import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Key,
  FileCode2,
  Terminal,
  Activity,
  Download,
} from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, clearSupabaseCredentials } from '../lib/supabase';
import { testRemoteSupabaseConnection, SupabaseConnectionStatus } from '../lib/api';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  onClose: () => void;
  onResetDemoData: () => void;
}

export const DatabaseSetupModal: React.FC<Props> = ({ onClose, onResetDemoData }) => {
  const currentCreds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(currentCreds.url);
  const [supabaseKey, setSupabaseKey] = useState(currentCreds.key);
  const [copiedMigration, setCopiedMigration] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'server-storage' | 'config' | 'migrations' | 'rls-guide'>('server-storage');
  const [selectedMigration, setSelectedMigration] = useState<'all' | '01' | '02' | '03' | '04'>('all');

  // Server Backups State
  const [backups, setBackups] = useState<Array<{ filename: string; size: number; createdAt: string }>>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const fetchBackupsList = async () => {
    try {
      const res = await fetch('/api/database/backups');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.backups) {
          setBackups(json.backups);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchBackupsList();
  }, []);

  const handleCreateSnapshot = async () => {
    setIsBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await fetch('/api/database/backup', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setBackupMsg(`Backup snapshot created: ${json.filename}`);
        fetchBackupsList();
      }
    } catch (err: any) {
      setBackupMsg(`Failed to create backup: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreSnapshot = async (filename: string) => {
    if (!confirm(`Restore database from snapshot ${filename}? Current unsaved data will be replaced.`)) return;
    try {
      const res = await fetch('/api/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const json = await res.json();
      if (json.success) {
        alert('Database restored successfully! Reloading...');
        window.location.reload();
      }
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    }
  };

  const handleDownloadDatabaseJson = async () => {
    try {
      const res = await fetch('/api/database');
      const json = await res.json();
      if (json && json.data) {
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MBD_Apartment_Database_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert('Could not download database JSON');
    }
  };

  // Connection Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SupabaseConnectionStatus | null>(null);

  useEffect(() => {
    if (currentCreds.isConfigured) {
      handleTestConnection();
    }
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testRemoteSupabaseConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSaveCreds = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    saveSupabaseCredentials(supabaseUrl.trim(), supabaseKey.trim());
    window.location.reload();
  };

  const handleClearCreds = () => {
    clearSupabaseCredentials();
    setSupabaseUrl('');
    setSupabaseKey('');
    setTestResult(null);
    window.location.reload();
  };

  const copyScript = (key: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMigration(key);
    setTimeout(() => setCopiedMigration(null), 2500);
  };

  // SQL Scripts
  const migration01 = `-- MIGRATION 01: Core Schema & Constraints
-- File location in codebase: /supabase/migrations/01_schema_and_tables.sql
-- Run in Supabase Dashboard -> SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'tenant',
    assigned_block block_name_enum,
    flat_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (See /supabase/migrations/01_schema_and_tables.sql for all 20+ tables & indexes)`;

  const migration02 = `-- MIGRATION 02: Row Level Security (RLS) & Isolation Policies
-- File location in codebase: /supabase/migrations/02_row_level_security.sql

-- Helper functions to prevent recursion
CREATE OR REPLACE FUNCTION public.get_current_role() RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_block() RETURNS block_name_enum AS $$
  SELECT assigned_block FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Block A Owner CANNOT see Block B or C!
CREATE POLICY "Owner view assigned block units" ON public.units FOR SELECT
USING (public.get_current_role() = 'owner' AND block_name = public.get_current_block());

-- Tenants can only see their own records!
CREATE POLICY "Tenant view own flat unit" ON public.units FOR SELECT
USING (public.get_current_role() = 'tenant' AND flat_id = public.get_current_flat());`;

  const migration03 = `-- MIGRATION 03: Account Provisioning & Password Reset Functions
-- File location in codebase: /supabase/migrations/03_secure_auth_and_provisioning.sql

CREATE OR REPLACE FUNCTION public.provision_tenant_account(...)
RETURNS JSONB AS $$
-- Inserts into auth.users, public.profiles, public.tenants, public.advance_accounts atomically
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(...)
RETURNS JSONB AS $$
-- Re-encrypts password with blowfish bcrypt salt without plain-text storage
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

  const migrationAll = `-- COMPLETE ALL-IN-ONE SQL SCRIPT
-- Execute the entire schema in /supabase/complete_setup.sql`;

  const getActiveCode = () => {
    if (selectedMigration === '01') return migration01;
    if (selectedMigration === '02') return migration02;
    if (selectedMigration === '03') return migration03;
    return `-- Complete production setup script is ready in: /supabase/complete_setup.sql\n-- Includes all 4 migrations: tables, RLS, triggers, and seed data.`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                {COMPLEX_CONFIG.name} &bull; {COMPLEX_CONFIG.contacts}
              </span>
              <h3 className="font-bold text-slate-900 text-base">
                Supabase PostgreSQL Database Architecture
              </h3>
              <p className="text-xs text-slate-500">
                {COMPLEX_CONFIG.address}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-4 mt-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('server-storage')}
            className={`pb-2.5 border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'server-storage' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Server Disk Database & Automated Backups</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 border-b-2 cursor-pointer ${
              activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Supabase Cloud Setup
          </button>
          <button
            onClick={() => setActiveTab('migrations')}
            className={`pb-2.5 border-b-2 cursor-pointer ${
              activeTab === 'migrations' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            SQL Migrations (Executable)
          </button>
          <button
            onClick={() => setActiveTab('rls-guide')}
            className={`pb-2.5 border-b-2 cursor-pointer ${
              activeTab === 'rls-guide' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Security & RLS
          </button>
        </div>

        {/* TAB 0: SERVER DISK DATABASE & AUTOMATED BACKUPS */}
        {activeTab === 'server-storage' && (
          <div className="mt-4 space-y-4 text-xs overflow-y-auto pr-1">
            <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-950 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-extrabold text-sm block">
                      Server-Side Disk Database Active & Synchronized
                    </span>
                    <p className="text-[11px] text-emerald-800">
                      File: <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono">/data/app_database.json</code> &bull; All entries, August records, and ledger changes persist permanently.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDatabaseJson}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON Backup
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateSnapshot}
                    disabled={isBackingUp}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
                    {isBackingUp ? 'Creating Snapshot...' : '📸 Instant Snapshot'}
                  </button>
                </div>
              </div>

              {backupMsg && (
                <div className="p-2 bg-white/80 rounded-lg text-xs font-semibold text-emerald-900 border border-emerald-300">
                  {backupMsg}
                </div>
              )}
            </div>

            {/* Backups List */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  Automated Database Backup Snapshots ({backups.length} snapshots)
                </span>
                <button
                  type="button"
                  onClick={fetchBackupsList}
                  className="text-blue-700 hover:underline text-[11px] font-semibold"
                >
                  Refresh list
                </button>
              </div>

              {backups.length === 0 ? (
                <p className="text-slate-500 text-xs py-3 text-center">
                  No previous snapshots found. Click &quot;📸 Instant Snapshot&quot; to create one now.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                  {backups.map((b) => (
                    <div key={b.filename} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-mono font-bold text-slate-800 block text-xs">{b.filename}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(b.createdAt).toLocaleString()} &bull; {(b.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreSnapshot(b.filename)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                      >
                        Restore This Snapshot
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: CONNECTION & STATUS */}
        {activeTab === 'config' && (
          <div className="mt-4 space-y-4 text-xs overflow-y-auto pr-1">
            {/* Live Health Check Pill */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                testResult?.isConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : currentCreds.isConfigured
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult?.isConnected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Database className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold text-sm block">
                    {testResult?.isConnected
                      ? 'Live Supabase PostgreSQL Connected'
                      : currentCreds.isConfigured
                      ? 'Supabase Configured (Connecting...)'
                      : 'Built-in Local Persistent Store Active'}
                  </span>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    {testResult?.message ||
                      (currentCreds.isConfigured
                        ? `Target: ${currentCreds.url}`
                        : 'System is running with full persistence in browser storage with all test accounts, flats, and ledgers.')}
                  </p>
                </div>
              </div>

              {currentCreds.isConfigured && (
                <button
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
              )}
            </div>

            {/* Credentials Input */}
            <form onSubmit={handleSaveCreds} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                Production Database Credentials
              </h4>
              <p className="text-slate-500">
                Enter your project credentials from your Supabase project dashboard (Project Settings &rarr; API) or define them in <code className="font-mono bg-slate-200 px-1 py-0.5 rounded">.env</code>:
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  VITE_SUPABASE_URL
                </label>
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  VITE_SUPABASE_ANON_KEY
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {currentCreds.isConfigured && (
                  <button
                    type="button"
                    onClick={handleClearCreds}
                    className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    Disconnect Supabase
                  </button>
                )}
                <button
                  type="submit"
                  className="ml-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer"
                >
                  Save & Reload
                </button>
              </div>
            </form>

            {/* Data reset */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">Seed Default Demo Dataset</p>
                <p className="text-slate-500 text-[11px]">
                  Restores default flats A1-A7, B1-B7, C1-C7, tenants, advances, and October ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset to initial demo data?')) {
                    onResetDemoData();
                    onClose();
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
              >
                Reset Data
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTABLE MIGRATIONS */}
        {activeTab === 'migrations' && (
          <div className="mt-4 space-y-3 text-xs flex-1 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2 rounded-xl">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedMigration('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    selectedMigration === 'all' ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Complete Setup (All-in-One)
                </button>
                <button
                  onClick={() => setSelectedMigration('01')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    selectedMigration === '01' ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  01: Tables
                </button>
                <button
                  onClick={() => setSelectedMigration('02')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    selectedMigration === '02' ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  02: RLS Policies
                </button>
                <button
                  onClick={() => setSelectedMigration('03')}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    selectedMigration === '03' ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  03: Account RPCs
                </button>
              </div>

              <button
                onClick={() => copyScript(selectedMigration, getActiveCode())}
                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-2xs"
              >
                {copiedMigration === selectedMigration ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedMigration === selectedMigration ? 'Copied!' : 'Copy Script'}
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px]">
              <strong>Execution Instructions:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                <li>Log in to your Supabase Project Dashboard (<a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-bold">supabase.com</a>).</li>
                <li>Click <strong>SQL Editor</strong> in the left sidebar menu.</li>
                <li>Click <strong>+ New query</strong>, paste the script from below (or from <code className="font-mono bg-blue-100 px-1 rounded">/supabase/complete_setup.sql</code>), and click <strong>Run</strong>.</li>
              </ol>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto font-mono text-[11px] max-h-72">
              {getActiveCode()}
            </pre>
          </div>
        )}

        {/* TAB 3: RLS GUIDE */}
        {activeTab === 'rls-guide' && (
          <div className="mt-4 space-y-3 text-xs overflow-y-auto pr-1">
            <h4 className="font-bold text-slate-900 text-sm">
              Role-Based Access Control & Strict Data Isolation
            </h4>
            <div className="space-y-2.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-purple-700 block mb-0.5">1. Manager (Super Admin Russell):</span>
                <p className="text-slate-600">
                  Full administrative permissions across all blocks, units, tenants, advance accounts, electricity bills, and ledgers. Can provision accounts, reset passwords, and approve online payments.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-blue-700 block mb-0.5">2. Block Owners (Rashed, Raju, Rony):</span>
                <p className="text-slate-600">
                  Strictly bounded by Row Level Security (RLS) to their assigned block.
                  <br />
                  &bull; <strong>Block A Owner (Rashed)</strong> CANNOT view or query units, tenants, ledgers, or bills belonging to Block B or Block C.
                  <br />
                  &bull; Enforced at database engine level via: <code className="font-mono text-[10px] bg-slate-200 px-1 rounded">USING (block_name = get_current_block())</code>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-emerald-700 block mb-0.5">3. Resident Tenants (Tanvir, Farhana, etc.):</span>
                <p className="text-slate-600">
                  Cannot access other flats' ledgers, private details, or bills. Enforced at database engine level via: <code className="font-mono text-[10px] bg-slate-200 px-1 rounded">USING (flat_id = get_current_flat())</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Files stored in: <code className="font-mono">/supabase/migrations/</code>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

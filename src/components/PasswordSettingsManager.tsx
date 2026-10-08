import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Building,
  UserCheck,
  Save,
  Filter,
  AlertTriangle,
  Info,
  Phone,
  Sparkles,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { AppDatabaseState, SecurityCredentials } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { getLast11Digits, compareFlatIdSerial } from '../lib/storage';
import { exportAllCredentialsToExcel } from '../lib/exportCredentials';

interface Props {
  data: AppDatabaseState;
  onUpdateSecurityCredentials: (credentials: SecurityCredentials, auditNote?: string) => void;
}

export const PasswordSettingsManager: React.FC<Props> = ({
  data,
  onUpdateSecurityCredentials,
}) => {
  // Current security credentials from state
  const initialCreds: SecurityCredentials = data.securityCredentials || {
    isManagerPasswordInitialized: false,
    authorityPasswords: {
      manager: '',
      ownerA: 'rashed123',
      ownerB: 'raju123',
      ownerC: 'rony123',
    },
    unitPasswords: {},
  };

  const [authorityPasswords, setAuthorityPasswords] = useState({
    manager: initialCreds.authorityPasswords.manager || '',
    ownerA: initialCreds.authorityPasswords.ownerA || 'rashed123',
    ownerB: initialCreds.authorityPasswords.ownerB || 'raju123',
    ownerC: initialCreds.authorityPasswords.ownerC || 'rony123',
  });

  const [unitPasswords, setUnitPasswords] = useState<Record<string, string>>({
    ...initialCreds.unitPasswords,
  });

  // Show/hide password states
  const [showAuthorityPass, setShowAuthorityPass] = useState<Record<string, boolean>>({});
  const [showUnitPass, setShowUnitPass] = useState<Record<string, boolean>>({});

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<'all' | 'Block A' | 'Block B' | 'Block C' | 'Other'>('all');
  const [filterCustomOnly, setFilterCustomOnly] = useState(false);

  // Status feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedFlatId, setCopiedFlatId] = useState<string | null>(null);
  const [isResetAllConfirmOpen, setIsResetAllConfirmOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Helper to get tenant info for a flat
  const getFlatResidentInfo = (flatId: string) => {
    // Current month ledger item
    const ledgerItem = data.ledgerItems.find(
      (item) =>
        item.flatId === flatId &&
        item.month === data.selectedMonth &&
        item.year === data.selectedYear
    );
    // Fallback to latest ledger item for that flat if none in current month
    const anyLedger = ledgerItem || data.ledgerItems.find((item) => item.flatId === flatId);
    const tenant = data.tenants.find((t) => t.flatId === flatId);

    const name = ledgerItem?.tenantName || anyLedger?.tenantName || tenant?.fullName || 'Vacant / Unassigned';
    const phone = ledgerItem?.tenantPhone || anyLedger?.tenantPhone || tenant?.phone || '01700-000000';

    return { name, phone };
  };

  // Save Authority Passwords
  const handleSaveAuthorityPasswords = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const updated: SecurityCredentials = {
      ...initialCreds,
      isManagerPasswordInitialized: Boolean(authorityPasswords.manager && authorityPasswords.manager.trim().length > 0),
      authorityPasswords: {
        manager: authorityPasswords.manager.trim(),
        ownerA: authorityPasswords.ownerA.trim() || 'rashed123',
        ownerB: authorityPasswords.ownerB.trim() || 'raju123',
        ownerC: authorityPasswords.ownerC.trim() || 'rony123',
      },
      unitPasswords: { ...unitPasswords },
    };

    onUpdateSecurityCredentials(updated, 'Updated authority login passwords (Manager & Block Owners)');
    showToast('Authority passwords saved successfully!');
  };

  // Update single unit password
  const handleSetUnitPassword = (flatId: string, customPass: string) => {
    const updatedUnitPasswords = { ...unitPasswords };
    if (!customPass || customPass.trim() === '') {
      delete updatedUnitPasswords[flatId];
    } else {
      updatedUnitPasswords[flatId] = customPass.trim();
    }
    setUnitPasswords(updatedUnitPasswords);

    const updated: SecurityCredentials = {
      ...initialCreds,
      authorityPasswords: { ...authorityPasswords },
      unitPasswords: updatedUnitPasswords,
    };

    onUpdateSecurityCredentials(updated, `Updated password override for unit ${flatId}`);
    showToast(`Saved password for Flat ${flatId}`);
  };

  // Reset single unit to default phone
  const handleResetUnitToDefaultPhone = (flatId: string) => {
    const updatedUnitPasswords = { ...unitPasswords };
    delete updatedUnitPasswords[flatId];
    setUnitPasswords(updatedUnitPasswords);

    const updated: SecurityCredentials = {
      ...initialCreds,
      authorityPasswords: { ...authorityPasswords },
      unitPasswords: updatedUnitPasswords,
    };

    onUpdateSecurityCredentials(updated, `Reset Flat ${flatId} to default phone password`);
    showToast(`Flat ${flatId} reset to default mobile number password`);
  };

  // Reset all units to default phone
  const handleResetAllUnits = () => {
    setUnitPasswords({});
    const updated: SecurityCredentials = {
      ...initialCreds,
      authorityPasswords: { ...authorityPasswords },
      unitPasswords: {},
    };

    onUpdateSecurityCredentials(updated, 'Reset all residential units to default phone numbers');
    setIsResetAllConfirmOpen(false);
    showToast('All units reset to default mobile number login');
  };

  // Copy tenant credential instruction to clipboard
  const handleCopyCredentials = (flatId: string) => {
    const { name, phone } = getFlatResidentInfo(flatId);
    const activePass = unitPasswords[flatId] || getLast11Digits(phone);
    const text = `🏢 ${COMPLEX_CONFIG.name} Resident Portal\nFlat: ${flatId}\nResident: ${name}\nLogin Password: ${activePass}\nPortal Link: http://localhost:5173\nManager Hotline: ${COMPLEX_CONFIG.managerPhone}`;

    navigator.clipboard.writeText(text);
    setCopiedFlatId(flatId);
    showToast(`Copied login credentials for Flat ${flatId}`);
    setTimeout(() => {
      setCopiedFlatId(null);
    }, 2500);
  };

  // Filtered unit list
  const filteredUnits = data.units.filter((unit) => {
    // Block filter
    if (selectedBlockFilter === 'Block A' && unit.blockName !== 'Block A') return false;
    if (selectedBlockFilter === 'Block B' && unit.blockName !== 'Block B') return false;
    if (selectedBlockFilter === 'Block C' && unit.blockName !== 'Block C') return false;
    if (selectedBlockFilter === 'Other' && (unit.blockName === 'Block A' || unit.blockName === 'Block B' || unit.blockName === 'Block C')) return false;

    // Custom only
    const hasCustom = Boolean(unitPasswords[unit.flatId]);
    if (filterCustomOnly && !hasCustom) return false;

    // Search filter
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    const { name, phone } = getFlatResidentInfo(unit.flatId);
    return (
      unit.flatId.toLowerCase().includes(query) ||
      unit.blockName.toLowerCase().includes(query) ||
      name.toLowerCase().includes(query) ||
      phone.toLowerCase().includes(query)
    );
  })
  .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Reset All */}
      {isResetAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Reset All Unit Passwords?</h3>
                <p className="text-xs text-slate-500">Super Admin Master Action</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will remove all custom password overrides across all flats. Every resident will log in using their default registered mobile number listed in the current monthly ledger.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setIsResetAllConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAllUnits}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
              >
                Yes, Reset All Units
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Super Admin Security Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Password Settings & Access Control
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Full control over authority accounts (Manager Russell and 3 Block Owners) and complete power to set, customize, or reset passwords for all residential units.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const ok = exportAllCredentialsToExcel(data);
                if (ok) showToast('Exported all passwords & login IDs to Excel (.xlsx) successfully!');
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-emerald-900/40"
              title="1-Click export all flat IDs and login passwords for all tenants & authority accounts (.xlsx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>1-Click Export Passwords (.xlsx)</span>
            </button>

            <button
              onClick={() => setIsResetAllConfirmOpen(true)}
              className="px-4 py-2.5 bg-slate-800/80 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700/60 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset All Units to Phone</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: AUTHORITY PASSWORDS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">Authority Accounts Passwords</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Set login credentials for Manager Russell and the 3 Block Owners (Rashed, Raju, Rony).
            </p>
          </div>

          <button
            onClick={handleSaveAuthorityPasswords}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer self-start sm:self-auto"
          >
            <Save className="w-4 h-4" />
            <span>Save Authority Passwords</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Russell (Manager) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-blue-600 text-white">
                Super Admin
              </span>
              <span className="text-[10px] font-bold text-blue-900">
                {authorityPasswords.manager ? 'Password Configured' : 'First-time Setup'}
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Russell (Manager)</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">{COMPLEX_CONFIG.managerPhone}</p>
              <p className="text-[10px] text-slate-500">akandarussell@gmail.com</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Master Password</label>
              <div className="relative">
                <input
                  type={showAuthorityPass['manager'] ? 'text' : 'password'}
                  placeholder="Set master password"
                  value={authorityPasswords.manager}
                  onChange={(e) =>
                    setAuthorityPasswords({ ...authorityPasswords, manager: e.target.value })
                  }
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAuthorityPass({
                      ...showAuthorityPass,
                      manager: !showAuthorityPass['manager'],
                    })
                  }
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showAuthorityPass['manager'] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Rashed (Block A Owner) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/70 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white">
                Block A Owner
              </span>
              <span className="text-[10px] font-bold text-emerald-900">Units A1-A8</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Md. Rashed (Owner)</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">01717623061</p>
              <p className="text-[10px] text-slate-500">rashed.blocka@mbdapartment.com</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Access Password</label>
              <div className="relative">
                <input
                  type={showAuthorityPass['ownerA'] ? 'text' : 'password'}
                  placeholder="Default: rashed123"
                  value={authorityPasswords.ownerA}
                  onChange={(e) =>
                    setAuthorityPasswords({ ...authorityPasswords, ownerA: e.target.value })
                  }
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAuthorityPass({
                      ...showAuthorityPass,
                      ownerA: !showAuthorityPass['ownerA'],
                    })
                  }
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showAuthorityPass['ownerA'] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Raju (Block B Owner) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-indigo-600 text-white">
                Block B Owner
              </span>
              <span className="text-[10px] font-bold text-indigo-900">Units B1-B7</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Md. Raju (Owner)</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">01913858775</p>
              <p className="text-[10px] text-slate-500">raju.blockb@mbdapartment.com</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Access Password</label>
              <div className="relative">
                <input
                  type={showAuthorityPass['ownerB'] ? 'text' : 'password'}
                  placeholder="Default: raju123"
                  value={authorityPasswords.ownerB}
                  onChange={(e) =>
                    setAuthorityPasswords({ ...authorityPasswords, ownerB: e.target.value })
                  }
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-600 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAuthorityPass({
                      ...showAuthorityPass,
                      ownerB: !showAuthorityPass['ownerB'],
                    })
                  }
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showAuthorityPass['ownerB'] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Rony (Block C Owner) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-pink-50/70 border border-purple-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-purple-600 text-white">
                Block C Owner
              </span>
              <span className="text-[10px] font-bold text-purple-900">Units C1-C7</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Md. Rony (Owner)</h3>
              <p className="text-[11px] text-slate-600 mt-0.5">01712118547</p>
              <p className="text-[10px] text-slate-500">rony.blockc@mbdapartment.com</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Access Password</label>
              <div className="relative">
                <input
                  type={showAuthorityPass['ownerC'] ? 'text' : 'password'}
                  placeholder="Default: rony123"
                  value={authorityPasswords.ownerC}
                  onChange={(e) =>
                    setAuthorityPasswords({ ...authorityPasswords, ownerC: e.target.value })
                  }
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowAuthorityPass({
                      ...showAuthorityPass,
                      ownerC: !showAuthorityPass['ownerC'],
                    })
                  }
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showAuthorityPass['ownerC'] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: UNIT & RESIDENT PASSWORDS (SUPER ADMIN POWER) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-700" />
              <h2 className="text-lg font-black text-slate-900">Unit & Resident Login Passwords</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              By default, each unit logs in with their mobile number in the current month ledger. You can set a custom override password for any unit or reset back to default phone anytime.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-xl font-bold border border-blue-200">
              Total Units: {data.units.length}
            </span>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl font-bold border border-amber-200">
              Custom Overrides: {Object.keys(unitPasswords).length}
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Block Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(['all', 'Block A', 'Block B', 'Block C', 'Other'] as const).map((block) => (
              <button
                key={block}
                onClick={() => setSelectedBlockFilter(block)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedBlockFilter === block
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {block === 'all' ? 'All Units' : block}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Custom Only Toggle */}
            <button
              onClick={() => setFilterCustomOnly(!filterCustomOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                filterCustomOnly
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Custom Passwords Only</span>
            </button>

            {/* Quick Export Button */}
            <button
              onClick={() => {
                const filter = selectedBlockFilter === 'all' || selectedBlockFilter === 'Other' ? undefined : selectedBlockFilter;
                const ok = exportAllCredentialsToExcel(data, { blockFilter: filter });
                if (ok) showToast(`Exported ${filter || 'all'} passwords to Excel!`);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Export displayed units to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>

            {/* Search Box */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search flat (e.g. A1, B4) or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Units Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Flat Number</th>
                <th className="py-3 px-4">Resident Tenant</th>
                <th className="py-3 px-4">Default Password (Last 11 Digits)</th>
                <th className="py-3 px-4">Active Login Password</th>
                <th className="py-3 px-4 text-right">Super Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    No units found matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => {
                  const flatId = unit.flatId;
                  const { name, phone } = getFlatResidentInfo(flatId);
                  const last11Digits = getLast11Digits(phone);
                  const customPass = unitPasswords[flatId] || '';
                  const hasCustomOverride = Boolean(customPass);
                  const isOwnerUnit = flatId.toLowerCase().includes('owner');

                  return (
                    <tr
                      key={unit.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Flat ID & Block */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-black text-xs shrink-0">
                            {flatId}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-900 block">Flat {flatId}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{unit.blockName} &bull; Floor {unit.floor}</span>
                          </div>
                        </div>
                      </td>

                      {/* Resident Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800 block">{name}</span>
                            <span className="text-[10px] text-slate-500">
                              {isOwnerUnit ? 'Owner Residence' : unit.isOccupied ? 'Active Resident' : 'Vacant'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Default Last 11 Digits Phone */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 w-fit">
                            <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold text-xs">{last11Digits}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                            <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Active Password & Override Input */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 max-w-xs">
                          <div className="flex items-center gap-2">
                            {hasCustomOverride ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                Custom Override Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Default Last 11 Digits Active
                              </span>
                            )}
                          </div>

                          <div className="relative flex items-center gap-1">
                            <input
                              type={showUnitPass[flatId] ? 'text' : 'password'}
                              placeholder={`Default: ${last11Digits}`}
                              value={unitPasswords[flatId] !== undefined ? unitPasswords[flatId] : ''}
                              onChange={(e) => {
                                setUnitPasswords({
                                  ...unitPasswords,
                                  [flatId]: e.target.value,
                                });
                              }}
                              className={`w-full pl-2.5 pr-8 py-1.5 rounded-lg text-xs font-mono font-semibold focus:outline-hidden border ${
                                hasCustomOverride
                                  ? 'bg-amber-50/50 border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'
                                  : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-600'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowUnitPass({
                                  ...showUnitPass,
                                  [flatId]: !showUnitPass[flatId],
                                })
                              }
                              className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              {showUnitPass[flatId] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Save / Apply button */}
                          <button
                            onClick={() => handleSetUnitPassword(flatId, unitPasswords[flatId] || '')}
                            title="Save custom password for this flat"
                            className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Save className="w-3 h-3" />
                            <span>Save</span>
                          </button>

                          {/* Reset to Phone button */}
                          {hasCustomOverride && (
                            <button
                              onClick={() => handleResetUnitToDefaultPhone(flatId)}
                              title="Reset back to default mobile number"
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Reset to Phone</span>
                            </button>
                          )}

                          {/* Copy Info button */}
                          <button
                            onClick={() => handleCopyCredentials(flatId)}
                            title="Copy login info for SMS or WhatsApp to tenant"
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedFlatId === flatId ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

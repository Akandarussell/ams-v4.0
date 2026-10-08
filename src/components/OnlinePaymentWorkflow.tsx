import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  ShieldCheck,
  Search,
  Building,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Save,
  CheckCircle2,
  User,
  Smartphone,
} from 'lucide-react';
import { AppDatabaseState, OnlinePaymentRequest, PaymentSettings, BlockMfsConfig } from '../types';
import { formatBDT, formatDateDDMMYYYY } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { INITIAL_BLOCK_MFS_CONFIGS } from '../lib/storage';

interface Props {
  data: AppDatabaseState;
  onVerifyPayment: (requestId: string, status: 'Verified' | 'Rejected') => void;
  onUpdatePaymentSettings: (settings: PaymentSettings) => void;
}

export const OnlinePaymentWorkflow: React.FC<Props> = ({
  data,
  onVerifyPayment,
  onUpdatePaymentSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'settings'>('requests');
  const [searchTerm, setSearchTerm] = useState('');

  // Payment settings form state with guaranteed blockConfigs for Block A, B, C
  const [settings, setSettings] = useState<PaymentSettings>(() => ({
    ...data.paymentSettings,
    blockConfigs: {
      ...INITIAL_BLOCK_MFS_CONFIGS,
      ...(data.paymentSettings?.blockConfigs || {}),
    },
  }));
  const [settingsSaved, setSettingsSaved] = useState(false);

  const handleToggleBlockMfs = (block: 'Block A' | 'Block B' | 'Block C') => {
    const currentBlock = settings.blockConfigs[block] || INITIAL_BLOCK_MFS_CONFIGS[block];
    const updated: PaymentSettings = {
      ...settings,
      blockConfigs: {
        ...settings.blockConfigs,
        [block]: {
          ...currentBlock,
          isMfsEnabled: !currentBlock.isMfsEnabled,
        },
      },
    };
    setSettings(updated);
    onUpdatePaymentSettings(updated);
  };

  const handleBlockConfigChange = (
    block: 'Block A' | 'Block B' | 'Block C',
    field: keyof BlockMfsConfig,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      blockConfigs: {
        ...prev.blockConfigs,
        [block]: {
          ...prev.blockConfigs[block],
          [field]: value,
        },
      },
    }));
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePaymentSettings(settings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const filteredRequests = data.onlineRequests.filter((r) => {
    const search = searchTerm.toLowerCase();
    return (
      r.flatId.toLowerCase().includes(search) ||
      r.tenantName.toLowerCase().includes(search) ||
      r.transactionId.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </span>
          <div>
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
              {COMPLEX_CONFIG.name}
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Online MFS Payment Approvals
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {COMPLEX_CONFIG.address}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify bKash, Nagad, and Rocket payments &bull; Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Payment Queue ({data.onlineRequests.filter((r) => r.verificationStatus === 'Pending').length} Pending)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            MFS Gateway Settings
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search TrxID, Flat, Tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <span className="text-xs text-slate-500">
              {filteredRequests.length} Transactions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Flat & Block</th>
                  <th className="py-3 px-4">Tenant Name</th>
                  <th className="py-3 px-4">Method & TrxID</th>
                  <th className="py-3 px-4">Recipient Owner Account</th>
                  <th className="py-3 px-4 text-right">Amount & 1.8% Fee</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      No online payment requests pending verification.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-blue-700">
                        Flat {req.flatId}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {req.blockName || (req.flatId.startsWith('B') ? 'Block B' : req.flatId.startsWith('C') ? 'Block C' : 'Block A')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {req.tenantName}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.paymentMethod === 'bKash'
                                ? 'bg-pink-100 text-pink-700'
                                : req.paymentMethod === 'Nagad'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {req.paymentMethod}
                          </span>
                          <span className="font-mono font-bold text-slate-800 text-[11px]">
                            {req.transactionId}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="font-semibold text-slate-900 block">
                          {req.recipientOwnerName || 'Block Owner'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {req.recipientNumber || 'MFS Number'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-emerald-600 text-xs">
                          {formatBDT(req.amount)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Base: {formatBDT(req.baseAmount || req.amount)} (+{formatBDT(req.feeAmount || 0)} 1.8%)
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDateDDMMYYYY(req.submissionDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.verificationStatus === 'Verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.verificationStatus === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {req.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {req.verificationStatus === 'Pending' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onVerifyPayment(req.id, 'Verified')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                            >
                              Verify & Post
                            </button>
                            <button
                              onClick={() => onVerifyPayment(req.id, 'Rejected')}
                              className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Settings Form: 3 Blocks Owner MFS Availability & 3 Owners' Account Numbers */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="font-bold text-slate-900 text-lg">
              Block Owners MFS Availability & Account Numbers
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure each block owner&apos;s toggle button to enable or disable receiving payments via Pay Online via MFS (bKash / Nagad / Rocket) in their own number (3 different numbers for 3 owners) with extra 1.8% fee addings. When turned OFF, tenants must pay physically.
            </p>
          </div>

          {settingsSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              All Block MFS configurations and toggle states saved successfully!
            </div>
          )}

          <form onSubmit={handleSettingsSubmit} className="space-y-6 text-xs">
            {/* 3 BLOCKS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {(['Block A', 'Block B', 'Block C'] as const).map((blockKey) => {
                const bConfig = settings.blockConfigs[blockKey] || INITIAL_BLOCK_MFS_CONFIGS[blockKey];
                const isEnabled = bConfig.isMfsEnabled;

                return (
                  <div
                    key={blockKey}
                    className={`rounded-2xl border p-5 transition-all ${
                      isEnabled
                        ? 'border-emerald-200 bg-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    {/* Block Card Header with Toggle Switch */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm">{blockKey}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isEnabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isEnabled ? 'MFS: ON' : 'MFS: OFF'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Owner: <strong>{bConfig.ownerName}</strong> &bull; {bConfig.ownerPhone}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleBlockMfs(blockKey)}
                        className={`p-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                          isEnabled
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                        }`}
                        title={`Click to turn MFS ${isEnabled ? 'OFF' : 'ON'} for ${blockKey}`}
                      >
                        {isEnabled ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-emerald-100" />
                            <span className="pr-1 text-[11px]">ON</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-slate-500" />
                            <span className="pr-1 text-[11px]">OFF</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Status note */}
                    <div
                      className={`p-2.5 rounded-xl border text-[11px] mb-4 ${
                        isEnabled
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/60 border-amber-200 text-amber-900'
                      }`}
                    >
                      {isEnabled ? (
                        <span>
                          🟢 <strong>Online MFS Active:</strong> {blockKey} tenants see {bConfig.ownerName}&apos;s accounts with +1.8% cashout fee added.
                        </span>
                      ) : (
                        <span>
                          🔴 <strong>Online MFS Disabled:</strong> {blockKey} tenants see online MFS is unavailable and must pay physically in cash.
                        </span>
                      )}
                    </div>

                    {/* Owner Accounts Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          bKash Number ({bConfig.ownerName})
                        </label>
                        <input
                          type="text"
                          value={bConfig.bkashNumber}
                          onChange={(e) => handleBlockConfigChange(blockKey, 'bkashNumber', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Nagad Number ({bConfig.ownerName})
                        </label>
                        <input
                          type="text"
                          value={bConfig.nagadNumber}
                          onChange={(e) => handleBlockConfigChange(blockKey, 'nagadNumber', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Rocket Number ({bConfig.ownerName})
                        </label>
                        <input
                          type="text"
                          value={bConfig.rocketNumber}
                          onChange={(e) => handleBlockConfigChange(blockKey, 'rocketNumber', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Extra Cashout Fee:</span>
                        <span className="font-bold text-slate-800 font-mono">
                          +{bConfig.mfsFeePercentage || 1.8}% (Automatic Adding)
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-bold text-slate-700 block">Direct Bank Deposit:</span>
                          <span className="text-[10px] text-slate-500">Islami Bank (2050 3219 9801 8587)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBlockConfigChange(blockKey, 'isBankDepositAllowed', !bConfig.isBankDepositAllowed)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                            bConfig.isBankDepositAllowed
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={`Click to ${bConfig.isBankDepositAllowed ? 'hide bank details from' : 'permit bank details for'} ${blockKey} tenants`}
                        >
                          {bConfig.isBankDepositAllowed ? 'Permitted (ON)' : 'Hidden (OFF)'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Changes apply instantly across tenant portals, owner dashboards, and payment requests.
              </p>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save All Block MFS Configurations
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

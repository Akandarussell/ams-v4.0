import React, { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  Receipt,
  Search,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  SlidersHorizontal,
  Building,
} from 'lucide-react';
import {
  AppDatabaseState,
  AdvanceAccount,
  PaymentMethod,
  PrintableReceipt,
} from '../types';
import { formatBDT, formatDateDDMMYYYY } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { compareFlatIdSerial } from '../lib/storage';

interface Props {
  data: AppDatabaseState;
  onRecordAdvancePayment: (
    flatId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    transactionId?: string,
    notes?: string
  ) => void;
  onViewReceipt: (receipt: PrintableReceipt) => void;
  userRole: string;
  assignedBlock?: string;
}

export const AdvancePaymentManager: React.FC<Props> = ({
  data,
  onRecordAdvancePayment,
  onViewReceipt,
  userRole,
  assignedBlock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [blockFilter, setBlockFilter] = useState<string>(
    userRole === 'owner' && assignedBlock ? assignedBlock : 'all'
  );
  const [sortBy, setSortBy] = useState<'flat' | 'paid' | 'remaining' | 'required'>('flat');
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Deposit Form State
  const [selectedFlatId, setSelectedFlatId] = useState<string>('A1');
  const [depositAmount, setDepositAmount] = useState<number>(20000);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('Bank Transfer');
  const [depositTxnId, setDepositTxnId] = useState<string>('');
  const [depositNotes, setDepositNotes] = useState<string>('Security advance deposit');

  // Scoped accounts for current role
  const scopedAccounts = data.advanceAccounts.filter((account) => {
    const unit = data.units.find((u) => u.flatId === account.flatId);
    if (userRole === 'owner' && assignedBlock && unit?.blockName !== assignedBlock) {
      return false;
    }
    return true;
  });

  // Dynamic counts for status tabs
  const countAll = scopedAccounts.length;
  const countPaid = scopedAccounts.filter((a) => a.status === 'paid').length;
  const countPartial = scopedAccounts.filter((a) => a.status === 'partially_paid').length;
  const countNotPaid = scopedAccounts.filter((a) => a.status === 'not_paid').length;

  const isFilterActive =
    searchTerm.trim() !== '' ||
    (userRole !== 'owner' && blockFilter !== 'all') ||
    statusFilter !== 'all' ||
    sortBy !== 'flat';

  const resetFilters = () => {
    setSearchTerm('');
    if (userRole !== 'owner') setBlockFilter('all');
    setStatusFilter('all');
    setSortBy('flat');
  };

  // Filter accounts
  const filteredAccounts = scopedAccounts
    .filter((account) => {
      const unit = data.units.find((u) => u.flatId === account.flatId);
      if (blockFilter !== 'all' && unit?.blockName !== blockFilter) {
        return false;
      }
      if (statusFilter !== 'all' && account.status !== statusFilter) {
        return false;
      }
      const tenant = data.tenants.find((t) => t.id === account.tenantId);
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (
        account.flatId.toLowerCase().includes(search) ||
        (tenant?.fullName.toLowerCase().includes(search) ?? false) ||
        (unit?.blockName.toLowerCase().includes(search) ?? false)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'paid') return (b.amountPaid - a.amountPaid) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'remaining') return ((b.totalRequired - b.amountPaid) - (a.totalRequired - a.amountPaid)) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'required') return (b.totalRequired - a.totalRequired) || compareFlatIdSerial(a.flatId, b.flatId);
      return compareFlatIdSerial(a.flatId, b.flatId);
    });

  // Aggregates
  const totalRequired = filteredAccounts.reduce((sum, a) => sum + a.totalRequired, 0);
  const totalPaid = filteredAccounts.reduce((sum, a) => sum + a.amountPaid, 0);
  const totalRemaining = filteredAccounts.reduce((sum, a) => sum + Math.max(0, a.totalRequired - a.amountPaid), 0);

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) return;
    onRecordAdvancePayment(selectedFlatId, depositAmount, depositMethod, depositTxnId, depositNotes);
    setIsDepositModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <Wallet className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Advance & Security Deposit Management
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {COMPLEX_CONFIG.name} &bull; {COMPLEX_CONFIG.address}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Escrow accounting, initial deposits, and adjustment records &bull; Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
            </p>
          </div>
        </div>

        {userRole === 'manager' && (
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Record Advance Deposit
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Required Advance</span>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatBDT(totalRequired)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Based on 2 months security deposit agreements</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Advance Collected</span>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            {formatBDT(totalPaid)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {Math.round((totalPaid / (totalRequired || 1)) * 100)}% of total security deposits secured
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Advance Balance</span>
          <div className="text-2xl font-black text-amber-600 mt-2 font-mono">
            {formatBDT(totalRemaining)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Pending payments from installments</p>
        </div>
      </div>

      {/* Comprehensive Data Filtering Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Status Tabs */}
        <div className="p-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
              Advance Accounts Filter Bar
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countAll}</span>
            </button>

            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              <span>Fully Paid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPaid}</span>
            </button>

            <button
              onClick={() => setStatusFilter('partially_paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'partially_paid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <span>Partially Paid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPartial}</span>
            </button>

            <button
              onClick={() => setStatusFilter('not_paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'not_paid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-800 text-rose-300 hover:bg-slate-700'
              }`}
            >
              <span>Not Paid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countNotPaid}</span>
            </button>
          </div>
        </div>

        {/* Detailed Controls Row */}
        <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Flat ID or Tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Block Filter */}
            {userRole !== 'owner' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> Block:
                </span>
                <select
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="all">All Blocks</option>
                  <option value="Block A">Block A</option>
                  <option value="Block B">Block B</option>
                  <option value="Block C">Block C</option>
                </select>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-800">
                {assignedBlock} Active
              </div>
            )}

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-semibold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="flat">Flat ID</option>
                <option value="paid">Amount Paid (High to Low)</option>
                <option value="remaining">Remaining Due (High to Low)</option>
                <option value="required">Total Required</option>
              </select>
            </div>

            {isFilterActive && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredAccounts.length}</strong> of {scopedAccounts.length} accounts
          </div>
        </div>

        {/* Advance Accounts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Flat ID</th>
                <th className="py-3 px-4">Tenant Name</th>
                <th className="py-3 px-4 text-right">Required Advance</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Remaining Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Payment Date</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-center no-print">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredAccounts.map((account) => {
                const tenant = data.tenants.find((t) => t.id === account.tenantId);
                const remaining = Math.max(0, account.totalRequired - account.amountPaid);
                return (
                  <tr key={account.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-indigo-700 font-sans">
                      Flat {account.flatId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 font-sans">
                      {tenant?.fullName || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-800">
                      {formatBDT(account.totalRequired)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatBDT(account.amountPaid)}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${remaining > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {formatBDT(remaining)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          account.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : account.status === 'partially_paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {account.status === 'paid' ? 'Fully Paid' : account.status === 'partially_paid' ? 'Partially Paid' : 'Not Paid'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDateDDMMYYYY(account.lastPaymentDate)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-sans max-w-xs truncate">
                      {account.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-sans no-print">
                      {account.amountPaid > 0 ? (
                        <button
                          onClick={() => {
                            const unit = data.units.find((u) => u.flatId === account.flatId);
                            onViewReceipt({
                              receiptNumber: `ADV-REC-${account.flatId}-${data.selectedYear}`,
                              type: 'advance',
                              tenantName: tenant?.fullName || 'Tenant',
                              tenantPhone: tenant?.phone || '',
                              flatId: account.flatId,
                              blockName: unit?.blockName || 'Block A',
                              amount: account.amountPaid,
                              paymentDate: account.lastPaymentDate || '2026-01-01',
                              paymentMethod: 'Bank Transfer',
                              purpose: `Security Advance Deposit for Residential Flat Agreement - Flat ${account.flatId}`,
                              remainingAdvance: account.amountPaid,
                              remainingDue: remaining,
                              authorizedSignatureBy: 'Russell',
                              signatureTitle: 'Russell (Manager)',
                              notes: account.notes,
                              breakdown: [
                                { label: 'Security Advance Deposit', amount: account.amountPaid },
                              ],
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold transition-colors cursor-pointer"
                          title="Generate Official Advance Payment Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advance Audit Trail (Never overwrite earlier transactions) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-slate-700" />
          <h3 className="font-bold text-slate-900 text-base">
            Advance Transactions Audit Log
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Complete ledger of security deposit collections, adjustments, and refunds. Historical transactions are immutable.
        </p>

        <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Receipt No</th>
                <th className="py-2.5 px-4">Flat ID</th>
                <th className="py-2.5 px-4">Tenant Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-right">Amount (BDT)</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Recorded By</th>
                <th className="py-2.5 px-4 text-center no-print">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {data.advanceTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-bold text-slate-900 font-sans">{tx.receiptNo}</td>
                  <td className="py-2.5 px-4 text-indigo-700 font-bold font-sans">Flat {tx.flatId}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-800">{tx.tenantName}</td>
                  <td className="py-2.5 px-4 font-sans">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'deposit'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {tx.type === 'deposit' ? 'Deposit' : 'Adjustment Deduction'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                    {formatBDT(tx.amount)}
                  </td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">{tx.paymentMethod}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-500">{formatDateDDMMYYYY(tx.paymentDate)}</td>
                  <td className="py-2.5 px-4 font-sans text-slate-600">{tx.recordedBy}</td>
                  <td className="py-2.5 px-4 font-sans text-center no-print">
                    <button
                      onClick={() => {
                        const unit = data.units.find((u) => u.flatId === tx.flatId);
                        const tenant = data.tenants.find((t) => t.id === tx.tenantId || t.flatId === tx.flatId);
                        onViewReceipt({
                          receiptNumber: tx.receiptNo,
                          type: tx.type === 'deposit' ? 'advance' : 'adjustment',
                          tenantName: tx.tenantName,
                          tenantPhone: tenant?.phone || '',
                          flatId: tx.flatId,
                          blockName: unit?.blockName || 'Block A',
                          amount: tx.amount,
                          paymentDate: tx.paymentDate,
                          paymentMethod: tx.paymentMethod,
                          purpose:
                            tx.type === 'deposit'
                              ? `Security Advance Deposit - Flat ${tx.flatId}`
                              : `Rent Advance Adjustment Deduction - Flat ${tx.flatId}`,
                          remainingAdvance: tx.amount,
                          authorizedSignatureBy: 'Russell',
                          signatureTitle: 'Russell (Manager)',
                          notes: tx.notes,
                          breakdown: [
                            {
                              label: tx.type === 'deposit' ? 'Security Advance Deposit' : 'Rent Advance Adjustment',
                              amount: tx.amount,
                            },
                          ],
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                      title="View / Print Receipt"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Advance Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <PlusCircle className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Record Advance Payment</h3>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDepositSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Flat *</label>
                <select
                  value={selectedFlatId}
                  onChange={(e) => setSelectedFlatId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {data.units.filter((u) => u.unitType === 'residential').map((u) => (
                    <option key={u.flatId} value={u.flatId}>
                      Flat {u.flatId} ({u.blockName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Deposit Amount (BDT / ৳) *</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  min={100}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Method *</label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="Bank Transfer">Bank Transfer / Pay Order</option>
                  <option value="Cash">Cash Handover</option>
                  <option value="bKash">bKash MFS</option>
                  <option value="Nagad">Nagad MFS</option>
                  <option value="Rocket">Rocket MFS</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Bank Reference / TrxID (Optional)</label>
                <input
                  type="text"
                  value={depositTxnId}
                  onChange={(e) => setDepositTxnId(e.target.value)}
                  placeholder="e.g. IBBL-PO-88219"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save Deposit & Generate Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

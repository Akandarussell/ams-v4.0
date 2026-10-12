import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  Home,
  Zap,
  Calendar,
  Building,
  CheckCircle2,
  Receipt,
  CreditCard,
  Smartphone,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  MonthlyLedgerItem,
  Unit,
  AppDatabaseState,
  UserProfile,
  PaymentMethod,
  PaymentStatus,
  PrintableReceipt,
} from '../types';
import { DateInputDDMMYYYY } from './DateInputDDMMYYYY';
import {
  getPostpaidElectricityPeriod,
  getMonthName,
  formatBDT,
  MONTH_NAMES,
} from '../lib/nescoTariff';
import { compareFlatIdSerial, calculateItemTotalDue, INITIAL_BLOCK_MFS_CONFIGS } from '../lib/storage';

export interface LedgerRecordFormData {
  flatId: string;
  tenantName: string;
  tenantPhone: string;
  entryDate: string;
  flatMonthlyRent: number;
  advanceStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  advanceAmount: number;
  advanceDate: string;
  rentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  rentPaidAmount: number;
  rentOutstandingDue: number;
  rentPaymentDate: string;
  electricityStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  electricityAmount: number;
  electricityDate: string;
}

export interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppDatabaseState;
  initialItem?: MonthlyLedgerItem | null;
  selectedMonth: number;
  selectedYear: number;
  userRole?: string;
  assignedBlock?: string;
  currentUser?: UserProfile;
  onSaveLedgerItem?: (item: MonthlyLedgerItem) => void;
  onRecordPayment?: (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    category: 'Combined' | 'Flat Rent' | 'Electricity' | 'Parking' | 'Godown' | 'Advance',
    transactionId?: string,
    notes?: string
  ) => void;
  onViewReceipt?: (receipt: PrintableReceipt) => void;
  onSave?: (record: LedgerRecordFormData) => void; // backwards-compatibility
}

export const RecordPaymentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  initialItem,
  selectedMonth,
  selectedYear,
  userRole = 'manager',
  assignedBlock,
  currentUser,
  onSaveLedgerItem,
  onRecordPayment,
  onViewReceipt,
  onSave,
}) => {
  // Scoped units sorted naturally (A1..A7, B1..B7, C1..C7)
  const availableUnits = data.units
    .filter((u) => {
      if (userRole === 'owner' && assignedBlock) {
        return u.blockName === assignedBlock;
      }
      return true;
    })
    .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  const [flatId, setFlatId] = useState<string>(
    initialItem?.flatId || availableUnits[0]?.flatId || 'A1'
  );
  const [tenantName, setTenantName] = useState<string>('');
  const [tenantPhone, setTenantPhone] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>('2025-06-01');
  const [flatMonthlyRent, setFlatMonthlyRent] = useState<number>(0);

  // Section 1: Security Advance
  const [advanceStatus, setAdvanceStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>('Not Paid');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceDate, setAdvanceDate] = useState<string>('');

  // Section 2: Flat Rent
  const [rentStatus, setRentStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>('Not Paid');
  const [rentPaidAmount, setRentPaidAmount] = useState<number>(0);
  const [rentOutstandingDue, setRentOutstandingDue] = useState<number>(0);
  const [rentPaymentDate, setRentPaymentDate] = useState<string>('');

  // Section 3: Electricity Bill
  const [electricityStatus, setElectricityStatus] = useState<'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'>('N/A');
  const [electricityAmount, setElectricityAmount] = useState<number>(0);
  const [electricityDate, setElectricityDate] = useState<string>('');

  // Transaction Info
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [autoOpenReceipt, setAutoOpenReceipt] = useState<boolean>(true);

  // Load initial values from initialItem or selected flat
  const populateFromItemOrFlat = (targetFlat: string, sourceItem?: MonthlyLedgerItem | null) => {
    const cleanFlat = targetFlat.trim().toLowerCase();
    const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === cleanFlat);
    const tenant = data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlat && t.status === 'active') ||
      data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlat);
    const ledger = sourceItem || data.ledgerItems.find(
      (li) => li.flatId.toLowerCase().trim() === cleanFlat && li.month === selectedMonth && li.year === selectedYear
    );
    const advance = data.advanceAccounts.find((a) => a.flatId.toLowerCase().trim() === cleanFlat);

    setFlatId(targetFlat);
    setTenantName(ledger?.tenantName || tenant?.fullName || (targetFlat.includes('Owner') ? 'Building Owner' : 'Resident'));
    setTenantPhone(ledger?.tenantPhone || tenant?.phone || '');
    setEntryDate(ledger?.entryDate || tenant?.entryDate || '2025-06-01');

    const rent = ledger?.flatRent !== undefined ? ledger.flatRent : (unit?.monthlyRent || 0);
    setFlatMonthlyRent(rent);

    // Advance
    const advAmt = ledger?.advancePayment !== undefined ? ledger.advancePayment : (advance?.amountPaid || advance?.totalRequired || 0);
    setAdvanceAmount(advAmt);
    const aStat = ledger?.advanceStatus || (advance?.status === 'paid' ? 'Paid' : advance?.status === 'partially_paid' ? 'Partially Paid' : advAmt > 0 ? 'Paid' : 'Not Paid');
    setAdvanceStatus(aStat);
    setAdvanceDate(ledger?.advanceDate || advance?.lastPaymentDate || ledger?.entryDate || '');

    // Rent
    const rStat = ledger?.rentStatus || (ledger?.paymentStatus === 'Paid' ? 'Paid' : ledger?.paymentStatus === 'Partially Paid' ? 'Partially Paid' : ledger?.paymentStatus === 'Adjusted' ? 'Adjusted' : 'Not Paid');
    setRentStatus(rStat);
    const rPaid = rStat === 'Paid' ? rent : rStat === 'Partially Paid' ? Math.round(rent / 2) : 0;
    setRentPaidAmount(ledger?.totalPaid !== undefined ? ledger.totalPaid : rPaid);
    setRentOutstandingDue(Math.max(0, rent - rPaid));
    setRentPaymentDate(ledger?.rentPaymentDate || ledger?.lastPaymentDate || (rStat === 'Paid' ? new Date().toISOString().split('T')[0] : ''));

    // Electricity
    const elecPeriod = getPostpaidElectricityPeriod(selectedMonth, selectedYear);
    const existingBill = data.electricityBills.find(
      (b) => b.flatId.toLowerCase().trim() === cleanFlat && b.consumptionMonth === elecPeriod.month && b.consumptionYear === elecPeriod.year
    );
    const eAmt = ledger?.electricityBill !== undefined ? ledger.electricityBill : (existingBill?.totalBill || 0);
    setElectricityAmount(eAmt);
    const eStat = ledger?.electricityStatus || (existingBill?.paymentStatus === 'Paid' ? 'Paid' : eAmt > 0 ? 'Not Paid' : 'N/A');
    setElectricityStatus(eStat);
    setElectricityDate(ledger?.electricityDate || (eStat === 'Paid' ? new Date().toISOString().split('T')[0] : ''));
  };

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        populateFromItemOrFlat(initialItem.flatId, initialItem);
      } else if (availableUnits.length > 0) {
        populateFromItemOrFlat(availableUnits[0].flatId, null);
      }
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setTransactionId('');
      setPaymentNotes('');
    }
  }, [isOpen, initialItem, selectedMonth, selectedYear]);

  if (!isOpen) return null;

  // Active unit & block details
  const currentUnit = data.units.find((u) => u.flatId.toLowerCase().trim() === flatId.toLowerCase().trim());
  const activeBlockName = initialItem?.blockName || currentUnit?.blockName || (flatId.startsWith('B') ? 'Block B' : flatId.startsWith('C') ? 'Block C' : 'Block A');
  const blockMfsConfig =
    data.paymentSettings?.blockConfigs?.[activeBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS[activeBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS['Block A'];

  // Calculate Duration
  const calculateDuration = (dateStr: string) => {
    if (!dateStr) return '--';
    const entry = new Date(dateStr);
    if (isNaN(entry.getTime())) return '--';
    const now = new Date();
    let months = (now.getFullYear() - entry.getFullYear()) * 12 + (now.getMonth() - entry.getMonth());
    if (now.getDate() < entry.getDate()) months--;
    if (months < 0) return 'Future Move-in';
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years === 0 && remMonths === 0) return 'Less than 1 month';
    if (years === 0) return `${remMonths} month${remMonths > 1 ? 's' : ''}`;
    if (remMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} year${years > 1 ? 's' : ''}, ${remMonths} month${remMonths > 1 ? 's' : ''}`;
  };

  const elecPeriod = getPostpaidElectricityPeriod(selectedMonth, selectedYear);

  // Quick Action Handlers
  const handleQuickPayAllDues = () => {
    const today = new Date().toISOString().split('T')[0];
    setRentStatus('Paid');
    setRentPaidAmount(flatMonthlyRent);
    setRentOutstandingDue(0);
    setRentPaymentDate(today);

    if (electricityAmount > 0) {
      setElectricityStatus('Paid');
      setElectricityDate(today);
    }
    setPaymentDate(today);
  };

  const handleQuickPayRentOnly = () => {
    const today = new Date().toISOString().split('T')[0];
    setRentStatus('Paid');
    setRentPaidAmount(flatMonthlyRent);
    setRentOutstandingDue(0);
    setRentPaymentDate(today);
    setPaymentDate(today);
  };

  const handleQuickPayElectricityOnly = () => {
    const today = new Date().toISOString().split('T')[0];
    if (electricityAmount > 0) {
      setElectricityStatus('Paid');
      setElectricityDate(today);
      setPaymentDate(today);
    }
  };

  const handleResetToNotPaid = () => {
    setRentStatus('Not Paid');
    setRentPaidAmount(0);
    setRentOutstandingDue(flatMonthlyRent);
    setRentPaymentDate('');
    if (electricityAmount > 0) {
      setElectricityStatus('Not Paid');
      setElectricityDate('');
    }
  };

  // Live Totals calculation
  const effectiveRentPayable = rentStatus === 'N/A' ? 0 : flatMonthlyRent;
  const effectiveElecPayable = electricityStatus === 'N/A' ? 0 : electricityAmount;
  const totalPayable = effectiveRentPayable + effectiveElecPayable;

  const currentRentPaid = rentStatus === 'Paid' ? flatMonthlyRent : rentStatus === 'Partially Paid' ? rentPaidAmount : 0;
  const currentElecPaid = electricityStatus === 'Paid' ? electricityAmount : 0;
  const totalPaidCollecting = currentRentPaid + currentElecPaid;

  const rentDue = rentStatus === 'Adjusted' ? 0 : Math.max(0, effectiveRentPayable - currentRentPaid);
  const elecDue = electricityStatus === 'Paid' || electricityStatus === 'N/A' ? 0 : effectiveElecPayable;
  const totalRemainingDue = rentDue + elecDue;

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const todayStr = paymentDate || new Date().toISOString().split('T')[0];

    // Determine overall payment status
    let paymentStatus: PaymentStatus = 'Not Paid';
    if (rentStatus === 'N/A' && (electricityStatus === 'N/A' || electricityAmount === 0)) {
      paymentStatus = 'N/A';
    } else if (rentStatus === 'Adjusted' && (electricityStatus === 'Paid' || electricityStatus === 'N/A' || electricityAmount === 0)) {
      paymentStatus = 'Adjusted';
    } else if (totalRemainingDue === 0 && totalPayable > 0) {
      paymentStatus = 'Paid';
    } else if (totalPaidCollecting > 0) {
      paymentStatus = 'Partially Paid';
    }

    const cleanFlat = flatId.trim();
    const existingLedger = initialItem || data.ledgerItems.find(
      (li) => li.flatId.toLowerCase().trim() === cleanFlat.toLowerCase() && li.month === selectedMonth && li.year === selectedYear
    );

    const updatedItem: MonthlyLedgerItem = {
      id: existingLedger?.id || `led-${cleanFlat.toLowerCase()}-${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
      unitId: existingLedger?.unitId || currentUnit?.id || `u-${cleanFlat.toLowerCase()}`,
      flatId: cleanFlat,
      blockName: activeBlockName as any,
      tenantId: existingLedger?.tenantId || '',
      tenantName: tenantName || 'Resident',
      tenantPhone: tenantPhone || '',
      entryDate: entryDate || '2025-06-01',
      billingPeriod: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
      month: selectedMonth,
      year: selectedYear,
      advancePayment: advanceAmount,
      advanceStatus,
      advanceDate: advanceDate || undefined,
      flatRent: flatMonthlyRent,
      rentStatus,
      rentPaymentDate: rentPaymentDate || (rentStatus === 'Paid' ? todayStr : undefined),
      electricityBill: electricityAmount,
      electricityStatus,
      electricityDate: electricityDate || (electricityStatus === 'Paid' ? todayStr : undefined),
      parkingRent: existingLedger?.parkingRent || 0,
      godownRent: existingLedger?.godownRent || 0,
      totalPayable,
      totalPaid: totalPaidCollecting,
      totalDue: totalRemainingDue,
      paymentStatus,
      adjustedFromAdvance: rentStatus === 'Adjusted' ? flatMonthlyRent : (existingLedger?.adjustedFromAdvance || 0),
      lastPaymentDate: todayStr,
      notes: paymentNotes || existingLedger?.notes,
    };

    // 1. Save ledger item
    if (onSaveLedgerItem) {
      onSaveLedgerItem(updatedItem);
    }

    // 2. Record payment transaction
    if (onRecordPayment && totalPaidCollecting > 0) {
      const category = rentStatus === 'Paid' && electricityStatus !== 'Paid'
        ? 'Flat Rent'
        : electricityStatus === 'Paid' && rentStatus !== 'Paid'
        ? 'Electricity'
        : 'Combined';

      onRecordPayment(
        cleanFlat,
        totalPaidCollecting,
        paymentMethod,
        category,
        transactionId || undefined,
        paymentNotes || `Payment recorded via RecordPaymentModal`
      );
    }

    // 3. Backwards compatibility handler if passed
    if (onSave) {
      onSave({
        flatId: cleanFlat,
        tenantName,
        tenantPhone,
        entryDate,
        flatMonthlyRent,
        advanceStatus,
        advanceAmount,
        advanceDate,
        rentStatus,
        rentPaidAmount: currentRentPaid,
        rentOutstandingDue: rentDue,
        rentPaymentDate: rentPaymentDate || todayStr,
        electricityStatus,
        electricityAmount,
        electricityDate: electricityDate || todayStr,
      });
    }

    // 4. Generate printable receipt if requested
    if (autoOpenReceipt && onViewReceipt && totalPaidCollecting > 0) {
      const isOwner = userRole === 'owner';
      const signatureMeta = isOwner
        ? {
            authorizedSignatureRole: 'owner' as const,
            signatureTitle: "Owner's Signature",
            authorizedSignatureBy: currentUser?.fullName
              ? `${currentUser.fullName} (Owner)`
              : `${activeBlockName} Owner`,
          }
        : {
            authorizedSignatureRole: 'manager' as const,
            signatureTitle: 'Russell (Manager)',
            authorizedSignatureBy: 'Russell',
          };

      const breakdown = [];
      if (currentRentPaid > 0) {
        breakdown.push({
          label: `Flat Rent (${getMonthName(selectedMonth)} ${selectedYear})`,
          amount: currentRentPaid,
        });
      }
      if (currentElecPaid > 0) {
        breakdown.push({
          label: `NESCO Electricity (${elecPeriod.displayStr})`,
          amount: currentElecPaid,
        });
      }

      const receiptType =
        rentStatus === 'Adjusted'
          ? 'adjustment'
          : currentRentPaid > 0 && currentElecPaid > 0
          ? 'combined'
          : currentRentPaid > 0
          ? 'rent'
          : 'electricity';

      const receipt: PrintableReceipt = {
        receiptNumber: `REC-PAY-${cleanFlat}-${selectedYear}${String(selectedMonth).padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
        type: receiptType,
        tenantName,
        tenantPhone,
        flatId: cleanFlat,
        blockName: activeBlockName,
        amount: totalPaidCollecting,
        paymentDate: todayStr,
        paymentMethod,
        purpose: `Collection for Flat ${cleanFlat} (${getMonthName(selectedMonth)} ${selectedYear})`,
        monthName: getMonthName(selectedMonth),
        year: selectedYear,
        remainingDue: totalRemainingDue,
        remainingAdvance: advanceAmount,
        breakdown,
        notes: paymentNotes || undefined,
        ...signatureMeta,
      };

      onViewReceipt(receipt);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl md:max-w-4xl lg:max-w-5xl w-full overflow-hidden border border-slate-200 my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Wallet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">
                  Record Payment Collection &bull; Unit {flatId}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-emerald-300 border border-white/15">
                  {activeBlockName}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Billing Period: <strong className="text-white">{getMonthName(selectedMonth)} {selectedYear}</strong> &bull; {tenantName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Unit Switcher if opened in general mode */}
          {availableUnits.length > 0 && !initialItem && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <label className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                <Building className="w-4 h-4 text-blue-600" />
                Select Flat / Unit:
              </label>
              <select
                value={flatId}
                onChange={(e) => populateFromItemOrFlat(e.target.value, null)}
                className="w-full sm:w-64 min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 text-base sm:text-xs cursor-pointer shadow-xs"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.flatId}>
                    Flat {u.flatId} ({u.blockName}) &mdash; {formatBDT(u.monthlyRent)}/mo
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tenant Metadata Summary Card */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Resident</span>
              <span className="font-extrabold text-slate-900 text-xs truncate block">{tenantName || 'Resident'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Phone</span>
              <span className="font-mono font-bold text-slate-800 text-xs block">{tenantPhone || '--'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Move-in Date</span>
              <span className="font-mono text-slate-700 text-xs block">{entryDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Stay Duration</span>
              <span className="font-semibold text-indigo-700 text-xs block">{calculateDuration(entryDate)}</span>
            </div>
          </div>

          {/* Quick Pay Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Quick Actions:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleQuickPayAllDues}
                className="min-h-[38px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                Pay All Dues ({formatBDT(flatMonthlyRent + electricityAmount)})
              </button>
              <button
                type="button"
                onClick={handleQuickPayRentOnly}
                className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                Rent Only ({formatBDT(flatMonthlyRent)})
              </button>
              {electricityAmount > 0 && (
                <button
                  type="button"
                  onClick={handleQuickPayElectricityOnly}
                  className="min-h-[38px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  Electricity ({formatBDT(electricityAmount)})
                </button>
              )}
              <button
                type="button"
                onClick={handleResetToNotPaid}
                className="min-h-[38px] px-2.5 py-1.5 bg-white hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs transition-colors border border-slate-300 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Desktop Multi-Column Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Rent & Utilities */}
            <div className="space-y-4">
              {/* Section 1: FLAT MONTHLY RENT */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-blue-900 text-[11px]">
              <div className="flex items-center gap-1.5 uppercase tracking-wide">
                <Home className="w-4 h-4 text-blue-600" />
                1. Flat Monthly Rent ({getMonthName(selectedMonth)} {selectedYear})
              </div>
              <span className="font-mono text-xs font-black text-blue-950">
                {formatBDT(flatMonthlyRent)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Rent Payment Status
                </label>
                <select
                  value={rentStatus}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    setRentStatus(st);
                    if (st === 'Paid') {
                      setRentPaidAmount(flatMonthlyRent);
                      setRentOutstandingDue(0);
                      if (!rentPaymentDate) setRentPaymentDate(paymentDate);
                    } else if (st === 'Partially Paid') {
                      setRentPaidAmount(Math.round(flatMonthlyRent / 2));
                      setRentOutstandingDue(Math.round(flatMonthlyRent / 2));
                      if (!rentPaymentDate) setRentPaymentDate(paymentDate);
                    } else if (st === 'Adjusted') {
                      setRentPaidAmount(0);
                      setRentOutstandingDue(0);
                      setRentPaymentDate(paymentDate);
                    } else {
                      setRentPaidAmount(0);
                      setRentOutstandingDue(flatMonthlyRent);
                      setRentPaymentDate('');
                    }
                  }}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 text-base sm:text-xs"
                >
                  <option value="Paid">Paid (Full)</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="Adjusted">Adjusted (from Advance)</option>
                  <option value="N/A">N/A (Exempt)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Amount Paid (BDT)
                </label>
                <input
                  type="number"
                  value={rentPaidAmount}
                  disabled={rentStatus === 'Adjusted' || rentStatus === 'N/A'}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setRentPaidAmount(val);
                    const due = Math.max(0, flatMonthlyRent - val);
                    setRentOutstandingDue(due);
                    if (val >= flatMonthlyRent) setRentStatus('Paid');
                    else if (val > 0) setRentStatus('Partially Paid');
                    else setRentStatus('Not Paid');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 text-base sm:text-xs disabled:bg-slate-100"
                />
              </div>

              <div>
                <DateInputDDMMYYYY
                  label="Rent Payment Date"
                  value={rentPaymentDate}
                  onChange={setRentPaymentDate}
                  isEnabled={rentStatus === 'Paid' || rentStatus === 'Partially Paid' || rentStatus === 'Adjusted'}
                  lockedReason="Select Paid to set date"
                />
              </div>
            </div>
          </div>

          {/* Section 2: NESCO ELECTRICITY BILL */}
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/25 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-amber-900 text-[11px]">
              <div className="flex items-center gap-1.5 uppercase tracking-wide">
                <Zap className="w-4 h-4 text-amber-600 fill-current" />
                2. NESCO Electricity Bill (Postpaid: {elecPeriod.displayStr})
              </div>
              <span className="font-mono text-xs font-black text-amber-950">
                {electricityAmount > 0 ? formatBDT(electricityAmount) : '৳0 (Exempt)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  E-Bill Status
                </label>
                <select
                  value={electricityStatus}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    setElectricityStatus(st);
                    if (st === 'Paid' && !electricityDate) {
                      setElectricityDate(paymentDate);
                    } else if (st === 'Not Paid' || st === 'N/A') {
                      setElectricityDate('');
                    }
                  }}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 text-base sm:text-xs"
                >
                  <option value="Paid">Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="N/A">N/A (Exempt / OFF)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Bill Amount (BDT)
                </label>
                <input
                  type="number"
                  value={electricityAmount}
                  onChange={(e) => setElectricityAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 text-base sm:text-xs"
                />
              </div>

              <div>
                <DateInputDDMMYYYY
                  label="E-Bill Payment Date"
                  value={electricityDate}
                  onChange={setElectricityDate}
                  isEnabled={electricityStatus === 'Paid' || (electricityStatus as any) === 'Partially Paid'}
                  lockedReason="Select Paid to set date"
                />
              </div>
            </div>
          </div>
            </div>

            {/* Right Column: Escrow Deposit & Transaction Info */}
            <div className="space-y-4">
              {/* Section 3: SECURITY ADVANCE DEPOSIT */}
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-indigo-900 text-[11px]">
              <div className="flex items-center gap-1.5 uppercase tracking-wide">
                <Wallet className="w-4 h-4 text-indigo-600" />
                3. Security Advance Escrow
              </div>
              <span className="font-mono text-xs font-black text-indigo-950">
                {formatBDT(advanceAmount)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Advance Status
                </label>
                <select
                  value={advanceStatus}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    setAdvanceStatus(st);
                    if ((st === 'Paid' || st === 'Partially Paid') && !advanceDate) {
                      setAdvanceDate(paymentDate);
                    } else if (st === 'Not Paid') {
                      setAdvanceDate('');
                    }
                  }}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 text-base sm:text-xs"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Not Paid">Not Paid</option>
                  <option value="Adjusted">Adjusted</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Advance Deposit (BDT)
                </label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 text-base sm:text-xs"
                />
              </div>

              <div>
                <DateInputDDMMYYYY
                  label="Advance Deposit Date"
                  value={advanceDate}
                  onChange={setAdvanceDate}
                  isEnabled={advanceStatus === 'Paid' || advanceStatus === 'Partially Paid'}
                  lockedReason="Select Paid to set date"
                />
              </div>
            </div>
          </div>

          {/* Section 4: PAYMENT TRANSACTION METHOD & GATEWAY INFO */}
          <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wide block text-[11px] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              4. Payment Method & Transaction Reference
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 text-base sm:text-xs"
                >
                  <option value="Cash">Cash Handover</option>
                  <option value="bKash">bKash MFS</option>
                  <option value="Nagad">Nagad MFS</option>
                  <option value="Rocket">Rocket (DBBL)</option>
                  <option value="Bank Transfer">Bank Deposit / EFT</option>
                </select>
              </div>

              <div>
                <DateInputDDMMYYYY
                  label="Transaction Date *"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  isEnabled={true}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Txn ID / Ref (Optional)
                </label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. BK98214AA or CHQ-1049"
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 text-base sm:text-xs"
                />
              </div>
            </div>

            {/* If MFS is selected, display official recipient phone number configured for this block */}
            {paymentMethod !== 'Cash' && paymentMethod !== 'Bank Transfer' && (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-600">
                    Official {paymentMethod} Account for {activeBlockName}:
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {paymentMethod === 'bKash'
                    ? blockMfsConfig.bkashNumber || '01737-321998'
                    : paymentMethod === 'Nagad'
                    ? blockMfsConfig.nagadNumber || '01737-321998'
                    : blockMfsConfig.rocketNumber || '01737-321998'}
                </span>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                Remarks / Collection Notes
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g. Received full October rent and September electricity in cash"
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 text-base sm:text-xs"
              />
            </div>
          </div>
            </div>
          </div>

          {/* Collection Summary & Receipt Option */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
            <div>
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block font-sans">
                Payment Collection Summary
              </span>
              <div className="flex items-center gap-4 mt-0.5">
                <div>
                  <span className="text-slate-500 text-[11px]">Collecting:</span>
                  <span className="ml-1 text-sm font-black text-emerald-800">
                    {formatBDT(totalPaidCollecting)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Remaining Due:</span>
                  <span className={`ml-1 text-sm font-black ${totalRemainingDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {formatBDT(totalRemainingDue)}
                  </span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer font-sans shrink-0">
              <input
                type="checkbox"
                checked={autoOpenReceipt}
                onChange={(e) => setAutoOpenReceipt(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-emerald-700" />
                Generate & view receipt voucher immediately
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer text-xs flex items-center justify-center order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all cursor-pointer text-xs flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record Payment & Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

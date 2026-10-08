import React, { useState } from 'react';
import {
  Building2,
  TrendingUp,
  AlertCircle,
  Wallet,
  Zap,
  Car,
  Warehouse,
  Printer,
  Download,
  Search,
  Filter,
  PlusCircle,
  Receipt,
  Edit3,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Check,
  Save,
  ToggleLeft,
  ToggleRight,
  Copy,
  Calendar,
  FileSpreadsheet,
  KeyRound,
} from 'lucide-react';
import { AppDatabaseState, UserProfile, PrintableReceipt, MonthlyLedgerItem, PaymentSettings } from '../types';
import { formatBDT, formatDateDDMMYYYY, getMonthName, MONTH_NAMES, getPostpaidElectricityPeriod, getPostpaidElectricityTenantInfo } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { formatBillingPeriod } from '../lib/api';
import { INITIAL_BLOCK_MFS_CONFIGS, getEffectiveRemainingAdvance, calculateItemTotalDue, compareFlatIdSerial } from '../lib/storage';
import { exportAllCredentialsToExcel } from '../lib/exportCredentials';
import { ManualLedgerEntryModal } from './ManualLedgerEntryModal';
import { ExcelImportModal } from './ExcelImportModal';

interface Props {
  currentUser: UserProfile;
  data: AppDatabaseState;
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onSaveLedgerItem?: (item: MonthlyLedgerItem) => void;
  onUpdatePaymentSettings?: (settings: PaymentSettings) => void;
  onCopyPreviousMonthLedger?: (targetMonth: number, targetYear: number, sourceMonth?: number, sourceYear?: number) => void;
  onUpdateMonthYear?: (month: number, year: number) => void;
  onImportLedgerData?: (
    items: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => void;
}

export const OwnerDashboard: React.FC<Props> = ({
  currentUser,
  data,
  onViewReceipt,
  onSaveLedgerItem,
  onUpdatePaymentSettings,
  onCopyPreviousMonthLedger,
  onUpdateMonthYear,
  onImportLedgerData,
}) => {
  const blockName = currentUser.assignedBlock || 'Block A';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Block MFS Gateway Configuration & Toggle
  const currentBlockConfig =
    data.paymentSettings?.blockConfigs?.[blockName] ||
    INITIAL_BLOCK_MFS_CONFIGS[blockName] ||
    INITIAL_BLOCK_MFS_CONFIGS['Block A'];

  const [isEditingMfs, setIsEditingMfs] = useState(false);
  const [mfsEditForm, setMfsEditForm] = useState({
    bkashNumber: currentBlockConfig.bkashNumber,
    bkashType: currentBlockConfig.bkashType,
    nagadNumber: currentBlockConfig.nagadNumber,
    nagadType: currentBlockConfig.nagadType,
    rocketNumber: currentBlockConfig.rocketNumber,
    rocketType: currentBlockConfig.rocketType,
    instructions: currentBlockConfig.instructions || '',
  });
  const [mfsSaveSuccess, setMfsSaveSuccess] = useState(false);

  const handleToggleMfs = (newEnabled: boolean) => {
    if (!onUpdatePaymentSettings) return;
    const currentConfigs = data.paymentSettings?.blockConfigs || INITIAL_BLOCK_MFS_CONFIGS;
    const updated = {
      ...data.paymentSettings,
      blockConfigs: {
        ...currentConfigs,
        [blockName]: {
          ...currentBlockConfig,
          isMfsEnabled: newEnabled,
        },
      },
    };
    onUpdatePaymentSettings(updated);
  };

  const handleToggleBankDeposit = (newAllowed: boolean) => {
    if (!onUpdatePaymentSettings) return;
    const currentConfigs = data.paymentSettings?.blockConfigs || INITIAL_BLOCK_MFS_CONFIGS;
    const updated = {
      ...data.paymentSettings,
      blockConfigs: {
        ...currentConfigs,
        [blockName]: {
          ...currentBlockConfig,
          isBankDepositAllowed: newAllowed,
        },
      },
    };
    onUpdatePaymentSettings(updated);
  };

  const handleSaveMfsAccounts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdatePaymentSettings) return;
    const currentConfigs = data.paymentSettings?.blockConfigs || INITIAL_BLOCK_MFS_CONFIGS;
    const updated = {
      ...data.paymentSettings,
      blockConfigs: {
        ...currentConfigs,
        [blockName]: {
          ...currentBlockConfig,
          ...mfsEditForm,
        },
      },
    };
    onUpdatePaymentSettings(updated);
    setIsEditingMfs(false);
    setMfsSaveSuccess(true);
    setTimeout(() => setMfsSaveSuccess(false), 3000);
  };

  // Copy from Previous Month Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // Excel / Google Sheet Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const prevMonthNum = data.selectedMonth === 1 ? 12 : data.selectedMonth - 1;
  const prevYearNum = data.selectedMonth === 1 ? data.selectedYear - 1 : data.selectedYear;
  const prevMonthName = getMonthName(prevMonthNum);
  const currentMonthName = getMonthName(data.selectedMonth);

  const handleConfirmCopyPreviousMonth = () => {
    if (onCopyPreviousMonthLedger) {
      onCopyPreviousMonthLedger(data.selectedMonth, data.selectedYear, prevMonthNum, prevYearNum);
      setIsCopyModalOpen(false);
      setCopySuccessMsg(`Successfully copied ledger baseline from ${prevMonthName} ${prevYearNum}. Electricity and Parking data are reset to empty for manual input.`);
      setTimeout(() => setCopySuccessMsg(null), 5000);
    }
  };

  // Manual Entry / Edit Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [itemToEditManual, setItemToEditManual] = useState<MonthlyLedgerItem | null>(null);

  // Signature Metadata: Always Owner's Signature for Owner Account
  const ownerSignatureMeta = {
    authorizedSignatureRole: 'owner' as const,
    signatureTitle: "Owner's Signature",
    authorizedSignatureBy: currentUser.fullName ? `${currentUser.fullName} (Owner)` : `${blockName} Owner`,
  };

  const handleGenerateAdvanceReceipt = (item: MonthlyLedgerItem) => {
    onViewReceipt({
      receiptNumber: `REC-ADV-${item.flatId}-${data.selectedYear}`,
      type: 'advance',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: blockName,
      amount: item.advancePayment,
      paymentDate: item.advanceDate || item.entryDate || '2026-10-01',
      paymentMethod: 'Cash',
      purpose: `Security Advance Deposit - Flat ${item.flatId} (${blockName})`,
      remainingAdvance: item.advancePayment,
      ...ownerSignatureMeta,
      breakdown: [
        { label: 'Security Advance Deposit', amount: item.advancePayment },
      ],
    });
  };

  const handleGenerateRentReceipt = (item: MonthlyLedgerItem) => {
    onViewReceipt({
      receiptNumber: `REC-RENT-${item.flatId}-${data.selectedMonth}-${data.selectedYear}`,
      type: item.paymentStatus === 'Adjusted' ? 'adjustment' : 'rent',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: blockName,
      amount: item.flatRent,
      paymentDate: item.rentPaymentDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: item.paymentStatus === 'Adjusted' ? 'Advance Adjustment' : 'Cash',
      purpose: `Monthly Flat Rent for ${getMonthName(data.selectedMonth)} ${data.selectedYear} - Flat ${item.flatId}`,
      remainingDue: item.totalDue,
      remainingAdvance: item.advancePayment,
      ...ownerSignatureMeta,
      breakdown: [
        { label: `Flat Rent (${getMonthName(data.selectedMonth)} ${data.selectedYear})`, amount: item.flatRent },
        ...(item.parkingRent > 0 ? [{ label: 'Parking Rent', amount: item.parkingRent }] : []),
      ],
    });
  };

  const handleGenerateElectricityReceipt = (item: MonthlyLedgerItem) => {
    const elecPeriod = getPostpaidElectricityPeriod(item.month || data.selectedMonth, item.year || data.selectedYear);
    // Postpaid rule: Electricity receipt must always be in previous month's tenant name (consumption month occupant)
    const priorOccupant = getPostpaidElectricityTenantInfo(
      item.flatId,
      elecPeriod.month,
      elecPeriod.year,
      data,
      item.tenantName,
      item.tenantPhone
    );

    onViewReceipt({
      receiptNumber: `REC-ELEC-${item.flatId}-${elecPeriod.month}-${elecPeriod.year}`,
      type: 'electricity',
      tenantName: priorOccupant.tenantName,
      tenantPhone: priorOccupant.tenantPhone,
      flatId: item.flatId,
      blockName: blockName,
      amount: item.electricityBill,
      paymentDate: item.electricityDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: 'Cash',
      monthName: elecPeriod.monthName,
      year: elecPeriod.year,
      purpose: `NESCO Sub-Meter Electricity Bill for ${elecPeriod.displayStr} (Postpaid Billing for ${getMonthName(item.month || data.selectedMonth)} ${item.year || data.selectedYear} Rent) - Flat ${item.flatId}`,
      ...ownerSignatureMeta,
      breakdown: [
        { label: `Postpaid Electricity Consumption (${elecPeriod.displayStr})`, amount: item.electricityBill },
      ],
    });
  };

  // Quick Inline Flat Rent Status Changer (for Block Owner)
  const handleQuickUpdateRentStatus = (
    item: MonthlyLedgerItem,
    newStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A'
  ) => {
    if (!onSaveLedgerItem) return;

    // Rent can only be adjusted from escrow when advance deposit condition was paid
    if (newStatus === 'Adjusted') {
      const matchingAdv = data.advanceAccounts.find((a) => a.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim());
      const isAdvPaid = item.advanceStatus === 'Paid' || item.advanceStatus === 'Partially Paid' || (matchingAdv && matchingAdv.amountPaid > 0);
      if (!isAdvPaid) {
        alert(`Cannot adjust flat rent for Flat ${item.flatId} because the security advance deposit condition is Not Paid. Rent can only be adjusted from escrow when advance deposit is paid.`);
        return;
      }
    }

    const rentNum = item.flatRent || 0;
    const elecNum = item.electricityBill || 0;
    let rentPaidVal = 0;
    if (newStatus === 'Paid') rentPaidVal = rentNum;
    else if (newStatus === 'Partially Paid') rentPaidVal = Math.round(rentNum / 2);
    else if (newStatus === 'Adjusted' || newStatus === 'N/A') rentPaidVal = 0;

    const elecPaidVal = item.electricityStatus === 'Paid' ? elecNum : 0;
    const totalPaid = rentPaidVal + elecPaidVal;
    const effectiveRentPayable = newStatus === 'N/A' ? 0 : rentNum;
    const effectiveElecPayable = item.electricityStatus === 'N/A' ? 0 : elecNum;
    const totalPayable = effectiveRentPayable + effectiveElecPayable + (item.parkingRent || 0) + (item.godownRent || 0);

    const rentDueVal = newStatus === 'Adjusted' ? 0 : Math.max(0, effectiveRentPayable - rentPaidVal);
    const elecDueVal = item.electricityStatus === 'Paid' || item.electricityStatus === 'N/A' ? 0 : Math.max(0, effectiveElecPayable - elecPaidVal);
    const totalDue = rentDueVal + elecDueVal + (item.parkingRent || 0) + (item.godownRent || 0);

    let paymentStatus: any = 'Not Paid';
    if (newStatus === 'N/A' && (item.electricityStatus === 'N/A' || elecNum === 0)) {
      paymentStatus = 'N/A';
    } else if (newStatus === 'Adjusted' && (item.electricityStatus === 'Paid' || item.electricityStatus === 'N/A' || elecNum === 0)) {
      paymentStatus = 'Adjusted';
    } else if (totalDue === 0 && totalPayable > 0) {
      paymentStatus = 'Paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'Partially Paid';
    }

    const rentPaymentDate =
      newStatus === 'Paid' || newStatus === 'Partially Paid'
        ? (item.rentPaymentDate || new Date().toISOString().split('T')[0])
        : newStatus === 'Adjusted'
        ? (item.advanceDate || item.rentPaymentDate || item.entryDate || new Date().toISOString().split('T')[0])
        : '';

    const updatedItem: MonthlyLedgerItem = {
      ...item,
      rentStatus: newStatus,
      rentPaymentDate: rentPaymentDate || undefined,
      totalPaid,
      totalDue,
      totalPayable,
      paymentStatus,
      lastPaymentDate: rentPaymentDate || item.lastPaymentDate || undefined,
      adjustedFromAdvance: newStatus === 'Adjusted' ? rentNum : (item.adjustedFromAdvance || 0),
    };

    onSaveLedgerItem(updatedItem);
  };

  // 1. Flats Occupancy
  const blockFlats = data.units.filter((u) => u.blockName === blockName && u.unitType === 'residential');
  const totalFlats = blockFlats.length;
  const occupiedFlats = blockFlats.filter((u) => u.isOccupied).length;
  const vacantFlats = totalFlats - occupiedFlats;
  const occupancyRate = totalFlats > 0 ? Math.round((occupiedFlats / totalFlats) * 100) : 0;

  // Filter ledger items for this block and selected period, sorted in serial order (A1..A7, B1..B7, C1..C7)
  const blockLedger = data.ledgerItems
    .filter(
      (item) => item.blockName === blockName && item.month === data.selectedMonth && item.year === data.selectedYear
    )
    .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  // Financial aggregates
  const totalPayable = blockLedger.reduce((sum, item) => sum + item.totalPayable, 0);
  const totalCollection = blockLedger.reduce((sum, item) => sum + item.totalPaid, 0);
  const totalDues = blockLedger.reduce((sum, item) => sum + calculateItemTotalDue(item), 0);

  // 2. Security Advance: Paid vs Due
  const blockAdvanceAccounts = data.advanceAccounts.filter((a) => {
    const u = data.units.find((unit) => unit.flatId === a.flatId);
    return u?.blockName === blockName;
  });
  const advancePaid = blockAdvanceAccounts.reduce(
    (sum, a) => sum + getEffectiveRemainingAdvance(a, data.ledgerItems),
    0
  );
  const advanceDue = blockAdvanceAccounts.reduce((sum, a) => {
    if (a.status === 'not_paid') {
      return sum + (a.totalRequired || 0);
    }
    if (a.status === 'partially_paid') {
      return sum + Math.max(0, (a.totalRequired || 0) - (a.amountPaid || 0));
    }
    return sum;
  }, 0);
  const totalAdvanceCollected = advancePaid; // For table footer and legacy

  // 3. Current Month Flat Rent: Paid vs Due
  const rentPaid = blockLedger.reduce((sum, item) => {
    if (item.rentStatus === 'Paid' || item.rentStatus === 'Adjusted') return sum + item.flatRent;
    if (item.rentStatus === 'Partially Paid') {
      const elecPaid = item.electricityStatus === 'Paid' ? item.electricityBill : 0;
      return sum + Math.max(0, (item.totalPaid || 0) - elecPaid);
    }
    if (item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted') return sum + item.flatRent;
    return sum;
  }, 0);

  const rentDue = blockLedger.reduce((sum, item) => {
    if (item.rentStatus === 'Adjusted' || item.rentStatus === 'Paid' || item.rentStatus === 'N/A') return sum;
    if (item.paymentStatus === 'Adjusted' || item.paymentStatus === 'Paid' || item.paymentStatus === 'N/A') return sum;
    if (item.rentStatus === 'Partially Paid') {
      const elecPaid = item.electricityStatus === 'Paid' ? item.electricityBill : 0;
      const paidRent = Math.max(0, (item.totalPaid || 0) - elecPaid);
      return sum + Math.max(0, item.flatRent - paidRent);
    }
    return sum + (item.flatRent || 0);
  }, 0);

  const rentPaidCount = blockLedger.filter((i) => i.rentStatus === 'Paid' || i.rentStatus === 'Adjusted').length;
  const rentDueCount = blockLedger.filter((i) => i.rentStatus !== 'Paid' && i.rentStatus !== 'Adjusted' && i.rentStatus !== 'N/A').length;

  // 4. (Previous Month) Electricity: Paid vs Due
  const elecPeriod = getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear);
  const elecPaid = blockLedger.reduce((sum, item) => {
    if (item.electricityStatus === 'Paid') return sum + item.electricityBill;
    if (item.electricityStatus === 'Partially Paid') return sum + Math.round(item.electricityBill / 2);
    return sum;
  }, 0);

  const elecDue = blockLedger.reduce((sum, item) => {
    if (item.electricityStatus === 'Paid' || item.electricityStatus === 'N/A') return sum;
    if (item.electricityStatus === 'Partially Paid') return sum + Math.round(item.electricityBill / 2);
    return sum + item.electricityBill;
  }, 0);

  const elecPaidCount = blockLedger.filter((i) => i.electricityStatus === 'Paid' && i.electricityBill > 0).length;
  const elecDueCount = blockLedger.filter((i) => i.electricityStatus !== 'Paid' && i.electricityStatus !== 'N/A' && i.electricityBill > 0).length;

  const rentCollected = rentPaid;

  const electricityCollected = elecPaid;

  const parkingIncome = blockLedger
    .filter((i) => i.parkingRent > 0 && i.totalPaid > 0)
    .reduce((sum, i) => sum + i.parkingRent, 0);

  const godownIncome = blockLedger
    .filter((i) => i.godownRent > 0 && i.totalPaid > 0)
    .reduce((sum, i) => sum + i.godownRent, 0);

  // Filtered rows for the ledger table sorted in strict serial order (A1..A7, B1..B7, C1..C7)
  const filteredLedger = blockLedger
    .filter((item) => {
      const matchesSearch =
        item.flatId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tenantName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.paymentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  const handleExportCSV = () => {
    const headers = [
      'Flat ID',
      'Tenant Name',
      'Phone',
      'Entry Date',
      'Advance Payment',
      'Flat Rent',
      'Electricity Bill',
      'Parking Rent',
    ];
    const rows = filteredLedger.map((item) => [
      `"${item.flatId}"`,
      `"${item.tenantName}"`,
      `"${item.tenantPhone}"`,
      `"${item.entryDate}"`,
      item.advancePayment,
      item.flatRent,
      item.electricityBill,
      item.parkingRent,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${blockName}_Ledger_${getMonthName(data.selectedMonth)}_${data.selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-700/60 border border-blue-400/30 rounded-full text-xs font-bold uppercase tracking-wider">
              {blockName} Owner Portal
            </span>
            <span className="text-xs text-blue-200">
              {COMPLEX_CONFIG.name}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">
            Welcome, {currentUser.fullName}
          </h1>
          <p className="text-xs text-blue-200 mt-1">
            {COMPLEX_CONFIG.address}
          </p>
          <p className="text-xs text-blue-300 mt-0.5">
            Hotline: <strong>{COMPLEX_CONFIG.contacts}</strong> &bull; Scoped to {blockName} for <span className="font-extrabold text-white underline underline-offset-2">{getMonthName(data.selectedMonth)} {data.selectedYear}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bold Active Billing Month Display */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white/15 border border-white/25 rounded-xl backdrop-blur-md shadow-inner">
            <Calendar className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-blue-200">Active Month</div>
              <div className="text-lg sm:text-xl font-black text-white tracking-tight">
                {getMonthName(data.selectedMonth)} {data.selectedYear}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => exportAllCredentialsToExcel(data, { blockFilter: blockName })}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              title={`1-Click Export Passwords for ${blockName} & Authority accounts (.xlsx)`}
            >
              <KeyRound className="w-4 h-4 text-emerald-100" />
              Export Passwords
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Box 1: Flats Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Flats Occupancy
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {occupancyRate}% Occupied
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
              {occupiedFlats} <span className="text-base font-normal text-slate-400">/ {totalFlats}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              {occupiedFlats} Occupied &bull; {vacantFlats} Vacant
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${occupancyRate}%` }}
            ></div>
          </div>
        </div>

        {/* Box 2: Advance Amount Paid vs Due */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                Advance (Paid vs Due)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Security Escrow
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid (Escrow)</span>
                <div className="text-base sm:text-lg font-black text-indigo-700 font-mono">
                  {formatBDT(advancePaid)}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advance Due</span>
                <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
                  {formatBDT(advanceDue)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Total required: {formatBDT(advancePaid + advanceDue)}
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-indigo-600 h-2 transition-all"
              style={{ width: `${(advancePaid + advanceDue) > 0 ? (advancePaid / (advancePaid + advanceDue)) * 100 : 100}%` }}
            ></div>
            <div
              className="bg-rose-500 h-2 transition-all"
              style={{ width: `${(advancePaid + advanceDue) > 0 ? (advanceDue / (advancePaid + advanceDue)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Box 3: Current Month Flat Rent Paid vs Due */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                {getMonthName(data.selectedMonth)} Flat Rent
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Paid vs Due
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rent Paid</span>
                <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                  {formatBDT(rentPaid)}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rent Due</span>
                <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
                  {formatBDT(rentDue)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {rentPaidCount} Paid (incl. adjusted) &bull; {rentDueCount} Due
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all"
              style={{ width: `${(rentPaid + rentDue) > 0 ? (rentPaid / (rentPaid + rentDue)) * 100 : 100}%` }}
            ></div>
            <div
              className="bg-rose-500 h-2 transition-all"
              style={{ width: `${(rentPaid + rentDue) > 0 ? (rentDue / (rentPaid + rentDue)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Box 4: (Previous Month) Electricity Paid vs Due Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {elecPeriod.monthName} Electricity
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Postpaid
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill Paid</span>
                <div className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                  {formatBDT(elecPaid)}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill Due</span>
                <div className="text-base sm:text-lg font-black text-rose-600 font-mono">
                  {formatBDT(elecDue)}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {elecPaidCount} Paid &bull; {elecDueCount} Due ({elecPeriod.displayStr})
            </p>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-2 transition-all"
              style={{ width: `${(elecPaid + elecDue) > 0 ? (elecPaid / (elecPaid + elecDue)) * 100 : 100}%` }}
            ></div>
            <div
              className="bg-rose-500 h-2 transition-all"
              style={{ width: `${(elecPaid + elecDue) > 0 ? (elecDue / (elecPaid + elecDue)) * 100 : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Rent Collected</span>
          <p className="text-base font-bold text-slate-900 mt-1">{formatBDT(rentCollected)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Electricity (NESCO)</span>
          <p className="text-base font-bold text-slate-900 mt-1">{formatBDT(electricityCollected)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Parking Income</span>
          <p className="text-base font-bold text-slate-900 mt-1">{formatBDT(parkingIncome)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Godown Income</span>
          <p className="text-base font-bold text-slate-900 mt-1">{formatBDT(godownIncome)}</p>
        </div>
      </div>

      {/* MFS ONLINE PAYMENT RECEIVING TOGGLE & CONFIGURATION FOR BLOCK OWNER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${currentBlockConfig.isMfsEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Pay Online via MFS (bKash / Nagad / Rocket) - {blockName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  currentBlockConfig.isMfsEnabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {currentBlockConfig.isMfsEnabled ? 'Available (ON)' : 'Disabled (OFF)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Owner account availability to receive tenant payments directly in your own number (+1.8% cashout fee added)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleToggleMfs(!currentBlockConfig.isMfsEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                currentBlockConfig.isMfsEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              {currentBlockConfig.isMfsEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-emerald-200" />
                  MFS Receiving: ON
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                  MFS Receiving: OFF
                </>
              )}
            </button>
            <button
              onClick={() => setIsEditingMfs(!isEditingMfs)}
              className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              {isEditingMfs ? 'Cancel Edit' : 'Edit Numbers'}
            </button>
          </div>
        </div>

        {/* Status description alert */}
        <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
          currentBlockConfig.isMfsEnabled
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {currentBlockConfig.isMfsEnabled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>
              {currentBlockConfig.isMfsEnabled ? (
                <>
                  <strong>Online MFS payments are active for {blockName}.</strong> Tenants can see your official numbers ({currentBlockConfig.ownerName}) and pay with an extra <strong>1.8% cashout fee</strong> added.
                </>
              ) : (
                <>
                  <strong>Online MFS payments are currently turned OFF for {blockName}.</strong> Tenants of {blockName} will be instructed to pay physically in cash or bank transfer.
                </>
              )}
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/70 font-bold shrink-0">
            Fee Adding: +{currentBlockConfig.mfsFeePercentage || 1.8}%
          </span>
        </div>

        {/* Display Accounts / Edit Accounts */}
        {isEditingMfs ? (
          <form onSubmit={handleSaveMfsAccounts} className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Update {blockName} Receiving Accounts ({currentBlockConfig.ownerName})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">bKash Number</label>
                <input
                  type="text"
                  value={mfsEditForm.bkashNumber}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, bkashNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  required
                />
                <select
                  value={mfsEditForm.bkashType}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, bkashType: e.target.value as any })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-600"
                >
                  <option value="Personal">Personal Account</option>
                  <option value="Merchant">Merchant Account</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Nagad Number</label>
                <input
                  type="text"
                  value={mfsEditForm.nagadNumber}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, nagadNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  required
                />
                <select
                  value={mfsEditForm.nagadType}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, nagadType: e.target.value as any })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-600"
                >
                  <option value="Personal">Personal Account</option>
                  <option value="Merchant">Merchant Account</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Rocket Number</label>
                <input
                  type="text"
                  value={mfsEditForm.rocketNumber}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, rocketNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                  required
                />
                <select
                  value={mfsEditForm.rocketType}
                  onChange={(e) => setMfsEditForm({ ...mfsEditForm, rocketType: e.target.value as any })}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-600"
                >
                  <option value="Personal">Personal Account</option>
                  <option value="Merchant">Merchant Account</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingMfs(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                Save Receiving Accounts
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4 text-xs">
            <div className="p-3.5 bg-pink-50/50 border border-pink-100 rounded-xl">
              <div className="flex items-center justify-between text-pink-700 font-bold mb-1">
                <span>bKash ({currentBlockConfig.bkashType})</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 rounded text-pink-800">
                  {currentBlockConfig.ownerName}
                </span>
              </div>
              <p className="font-mono text-slate-900 font-bold text-sm">{currentBlockConfig.bkashNumber}</p>
              <p className="text-[11px] text-slate-500 mt-1">Tenant adds +1.8% cashout fee</p>
            </div>

            <div className="p-3.5 bg-orange-50/50 border border-orange-100 rounded-xl">
              <div className="flex items-center justify-between text-orange-700 font-bold mb-1">
                <span>Nagad ({currentBlockConfig.nagadType})</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 rounded text-orange-800">
                  {currentBlockConfig.ownerName}
                </span>
              </div>
              <p className="font-mono text-slate-900 font-bold text-sm">{currentBlockConfig.nagadNumber}</p>
              <p className="text-[11px] text-slate-500 mt-1">Tenant adds +1.8% cashout fee</p>
            </div>

            <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl">
              <div className="flex items-center justify-between text-purple-700 font-bold mb-1">
                <span>Rocket ({currentBlockConfig.rocketType})</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 rounded text-purple-800">
                  {currentBlockConfig.ownerName}
                </span>
              </div>
              <p className="font-mono text-slate-900 font-bold text-sm">{currentBlockConfig.rocketNumber}</p>
              <p className="text-[11px] text-slate-500 mt-1">Tenant adds +1.8% cashout fee</p>
            </div>
          </div>
        )}

        {/* DIRECT BANK DEPOSIT PERMISSION SECTION */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${currentBlockConfig.isBankDepositAllowed ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-xs">
                  Direct Bank Deposit Permission for {blockName} Tenants
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  currentBlockConfig.isBankDepositAllowed
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {currentBlockConfig.isBankDepositAllowed ? 'Permitted (Visible to Tenants)' : 'Not Permitted (Hidden from Tenants)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Islami Bank Bangladesh Ltd (Rajshahi Branch) &bull; A/C: <strong>2050 3219 9801 8587</strong> &bull; Routing: <strong>IBBLBDRJ050</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleToggleBankDeposit(!currentBlockConfig.isBankDepositAllowed)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 ${
              currentBlockConfig.isBankDepositAllowed
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {currentBlockConfig.isBankDepositAllowed ? (
              <>
                <ToggleRight className="w-4 h-4 text-indigo-200" />
                Bank Deposit: Permitted
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-slate-400" />
                Bank Deposit: Hidden
              </>
            )}
          </button>
        </div>

        {mfsSaveSuccess && (
          <div className="mt-3 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            MFS account details saved successfully.
          </div>
        )}
      </div>

      {/* Copy Previous Month Success Alert */}
      {copySuccessMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{copySuccessMsg}</span>
          </div>
          <button onClick={() => setCopySuccessMsg(null)} className="text-indigo-400 hover:text-indigo-600">
            &times;
          </button>
        </div>
      )}

      {/* Excel / Google Sheet Import Success Alert */}
      {importSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            &times;
          </button>
        </div>
      )}

      {/* Spreadsheet Ledger Table for Block Owner (8 Columns) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                {blockName} Monthly Financial Ledger
              </h3>
              <span className="px-3 py-1 bg-blue-900 text-white text-xs font-black rounded-lg shadow-xs tracking-wider">
                {getMonthName(data.selectedMonth).toUpperCase()} {data.selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active Billing Month: <strong className="text-slate-900 font-extrabold text-sm">{getMonthName(data.selectedMonth)} {data.selectedYear}</strong> &bull; 8-Column Financial Ledger
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Month Selector for Owner with Bold Month Display */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border-2 border-slate-300 shadow-xs">
              <Calendar className="w-4 h-4 text-blue-600 mx-0.5 shrink-0" />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Month:</span>
              <select
                value={data.selectedMonth}
                onChange={(e) => onUpdateMonthYear && onUpdateMonthYear(Number(e.target.value), data.selectedYear)}
                className="bg-transparent border-0 text-slate-900 text-sm font-black focus:outline-hidden cursor-pointer tracking-tight"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1} className="font-bold">
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={data.selectedYear}
                onChange={(e) => onUpdateMonthYear && onUpdateMonthYear(data.selectedMonth, Number(e.target.value))}
                className="bg-transparent border-0 text-slate-900 text-sm font-black focus:outline-hidden cursor-pointer tracking-tight"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y} className="font-bold">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Entry Button for Owner */}
            <button
              onClick={() => {
                setItemToEditManual(null);
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Add or update ledger data manually"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Manual Ledger Entry</span>
            </button>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Flat or Tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Not Paid">Not Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Adjusted">Adjusted</option>
            </select>
          </div>
        </div>

        {/* Ledger Table (8 Columns - Godown, Total Payable, Total Paid, Total Due, Status, and Actions removed) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">1. Flat ID</th>
                <th className="py-3 px-4 whitespace-nowrap">2. Tenant Name</th>
                <th className="py-3 px-4 whitespace-nowrap">3. Mobile</th>
                <th className="py-3 px-4 whitespace-nowrap">4. Entry Date</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">5. Advance</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">6. Flat Rent</th>
                <th
                  className="py-3 px-4 text-right whitespace-nowrap"
                  title={`Postpaid Electricity for ${getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).displayStr} (Flat Rent Month: ${getMonthName(data.selectedMonth)} ${data.selectedYear})`}
                >
                  7. Electricity
                  <span className="block text-[10px] font-normal text-slate-300">
                    ({getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).monthName.slice(0, 3)} Postpaid)
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    No ledger records match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => {
                  const isOwnerFlat = row.flatId.toLowerCase().includes('owner');
                  const rawAdvStatus = (row.advanceStatus || '').trim();
                  const matchingAdv = data.advanceAccounts.find((a) => a.flatId === row.flatId);
                  const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
                  const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

                  const effectiveAdvAmount =
                    row.advancePayment !== undefined && row.advancePayment !== null
                      ? Number(row.advancePayment)
                      : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
                      ? matchingAdv.amountPaid
                      : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
                      ? matchingAdv.totalRequired
                      : 0;

                  const hasAdvAmount = effectiveAdvAmount > 0;
                  const isNotPaid =
                    rawAdvStatus.toLowerCase() === 'not paid' ||
                    rawAdvStatus.toLowerCase() === 'not_paid';

                  const advStatus =
                    isOwnerFlat
                      ? 'N/A'
                      : isNotPaid
                      ? 'Not Paid'
                      : isMarkedPaid
                      ? 'Paid'
                      : isMarkedPartial || matchingAdv?.status === 'partially_paid'
                      ? 'Partially Paid'
                      : rawAdvStatus.toLowerCase() === 'adjusted'
                      ? 'Adjusted'
                      : rawAdvStatus.toLowerCase() === 'n/a'
                      ? 'N/A'
                      : (matchingAdv?.status === 'paid' || (!rawAdvStatus && hasAdvAmount))
                      ? 'Paid'
                      : 'Not Paid';
                  const rentStatus =
                    row.rentStatus ||
                    (row.paymentStatus === 'Paid' || row.paymentStatus === 'Adjusted'
                      ? 'Paid'
                      : row.paymentStatus === 'Partially Paid'
                      ? 'Partially Paid'
                      : row.paymentStatus === 'N/A'
                      ? 'N/A'
                      : 'Not Paid');
                  const elecStatus =
                    row.electricityStatus ||
                    (row.electricityBill === 0
                      ? 'N/A'
                      : row.paymentStatus === 'Paid'
                      ? 'Paid'
                      : 'Not Paid');

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-blue-700 font-sans whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold">{row.flatId}</span>
                          <button
                            onClick={() => {
                              setItemToEditManual(row);
                              setIsManualModalOpen(true);
                            }}
                            title="Edit this ledger record manually"
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 font-sans whitespace-nowrap">
                        {row.tenantName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-sans whitespace-nowrap">
                        {row.tenantPhone}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-sans whitespace-nowrap">
                        {formatDateDDMMYYYY(row.entryDate)}
                      </td>

                      {/* 5. Advance Payment Status & Receipt */}
                      <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 block">
                          {formatBDT(effectiveAdvAmount)}
                        </span>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            advStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : advStatus === 'Partially Paid'
                              ? 'bg-amber-100 text-amber-800'
                              : advStatus === 'Adjusted'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {advStatus}
                        </span>
                        {(advStatus === 'Paid' || advStatus === 'Partially Paid' || hasAdvAmount) && advStatus !== 'N/A' && advStatus !== 'Not Paid' && !isOwnerFlat && (
                          <div className="mt-1">
                            <button
                              onClick={() => handleGenerateAdvanceReceipt({ ...row, advancePayment: effectiveAdvAmount })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Advance Payment Receipt (Owner Signed)"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Flat Rent Status & Receipt */}
                      <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 block">
                          {formatBDT(row.flatRent)}
                        </span>
                        <div className="mt-0.5 inline-block">
                          <select
                            value={rentStatus}
                            onChange={(e) => {
                              const newStatus = e.target.value as 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
                              handleQuickUpdateRentStatus(row, newStatus);
                            }}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border focus:outline-hidden cursor-pointer ${
                              rentStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : rentStatus === 'Partially Paid'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : rentStatus === 'Adjusted'
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : rentStatus === 'N/A'
                                ? 'bg-slate-50 text-slate-500 border-slate-200'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            <option value="Paid">Paid</option>
                            <option value="Not Paid">Not Paid</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Adjusted">Adjusted</option>
                            <option value="N/A">N/A</option>
                          </select>
                        </div>
                        {rentStatus === 'Paid' && row.flatRent > 0 && (
                          <div className="mt-1">
                            <button
                              onClick={() => handleGenerateRentReceipt(row)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Flat Rent Receipt (Owner Signed)"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 7. Electricity Bill Status & Receipt */}
                      <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                        {(() => {
                          const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === row.flatId.toLowerCase().trim());
                          const isUnitElecOn =
                            row.electricityBill > 0 ||
                            ((unit?.unitType === 'residential' || unit?.unitType === 'godown' || !unit) &&
                             (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter' || !unit?.electricityBillingType)) &&
                             unit?.electricityBillingType !== 'none');

                          if (!isUnitElecOn) {
                            return (
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-medium text-slate-400 block">৳0</span>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  OFF
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">No Bill</span>
                              </div>
                            );
                          }

                          return (
                            <>
                              <span className="font-mono font-bold text-slate-800 block">
                                {row.electricityBill > 0 ? formatBDT(row.electricityBill) : '৳0'}
                              </span>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  elecStatus === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : elecStatus === 'N/A'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {elecStatus}
                              </span>
                              {row.electricityBill > 0 && (
                                <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                                  {getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).monthName.slice(0, 3)} Bill
                                </span>
                              )}
                              {elecStatus === 'Paid' && row.electricityBill > 0 && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => handleGenerateElectricityReceipt(row)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Generate Official Electricity Bill Receipt (Owner Signed)"
                                  >
                                    <Receipt className="w-3 h-3" />
                                    <span>Generate Receipt</span>
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Summary Footer */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold font-mono">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-slate-900 font-sans text-right">
                  Block Totals:
                </td>
                <td className="py-3 px-4 text-right text-indigo-700 whitespace-nowrap">
                  {formatBDT(
                    filteredLedger.reduce((acc, curr) => {
                      const advAcc = data.advanceAccounts.find((a) => a.flatId === curr.flatId);
                      return acc + (advAcc ? getEffectiveRemainingAdvance(advAcc, data.ledgerItems) : (curr.advancePayment || 0));
                    }, 0)
                  )}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 whitespace-nowrap">
                  {formatBDT(filteredLedger.reduce((acc, curr) => acc + curr.flatRent, 0))}
                </td>
                <td className="py-3 px-4 text-right text-slate-900 whitespace-nowrap">
                  {formatBDT(filteredLedger.reduce((acc, curr) => acc + curr.electricityBill, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* MANUAL LEDGER ENTRY & UPDATE MODAL FOR OWNER */}
      <ManualLedgerEntryModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setItemToEditManual(null);
        }}
        itemToEdit={itemToEditManual}
        data={data}
        onSave={(savedItem) => {
          if (onSaveLedgerItem) {
            onSaveLedgerItem(savedItem);
          }
        }}
        userRole="owner"
        assignedBlock={blockName}
      />

      {/* COPY PREVIOUS MONTH CONFIRMATION MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Copy className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Copy Data from Previous Month
                  </h3>
                  <p className="text-xs text-slate-500">
                    From: <strong>{prevMonthName} {prevYearNum}</strong> &rarr; To: <strong>{currentMonthName} {data.selectedYear}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-slate-700">
                Are you sure you want to initialize <strong>{currentMonthName} {data.selectedYear}</strong> ledger by copying baseline tenant data from <strong>{prevMonthName} {prevYearNum}</strong>?
              </p>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Fields Copied from Previous Month:
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    1. Flat ID
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    2. Tenant Name
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    3. Mobile Number
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    4. Entry Date
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    5. Security Advance
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    6. Monthly Flat Rent
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5 text-[11px] text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Fields Reset to Empty for Manual Input:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-700">
                  <li><strong>7. Electricity Bill:</strong> Set to ৳0 / Empty (ready for your sub-meter manual input)</li>
                  <li><strong>Payment Status:</strong> Initialized to &quot;Not Paid&quot; (৳0 paid) for the new month</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCopyPreviousMonth}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Confirm & Copy Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL / GOOGLE SHEET IMPORT MODAL */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        data={data}
        initialMonth={data.selectedMonth}
        initialYear={data.selectedYear}
        assignedBlock={blockName}
        userRole="owner"
        onImportSuccess={(items, targetM, targetY, options) => {
          if (onImportLedgerData) {
            onImportLedgerData(items, targetM, targetY, options);
            setImportSuccessMsg(
              `Successfully extracted & imported ${items.length} flats into ${getMonthName(targetM)} ${targetY} ledger! Saved to database.`
            );
            setTimeout(() => setImportSuccessMsg(null), 6000);
          }
        }}
      />
    </div>
  );
};

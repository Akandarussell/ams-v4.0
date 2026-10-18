import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Printer,
  Download,
  FileSpreadsheet,
  PlusCircle,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Calendar,
  X,
  Building,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  SlidersHorizontal,
  Layers,
  Car,
  Warehouse,
  TrendingUp,
  Percent,
  Edit3,
  Copy,
  Zap,
  Coins,
  Eye,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
  KeyRound,
  Wallet,
  LayoutGrid,
  Table,
  Phone,
  Clock,
} from 'lucide-react';
import {
  AppDatabaseState,
  MonthlyLedgerItem,
  PaymentMethod,
  PaymentStatus,
  PrintableReceipt,
  UserProfile,
  ElectricityBill,
  NescoTariffConfig,
} from '../types';
import {
  formatBDT,
  formatDateDDMMYYYY,
  getMonthName,
  MONTH_NAMES,
  getPostpaidElectricityPeriod,
  getPostpaidElectricityTenantInfo,
  calculateNescoElectricityBill,
  calculateMultiSystemElectricityBill,
  NescoBillingSystem,
  DEFAULT_NESCO_TARIFF,
} from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { formatBillingPeriod, upsertBatchRemoteMonthlyRentRecords } from '../lib/api';
import { getSupabaseCredentials } from '../lib/supabase';
import { getEffectiveRemainingAdvance, calculateItemTotalDue, compareFlatIdSerial } from '../lib/storage';
import { exportAllCredentialsToExcel } from '../lib/exportCredentials';
import { ManualLedgerEntryModal } from './ManualLedgerEntryModal';
import { ExcelImportModal } from './ExcelImportModal';
import { NescoBillGeneratorModal } from './NescoBillGeneratorModal';

interface Props {
  data: AppDatabaseState;
  onRecordPayment: (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    category: 'Combined' | 'Flat Rent' | 'Electricity' | 'Parking' | 'Godown' | 'Advance',
    transactionId?: string,
    notes?: string
  ) => void;
  onAdjustFromAdvance: (flatId: string, amount: number, notes?: string) => { success: boolean; message: string };
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onViewBill?: (bill: ElectricityBill) => void;
  onUpdateMonthYear: (month: number, year: number) => void;
  onSaveLedgerItem?: (item: MonthlyLedgerItem) => void;
  onCopyPreviousMonthLedger?: (targetMonth: number, targetYear: number, sourceMonth?: number, sourceYear?: number) => void;
  onImportLedgerData?: (
    items: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => void;
  onGenerateElectricityBills?: (
    consumptionMonth: number,
    consumptionYear: number,
    billingMonth: number,
    billingYear: number,
    customReadings?: any
  ) => void;
  onToggleUnitElectricity?: (flatId: string, enabled: boolean) => void;
  onDeleteLedgerItem?: (
    itemId: string,
    flatId: string,
    month: number,
    year: number,
    deleteFromMasterUnits?: boolean
  ) => void;
  userRole: string;
  assignedBlock?: string;
  currentUser?: UserProfile;
  initialBlockFilter?: string;
}

export const MainLedger: React.FC<Props> = ({
  data,
  onRecordPayment,
  onAdjustFromAdvance,
  onViewReceipt,
  onViewBill,
  onUpdateMonthYear,
  onSaveLedgerItem,
  onCopyPreviousMonthLedger,
  onImportLedgerData,
  onGenerateElectricityBills,
  onToggleUnitElectricity,
  onDeleteLedgerItem,
  userRole,
  assignedBlock,
  currentUser,
  initialBlockFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [blockFilter, setBlockFilter] = useState<string>(
    userRole === 'owner' && assignedBlock
      ? assignedBlock
      : initialBlockFilter || 'all'
  );

  useEffect(() => {
    if (userRole !== 'owner' && initialBlockFilter) {
      setBlockFilter(initialBlockFilter);
    }
  }, [initialBlockFilter, userRole]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlyDuesFilter, setOnlyDuesFilter] = useState<boolean>(false);
  const [unitTypeFilter, setUnitTypeFilter] = useState<'all' | 'parking' | 'godown'>('all');
  const [sortBy, setSortBy] = useState<'flat' | 'payable' | 'paid' | 'due' | 'name'>('flat');

  // Full Screen Mode State
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  // Mobile Layout Mode (Cards view vs Table view on smartphones)
  const [mobileLayoutMode, setMobileLayoutMode] = useState<'cards' | 'table'>('cards');

  // Keyboard shortcut listener: press Escape to exit full screen
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Month & Year Filter
  const [filterMonth, setFilterMonth] = useState<number>(data.selectedMonth);
  const [filterYear, setFilterYear] = useState<number>(data.selectedYear);

  // Manual Entry / Edit Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [itemToEditManual, setItemToEditManual] = useState<MonthlyLedgerItem | null>(null);

  // Copy from Previous Month Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // NESCO Electricity Generator Modal State
  const [isNescoModalOpen, setIsNescoModalOpen] = useState(false);
  const [nescoSuccessMsg, setNescoSuccessMsg] = useState<string | null>(null);

  // Quick Single-Unit NESCO Meter Edit State (Supports 3 Billing Systems + ON/OFF Toggle)
  const [quickUnitNesco, setQuickUnitNesco] = useState<{
    flatId: string;
    tenantName: string;
    billingEnabled: boolean;
    billingSystem: NescoBillingSystem;
    previousReading: number;
    currentReading: number;
    consumedUnits: number;
    fixedUnitRate: number;
    fixedBillAmount: number;
    demandRate: number;
    sanctionedLoad: number;
    meterRent: number;
    vatPercentage: number;
    lastMonthReadingValue?: number;
    lastMonthAvailable?: boolean;
    lastMonthPeriodLabel?: string;
  } | null>(null);

  // Excel / Google Sheet Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Keep filterMonth & filterYear in sync with data.selectedMonth & data.selectedYear
  React.useEffect(() => {
    setFilterMonth(data.selectedMonth);
    setFilterYear(data.selectedYear);
  }, [data.selectedMonth, data.selectedYear]);

  const prevMonthNum = filterMonth === 1 ? 12 : filterMonth - 1;
  const prevYearNum = filterMonth === 1 ? filterYear - 1 : filterYear;
  const prevMonthName = getMonthName(prevMonthNum);
  const currentMonthName = getMonthName(filterMonth);

  const handleConfirmCopyPreviousMonth = () => {
    if (onCopyPreviousMonthLedger) {
      onCopyPreviousMonthLedger(filterMonth, filterYear, prevMonthNum, prevYearNum);
      setIsCopyModalOpen(false);
      setCopySuccessMsg(`Successfully copied ledger baseline from ${prevMonthName} ${prevYearNum}. Electricity and Parking data are reset to empty for manual input.`);
      setTimeout(() => setCopySuccessMsg(null), 5000);
    }
  };

  // Signature Metadata: Owners get Owner's sign, Manager and Tenant get Manager's sign
  const getSignatureMeta = () => {
    if (userRole === 'owner') {
      const block = assignedBlock || currentUser?.assignedBlock || 'Block A';
      const ownerLastName =
        block === 'Block A'
          ? 'Rashed'
          : block === 'Block B'
          ? 'Raju'
          : block === 'Block C'
          ? 'Rony'
          : currentUser?.fullName?.toLowerCase().includes('rashed')
          ? 'Rashed'
          : currentUser?.fullName?.toLowerCase().includes('raju')
          ? 'Raju'
          : currentUser?.fullName?.toLowerCase().includes('rony')
          ? 'Rony'
          : 'Owner';

      return {
        authorizedSignatureRole: 'owner' as const,
        signatureTitle: `${ownerLastName} (${block} Owner)`,
        authorizedSignatureBy: ownerLastName,
      };
    }
    // manager and tenant accounts
    return {
      authorizedSignatureRole: 'manager' as const,
      signatureTitle: "Russell (Manager)",
      authorizedSignatureBy: 'Russell',
    };
  };

  // Receipt Generators for Payment Types
  const handleGenerateAdvanceReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
    onViewReceipt({
      receiptNumber: `REC-ADV-${item.flatId}-${data.selectedYear}`,
      type: 'advance',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: item.blockName,
      amount: item.advancePayment,
      paymentDate: item.advanceDate || item.entryDate || '2026-10-01',
      paymentMethod: 'Cash',
      purpose: `Security Advance Deposit - Flat ${item.flatId} (${item.blockName})`,
      remainingAdvance: item.advancePayment,
      ...sig,
      breakdown: [
        { label: 'Security Advance Deposit', amount: item.advancePayment },
      ],
    });
  };

  const handleGenerateRentReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
    onViewReceipt({
      receiptNumber: `REC-RENT-${item.flatId}-${data.selectedMonth}-${data.selectedYear}`,
      type: item.paymentStatus === 'Adjusted' ? 'adjustment' : 'rent',
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      flatId: item.flatId,
      blockName: item.blockName,
      amount: item.flatRent,
      paymentDate: item.rentPaymentDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: item.paymentStatus === 'Adjusted' ? 'Advance Adjustment' : 'Cash',
      purpose: `Monthly Flat Rent for ${getMonthName(data.selectedMonth)} ${data.selectedYear} - Flat ${item.flatId}`,
      remainingDue: item.totalDue,
      remainingAdvance: item.advancePayment,
      ...sig,
      breakdown: [
        { label: `Flat Rent (${getMonthName(data.selectedMonth)} ${data.selectedYear})`, amount: item.flatRent },
        ...(item.parkingRent > 0 ? [{ label: 'Parking Rent', amount: item.parkingRent }] : []),
      ],
    });
  };

  const handleGenerateElectricityReceipt = (item: MonthlyLedgerItem) => {
    const sig = getSignatureMeta();
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
      blockName: item.blockName,
      amount: item.electricityBill,
      paymentDate: item.electricityDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: 'Cash',
      monthName: elecPeriod.monthName,
      year: elecPeriod.year,
      purpose: `NESCO Sub-Meter Electricity Bill for ${elecPeriod.displayStr} (Postpaid Billing for ${getMonthName(item.month || data.selectedMonth)} ${item.year || data.selectedYear} Rent) - Flat ${item.flatId}`,
      ...sig,
      breakdown: [
        { label: `Postpaid Electricity Consumption (${elecPeriod.displayStr})`, amount: item.electricityBill },
      ],
    });
  };

  // Quick Inline Flat Rent Status Changer (for Manager & Owner)
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

    let paymentStatus: PaymentStatus = 'Not Paid';
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

  // Modals

  const [adjustModalItem, setAdjustModalItem] = useState<MonthlyLedgerItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string>('');

  // Delete flat row modal state (to remove duplicate or unwanted entries)
  const [rowToDelete, setRowToDelete] = useState<MonthlyLedgerItem | null>(null);
  const [deleteFromUnitsMaster, setDeleteFromUnitsMaster] = useState<boolean>(false);

  // Handle Month / Year apply
  const handleApplyMonthYear = (month: number = filterMonth, year: number = filterYear) => {
    onUpdateMonthYear(month, year);
  };

  const handlePrevMonth = () => {
    let newM = filterMonth - 1;
    let newY = filterYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setFilterMonth(newM);
    setFilterYear(newY);
    handleApplyMonthYear(newM, newY);
  };

  const handleNextMonth = () => {
    let newM = filterMonth + 1;
    let newY = filterYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setFilterMonth(newM);
    setFilterYear(newY);
    handleApplyMonthYear(newM, newY);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    if (userRole !== 'owner') {
      setBlockFilter('all');
    }
    setStatusFilter('all');
    setOnlyDuesFilter(false);
    setUnitTypeFilter('all');
    setSortBy('flat');
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    (userRole !== 'owner' && blockFilter !== 'all') ||
    statusFilter !== 'all' ||
    onlyDuesFilter ||
    unitTypeFilter !== 'all' ||
    sortBy !== 'flat';

  // Filter ledger for active month & year
  const activeMonthLedger = data.ledgerItems.filter(
    (item) => item.month === data.selectedMonth && item.year === data.selectedYear
  );

  // Scoped ledger for current role (if block owner)
  const scopedLedger = activeMonthLedger.filter((item) => {
    if (userRole === 'owner' && assignedBlock && item.blockName !== assignedBlock) {
      return false;
    }
    return true;
  });

  // Calculate live counts for quick status tabs
  const countAll = scopedLedger.length;
  const countPaid = scopedLedger.filter((i) => i.paymentStatus === 'Paid').length;
  const countPartial = scopedLedger.filter((i) => i.paymentStatus === 'Partially Paid').length;
  const countDue = scopedLedger.filter((i) => calculateItemTotalDue(i) > 0).length;
  const countAdjusted = scopedLedger.filter((i) => i.paymentStatus === 'Adjusted' || i.rentStatus === 'Adjusted').length;
  const countNA = scopedLedger.filter((i) => i.paymentStatus === 'N/A').length;

  // Supabase Save / Sync status
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    setSyncStatusMsg(null);
    const billingPeriod = formatBillingPeriod(filterMonth, filterYear);
    console.log(`[Manual Supabase Save Operation] Re-running save for ${activeMonthLedger.length} units in ${billingPeriod}...`);
    try {
      const { isConfigured } = getSupabaseCredentials();
      if (!isConfigured) {
        const infoMsg = `Supabase PostgreSQL is not connected yet. All financial records are securely saved on the local server database. Click 'Database Setup' in the header to connect your Supabase PostgreSQL project.`;
        console.info(`[Manual Supabase Save Operation] ${infoMsg}`);
        setSyncStatusMsg({ type: 'info', text: infoMsg });
        return;
      }

      if (activeMonthLedger.length === 0) {
        const infoMsg = `No ledger records found for period ${billingPeriod} to save.`;
        console.warn(`[Manual Supabase Save Operation] ${infoMsg}`);
        setSyncStatusMsg({ type: 'info', text: infoMsg });
        return;
      }

      const res = await upsertBatchRemoteMonthlyRentRecords(activeMonthLedger);
      if (res.success) {
        const msg = `Successfully saved ${res.count} unit records to Supabase for ${billingPeriod} with explicit block_key!`;
        console.log(`[Manual Supabase Save Operation Success] ${msg}`);
        setSyncStatusMsg({ type: 'success', text: msg });
      } else {
        const errObj = res.error;
        const errText =
          (errObj && typeof errObj === 'object' && errObj.message) ||
          (typeof errObj === 'string' ? errObj : JSON.stringify(errObj)) ||
          'Save operation encountered an issue';
        console.error(`[Manual Supabase Save Operation Error] Save failed:`, errText);
        setSyncStatusMsg({ type: 'error', text: `Supabase save error: ${errText}` });
      }
    } catch (err: any) {
      console.error(`[Manual Supabase Save Operation Exception]:`, err);
      setSyncStatusMsg({ type: 'error', text: `Exception: ${err?.message || err}` });
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSyncStatusMsg(null), 8000);
    }
  };

  const filteredItems = scopedLedger
    .filter((item) => {
      if (blockFilter !== 'all' && item.blockName !== blockFilter) {
        return false;
      }
      if (statusFilter !== 'all' && item.paymentStatus !== statusFilter) {
        return false;
      }
      if (onlyDuesFilter && calculateItemTotalDue(item) <= 0) {
        return false;
      }
      if (unitTypeFilter === 'parking' && item.parkingRent <= 0) {
        return false;
      }
      if (unitTypeFilter === 'godown' && item.godownRent <= 0) {
        return false;
      }
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (
        item.flatId.toLowerCase().includes(search) ||
        item.tenantName.toLowerCase().includes(search) ||
        item.tenantPhone.toLowerCase().includes(search) ||
        item.blockName.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'payable') return (b.totalPayable - a.totalPayable) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'paid') return (b.totalPaid - a.totalPaid) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'due') return (calculateItemTotalDue(b) - calculateItemTotalDue(a)) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'name') return a.tenantName.localeCompare(b.tenantName) || compareFlatIdSerial(a.flatId, b.flatId);
      return compareFlatIdSerial(a.flatId, b.flatId);
    });

  // Totals for the table footer & ribbon
  const totalPayable = filteredItems.reduce((acc, curr) => acc + curr.totalPayable, 0);
  const totalPaid = filteredItems.reduce((acc, curr) => acc + curr.totalPaid, 0);
  const totalDue = filteredItems.reduce((acc, curr) => acc + calculateItemTotalDue(curr), 0);
  const collectionPercentage = totalPayable > 0 ? Math.round((totalPaid / totalPayable) * 100) : 0;

  // Postpaid electricity consumption period rule
  const currentPostpaidPeriod = getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear);

  // 1. Advance (Paid vs Due) for units in filtered ledger:
  // Count all paid subtotal amount in the month as paid amount and not paid subtotal amount in the month as due
  let advancePaid = 0;
  let advanceDue = 0;
  let advancePaidCount = 0;
  let advanceDueCount = 0;

  filteredItems.forEach((item) => {
    if (item.flatId.toLowerCase().includes('owner')) return;
    const rawAdvStatus = (item.advanceStatus || '').trim().toLowerCase();
    const matchingAdv = data.advanceAccounts.find(
      (a) => a.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim()
    );
    const isMarkedPaid = rawAdvStatus === 'paid';
    const isMarkedPartial = rawAdvStatus === 'partially paid' || rawAdvStatus === 'partially_paid';
    const isNotPaid = rawAdvStatus === 'not paid' || rawAdvStatus === 'not_paid';

    const effectiveAdvAmount =
      item.advancePayment !== undefined && item.advancePayment !== null && Number(item.advancePayment) > 0
        ? Number(item.advancePayment)
        : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
        ? matchingAdv.amountPaid
        : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
        ? matchingAdv.totalRequired
        : (item.flatRent > 0 ? item.flatRent * 2 : 0);

    const advStatus =
      rawAdvStatus === 'n/a'
        ? 'N/A'
        : isNotPaid
        ? 'Not Paid'
        : isMarkedPaid
        ? 'Paid'
        : isMarkedPartial || matchingAdv?.status === 'partially_paid'
        ? 'Partially Paid'
        : rawAdvStatus === 'adjusted'
        ? 'Adjusted'
        : (matchingAdv?.status === 'paid' || (!rawAdvStatus && effectiveAdvAmount > 0))
        ? 'Paid'
        : 'Not Paid';

    if (advStatus === 'Paid' || advStatus === 'Adjusted') {
      advancePaid += effectiveAdvAmount;
      if (effectiveAdvAmount > 0) advancePaidCount++;
    } else if (advStatus === 'Not Paid') {
      advanceDue += effectiveAdvAmount;
      if (effectiveAdvAmount > 0) advanceDueCount++;
    } else if (advStatus === 'Partially Paid') {
      const paidPart = (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
        ? Math.min(matchingAdv.amountPaid, effectiveAdvAmount)
        : Math.round(effectiveAdvAmount / 2);
      const duePart = Math.max(0, (matchingAdv?.totalRequired || effectiveAdvAmount) - paidPart);
      advancePaid += paidPart;
      advanceDue += duePart;
      if (paidPart > 0) advancePaidCount++;
      if (duePart > 0) advanceDueCount++;
    }
  });

  const advanceTotalRequired = advancePaid + advanceDue;
  const totalAdvance = advancePaid;

  // 2. Current Month Flat Rent (Paid vs Due)
  const rentPaid = filteredItems.reduce((sum, item) => {
    if (item.rentStatus === 'Paid' || item.rentStatus === 'Adjusted') return sum + (item.flatRent || 0);
    if (item.rentStatus === 'Partially Paid') {
      const elecPaid = item.electricityStatus === 'Paid' ? (item.electricityBill || 0) : 0;
      return sum + Math.max(0, (item.totalPaid || 0) - elecPaid);
    }
    if (item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted') return sum + (item.flatRent || 0);
    return sum;
  }, 0);

  const rentDue = filteredItems.reduce((sum, item) => {
    if (item.rentStatus === 'Adjusted' || item.rentStatus === 'Paid' || item.rentStatus === 'N/A') return sum;
    if (item.paymentStatus === 'Adjusted' || item.paymentStatus === 'Paid' || item.paymentStatus === 'N/A') return sum;
    if (item.rentStatus === 'Partially Paid') {
      const elecPaid = item.electricityStatus === 'Paid' ? (item.electricityBill || 0) : 0;
      const paidRent = Math.max(0, (item.totalPaid || 0) - elecPaid);
      return sum + Math.max(0, (item.flatRent || 0) - paidRent);
    }
    return sum + (item.flatRent || 0);
  }, 0);

  const rentTotalRequired = rentPaid + rentDue;

  const rentPaidCount = filteredItems.filter(
    (i) => i.rentStatus === 'Paid' || i.rentStatus === 'Adjusted' || (!i.rentStatus && (i.paymentStatus === 'Paid' || i.paymentStatus === 'Adjusted'))
  ).length;
  const rentDueCount = filteredItems.filter(
    (i) => i.rentStatus !== 'Paid' && i.rentStatus !== 'Adjusted' && i.rentStatus !== 'N/A' && (i.flatRent || 0) > 0
  ).length;

  // 3. Current Month Electricity Bill (Paid vs Due)
  const elecPaid = filteredItems.reduce((sum, item) => {
    if (item.electricityStatus === 'Paid') return sum + (item.electricityBill || 0);
    if (item.electricityStatus === 'Partially Paid') return sum + Math.round((item.electricityBill || 0) / 2);
    return sum;
  }, 0);

  const elecDue = filteredItems.reduce((sum, item) => {
    if (item.electricityStatus === 'Paid' || item.electricityStatus === 'N/A') return sum;
    if (item.electricityStatus === 'Partially Paid') return sum + Math.round((item.electricityBill || 0) / 2);
    return sum + (item.electricityBill || 0);
  }, 0);

  const elecTotalRequired = elecPaid + elecDue;

  const elecPaidCount = filteredItems.filter(
    (i) => i.electricityStatus === 'Paid' && (i.electricityBill || 0) > 0
  ).length;
  const elecDueCount = filteredItems.filter(
    (i) => i.electricityStatus !== 'Paid' && i.electricityStatus !== 'N/A' && (i.electricityBill || 0) > 0
  ).length;
  const totalConsumedKwh = filteredItems.reduce((acc, curr) => {
    const existingBill = data.electricityBills.find(
      (b) =>
        b.flatId.toLowerCase().trim() === curr.flatId.toLowerCase().trim() &&
        b.consumptionMonth === currentPostpaidPeriod.month &&
        b.consumptionYear === currentPostpaidPeriod.year
    );
    const existingReading = data.meterReadings.find(
      (r) =>
        r.flatId.toLowerCase().trim() === curr.flatId.toLowerCase().trim() &&
        r.month === currentPostpaidPeriod.month &&
        r.year === currentPostpaidPeriod.year
    );
    const kwh = existingBill?.consumedUnits ?? existingReading?.consumedUnits ?? (curr.electricityBill > 0 ? 220 : 0);
    return acc + kwh;
  }, 0);


  // Open Adjust from Advance Modal
  const openAdjustModal = (item: MonthlyLedgerItem) => {
    setAdjustModalItem(item);
    const matchingAdv = data.advanceAccounts.find((a) => a.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim());
    const availableEscrow = matchingAdv ? getEffectiveRemainingAdvance(matchingAdv, data.ledgerItems) : (item.advancePayment || 0);
    setAdjustAmount(Math.min(item.flatRent, availableEscrow));
    setAdjustNotes('Departure notice: last month flat rent adjusted from escrow advance');
    setAdjustError('');
  };

  const handleConfirmAdjustment = () => {
    if (!adjustModalItem || adjustAmount <= 0) return;
    const result = onAdjustFromAdvance(adjustModalItem.flatId, adjustAmount, adjustNotes);
    if (!result.success) {
      setAdjustError(result.message);
      return;
    }
    setAdjustModalItem(null);
  };

  // Export to CSV (Aligned with 8 ledger columns)
  const handleExportCSV = () => {
    const headers = [
      'Flat ID',
      'Tenant Name',
      'Mobile Number',
      'Entry Date',
      'Advance Payment',
      'Flat Rent',
      'Electricity Bill',
      'NESCO Billing (kWh)',
    ];
    const rows = filteredItems.map((item) => {
      const existingBill = data.electricityBills.find(
        (b) =>
          b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
          b.consumptionMonth === currentPostpaidPeriod.month &&
          b.consumptionYear === currentPostpaidPeriod.year
      );
      const existingReading = data.meterReadings.find(
        (r) =>
          r.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
          r.month === currentPostpaidPeriod.month &&
          r.year === currentPostpaidPeriod.year
      );
      const kwh = existingBill?.consumedUnits ?? existingReading?.consumedUnits ?? (item.electricityBill > 0 ? 220 : 0);
      const prevR = existingBill?.previousReading ?? existingReading?.previousReading ?? 1500;
      const currR = existingBill?.currentReading ?? existingReading?.currentReading ?? (prevR + kwh);

      return [
        `"${item.flatId}"`,
        `"${item.tenantName}"`,
        `"${item.tenantPhone}"`,
        `"${item.entryDate}"`,
        item.advancePayment,
        item.flatRent,
        item.electricityBill,
        `"${kwh} kWh (${prevR}->${currR})"`,
      ];
    });

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `MBD_Apartment_Ledger_${getMonthName(data.selectedMonth)}_${data.selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel-compatible HTML format
  const handleExportExcel = () => {
    let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"/></head><body>
    <h2>${COMPLEX_CONFIG.name.toUpperCase()} - MAIN FINANCIAL LEDGER</h2>
    <p>${COMPLEX_CONFIG.address} | Contact: ${COMPLEX_CONFIG.contacts}</p>
    <p>Period: ${getMonthName(data.selectedMonth)} ${data.selectedYear}</p>
    <table border="1">
      <thead>
        <tr style="background:#0f172a; color:#ffffff;">
          <th>Flat ID</th><th>Tenant Name</th><th>Mobile</th><th>Entry Date</th>
          <th>Advance</th><th>Flat Rent</th><th>Electricity</th><th>NESCO Billing (kWh)</th>
        </tr>
      </thead>
      <tbody>`;

    filteredItems.forEach((row) => {
      const existingBill = data.electricityBills.find(
        (b) =>
          b.flatId.toLowerCase().trim() === row.flatId.toLowerCase().trim() &&
          b.consumptionMonth === currentPostpaidPeriod.month &&
          b.consumptionYear === currentPostpaidPeriod.year
      );
      const existingReading = data.meterReadings.find(
        (r) =>
          r.flatId.toLowerCase().trim() === row.flatId.toLowerCase().trim() &&
          r.month === currentPostpaidPeriod.month &&
          r.year === currentPostpaidPeriod.year
      );
      const kwh = existingBill?.consumedUnits ?? existingReading?.consumedUnits ?? (row.electricityBill > 0 ? 220 : 0);

      tableHtml += `<tr>
        <td>${row.flatId}</td><td>${row.tenantName}</td><td>${row.tenantPhone}</td><td>${row.entryDate}</td>
        <td>${row.advancePayment}</td><td>${row.flatRent}</td><td>${row.electricityBill}</td><td>${kwh} kWh</td>
      </tr>`;
    });

    tableHtml += `</tbody></table></body></html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MBD_Apartment_Ledger_${getMonthName(data.selectedMonth)}_${data.selectedYear}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={
        isFullScreen
          ? 'fixed inset-0 z-50 bg-slate-100 overflow-y-auto p-3 sm:p-5 w-screen h-screen flex flex-col space-y-4'
          : 'space-y-6'
      }
    >
      {/* Full Screen Mode Active Indicator Banner */}
      {isFullScreen && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-2.5 rounded-2xl border border-blue-800/60 shadow-md flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400">
              <Maximize2 className="w-4 h-4" />
            </span>
            <span>
              ⚡ Full Screen Mode Active &bull; Showing all 9 Columns ({filteredItems.length} units listed for {getMonthName(data.selectedMonth)} {data.selectedYear})
            </span>
          </div>
          <button
            onClick={() => setIsFullScreen(false)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exit Full Screen (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5 text-rose-300" />
            <span>Exit Full Screen (Esc)</span>
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {COMPLEX_CONFIG.name} - Financial Ledger
                </h1>
                <span className="px-3 py-1 bg-blue-900 text-white font-black text-xs sm:text-sm rounded-lg shadow-xs tracking-wide">
                  {getMonthName(data.selectedMonth).toUpperCase()} {data.selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {COMPLEX_CONFIG.address}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong> &bull; Period: <span className="font-extrabold text-blue-900 text-xs sm:text-sm underline underline-offset-2">{getMonthName(data.selectedMonth)} {data.selectedYear}</span> <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold ml-1">Period: {formatBillingPeriod(data.selectedMonth, data.selectedYear)}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Month Navigation with Bold Styling */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border-2 border-slate-300 shadow-xs">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <Calendar className="w-4 h-4 text-blue-600 mx-0.5 shrink-0" />
            <select
              value={filterMonth}
              onChange={(e) => {
                const newM = Number(e.target.value);
                setFilterMonth(newM);
                handleApplyMonthYear(newM, filterYear);
              }}
              className="bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-black rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer tracking-tight"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1} className="font-bold">
                  {m}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => {
                const newY = Number(e.target.value);
                setFilterYear(newY);
                handleApplyMonthYear(filterMonth, newY);
              }}
              className="bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-black rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer tracking-tight"
            >
              {Array.from({ length: 77 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={y} className="font-bold">
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Upload & Extract from Excel / Google Sheet Button - Manager only */}
          {onImportLedgerData && userRole === 'manager' && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="Upload & extract data from Excel or Google Sheet to automatically fill up fields"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📥 Upload Excel / Google Sheet</span>
            </button>
          )}

          {/* NESCO Electricity Billing Quick Generator */}
          {onGenerateElectricityBills && (userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={() => setIsNescoModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs hover:shadow-md"
              title={`Generate & calculate NESCO electricity bills for all rental units for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
            >
              <Zap className="w-4 h-4 text-slate-950 fill-current" />
              <span>⚡ Generate NESCO Bills</span>
            </button>
          )}

          {/* Copy Data from Previous Month Button - Manager only */}
          {onCopyPreviousMonthLedger && userRole === 'manager' && (
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title={`Copy baseline tenant data from ${prevMonthName} ${prevYearNum} with Electricity & Parking empty for manual input`}
            >
              <Copy className="w-4 h-4" />
              <span>📋 Copy from Prev Month ({prevMonthName})</span>
            </button>
          )}

          {/* Manual Entry Button for Owners and Managers */}
          {(userRole === 'manager' || userRole === 'owner') && (
            <>
              <button
                onClick={() => {
                  setItemToEditManual(null);
                  setIsManualModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                title="Add or update ledger data manually"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add / Edit Ledger Data Manually</span>
              </button>
            </>
          )}

          {/* Sync / Save to Supabase Button */}
          {(userRole === 'manager' || userRole === 'owner') && (
            <button
              onClick={handleSyncToSupabase}
              disabled={isSyncingSupabase}
              className={`flex items-center gap-1.5 px-3.5 py-2 ${
                isSyncingSupabase
                  ? 'bg-slate-500 cursor-not-allowed text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer'
              } text-xs font-bold rounded-xl transition-all shadow-xs`}
              title="Re-run save operation to Supabase monthly_rent_records with explicit block_key"
            >
              <RotateCcw className={`w-4 h-4 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
              <span>{isSyncingSupabase ? 'Saving to Supabase...' : '💾 Sync to Supabase'}</span>
            </button>
          )}

          {/* Export, Print & Full Screen */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Full Screen Mode Toggle Button */}
            <button
              onClick={() => setIsFullScreen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 ${
                isFullScreen
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
              } text-xs font-black rounded-xl transition-all cursor-pointer`}
              title={
                isFullScreen
                  ? 'Exit Full Screen mode (Esc)'
                  : 'Display Monthly Ledger in Full Screen Mode to show all 9 columns clearly'
              }
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-rose-200" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-amber-400" />
                  <span>⛶ Full Screen Mode</span>
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Print official A4 ledger report"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print A4</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Export data to CSV format"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Download formatted Excel (.xls) spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>

            {userRole === 'manager' && (
              <button
                onClick={() => exportAllCredentialsToExcel(data, { blockFilter: blockFilter !== 'all' ? blockFilter : undefined })}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                title="1-Click export all flat IDs and login passwords for tenants and authority accounts (.xlsx)"
              >
                <KeyRound className="w-4 h-4 text-blue-200" />
                <span>Export Passwords</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Supabase Save / Sync Result Alert Banner */}
      {syncStatusMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            syncStatusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : syncStatusMsg.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatusMsg.type === 'info' ? (
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button
            onClick={() => setSyncStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-base cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Copy Previous Month Success Alert */}
      {copySuccessMsg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{copySuccessMsg}</span>
          </div>
          <button onClick={() => setCopySuccessMsg(null)} className="text-indigo-400 hover:text-indigo-600 text-base cursor-pointer">
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
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600 text-base cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* NESCO Electricity Bill Generation Alert Banner */}
      {nescoSuccessMsg && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 fill-current shrink-0" />
            <span>{nescoSuccessMsg}</span>
          </div>
          <button onClick={() => setNescoSuccessMsg(null)} className="text-amber-600 hover:text-amber-800 text-base cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Empty Billing Period Alert Banner with 1-Click Clone Option */}
      {activeMonthLedger.length === 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5 shadow-xs">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900">
                  Billing Period {formatBillingPeriod(data.selectedMonth, data.selectedYear)} ({getMonthName(data.selectedMonth)} {data.selectedYear}) has no records in Supabase yet.
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                  Empty Billing Period
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Each month maintains its own independent record in <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-800">monthly_rent_records</code> matching on <code className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-amber-200 text-slate-800">(unit_id, billing_period)</code>. You can copy the tenant roster from <strong className="text-slate-800">{prevMonthName} {prevYearNum}</strong> with reset payment statuses.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onCopyPreviousMonthLedger && userRole === 'manager' && (
              <button
                onClick={() => setIsCopyModalOpen(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                title={`Clone roster from ${prevMonthName} ${prevYearNum} into ${formatBillingPeriod(data.selectedMonth, data.selectedYear)}`}
              >
                <Copy className="w-4 h-4" />
                <span>Clone Roster from {prevMonthName}</span>
              </button>
            )}
            {(userRole === 'manager' || userRole === 'owner') && (
              <button
                onClick={() => {
                  setItemToEditManual(null);
                  setIsManualModalOpen(true);
                }}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-all cursor-pointer shadow-xs"
              >
                + Add Manually
              </button>
            )}
          </div>
        </div>
      )}

      {/* COMPREHENSIVE DATA FILTERING BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Bar Header & Quick Status Pills */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
              Data Filtering Bar
            </span>
          </div>

          {/* Quick Status Tabs with Live Count Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>All Units</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countAll}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
              }`}
            >
              <span>Paid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPaid}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Partially Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Partially Paid'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <span>Partial</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countPartial}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Not Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Not Paid'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-800 text-rose-300 hover:bg-slate-700'
              }`}
            >
              <span>Due / Unpaid</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countDue}</span>
            </button>

            <button
              onClick={() => setStatusFilter('Adjusted')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Adjusted'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-800 text-purple-300 hover:bg-slate-700'
              }`}
            >
              <span>Advance Adjusted</span>
              <span className="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]">{countAdjusted}</span>
            </button>
          </div>
        </div>

        {/* Detailed Filter Inputs Row */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Input with Clear Button */}
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Flat ID, Tenant, Phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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

            {/* Block Filter (Scoped for Admin, or visible if manager) */}
            {userRole !== 'owner' ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> Block:
                </span>
                <select
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                  className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="all">All Blocks (A, B, C)</option>
                  <option value="Block A">Block A (Rashed)</option>
                  <option value="Block B">Block B (Raju)</option>
                  <option value="Block C">Block C (Rony)</option>
                </select>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-200 text-xs font-bold text-blue-800">
                {assignedBlock} Filter Active
              </div>
            )}

            {/* Unit Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Units:
              </span>
              <select
                value={unitTypeFilter}
                onChange={(e) => setUnitTypeFilter(e.target.value as any)}
                className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="all">All Units</option>
                <option value="godown">With Godown Rent</option>
              </select>
            </div>

            {/* Quick Toggle: Show Dues Only */}
            <button
              onClick={() => setOnlyDuesFilter(!onlyDuesFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                onlyDuesFilter
                  ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertCircle className={`w-3.5 h-3.5 ${onlyDuesFilter ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Pending Dues Only</span>
              {countDue > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  onlyDuesFilter ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {countDue}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="flat">Flat ID (Ascending)</option>
                <option value="due">Highest Total Due</option>
                <option value="payable">Highest Total Payable</option>
                <option value="paid">Highest Total Paid</option>
                <option value="name">Tenant Name (A-Z)</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Clear all search and filter conditions"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Ribbon & Filter Status Bar with Paid vs Due Boxes */}
        <div className="px-4 sm:px-5 py-4 bg-slate-50/90 border-t border-slate-200/90 flex flex-col gap-3.5 text-xs">
          {/* Top Info Bar: Showing count & Total Collection Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2 text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-500">Showing:</span>
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200/80 text-blue-700 rounded-lg font-bold text-xs">
                {filteredItems.length} of {scopedLedger.length} Units
              </span>
              {isAnyFilterActive && (
                <span className="text-[11px] text-amber-700 font-semibold px-2 py-0.5 bg-amber-50 rounded-md border border-amber-200/70">
                  Filtered view active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 font-sans">
              <span className="text-xs font-bold text-slate-700">{collectionPercentage}% Total Collected</span>
              <div className="w-24 sm:w-32 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, collectionPercentage)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* 3 Monthly Accounting KPI Boxes: Advance Paid vs Due, Flat Rent Paid vs Due, Electricity Bill Paid vs Due */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {/* Box 1: Advance Paid vs Due */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                    Advance (Paid vs Due)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                    Paid vs Due
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Advance Paid</span>
                    <div className="text-base sm:text-lg font-black text-indigo-700 font-mono tabular-nums">
                      {formatBDT(advancePaid)}
                    </div>
                  </div>
                  <div className="border-l border-slate-100 pl-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Advance Due</span>
                    <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${advanceDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatBDT(advanceDue)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>{advancePaidCount} Paid &bull; {advanceDueCount} Due</span>
                  <span className="font-mono text-slate-400 text-[10px]">Total: {formatBDT(advanceTotalRequired)}</span>
                </div>
              </div>
              <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
                <div
                  className="bg-indigo-600 h-1.5 transition-all"
                  style={{ width: `${advanceTotalRequired > 0 ? (advancePaid / advanceTotalRequired) * 100 : 100}%` }}
                ></div>
                <div
                  className="bg-rose-500 h-1.5 transition-all"
                  style={{ width: `${advanceTotalRequired > 0 ? (advanceDue / advanceTotalRequired) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Box 2: Current Month Flat Rent Paid vs Due */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    {getMonthName(data.selectedMonth)} Flat Rent
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    Paid vs Due
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rent Paid</span>
                    <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tabular-nums">
                      {formatBDT(rentPaid)}
                    </div>
                  </div>
                  <div className="border-l border-slate-100 pl-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rent Due</span>
                    <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${rentDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatBDT(rentDue)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>{rentPaidCount} Paid (incl. adj) &bull; {rentDueCount} Due</span>
                  <span className="font-mono text-slate-400 text-[10px]">Req: {formatBDT(rentTotalRequired)}</span>
                </div>
              </div>
              <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-1.5 transition-all"
                  style={{ width: `${rentTotalRequired > 0 ? (rentPaid / rentTotalRequired) * 100 : 100}%` }}
                ></div>
                <div
                  className="bg-rose-500 h-1.5 transition-all"
                  style={{ width: `${rentTotalRequired > 0 ? (rentDue / rentTotalRequired) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Box 3: Electricity Bill Paid vs Due */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between sm:col-span-2 lg:col-span-1">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {currentPostpaidPeriod.monthName} Electricity
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                    Postpaid Bill
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bill Paid</span>
                    <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tabular-nums">
                      {formatBDT(elecPaid)}
                    </div>
                  </div>
                  <div className="border-l border-slate-100 pl-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bill Due</span>
                    <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${elecDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {formatBDT(elecDue)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>{elecPaidCount} Paid &bull; {elecDueCount} Due</span>
                  <span className="font-mono text-slate-400 text-[10px]">Req: {formatBDT(elecTotalRequired)}</span>
                </div>
              </div>
              <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-1.5 transition-all"
                  style={{ width: `${elecTotalRequired > 0 ? (elecPaid / elecTotalRequired) * 100 : 100}%` }}
                ></div>
                <div
                  className="bg-rose-500 h-1.5 transition-all"
                  style={{ width: `${elecTotalRequired > 0 ? (elecDue / elecTotalRequired) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher (Smartphones) */}
      <div className="md:hidden flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">View:</span>
          <span className="text-xs font-extrabold text-slate-800">{filteredItems.length} Units</span>
        </div>
        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileLayoutMode('cards')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              mobileLayoutMode === 'cards'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileLayoutMode('table')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              mobileLayoutMode === 'table'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Mobile Card Layout (Visible when mobileLayoutMode === 'cards' on small screens) */}
      {mobileLayoutMode === 'cards' && (
        <div className="md:hidden space-y-3.5 mb-6">
          {filteredItems.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 font-sans text-xs">
              No ledger entries found matching your search and filter criteria.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isOwnerFlat = item.flatId.toLowerCase().includes('owner');
              const rawAdvStatus = (item.advanceStatus || '').trim();
              const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId);
              const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
              const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

              const effectiveAdvAmount =
                item.advancePayment !== undefined && item.advancePayment !== null && Number(item.advancePayment) > 0
                  ? Number(item.advancePayment)
                  : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
                  ? matchingAdv.amountPaid
                  : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
                  ? matchingAdv.totalRequired
                  : (item.flatRent > 0 ? item.flatRent * 2 : 0);

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
                item.rentStatus ||
                (item.paymentStatus === 'Adjusted'
                  ? 'Adjusted'
                  : item.paymentStatus === 'Paid'
                  ? 'Paid'
                  : item.paymentStatus === 'Partially Paid'
                  ? 'Partially Paid'
                  : item.paymentStatus === 'N/A'
                  ? 'N/A'
                  : 'Not Paid');

              const elecPeriod = currentPostpaidPeriod;
              const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim());

              const existingBill = data.electricityBills.find(
                (b) =>
                  b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                  b.consumptionMonth === elecPeriod.month &&
                  b.consumptionYear === elecPeriod.year
              );
              const existingReading = data.meterReadings.find(
                (r) =>
                  r.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                  r.month === elecPeriod.month &&
                  r.year === elecPeriod.year
              );

              const prevReading = existingBill?.previousReading ?? existingReading?.previousReading ?? 1500;
              const currReading =
                existingBill?.currentReading ??
                existingReading?.currentReading ??
                (item.electricityBill > 0 ? prevReading + 220 : prevReading);
              const consumedKwh =
                existingBill?.consumedUnits ??
                existingReading?.consumedUnits ??
                Math.max(0, currReading - prevReading);
              const hasGenerated = (existingBill && existingBill.totalBill > 0) || item.electricityBill > 0;

              const billedTenantName =
                existingBill?.tenantName?.trim() ||
                item.tenantName;

              return (
                <div
                  key={`mobile-card-${item.id}`}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="px-3 py-1 bg-blue-900 text-white font-mono font-black text-sm rounded-xl shadow-xs">
                        {item.flatId}
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          {item.blockName}
                        </span>
                        <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                          {item.tenantName}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(userRole === 'manager' || userRole === 'owner') && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setItemToEditManual(item);
                              setIsManualModalOpen(true);
                            }}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors cursor-pointer"
                            title="Edit Ledger Entry"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3.5 text-xs">
                    {/* Contact & Move-in Info */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      {item.tenantPhone && item.tenantPhone !== '--' ? (
                        <a
                          href={`tel:${item.tenantPhone}`}
                          className="min-h-[44px] px-3.5 py-2 inline-flex items-center gap-2 bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 transition-colors text-xs cursor-pointer active:scale-95"
                          title="Call Tenant"
                        >
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-mono">{item.tenantPhone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 font-mono">No phone</span>
                      )}

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Entry Date</span>
                        <span className="font-mono text-slate-600 font-semibold text-xs">
                          {formatDateDDMMYYYY(item.entryDate)}
                        </span>
                      </div>
                    </div>

                    {/* Financial Items Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Advance Escrow */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Advance Escrow
                          </span>
                          <span className="text-sm font-black text-indigo-700 font-mono tabular-nums block mt-0.5">
                            {formatBDT(effectiveAdvAmount)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-center ${
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
                            <button
                              type="button"
                              onClick={() => handleGenerateAdvanceReceipt({ ...item, advancePayment: effectiveAdvAmount })}
                              className="min-h-[40px] w-full px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Advance Receipt</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Flat Rent */}
                      <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Flat Rent
                          </span>
                          <span className="text-sm font-black text-slate-900 font-mono tabular-nums block mt-0.5">
                            {formatBDT(item.flatRent)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold text-center border ${
                              rentStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rentStatus === 'Partially Paid'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : rentStatus === 'Adjusted'
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : rentStatus === 'N/A'
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {rentStatus}
                          </span>
                          {rentStatus === 'Paid' && item.flatRent > 0 && (
                            <button
                              type="button"
                              onClick={() => handleGenerateRentReceipt(item)}
                              className="min-h-[40px] w-full px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Rent Receipt</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Electricity Item Banner */}
                    <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-600 fill-current" />
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                            NESCO Electricity ({getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).monthName.slice(0, 3)})
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-sm font-black text-amber-950 font-mono tabular-nums">
                            {item.electricityBill > 0 ? formatBDT(item.electricityBill) : '৳0'}
                          </span>
                          {consumedKwh > 0 && (
                            <span className="text-[11px] font-bold text-amber-800 font-mono">
                              ({consumedKwh} kWh)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasGenerated ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onViewBill) {
                                if (existingBill) {
                                  onViewBill(existingBill);
                                } else {
                                  const calc = calculateNescoElectricityBill(currReading, prevReading, data.tariffConfig, 2);
                                  const syntheticBill: ElectricityBill = {
                                    id: `eb-${item.flatId.toLowerCase().trim()}-${elecPeriod.month}-${elecPeriod.year}`,
                                    unitId: item.unitId || `u-${item.flatId.toLowerCase().trim()}`,
                                    flatId: item.flatId,
                                    tenantId: item.tenantId || '',
                                    tenantName: billedTenantName,
                                    consumptionMonth: elecPeriod.month,
                                    consumptionYear: elecPeriod.year,
                                    billingMonth: data.selectedMonth,
                                    billingYear: data.selectedYear,
                                    previousReading: prevReading,
                                    currentReading: currReading,
                                    consumedUnits: consumedKwh || calc.consumedUnits,
                                    slabBreakdown: calc.slabBreakdown,
                                    baseEnergyCost: calc.baseEnergyCost,
                                    demandCharge: calc.demandCharge,
                                    vatAmount: calc.vatAmount,
                                    meterRent: calc.meterRent,
                                    rebateAmount: calc.rebateAmount,
                                    totalBill: item.electricityBill || calc.totalBill,
                                    paidAmount: item.paymentStatus === 'Paid' ? (item.electricityBill || calc.totalBill) : 0,
                                    dueAmount: item.paymentStatus === 'Paid' ? 0 : (item.electricityBill || calc.totalBill),
                                    paymentStatus: item.paymentStatus === 'Paid' ? 'Paid' : 'Not Paid',
                                    generatedDate: new Date().toISOString().split('T')[0],
                                    tariffSnapshotTitle: data.tariffConfig.title,
                                  };
                                  onViewBill(syntheticBill);
                                }
                              }
                            }}
                            className="min-h-[40px] px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="View NESCO Voucher"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>Voucher</span>
                          </button>
                        ) : (
                          (userRole === 'manager' || userRole === 'owner') && onGenerateElectricityBills && (
                            <button
                              type="button"
                              onClick={() => {
                                const stdCurrent = prevReading + 220;
                                const calc = calculateNescoElectricityBill(stdCurrent, prevReading, data.tariffConfig, 2);
                                onGenerateElectricityBills(
                                  elecPeriod.month,
                                  elecPeriod.year,
                                  data.selectedMonth,
                                  data.selectedYear,
                                  [
                                    {
                                      flatId: item.flatId,
                                      previousReading: prevReading,
                                      currentReading: stdCurrent,
                                      consumedUnits: 220,
                                      billAmount: calc.totalBill,
                                    },
                                  ]
                                );
                                setNescoSuccessMsg(`⚡ Generated 220 kWh bill (৳${calc.totalBill.toLocaleString()}) for Flat ${item.flatId}!`);
                                setTimeout(() => setNescoSuccessMsg(null), 5000);
                              }}
                              className="min-h-[40px] px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            >
                              <Zap className="w-3 h-3 fill-current" />
                              <span>+220 kWh</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Total Due & Full-Width Action Button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Net Due</span>
                        <span className={`text-base font-black font-mono tabular-nums ${item.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.totalDue > 0 ? formatBDT(item.totalDue) : '৳0 Paid'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Main Financial Ledger Table (8 Columns) */}
      <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden ${mobileLayoutMode === 'cards' ? 'hidden md:block' : 'block'}`}>
        {/* Printable Sheet Header (Visible Only When Printing) */}
        <div className="hidden print:block p-6 text-center border-b-2 border-slate-900 mb-4 bg-white">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{COMPLEX_CONFIG.name.toUpperCase()}</h1>
          <p className="text-xs text-slate-700 font-medium mt-1">{COMPLEX_CONFIG.address}</p>
          <p className="text-xs text-slate-600 mt-0.5">Hotline Contacts: <strong>{COMPLEX_CONFIG.contacts}</strong></p>
          <div className="mt-2 inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs text-slate-900">
            Official Monthly Financial Ledger &bull; {getMonthName(data.selectedMonth)} {data.selectedYear}
          </div>
        </div>

        <div className="table-scroll-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20">
              <tr>
                <th className="py-3.5 px-3.5 whitespace-nowrap sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">
                  1. Flat ID
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">2. Tenant Name</th>
                <th className="py-3.5 px-3 whitespace-nowrap">3. Mobile</th>
                <th className="py-3.5 px-3 whitespace-nowrap">4. Entry Date</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">5. Advance</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">6. Flat Rent</th>
                <th
                  className="py-3.5 px-3 text-right whitespace-nowrap"
                  title={`Postpaid Electricity for ${getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).displayStr} (Flat Rent Month: ${getMonthName(data.selectedMonth)} ${data.selectedYear})`}
                >
                  7. Electricity
                  <span className="block text-[10px] font-normal text-slate-300">
                    ({getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).monthName.slice(0, 3)} Postpaid)
                  </span>
                </th>
                <th
                  className="py-3.5 px-3.5 text-center whitespace-nowrap bg-amber-950/40 border-l border-amber-800/40"
                  title="Sub-meter Readings & Official NESCO Voucher"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-300">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>8. NESCO Billing</span>
                  </div>
                  <span className="block text-[10px] font-normal text-amber-200/80">
                    (kWh & Voucher)
                  </span>
                </th>
                {(userRole === 'manager' || userRole === 'owner') && (
                  <th
                    className="py-3.5 px-3 text-center whitespace-nowrap bg-rose-950/40 text-rose-300 border-l border-rose-800/40"
                    title="Delete entire row for flat (Remove duplicate entry)"
                  >
                    9. Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={(userRole === 'manager' || userRole === 'owner') ? 9 : 8} className="py-12 text-center text-slate-500 font-sans text-sm">
                    {activeMonthLedger.length === 0 ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-slate-800 text-base">
                          No records for {getMonthName(data.selectedMonth)} {data.selectedYear} ({formatBillingPeriod(data.selectedMonth, data.selectedYear)})
                        </p>
                        <p className="text-xs text-slate-500">
                          This billing period is currently empty. You can clone the tenant roster from the previous month with reset payment statuses, or upload an Excel sheet.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          {onCopyPreviousMonthLedger && userRole === 'manager' && (
                            <button
                              onClick={() => setIsCopyModalOpen(true)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy from Prev Month ({prevMonthName})</span>
                            </button>
                          )}
                          {onImportLedgerData && userRole === 'manager' && (
                            <button
                              onClick={() => setIsImportModalOpen(true)}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Upload Excel / Sheet</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      'No ledger entries found matching your search and filter criteria.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isOwnerFlat = item.flatId.toLowerCase().includes('owner');
                  const rawAdvStatus = (item.advanceStatus || '').trim();
                  const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId);
                  const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
                  const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

                  const effectiveAdvAmount =
                    item.advancePayment !== undefined && item.advancePayment !== null && Number(item.advancePayment) > 0
                      ? Number(item.advancePayment)
                      : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
                      ? matchingAdv.amountPaid
                      : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
                      ? matchingAdv.totalRequired
                      : (item.flatRent > 0 ? item.flatRent * 2 : 0);

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
                    item.rentStatus ||
                    (item.paymentStatus === 'Adjusted'
                      ? 'Adjusted'
                      : item.paymentStatus === 'Paid'
                      ? 'Paid'
                      : item.paymentStatus === 'Partially Paid'
                      ? 'Partially Paid'
                      : item.paymentStatus === 'N/A'
                      ? 'N/A'
                      : 'Not Paid');
                  const elecStatus =
                    item.electricityStatus ||
                    (item.electricityBill === 0
                      ? 'N/A'
                      : item.paymentStatus === 'Paid'
                      ? 'Paid'
                      : 'Not Paid');

                  return (
                    <tr key={item.id} className="group hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-blue-700 font-sans whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-blue-800">{item.flatId}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {item.blockName}
                            </span>
                          </div>
                          {(userRole === 'manager' || userRole === 'owner') && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setItemToEditManual(item);
                                  setIsManualModalOpen(true);
                                }}
                                title="Edit this ledger record manually"
                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900 font-sans whitespace-nowrap">
                        {item.tenantName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-sans whitespace-nowrap">
                        {item.tenantPhone}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-sans whitespace-nowrap">
                        {formatDateDDMMYYYY(item.entryDate)}
                      </td>

                      {/* 5. Advance Payment Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        <span className="font-mono tabular-nums font-bold text-indigo-700 block">
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
                              onClick={() => handleGenerateAdvanceReceipt({ ...item, advancePayment: effectiveAdvAmount })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Advance Payment Receipt"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 6. Flat Rent Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        <span className="font-mono tabular-nums font-bold text-slate-800 block">
                          {formatBDT(item.flatRent)}
                        </span>
                        <div className="mt-0.5 inline-block">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              rentStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rentStatus === 'Partially Paid'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : rentStatus === 'Adjusted'
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : rentStatus === 'N/A'
                                ? 'bg-slate-100 text-slate-600 border-slate-300'
                                : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {rentStatus}
                          </span>
                        </div>
                        {rentStatus === 'Paid' && item.flatRent > 0 ? (
                          <div className="mt-1">
                            <button
                              onClick={() => handleGenerateRentReceipt(item)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                              title="Generate Official Flat Rent Receipt"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Generate Receipt</span>
                            </button>
                          </div>
                        ) : null}
                      </td>

                      {/* 7. Electricity Bill Status & Receipt */}
                      <td className="py-3 px-3 text-right font-sans whitespace-nowrap">
                        {(() => {
                          const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim());
                          const isUnitElecOn =
                            item.electricityBill > 0 ||
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
                                {item.electricityBill > 0 ? formatBDT(item.electricityBill) : '৳0'}
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
                              {item.electricityBill > 0 && (
                                <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                                  {getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).monthName.slice(0, 3)} Bill
                                </span>
                              )}
                              {elecStatus === 'Paid' && item.electricityBill > 0 && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => handleGenerateElectricityReceipt(item)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                    title="Generate Official Electricity Bill Receipt"
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

                      {/* 8. NESCO Billing (Sub-meter kWh, Readings & Voucher Actions) */}
                      <td className="py-3 px-3 text-center font-sans whitespace-nowrap bg-amber-50/25 border-l border-amber-100/80">
                        {(() => {
                          const elecPeriod = currentPostpaidPeriod;
                          const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim());
                          const isElecOn =
                            item.electricityBill > 0 ||
                            ((unit?.unitType === 'residential' || unit?.unitType === 'godown' || !unit) &&
                             (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter' || !unit?.electricityBillingType)) &&
                             unit?.electricityBillingType !== 'none');

                          // Find existing bill or meter reading for postpaid period
                          const existingBill = data.electricityBills.find(
                            (b) =>
                              b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                              b.consumptionMonth === elecPeriod.month &&
                              b.consumptionYear === elecPeriod.year
                          );
                          const existingReading = data.meterReadings.find(
                            (r) =>
                              r.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                              r.month === elecPeriod.month &&
                              r.year === elecPeriod.year
                          );

                          const prevReading = existingBill?.previousReading ?? existingReading?.previousReading ?? 1500;
                          const currReading =
                            existingBill?.currentReading ??
                            existingReading?.currentReading ??
                            (item.electricityBill > 0 ? prevReading + 220 : prevReading);
                          const consumedKwh =
                            existingBill?.consumedUnits ??
                            existingReading?.consumedUnits ??
                            Math.max(0, currReading - prevReading);
                          const hasGenerated = (existingBill && existingBill.totalBill > 0) || item.electricityBill > 0;

                          // Helper: Postpaid electricity bills apply to prior month's usage.
                          // Issue and display bill under the name of last month's resident.
                          const priorLedgerItem = data.ledgerItems.find(
                            (li) =>
                              li.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                              li.month === elecPeriod.month &&
                              li.year === elecPeriod.year
                          );
                          const priorBill = data.electricityBills.find(
                            (b) =>
                              b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                              b.consumptionMonth === elecPeriod.month &&
                              b.consumptionYear === elecPeriod.year
                          );
                          const billedTenantName =
                            existingBill?.tenantName?.trim() ||
                            priorBill?.tenantName?.trim() ||
                            priorLedgerItem?.tenantName?.trim() ||
                            item.tenantName;

                          if (!isElecOn) {
                            return (
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    Billing OFF
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono">৳0 Exempt</span>
                                </div>
                                {(userRole === 'manager' || userRole === 'owner') && (
                                  <button
                                    onClick={() => {
                                      const lastM = elecPeriod.month === 1 ? 12 : elecPeriod.month - 1;
                                      const lastY = elecPeriod.month === 1 ? elecPeriod.year - 1 : elecPeriod.year;
                                      const lastMonthBill = data.electricityBills.find(
                                        (b) =>
                                          b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                                          b.consumptionMonth === lastM &&
                                          b.consumptionYear === lastY
                                      );
                                      const lastMonthMr = data.meterReadings.find(
                                        (r) =>
                                          r.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                                          r.month === lastM &&
                                          r.year === lastY
                                      );
                                      const lastVal = lastMonthBill?.currentReading ?? lastMonthMr?.currentReading;
                                      const hasLast = lastVal !== undefined;
                                      const lastLabel = `${getMonthName(lastM)} ${lastY}`;

                                      setQuickUnitNesco({
                                        flatId: item.flatId,
                                        tenantName: billedTenantName,
                                        billingEnabled: false,
                                        billingSystem: 'regular_nesco',
                                        previousReading: 0,
                                        currentReading: 0,
                                        consumedUnits: 0,
                                        fixedUnitRate: 15.01,
                                        fixedBillAmount: 0,
                                        demandRate: data.tariffConfig?.demandChargePerKW ?? 42,
                                        sanctionedLoad: 3,
                                        meterRent: data.tariffConfig?.meterRent ?? 40,
                                        vatPercentage: data.tariffConfig?.vatPercentage ?? 5,
                                        lastMonthReadingValue: lastVal,
                                        lastMonthAvailable: hasLast,
                                        lastMonthPeriodLabel: lastLabel,
                                      });
                                    }}
                                    title={`Configure NESCO billing for Flat ${item.flatId} (Turn ON / readings)`}
                                    className="p-1 hover:bg-amber-100 text-slate-500 hover:text-amber-900 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col items-center justify-center gap-1">
                              {/* Energy Consumption Badge & Edit Action */}
                              <div className="flex items-center gap-1.5">
                                {hasGenerated ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                                    <Zap className="w-3 h-3 text-amber-600 fill-current shrink-0" />
                                    {consumedKwh} kWh
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Not Generated
                                  </span>
                                )}

                                {/* Quick Edit Reading Button */}
                                {(userRole === 'manager' || userRole === 'owner') && (
                                  <button
                                    onClick={() => {
                                      const lastM = elecPeriod.month === 1 ? 12 : elecPeriod.month - 1;
                                      const lastY = elecPeriod.month === 1 ? elecPeriod.year - 1 : elecPeriod.year;
                                      const lastMonthBill = data.electricityBills.find(
                                        (b) =>
                                          b.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                                          b.consumptionMonth === lastM &&
                                          b.consumptionYear === lastY
                                      );
                                      const lastMonthMr = data.meterReadings.find(
                                        (r) =>
                                          r.flatId.toLowerCase().trim() === item.flatId.toLowerCase().trim() &&
                                          r.month === lastM &&
                                          r.year === lastY
                                      );
                                      const lastVal = lastMonthBill?.currentReading ?? lastMonthMr?.currentReading;
                                      const hasLast = lastVal !== undefined;
                                      const lastLabel = `${getMonthName(lastM)} ${lastY}`;

                                      let detectedSystem: NescoBillingSystem = 'regular_nesco';
                                      if (existingBill?.slabBreakdown?.[0]?.slabName?.includes('Fixed Price')) {
                                        detectedSystem = 'fixed_price_bill';
                                      } else if (existingBill?.slabBreakdown?.[0]?.slabName?.includes('Fixed Unit')) {
                                        detectedSystem = 'fixed_unit_price';
                                      }

                                      setQuickUnitNesco({
                                        flatId: item.flatId,
                                        tenantName: billedTenantName,
                                        billingEnabled: isElecOn,
                                        billingSystem: detectedSystem,
                                        previousReading: prevReading,
                                        currentReading: currReading,
                                        consumedUnits: consumedKwh,
                                        fixedUnitRate: 15.01,
                                        fixedBillAmount: item.electricityBill > 0 ? item.electricityBill : 1500,
                                        demandRate: data.tariffConfig?.demandChargePerKW ?? 42,
                                        sanctionedLoad: existingBill?.sanctionedLoadKW || 3,
                                        meterRent: data.tariffConfig?.meterRent ?? 40,
                                        vatPercentage: data.tariffConfig?.vatPercentage ?? 5,
                                        lastMonthReadingValue: lastVal,
                                        lastMonthAvailable: hasLast,
                                        lastMonthPeriodLabel: lastLabel,
                                      });
                                    }}
                                    title={`Configure NESCO billing for Flat ${item.flatId}`}
                                    className="p-1 hover:bg-amber-100 text-slate-500 hover:text-amber-900 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Reading Range Subtext */}
                              <div className="text-[10px] text-slate-500 font-mono">
                                <span title="Previous Reading">{prevReading}</span>
                                <span className="mx-1 text-slate-400">&rarr;</span>
                                <span title="Current Reading" className="font-semibold text-slate-700">{currReading}</span>
                              </div>

                              {/* Action Buttons: View Voucher or Generate */}
                              <div className="flex items-center gap-1 mt-0.5">
                                {hasGenerated ? (
                                  <button
                                    onClick={() => {
                                      if (onViewBill) {
                                        if (existingBill) {
                                          onViewBill(existingBill);
                                        } else {
                                          const calc = calculateNescoElectricityBill(
                                            currReading,
                                            prevReading,
                                            data.tariffConfig,
                                            2
                                          );
                                          const syntheticBill: ElectricityBill = {
                                            id: `eb-${item.flatId.toLowerCase().trim()}-${elecPeriod.month}-${elecPeriod.year}`,
                                            unitId: item.unitId || `u-${item.flatId.toLowerCase().trim()}`,
                                            flatId: item.flatId,
                                            tenantId: item.tenantId || '',
                                            tenantName: billedTenantName,
                                            consumptionMonth: elecPeriod.month,
                                            consumptionYear: elecPeriod.year,
                                            billingMonth: data.selectedMonth,
                                            billingYear: data.selectedYear,
                                            previousReading: prevReading,
                                            currentReading: currReading,
                                            consumedUnits: consumedKwh || calc.consumedUnits,
                                            slabBreakdown: calc.slabBreakdown,
                                            baseEnergyCost: calc.baseEnergyCost,
                                            demandCharge: calc.demandCharge,
                                            vatAmount: calc.vatAmount,
                                            meterRent: calc.meterRent,
                                            rebateAmount: calc.rebateAmount,
                                            totalBill: item.electricityBill || calc.totalBill,
                                            paidAmount: item.paymentStatus === 'Paid' ? (item.electricityBill || calc.totalBill) : 0,
                                            dueAmount: item.paymentStatus === 'Paid' ? 0 : (item.electricityBill || calc.totalBill),
                                            paymentStatus: item.paymentStatus === 'Paid' ? 'Paid' : 'Not Paid',
                                            generatedDate: new Date().toISOString().split('T')[0],
                                            tariffSnapshotTitle: data.tariffConfig.title,
                                          };
                                          onViewBill(syntheticBill);
                                        }
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 rounded text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                                    title="View & Print Official NESCO Bill Voucher"
                                  >
                                    <Zap className="w-3 h-3 text-amber-600 fill-current" />
                                    <span>NESCO Voucher</span>
                                  </button>
                                ) : (
                                  (userRole === 'manager' || userRole === 'owner') && onGenerateElectricityBills && (
                                    <button
                                      onClick={() => {
                                        const stdCurrent = prevReading + 220;
                                        const calc = calculateNescoElectricityBill(stdCurrent, prevReading, data.tariffConfig, 2);
                                        onGenerateElectricityBills(
                                          elecPeriod.month,
                                          elecPeriod.year,
                                          data.selectedMonth,
                                          data.selectedYear,
                                          [
                                            {
                                              flatId: item.flatId,
                                              previousReading: prevReading,
                                              currentReading: stdCurrent,
                                              consumedUnits: 220,
                                              billAmount: calc.totalBill,
                                            },
                                          ]
                                        );
                                        setNescoSuccessMsg(`⚡ Generated 220 kWh bill (৳${calc.totalBill.toLocaleString()}) for Flat ${item.flatId}!`);
                                        setTimeout(() => setNescoSuccessMsg(null), 5000);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[10px] font-black transition-all cursor-pointer shadow-2xs"
                                      title="Generate standard 220 kWh bill for this unit"
                                    >
                                      <Zap className="w-3 h-3 fill-current" />
                                      <span>+220 kWh</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      {(userRole === 'manager' || userRole === 'owner') && (
                        <td className="py-3 px-3 text-center font-sans whitespace-nowrap border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              setRowToDelete(item);
                              setDeleteFromUnitsMaster(false);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete entire row for Flat ${item.flatId} (Remove duplicate entry)`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Summary Footer */}
            <tfoot className="bg-slate-100/90 border-t-2 border-slate-300/90 font-bold font-mono sticky bottom-0 z-10 shadow-xs">
              <tr>
                <td colSpan={4} className="py-3 px-3.5 text-slate-900 font-sans text-right font-extrabold sticky left-0 bg-slate-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Grand Totals:
                </td>
                <td className="py-3 px-3 text-right text-indigo-700 whitespace-nowrap tabular-nums">
                  {formatBDT(totalAdvance)}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 whitespace-nowrap tabular-nums">
                  {formatBDT(filteredItems.reduce((acc, curr) => acc + curr.flatRent, 0))}
                </td>
                <td className="py-3 px-3 text-right text-slate-900 whitespace-nowrap tabular-nums">
                  {formatBDT(filteredItems.reduce((acc, curr) => acc + curr.electricityBill, 0))}
                </td>
                <td className="py-3 px-3 text-center text-amber-950 bg-amber-50/70 border-l border-amber-200/80 whitespace-nowrap font-bold text-xs tabular-nums">
                  ⚡ Total: {totalConsumedKwh.toLocaleString()} kWh
                </td>
                {(userRole === 'manager' || userRole === 'owner') && (
                  <td className="py-3 px-3 border-l border-slate-200"></td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


      {/* ADJUST FROM ADVANCE MODAL */}
      {adjustModalItem && (() => {
        const matchingAdvForModal = data.advanceAccounts.find(
          (a) => a.flatId.toLowerCase().trim() === adjustModalItem.flatId.toLowerCase().trim()
        );
        const availableEscrowForModal = matchingAdvForModal
          ? getEffectiveRemainingAdvance(matchingAdvForModal, data.ledgerItems)
          : (adjustModalItem.advancePayment || 0);

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <RotateCcw className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Adjust Rent from Advance</h3>
                    <p className="text-xs text-slate-500">
                      Flat {adjustModalItem.flatId} &bull; Security Deposit Escrow Deduction
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdjustModalItem(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-purple-700 font-sans">Available Advance in Escrow:</span>
                    <span className="font-bold text-purple-900">{formatBDT(availableEscrowForModal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Flat Rent to Adjust:</span>
                    <span className="font-bold text-slate-900">{formatBDT(adjustModalItem.flatRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Current Month Due:</span>
                    <span className="font-bold text-rose-600">{formatBDT(calculateItemTotalDue(adjustModalItem))}</span>
                  </div>
                </div>

                {adjustError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                    {adjustError}
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Deduction Amount (BDT / ৳) *
                  </label>
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    max={availableEscrowForModal}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cannot exceed available security advance escrow balance of {formatBDT(availableEscrowForModal)}.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Reason / Departure Notice Notes
                  </label>
                  <input
                    type="text"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Tenant departure last month rent adjusted from advance"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => setAdjustModalItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAdjustment}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Confirm Deduction & Update Balance
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MANUAL LEDGER ENTRY & UPDATE MODAL */}
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
        userRole={userRole}
        assignedBlock={assignedBlock}
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
                    From: <strong>{prevMonthName} {prevYearNum}</strong> &rarr; To: <strong>{currentMonthName} {filterYear}</strong>
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
                Are you sure you want to initialize <strong>{currentMonthName} {filterYear}</strong> ledger by copying baseline tenant data from <strong>{prevMonthName} {prevYearNum}</strong>?
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
        initialMonth={filterMonth}
        initialYear={filterYear}
        assignedBlock={assignedBlock}
        userRole={userRole}
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

      {/* QUICK SINGLE-UNIT NESCO METER READING EDIT MODAL */}
      {quickUnitNesco && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    NESCO Billing - Flat {quickUnitNesco.flatId}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Tenant: <strong className="text-white">{quickUnitNesco.tenantName}</strong> &bull; {currentPostpaidPeriod.monthName} Postpaid
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickUnitNesco(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 1. Billing ON / OFF Toggle Button */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Electricity Billing Status
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {quickUnitNesco.billingEnabled ? 'Billing is active for this flat' : 'Billing disabled / exempt (৳0 applied)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !quickUnitNesco.billingEnabled;
                    setQuickUnitNesco({
                      ...quickUnitNesco,
                      billingEnabled: nextVal,
                      previousReading: nextVal ? (quickUnitNesco.previousReading || (quickUnitNesco.lastMonthReadingValue ?? 1500)) : 0,
                      currentReading: nextVal ? (quickUnitNesco.currentReading || ((quickUnitNesco.previousReading || (quickUnitNesco.lastMonthReadingValue ?? 1500)) + 220)) : 0,
                      consumedUnits: nextVal ? (quickUnitNesco.consumedUnits || 220) : 0,
                      fixedUnitRate: nextVal ? (quickUnitNesco.fixedUnitRate || 15.01) : 0,
                      fixedBillAmount: nextVal ? (quickUnitNesco.fixedBillAmount || 1500) : 0,
                    });
                    if (onToggleUnitElectricity) {
                      onToggleUnitElectricity(quickUnitNesco.flatId, nextVal);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    quickUnitNesco.billingEnabled
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      quickUnitNesco.billingEnabled ? 'bg-white' : 'bg-slate-500'
                    }`}
                  ></span>
                  <span>{quickUnitNesco.billingEnabled ? '⚡ Billing ON' : '🚫 Billing OFF (৳0)'}</span>
                </button>
              </div>

              {/* 2. Choose Billing System (3 Options) */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Choose System of Billing (3 Systems)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* System 1 */}
                  <button
                    type="button"
                    disabled={!quickUnitNesco.billingEnabled}
                    onClick={() =>
                      setQuickUnitNesco({
                        ...quickUnitNesco,
                        billingSystem: 'regular_nesco',
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      !quickUnitNesco.billingEnabled
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : quickUnitNesco.billingSystem === 'regular_nesco'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs cursor-pointer'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-current" />
                        No. 1
                      </span>
                      {quickUnitNesco.billingEnabled && quickUnitNesco.billingSystem === 'regular_nesco' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] block mt-1 leading-tight">
                      Regular NESCO Slabs
                    </span>
                  </button>

                  {/* System 2 */}
                  <button
                    type="button"
                    disabled={!quickUnitNesco.billingEnabled}
                    onClick={() =>
                      setQuickUnitNesco({
                        ...quickUnitNesco,
                        billingSystem: 'fixed_unit_price',
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      !quickUnitNesco.billingEnabled
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : quickUnitNesco.billingSystem === 'fixed_unit_price'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs cursor-pointer'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        No. 2
                      </span>
                      {quickUnitNesco.billingEnabled && quickUnitNesco.billingSystem === 'fixed_unit_price' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] block mt-1 leading-tight">
                      Fixed Unit Price
                    </span>
                  </button>

                  {/* System 3 */}
                  <button
                    type="button"
                    disabled={!quickUnitNesco.billingEnabled}
                    onClick={() =>
                      setQuickUnitNesco({
                        ...quickUnitNesco,
                        billingSystem: 'fixed_price_bill',
                      })
                    }
                    className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      !quickUnitNesco.billingEnabled
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : quickUnitNesco.billingSystem === 'fixed_price_bill'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-xs cursor-pointer'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        <Receipt className="w-3 h-3" />
                        No. 3
                      </span>
                      {quickUnitNesco.billingEnabled && quickUnitNesco.billingSystem === 'fixed_price_bill' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[10px] block mt-1 leading-tight">
                      Fixed Price Bill
                    </span>
                  </button>
                </div>
              </div>

              {/* 3. Inputs based on chosen system */}
              {quickUnitNesco.billingSystem === 'fixed_price_bill' ? (
                /* System 3: Fixed flat charge without unit calculation */
                <div className={`p-3.5 rounded-2xl border space-y-2 ${
                  quickUnitNesco.billingEnabled
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${quickUnitNesco.billingEnabled ? 'text-amber-950' : 'text-slate-500'}`}>
                      Fixed Monthly Bill Amount (BDT / ৳)
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      quickUnitNesco.billingEnabled ? 'text-amber-800 bg-amber-200/60' : 'text-slate-500 bg-slate-200'
                    }`}>
                      No Units Math
                    </span>
                  </div>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold font-mono text-sm ${
                      quickUnitNesco.billingEnabled ? 'text-amber-900' : 'text-slate-400'
                    }`}>৳</span>
                    <input
                      type="number"
                      disabled={!quickUnitNesco.billingEnabled}
                      value={quickUnitNesco.billingEnabled ? (quickUnitNesco.fixedBillAmount > 0 ? quickUnitNesco.fixedBillAmount : '') : ''}
                      onChange={(e) =>
                        setQuickUnitNesco({
                          ...quickUnitNesco,
                          fixedBillAmount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className={`w-full rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-black focus:outline-hidden ${
                        quickUnitNesco.billingEnabled
                          ? 'bg-white border border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'
                          : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                      placeholder={quickUnitNesco.billingEnabled ? 'e.g. 1500' : '—'}
                    />
                  </div>
                  <p className={`text-[10px] ${quickUnitNesco.billingEnabled ? 'text-amber-800' : 'text-slate-400'}`}>
                    {quickUnitNesco.billingEnabled
                      ? 'Flat lump-sum electricity charge applied directly to monthly ledger without sub-meter calculations.'
                      : 'Billing is OFF. Input field is empty and disabled.'}
                  </p>
                </div>
              ) : (
                /* System 1 or System 2: Sub-meter Readings */
                <div className="space-y-3">
                  {/* Copy Last Month's Reading Helper */}
                  <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                    quickUnitNesco.billingEnabled ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      {!quickUnitNesco.billingEnabled ? (
                        <span className="text-slate-400 text-[11px] font-medium">
                          Billing is disabled for this unit.
                        </span>
                      ) : quickUnitNesco.lastMonthAvailable && quickUnitNesco.lastMonthReadingValue !== undefined ? (
                        <span className="text-slate-700 text-[11px]">
                          Last month ({quickUnitNesco.lastMonthPeriodLabel}): <strong className="font-mono text-slate-900">{quickUnitNesco.lastMonthReadingValue} kWh</strong>
                        </span>
                      ) : (
                        <span className="text-amber-800 text-[11px] font-medium">
                          ⚠️ No reading found for {quickUnitNesco.lastMonthPeriodLabel || 'last month'}. Input both readings manually.
                        </span>
                      )}
                    </div>
                    {quickUnitNesco.billingEnabled && quickUnitNesco.lastMonthAvailable && quickUnitNesco.lastMonthReadingValue !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = quickUnitNesco.lastMonthReadingValue!;
                          const c = Math.max(p, quickUnitNesco.currentReading > p ? quickUnitNesco.currentReading : p + 220);
                          setQuickUnitNesco({
                            ...quickUnitNesco,
                            previousReading: p,
                            currentReading: c,
                            consumedUnits: Math.max(0, c - p),
                          });
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black rounded-lg cursor-pointer transition-colors shadow-2xs"
                        title="Copy last month's current reading as this month's previous reading"
                      >
                        📋 Copy Last Reading
                      </button>
                    )}
                  </div>

                  {/* Previous & Current Reading Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Previous Reading (kWh) *
                      </label>
                      <input
                        type="number"
                        disabled={!quickUnitNesco.billingEnabled}
                        value={quickUnitNesco.billingEnabled ? (quickUnitNesco.previousReading > 0 ? quickUnitNesco.previousReading : '') : ''}
                        onChange={(e) => {
                          const p = Number(e.target.value) || 0;
                          const c = Math.max(p, quickUnitNesco.currentReading);
                          setQuickUnitNesco({
                            ...quickUnitNesco,
                            previousReading: p,
                            currentReading: c,
                            consumedUnits: Math.max(0, c - p),
                          });
                        }}
                        placeholder={quickUnitNesco.billingEnabled ? 'e.g. 1500' : '—'}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden ${
                          quickUnitNesco.billingEnabled
                            ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500'
                            : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Current Reading (kWh) *
                      </label>
                      <input
                        type="number"
                        disabled={!quickUnitNesco.billingEnabled}
                        value={quickUnitNesco.billingEnabled ? (quickUnitNesco.currentReading > 0 ? quickUnitNesco.currentReading : '') : ''}
                        onChange={(e) => {
                          const c = Number(e.target.value) || 0;
                          setQuickUnitNesco({
                            ...quickUnitNesco,
                            currentReading: c,
                            consumedUnits: Math.max(0, c - quickUnitNesco.previousReading),
                          });
                        }}
                        placeholder={quickUnitNesco.billingEnabled ? 'e.g. 1720' : '—'}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-hidden ${
                          quickUnitNesco.billingEnabled
                            ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500'
                            : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Consumed Units & System 2 Custom Rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Consumed Units (kWh)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.consumedUnits > 0 ? quickUnitNesco.consumedUnits : '') : ''}
                          onChange={(e) => {
                            const units = Math.max(0, Number(e.target.value) || 0);
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              consumedUnits: units,
                              currentReading: quickUnitNesco.previousReading + units,
                            });
                          }}
                          placeholder={quickUnitNesco.billingEnabled ? '0' : '—'}
                          className={`w-full rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-hidden ${
                            quickUnitNesco.billingEnabled
                              ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500'
                              : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                        {quickUnitNesco.billingEnabled && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickUnitNesco({
                                ...quickUnitNesco,
                                consumedUnits: 220,
                                currentReading: quickUnitNesco.previousReading + 220,
                              });
                            }}
                            className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors"
                            title="Set standard 220 kWh consumption"
                          >
                            +220
                          </button>
                        )}
                      </div>
                    </div>

                    {quickUnitNesco.billingSystem === 'fixed_unit_price' ? (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Fixed Unit Rate (৳/kWh) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.fixedUnitRate > 0 ? quickUnitNesco.fixedUnitRate : '') : ''}
                          onChange={(e) => {
                            const r = Number(e.target.value) || 15.01;
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              fixedUnitRate: r,
                            });
                          }}
                          placeholder={quickUnitNesco.billingEnabled ? '15.01' : '—'}
                          className={`w-full rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-hidden ${
                            quickUnitNesco.billingEnabled
                              ? 'bg-white border border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500'
                              : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col justify-end">
                        <span className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-xl border border-slate-200">
                          Slabs: <strong>৳4.63 - ৳17.35/kWh</strong> progressive
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4 Tariff Parameters for No. 1 and No. 2 Billing Systems */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                        Tariff Parameters ({quickUnitNesco.billingSystem === 'regular_nesco' ? 'No. 1: Regular Slabs' : 'No. 2: Fixed Rate'})
                      </span>
                      <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Live Calculation
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Demand Rate (৳)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.demandRate > 0 ? quickUnitNesco.demandRate : '') : ''}
                          onChange={(e) =>
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              demandRate: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          placeholder="42"
                          className="w-full rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Sanctioned (kW)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.sanctionedLoad > 0 ? quickUnitNesco.sanctionedLoad : '') : ''}
                          onChange={(e) =>
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              sanctionedLoad: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          placeholder="3"
                          className="w-full rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Meter Rent (৳)
                        </label>
                        <input
                          type="number"
                          step="1"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.meterRent >= 0 ? quickUnitNesco.meterRent : '') : ''}
                          onChange={(e) =>
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              meterRent: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          placeholder="40"
                          className="w-full rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          VAT (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          disabled={!quickUnitNesco.billingEnabled}
                          value={quickUnitNesco.billingEnabled ? (quickUnitNesco.vatPercentage >= 0 ? quickUnitNesco.vatPercentage : '') : ''}
                          onChange={(e) =>
                            setQuickUnitNesco({
                              ...quickUnitNesco,
                              vatPercentage: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          placeholder="5"
                          className="w-full rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Live Detailed Breakdown Preview */}
              {(() => {
                if (!quickUnitNesco.billingEnabled) {
                  return (
                    <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-2xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">
                          Electricity Billing Status:
                        </span>
                        <span className="font-mono font-bold text-slate-500">
                          🚫 Billing OFF (৳0 Applied)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Input fields are empty. No bill voucher will be displayed after saving. This setting will carry forward to next months until changed manually.
                      </p>
                    </div>
                  );
                }

                const liveTariffConfig: NescoTariffConfig = {
                  ...(data.tariffConfig || DEFAULT_NESCO_TARIFF),
                  demandChargePerKW: quickUnitNesco.demandRate,
                  meterRent: quickUnitNesco.meterRent,
                  vatPercentage: quickUnitNesco.vatPercentage,
                };

                const calc = calculateMultiSystemElectricityBill({
                  billingSystem: quickUnitNesco.billingSystem,
                  currentReading: quickUnitNesco.currentReading,
                  previousReading: quickUnitNesco.previousReading,
                  fixedUnitRate: quickUnitNesco.fixedUnitRate,
                  fixedBillAmount: quickUnitNesco.fixedBillAmount,
                  tariffConfig: liveTariffConfig,
                  sanctionedLoadKW: quickUnitNesco.sanctionedLoad,
                });

                return (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-950">
                        Calculated NESCO Bill ({quickUnitNesco.billingSystem === 'fixed_price_bill' ? 'Fixed Price' : quickUnitNesco.billingSystem === 'fixed_unit_price' ? `৳${quickUnitNesco.fixedUnitRate}/unit` : 'Regular Slabs'}):
                      </span>
                      <span className="font-mono font-black text-sm text-amber-950">
                        {formatBDT(calc.totalBill)}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-800/90 flex flex-wrap items-center justify-between border-t border-amber-200/60 pt-1.5 gap-1 font-mono">
                      <span>Energy: {formatBDT(calc.baseEnergyCost)}</span>
                      {calc.demandCharge > 0 && <span>Demand: {formatBDT(calc.demandCharge)} ({quickUnitNesco.sanctionedLoad}kW@৳{quickUnitNesco.demandRate})</span>}
                      {calc.meterRent > 0 && <span>Rent: {formatBDT(calc.meterRent)}</span>}
                      {calc.vatAmount > 0 && <span>VAT: {formatBDT(calc.vatAmount)} ({quickUnitNesco.vatPercentage}%)</span>}
                    </div>
                  </div>
                );
              })()}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickUnitNesco(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // 1. Persist unit billing setting to master units so it carries forward
                    if (onToggleUnitElectricity) {
                      onToggleUnitElectricity(quickUnitNesco.flatId, quickUnitNesco.billingEnabled);
                    }

                    const liveTariffConfig: NescoTariffConfig = {
                      ...(data.tariffConfig || DEFAULT_NESCO_TARIFF),
                      demandChargePerKW: quickUnitNesco.demandRate,
                      meterRent: quickUnitNesco.meterRent,
                      vatPercentage: quickUnitNesco.vatPercentage,
                    };

                    const calc = calculateMultiSystemElectricityBill({
                      billingSystem: quickUnitNesco.billingSystem,
                      currentReading: quickUnitNesco.currentReading,
                      previousReading: quickUnitNesco.previousReading,
                      fixedUnitRate: quickUnitNesco.fixedUnitRate,
                      fixedBillAmount: quickUnitNesco.fixedBillAmount,
                      tariffConfig: liveTariffConfig,
                      sanctionedLoadKW: quickUnitNesco.sanctionedLoad,
                    });
                    const finalBillAmount = quickUnitNesco.billingEnabled ? calc.totalBill : 0;

                    if (onGenerateElectricityBills) {
                      onGenerateElectricityBills(
                        currentPostpaidPeriod.month,
                        currentPostpaidPeriod.year,
                        data.selectedMonth,
                        data.selectedYear,
                        [
                          {
                            flatId: quickUnitNesco.flatId,
                            previousReading: quickUnitNesco.billingEnabled ? quickUnitNesco.previousReading : 0,
                            currentReading: quickUnitNesco.billingEnabled ? quickUnitNesco.currentReading : 0,
                            consumedUnits: quickUnitNesco.billingEnabled ? quickUnitNesco.consumedUnits : 0,
                            billAmount: finalBillAmount,
                            slabBreakdown: quickUnitNesco.billingEnabled ? calc.slabBreakdown : [],
                            baseEnergyCost: quickUnitNesco.billingEnabled ? calc.baseEnergyCost : 0,
                            demandCharge: quickUnitNesco.billingEnabled ? calc.demandCharge : 0,
                            vatAmount: quickUnitNesco.billingEnabled ? calc.vatAmount : 0,
                            meterRent: quickUnitNesco.billingEnabled ? calc.meterRent : 0,
                            rebateAmount: 0,
                            billingSystem: quickUnitNesco.billingSystem,
                            isBillingEnabled: quickUnitNesco.billingEnabled,
                          },
                        ]
                      );
                    }

                    // Construct official ElectricityBill object only if billing is ON
                    const constructedBill: ElectricityBill = {
                      id: `eb-${quickUnitNesco.flatId.toLowerCase().trim()}-${currentPostpaidPeriod.month}-${currentPostpaidPeriod.year}`,
                      unitId: `u-${quickUnitNesco.flatId.toLowerCase().trim()}`,
                      flatId: quickUnitNesco.flatId,
                      tenantId: '',
                      tenantName: quickUnitNesco.tenantName,
                      consumptionMonth: currentPostpaidPeriod.month,
                      consumptionYear: currentPostpaidPeriod.year,
                      billingMonth: data.selectedMonth,
                      billingYear: data.selectedYear,
                      previousReading: quickUnitNesco.previousReading,
                      currentReading: quickUnitNesco.currentReading,
                      consumedUnits: quickUnitNesco.consumedUnits,
                      slabBreakdown: calc.slabBreakdown,
                      baseEnergyCost: calc.baseEnergyCost,
                      demandCharge: calc.demandCharge,
                      vatAmount: calc.vatAmount,
                      meterRent: calc.meterRent,
                      rebateAmount: 0,
                      totalBill: finalBillAmount,
                      paidAmount: 0,
                      dueAmount: finalBillAmount,
                      paymentStatus: 'Not Paid',
                      generatedDate: new Date().toISOString().split('T')[0],
                      tariffSnapshotTitle: data.tariffConfig.title,
                    };

                    setNescoSuccessMsg(
                      quickUnitNesco.billingEnabled
                        ? `⚡ Saved Flat ${quickUnitNesco.flatId} NESCO bill: ${formatBDT(finalBillAmount)} in ${getMonthName(data.selectedMonth)} ${data.selectedYear} ledger!`
                        : `⚡ Flat ${quickUnitNesco.flatId} electricity billing is OFF (৳0 applied). Setting will carry forward to next months.`
                    );
                    setTimeout(() => setNescoSuccessMsg(null), 5000);

                    // Close quick edit modal
                    setQuickUnitNesco(null);

                    // IMPORTANT: Only display bill after save and apply if billing is ON!
                    // If billing is OFF, do NOT display bill after save and apply!
                    if (quickUnitNesco.billingEnabled && onViewBill) {
                      onViewBill(constructedBill);
                    }
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Save & Apply to Ledger</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE FLAT ROW CONFIRMATION MODAL */}
      {rowToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Delete Flat Row</h3>
                  <p className="text-xs text-slate-500">
                    Remove duplicate or unwanted flat entry from ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Flat ID:</span>
                <span className="font-mono font-black text-slate-900 px-2 py-0.5 rounded bg-slate-200">
                  {rowToDelete.flatId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Resident:</span>
                <span className="font-bold text-slate-800">{rowToDelete.tenantName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Billing Period:</span>
                <span className="font-bold text-indigo-700">
                  {getMonthName(rowToDelete.month)} {rowToDelete.year}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/80 pt-1.5">
                <span className="text-slate-500 font-medium">Flat Rent:</span>
                <span className="font-mono font-bold text-slate-800">{formatBDT(rowToDelete.flatRent)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Electricity Bill:</span>
                <span className="font-mono font-bold text-amber-900">{formatBDT(rowToDelete.electricityBill)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Total Payable:</span>
                <span className="font-mono font-black text-slate-950">{formatBDT(rowToDelete.totalPayable)}</span>
              </div>
            </div>

            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              ⚠️ Are you sure you want to delete this flat row? If this was a duplicate entry, the other entry will remain safe in the ledger.
            </p>

            <label className="flex items-start gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteFromUnitsMaster}
                onChange={(e) => setDeleteFromUnitsMaster(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="font-bold text-slate-900 block">
                  Also remove Flat {rowToDelete.flatId} from master rental units list
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Check this only if this flat was accidentally created twice in the building database.
                </span>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRowToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteLedgerItem) {
                    onDeleteLedgerItem(
                      rowToDelete.id,
                      rowToDelete.flatId,
                      rowToDelete.month,
                      rowToDelete.year,
                      deleteFromUnitsMaster
                    );
                  }
                  setNescoSuccessMsg(
                    `🗑️ Successfully deleted row for Flat ${rowToDelete.flatId} from ${getMonthName(
                      rowToDelete.month
                    )} ${rowToDelete.year} ledger.`
                  );
                  setTimeout(() => setNescoSuccessMsg(null), 5000);
                  setRowToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Row</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NESCO ELECTRICITY BILL GENERATOR MODAL */}
      {onGenerateElectricityBills && (
        <NescoBillGeneratorModal
          isOpen={isNescoModalOpen}
          onClose={() => setIsNescoModalOpen(false)}
          data={data}
          billingMonth={filterMonth}
          billingYear={filterYear}
          onGenerateElectricityBills={(cM, cY, bM, bY, custom) => {
            onGenerateElectricityBills(cM, cY, bM, bY, custom);
            setNescoSuccessMsg(
              `⚡ Successfully generated NESCO electricity bills for rental units in ${getMonthName(bM)} ${bY} ledger!`
            );
            setTimeout(() => setNescoSuccessMsg(null), 6000);
          }}
          onToggleUnitElectricity={onToggleUnitElectricity}
          onViewBill={onViewBill}
          userRole={userRole}
        />
      )}
    </div>
  );
};

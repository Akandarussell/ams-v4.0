import React, { useState, useEffect } from 'react';
import {
  User,
  Building2,
  Calendar,
  Wallet,
  Zap,
  ZapOff,
  Receipt,
  Download,
  Printer,
  CreditCard,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Send,
  ArrowRight,
  Copy,
  Check,
  ShieldAlert,
  Phone,
  Lock,
} from 'lucide-react';
import {
  AppDatabaseState,
  UserProfile,
  PrintableReceipt,
  ElectricityBill,
  OnlinePaymentRequest,
  MonthlyLedgerItem,
} from '../types';
import { formatBDT, formatDateDDMMYYYY, getMonthName, getPostpaidElectricityPeriod, getPostpaidElectricityTenantInfo } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { INITIAL_BLOCK_MFS_CONFIGS, calculateItemTotalDue, getEffectiveRemainingAdvance } from '../lib/storage';

interface Props {
  currentUser: UserProfile;
  data: AppDatabaseState;
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onViewBill: (bill: ElectricityBill) => void;
  onSubmitOnlinePayment: (
    flatId: string,
    baseAmount: number,
    feeAmount: number,
    totalAmount: number,
    method: 'bKash' | 'Nagad' | 'Rocket',
    transactionId: string,
    category: string,
    recipientNumber?: string,
    recipientOwnerName?: string
  ) => void;
  onNavigateToView: (view: string) => void;
}

export const TenantPortal: React.FC<Props> = ({
  currentUser,
  data,
  onViewReceipt,
  onViewBill,
  onSubmitOnlinePayment,
  onNavigateToView,
}) => {
  const flatId = currentUser.flatId || 'A2';

  // Find tenant details - prioritize active tenant record
  const cleanFlatId = flatId.toLowerCase().trim();
  const activeTenant = data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlatId && t.status === 'active');
  const tenant = activeTenant || data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlatId);
  const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === cleanFlatId);

  // Parse tenant's entry / lease start date for strict staying period boundaries
  const entryDateStr = activeTenant?.entryDate || tenant?.entryDate || currentUser.createdAt || '';
  let entryYear = 0;
  let entryMonth = 0;
  if (entryDateStr && entryDateStr.includes('-')) {
    const parts = entryDateStr.split('-');
    entryYear = parseInt(parts[0], 10) || 0;
    entryMonth = parseInt(parts[1], 10) || 0;
  }
  const currentTenantFullName = (activeTenant?.fullName || tenant?.fullName || currentUser.fullName || '').trim().toLowerCase();

  // Privacy Rule: Check if a given record/bill falls strictly within this tenant's staying period
  const isWithinStayingPeriod = (month: number, year: number, recordTenantName?: string): boolean => {
    // 1. Entry / lease start date boundary
    if (entryYear > 0 && entryMonth > 0) {
      if (year < entryYear || (year === entryYear && month < entryMonth)) {
        return false; // Prior month/year belongs to previous occupant
      }
    }
    // 2. Tenant name matching check to block previous tenants' information
    if (recordTenantName && currentTenantFullName) {
      const recName = recordTenantName.trim().toLowerCase();
      const genericNames = ['resident', 'vacant flat', 'owner occupied', 'n/a', ''];
      if (!genericNames.includes(recName)) {
        const isMatch =
          recName === currentTenantFullName ||
          recName.includes(currentTenantFullName) ||
          currentTenantFullName.includes(recName);
        if (!isMatch) {
          return false;
        }
      }
    }
    return true;
  };

  // Find advance account strictly matching current tenant
  const advance = data.advanceAccounts.find(
    (a) => a.flatId.toLowerCase().trim() === cleanFlatId && (!a.tenantId || a.tenantId === activeTenant?.id || a.tenantId === tenant?.id)
  );

  // Historical ledger records strictly filtered to current tenant's staying period
  const flatLedgerHistory = data.ledgerItems
    .filter((item) => {
      if (item.flatId.toLowerCase().trim() !== cleanFlatId) return false;
      return isWithinStayingPeriod(item.month, item.year, item.tenantName);
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  // Active month ledger entry (bounded to staying period; falls back to current tenant's latest item)
  const isSelectedWithinStay = isWithinStayingPeriod(data.selectedMonth, data.selectedYear);
  const currentLedgerItem = isSelectedWithinStay
    ? data.ledgerItems.find(
        (item) => item.flatId.toLowerCase().trim() === cleanFlatId && item.month === data.selectedMonth && item.year === data.selectedYear
      )
    : flatLedgerHistory[0] || null;

  // Electricity bills strictly filtered to consumption during current tenant's staying period
  const flatElectricityBills = data.electricityBills.filter((b) => {
    if (b.flatId.toLowerCase().trim() !== cleanFlatId) return false;
    return isWithinStayingPeriod(b.consumptionMonth, b.consumptionYear, b.tenantName);
  });

  // Strict unit electricity active toggle check - completely hides when disabled on unit
  const isUnitElecOn = Boolean(
    unit &&
    unit.isElectricityEnabled !== false &&
    unit.electricityBillingType !== 'none'
  );

  // Block MFS Gateway Configuration & Availability
  const tenantBlockName: 'Block A' | 'Block B' | 'Block C' =
    unit?.blockName ||
    (flatId.toUpperCase().startsWith('B') ? 'Block B' : flatId.toUpperCase().startsWith('C') ? 'Block C' : 'Block A');

  // Manager Contact Information (from data or config)
  const managerProfile = data.profiles.find((p) => p.role === 'manager');
  const managerName = managerProfile?.fullName || COMPLEX_CONFIG.managerName || 'Russell (Manager)';
  const managerPhone = managerProfile?.phone || COMPLEX_CONFIG.managerPhone || '01737-321998';

  // Authority Block Owner Information strictly for this tenant's block
  const blockOwnerProfile = data.profiles.find(
    (p) => p.role === 'owner' && p.assignedBlock === tenantBlockName
  );

  const blockOwnerDefaults = {
    'Block A': {
      name: 'Md. Rashed',
      phone: '01717623061',
    },
    'Block B': {
      name: 'Md. Raju',
      phone: '01913858775',
    },
    'Block C': {
      name: 'Md. Rony',
      phone: '01712118547',
    },
  }[tenantBlockName];

  const currentBlockOwnerName =
    blockOwnerDefaults?.name ||
    blockOwnerProfile?.fullName?.replace(/\(.*?\)/g, '').trim() ||
    'Block Owner';

  const currentBlockOwnerPhone =
    blockOwnerDefaults?.phone ||
    blockOwnerProfile?.phone ||
    '';

  const blockMfsConfig =
    data.paymentSettings?.blockConfigs?.[tenantBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS[tenantBlockName] ||
    INITIAL_BLOCK_MFS_CONFIGS['Block A'];

  const isMfsActive = blockMfsConfig?.isMfsEnabled ?? true;
  const feeRate = blockMfsConfig?.mfsFeePercentage ?? 1.8;

  // Online Payment Request Form State
  const initialDue = currentLedgerItem ? calculateItemTotalDue(currentLedgerItem) : 25000;
  const [payAmount, setPayAmount] = useState<number>(initialDue);
  const [payMethod, setPayMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [payTrxId, setPayTrxId] = useState<string>('');
  const [paySuccessMsg, setPaySuccessMsg] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (currentLedgerItem) {
      setPayAmount(calculateItemTotalDue(currentLedgerItem));
    }
  }, [currentLedgerItem]);

  // Calculate 1.8% Cashout Fee Addings
  const mfsFeeAmount = Math.round(payAmount * (feeRate / 100));
  const totalMfsAmountToSend = payAmount + mfsFeeAmount;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOnlinePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTrxId.trim() || payAmount <= 0) return;
    const recipientNumber =
      payMethod === 'bKash'
        ? blockMfsConfig.bkashNumber
        : payMethod === 'Nagad'
        ? blockMfsConfig.nagadNumber
        : blockMfsConfig.rocketNumber;

    onSubmitOnlinePayment(
      flatId,
      payAmount,
      mfsFeeAmount,
      totalMfsAmountToSend,
      payMethod,
      payTrxId.trim(),
      `${getMonthName(data.selectedMonth)} ${data.selectedYear} Monthly Rent & Utilities`,
      recipientNumber,
      blockMfsConfig.ownerName
    );
    setPaySuccessMsg(`Payment verification request submitted for ${formatBDT(totalMfsAmountToSend)} (Base: ${formatBDT(payAmount)} + 1.8% cashout fee: ${formatBDT(mfsFeeAmount)}) with TrxID: ${payTrxId}. Management will verify shortly.`);
    setPayTrxId('');
  };

  // Signature Metadata: Per user request, receipts through tenant's account must have Manager's sign
  const tenantSignatureMeta = {
    authorizedSignatureRole: 'manager' as const,
    signatureTitle: "Russell (Manager)",
    authorizedSignatureBy: 'Russell',
  };

  const handleGenerateAdvanceReceipt = (item: MonthlyLedgerItem) => {
    const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId || a.flatId === flatId);
    const resolvedAmount =
      item.advancePayment !== undefined && item.advancePayment !== null
        ? Number(item.advancePayment)
        : (matchingAdv?.amountPaid && matchingAdv.amountPaid > 0)
        ? matchingAdv.amountPaid
        : (matchingAdv?.totalRequired && matchingAdv.totalRequired > 0)
        ? matchingAdv.totalRequired
        : 0;

    onViewReceipt({
      receiptNumber: `REC-ADV-${flatId}-${item.year || data.selectedYear}`,
      type: 'advance',
      tenantName: tenant?.fullName || currentUser.fullName,
      tenantPhone: tenant?.phone || currentUser.phone || '',
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: resolvedAmount,
      paymentDate: item.advanceDate || matchingAdv?.lastPaymentDate || item.entryDate || '2024-01-01',
      paymentMethod: 'bKash',
      purpose: `Security Advance Deposit - Flat ${flatId} (${unit?.blockName || 'Block A'})`,
      remainingAdvance: resolvedAmount,
      ...tenantSignatureMeta,
      breakdown: [
        { label: 'Security Advance Deposit', amount: resolvedAmount },
      ],
    });
  };

  const handleGenerateRentReceipt = (item: MonthlyLedgerItem) => {
    const isAdj = item.paymentStatus === 'Adjusted' || item.rentStatus === 'Adjusted';
    onViewReceipt({
      receiptNumber: `REC-RENT-${flatId}-${item.month}-${item.year}`,
      type: isAdj ? 'adjustment' : 'rent',
      tenantName: tenant?.fullName || currentUser.fullName,
      tenantPhone: tenant?.phone || currentUser.phone || '',
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: item.flatRent,
      paymentDate: item.rentPaymentDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: isAdj ? 'Advance Adjustment' : 'bKash',
      purpose: `Monthly Flat Rent for ${getMonthName(item.month)} ${item.year} - Flat ${flatId}${isAdj ? ' (Adjusted from Escrow Advance)' : ''}`,
      remainingDue: calculateItemTotalDue(item),
      remainingAdvance: matchingAdv ? getEffectiveRemainingAdvance(matchingAdv, data.ledgerItems) : item.advancePayment,
      ...tenantSignatureMeta,
      breakdown: [
        { label: `Flat Rent (${getMonthName(item.month)} ${item.year})${isAdj ? ' [Paid via Escrow Advance Adjustment]' : ''}`, amount: item.flatRent },
        ...(item.parkingRent > 0 ? [{ label: 'Parking Rent', amount: item.parkingRent }] : []),
      ],
    });
  };

  const handleGenerateElectricityReceipt = (item: MonthlyLedgerItem) => {
    const elecPeriod = getPostpaidElectricityPeriod(item.month, item.year);
    // Postpaid rule: Electricity receipt must always be in previous month's tenant name (consumption month occupant)
    const priorOccupant = getPostpaidElectricityTenantInfo(
      flatId,
      elecPeriod.month,
      elecPeriod.year,
      data,
      tenant?.fullName || currentUser.fullName,
      tenant?.phone || currentUser.phone || ''
    );

    onViewReceipt({
      receiptNumber: `REC-ELEC-${flatId}-${elecPeriod.month}-${elecPeriod.year}`,
      type: 'electricity',
      tenantName: priorOccupant.tenantName,
      tenantPhone: priorOccupant.tenantPhone,
      flatId: flatId,
      blockName: unit?.blockName || 'Block A',
      amount: item.electricityBill,
      paymentDate: item.electricityDate || item.lastPaymentDate || '2026-10-01',
      paymentMethod: 'bKash',
      monthName: elecPeriod.monthName,
      year: elecPeriod.year,
      purpose: `NESCO Electricity Bill for ${elecPeriod.displayStr} (Postpaid Billing for ${getMonthName(item.month)} ${item.year} Rent) - Flat ${flatId}`,
      ...tenantSignatureMeta,
      breakdown: [
        { label: `Postpaid Electricity Consumption (${elecPeriod.displayStr})`, amount: item.electricityBill },
      ],
    });
  };

  // Restrict access if flat is vacant or tenant is moved out
  if ((unit && !unit.isOccupied) || (tenant && tenant.status === 'moved_out') || !activeTenant) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Tenant Portal Access Restricted
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Flat {flatId} &bull; {unit?.blockName || 'Apartment Complex'}
          </p>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
          This unit is currently marked as vacant or no active tenancy was found for Flat {flatId}. The tenant dashboard is strictly reserved for current active residents with an active lease.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`tel:${managerPhone.replace(/[^0-9+]/g, '')}`}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>Contact Manager ({managerPhone})</span>
          </a>
          <a
            href={`tel:${currentBlockOwnerPhone.replace(/[^0-9+]/g, '')}`}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>Contact {currentBlockOwnerName} - {tenantBlockName} Owner ({currentBlockOwnerPhone})</span>
          </a>
        </div>
      </div>
    );
  }

  // 1. Resolve security advance amount & status saved in ledger / advance accounts
  const isOwnerFlat = flatId.toLowerCase().includes('owner');
  const matchingAdv = data.advanceAccounts.find(
    (a) => a.flatId.toLowerCase().trim() === cleanFlatId && (!a.tenantId || a.tenantId === activeTenant?.id || a.tenantId === tenant?.id)
  );

  const effectiveAdvAmount = matchingAdv
    ? getEffectiveRemainingAdvance(matchingAdv, data.ledgerItems)
    : currentLedgerItem?.advancePayment !== undefined && currentLedgerItem?.advancePayment !== null
    ? Number(currentLedgerItem.advancePayment)
    : 0;

  const rawAdvStatus = (currentLedgerItem?.advanceStatus || '').trim().toLowerCase();
  const isAdvNotPaid = rawAdvStatus === 'not paid' || rawAdvStatus === 'not_paid';
  const isAdvPaid = rawAdvStatus === 'paid';
  const isAdvPartial = rawAdvStatus === 'partially paid' || rawAdvStatus === 'partially_paid';
  const isAdvAdjusted = rawAdvStatus === 'adjusted' || (matchingAdv && (matchingAdv.amountPaid || 0) > 0 && effectiveAdvAmount === 0);
  const isAdvNA = rawAdvStatus === 'n/a';

  const advStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' =
    isOwnerFlat
      ? 'N/A'
      : isAdvNotPaid
      ? 'Not Paid'
      : isAdvAdjusted
      ? 'Adjusted'
      : isAdvPaid
      ? 'Paid'
      : isAdvPartial || matchingAdv?.status === 'partially_paid'
      ? 'Partially Paid'
      : isAdvNA
      ? 'N/A'
      : (matchingAdv?.status === 'paid' || (!rawAdvStatus && effectiveAdvAmount > 0))
      ? 'Paid'
      : 'Not Paid';

  // 2. Current Month Flat Rent
  const currentFlatRent = currentLedgerItem?.flatRent ?? unit?.monthlyRent ?? 0;

  // Base single-month standard security advance amount (strictly single-month e.g. ৳8,000, not cumulative or multiplied sum)
  const singleMonthAdvanceAmount = (() => {
    if (isOwnerFlat) return 0;
    // 1. Direct recorded advance payment on current active ledger item
    const ledgerAdv =
      currentLedgerItem?.advancePayment !== undefined && currentLedgerItem?.advancePayment !== null
        ? Number(currentLedgerItem.advancePayment)
        : null;
    if (ledgerAdv !== null && ledgerAdv > 0) {
      if (!currentFlatRent || ledgerAdv <= currentFlatRent) {
        return ledgerAdv;
      }
      return currentFlatRent > 0 ? currentFlatRent : ledgerAdv;
    }

    // 2. Matching advance account from database
    if (matchingAdv) {
      const advTotal = matchingAdv.amountPaid || matchingAdv.totalRequired || 0;
      if (advTotal > 0) {
        if (currentFlatRent > 0 && advTotal > currentFlatRent) {
          return currentFlatRent;
        }
        return advTotal;
      }
    }

    // 3. Fallback to current flat monthly rent or standard advance (৳8,000)
    return currentFlatRent > 0 ? currentFlatRent : 8000;
  })();
  const rawRentStatus = (currentLedgerItem?.rentStatus || '').trim();
  const resolvedRentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' =
    isOwnerFlat
      ? 'N/A'
      : rawRentStatus
      ? (rawRentStatus as any)
      : currentLedgerItem?.paymentStatus === 'Paid' || currentLedgerItem?.paymentStatus === 'Adjusted'
      ? (currentLedgerItem.paymentStatus as any)
      : currentLedgerItem?.paymentStatus === 'Partially Paid'
      ? 'Partially Paid'
      : currentLedgerItem?.paymentStatus === 'N/A'
      ? 'N/A'
      : currentLedgerItem && currentLedgerItem.totalPaid >= currentLedgerItem.flatRent && currentLedgerItem.flatRent > 0
      ? 'Paid'
      : 'Not Paid';

  // 3. Electricity Bill Display Eligibility Check:
  // Condition a: Is electricity bill toggled on for this rental unit?
  const isElecToggledOn =
    (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter' || !unit?.electricityBillingType)) &&
    unit?.electricityBillingType !== 'none';

  // Condition b: Did this tenant occupy this unit last month? (If first month of stay, do NOT show electricity bill)
  const prevMonth = data.selectedMonth === 1 ? 12 : data.selectedMonth - 1;
  const prevYear = data.selectedMonth === 1 ? data.selectedYear - 1 : data.selectedYear;

  const isFirstMonthOfStay =
    (entryYear > 0 && entryMonth > 0) &&
    ((entryYear === data.selectedYear && entryMonth === data.selectedMonth) ||
     (entryYear > data.selectedYear) ||
     (entryYear === data.selectedYear && entryMonth > data.selectedMonth));

  const prevMonthLedgerItem = data.ledgerItems.find(
    (item) => item.flatId.toLowerCase().trim() === cleanFlatId && item.month === prevMonth && item.year === prevYear
  );

  let occupiedUnitLastMonth = true;
  if (isFirstMonthOfStay) {
    occupiedUnitLastMonth = false;
  } else if (entryYear > 0 && entryMonth > 0 && (entryYear > prevYear || (entryYear === prevYear && entryMonth > prevMonth))) {
    occupiedUnitLastMonth = false;
  } else if (prevMonthLedgerItem && prevMonthLedgerItem.tenantName) {
    const pName = prevMonthLedgerItem.tenantName.trim().toLowerCase();
    const genericNames = ['vacant', 'vacant flat', 'owner occupied', 'n/a', 'none', ''];
    if (!genericNames.includes(pName) && currentTenantFullName) {
      const isMatch =
        pName === currentTenantFullName ||
        pName.includes(currentTenantFullName) ||
        currentTenantFullName.includes(pName);
      if (!isMatch) {
        occupiedUnitLastMonth = false;
      }
    }
  }

  const showElectricityBox = isElecToggledOn && occupiedUnitLastMonth && !isFirstMonthOfStay;

  const rawElecStatus = (currentLedgerItem?.electricityStatus || '').trim();
  const currentElecStatus: 'Paid' | 'Not Paid' | 'N/A' =
    isOwnerFlat
      ? 'N/A'
      : rawElecStatus
      ? (rawElecStatus as any)
      : (currentLedgerItem?.electricityBill || 0) === 0
      ? 'N/A'
      : currentLedgerItem?.paymentStatus === 'Paid'
      ? 'Paid'
      : 'Not Paid';

  // 4. Listing of all previous due amounts (Strictly EXCLUDING electricity due)
  interface PreviousDueItem {
    id: string;
    title: string;
    amount: number;
  }

  const previousDuesList: PreviousDueItem[] = [];

  // Security Advance Due (if applicable)
  if (!isOwnerFlat) {
    let advDue = 0;
    if (matchingAdv) {
      if (matchingAdv.status === 'not_paid') {
        advDue = matchingAdv.totalRequired > 0 ? matchingAdv.totalRequired : (effectiveAdvAmount || 0);
      } else if (matchingAdv.status === 'partially_paid') {
        advDue = Math.max(0, (matchingAdv.totalRequired || 0) - (matchingAdv.amountPaid || 0));
      }
    }
    if (advDue === 0 && isAdvNotPaid) {
      advDue = effectiveAdvAmount > 0 ? effectiveAdvAmount : 0;
    } else if (advDue === 0 && isAdvPartial) {
      advDue = Math.max(0, Math.round(effectiveAdvAmount / 2));
    }
    if (advDue > 0) {
      previousDuesList.push({
        id: 'adv-due',
        title: 'Advance Payment Due',
        amount: advDue,
      });
    }
  }

  // Previous months flat rent dues (strictly before current selected month/year within staying period)
  const previousMonths = flatLedgerHistory.filter((item) => {
    if (item.year < data.selectedYear) return true;
    if (item.year === data.selectedYear && item.month < data.selectedMonth) return true;
    return false;
  });

  const sortedPreviousMonths = [...previousMonths].sort((a, b) => a.year - b.year || a.month - b.month);

  for (const pItem of sortedPreviousMonths) {
    const pRentStatus = (pItem.rentStatus || '').trim().toLowerCase();
    let pRentDue = 0;
    if (pRentStatus === 'paid' || pRentStatus === 'adjusted' || pRentStatus === 'n/a') {
      pRentDue = 0;
    } else if (pItem.paymentStatus === 'Paid' || pItem.paymentStatus === 'Adjusted' || pItem.paymentStatus === 'N/A') {
      pRentDue = 0;
    } else if (pRentStatus === 'partially paid' || pRentStatus === 'partially_paid' || pItem.paymentStatus === 'Partially Paid') {
      const elecPaid = pItem.electricityStatus === 'Paid' ? (pItem.electricityBill || 0) : 0;
      const rentPaid = Math.max(0, (pItem.totalPaid || 0) - elecPaid);
      const unpaid = Math.max(0, pItem.flatRent - rentPaid);
      pRentDue = unpaid > 0 ? unpaid : Math.round(pItem.flatRent / 2);
    } else {
      pRentDue = pItem.flatRent || 0;
    }

    if (pRentDue > 0) {
      previousDuesList.push({
        id: `rent-${pItem.month}-${pItem.year}`,
        title: `${getMonthName(pItem.month)} Flat Rent Due`,
        amount: pRentDue,
      });
    }

    // Previous parking rent due (if applicable)
    if (pItem.parkingRent > 0 && pItem.paymentStatus !== 'Paid' && pItem.paymentStatus !== 'Adjusted' && pItem.paymentStatus !== 'N/A') {
      previousDuesList.push({
        id: `park-${pItem.month}-${pItem.year}`,
        title: `${getMonthName(pItem.month)} Parking Rent Due`,
        amount: pItem.parkingRent,
      });
    }
  }

  const totalPreviousDue = previousDuesList.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-semibold text-blue-300 mb-3">
            <Building2 className="w-3.5 h-3.5" />
            Resident of {COMPLEX_CONFIG.name} &bull; {unit?.blockName || 'Block A'} &bull; Flat {flatId}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {tenant?.fullName || currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            {COMPLEX_CONFIG.address}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span>Mobile: <strong className="text-white">{tenant?.phone || currentUser.phone}</strong></span>
            <span>&bull;</span>
            <span>Manager: <strong className="text-blue-300 font-mono">{managerPhone}</strong></span>
            <span>&bull;</span>
            <span>{tenantBlockName} Owner ({currentBlockOwnerName}): <strong className="text-emerald-300 font-mono">{currentBlockOwnerPhone}</strong></span>
            <span>&bull;</span>
            <span>Monthly Rent: <strong className="text-emerald-400 font-mono">{formatBDT(currentFlatRent)}</strong></span>
          </div>
        </div>

        {/* Quick Outstanding Due Pill */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 text-right min-w-[200px]">
          <span className="text-xs text-slate-300 font-medium">Current Month Due</span>
          <div className="text-2xl font-black font-mono mt-1 text-white">
            {formatBDT(currentLedgerItem?.totalDue || 0)}
          </div>
          <span
            className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              currentLedgerItem?.paymentStatus === 'Paid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            Status: {currentLedgerItem?.paymentStatus || 'Not Paid'}
          </span>
        </div>
      </div>

      {/* Summary Metric Cards: Security Advance, Current Month Flat Rent, Conditional Electricity, and Previous Dues */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showElectricityBox ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {/* Box 1: Security Advance & Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Advance</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  advStatus === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : advStatus === 'Partially Paid'
                    ? 'bg-amber-100 text-amber-800'
                    : advStatus === 'Adjusted'
                    ? 'bg-purple-100 text-purple-800'
                    : advStatus === 'N/A'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {advStatus}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-2 font-mono tabular-nums">
              {formatBDT(singleMonthAdvanceAmount)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {matchingAdv && matchingAdv.amountPaid > singleMonthAdvanceAmount
                ? `Standard security advance (${formatBDT(matchingAdv.amountPaid)} total in escrow)`
                : 'Deposited in escrow account'}
            </p>
          </div>
          {(advStatus === 'Paid' || (advStatus === 'Adjusted' && (matchingAdv?.amountPaid || 0) > 0)) && !isOwnerFlat && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const targetItem = currentLedgerItem || flatLedgerHistory[0] || ({
                    id: `adv-${flatId}`,
                    flatId,
                    month: data.selectedMonth,
                    year: data.selectedYear,
                    advancePayment: singleMonthAdvanceAmount,
                    entryDate: tenant?.entryDate || '2024-01-01',
                  } as MonthlyLedgerItem);
                  handleGenerateAdvanceReceipt({
                    ...targetItem,
                    advancePayment: singleMonthAdvanceAmount,
                  });
                }}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Generate Official Security Advance Receipt (Manager Signed)"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Generate Receipt</span>
              </button>
            </div>
          )}
        </div>

        {/* Box 2: Current Month Flat Rent & Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {getMonthName(data.selectedMonth)} Flat Rent
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  resolvedRentStatus === 'Paid'
                    ? 'bg-emerald-100 text-emerald-800'
                    : resolvedRentStatus === 'Partially Paid'
                    ? 'bg-amber-100 text-amber-800'
                    : resolvedRentStatus === 'Adjusted'
                    ? 'bg-purple-100 text-purple-800'
                    : resolvedRentStatus === 'N/A'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {resolvedRentStatus}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 font-mono tabular-nums">
              {formatBDT(currentFlatRent)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Monthly flat occupancy rent</p>
          </div>
          {(resolvedRentStatus === 'Paid' || resolvedRentStatus === 'Adjusted') && currentFlatRent > 0 && currentLedgerItem && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleGenerateRentReceipt(currentLedgerItem)}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Generate Official Flat Rent Receipt (Manager Signed)"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Generate Receipt</span>
              </button>
            </div>
          )}
        </div>

        {/* Box 3: Electricity Bill (Visible ONLY if toggled on AND tenant occupied unit last month) */}
        {showElectricityBox && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Electricity Bill
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    currentElecStatus === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : currentElecStatus === 'N/A'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {currentElecStatus}
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-600 mt-2 font-mono tabular-nums">
                {formatBDT(currentLedgerItem?.electricityBill || 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {getMonthName(prevMonth)} {prevYear} consumption
              </p>
            </div>
            {currentElecStatus === 'Paid' && (currentLedgerItem?.electricityBill || 0) > 0 && currentLedgerItem && (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleGenerateElectricityReceipt(currentLedgerItem)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Generate Official Electricity Receipt (Manager Signed)"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Generate Receipt</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Box 4: Previous Due Amounts Listing (Strictly excluding electricity due) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Previous Dues
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  totalPreviousDue === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {totalPreviousDue === 0 ? 'All Cleared' : `${previousDuesList.length} Outstanding`}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 mt-2 font-mono tabular-nums">
              {formatBDT(totalPreviousDue)}
            </div>

            {totalPreviousDue === 0 ? (
              <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>No previous dues pending</span>
              </p>
            ) : (
              <div className="mt-2.5 space-y-1.5 max-h-28 overflow-y-auto pr-1 divide-y divide-slate-100">
                {previousDuesList.map((due) => (
                  <div key={due.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium truncate pr-2">
                      {due.title}:
                    </span>
                    <span className="font-mono tabular-nums font-bold text-rose-600 shrink-0">
                      {formatBDT(due.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
            * Electricity dues excluded
          </p>
        </div>
      </div>

      {/* ONLINE PAYMENT MFS SUBMISSION OR PHYSICAL PAYMENT NOTICE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`p-2 rounded-lg ${isMfsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Pay Online via MFS (bKash / Nagad / Rocket)
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isMfsActive
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {isMfsActive ? `${tenantBlockName}: Available (ON)` : `${tenantBlockName}: Unavailable (OFF)`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isMfsActive
                  ? `Receive money in ${tenantBlockName} Owner's own account (${blockMfsConfig.ownerName}) with +1.8% fee added`
                  : `Online MFS receiving is currently turned OFF by ${blockMfsConfig.ownerName} / Management for ${tenantBlockName}`}
              </p>
            </div>
          </div>
        </div>

        {paySuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {paySuccessMsg}
          </div>
        )}

        {isMfsActive ? (
          /* ONLINE MFS PAYMENT ACTIVE FOR THIS BLOCK */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Instructions Box with Owner's accounts */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider">
                  {tenantBlockName} Official Accounts:
                </h4>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded">
                  {blockMfsConfig.ownerName} (Owner)
                </span>
              </div>

              {/* bKash */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-pink-600">bKash ({blockMfsConfig.bkashType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.bkashNumber, 'bkash')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'bkash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'bkash' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.bkashNumber}</p>
              </div>

              {/* Nagad */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-orange-600">Nagad ({blockMfsConfig.nagadType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.nagadNumber, 'nagad')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'nagad' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'nagad' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.nagadNumber}</p>
              </div>

              {/* Rocket */}
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 relative group">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-purple-600">Rocket ({blockMfsConfig.rocketType})</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(blockMfsConfig.rocketNumber, 'rocket')}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
                  >
                    {copiedKey === 'rocket' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'rocket' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-slate-900 font-bold text-sm">{blockMfsConfig.rocketNumber}</p>
              </div>

              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
                <p className="font-semibold">⚠️ Extra 1.8% Cashout Fee Added:</p>
                <p>
                  Per {tenantBlockName} policy, 1.8% is automatically added to cover MFS cashout costs. Please send the exact total amount calculated below.
                </p>
                <p className="font-semibold text-slate-700 mt-1">
                  * Put Flat ID ({flatId}) in the payment reference.
                </p>
              </div>
            </div>

            {/* Payment Request Submission Form */}
            <form onSubmit={handleOnlinePaySubmit} className="md:col-span-2 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Select Payment Method *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-semibold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="bKash">bKash ({blockMfsConfig.bkashNumber})</option>
                    <option value="Nagad">Nagad ({blockMfsConfig.nagadNumber})</option>
                    <option value="Rocket">Rocket ({blockMfsConfig.rocketNumber})</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Send to: <strong className="text-slate-800">
                      {payMethod === 'bKash' ? blockMfsConfig.bkashNumber : payMethod === 'Nagad' ? blockMfsConfig.nagadNumber : blockMfsConfig.rocketNumber}
                    </strong> ({blockMfsConfig.ownerName})
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Base Payable Amount (BDT / ৳) *
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rent / Electricity dues to be credited
                  </p>
                </div>
              </div>

              {/* 1.8% FEE & TOTAL BREAKDOWN CALCULATOR */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-slate-700 text-xs">
                  <span>Base Amount:</span>
                  <span className="font-bold">{formatBDT(payAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-blue-800 text-xs">
                  <span>+ Extra 1.8% MFS Cashout Fee:</span>
                  <span className="font-bold">+{formatBDT(mfsFeeAmount)}</span>
                </div>
                <div className="border-t border-blue-200 pt-1.5 flex items-center justify-between text-sm font-bold text-slate-900">
                  <span className="font-sans">Total to Send via {payMethod}:</span>
                  <span className="text-emerald-700 text-base">{formatBDT(totalMfsAmountToSend)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Transaction ID (TrxID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9J8219BA44 or BK99214A"
                  value={payTrxId}
                  onChange={(e) => setPayTrxId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 uppercase font-bold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter the exact transaction ID from your {payMethod} SMS/App confirmation.
                </p>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Send className="w-4 h-4" />
                <span>Submit Payment Verification Request ({formatBDT(totalMfsAmountToSend)})</span>
              </button>
            </form>
          </div>
        ) : (
          /* ONLINE MFS PAYMENT OFF FOR THIS BLOCK - PHYSICAL PAYMENT INSTRUCTIONS */
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-5">
            <div className="flex items-start gap-3">
              <span className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Online MFS Payment is Currently Turned OFF for {tenantBlockName}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your block owner (<strong>{blockMfsConfig.ownerName}</strong>) or building management has disabled online MFS receiving for <strong>{tenantBlockName}</strong> at this time. Tenants of {tenantBlockName} must make payments <strong>physically in cash</strong> or through direct bank deposit.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Manager Office (Ground Floor)
                </div>
                <p className="text-slate-600">Pay cash in person to Manager Russell.</p>
                <p className="font-semibold text-slate-900">Phone: 01737-321998</p>
                <p className="text-[11px] text-slate-500">Office Hours: 09:00 AM &ndash; 09:00 PM</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <User className="w-4 h-4 text-emerald-600" />
                  {tenantBlockName} Owner ({blockMfsConfig.ownerName})
                </div>
                <p className="text-slate-600">Contact your block owner for direct payment collection.</p>
                <p className="font-semibold text-slate-900">Phone: {blockMfsConfig.ownerPhone}</p>
                <p className="text-[11px] text-slate-500">Receipt will be recorded in your digital ledger</p>
              </div>

              {blockMfsConfig.isBankDepositAllowed ? (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      Direct Bank Deposit
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">
                      Permitted
                    </span>
                  </div>
                  <p className="text-slate-600">{data.paymentSettings.bankName}</p>
                  <p className="font-mono font-bold text-slate-900">{data.paymentSettings.bankAccountNo}</p>
                  <p className="text-[11px] text-slate-500">Routing: {data.paymentSettings.bankRouting}</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-100/80 rounded-xl border border-dashed border-slate-300 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <Lock className="w-4 h-4 text-amber-600" />
                    Direct Bank Deposit
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bank account details are restricted and not available without {tenantBlockName} Owner ({blockMfsConfig.ownerName}) permission.
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    Please pay physically in cash at Manager Russell&apos;s office.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Once you hand over physical cash or deposit to bank, Manager Russell will record it and you can download your official signed payment receipt immediately.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MONTHLY LEDGER HISTORY (From entry month onward) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              My Financial History & Monthly Ledgers
            </h3>
            <p className="text-xs text-slate-500">
              Complete historical record from tenant entry date ({formatDateDDMMYYYY(tenant?.entryDate)}) to present
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Statement
          </button>
        </div>

        {/* Mobile Financial History Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {flatLedgerHistory.map((item) => {
            const isOwnerFlat = item.flatId.toLowerCase().includes('owner');
            const rawAdvStatus = (item.advanceStatus || '').trim();
            const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId || a.flatId === flatId);
            const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
            const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

            const effectiveAdvAmount =
              item.advancePayment !== undefined && item.advancePayment !== null
                ? Number(item.advancePayment)
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
              item.rentStatus ||
              (item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted'
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
              <div key={item.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-extrabold text-sm text-slate-900 font-sans">
                    {getMonthName(item.month)} {item.year}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      rentStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : rentStatus === 'Partially Paid'
                        ? 'bg-amber-100 text-amber-800'
                        : rentStatus === 'N/A'
                        ? 'bg-slate-100 text-slate-500'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    Rent: {rentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* Rent Block */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-500 uppercase block font-bold">Flat Rent</span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block">{formatBDT(item.flatRent)}</span>
                    </div>
                    {rentStatus === 'Paid' && item.flatRent > 0 && (
                      <button
                        onClick={() => handleGenerateRentReceipt(item)}
                        className="mt-2 min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Generate Official Flat Rent Receipt"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}
                  </div>

                  {/* Electricity Block */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-sans text-slate-500 uppercase block font-bold">Electricity</span>
                      <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                        {item.electricityBill > 0 ? formatBDT(item.electricityBill) : '৳0'}
                      </span>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          elecStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : elecStatus === 'N/A'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {elecStatus}
                      </span>
                    </div>
                    {elecStatus === 'Paid' && item.electricityBill > 0 && (
                      <button
                        onClick={() => handleGenerateElectricityReceipt(item)}
                        className="mt-2 min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Generate Official Electricity Receipt"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Advance and Parking Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px]">Advance: <strong className="font-mono text-indigo-700">{formatBDT(effectiveAdvAmount)}</strong></span>
                    {(advStatus === 'Paid' || advStatus === 'Partially Paid' || hasAdvAmount) && advStatus !== 'N/A' && advStatus !== 'Not Paid' && !isOwnerFlat && (
                      <button
                        onClick={() => handleGenerateAdvanceReceipt({ ...item, advancePayment: effectiveAdvAmount })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                        title="Generate Advance Receipt"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                    )}
                  </div>
                  {item.parkingRent > 0 && (
                    <span className="text-[11px]">Parking: <strong className="font-mono text-slate-800">{formatBDT(item.parkingRent)}</strong></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table (hidden md:block) */}
        <div className="hidden md:block table-scroll-container">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Period</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Advance Paid</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Flat Rent</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Electricity</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Parking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {flatLedgerHistory.map((item) => {
                const isOwnerFlat = item.flatId.toLowerCase().includes('owner');
                const rawAdvStatus = (item.advanceStatus || '').trim();
                const matchingAdv = data.advanceAccounts.find((a) => a.flatId === item.flatId || a.flatId === flatId);
                const isMarkedPaid = rawAdvStatus.toLowerCase() === 'paid';
                const isMarkedPartial = rawAdvStatus.toLowerCase() === 'partially paid' || rawAdvStatus.toLowerCase() === 'partially_paid';

                const effectiveAdvAmount =
                  item.advancePayment !== undefined && item.advancePayment !== null
                    ? Number(item.advancePayment)
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
                  item.rentStatus ||
                  (item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted'
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
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-sans whitespace-nowrap">
                      {getMonthName(item.month)} {item.year}
                    </td>

                    {/* Advance Paid with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
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
                            title="Generate Official Security Advance Receipt (Manager Signed)"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Generate Receipt</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Flat Rent with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                      <span className="font-mono tabular-nums font-bold text-slate-800 block">
                        {formatBDT(item.flatRent)}
                      </span>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          rentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rentStatus === 'Partially Paid'
                            ? 'bg-amber-100 text-amber-800'
                            : rentStatus === 'N/A'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {rentStatus}
                      </span>
                      {rentStatus === 'Paid' && item.flatRent > 0 && (
                        <div className="mt-1">
                          <button
                            onClick={() => handleGenerateRentReceipt(item)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                            title="Generate Official Flat Rent Receipt (Manager Signed)"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Generate Receipt</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Electricity with Status & Receipt */}
                    <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                      {!isUnitElecOn && item.electricityBill === 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-mono tabular-nums font-medium text-slate-400 block">৳0</span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            OFF
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">No Bill</span>
                        </div>
                      ) : (
                        <>
                          <span className="font-mono tabular-nums font-bold text-slate-800 block">
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
                              {getPostpaidElectricityPeriod(item.month, item.year).monthName.slice(0, 3)} Bill
                            </span>
                          )}
                          {elecStatus === 'Paid' && item.electricityBill > 0 && (
                            <div className="mt-1">
                              <button
                                onClick={() => handleGenerateElectricityReceipt(item)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                title="Generate Official Electricity Bill Receipt (Manager Signed)"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>Generate Receipt</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Parking Rent */}
                    <td className="py-3 px-4 text-right text-slate-600 font-mono tabular-nums whitespace-nowrap">
                      {item.parkingRent > 0 ? formatBDT(item.parkingRent) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ELECTRICITY BILLS SECTION */}
      {isUnitElecOn ? (
        flatElectricityBills.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-base">
                My NESCO Electricity Bills
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {flatElectricityBills.map((b) => (
                <div key={b.id} className="p-4 border border-slate-200 rounded-xl bg-amber-50/30 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">
                      {getMonthName(b.consumptionMonth)} {b.consumptionYear} Consumption
                    </span>
                    <p className="text-slate-600 mt-0.5">
                      {b.consumedUnits} kWh units ({b.previousReading} &rarr; {b.currentReading})
                    </p>
                    <p className="font-bold text-amber-800 font-mono mt-1 text-base">
                      {formatBDT(b.totalBill)}
                    </p>
                  </div>
                  <button
                    onClick={() => onViewBill(b)}
                    className="min-h-[44px] px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center transition-colors"
                  >
                    View Bill
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="p-2.5 bg-slate-100 text-slate-500 rounded-xl">
              <ZapOff className="w-5 h-5" />
            </span>
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                Electricity Sub-Meter Billing is OFF
              </span>
              <p className="text-slate-500 mt-0.5">
                Electricity billing and voucher receipts are currently disabled for Unit {flatId}. No electricity charges are added to your monthly dues.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Management & Office Contacts Card: Block Owner and Manager Only */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <Building2 className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-slate-900 text-base">
                {COMPLEX_CONFIG.name} Management Office
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              {COMPLEX_CONFIG.address}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              For any urgent maintenance, security, billing queries, or emergency assistance, contact your block owner or manager directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`tel:${managerPhone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Manager ({managerName}):</span>
              <span className="font-mono">{managerPhone}</span>
            </a>
            <a
              href={`tel:${currentBlockOwnerPhone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{currentBlockOwnerName} ({tenantBlockName} Owner):</span>
              <span className="font-mono">{currentBlockOwnerPhone}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Direct Shortcuts for Complaints & Chat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigateToView('complaints')}
          className="p-5 bg-white hover:bg-blue-50/50 border border-slate-200 rounded-2xl shadow-xs text-left transition-colors flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Submit Maintenance Complaint</h4>
              <p className="text-xs text-slate-500">Report plumbing, electricity, lift, or cleaning issues</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </button>

        <button
          onClick={() => onNavigateToView('messages')}
          className="p-5 bg-white hover:bg-blue-50/50 border border-slate-200 rounded-2xl shadow-xs text-left transition-colors flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <MessageSquare className="w-6 h-6" />
            </span>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Chat with Management</h4>
              <p className="text-xs text-slate-500">Direct message with Manager or {tenantBlockName} Owner ({currentBlockOwnerName})</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};

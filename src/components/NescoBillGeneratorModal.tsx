import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Building,
  Info,
  Layers,
  ChevronDown,
  ChevronRight,
  Calculator,
  Search,
  Check,
  Sparkles,
  Copy,
  Eye,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  Coins,
  Receipt,
  Trash2,
} from 'lucide-react';
import { AppDatabaseState, Unit, MeterReading, ElectricityBill, SlabBreakdownItem, NescoTariffConfig } from '../types';
import {
  DEFAULT_NESCO_TARIFF,
  calculateNescoElectricityBill,
  calculateMultiSystemElectricityBill,
  NescoBillingSystem,
  MultiSystemCalculationResult,
  formatBDT,
  getMonthName,
  MONTH_NAMES,
  getPostpaidElectricityPeriod,
} from '../lib/nescoTariff';
import { PrintableBillModal } from './PrintableBillModal';
import { compareFlatIdSerial } from '../lib/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppDatabaseState;
  billingMonth: number;
  billingYear: number;
  onGenerateElectricityBills: (
    consumptionMonth: number,
    consumptionYear: number,
    billingMonth: number,
    billingYear: number,
    customReadings?: {
      flatId: string;
      tenantName?: string;
      previousReading: number;
      currentReading: number;
      consumedUnits?: number;
      billAmount?: number;
      slabBreakdown?: SlabBreakdownItem[];
      baseEnergyCost?: number;
      demandCharge?: number;
      vatAmount?: number;
      meterRent?: number;
      rebateAmount?: number;
      billingSystem?: string;
    }[]
  ) => void;
  onToggleUnitElectricity?: (flatId: string, enabled: boolean) => void;
  onViewBill?: (bill: ElectricityBill) => void;
  userRole?: string;
}

interface UnitReadingDraft {
  unitId: string;
  flatId: string;
  blockName: string;
  tenantName: string;
  isEnabled: boolean; // Billing ON / OFF toggle
  billingSystem: NescoBillingSystem; // System 1: 'regular_nesco', System 2: 'fixed_unit_price', System 3: 'fixed_price_bill'
  previousReading: number;
  currentReading: number;
  fixedUnitRate: number; // For System 2, default 15.01
  fixedBillAmount: number; // For System 3, default 1500
  consumedUnits: number;
  calculatedBill: number;
  sanctionedLoad: number;
  slabBreakdown: SlabBreakdownItem[];
  baseEnergyCost: number;
  demandCharge: number;
  meterRent: number;
  vatAmount: number;
  lastMonthReadingAvailable: boolean;
  lastMonthReadingValue?: number;
  lastMonthPeriodLabel?: string;
}

export const NescoBillGeneratorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  billingMonth,
  billingYear,
  onGenerateElectricityBills,
  onToggleUnitElectricity,
  onViewBill,
  userRole,
}) => {
  // Postpaid consumption period rule (e.g., October 2026 ledger bills September 2026 consumption)
  const defaultElecPeriod = getPostpaidElectricityPeriod(billingMonth, billingYear);
  const [consumptionMonth, setConsumptionMonth] = useState<number>(defaultElecPeriod.month);
  const [consumptionYear, setConsumptionYear] = useState<number>(defaultElecPeriod.year);

  // Global Presets & Tariff Parameters
  const [globalBillingSystem, setGlobalBillingSystem] = useState<NescoBillingSystem>('regular_nesco');
  const [globalFixedUnitRate, setGlobalFixedUnitRate] = useState<number>(15.01);
  const [globalFixedBillAmount, setGlobalFixedBillAmount] = useState<number>(1500);
  const [globalDemandRate, setGlobalDemandRate] = useState<number>(data.tariffConfig?.demandChargePerKW ?? 42);
  const [globalSanctionedLoad, setGlobalSanctionedLoad] = useState<number>(3);
  const [globalMeterRent, setGlobalMeterRent] = useState<number>(data.tariffConfig?.meterRent ?? 40);
  const [globalVatPercentage, setGlobalVatPercentage] = useState<number>(data.tariffConfig?.vatPercentage ?? 5);

  // Active combined tariff config with live parameters
  const activeTariffConfig = useMemo<NescoTariffConfig>(() => {
    return {
      ...(data.tariffConfig || DEFAULT_NESCO_TARIFF),
      demandChargePerKW: Number(globalDemandRate) || 42,
      meterRent: Number(globalMeterRent) || 40,
      vatPercentage: Number(globalVatPercentage) || 5,
    };
  }, [data.tariffConfig, globalDemandRate, globalMeterRent, globalVatPercentage]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [blockFilter, setBlockFilter] = useState<'all' | 'Block A' | 'Block B' | 'Block C'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Voucher Preview Modal State (Shows bill in original format with detailed breakdown and close option)
  const [previewBill, setPreviewBill] = useState<ElectricityBill | null>(null);

  // Units draft readings state
  const [drafts, setDrafts] = useState<UnitReadingDraft[]>([]);

  // Previous consumption period for "Copy Last Month Readings"
  const prevConsumptionMonth = consumptionMonth === 1 ? 12 : consumptionMonth - 1;
  const prevConsumptionYear = consumptionMonth === 1 ? consumptionYear - 1 : consumptionYear;
  const prevPeriodLabel = `${getMonthName(prevConsumptionMonth)} ${prevConsumptionYear}`;

  // Helper to calculate bill for a draft object
  const recalculateDraft = (
    draft: Omit<UnitReadingDraft, 'consumedUnits' | 'calculatedBill' | 'slabBreakdown' | 'baseEnergyCost' | 'demandCharge' | 'meterRent' | 'vatAmount'>,
    customTariffConfig?: NescoTariffConfig,
    customSanctionedLoad?: number,
    customFixedUnitRate?: number,
    customFixedBillAmount?: number
  ): UnitReadingDraft => {
    if (!draft.isEnabled) {
      return {
        ...draft,
        previousReading: 0,
        currentReading: 0,
        fixedBillAmount: 0,
        fixedUnitRate: 0,
        consumedUnits: 0,
        calculatedBill: 0,
        slabBreakdown: [],
        baseEnergyCost: 0,
        demandCharge: 0,
        meterRent: 0,
        vatAmount: 0,
      };
    }

    const tConfig = customTariffConfig || activeTariffConfig;
    const sLoad = customSanctionedLoad !== undefined ? customSanctionedLoad : (draft.sanctionedLoad || globalSanctionedLoad);
    const fRate = customFixedUnitRate !== undefined ? customFixedUnitRate : (draft.fixedUnitRate || globalFixedUnitRate);
    const fBill = customFixedBillAmount !== undefined ? customFixedBillAmount : (draft.fixedBillAmount || globalFixedBillAmount);

    const res = calculateMultiSystemElectricityBill({
      billingSystem: draft.billingSystem,
      currentReading: draft.currentReading,
      previousReading: draft.previousReading,
      fixedUnitRate: fRate,
      fixedBillAmount: fBill,
      tariffConfig: tConfig,
      sanctionedLoadKW: sLoad,
    });

    return {
      ...draft,
      consumedUnits: res.consumedUnits,
      calculatedBill: res.totalBill,
      slabBreakdown: res.slabBreakdown,
      baseEnergyCost: res.baseEnergyCost,
      demandCharge: res.demandCharge,
      meterRent: res.meterRent,
      vatAmount: res.vatAmount,
    };
  };

  // Initialize/recalculate draft readings whenever modal opens or consumption period changes
  useEffect(() => {
    if (!isOpen) return;

    // 1. Get all active ledger items for target billing period
    const activeLedgerItems = data.ledgerItems.filter(
      (item) => item.month === billingMonth && item.year === billingYear
    );

    const ledgerFlatIds = new Set(activeLedgerItems.map((i) => i.flatId.toLowerCase().trim()));

    // Also include any registered rental units from data.units not yet present in ledger
    const remainingUnits = data.units.filter(
      (u) =>
        (u.unitType === 'residential' || u.unitType === 'godown') &&
        !u.flatId.toLowerCase().includes('parking') &&
        !ledgerFlatIds.has(u.flatId.toLowerCase().trim())
    );

    // Helper: Postpaid electricity bills apply to prior month's usage (consumptionMonth & consumptionYear).
    // The bill is always issued under the name of the user who stayed during that consumption period.
    const getPriorMonthTenantName = (flatKey: string, fallbackName: string) => {
      const priorLedger = data.ledgerItems.find(
        (li) =>
          li.flatId.toLowerCase().trim() === flatKey.toLowerCase().trim() &&
          li.month === consumptionMonth &&
          li.year === consumptionYear
      );
      if (priorLedger && priorLedger.tenantName && priorLedger.tenantName.trim() !== '') {
        return priorLedger.tenantName.trim();
      }
      const priorBill = data.electricityBills.find(
        (b) =>
          b.flatId.toLowerCase().trim() === flatKey.toLowerCase().trim() &&
          b.consumptionMonth === consumptionMonth &&
          b.consumptionYear === consumptionYear
      );
      if (priorBill && priorBill.tenantName && priorBill.tenantName.trim() !== '') {
        return priorBill.tenantName.trim();
      }
      return fallbackName;
    };

    const combinedFlatList = [
      ...activeLedgerItems.map((li) => {
        const matchingUnit = data.units.find(
          (u) => u.flatId.toLowerCase().trim() === li.flatId.toLowerCase().trim()
        );
        const billedTenantName = getPriorMonthTenantName(li.flatId, li.tenantName);
        return {
          flatId: li.flatId,
          unitId: matchingUnit?.id || li.unitId || `u-${li.flatId.toLowerCase().trim()}`,
          blockName: li.blockName,
          tenantName: billedTenantName,
          unitType: matchingUnit?.unitType || 'residential',
          isElectricityEnabled: matchingUnit?.isElectricityEnabled,
          electricityBillingType: matchingUnit?.electricityBillingType,
        };
      }),
      ...remainingUnits.map((u) => {
        const tenant = data.tenants.find((t) => t.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim());
        const defaultName = tenant ? tenant.fullName : 'Vacant Flat';
        const billedTenantName = getPriorMonthTenantName(u.flatId, defaultName);
        return {
          flatId: u.flatId,
          unitId: u.id,
          blockName: u.blockName,
          tenantName: billedTenantName,
          unitType: u.unitType,
          isElectricityEnabled: u.isElectricityEnabled,
          electricityBillingType: u.electricityBillingType,
        };
      }),
    ];

    // De-duplicate flats to remove duplicate entries
    const seenFlatIds = new Set<string>();
    const deduplicatedFlatList: typeof combinedFlatList = [];
    for (const u of combinedFlatList) {
      const cleanKey = u.flatId.toLowerCase().trim();
      if (!seenFlatIds.has(cleanKey)) {
        seenFlatIds.add(cleanKey);
        deduplicatedFlatList.push(u);
      }
    }

    // Sort in serial order (A1..A7, B1..B7, C1..C7)
    deduplicatedFlatList.sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

    const initialDrafts: UnitReadingDraft[] = deduplicatedFlatList.map((u) => {
      const matchingLedgerItem = activeLedgerItems.find(
        (li) => li.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim()
      );
      const isElecEnabled =
        (u.isElectricityEnabled ?? (u.electricityBillingType === 'nesco_submeter' || !u.electricityBillingType || (matchingLedgerItem?.electricityBill ?? 0) > 0)) &&
        u.electricityBillingType !== 'none';

      // Find current period bill / reading if already generated
      const existingBill = data.electricityBills.find(
        (b) =>
          b.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim() &&
          b.consumptionMonth === consumptionMonth &&
          b.consumptionYear === consumptionYear
      );

      const mr = data.meterReadings.find(
        (r) =>
          (r.unitId === u.unitId || r.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim()) &&
          r.month === consumptionMonth &&
          r.year === consumptionYear
      );

      // Look up LAST MONTH'S reading (for the requirement: copy last month readings if available)
      const lastMonthBill = data.electricityBills.find(
        (b) =>
          b.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim() &&
          b.consumptionMonth === prevConsumptionMonth &&
          b.consumptionYear === prevConsumptionYear
      );
      const lastMonthMr = data.meterReadings.find(
        (r) =>
          (r.unitId === u.unitId || r.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim()) &&
          r.month === prevConsumptionMonth &&
          r.year === prevConsumptionYear
      );
      const lastMonthReading = lastMonthBill?.currentReading ?? lastMonthMr?.currentReading;
      const lastMonthAvailable = lastMonthReading !== undefined;

      // Determine initial previous reading:
      // Prefer: existing current-period previousReading -> last month's reading -> default 1500
      const prevReading = existingBill?.previousReading ?? mr?.previousReading ?? (lastMonthAvailable ? lastMonthReading : 1500);

      // Determine initial current reading:
      const currReading =
        existingBill?.currentReading ??
        mr?.currentReading ??
        (isElecEnabled ? prevReading + 220 : prevReading);

      // Determine system
      let initialSystem: NescoBillingSystem = 'regular_nesco';
      if (existingBill?.slabBreakdown?.[0]?.slabName?.includes('Fixed Price')) {
        initialSystem = 'fixed_price_bill';
      } else if (existingBill?.slabBreakdown?.[0]?.slabName?.includes('Fixed Unit')) {
        initialSystem = 'fixed_unit_price';
      }

      return recalculateDraft({
        unitId: u.unitId,
        flatId: u.flatId,
        blockName: u.blockName,
        tenantName: u.tenantName,
        isEnabled: isElecEnabled,
        billingSystem: initialSystem,
        previousReading: isElecEnabled ? prevReading : 0,
        currentReading: isElecEnabled ? currReading : 0,
        fixedUnitRate: isElecEnabled ? 15.01 : 0,
        fixedBillAmount: isElecEnabled ? (existingBill?.totalBill || 1500) : 0,
        sanctionedLoad: 3,
        lastMonthReadingAvailable: lastMonthAvailable,
        lastMonthReadingValue: lastMonthReading,
        lastMonthPeriodLabel: prevPeriodLabel,
      });
    });

    setDrafts(initialDrafts);
  }, [
    isOpen,
    consumptionMonth,
    consumptionYear,
    billingMonth,
    billingYear,
    data.ledgerItems,
    data.units,
    data.meterReadings,
    data.electricityBills,
    data.tariffConfig,
  ]);

  // Recalculate bill for an individual unit
  const handleUpdateUnitDraft = (
    flatId: string,
    updates: Partial<Omit<UnitReadingDraft, 'consumedUnits' | 'calculatedBill' | 'slabBreakdown' | 'baseEnergyCost' | 'demandCharge' | 'meterRent' | 'vatAmount'>>
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.flatId !== flatId) return d;
        const merged = { ...d, ...updates };
        return recalculateDraft(merged);
      })
    );
  };

  // Toggle unit electricity billing ON / OFF
  const handleToggleUnitBilling = (flatId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.flatId !== flatId) return d;
        const newEnabled = !d.isEnabled;
        if (onToggleUnitElectricity) {
          onToggleUnitElectricity(flatId, newEnabled);
        }
        return recalculateDraft({
          ...d,
          isEnabled: newEnabled,
          previousReading: newEnabled ? (d.previousReading || (d.lastMonthReadingValue ?? 1500)) : 0,
          currentReading: newEnabled ? (d.currentReading || ((d.previousReading || (d.lastMonthReadingValue ?? 1500)) + 220)) : 0,
          fixedUnitRate: newEnabled ? (d.fixedUnitRate || 15.01) : 0,
          fixedBillAmount: newEnabled ? (d.fixedBillAmount || 1500) : 0,
        });
      })
    );
  };

  // Remove an entire draft row from the billing sheet (to remove duplicate or unwanted entry)
  const handleRemoveDraftRow = (flatId: string) => {
    setDrafts((prev) => prev.filter((d) => d.flatId !== flatId));
  };

  // Quick: Copy last month reading for a single unit
  const handleCopyLastMonthForUnit = (flatId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.flatId !== flatId || !d.isEnabled) return d;
        if (!d.lastMonthReadingAvailable || d.lastMonthReadingValue === undefined) {
          alert(`No previous reading found for Flat ${flatId} in ${d.lastMonthPeriodLabel}. Please input previous and current readings manually.`);
          return d;
        }
        const newPrev = d.lastMonthReadingValue;
        const newCurr = Math.max(newPrev, d.currentReading > newPrev ? d.currentReading : newPrev + 220);
        return recalculateDraft({
          ...d,
          previousReading: newPrev,
          currentReading: newCurr,
        });
      })
    );
  };

  // 1-Click: Copy last month readings for ALL units
  const handleCopyLastMonthAll = () => {
    let copiedCount = 0;
    let missingCount = 0;

    setDrafts((prev) =>
      prev.map((d) => {
        if (!d.isEnabled) return d;
        if (d.lastMonthReadingAvailable && d.lastMonthReadingValue !== undefined) {
          copiedCount++;
          const newPrev = d.lastMonthReadingValue;
          const newCurr = Math.max(newPrev, d.currentReading > newPrev ? d.currentReading : newPrev + 220);
          return recalculateDraft({
            ...d,
            previousReading: newPrev,
            currentReading: newCurr,
          });
        }
        missingCount++;
        return d;
      })
    );

    if (copiedCount > 0) {
      setSuccessToast(
        `✓ Copied ${prevPeriodLabel} readings for ${copiedCount} active units! ${
          missingCount > 0 ? `(${missingCount} units without prior readings remain open for manual input)` : ''
        }`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } else {
      alert(`No previous readings found in ${prevPeriodLabel}. Please input previous and current readings manually.`);
    }
  };

  // Handlers for Live Parameters (System 1 & System 2)
  const handleDemandRateChange = (newVal: number) => {
    setGlobalDemandRate(newVal);
    const updatedConfig: NescoTariffConfig = { ...activeTariffConfig, demandChargePerKW: newVal };
    setDrafts((prev) =>
      prev.map((d) => recalculateDraft(d, updatedConfig, globalSanctionedLoad, globalFixedUnitRate, globalFixedBillAmount))
    );
  };

  const handleSanctionedLoadChange = (newVal: number) => {
    setGlobalSanctionedLoad(newVal);
    setDrafts((prev) =>
      prev.map((d) => recalculateDraft(d, activeTariffConfig, newVal, globalFixedUnitRate, globalFixedBillAmount))
    );
  };

  const handleMeterRentChange = (newVal: number) => {
    setGlobalMeterRent(newVal);
    const updatedConfig: NescoTariffConfig = { ...activeTariffConfig, meterRent: newVal };
    setDrafts((prev) =>
      prev.map((d) => recalculateDraft(d, updatedConfig, globalSanctionedLoad, globalFixedUnitRate, globalFixedBillAmount))
    );
  };

  const handleVatPercentageChange = (newVal: number) => {
    setGlobalVatPercentage(newVal);
    const updatedConfig: NescoTariffConfig = { ...activeTariffConfig, vatPercentage: newVal };
    setDrafts((prev) =>
      prev.map((d) => recalculateDraft(d, updatedConfig, globalSanctionedLoad, globalFixedUnitRate, globalFixedBillAmount))
    );
  };

  const handleGlobalFixedUnitRateChange = (newVal: number) => {
    setGlobalFixedUnitRate(newVal);
    setDrafts((prev) =>
      prev.map((d) =>
        recalculateDraft(
          { ...d, fixedUnitRate: newVal },
          activeTariffConfig,
          globalSanctionedLoad,
          newVal,
          globalFixedBillAmount
        )
      )
    );
  };

  const handleGlobalFixedBillAmountChange = (newVal: number) => {
    setGlobalFixedBillAmount(newVal);
    setDrafts((prev) =>
      prev.map((d) =>
        recalculateDraft(
          { ...d, fixedBillAmount: newVal },
          activeTariffConfig,
          globalSanctionedLoad,
          globalFixedUnitRate,
          newVal
        )
      )
    );
  };

  // 1-Click: Apply selected billing system to ALL units
  const handleApplySystemToAll = (system: NescoBillingSystem) => {
    setGlobalBillingSystem(system);
    setDrafts((prev) =>
      prev.map((d) =>
        recalculateDraft({
          ...d,
          billingSystem: system,
          fixedUnitRate: d.isEnabled ? globalFixedUnitRate : 0,
          fixedBillAmount: d.isEnabled ? globalFixedBillAmount : 0,
        })
      )
    );
  };

  // 1-Click: Toggle billing ON/OFF for all units
  const handleToggleAllBilling = (enabled: boolean) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (onToggleUnitElectricity) {
          onToggleUnitElectricity(d.flatId, enabled);
        }
        return recalculateDraft({
          ...d,
          isEnabled: enabled,
          previousReading: enabled ? (d.previousReading || (d.lastMonthReadingValue ?? 1500)) : 0,
          currentReading: enabled ? (d.currentReading || ((d.previousReading || (d.lastMonthReadingValue ?? 1500)) + 220)) : 0,
          fixedUnitRate: enabled ? (d.fixedUnitRate || 15.01) : 0,
          fixedBillAmount: enabled ? (d.fixedBillAmount || 1500) : 0,
        });
      })
    );
  };

  // Quick auto-fill default standard consumption (+220 kWh) for enabled units
  const handleAutoFillStandard = (standardKwh: number = 220) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (!d.isEnabled) return d;
        const newCurrent = d.previousReading + standardKwh;
        return recalculateDraft({
          ...d,
          currentReading: newCurrent,
        });
      })
    );
  };

  // Construct printable ElectricityBill object from a draft for preview / voucher
  const buildElectricityBillFromDraft = (draft: UnitReadingDraft): ElectricityBill => {
    return {
      id: `eb-${draft.flatId.toLowerCase().trim()}-${consumptionMonth}-${consumptionYear}`,
      unitId: draft.unitId,
      flatId: draft.flatId,
      tenantId: '',
      tenantName: draft.tenantName,
      consumptionMonth,
      consumptionYear,
      billingMonth,
      billingYear,
      previousReading: draft.previousReading,
      currentReading: draft.currentReading,
      consumedUnits: draft.consumedUnits,
      slabBreakdown: draft.slabBreakdown,
      baseEnergyCost: draft.baseEnergyCost,
      demandCharge: draft.demandCharge,
      vatAmount: draft.vatAmount,
      meterRent: draft.meterRent,
      rebateAmount: 0,
      totalBill: draft.calculatedBill,
      paidAmount: 0,
      dueAmount: draft.calculatedBill,
      paymentStatus: 'Not Paid',
      generatedDate: new Date().toISOString().split('T')[0],
      tariffSnapshotTitle: data.tariffConfig.title,
    };
  };

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      const matchSearch =
        d.flatId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.tenantName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBlock = blockFilter === 'all' || d.blockName === blockFilter;
      return matchSearch && matchBlock;
    });
  }, [drafts, searchQuery, blockFilter]);

  // Aggregate totals
  const totalEnabledUnits = drafts.filter((d) => d.isEnabled).length;
  const totalConsumedKwh = drafts.reduce((sum, d) => sum + (d.isEnabled ? d.consumedUnits : 0), 0);
  const totalEstimatedBill = drafts.reduce((sum, d) => sum + (d.isEnabled ? d.calculatedBill : 0), 0);

  // Submit and apply all bills to monthly ledger, then display the generated bill in original format with detailed breakdown
  const handleGenerateAndApply = () => {
    setIsSubmitting(true);

    // Sync all unit toggles to master units so they carry forward
    drafts.forEach((d) => {
      if (onToggleUnitElectricity) {
        onToggleUnitElectricity(d.flatId, d.isEnabled);
      }
    });

    const payload = drafts.map((d) => ({
      flatId: d.flatId,
      tenantName: d.tenantName,
      previousReading: d.isEnabled ? d.previousReading : 0,
      currentReading: d.isEnabled ? d.currentReading : 0,
      consumedUnits: d.isEnabled ? d.consumedUnits : 0,
      billAmount: d.isEnabled ? d.calculatedBill : 0,
      slabBreakdown: d.isEnabled ? d.slabBreakdown : [],
      baseEnergyCost: d.isEnabled ? d.baseEnergyCost : 0,
      demandCharge: d.isEnabled ? d.demandCharge : 0,
      vatAmount: d.isEnabled ? d.vatAmount : 0,
      meterRent: d.isEnabled ? d.meterRent : 0,
      rebateAmount: 0,
      billingSystem: d.billingSystem,
      isBillingEnabled: d.isEnabled,
    }));

    onGenerateElectricityBills(
      consumptionMonth,
      consumptionYear,
      billingMonth,
      billingYear,
      payload
    );

    // Pick first enabled draft to display the bill in its original format with detailed breakdown ONLY if enabled!
    // If billing is OFF, do NOT display bill after save and apply.
    const sampleDraft = drafts.find((d) => d.isEnabled);
    if (sampleDraft) {
      const sampleBill = buildElectricityBillFromDraft(sampleDraft);
      setPreviewBill(sampleBill);
      if (onViewBill) {
        onViewBill(sampleBill);
      }
    } else {
      setPreviewBill(null);
    }

    setSuccessToast(
      `✓ Successfully saved & applied NESCO electricity bills for ${totalEnabledUnits} rental units totaling ${formatBDT(
        totalEstimatedBill
      )} in the ${getMonthName(billingMonth)} ${billingYear} ledger!`
    );

    setTimeout(() => {
      setIsSubmitting(false);
    }, 700);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Printable Bill Modal for Detailed Breakdown Inspection */}
      {previewBill && (
        <PrintableBillModal
          bill={previewBill}
          onClose={() => setPreviewBill(null)}
        />
      )}

      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  NESCO Electricity Billing Generator
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                  3 Billing Systems
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Calculate & apply electricity bills to the{' '}
                <span className="text-amber-300 font-bold">
                  {getMonthName(billingMonth)} {billingYear}
                </span>{' '}
                Monthly Ledger.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close generator form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert Toast */}
        {successToast && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 flex items-center justify-between gap-2 text-xs font-bold animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="p-1 hover:bg-emerald-700 rounded text-emerald-100 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Top Bar: Periods & 3 Billing Systems Selector */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Period Selector Card */}
            <div className="md:col-span-4 bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Target Ledger & Consumption Period
                </span>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Ledger Month:</span>
                    <span className="font-mono font-black text-sm text-indigo-700">
                      {getMonthName(billingMonth)} {billingYear}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-900 block">Consumption:</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <select
                        value={consumptionMonth}
                        onChange={(e) => setConsumptionMonth(Number(e.target.value))}
                        className="bg-white border border-amber-300 text-amber-950 text-xs font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      >
                        {MONTH_NAMES.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={consumptionYear}
                        onChange={(e) => setConsumptionYear(Number(e.target.value))}
                        className="bg-white border border-amber-300 text-amber-950 text-xs font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      >
                        {[2024, 2025, 2026, 2027].map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 bg-white p-1.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
                <span>Last Month: <strong>{prevPeriodLabel}</strong></span>
                <button
                  type="button"
                  onClick={handleCopyLastMonthAll}
                  className="text-amber-800 hover:text-amber-950 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  title="Copy readings for all units where available"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy All Last Month</span>
                </button>
              </div>
            </div>

            {/* 3 Billing Systems Selector */}
            <div className="md:col-span-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-white border border-slate-700 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-700/80">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                    Choose System of Billing
                  </span>
                  <p className="text-xs text-slate-300">
                    Select default calculation system or customize per flat below.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleAllBilling(true)}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    All Billing ON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllBilling(false)}
                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    All Billing OFF
                  </button>
                </div>
              </div>

              {/* 3 Interactive System Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5">
                {/* System 1: Regular NESCO */}
                <button
                  type="button"
                  onClick={() => handleApplySystemToAll('regular_nesco')}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    globalBillingSystem === 'regular_nesco'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      No. 1: Regular NESCO
                    </span>
                    {globalBillingSystem === 'regular_nesco' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className={`text-[10px] mt-1 block leading-tight ${globalBillingSystem === 'regular_nesco' ? 'text-slate-900' : 'text-slate-400'}`}>
                    Progressive Slabs (0–50 Lifeline + 6 Slabs) + Demand + Rent + 5% VAT
                  </span>
                </button>

                {/* System 2: Fixed Unit Price */}
                <button
                  type="button"
                  onClick={() => handleApplySystemToAll('fixed_unit_price')}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    globalBillingSystem === 'fixed_unit_price'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      No. 2: Fixed Unit Price
                    </span>
                    {globalBillingSystem === 'fixed_unit_price' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className={`text-[10px] mt-1 block leading-tight ${globalBillingSystem === 'fixed_unit_price' ? 'text-slate-900' : 'text-slate-400'}`}>
                    Flat ৳{globalFixedUnitRate}/kWh consumed instead of slabs
                  </span>
                </button>

                {/* System 3: Fixed Price Bill */}
                <button
                  type="button"
                  onClick={() => handleApplySystemToAll('fixed_price_bill')}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                    globalBillingSystem === 'fixed_price_bill'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5" />
                      No. 3: Fixed Price Bill
                    </span>
                    {globalBillingSystem === 'fixed_price_bill' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className={`text-[10px] mt-1 block leading-tight ${globalBillingSystem === 'fixed_price_bill' ? 'text-slate-900' : 'text-slate-400'}`}>
                    Flat lump-sum (e.g. ৳{globalFixedBillAmount}) without units
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 4 Tariff Input Fields like user image for No. 1 & No. 2 Billing Systems */}
          {(globalBillingSystem === 'regular_nesco' || globalBillingSystem === 'fixed_unit_price') && (
            <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    {globalBillingSystem === 'regular_nesco'
                      ? 'No. 1: Regular NESCO Tariff Parameters'
                      : 'No. 2: Fixed Unit Price Parameters'}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {globalBillingSystem === 'regular_nesco'
                      ? 'LT-A Residential 2026 progressive slabs: 0–50 Lifeline (৳4.63) • 0–75 First-stage (৳5.26) • 76–200 (৳8.50) • 201–300 (৳9.10) • 301–400 (৳9.62) • 401–600 (৳15.01) • Above 600 (৳17.35)'
                      : 'Custom energy unit rate per kWh plus NESCO fixed demand charges and VAT'}
                  </p>
                </div>
                {globalBillingSystem === 'regular_nesco' && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 inline-flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>2026 Slabs Active</span>
                  </span>
                )}
              </div>

              {/* 4 Input Fields styled exactly like the provided image */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4">
                {globalBillingSystem === 'fixed_unit_price' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Fixed Rate (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={globalFixedUnitRate}
                      onChange={(e) => handleGlobalFixedUnitRateChange(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Demand Rate (৳)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={globalDemandRate}
                    onChange={(e) => handleDemandRateChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sanctioned (kW)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={globalSanctionedLoad}
                    onChange={(e) => handleSanctionedLoadChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Meter Rent (৳)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={globalMeterRent}
                    onChange={(e) => handleMeterRentChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    VAT (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={globalVatPercentage}
                    onChange={(e) => handleVatPercentageChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* System 3 Parameter Bar */}
          {globalBillingSystem === 'fixed_price_bill' && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
                No. 3: Fixed Price Bill Parameter
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                Flat fixed lump-sum amount applied to all rental units without sub-meter readings.
              </p>
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Fixed Bill Amount (৳)
                </label>
                <input
                  type="number"
                  step="50"
                  value={globalFixedBillAmount}
                  onChange={(e) => handleGlobalFixedBillAmountChange(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>
          )}

          {/* Quick Metrics & 1-Click Action Bar */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-2xl p-4 text-slate-950 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5 sm:gap-6">
              <div>
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block">
                  Billed Units
                </span>
                <span className="text-lg sm:text-2xl font-black font-mono">
                  {totalEnabledUnits} <span className="text-xs font-semibold">/ {drafts.length} Flats</span>
                </span>
              </div>
              <div className="h-8 w-px bg-amber-600/30 hidden sm:block"></div>
              <div>
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block">
                  Total Energy
                </span>
                <span className="text-lg sm:text-2xl font-black font-mono">
                  {totalConsumedKwh.toLocaleString()} <span className="text-xs font-semibold">kWh</span>
                </span>
              </div>
              <div className="h-8 w-px bg-amber-600/30 hidden sm:block"></div>
              <div>
                <span className="text-[10px] font-black text-amber-950 uppercase tracking-wider block">
                  Total Estimated Bill
                </span>
                <span className="text-lg sm:text-2xl font-black font-mono text-slate-950">
                  {formatBDT(totalEstimatedBill)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLastMonthAll}
                className="px-3 py-2 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                title="Copy previous month readings for all units where available"
              >
                <Copy className="w-3.5 h-3.5 text-slate-700" />
                <span>📋 Copy Last Readings</span>
              </button>

              <button
                type="button"
                onClick={() => handleAutoFillStandard(220)}
                className="px-3 py-2 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                title="Auto-fill +220 kWh consumed units for all rental flats"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Auto-Fill 220 kWh</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateAndApply}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-400 fill-current" />
                )}
                <span>⚡ Save & Apply</span>
              </button>
            </div>
          </div>

          {/* Search, Filter, and Block Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search flat or tenant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 w-44 sm:w-56"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['all', 'Block A', 'Block B', 'Block C'] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBlockFilter(b)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      blockFilter === b
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {b === 'all' ? 'All Blocks' : b.replace('Block ', 'B-')}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredDrafts.length}</span> rental units
            </div>
          </div>

          {/* Unit Reading Sheet with 3 Systems & ON/OFF Toggles */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Flat ID</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Resident</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Billing Toggle</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Billing System</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Prev Reading</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Current / Fixed</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Units (kWh)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Bill (৳)</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Voucher</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-rose-950/40 text-rose-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDrafts.map((d) => {
                    return (
                      <tr
                        key={d.flatId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !d.isEnabled ? 'bg-slate-50/50 opacity-60' : ''
                        }`}
                      >
                        {/* Flat ID */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-sans font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                            {d.flatId}
                          </span>
                        </td>

                        {/* Resident */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700 max-w-[130px] truncate">
                          {d.tenantName}
                        </td>

                        {/* Billing ON / OFF Toggle Button */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleUnitBilling(d.flatId)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all shadow-2xs ${
                              d.isEnabled
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title={d.isEnabled ? 'Click to disable electricity billing (৳0)' : 'Click to enable electricity billing'}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                d.isEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            ></span>
                            <span>{d.isEnabled ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* 3 Billing Systems Dropdown */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <select
                            disabled={!d.isEnabled}
                            value={d.billingSystem}
                            onChange={(e) =>
                              handleUpdateUnitDraft(d.flatId, {
                                billingSystem: e.target.value as NescoBillingSystem,
                              })
                            }
                            className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="regular_nesco">1. Regular NESCO Slabs</option>
                            <option value="fixed_unit_price">2. Fixed Unit Price</option>
                            <option value="fixed_price_bill">3. Fixed Price Bill</option>
                          </select>
                        </td>

                        {/* Previous Reading (Input + Copy Last Month) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {d.billingSystem === 'fixed_price_bill' ? (
                            <span className="text-[10px] text-slate-400 italic">No Readings</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {d.isEnabled && d.lastMonthReadingAvailable && d.lastMonthReadingValue !== undefined ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyLastMonthForUnit(d.flatId)}
                                  className="p-1 hover:bg-amber-100 text-amber-800 rounded transition-colors text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                  title={`Copy ${d.lastMonthPeriodLabel} ending reading (${d.lastMonthReadingValue} kWh)`}
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>{d.lastMonthReadingValue}</span>
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-mono" title={d.isEnabled ? "No previous reading found" : "Billing is OFF"}>
                                  {d.isEnabled ? 'Manual' : '—'}
                                </span>
                              )}
                              <input
                                type="number"
                                disabled={!d.isEnabled}
                                value={d.isEnabled ? (d.previousReading > 0 ? d.previousReading : '') : ''}
                                onChange={(e) => {
                                  const p = Number(e.target.value) || 0;
                                  handleUpdateUnitDraft(d.flatId, { previousReading: p });
                                }}
                                placeholder={d.isEnabled ? '0' : '—'}
                                className="w-20 text-right font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                              />
                            </div>
                          )}
                        </td>

                        {/* Current Reading (or Fixed Amount / Rate) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {d.billingSystem === 'fixed_price_bill' ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500 font-bold">Fixed ৳</span>
                              <input
                                type="number"
                                disabled={!d.isEnabled}
                                value={d.isEnabled ? (d.fixedBillAmount > 0 ? d.fixedBillAmount : '') : ''}
                                onChange={(e) => {
                                  const amt = Number(e.target.value) || 0;
                                  handleUpdateUnitDraft(d.flatId, { fixedBillAmount: amt });
                                }}
                                placeholder={d.isEnabled ? '1500' : '—'}
                                className="w-24 text-right font-mono font-bold text-xs px-2 py-1 bg-amber-50/50 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {d.billingSystem === 'fixed_unit_price' && (
                                <div className="flex items-center text-[10px] text-slate-500">
                                  <span>@৳</span>
                                  <input
                                    type="number"
                                    step="0.1"
                                    disabled={!d.isEnabled}
                                    value={d.isEnabled ? (d.fixedUnitRate > 0 ? d.fixedUnitRate : '') : ''}
                                    onChange={(e) => {
                                      const r = Number(e.target.value) || 8.5;
                                      handleUpdateUnitDraft(d.flatId, { fixedUnitRate: r });
                                    }}
                                    placeholder={d.isEnabled ? '8.5' : '—'}
                                    className="w-12 text-right font-mono font-bold text-[10px] px-1 py-1 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                    title="Rate per kWh"
                                  />
                                </div>
                              )}
                              <input
                                type="number"
                                disabled={!d.isEnabled}
                                value={d.isEnabled ? (d.currentReading > 0 ? d.currentReading : '') : ''}
                                onChange={(e) => {
                                  const c = Number(e.target.value) || 0;
                                  handleUpdateUnitDraft(d.flatId, { currentReading: c });
                                }}
                                placeholder={d.isEnabled ? '0' : '—'}
                                className="w-20 text-right font-mono font-bold text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                              />
                            </div>
                          )}
                        </td>

                        {/* Consumed Units */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              !d.isEnabled
                                ? 'text-slate-400'
                                : d.billingSystem === 'fixed_price_bill'
                                ? 'bg-slate-100 text-slate-600'
                                : d.consumedUnits > 300
                                ? 'bg-rose-50 text-rose-700 font-black'
                                : d.consumedUnits > 200
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {!d.isEnabled
                              ? '—'
                              : d.billingSystem === 'fixed_price_bill'
                              ? '0 Units (Fixed)'
                              : `${d.consumedUnits} kWh`}
                          </span>
                        </td>

                        {/* Calculated Bill */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold">
                          {d.isEnabled ? (
                            <span className="text-amber-950 font-black">{formatBDT(d.calculatedBill)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">৳0 (Off)</span>
                          )}
                        </td>

                        {/* Preview Voucher Button */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {d.isEnabled ? (
                            <button
                              type="button"
                              onClick={() => {
                                const b = buildElectricityBillFromDraft(d);
                                setPreviewBill(b);
                              }}
                              className="p-1 hover:bg-amber-100 text-amber-900 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold"
                              title="Inspect bill voucher in original format with detailed breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Voucher</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono text-xs select-none">—</span>
                          )}
                        </td>

                        {/* Action: Remove Draft Row */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(d.flatId)}
                            className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title={`Remove Flat ${d.flatId} row from billing generator`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>
              Bills will update the{' '}
              <strong className="text-slate-800 font-bold">
                {getMonthName(billingMonth)} {billingYear}
              </strong>{' '}
              monthly ledger and persist to database.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handleGenerateAndApply}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Zap className="w-4 h-4 text-slate-950 fill-current" />
              )}
              <span>⚡ Save & Apply to Monthly Ledger</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

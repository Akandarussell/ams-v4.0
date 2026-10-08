import { NescoTariffConfig, SlabBreakdownItem } from '../types';

export const DEFAULT_NESCO_TARIFF: NescoTariffConfig = {
  id: 'nesco-2026-standard',
  title: 'NESCO Residential Tariff (LT-A Postpaid 2026 Update)',
  effectiveFrom: '2026-01-01',
  slabs: [
    { minUnits: 0, maxUnits: 50, ratePerUnit: 4.63, slabName: '0–50 units (Lifeline)' },
    { minUnits: 0, maxUnits: 75, ratePerUnit: 5.26, slabName: '0–75 units (First-stage)' },
    { minUnits: 76, maxUnits: 200, ratePerUnit: 8.50, slabName: '76–200 units' },
    { minUnits: 201, maxUnits: 300, ratePerUnit: 9.10, slabName: '201–300 units' },
    { minUnits: 301, maxUnits: 400, ratePerUnit: 9.62, slabName: '301–400 units' },
    { minUnits: 401, maxUnits: 600, ratePerUnit: 15.01, slabName: '401–600 units' },
    { minUnits: 601, maxUnits: null, ratePerUnit: 17.35, slabName: 'Above 600 units' },
  ],
  demandChargePerKW: 42.00,
  vatPercentage: 5.0,
  meterRent: 40.00,
  rebatePercentage: 0,
  isActive: true,
};

/**
 * Checks whether a tariff configuration has all 2026 LT-A slabs and rates without legacy values.
 */
export function isTariffUpToDate(tariff?: NescoTariffConfig | null): boolean {
  if (!tariff || !Array.isArray(tariff.slabs) || tariff.slabs.length < 7) {
    return false;
  }
  // Check if any obsolete rates exist (7.20, 7.59, 8.02, 12.67, 14.61)
  const legacyRates = [7.2, 7.20, 7.59, 8.02, 12.67, 14.61];
  const hasLegacyRate = tariff.slabs.some((s) => legacyRates.includes(s.ratePerUnit));
  if (hasLegacyRate) return false;

  // Verify all updated rates exist
  const lifeline = tariff.slabs.find((s) => s.maxUnits === 50);
  const slab1 = tariff.slabs.find((s) => s.minUnits === 0 && s.maxUnits === 75);
  const slab2 = tariff.slabs.find((s) => s.minUnits === 76 && s.maxUnits === 200);
  const slab3 = tariff.slabs.find((s) => s.minUnits === 201 && s.maxUnits === 300);
  const slab4 = tariff.slabs.find((s) => s.minUnits === 301 && s.maxUnits === 400);
  const slab5 = tariff.slabs.find((s) => s.minUnits === 401 && s.maxUnits === 600);
  const slab6 = tariff.slabs.find((s) => (s.minUnits !== undefined && s.minUnits >= 601) || s.maxUnits === null);

  if (!lifeline || Number(lifeline.ratePerUnit) !== 4.63) return false;
  if (!slab1 || Number(slab1.ratePerUnit) !== 5.26) return false;
  if (!slab2 || Number(slab2.ratePerUnit) !== 8.50) return false;
  if (!slab3 || Number(slab3.ratePerUnit) !== 9.10) return false;
  if (!slab4 || Number(slab4.ratePerUnit) !== 9.62) return false;
  if (!slab5 || Number(slab5.ratePerUnit) !== 15.01) return false;
  if (!slab6 || Number(slab6.ratePerUnit) !== 17.35) return false;

  return true;
}

/**
 * Normalizes and upgrades a tariff configuration to the latest 2026 NESCO rates,
 * preserving custom demandChargePerKW, meterRent, and vatPercentage if configured.
 */
export function upgradeTariffConfig(tariff?: NescoTariffConfig | null): NescoTariffConfig {
  if (isTariffUpToDate(tariff) && tariff) {
    return tariff;
  }
  return {
    ...DEFAULT_NESCO_TARIFF,
    demandChargePerKW: tariff?.demandChargePerKW !== undefined ? Number(tariff.demandChargePerKW) : DEFAULT_NESCO_TARIFF.demandChargePerKW,
    meterRent: tariff?.meterRent !== undefined ? Number(tariff.meterRent) : DEFAULT_NESCO_TARIFF.meterRent,
    vatPercentage: tariff?.vatPercentage !== undefined ? Number(tariff.vatPercentage) : DEFAULT_NESCO_TARIFF.vatPercentage,
    rebatePercentage: tariff?.rebatePercentage !== undefined ? Number(tariff.rebatePercentage) : DEFAULT_NESCO_TARIFF.rebatePercentage,
  };
}

export interface TariffCalculationResult {
  consumedUnits: number;
  slabBreakdown: SlabBreakdownItem[];
  baseEnergyCost: number;
  demandCharge: number;
  meterRent: number;
  subtotal: number;
  vatAmount: number;
  rebateAmount: number;
  totalBill: number;
  sanctionedLoadKW: number;
  tariffConfigSnapshot: NescoTariffConfig;
}

/**
 * Calculates progressive electricity bill based on Bangladesh NESCO LT-A Residential Tariff (2026 Update).
 * Consumed units = Current Reading - Previous Reading
 */
export function calculateNescoElectricityBill(
  currentReading: number,
  previousReading: number,
  tariffConfig: NescoTariffConfig = DEFAULT_NESCO_TARIFF,
  sanctionedLoadKW: number = 3
): TariffCalculationResult {
  const activeTariff = isTariffUpToDate(tariffConfig) ? tariffConfig : upgradeTariffConfig(tariffConfig);
  const consumedUnits = Math.max(0, currentReading - previousReading);
  const slabBreakdown: SlabBreakdownItem[] = [];
  let remainingUnits = consumedUnits;
  let baseEnergyCost = 0;

  const slabs = activeTariff.slabs || DEFAULT_NESCO_TARIFF.slabs;
  const lifelineSlab = slabs.find((s) => s.maxUnits === 50) || { ratePerUnit: 4.63, slabName: '0–50 units (Lifeline)' };
  const slab1 = slabs.find((s) => s.minUnits === 0 && s.maxUnits === 75) || slabs[1] || slabs[0] || { ratePerUnit: 5.26, slabName: '0–75 units (First-stage)' };
  const slab2 = slabs.find((s) => s.minUnits === 76 && s.maxUnits === 200) || slabs[2] || slabs[1] || { ratePerUnit: 8.50, slabName: '76–200 units' };
  const slab3 = slabs.find((s) => s.minUnits === 201 && s.maxUnits === 300) || slabs[3] || slabs[2] || { ratePerUnit: 9.10, slabName: '201–300 units' };
  const slab4 = slabs.find((s) => s.minUnits === 301 && s.maxUnits === 400) || slabs[4] || slabs[3] || { ratePerUnit: 9.62, slabName: '301–400 units' };
  const slab5 = slabs.find((s) => s.minUnits === 401 && s.maxUnits === 600) || slabs[5] || slabs[4] || { ratePerUnit: 15.01, slabName: '401–600 units' };
  const slab6 = slabs.find((s) => (s.minUnits !== undefined && s.minUnits >= 601) || s.maxUnits === null) || slabs[6] || slabs[5] || { ratePerUnit: 17.35, slabName: 'Above 600 units' };

  // Check Lifeline eligibility (0 - 50 units)
  if (consumedUnits <= 50 && consumedUnits > 0) {
    const lifelineRate = lifelineSlab.ratePerUnit;
    const cost = Number((consumedUnits * lifelineRate).toFixed(2));
    slabBreakdown.push({
      slabName: lifelineSlab.slabName || '0–50 units (Lifeline)',
      units: consumedUnits,
      rate: lifelineRate,
      amount: cost,
    });
    baseEnergyCost = cost;
  } else {
    // Progressive slab calculation
    // Slabs: 0-75 (75 units), 76-200 (125 units), 201-300 (100 units), 301-400 (100 units), 401-600 (200 units), >600 (remaining)
    const slabRanges = [
      { name: slab1.slabName || '0–75 units (First-stage)', cap: 75, rate: slab1.ratePerUnit },
      { name: slab2.slabName || '76–200 units', cap: 125, rate: slab2.ratePerUnit },
      { name: slab3.slabName || '201–300 units', cap: 100, rate: slab3.ratePerUnit },
      { name: slab4.slabName || '301–400 units', cap: 100, rate: slab4.ratePerUnit },
      { name: slab5.slabName || '401–600 units', cap: 200, rate: slab5.ratePerUnit },
      { name: slab6.slabName || 'Above 600 units', cap: Infinity, rate: slab6.ratePerUnit },
    ];

    for (const slab of slabRanges) {
      if (remainingUnits <= 0) break;
      const unitsInThisSlab = Math.min(remainingUnits, slab.cap);
      const amount = Number((unitsInThisSlab * slab.rate).toFixed(2));
      slabBreakdown.push({
        slabName: slab.name,
        units: unitsInThisSlab,
        rate: slab.rate,
        amount: amount,
      });
      baseEnergyCost += amount;
      remainingUnits -= unitsInThisSlab;
    }
  }

  baseEnergyCost = Number(baseEnergyCost.toFixed(2));
  const demandRate = Number(activeTariff.demandChargePerKW ?? 42.00);
  const demandCharge = Number((sanctionedLoadKW * demandRate).toFixed(2));
  const meterRent = Number((activeTariff.meterRent ?? 40.00).toFixed(2));
  const subtotal = Number((baseEnergyCost + demandCharge + meterRent).toFixed(2));

  // Government VAT on subtotal
  const vatPercentage = Number(activeTariff.vatPercentage ?? 5.0);
  const vatAmount = Number(((subtotal * vatPercentage) / 100).toFixed(2));
  const rebateAmount = (activeTariff.rebatePercentage || 0) > 0
    ? Number(((baseEnergyCost * activeTariff.rebatePercentage) / 100).toFixed(2))
    : 0;

  const totalBill = Math.round(subtotal + vatAmount - rebateAmount);

  return {
    consumedUnits,
    slabBreakdown,
    baseEnergyCost,
    demandCharge,
    meterRent,
    subtotal,
    vatAmount,
    rebateAmount,
    totalBill,
    sanctionedLoadKW,
    tariffConfigSnapshot: activeTariff,
  };
}

/**
 * Bangladeshi Taka Currency Formatter (BDT / ৳)
 */
export function formatBDT(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '৳0';
  return `৳${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Format Date strictly to DD/MM/YYYY with slashes as required (immune to timezone shift)
 */
export function formatDateDDMMYYYY(dateString?: string): string {
  if (!dateString || dateString === 'N/A' || dateString === 'null' || dateString === 'undefined') {
    return 'N/A';
  }
  const str = String(dateString).trim();
  if (!str) return 'N/A';

  // 1. Direct regex for ISO YYYY-MM-DD (prevents UTC-to-local timezone day shift)
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 2. Direct regex for DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }

  // 3. Fallback for generic Date objects or ISO strings with time
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {
    // fallback
  }

  return str;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || `Month ${monthNumber}`;
}

/**
 * Format Date strictly to DD/MM/YYYY format with slashes (immune to timezone shift)
 */
export function formatDateDDSlashMMSlashYYYY(dateString?: string): string {
  if (!dateString || dateString === 'N/A' || dateString === 'null' || dateString === 'undefined') {
    return '';
  }
  const str = String(dateString).trim();
  if (!str) return '';

  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  const dmy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}

  return str;
}

/**
 * Calculates the Postpaid Electricity Billing Period corresponding to a flat rent month/year.
 * Requirement: If flat rent month is August (8), then electricity billing period is July (7) as electricity is postpaid.
 */
export function getPostpaidElectricityPeriod(flatRentMonth: number, flatRentYear: number): {
  month: number;
  year: number;
  monthName: string;
  periodStr: string;
  displayStr: string;
} {
  const month = flatRentMonth === 1 ? 12 : flatRentMonth - 1;
  const year = flatRentMonth === 1 ? flatRentYear - 1 : flatRentYear;
  const monthName = getMonthName(month);
  const periodStr = `${year}-${String(month).padStart(2, '0')}`;
  const displayStr = `${monthName} ${year}`;
  return { month, year, monthName, periodStr, displayStr };
}

/**
 * Resolves the tenant name and contact for postpaid electricity receipts and vouchers.
 * In a postpaid electricity system, electricity collected in month M is for consumption
 * during the prior month (consumptionMonth, consumptionYear).
 * Because tenants may change at any month boundary, the electricity bill receipt must
 * ALWAYS be in the name of the tenant who occupied the unit during the prior consumption month.
 */
export function getPostpaidElectricityTenantInfo(
  flatId: string,
  consumptionMonth: number,
  consumptionYear: number,
  data: {
    ledgerItems?: Array<{
      flatId: string;
      month: number;
      year: number;
      tenantName?: string;
      tenantPhone?: string;
    }>;
    electricityBills?: Array<{
      flatId: string;
      consumptionMonth: number;
      consumptionYear: number;
      tenantName?: string;
      tenantId?: string;
    }>;
    tenants?: Array<{
      flatId: string;
      fullName: string;
      phone?: string;
      entryDate?: string;
      id?: string;
    }>;
  },
  currentTenantName?: string,
  currentTenantPhone?: string
): { tenantName: string; tenantPhone: string } {
  const cleanFlatId = (flatId || '').toLowerCase().trim();

  // 1. First priority: Check existing electricity bills for this consumption period
  const matchingBill = data.electricityBills?.find(
    (b) =>
      (b.flatId || '').toLowerCase().trim() === cleanFlatId &&
      b.consumptionMonth === consumptionMonth &&
      b.consumptionYear === consumptionYear &&
      b.tenantName &&
      b.tenantName.trim() !== ''
  );
  if (matchingBill && matchingBill.tenantName) {
    const billTenantName = matchingBill.tenantName.trim();
    const matchingTenantObj = data.tenants?.find(
      (t) =>
        (t.flatId || '').toLowerCase().trim() === cleanFlatId &&
        ((t.fullName || '').toLowerCase().trim() === billTenantName.toLowerCase() ||
         (matchingBill.tenantId && t.id === matchingBill.tenantId))
    );
    const matchingLedger = data.ledgerItems?.find(
      (li) =>
        (li.flatId || '').toLowerCase().trim() === cleanFlatId &&
        li.month === consumptionMonth &&
        li.year === consumptionYear
    );
    return {
      tenantName: billTenantName,
      tenantPhone: matchingTenantObj?.phone || matchingLedger?.tenantPhone || currentTenantPhone || '',
    };
  }

  // 2. Second priority: Check the previous month's ledger item (the record during that consumption period)
  const priorLedger = data.ledgerItems?.find(
    (li) =>
      (li.flatId || '').toLowerCase().trim() === cleanFlatId &&
      li.month === consumptionMonth &&
      li.year === consumptionYear &&
      li.tenantName &&
      li.tenantName.trim() !== ''
  );
  if (priorLedger && priorLedger.tenantName) {
    return {
      tenantName: priorLedger.tenantName.trim(),
      tenantPhone: priorLedger.tenantPhone || currentTenantPhone || '',
    };
  }

  // 3. Third priority: Check tenants table: tenant who was resident during consumption month
  const priorTenant = data.tenants?.find((t) => {
    if ((t.flatId || '').toLowerCase().trim() !== cleanFlatId) return false;
    if (!t.entryDate || !t.entryDate.includes('-')) return false;
    const parts = t.entryDate.split('-');
    const eYear = parseInt(parts[0], 10);
    const eMonth = parseInt(parts[1], 10);
    if (!eYear || !eMonth) return false;
    return eYear < consumptionYear || (eYear === consumptionYear && eMonth <= consumptionMonth);
  });
  if (priorTenant && priorTenant.fullName) {
    return {
      tenantName: priorTenant.fullName.trim(),
      tenantPhone: priorTenant.phone || currentTenantPhone || '',
    };
  }

  // 4. Fallback: current tenant name or 'Resident'
  return {
    tenantName: currentTenantName?.trim() || 'Resident',
    tenantPhone: currentTenantPhone || '',
  };
}


export type NescoBillingSystem = 'regular_nesco' | 'fixed_unit_price' | 'fixed_price_bill';

export interface MultiSystemCalculationResult {
  billingSystem: NescoBillingSystem;
  consumedUnits: number;
  slabBreakdown: SlabBreakdownItem[];
  baseEnergyCost: number;
  demandCharge: number;
  meterRent: number;
  subtotal: number;
  vatAmount: number;
  rebateAmount: number;
  totalBill: number;
  fixedUnitRate?: number;
  fixedBillAmount?: number;
}

/**
 * Calculates bill across the 3 billing systems:
 * 1. regular_nesco: Official progressive NESCO slabs (0-75, 76-200, etc.) + demand charge + meter rent + 5% VAT
 * 2. fixed_unit_price: Flat rate per consumed unit (e.g. ৳8.50/kWh) + demand charge + meter rent + 5% VAT
 * 3. fixed_price_bill: Fixed flat sum amount without any unit calculation
 */
export function calculateMultiSystemElectricityBill({
  billingSystem,
  currentReading,
  previousReading,
  fixedUnitRate = 15.01,
  fixedBillAmount = 1500,
  tariffConfig = DEFAULT_NESCO_TARIFF,
  sanctionedLoadKW = 3,
}: {
  billingSystem: NescoBillingSystem;
  currentReading: number;
  previousReading: number;
  fixedUnitRate?: number;
  fixedBillAmount?: number;
  tariffConfig?: NescoTariffConfig;
  sanctionedLoadKW?: number;
}): MultiSystemCalculationResult {
  if (billingSystem === 'fixed_price_bill') {
    const total = Math.max(0, Math.round(fixedBillAmount || 0));
    return {
      billingSystem: 'fixed_price_bill',
      consumedUnits: 0,
      slabBreakdown: [
        {
          slabName: 'Fixed Electricity Charge (No Sub-meter)',
          units: 0,
          rate: total,
          amount: total,
        },
      ],
      baseEnergyCost: total,
      demandCharge: 0,
      meterRent: 0,
      subtotal: total,
      vatAmount: 0,
      rebateAmount: 0,
      totalBill: total,
      fixedBillAmount: total,
    };
  }

  const consumedUnits = Math.max(0, currentReading - previousReading);

  if (billingSystem === 'fixed_unit_price') {
    const rate = Math.max(0, Number(fixedUnitRate) || 15.01);
    const baseEnergyCost = Number((consumedUnits * rate).toFixed(2));
    const demandCharge = Number((sanctionedLoadKW * (tariffConfig?.demandChargePerKW || 42)).toFixed(2));
    const meterRent = Number((tariffConfig?.meterRent || 40).toFixed(2));
    const subtotal = Number((baseEnergyCost + demandCharge + meterRent).toFixed(2));
    const vatAmount = Number(((subtotal * (tariffConfig?.vatPercentage || 5)) / 100).toFixed(2));
    const totalBill = Math.round(subtotal + vatAmount);

    return {
      billingSystem: 'fixed_unit_price',
      consumedUnits,
      slabBreakdown: [
        {
          slabName: `Fixed Unit Rate (৳${rate.toFixed(2)}/kWh)`,
          units: consumedUnits,
          rate,
          amount: baseEnergyCost,
        },
      ],
      baseEnergyCost,
      demandCharge,
      meterRent,
      subtotal,
      vatAmount,
      rebateAmount: 0,
      totalBill,
      fixedUnitRate: rate,
    };
  }

  // System 1: Regular NESCO progressive slabs
  const regular = calculateNescoElectricityBill(
    currentReading,
    previousReading,
    tariffConfig,
    sanctionedLoadKW
  );

  return {
    billingSystem: 'regular_nesco',
    ...regular,
  };
}

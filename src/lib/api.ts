import { getSupabaseClient } from './supabase';
import { INITIAL_UNITS } from './storage';
import {
  MonthlyLedgerItem,
  Unit,
  Tenant,
  ElectricityBill,
  PaymentTransaction,
  Complaint,
  ChatMessage,
  OnlinePaymentRequest,
  PaymentMethod,
  PaymentStatus,
} from '../types';

export interface SupabaseConnectionStatus {
  isConnected: boolean;
  message: string;
  tableCount?: number;
}

/**
 * Format month and year into strict 'YYYY-MM' billing period string
 * e.g., month = 10, year = 2026 -> '2026-10'
 */
export function formatBillingPeriod(month: number, year: number): string {
  const safeMonth = Math.min(12, Math.max(1, month));
  return `${year}-${String(safeMonth).padStart(2, '0')}`;
}

/**
 * Parse 'YYYY-MM' billing period string into { month, year }
 */
export function parseBillingPeriod(period: string): { month: number; year: number } {
  if (!period || !period.includes('-')) {
    return { month: 10, year: 2026 };
  }
  const parts = period.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const month = parseInt(parts[1], 10) || 10;
  return { month, year };
}

/**
 * Validates connection to the remote Supabase PostgreSQL database
 */
export async function testRemoteSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      isConnected: false,
      message: 'Supabase URL and Anon Key are not configured in environment variables or UI.',
    };
  }

  try {
    // Check connection to monthly_rent_records or units
    const { count, error } = await supabase
      .from('monthly_rent_records')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // If monthly_rent_records table isn't created yet, check units
      const { count: unitCount, error: unitError } = await supabase
        .from('units')
        .select('*', { count: 'exact', head: true });

      if (unitError) {
        console.error('[Supabase Connection/RLS Error]', unitError);
        return {
          isConnected: false,
          message: `Database connection/RLS error: ${unitError.message} (Code: ${unitError.code})`,
        };
      }

      return {
        isConnected: true,
        message: `Connected to Supabase! (Found 'units' table with ${unitCount ?? 0} units. Note: run SQL migration to create 'monthly_rent_records').`,
        tableCount: unitCount ?? 0,
      };
    }

    return {
      isConnected: true,
      message: `Successfully connected to Supabase PostgreSQL! Database has ${count ?? 0} monthly rent records.`,
      tableCount: count ?? 0,
    };
  } catch (err: any) {
    console.error('[Supabase Network Failure]', err);
    return {
      isConnected: false,
      message: `Network or configuration failure: ${err?.message || err}`,
    };
  }
}

// Cached detected period column name on remote database: 'period' | 'billing_period'
let activePeriodColumn: 'period' | 'billing_period' = 'period';

/**
 * Resolves which column name ('period' or 'billing_period') is supported on monthly_rent_records.
 * Defaults strictly to 'period' matching the primary database schema and unique constraint.
 */
async function resolvePeriodColumn(supabase: any): Promise<'period' | 'billing_period'> {
  if (activePeriodColumn) return activePeriodColumn;
  activePeriodColumn = 'period';
  return 'period';
}

/**
 * Maps a flat ID or unit ID (e.g. 'A1', 'u-a1', 'B2', 'C4') to its canonical block key:
 * 'blockA', 'blockB', or 'blockC'
 */
export function deriveBlockKey(flatIdOrUnitId: string, blockName?: string): string {
  const str = (flatIdOrUnitId || '').trim();
  const cleanId = str.replace(/^u-/, '').toUpperCase();

  if (cleanId.startsWith('A')) return 'blockA';
  if (cleanId.startsWith('B')) return 'blockB';
  if (cleanId.startsWith('C')) return 'blockC';

  if (blockName) {
    const bn = blockName.toLowerCase();
    if (bn.includes('a')) return 'blockA';
    if (bn.includes('b')) return 'blockB';
    if (bn.includes('c')) return 'blockC';
  }

  return 'blockA';
}

/**
 * Validates and normalizes status values for the PostgreSQL payment_status enum
 * ('Paid' | 'Not Paid' | 'Partially Paid' | 'N/A')
 */
export function normalizePaymentStatus(val?: string): 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' {
  if (!val) return 'Not Paid';
  const clean = String(val).trim().toLowerCase();
  if (clean === 'paid') return 'Paid';
  if (clean === 'partially paid' || clean === 'partially_paid' || clean === 'partial') return 'Partially Paid';
  if (clean === 'adjusted') return 'Adjusted';
  if (clean === 'n/a' || clean === 'na') return 'N/A';
  return 'Not Paid';
}

/**
 * Maps a raw Supabase PostgreSQL row to a typed MonthlyLedgerItem
 */
export function mapDbRowToMonthlyLedgerItem(
  item: any,
  fallbackPeriod: string,
  fallbackMonth?: number,
  fallbackYear?: number
): MonthlyLedgerItem {
  const billingPeriod = item.period || item.billing_period || fallbackPeriod;
  const { month: parsedM, year: parsedY } = parseBillingPeriod(billingPeriod);
  const m = item.month || (fallbackMonth ?? parsedM);
  const y = item.year || (fallbackYear ?? parsedY);

  const unit = INITIAL_UNITS.find(
    (u) => u.id === item.unit_id || u.flatId === item.unit_id || u.flatId === item.flat_id
  );

  const flatId = item.flat_id || unit?.flatId || item.unit_id || 'A1';
  const blockName = item.block_name || unit?.blockName || 'Block A';
  const blockKey = item.block_key || deriveBlockKey(flatId, blockName);
  const flatRent = Number(item.monthly_rent ?? item.flat_rent ?? unit?.monthlyRent ?? 0);
  const electricityBill = Number(item.electricity_bill ?? item.e_bill_amount ?? 0);
  const parkingRent = Number(item.parking_rent ?? 0);
  const godownRent = Number(item.godown_rent ?? 0);
  const advancePayment = Number(item.advance_paid ?? item.advance_payment ?? 0);
  const totalPaid = Number(item.paid_amount ?? item.total_paid ?? 0);
  const calculatedPayable = flatRent + electricityBill + parkingRent + godownRent;
  const totalPayable = Number(item.total_payable ?? calculatedPayable);
  const totalDue = Number(item.due_amount ?? item.total_due ?? Math.max(0, totalPayable - totalPaid));

  let rentStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' = 'Not Paid';
  const rawRent = item.rent_status || item.rentStatus;
  const rawPayment = item.payment_status || item.paymentStatus;
  if (rawRent) {
    rentStatus = normalizePaymentStatus(rawRent);
  } else if (rawPayment && normalizePaymentStatus(rawPayment) !== 'Not Paid') {
    rentStatus = normalizePaymentStatus(rawPayment);
  } else if (totalPaid >= flatRent && flatRent > 0) {
    rentStatus = 'Paid';
  } else if (totalPaid > 0) {
    rentStatus = 'Partially Paid';
  } else {
    rentStatus = 'Not Paid';
  }

  let paymentStatus: PaymentStatus = 'Not Paid';
  if (rawPayment) {
    paymentStatus = normalizePaymentStatus(rawPayment);
  } else if (totalDue <= 0 && totalPaid > 0) {
    paymentStatus = 'Paid';
  } else if (totalPaid > 0) {
    paymentStatus = 'Partially Paid';
  } else {
    paymentStatus = 'Not Paid';
  }

  const resolvedRentDate =
    item.rent_payment_date ||
    item.rentPaymentDate ||
    item.payment_date ||
    item.paymentDate ||
    item.last_payment_date ||
    item.lastPaymentDate ||
    undefined;

  return {
    id: item.id || `led-${flatId.toLowerCase().replace(/\s+/g, '-')}-${billingPeriod}`,
    unitId: item.unit_id || unit?.id || `u-${flatId.toLowerCase()}`,
    flatId,
    blockName,
    blockKey,
    tenantId: item.tenant_id || '',
    tenantName: item.tenant_name || item.tenantName || 'Resident',
    tenantPhone: item.tenant_phone || item.tenantPhone || '',
    entryDate: item.entry_date || item.entryDate || '2026-01-01',
    billingPeriod,
    month: m,
    year: y,
    advancePayment,
    advanceStatus: item.advance_status || item.advanceStatus || 'Not Paid',
    advanceDate: item.advance_date || item.advanceDate || undefined,
    flatRent,
    rentStatus,
    rentPaymentDate: resolvedRentDate,
    electricityBill,
    electricityStatus: item.electricity_status || item.electricityStatus || item.e_bill_status || (electricityBill > 0 ? 'Not Paid' : 'N/A'),
    electricityDate: item.electricity_date || item.electricityDate || item.e_bill_date || undefined,
    parkingRent,
    godownRent,
    totalPayable,
    totalPaid,
    totalDue,
    paymentStatus,
    adjustedFromAdvance: Number(item.adjustment_amount ?? item.adjusted_from_advance ?? item.adjustedFromAdvance ?? 0),
    lastPaymentDate: resolvedRentDate || item.last_payment_date || item.lastPaymentDate || item.electricity_date || item.electricityDate || undefined,
    notes: item.notes || '',
  };
}

/**
 * 1. MONTHLY SCOPING: Fetch records from Supabase strictly where billing_period (or period) = selectedPeriod
 * Target table: monthly_rent_records (with seamless adaptive column detection and fallback)
 */
export async function fetchRemoteMonthlyRentRecords(
  billingPeriod: string
): Promise<MonthlyLedgerItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { month, year } = parseBillingPeriod(billingPeriod);
  const targetCol = await resolvePeriodColumn(supabase);

  try {
    console.log(`[Supabase Scoping] Querying monthly_rent_records where ${targetCol} = "${billingPeriod}"...`);
    let { data, error } = await supabase
      .from('monthly_rent_records')
      .select('*')
      .eq(targetCol, billingPeriod);

    if (error) {
      // Column does not exist on table (code 42703) -> try alternate column
      if (error.code === '42703' || error.message?.toLowerCase().includes('does not exist')) {
        const alternateCol = targetCol === 'period' ? 'billing_period' : 'period';
        console.log(`[Supabase Scoping] Column '${targetCol}' not present, checking '${alternateCol}'...`);
        const retry = await supabase
          .from('monthly_rent_records')
          .select('*')
          .eq(alternateCol, billingPeriod);

        if (!retry.error) {
          activePeriodColumn = alternateCol;
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        // Table does not exist (code 42P01 or PGRST205)
        if (error.code === '42P01' || error.code === 'PGRST205') {
          console.warn(`[Supabase Schema Notice] Table 'monthly_rent_records' not found in database. Checking fallback.`);
          return await fetchRemoteLedgerFallback(month, year);
        }

        // Permission denied (RLS violation)
        if (error.code === '42501') {
          console.warn(
            `[Supabase RLS Notice] Read access restricted on monthly_rent_records for ${billingPeriod}. Verify RLS policies allow SELECT.`
          );
          return [];
        }

        console.warn(`[Supabase Query Notice] Failed to query monthly_rent_records for ${billingPeriod}:`, error.message);
        return await fetchRemoteLedgerFallback(month, year);
      }
    }

    if (!data || data.length === 0) {
      console.log(`[Supabase Query] ${targetCol} = "${billingPeriod}": 0 records found in Supabase.`);
      return [];
    }

    console.log(
      `[Supabase Query Success] ${targetCol} = "${billingPeriod}": Successfully fetched ${data.length} records from monthly_rent_records.`
    );

    return data.map((item: any) => mapDbRowToMonthlyLedgerItem(item, billingPeriod, month, year));
  } catch (err: any) {
    console.warn(`[Supabase Exception] Failed to query monthly_rent_records:`, err);
    return await fetchRemoteLedgerFallback(month, year);
  }
}

/**
 * Dynamic set of columns reported by PostgREST as not existing in schema cache (e.g. PGRST204)
 */
const unsupportedColumns = new Set<string>();

/**
 * Helper to build payload matching the database schema.
 * Ensures block_key, monthly_rent, and all actual database fields are properly structured.
 */
export function buildUpsertPayload(flat: any, selectedPeriod: string): Record<string, any> {
  let cleanId = '';
  if (flat.flatId) {
    cleanId = String(flat.flatId).trim();
  } else if (flat.unit_id && !String(flat.unit_id).startsWith('led')) {
    cleanId = String(flat.unit_id).trim();
  } else if (flat.unitId && !String(flat.unitId).startsWith('led')) {
    cleanId = String(flat.unitId).trim();
  } else if (flat.id) {
    const idStr = String(flat.id).trim();
    if (idStr.startsWith('ledger-') || idStr.startsWith('led-')) {
      const parts = idStr.split('-');
      cleanId = parts[1] || idStr;
    } else {
      cleanId = idStr;
    }
  } else {
    cleanId = 'A1';
  }
  const unitId = cleanId.replace(/^u-/, '').trim();

  // 1. Map block_key properly from the flat record or derive it from the unit ID prefix
  const derivedBlockKey =
    unitId.toUpperCase().startsWith('A')
      ? 'blockA'
      : unitId.toUpperCase().startsWith('B')
      ? 'blockB'
      : unitId.toUpperCase().startsWith('C')
      ? 'blockC'
      : deriveBlockKey(unitId, flat.blockName || flat.block_name);

  const blockKey: string =
    flat.blockKey ||
    flat.block_key ||
    (unitId.startsWith('A') ? 'blockA' : unitId.startsWith('B') ? 'blockB' : unitId.startsWith('C') ? 'blockC' : derivedBlockKey) ||
    'blockA';

  const rentStatus = normalizePaymentStatus(flat.rent_status || flat.rentStatus);
  const electricityStatus = normalizePaymentStatus(
    flat.electricity_status || flat.eBillStatus || flat.electricityStatus
  );

  const flatRent = Number(flat.monthly_rent ?? flat.flat_rent ?? flat.rent ?? flat.flatRent ?? 0);
  const eBillAmount = Number(flat.electricity_bill ?? flat.e_bill_amount ?? flat.eBill ?? flat.electricityBill ?? 0);
  const parkingRent = Number(flat.parking_rent ?? flat.parkingRent ?? 0);
  const godownRent = Number(flat.godown_rent ?? flat.godownRent ?? 0);
  const advancePayment = Number(flat.advance_paid ?? flat.advance_payment ?? flat.advancePayment ?? 0);
  const advanceStatus = flat.advance_status || flat.advanceStatus || (advancePayment > 0 ? 'Paid' : 'Not Paid');
  const adjustedFromAdvance = Number(flat.adjustment_amount ?? flat.adjusted_from_advance ?? flat.adjustedFromAdvance ?? 0);
  const rawAdvDate = flat.advance_date || flat.advanceDate;
  const rawRentDate = flat.payment_date || flat.paymentDate || flat.rent_payment_date || flat.rentPaymentDate;
  const rawElecDate = flat.e_bill_date || flat.eBillDate || flat.electricity_date || flat.electricityDate;
  const rawLastDate = flat.last_payment_date || flat.lastPaymentDate || rawRentDate || rawElecDate || rawAdvDate;

  const advPaid = advancePayment;
  const advReq = Number(flat.advance_required ?? advPaid);
  const advDue = Math.max(0, advReq - advPaid);

  const totalPayableVal = Number(
    flat.total_payable ?? flat.totalPayable ?? (flatRent + eBillAmount + parkingRent + godownRent)
  );

  let paidAmount = Number(flat.paid_amount ?? flat.total_paid ?? flat.totalPaid ?? 0);
  if (paidAmount === 0 && rentStatus === 'Paid' && flatRent > 0) {
    paidAmount = flatRent + (electricityStatus === 'Paid' ? eBillAmount : 0);
  } else if (rentStatus === 'Partially Paid' && paidAmount === 0 && flatRent > 0) {
    paidAmount = Math.round(flatRent / 2);
  }

  // Calculate rent due portion
  const rentDue = (rentStatus === 'Paid' || rentStatus === 'Adjusted' || rentStatus === 'N/A')
    ? 0
    : rentStatus === 'Partially Paid'
    ? Math.max(0, flatRent - paidAmount)
    : flatRent;

  // Calculate electricity due portion
  const elecDue = (electricityStatus === 'Paid' || electricityStatus === 'N/A' || eBillAmount === 0)
    ? 0
    : eBillAmount;

  let dueAmount = rentDue + elecDue + (parkingRent || 0) + (godownRent || 0);
  if (flat.due_amount !== undefined && flat.due_amount !== null && !isNaN(flat.due_amount)) {
    if (rentStatus !== 'Paid' && rentStatus !== 'Adjusted') {
      dueAmount = Number(flat.due_amount);
    }
  } else if (flat.total_due !== undefined && flat.total_due !== null && !isNaN(flat.total_due)) {
    if (rentStatus !== 'Paid' && rentStatus !== 'Adjusted') {
      dueAmount = Number(flat.total_due);
    }
  }

  const paymentStatus = normalizePaymentStatus(
    flat.payment_status ||
    flat.paymentStatus ||
    (rentStatus === 'Adjusted'
      ? 'Adjusted'
      : rentStatus === 'N/A' && (electricityStatus === 'N/A' || eBillAmount === 0)
      ? 'N/A'
      : dueAmount === 0 && totalPayableVal > 0
      ? 'Paid'
      : paidAmount > 0
      ? 'Partially Paid'
      : 'Not Paid')
  );

  const payload: Record<string, any> = {
    period: selectedPeriod, // 'YYYY-MM' matching table column
    billing_period: selectedPeriod, // Dual-support for billing_period column
    unit_id: unitId,
    flat_id: cleanId,
    block_key: blockKey,
    tenant_name: flat.tenant_name || flat.tenant || flat.tenantName || 'Resident',
    tenant_phone: flat.tenant_phone || flat.phone || flat.tenantPhone || '',
    entry_date: (flat.entry_date || flat.entryDate) ? String(flat.entry_date || flat.entryDate).slice(0, 10) : '2026-01-01',
    advance_required: advReq,
    advance_paid: advPaid,
    advance_due: advDue,
    advance_status: advanceStatus,
    advance_date: rawAdvDate ? String(rawAdvDate).slice(0, 10) : null,
    flat_rent: flatRent,
    monthly_rent: flatRent,
    rent_status: rentStatus,
    rent_payment_date: rawRentDate ? String(rawRentDate).slice(0, 10) : (rentStatus === 'Paid' ? (rawLastDate ? String(rawLastDate).slice(0, 10) : null) : null),
    total_payable: totalPayableVal,
    total_paid: paidAmount,
    paid_amount: paidAmount,
    total_due: dueAmount,
    due_amount: dueAmount,
    payment_status: paymentStatus,
    payment_date: rawRentDate ? String(rawRentDate).slice(0, 10) : (rentStatus === 'Paid' ? (rawLastDate ? String(rawLastDate).slice(0, 10) : null) : null),
    payment_method: flat.payment_method || flat.paymentMethod || 'Cash',
    adjusted_from_advance: adjustedFromAdvance,
    adjustment_amount: adjustedFromAdvance,
    electricity_billing_type: flat.electricity_billing_type || 'nesco_submeter',
    e_bill_amount: eBillAmount,
    electricity_bill: eBillAmount,
    electricity_status: electricityStatus,
    e_bill_date: rawElecDate ? String(rawElecDate).slice(0, 10) : (electricityStatus === 'Paid' ? (rawLastDate ? String(rawLastDate).slice(0, 10) : null) : null),
    parking_rent: parkingRent,
    godown_rent: godownRent,
    notes: flat.notes || '',
  };

  // Strip any columns dynamically flagged as unsupported
  for (const col of unsupportedColumns) {
    delete payload[col];
  }

  return payload;
}

// Track unit IDs that have been confirmed or registered in remote units table
const syncedUnitIds = new Set<string>();

/**
 * Ensures that referenced unit IDs exist in the Supabase 'units' table before inserting/updating monthly rent records.
 * If a unit ID (e.g. 'A1', 'A5 (Owner)', 'C5 Owner', 'P1', etc.) is missing in remote database, it dynamically creates it.
 */
export async function ensureRemoteUnitsExist(
  supabase: any,
  records: Array<{ unit_id?: string; flat_id?: string; block_key?: string; block_name?: string; monthly_rent?: number }>
): Promise<void> {
  if (!supabase || !records || records.length === 0) return;

  try {
    const neededUnitIds = Array.from(
      new Set(
        records
          .map((r) => String(r.unit_id || r.flat_id || '').trim())
          .filter((id) => id.length > 0)
      )
    );

    const unverifiedIds = neededUnitIds.filter((id) => !syncedUnitIds.has(id));
    if (unverifiedIds.length === 0) return;

    // Check existing units in Supabase
    const { data: dbUnits, error: fetchErr } = await supabase
      .from('units')
      .select('id, flat_id');

    if (fetchErr) {
      return;
    }

    const existingKeys = new Set<string>();
    if (dbUnits && Array.isArray(dbUnits)) {
      for (const u of dbUnits) {
        if (u.id) existingKeys.add(String(u.id).trim());
        if (u.flat_id) existingKeys.add(String(u.flat_id).trim());
      }
    }

    const missingIds = unverifiedIds.filter((id) => !existingKeys.has(id));

    if (missingIds.length > 0) {
      const unitsToInsert = missingIds.map((uid) => {
        const matchingRecord = records.find(
          (r) => (r.unit_id || r.flat_id) === uid
        );
        const blockKey = matchingRecord?.block_key || deriveBlockKey(uid, matchingRecord?.block_name);
        const blockName =
          blockKey === 'blockA' ? 'Block A' : blockKey === 'blockB' ? 'Block B' : 'Block C';
        const floor = parseInt(uid.replace(/\D/g, ''), 10) || 1;
        const unitType = uid.toUpperCase().startsWith('P')
          ? 'parking'
          : uid.toUpperCase().startsWith('G')
          ? 'godown'
          : 'residential';

        return {
          id: uid,
          flat_id: uid,
          block_name: blockName,
          floor,
          unit_type: unitType,
          monthly_rent: Number(matchingRecord?.monthly_rent || 0),
          is_occupied: true,
          electricity_billing_type: unitType === 'residential' ? 'nesco_submeter' : 'none',
        };
      });

      console.log(`[Supabase Units Auto-Sync] Auto-registering ${unitsToInsert.length} missing units in remote 'units' table:`, missingIds);

      // Attempt upsert
      try {
        const { error: upsertErr } = await supabase
          .from('units')
          .upsert(unitsToInsert, { onConflict: 'id' });

        if (upsertErr) {
          for (const u of unitsToInsert) {
            try {
              await supabase.from('units').upsert(u, { onConflict: 'flat_id' });
            } catch {
              // ignore individual error
            }
          }
        }
      } catch {
        // ignore
      }
    }

    for (const id of neededUnitIds) {
      syncedUnitIds.add(id);
    }
  } catch (err) {
    console.warn('[Supabase Units Auto-Sync Notice] Could not auto-sync units table:', err);
  }
}

/**
 * 2. DATA UPSERT / PERSISTENCE:
 * Perform a Supabase save matching on (unit_id, period) with explicit block_key,
 * resilient PostgREST schema cache tolerance (PGRST204), and conflict fallback.
 */
export async function upsertRemoteMonthlyRentRecord(
  flat: any
): Promise<{ success: boolean; data?: any; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const errorMsg = 'Supabase client is not configured. Please configure your Supabase URL & Anon Key in the Database Setup modal or .env file.';
    console.warn('[Supabase Upsert]', errorMsg);
    return { success: false, error: new Error(errorMsg) };
  }

  const selectedPeriod =
    flat.period ||
    flat.billingPeriod ||
    flat.billing_period ||
    (flat.month && flat.year ? formatBillingPeriod(flat.month, flat.year) : '2026-10');

  let payload: any = buildUpsertPayload(flat, selectedPeriod);

  console.log(`[Supabase Upsert] Saving Flat ${payload.unit_id} (period: "${payload.period}", block_key: "${payload.block_key}"):`, payload);

  // Auto-ensure referenced unit exists in units table
  await ensureRemoteUnitsExist(supabase, [payload]);

  let lastError: any = null;

  // Retry loop handles stale PostgREST schema cache (PGRST204) by stripping any uncached columns
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // Clean payload against current unsupportedColumns
      for (const col of unsupportedColumns) {
        delete payload[col];
      }

      // 1. Try upsert with onConflict on (unit_id, billing_period) or (unit_id, period)
      const conflictCol = activePeriodColumn === 'billing_period' ? 'unit_id,billing_period' : 'unit_id,period';
      let { data, error } = await supabase
        .from('monthly_rent_records')
        .upsert(payload, { onConflict: conflictCol })
        .select('id');

      if (!error) {
        console.log(`[Supabase Upsert OK] Flat ${payload.unit_id} (block_key: "${payload.block_key}") saved successfully to monthly_rent_records:`, data);
        return { success: true, data: data || { unit_id: payload.unit_id } };
      }

      let currentError = error;
      lastError = error;

      // Handle foreign key constraint violation (code 23503 or monthly_rent_records_unit_id_fkey)
      if (
        currentError.code === '23503' ||
        currentError.message?.toLowerCase().includes('foreign key') ||
        currentError.message?.includes('monthly_rent_records_unit_id_fkey')
      ) {
        console.warn(`[Supabase Foreign Key Notice] unit_id '${payload.unit_id}' not found in units table. Registering and retrying...`);
        try {
          await supabase.from('units').upsert({
            id: payload.unit_id,
            flat_id: payload.unit_id,
            block_name: payload.block_key === 'blockA' ? 'Block A' : payload.block_key === 'blockB' ? 'Block B' : 'Block C',
            floor: parseInt(payload.unit_id.replace(/\D/g, ''), 10) || 1,
            unit_type: payload.unit_id.startsWith('P') ? 'parking' : payload.unit_id.startsWith('G') ? 'godown' : 'residential',
            monthly_rent: payload.monthly_rent || 0,
            is_occupied: true,
          }, { onConflict: 'id' });
          syncedUnitIds.add(payload.unit_id);

          // Retry upsert
          const retryRes = await supabase
            .from('monthly_rent_records')
            .upsert(payload, { onConflict: conflictCol })
            .select('id');

          if (!retryRes.error) {
            console.log(`[Supabase Upsert OK after FK resolution] Flat ${payload.unit_id} saved successfully.`);
            return { success: true, data: retryRes.data || { unit_id: payload.unit_id } };
          }
        } catch {
          // continue fallback
        }
      }

      // Handle PostgREST schema cache missing column (PGRST204) immediately
      if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
        const match =
          currentError.message.match(/Could not find the '([^']+)' column/i) ||
          currentError.message.match(/'([^']+)' column/i) ||
          currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
          currentError.message.match(/column "([^"]+)"/i);
        const colName = match ? match[1] : null;
        if (colName) {
          console.warn(`[Supabase Schema Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
          unsupportedColumns.add(colName);
          delete payload[colName];

          // Also attempt simple upsert without select
          try {
            const noSelectRes = await supabase
              .from('monthly_rent_records')
              .upsert(payload, { onConflict: conflictCol });
            if (!noSelectRes.error) {
              console.log(`[Supabase Upsert OK Minimal] Flat ${payload.unit_id} saved successfully.`);
              return { success: true, data: { unit_id: payload.unit_id } };
            }
            if (noSelectRes.error.code === 'PGRST204' || noSelectRes.error.message?.includes('schema cache') || noSelectRes.error.message?.includes('column')) {
              const m2 =
                noSelectRes.error.message.match(/Could not find the '([^']+)' column/i) ||
                noSelectRes.error.message.match(/'([^']+)' column/i) ||
                noSelectRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
                noSelectRes.error.message.match(/column "([^"]+)"/i);
              if (m2?.[1]) {
                unsupportedColumns.add(m2[1]);
                delete payload[m2[1]];
              }
            }
          } catch {
            // continue retry loop
          }
          continue;
        }
      }

      // If missing unique constraint matching onConflict specification (error 42P10), try alternate conflict target
      if (error.code === '42P10' || error.message?.includes('ON CONFLICT specification') || error.message?.includes('exclusion constraint')) {
        const altConflict = conflictCol === 'unit_id,period' ? 'unit_id,billing_period' : 'unit_id,period';
        const altRes = await supabase
          .from('monthly_rent_records')
          .upsert(payload, { onConflict: altConflict })
          .select('id');

        if (!altRes.error) {
          activePeriodColumn = altConflict === 'unit_id,billing_period' ? 'billing_period' : 'period';
          console.log(`[Supabase Upsert OK with ${altConflict}] Flat ${payload.unit_id} saved successfully:`, altRes.data);
          return { success: true, data: altRes.data || { unit_id: payload.unit_id } };
        }

        if (altRes.error.code === 'PGRST204' || altRes.error.message?.includes('schema cache') || altRes.error.message?.includes('column')) {
          const match =
            altRes.error.message.match(/Could not find the '([^']+)' column/i) ||
            altRes.error.message.match(/'([^']+)' column/i) ||
            altRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            altRes.error.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            console.warn(`[Supabase Schema Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
            unsupportedColumns.add(colName);
            delete payload[colName];
            continue;
          }
        }

        console.warn(`[Supabase Notice] No unique constraint on (${conflictCol}); saving Flat ${payload.unit_id} via find-and-update/insert...`);
        const queryCol = activePeriodColumn === 'period' ? 'period' : 'billing_period';
        const queryPeriod = payload[queryCol] || payload.billing_period || payload.period;
        let existingId: string | null = null;
        try {
          const { data: exRow, error: exErr } = await supabase
            .from('monthly_rent_records')
            .select('id')
            .eq('unit_id', payload.unit_id)
            .eq(queryCol, queryPeriod)
            .maybeSingle();

          if (!exErr && exRow?.id) {
            existingId = exRow.id;
          } else if (exErr) {
            const altCol = queryCol === 'period' ? 'billing_period' : 'period';
            const altP = payload[altCol] || queryPeriod;
            const { data: altExRow } = await supabase
              .from('monthly_rent_records')
              .select('id')
              .eq('unit_id', payload.unit_id)
              .eq(altCol, altP)
              .maybeSingle();
            if (altExRow?.id) {
              existingId = altExRow.id;
              activePeriodColumn = altCol;
            }
          }
        } catch {
          // ignore lookup errors and fall through
        }

        if (existingId) {
          const updateRes = await supabase
            .from('monthly_rent_records')
            .update(payload)
            .eq('id', existingId)
            .select('id');

          if (!updateRes.error) {
            console.log(`[Supabase Update OK] Flat ${payload.unit_id} updated successfully via ID:`, updateRes.data);
            return { success: true, data: updateRes.data || { id: existingId, unit_id: payload.unit_id } };
          }
          currentError = updateRes.error;
          lastError = updateRes.error;
        } else {
          const insertRes = await supabase
            .from('monthly_rent_records')
            .insert(payload)
            .select('id');

          if (!insertRes.error) {
            console.log(`[Supabase Insert OK] Flat ${payload.unit_id} inserted successfully:`, insertRes.data);
            return { success: true, data: insertRes.data || { unit_id: payload.unit_id } };
          }
          currentError = insertRes.error;
          lastError = insertRes.error;
        }

        if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
          const match =
            currentError.message.match(/Could not find the '([^']+)' column/i) ||
            currentError.message.match(/'([^']+)' column/i) ||
            currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            currentError.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            unsupportedColumns.add(colName);
            delete payload[colName];
            continue;
          }
        }
      }

      console.error(`[Supabase Upsert Error] Failed to save Flat ${payload.unit_id} (${payload.block_key}):`, currentError.message, currentError);
      return { success: false, error: currentError };
    } catch (err: any) {
      console.error(`[Supabase Upsert Exception] Error saving Flat ${payload.unit_id}:`, err?.message || err, err);
      return { success: false, error: err };
    }
  }

  return { success: false, error: lastError || new Error('Max attempts exceeded') };
}

/**
 * Batch Upsert multiple monthly rent records into Supabase on (unit_id, billing_period)
 * with explicit block_key, auto-unit registration, and resilient individual fallback.
 */
export async function upsertBatchRemoteMonthlyRentRecords(
  flats: any[]
): Promise<{ success: boolean; count: number; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const errorMsg = 'Supabase client is not configured. Please configure your Supabase URL & Anon Key in the Database Setup modal or .env file.';
    return { success: false, count: 0, error: new Error(errorMsg) };
  }
  if (!flats || flats.length === 0) {
    return { success: false, count: 0, error: new Error('No records provided to save.') };
  }

  const records = flats.map((flat) => {
    const selectedPeriod =
      flat.period ||
      flat.billingPeriod ||
      flat.billing_period ||
      (flat.month && flat.year ? formatBillingPeriod(flat.month, flat.year) : '2026-10');
    return buildUpsertPayload(flat, selectedPeriod);
  });

  console.log(`[Supabase Batch Upsert] Upserting ${records.length} records with explicit block_key to monthly_rent_records... Sample:`, records[0]);

  // 1. Auto-ensure all referenced units exist in the remote units table
  await ensureRemoteUnitsExist(supabase, records);

  let currentRecords = records;
  let lastBatchError: any = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      // Ensure records do not contain any known unsupportedColumns
      currentRecords = currentRecords.map((r: any) => {
        const copy = { ...r };
        for (const col of unsupportedColumns) {
          delete copy[col];
        }
        return copy;
      });

      const conflictCol = activePeriodColumn === 'billing_period' ? 'unit_id,billing_period' : 'unit_id,period';
      let { data, error } = await supabase
        .from('monthly_rent_records')
        .upsert(currentRecords, { onConflict: conflictCol })
        .select('id');

      if (!error) {
        console.log(`[Supabase Batch Upsert OK] Successfully saved ${currentRecords.length} records with explicit block_key.`);
        return { success: true, count: currentRecords.length };
      }

      let currentError = error;
      lastBatchError = error;

      // Handle PostgREST schema cache missing column (PGRST204) immediately
      if (currentError.code === 'PGRST204' || currentError.message?.includes('schema cache') || currentError.message?.includes('column')) {
        const match =
          currentError.message.match(/Could not find the '([^']+)' column/i) ||
          currentError.message.match(/'([^']+)' column/i) ||
          currentError.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
          currentError.message.match(/column "([^"]+)"/i);
        const colName = match ? match[1] : null;
        if (colName) {
          console.warn(`[Supabase Batch Notice] Column '${colName}' not found in PostgREST schema cache; stripping and remembering...`);
          unsupportedColumns.add(colName);
          currentRecords = currentRecords.map((r: any) => {
            const copy = { ...r };
            delete copy[colName];
            return copy;
          });
          continue;
        }
      }

      // If missing unique constraint matching onConflict specification, try alternate conflict target
      if (error.code === '42P10' || error.message?.includes('ON CONFLICT specification') || error.message?.includes('exclusion constraint')) {
        const altConflict = conflictCol === 'unit_id,period' ? 'unit_id,billing_period' : 'unit_id,period';
        const altRes = await supabase
          .from('monthly_rent_records')
          .upsert(currentRecords, { onConflict: altConflict })
          .select('id');

        if (!altRes.error) {
          activePeriodColumn = altConflict === 'unit_id,billing_period' ? 'billing_period' : 'period';
          console.log(`[Supabase Batch Upsert OK with ${altConflict}] Successfully saved ${currentRecords.length} records.`);
          return { success: true, count: currentRecords.length };
        }

        if (altRes.error.code === 'PGRST204' || altRes.error.message?.includes('schema cache') || altRes.error.message?.includes('column')) {
          const match =
            altRes.error.message.match(/Could not find the '([^']+)' column/i) ||
            altRes.error.message.match(/'([^']+)' column/i) ||
            altRes.error.message.match(/column ['"]([^'"]+)['"] of relation/i) ||
            altRes.error.message.match(/column "([^"]+)"/i);
          const colName = match ? match[1] : null;
          if (colName) {
            unsupportedColumns.add(colName);
            currentRecords = currentRecords.map((r: any) => {
              const copy = { ...r };
              delete copy[colName];
              return copy;
            });
            continue;
          }
        }
      }

      // On ANY other batch error (foreign key constraint 23503, 409, or schema mismatch), gracefully save records individually
      console.warn(`[Supabase Batch Notice] Batch save hit issue (${currentError.message}); falling back to saving records individually...`);
      let savedCount = 0;
      let singleErrors: any[] = [];
      for (const item of currentRecords) {
        const res = await upsertRemoteMonthlyRentRecord(item);
        if (res.success) {
          savedCount++;
        } else if (res.error) {
          singleErrors.push(res.error);
        }
      }
      if (savedCount > 0) {
        console.log(`[Supabase Batch Fallback OK] Saved ${savedCount}/${currentRecords.length} records individually.`);
        return { success: true, count: savedCount };
      }
      return { success: false, count: 0, error: singleErrors[0] || currentError };
    } catch (err: any) {
      console.error('[Supabase Batch Upsert Exception]:', err?.message || err, err);
      // Try individual save fallback
      try {
        let savedCount = 0;
        for (const item of currentRecords) {
          const res = await upsertRemoteMonthlyRentRecord(item);
          if (res.success) savedCount++;
        }
        if (savedCount > 0) {
          return { success: true, count: savedCount };
        }
      } catch {
        // ignore
      }
      return { success: false, count: 0, error: err };
    }
  }

  return { success: false, count: 0, error: lastBatchError || new Error('Max retry attempts exceeded') };
}

/**
 * Copy/Clone tenant roster from a previous month into the current billing_period
 * with reset payment statuses (Electricity & Paid set to 0, Payment Status = 'Not Paid').
 */
export async function copyMonthlyRosterInSupabase(
  sourcePeriod: string,
  targetPeriod: string,
  fallbackSourceItems?: MonthlyLedgerItem[]
): Promise<{ success: boolean; count: number; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, count: 0, error: new Error('Supabase client is not configured.') };

  const { month: targetMonth, year: targetYear } = parseBillingPeriod(targetPeriod);

  // 1. Fetch source records
  let sourceRecords = await fetchRemoteMonthlyRentRecords(sourcePeriod);
  if (!sourceRecords || sourceRecords.length === 0) {
    sourceRecords = fallbackSourceItems || [];
  }

  if (sourceRecords.length === 0) {
    const err = new Error(`No source records found for ${sourcePeriod} to clone.`);
    console.warn(`[Supabase Clone Roster] ${err.message}`);
    return { success: false, count: 0, error: err };
  }

  // 2. Transform into target period records with reset payment statuses
  const targetRecords: MonthlyLedgerItem[] = sourceRecords.map((item) => {
    const totalPayable = item.flatRent + item.godownRent; // Electricity reset to 0
    const paymentStatus: PaymentStatus =
      item.tenantName === 'Owner Occupied' || item.tenantName === 'Vacant Flat' ? 'N/A' : 'Not Paid';

    return {
      id: `led-${item.flatId.toLowerCase()}-${targetPeriod}`,
      unitId: item.unitId || `u-${item.flatId}`,
      flatId: item.flatId,
      blockName: item.blockName,
      tenantId: item.tenantId,
      tenantName: item.tenantName,
      tenantPhone: item.tenantPhone,
      entryDate: item.entryDate,
      billingPeriod: targetPeriod,
      month: targetMonth,
      year: targetYear,
      advancePayment: item.advancePayment,
      advanceStatus: item.advanceStatus || (item.advancePayment > 0 ? 'Paid' : 'Not Paid'),
      advanceDate: item.advanceDate,
      flatRent: item.flatRent,
      rentStatus: 'Not Paid',
      rentPaymentDate: undefined,
      electricityBill: 0,
      electricityStatus: 'N/A',
      electricityDate: undefined,
      parkingRent: 0,
      godownRent: item.godownRent || 0,
      totalPayable,
      totalPaid: 0,
      totalDue: totalPayable,
      paymentStatus,
      adjustedFromAdvance: 0,
      lastPaymentDate: undefined,
      notes: '',
    };
  });

  const result = await upsertBatchRemoteMonthlyRentRecords(targetRecords);
  if (result.success) {
    console.log(
      `[Supabase Clone OK] Cloned ${result.count} tenant records from ${sourcePeriod} into billing_period = "${targetPeriod}" with reset payment statuses.`
    );
  }
  return result;
}

/**
 * Delete a specific monthly rent record from remote Supabase PostgreSQL
 */
export async function deleteRemoteMonthlyRentRecord(
  unitId: string,
  billingPeriod: string
): Promise<{ success: boolean; error?: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: new Error('Supabase client not configured.') };

  try {
    const targetCol = await resolvePeriodColumn(supabase);
    const { error } = await supabase
      .from('monthly_rent_records')
      .delete()
      .match({ unit_id: unitId, [targetCol]: billingPeriod });

    if (error) {
      console.warn(`[Supabase Delete Notice] Error deleting record for unit ${unitId} in ${billingPeriod}:`, error.message);
      return { success: false, error };
    }
    console.log(`[Supabase Delete OK] Deleted record for unit ${unitId} in ${billingPeriod}.`);
    return { success: true };
  } catch (err: any) {
    console.warn(`[Supabase Delete Exception]`, err?.message || err);
    return { success: false, error: err };
  }
}

/**
 * Secondary fallback to legacy monthly_rent_charges if monthly_rent_records table isn't migrated
 */
async function fetchRemoteLedgerFallback(
  month: number,
  year: number
): Promise<MonthlyLedgerItem[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('monthly_rent_charges')
      .select('*')
      .eq('month', month)
      .eq('year', year);

    if (error || !data) return null;

    const billingPeriod = formatBillingPeriod(month, year);
    return data.map((item: any) => ({
      id: item.id,
      unitId: item.unit_id,
      flatId: item.flat_id,
      blockName: item.block_name,
      tenantId: item.tenant_id || '',
      tenantName: item.tenant_name || 'Resident',
      tenantPhone: item.tenant_phone || '',
      entryDate: item.entry_date || '2026-01-01',
      billingPeriod,
      month: item.month,
      year: item.year,
      advancePayment: Number(item.advance_payment || 0),
      flatRent: Number(item.flat_rent || 0),
      electricityBill: Number(item.electricity_bill || 0),
      parkingRent: Number(item.parking_rent || 0),
      godownRent: Number(item.godown_rent || 0),
      totalPayable: Number(item.total_payable || 0),
      totalPaid: Number(item.total_paid || 0),
      totalDue: Number(item.total_due || 0),
      paymentStatus: item.payment_status || 'Not Paid',
      adjustedFromAdvance: Number(item.adjusted_from_advance || 0),
      lastPaymentDate: item.last_payment_date,
      notes: item.notes,
    }));
  } catch {
    return null;
  }
}

/**
 * Legacy alias for backwards compatibility
 */
export async function fetchRemoteLedger(
  month: number,
  year: number
): Promise<MonthlyLedgerItem[] | null> {
  const period = formatBillingPeriod(month, year);
  return fetchRemoteMonthlyRentRecords(period);
}

/**
 * Call privileged RPC to provision a new tenant
 */
export async function rpcProvisionTenant(params: {
  flatId: string;
  fullName: string;
  email: string;
  phone: string;
  nidNumber: string;
  tempPassword: string;
  entryDate: string;
  requiredAdvance: number;
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: 'Supabase client not configured.' };

  try {
    const { data, error } = await supabase.rpc('provision_tenant_account', {
      p_flat_id: params.flatId,
      p_full_name: params.fullName,
      p_email: params.email,
      p_phone: params.phone,
      p_nid_number: params.nidNumber,
      p_temp_password: params.tempPassword,
      p_entry_date: params.entryDate,
      p_required_advance: params.requiredAdvance,
    });

    if (error) {
      console.error('[Supabase RLS/Error] provision_tenant_account RPC error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: `Account provisioned for Flat ${params.flatId}` };
  } catch (err: any) {
    console.error('[Supabase Exception] provision_tenant_account exception:', err);
    return { success: false, message: err?.message || 'RPC invocation failed' };
  }
}

/**
 * Call privileged RPC to reset a user password
 */
export async function rpcAdminResetPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, message: 'Supabase client not configured.' };

  try {
    const { data, error } = await supabase.rpc('admin_reset_user_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    });

    if (error) {
      console.error('[Supabase RLS/Error] admin_reset_user_password RPC error:', error);
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Password reset successfully in auth system.' };
  } catch (err: any) {
    console.error('[Supabase Exception] admin_reset_user_password exception:', err);
    return { success: false, message: err?.message || 'RPC invocation failed' };
  }
}

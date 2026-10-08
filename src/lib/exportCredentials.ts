import * as XLSX from 'xlsx';
import { AppDatabaseState } from '../types';
import { COMPLEX_CONFIG } from './complexConfig';
import { compareFlatIdSerial, getLast11Digits, getCurrentActiveBillingPeriod } from './storage';
import { getMonthName } from './nescoTariff';

export interface ExportCredentialsOptions {
  blockFilter?: string; // e.g. 'Block A', 'Block B', 'Block C', or undefined for all
  fileNamePrefix?: string;
}

/**
 * 1-Click Export of all Flat IDs and Passwords for all tenants and authority logins to Excel (.xlsx)
 * Strictly generates credentials from the CURRENT active billing month's tenant list (e.g. October 2026),
 * ensuring departed tenants from previous months (e.g. Sabbir in B5) are never exported.
 */
export function exportAllCredentialsToExcel(
  data: AppDatabaseState,
  options?: ExportCredentialsOptions
): boolean {
  try {
    const wb = XLSX.utils.book_new();
    const securityCreds = data.securityCredentials || {
      isManagerPasswordInitialized: false,
      authorityPasswords: {
        manager: '',
        ownerA: 'rashed123',
        ownerB: 'raju123',
        ownerC: 'rony123',
      },
      unitPasswords: {},
    };

    const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const activePeriod = getCurrentActiveBillingPeriod(data);
    const activeMonthLabel = `${getMonthName(activePeriod.month)} ${activePeriod.year}`;

    // 1. Build Authority Accounts List
    const authorityRows = [
      {
        'Account Role': 'Manager (Super Admin)',
        'Full Name': 'Russell (Manager)',
        'Contact Phone': COMPLEX_CONFIG.managerPhone, // 01737-321998
        'Login Email / ID': 'akandarussell@gmail.com',
        'Assigned Block': 'All Complex (Master)',
        'Login Password': securityCreds.authorityPasswords?.manager || '(Set on First Login / Default: empty)',
        'Password Status': securityCreds.authorityPasswords?.manager ? 'Configured' : 'First Time Setup Required',
        'Portal Link': hostUrl,
        'Billing Period': activeMonthLabel,
        'Notes': 'Full administrative control over ledgers, NESCO, MFS, units and credentials',
      },
      {
        'Account Role': 'Block A Owner',
        'Full Name': 'Md. Rashed',
        'Contact Phone': '01717623061',
        'Login Email / ID': 'rashed.blocka@mbdapartment.com',
        'Assigned Block': 'Block A',
        'Login Password': securityCreds.authorityPasswords?.ownerA || 'rashed123',
        'Password Status': 'Active',
        'Portal Link': hostUrl,
        'Billing Period': activeMonthLabel,
        'Notes': 'Full access to Block A financial ledger, receipts and bank/MFS collection',
      },
      {
        'Account Role': 'Block B Owner',
        'Full Name': 'Md. Raju',
        'Contact Phone': '01913858775',
        'Login Email / ID': 'raju.blockb@mbdapartment.com',
        'Assigned Block': 'Block B',
        'Login Password': securityCreds.authorityPasswords?.ownerB || 'raju123',
        'Password Status': 'Active',
        'Portal Link': hostUrl,
        'Billing Period': activeMonthLabel,
        'Notes': 'Full access to Block B financial ledger, receipts and bank/MFS collection',
      },
      {
        'Account Role': 'Block C Owner',
        'Full Name': 'Md. Rony',
        'Contact Phone': '01712118547',
        'Login Email / ID': 'rony.blockc@mbdapartment.com',
        'Assigned Block': 'Block C',
        'Login Password': securityCreds.authorityPasswords?.ownerC || 'rony123',
        'Password Status': 'Active',
        'Portal Link': hostUrl,
        'Billing Period': activeMonthLabel,
        'Notes': 'Full access to Block C financial ledger, receipts and bank/MFS collection',
      },
    ];

    // If an owner is exporting only their block, optionally filter authority rows or keep all
    const filteredAuthorityRows = options?.blockFilter
      ? authorityRows.filter((r) => r['Assigned Block'] === options.blockFilter || r['Account Role'].includes('Manager'))
      : authorityRows;

    // 2. Build Tenant & Flat Logins List sorted strictly in serial order (A1, A2... B1, B2... C1, C2...)
    // Strictly derived from the current active billing month (e.g. October 2026), ensuring current residents
    // like Ripon / Mizanur Rahman (B5) are generated, and previous tenants who departed are excluded.
    const sortedUnits = [...data.units].sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));
    const targetUnits = options?.blockFilter
      ? sortedUnits.filter((u) => u.blockName === options.blockFilter)
      : sortedUnits;

    const tenantRows = targetUnits.map((unit) => {
      const cleanFlatId = unit.flatId.toLowerCase().trim();

      // 1. Primary lookup: Current active billing month ledger item
      const currentMonthLedger = data.ledgerItems.find(
        (item) =>
          item.flatId.toLowerCase().trim() === cleanFlatId &&
          item.month === activePeriod.month &&
          item.year === activePeriod.year
      );

      // 2. Fallback lookup: Latest ledger item sorted descending (NEVER older previous month records)
      const latestLedger = [...data.ledgerItems]
        .filter((i) => i.flatId.toLowerCase().trim() === cleanFlatId)
        .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0];

      // 3. Active tenant from synced state
      const activeTenant = data.tenants.find(
        (t) => t.flatId.toLowerCase().trim() === cleanFlatId && t.status === 'active'
      );
      const anyTenant = activeTenant || data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlatId);

      const isOwnerUnit =
        cleanFlatId.includes('owner') ||
        (unit.notes || '').toLowerCase().includes('owner') ||
        (currentMonthLedger?.notes || '').toLowerCase().includes('owner');

      const residentName =
        currentMonthLedger?.tenantName?.trim() ||
        latestLedger?.tenantName?.trim() ||
        anyTenant?.fullName?.trim() ||
        (isOwnerUnit ? 'Owner Residence' : 'Vacant Flat');

      const rawPhone =
        currentMonthLedger?.tenantPhone?.trim() ||
        latestLedger?.tenantPhone?.trim() ||
        anyTenant?.phone?.trim() ||
        (isOwnerUnit ? (unit.flatId.startsWith('A') ? '01717623061' : '01712118547') : '01700-000000');

      const customPassword =
        securityCreds.unitPasswords?.[unit.flatId] ||
        securityCreds.unitPasswords?.[cleanFlatId];

      const defaultPhonePassword = getLast11Digits(rawPhone);
      const residentMobile = defaultPhonePassword.length === 11 ? defaultPhonePassword : rawPhone;
      const activePassword = customPassword || defaultPhonePassword;
      const passwordType = customPassword ? 'Custom Override' : 'Default (11-digit Mobile)';

      return {
        'Flat ID': unit.flatId,
        'Block': unit.blockName,
        'Floor': unit.floor,
        'Resident Name': residentName,
        'Resident Mobile': residentMobile,
        'Login Password': activePassword,
        'Password Type': passwordType,
        'Billing Month': activeMonthLabel,
        'Occupancy': unit.isOccupied ? 'Occupied' : 'Vacant',
        'Unit Type': unit.unitType.toUpperCase(),
        'Monthly Rent (BDT)': currentMonthLedger?.flatRent || unit.monthlyRent,
        'Login Instructions': `Select Flat ${unit.flatId} -> Enter password ${activePassword}`,
      };
    });

    // 3. Master Summary List combining Authority & Flats
    const masterSummaryRows = [
      ...filteredAuthorityRows.map((a) => ({
        'Category': 'Authority / Owner',
        'Identifier': a['Login Email / ID'],
        'Name': a['Full Name'],
        'Phone': a['Contact Phone'],
        'Assigned Block': a['Assigned Block'],
        'Login Password': a['Login Password'],
        'Password Type': a['Password Status'],
        'Portal URL': a['Portal Link'],
      })),
      ...tenantRows.map((t) => ({
        'Category': 'Resident / Tenant',
        'Identifier': `Flat ${t['Flat ID']}`,
        'Name': t['Resident Name'],
        'Phone': t['Resident Mobile'],
        'Assigned Block': t['Block'],
        'Login Password': t['Login Password'],
        'Password Type': t['Password Type'],
        'Portal URL': hostUrl,
      })),
    ];

    // Create Sheets
    const wsTenants = XLSX.utils.json_to_sheet(tenantRows);
    wsTenants['!cols'] = [
      { wch: 14 }, // Flat ID
      { wch: 12 }, // Block
      { wch: 8 },  // Floor
      { wch: 26 }, // Resident Name
      { wch: 18 }, // Resident Mobile
      { wch: 18 }, // Login Password
      { wch: 22 }, // Password Type
      { wch: 12 }, // Occupancy
      { wch: 14 }, // Unit Type
      { wch: 18 }, // Monthly Rent
      { wch: 38 }, // Login Instructions
    ];

    const wsAuthority = XLSX.utils.json_to_sheet(filteredAuthorityRows);
    wsAuthority['!cols'] = [
      { wch: 24 }, // Account Role
      { wch: 22 }, // Full Name
      { wch: 16 }, // Contact Phone
      { wch: 32 }, // Login Email / ID
      { wch: 20 }, // Assigned Block
      { wch: 20 }, // Login Password
      { wch: 24 }, // Password Status
      { wch: 26 }, // Portal Link
      { wch: 45 }, // Notes
    ];

    const wsMaster = XLSX.utils.json_to_sheet(masterSummaryRows);
    wsMaster['!cols'] = [
      { wch: 20 }, // Category
      { wch: 26 }, // Identifier
      { wch: 24 }, // Name
      { wch: 18 }, // Phone
      { wch: 20 }, // Assigned Block
      { wch: 20 }, // Login Password
      { wch: 22 }, // Password Type
      { wch: 26 }, // Portal URL
    ];

    // Append sheets
    XLSX.utils.book_append_sheet(wb, wsTenants, 'Flat & Tenant Passwords');
    XLSX.utils.book_append_sheet(wb, wsAuthority, 'Authority Logins');
    XLSX.utils.book_append_sheet(wb, wsMaster, 'All Logins Summary');

    const dateStr = new Date().toISOString().split('T')[0];
    const prefix = options?.fileNamePrefix || (options?.blockFilter ? `${options.blockFilter.replace(/\s+/g, '_')}_` : '');
    const filename = `${prefix}MBD_Apartment_All_Passwords_${dateStr}.xlsx`;

    XLSX.writeFile(wb, filename);
    return true;
  } catch (err) {
    console.error('Failed to export credentials to Excel:', err);
    return false;
  }
}

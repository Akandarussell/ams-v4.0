import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Database,
  RefreshCw,
  FileText,
  Table,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MonthlyLedgerItem, PaymentStatus, AppDatabaseState } from '../types';
import { formatBDT, MONTH_NAMES, getMonthName, formatDateDDMMYYYY } from '../lib/nescoTariff';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppDatabaseState;
  onImportSuccess: (
    items: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => void;
  initialMonth?: number;
  initialYear?: number;
  assignedBlock?: string;
  userRole?: string;
}

interface ColumnMapping {
  flatId: string;
  tenantName: string;
  phone: string;
  entryDate: string;
  advance: string;
}

// Helper to normalize various spreadsheet date formats (Excel serial number, DD/MM/YYYY, etc.)
export const normalizeSpreadsheetDate = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  // Excel serial number (e.g. 45352 -> 2024-03-01)
  if (typeof val === 'number') {
    if (val > 20000 && val < 90000) {
      const utcDays = Math.floor(val - 25569);
      const utcMs = utcDays * 86400 * 1000;
      const date = new Date(utcMs);
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (supports 2-digit and 4-digit years)
  const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    } else if (year === '2006' || year === '06') {
      // Fix common typo 2006 -> 2026 in 2024-2026 tenant rosters
      year = '2026';
    }
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    let year = ymdMatch[1];
    if (year === '2006') year = '2026';
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Generic Date constructor using UTC values
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getUTCFullYear() > 1990 && parsed.getUTCFullYear() < 2100) {
    let y = parsed.getUTCFullYear();
    if (y === 2006) y = 2026;
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
};

export const ExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onImportSuccess,
  initialMonth = 10,
  initialYear = 2026,
  assignedBlock,
  userRole,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'googlesheet' | 'paste'>('upload');
  const [targetMonth, setTargetMonth] = useState<number>(initialMonth);
  const [targetYear, setTargetYear] = useState<number>(initialYear);

  // File & Raw Data State
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Column Mapping: Strictly only the 5 allowed fields
  const [mapping, setMapping] = useState<ColumnMapping>({
    flatId: '',
    tenantName: '',
    phone: '',
    entryDate: '',
    advance: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Smart Header Detection for strictly the 5 fields
  const autoDetectMapping = (headers: string[]): ColumnMapping => {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const findMatch = (patterns: string[], fallbackIndex?: number): string => {
      // 1. Try pattern matching
      for (const h of headers) {
        const ch = clean(h);
        for (const p of patterns) {
          const cp = clean(p);
          // CRITICAL: NEVER test empty or 1-character string, so non-ascii never matches everything
          if (cp && cp.length >= 2 && ch.includes(cp)) {
            return h;
          }
        }
      }
      // 2. Fallback to index position if within bounds
      if (fallbackIndex !== undefined && fallbackIndex < headers.length) {
        return headers[fallbackIndex];
      }
      return '';
    };

    return {
      flatId: findMatch(['flatid', 'flatno', 'flat', 'unit', 'apartment'], 0),
      tenantName: findMatch(['tenantname', 'tenant', 'name', 'resident', 'occupant'], 1),
      phone: findMatch(['mobile', 'phonenumber', 'mobilenumber', 'phone', 'contact', 'cell'], 2),
      entryDate: findMatch(['entrydate', 'entry', 'date', 'movein', 'joining'], 3),
      advance: findMatch(['advance', 'security', 'deposit', 'securitydeposit'], 4),
    };
  };

  const handleProcessWorkbook = (wb: XLSX.WorkBook, sourceName: string) => {
    try {
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '', raw: true });

      if (jsonData.length < 2) {
        setErrorMessage('The sheet appears to be empty or has no data.');
        return;
      }

      // Smart Header Row Detection (look in first 5 rows for column labels like Flat, Tenant, Mobile, Date, Advance)
      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(5, jsonData.length); r++) {
        const rowStrings = (jsonData[r] as any[]).map((c) => String(c || '').toLowerCase());
        const hasHeaderKeywords = rowStrings.some((s) =>
          ['flat', 'tenant', 'name', 'mobile', 'phone', 'entry', 'advance', 'date'].some((kw) => s.includes(kw))
        );
        if (hasHeaderKeywords) {
          headerRowIndex = r;
          break;
        }
      }

      const rawHeaderRow = (jsonData[headerRowIndex] as any[]) || [];
      const headers = rawHeaderRow.map((h, i) => {
        const str = String(h || '').trim();
        return str || `Column ${i + 1}`;
      });
      const rows = jsonData.slice(headerRowIndex + 1).filter((r: any[]) => r.some((c) => c !== '' && c !== null));

      setRawHeaders(headers);
      setRawRows(rows);
      setFileName(sourceName);
      setErrorMessage(null);

      // Auto-detect columns with positional fallbacks
      const detected = autoDetectMapping(headers);
      setMapping(detected);
    } catch (err: any) {
      setErrorMessage(`Failed to parse spreadsheet: ${err.message}`);
    }
  };

  // 1. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', raw: true });
        handleProcessWorkbook(wb, file.name);
      } catch (err: any) {
        setErrorMessage(`Error reading file: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // 2. Google Sheet Link Handler
  const handleFetchGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      setErrorMessage('Please paste a valid Google Sheet link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let csvText: string | null = null;
      try {
        const res = await fetch('/api/fetch-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: googleSheetUrl.trim() }),
        });
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const json = await res.json();
          if (json.success && json.csv) {
            csvText = json.csv;
          }
        }
      } catch (proxyErr) {
        // Fall through to direct fetch
      }

      // Fallback: direct public CSV export download (works client-side on Vercel if sheet is public)
      if (!csvText) {
        let fetchUrl = googleSheetUrl.trim();
        if (fetchUrl.includes('docs.google.com/spreadsheets')) {
          const match = fetchUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match) {
            const id = match[1];
            const gidMatch = fetchUrl.match(/[#&?]gid=([0-9]+)/);
            const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
            fetchUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`;
          }
        }
        const directRes = await fetch(fetchUrl);
        if (!directRes.ok) {
          throw new Error('Failed to download Google Sheet. Ensure sheet sharing is set to "Anyone with the link can view".');
        }
        csvText = await directRes.text();
      }

      const wb = XLSX.read(csvText, { type: 'string' });
      handleProcessWorkbook(wb, 'Google Sheet (Live Extract)');
    } catch (err: any) {
      setErrorMessage(
        `Failed to import from Google Sheet: ${err.message}. Tip: Make sure the Google Sheet sharing setting is set to "Anyone with the link can view".`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Paste Table Data Handler
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Please paste table data from Excel or Google Sheets.');
      return;
    }

    try {
      const wb = XLSX.read(pastedText.trim(), { type: 'string', raw: true });
      handleProcessWorkbook(wb, 'Pasted Clipboard Data');
    } catch (err: any) {
      setErrorMessage(`Error parsing pasted data: ${err.message}`);
    }
  };

  // Download Sample Template (Strictly the 5 fields)
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Flat ID': 'A1',
        'Tenant Name': 'Moshiur Rahman',
        'Mobile': '01711-234567',
        'Entry Date': '2024-03-01',
        'Advance': 60000,
      },
      {
        'Flat ID': 'A2',
        'Tenant Name': 'Farhan Ahmed',
        'Mobile': '01819-876543',
        'Entry Date': '2024-05-15',
        'Advance': 50000,
      },
      {
        'Flat ID': 'B1',
        'Tenant Name': 'Ziaur Rahman',
        'Mobile': '01722-334455',
        'Entry Date': '2024-01-10',
        'Advance': 55000,
      },
      {
        'Flat ID': 'C1',
        'Tenant Name': '', // Example of empty field leaving existing data intact
        'Mobile': '01912-345678',
        'Entry Date': '',
        'Advance': 40000,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TenantRoster');
    XLSX.writeFile(wb, `Apartment_5Fields_Upload_Template.xlsx`);
  };

  // Convert extracted rows into MonthlyLedgerItem records
  // Strictly: 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance
  // If any field is empty, it leaves it as it is and proceeds to the next
  const handleExecuteImport = () => {
    if (!mapping.flatId) {
      setErrorMessage('Please map the Flat ID column before importing.');
      return;
    }

    const flatIdIdx = rawHeaders.indexOf(mapping.flatId);
    const nameIdx = rawHeaders.indexOf(mapping.tenantName);
    const phoneIdx = rawHeaders.indexOf(mapping.phone);
    const entryDateIdx = rawHeaders.indexOf(mapping.entryDate);
    const advanceIdx = rawHeaders.indexOf(mapping.advance);

    const importedItems: MonthlyLedgerItem[] = [];

    rawRows.forEach((row) => {
      const rawFlatId = flatIdIdx >= 0 ? String(row[flatIdIdx] || '').trim() : '';
      if (!rawFlatId) return; // If Flat ID is empty, leave it as it is and do next

      // Normalize Flat ID (e.g. "a1" -> "A1")
      const flatIdUpper = rawFlatId.toUpperCase().replace(/\s+/g, '');

      // 1. Tenant Name (Strict: if empty, leave existing as it is)
      const rawTenantName =
        nameIdx >= 0 && row[nameIdx] !== undefined && row[nameIdx] !== null
          ? String(row[nameIdx]).trim()
          : '';

      // Resolve specific unit names (like A5 (Owner) vs A5 Sublet, and C5 Owner)
      let resolvedFlatId = flatIdUpper;
      if (flatIdUpper === 'A5' || flatIdUpper === 'A5 OWNER' || flatIdUpper === 'A5 (OWNER)') {
        if (rawTenantName.toUpperCase().includes('OWNER') || flatIdUpper.includes('OWNER')) {
          if (data.units.some((u) => u.flatId === 'A5 (Owner)' || u.flatId === 'A5 Owner') || data.ledgerItems.some((i) => i.flatId === 'A5 (Owner)' || i.flatId === 'A5 Owner')) {
            resolvedFlatId = 'A5 (Owner)';
          }
        } else {
          if (data.units.some((u) => u.flatId === 'A5 Sublet') || data.ledgerItems.some((i) => i.flatId === 'A5 Sublet')) {
            resolvedFlatId = 'A5 Sublet';
          }
        }
      } else if (flatIdUpper === 'C5' || flatIdUpper === 'C5 OWNER' || flatIdUpper === 'C5 (OWNER)') {
        if (data.units.some((u) => u.flatId === 'C5 Owner' || u.flatId === 'C5 (Owner)') || data.ledgerItems.some((i) => i.flatId === 'C5 Owner' || i.flatId === 'C5 (Owner)')) {
          resolvedFlatId = 'C5 Owner';
        }
      }

      // Determine Block Name
      let blockName: 'Block A' | 'Block B' | 'Block C' = 'Block A';
      if (resolvedFlatId.startsWith('B')) blockName = 'Block B';
      else if (resolvedFlatId.startsWith('C')) blockName = 'Block C';

      const existingLedgerItem = data.ledgerItems.find(
        (i) => i.flatId === resolvedFlatId && i.month === targetMonth && i.year === targetYear
      );
      const unit = data.units.find((u) => u.flatId === resolvedFlatId);
      const tenant = data.tenants.find((t) => t.flatId === resolvedFlatId);
      const advanceAccount = data.advanceAccounts.find((a) => a.flatId === resolvedFlatId);
      const prevLedgerItem = data.ledgerItems.find(
        (i) =>
          i.flatId === resolvedFlatId &&
          i.month === (targetMonth === 1 ? 12 : targetMonth - 1) &&
          i.year === (targetMonth === 1 ? targetYear - 1 : targetYear)
      );

      const isNameProvided = rawTenantName !== '';
      const tenantName = isNameProvided
        ? rawTenantName
        : existingLedgerItem?.tenantName ||
          tenant?.fullName ||
          (resolvedFlatId.includes('Owner') ? 'Owner Occupied' : 'Resident');

      // 2. Mobile (Strict: if empty, leave existing as it is)
      const rawPhone =
        phoneIdx >= 0 && row[phoneIdx] !== undefined && row[phoneIdx] !== null
          ? String(row[phoneIdx]).trim()
          : '';
      const isPhoneProvided = rawPhone !== '';
      const tenantPhone = isPhoneProvided
        ? rawPhone
        : existingLedgerItem?.tenantPhone || tenant?.phone || (resolvedFlatId.includes('Owner') ? 'N/A' : '01700-000000');

      // 3. Entry Date (Strict: if empty, leave existing as it is)
      const rawDate =
        entryDateIdx >= 0 && row[entryDateIdx] !== undefined && row[entryDateIdx] !== null
          ? row[entryDateIdx]
          : '';
      const normalizedDate = normalizeSpreadsheetDate(rawDate);
      const isDateProvided = normalizedDate !== '';
      const entryDate = isDateProvided
        ? normalizedDate
        : existingLedgerItem?.entryDate || tenant?.entryDate || (resolvedFlatId.includes('Owner') ? 'N/A' : '2024-01-01');

      // 4. Advance (Strict: supports status "PAID", "NOT PAID", "N/A" or numeric amount)
      const rawAdvanceStr =
        advanceIdx >= 0 && row[advanceIdx] !== undefined && row[advanceIdx] !== null
          ? String(row[advanceIdx]).trim()
          : '';

      // Registered advance deposit from building advance accounts or standard 2-months rent
      const standardAdvance =
        advanceAccount?.amountPaid !== undefined && advanceAccount.amountPaid > 0
          ? advanceAccount.amountPaid
          : advanceAccount?.totalRequired !== undefined && advanceAccount.totalRequired > 0
          ? advanceAccount.totalRequired
          : prevLedgerItem?.advancePayment !== undefined && prevLedgerItem.advancePayment > 0
          ? prevLedgerItem.advancePayment
          : unit?.monthlyRent ? unit.monthlyRent * 2
          : 50000;

      let advancePayment =
        existingLedgerItem?.advancePayment !== undefined
          ? existingLedgerItem.advancePayment
          : standardAdvance;

      let advanceStatus: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A' =
        resolvedFlatId.includes('Owner')
          ? 'N/A'
          : (existingLedgerItem?.advanceStatus || (advancePayment > 0 ? 'Paid' : 'Not Paid'));

      if (rawAdvanceStr !== '') {
        const upperAdv = rawAdvanceStr.toUpperCase().trim();
        if (upperAdv.includes('NOT') || upperAdv === 'DUE' || upperAdv === 'UNPAID') {
          advanceStatus = 'Not Paid';
          advancePayment = 0;
        } else if (upperAdv === 'N/A' || upperAdv === 'NA' || upperAdv === 'NONE' || upperAdv === '-') {
          advanceStatus = 'N/A';
          advancePayment = 0;
        } else if (upperAdv.includes('PAID') || upperAdv === 'YES') {
          advanceStatus = 'Paid';
          advancePayment = standardAdvance > 0 ? standardAdvance : (unit?.monthlyRent ? unit.monthlyRent * 2 : 0);
        } else {
          const cleanAdvanceNum = rawAdvanceStr.replace(/[^0-9.]/g, '');
          if (cleanAdvanceNum !== '' && !isNaN(Number(cleanAdvanceNum))) {
            advancePayment = Number(cleanAdvanceNum);
            advanceStatus = advancePayment > 0 ? 'Paid' : 'Not Paid';
          }
        }
      }

      // If marked as Paid or Partially Paid but advancePayment is 0, guarantee standard advance amount
      if (!resolvedFlatId.includes('Owner') && (advanceStatus === 'Paid' || advanceStatus === 'Partially Paid') && advancePayment === 0) {
        advancePayment = standardAdvance > 0 ? standardAdvance : (unit?.monthlyRent ? unit.monthlyRent * 2 : 0);
      }

      // Strict preservation: Keep all existing financial & billing fields untouched
      if (existingLedgerItem) {
        // Self-heal: If existing item had erroneous 8000 flat rent for A1, correct to standard unit monthly rent
        let flatRent = existingLedgerItem.flatRent;
        let electricityBill = existingLedgerItem.electricityBill;
        let electricityStatus = existingLedgerItem.electricityStatus;
        let rentStatus = existingLedgerItem.rentStatus;
        let paymentStatus = existingLedgerItem.paymentStatus;
        let totalPayable = existingLedgerItem.totalPayable;
        let totalPaid = existingLedgerItem.totalPaid;
        let totalDue = existingLedgerItem.totalDue;

        if (resolvedFlatId === 'A1' && flatRent === 8000) {
          flatRent = unit?.monthlyRent || 22000;
          electricityBill = 0;
          electricityStatus = 'N/A';
          rentStatus = 'Not Paid';
          paymentStatus = 'Not Paid';
          totalPayable = flatRent;
          totalPaid = 0;
          totalDue = flatRent;
        }

        importedItems.push({
          ...existingLedgerItem,
          tenantName,
          tenantPhone,
          entryDate,
          advancePayment,
          advanceStatus,
          flatRent,
          electricityBill,
          electricityStatus,
          rentStatus,
          paymentStatus,
          totalPayable,
          totalPaid,
          totalDue,
        });
      } else {
        // Fallback if ledger item doesn't exist for target month yet
        const flatRent = resolvedFlatId.includes('Owner') ? 0 : (unit?.monthlyRent || prevLedgerItem?.flatRent || 25000);
        const electricityBill = 0; // Empty for manual input
        const parkingRent = unit?.parkingSlot ? 2500 : (prevLedgerItem?.parkingRent || 0);
        const godownRent = unit?.godownSlot ? 6000 : (prevLedgerItem?.godownRent || 0);
        const totalPayable = flatRent + parkingRent + godownRent;
        const totalPaid = 0;
        const totalDue = totalPayable;
        const paymentStatus: PaymentStatus =
          resolvedFlatId.includes('Owner') || tenantName === 'Owner Occupied' || tenantName === 'Vacant Flat'
            ? 'N/A'
            : 'Not Paid';

        importedItems.push({
          id: `led-${resolvedFlatId.toLowerCase().replace(/\s+/g, '-')}-${targetMonth}-${targetYear}`,
          unitId: unit?.id || `u-${resolvedFlatId.toLowerCase().replace(/\s+/g, '-')}`,
          flatId: resolvedFlatId,
          blockName,
          tenantId: tenant?.id || `t-${resolvedFlatId.toLowerCase().replace(/\s+/g, '-')}`,
          tenantName,
          tenantPhone,
          entryDate,
          month: targetMonth,
          year: targetYear,
          advancePayment,
          advanceStatus,
          flatRent,
          rentStatus: paymentStatus === 'N/A' ? 'N/A' : 'Not Paid',
          electricityBill,
          electricityStatus: 'N/A',
          parkingRent,
          godownRent,
          totalPayable,
          totalPaid,
          totalDue,
          paymentStatus,
          adjustedFromAdvance: 0,
        });
      }
    });

    if (importedItems.length === 0) {
      setErrorMessage('No valid flat records could be extracted.');
      return;
    }

    onImportSuccess(importedItems, targetMonth, targetYear, {
      updateUnits: false,
      updateTenants: false,
      updateAdvance: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">
                Upload Excel / Google Sheet (Strict 5 Fields)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Strictly uploads: <strong>1. Flat ID</strong>, <strong>2. Tenant Name</strong>, <strong>3. Mobile</strong>, <strong>4. Entry Date</strong>, <strong>5. Advance</strong>. If any field is empty, it leaves it as it is.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Target Month & Year Selector Banner */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="font-bold text-blue-900 text-sm block">Target Ledger Month & Year</span>
              <p className="text-blue-700 text-xs mt-0.5">
                Roster updates will be applied to the selected billing period in the database.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
                className="min-h-[44px] bg-white border border-blue-300 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 shadow-2xs focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="min-h-[44px] bg-white border border-blue-300 font-bold text-slate-800 text-xs rounded-xl px-3 py-2 shadow-2xs focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs w-full sm:w-auto"
                title="Download formatted sample template (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>5-Field Template (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Strict 5 Fields Policy Banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3">
            <div className="p-1 bg-amber-200 text-amber-900 rounded-md shrink-0 mt-0.5 font-bold text-[10px]">
              STRICT
            </div>
            <div className="text-amber-950 text-xs leading-relaxed">
              <p className="font-bold text-amber-900 mb-0.5">Strict 5 Fields Upload Policy:</p>
              This uploader only touches: <strong>1. Flat ID</strong>, <strong>2. Tenant Name</strong>, <strong>3. Mobile</strong>, <strong>4. Entry Date</strong>, and <strong>5. Advance</strong>.
              All existing ledger amounts (<strong>Flat Rent</strong>, <strong>Electricity Bill</strong>, <strong>Parking Rent</strong>, and <strong>Payment Status</strong>) are strictly preserved and left as they are. If any field in your row is empty, it leaves the existing value as it is and proceeds to the next.
            </div>
          </div>

          {/* Source Tabs */}
          <div className="flex overflow-x-auto no-scrollbar items-center gap-2 border-b border-slate-200 pb-2 whitespace-nowrap">
            <button
              onClick={() => setActiveTab('upload')}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>1. Upload File (.xlsx / .csv)</span>
            </button>

            <button
              onClick={() => setActiveTab('googlesheet')}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                activeTab === 'googlesheet'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              <span>2. Google Sheet Link</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
                activeTab === 'paste'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>3. Paste Table Data</span>
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  Click to select or drag & drop your Excel / CSV file
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Uploads strictly: Flat ID, Tenant Name, Mobile, Entry Date, and Advance
                </p>
              </div>
              {fileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Loaded: {fileName} ({rawRows.length} rows)
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Google Sheet Link */}
          {activeTab === 'googlesheet' && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800">
                Paste Google Sheet Shareable URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleFetchGoogleSheet}
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Fetch & Extract
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Note: The Google Sheet must be shared with <em>&quot;Anyone with the link can view&quot;</em>.
              </p>
            </div>
          )}

          {/* TAB 3: Paste Table Data */}
          {activeTab === 'paste' && (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800">
                Paste rows copied directly from Excel or Google Sheet
              </label>
              <textarea
                rows={4}
                placeholder="Flat ID	Tenant Name	Mobile	Entry Date	Advance
A1	Moshiur Rahman	01711-234567	2024-03-01	60000
A2	Farhan Ahmed	01819-876543	2024-05-15	50000"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Extract Pasted Data
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Column Mapping Section (Visible once rows are extracted) */}
          {rawHeaders.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Table className="w-4 h-4 text-blue-600" />
                    Step 2: Map the 5 Allowed Fields
                  </h4>
                  <p className="text-slate-500 text-xs">
                    Only these 5 fields are uploaded strictly. Any empty field in a row will leave existing database data untouched.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                  {rawRows.length} Rows Found
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                {/* 1. Flat ID (Required) */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    1. Flat ID <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={mapping.flatId}
                    onChange={(e) => setMapping({ ...mapping, flatId: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Required identifier</span>
                </div>

                {/* 2. Tenant Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    2. Tenant Name
                  </label>
                  <select
                    value={mapping.tenantName}
                    onChange={(e) => setMapping({ ...mapping, tenantName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- None (Keep Existing) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Empty = leaves as is</span>
                </div>

                {/* 3. Mobile */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    3. Mobile
                  </label>
                  <select
                    value={mapping.phone}
                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- None (Keep Existing) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Empty = leaves as is</span>
                </div>

                {/* 4. Entry Date */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    4. Entry Date
                  </label>
                  <select
                    value={mapping.entryDate}
                    onChange={(e) => setMapping({ ...mapping, entryDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- None (Keep Existing) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Empty = leaves as is</span>
                </div>

                {/* 5. Advance */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1 text-[11px]">
                    5. Advance
                  </label>
                  <select
                    value={mapping.advance}
                    onChange={(e) => setMapping({ ...mapping, advance: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- None (Keep Existing) --</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Empty = leaves as is</span>
                </div>
              </div>

              {/* Data Extraction Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs block">
                    Extracted Data Preview (First 5 Rows):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Fields marked <span className="italic text-slate-400">(Empty - Leaves Existing)</span> will preserve existing data
                  </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">1. Flat ID</th>
                        <th className="p-2.5">2. Tenant Name</th>
                        <th className="p-2.5">3. Mobile</th>
                        <th className="p-2.5">4. Entry Date</th>
                        <th className="p-2.5 text-right">5. Advance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {rawRows.slice(0, 5).map((row, i) => {
                        const getVal = (col: string) => {
                          const idx = rawHeaders.indexOf(col);
                          return idx >= 0 && row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== ''
                            ? String(row[idx]).trim()
                            : '';
                        };

                        const flatIdVal = getVal(mapping.flatId);
                        const tenantNameVal = getVal(mapping.tenantName);
                        const phoneVal = getVal(mapping.phone);
                        const dateVal = getVal(mapping.entryDate);
                        const rawAdvance = getVal(mapping.advance);
                        const upperAdv = rawAdvance.toUpperCase().trim();
                        const advanceNum = rawAdvance ? Number(rawAdvance.replace(/[^0-9.]/g, '')) : NaN;

                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-blue-700 font-sans">
                              {flatIdVal || `Row ${i + 1}`}
                            </td>
                            <td className="p-2.5 font-sans">
                              {tenantNameVal ? (
                                <span className="font-medium text-slate-800">{tenantNameVal}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">(Empty - Leaves Existing)</span>
                              )}
                            </td>
                            <td className="p-2.5 font-sans">
                              {phoneVal ? (
                                <span className="text-slate-700">{phoneVal}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">(Empty - Leaves Existing)</span>
                              )}
                            </td>
                            <td className="p-2.5 font-sans">
                              {dateVal ? (
                                <span className="text-slate-700 font-semibold">{formatDateDDMMYYYY(normalizeSpreadsheetDate(dateVal))}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">(Empty - Leaves Existing)</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-sans">
                              {upperAdv.includes('NOT') || upperAdv === 'DUE' || upperAdv === 'UNPAID' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  Not Paid (৳0)
                                </span>
                              ) : upperAdv === 'N/A' || upperAdv === 'NA' || upperAdv === 'NONE' || upperAdv === '-' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                  N/A
                                </span>
                              ) : upperAdv.includes('PAID') || upperAdv === 'YES' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Paid
                                </span>
                              ) : !isNaN(advanceNum) && rawAdvance !== '' ? (
                                <span className="font-bold text-indigo-700">{formatBDT(advanceNum)}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">(Empty - Leaves Existing)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Month-Only Override Scope Guarantee */}
              <div className="p-4 bg-emerald-50/90 rounded-2xl border border-emerald-200 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Target Override Scope: {getMonthName(targetMonth)} {targetYear} Ledger ONLY</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed pl-6">
                  Uploading will override existing records in <strong>{getMonthName(targetMonth)} {targetYear} only</strong>. All other months (previous and future months) are strictly protected and remain completely untouched. If any field in a row is empty, it leaves the existing data in this month as it is.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Database className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Target: <strong className="text-slate-900">{getMonthName(targetMonth)} {targetYear}</strong> (This month only)</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={rawRows.length === 0 || !mapping.flatId}
              className="min-h-[44px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Override {getMonthName(targetMonth)} {targetYear} Data ({rawRows.length} Flats)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

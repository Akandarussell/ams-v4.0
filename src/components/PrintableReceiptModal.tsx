import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { PrintableReceipt } from '../types';
import { formatBDT, formatDateDDMMYYYY, getMonthName } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  receipt: PrintableReceipt | null;
  onClose: () => void;
}

// 12 Distinct, High-Contrast Monthly Color Themes from user template
const MONTH_THEMES: Record<string, { primary: string; dark: string; light: string; border: string; label: string }> = {
  january:   { primary: '#0284c7', dark: '#0369a1', light: '#f0f9ff', border: '#bae6fd', label: 'Sky Blue' },
  february:  { primary: '#c026d3', dark: '#86198f', light: '#fdf4ff', border: '#f5d0fe', label: 'Vibrant Fuchsia' },
  march:     { primary: '#16a34a', dark: '#15803d', light: '#f0fdf4', border: '#bbf7d0', label: 'Meadow Green' },
  april:     { primary: '#ca8a04', dark: '#854d0e', light: '#fefce8', border: '#fef08a', label: 'Sunny Gold' },
  may:       { primary: '#7c3aed', dark: '#5b21b6', light: '#f5f3ff', border: '#ddd6fe', label: 'Electric Violet' },
  june:      { primary: '#0891b2', dark: '#0e7490', light: '#ecfeff', border: '#a5f3fc', label: 'Ocean Cyan' },
  july:      { primary: '#ea580c', dark: '#c2410c', light: '#fff7ed', border: '#ffedd5', label: 'Vivid Orange' },
  august:    { primary: '#dc2626', dark: '#991b1b', light: '#fef2f2', border: '#fecaca', label: 'Ruby Red' },
  september: { primary: '#4338ca', dark: '#312e81', light: '#eef2ff', border: '#c7d2fe', label: 'Royal Cobalt' },
  october:   { primary: '#854d0e', dark: '#713f12', light: '#fefce8', border: '#fef08a', label: 'Warm Ochre' },
  november:  { primary: '#0d9488', dark: '#115e59', light: '#f0fdfa', border: '#99f6e4', label: 'Fresh Teal' },
  december:  { primary: '#1e293b', dark: '#0f172a', light: '#f8fafc', border: '#cbd5e1', label: 'Midnight Obsidian' },
};

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

export const PrintableReceiptModal: React.FC<Props> = ({ receipt, onClose }) => {
  const receiptWrapRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedThemeMonth, setSelectedThemeMonth] = useState<string>('september');

  // Detect month from receipt or default
  useEffect(() => {
    if (!receipt) return;

    if (receipt.monthName) {
      const lower = receipt.monthName.toLowerCase();
      if (MONTH_THEMES[lower]) {
        setSelectedThemeMonth(lower);
        return;
      }
    }

    if (receipt.paymentDate) {
      try {
        const parts = receipt.paymentDate.split('-');
        if (parts.length === 3) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            setSelectedThemeMonth(MONTH_KEYS[monthIdx]);
            return;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Check purpose for month names
    const purposeLower = (receipt.purpose || '').toLowerCase();
    for (const m of MONTH_KEYS) {
      if (purposeLower.includes(m)) {
        setSelectedThemeMonth(m);
        return;
      }
    }

    // Default to current month
    const curMonth = MONTH_KEYS[new Date().getMonth()];
    setSelectedThemeMonth(curMonth);
  }, [receipt]);

  if (!receipt) return null;

  const currentTheme = MONTH_THEMES[selectedThemeMonth] || MONTH_THEMES.september;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = async () => {
    if (!receiptWrapRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(receiptWrapRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const cleanFlat = (receipt.flatId || 'flat').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanReceiptNo = (receipt.receiptNumber || 'receipt').replace(/[^a-zA-Z0-9]/g, '_');
      const link = document.createElement('a');
      link.download = `Receipt_${cleanFlat}_${selectedThemeMonth}_${cleanReceiptNo}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate PNG receipt:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!receiptWrapRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(receiptWrapRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const cleanPhone = (receipt.tenantPhone || '').replace(/\D/g, '');
      let formattedPhone = cleanPhone;
      if (cleanPhone.startsWith('0')) {
        formattedPhone = '88' + cleanPhone;
      } else if (cleanPhone && !cleanPhone.startsWith('880')) {
        formattedPhone = '880' + cleanPhone;
      }

      const textMsg = `Hello ${receipt.tenantName}, here is your official payment receipt for Flat ${receipt.flatId} (${receipt.blockName || 'Block A'}). Total Paid: ${formatBDT(receipt.amount)}. Thank you! - ${COMPLEX_CONFIG.name}`;

      canvas.toBlob(async (blob) => {
        if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'receipt.png', { type: 'image/png' })] })) {
          try {
            const file = new File([blob], `Receipt_${receipt.flatId}_${selectedThemeMonth}.png`, { type: 'image/png' });
            await navigator.share({
              files: [file],
              title: 'Official Payment Receipt',
              text: textMsg,
            });
            setIsExporting(false);
            return;
          } catch (e) {
            // fallback
          }
        }

        // Desktop fallback: Download PNG and open WhatsApp
        const link = document.createElement('a');
        link.download = `Receipt_${receipt.flatId}_${selectedThemeMonth}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        const encodedText = encodeURIComponent(textMsg);
        const whatsappUrl = formattedPhone
          ? `https://wa.me/${formattedPhone}?text=${encodedText}`
          : `https://wa.me/?text=${encodedText}`;

        window.open(whatsappUrl, '_blank');
        setIsExporting(false);
      }, 'image/png');
    } catch (err) {
      console.error('WhatsApp export failed:', err);
      setIsExporting(false);
    }
  };

  // Determine Receipt Type Heading
  const isAdvance = receipt.type === 'advance';
  const isElectricity = receipt.type === 'electricity';
  const isAdjustment = receipt.type === 'adjustment';

  const receiptTypeHeading = isAdvance
    ? 'ADVANCE PAYMENT RECEIPT'
    : isElectricity
    ? 'ELECTRICITY BILL RECEIPT'
    : isAdjustment
    ? 'ADVANCE ADJUSTMENT VOUCHER'
    : 'ROOM RENT RECEIPT';

  const defaultDesc = isAdvance
    ? 'Security Advance Deposit'
    : isElectricity
    ? 'Electricity Bill (NESCO Postpaid Service)'
    : isAdjustment
    ? 'Advance Rent Adjustment'
    : 'Room Rent Payment';

  const periodLabel = isAdvance
    ? formatDateDDMMYYYY(receipt.paymentDate)
    : receipt.monthName && receipt.year
    ? `${receipt.monthName} ${receipt.year}${isElectricity ? ' (Postpaid)' : ''}`
    : `${selectedThemeMonth.charAt(0).toUpperCase() + selectedThemeMonth.slice(1)} ${receipt.year || new Date().getFullYear()}`;

  const thankYouText = isAdvance
    ? 'Thank you for your advance deposit! Please retain this receipt.'
    : isElectricity
    ? 'Thank you for clearing your electricity bill! Have a pleasant day.'
    : isAdjustment
    ? 'Advance deposit successfully adjusted towards monthly dues. Retain this voucher.'
    : 'Thank you for your prompt payment! Please retain this receipt.';

  // Signatory details - Manager name is Russell (never write Manager for the signature itself)
  const isOwner = receipt.authorizedSignatureRole === 'owner';
  const signatoryFirstName = isOwner
    ? ((receipt.authorizedSignatureBy || '').replace(/[\(\)\[\]]/g, '').replace(/\bowner\b/gi, '').trim().split(' ')[0] || 'Owner')
    : 'Russell';
  const signatoryTitle = isOwner
    ? (receipt.signatureTitle || `${receipt.authorizedSignatureBy || 'Owner'} (${receipt.blockName || 'Block'} Owner)`)
    : 'Russell (Manager)';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:p-0 print:static print:bg-white print:block">
      {/* Print-specific overrides to match template */}
      <style>{`
        @media print {
          body { background: #fff !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .receipt-wrap { border: none !important; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; max-width: 100% !important; }
        }
      `}</style>
      {/* Container Card */}
      <div className="bg-slate-100 print:bg-white rounded-2xl print:rounded-none shadow-2xl print:shadow-none max-w-2xl w-full overflow-hidden border border-slate-300 print:border-none my-auto">
        {/* Modal Top Controls Toolbar (Hidden when printing) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block shadow-xs"
              style={{ backgroundColor: currentTheme.primary }}
            ></span>
            <span className="font-bold text-sm">Official Payment Receipt Generator</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Monthly Theme Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 font-medium">Month Color:</span>
              <select
                value={selectedThemeMonth}
                onChange={(e) => setSelectedThemeMonth(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer capitalize"
              >
                {MONTH_KEYS.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m.charAt(0).toUpperCase() + m.slice(1)} ({MONTH_THEMES[m].label})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* RECEIPT PREVIEW (Ultra-Compact Half-Height Professional Receipt Styling) */}
        <div className="p-4 sm:p-6 bg-slate-200/60">
          <div
            ref={receiptWrapRef}
            className="receipt-wrap bg-white rounded-xl border border-slate-300 shadow-md relative overflow-hidden text-slate-800 font-sans"
            style={
              {
                '--theme-primary': currentTheme.primary,
                '--theme-dark': currentTheme.dark,
                '--theme-light': currentTheme.light,
                '--theme-border': currentTheme.border,
              } as React.CSSProperties
            }
          >
            {/* Top Accent Gradient Bar */}
            <div
              className="receipt-accent-bar"
              style={{
                height: '5px',
                background: `linear-gradient(90deg, ${currentTheme.dark} 0%, ${currentTheme.primary} 50%, ${currentTheme.dark} 100%)`,
              }}
            ></div>

            {/* Receipt Inner Content */}
            <div className="p-4 sm:p-5">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <div className="flex gap-2.5 items-center">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center p-2 shadow-xs shrink-0"
                    style={{ backgroundColor: currentTheme.primary }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 512 512"
                      className="w-full h-full fill-white"
                    >
                      <path d="M256 32L32 224h64v256h128V320h64v160h128V224h64L256 32z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="m-0 text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                      {COMPLEX_CONFIG.name}
                    </h1>
                    <p className="m-0 text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
                      {COMPLEX_CONFIG.address}
                    </p>
                  </div>
                </div>

                {/* Meta Badge Box */}
                <div
                  className="rounded-md px-2.5 py-1.5 text-right border shrink-0"
                  style={{
                    backgroundColor: currentTheme.light,
                    borderColor: currentTheme.border,
                  }}
                >
                  <div
                    className="text-[11px] font-extrabold uppercase tracking-wide"
                    style={{ color: currentTheme.primary }}
                  >
                    {receiptTypeHeading}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    Receipt No: <strong className="text-slate-900 font-mono">{receipt.receiptNumber}</strong>
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Issue Date: <strong className="text-slate-900">{formatDateDDMMYYYY(receipt.paymentDate)}</strong>
                  </div>
                </div>
              </div>

              {/* Info Cards Grid */}
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-2">
                  <div className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Received From (Tenant)
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    {receipt.tenantName}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                    {receipt.tenantPhone ? `Mobile: ${receipt.tenantPhone}` : 'Valued Resident'}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-right">
                  <div className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Property Allocation
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    Flat {receipt.flatId} ({receipt.blockName || 'Block A'})
                  </div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    Residential Premises
                  </div>
                </div>
              </div>

              {/* Compact Items Table */}
              <div className="mt-2.5 rounded-md overflow-hidden border border-slate-200">
                <table className="w-full border-collapse bg-white text-xs">
                  <thead>
                    <tr style={{ backgroundColor: currentTheme.primary, color: '#ffffff' }}>
                      <th className="py-1.5 px-3 text-left font-bold text-[10px] uppercase tracking-wider text-white">
                        Description / Payment Item
                      </th>
                      <th className="py-1.5 px-3 text-center font-bold text-[10px] uppercase tracking-wider text-white">
                        {isAdvance ? 'Payment Date' : 'Billing Period'}
                      </th>
                      <th className="py-1.5 px-3 text-right font-bold text-[10px] uppercase tracking-wider text-white">
                        Amount (BDT)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipt.breakdown && receipt.breakdown.length > 0 ? (
                      receipt.breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-3 font-semibold text-slate-900 text-[11px]">
                            {item.label}
                          </td>
                          <td className="py-1.5 px-3 text-center text-slate-600 text-[11px]">
                            {periodLabel}
                          </td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono text-[11px]">
                            {formatBDT(item.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-900 text-[11px]">
                          {receipt.purpose || defaultDesc}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                          {periodLabel}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-[11.5px]">
                          {formatBDT(receipt.amount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Section */}
              <div className="flex justify-between items-center mt-2.5 gap-3">
                <div className="text-[10px] text-slate-500 italic max-w-xs leading-tight">
                  <strong className="text-slate-700 not-italic block font-bold">Notice:</strong>
                  <span>{thankYouText}</span>
                </div>

                <div
                  className="rounded-md px-3 py-1.5 text-right min-w-[170px] shadow-xs text-white"
                  style={{ backgroundColor: currentTheme.primary }}
                >
                  <div className="text-[8.5px] uppercase tracking-wider font-semibold opacity-90">
                    Total Amount Paid
                  </div>
                  <div className="text-sm font-extrabold font-mono mt-0.5">
                    {formatBDT(receipt.amount)}
                  </div>
                  <div className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-white/20 mt-0.5">
                    PAID
                  </div>
                </div>
              </div>

              {/* Signatures Footer */}
              <div className="flex justify-between items-end mt-3 pt-2 border-t border-dashed border-slate-200">
                <div className="text-center min-w-[130px]">
                  <div className="h-7 flex items-center justify-center text-slate-400 text-xs font-cursive">
                    {receipt.tenantName}
                  </div>
                  <div className="text-[9px] text-slate-500 border-t border-slate-300 pt-0.5 font-bold uppercase tracking-wider">
                    Tenant Signature
                  </div>
                </div>

                <div className="text-center min-w-[130px]">
                  <div
                    className="h-7 flex items-center justify-center text-slate-900 font-cursive text-xl"
                    style={{ fontFamily: "'Cedarville Cursive', cursive, sans-serif" }}
                  >
                    {signatoryFirstName}
                  </div>
                  <div className="text-[9px] text-slate-500 border-t border-slate-300 pt-0.5 font-bold uppercase tracking-wider">
                    {signatoryTitle}
                  </div>
                </div>
              </div>

              {/* Verification Footer */}
              <div className="text-center text-[8px] text-slate-400 mt-2.5 uppercase tracking-wider">
                Computer Generated Official Voucher &bull; {COMPLEX_CONFIG.name}
              </div>
            </div>

            {/* Watermark Stamp */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 font-black uppercase tracking-widest text-emerald-600 opacity-12 text-4xl sm:text-5xl border-4 border-dashed border-emerald-600 px-5 py-1 rounded-xl z-10 whitespace-nowrap"
            >
              PAID
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Bar (Print, Download PNG, Share WhatsApp, Close) */}
        <div className="no-print bg-slate-50 border-t border-slate-300 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentTheme.primary }}></span>
            <span className="font-semibold capitalize">{selectedThemeMonth} Monthly Theme Active</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            {/* Download PNG Button */}
            <button
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              style={{ backgroundColor: currentTheme.primary }}
              title="Download receipt as PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generating PNG...' : 'Download PNG'}</span>
            </button>

            {/* Share via WhatsApp Button */}
            <button
              onClick={handleShareWhatsApp}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
              title="Share receipt via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { X, Printer, Download, Zap } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { ElectricityBill } from '../types';
import { formatBDT, getMonthName, formatDateDDMMYYYY } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  bill: ElectricityBill | null;
  onClose: () => void;
}

export const PrintableBillModal: React.FC<Props> = ({ bill, onClose }) => {
  const billReceiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  const downloadAsPNG = async () => {
    if (!billReceiptRef.current) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const monthName = getMonthName(bill.consumptionMonth);
      const shortYear = String(bill.consumptionYear).slice(-2);
      const finalFilename = `${bill.flatId} Electricity bill ${monthName} ${shortYear}.png`;

      const canvas = await html2canvas(billReceiptRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      link.download = finalFilename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error generating bill PNG image:', err);
      setDownloadError(err?.message || 'Failed to generate PNG image. Please try printing or saving as PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  const subtotalBeforeVat = bill.baseEnergyCost + bill.demandCharge + bill.meterRent;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 print:p-0 print:static print:bg-white print:block">
      {/* Print Overrides */}
      <style>{`
        @media print {
          body { background: #ffffff !important; padding: 0 !important; }
          .no-print { display: none !important; }
          #billReceipt { border: none !important; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; width: 100% !important; }
        }
      `}</style>

      <div className="max-w-md lg:max-w-lg w-full my-auto flex flex-col items-center">
        {/* Actions Bar (Top) */}
        <div className="no-print w-full bg-slate-900 text-white rounded-t-xl px-5 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-amber-400/20 text-amber-400 rounded-md">
              <Zap className="w-4 h-4" />
            </span>
            <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
              Electricity Bill Voucher
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              title="Print bill or save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Exact Bill Receipt Component from User's Template */}
        <div
          id="billReceipt"
          ref={billReceiptRef}
          className="bg-white p-6 sm:p-8 border border-gray-200 shadow-xl rounded-b-xl print:rounded-none w-full relative overflow-hidden text-gray-800 text-xs font-sans"
        >
          {/* Decorative top bar */}
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>

          {/* Header */}
          <div className="text-center border-b-2 border-gray-100 pb-4 mb-4 mt-1">
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">
              {COMPLEX_CONFIG.name}
            </h2>
            <p className="text-xs text-gray-500 tracking-widest uppercase mt-0.5">
              Apartment Complex
            </p>
            <div className="inline-block bg-blue-50 text-blue-800 font-bold px-3 py-0.5 rounded-full text-xs mt-2">
              ELECTRICITY BILL
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div>
              <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Flat No</p>
              <p className="font-bold text-base text-gray-800" id="outFlat">
                Flat {bill.flatId}
              </p>
              {bill.tenantName && (
                <p className="text-gray-600 text-[11px] font-medium">{bill.tenantName}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Date Generated</p>
              <p className="font-medium text-gray-800" id="outGenDate">
                {formatDateDDMMYYYY(bill.generatedDate)}
              </p>
              <p className="text-gray-400 font-mono text-[10px] mt-0.5">Ref: {bill.id.slice(-8).toUpperCase()}</p>
            </div>
            <div className="col-span-2 bg-gray-50 p-2.5 rounded-md border border-gray-100">
              <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Billing Period</p>
              <p className="font-semibold text-gray-800" id="outPeriod">
                {getMonthName(bill.consumptionMonth)} {bill.consumptionYear} (Cycle Due: {getMonthName(bill.billingMonth)} {bill.billingYear})
              </p>
            </div>
          </div>

          {/* Reading Details */}
          {bill.consumedUnits > 0 || bill.currentReading > 0 ? (
            <div id="outReadingsBox" className="flex justify-between items-center mb-4 text-xs border-b border-gray-100 pb-3">
              <div>
                <p className="text-gray-500 text-[11px]">Previous Reading</p>
                <p className="font-bold text-sm text-gray-700 font-mono" id="outPrev">
                  {bill.previousReading}
                </p>
              </div>
              <div className="text-gray-400 text-sm font-bold">-</div>
              <div>
                <p className="text-gray-500 text-[11px]">Current Reading</p>
                <p className="font-bold text-sm text-gray-900 font-mono" id="outCurr">
                  {bill.currentReading}
                </p>
              </div>
              <div className="text-gray-400 text-sm font-bold">=</div>
              <div className="text-right">
                <p className="text-gray-500 text-[11px]">Total Units</p>
                <p className="font-bold text-blue-600 text-sm font-mono" id="outUnits">
                  {bill.consumedUnits} Units
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-2.5 bg-amber-50/60 rounded-lg border border-amber-200/80 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-amber-900 block">Fixed Electricity Charge</span>
                <span className="text-[10px] text-amber-700">Flat rate monthly billing without sub-meter units</span>
              </div>
              <span className="font-mono font-black text-sm text-amber-950">
                {formatBDT(bill.totalBill)}
              </span>
            </div>
          )}

          {/* DETAILED BREAKDOWN SECTION */}
          <div className="mb-4 bg-gray-50/70 rounded-lg p-3 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-700 border-b border-gray-200 pb-1.5 mb-2 uppercase tracking-wide flex justify-between items-center">
              <span>Detailed Breakdown</span>
              <span className="text-[10px] text-gray-400 normal-case font-normal">NESCO Tariff</span>
            </h3>

            {/* Dynamic Step Lines */}
            <div id="outBreakdownSteps" className="space-y-1 text-xs text-gray-600 mb-2">
              {bill.slabBreakdown && bill.slabBreakdown.length > 0 ? (
                bill.slabBreakdown.map((step, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span>
                      {step.slabName}{' '}
                      {step.units > 0 && (
                        <span className="text-gray-400 font-mono text-[11px]">
                          ({step.units} x {step.rate.toFixed(2)})
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-gray-800 font-mono">
                      ৳{step.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center">
                  <span>
                    Energy Units{' '}
                    {bill.consumedUnits > 0 && (
                      <span className="text-gray-400 font-mono text-[11px]">
                        ({bill.consumedUnits} kWh)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-gray-800 font-mono">
                    ৳{bill.baseEnergyCost.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Additional Charges (shown if present) */}
            {(bill.demandCharge > 0 || bill.meterRent > 0 || bill.vatAmount > 0) ? (
              <div className="space-y-1 text-xs border-t border-gray-200 pt-2 text-gray-700 font-mono">
                <div className="flex justify-between items-center font-sans font-medium text-gray-800">
                  <span>Energy Charge Subtotal</span>
                  <span id="outEnergyCharge" className="font-mono">৳{bill.baseEnergyCost.toFixed(2)}</span>
                </div>
                {bill.demandCharge > 0 && (
                  <div className="flex justify-between items-center font-sans">
                    <span id="outDemandLabel">Demand Charge ({bill.sanctionedLoadKW || 3} kW Load @ ৳42)</span>
                    <span id="outDemandCharge" className="font-mono">৳{bill.demandCharge.toFixed(2)}</span>
                  </div>
                )}
                {bill.meterRent > 0 && (
                  <div className="flex justify-between items-center font-sans">
                    <span>Meter Rent</span>
                    <span id="outMeterRent" className="font-mono">৳{bill.meterRent.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center font-semibold text-gray-800 border-t border-dashed border-gray-200 pt-1 mt-1 font-sans">
                  <span>Subtotal</span>
                  <span id="outSubtotal" className="font-mono">৳{subtotalBeforeVat.toFixed(2)}</span>
                </div>
                {bill.vatAmount > 0 && (
                  <div className="flex justify-between items-center font-sans">
                    <span id="outVatLabel">VAT (5%)</span>
                    <span id="outVat" className="font-mono">৳{bill.vatAmount.toFixed(2)}</span>
                  </div>
                )}
                {bill.rebateAmount > 0 && (
                  <div className="flex justify-between items-center font-sans text-emerald-600">
                    <span>Rebate / Discount</span>
                    <span className="font-mono">-৳{bill.rebateAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Grand Total */}
          <div className="bg-blue-50 p-3.5 rounded-lg flex justify-between items-center border border-blue-100">
            <span className="font-bold text-blue-900 uppercase tracking-wider text-xs">
              Total Payable
            </span>
            <span className="font-bold text-xl text-blue-700 font-mono" id="outTotalPayable">
              ৳ {Math.round(bill.totalBill).toFixed(2)}
            </span>
          </div>

          {/* Signatures with Manager Russell */}
          <div className="pt-4 border-t border-gray-200 flex justify-between items-end text-xs mt-4">
            <div className="text-center min-w-[120px]">
              <div className="h-7 flex items-center justify-center text-gray-400 text-xs">
                Verified
              </div>
              <div className="w-28 border-b border-gray-300 mx-auto mb-1"></div>
              <p className="font-medium text-gray-500 text-[10px] uppercase">Meter Reader</p>
            </div>

            <div className="text-center min-w-[130px]">
              {/* Handwritten Manager Signature - Cursive Russell */}
              <div
                className="h-7 flex items-center justify-center text-gray-900 text-2xl font-bold"
                style={{ fontFamily: "'Cedarville Cursive', cursive, sans-serif" }}
              >
                Russell
              </div>
              <div className="w-32 border-b border-gray-400 mx-auto mb-1"></div>
              <p className="font-extrabold text-gray-800 text-[11px]">Russell</p>
              <p className="text-blue-600 text-[10px] uppercase font-bold tracking-wider">Manager</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center border-t border-gray-100 pt-3">
            <p className="text-[11px] text-gray-400">
              Please pay your bill within the due date to avoid late fees.
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Generated by Complex Management &bull; Russell (Manager)
            </p>
          </div>
        </div>

        {/* Error message */}
        {downloadError && (
          <div className="no-print w-full mt-3 p-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl text-center">
            {downloadError}
          </div>
        )}

        {/* Download Button (Matching template's animated green button) */}
        <div className="no-print w-full mt-4 flex items-center gap-2">
          <button
            onClick={downloadAsPNG}
            disabled={isDownloading}
            className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-md flex justify-center items-center gap-2 text-xs cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Generating PNG...' : 'Download Bill as PNG'}</span>
          </button>
          <button
            onClick={onClose}
            className="min-h-[44px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 px-5 rounded-xl transition duration-200 text-xs cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, Settings, RotateCcw, Sparkles } from 'lucide-react';
import { NescoTariffConfig } from '../types';
import { DEFAULT_NESCO_TARIFF, isTariffUpToDate, upgradeTariffConfig } from '../lib/nescoTariff';

interface Props {
  tariffConfig: NescoTariffConfig;
  onSave: (config: NescoTariffConfig) => void;
  onClose: () => void;
}

export const TariffSettingsModal: React.FC<Props> = ({ tariffConfig, onSave, onClose }) => {
  const activeInitial = isTariffUpToDate(tariffConfig) ? tariffConfig : upgradeTariffConfig(tariffConfig);
  const [title, setTitle] = useState(activeInitial.title);
  const [demandCharge, setDemandCharge] = useState(activeInitial.demandChargePerKW);
  const [vat, setVat] = useState(activeInitial.vatPercentage);
  const [meterRent, setMeterRent] = useState(activeInitial.meterRent);
  const [slabs, setSlabs] = useState(activeInitial.slabs);

  const handleSlabRateChange = (index: number, newRate: number) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], ratePerUnit: newRate };
    setSlabs(updated);
  };

  const handleResetToDefault2026 = () => {
    setTitle(DEFAULT_NESCO_TARIFF.title);
    setDemandCharge(DEFAULT_NESCO_TARIFF.demandChargePerKW);
    setVat(DEFAULT_NESCO_TARIFF.vatPercentage);
    setMeterRent(DEFAULT_NESCO_TARIFF.meterRent);
    setSlabs(DEFAULT_NESCO_TARIFF.slabs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...tariffConfig,
      title,
      demandChargePerKW: demandCharge,
      vatPercentage: vat,
      meterRent,
      slabs,
      effectiveFrom: '2026-01-01',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl lg:max-w-2xl w-full p-6 border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Settings className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base">NESCO Tariff Configuration Engine</h3>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>2026 Updated</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Configure progressive slabs, demand charges, and VAT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tariff Title / Notice Reference</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-medium text-base sm:text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Demand Charge (৳/KW)</label>
              <input
                type="number"
                step="0.01"
                value={demandCharge}
                onChange={(e) => setDemandCharge(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Government VAT (%)</label>
              <input
                type="number"
                step="0.1"
                value={vat}
                onChange={(e) => setVat(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sub-Meter Rent (৳)</label>
              <input
                type="number"
                step="0.01"
                value={meterRent}
                onChange={(e) => setMeterRent(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Progressive Consumption Slabs
              </h4>
              <button
                type="button"
                onClick={handleResetToDefault2026}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                title="Reset all slab rates to latest official 2026 NESCO LT-A rates"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Official 2026 Rates</span>
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {slabs.map((slab, i) => (
                <div key={i} className="p-3 flex items-center justify-between bg-slate-50/50">
                  <span className="font-semibold text-slate-800 text-xs">{slab.slabName}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-500">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      value={slab.ratePerUnit}
                      onChange={(e) => handleSlabRateChange(i, Number(e.target.value))}
                      className="w-24 min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="text-slate-500 text-xs">/ unit</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer flex items-center justify-center order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center justify-center order-1 sm:order-2 active:scale-95 transition-all"
            >
              Save Tariff Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

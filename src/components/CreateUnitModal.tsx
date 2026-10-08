import React, { useState } from 'react';
import {
  X,
  Building2,
  PlusCircle,
  Zap,
  User,
  Phone,
  Calendar,
  Wallet,
  Car,
  Warehouse,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { AppDatabaseState, UnitType, ElectricityBillingType } from '../types';
import { formatBDT } from '../lib/nescoTariff';

export interface NewRentalUnitPayload {
  flatId: string;
  blockName: 'Block A' | 'Block B' | 'Block C';
  floor: number;
  unitType: UnitType;
  monthlyRent: number;
  parkingSlot?: string;
  godownSlot?: string;
  electricityBillingType: ElectricityBillingType;
  meterPreviousReading: number;
  meterCurrentReading: number;
  sanctionedLoad: number;
  isOccupied: boolean;
  tenantName?: string;
  tenantPhone?: string;
  entryDate?: string;
  advanceAmount?: number;
  advanceStatus?: 'Paid' | 'Not Paid';
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppDatabaseState;
  onAddUnit: (payload: NewRentalUnitPayload) => void;
}

export const CreateUnitModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onAddUnit,
}) => {
  if (!isOpen) return null;

  // Form State
  const [flatId, setFlatId] = useState('');
  const [blockName, setBlockName] = useState<'Block A' | 'Block B' | 'Block C'>('Block A');
  const [floor, setFloor] = useState<number>(1);
  const [unitType, setUnitType] = useState<UnitType>('residential');
  const [monthlyRent, setMonthlyRent] = useState<number>(25000);

  // Addons
  const [hasParking, setHasParking] = useState(false);
  const [parkingSlot, setParkingSlot] = useState('P-1');
  const [hasGodown, setHasGodown] = useState(false);
  const [godownSlot, setGodownSlot] = useState('G-1');

  // NESCO Electricity Sub-Meter Setup
  const [electricityBillingType, setElectricityBillingType] = useState<ElectricityBillingType>('nesco_submeter');
  const [meterPreviousReading, setMeterPreviousReading] = useState<number>(0);
  const [meterCurrentReading, setMeterCurrentReading] = useState<number>(0);
  const [sanctionedLoad, setSanctionedLoad] = useState<number>(2);

  // Tenant & Occupancy
  const [isOccupied, setIsOccupied] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [entryDate, setEntryDate] = useState(
    `${data.selectedYear}-${String(data.selectedMonth).padStart(2, '0')}-01`
  );
  const [advanceAmount, setAdvanceAmount] = useState<number>(50000);
  const [advanceStatus, setAdvanceStatus] = useState<'Paid' | 'Not Paid'>('Not Paid');
  const [notes, setNotes] = useState('');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validation
  const trimmedFlatId = flatId.trim().toUpperCase();
  const isDuplicate = data.units.some(
    (u) => u.flatId.trim().toUpperCase() === trimmedFlatId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedFlatId) {
      setErrorMsg('Please enter a Flat or Unit ID (e.g. A8, B7, C7).');
      return;
    }
    if (isDuplicate) {
      setErrorMsg(`Flat ID "${trimmedFlatId}" already exists. Please choose a unique Flat ID.`);
      return;
    }
    if (monthlyRent < 0) {
      setErrorMsg('Monthly rent cannot be negative.');
      return;
    }

    onAddUnit({
      flatId: trimmedFlatId,
      blockName,
      floor,
      unitType,
      monthlyRent,
      parkingSlot: hasParking ? parkingSlot : undefined,
      godownSlot: hasGodown ? godownSlot : undefined,
      electricityBillingType,
      meterPreviousReading: Number(meterPreviousReading) || 0,
      meterCurrentReading: Number(meterCurrentReading) || Number(meterPreviousReading) || 0,
      sanctionedLoad: Number(sanctionedLoad) || 2,
      isOccupied: isOccupied || Boolean(tenantName.trim()),
      tenantName: tenantName.trim() || (isOccupied ? 'Resident' : undefined),
      tenantPhone: tenantPhone.trim() || undefined,
      entryDate,
      advanceAmount: Number(advanceAmount) || 0,
      advanceStatus,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  // Quick helper to suggest next unit ID based on block
  const suggestNextFlatId = (block: 'Block A' | 'Block B' | 'Block C') => {
    setBlockName(block);
    const prefix = block === 'Block A' ? 'A' : block === 'Block B' ? 'B' : 'C';
    const existing = data.units
      .filter((u) => u.flatId.startsWith(prefix))
      .map((u) => {
        const num = parseInt(u.flatId.replace(/\D/g, ''), 10);
        return isNaN(num) ? 0 : num;
      });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    setFlatId(`${prefix}${max + 1}`);
    setFloor(Math.min(7, Math.max(1, Math.ceil((max + 1) / 2))));
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Create New Rental Unit
                </h2>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-400/30">
                  Instant Auto-Sync
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Automatically registers into Monthly Ledger unit list and NESCO Electricity Billing System immediately.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold text-xs">{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Identification & Location */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                1. Unit Identification & Block Location
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Suggest:</span>
                <button
                  type="button"
                  onClick={() => suggestNextFlatId('Block A')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded-md font-bold cursor-pointer"
                >
                  Block A
                </button>
                <button
                  type="button"
                  onClick={() => suggestNextFlatId('Block B')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded-md font-bold cursor-pointer"
                >
                  Block B
                </button>
                <button
                  type="button"
                  onClick={() => suggestNextFlatId('Block C')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded-md font-bold cursor-pointer"
                >
                  Block C
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Flat / Unit ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A8, B7, C7, P2"
                  value={flatId}
                  onChange={(e) => {
                    setFlatId(e.target.value.toUpperCase());
                    setErrorMsg(null);
                  }}
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                    isDuplicate ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                  }`}
                  required
                />
                {isDuplicate && (
                  <p className="text-[10px] text-rose-600 mt-1 font-semibold">
                    Flat ID already exists! Please choose another ID.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Block Assignment <span className="text-rose-500">*</span>
                </label>
                <select
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Block A">Block A (Owner Rashed)</option>
                  <option value="Block B">Block B (Owner Raju)</option>
                  <option value="Block C">Block C (Owner Rony)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Floor Level</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Space Type</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="residential">Residential Flat</option>
                  <option value="parking">Parking Slot</option>
                  <option value="godown">Godown / Storage</option>
                  <option value="commercial">Commercial Space</option>
                  <option value="other">Other Space</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Monthly Rent (৳ BDT) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                  <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">
                    ৳ BDT
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: NESCO Electricity Sub-Meter Enrollment */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                2. NESCO Electricity Sub-Meter Auto-Enrollment
              </span>
              <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 font-bold rounded-full text-[10px]">
                NESCO Slabs Billing
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              When created, this unit will immediately appear in the <strong>Electricity (NESCO)</strong> bills table, sub-meter readings entry list, and bill calculator.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Electricity Billing Mode</label>
                <select
                  value={electricityBillingType}
                  onChange={(e) => setElectricityBillingType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="nesco_submeter">NESCO Sub-Meter (Progressive Slabs)</option>
                  <option value="fixed">Fixed Electricity Rate</option>
                  <option value="none">No Electricity Billing</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Starting / Previous Reading (kWh)
                </label>
                <input
                  type="number"
                  min="0"
                  value={meterPreviousReading}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMeterPreviousReading(val);
                    if (meterCurrentReading < val) {
                      setMeterCurrentReading(val);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  placeholder="e.g. 0 or 1500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sanctioned Load (kW)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={sanctionedLoad}
                  onChange={(e) => setSanctionedLoad(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Resident / Tenant Details (Optional) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                3. Resident & Security Advance (Optional)
              </span>

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-600 cursor-pointer flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isOccupied}
                    onChange={(e) => setIsOccupied(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Mark as Occupied</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tenant Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Md. Rafiqul Islam"
                  value={tenantName}
                  onChange={(e) => {
                    setTenantName(e.target.value);
                    if (e.target.value.trim() && !isOccupied) setIsOccupied(true);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tenant Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. 01717623061"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Entry Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Security Advance / Deposit (৳ BDT)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">
                    ৳ BDT
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Advance Payment Status</label>
                <select
                  value={advanceStatus}
                  onChange={(e) => setAdvanceStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="Not Paid">Not Paid (Due / Outstanding)</option>
                  <option value="Paid">Paid in Full (Holding in Escrow)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Parking & Godown Addons */}
          <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50 space-y-2.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Optional Add-on Spaces
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasParking}
                  onChange={(e) => setHasParking(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <Car className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">
                  Includes Parking Slot (+৳2,500/mo)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasGodown}
                  onChange={(e) => setHasGodown(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <Warehouse className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-slate-800">
                  Includes Godown Storage (+৳6,000/mo)
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Will create in <strong>Monthly Ledger</strong> and enroll in <strong>NESCO Electricity</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isDuplicate || !trimmedFlatId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create & Sync Rental Unit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

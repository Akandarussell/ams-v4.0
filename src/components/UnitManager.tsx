import React, { useState } from 'react';
import {
  Building2,
  PlusCircle,
  Search,
  UserCheck,
  UserX,
  Car,
  Warehouse,
  Home,
  Edit2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AppDatabaseState, Unit, UnitType, ElectricityBillingType, NescoBillingSystem } from '../types';
import { formatBDT } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  data: AppDatabaseState;
  onAddUnit: (unit: Omit<Unit, 'id'>) => void;
  onUpdateUnitRent: (unitId: string, monthlyRent: number) => void;
  onVacateUnit: (unitId: string) => void;
}

export const UnitManager: React.FC<Props> = ({
  data,
  onAddUnit,
  onUpdateUnitRent,
  onVacateUnit,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBlock, setFilterBlock] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit Rent Modal
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [newRent, setNewRent] = useState<number>(0);

  // Add Unit Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFlatId, setNewFlatId] = useState('');
  const [newBlock, setNewBlock] = useState<'Block A' | 'Block B' | 'Block C' | 'Basement'>('Block A');
  const [newFloor, setNewFloor] = useState(1);
  const [newType, setNewType] = useState<UnitType>('residential');
  const [newRentAmount, setNewRentAmount] = useState(25000);
  const [newElecType, setNewElecType] = useState<ElectricityBillingType>('nesco_submeter');
  const [newBillingSystem, setNewBillingSystem] = useState<NescoBillingSystem | 'none'>('regular_nesco');
  const [newFixedUnitRate, setNewFixedUnitRate] = useState<number>(15.01);
  const [newFixedBillAmount, setNewFixedBillAmount] = useState<number>(1500);

  const filteredUnits = data.units.filter((u) => {
    if (filterType !== 'all' && u.unitType !== filterType) return false;
    if (filterBlock !== 'all' && u.blockName !== filterBlock) return false;
    const search = searchTerm.toLowerCase();
    return u.flatId.toLowerCase().includes(search);
  });

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setNewRent(unit.monthlyRent);
  };

  const handleSaveRent = () => {
    if (!editingUnit || newRent < 0) return;
    onUpdateUnitRent(editingUnit.id, newRent);
    setEditingUnit(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlatId.trim()) return;
    onAddUnit({
      flatId: newFlatId.trim(),
      blockId:
        newBlock === 'Block A'
          ? 'block-a'
          : newBlock === 'Block B'
          ? 'block-b'
          : newBlock === 'Block C'
          ? 'block-c'
          : 'block-basement',
      blockName: newBlock,
      floor: newFloor,
      unitType: newType,
      monthlyRent: newRentAmount,
      isOccupied: false,
      electricityBillingType: newBillingSystem === 'fixed_price_bill' ? 'fixed' : newBillingSystem === 'none' ? 'none' : 'nesco_submeter',
      billingSystem: newBillingSystem === 'none' ? undefined : newBillingSystem,
      fixedUnitRate: newFixedUnitRate,
      fixedElectricityAmount: newFixedBillAmount,
      isElectricityEnabled: newBillingSystem !== 'none',
    });
    setNewFlatId('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
            {COMPLEX_CONFIG.name}
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Flats, Parking & Godown Rental Spaces
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {COMPLEX_CONFIG.address}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage residential flats, parking spaces, godowns, and contract rents &bull; Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="min-h-[44px] flex items-center justify-center gap-1.5 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Add Rental Unit
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search by Flat ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-h-[44px] w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-slate-500 shrink-0">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="min-h-[44px] w-full sm:w-auto bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="residential">Residential Flats</option>
              <option value="parking">Parking Slots</option>
              <option value="godown">Godown / Storage</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="text-slate-500 shrink-0">Block:</span>
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
              className="min-h-[44px] w-full sm:w-auto bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Blocks</option>
              <option value="Block A">Block A</option>
              <option value="Block B">Block B</option>
              <option value="Block C">Block C</option>
              <option value="Basement">Basement</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium shrink-0 self-end sm:self-center">
          {filteredUnits.length} Units Configured
        </span>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnits.map((unit) => {
          const tenant = data.tenants.find((t) => t.flatId === unit.flatId);
          return (
            <div
              key={unit.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-400 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      {unit.unitType === 'residential' ? (
                        <Home className="w-5 h-5" />
                      ) : unit.unitType === 'parking' ? (
                        <Car className="w-5 h-5" />
                      ) : (
                        <Warehouse className="w-5 h-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        Unit {unit.flatId}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {unit.blockName} &bull; Floor {unit.floor}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      unit.isOccupied
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {unit.isOccupied ? 'Occupied' : 'Vacant'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Monthly Rent:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatBDT(unit.monthlyRent)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Electricity Type:</span>
                    <span className="font-medium text-slate-700 capitalize">
                      {unit.electricityBillingType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Current Resident:</span>
                    <span className="font-semibold text-blue-700 truncate max-w-[140px]">
                      {tenant ? tenant.fullName : unit.flatId.includes('Owner') ? 'Owner Residing' : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => handleOpenEdit(unit)}
                  className="min-h-[40px] px-3 py-2 flex items-center gap-1.5 text-slate-600 hover:text-blue-700 font-semibold cursor-pointer rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Rent
                </button>

                {unit.isOccupied && !unit.flatId.includes('Owner') && (
                  <button
                    onClick={() => {
                      if (confirm(`Notice move-out for Unit ${unit.flatId}? Historical financial records will be preserved.`)) {
                        onVacateUnit(unit.id);
                      }
                    }}
                    className="min-h-[40px] px-3 py-2 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer text-xs rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    Mark Vacated
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* EDIT RENT MODAL */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              Update Rent for Unit {editingUnit.flatId}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter updated monthly rent amount in Bangladeshi Taka (৳).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Monthly Rent (BDT / ৳)
                </label>
                <input
                  type="number"
                  value={newRent}
                  onChange={(e) => setNewRent(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                onClick={() => setEditingUnit(null)}
                className="min-h-[44px] px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center justify-center order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRent}
                className="min-h-[44px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center order-1 sm:order-2"
              >
                Save Rent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD UNIT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md lg:max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Add New Rental Unit</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit / Flat ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A8 or P7 or G4"
                    value={newFlatId}
                    onChange={(e) => setNewFlatId(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-bold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Block *</label>
                  <select
                    value={newBlock}
                    onChange={(e) => setNewBlock(e.target.value as any)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-semibold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Block A">Block A</option>
                    <option value="Block B">Block B</option>
                    <option value="Block C">Block C</option>
                    <option value="Basement">Basement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Type *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-semibold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="residential">Residential Flat</option>
                    <option value="parking">Parking Space</option>
                    <option value="godown">Godown / Storage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Floor Level</label>
                  <input
                    type="number"
                    value={newFloor}
                    onChange={(e) => setNewFloor(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Monthly Rent (BDT / ৳) *</label>
                <input
                  type="number"
                  value={newRentAmount}
                  onChange={(e) => setNewRentAmount(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Electricity Billing System</label>
                <select
                  value={newBillingSystem}
                  onChange={(e) => {
                    const sys = e.target.value as NescoBillingSystem | 'none';
                    setNewBillingSystem(sys);
                    if (sys === 'fixed_price_bill') setNewElecType('fixed');
                    else if (sys === 'none') setNewElecType('none');
                    else setNewElecType('nesco_submeter');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-900 font-semibold text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="regular_nesco">System 1: Regular NESCO Tariff Slabs (Sub-meter kWh)</option>
                  <option value="fixed_unit_price">System 2: Fixed Unit Price (e.g. ৳15.01 per kWh)</option>
                  <option value="fixed_price_bill">System 3: Fixed Price Bill (e.g. ৳1,500/month flat)</option>
                  <option value="none">System 4: Electricity Billing OFF (Parking/Godown)</option>
                </select>
              </div>

              {newBillingSystem === 'fixed_unit_price' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fixed Rate per kWh (BDT / ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newFixedUnitRate}
                    onChange={(e) => setNewFixedUnitRate(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}

              {newBillingSystem === 'fixed_price_bill' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fixed Monthly Electricity Bill (BDT / ৳)</label>
                  <input
                    type="number"
                    value={newFixedBillAmount}
                    onChange={(e) => setNewFixedBillAmount(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono text-slate-900 text-base sm:text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center justify-center"
                >
                  Create Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

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
import { AppDatabaseState, Unit, UnitType, ElectricityBillingType } from '../types';
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
  const [newBlock, setNewBlock] = useState<'Block A' | 'Block B' | 'Block C'>('Block A');
  const [newFloor, setNewFloor] = useState(1);
  const [newType, setNewType] = useState<UnitType>('residential');
  const [newRentAmount, setNewRentAmount] = useState(25000);
  const [newElecType, setNewElecType] = useState<ElectricityBillingType>('nesco_submeter');

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
      blockId: newBlock === 'Block A' ? 'block-a' : newBlock === 'Block B' ? 'block-b' : 'block-c',
      blockName: newBlock,
      floor: newFloor,
      unitType: newType,
      monthlyRent: newRentAmount,
      isOccupied: false,
      electricityBillingType: newElecType,
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
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Add Rental Unit
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Flat ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Types</option>
              <option value="residential">Residential Flats</option>
              <option value="parking">Parking Slots</option>
              <option value="godown">Godown / Storage</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Block:</span>
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="all">All Blocks</option>
              <option value="Block A">Block A</option>
              <option value="Block B">Block B</option>
              <option value="Block C">Block C</option>
            </select>
          </div>
        </div>

        <span className="text-slate-500 font-medium">
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
                  className="flex items-center gap-1 text-slate-600 hover:text-blue-700 font-semibold cursor-pointer"
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
                    className="text-rose-600 hover:text-rose-700 font-semibold cursor-pointer text-[11px]"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingUnit(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRent}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
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
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Add New Rental Unit</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit / Flat ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A8 or P7 or G4"
                    value={newFlatId}
                    onChange={(e) => setNewFlatId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Block *</label>
                  <select
                    value={newBlock}
                    onChange={(e) => setNewBlock(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Block A">Block A</option>
                    <option value="Block B">Block B</option>
                    <option value="Block C">Block C</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Type *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Monthly Rent (BDT / ৳) *</label>
                <input
                  type="number"
                  value={newRentAmount}
                  onChange={(e) => setNewRentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Electricity Billing Type</label>
                <select
                  value={newElecType}
                  onChange={(e) => setNewElecType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="nesco_submeter">NESCO Postpaid Sub-meter</option>
                  <option value="fixed">Fixed Monthly Charge</option>
                  <option value="none">No Electricity Billing (Parking/Godown)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
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

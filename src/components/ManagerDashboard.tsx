import React, { useState } from 'react';
import {
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Wallet,
  Zap,
  Car,
  Warehouse,
  ArrowUpRight,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  Database,
  Server,
  PlusCircle,
  KeyRound,
  Download,
} from 'lucide-react';
import { AppDatabaseState, MonthlyLedgerItem } from '../types';
import { formatBDT, MONTH_NAMES, getMonthName, getPostpaidElectricityPeriod } from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { getSupabaseCredentials } from '../lib/supabase';
import {
  getEffectiveRemainingAdvance,
  calculateItemTotalDue,
  calculateLedgerAdvancePaidDue,
  calculateLedgerRentPaidDue,
  calculateLedgerElectricityPaidDue,
} from '../lib/storage';
import { exportAllCredentialsToExcel } from '../lib/exportCredentials';
import { CreateUnitModal, NewRentalUnitPayload } from './CreateUnitModal';

interface Props {
  data: AppDatabaseState;
  onUpdateMonthYear: (month: number, year: number) => void;
  onNavigateToView: (view: string) => void;
  onOpenDbModal?: () => void;
  onAddUnit?: (payload: NewRentalUnitPayload) => void;
  onNavigateToBlockLedger?: (block: string, month: number, year: number) => void;
}

export const ManagerDashboard: React.FC<Props> = ({
  data,
  onUpdateMonthYear,
  onNavigateToView,
  onOpenDbModal,
  onAddUnit,
  onNavigateToBlockLedger,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(data.selectedMonth);
  const [selectedYear, setSelectedYear] = useState<number>(data.selectedYear);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);

  const dbCreds = getSupabaseCredentials();

  const handleApplyFilter = (month: number = selectedMonth, year: number = selectedYear) => {
    onUpdateMonthYear(month, year);
  };

  const handleBlockClick = (blockName: string) => {
    if (onNavigateToBlockLedger) {
      onNavigateToBlockLedger(blockName, selectedMonth, selectedYear);
    } else {
      onUpdateMonthYear(selectedMonth, selectedYear);
      onNavigateToView('monthly-ledger');
    }
  };

  const handlePrevMonth = () => {
    let newM = selectedMonth - 1;
    let newY = selectedYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
    handleApplyFilter(newM, newY);
  };

  const handleNextMonth = () => {
    let newM = selectedMonth + 1;
    let newY = selectedYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
    handleApplyFilter(newM, newY);
  };

  // Calculations for current selected month
  const currentLedger = data.ledgerItems.filter(
    (item) => item.month === data.selectedMonth && item.year === data.selectedYear
  );

  const complexUnits = data.units.filter((u) =>
    ['Block A', 'Block B', 'Block C'].includes(u.blockName)
      ? u.unitType === 'residential'
      : u.blockName === 'Basement'
  );
  const totalFlats = complexUnits.length;
  const occupiedFlats = complexUnits.filter((u) => u.isOccupied).length;
  const vacantFlats = totalFlats - occupiedFlats;
  const totalTenants = data.tenants.filter((t) => t.status === 'active').length;

  // Postpaid electricity billing period
  const elecPeriod = getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear);

  // Collections and Dues
  const totalPayable = currentLedger.reduce((sum, item) => sum + item.totalPayable, 0);
  const totalCollection = currentLedger.reduce((sum, item) => sum + item.totalPaid, 0);
  const totalDues = currentLedger.reduce((sum, item) => sum + calculateItemTotalDue(item), 0);

  // Escrow balance held across all accounts
  const advanceTotal = data.advanceAccounts.reduce(
    (sum, a) => sum + getEffectiveRemainingAdvance(a, data.ledgerItems),
    0
  );

  // Block-wise statistics including month-specific Paid vs Due breakdown
  const blocks = ['Block A', 'Block B', 'Block C', 'Basement'] as const;
  const blockStats = blocks.map((blockName) => {
    const blockUnits = data.units.filter(
      (u) => u.blockName === blockName && (blockName === 'Basement' || u.unitType === 'residential')
    );
    const blockOccupied = blockUnits.filter((u) => u.isOccupied).length;
    const blockLedger = currentLedger.filter((item) => item.blockName === blockName);
    const blockPayable = blockLedger.reduce((sum, item) => sum + item.totalPayable, 0);
    const blockCollected = blockLedger.reduce((sum, item) => sum + item.totalPaid, 0);
    const blockDue = blockLedger.reduce((sum, item) => sum + calculateItemTotalDue(item), 0);
    const blockAdvanceEscrow = data.advanceAccounts
      .filter((a) => {
        const u = data.units.find((unit) => unit.flatId === a.flatId);
        return u?.blockName === blockName;
      })
      .reduce((sum, a) => sum + getEffectiveRemainingAdvance(a, data.ledgerItems), 0);

    // Exact month-specific Paid vs Due calculations (identical to the 3 KPI boxes)
    const adv = calculateLedgerAdvancePaidDue(blockLedger, data.advanceAccounts);
    const rent = calculateLedgerRentPaidDue(blockLedger);
    const elec = calculateLedgerElectricityPaidDue(blockLedger);

    return {
      name: blockName,
      owner:
        blockName === 'Block A'
          ? 'Rashed'
          : blockName === 'Block B'
          ? 'Raju'
          : blockName === 'Block C'
          ? 'Rony'
          : 'Manager',
      totalUnits: blockUnits.length,
      occupied: blockOccupied,
      vacant: blockUnits.length - blockOccupied,
      payable: blockPayable,
      collected: blockCollected,
      due: blockDue,
      advanceEscrow: blockAdvanceEscrow,
      // Month-specific Advance (Paid vs Due)
      advancePaid: adv.paid,
      advanceDue: adv.due,
      advancePaidCount: adv.paidCount,
      advanceDueCount: adv.dueCount,
      advanceTotalRequired: adv.totalRequired,
      // Month-specific Flat Rent (Paid vs Due)
      rentPaid: rent.paid,
      rentDue: rent.due,
      rentPaidCount: rent.paidCount,
      rentDueCount: rent.dueCount,
      rentTotalRequired: rent.totalRequired,
      // Month-specific Electricity Bill (Paid vs Due)
      elecPaid: elec.paid,
      elecDue: elec.due,
      elecPaidCount: elec.paidCount,
      elecDueCount: elec.dueCount,
      elecTotalRequired: elec.totalRequired,
      collectionRate: blockPayable > 0 ? Math.round((blockCollected / blockPayable) * 100) : 0,
    };
  });

  // All Blocks Summary Subtotals (Sum of Blocks A + B + C of the month)
  const allBlocksSummary = {
    // 1. Advance: Subtotal of Advance Payment & Dues across Blocks A+B+C
    advancePaid: blockStats.reduce((sum, b) => sum + b.advancePaid, 0),
    advanceDue: blockStats.reduce((sum, b) => sum + b.advanceDue, 0),
    advancePaidCount: blockStats.reduce((sum, b) => sum + b.advancePaidCount, 0),
    advanceDueCount: blockStats.reduce((sum, b) => sum + b.advanceDueCount, 0),
    advanceTotalRequired: blockStats.reduce((sum, b) => sum + b.advanceTotalRequired, 0),

    // 2. Monthly Flat Rent: Subtotal of Rent Paid & Dues across Blocks A+B+C
    rentPaid: blockStats.reduce((sum, b) => sum + b.rentPaid, 0),
    rentDue: blockStats.reduce((sum, b) => sum + b.rentDue, 0),
    rentPaidCount: blockStats.reduce((sum, b) => sum + b.rentPaidCount, 0),
    rentDueCount: blockStats.reduce((sum, b) => sum + b.rentDueCount, 0),
    rentTotalRequired: blockStats.reduce((sum, b) => sum + b.rentTotalRequired, 0),

    // 3. Electricity Bill: Subtotal of Bill Paid & Dues across Blocks A+B+C
    elecPaid: blockStats.reduce((sum, b) => sum + b.elecPaid, 0),
    elecDue: blockStats.reduce((sum, b) => sum + b.elecDue, 0),
    elecPaidCount: blockStats.reduce((sum, b) => sum + b.elecPaidCount, 0),
    elecDueCount: blockStats.reduce((sum, b) => sum + b.elecDueCount, 0),
    elecTotalRequired: blockStats.reduce((sum, b) => sum + b.elecTotalRequired, 0),
  };

  // Category collections (synchronized with verified Paid subtotals)
  const flatRentCollection = allBlocksSummary.rentPaid;
  const electricityCollection = allBlocksSummary.elecPaid;

  const parkingCollection = currentLedger
    .filter((item) => item.parkingRent > 0 && item.totalPaid > 0)
    .reduce((sum, item) => sum + item.parkingRent, 0);

  const godownCollection = currentLedger
    .filter((item) => item.godownRent > 0 && item.totalPaid > 0)
    .reduce((sum, item) => sum + item.godownRent, 0);

  // Category breakdown percentages
  const categories = [
    { label: 'Flat Rent', amount: flatRentCollection, color: 'bg-blue-600', text: 'text-blue-600' },
    { label: 'Electricity (NESCO)', amount: electricityCollection, color: 'bg-amber-500', text: 'text-amber-500' },
    { label: 'Parking Rent', amount: parkingCollection, color: 'bg-emerald-600', text: 'text-emerald-600' },
    { label: 'Godown Rent', amount: godownCollection, color: 'bg-purple-600', text: 'text-purple-600' },
  ];
  const catTotal = categories.reduce((sum, c) => sum + c.amount, 0) || 1;

  // Generate Year options 2024 to 2100
  const yearOptions = Array.from({ length: 77 }, (_, i) => 2024 + i);

  return (
    <div className="space-y-6">
      {/* Month & Year Selection Header with ENTER Button */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {COMPLEX_CONFIG.name.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {COMPLEX_CONFIG.address}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Hotline: <a href="tel:01737-321998" className="font-bold text-blue-700 hover:underline">{COMPLEX_CONFIG.contacts}</a> &bull; Super Admin ERP
              </p>
            </div>
          </div>
        </div>

        {/* Month, Year & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50/80 p-2 rounded-2xl border border-slate-200/80">
          <button
            onClick={handlePrevMonth}
            title="Previous Month"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            aria-label="Previous Month"
          >
            <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>

          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="min-h-[44px] w-full sm:w-auto bg-white border border-slate-300 text-slate-800 text-base sm:text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 sm:flex-initial">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="min-h-[44px] w-full sm:w-auto bg-white border border-slate-300 text-slate-800 text-base sm:text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer font-mono"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextMonth}
            title="Next Month"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            aria-label="Next Month"
          >
            <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => handleApplyFilter(selectedMonth, selectedYear)}
            className="min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 flex-1 sm:flex-initial"
          >
            <Filter className="w-4 h-4" />
            ENTER
          </button>

          <button
            type="button"
            onClick={() => setIsAddUnitModalOpen(true)}
            className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 flex-1 sm:flex-initial"
            title="Create New Rental Unit"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Create Unit</span>
          </button>
        </div>
      </div>

      {/* Manager's Dedicated Supabase Database Live Connection Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white">
                PostgreSQL & Supabase Database Live Connection
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                dbCreds.isConfigured
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dbCreds.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}></span>
                {dbCreds.isConfigured ? 'Supabase Live Connected' : 'Database Ready (Local / Cloud)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Manager Super Admin Console &bull; Real-time synchronization & escrow financial ledgers
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => exportAllCredentialsToExcel(data)}
            className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-1 sm:flex-initial"
            title="1-Click export all flat IDs and login passwords for tenants & authority logins (.xlsx)"
          >
            <Download className="w-4 h-4" />
            <span>1-Click Export Passwords</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddUnitModalOpen(true)}
            className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-1 sm:flex-initial"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Rental Unit</span>
          </button>

          {onOpenDbModal && (
            <button
              onClick={onOpenDbModal}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex-1 sm:flex-initial"
            >
              <Server className="w-4 h-4 text-blue-400" />
              <span>Database Setup & SQL</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 PRIMARY SUMMARY BOXES: Block A, Block B, Block C, and All Blocks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Monthly Blocks Performance & Accounting ({getMonthName(data.selectedMonth)} {data.selectedYear})
            </h2>
            <p className="text-xs text-slate-500">
              Click any block card to open its dedicated monthly ledger immediately
            </p>
          </div>
        </div>

        {/* 5 PRIMARY SUMMARY BOXES: Block A, Block B, Block C, Basement, and All Blocks Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Box 1: Block A Summary */}
          {(() => {
            const b = blockStats[0];
            return (
              <div
                onClick={() => handleBlockClick('Block A')}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-500 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden shadow-xs"
                title={`Click to open Block A Monthly Ledger for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-blue-600 text-white shadow-xs">
                      {b.name}
                    </span>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                      {getMonthName(data.selectedMonth)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Owner: <strong className="text-slate-800">{b.owner}</strong></span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{b.occupied}/{b.totalUnits} Units</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {/* Line 1: Advance Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Advance:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-indigo-700 font-bold">{formatBDT(b.advancePaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.advanceDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.advanceDue)}</span>
                      </span>
                    </div>

                    {/* Line 2: Flat Rent Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Flat Rent:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.rentPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.rentDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.rentDue)}</span>
                      </span>
                    </div>

                    {/* Line 3: Electricity Bill Paid vs Due (Last Month) */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Elec ({elecPeriod.monthName.slice(0, 3)}):</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.elecPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.elecDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.elecDue)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-slate-500">Collection Rate</span>
                    <span className="text-blue-700 font-bold">{b.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${b.collectionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] font-bold text-blue-700 group-hover:text-blue-800 flex items-center justify-between">
                    <span>Open Block A Ledger</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Box 2: Block B Summary */}
          {(() => {
            const b = blockStats[1];
            return (
              <div
                onClick={() => handleBlockClick('Block B')}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-500 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden shadow-xs"
                title={`Click to open Block B Monthly Ledger for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors"></div>
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                      {b.name}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                      {getMonthName(data.selectedMonth)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Owner: <strong className="text-slate-800">{b.owner}</strong></span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{b.occupied}/{b.totalUnits} Units</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {/* Line 1: Advance Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Advance:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-indigo-700 font-bold">{formatBDT(b.advancePaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.advanceDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.advanceDue)}</span>
                      </span>
                    </div>

                    {/* Line 2: Flat Rent Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Flat Rent:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.rentPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.rentDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.rentDue)}</span>
                      </span>
                    </div>

                    {/* Line 3: Electricity Bill Paid vs Due (Last Month) */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Elec ({elecPeriod.monthName.slice(0, 3)}):</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.elecPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.elecDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.elecDue)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-slate-500">Collection Rate</span>
                    <span className="text-indigo-700 font-bold">{b.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${b.collectionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] font-bold text-indigo-700 group-hover:text-indigo-800 flex items-center justify-between">
                    <span>Open Block B Ledger</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Box 3: Block C Summary */}
          {(() => {
            const b = blockStats[2];
            return (
              <div
                onClick={() => handleBlockClick('Block C')}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-purple-500 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden shadow-xs"
                title={`Click to open Block C Monthly Ledger for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-purple-600 text-white shadow-xs">
                      {b.name}
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md">
                      {getMonthName(data.selectedMonth)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Owner: <strong className="text-slate-800">{b.owner}</strong></span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{b.occupied}/{b.totalUnits} Units</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {/* Line 1: Advance Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Advance:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-indigo-700 font-bold">{formatBDT(b.advancePaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.advanceDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.advanceDue)}</span>
                      </span>
                    </div>

                    {/* Line 2: Flat Rent Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Flat Rent:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.rentPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.rentDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.rentDue)}</span>
                      </span>
                    </div>

                    {/* Line 3: Electricity Bill Paid vs Due (Last Month) */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Elec ({elecPeriod.monthName.slice(0, 3)}):</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.elecPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.elecDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.elecDue)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-slate-500">Collection Rate</span>
                    <span className="text-purple-700 font-bold">{b.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2.5">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${b.collectionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] font-bold text-purple-700 group-hover:text-purple-800 flex items-center justify-between">
                    <span>Open Block C Ledger</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Box 4: Basement Summary */}
          {(() => {
            const b = blockStats[3];
            return (
              <div
                onClick={() => handleBlockClick('Basement')}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-teal-500 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden shadow-xs"
                title={`Click to open Basement Monthly Ledger for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-bl-full pointer-events-none group-hover:bg-teal-500/10 transition-colors"></div>
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-teal-700 text-white shadow-xs">
                      {b.name}
                    </span>
                    <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-md">
                      {getMonthName(data.selectedMonth)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Owner: <strong className="text-slate-800">{b.owner}</strong></span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{b.occupied}/{b.totalUnits} Units</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {/* Line 1: Advance Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Advance:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-indigo-700 font-bold">{formatBDT(b.advancePaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.advanceDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.advanceDue)}</span>
                      </span>
                    </div>

                    {/* Line 2: Flat Rent Paid vs Due */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Flat Rent:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.rentPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.rentDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.rentDue)}</span>
                      </span>
                    </div>

                    {/* Line 3: Electricity Bill Paid vs Due (Last Month) */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Elec ({elecPeriod.monthName.slice(0, 3)}):</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-700 font-bold">{formatBDT(b.elecPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={b.elecDue > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}>{formatBDT(b.elecDue)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-slate-500">Collection Rate</span>
                    <span className="text-teal-700 font-bold">{b.collectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2.5">
                    <div
                      className="bg-teal-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${b.collectionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] font-bold text-teal-700 group-hover:text-teal-800 flex items-center justify-between">
                    <span>Open Basement Ledger</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Box 5: All Blocks Summary (All Box Summary) */}
          {(() => {
            const allCollectionRate = totalPayable > 0 ? Math.round((totalCollection / totalPayable) * 100) : 0;
            return (
              <div
                onClick={() => handleBlockClick('all')}
                className="bg-gradient-to-b from-white to-slate-50/70 rounded-2xl border-2 border-slate-800/80 hover:border-slate-900 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden shadow-xs"
                title={`Click to open All Blocks Unified Ledger for ${getMonthName(data.selectedMonth)} ${data.selectedYear}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-900/5 rounded-bl-full pointer-events-none group-hover:bg-slate-900/10 transition-colors"></div>
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-white shadow-xs">
                      All Blocks Summary
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-md">
                      {getMonthName(data.selectedMonth)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Complex: <strong className="text-slate-800">A + B + C + Basement</strong></span>
                    <span className="font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded-md">{occupiedFlats}/{totalFlats} Units</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    {/* Line 1: Advance Paid vs Due Subtotal */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                      <span className="flex items-center gap-1.5 font-bold text-indigo-950">
                        <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Advance Subtotal:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-indigo-800 font-black">{formatBDT(allBlocksSummary.advancePaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={allBlocksSummary.advanceDue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>{formatBDT(allBlocksSummary.advanceDue)}</span>
                      </span>
                    </div>

                    {/* Line 2: Flat Rent Paid vs Due Subtotal */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-950">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Rent Subtotal:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-800 font-black">{formatBDT(allBlocksSummary.rentPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={allBlocksSummary.rentDue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>{formatBDT(allBlocksSummary.rentDue)}</span>
                      </span>
                    </div>

                    {/* Line 3: Electricity Bill Paid vs Due Subtotal of Last Month */}
                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-amber-50/70 border border-amber-100">
                      <span className="flex items-center gap-1.5 font-bold text-amber-950">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        <span>Elec ({elecPeriod.monthName.slice(0, 3)}) Subtotal:</span>
                      </span>
                      <span className="font-mono tabular-nums text-xs">
                        <strong className="text-emerald-800 font-black">{formatBDT(allBlocksSummary.elecPaid)}</strong>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={allBlocksSummary.elecDue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}>{formatBDT(allBlocksSummary.elecDue)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200">
                  <div className="flex justify-between text-[11px] mb-1 font-semibold">
                    <span className="text-slate-500">Overall Rate</span>
                    <span className="text-slate-900 font-black">{allCollectionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2.5">
                    <div
                      className="bg-slate-900 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${allCollectionRate}%` }}
                    ></div>
                  </div>
                  <div className="text-[11px] font-black text-slate-900 group-hover:text-blue-700 flex items-center justify-between">
                    <span>Open All Blocks Ledger</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* 3 Dedicated Monthly Accounting KPI Cards (Screenshot match: Advance, Flat Rent, Electricity of Last Month) */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: ADVANCE (PAID VS DUE) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                  ADVANCE (PAID VS DUE)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  Paid vs Due
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ADVANCE PAID</span>
                  <div className="text-base sm:text-lg font-black text-indigo-700 font-mono tabular-nums">
                    {formatBDT(allBlocksSummary.advancePaid)}
                  </div>
                </div>
                <div className="border-l border-slate-100 pl-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ADVANCE DUE</span>
                  <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${allBlocksSummary.advanceDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatBDT(allBlocksSummary.advanceDue)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>{allBlocksSummary.advancePaidCount} Paid &bull; {allBlocksSummary.advanceDueCount} Due</span>
                <span className="font-mono text-slate-400 text-[10px]">Total: {formatBDT(allBlocksSummary.advanceTotalRequired)}</span>
              </div>
            </div>
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
              <div
                className="bg-indigo-600 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.advanceTotalRequired > 0 ? (allBlocksSummary.advancePaid / allBlocksSummary.advanceTotalRequired) * 100 : 100}%` }}
              ></div>
              <div
                className="bg-rose-500 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.advanceTotalRequired > 0 ? (allBlocksSummary.advanceDue / allBlocksSummary.advanceTotalRequired) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Card 2: [MONTH] FLAT RENT */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  {getMonthName(data.selectedMonth).toUpperCase()} FLAT RENT
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Paid vs Due
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RENT PAID</span>
                  <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tabular-nums">
                    {formatBDT(allBlocksSummary.rentPaid)}
                  </div>
                </div>
                <div className="border-l border-slate-100 pl-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RENT DUE</span>
                  <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${allBlocksSummary.rentDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatBDT(allBlocksSummary.rentDue)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>{allBlocksSummary.rentPaidCount} Paid (incl. adj) &bull; {allBlocksSummary.rentDueCount} Due</span>
                <span className="font-mono text-slate-400 text-[10px]">Req: {formatBDT(allBlocksSummary.rentTotalRequired)}</span>
              </div>
            </div>
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
              <div
                className="bg-emerald-500 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.rentTotalRequired > 0 ? (allBlocksSummary.rentPaid / allBlocksSummary.rentTotalRequired) * 100 : 100}%` }}
              ></div>
              <div
                className="bg-rose-500 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.rentTotalRequired > 0 ? (allBlocksSummary.rentDue / allBlocksSummary.rentTotalRequired) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Card 3: [PREV_MONTH] ELECTRICITY */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  {elecPeriod.monthName.toUpperCase()} ELECTRICITY
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                  Postpaid Bill
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BILL PAID</span>
                  <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tabular-nums">
                    {formatBDT(allBlocksSummary.elecPaid)}
                  </div>
                </div>
                <div className="border-l border-slate-100 pl-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BILL DUE</span>
                  <div className={`text-base sm:text-lg font-black font-mono tabular-nums ${allBlocksSummary.elecDue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {formatBDT(allBlocksSummary.elecDue)}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>{allBlocksSummary.elecPaidCount} Paid &bull; {allBlocksSummary.elecDueCount} Due</span>
                <span className="font-mono text-slate-400 text-[10px]">Req: {formatBDT(allBlocksSummary.elecTotalRequired)}</span>
              </div>
            </div>
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex shadow-inner">
              <div
                className="bg-emerald-500 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.elecTotalRequired > 0 ? (allBlocksSummary.elecPaid / allBlocksSummary.elecTotalRequired) * 100 : 100}%` }}
              ></div>
              <div
                className="bg-rose-500 h-1.5 transition-all"
                style={{ width: `${allBlocksSummary.elecTotalRequired > 0 ? (allBlocksSummary.elecDue / allBlocksSummary.elecTotalRequired) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Sub-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3 hover:border-blue-300 hover:shadow-sm transition-all">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Flat Rent Paid</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${allBlocksSummary.rentDue > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-700'}`}>
                {allBlocksSummary.rentDue > 0 ? `Due: ${formatBDT(allBlocksSummary.rentDue)}` : 'Cleared'}
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 font-mono tabular-nums truncate">{formatBDT(flatRentCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3 hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Electricity Paid</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${allBlocksSummary.elecDue > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-700'}`}>
                {allBlocksSummary.elecDue > 0 ? `Due: ${formatBDT(allBlocksSummary.elecDue)}` : 'Cleared'}
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 font-mono tabular-nums truncate">{formatBDT(electricityCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm transition-all">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Parking Rental</p>
            <p className="text-base font-bold text-slate-900 font-mono tabular-nums truncate">{formatBDT(parkingCollection)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3 hover:border-purple-300 hover:shadow-sm transition-all">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 shrink-0">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Godown Rental</p>
            <p className="text-base font-bold text-slate-900 font-mono tabular-nums truncate">{formatBDT(godownCollection)}</p>
          </div>
        </div>
      </div>



      {/* Visual Analytics Grid: Category Breakdown & Historical Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Collection by Revenue Stream
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {getMonthName(data.selectedMonth)} {data.selectedYear}
            </span>
          </div>

          {/* Visual Progress Bars */}
          <div className="space-y-4 my-2">
            {categories.map((cat) => {
              const pct = Math.round((cat.amount / catTotal) * 100);
              return (
                <div key={cat.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">{cat.label}</span>
                    <span className="font-mono text-slate-900">{formatBDT(cat.amount)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`${cat.color} h-2.5 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Total Categorized Revenue</span>
            <span className="font-bold text-slate-900 text-sm font-mono">{formatBDT(catTotal)}</span>
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                ERP Management Actions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Access the main operational financial modules for {COMPLEX_CONFIG.name}:
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <button
                onClick={() => onNavigateToView('monthly-ledger')}
                className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <p className="font-bold text-slate-900">Main Ledger</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Spreadsheet table & exports</p>
              </button>

              <button
                onClick={() => onNavigateToView('electricity')}
                className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <p className="font-bold text-slate-900">NESCO Electricity</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Sub-meter progressive slabs</p>
              </button>

              <button
                onClick={() => setIsAddUnitModalOpen(true)}
                className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Create Rental Unit</p>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                    + New Flat
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">Instant sync to Ledger & NESCO</p>
              </button>

              <button
                onClick={() => onNavigateToView('online-payments')}
                className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Online Payments</p>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                    {data.onlineRequests.filter((r) => r.verificationStatus === 'Pending').length} Pending
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">3 Block Owners MFS & +1.8% fee</p>
                <div className="flex items-center gap-1 mt-2 text-[10px] font-bold">
                  {(['Block A', 'Block B', 'Block C'] as const).map((b) => {
                    const active = data.paymentSettings?.blockConfigs?.[b]?.isMfsEnabled ?? true;
                    return (
                      <span
                        key={b}
                        className={`px-1.5 py-0.5 rounded ${
                          active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {b.split(' ')[1]}: {active ? 'ON' : 'OFF'}
                      </span>
                    );
                  })}
                </div>
              </button>
              <button
                onClick={() => exportAllCredentialsToExcel(data)}
                className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">Export Passwords</p>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                    1-Click .xlsx
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">All tenant units & authority accounts</p>
              </button>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Unresolved complaints:</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">
              {data.complaints.filter((c) => c.status !== 'Resolved').length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Create New Rental Unit Modal */}
      <CreateUnitModal
        isOpen={isAddUnitModalOpen}
        onClose={() => setIsAddUnitModalOpen(false)}
        data={data}
        onAddUnit={onAddUnit || (() => {})}
      />
    </div>
  );
};

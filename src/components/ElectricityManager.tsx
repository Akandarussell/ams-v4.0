import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Calculator,
  Printer,
  Receipt,
  FileCheck,
  AlertTriangle,
  Settings,
  Calendar,
  Layers,
  ChevronRight,
  TrendingDown,
  Info,
  Search,
  Filter,
  X,
  Building,
  SlidersHorizontal,
  Download,
  ToggleLeft,
  ToggleRight,
  ZapOff,
  Warehouse,
  Home,
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import {
  AppDatabaseState,
  ElectricityBill,
  PrintableReceipt,
} from '../types';
import {
  calculateNescoElectricityBill,
  formatBDT,
  getMonthName,
  MONTH_NAMES,
  DEFAULT_NESCO_TARIFF,
  getPostpaidElectricityPeriod,
  getPostpaidElectricityTenantInfo,
} from '../lib/nescoTariff';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { DateInputDDMMYYYY } from './DateInputDDMMYYYY';
import { compareFlatIdSerial } from '../lib/storage';

interface Props {
  data: AppDatabaseState;
  onGenerateElectricityBills: (consumptionMonth: number, consumptionYear: number, billingMonth: number, billingYear: number) => void;
  onUpdateMeterReading: (flatId: string, currentReading: number, consumptionMonth: number, consumptionYear: number) => void;
  onToggleUnitElectricity?: (flatId: string, enabled: boolean) => void;
  onViewBill: (bill: ElectricityBill) => void;
  onViewReceipt: (receipt: PrintableReceipt) => void;
  onOpenTariffModal: () => void;
  userRole: string;
}

export const ElectricityManager: React.FC<Props> = ({
  data,
  onGenerateElectricityBills,
  onUpdateMeterReading,
  onToggleUnitElectricity,
  onViewBill,
  onViewReceipt,
  onOpenTariffModal,
  userRole,
}) => {
  // Consumption month is strictly postpaid: if flat rent month is August (8), electricity billing period is July (7)
  const defaultElecPeriod = getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear);
  const [consumptionMonth, setConsumptionMonth] = useState<number>(defaultElecPeriod.month);
  const [consumptionYear, setConsumptionYear] = useState<number>(defaultElecPeriod.year);

  // Automatically update consumption period when selected month/year changes
  useEffect(() => {
    const elecPeriod = getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear);
    setConsumptionMonth(elecPeriod.month);
    setConsumptionYear(elecPeriod.year);
  }, [data.selectedMonth, data.selectedYear]);

  const [activeTab, setActiveTab] = useState<'bills' | 'readings' | 'calculator'>('bills');

  // Filter Bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [blockFilter, setBlockFilter] = useState<string>('all');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [readingsStatusFilter, setReadingsStatusFilter] = useState<'all' | 'on' | 'off'>('all');
  const [sortBy, setSortBy] = useState<'flat' | 'units' | 'bill'>('flat');

  // Interactive Live Calculator & Bill Generator state (from user's template)
  const [calcPrev, setCalcPrev] = useState<number>(1850);
  const [calcCurr, setCalcCurr] = useState<number>(2125);
  const [calcLoad, setCalcLoad] = useState<number>(3);

  const [genFlat, setGenFlat] = useState<string>('B6');
  const [genDateFrom, setGenDateFrom] = useState<string>('2026-09-01');
  const [genDateTo, setGenDateTo] = useState<string>('2026-09-30');
  const [genInputMethod, setGenInputMethod] = useState<'calculate' | 'direct'>('calculate');
  const [genPrevReading, setGenPrevReading] = useState<number>(1050);
  const [genCurrReading, setGenCurrReading] = useState<number>(1180);
  const [genDirectUnits, setGenDirectUnits] = useState<number>(130);
  const [genRateMethod, setGenRateMethod] = useState<'slab' | 'fixed'>('slab');
  const [genFixedRate, setGenFixedRate] = useState<number>(15.01);
  const [genDemandRate, setGenDemandRate] = useState<number>(42);
  const [genSanctionedLoad, setGenSanctionedLoad] = useState<number>(3);
  const [genMeterRent, setGenMeterRent] = useState<number>(40);
  const [genVatRate, setGenVatRate] = useState<number>(5);
  const [generatedBillPreview, setGeneratedBillPreview] = useState<any | null>(null);
  const [isDownloadingBillPng, setIsDownloadingBillPng] = useState<boolean>(false);
  const billPreviewRef = useRef<HTMLDivElement>(null);

  const handleGeneratePreviewBill = () => {
    const units = genInputMethod === 'calculate'
      ? Math.max(0, genCurrReading - genPrevReading)
      : Math.max(0, genDirectUnits);

    if (units <= 0) {
      alert("Please enter valid readings or units greater than 0.");
      return;
    }

    const demandCharge = genDemandRate * genSanctionedLoad;
    let steps: { label: string; formula: string; cost: number }[] = [];
    let energyCharge = 0;

    if (genRateMethod === 'fixed') {
      energyCharge = units * genFixedRate;
      steps.push({
        label: "Fixed Rate",
        formula: `(${units} x ${genFixedRate})`,
        cost: energyCharge,
      });
    } else {
      const calcResult = calculateNescoElectricityBill(
        genInputMethod === 'calculate' ? genCurrReading : genDirectUnits,
        genInputMethod === 'calculate' ? genPrevReading : 0,
        {
          ...(data.tariffConfig || DEFAULT_NESCO_TARIFF),
          demandChargePerKW: genDemandRate,
          meterRent: genMeterRent,
          vatPercentage: genVatRate,
        },
        genSanctionedLoad
      );
      energyCharge = calcResult.baseEnergyCost;
      steps = calcResult.slabBreakdown.map((sb) => ({
        label: sb.slabName,
        formula: `(${sb.units} x ${sb.rate.toFixed(2)})`,
        cost: sb.amount,
      }));
    }

    const subtotal = energyCharge + demandCharge + genMeterRent;
    const vat = subtotal * (genVatRate / 100);
    const totalPayable = subtotal + vat;

    const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === genFlat.toLowerCase().trim());
    const tenant = data.tenants.find((t) => t.id === unit?.tenantId || t.flatId.toLowerCase().trim() === genFlat.toLowerCase().trim());

    setGeneratedBillPreview({
      flat: genFlat,
      block: unit?.blockName || 'Block B',
      tenantName: tenant?.fullName || '',
      dateFrom: genDateFrom,
      dateTo: genDateTo,
      dateGenerated: new Date().toLocaleDateString('en-GB'),
      inputMethod: genInputMethod,
      prevReading: genPrevReading,
      currReading: genCurrReading,
      units,
      steps,
      energyCharge,
      demandCharge,
      meterRent: genMeterRent,
      subtotal,
      vatRate: genVatRate,
      vat,
      totalPayable,
      sanctionedLoad: genSanctionedLoad,
      demandRate: genDemandRate,
    });
  };

  const handleDownloadBillPng = async () => {
    if (!billPreviewRef.current || !generatedBillPreview) return;
    setIsDownloadingBillPng(true);
    try {
      const canvas = await html2canvas(billPreviewRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const d = generatedBillPreview.dateTo ? new Date(generatedBillPreview.dateTo) : new Date();
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const targetMonth = monthNames[d.getMonth()] || "Month";
      const targetYear = String(d.getFullYear()).slice(-2);
      const filename = `${generatedBillPreview.flat} Electricity bill ${targetMonth} ${targetYear}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generating bill PNG:', err);
    } finally {
      setIsDownloadingBillPng(false);
    }
  };

  // Meter reading input states for inline recording
  const [editingReadings, setEditingReadings] = useState<{ [flatId: string]: number }>({});
  const [readingError, setReadingError] = useState<{ [flatId: string]: string }>({});

  // Specific Flats and Godowns eligible for sub-metering (excluding garage/parking)
  const eligibleUnits = data.units.filter(
    (u) => u.unitType === 'residential' || u.unitType === 'godown'
  );

  const activeElecUnits = eligibleUnits.filter(
    (u) => (u.isElectricityEnabled ?? (u.electricityBillingType === 'nesco_submeter')) && u.electricityBillingType !== 'none'
  );

  // Bills for the active billing cycle
  const currentBills = data.electricityBills.filter(
    (b) => b.consumptionMonth === consumptionMonth && b.consumptionYear === consumptionYear
  );

  const isFilterActive = searchQuery.trim() !== '' || blockFilter !== 'all' || billStatusFilter !== 'all' || sortBy !== 'flat';

  const resetFilters = () => {
    setSearchQuery('');
    setBlockFilter('all');
    setBillStatusFilter('all');
    setSortBy('flat');
  };

  // Filtered bills
  const filteredBills = currentBills
    .filter((b) => {
      const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === b.flatId.toLowerCase().trim());
      if (blockFilter !== 'all' && unit?.blockName !== blockFilter) return false;
      if (billStatusFilter === 'paid' && b.paymentStatus !== 'Paid') return false;
      if (billStatusFilter === 'unpaid' && b.paymentStatus === 'Paid') return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        b.flatId.toLowerCase().includes(q) ||
        b.tenantName.toLowerCase().includes(q) ||
        (unit?.blockName.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'units') return (b.consumedUnits - a.consumedUnits) || compareFlatIdSerial(a.flatId, b.flatId);
      if (sortBy === 'bill') return (b.totalBill - a.totalBill) || compareFlatIdSerial(a.flatId, b.flatId);
      return compareFlatIdSerial(a.flatId, b.flatId);
    });

  // Filtered readings list for Monthly Sub-Meter Readings Input
  const filteredReadings = eligibleUnits
    .filter((unit) => {
      const isElecOn = (unit.isElectricityEnabled ?? (unit.electricityBillingType === 'nesco_submeter')) && unit.electricityBillingType !== 'none';
      if (readingsStatusFilter === 'on' && !isElecOn) return false;
      if (readingsStatusFilter === 'off' && isElecOn) return false;
      if (blockFilter !== 'all' && unit.blockName !== blockFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const tenant = data.tenants.find((t) => t.id === unit.tenantId);
      return (
        unit.flatId.toLowerCase().includes(q) ||
        unit.blockName.toLowerCase().includes(q) ||
        unit.unitType.toLowerCase().includes(q) ||
        (tenant?.fullName.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  const totalConsumedKwh = currentBills.reduce((acc, b) => acc + b.consumedUnits, 0);
  const totalBilledBDT = currentBills.reduce((acc, b) => acc + b.totalBill, 0);
  const totalPaidBDT = currentBills.reduce((acc, b) => acc + b.paidAmount, 0);

  // Calculator computation
  const liveCalcResult = calculateNescoElectricityBill(calcCurr, calcPrev, data.tariffConfig, calcLoad);

  const handleReadingChange = (flatId: string, value: number, previousReading: number) => {
    if (value < previousReading) {
      setReadingError((prev) => ({
        ...prev,
        [flatId]: `Current reading (${value}) cannot be less than previous reading (${previousReading})`,
      }));
    } else {
      setReadingError((prev) => {
        const copy = { ...prev };
        delete copy[flatId];
        return copy;
      });
    }
    setEditingReadings((prev) => ({
      ...prev,
      [flatId]: value,
    }));
  };

  const handleSaveReading = (flatId: string, prevReading: number) => {
    const current = editingReadings[flatId];
    if (current === undefined || current < prevReading) return;
    onUpdateMeterReading(flatId, current, consumptionMonth, consumptionYear);
  };

  const handleBatchGenerate = () => {
    onGenerateElectricityBills(consumptionMonth, consumptionYear, data.selectedMonth, data.selectedYear);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Zap className="w-6 h-6" />
          </span>
          <div>
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              {COMPLEX_CONFIG.name} &bull; NESCO Rajshahi Zone
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <h1 className="text-xl font-bold text-slate-900">
                NESCO Postpaid Electricity Management
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[11px] font-bold">
                LT-A Residential
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {COMPLEX_CONFIG.address} &bull; Hotline: <strong className="text-slate-800">{COMPLEX_CONFIG.contacts}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {userRole === 'manager' && (
            <>
              <button
                onClick={onOpenTariffModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
              >
                <Settings className="w-4 h-4" />
                Tariff Settings
              </button>
              <button
                onClick={handleBatchGenerate}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Calculator className="w-4 h-4" />
                Generate {getMonthName(consumptionMonth)} Bills
              </button>
            </>
          )}
        </div>
      </div>

      {/* Postpaid Cycle Notice & Month Selector */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900">Postpaid Electricity Billing Cycle:</span>
            <p className="text-amber-800">
              Postpaid service rule: If flat rent month is <strong>{getMonthName(data.selectedMonth)} {data.selectedYear}</strong>, the electricity billing period is <strong>{getPostpaidElectricityPeriod(data.selectedMonth, data.selectedYear).displayStr}</strong>. Meter readings taken for <strong>{getMonthName(consumptionMonth)} {consumptionYear}</strong> consumption generate the electricity bill collected in <strong>{getMonthName(data.selectedMonth)} {data.selectedYear}</strong> rent.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-xl border border-amber-300 min-h-[44px]">
          <span className="font-bold text-slate-700 text-xs shrink-0">Consumption Period:</span>
          <select
            value={consumptionMonth}
            onChange={(e) => setConsumptionMonth(Number(e.target.value))}
            className="text-slate-800 font-semibold focus:outline-hidden text-xs min-h-[36px] bg-slate-50 border border-slate-200 rounded-lg px-2"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={consumptionYear}
            onChange={(e) => setConsumptionYear(Number(e.target.value))}
            className="text-slate-800 font-semibold focus:outline-hidden text-xs min-h-[36px] bg-slate-50 border border-slate-200 rounded-lg px-2"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sub-metered Units</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {activeElecUnits.length} ON
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {activeElecUnits.length} / {eligibleUnits.length} Units
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {eligibleUnits.length - activeElecUnits.length} flats/godowns excluded (OFF) &bull; Garage units exempt
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Electricity Billed</span>
          <div className="text-2xl font-black text-amber-600 mt-2 font-mono tabular-nums">
            {formatBDT(totalBilledBDT)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Progressive slab rate + ৳42/KW demand + 5% VAT
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collected Amount</span>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono tabular-nums">
            {formatBDT(totalPaidBDT)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {Math.round((totalPaidBDT / (totalBilledBDT || 1)) * 100)}% collected for this billing period
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-slate-200 gap-4 sm:gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('bills')}
          className={`min-h-[44px] py-2 px-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'bills'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Electricity Bills ({currentBills.length})
        </button>
        <button
          onClick={() => setActiveTab('readings')}
          className={`min-h-[44px] py-2 px-1 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'readings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Monthly Sub-Meter Readings Input</span>
          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
            {activeElecUnits.length} ON
          </span>
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`min-h-[44px] py-2 px-1 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'calculator'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Electricity Bill Generator Panel
        </button>
      </div>

      {/* TAB 1: GENERATED BILLS TABLE */}
      {activeTab === 'bills' && (
        <div className="space-y-4">
          {/* Data Filtering Bar for Electricity Bills */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
                  Electricity Bills Filter Bar
                </span>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setBillStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    billStatusFilter === 'all'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All ({currentBills.length})
                </button>
                <button
                  onClick={() => setBillStatusFilter('paid')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    billStatusFilter === 'paid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                  }`}
                >
                  Paid ({currentBills.filter(b => b.paymentStatus === 'Paid').length})
                </button>
                <button
                  onClick={() => setBillStatusFilter('unpaid')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    billStatusFilter === 'unpaid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-rose-300 hover:bg-slate-700'
                  }`}
                >
                  Unpaid ({currentBills.filter(b => b.paymentStatus !== 'Paid').length})
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search */}
                <div className="relative min-w-[200px] sm:min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search Flat or Tenant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Block Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Block:</span>
                  <select
                    value={blockFilter}
                    onChange={(e) => setBlockFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="all">All Blocks</option>
                    <option value="Block A">Block A</option>
                    <option value="Block B">Block B</option>
                    <option value="Block C">Block C</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="flat">Flat ID</option>
                    <option value="units">Consumed Units (High to Low)</option>
                    <option value="bill">Bill Amount (High to Low)</option>
                  </select>
                </div>

                {isFilterActive && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="text-slate-500 font-medium">
                Showing <strong className="text-slate-800">{filteredBills.length}</strong> of {currentBills.length} bills
              </div>
            </div>
          </div>

          {/* Mobile View: Electricity Bills Cards */}
          <div className="block md:hidden space-y-4">
            {filteredBills.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-sans">
                No electricity bills found matching your filter criteria.
              </div>
            ) : (
              filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-blue-700 text-base">
                          Flat {bill.flatId}
                        </span>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            bill.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {bill.paymentStatus}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                        {bill.tenantName}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-sans block">Total Bill</span>
                      <span className="font-black text-amber-700 text-base font-mono">
                        {formatBDT(bill.totalBill)}
                      </span>
                    </div>
                  </div>

                  {/* Key Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs tabular-nums">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Consumed Units:</span>
                      <span className="font-extrabold text-blue-700 font-mono text-sm">
                        {bill.consumedUnits} kWh
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Readings:</span>
                      <span className="font-mono text-slate-700 text-xs">
                        {bill.previousReading} &rarr; {bill.currentReading}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Energy Cost:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatBDT(bill.baseEnergyCost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Demand + VAT:</span>
                      <span className="font-semibold text-slate-600 font-mono">
                        {formatBDT(bill.demandCharge + bill.vatAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onViewBill(bill)}
                      className="min-h-[44px] flex-1 px-4 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-amber-200"
                    >
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>View Bill</span>
                    </button>
                    {bill.paidAmount > 0 && bill.paymentStatus === 'Paid' && (
                      <button
                        onClick={() => {
                          const priorOccupant = getPostpaidElectricityTenantInfo(
                            bill.flatId,
                            bill.consumptionMonth,
                            bill.consumptionYear,
                            data,
                            bill.tenantName,
                            ''
                          );
                          onViewReceipt({
                            receiptNumber: bill.receiptNo || `REC-ELEC-${bill.flatId}-01`,
                            type: 'electricity',
                            tenantName: priorOccupant.tenantName || bill.tenantName,
                            tenantPhone: priorOccupant.tenantPhone,
                            flatId: bill.flatId,
                            blockName: '',
                            amount: bill.paidAmount,
                            paymentDate: bill.generatedDate,
                            paymentMethod: 'Cash',
                            monthName: getMonthName(bill.consumptionMonth),
                            year: bill.consumptionYear,
                            purpose: `Electricity Bill Payment for ${getMonthName(bill.consumptionMonth)} ${bill.consumptionYear} consumption`,
                            remainingDue: bill.dueAmount,
                            authorizedSignatureBy: 'Russell',
                            signatureTitle: 'Russell (Manager)',
                            breakdown: [
                              { label: `Consumed ${bill.consumedUnits} Units Energy Cost`, amount: bill.baseEnergyCost },
                              { label: 'Demand Charge (2 kW)', amount: bill.demandCharge },
                              { label: 'Government VAT (5%)', amount: bill.vatAmount },
                              { label: 'Meter Rent', amount: bill.meterRent },
                            ],
                          });
                        }}
                        className="min-h-[44px] px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-blue-200"
                        title="Payment Receipt"
                        aria-label="Payment Receipt"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Receipt</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View: Dense Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="table-scroll-container">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20 shadow-xs">
                  <tr>
                    <th className="py-3.5 px-4 sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">Flat ID</th>
                    <th className="py-3.5 px-4">Tenant Name</th>
                    <th className="py-3.5 px-4 text-center">Previous Reading</th>
                    <th className="py-3.5 px-4 text-center">Current Reading</th>
                    <th className="py-3.5 px-4 text-center">Consumed (kWh)</th>
                    <th className="py-3.5 px-4 text-right">Energy Cost</th>
                    <th className="py-3.5 px-4 text-right">Demand (৳)</th>
                    <th className="py-3.5 px-4 text-right">5% VAT</th>
                    <th className="py-3.5 px-4 text-right font-bold text-amber-300">Total Bill</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500 font-sans">
                        No electricity bills found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((bill) => (
                    <tr key={bill.id} className="group hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-blue-700 font-sans sticky left-0 bg-white group-hover:bg-amber-50/70 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        Flat {bill.flatId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 font-sans">
                        {bill.tenantName}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-mono">
                        {bill.previousReading}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900 font-mono">
                        {bill.currentReading}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-blue-700 font-mono">
                        {bill.consumedUnits}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-800">
                        {formatBDT(bill.baseEnergyCost)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatBDT(bill.demandCharge)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {formatBDT(bill.vatAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-700 text-sm">
                        {formatBDT(bill.totalBill)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            bill.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {bill.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans no-print">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewBill(bill)}
                            className="min-h-[36px] px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center"
                          >
                            View Bill
                          </button>
                          {bill.paidAmount > 0 && bill.paymentStatus === 'Paid' && (
                            <button
                              onClick={() => {
                                const priorOccupant = getPostpaidElectricityTenantInfo(
                                  bill.flatId,
                                  bill.consumptionMonth,
                                  bill.consumptionYear,
                                  data,
                                  bill.tenantName,
                                  ''
                                );
                                onViewReceipt({
                                  receiptNumber: bill.receiptNo || `REC-ELEC-${bill.flatId}-01`,
                                  type: 'electricity',
                                  tenantName: priorOccupant.tenantName || bill.tenantName,
                                  tenantPhone: priorOccupant.tenantPhone,
                                  flatId: bill.flatId,
                                  blockName: '',
                                  amount: bill.paidAmount,
                                  paymentDate: bill.generatedDate,
                                  paymentMethod: 'Cash',
                                  monthName: getMonthName(bill.consumptionMonth),
                                  year: bill.consumptionYear,
                                  purpose: `Electricity Bill Payment for ${getMonthName(bill.consumptionMonth)} ${bill.consumptionYear} consumption`,
                                  remainingDue: bill.dueAmount,
                                  authorizedSignatureBy: 'Russell',
                                  signatureTitle: 'Russell (Manager)',
                                  breakdown: [
                                    { label: `Consumed ${bill.consumedUnits} Units Energy Cost`, amount: bill.baseEnergyCost },
                                    { label: 'Demand Charge (2 kW)', amount: bill.demandCharge },
                                    { label: 'Government VAT (5%)', amount: bill.vatAmount },
                                    { label: 'Meter Rent', amount: bill.meterRent },
                                  ],
                                });
                              }}
                              className="min-w-[36px] min-h-[36px] p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                              title="Payment Receipt"
                              aria-label="Payment Receipt"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* TAB 2: ENTER METER READINGS (Monthly Sub-Meter Readings Input) */}
      {activeTab === 'readings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Monthly Sub-Meter Readings Input ({getMonthName(consumptionMonth)} {consumptionYear})
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {activeElecUnits.length} Active ON / {eligibleUnits.length - activeElecUnits.length} OFF
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle Electricity Bill & Receipt generation ON/OFF for specific residential flats and godowns. Garage/parking units are excluded.
              </p>
            </div>

            {/* Quick Status Pill Filters for Readings Tab */}
            <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setReadingsStatusFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  readingsStatusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({eligibleUnits.length})
              </button>
              <button
                type="button"
                onClick={() => setReadingsStatusFilter('on')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  readingsStatusFilter === 'on'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Active ON ({activeElecUnits.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setReadingsStatusFilter('off')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  readingsStatusFilter === 'off'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ZapOff className="w-3 h-3" />
                <span>Disabled OFF ({eligibleUnits.length - activeElecUnits.length})</span>
              </button>
            </div>
          </div>

          {/* Mobile View: Meter Readings Cards */}
          <div className="block md:hidden space-y-4">
            {filteredReadings.length === 0 ? (
              <div className="py-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 font-sans text-xs">
                No units found matching your filter criteria.
              </div>
            ) : (
              filteredReadings.map((unit) => {
                const isElecOn = (unit.isElectricityEnabled ?? (unit.electricityBillingType === 'nesco_submeter')) && unit.electricityBillingType !== 'none';
                const mr = data.meterReadings.find(
                  (r) => r.unitId === unit.id && r.month === consumptionMonth && r.year === consumptionYear
                );
                const prevReading = mr?.previousReading || 1500;
                const currentInput = editingReadings[unit.flatId] !== undefined
                  ? editingReadings[unit.flatId]
                  : mr?.currentReading || prevReading + 200;
                const consumed = isElecOn ? Math.max(0, currentInput - prevReading) : 0;
                const error = readingError[unit.flatId];

                return (
                  <div
                    key={unit.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                      isElecOn ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/70 border-slate-200 text-slate-400'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                          {unit.unitType === 'godown' ? (
                            <Warehouse className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Home className="w-4 h-4 text-blue-600" />
                          )}
                        </span>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-sm">
                            {unit.unitType === 'godown' ? `Godown ${unit.flatId}` : `Flat ${unit.flatId}`}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {unit.blockName} &bull; <span className="capitalize">{unit.unitType}</span>
                          </span>
                        </div>
                      </div>

                      {/* Toggle Button */}
                      {userRole === 'manager' ? (
                        <button
                          type="button"
                          onClick={() => onToggleUnitElectricity?.(unit.flatId, !isElecOn)}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs border flex items-center gap-1.5 ${
                            isElecOn
                              ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          {isElecOn ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-emerald-200" />
                              <span>Bill ON</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-slate-400" />
                              <span>Bill OFF</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            isElecOn
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {isElecOn ? 'ON' : 'OFF'}
                        </span>
                      )}
                    </div>

                    {isElecOn ? (
                      <>
                        {/* Readings stats */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 font-sans block">Previous Reading:</span>
                            <span className="font-bold text-slate-700 text-sm">{prevReading} kWh</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-sans block">Consumed:</span>
                            <span className="font-extrabold text-emerald-600 text-sm">{consumed} kWh</span>
                          </div>
                        </div>

                        {/* Current Reading input */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            Current Meter Reading:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={currentInput}
                              onChange={(e) => handleReadingChange(unit.flatId, Number(e.target.value), prevReading)}
                              className="min-h-[44px] flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-base sm:text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            />
                            <button
                              onClick={() => handleSaveReading(unit.flatId, prevReading)}
                              disabled={Boolean(error)}
                              className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors shrink-0 flex items-center justify-center"
                            >
                              Save
                            </button>
                          </div>
                          {error && <p className="text-[11px] text-rose-600 font-sans font-medium mt-1">{error}</p>}
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-slate-100/80 rounded-xl text-center text-slate-500 text-xs">
                        Excluded from electricity billing & receipt generation
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Dense Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden text-xs">
            <div className="table-scroll-container">
              <table className="w-full text-left min-w-[760px] border-collapse">
                <thead className="bg-slate-900 text-white font-semibold sticky top-0 z-20 shadow-xs">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-900 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.35)]">Flat / Godown ID</th>
                    <th className="py-3 px-3 whitespace-nowrap">Block & Type</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">
                      Electricity Bill & Receipt
                    </th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Previous Reading (Stored)</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Current Reading</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Consumed Units</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredReadings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500 font-sans">
                        No units found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredReadings.map((unit) => {
                      const isElecOn = (unit.isElectricityEnabled ?? (unit.electricityBillingType === 'nesco_submeter')) && unit.electricityBillingType !== 'none';
                      const mr = data.meterReadings.find(
                        (r) => r.unitId === unit.id && r.month === consumptionMonth && r.year === consumptionYear
                      );
                      const prevReading = mr?.previousReading || 1500;
                      const currentInput = editingReadings[unit.flatId] !== undefined
                        ? editingReadings[unit.flatId]
                        : mr?.currentReading || prevReading + 200;
                      const consumed = isElecOn ? Math.max(0, currentInput - prevReading) : 0;
                      const error = readingError[unit.flatId];

                      return (
                        <tr key={unit.id} className={`group transition-colors ${isElecOn ? 'hover:bg-slate-50/70' : 'bg-slate-50/40 text-slate-400'}`}>
                          {/* Flat / Godown ID */}
                          <td className={`py-3 px-4 font-bold font-sans sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] ${
                            isElecOn ? 'bg-white group-hover:bg-slate-50' : 'bg-slate-50/90'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {unit.unitType === 'godown' ? (
                                <Warehouse className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              ) : (
                                <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              )}
                              <span className={isElecOn ? 'text-blue-700 font-extrabold' : 'text-slate-500'}>
                                {unit.unitType === 'godown' ? `Godown ${unit.flatId}` : `Flat ${unit.flatId}`}
                              </span>
                            </div>
                          </td>

                          {/* Block & Type */}
                          <td className="py-3 px-3 font-sans text-slate-600">
                            <span className="font-medium">{unit.blockName}</span>
                            <span className="block text-[10px] text-slate-400 capitalize">{unit.unitType}</span>
                          </td>

                          {/* Electricity Bill & Receipt ON/OFF Toggle Button */}
                          <td className="py-3 px-3 text-center font-sans">
                            {userRole === 'manager' ? (
                              <button
                                type="button"
                                onClick={() => onToggleUnitElectricity?.(unit.flatId, !isElecOn)}
                                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs border ${
                                  isElecOn
                                    ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                                    : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                                }`}
                                title={isElecOn ? "Electricity bill & receipt enabled. Click to turn OFF." : "Electricity bill & receipt disabled. Click to turn ON."}
                              >
                                {isElecOn ? (
                                  <>
                                    <ToggleRight className="w-4 h-4 text-emerald-200" />
                                    <span>ON</span>
                                  </>
                                ) : (
                                  <>
                                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                                    <span>OFF</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isElecOn
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {isElecOn ? 'ON' : 'OFF'}
                              </span>
                            )}
                            <span className="block text-[9.5px] mt-0.5 text-slate-400">
                              {isElecOn ? 'Bill & Receipt ON' : 'No Bill / Receipt'}
                            </span>
                          </td>

                          {/* Previous Reading */}
                          <td className="py-3 px-4 text-center text-slate-600 font-bold font-mono">
                            {isElecOn ? prevReading : '-'}
                          </td>

                          {/* Current Reading */}
                          <td className="py-3 px-4 text-center">
                            {isElecOn ? (
                              <>
                                <input
                                  type="number"
                                  value={currentInput}
                                  onChange={(e) => handleReadingChange(unit.flatId, Number(e.target.value), prevReading)}
                                  className="w-28 min-h-[36px] px-2 py-1 bg-white border border-slate-300 rounded text-center font-bold font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                                {error && <p className="text-[10px] text-rose-600 font-sans mt-0.5">{error}</p>}
                              </>
                            ) : (
                              <span className="text-slate-400 italic text-[11px] font-sans">
                                Disabled (OFF)
                              </span>
                            )}
                          </td>

                          {/* Consumed Units */}
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {isElecOn ? (
                              <span className="text-emerald-600">{consumed} kWh</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-center font-sans">
                            {isElecOn ? (
                              <button
                                onClick={() => handleSaveReading(unit.flatId, prevReading)}
                                disabled={Boolean(error)}
                                className="min-h-[36px] px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                              >
                                Save
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                Excluded
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ELECTRICITY BILL GENERATOR PANEL & SIMULATOR (FROM USER TEMPLATE) */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* LEFT COLUMN: Input Form Panel */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-5 border-b border-gray-200 pb-3 flex items-center justify-between">
              <span>Bill Generator Panel</span>
              <span className="text-xs font-normal text-slate-500">NESCO Tariffs</span>
            </h2>

            <form onSubmit={(e) => { e.preventDefault(); handleGeneratePreviewBill(); }} className="space-y-4 text-xs">
              {/* Select Flat */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Flat
                </label>
                <select
                  value={genFlat}
                  onChange={(e) => {
                    const f = e.target.value;
                    setGenFlat(f);
                    const unit = data.units.find((u) => u.flatId === f);
                    if (unit) {
                      setGenPrevReading(unit.meterPreviousReading || 0);
                      setGenCurrReading(unit.meterCurrentReading || (unit.meterPreviousReading || 0) + 120);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <optgroup label="Block A">
                    {data.units.filter((u) => u.blockName === 'Block A').map((u) => (
                      <option key={u.id} value={u.flatId}>Flat {u.flatId}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Block B">
                    {data.units.filter((u) => u.blockName === 'Block B').map((u) => (
                      <option key={u.id} value={u.flatId}>Flat {u.flatId}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Block C">
                    {data.units.filter((u) => u.blockName === 'Block C').map((u) => (
                      <option key={u.id} value={u.flatId}>Flat {u.flatId}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Commercial / Office">
                    {data.units.filter((u) => u.unitType === 'commercial').map((u) => (
                      <option key={u.id} value={u.flatId}>{u.flatId}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Billing Period */}
              <div className="grid grid-cols-2 gap-3">
                <DateInputDDMMYYYY
                  label="Period From"
                  value={genDateFrom}
                  onChange={setGenDateFrom}
                  isEnabled={true}
                />
                <DateInputDDMMYYYY
                  label="Period To"
                  value={genDateTo}
                  onChange={setGenDateTo}
                  isEnabled={true}
                />
              </div>

              {/* Unit Input Method Toggle */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Unit Input Method
                </label>
                <div className="flex items-center space-x-5">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="inputMethod"
                      value="calculate"
                      checked={genInputMethod === 'calculate'}
                      onChange={() => setGenInputMethod('calculate')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-xs text-gray-700 font-medium">Calculate from Readings</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="inputMethod"
                      value="direct"
                      checked={genInputMethod === 'direct'}
                      onChange={() => setGenInputMethod('direct')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-xs text-gray-700 font-medium">Direct Unit Entry</span>
                  </label>
                </div>
              </div>

              {/* Readings Input (If calculate mode) */}
              {genInputMethod === 'calculate' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Previous Reading</label>
                    <input
                      type="number"
                      min="0"
                      value={genPrevReading}
                      onChange={(e) => setGenPrevReading(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Reading</label>
                    <input
                      type="number"
                      min="0"
                      value={genCurrReading}
                      onChange={(e) => setGenCurrReading(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Direct Consumed Units (kWh)</label>
                  <input
                    type="number"
                    min="0"
                    value={genDirectUnits}
                    onChange={(e) => setGenDirectUnits(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 150"
                  />
                </div>
              )}

              {/* Total Consumption Display */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Total Consumption (Units)
                </label>
                <div className="w-full border border-gray-300 rounded-lg p-2 bg-gray-100 font-bold text-base text-blue-700 font-mono">
                  {genInputMethod === 'calculate' ? Math.max(0, genCurrReading - genPrevReading) : Math.max(0, genDirectUnits)} Units
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {genInputMethod === 'calculate' ? 'Automatically calculated from readings difference.' : 'Manually entered consumption units.'}
                </p>
              </div>

              {/* Rate Calculation Method */}
              <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                  Rate Calculation Method
                </label>
                <div className="flex items-center space-x-5">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="rateMethod"
                      value="slab"
                      checked={genRateMethod === 'slab'}
                      onChange={() => setGenRateMethod('slab')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-xs text-gray-800 font-medium">Standard Slabs (BERC NESCO)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="rateMethod"
                      value="fixed"
                      checked={genRateMethod === 'fixed'}
                      onChange={() => setGenRateMethod('fixed')}
                      className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-xs text-gray-800 font-medium">Fixed Rate</span>
                  </label>
                </div>

                {genRateMethod === 'fixed' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fixed Rate per Unit (৳)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={genFixedRate}
                      onChange={(e) => setGenFixedRate(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Additional Charges Settings */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-t border-gray-100 pt-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Demand Rate (৳)</label>
                  <input
                    type="number"
                    value={genDemandRate}
                    onChange={(e) => setGenDemandRate(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Sanctioned (kW)</label>
                  <input
                    type="number"
                    value={genSanctionedLoad}
                    onChange={(e) => setGenSanctionedLoad(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">Meter Rent (৳)</label>
                  <input
                    type="number"
                    value={genMeterRent}
                    onChange={(e) => setGenMeterRent(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">VAT (%)</label>
                  <input
                    type="number"
                    value={genVatRate}
                    onChange={(e) => setGenVatRate(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-md text-xs cursor-pointer"
              >
                Generate & Preview Bill
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Bill Preview & PNG Download */}
          <div className="flex flex-col items-center w-full">
            {generatedBillPreview ? (
              <div className="w-full max-w-md flex flex-col items-center">
                {/* Download PNG Button (from user's template) */}
                <div className="w-full mb-3">
                  <button
                    onClick={handleDownloadBillPng}
                    disabled={isDownloadingBillPng}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-md flex justify-center items-center gap-2 text-xs cursor-pointer animate-pulse"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloadingBillPng ? 'Exporting PNG...' : 'Download Bill as PNG'}</span>
                  </button>
                </div>

                {/* The Bill Receipt Card matching user's template */}
                <div
                  ref={billPreviewRef}
                  className="bg-white p-6 sm:p-7 border border-gray-200 shadow-xl rounded-sm w-full relative overflow-hidden text-gray-800 text-xs font-sans"
                >
                  {/* Decorative top bar */}
                  <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>

                  {/* Header */}
                  <div className="text-center border-b-2 border-gray-100 pb-3 mb-3 mt-1">
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
                  <div className="grid grid-cols-2 gap-2.5 mb-3 text-xs">
                    <div>
                      <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Flat No</p>
                      <p className="font-bold text-base text-gray-800">
                        Flat {generatedBillPreview.flat}
                      </p>
                      {generatedBillPreview.tenantName && (
                        <p className="text-gray-600 text-[11px] font-medium">{generatedBillPreview.tenantName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Date Generated</p>
                      <p className="font-medium text-gray-800">{generatedBillPreview.dateGenerated}</p>
                    </div>
                    <div className="col-span-2 bg-gray-50 p-2 rounded-md border border-gray-100">
                      <p className="text-gray-500 uppercase tracking-wider mb-0.5 text-[10px] font-bold">Billing Period</p>
                      <p className="font-medium text-gray-800">
                        {generatedBillPreview.dateFrom} to {generatedBillPreview.dateTo}
                      </p>
                    </div>
                  </div>

                  {/* Reading Details */}
                  {generatedBillPreview.inputMethod === 'calculate' ? (
                    <div className="flex justify-between items-center mb-3 text-xs border-b border-gray-100 pb-2.5 font-mono">
                      <div>
                        <p className="text-gray-500 text-[10px] font-sans">Previous Reading</p>
                        <p className="font-medium text-sm text-gray-800">{generatedBillPreview.prevReading}</p>
                      </div>
                      <div className="text-gray-400 font-bold">-</div>
                      <div>
                        <p className="text-gray-500 text-[10px] font-sans">Current Reading</p>
                        <p className="font-medium text-sm text-gray-800">{generatedBillPreview.currReading}</p>
                      </div>
                      <div className="text-gray-400 font-bold">=</div>
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] font-sans">Total Units</p>
                        <p className="font-bold text-blue-600 text-sm">{generatedBillPreview.units} Units</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center mb-3 text-xs border-b border-gray-100 pb-2.5">
                      <span className="text-gray-600 font-medium">Total Consumed Units:</span>
                      <span className="font-bold text-blue-600 text-base font-mono">{generatedBillPreview.units} Units</span>
                    </div>
                  )}

                  {/* Detailed Breakdown Section */}
                  <div className="mb-3 bg-gray-50/70 rounded-lg p-3 border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-700 border-b border-gray-200 pb-1 mb-2 uppercase tracking-wide">
                      Detailed Breakdown
                    </h3>

                    {/* Dynamic Step Lines */}
                    <div className="space-y-1 text-xs text-gray-600 mb-2">
                      {generatedBillPreview.steps.map((step: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span>
                            {step.label} <span className="text-gray-400 font-mono text-[11px]">{step.formula}</span>
                          </span>
                          <span className="font-medium text-gray-800 font-mono">৳{step.cost.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Additional Charges */}
                    <div className="space-y-1 text-xs border-t border-gray-200 pt-2 text-gray-700 font-mono">
                      <div className="flex justify-between items-center font-sans font-medium text-gray-800">
                        <span>Energy Charge Subtotal</span>
                        <span className="font-mono">৳{generatedBillPreview.energyCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-sans">
                        <span>Demand Charge ({generatedBillPreview.sanctionedLoad} x {generatedBillPreview.demandRate})</span>
                        <span className="font-mono">৳{generatedBillPreview.demandCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-sans">
                        <span>Meter Rent</span>
                        <span className="font-mono">৳{generatedBillPreview.meterRent.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-semibold text-gray-800 border-t border-dashed border-gray-200 pt-1 mt-1 font-sans">
                        <span>Subtotal</span>
                        <span className="font-mono">৳{generatedBillPreview.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center font-sans">
                        <span>VAT ({generatedBillPreview.vatRate}%)</span>
                        <span className="font-mono">৳{generatedBillPreview.vat.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="bg-blue-50 p-3 rounded-lg flex justify-between items-center border border-blue-100">
                    <span className="font-bold text-blue-900 uppercase tracking-wider text-xs">Total Payable</span>
                    <span className="font-bold text-xl text-blue-700 font-mono">
                      ৳ {Math.round(generatedBillPreview.totalPayable).toFixed(2)}
                    </span>
                  </div>

                  {/* Signatures with Manager Russell */}
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-end text-xs mt-3">
                    <div className="text-center min-w-[120px]">
                      <div className="h-6 flex items-center justify-center text-gray-400 text-xs">
                        Verified
                      </div>
                      <div className="w-28 border-b border-gray-300 mx-auto mb-1"></div>
                      <p className="font-medium text-gray-500 text-[10px] uppercase">Meter Reader</p>
                    </div>

                    <div className="text-center min-w-[130px]">
                      {/* Handwritten Manager Signature - Cursive Russell */}
                      <div
                        className="h-6 flex items-center justify-center text-gray-900 text-2xl font-bold"
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
                  <div className="mt-3 text-center border-t border-gray-100 pt-2">
                    <p className="text-[11px] text-gray-400">Please pay your bill within the due date to avoid late fees.</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Generated by Complex Management &bull; Russell (Manager)</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State from user's template */
              <div className="bg-white p-10 border border-gray-200 border-dashed rounded-xl w-full max-w-md text-center text-gray-400 flex flex-col items-center justify-center h-96">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p className="text-sm font-medium text-gray-500">No Bill Preview Generated Yet</p>
                <p className="text-xs text-gray-400 mt-1">Fill out the parameters on the left and click "Generate & Preview Bill" to preview here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

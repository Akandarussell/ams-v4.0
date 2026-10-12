import React, { useState, useEffect } from 'react';
import {
  Building2,
  LayoutDashboard,
  FileSpreadsheet,
  Wallet,
  Zap,
  Car,
  Warehouse,
  MessageSquare,
  AlertCircle,
  CreditCard,
  Settings,
  Users,
  History,
  Database,
  Printer,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Menu,
  X,
  Bell,
  ShieldCheck,
  UserCheck,
  Home,
  User,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import {
  AppDatabaseState,
  UserProfile,
  PrintableReceipt,
  ElectricityBill,
  PaymentMethod,
  PaymentStatus,
  NescoTariffConfig,
  ComplaintCategory,
  ComplaintStatus,
  Unit,
  MonthlyLedgerItem,
  OnlinePaymentRequest,
  Tenant,
  AdvanceAccount,
  MeterReading,
  SlabBreakdownItem,
  SecurityCredentials,
  ChatMessage,
} from './types';
import {
  loadDatabaseState,
  saveDatabaseState,
  resetDatabaseToDefault,
  INITIAL_PROFILES,
  generateInitialLedger,
  fetchDatabaseFromServer,
  syncTenantsWithCurrentLedger,
  isMessageAssociatedWithFlat,
  isSameTenantPerson,
  purgePreviousTenantChatMessages,
  calculateItemTotalDue,
  getEffectiveRemainingAdvance,
} from './lib/storage';
import { formatBDT, getMonthName, calculateNescoElectricityBill, getPostpaidElectricityPeriod } from './lib/nescoTariff';
import { getSupabaseCredentials } from './lib/supabase';
import { COMPLEX_CONFIG } from './lib/complexConfig';
import {
  formatBillingPeriod,
  parseBillingPeriod,
  fetchRemoteMonthlyRentRecords,
  upsertRemoteMonthlyRentRecord,
  upsertBatchRemoteMonthlyRentRecords,
  deleteRemoteMonthlyRentRecord,
} from './lib/api';

// Components
import { ManagerDashboard } from './components/ManagerDashboard';
import { NewRentalUnitPayload } from './components/CreateUnitModal';
import { OwnerDashboard } from './components/OwnerDashboard';
import { MainLedger } from './components/MainLedger';
import { AdvancePaymentManager } from './components/AdvancePaymentManager';
import { ElectricityManager } from './components/ElectricityManager';
import { TenantPortal } from './components/TenantPortal';
import { ComplaintsManager } from './components/ComplaintsManager';
import { ChatSystem } from './components/ChatSystem';
import { OnlinePaymentWorkflow } from './components/OnlinePaymentWorkflow';
import { UnitManager } from './components/UnitManager';
import { UserManagement } from './components/UserManagement';
import { PasswordSettingsManager } from './components/PasswordSettingsManager';
import { AuditLogView } from './components/AuditLogView';
import { PrintableReceiptModal } from './components/PrintableReceiptModal';
import { PrintableBillModal } from './components/PrintableBillModal';
import { TariffSettingsModal } from './components/TariffSettingsModal';
import { DatabaseSetupModal } from './components/DatabaseSetupModal';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [data, setData] = useState<AppDatabaseState>(() => loadDatabaseState());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('mbd_logged_in_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse stored user:', e);
    }
    return null; // Start at Login page
  });
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [ledgerInitialBlock, setLedgerInitialBlock] = useState<string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Active user safe helpers for handlers
  const activeUserFullName = currentUser?.fullName || 'Manager Russell';
  const activeUserRole = currentUser?.role || 'manager';
  const activeUserId = currentUser?.id || 'user-manager-russell';
  const activeUserFlatId = currentUser?.flatId || 'A2';

  // Modals
  const [activeReceipt, setActiveReceipt] = useState<PrintableReceipt | null>(null);
  const [activeBill, setActiveBill] = useState<ElectricityBill | null>(null);
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // Fetch latest persistent state from server database and Supabase on mount
  useEffect(() => {
    fetchDatabaseFromServer()
      .then((serverData) => {
        const baseData = serverData && serverData.ledgerItems ? serverData : data;
        if (serverData && serverData.ledgerItems) {
          setData(serverData);
        } else {
          saveDatabaseState(data);
        }

        const initialPeriod = formatBillingPeriod(baseData.selectedMonth, baseData.selectedYear);
        fetchRemoteMonthlyRentRecords(initialPeriod)
          .then((remoteRecords) => {
            if (remoteRecords && remoteRecords.length > 0) {
              updateData((prev) => {
                const mergedRecords = remoteRecords.map((rem) => {
                  const existing = prev.ledgerItems.find(
                    (loc) => loc.flatId.toLowerCase().trim() === rem.flatId.toLowerCase().trim() && loc.month === rem.month && loc.year === rem.year
                  );
                  if (existing) {
                    const finalRentStatus =
                      rem.rentStatus && rem.rentStatus !== 'Not Paid'
                        ? rem.rentStatus
                        : (existing.rentStatus || rem.rentStatus);
                    const finalRentPaymentDate = rem.rentPaymentDate || existing.rentPaymentDate;
                    return {
                      ...existing,
                      ...rem,
                      rentStatus: finalRentStatus,
                      rentPaymentDate: finalRentPaymentDate,
                    };
                  }
                  return rem;
                });
                const remoteFlatKeys = new Set(mergedRecords.map((r) => r.flatId.toLowerCase().trim()));
                const preservedLocal = prev.ledgerItems.filter(
                  (i) => i.month === baseData.selectedMonth && i.year === baseData.selectedYear && !remoteFlatKeys.has(i.flatId.toLowerCase().trim())
                );
                const otherItems = prev.ledgerItems.filter(
                  (i) => !(i.month === baseData.selectedMonth && i.year === baseData.selectedYear)
                );
                return {
                  ...prev,
                  ledgerItems: [...otherItems, ...mergedRecords, ...preservedLocal],
                };
              });
              console.log(`[Supabase Initial Mount] Synced ${remoteRecords.length} records for ${initialPeriod}`);
            }
          })
          .catch((err) => {
            console.warn('[Supabase Initial Load Notice] Using local server state:', err?.message || err);
          });
      })
      .catch((err) => {
        console.warn('Could not sync with server database:', err);
      });
  }, []);

  // Save changes to storage whenever data changes
  const updateData = (updater: (prev: AppDatabaseState) => AppDatabaseState) => {
    setData((prev) => {
      const next = updater(prev);
      saveDatabaseState(next);
      return next;
    });
  };

  // Switch month and year across system (1. Monthly Scoping: fetches from Supabase where billing_period = selectedPeriod)
  const handleUpdateMonthYear = async (month: number, year: number) => {
    const billingPeriod = formatBillingPeriod(month, year);
    console.log(`[Supabase Monthly Scoping] Switching to billing_period = "${billingPeriod}" (${getMonthName(month)} ${year})`);

    updateData((prev) => {
      const switched = {
        ...prev,
        selectedMonth: month,
        selectedYear: year,
      };
      return syncTenantsWithCurrentLedger(switched);
    });

    try {
      const remoteRecords = await fetchRemoteMonthlyRentRecords(billingPeriod);
      if (remoteRecords && remoteRecords.length > 0) {
        updateData((prev) => {
          const mergedRecords = remoteRecords.map((rem) => {
            const existing = prev.ledgerItems.find(
              (loc) => loc.flatId.toLowerCase().trim() === rem.flatId.toLowerCase().trim() && loc.month === rem.month && loc.year === rem.year
            );
            if (existing) {
              const finalRentStatus =
                rem.rentStatus && rem.rentStatus !== 'Not Paid'
                  ? rem.rentStatus
                  : (existing.rentStatus || rem.rentStatus);
              const finalRentPaymentDate = rem.rentPaymentDate || existing.rentPaymentDate;
              return {
                ...existing,
                ...rem,
                rentStatus: finalRentStatus,
                rentPaymentDate: finalRentPaymentDate,
              };
            }
            return rem;
          });
          const remoteFlatKeys = new Set(mergedRecords.map((r) => r.flatId.toLowerCase().trim()));
          const preservedLocal = prev.ledgerItems.filter(
            (i) => i.month === month && i.year === year && !remoteFlatKeys.has(i.flatId.toLowerCase().trim())
          );
          const otherItems = prev.ledgerItems.filter((i) => !(i.month === month && i.year === year));
          const nextState = {
            ...prev,
            ledgerItems: [...otherItems, ...mergedRecords, ...preservedLocal],
          };
          return syncTenantsWithCurrentLedger(nextState);
        });
        console.log(`[Supabase Monthly Sync] Synced ${remoteRecords.length} records for ${billingPeriod} from Supabase.`);
      } else {
        console.log(
          `[Supabase Monthly Scoping] 0 records found in Supabase for billing_period = "${billingPeriod}". Roster can be cloned from previous month.`
        );
      }
    } catch (err: any) {
      console.warn(`[Supabase Monthly Scoping Notice] Could not sync monthly_rent_records for ${billingPeriod}:`, err?.message || err);
    }
  };

  // Navigate to block monthly ledger from manager dashboard cards
  const handleNavigateToBlockLedger = (block: string, month?: number, year?: number) => {
    if (month && year && (month !== data.selectedMonth || year !== data.selectedYear)) {
      handleUpdateMonthYear(month, year);
    }
    setLedgerInitialBlock(block);
    setCurrentView('monthly-ledger');
  };

  // Record Payment
  const handleRecordPayment = (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    category: 'Combined' | 'Flat Rent' | 'Electricity' | 'Parking' | 'Godown' | 'Advance' = 'Combined',
    transactionId?: string,
    notes?: string
  ) => {
    updateData((prev) => {
      const receiptNo = `REC-${flatId}-${prev.selectedMonth}-${Date.now().toString().slice(-4)}`;
      const cleanFlat = flatId.toLowerCase().trim();
      const tenant = prev.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlat);
      const unit = prev.units.find((u) => u.flatId.toLowerCase().trim() === cleanFlat);

      // Create Payment Transaction
      const newTx = {
        id: `ptxn-${Date.now()}`,
        receiptNo,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        category,
        month: prev.selectedMonth,
        year: prev.selectedYear,
        amount,
        paymentMethod: method,
        transactionId: transactionId || `TX-${Date.now().toString().slice(-6)}`,
        paymentDate: new Date().toISOString().split('T')[0],
        verificationStatus: 'Verified' as const,
        recordedBy: activeUserFullName,
        notes,
        createdAt: new Date().toISOString(),
      };

      // Update Monthly Ledger item with strict monthly scoping
      const currentBillingPeriod = formatBillingPeriod(prev.selectedMonth, prev.selectedYear);
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId.toLowerCase().trim() === cleanFlat && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const newTotalPaid = item.totalPaid + amount;
          const newTotalDue = Math.max(0, item.totalPayable - newTotalPaid);
          let newStatus: PaymentStatus = 'Paid';
          if (newTotalPaid === 0) newStatus = 'Not Paid';
          else if (newTotalDue > 0) newStatus = 'Partially Paid';

          let rentStatus = item.rentStatus;
          let rentPaymentDate = item.rentPaymentDate;
          let electricityStatus = item.electricityStatus;
          let electricityDate = item.electricityDate;

          if (category === 'Flat Rent') {
            rentStatus = newTotalDue === 0 ? 'Paid' : 'Partially Paid';
            rentPaymentDate = newTx.paymentDate;
          } else if (category === 'Electricity') {
            electricityStatus = 'Paid';
            electricityDate = newTx.paymentDate;
          } else if (category === 'Combined') {
            rentStatus = newTotalDue === 0 ? 'Paid' : 'Partially Paid';
            rentPaymentDate = newTx.paymentDate;
            if (item.electricityBill > 0) {
              electricityStatus = 'Paid';
              electricityDate = newTx.paymentDate;
            }
          }

          return {
            ...item,
            billingPeriod: currentBillingPeriod,
            totalPaid: newTotalPaid,
            totalDue: newTotalDue,
            paymentStatus: newStatus,
            rentStatus,
            rentPaymentDate,
            electricityStatus,
            electricityDate,
            lastPaymentDate: newTx.paymentDate,
          };
        }
        return item;
      });

      // Audit Log
      const auditLog = {
        id: `log-${Date.now()}`,
        action: 'RECORD_PAYMENT',
        entity: 'PaymentTransaction',
        entityId: newTx.id,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Recorded payment of ${formatBDT(amount)} via ${method} for Flat ${flatId} in period ${currentBillingPeriod}`,
        timestamp: new Date().toISOString(),
      };

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      const updatedItem = updatedLedger.find(
        (i) => i.flatId.toLowerCase().trim() === cleanFlat && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert payment for flat ${flatId} (period: ${currentBillingPeriod}):`,
              err
            );
          }
        });
      }

      return {
        ...prev,
        payments: [newTx, ...prev.payments],
        ledgerItems: updatedLedger,
        auditLogs: [auditLog, ...prev.auditLogs],
      };
    });
  };

  // Adjust from Advance
  const handleAdjustFromAdvance = (flatId: string, amount: number, notes?: string) => {
    const advance = data.advanceAccounts.find((a) => a.flatId === flatId);
    if (!advance || advance.amountPaid < amount) {
      return { success: false, message: 'Adjustment exceeds available security advance balance!' };
    }

    updateData((prev) => {
      const receiptNo = `ADJ-${flatId}-${Date.now().toString().slice(-4)}`;
      const tenant = prev.tenants.find((t) => t.flatId === flatId);

      // Deduct from advance account
      const updatedAdvance = prev.advanceAccounts.map((a) => {
        if (a.flatId === flatId) {
          const remainingPaid = a.amountPaid - amount;
          return {
            ...a,
            amountPaid: remainingPaid,
            remainingAdvance: remainingPaid,
            status: remainingPaid <= 0 ? ('not_paid' as const) : ('partially_paid' as const),
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      // Advance Transaction
      const advTx = {
        id: `atx-${Date.now()}`,
        advanceAccountId: advance.id,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        amount,
        type: 'adjustment_deduction' as const,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Advance Adjustment' as PaymentMethod,
        receiptNo,
        notes: notes || 'Rent adjusted from advance deposit',
        recordedBy: activeUserFullName,
        createdAt: new Date().toISOString(),
      };

      // Update Ledger item
      const currentBillingPeriod = formatBillingPeriod(prev.selectedMonth, prev.selectedYear);
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const newAdjustedFromAdvance = (item.adjustedFromAdvance || 0) + amount;
          const isFullRentCovered = amount >= item.flatRent || newAdjustedFromAdvance >= item.flatRent;
          const rentStatus = isFullRentCovered ? 'Adjusted' : 'Partially Paid';
          const newTotalDue = calculateItemTotalDue({
            ...item,
            rentStatus,
            adjustedFromAdvance: newAdjustedFromAdvance,
          });
          return {
            ...item,
            billingPeriod: currentBillingPeriod,
            adjustedFromAdvance: newAdjustedFromAdvance,
            totalDue: newTotalDue,
            rentStatus: rentStatus as any,
            paymentStatus: (newTotalDue === 0 ? 'Adjusted' : 'Partially Paid') as PaymentStatus,
            lastPaymentDate: advTx.paymentDate,
          };
        }
        return item;
      });

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      const updatedItem = updatedLedger.find(
        (i) => i.flatId === flatId && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert advance adjustment for flat ${flatId} (${currentBillingPeriod}):`,
              err
            );
          }
        });
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: 'ADJUST_ADVANCE',
        entity: 'MonthlyLedger',
        entityId: flatId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Adjusted rent of ${formatBDT(amount)} from advance balance for Flat ${flatId} in period ${currentBillingPeriod}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        advanceAccounts: updatedAdvance,
        advanceTransactions: [advTx, ...prev.advanceTransactions],
        ledgerItems: updatedLedger,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });

    return { success: true, message: 'Rent successfully adjusted from advance.' };
  };

  // Record Advance Payment
  const handleRecordAdvancePayment = (
    flatId: string,
    amount: number,
    method: PaymentMethod,
    transactionId?: string,
    notes?: string
  ) => {
    updateData((prev) => {
      const tenant = prev.tenants.find((t) => t.flatId === flatId);
      const receiptNo = `ADV-${prev.selectedYear}-${Date.now().toString().slice(-4)}`;

      // Update advance account
      const updatedAccounts = prev.advanceAccounts.map((a) => {
        if (a.flatId === flatId) {
          const newPaid = a.amountPaid + amount;
          const newRemaining = Math.max(0, a.totalRequired - newPaid);
          return {
            ...a,
            amountPaid: newPaid,
            remainingAdvance: newPaid,
            status: (newPaid >= a.totalRequired ? 'paid' : 'partially_paid') as any,
            lastPaymentDate: new Date().toISOString().split('T')[0],
            notes,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });

      const advTx = {
        id: `atx-${Date.now()}`,
        advanceAccountId: `adv-${flatId}`,
        tenantId: tenant?.id || '',
        tenantName: tenant?.fullName || 'Resident',
        flatId,
        amount,
        type: 'deposit' as const,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: method,
        receiptNo,
        transactionId,
        notes,
        recordedBy: activeUserFullName,
        createdAt: new Date().toISOString(),
      };

      const audit = {
        id: `log-${Date.now()}`,
        action: 'DEPOSIT_ADVANCE',
        entity: 'AdvanceAccount',
        entityId: flatId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Deposited advance ${formatBDT(amount)} for Flat ${flatId}`,
        timestamp: new Date().toISOString(),
      };

      // Also sync active month ledger item advance payment & status
      const updatedLedgerItems = prev.ledgerItems.map((item) => {
        if (item.flatId === flatId && item.month === prev.selectedMonth && item.year === prev.selectedYear) {
          const matchingAcc = updatedAccounts.find((a) => a.flatId === flatId);
          const totalPaidAdv = matchingAcc ? matchingAcc.amountPaid : amount;
          return {
            ...item,
            advancePayment: totalPaidAdv,
            advanceStatus: 'Paid' as const,
            advanceDate: new Date().toISOString().split('T')[0],
          };
        }
        return item;
      });

      return {
        ...prev,
        ledgerItems: updatedLedgerItems,
        advanceAccounts: updatedAccounts,
        advanceTransactions: [advTx, ...prev.advanceTransactions],
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Toggle Unit Electricity Billing ON / OFF (for specific flats and godowns)
  const handleToggleUnitElectricity = (flatId: string, enabled: boolean) => {
    updateData((prev) => {
      const cleanFlatId = flatId.trim();
      let targetUnit = prev.units.find((u) => u.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase());
      let updatedUnits = [...prev.units];

      if (!targetUnit) {
        // Instantiate missing unit record so sublets/ledger flats can be properly toggled and tracked
        const ledgerItem = prev.ledgerItems.find((i) => i.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase());
        const tenant = prev.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase());
        const newUnit: Unit = {
          id: `u-${cleanFlatId.toLowerCase().replace(/\s+/g, '-')}`,
          flatId: cleanFlatId,
          blockId: ledgerItem?.blockName === 'Block B' ? 'block-b' : ledgerItem?.blockName === 'Block C' ? 'block-c' : 'block-a',
          blockName: (ledgerItem?.blockName || (cleanFlatId.startsWith('B') ? 'Block B' : cleanFlatId.startsWith('C') ? 'Block C' : 'Block A')) as any,
          floor: 5,
          unitType: 'residential',
          monthlyRent: ledgerItem?.flatRent || 0,
          isOccupied: true,
          electricityBillingType: enabled ? ('nesco_submeter' as const) : ('none' as const),
          isElectricityEnabled: enabled,
        };
        updatedUnits.push(newUnit);
      } else {
        // Update unit configuration
        updatedUnits = prev.units.map((u) => {
          if (u.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase()) {
            return {
              ...u,
              isElectricityEnabled: enabled,
              electricityBillingType: enabled ? ('nesco_submeter' as const) : ('none' as const),
            };
          }
          return u;
        });
      }

      // Update ledger items for this flat
      const updatedLedger = prev.ledgerItems.map((item) => {
        if (item.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase()) {
          if (!enabled) {
            // Turning OFF: electricity bill becomes 0, status N/A
            const newTotalPayable = item.flatRent + item.parkingRent + item.godownRent;
            const newTotalDue = Math.max(0, newTotalPayable - item.totalPaid);
            return {
              ...item,
              electricityBill: 0,
              electricityStatus: 'N/A' as const,
              totalPayable: newTotalPayable,
              totalDue: newTotalDue,
            };
          } else {
            // Turning ON: find if there was a bill or recalculate
            const existingBill = prev.electricityBills.find(
              (b) => b.flatId.toLowerCase().trim() === cleanFlatId.toLowerCase() && b.billingMonth === item.month && b.billingYear === item.year
            );
            if (existingBill) {
              const newTotalPayable = item.flatRent + existingBill.totalBill + item.parkingRent + item.godownRent;
              const newTotalDue = Math.max(0, newTotalPayable - item.totalPaid);
              return {
                ...item,
                electricityBill: existingBill.totalBill,
                electricityStatus: (item.totalPaid >= newTotalPayable ? 'Paid' : 'Not Paid') as any,
                totalPayable: newTotalPayable,
                totalDue: newTotalDue,
              };
            } else {
              return {
                ...item,
                electricityStatus: (item.electricityBill > 0 ? (item.totalPaid >= item.totalPayable ? 'Paid' : 'Not Paid') : 'Not Paid') as any,
              };
            }
          }
        }
        return item;
      });

      // When turning OFF, remove unverified / unpaid bills for this flat
      let updatedBills = prev.electricityBills;
      if (!enabled) {
        updatedBills = prev.electricityBills.filter(
          (b) => !(b.flatId === flatId && b.paymentStatus !== 'Paid')
        );
      }

      // Persist toggled unit monthly rent record to Supabase
      const updatedItem = updatedLedger.find(
        (i) => i.flatId === flatId && i.month === prev.selectedMonth && i.year === prev.selectedYear
      );
      if (updatedItem) {
        upsertRemoteMonthlyRentRecord(updatedItem).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to upsert toggled electricity for Flat ${flatId} in period ${formatBillingPeriod(prev.selectedMonth, prev.selectedYear)}:`,
              err
            );
          }
        });
      }

      // Audit Log
      const auditLog = {
        id: `log-${Date.now()}`,
        action: 'UPDATE_UNIT_ELECTRICITY',
        entity: 'Unit',
        entityId: targetUnit?.id || `u-${cleanFlatId.toLowerCase().replace(/\s+/g, '-')}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Electricity billing & receipt generation toggled ${enabled ? 'ON' : 'OFF'} for ${targetUnit?.unitType === 'godown' ? 'Godown' : 'Flat'} ${flatId}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        units: updatedUnits,
        ledgerItems: updatedLedger,
        electricityBills: updatedBills,
        auditLogs: [auditLog, ...prev.auditLogs],
      };
    });
  };

  // Generate Electricity Bills
  const handleGenerateElectricityBills = (
    consumptionMonth: number,
    consumptionYear: number,
    billingMonth: number,
    billingYear: number,
    customReadings?: {
      flatId: string;
      tenantName?: string;
      previousReading?: number;
      currentReading?: number;
      consumedUnits?: number;
      billAmount?: number;
      slabBreakdown?: SlabBreakdownItem[];
      baseEnergyCost?: number;
      demandCharge?: number;
      vatAmount?: number;
      meterRent?: number;
      rebateAmount?: number;
      billingSystem?: string;
    }[]
  ) => {
    updateData((prev) => {
      // Gather all eligible units or target specific units if customReadings is provided
      const isTargetedGeneration = Boolean(customReadings && customReadings.length > 0);
      const customFlatIds = new Set((customReadings || []).map((cr) => cr.flatId.toLowerCase().trim()));

      // Flats to generate bills for:
      // If customReadings provided, ONLY generate bills for those specific flats!
      // Otherwise (batch generation for all flats), generate for all nescoUnits.
      const targetFlatsList: { flatId: string; unitId: string; tenantId: string; tenantName: string }[] = [];

      // Helper: Postpaid electricity bills apply to prior month's usage (consumptionMonth & consumptionYear).
      // The bill is always issued under the name of the last month's user who stayed during that consumption period.
      const getPriorMonthTenantName = (flatKey: string, fallbackName: string) => {
        const priorLedger = prev.ledgerItems.find(
          (li) =>
            li.flatId.toLowerCase().trim() === flatKey.toLowerCase().trim() &&
            li.month === consumptionMonth &&
            li.year === consumptionYear
        );
        if (priorLedger && priorLedger.tenantName && priorLedger.tenantName.trim() !== '') {
          return priorLedger.tenantName.trim();
        }
        const priorBill = prev.electricityBills.find(
          (b) =>
            b.flatId.toLowerCase().trim() === flatKey.toLowerCase().trim() &&
            b.consumptionMonth === consumptionMonth &&
            b.consumptionYear === consumptionYear
        );
        if (priorBill && priorBill.tenantName && priorBill.tenantName.trim() !== '') {
          return priorBill.tenantName.trim();
        }
        return fallbackName;
      };

      if (isTargetedGeneration) {
        (customReadings || []).forEach((cr) => {
          const key = cr.flatId.toLowerCase().trim();
          const matchingUnit = prev.units.find((u) => u.flatId.toLowerCase().trim() === key);
          const currentTenant = prev.tenants.find((t) => t.flatId.toLowerCase().trim() === key);
          const currentName = cr.tenantName || currentTenant?.fullName || 'Resident';
          const billedTenantName = getPriorMonthTenantName(key, currentName);
          targetFlatsList.push({
            flatId: cr.flatId,
            unitId: matchingUnit?.id || `u-${key.replace(/\s+/g, '-')}`,
            tenantId: currentTenant?.id || '',
            tenantName: billedTenantName,
          });
        });
      } else {
        const nescoUnits = prev.units.filter(
          (u) =>
            (u.unitType === 'residential' || u.unitType === 'godown') &&
            (u.isElectricityEnabled ?? (u.electricityBillingType === 'nesco_submeter')) &&
            u.electricityBillingType !== 'none'
        );
        nescoUnits.forEach((u) => {
          const key = u.flatId.toLowerCase().trim();
          const currentTenant = prev.tenants.find((t) => t.flatId.toLowerCase().trim() === key);
          const currentName = currentTenant?.fullName || 'Resident';
          const billedTenantName = getPriorMonthTenantName(key, currentName);
          targetFlatsList.push({
            flatId: u.flatId,
            unitId: u.id,
            tenantId: currentTenant?.id || '',
            tenantName: billedTenantName,
          });
        });
      }

      const newBills: ElectricityBill[] = targetFlatsList.map((f) => {
        const custom = customReadings?.find((cr) => cr.flatId.toLowerCase().trim() === f.flatId.toLowerCase().trim());
        const mr = prev.meterReadings.find(
          (r) =>
            (r.unitId === f.unitId || r.flatId.toLowerCase().trim() === f.flatId.toLowerCase().trim()) &&
            r.month === consumptionMonth &&
            r.year === consumptionYear
        );
        const prevReading = custom?.previousReading !== undefined ? custom.previousReading : (mr?.previousReading || 1500);
        const currentReading = custom?.currentReading !== undefined ? custom.currentReading : (mr?.currentReading || prevReading + 220);
        const calc = calculateNescoElectricityBill(currentReading, prevReading, prev.tariffConfig, 2);
        const billAmount = custom?.billAmount !== undefined ? custom.billAmount : calc.totalBill;

        return {
          id: `eb-${f.flatId.toLowerCase().trim()}-${consumptionMonth}-${consumptionYear}`,
          unitId: f.unitId,
          flatId: f.flatId,
          tenantId: f.tenantId,
          tenantName: f.tenantName,
          consumptionMonth,
          consumptionYear,
          billingMonth,
          billingYear,
          previousReading: prevReading,
          currentReading,
          consumedUnits: custom?.consumedUnits !== undefined ? custom.consumedUnits : calc.consumedUnits,
          slabBreakdown: custom?.slabBreakdown !== undefined ? custom.slabBreakdown : calc.slabBreakdown,
          baseEnergyCost: custom?.baseEnergyCost !== undefined ? custom.baseEnergyCost : calc.baseEnergyCost,
          demandCharge: custom?.demandCharge !== undefined ? custom.demandCharge : calc.demandCharge,
          vatAmount: custom?.vatAmount !== undefined ? custom.vatAmount : calc.vatAmount,
          meterRent: custom?.meterRent !== undefined ? custom.meterRent : calc.meterRent,
          rebateAmount: custom?.rebateAmount !== undefined ? custom.rebateAmount : calc.rebateAmount,
          totalBill: billAmount,
          paidAmount: 0,
          dueAmount: billAmount,
          paymentStatus: 'Not Paid',
          generatedDate: new Date().toISOString().split('T')[0],
          tariffSnapshotTitle: prev.tariffConfig.title,
        };
      });

      // Update Meter Readings state if custom readings were provided
      let updatedMeterReadings = prev.meterReadings;
      if (customReadings && customReadings.length > 0) {
        const filteredOldReadings = prev.meterReadings.filter(
          (r) => !(customFlatIds.has(r.flatId.toLowerCase().trim()) && r.month === consumptionMonth && r.year === consumptionYear)
        );
        const addedReadings: MeterReading[] = customReadings.map((cr) => {
          const unit = prev.units.find((u) => u.flatId.toLowerCase().trim() === cr.flatId.toLowerCase().trim());
          const pR = cr.previousReading || 1500;
          const cR = cr.currentReading || pR;
          return {
            id: `mr-${cr.flatId.toLowerCase().trim()}-${consumptionMonth}-${consumptionYear}`,
            unitId: unit?.id || `u-${cr.flatId.toLowerCase().trim().replace(/\s+/g, '-')}`,
            flatId: cr.flatId,
            month: consumptionMonth,
            year: consumptionYear,
            previousReading: pR,
            currentReading: cR,
            consumedUnits: cr.consumedUnits !== undefined ? cr.consumedUnits : Math.max(0, cR - pR),
            readingDate: new Date().toISOString().split('T')[0],
            recordedBy: activeUserFullName,
          };
        });
        updatedMeterReadings = [...addedReadings, ...filteredOldReadings];
      }

      // Update Ledger with new electricity bills for billingMonth
      const targetBillingPeriod = formatBillingPeriod(billingMonth, billingYear);
      const existingFlatsInLedger = new Set(
        prev.ledgerItems
          .filter((i) => i.month === billingMonth && i.year === billingYear)
          .map((i) => i.flatId.toLowerCase().trim())
      );

      // Update unit electricity billing enabled settings so they carry forward to subsequent months
      let updatedUnits = prev.units.map((u) => {
        const custom = customReadings?.find((cr) => cr.flatId.toLowerCase().trim() === u.flatId.toLowerCase().trim());
        if (custom) {
          const isCustomEnabled = (custom as any).isBillingEnabled !== undefined
            ? Boolean((custom as any).isBillingEnabled)
            : (custom.billAmount !== undefined ? custom.billAmount > 0 : (u.isElectricityEnabled ?? true));
          return {
            ...u,
            isElectricityEnabled: isCustomEnabled,
            electricityBillingType: isCustomEnabled ? ('nesco_submeter' as const) : ('none' as const),
          };
        }
        return u;
      });

      // Ensure any custom readings flat (e.g. sublets) not yet in units is automatically added
      if (customReadings) {
        customReadings.forEach((cr) => {
          const key = cr.flatId.toLowerCase().trim();
          const exists = updatedUnits.some((u) => u.flatId.toLowerCase().trim() === key);
          if (!exists) {
            const isCustomEnabled = (cr as any).isBillingEnabled !== undefined
              ? Boolean((cr as any).isBillingEnabled)
              : (cr.billAmount !== undefined ? cr.billAmount > 0 : true);
            const ledgerItem = prev.ledgerItems.find((i) => i.flatId.toLowerCase().trim() === key);
            updatedUnits.push({
              id: `u-${key.replace(/\s+/g, '-')}`,
              flatId: cr.flatId,
              blockId: ledgerItem?.blockName === 'Block B' ? 'block-b' : ledgerItem?.blockName === 'Block C' ? 'block-c' : 'block-a',
              blockName: (ledgerItem?.blockName || (cr.flatId.startsWith('B') ? 'Block B' : cr.flatId.startsWith('C') ? 'Block C' : 'Block A')) as any,
              floor: 5,
              unitType: 'residential',
              monthlyRent: ledgerItem?.flatRent || 0,
              isOccupied: true,
              electricityBillingType: isCustomEnabled ? ('nesco_submeter' as const) : ('none' as const),
              isElectricityEnabled: isCustomEnabled,
            });
          }
        });
      }

      // Update Ledger items:
      // CRITICAL: If targeted generation, ONLY update the flats specified in customReadings!
      // All other flats' ledger items MUST remain completely untouched so other bill amounts are never overwritten!
      const updatedLedger = prev.ledgerItems.map((item) => {
        const itemKey = item.flatId.toLowerCase().trim();

        if (isTargetedGeneration && !customFlatIds.has(itemKey)) {
          return item;
        }

        const matchingBill = newBills.find((b) => b.flatId.toLowerCase().trim() === itemKey);
        const unit = updatedUnits.find((u) => u.flatId.toLowerCase().trim() === itemKey);
        const custom = customReadings?.find((cr) => cr.flatId.toLowerCase().trim() === itemKey);
        const isCustomExplicitlyEnabled = (custom as any)?.isBillingEnabled;
        const isElecOn = isCustomExplicitlyEnabled !== undefined
          ? Boolean(isCustomExplicitlyEnabled)
          : custom?.billAmount !== undefined
          ? custom.billAmount > 0
          : (unit?.unitType === 'residential' || unit?.unitType === 'godown' || !unit) &&
            (unit?.isElectricityEnabled ?? (unit?.electricityBillingType === 'nesco_submeter' || !unit?.electricityBillingType)) &&
            unit?.electricityBillingType !== 'none';

        if (item.month === billingMonth && item.year === billingYear) {
          if (matchingBill && isElecOn) {
            const billAmount = matchingBill.totalBill;
            const totalPayable = item.flatRent + billAmount + item.parkingRent + item.godownRent;
            const totalDue = Math.max(0, totalPayable - item.totalPaid);
            return {
              ...item,
              billingPeriod: targetBillingPeriod,
              electricityBill: billAmount,
              electricityStatus: (item.totalPaid >= totalPayable ? 'Paid' : 'Not Paid') as any,
              totalPayable,
              totalDue,
            };
          } else if (!isElecOn) {
            const totalPayable = item.flatRent + item.parkingRent + item.godownRent;
            const totalDue = Math.max(0, totalPayable - item.totalPaid);
            return {
              ...item,
              billingPeriod: targetBillingPeriod,
              electricityBill: 0,
              electricityStatus: 'N/A' as const,
              totalPayable,
              totalDue,
            };
          }
        }
        return item;
      });

      // Automatically add missing ledger items for any billed units that didn't exist in ledger for this month
      const missingLedgerItems: MonthlyLedgerItem[] = [];
      newBills.forEach((bill) => {
        if (!existingFlatsInLedger.has(bill.flatId.toLowerCase().trim())) {
          const unit = prev.units.find((u) => u.flatId.toLowerCase().trim() === bill.flatId.toLowerCase().trim());
          const tenant = prev.tenants.find((t) => t.flatId.toLowerCase().trim() === bill.flatId.toLowerCase().trim());
          const flatRent = unit?.monthlyRent || 0;
          const totalPayable = flatRent + bill.totalBill;
          missingLedgerItems.push({
            id: `ledger-${bill.flatId.toLowerCase().trim()}-${billingMonth}-${billingYear}`,
            unitId: unit?.id || `u-${bill.flatId.toLowerCase().trim()}`,
            flatId: bill.flatId,
            blockName: (unit?.blockName || (bill.flatId.startsWith('B') ? 'Block B' : bill.flatId.startsWith('C') ? 'Block C' : 'Block A')) as any,
            tenantId: tenant?.id || '',
            tenantName: tenant?.fullName || bill.tenantName || 'Resident',
            tenantPhone: tenant?.phone || '',
            entryDate: tenant?.entryDate || '2024-01-01',
            billingPeriod: targetBillingPeriod,
            month: billingMonth,
            year: billingYear,
            advancePayment: 0,
            flatRent,
            electricityBill: bill.totalBill,
            parkingRent: 0,
            godownRent: 0,
            totalPayable,
            totalPaid: 0,
            totalDue: totalPayable,
            paymentStatus: 'Not Paid',
            adjustedFromAdvance: 0,
            electricityStatus: 'Not Paid',
          });
        }
      });

      const finalLedger = [...updatedLedger, ...missingLedgerItems];

      // Persist updated electricity bill records to Supabase monthly_rent_records
      const itemsForBillingPeriod = finalLedger.filter(
        (i) => i.month === billingMonth && i.year === billingYear
      );
      if (itemsForBillingPeriod.length > 0) {
        upsertBatchRemoteMonthlyRentRecords(itemsForBillingPeriod).catch((err) => {
          if (getSupabaseCredentials().isConfigured) {
            console.error(
              `[Supabase RLS/Error] Failed to batch upsert electricity bills for billing_period = "${targetBillingPeriod}":`,
              err
            );
          }
        });
      }

      // Merge electricity bills:
      // If targeted generation, keep all other existing bills intact!
      let updatedBills: ElectricityBill[];
      if (isTargetedGeneration) {
        const targetedKeys = new Set(targetFlatsList.map((f) => f.flatId.toLowerCase().trim()));
        const preservedBills = prev.electricityBills.filter(
          (b) =>
            !(
              targetedKeys.has(b.flatId.toLowerCase().trim()) &&
              b.consumptionMonth === consumptionMonth &&
              b.consumptionYear === consumptionYear
            )
        );
        updatedBills = [...newBills, ...preservedBills];
      } else {
        updatedBills = [
          ...newBills,
          ...prev.electricityBills.filter(
            (b) => !(b.consumptionMonth === consumptionMonth && b.consumptionYear === consumptionYear)
          ),
        ];
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: 'CREATE_BILL',
        entity: 'ElectricityBill',
        entityId: `eb-batch-${consumptionMonth}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Generated ${newBills.length} electricity bills for ${getMonthName(consumptionMonth)} consumption (excluding disabled flats & parking)`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        units: updatedUnits,
        meterReadings: updatedMeterReadings,
        electricityBills: updatedBills,
        ledgerItems: finalLedger,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Manual Save / Update Ledger Item (2. Data Upsert / Persistence: Supabase .upsert() matching on (unit_id, period))
  const handleSaveLedgerItem = (savedItem: MonthlyLedgerItem) => {
    const cleanFlat = savedItem.flatId.toLowerCase().trim();
    const existingItem = data.ledgerItems.find(
      (i) => i.flatId.toLowerCase().trim() === cleanFlat && i.month === savedItem.month && i.year === savedItem.year
    );

    const billingPeriod = savedItem.billingPeriod || formatBillingPeriod(savedItem.month, savedItem.year);
    const resolvedRentStatus = savedItem.rentStatus || existingItem?.rentStatus || 'Not Paid';
    const resolvedRentDate =
      savedItem.rentPaymentDate ||
      (resolvedRentStatus === 'Paid' ? (existingItem?.rentPaymentDate || new Date().toISOString().slice(0, 10)) : existingItem?.rentPaymentDate);

    const isRentAdjusted = resolvedRentStatus === 'Adjusted' || savedItem.paymentStatus === 'Adjusted';
    const computedDue = isRentAdjusted
      ? calculateItemTotalDue({
          ...existingItem,
          ...savedItem,
          flatRent: savedItem.flatRent !== undefined && !isNaN(savedItem.flatRent) ? savedItem.flatRent : (existingItem?.flatRent || 0),
          electricityBill: savedItem.electricityBill !== undefined && !isNaN(savedItem.electricityBill) ? savedItem.electricityBill : (existingItem?.electricityBill || 0),
          rentStatus: 'Adjusted',
        })
      : savedItem.totalDue !== undefined
      ? savedItem.totalDue
      : (existingItem?.totalDue || 0);

    const computedPaymentStatus = isRentAdjusted
      ? (computedDue === 0 ? 'Adjusted' : 'Partially Paid')
      : (savedItem.paymentStatus || existingItem?.paymentStatus || 'Not Paid');

    // Build carefully merged item preventing any date, status or amount loss
    const itemToPersist: MonthlyLedgerItem = {
      ...(existingItem || {}),
      ...savedItem,
      billingPeriod,
      entryDate: savedItem.entryDate || existingItem?.entryDate || '2024-01-01',
      advanceDate: savedItem.advanceDate || existingItem?.advanceDate || undefined,
      rentStatus: resolvedRentStatus,
      rentPaymentDate: resolvedRentDate || undefined,
      electricityStatus: savedItem.electricityStatus || existingItem?.electricityStatus || (savedItem.electricityBill > 0 ? 'Not Paid' : 'N/A'),
      electricityDate: savedItem.electricityDate || existingItem?.electricityDate || undefined,
      totalPayable: savedItem.totalPayable !== undefined ? savedItem.totalPayable : (existingItem?.totalPayable || 0),
      totalPaid: savedItem.totalPaid !== undefined ? savedItem.totalPaid : (existingItem?.totalPaid || 0),
      totalDue: computedDue,
      paymentStatus: computedPaymentStatus,
      adjustedFromAdvance:
        isRentAdjusted
          ? (savedItem.adjustedFromAdvance || (savedItem.flatRent !== undefined ? savedItem.flatRent : (existingItem?.flatRent || 0)))
          : (savedItem.adjustedFromAdvance || existingItem?.adjustedFromAdvance || 0),
      lastPaymentDate:
        savedItem.lastPaymentDate ||
        resolvedRentDate ||
        savedItem.electricityDate ||
        savedItem.advanceDate ||
        existingItem?.lastPaymentDate ||
        undefined,
      flatRent:
        savedItem.flatRent !== undefined && !isNaN(savedItem.flatRent)
          ? savedItem.flatRent
          : existingItem?.flatRent !== undefined
          ? existingItem.flatRent
          : 0,
      advancePayment:
        savedItem.advancePayment !== undefined && !isNaN(savedItem.advancePayment)
          ? savedItem.advancePayment
          : existingItem?.advancePayment !== undefined
          ? existingItem.advancePayment
          : 0,
      electricityBill:
        savedItem.electricityBill !== undefined && !isNaN(savedItem.electricityBill)
          ? savedItem.electricityBill
          : existingItem?.electricityBill !== undefined
          ? existingItem.electricityBill
          : 0,
    };

    console.log(
      `[Supabase Save Operation] Saving Flat ${savedItem.flatId} (period: "${itemToPersist.billingPeriod}", rent_status: "${itemToPersist.rentStatus}", block_key: "${itemToPersist.blockKey || 'auto'}") to Supabase...`
    );

    upsertRemoteMonthlyRentRecord(itemToPersist)
      .then((res) => {
        if (res.success) {
          console.log(`[Supabase Save Success] Flat ${savedItem.flatId} saved successfully:`, res.data);
        } else {
          const creds = getSupabaseCredentials();
          if (!creds.isConfigured) {
            console.log(`[Supabase Remote Notice] Remote database not configured; Flat ${savedItem.flatId} saved to server disk.`);
          } else {
            console.error(`[Supabase Save Error] Failed to save Flat ${savedItem.flatId}:`, res.error?.message || res.error);
          }
        }
      })
      .catch((err: any) => {
        console.error(`[Supabase Save Exception] Failed to save Flat ${savedItem.flatId}:`, err);
      });

    updateData((prev) => {
      const existingIdx = prev.ledgerItems.findIndex(
        (i) => i.flatId.toLowerCase().trim() === cleanFlat && i.month === savedItem.month && i.year === savedItem.year
      );

      let updatedLedger: MonthlyLedgerItem[];
      if (existingIdx >= 0) {
        const prevItem = prev.ledgerItems[existingIdx];
        const merged: MonthlyLedgerItem = {
          ...prevItem,
          ...itemToPersist,
          rentStatus: itemToPersist.rentStatus,
          rentPaymentDate: itemToPersist.rentPaymentDate,
          totalPaid: itemToPersist.totalPaid,
          totalDue: itemToPersist.totalDue,
          totalPayable: itemToPersist.totalPayable,
          paymentStatus: itemToPersist.paymentStatus,
          entryDate: itemToPersist.entryDate || prevItem.entryDate,
          advanceDate: itemToPersist.advanceDate || prevItem.advanceDate,
          electricityDate: itemToPersist.electricityDate || prevItem.electricityDate,
          lastPaymentDate: itemToPersist.lastPaymentDate || prevItem.lastPaymentDate,
          flatRent: itemToPersist.flatRent !== undefined && !isNaN(itemToPersist.flatRent) ? itemToPersist.flatRent : prevItem.flatRent,
          advancePayment: itemToPersist.advancePayment !== undefined && !isNaN(itemToPersist.advancePayment) ? itemToPersist.advancePayment : prevItem.advancePayment,
          electricityBill: itemToPersist.electricityBill !== undefined && !isNaN(itemToPersist.electricityBill) ? itemToPersist.electricityBill : prevItem.electricityBill,
        };
        updatedLedger = [...prev.ledgerItems];
        updatedLedger[existingIdx] = merged;
      } else {
        updatedLedger = [itemToPersist, ...prev.ledgerItems];
      }

      // Sync advance payment and status across other months ONLY if positive or paid status
      const advVal = Number(itemToPersist.advancePayment);
      if (advVal > 0 || itemToPersist.advanceStatus === 'Paid' || itemToPersist.advanceStatus === 'Partially Paid') {
        const advStat = itemToPersist.advanceStatus || (advVal > 0 ? 'Paid' : 'Not Paid');
        const advDt = itemToPersist.advanceDate;
        updatedLedger = updatedLedger.map((item) => {
          if (item.flatId.toLowerCase().trim() === cleanFlat && item.id !== itemToPersist.id) {
            return {
              ...item,
              advancePayment: advVal > 0 ? advVal : item.advancePayment,
              advanceStatus: advStat,
              advanceDate: advDt || item.advanceDate,
            };
          }
          return item;
        });
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: existingIdx >= 0 ? 'UPDATE_LEDGER_MANUAL' : 'ADD_LEDGER_MANUAL',
        entity: 'MonthlyLedger',
        entityId: `${savedItem.flatId}-${savedItem.month}-${savedItem.year}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Manual ledger data ${existingIdx >= 0 ? 'updated' : 'added'} for Flat ${savedItem.flatId} (${savedItem.month}/${savedItem.year})`,
        timestamp: new Date().toISOString(),
      };

      // Sync advance accounts safely without wiping existing deposit data
      let updatedAdvanceAccounts = prev.advanceAccounts;
      const advPaidNum = Number(itemToPersist.advancePayment !== undefined ? itemToPersist.advancePayment : 0);
      const isAdvanceRelevant =
        advPaidNum > 0 ||
        itemToPersist.advanceStatus === 'Paid' ||
        itemToPersist.advanceStatus === 'Partially Paid' ||
        itemToPersist.advanceStatus === 'Adjusted' ||
        itemToPersist.rentStatus === 'Adjusted' ||
        itemToPersist.paymentStatus === 'Adjusted';

      if (isAdvanceRelevant) {
        updatedAdvanceAccounts = [...prev.advanceAccounts];
        const advIndex = updatedAdvanceAccounts.findIndex(
          (a) => a.flatId.toLowerCase().trim() === cleanFlat
        );
        const isNotPaid = itemToPersist.advanceStatus === 'Not Paid';
        const isPartial = itemToPersist.advanceStatus === 'Partially Paid';
        const isPaid = itemToPersist.advanceStatus === 'Paid';
        const isAdjusted = itemToPersist.advanceStatus === 'Adjusted';

        const resolvedStatus: 'paid' | 'not_paid' | 'partially_paid' =
          isNotPaid || (advPaidNum === 0 && !isPaid && !isAdjusted && advIndex < 0)
            ? 'not_paid'
            : isPartial
            ? 'partially_paid'
            : isPaid || isAdjusted
            ? 'paid'
            : 'not_paid';

        const resolvedPaid = advPaidNum;
        const resolvedRequired = advPaidNum;

        // Calculate total rent adjusted across all ledger items for this flat
        const totalAdjustedForFlat = updatedLedger
          .filter(
            (i) =>
              i.flatId.toLowerCase().trim() === cleanFlat &&
              (i.rentStatus === 'Adjusted' ||
                i.paymentStatus === 'Adjusted' ||
                (i.adjustedFromAdvance !== undefined && i.adjustedFromAdvance > 0))
          )
          .reduce(
            (s, i) =>
              s +
              (i.adjustedFromAdvance && i.adjustedFromAdvance > 0
                ? i.adjustedFromAdvance
                : i.rentStatus === 'Adjusted' || i.paymentStatus === 'Adjusted'
                ? i.flatRent
                : 0),
            0
          );

        if (advIndex >= 0) {
          const acc = updatedAdvanceAccounts[advIndex];
          const basePaid = resolvedPaid > 0 ? resolvedPaid : acc.amountPaid;
          const newRemaining = Math.max(0, basePaid - totalAdjustedForFlat);
          updatedAdvanceAccounts[advIndex] = {
            ...acc,
            totalRequired: resolvedRequired > 0 ? resolvedRequired : acc.totalRequired,
            amountPaid: basePaid,
            remainingAdvance: newRemaining,
            status: newRemaining <= 0 ? 'not_paid' : newRemaining < basePaid ? 'partially_paid' : (acc.status || resolvedStatus),
            lastPaymentDate:
              itemToPersist.advanceDate || acc.lastPaymentDate || new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          };
        } else if (resolvedPaid > 0) {
          const newRemaining = Math.max(0, resolvedPaid - totalAdjustedForFlat);
          updatedAdvanceAccounts.push({
            id: `adv-${savedItem.flatId.toLowerCase()}`,
            tenantId: itemToPersist.tenantId,
            unitId: itemToPersist.unitId,
            flatId: itemToPersist.flatId,
            totalRequired: resolvedRequired,
            amountPaid: resolvedPaid,
            remainingAdvance: newRemaining,
            status: newRemaining <= 0 ? 'not_paid' : newRemaining < resolvedPaid ? 'partially_paid' : resolvedStatus,
            lastPaymentDate:
              itemToPersist.advanceDate || new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Check if new tenant entry occurred in the same rental unit
      const existingTenant = prev.tenants.find(
        (t) => t.flatId.toLowerCase().trim() === cleanFlat && !t.flatId.toLowerCase().includes('owner')
      );
      const newTenantName = (itemToPersist.tenantName || '').trim();
      const isNewTenantEntry = Boolean(
        newTenantName &&
        newTenantName.toLowerCase() !== 'vacant' &&
        newTenantName.toLowerCase() !== 'vacant flat' &&
        newTenantName.toLowerCase() !== 'n/a' &&
        existingTenant &&
        !isSameTenantPerson(existingTenant.fullName, newTenantName)
      );

      let updatedChatMessages = prev.chatMessages || [];
      let newAuditLogs = [audit, ...prev.auditLogs];

      if (isNewTenantEntry) {
        // Immediately remove all conversation messages of previous tenant in this rental unit
        updatedChatMessages = updatedChatMessages.filter((m) => !isMessageAssociatedWithFlat(m, savedItem.flatId));
        newAuditLogs = [
          {
            id: `log-${Date.now()}-chat-purge`,
            action: 'PURGE_PREVIOUS_TENANT_CHAT',
            entity: 'ChatMessage',
            entityId: savedItem.flatId,
            performedBy: activeUserFullName,
            userRole: activeUserRole,
            details: `New tenant "${newTenantName}" entered Flat ${savedItem.flatId}. All conversation messages of previous tenant (${existingTenant?.fullName}) removed immediately.`,
            timestamp: new Date().toISOString(),
          },
          ...newAuditLogs,
        ];
      }

      return syncTenantsWithCurrentLedger({
        ...prev,
        ledgerItems: updatedLedger,
        advanceAccounts: updatedAdvanceAccounts,
        chatMessages: updatedChatMessages,
        auditLogs: newAuditLogs,
      });
    });
  };

  // Delete an entire flat row from monthly ledger (to remove duplicate or unwanted entries)
  const handleDeleteLedgerItem = (
    itemId: string,
    flatId: string,
    month: number,
    year: number,
    deleteFromMasterUnits?: boolean
  ) => {
    updateData((prev) => {
      // 1. Remove the specific ledger item by ID
      const updatedLedger = prev.ledgerItems.filter((item) => item.id !== itemId);

      // 2. If deleteFromMasterUnits is requested, also remove unit and its tenant
      let updatedUnits = prev.units;
      let updatedTenants = prev.tenants;
      if (deleteFromMasterUnits) {
        updatedUnits = prev.units.filter((u) => u.flatId.toLowerCase().trim() !== flatId.toLowerCase().trim());
        updatedTenants = prev.tenants.filter((t) => t.flatId.toLowerCase().trim() !== flatId.toLowerCase().trim());
      }

      // 3. Remote Supabase deletion (if configured)
      const billingPeriod = formatBillingPeriod(month, year);
      const targetUnit = prev.units.find((u) => u.flatId.toLowerCase().trim() === flatId.toLowerCase().trim());
      if (targetUnit) {
        deleteRemoteMonthlyRentRecord(targetUnit.id, billingPeriod).catch((err) => {
          console.warn(`[Supabase Delete Warning]:`, err);
        });
      }

      const audit = {
        id: `log-${Date.now()}`,
        action: 'DELETE_ROW',
        entity: 'MonthlyLedger',
        entityId: itemId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Deleted flat row for Flat ${flatId} from ${getMonthName(month)} ${year} ledger (Removed duplicate entry)${deleteFromMasterUnits ? ' and removed unit from master units registry' : ''}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        units: updatedUnits,
        tenants: updatedTenants,
        ledgerItems: updatedLedger,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Copy Ledger Data from Previous Month
  // As requested:
  // 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance, 6. Flat Rent are copied
  // 7. Electricity, 8. Parking data are set to EMPTY (0) for manual input
  // Resets payment statuses: rentStatus = 'Not Paid', totalPaid = 0, totalDue = totalPayable, paymentStatus = 'Not Paid'
  const handleCopyPreviousMonthLedger = (
    targetMonth: number,
    targetYear: number,
    sourceMonth?: number,
    sourceYear?: number
  ) => {
    const srcMonth = sourceMonth || (targetMonth === 1 ? 12 : targetMonth - 1);
    const srcYear = sourceYear || (targetMonth === 1 ? targetYear - 1 : targetYear);
    const targetPeriod = formatBillingPeriod(targetMonth, targetYear);
    const sourcePeriod = formatBillingPeriod(srcMonth, srcYear);

    console.log(
      `[Supabase Clone Roster] Cloning tenant roster from ${sourcePeriod} into target billing_period = "${targetPeriod}"...`
    );

    updateData((prev) => {
      // Find source month items
      let sourceItems = prev.ledgerItems.filter((i) => i.month === srcMonth && i.year === srcYear);

      // If no items in source month, fallback to generating baseline
      if (sourceItems.length === 0) {
        sourceItems = generateInitialLedger(srcMonth, srcYear);
      }

      // Existing items in other months
      const otherMonthsItems = prev.ledgerItems.filter((i) => !(i.month === targetMonth && i.year === targetYear));

      // Build copied items with reset payment statuses
      const newTargetItems: MonthlyLedgerItem[] = sourceItems.map((src) => {
        const isOwnerFlat = src.flatId.includes('Owner') || src.tenantName === 'Owner Occupied' || src.tenantName === 'Vacant Flat';
        const matchingUnit = prev.units.find((u) => u.flatId.toLowerCase().trim() === src.flatId.toLowerCase().trim());
        const isElecEnabled =
          (matchingUnit?.isElectricityEnabled ?? (matchingUnit?.electricityBillingType === 'nesco_submeter' || !matchingUnit?.electricityBillingType)) &&
          matchingUnit?.electricityBillingType !== 'none';
        const flatRent = isOwnerFlat ? 0 : src.flatRent;
        const electricityBill = 0; // 7. Electricity EMPTY (0) for manual input
        const parkingRent = 0;     // 8. Parking EMPTY (0) for manual input
        const godownRent = src.godownRent || 0;
        const totalPayable = flatRent + godownRent; // Ready for electricity & parking manual inputs
        const totalPaid = 0;
        const totalDue = isOwnerFlat ? 0 : totalPayable;
        const paymentStatus: PaymentStatus = isOwnerFlat ? 'N/A' : 'Not Paid';
        const rentStatus: PaymentStatus = isOwnerFlat ? 'N/A' : 'Not Paid';

        return {
          id: `led-${src.flatId.toLowerCase()}-${targetPeriod}`,
          unitId: src.unitId || matchingUnit?.id || `u-${src.flatId}`,
          flatId: src.flatId,           // 1. Flat ID copied
          blockName: src.blockName,
          tenantId: src.tenantId,
          tenantName: src.tenantName,   // 2. Tenant Name copied
          tenantPhone: src.tenantPhone, // 3. Mobile copied
          entryDate: src.entryDate,     // 4. Entry Date copied
          billingPeriod: targetPeriod,  // Strict YYYY-MM column
          month: targetMonth,
          year: targetYear,
          advancePayment: isOwnerFlat ? 0 : (src.advancePayment !== undefined ? src.advancePayment : (prev.advanceAccounts.find((a) => a.flatId === src.flatId)?.amountPaid ?? 0)),
          advanceStatus: isOwnerFlat ? 'N/A' : (src.advanceStatus || (src.advancePayment && src.advancePayment > 0 ? 'Paid' : 'Not Paid')),
          advanceDate: isOwnerFlat ? undefined : src.advanceDate,
          flatRent,                     // 6. Flat Rent copied
          rentStatus,
          rentPaymentDate: undefined,
          electricityBill: 0,           // 7. Electricity EMPTY for manual input
          electricityStatus: isElecEnabled ? ('Not Paid' as const) : ('N/A' as const),
          electricityDate: undefined,
          parkingRent: 0,               // 8. Parking EMPTY for manual input
          godownRent,
          totalPayable,
          totalPaid,
          totalDue,
          paymentStatus,
          adjustedFromAdvance: 0,
          lastPaymentDate: undefined,
          notes: src.notes || '',
        };
      });

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      upsertBatchRemoteMonthlyRentRecords(newTargetItems).catch((err: any) => {
        console.warn(
          `[Supabase Sync Notice] Remote batch upsert for ${targetPeriod}:`,
          err?.message || err
        );
      });

      const audit = {
        id: `log-${Date.now()}`,
        action: 'COPY_PREVIOUS_MONTH_LEDGER',
        entity: 'MonthlyLedger',
        entityId: `ledger-${targetPeriod}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Copied tenant roster from ${sourcePeriod} to ${targetPeriod} with reset payment statuses (Advance & Rent preserved; Electricity & Parking reset to 0; Status: Not Paid)`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        ledgerItems: [...newTargetItems, ...otherMonthsItems],
        selectedMonth: targetMonth,
        selectedYear: targetYear,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Handle Import from Excel or Google Sheet
  // Strictly: 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance
  // If any field is empty, it leaves it as it is and proceeds to next
  const handleImportLedgerData = (
    importedItems: MonthlyLedgerItem[],
    targetMonth: number,
    targetYear: number,
    options: { updateUnits: boolean; updateTenants: boolean; updateAdvance: boolean }
  ) => {
    updateData((prev) => {
      // 1. Merge into ledgerItems for targetMonth and targetYear
      const otherMonthsItems = prev.ledgerItems.filter(
        (i) => !(i.month === targetMonth && i.year === targetYear)
      );
      const existingThisMonth = prev.ledgerItems.filter(
        (i) => i.month === targetMonth && i.year === targetYear
      );

      const updatedThisMonth = [...existingThisMonth];
      importedItems.forEach((newItem) => {
        const idx = updatedThisMonth.findIndex((i) => i.flatId === newItem.flatId);
        if (idx >= 0) {
          const existing = updatedThisMonth[idx];
          // Strictly only upload: 1. Flat ID, 2. Tenant Name, 3. Mobile, 4. Entry Date, 5. Advance
          // If any field is empty, leave it as it is and do next
          const tenantName =
            newItem.tenantName && newItem.tenantName.trim() ? newItem.tenantName.trim() : existing.tenantName;
          const tenantPhone =
            newItem.tenantPhone && newItem.tenantPhone.trim() ? newItem.tenantPhone.trim() : existing.tenantPhone;
          const entryDate =
            newItem.entryDate && newItem.entryDate.trim() ? newItem.entryDate.trim() : existing.entryDate;
          const advancePayment =
            newItem.advancePayment !== undefined && newItem.advancePayment !== null && !isNaN(newItem.advancePayment)
              ? newItem.advancePayment
              : existing.advancePayment;
          const advanceStatus = newItem.advanceStatus || existing.advanceStatus;

          updatedThisMonth[idx] = {
            ...existing,
            tenantName,
            tenantPhone,
            entryDate,
            advancePayment,
            advanceStatus,
            // Strictly preserve: flatRent, electricityBill, parkingRent, godownRent, paymentStatus, rentStatus, electricityStatus, totalPaid, totalPayable, totalDue
          };
        } else {
          updatedThisMonth.push(newItem);
        }
      });

      const audit = {
        id: `log-${Date.now()}`,
        action: 'IMPORT_EXCEL_LEDGER',
        entity: 'MonthlyLedger',
        entityId: `ledger-${targetMonth}-${targetYear}`,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Overrode ledger data for ${getMonthName(targetMonth)} ${targetYear} only (${importedItems.length} flats updated). Other months remain unchanged.`,
        timestamp: new Date().toISOString(),
      };

      // 2. Data Upsert / Persistence: Perform a Supabase .upsert() matching on (unit_id, billing_period)
      upsertBatchRemoteMonthlyRentRecords(updatedThisMonth).catch((err) => {
        if (getSupabaseCredentials().isConfigured) {
          console.error('[Supabase RLS/Error] Failed to batch upsert imported ledger items into Supabase:', err);
        }
      });

      return {
        ...prev,
        ledgerItems: [...otherMonthsItems, ...updatedThisMonth],
        selectedMonth: targetMonth,
        selectedYear: targetYear,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Update Meter Reading
  const handleUpdateMeterReading = (
    flatId: string,
    currentReading: number,
    month: number,
    year: number
  ) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === flatId);
      const existing = prev.meterReadings.find((r) => r.flatId === flatId && r.month === month && r.year === year);
      const prevReading = existing?.previousReading || 1500;
      const consumedUnits = Math.max(0, currentReading - prevReading);

      const newReading = {
        id: `mr-${flatId}-${month}-${year}`,
        unitId: unit?.id || '',
        flatId,
        month,
        year,
        previousReading: prevReading,
        currentReading,
        consumedUnits,
        readingDate: new Date().toISOString().split('T')[0],
        recordedBy: activeUserFullName,
      };

      return {
        ...prev,
        meterReadings: [
          newReading,
          ...prev.meterReadings.filter((r) => !(r.flatId === flatId && r.month === month && r.year === year)),
        ],
      };
    });
  };

  // Submit Complaint
  const handleSubmitComplaint = (category: ComplaintCategory, subject: string, description: string) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === activeUserFlatId);
      const newComplaint = {
        id: `comp-${Date.now().toString().slice(-4)}`,
        tenantId: activeUserId,
        tenantName: activeUserFullName,
        flatId: activeUserFlatId,
        blockName: unit?.blockName || 'Block A',
        category,
        subject,
        description,
        submissionDate: new Date().toISOString(),
        status: 'Submitted' as ComplaintStatus,
        messages: [],
      };
      return {
        ...prev,
        complaints: [newComplaint, ...prev.complaints],
      };
    });
  };

  // Update Complaint Status
  const handleUpdateComplaintStatus = (complaintId: string, status: ComplaintStatus) => {
    updateData((prev) => ({
      ...prev,
      complaints: prev.complaints.map((c) => (c.id === complaintId ? { ...c, status } : c)),
    }));
  };

  // Add Message to Complaint
  const handleAddComplaintMessage = (complaintId: string, message: string) => {
    updateData((prev) => ({
      ...prev,
      complaints: prev.complaints.map((c) => {
        if (c.id === complaintId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              {
                id: `cm-${Date.now()}`,
                senderName: activeUserFullName,
                senderRole: activeUserRole,
                message,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }
        return c;
      }),
    }));
  };

  // Send Direct Chat Message
  const handleSendMessage = (recipientId: string, recipientName: string, message: string) => {
    updateData((prev) => {
      // Find tenant or flat if message involves a tenant
      const targetTenant = prev.tenants.find(
        (t) => t.id === recipientId || t.flatId.toLowerCase() === recipientId.toLowerCase()
      );
      const isSenderTenant = activeUserRole === 'tenant';
      const senderTenant = isSenderTenant
        ? prev.tenants.find((t) => t.id === activeUserId || (currentUser?.flatId && t.flatId === currentUser.flatId))
        : undefined;

      const flatId = targetTenant?.flatId || senderTenant?.flatId || (isSenderTenant ? currentUser?.flatId : undefined);
      const tenantId = targetTenant?.id || senderTenant?.id || (isSenderTenant ? activeUserId : undefined);
      const conversationId = flatId ? `conv-${flatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : `conv-${recipientId}`;

      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        conversationId,
        senderId: activeUserId,
        senderName: activeUserFullName,
        senderRole: activeUserRole,
        recipientId,
        message,
        timestamp: new Date().toISOString(),
        isRead: false,
        flatId,
        tenantId,
      };
      return {
        ...prev,
        chatMessages: [...(prev.chatMessages || []), newMsg],
      };
    });
  };

  // Explicitly purge conversation messages for a rental unit (e.g. upon new tenant entry or manager request)
  const handleClearTenantChatMessages = (flatId: string) => {
    updateData((prev) => {
      const remainingMessages = (prev.chatMessages || []).filter((m) => !isMessageAssociatedWithFlat(m, flatId));
      const audit = {
        id: `log-${Date.now()}`,
        action: 'CLEAR_CHAT_MESSAGES',
        entity: 'ChatMessage',
        entityId: flatId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Purged all previous tenant conversation messages for rental unit Flat ${flatId}`,
        timestamp: new Date().toISOString(),
      };
      return {
        ...prev,
        chatMessages: remainingMessages,
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  // Submit Online Payment Request (bKash/Nagad/Rocket with 1.8% fee)
  const handleSubmitOnlinePayment = (
    flatId: string,
    baseAmount: number,
    feeAmount: number,
    totalAmount: number,
    method: 'bKash' | 'Nagad' | 'Rocket',
    transactionId: string,
    category: string,
    recipientNumber?: string,
    recipientOwnerName?: string
  ) => {
    updateData((prev) => {
      const unit = prev.units.find((u) => u.flatId === flatId);
      const newReq: OnlinePaymentRequest = {
        id: `onl-${Date.now()}`,
        tenantId: activeUserId,
        tenantName: activeUserFullName,
        flatId,
        blockName: unit?.blockName,
        month: prev.selectedMonth,
        year: prev.selectedYear,
        category,
        baseAmount,
        feeAmount,
        amount: totalAmount,
        paymentMethod: method,
        recipientNumber,
        recipientOwnerName,
        transactionId,
        submissionDate: new Date().toISOString(),
        verificationStatus: 'Pending',
      };
      return {
        ...prev,
        onlineRequests: [newReq, ...prev.onlineRequests],
      };
    });
  };

  // Verify Online Payment Request
  const handleVerifyPayment = (requestId: string, status: 'Verified' | 'Rejected') => {
    const req = data.onlineRequests.find((r) => r.id === requestId);
    if (!req) return;

    if (status === 'Verified') {
      const creditAmount = req.baseAmount || req.amount;
      handleRecordPayment(
        req.flatId,
        creditAmount,
        req.paymentMethod,
        'Combined',
        req.transactionId,
        `Verified online MFS payment (Total sent: ৳${req.amount}, 1.8% MFS cashout fee: ৳${req.feeAmount || 0})`
      );
    }

    updateData((prev) => ({
      ...prev,
      onlineRequests: prev.onlineRequests.map((r) =>
        r.id === requestId ? { ...r, verificationStatus: status, verifiedBy: activeUserFullName } : r
      ),
    }));
  };

  // Unit Operations (Creates unit and auto-syncs to Monthly Ledger and NESCO Electricity immediately)
  const handleAddUnit = (
    unitPayload: (Omit<Unit, 'id'> & Partial<NewRentalUnitPayload>) | NewRentalUnitPayload
  ) => {
    const cleanFlatId = unitPayload.flatId.trim().toUpperCase();
    const blockName = unitPayload.blockName || 'Block A';
    const blockId =
      blockName === 'Block A' ? 'block-a' : blockName === 'Block B' ? 'block-b' : 'block-c';
    const blockKey =
      blockName === 'Block A' ? 'blockA' : blockName === 'Block B' ? 'blockB' : 'blockC';
    const newUnitId = `u-${cleanFlatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;

    const isOccupied = Boolean(unitPayload.isOccupied || unitPayload.tenantName?.trim());
    const tenantName = unitPayload.tenantName?.trim();
    const tenantPhone = unitPayload.tenantPhone?.trim() || '';
    const entryDate =
      unitPayload.entryDate ||
      `${data.selectedYear}-${String(data.selectedMonth).padStart(2, '0')}-01`;
    const monthlyRent = Number(unitPayload.monthlyRent) || 0;
    const advanceAmount = Number(unitPayload.advanceAmount) || 0;
    const advanceStatus = unitPayload.advanceStatus || (advanceAmount > 0 ? 'Not Paid' : 'N/A');

    const elecType = unitPayload.electricityBillingType || 'nesco_submeter';
    const isElecOn = elecType === 'nesco_submeter';
    const prevReading = Number(unitPayload.meterPreviousReading) || 0;
    const currReading =
      Number(unitPayload.meterCurrentReading) !== undefined &&
      Number(unitPayload.meterCurrentReading) >= prevReading
        ? Number(unitPayload.meterCurrentReading)
        : prevReading;
    const sanctionedLoad = Number(unitPayload.sanctionedLoad) || 2;

    const newTenantId = isOccupied
      ? `t-${cleanFlatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`
      : undefined;

    const newUnit: Unit = {
      id: newUnitId,
      flatId: cleanFlatId,
      blockId,
      blockName,
      floor: Number(unitPayload.floor) || 1,
      unitType: unitPayload.unitType || 'residential',
      monthlyRent,
      isOccupied,
      tenantId: newTenantId,
      electricityBillingType: elecType,
      isElectricityEnabled: isElecOn,
      meterPreviousReading: prevReading,
      meterCurrentReading: currReading,
      parkingSlot: unitPayload.parkingSlot || undefined,
      godownSlot: unitPayload.godownSlot || undefined,
      notes: unitPayload.notes || undefined,
    };

    updateData((prev) => {
      // 1. Tenants
      let updatedTenants = [...prev.tenants];
      if (newTenantId) {
        const newTenant: Tenant = {
          id: newTenantId,
          unitId: newUnitId,
          flatId: cleanFlatId,
          blockName,
          fullName: tenantName || 'Resident',
          phone: tenantPhone,
          nidNumber: '',
          entryDate,
          emergencyContact: '',
          status: 'active',
        };
        updatedTenants = [newTenant, ...prev.tenants.filter((t) => t.flatId !== cleanFlatId)];
      }

      // 2. Advance Accounts & Transactions
      let updatedAdvanceAccounts = [...prev.advanceAccounts];
      let updatedAdvanceTransactions = [...prev.advanceTransactions];
      if (advanceAmount > 0 && newTenantId) {
        const newAdvAccount: AdvanceAccount = {
          id: `adv-${cleanFlatId.toLowerCase()}-${Date.now().toString().slice(-4)}`,
          tenantId: newTenantId,
          unitId: newUnitId,
          flatId: cleanFlatId,
          totalRequired: advanceAmount,
          amountPaid: advanceStatus === 'Paid' ? advanceAmount : 0,
          remainingAdvance: advanceStatus === 'Paid' ? advanceAmount : 0,
          status: advanceStatus === 'Paid' ? 'paid' : 'not_paid',
          lastPaymentDate: advanceStatus === 'Paid' ? entryDate : undefined,
          updatedAt: new Date().toISOString(),
        };
        updatedAdvanceAccounts = [newAdvAccount, ...prev.advanceAccounts.filter((a) => a.flatId !== cleanFlatId)];

        if (advanceStatus === 'Paid') {
          updatedAdvanceTransactions = [
            {
              id: `atx-${Date.now()}`,
              advanceAccountId: newAdvAccount.id,
              tenantId: newTenantId,
              tenantName: tenantName || 'Resident',
              flatId: cleanFlatId,
              amount: advanceAmount,
              type: 'deposit',
              paymentDate: entryDate,
              paymentMethod: 'Cash',
              receiptNo: `ADV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
              notes: 'Initial security deposit upon unit creation',
              recordedBy: activeUserFullName,
              createdAt: new Date().toISOString(),
            },
            ...prev.advanceTransactions,
          ];
        }
      }

      // 3. Meter Readings (for postpaid consumption period)
      const elecPeriod = getPostpaidElectricityPeriod(prev.selectedMonth, prev.selectedYear);
      const consumedUnits = Math.max(0, currReading - prevReading);
      const newMeterReading: MeterReading = {
        id: `mr-${cleanFlatId.toLowerCase()}-${elecPeriod.month}-${elecPeriod.year}`,
        unitId: newUnitId,
        flatId: cleanFlatId,
        month: elecPeriod.month,
        year: elecPeriod.year,
        previousReading: prevReading,
        currentReading: currReading,
        consumedUnits,
        readingDate: new Date().toISOString().split('T')[0],
        recordedBy: activeUserFullName,
      };
      const updatedMeterReadings = [
        newMeterReading,
        ...prev.meterReadings.filter(
          (r) => !(r.flatId === cleanFlatId && r.month === elecPeriod.month && r.year === elecPeriod.year)
        ),
      ];

      // 4. Electricity Bills (for consumption period and active billing month)
      const calc = calculateNescoElectricityBill(
        currReading,
        prevReading,
        prev.tariffConfig,
        sanctionedLoad
      );
      const initialElecBillAmount = isElecOn ? calc.totalBill : (elecType === 'fixed' ? (newUnit.fixedElectricityAmount || 0) : 0);
      const newElecBill: ElectricityBill = {
        id: `eb-${cleanFlatId.toLowerCase()}-${elecPeriod.month}-${elecPeriod.year}`,
        unitId: newUnitId,
        flatId: cleanFlatId,
        tenantId: newTenantId || '',
        tenantName: tenantName || (isOccupied ? 'Resident' : 'Vacant'),
        consumptionMonth: elecPeriod.month,
        consumptionYear: elecPeriod.year,
        billingMonth: prev.selectedMonth,
        billingYear: prev.selectedYear,
        previousReading: prevReading,
        currentReading: currReading,
        consumedUnits: calc.consumedUnits,
        slabBreakdown: calc.slabBreakdown,
        baseEnergyCost: calc.baseEnergyCost,
        demandCharge: calc.demandCharge,
        vatAmount: calc.vatAmount,
        meterRent: calc.meterRent,
        rebateAmount: calc.rebateAmount,
        totalBill: initialElecBillAmount,
        paidAmount: 0,
        dueAmount: initialElecBillAmount,
        paymentStatus: 'Not Paid',
        generatedDate: new Date().toISOString().split('T')[0],
        tariffSnapshotTitle: prev.tariffConfig.title,
      };
      const updatedElectricityBills = [
        newElecBill,
        ...prev.electricityBills.filter(
          (b) => !(b.flatId === cleanFlatId && b.consumptionMonth === elecPeriod.month && b.consumptionYear === elecPeriod.year)
        ),
      ];

      // 5. Monthly Ledger Items:
      // Ensure unit is present in the ledger for current selectedMonth-selectedYear,
      // as well as all distinct periods already recorded in prev.ledgerItems.
      const existingPeriods = Array.from(
        new Set(prev.ledgerItems.map((i) => `${i.month}-${i.year}`))
      );
      if (!existingPeriods.includes(`${prev.selectedMonth}-${prev.selectedYear}`)) {
        existingPeriods.push(`${prev.selectedMonth}-${prev.selectedYear}`);
      }

      const parkingRent = newUnit.parkingSlot ? 2500 : 0;
      const godownRent = newUnit.godownSlot ? 6000 : 0;
      const totalPayable = monthlyRent + initialElecBillAmount + parkingRent + godownRent;

      const newLedgerItemsForUnit: MonthlyLedgerItem[] = existingPeriods.map((pStr) => {
        const [mStr, yStr] = pStr.split('-');
        const m = parseInt(mStr, 10);
        const y = parseInt(yStr, 10);
        const isCurrentPeriod = m === prev.selectedMonth && y === prev.selectedYear;
        const bPeriod = formatBillingPeriod(m, y);

        return {
          id: `ledger-${cleanFlatId.toLowerCase()}-${m}-${y}`,
          unitId: newUnitId,
          flatId: cleanFlatId,
          blockName,
          blockKey,
          tenantId: newTenantId || '',
          tenantName: tenantName || (isOccupied ? 'Resident' : 'Vacant'),
          tenantPhone,
          entryDate,
          billingPeriod: bPeriod,
          month: m,
          year: y,
          advancePayment: advanceAmount,
          advanceStatus: (advanceAmount > 0 ? (advanceStatus === 'Paid' ? 'Paid' : 'Not Paid') : 'N/A') as any,
          advanceDate: advanceStatus === 'Paid' ? entryDate : undefined,
          flatRent: monthlyRent,
          rentStatus: (isOccupied ? 'Not Paid' : 'N/A') as any,
          electricityBill: isCurrentPeriod ? initialElecBillAmount : 0,
          electricityStatus: (elecType !== 'none' ? 'Not Paid' : 'N/A') as any,
          parkingRent,
          godownRent,
          totalPayable: isOccupied ? totalPayable : 0,
          totalPaid: 0,
          totalDue: isOccupied ? totalPayable : 0,
          paymentStatus: (isOccupied ? 'Not Paid' : 'N/A') as PaymentStatus,
          adjustedFromAdvance: 0,
          notes: unitPayload.notes || 'Created via Manager Dashboard',
        };
      });

      const updatedLedgerItems = [
        ...prev.ledgerItems.filter((i) => i.flatId !== cleanFlatId),
        ...newLedgerItemsForUnit,
      ];

      // Async sync to Supabase if configured
      if (getSupabaseCredentials().isConfigured) {
        const currentPeriodItems = newLedgerItemsForUnit.filter(
          (i) => i.month === prev.selectedMonth && i.year === prev.selectedYear
        );
        upsertBatchRemoteMonthlyRentRecords(currentPeriodItems).catch((err) => {
          console.warn('[Supabase Sync] Could not sync new rental unit ledger record:', err);
        });
      }

      // 6. Audit Log
      const audit = {
        id: `log-${Date.now()}`,
        action: 'CREATE_UNIT',
        entity: 'Unit',
        entityId: newUnitId,
        performedBy: activeUserFullName,
        userRole: activeUserRole,
        details: `Created rental unit ${cleanFlatId} (${blockName}) with immediate Ledger & NESCO sync`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        units: [...prev.units.filter((u) => u.flatId !== cleanFlatId), newUnit],
        tenants: updatedTenants,
        advanceAccounts: updatedAdvanceAccounts,
        advanceTransactions: updatedAdvanceTransactions,
        meterReadings: updatedMeterReadings,
        electricityBills: updatedElectricityBills,
        ledgerItems: updatedLedgerItems,
        chatMessages: (prev.chatMessages || []).filter((m) => !isMessageAssociatedWithFlat(m, cleanFlatId)),
        auditLogs: [audit, ...prev.auditLogs],
      };
    });
  };

  const handleUpdateUnitRent = (unitId: string, monthlyRent: number) => {
    updateData((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === unitId ? { ...u, monthlyRent } : u)),
    }));
  };

  const handleVacateUnit = (unitId: string) => {
    updateData((prev) => {
      const targetUnit = prev.units.find((u) => u.id === unitId);
      const flatId = targetUnit?.flatId;
      return {
        ...prev,
        units: prev.units.map((u) => (u.id === unitId ? { ...u, isOccupied: false, tenantId: undefined } : u)),
        chatMessages: flatId
          ? (prev.chatMessages || []).filter((m) => !isMessageAssociatedWithFlat(m, flatId))
          : prev.chatMessages,
      };
    });
  };

  // User Accounts
  const handleAddUser = (user: Omit<UserProfile, 'id' | 'createdAt'>) => {
    updateData((prev) => ({
      ...prev,
      profiles: [...prev.profiles, { ...user, id: `user-${Date.now()}`, createdAt: new Date().toISOString() }],
    }));
  };

  const handleToggleUserStatus = (userId: string) => {
    updateData((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, isActive: !p.isActive } : p)),
    }));
  };

  const handleResetPassword = (userId: string) => {
    // Password reset simulation with audit log
    updateData((prev) => ({
      ...prev,
      auditLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'RESET_PASSWORD',
          entity: 'UserProfile',
          entityId: userId,
          performedBy: activeUserFullName,
          userRole: activeUserRole,
          details: `Manager reset password for user ${userId}`,
          timestamp: new Date().toISOString(),
        },
        ...prev.auditLogs,
      ],
    }));
  };

  const handleUpdateSecurityCredentials = (credentials: SecurityCredentials, auditNote?: string) => {
    updateData((prev) => ({
      ...prev,
      securityCredentials: credentials,
      auditLogs: auditNote
        ? [
            {
              id: `log-${Date.now()}`,
              action: 'UPDATE_SECURITY_CREDENTIALS',
              entity: 'SecurityCredentials',
              entityId: 'global',
              performedBy: activeUserFullName,
              userRole: activeUserRole,
              details: auditNote,
              timestamp: new Date().toISOString(),
            },
            ...prev.auditLogs,
          ]
        : prev.auditLogs,
    }));
  };

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('mbd_logged_in_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('mbd_logged_in_user');
    } catch (e) {
      console.error(e);
    }
    setIsMobileMenuOpen(false);
    setCurrentView('dashboard');
  };

  // Navigation items based on role (Advance Payments, Rental Units, and Electricity tabs removed from left menubar)
  const getNavItems = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'manager') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'monthly-ledger', label: 'Monthly Ledger', icon: FileSpreadsheet },
        { id: 'online-payments', label: 'Online Payments', icon: CreditCard },
        { id: 'complaints', label: 'Complaints', icon: AlertCircle },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'passwords', label: 'Password Settings', icon: KeyRound },
        { id: 'audit-logs', label: 'Audit Logs', icon: History },
      ];
    } else if (currentUser.role === 'owner') {
      return [
        { id: 'dashboard', label: `${currentUser.assignedBlock} Dashboard`, icon: LayoutDashboard },
        { id: 'monthly-ledger', label: `${currentUser.assignedBlock} Ledger`, icon: FileSpreadsheet },
        { id: 'complaints', label: 'Complaints', icon: AlertCircle },
        { id: 'messages', label: 'Messages', icon: MessageSquare },
      ];
    } else {
      return [
        { id: 'dashboard', label: 'My Dashboard & Bills', icon: LayoutDashboard },
        { id: 'complaints', label: 'Maintenance Requests', icon: AlertCircle },
        { id: 'messages', label: 'Chat with Management', icon: MessageSquare },
      ];
    }
  };

  const navItems = getNavItems();
  const dbCreds = getSupabaseCredentials();

  // List of billing periods for header dropdown (strict YYYY-MM scoping)
  const headerBillingPeriods = React.useMemo(() => {
    const list: { period: string; label: string; month: number; year: number }[] = [];
    for (let y = 2027; y >= 2025; y--) {
      for (let m = 12; m >= 1; m--) {
        const period = formatBillingPeriod(m, y);
        list.push({
          period,
          label: `${period} (${getMonthName(m)} ${y})`,
          month: m,
          year: y,
        });
      }
    }
    return list;
  }, []);

  // If not logged in, render the Login Page
  if (!currentUser) {
    return (
      <LoginPage
        profiles={data.profiles}
        data={data}
        onLogin={handleLogin}
        onUpdateSecurityCredentials={handleUpdateSecurityCredentials}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Complex Bar - Modern SaaS Header */}
      <header className="no-print bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800/90 shadow-xs backdrop-blur-md bg-slate-900/95">
        <div className="max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Complex Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 -ml-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Toggle navigation drawer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-blue-400" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-xs sm:text-sm shadow-sm tracking-wider shrink-0 border border-blue-400/20">
                MBD
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-tight block truncate text-white">
                  {COMPLEX_CONFIG.name.toUpperCase()}
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block font-medium truncate max-w-xs sm:max-w-md lg:max-w-xl">
                  {COMPLEX_CONFIG.address} &bull; Hotline: <a href="tel:01737-321998" className="font-bold text-blue-300 hover:underline">{COMPLEX_CONFIG.contacts}</a>
                </span>
                <span className="text-[10px] text-blue-300 sm:hidden block font-medium truncate">
                  Rajshahi-6201 &bull; ERP
                </span>
              </div>
            </div>
          </div>

          {/* Current Period & Database Status & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Database indicator - ONLY DISPLAY ON MANAGER'S DASHBOARD */}
            {currentUser.role === 'manager' && currentView === 'dashboard' && (
              <button
                onClick={() => setIsDbModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700/80 cursor-pointer shadow-xs"
                title="Supabase Database Configuration"
              >
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>{dbCreds.isConfigured ? 'Supabase Live' : 'Database'}</span>
                <span className={`w-2 h-2 rounded-full ${dbCreds.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`}></span>
              </button>
            )}

            {/* Header Billing Period Dropdown (Strict YYYY-MM Scoping) */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl p-1 text-xs shadow-xs">
              <button
                onClick={() => {
                  let newM = data.selectedMonth - 1;
                  let newY = data.selectedYear;
                  if (newM < 1) {
                    newM = 12;
                    newY -= 1;
                  }
                  handleUpdateMonthYear(newM, newY);
                }}
                title="Previous Billing Period"
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 px-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0 hidden sm:inline" />
                <span className="text-[10px] text-slate-400 font-sans hidden xl:inline">Period:</span>
                <select
                  value={formatBillingPeriod(data.selectedMonth, data.selectedYear)}
                  onChange={(e) => {
                    const { month, year } = parseBillingPeriod(e.target.value);
                    handleUpdateMonthYear(month, year);
                  }}
                  className="bg-transparent text-blue-300 hover:text-white font-bold text-xs focus:outline-hidden cursor-pointer py-0.5 border-none font-mono max-w-[105px] sm:max-w-none"
                  title="Select Billing Period (strict YYYY-MM format)"
                >
                  {headerBillingPeriods.map((bp) => (
                    <option key={bp.period} value={bp.period} className="bg-slate-900 text-white font-mono">
                      {bp.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  let newM = data.selectedMonth + 1;
                  let newY = data.selectedYear;
                  if (newM > 12) {
                    newM = 1;
                    newY += 1;
                  }
                  handleUpdateMonthYear(newM, newY);
                }}
                title="Next Billing Period"
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Active Logged-in User Display */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs shadow-xs">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
              <span className="font-bold max-w-[90px] sm:max-w-[150px] truncate text-white">
                {currentUser.fullName}
              </span>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-blue-900/60 text-blue-300 font-bold uppercase tracking-wider border border-blue-700/50 hidden md:inline">
                {currentUser.role}
              </span>
            </div>

            {/* Direct Logout Button in Header */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700/80 cursor-pointer shadow-xs active:scale-95"
              title="Sign out of your account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <div
        className={`flex-1 w-full mx-auto py-4 sm:py-6 flex gap-6 pb-24 lg:pb-8 ${
          currentView === 'monthly-ledger'
            ? 'max-w-none px-2 sm:px-4 lg:px-6'
            : 'max-w-[1680px] px-3 sm:px-6 lg:px-8 xl:px-10'
        }`}
      >
        {/* Left Sidebar Navigation (Desktop Fixed & Clean, Laptop Viewport Scrollable) */}
        <aside className="no-print hidden lg:block w-64 xl:w-72 shrink-0">
          <nav className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs space-y-1.5 sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto no-scrollbar">
            {/* Role Header Chip */}
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                {currentUser.role === 'manager'
                  ? 'Super Admin ERP'
                  : currentUser.role === 'owner'
                  ? `${currentUser.assignedBlock} Owner`
                  : 'Resident Portal'}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            {/* Nav Links */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
              {currentUser.role === 'manager' && currentView === 'dashboard' && (
                <button
                  onClick={() => setIsDbModalOpen(true)}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                >
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Supabase & SQL</span>
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>

              {/* Complex Emergency Contacts Widget */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-[11px]">
                <p className="font-extrabold text-slate-800 leading-tight">{COMPLEX_CONFIG.name}</p>
                <p className="text-slate-500 text-[10px] mt-0.5 leading-normal">{COMPLEX_CONFIG.address}</p>
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex flex-col gap-1 text-[10px]">
                  {currentUser.role === 'tenant' ? (() => {
                    const tUnit = data.units.find(u => u.flatId.toLowerCase() === (currentUser.flatId || '').toLowerCase());
                    const bName = tUnit?.blockName || (currentUser.flatId?.toUpperCase().startsWith('B') ? 'Block B' : currentUser.flatId?.toUpperCase().startsWith('C') ? 'Block C' : 'Block A');
                    const bOwner = bName === 'Block A' 
                      ? { name: 'Md. Rashed', phone: '01717623061' } 
                      : bName === 'Block B' 
                      ? { name: 'Md. Raju', phone: '01913858775' } 
                      : { name: 'Md. Rony', phone: '01712118547' };
                    return (
                      <>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Manager:</span>
                          <a href="tel:01737-321998" className="font-bold text-blue-700 hover:underline">01737-321998</a>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>{bOwner.name} ({bName}):</span>
                          <a href={`tel:${bOwner.phone}`} className="font-bold text-blue-700 hover:underline">{bOwner.phone}</a>
                        </div>
                      </>
                    );
                  })() : (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Manager:</span>
                        <a href="tel:01737-321998" className="font-bold text-blue-700 hover:underline">01737-321998</a>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Raju:</span>
                        <a href="tel:01913-858775" className="font-bold text-blue-700 hover:underline">01913-858775</a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/70 backdrop-blur-sm flex">
            <div className="w-80 max-w-[85vw] bg-white h-full p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shadow-2xl">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center text-xs">
                      MBD
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs block leading-tight">{COMPLEX_CONFIG.name}</span>
                      <span className="text-[10px] text-slate-500">Rajshahi-6201 &bull; ERP</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                    aria-label="Close menu drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile User Profile Header */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 my-2 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                    {currentUser.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-slate-900 truncate">{currentUser.fullName}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">{currentUser.role} {currentUser.flatId ? `(${currentUser.flatId})` : ''}</p>
                  </div>
                </div>

                {/* Mobile Billing Period Selector */}
                <div className="p-3 bg-slate-900 text-white rounded-xl my-2 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Billing Period (Monthly Scoping)</span>
                  </div>
                  <select
                    value={formatBillingPeriod(data.selectedMonth, data.selectedYear)}
                    onChange={(e) => {
                      const { month, year } = parseBillingPeriod(e.target.value);
                      handleUpdateMonthYear(month, year);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-slate-800 text-blue-300 font-mono text-xs rounded-lg px-2.5 py-2 font-bold border border-slate-700 focus:outline-hidden"
                  >
                    {headerBillingPeriods.map((bp) => (
                      <option key={bp.period} value={bp.period} className="bg-slate-900 text-white">
                        {bp.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Navigation Items */}
                <div className="pt-2 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentView(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Drawer Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                {currentUser.role === 'manager' && currentView === 'dashboard' && (
                  <button
                    onClick={() => {
                      setIsDbModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full min-h-[44px] py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    Database Setup & SQL
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full min-h-[44px] py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600">
                  <p className="font-bold text-slate-800">{COMPLEX_CONFIG.address}</p>
                  <p className="mt-1 font-semibold text-blue-700">
                    Hotline: <a href="tel:01737-321998">{COMPLEX_CONFIG.contacts}</a>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)}></div>
          </div>
        )}

        {/* Mobile Sticky Bottom Navigation Bar (Smartphones) */}
        <div className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-1.5 py-1 flex items-center justify-around safe-pb">
          {currentUser.role === 'tenant' ? (
            <>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setCurrentView('complaints')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'complaints' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Requests</span>
              </button>
              <button
                onClick={() => setCurrentView('messages')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'messages' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900 active:scale-95 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>More</span>
              </button>
            </>
          ) : currentUser.role === 'owner' ? (
            <>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setCurrentView('monthly-ledger')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'monthly-ledger' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ledger</span>
              </button>
              <button
                onClick={() => setCurrentView('complaints')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'complaints' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <AlertCircle className="w-4 h-4" />
                <span>Complaints</span>
              </button>
              <button
                onClick={() => setCurrentView('messages')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'messages' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900 active:scale-95 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>More</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </button>
              <button
                onClick={() => setCurrentView('monthly-ledger')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'monthly-ledger' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ledger</span>
              </button>
              <button
                onClick={() => setCurrentView('online-payments')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'online-payments' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Payments</span>
              </button>
              <button
                onClick={() => setCurrentView('messages')}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                  currentView === 'messages' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-h-[48px] flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900 active:scale-95 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>Menu</span>
              </button>
            </>
          )}
        </div>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          {/* VIEW ROUTING */}
          {currentUser.role === 'tenant' ? (
            /* Tenant View */
            currentView === 'dashboard' ? (
              <TenantPortal
                currentUser={currentUser}
                data={data}
                onViewReceipt={setActiveReceipt}
                onViewBill={setActiveBill}
                onSubmitOnlinePayment={handleSubmitOnlinePayment}
                onNavigateToView={setCurrentView}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onClearTenantMessages={handleClearTenantChatMessages}
              />
            )
          ) : currentUser.role === 'owner' ? (
            /* Block Owner View */
            currentView === 'dashboard' ? (
              <OwnerDashboard
                currentUser={currentUser}
                data={data}
                onViewReceipt={setActiveReceipt}
                onSaveLedgerItem={handleSaveLedgerItem}
                onRecordPayment={handleRecordPayment}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onUpdateMonthYear={handleUpdateMonthYear}
                onImportLedgerData={handleImportLedgerData}
                onUpdatePaymentSettings={(settings) =>
                  updateData((prev) => ({ ...prev, paymentSettings: settings }))
                }
              />
            ) : currentView === 'monthly-ledger' ? (
              <MainLedger
                data={data}
                onRecordPayment={handleRecordPayment}
                onAdjustFromAdvance={handleAdjustFromAdvance}
                onViewReceipt={setActiveReceipt}
                onUpdateMonthYear={handleUpdateMonthYear}
                onSaveLedgerItem={handleSaveLedgerItem}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onImportLedgerData={handleImportLedgerData}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onDeleteLedgerItem={handleDeleteLedgerItem}
                onViewBill={setActiveBill}
                userRole={currentUser.role}
                assignedBlock={currentUser.assignedBlock}
                currentUser={currentUser}
              />
            ) : currentView === 'advance-payments' ? (
              <AdvancePaymentManager
                data={data}
                onRecordAdvancePayment={handleRecordAdvancePayment}
                onViewReceipt={setActiveReceipt}
                userRole={currentUser.role}
                assignedBlock={currentUser.assignedBlock}
              />
            ) : currentView === 'electricity' ? (
              <ElectricityManager
                data={data}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onUpdateMeterReading={handleUpdateMeterReading}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onViewBill={setActiveBill}
                onViewReceipt={setActiveReceipt}
                onOpenTariffModal={() => setIsTariffModalOpen(true)}
                userRole={currentUser.role}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onClearTenantMessages={handleClearTenantChatMessages}
              />
            )
          ) : (
            /* Manager (Super Admin) View */
            currentView === 'dashboard' ? (
              <ManagerDashboard
                data={data}
                onUpdateMonthYear={handleUpdateMonthYear}
                onNavigateToView={setCurrentView}
                onOpenDbModal={() => setIsDbModalOpen(true)}
                onAddUnit={handleAddUnit}
                onNavigateToBlockLedger={handleNavigateToBlockLedger}
              />
            ) : currentView === 'monthly-ledger' ? (
              <MainLedger
                data={data}
                initialBlockFilter={ledgerInitialBlock}
                onRecordPayment={handleRecordPayment}
                onAdjustFromAdvance={handleAdjustFromAdvance}
                onViewReceipt={setActiveReceipt}
                onUpdateMonthYear={handleUpdateMonthYear}
                onSaveLedgerItem={handleSaveLedgerItem}
                onCopyPreviousMonthLedger={handleCopyPreviousMonthLedger}
                onImportLedgerData={handleImportLedgerData}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onDeleteLedgerItem={handleDeleteLedgerItem}
                onViewBill={setActiveBill}
                userRole={currentUser.role}
                currentUser={currentUser}
              />
            ) : currentView === 'advance-payments' ? (
              <AdvancePaymentManager
                data={data}
                onRecordAdvancePayment={handleRecordAdvancePayment}
                onViewReceipt={setActiveReceipt}
                userRole={currentUser.role}
              />
            ) : currentView === 'electricity' ? (
              <ElectricityManager
                data={data}
                onGenerateElectricityBills={handleGenerateElectricityBills}
                onUpdateMeterReading={handleUpdateMeterReading}
                onToggleUnitElectricity={handleToggleUnitElectricity}
                onViewBill={setActiveBill}
                onViewReceipt={setActiveReceipt}
                onOpenTariffModal={() => setIsTariffModalOpen(true)}
                userRole={currentUser.role}
              />
            ) : currentView === 'online-payments' ? (
              <OnlinePaymentWorkflow
                data={data}
                onVerifyPayment={handleVerifyPayment}
                onUpdatePaymentSettings={(settings) =>
                  updateData((prev) => ({ ...prev, paymentSettings: settings }))
                }
              />
            ) : currentView === 'units' ? (
              <UnitManager
                data={data}
                onAddUnit={handleAddUnit}
                onUpdateUnitRent={handleUpdateUnitRent}
                onVacateUnit={handleVacateUnit}
              />
            ) : currentView === 'complaints' ? (
              <ComplaintsManager
                data={data}
                currentUser={currentUser}
                onSubmitComplaint={handleSubmitComplaint}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onAddComplaintMessage={handleAddComplaintMessage}
              />
            ) : currentView === 'messages' ? (
              <ChatSystem
                data={data}
                currentUser={currentUser}
                onSendMessage={handleSendMessage}
                onClearTenantMessages={handleClearTenantChatMessages}
              />
            ) : currentView === 'passwords' ? (
              <PasswordSettingsManager
                data={data}
                onUpdateSecurityCredentials={handleUpdateSecurityCredentials}
              />
            ) : currentView === 'users' ? (
              <UserManagement
                data={data}
                onAddUser={handleAddUser}
                onToggleUserStatus={handleToggleUserStatus}
                onResetPassword={handleResetPassword}
              />
            ) : (
              <AuditLogView data={data} />
            )
          )}
        </main>
      </div>

      {/* Complex Permanent Footer */}
      <footer className="no-print bg-slate-900 text-slate-400 border-t border-slate-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-center md:text-left">
            <p className="font-extrabold text-white text-sm tracking-tight">
              {COMPLEX_CONFIG.name.toUpperCase()}
            </p>
            <p className="text-slate-400 mt-0.5">
              {COMPLEX_CONFIG.address}
            </p>
            <p className="text-slate-300 mt-1 font-medium">
              Hotline Contacts: <a href="tel:01737-321998" className="text-blue-400 font-bold hover:underline">01737-321998 (Manager)</a>, <a href="tel:01913-858775" className="text-blue-400 font-bold hover:underline">01913-858775 (Raju)</a>
            </p>
          </div>
          <div className="text-center md:text-right text-[11px] text-slate-500">
            <p>Apartment Management ERP &bull; Residential Complex System</p>
            <p className="mt-0.5">Currency: {COMPLEX_CONFIG.currency} &bull; Timezone: {COMPLEX_CONFIG.timezone}</p>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <PrintableReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <PrintableBillModal
        bill={activeBill}
        onClose={() => setActiveBill(null)}
      />

      {isTariffModalOpen && (
        <TariffSettingsModal
          tariffConfig={data.tariffConfig}
          onSave={(cfg) => updateData((prev) => ({ ...prev, tariffConfig: cfg }))}
          onClose={() => setIsTariffModalOpen(false)}
        />
      )}

      {isDbModalOpen && currentUser.role === 'manager' && (
        <DatabaseSetupModal
          onClose={() => setIsDbModalOpen(false)}
          onResetDemoData={() => setData(resetDatabaseToDefault())}
        />
      )}
    </div>
  );
}

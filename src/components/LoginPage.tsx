import React, { useState, useEffect } from 'react';
import {
  Building2,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Phone,
  Home,
  Users,
  CheckCircle2,
  KeyRound,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Info,
  HelpCircle,
} from 'lucide-react';
import { UserProfile, AppDatabaseState, SecurityCredentials } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';
import { getMonthName } from '../lib/nescoTariff';
import { getLast11Digits, compareFlatIdSerial, getCurrentActiveBillingPeriod } from '../lib/storage';

interface Props {
  profiles: UserProfile[];
  data: AppDatabaseState;
  onLogin: (user: UserProfile) => void;
  onUpdateSecurityCredentials?: (credentials: SecurityCredentials, auditNote?: string) => void;
}

export const LoginPage: React.FC<Props> = ({
  profiles,
  data,
  onLogin,
  onUpdateSecurityCredentials,
}) => {
  // Active Tab: 'tenant' or 'authority'
  const [activeTab, setActiveTab] = useState<'tenant' | 'authority'>('tenant');

  // Tenant Login Form State
  const [selectedFlat, setSelectedFlat] = useState<string>('A1');
  const [tenantPassword, setTenantPassword] = useState<string>('');
  const [showTenantPassword, setShowTenantPassword] = useState<boolean>(false);

  // Authority Login Form State
  const [selectedAuthority, setSelectedAuthority] = useState<'manager' | 'ownerA' | 'ownerB' | 'ownerC'>('manager');
  const [authorityPassword, setAuthorityPassword] = useState<string>('');
  const [showAuthorityPassword, setShowAuthorityPassword] = useState<boolean>(false);

  // First-time Manager Setup Modal State
  const [isFirstTimeSetupOpen, setIsFirstTimeSetupOpen] = useState<boolean>(false);
  const [firstTimeNewPass, setFirstTimeNewPass] = useState<string>('');
  const [firstTimeConfirmPass, setFirstTimeConfirmPass] = useState<string>('');
  const [firstTimeError, setFirstTimeError] = useState<string>('');

  // UI / Feedback State
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showHintModal, setShowHintModal] = useState<boolean>(false);

  const securityCreds = data.securityCredentials || {
    isManagerPasswordInitialized: false,
    authorityPasswords: {
      manager: '',
      ownerA: 'rashed123',
      ownerB: 'raju123',
      ownerC: 'rony123',
    },
    unitPasswords: {},
  };

  const isManagerPasswordSet = Boolean(
    securityCreds.isManagerPasswordInitialized &&
    securityCreds.authorityPasswords.manager &&
    securityCreds.authorityPasswords.manager.trim().length > 0
  );

  // Get current tenant & ledger info for any flat based strictly on current month occupation
  const getFlatInfo = (flatId: string) => {
    const cleanId = flatId.toLowerCase().trim();
    const unit = data.units.find((u) => u.flatId.toLowerCase().trim() === cleanId);
    const activePeriod = getCurrentActiveBillingPeriod(data);

    // Primary source of truth: ledger item for the current active billing month
    const currentLedger = data.ledgerItems.find(
      (item) =>
        item.flatId.toLowerCase().trim() === cleanId &&
        item.month === activePeriod.month &&
        item.year === activePeriod.year
    );

    // Latest ledger item fallback (sorted descending, NEVER older previous months)
    const latestLedger = [...data.ledgerItems]
      .filter((item) => item.flatId.toLowerCase().trim() === cleanId)
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0];

    // Active tenant from synced data.tenants
    const activeTenant = data.tenants.find(
      (t) => t.flatId.toLowerCase().trim() === cleanId && t.status === 'active'
    );
    const tenant = activeTenant || data.tenants.find((t) => t.flatId.toLowerCase().trim() === cleanId);

    const isOwner =
      cleanId.includes('owner') ||
      (currentLedger?.notes || '').toLowerCase().includes('owner residence') ||
      (unit?.notes || '').toLowerCase().includes('owner residence') ||
      (currentLedger?.tenantName || '').toLowerCase().includes('owner');

    const rawResidentName =
      currentLedger?.tenantName?.trim() ||
      latestLedger?.tenantName?.trim() ||
      activeTenant?.fullName?.trim() ||
      tenant?.fullName?.trim() ||
      '';

    const isVacant =
      !isOwner &&
      (!rawResidentName ||
        rawResidentName.toLowerCase() === 'vacant' ||
        rawResidentName.toLowerCase() === 'vacant flat' ||
        rawResidentName.toLowerCase() === 'n/a');

    const residentName = isOwner
      ? (rawResidentName || 'Owner Residence')
      : isVacant
      ? 'Vacant Flat'
      : rawResidentName;

    const rawPhone =
      currentLedger?.tenantPhone?.trim() ||
      latestLedger?.tenantPhone?.trim() ||
      activeTenant?.phone?.trim() ||
      tenant?.phone?.trim() ||
      '01700-000000';

    const last11Digits = getLast11Digits(rawPhone);
    const defaultPhone = last11Digits.length === 11 ? last11Digits : rawPhone;

    const isOccupied = !isVacant;
    const isEligibleForTenantLogin = Boolean(!isOwner && !isVacant && rawResidentName);

    const customPass = securityCreds.unitPasswords?.[flatId] || securityCreds.unitPasswords?.[cleanId];

    return {
      residentName,
      defaultPhone,
      last11Digits,
      customPass,
      hasCustomPassword: Boolean(customPass),
      isOccupied,
      isOwner,
      isEligibleForTenantLogin,
      activeTenant,
      unit,
      currentLedger,
    };
  };

  // Automatically select an eligible flat when month or ledger items change if current is ineligible
  useEffect(() => {
    const currentMeta = getFlatInfo(selectedFlat);
    if (!currentMeta.isEligibleForTenantLogin) {
      const firstEligible = data.units.find((u) => {
        if (u.unitType === 'parking' || u.unitType === 'godown') return false;
        const meta = getFlatInfo(u.flatId);
        return meta.isEligibleForTenantLogin;
      });
      if (firstEligible) {
        setSelectedFlat(firstEligible.flatId);
      }
    }
  }, [data.selectedMonth, data.selectedYear, data.ledgerItems]);

  const selectedFlatInfo = getFlatInfo(selectedFlat);

  // Authority accounts metadata
  const authorityOptions = [
    {
      id: 'manager' as const,
      name: 'Russell (Manager)',
      roleLabel: 'Super Admin ERP • Complete Complex Access',
      badge: 'Manager',
      badgeColor: 'bg-blue-600 text-white',
      email: 'akandarussell@gmail.com',
      phone: COMPLEX_CONFIG.managerPhone,
      profile: profiles[0] || {
        id: 'user-manager-russell',
        email: 'akandarussell@gmail.com',
        fullName: 'Russell (Manager)',
        phone: COMPLEX_CONFIG.managerPhone,
        role: 'manager',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'ownerA' as const,
      name: 'Md. Rashed (Block A Owner)',
      roleLabel: 'Block A Wings • Units A1-A8 Access',
      badge: 'Owner Block A',
      badgeColor: 'bg-emerald-600 text-white',
      email: 'rashed.blocka@mbdapartment.com',
      phone: '01717623061',
      profile: profiles[1] || {
        id: 'user-owner-rashed-a',
        email: 'rashed.blocka@mbdapartment.com',
        fullName: 'Md. Rashed (Block A Owner)',
        phone: '01717623061',
        role: 'owner',
        assignedBlock: 'Block A',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'ownerB' as const,
      name: 'Md. Raju (Block B Owner)',
      roleLabel: 'Block B Wings • Units B1-B7 Access',
      badge: 'Owner Block B',
      badgeColor: 'bg-indigo-600 text-white',
      email: 'raju.blockb@mbdapartment.com',
      phone: '01913858775',
      profile: profiles[2] || {
        id: 'user-owner-raju-b',
        email: 'raju.blockb@mbdapartment.com',
        fullName: 'Md. Raju (Block B Owner)',
        phone: '01913858775',
        role: 'owner',
        assignedBlock: 'Block B',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
    {
      id: 'ownerC' as const,
      name: 'Md. Rony (Block C Owner)',
      roleLabel: 'Block C Wings • Units C1-C7 Access',
      badge: 'Owner Block C',
      badgeColor: 'bg-purple-600 text-white',
      email: 'rony.blockc@mbdapartment.com',
      phone: '01712118547',
      profile: profiles[3] || {
        id: 'user-owner-rony-c',
        email: 'rony.blockc@mbdapartment.com',
        fullName: 'Md. Rony (Block C Owner)',
        phone: '01712118547',
        role: 'owner',
        assignedBlock: 'Block C',
        isActive: true,
        createdAt: '2024-01-01',
      },
    },
  ];

  // Clean phone number for flexible matching
  const normalizeDigits = (val: string) => val.replace(/[^0-9]/g, '');

  // 1. Handle Tenant Login
  const handleTenantLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Strict Tenant Privacy & Access Restriction: Verify current active tenant
    const currentFlatMeta = getFlatInfo(selectedFlat);
    if (!currentFlatMeta.isEligibleForTenantLogin) {
      setErrorMsg(
        `Access Denied: Flat ${selectedFlat} currently has no active tenant or is marked as vacant. Tenant Dashboard access is strictly reserved for current active residents with a valid tenancy.`
      );
      return;
    }

    if (!tenantPassword.trim()) {
      setErrorMsg('Please enter your password (put your registered mobile number here).');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const entered = tenantPassword.trim();
      const enteredDigits = normalizeDigits(entered);
      const expectedLast11 = currentFlatMeta.last11Digits;
      const defaultPhoneDigits = normalizeDigits(currentFlatMeta.defaultPhone);

      let isMatch = false;

      // Check custom password override if set by manager
      if (currentFlatMeta.hasCustomPassword && currentFlatMeta.customPass) {
        if (entered === currentFlatMeta.customPass) {
          isMatch = true;
        }
      }

      // Check last 11 digits of registered mobile number (or full mobile digits)
      if (expectedLast11) {
        if (
          entered === expectedLast11 ||
          enteredDigits === expectedLast11 ||
          enteredDigits.slice(-11) === expectedLast11 ||
          entered === currentFlatMeta.defaultPhone ||
          enteredDigits === defaultPhoneDigits
        ) {
          isMatch = true;
        }
      }

      if (isMatch) {
        // Construct or find tenant UserProfile strictly using active tenant data
        const activeTenant = currentFlatMeta.activeTenant;
        const existingProfile = profiles.find((p) => p.flatId === selectedFlat);

        const tenantUser: UserProfile = {
          id: activeTenant?.id || existingProfile?.id || `user-tenant-${selectedFlat.toLowerCase()}`,
          email: activeTenant?.email || existingProfile?.email || `${selectedFlat.toLowerCase().replace(/\s+/g, '')}.resident@mbdapartment.com`,
          fullName: currentFlatMeta.residentName,
          phone: currentFlatMeta.defaultPhone,
          role: 'tenant',
          flatId: selectedFlat,
          isActive: true,
          createdAt: currentFlatMeta.currentLedger?.entryDate || activeTenant?.entryDate || '2024-01-01',
        };

        onLogin(tenantUser);
      } else {
        setErrorMsg(
          `Incorrect password for Flat ${selectedFlat}. Please put your registered mobile number here.`
        );
      }
    }, 300);
  };

  // 2. Handle Authority Login
  const handleAuthorityLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // If Russell is selected and password has never been set, show first-time setup modal!
    if (selectedAuthority === 'manager' && !isManagerPasswordSet) {
      setIsFirstTimeSetupOpen(true);
      return;
    }

    if (!authorityPassword.trim()) {
      setErrorMsg('Please enter the password set for this authority account.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const entered = authorityPassword.trim();
      const activeOption = authorityOptions.find((o) => o.id === selectedAuthority)!;

      let expectedPass = '';
      if (selectedAuthority === 'manager') {
        expectedPass = securityCreds.authorityPasswords.manager || '';
      } else if (selectedAuthority === 'ownerA') {
        expectedPass = securityCreds.authorityPasswords.ownerA || 'rashed123';
      } else if (selectedAuthority === 'ownerB') {
        expectedPass = securityCreds.authorityPasswords.ownerB || 'raju123';
      } else if (selectedAuthority === 'ownerC') {
        expectedPass = securityCreds.authorityPasswords.ownerC || 'rony123';
      }

      if (entered === expectedPass) {
        onLogin(activeOption.profile);
      } else {
        setErrorMsg(
          `Incorrect password for ${activeOption.name}. Please verify your credentials or ask Manager Russell.`
        );
      }
    }, 300);
  };

  // 3. Handle First-Time Manager Password Setup
  const handleSaveFirstTimeManagerPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setFirstTimeError('');

    if (!firstTimeNewPass.trim()) {
      setFirstTimeError('Please enter a secure password.');
      return;
    }
    if (firstTimeNewPass.length < 4) {
      setFirstTimeError('Password should be at least 4 characters long.');
      return;
    }
    if (firstTimeNewPass !== firstTimeConfirmPass) {
      setFirstTimeError('Passwords do not match. Please re-enter.');
      return;
    }

    const updatedCreds: SecurityCredentials = {
      ...securityCreds,
      isManagerPasswordInitialized: true,
      authorityPasswords: {
        ...securityCreds.authorityPasswords,
        manager: firstTimeNewPass.trim(),
      },
    };

    if (onUpdateSecurityCredentials) {
      onUpdateSecurityCredentials(
        updatedCreds,
        'Manager Russell initialized first-time master password'
      );
    }

    setIsFirstTimeSetupOpen(false);
    // Log Manager Russell in immediately!
    const managerProfile = authorityOptions[0].profile;
    onLogin(managerProfile);
  };

  // Quick One-Click Demo Login
  const handleQuickDemo = (roleOrFlat: 'manager' | 'ownerA' | 'ownerB' | 'ownerC' | 'A1' | 'A2' | 'B3' | 'B4') => {
    if (roleOrFlat === 'manager') {
      onLogin(authorityOptions[0].profile);
    } else if (roleOrFlat === 'ownerA') {
      onLogin(authorityOptions[1].profile);
    } else if (roleOrFlat === 'ownerB') {
      onLogin(authorityOptions[2].profile);
    } else if (roleOrFlat === 'ownerC') {
      onLogin(authorityOptions[3].profile);
    } else {
      const fInfo = getFlatInfo(roleOrFlat);
      const tenantUser: UserProfile = {
        id: `user-tenant-${roleOrFlat.toLowerCase()}`,
        email: `${roleOrFlat.toLowerCase()}.resident@mbdapartment.com`,
        fullName: fInfo.residentName,
        phone: fInfo.defaultPhone,
        role: 'tenant',
        flatId: roleOrFlat,
        isActive: true,
        createdAt: '2024-01-01',
      };
      onLogin(tenantUser);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-sm shadow-md tracking-wider shrink-0 border border-blue-400/30">
              MBD
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight block text-white">
                {COMPLEX_CONFIG.name.toUpperCase()}
              </span>
              <span className="text-[11px] text-blue-300 block font-medium">
                {COMPLEX_CONFIG.address}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              <span>Hotline: <strong className="text-white">{COMPLEX_CONFIG.contacts}</strong></span>
            </div>

            <button
              onClick={() => setShowHintModal(!showHintModal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs text-slate-300 font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Login Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* FIRST-TIME MANAGER PASSWORD SETUP MODAL */}
      {isFirstTimeSetupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-blue-500/30 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white">First-Time Manager Setup</h3>
                <p className="text-xs text-blue-300">Super Admin Security Initialization</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Welcome, <strong className="text-white">Russell (Manager)</strong>! As the Super Admin of <strong className="text-white">{COMPLEX_CONFIG.name}</strong>, please create your master password to secure and initialize the apartment management portal.
            </p>

            {firstTimeError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold">
                {firstTimeError}
              </div>
            )}

            <form onSubmit={handleSaveFirstTimeManagerPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Set Your Master Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    placeholder="Enter your master password"
                    value={firstTimeNewPass}
                    onChange={(e) => setFirstTimeNewPass(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Confirm Master Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    placeholder="Re-enter your master password"
                    value={firstTimeConfirmPass}
                    onChange={(e) => setFirstTimeConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFirstTimeSetupOpen(false)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save & Sign In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGIN HELP MODAL */}
      {showHintModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                <h3 className="font-extrabold text-base text-white">Login Instructions & Credential Guide</h3>
              </div>
              <button
                onClick={() => setShowHintModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-blue-400 block">🏠 1. Tenant Login:</span>
                <p>
                  Select your assigned Flat Number from the dropdown. Enter your default password, which is your <strong>registered mobile number</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
                <span className="font-extrabold text-emerald-400 block">🛡️ 2. Authority Login:</span>
                <p>
                  Select your role from the dropdown:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pt-1">
                  <li><strong>Russell (Manager)</strong>: Super Admin ERP (prompts to set password on first login or configured password).</li>
                  <li><strong>Rashed (Block A Owner)</strong>: Default: <code className="text-emerald-300 font-mono">rashed123</code></li>
                  <li><strong>Raju (Block B Owner)</strong>: Default: <code className="text-indigo-300 font-mono">raju123</code></li>
                  <li><strong>Rony (Block C Owner)</strong>: Default: <code className="text-purple-300 font-mono">rony123</code></li>
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 space-y-1">
                <span className="font-extrabold text-blue-300 block">⚡ Quick 1-Click Testing Presets:</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('manager'); }}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Russell (Manager)
                  </button>
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('ownerA'); }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Rashed (Owner A)
                  </button>
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('ownerB'); }}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Raju (Owner B)
                  </button>
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('ownerC'); }}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Rony (Owner C)
                  </button>
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('A1'); }}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Tenant A1 ({getFlatInfo('A1').residentName})
                  </button>
                  <button
                    onClick={() => { setShowHintModal(false); handleQuickDemo('B4'); }}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-[10px] cursor-pointer"
                  >
                    Tenant B4 ({getFlatInfo('B4').residentName})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Login Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14 relative z-10">
        {/* Left Side: Apartment Complex Overview */}
        <div className="flex-1 max-w-lg space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Integrated Property ERP &bull; Rajshahi-6201</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Apartment Management System
          </h2>

          <p className="text-slate-300 text-sm leading-relaxed">
            Welcome to the centralized financial, billing, and utility management portal of{' '}
            <strong className="text-white">{COMPLEX_CONFIG.name}</strong>.
            Sign in to access your tenant portal or authority management console.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-xs">
              <div className="font-bold text-blue-400 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> 3 Residential Wings
              </div>
              <p className="text-slate-400 text-[11px]">
                Block A (Rashed), Block B (Raju), Block C (Rony)
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 backdrop-blur-xs">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Home className="w-4 h-4" /> 22 Units & Utilities
              </div>
              <p className="text-slate-400 text-[11px]">
                NESCO submetering, Advance escrow & 14-Col Ledger
              </p>
            </div>
          </div>

          {/* Quick Hotline Contacts card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-900/60 border border-blue-900/50 text-xs text-slate-300 space-y-1.5">
            <p className="font-bold text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-400" /> Emergency & Management Hotlines
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[11px] text-slate-400">
              <span>Manager Russell: <a href="tel:01737-321998" className="text-blue-400 font-bold hover:underline">01737-321998</a></span>
              <span className="hidden sm:inline">&bull;</span>
              <span>Owner Raju: <a href="tel:01913-858775" className="text-blue-400 font-bold hover:underline">01913-858775</a></span>
            </div>
          </div>
        </div>

        {/* Right Side: Tabbed Login Card */}
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
          {/* Card Top Title & Period info */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Portal Authentication
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                {getMonthName(data.selectedMonth)} {data.selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Select your login portal below to access your account
            </p>
          </div>

          {/* Interactive Login Switcher Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('tenant');
                setErrorMsg('');
              }}
              className={`min-h-[44px] py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'tenant'
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Tenant Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('authority');
                setErrorMsg('');
              }}
              className={`min-h-[44px] py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'authority'
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authority Login</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: TENANT LOGIN */}
          {activeTab === 'tenant' && (
            <form onSubmit={handleTenantLogin} className="space-y-4 text-xs">
              {/* Flat Number Dropdown */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Your Flat Number
                </label>
                <div className="relative">
                  <select
                    value={selectedFlat}
                    onChange={(e) => {
                      setSelectedFlat(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
                  >
                    {/* Block A Units */}
                    <optgroup label="Block A (Premier Wing)">
                      {data.units
                        .filter((u) => u.blockName === 'Block A' && u.unitType !== 'parking' && u.unitType !== 'godown')
                        .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId))
                        .map((u) => {
                          const fInfo = getFlatInfo(u.flatId);
                          return (
                            <option
                              key={u.id}
                              value={u.flatId}
                              disabled={!fInfo.isEligibleForTenantLogin}
                            >
                              Flat {u.flatId} &bull; {
                                fInfo.isOwner
                                  ? 'Owner Residence (Use Authority Login)'
                                  : fInfo.isEligibleForTenantLogin
                                  ? fInfo.residentName
                                  : `${fInfo.residentName} (Vacant)`
                              }
                            </option>
                          );
                        })}
                    </optgroup>

                    {/* Block B Units */}
                    <optgroup label="Block B (Courtyard Wing)">
                      {data.units
                        .filter((u) => u.blockName === 'Block B' && u.unitType !== 'parking' && u.unitType !== 'godown')
                        .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId))
                        .map((u) => {
                          const fInfo = getFlatInfo(u.flatId);
                          return (
                            <option
                              key={u.id}
                              value={u.flatId}
                              disabled={!fInfo.isEligibleForTenantLogin}
                            >
                              Flat {u.flatId} &bull; {
                                fInfo.isOwner
                                  ? 'Owner Residence (Use Authority Login)'
                                  : fInfo.isEligibleForTenantLogin
                                  ? fInfo.residentName
                                  : `${fInfo.residentName} (Vacant)`
                              }
                            </option>
                          );
                        })}
                    </optgroup>

                    {/* Block C Units */}
                    <optgroup label="Block C (Terrace Wing)">
                      {data.units
                        .filter((u) => u.blockName === 'Block C' && u.unitType !== 'parking' && u.unitType !== 'godown')
                        .sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId))
                        .map((u) => {
                          const fInfo = getFlatInfo(u.flatId);
                          return (
                            <option
                              key={u.id}
                              value={u.flatId}
                              disabled={!fInfo.isEligibleForTenantLogin}
                            >
                              Flat {u.flatId} &bull; {
                                fInfo.isOwner
                                  ? 'Owner Residence (Use Authority Login)'
                                  : fInfo.isEligibleForTenantLogin
                                  ? fInfo.residentName
                                  : `${fInfo.residentName} (Vacant)`
                              }
                            </option>
                          );
                        })}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Resident Card / Vacancy Warning */}
              {selectedFlatInfo.isEligibleForTenantLogin ? (
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Current Active Resident ({getMonthName(data.selectedMonth)} {data.selectedYear})
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {selectedFlatInfo.residentName}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] uppercase tracking-wider border border-emerald-200/60">
                    Active Lease
                  </span>
                </div>
              ) : selectedFlatInfo.isOwner ? (
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
                    <span>Flat {selectedFlat} is an Owner Residence</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    This unit is occupied by the building owner. Please switch to the <strong className="text-indigo-950">Authority Login</strong> tab above to sign into the owner console.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Flat {selectedFlat} Has No Active Tenancy</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    This unit is marked as vacant or the former tenant has moved out in {getMonthName(data.selectedMonth)} {data.selectedYear}. Tenant portal access is restricted strictly to active residents with an active lease.
                  </p>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Password
                </label>

                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showTenantPassword ? 'text' : 'password'}
                    placeholder="Put your registered mobile number here"
                    value={tenantPassword}
                    onChange={(e) => setTenantPassword(e.target.value)}
                    disabled={!selectedFlatInfo.isEligibleForTenantLogin}
                    className="min-h-[44px] w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTenantPassword(!showTenantPassword)}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute right-1.5 top-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showTenantPassword ? "Hide password" : "Show password"}
                  >
                    {showTenantPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mt-1.5">
                  Put your registered mobile number here.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !selectedFlatInfo.isEligibleForTenantLogin}
                className="w-full min-h-[48px] py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mt-2"
              >
                {isLoading ? (
                  <span>Signing In as Tenant...</span>
                ) : !selectedFlatInfo.isEligibleForTenantLogin ? (
                  <span>Tenant Login Restricted (Flat Vacant)</span>
                ) : (
                  <>
                    <span>Sign In to Flat {selectedFlat} Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: AUTHORITY LOGIN */}
          {activeTab === 'authority' && (
            <form onSubmit={handleAuthorityLogin} className="space-y-4 text-xs">
              {/* Authority Dropdown */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Authority Account
                </label>
                <div className="relative">
                  <select
                    value={selectedAuthority}
                    onChange={(e) => {
                      setSelectedAuthority(e.target.value as any);
                      setErrorMsg('');
                    }}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
                  >
                    {authorityOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Details Card */}
              {(() => {
                const opt = authorityOptions.find((o) => o.id === selectedAuthority)!;
                return (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black inline-block mb-1 ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                      <span className="font-bold text-slate-800 block text-xs">
                        {opt.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{opt.email}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-600 font-medium">
                      <span>{opt.phone}</span>
                    </div>
                  </div>
                );
              })()}

              {/* First-time Manager Setup Banner if not initialized */}
              {selectedAuthority === 'manager' && !isManagerPasswordSet && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>First-Time Setup Required</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Manager Russell&apos;s master password is not yet configured. Click below to create your password and initialize the portal.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsFirstTimeSetupOpen(true)}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Set Master Password Now
                  </button>
                </div>
              )}

              {/* Password Input (only shown if not needing initial setup, or for owners) */}
              {(selectedAuthority !== 'manager' || isManagerPasswordSet) && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-700">
                      Authority Password
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Set by Manager
                    </span>
                  </div>

                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showAuthorityPassword ? 'text' : 'password'}
                      placeholder="Enter authority password"
                      value={authorityPassword}
                      onChange={(e) => setAuthorityPassword(e.target.value)}
                      className="min-h-[44px] w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthorityPassword(!showAuthorityPassword)}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute right-1.5 top-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label={showAuthorityPassword ? "Hide password" : "Show password"}
                    >
                      {showAuthorityPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Authority Sign In Button */}
              {(selectedAuthority !== 'manager' || isManagerPasswordSet) && (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[48px] py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mt-2"
                >
                  {isLoading ? (
                    <span>Verifying Authority...</span>
                  ) : (
                    <>
                      <span>Sign In as {authorityOptions.find((o) => o.id === selectedAuthority)?.badge}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Quick 1-Click Role Testing Presets */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Quick Role Demo Access:
              </span>
              <button
                type="button"
                onClick={() => setShowHintModal(true)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Help & Passwords
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('manager')}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] transition-colors border border-blue-200/60 truncate cursor-pointer"
                title="Sign in as Manager Russell (Super Admin)"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('ownerA')}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[10px] transition-colors border border-emerald-200/60 truncate cursor-pointer"
                title="Sign in as Block A Owner Rashed"
              >
                Block A Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('ownerB')}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] transition-colors border border-indigo-200/60 truncate cursor-pointer"
                title="Sign in as Block B Owner Raju"
              >
                Block B Owner
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('A1')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition-colors border border-slate-200 truncate cursor-pointer"
                title="Sign in as Resident of Flat A1"
              >
                Resident A1
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Complex Permanent Footer */}
      <footer className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950 text-slate-400 text-xs relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <p className="font-bold text-slate-200">{COMPLEX_CONFIG.name}</p>
            <p className="text-[11px] text-slate-500">{COMPLEX_CONFIG.address}</p>
          </div>
          <p className="text-[11px] text-slate-500">
            Apartment ERP &bull; Secured with Role-Based Access Control
          </p>
        </div>
      </footer>
    </div>
  );
};

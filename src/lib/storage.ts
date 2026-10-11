import {
  UserProfile,
  Block,
  Unit,
  Tenant,
  AdvanceAccount,
  AdvanceTransaction,
  MonthlyLedgerItem,
  MeterReading,
  ElectricityBill,
  PaymentTransaction,
  PrintableReceipt,
  Complaint,
  ChatMessage,
  OnlinePaymentRequest,
  AuditLog,
  PaymentSettings,
  BlockMfsConfig,
  NescoTariffConfig,
  PaymentStatus,
  AppDatabaseState,
  SecurityCredentials,
  AuthorityPasswords,
} from '../types';
import {
  DEFAULT_NESCO_TARIFF,
  calculateNescoElectricityBill,
  isTariffUpToDate,
  upgradeTariffConfig,
} from './nescoTariff';
import { COMPLEX_CONFIG } from './complexConfig';

export const DEFAULT_SECURITY_CREDENTIALS: SecurityCredentials = {
  isManagerPasswordInitialized: false,
  authorityPasswords: {
    manager: '',
    ownerA: 'rashed123',
    ownerB: 'raju123',
    ownerC: 'rony123',
  },
  unitPasswords: {},
};

// Initial Authority Accounts
export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user-manager-russell',
    email: 'akandarussell@gmail.com',
    fullName: 'Russell (Manager)',
    phone: COMPLEX_CONFIG.managerPhone, // 01737-321998
    role: 'manager',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-rashed-a',
    email: 'rashed.blocka@mbdapartment.com',
    fullName: 'Md. Rashed (Block A Owner)',
    phone: '01717623061',
    role: 'owner',
    assignedBlock: 'Block A',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-raju-b',
    email: 'raju.blockb@mbdapartment.com',
    fullName: 'Md. Raju (Block B Owner)',
    phone: '01913858775',
    role: 'owner',
    assignedBlock: 'Block B',
    isActive: true,
    createdAt: '2024-01-01',
  },
  {
    id: 'user-owner-rony-c',
    email: 'rony.blockc@mbdapartment.com',
    fullName: 'Md. Rony (Block C Owner)',
    phone: '01712118547',
    role: 'owner',
    assignedBlock: 'Block C',
    isActive: true,
    createdAt: '2024-01-01',
  },
];

export const INITIAL_BLOCKS: Block[] = [
  {
    id: 'block-a',
    name: 'Block A',
    ownerId: 'user-owner-rashed-a',
    ownerName: 'Md. Rashed',
    totalFloors: 7,
    totalUnits: 8,
    description: 'Premier residential wing with private lift and generator backup.',
  },
  {
    id: 'block-b',
    name: 'Block B',
    ownerId: 'user-owner-raju-b',
    ownerName: 'Md. Raju',
    totalFloors: 7,
    totalUnits: 7,
    description: 'Central residential block overlooking garden courtyard.',
  },
  {
    id: 'block-c',
    name: 'Block C',
    ownerId: 'user-owner-rony-c',
    ownerName: 'Md. Rony',
    totalFloors: 7,
    totalUnits: 7,
    description: 'Quiet east-facing residential block with rooftop terrace.',
  },
];

export const INITIAL_UNITS: Unit[] = [
  // Block A
  { id: 'u-a1', flatId: 'A1', blockId: 'block-a', blockName: 'Block A', floor: 1, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a2', flatId: 'A2', blockId: 'block-a', blockName: 'Block A', floor: 2, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P1' },
  { id: 'u-a3', flatId: 'A3', blockId: 'block-a', blockName: 'Block A', floor: 3, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a4', flatId: 'A4', blockId: 'block-a', blockName: 'Block A', floor: 4, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, godownSlot: 'G1' },
  { id: 'u-a5', flatId: 'A5', blockId: 'block-a', blockName: 'Block A', floor: 5, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a5-owner', flatId: 'A5 (Owner)', blockId: 'block-a', blockName: 'Block A', floor: 5, unitType: 'residential', monthlyRent: 0, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, fixedElectricityAmount: 0, notes: 'Owner residence' },
  { id: 'u-a5-sublet', flatId: 'A5 Sublet', blockId: 'block-a', blockName: 'Block A', floor: 5, unitType: 'residential', monthlyRent: 4500, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a6', flatId: 'A6', blockId: 'block-a', blockName: 'Block A', floor: 6, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-a7', flatId: 'A7', blockId: 'block-a', blockName: 'Block A', floor: 7, unitType: 'residential', monthlyRent: 26000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Block B
  { id: 'u-b1', flatId: 'B1', blockId: 'block-b', blockName: 'Block B', floor: 1, unitType: 'residential', monthlyRent: 21000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b2', flatId: 'B2', blockId: 'block-b', blockName: 'Block B', floor: 2, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P2' },
  { id: 'u-b3', flatId: 'B3', blockId: 'block-b', blockName: 'Block B', floor: 3, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b4', flatId: 'B4', blockId: 'block-b', blockName: 'Block B', floor: 4, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, godownSlot: 'G2' },
  { id: 'u-b5', flatId: 'B5', blockId: 'block-b', blockName: 'Block B', floor: 5, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b6', flatId: 'B6', blockId: 'block-b', blockName: 'Block B', floor: 6, unitType: 'residential', monthlyRent: 25000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-b7', flatId: 'B7', blockId: 'block-b', blockName: 'Block B', floor: 7, unitType: 'residential', monthlyRent: 25000, isOccupied: false, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Block C
  { id: 'u-c1', flatId: 'C1', blockId: 'block-c', blockName: 'Block C', floor: 1, unitType: 'residential', monthlyRent: 20000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c2', flatId: 'C2', blockId: 'block-c', blockName: 'Block C', floor: 2, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true, parkingSlot: 'P3' },
  { id: 'u-c3', flatId: 'C3', blockId: 'block-c', blockName: 'Block C', floor: 3, unitType: 'residential', monthlyRent: 22000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c4', flatId: 'C4', blockId: 'block-c', blockName: 'Block C', floor: 4, unitType: 'residential', monthlyRent: 23000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c5-owner', flatId: 'C5 Owner', blockId: 'block-c', blockName: 'Block C', floor: 5, unitType: 'residential', monthlyRent: 0, isOccupied: true, electricityBillingType: 'fixed', isElectricityEnabled: false, fixedElectricityAmount: 0, notes: 'Owner residence' },
  { id: 'u-c6', flatId: 'C6', blockId: 'block-c', blockName: 'Block C', floor: 6, unitType: 'residential', monthlyRent: 24000, isOccupied: true, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },
  { id: 'u-c7', flatId: 'C7', blockId: 'block-c', blockName: 'Block C', floor: 7, unitType: 'residential', monthlyRent: 25000, isOccupied: false, electricityBillingType: 'nesco_submeter', isElectricityEnabled: true },

  // Parking & Godowns (Flats and Godowns can be toggled ON/OFF; Parking has no electricity)
  { id: 'u-p1', flatId: 'P1', blockId: 'block-a', blockName: 'Block A', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-p2', flatId: 'P2', blockId: 'block-b', blockName: 'Block B', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-p3', flatId: 'P3', blockId: 'block-c', blockName: 'Block C', floor: 0, unitType: 'parking', monthlyRent: 2500, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-g1', flatId: 'G1', blockId: 'block-a', blockName: 'Block A', floor: 0, unitType: 'godown', monthlyRent: 6000, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
  { id: 'u-g2', flatId: 'G2', blockId: 'block-b', blockName: 'Block B', floor: 0, unitType: 'godown', monthlyRent: 6000, isOccupied: true, electricityBillingType: 'none', isElectricityEnabled: false },
];

export const INITIAL_TENANTS: Tenant[] = [
  // Block A
  { id: 't-a1', unitId: 'u-a1', flatId: 'A1', blockName: 'Block A', fullName: 'MD. MANIK (ZEON PHARMA)', phone: '01705356537', nidNumber: '19882691234567890', email: 'a1.resident@mbdapartment.com', entryDate: '2026-10-01', emergencyContact: '01705356537', status: 'active' },
  { id: 't-a2', unitId: 'u-a2', flatId: 'A2', blockName: 'Block A', fullName: 'ABDULLAH AL MAMUN', phone: '01762598361', nidNumber: '19902692345678902', email: 'mamun.a2@gmail.com', entryDate: '2026-05-01', emergencyContact: '01762598361', status: 'active' },
  { id: 't-a3', unitId: 'u-a3', flatId: 'A3', blockName: 'Block A', fullName: 'MD. SHARIFUL', phone: '01760800335', nidNumber: '19882693456789013', email: 'shariful.a3@gmail.com', entryDate: '2024-07-01', emergencyContact: '01760800335', status: 'active' },
  { id: 't-a4', unitId: 'u-a4', flatId: 'A4', blockName: 'Block A', fullName: 'SABIN', phone: '01704027951', nidNumber: '19922694567890124', email: 'sabin.a4@gmail.com', entryDate: '2025-08-01', emergencyContact: '01704027951', status: 'active' },
  { id: 't-a5', unitId: 'u-a5', flatId: 'A5', blockName: 'Block A', fullName: 'MD. RASHED', phone: '01717623061', nidNumber: '19852695678901235', email: 'rashed.a5@gmail.com', entryDate: '2025-08-01', emergencyContact: '01717623061', status: 'active' },
  { id: 't-a5-owner', unitId: 'u-a5-owner', flatId: 'A5 (Owner)', blockName: 'Block A', fullName: 'Md. Rashed (Owner)', phone: '01717623061', nidNumber: '19852695678901235', email: 'rashed.blocka@mbdapartment.com', entryDate: '2024-01-01', emergencyContact: '01737-321998', status: 'active' },
  { id: 't-a5-sublet', unitId: 'u-a5-sublet', flatId: 'A5 Sublet', blockName: 'Block A', fullName: 'S. M. ABDUL LATIF', phone: '01711000000', nidNumber: '19852695678901236', email: 'latif.a5sublet@gmail.com', entryDate: '2026-10-01', emergencyContact: '01711000000', status: 'active' },
  { id: 't-a6', unitId: 'u-a6', flatId: 'A6', blockName: 'Block A', fullName: 'SUMAIYA', phone: '01310526217', nidNumber: '19872696789012346', email: 'sumaiya.a6@gmail.com', entryDate: '2024-06-03', emergencyContact: '01310526217', status: 'active' },
  { id: 't-a7', unitId: 'u-a7', flatId: 'A7', blockName: 'Block A', fullName: 'GERMAN ALI', phone: '01738115155', nidNumber: '19932697890123457', email: 'german.a7@gmail.com', entryDate: '2025-10-14', emergencyContact: '01738115155', status: 'active' },

  // Block B
  { id: 't-b1', unitId: 'u-b1', flatId: 'B1', blockName: 'Block B', fullName: 'TOFAZZOL HOSSAIN', phone: '01819502178', nidNumber: '19862697890123457', email: 'tofazzol.b1@gmail.com', entryDate: '2024-07-01', emergencyContact: '01819502178', status: 'active' },
  { id: 't-b2', unitId: 'u-b2', flatId: 'B2', blockName: 'Block B', fullName: 'MIZAN & BROS', phone: '01765310914', nidNumber: '19832698901234568', email: 'mizan.b2@gmail.com', entryDate: '2025-08-01', emergencyContact: '01765310914', status: 'active' },
  { id: 't-b3', unitId: 'u-b3', flatId: 'B3', blockName: 'Block B', fullName: 'ALEYA JANNAT', phone: '01735414773', nidNumber: '19912699012345679', email: 'aleya.b3@gmail.com', entryDate: '2024-07-26', emergencyContact: '01735414773', status: 'active' },
  { id: 't-b4', unitId: 'u-b4', flatId: 'B4', blockName: 'Block B', fullName: 'MD. NADIM', phone: '01762598361', nidNumber: '19942690123456780', email: 'nadim.b4@gmail.com', entryDate: '2024-08-01', emergencyContact: '01762598361', status: 'active' },
  { id: 't-b5', unitId: 'u-b5', flatId: 'B5', blockName: 'Block B', fullName: 'RIPON / MIZANUR RAHMAN', phone: '01700000000', nidNumber: '19892691234567891', email: 'b5.resident@mbdapartment.com', entryDate: '2026-10-01', emergencyContact: '01700000000', status: 'active' },
  { id: 't-b6', unitId: 'u-b6', flatId: 'B6', blockName: 'Block B', fullName: 'SHAKIL AHMED', phone: '01710852936', nidNumber: '19932692345678902', email: 'shakil.b6@gmail.com', entryDate: '2025-12-08', emergencyContact: '01710852936', status: 'active' },
  { id: 't-b7', unitId: 'u-b7', flatId: 'B7', blockName: 'Block B', fullName: 'MD. ROCKY', phone: '01714411735', nidNumber: '19952693456789013', email: 'rocky.b7@gmail.com', entryDate: '2026-05-01', emergencyContact: '01714411735', status: 'active' },

  // Block C
  { id: 't-c1', unitId: 'u-c1', flatId: 'C1', blockName: 'Block C', fullName: 'JUI RAHMAN', phone: '8801832326112', nidNumber: '19822693456789013', email: 'jui.c1@gmail.com', entryDate: '2026-01-21', emergencyContact: '8801832326112', status: 'active' },
  { id: 't-c2', unitId: 'u-c2', flatId: 'C2', blockName: 'Block C', fullName: 'RUSTOM', phone: '8801772189563', nidNumber: '19852694567890124', email: 'rustom.c2@gmail.com', entryDate: '2026-03-01', emergencyContact: '8801772189563', status: 'active' },
  { id: 't-c3', unitId: 'u-c3', flatId: 'C3', blockName: 'Block C', fullName: 'MONIRUZZAMAMN', phone: '8801773030467', nidNumber: '19922695678901235', email: 'monir.c3@gmail.com', entryDate: '2026-01-28', emergencyContact: '8801773030467', status: 'active' },
  { id: 't-c4', unitId: 'u-c4', flatId: 'C4', blockName: 'Block C', fullName: 'DR. SHAMIMA', phone: '8801745042624', nidNumber: '19882696789012346', email: 'shamima.c4@gmail.com', entryDate: '2025-06-01', emergencyContact: '8801745042624', status: 'active' },
  { id: 't-c6', unitId: 'u-c6', flatId: 'C6', blockName: 'Block C', fullName: 'MD. FARUK HOSSEN', phone: '8801741600402', nidNumber: '19902697890123457', email: 'faruk.c6@gmail.com', entryDate: '2024-12-29', emergencyContact: '8801741600402', status: 'active' },
  { id: 't-c7', unitId: 'u-c7', flatId: 'C7', blockName: 'Block C', fullName: 'BADHON', phone: '01734100737', nidNumber: '19942698901234568', email: 'badhon.c7@gmail.com', entryDate: '2026-07-01', emergencyContact: '01734100737', status: 'active' },
];

export const INITIAL_ADVANCE_ACCOUNTS: AdvanceAccount[] = [
  { id: 'adv-a1', tenantId: 't-a1', unitId: 'u-a1', flatId: 'A1', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-01-15', updatedAt: '2024-01-15' },
  { id: 'adv-a2', tenantId: 't-a2', unitId: 'u-a2', flatId: 'A2', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-03-01', updatedAt: '2024-03-01' },
  { id: 'adv-a3', tenantId: 't-a3', unitId: 'u-a3', flatId: 'A3', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-02-10', updatedAt: '2024-02-10' },
  { id: 'adv-a4', tenantId: 't-a4', unitId: 'u-a4', flatId: 'A4', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2025-08-01', updatedAt: '2025-08-01' },
  { id: 'adv-a5', tenantId: 't-a5', unitId: 'u-a5', flatId: 'A5', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2025-08-01', updatedAt: '2025-08-01' },
  { id: 'adv-a5-owner', tenantId: 't-a5-owner', unitId: 'u-a5-owner', flatId: 'A5 (Owner)', totalRequired: 0, amountPaid: 0, remainingAdvance: 0, status: 'paid', lastPaymentDate: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'adv-a6', tenantId: 't-a6', unitId: 'u-a6', flatId: 'A6', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2024-06-03', updatedAt: '2024-06-03' },
  { id: 'adv-a7', tenantId: 't-a7', unitId: 'u-a7', flatId: 'A7', totalRequired: 52000, amountPaid: 52000, remainingAdvance: 52000, status: 'paid', lastPaymentDate: '2025-10-14', updatedAt: '2025-10-14' },

  { id: 'adv-b1', tenantId: 't-b1', unitId: 'u-b1', flatId: 'B1', totalRequired: 42000, amountPaid: 42000, remainingAdvance: 42000, status: 'paid', lastPaymentDate: '2024-02-01', updatedAt: '2024-02-01' },
  { id: 'adv-b2', tenantId: 't-b2', unitId: 'u-b2', flatId: 'B2', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-01-10', updatedAt: '2024-01-10' },
  { id: 'adv-b3', tenantId: 't-b3', unitId: 'u-b3', flatId: 'B3', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-05-01', updatedAt: '2024-05-01' },
  { id: 'adv-b4', tenantId: 't-b4', unitId: 'u-b4', flatId: 'B4', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 48000, status: 'paid', lastPaymentDate: '2024-03-15', updatedAt: '2024-03-15' },
  { id: 'adv-b5', tenantId: 't-b5', unitId: 'u-b5', flatId: 'B5', totalRequired: 17000, amountPaid: 17000, remainingAdvance: 17000, status: 'paid', lastPaymentDate: '2026-10-01', updatedAt: '2026-10-01' },
  { id: 'adv-b6', tenantId: 't-b6', unitId: 'u-b6', flatId: 'B6', totalRequired: 50000, amountPaid: 50000, remainingAdvance: 50000, status: 'paid', lastPaymentDate: '2024-02-15', updatedAt: '2024-02-15' },

  { id: 'adv-c1', tenantId: 't-c1', unitId: 'u-c1', flatId: 'C1', totalRequired: 40000, amountPaid: 40000, remainingAdvance: 40000, status: 'paid', lastPaymentDate: '2024-01-01', updatedAt: '2024-01-01' },
  { id: 'adv-c2', tenantId: 't-c2', unitId: 'u-c2', flatId: 'C2', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-03-01', updatedAt: '2024-03-01' },
  { id: 'adv-c3', tenantId: 't-c3', unitId: 'u-c3', flatId: 'C3', totalRequired: 44000, amountPaid: 44000, remainingAdvance: 44000, status: 'paid', lastPaymentDate: '2024-02-01', updatedAt: '2024-02-01' },
  { id: 'adv-c4', tenantId: 't-c4', unitId: 'u-c4', flatId: 'C4', totalRequired: 46000, amountPaid: 46000, remainingAdvance: 46000, status: 'paid', lastPaymentDate: '2024-04-15', updatedAt: '2024-04-15' },
  { id: 'adv-c6', tenantId: 't-c6', unitId: 'u-c6', flatId: 'C6', totalRequired: 48000, amountPaid: 48000, remainingAdvance: 24000, status: 'partially_paid', lastPaymentDate: '2024-01-20', updatedAt: '2024-01-20' },
];

export const INITIAL_ADVANCE_TRANSACTIONS: AdvanceTransaction[] = [
  { id: 'atx-1', advanceAccountId: 'adv-a1', tenantId: 't-a1', tenantName: 'Engr. Mahbubur Rahman', flatId: 'A1', amount: 44000, type: 'deposit', paymentDate: '2024-01-15', paymentMethod: 'Bank Transfer', receiptNo: 'ADV-2024-001', transactionId: 'TXN-IBBL-98124', notes: '2 months security deposit', recordedBy: 'Manager Russell', createdAt: '2024-01-15' },
  { id: 'atx-2', advanceAccountId: 'adv-a2', tenantId: 't-a2', tenantName: 'Tanvir Ahmed Chy', flatId: 'A2', amount: 48000, type: 'deposit', paymentDate: '2024-03-01', paymentMethod: 'Cash', receiptNo: 'ADV-2024-002', notes: 'Security advance paid in cash', recordedBy: 'Manager Russell', createdAt: '2024-03-01' },
  { id: 'atx-3', advanceAccountId: 'adv-b3', tenantId: 't-b3', tenantName: 'Farhana Begum', flatId: 'B3', amount: 46000, type: 'deposit', paymentDate: '2024-05-01', paymentMethod: 'bKash', receiptNo: 'ADV-2024-003', transactionId: 'BK-99214A', notes: 'bKash Merchant Payment', recordedBy: 'Manager Russell', createdAt: '2024-05-01' },
];

// Previous Month (September 2026) Meter Readings & Electricity Bills
// Postpaid rule: Sep consumption bill is billed & paid in Oct collection ledger!
export const INITIAL_METER_READINGS: MeterReading[] = [
  // Aug -> Sep readings (for Sep electricity consumption)
  { id: 'mr-a1-sep', unitId: 'u-a1', flatId: 'A1', month: 9, year: 2026, previousReading: 2150, currentReading: 2365, consumedUnits: 215, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a2-sep', unitId: 'u-a2', flatId: 'A2', month: 9, year: 2026, previousReading: 1820, currentReading: 2110, consumedUnits: 290, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a3-sep', unitId: 'u-a3', flatId: 'A3', month: 9, year: 2026, previousReading: 3100, currentReading: 3340, consumedUnits: 240, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a4-sep', unitId: 'u-a4', flatId: 'A4', month: 9, year: 2026, previousReading: 1450, currentReading: 1775, consumedUnits: 325, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-a6-sep', unitId: 'u-a6', flatId: 'A6', month: 9, year: 2026, previousReading: 2600, currentReading: 2880, consumedUnits: 280, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },

  { id: 'mr-b1-sep', unitId: 'u-b1', flatId: 'B1', month: 9, year: 2026, previousReading: 1980, currentReading: 2175, consumedUnits: 195, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b2-sep', unitId: 'u-b2', flatId: 'B2', month: 9, year: 2026, previousReading: 3200, currentReading: 3460, consumedUnits: 260, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b3-sep', unitId: 'u-b3', flatId: 'B3', month: 9, year: 2026, previousReading: 1540, currentReading: 1765, consumedUnits: 225, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b4-sep', unitId: 'u-b4', flatId: 'B4', month: 9, year: 2026, previousReading: 2100, currentReading: 2380, consumedUnits: 280, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b5-sep', unitId: 'u-b5', flatId: 'B5', month: 9, year: 2026, previousReading: 1720, currentReading: 1930, consumedUnits: 210, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-b6-sep', unitId: 'u-b6', flatId: 'B6', month: 9, year: 2026, previousReading: 2890, currentReading: 3190, consumedUnits: 300, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },

  { id: 'mr-c1-sep', unitId: 'u-c1', flatId: 'C1', month: 9, year: 2026, previousReading: 1800, currentReading: 1995, consumedUnits: 195, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c2-sep', unitId: 'u-c2', flatId: 'C2', month: 9, year: 2026, previousReading: 2310, currentReading: 2540, consumedUnits: 230, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c3-sep', unitId: 'u-c3', flatId: 'C3', month: 9, year: 2026, previousReading: 1420, currentReading: 1650, consumedUnits: 230, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c4-sep', unitId: 'u-c4', flatId: 'C4', month: 9, year: 2026, previousReading: 2050, currentReading: 2310, consumedUnits: 260, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
  { id: 'mr-c6-sep', unitId: 'u-c6', flatId: 'C6', month: 9, year: 2026, previousReading: 3100, currentReading: 3375, consumedUnits: 275, readingDate: '2026-09-30', recordedBy: 'Manager Russell' },
];

// Electricity Bills for September consumption applied in October 2026 collection ledger
export function generateInitialElectricityBills(): ElectricityBill[] {
  return INITIAL_METER_READINGS.map((mr) => {
    const calc = calculateNescoElectricityBill(mr.currentReading, mr.previousReading, DEFAULT_NESCO_TARIFF, 3);
    const tenant = INITIAL_TENANTS.find((t) => t.flatId === mr.flatId);
    return {
      id: `eb-${mr.flatId.toLowerCase()}-sep2026`,
      unitId: mr.unitId,
      flatId: mr.flatId,
      tenantId: tenant?.id || '',
      tenantName: tenant?.fullName || 'N/A',
      consumptionMonth: 9,
      consumptionYear: 2026,
      billingMonth: 10,
      billingYear: 2026,
      previousReading: mr.previousReading,
      currentReading: mr.currentReading,
      consumedUnits: mr.consumedUnits,
      slabBreakdown: calc.slabBreakdown,
      baseEnergyCost: calc.baseEnergyCost,
      demandCharge: calc.demandCharge,
      vatAmount: calc.vatAmount,
      meterRent: calc.meterRent,
      rebateAmount: calc.rebateAmount,
      totalBill: calc.totalBill,
      paidAmount: mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? calc.totalBill : 0,
      dueAmount: mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? 0 : calc.totalBill,
      paymentStatus: (mr.flatId === 'A1' || mr.flatId === 'B1' || mr.flatId === 'C1' ? 'Paid' : 'Not Paid') as PaymentStatus,
      generatedDate: '2026-10-01',
      receiptNo: mr.flatId === 'A1' ? 'REC-ELEC-2026-10-A1' : undefined,
      tariffSnapshotTitle: DEFAULT_NESCO_TARIFF.title,
    };
  });
}

// Initial Main Monthly Financial Ledger for Current Month (October 2026)
export function generateInitialLedger(month: number = 10, year: number = 2026): MonthlyLedgerItem[] {
  const bills = generateInitialElectricityBills();

  return INITIAL_UNITS.map((unit) => {
    const tenant = INITIAL_TENANTS.find((t) => t.flatId === unit.flatId);
    const advance = INITIAL_ADVANCE_ACCOUNTS.find((a) => a.flatId === unit.flatId);
    const elecBill = bills.find((b) => b.flatId === unit.flatId);

    const flatRent = unit.monthlyRent;
    const electricityAmount = unit.electricityBillingType === 'fixed'
      ? (unit.fixedElectricityAmount || 0)
      : (elecBill ? elecBill.totalBill : 0);

    const parkingRent = unit.parkingSlot ? 2500 : 0;
    const godownRent = unit.godownSlot ? 6000 : 0;

    const totalPayable = flatRent + electricityAmount + parkingRent + godownRent;

    // Simulate payment statuses for October 2026
    let totalPaid = 0;
    let paymentStatus: PaymentStatus = 'Not Paid';
    let adjustedFromAdvance = 0;
    let lastPaymentDate: string | undefined = undefined;

    if (!unit.isOccupied) {
      paymentStatus = 'N/A';
    } else if (unit.flatId === 'A5 (Owner)' || unit.flatId === 'A5 Owner' || unit.flatId === 'C5 Owner' || unit.flatId.includes('Owner')) {
      paymentStatus = 'N/A';
    } else if (unit.flatId === 'A1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-03';
    } else if (unit.flatId === 'A2') {
      totalPaid = 15000; // partial
      paymentStatus = 'Partially Paid';
      lastPaymentDate = '2026-10-05';
    } else if (unit.flatId === 'B1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-04';
    } else if (unit.flatId === 'B3') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-02';
    } else if (unit.flatId === 'C1') {
      totalPaid = totalPayable;
      paymentStatus = 'Paid';
      lastPaymentDate = '2026-10-06';
    } else if (unit.flatId === 'C6') {
      // Adjusted from advance
      adjustedFromAdvance = flatRent;
      totalPaid = totalPayable;
      paymentStatus = 'Adjusted';
      lastPaymentDate = '2026-10-01';
    } else {
      totalPaid = 0;
      paymentStatus = 'Not Paid';
    }

    const totalDue = Math.max(0, totalPayable - totalPaid);
    const cleanFlatId = unit.flatId.replace(/^u-/, '').trim();
    const blockKey =
      unit.blockName === 'Block A'
        ? 'blockA'
        : unit.blockName === 'Block B'
        ? 'blockB'
        : unit.blockName === 'Block C'
        ? 'blockC'
        : cleanFlatId.startsWith('A')
        ? 'blockA'
        : cleanFlatId.startsWith('B')
        ? 'blockB'
        : cleanFlatId.startsWith('C')
        ? 'blockC'
        : 'blockA';

    return {
      id: `led-${unit.flatId.toLowerCase()}-${month}-${year}`,
      unitId: unit.id,
      flatId: unit.flatId,
      blockName: unit.blockName,
      blockKey,
      tenantId: tenant?.id || '',
      tenantName: tenant ? tenant.fullName : (unit.flatId.includes('Owner') ? 'Owner Occupied' : 'Vacant Flat'),
      tenantPhone: tenant?.phone || 'N/A',
      entryDate: tenant?.entryDate || 'N/A',
      billingPeriod: `${year}-${String(month).padStart(2, '0')}`,
      month,
      year,
      advancePayment: unit.flatId.includes('Owner') || advance?.status === 'not_paid' ? 0 : (advance?.amountPaid || 0),
      advanceStatus: unit.flatId.includes('Owner')
        ? 'N/A'
        : advance?.status === 'not_paid'
        ? 'Not Paid'
        : advance?.status === 'partially_paid'
        ? 'Partially Paid'
        : (advance?.amountPaid && advance.amountPaid > 0)
        ? 'Paid'
        : 'Not Paid',
      advanceDate: advance?.status === 'not_paid' ? undefined : (advance?.lastPaymentDate || (advance?.amountPaid && advance.amountPaid > 0 ? '2024-01-01' : undefined)),
      flatRent,
      rentStatus: (
        unit.flatId.includes('Owner')
          ? 'N/A'
          : paymentStatus === 'Paid'
          ? 'Paid'
          : paymentStatus === 'Adjusted'
          ? 'Adjusted'
          : paymentStatus === 'Partially Paid'
          ? 'Partially Paid'
          : paymentStatus === 'N/A'
          ? 'N/A'
          : 'Not Paid'
      ) as 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A',
      rentPaymentDate: lastPaymentDate,
      electricityBill: electricityAmount,
      electricityStatus: (
        unit.flatId.includes('Owner') || electricityAmount === 0
          ? 'N/A'
          : paymentStatus === 'Paid'
          ? 'Paid'
          : 'Not Paid'
      ) as 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A',
      electricityDate: paymentStatus === 'Paid' ? lastPaymentDate : undefined,
      parkingRent,
      godownRent,
      totalPayable,
      totalPaid,
      totalDue,
      paymentStatus,
      adjustedFromAdvance,
      lastPaymentDate,
    };
  });
}

// Initial Payments
export const INITIAL_PAYMENT_TRANSACTIONS: PaymentTransaction[] = [
  { id: 'ptxn-01', receiptNo: 'REC-2026-10-A1', tenantId: 't-a1', tenantName: 'Engr. Mahbubur Rahman', flatId: 'A1', category: 'Combined', month: 10, year: 2026, amount: 23850, paymentMethod: 'Bank Transfer', transactionId: 'IBBL-OCT-88912', paymentDate: '2026-10-03', verificationStatus: 'Verified', recordedBy: 'Manager Russell', notes: 'Rent & Electricity' , createdAt: '2026-10-03' },
  { id: 'ptxn-02', receiptNo: 'REC-2026-10-A2', tenantId: 't-a2', tenantName: 'Tanvir Ahmed Chy', flatId: 'A2', category: 'Flat Rent', month: 10, year: 2026, amount: 15000, paymentMethod: 'bKash', transactionId: 'BK912903AA', paymentDate: '2026-10-05', verificationStatus: 'Verified', recordedBy: 'Manager Russell', notes: 'Partial rent payment', createdAt: '2026-10-05' },
  { id: 'ptxn-03', receiptNo: 'REC-2026-10-B1', tenantId: 't-b1', tenantName: 'Al-Amin Hossain', flatId: 'B1', category: 'Combined', month: 10, year: 2026, amount: 22680, paymentMethod: 'Cash', paymentDate: '2026-10-04', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-04' },
  { id: 'ptxn-04', receiptNo: 'REC-2026-10-B3', tenantId: 't-b3', tenantName: 'Farhana Begum', flatId: 'B3', category: 'Combined', month: 10, year: 2026, amount: 24920, paymentMethod: 'bKash', transactionId: 'BK778811XX', paymentDate: '2026-10-02', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-02' },
  { id: 'ptxn-05', receiptNo: 'REC-2026-10-C1', tenantId: 't-c1', tenantName: 'Golam Mostafa', flatId: 'C1', category: 'Combined', month: 10, year: 2026, amount: 21680, paymentMethod: 'Nagad', transactionId: 'NG66224411', paymentDate: '2026-10-06', verificationStatus: 'Verified', recordedBy: 'Manager Russell', createdAt: '2026-10-06' },
];

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'comp-1',
    tenantId: 't-a2',
    tenantName: 'Tanvir Ahmed Chy',
    flatId: 'A2',
    blockName: 'Block A',
    category: 'Water',
    subject: 'Low water pressure in master bathroom',
    description: 'Since yesterday evening, the rooftop overhead tank water pressure is very slow in the master bath faucet.',
    submissionDate: '2026-10-04T10:30:00Z',
    status: 'In Progress',
    assignedTo: 'Plumber Abdul Kalam',
    messages: [
      { id: 'cm-1', senderName: 'Tanvir Ahmed Chy', senderRole: 'tenant', message: 'Please send the plumber in the afternoon after 3 PM if possible.', timestamp: '2026-10-04T10:32:00Z' },
      { id: 'cm-2', senderName: 'Russell (Manager)', senderRole: 'manager', message: 'Abdul Kalam is assigned and will inspect the pressure valve at 3:30 PM today.', timestamp: '2026-10-04T11:15:00Z' },
    ],
  },
  {
    id: 'comp-2',
    tenantId: 't-b3',
    tenantName: 'Farhana Begum',
    flatId: 'B3',
    blockName: 'Block B',
    category: 'Electricity',
    subject: 'Corridor emergency light flickering',
    description: 'The 3rd floor corridor emergency tube light flickers continuously during generator changeover.',
    submissionDate: '2026-10-02T14:00:00Z',
    status: 'Resolved',
    assignedTo: 'Electrician Nurul',
    messages: [
      { id: 'cm-3', senderName: 'Russell (Manager)', senderRole: 'manager', message: 'Replaced ballast and starter on 2nd Oct evening. Tested with generator load successfully.', timestamp: '2026-10-02T18:00:00Z' },
    ],
  },
  {
    id: 'comp-3',
    tenantId: 't-c4',
    tenantName: 'Moniruzzaman Monir',
    flatId: 'C4',
    blockName: 'Block C',
    category: 'Lift',
    subject: 'Lift door sensor sensitivity in Block C',
    description: 'Lift doors close too quickly before elder passengers can comfortably enter.',
    submissionDate: '2026-10-05T09:15:00Z',
    status: 'Submitted',
    messages: [],
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'msg-1', conversationId: 'conv-owner-rashed-a', senderId: 'user-manager-russell', senderName: 'Russell (Manager)', senderRole: 'manager', recipientId: 'user-owner-rashed-a', message: 'Assalamu Alaikum Rashed bhai, October monthly ledger for Block A has been updated with latest meter readings.', timestamp: '2026-10-01T10:00:00Z', isRead: true },
  { id: 'msg-2', conversationId: 'conv-owner-rashed-a', senderId: 'user-owner-rashed-a', senderName: 'Rashed (Block A Owner)', senderRole: 'owner', recipientId: 'user-manager-russell', message: 'Walaikum Assalam Russell. Thank you. Please ensure all payment receipts are issued on time.', timestamp: '2026-10-01T10:30:00Z', isRead: true },
  { id: 'msg-3', conversationId: 'conv-owner-raju-b', senderId: 'user-manager-russell', senderName: 'Russell (Manager)', senderRole: 'manager', recipientId: 'user-owner-raju-b', message: 'Raju bhai, Block B electricity submeters have all been checked for September billing.', timestamp: '2026-10-02T11:00:00Z', isRead: true },
  { id: 'msg-4', conversationId: 'conv-owner-raju-b', senderId: 'user-owner-raju-b', senderName: 'Raju (Block B Owner)', senderRole: 'owner', recipientId: 'user-manager-russell', message: 'Received Russell bhai. I have verified the Block B collections in the ledger.', timestamp: '2026-10-02T11:45:00Z', isRead: true },
];

export const INITIAL_BLOCK_MFS_CONFIGS: Record<'Block A' | 'Block B' | 'Block C', BlockMfsConfig> = {
  'Block A': {
    blockName: 'Block A',
    ownerId: 'user-owner-rashed-a',
    ownerName: 'Md. Rashed',
    ownerPhone: '01717623061',
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: '01717623061',
    bkashType: 'Personal',
    nagadNumber: '01717623061',
    nagadType: 'Personal',
    rocketNumber: '01717623061-0',
    rocketType: 'Personal',
    instructions: 'Send Money to Block A Owner Md. Rashed. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
  'Block B': {
    blockName: 'Block B',
    ownerId: 'user-owner-raju-b',
    ownerName: 'Md. Raju',
    ownerPhone: '01913858775',
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: '01913858775',
    bkashType: 'Personal',
    nagadNumber: '01913858775',
    nagadType: 'Personal',
    rocketNumber: '01913858775-0',
    rocketType: 'Personal',
    instructions: 'Send Money to Block B Owner Md. Raju. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
  'Block C': {
    blockName: 'Block C',
    ownerId: 'user-owner-rony-c',
    ownerName: 'Md. Rony',
    ownerPhone: '01712118547',
    isMfsEnabled: true,
    mfsFeePercentage: 1.8,
    bkashNumber: '01712118547',
    bkashType: 'Personal',
    nagadNumber: '01712118547',
    nagadType: 'Personal',
    rocketNumber: '01712118547-0',
    rocketType: 'Personal',
    instructions: 'Send Money to Block C Owner Md. Rony. Add 1.8% cashout fee and use Flat ID in reference.',
    isBankDepositAllowed: false,
  },
};

export const INITIAL_PAYMENT_SETTINGS: PaymentSettings = {
  bkashEnabled: true,
  bkashNumber: `${COMPLEX_CONFIG.managerPhone} (Manager Russell)`,
  nagadEnabled: true,
  nagadNumber: `${COMPLEX_CONFIG.rajuPhone} (Raju - Block B Owner)`,
  rocketEnabled: true,
  rocketNumber: `${COMPLEX_CONFIG.managerPhone}-0 (Manager)`,
  bankEnabled: true,
  bankName: 'Islami Bank Bangladesh Ltd (Rajshahi Branch)',
  bankAccountNo: '2050 3219 9801 8587',
  bankRouting: 'IBBLBDRJ050',
  blockConfigs: INITIAL_BLOCK_MFS_CONFIGS,
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: 'log-1', action: 'CREATE_BILL', entity: 'ElectricityBill', entityId: 'eb-all-sep2026', performedBy: 'Manager Russell', userRole: 'manager', details: 'Generated September 2026 postpaid NESCO electricity bills for 17 flats in Ma Babar Doa Apartment Complex', timestamp: '2026-10-01T09:00:00Z' },
  { id: 'log-2', action: 'RECORD_PAYMENT', entity: 'PaymentTransaction', entityId: 'ptxn-01', performedBy: 'Manager Russell', userRole: 'manager', details: 'Verified bank payment of ৳23,850 for Flat A1', timestamp: '2026-10-03T14:20:00Z' },
  { id: 'log-3', action: 'ADJUST_ADVANCE', entity: 'MonthlyLedger', entityId: 'led-c6-10-2026', performedBy: 'Manager Russell', userRole: 'manager', details: 'Adjusted rent of ৳24,000 from available advance balance for Flat C6 (departure notice month)', timestamp: '2026-10-01T11:45:00Z' },
];

// Persistent App State Engine
const STORAGE_KEY = 'ams_mbd_v2_database';

export function getInitialDatabaseState(): AppDatabaseState {
  return {
    profiles: INITIAL_PROFILES,
    blocks: INITIAL_BLOCKS,
    units: INITIAL_UNITS,
    tenants: INITIAL_TENANTS,
    advanceAccounts: INITIAL_ADVANCE_ACCOUNTS,
    advanceTransactions: INITIAL_ADVANCE_TRANSACTIONS,
    ledgerItems: [
      ...generateInitialLedger(8, 2026),
      ...generateInitialLedger(10, 2026),
    ],
    meterReadings: INITIAL_METER_READINGS,
    electricityBills: generateInitialElectricityBills(),
    payments: INITIAL_PAYMENT_TRANSACTIONS,
    complaints: INITIAL_COMPLAINTS,
    chatMessages: INITIAL_CHAT_MESSAGES,
    onlineRequests: [
      {
        id: 'onl-1',
        tenantId: 't-b4',
        tenantName: 'Tariqul Islam Tushar',
        flatId: 'B4',
        month: 10,
        year: 2026,
        category: 'Combined Bill (Rent + Elec)',
        amount: 26500,
        paymentMethod: 'bKash',
        transactionId: 'BK99482103',
        submissionDate: '2026-10-05T16:20:00Z',
        verificationStatus: 'Pending',
        notes: 'Submitted via bKash app',
      }
    ],
    paymentSettings: INITIAL_PAYMENT_SETTINGS,
    tariffConfig: DEFAULT_NESCO_TARIFF,
    auditLogs: INITIAL_AUDIT_LOGS,
    selectedMonth: 10,
    selectedYear: 2026,
    securityCredentials: { ...DEFAULT_SECURITY_CREDENTIALS },
  };
}

/**
 * Resolves the true current/active billing period from the database.
 * Looks for the maximum billing month & year present in ledger records (e.g. October 2026),
 * ensuring operations like credential generation, tenant logins, and default passwords
 * always reflect the current active residents, never past tenants who departed in previous months.
 */
export function getCurrentActiveBillingPeriod(data?: AppDatabaseState | null): { month: number; year: number } {
  let maxYear = 2026;
  let maxMonth = 10;
  if (data && Array.isArray(data.ledgerItems) && data.ledgerItems.length > 0) {
    for (const item of data.ledgerItems) {
      if (item.year > maxYear || (item.year === maxYear && item.month > maxMonth)) {
        maxYear = item.year;
        maxMonth = item.month;
      }
    }
  }
  return { month: maxMonth, year: maxYear };
}

/**
 * Compares two flat IDs in natural serial order:
 * e.g., A1, A2, A3, ... A5, A5 (Owner), A5 Sublet, ... A7, ... B1, B2, ... C1, C2 ...
 * Followed by godowns (G1, G2) and parking slots (P1, P2, P3).
 */
export function compareFlatIdSerial(idA: string = '', idB: string = ''): number {
  if (!idA && !idB) return 0;
  if (!idA) return 1;
  if (!idB) return -1;

  const rawA = idA.trim();
  const rawB = idB.trim();
  if (rawA.toLowerCase() === rawB.toLowerCase()) return 0;

  // Clean strings for comparison (strip leading 'flat' keyword if present)
  const cleanA = rawA.toUpperCase().replace(/^FLAT[\s\-_]*/i, '');
  const cleanB = rawB.toUpperCase().replace(/^FLAT[\s\-_]*/i, '');

  // Extract block letter(s), number, and any suffix
  // e.g., 'A1' -> block 'A', num 1, suffix ''
  // e.g., 'A5 (OWNER)' -> block 'A', num 5, suffix ' (OWNER)'
  // e.g., 'A5 SUBLET' -> block 'A', num 5, suffix ' SUBLET'
  const matchA = cleanA.match(/^([A-Z]+)[\s\-_]*(\d+)?(.*)$/);
  const matchB = cleanB.match(/^([A-Z]+)[\s\-_]*(\d+)?(.*)$/);

  if (matchA && matchB) {
    const blockA = matchA[1];
    const blockB = matchB[1];
    if (blockA !== blockB) {
      return blockA.localeCompare(blockB);
    }
    const numA = matchA[2] ? parseInt(matchA[2], 10) : -1;
    const numB = matchB[2] ? parseInt(matchB[2], 10) : -1;
    if (numA !== numB) {
      if (numA === -1) return 1;
      if (numB === -1) return -1;
      return numA - numB;
    }
    const suffixA = (matchA[3] || '').trim();
    const suffixB = (matchB[3] || '').trim();
    if (!suffixA && suffixB) return -1;
    if (suffixA && !suffixB) return 1;

    // Prioritize (Owner) over Sublet
    const isOwnerA = suffixA.includes('OWNER');
    const isOwnerB = suffixB.includes('OWNER');
    if (isOwnerA && !isOwnerB) return -1;
    if (!isOwnerA && isOwnerB) return 1;

    return suffixA.localeCompare(suffixB, undefined, { numeric: true, sensitivity: 'base' });
  }

  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extract the last 11 digits of a phone number (standard Bangladesh mobile format e.g. 017XXXXXXXX).
 * Handles numbers with country code (+88017..., 88017...), hyphens, spaces, or leading missing zero (17...).
 */
export function getLast11Digits(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 11) {
    return digits.slice(-11);
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return '0' + digits;
  }
  return digits;
}

/**
 * Normalizes name strings for comparison
 */
export function normalizeTenantName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Checks if two tenant names refer to the same person
 */
export function isSameTenantPerson(nameA: string, nameB: string): boolean {
  const normA = normalizeTenantName(nameA);
  const normB = normalizeTenantName(nameB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // If one contains the other (e.g. "Tanvir Ahmed" and "Tanvir Ahmed Chy")
  if (normA.length >= 4 && normB.length >= 4) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  return false;
}

/**
 * Checks if a chat message is associated with a given flat
 */
export function isMessageAssociatedWithFlat(m: ChatMessage, flatId: string): boolean {
  if (!m || !flatId) return false;
  const cleanFlat = flatId.trim().toUpperCase();
  const lowerFlat = flatId.trim().toLowerCase();
  const flatSlug = lowerFlat.replace(/[^a-z0-9]/g, '');

  // 1. Explicit m.flatId
  if (m.flatId && m.flatId.trim().toUpperCase() === cleanFlat) return true;

  // 2. conversationId matching e.g. conv-a2, conv-flat-a2
  if (m.conversationId) {
    const c = m.conversationId.toLowerCase().trim();
    if (
      c === `conv-${lowerFlat}` ||
      c === `conv-${flatSlug}` ||
      c === `conv-flat-${lowerFlat}` ||
      c === `conv-flat-${flatSlug}` ||
      c === `conv-t-${lowerFlat}` ||
      c === `conv-t-${flatSlug}`
    ) {
      return true;
    }
  }

  // 3. recipientId or senderId matching
  const r = (m.recipientId || '').toLowerCase().trim();
  const s = (m.senderId || '').toLowerCase().trim();
  if (
    r === lowerFlat ||
    r === flatSlug ||
    r === `t-${lowerFlat}` ||
    r === `t-${flatSlug}` ||
    r === `u-${lowerFlat}` ||
    r === `u-${flatSlug}` ||
    s === lowerFlat ||
    s === flatSlug ||
    s === `t-${lowerFlat}` ||
    s === `t-${flatSlug}` ||
    s === `u-${lowerFlat}` ||
    s === `u-${flatSlug}`
  ) {
    return true;
  }

  // 4. Check if senderName mentions this flat (e.g. "ABDULLAH AL MAMUN (Flat A2)")
  if (m.senderName && m.senderName.toUpperCase().includes(`(FLAT ${cleanFlat})`)) {
    return true;
  }

  return false;
}

/**
 * Automatically purges previous tenant chat messages for all rental units.
 * Whenever a new tenant enters a rental unit, all previous conversation messages
 * of former occupants for that rental unit must be removed immediately.
 */
export function purgePreviousTenantChatMessages(
  chatMessages: ChatMessage[],
  activeTenants: Tenant[],
  units?: Unit[]
): ChatMessage[] {
  if (!Array.isArray(chatMessages)) return [];

  // Map active tenants by flatId (uppercase)
  const activeTenantByFlat = new Map<string, Tenant>();
  (activeTenants || []).forEach((t) => {
    if (t.flatId && t.status === 'active' && !t.flatId.toLowerCase().includes('owner')) {
      activeTenantByFlat.set(t.flatId.trim().toUpperCase(), t);
    }
  });

  // Track flats where former tenant activity is detected
  const flatsWithPreviousTenantMessages = new Set<string>();

  chatMessages.forEach((m) => {
    // Resolve flat for this message
    let matchedFlat: string | null = null;
    if (m.flatId) {
      matchedFlat = m.flatId.trim().toUpperCase();
    } else if (m.conversationId) {
      const convMatch = m.conversationId.match(/conv-(?:flat-)?(?:t-)?([a-cA-C][0-9]+)/i);
      if (convMatch) matchedFlat = convMatch[1].toUpperCase();
    }
    if (!matchedFlat) {
      const matchRec = (m.recipientId || '').match(/t-([a-cA-C][0-9]+)/i);
      const matchSend = (m.senderId || '').match(/t-([a-cA-C][0-9]+)/i);
      if (matchRec) matchedFlat = matchRec[1].toUpperCase();
      else if (matchSend) matchedFlat = matchSend[1].toUpperCase();
    }

    if (matchedFlat && activeTenantByFlat.has(matchedFlat)) {
      const activeTenant = activeTenantByFlat.get(matchedFlat)!;

      // 1. If sender was a tenant whose name doesn't match active tenant
      if (m.senderRole === 'tenant') {
        if (!isSameTenantPerson(m.senderName, activeTenant.fullName)) {
          flatsWithPreviousTenantMessages.add(matchedFlat);
        }
      }

      // 2. If message timestamp is before active tenant entry date
      if (activeTenant.entryDate && activeTenant.entryDate.includes('-')) {
        const entryTime = new Date(`${activeTenant.entryDate}T00:00:00Z`).getTime();
        const msgTime = new Date(m.timestamp).getTime();
        if (!isNaN(entryTime) && !isNaN(msgTime) && msgTime < entryTime) {
          flatsWithPreviousTenantMessages.add(matchedFlat);
        }
      }

      // 3. Known former mock tenants check
      const lowerSender = (m.senderName || '').toLowerCase();
      const lowerMsg = (m.message || '').toLowerCase();
      if (
        (lowerSender.includes('tanvir') || lowerMsg.includes('tanvir')) &&
        !activeTenant.fullName.toLowerCase().includes('tanvir')
      ) {
        flatsWithPreviousTenantMessages.add(matchedFlat);
      }
      if (
        (lowerSender.includes('farhana') || lowerMsg.includes('farhana')) &&
        !activeTenant.fullName.toLowerCase().includes('farhana')
      ) {
        flatsWithPreviousTenantMessages.add(matchedFlat);
      }
    }
  });

  // Filter messages to strictly exclude all previous tenant messages
  return chatMessages.filter((m) => {
    // Check if message is between authority profiles (e.g. manager and owners)
    const isAuthorityOnly =
      (m.conversationId && m.conversationId.includes('owner')) ||
      (m.senderRole === 'manager' && m.recipientId.includes('owner')) ||
      (m.senderRole === 'owner' && m.recipientId.includes('manager')) ||
      (m.senderRole === 'owner' && m.recipientId.includes('owner'));
    if (isAuthorityOnly) {
      return true;
    }

    // Resolve matched flat
    let matchedFlat: string | null = null;
    if (m.flatId) {
      matchedFlat = m.flatId.trim().toUpperCase();
    } else if (m.conversationId) {
      const convMatch = m.conversationId.match(/conv-(?:flat-)?(?:t-)?([a-cA-C][0-9]+)/i);
      if (convMatch) matchedFlat = convMatch[1].toUpperCase();
    }
    if (!matchedFlat) {
      const matchRec = (m.recipientId || '').match(/t-([a-cA-C][0-9]+)/i);
      const matchSend = (m.senderId || '').match(/t-([a-cA-C][0-9]+)/i);
      if (matchRec) matchedFlat = matchRec[1].toUpperCase();
      else if (matchSend) matchedFlat = matchSend[1].toUpperCase();
    }

    if (matchedFlat) {
      const activeTenant = activeTenantByFlat.get(matchedFlat);
      if (!activeTenant) {
        // Flat is currently vacant or has no active tenant: purge old tenant messages
        return false;
      }

      // 1. If message was sent by a tenant, sender name MUST match the active tenant
      if (m.senderRole === 'tenant' && !isSameTenantPerson(m.senderName, activeTenant.fullName)) {
        return false;
      }

      // 2. If message timestamp is before active tenant entry date, purge it
      if (activeTenant.entryDate && activeTenant.entryDate.includes('-')) {
        const entryTime = new Date(`${activeTenant.entryDate}T00:00:00Z`).getTime();
        const msgTime = new Date(m.timestamp).getTime();
        if (!isNaN(entryTime) && !isNaN(msgTime) && msgTime < entryTime) {
          return false;
        }
      }

      // 3. If flat had previous tenant messages in that thread (e.g. Tanvir in Flat A2, Farhana in Flat B3),
      // purge any message from that former conversation thread
      if (flatsWithPreviousTenantMessages.has(matchedFlat)) {
        const lowerSender = (m.senderName || '').toLowerCase();
        const lowerMsg = (m.message || '').toLowerCase();
        if (
          (lowerSender.includes('tanvir') || lowerMsg.includes('tanvir')) &&
          !activeTenant.fullName.toLowerCase().includes('tanvir')
        ) {
          return false;
        }
        if (
          (lowerSender.includes('farhana') || lowerMsg.includes('farhana')) &&
          !activeTenant.fullName.toLowerCase().includes('farhana')
        ) {
          return false;
        }
        // If message was between manager and this flat prior to active tenant entry date
        // or part of the previous tenant thread:
        if (m.id === 'msg-1' || m.id === 'msg-2' || m.id === 'msg-3' || m.id === 'msg-4' || m.id === 'msg-5') {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Automatically synchronize all tenant records strictly according to the current month's occupation in the financial ledger.
 * - Removes unknown tenant names not in the active ledger.
 * - Replaces stale tenant names and phone numbers with current month ledger tenant names and phone numbers.
 * - Updates unit occupancy (isOccupied and tenantId).
 * - Immediately purges previous tenant chat messages when a new tenant enters a rental unit.
 */
export function syncTenantsWithCurrentLedger(state: AppDatabaseState): AppDatabaseState {
  if (!state || !Array.isArray(state.ledgerItems)) return state;

  const currentPeriod = getCurrentActiveBillingPeriod(state);
  const targetMonth = state.selectedMonth || currentPeriod.month;
  const targetYear = state.selectedYear || currentPeriod.year;

  // 1. Get ledger items for the currently selected month & year
  let monthLedger = state.ledgerItems.filter(
    (i) => i.month === targetMonth && i.year === targetYear
  );

  // If monthLedger is empty (or has no active data), fall back to current active billing period
  if (monthLedger.length === 0) {
    monthLedger = state.ledgerItems.filter(
      (i) => i.month === currentPeriod.month && i.year === currentPeriod.year
    );
  }

  const sourceLedger = monthLedger.length > 0 ? monthLedger : state.ledgerItems;

  // 2. Identify active occupants per flat
  const activeTenantsMap = new Map<string, MonthlyLedgerItem>();
  sourceLedger.forEach((item) => {
    const flatKey = (item.flatId || '').trim().toLowerCase();
    if (!flatKey) return;
    const isOwner = flatKey.includes('owner') || (item.notes || '').toLowerCase().includes('owner residence');
    const rawName = (item.tenantName || '').trim();
    const hasName = Boolean(rawName && rawName.toLowerCase() !== 'vacant' && rawName.toLowerCase() !== 'vacant flat' && rawName.toLowerCase() !== 'n/a');
    if (!isOwner && hasName) {
      if (!activeTenantsMap.has(flatKey)) {
        activeTenantsMap.set(flatKey, item);
      }
    }
  });

  // 3. Rebuild state.tenants strictly from the current month's active occupants
  const syncedTenants: Tenant[] = [];

  activeTenantsMap.forEach((ledgerItem, flatKey) => {
    const unit = state.units.find((u) => u.flatId.toLowerCase().trim() === flatKey);
    const existingTenant = (state.tenants || []).find((t) => t.flatId.toLowerCase().trim() === flatKey);

    const blockName: 'Block A' | 'Block B' | 'Block C' =
      unit?.blockName ||
      (ledgerItem.blockName as any) ||
      (ledgerItem.flatId.toUpperCase().startsWith('A') ? 'Block A' :
       ledgerItem.flatId.toUpperCase().startsWith('B') ? 'Block B' : 'Block C');

    const cleanPhone = ledgerItem.tenantPhone || existingTenant?.phone || '01700-000000';
    const cleanName = ledgerItem.tenantName.trim();

    syncedTenants.push({
      id: existingTenant?.id || ledgerItem.tenantId || `t-${ledgerItem.flatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      unitId: unit?.id || ledgerItem.unitId || `u-${ledgerItem.flatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      flatId: ledgerItem.flatId,
      blockName,
      fullName: cleanName,
      phone: cleanPhone,
      nidNumber: existingTenant?.nidNumber || '19902690000000000',
      email: `${ledgerItem.flatId.toLowerCase().replace(/[^a-z0-9]/g, '')}.resident@mbdapartment.com`,
      entryDate: ledgerItem.entryDate || existingTenant?.entryDate || '2024-01-01',
      emergencyContact: cleanPhone,
      status: 'active',
      notes: ledgerItem.notes,
    });
  });

  // Preserve Owner records if needed (marked active)
  const ownerUnits = state.units.filter((u) => u.flatId.toLowerCase().includes('owner'));
  ownerUnits.forEach((u) => {
    const existingOwnerTenant = (state.tenants || []).find((t) => t.flatId.toLowerCase() === u.flatId.toLowerCase());
    if (existingOwnerTenant) {
      syncedTenants.push(existingOwnerTenant);
    } else {
      syncedTenants.push({
        id: `t-${u.flatId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        unitId: u.id,
        flatId: u.flatId,
        blockName: u.blockName,
        fullName: u.flatId.startsWith('A') ? 'Md. Rashed (Owner)' : 'Md. Rony (Owner)',
        phone: u.flatId.startsWith('A') ? '01717623061' : '01712118547',
        nidNumber: '19852695678901235',
        email: `${u.flatId.toLowerCase().replace(/[^a-z0-9]/g, '')}@mbdapartment.com`,
        entryDate: '2024-01-01',
        emergencyContact: COMPLEX_CONFIG.managerPhone,
        status: 'active',
        notes: 'Owner residence',
      });
    }
  });

  // Sort by Flat in serial order (A1..A7, B1..B7, C1..C7)
  syncedTenants.sort((a, b) => compareFlatIdSerial(a.flatId, b.flatId));

  // 4. Update unit occupancy status based on current month ledger occupation
  const updatedUnits = state.units.map((unit) => {
    const flatKey = unit.flatId.toLowerCase().trim();
    const isOwner = flatKey.includes('owner');
    if (isOwner) {
      return { ...unit, isOccupied: true };
    }
    const matchingTenant = syncedTenants.find((t) => t.flatId.toLowerCase().trim() === flatKey && !t.flatId.toLowerCase().includes('owner'));
    return {
      ...unit,
      isOccupied: Boolean(matchingTenant),
      tenantId: matchingTenant ? matchingTenant.id : undefined,
    };
  });

  // 5. Purge previous tenant chat messages immediately whenever tenants are synced
  const cleanedChatMessages = purgePreviousTenantChatMessages(state.chatMessages || [], syncedTenants, updatedUnits);

  return {
    ...state,
    tenants: syncedTenants,
    units: updatedUnits,
    chatMessages: cleanedChatMessages,
  };
}

/**
 * Calculates the exact total due for a monthly ledger item.
 * When monthly flat rent status is 'Adjusted' (or paymentStatus === 'Adjusted'),
 * the flat rent amount is settled from the security advance escrow deposit
 * and must NEVER be counted as outstanding due (rent due is 0).
 */
export function calculateItemTotalDue(item: MonthlyLedgerItem): number {
  const rawRentStatus = (item.rentStatus || '').trim().toLowerCase();
  const rawPaymentStatus = (item.paymentStatus || '').trim().toLowerCase();
  const isRentAdjusted = rawRentStatus === 'adjusted' || rawPaymentStatus === 'adjusted';
  const isRentPaid =
    rawRentStatus === 'paid' ||
    rawRentStatus === 'n/a' ||
    rawPaymentStatus === 'paid' ||
    rawPaymentStatus === 'n/a';

  let rentDue = 0;
  if (isRentAdjusted || isRentPaid) {
    rentDue = 0;
  } else if (
    rawRentStatus === 'partially paid' ||
    rawRentStatus === 'partially_paid' ||
    rawPaymentStatus === 'partially paid' ||
    rawPaymentStatus === 'partially_paid'
  ) {
    const elecPaid = item.electricityStatus === 'Paid' ? (item.electricityBill || 0) : 0;
    const rentPaid = Math.max(0, (item.totalPaid || 0) - elecPaid);
    rentDue = Math.max(0, (item.flatRent || 0) - rentPaid);
  } else {
    rentDue = item.flatRent || 0;
  }

  let elecDue = 0;
  if (
    item.electricityStatus === 'Paid' ||
    item.electricityStatus === 'N/A' ||
    !item.electricityBill
  ) {
    elecDue = 0;
  } else {
    elecDue = item.electricityBill || 0;
  }

  const otherDue = (item.parkingRent || 0) + (item.godownRent || 0);
  return rentDue + elecDue + otherDue;
}

/**
 * Calculates the net remaining security advance deposit held in escrow for an account.
 * When any tenant's flat rent is adjusted from advance deposit (rentStatus === 'Adjusted'),
 * that adjusted amount is deducted from the escrow balance in the Manager's and Owner's dashboards.
 */
export function getEffectiveRemainingAdvance(
  account: AdvanceAccount,
  ledgerItems: MonthlyLedgerItem[]
): number {
  const flatClean = account.flatId.toLowerCase().trim();
  const totalAdjusted = ledgerItems
    .filter((item) => {
      if (item.flatId.toLowerCase().trim() !== flatClean) return false;
      const rStat = (item.rentStatus || '').trim().toLowerCase();
      const pStat = (item.paymentStatus || '').trim().toLowerCase();
      return (
        rStat === 'adjusted' ||
        pStat === 'adjusted' ||
        (item.adjustedFromAdvance !== undefined && item.adjustedFromAdvance > 0)
      );
    })
    .reduce((sum, item) => {
      const rStat = (item.rentStatus || '').trim().toLowerCase();
      const pStat = (item.paymentStatus || '').trim().toLowerCase();
      const amt =
        item.adjustedFromAdvance && item.adjustedFromAdvance > 0
          ? item.adjustedFromAdvance
          : rStat === 'adjusted' || pStat === 'adjusted'
          ? (item.flatRent || 0)
          : 0;
      return sum + amt;
    }, 0);

  const basePaid = account.amountPaid || 0;
  if (account.remainingAdvance !== undefined && account.remainingAdvance < basePaid) {
    return Math.max(0, Math.min(account.remainingAdvance, basePaid - totalAdjusted));
  }
  return Math.max(0, basePaid - totalAdjusted);
}

export function loadDatabaseState(): AppDatabaseState {
  if (typeof window === 'undefined') return getInitialDatabaseState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialDatabaseState();
      saveDatabaseState(initial);
      return initial;
    }
    let parsed: AppDatabaseState = JSON.parse(raw);
    if (parsed) {
      if (Array.isArray(parsed.units)) {
        parsed.units = parsed.units.map((u) => ({
          ...u,
          isElectricityEnabled:
            u.isElectricityEnabled !== undefined
              ? u.isElectricityEnabled
              : u.unitType === 'parking'
              ? false
              : u.flatId.includes('Owner')
              ? false
              : u.electricityBillingType === 'nesco_submeter',
        }));
        // Ensure Block A units have A1-A7 and A5 (Owner)
        const hasA5 = parsed.units.some((u) => u.flatId === 'A5');
        if (!hasA5) {
          parsed.units = parsed.units.filter((u) => !(u.blockName === 'Block A' || u.flatId.startsWith('A')));
          parsed.units.unshift(...INITIAL_UNITS.filter((u) => u.blockName === 'Block A'));
        }
        const existingA5Owner = parsed.units.find(
          (u) => u.flatId.toLowerCase().trim() === 'a5 (owner)' || u.flatId.toLowerCase().trim() === 'a5 owner'
        );
        if (!existingA5Owner) {
          const a5Idx = parsed.units.findIndex((u) => u.flatId === 'A5');
          const ownerUnit: Unit = {
            id: 'u-a5-owner',
            flatId: 'A5 (Owner)',
            blockId: 'block-a',
            blockName: 'Block A',
            floor: 5,
            unitType: 'residential',
            monthlyRent: 0,
            isOccupied: true,
            electricityBillingType: 'nesco_submeter',
            isElectricityEnabled: true,
            fixedElectricityAmount: 0,
            notes: 'Owner residence',
          };
          if (a5Idx >= 0) {
            parsed.units.splice(a5Idx + 1, 0, ownerUnit);
          } else {
            parsed.units.unshift(ownerUnit);
          }
        } else {
          // Ensure A5 Owner electricity billing is enabled
          if (existingA5Owner.isElectricityEnabled === false || existingA5Owner.electricityBillingType === 'none' || existingA5Owner.electricityBillingType === 'fixed') {
            existingA5Owner.electricityBillingType = 'nesco_submeter';
            existingA5Owner.isElectricityEnabled = true;
          }
        }
        const hasA5Sublet = parsed.units.some((u) => u.flatId.toLowerCase().trim() === 'a5 sublet');
        if (!hasA5Sublet) {
          const a5Idx = parsed.units.findIndex((u) => u.flatId === 'A5');
          const subletUnit: Unit = {
            id: 'u-a5-sublet',
            flatId: 'A5 Sublet',
            blockId: 'block-a',
            blockName: 'Block A',
            floor: 5,
            unitType: 'residential',
            monthlyRent: 4500,
            isOccupied: true,
            electricityBillingType: 'nesco_submeter',
            isElectricityEnabled: true,
          };
          if (a5Idx >= 0) {
            parsed.units.splice(a5Idx + 2, 0, subletUnit);
          } else {
            parsed.units.push(subletUnit);
          }
        }
      }
      if (Array.isArray(parsed.advanceAccounts)) {
        if (!parsed.advanceAccounts.some((a) => a.flatId === 'A5 (Owner)' || a.flatId === 'A5 Owner')) {
          parsed.advanceAccounts.push({
            id: 'adv-a5-owner',
            tenantId: 't-a5-owner',
            unitId: 'u-a5-owner',
            flatId: 'A5 (Owner)',
            totalRequired: 0,
            amountPaid: 0,
            remainingAdvance: 0,
            status: 'paid',
            lastPaymentDate: '2024-01-01',
            updatedAt: '2024-01-01',
          });
        }
      }
      if (Array.isArray(parsed.ledgerItems)) {
        const hasAugShojib = parsed.ledgerItems.some(
          (i) => i.month === 8 && i.year === 2026 && i.flatId === 'A1' && i.tenantName === 'SHOJIB'
        );
        if (!hasAugShojib) {
          const augItems = generateInitialLedger(8, 2026);
          parsed.ledgerItems = [
            ...parsed.ledgerItems.filter((i) => !(i.month === 8 && i.year === 2026)),
            ...augItems,
          ];
        }

        // Ensure A5 (Owner) row exists for every month present in ledgerItems
        const periods = Array.from(new Set(parsed.ledgerItems.map((i) => `${i.month}-${i.year}`)));
        periods.forEach((period) => {
          const [m, y] = period.split('-').map(Number);
          const hasOwnerRow = parsed.ledgerItems.some(
            (i) => (i.flatId === 'A5 (Owner)' || i.flatId === 'A5 Owner') && i.month === m && i.year === y
          );
          if (!hasOwnerRow) {
            parsed.ledgerItems.push({
              id: `led-a5-owner-${m}-${y}`,
              unitId: 'u-a5-owner',
              flatId: 'A5 (Owner)',
              blockName: 'Block A',
              blockKey: 'blockA',
              month: m,
              year: y,
              billingPeriod: `${y}-${String(m).padStart(2, '0')}`,
              tenantId: 't-a5-owner',
              tenantName: 'Md. Rashed (Owner)',
              tenantPhone: '01717623061',
              entryDate: '2024-01-01',
              advancePayment: 0,
              advanceStatus: 'N/A',
              flatRent: 0,
              rentStatus: 'N/A',
              electricityBill: 0,
              electricityStatus: 'N/A',
              parkingRent: 0,
              godownRent: 0,
              totalPayable: 0,
              totalPaid: 0,
              totalDue: 0,
              paymentStatus: 'N/A',
              adjustedFromAdvance: 0,
              notes: 'Owner residence',
            });
          }
        });

        // Ensure all tenant ledger items retain their user-configured advance deposit amount, status, and payment date
        parsed.ledgerItems = parsed.ledgerItems.map((item) => {
          const isOwner = (item.flatId || '').toLowerCase().includes('owner');
          if (isOwner) {
            return { ...item, advancePayment: 0, advanceStatus: 'N/A' };
          }

          const rawStatus = (item.advanceStatus || '').trim().toLowerCase();
          const isNotPaid = rawStatus === 'not paid' || rawStatus === 'not_paid';

          const advAcc = parsed.advanceAccounts?.find((a) => a.flatId === item.flatId);

          // Strictly preserve user input advancePayment if set (including 0)
          const resolvedAdvPayment =
            item.advancePayment !== undefined && item.advancePayment !== null
              ? Number(item.advancePayment)
              : advAcc?.amountPaid !== undefined && advAcc.amountPaid > 0
              ? advAcc.amountPaid
              : advAcc?.totalRequired !== undefined && advAcc.totalRequired > 0
              ? advAcc.totalRequired
              : 0;

          const resolvedAdvStatus =
            isNotPaid || resolvedAdvPayment === 0
              ? 'Not Paid'
              : item.advanceStatus === 'Partially Paid' || (item.advanceStatus as any) === 'partially_paid' || advAcc?.status === 'partially_paid'
              ? 'Partially Paid'
              : item.advanceStatus === 'Adjusted'
              ? 'Adjusted'
              : item.advanceStatus === 'Paid' || rawStatus === 'paid' || advAcc?.status === 'paid'
              ? 'Paid'
              : 'Paid';

          const rawRentStatus = (item.rentStatus || '').trim();
          const resolvedRentStatus =
            isOwner
              ? 'N/A'
              : rawRentStatus
              ? (rawRentStatus as any)
              : item.paymentStatus === 'Paid' || item.paymentStatus === 'Adjusted'
              ? (item.paymentStatus as any)
              : item.paymentStatus === 'Partially Paid'
              ? 'Partially Paid'
              : item.paymentStatus === 'N/A'
              ? 'N/A'
              : item.totalPaid >= item.flatRent && item.flatRent > 0
              ? 'Paid'
              : 'Not Paid';

          const resolvedRentDate =
            resolvedRentStatus === 'Paid' || resolvedRentStatus === 'Partially Paid'
              ? item.rentPaymentDate || item.lastPaymentDate || undefined
              : resolvedRentStatus === 'Adjusted'
              ? item.rentPaymentDate || item.advanceDate || item.lastPaymentDate || undefined
              : undefined;

          const isAdjustedRent =
            resolvedRentStatus === 'Adjusted' ||
            item.paymentStatus === 'Adjusted';
          const normalizedDue = isAdjustedRent
            ? calculateItemTotalDue({ ...item, rentStatus: resolvedRentStatus })
            : item.totalDue !== undefined
            ? item.totalDue
            : calculateItemTotalDue({ ...item, rentStatus: resolvedRentStatus });

          return {
            ...item,
            advancePayment: resolvedAdvPayment,
            advanceStatus: resolvedAdvStatus,
            advanceDate:
              resolvedAdvStatus === 'Paid' || resolvedAdvStatus === 'Partially Paid'
                ? item.advanceDate || advAcc?.lastPaymentDate || item.entryDate || '2024-01-01'
                : undefined,
            rentStatus: resolvedRentStatus,
            rentPaymentDate: resolvedRentDate,
            totalDue: normalizedDue,
            adjustedFromAdvance:
              isAdjustedRent && (!item.adjustedFromAdvance || item.adjustedFromAdvance <= 0)
                ? item.flatRent
                : (item.adjustedFromAdvance || 0),
          };
        });
      }

      if (Array.isArray(parsed.advanceAccounts) && Array.isArray(parsed.ledgerItems)) {
        parsed.advanceAccounts = parsed.advanceAccounts.map((acc) => ({
          ...acc,
          remainingAdvance: getEffectiveRemainingAdvance(acc, parsed.ledgerItems),
        }));
      }
    }
    if (parsed && parsed.paymentSettings) {
      parsed.paymentSettings.blockConfigs = {
        ...INITIAL_BLOCK_MFS_CONFIGS,
        ...(parsed.paymentSettings.blockConfigs || {}),
      };
      if (parsed.paymentSettings.blockConfigs['Block A']) {
        parsed.paymentSettings.blockConfigs['Block A'].ownerName = 'Md. Rashed';
        parsed.paymentSettings.blockConfigs['Block A'].ownerPhone = '01717623061';
        if (!parsed.paymentSettings.blockConfigs['Block A'].bkashNumber || parsed.paymentSettings.blockConfigs['Block A'].bkashNumber.includes('345678')) {
          parsed.paymentSettings.blockConfigs['Block A'].bkashNumber = '01717623061';
        }
        if (!parsed.paymentSettings.blockConfigs['Block A'].nagadNumber || parsed.paymentSettings.blockConfigs['Block A'].nagadNumber.includes('345678')) {
          parsed.paymentSettings.blockConfigs['Block A'].nagadNumber = '01717623061';
        }
        if (!parsed.paymentSettings.blockConfigs['Block A'].rocketNumber || parsed.paymentSettings.blockConfigs['Block A'].rocketNumber.includes('345678')) {
          parsed.paymentSettings.blockConfigs['Block A'].rocketNumber = '01717623061-0';
        }
      }
      if (parsed.paymentSettings.blockConfigs['Block B']) {
        parsed.paymentSettings.blockConfigs['Block B'].ownerName = 'Md. Raju';
        parsed.paymentSettings.blockConfigs['Block B'].ownerPhone = '01913858775';
      }
      if (parsed.paymentSettings.blockConfigs['Block C']) {
        parsed.paymentSettings.blockConfigs['Block C'].ownerName = 'Md. Rony';
        parsed.paymentSettings.blockConfigs['Block C'].ownerPhone = '01712118547';
        if (!parsed.paymentSettings.blockConfigs['Block C'].bkashNumber || parsed.paymentSettings.blockConfigs['Block C'].bkashNumber.includes('567890')) {
          parsed.paymentSettings.blockConfigs['Block C'].bkashNumber = '01712118547';
        }
        if (!parsed.paymentSettings.blockConfigs['Block C'].nagadNumber || parsed.paymentSettings.blockConfigs['Block C'].nagadNumber.includes('567890')) {
          parsed.paymentSettings.blockConfigs['Block C'].nagadNumber = '01712118547';
        }
        if (!parsed.paymentSettings.blockConfigs['Block C'].rocketNumber || parsed.paymentSettings.blockConfigs['Block C'].rocketNumber.includes('567890')) {
          parsed.paymentSettings.blockConfigs['Block C'].rocketNumber = '01712118547-0';
        }
      }
    }
    // Migrate profiles with authoritative owner and manager names and phones
    if (parsed && Array.isArray(parsed.profiles)) {
      parsed.profiles = parsed.profiles.map((p) => {
        if (p.id === 'user-owner-rashed-a' || p.assignedBlock === 'Block A') {
          return { ...p, fullName: 'Md. Rashed (Block A Owner)', phone: '01717623061' };
        }
        if (p.id === 'user-owner-raju-b' || p.assignedBlock === 'Block B') {
          return { ...p, fullName: 'Md. Raju (Block B Owner)', phone: '01913858775' };
        }
        if (p.id === 'user-owner-rony-c' || p.assignedBlock === 'Block C') {
          return { ...p, fullName: 'Md. Rony (Block C Owner)', phone: '01712118547' };
        }
        if (p.id === 'user-manager-russell' || p.role === 'manager') {
          return { ...p, phone: COMPLEX_CONFIG.managerPhone };
        }
        return p;
      });
    }
    // Migrate blocks with authoritative owner names
    if (parsed && Array.isArray(parsed.blocks)) {
      parsed.blocks = parsed.blocks.map((b) => {
        if (b.id === 'block-a' || b.name === 'Block A') return { ...b, ownerName: 'Md. Rashed' };
        if (b.id === 'block-b' || b.name === 'Block B') return { ...b, ownerName: 'Md. Raju' };
        if (b.id === 'block-c' || b.name === 'Block C') return { ...b, ownerName: 'Md. Rony' };
        return b;
      });
    }
    // Update tariffConfig to latest 2026 NESCO rates if missing, incomplete, or using legacy rates
    if (parsed) {
      if (!isTariffUpToDate(parsed.tariffConfig)) {
        parsed.tariffConfig = upgradeTariffConfig(parsed.tariffConfig);
      }
    }
    // Normalize security credentials
    if (parsed) {
      let secCreds: SecurityCredentials = {
        ...DEFAULT_SECURITY_CREDENTIALS,
        ...(parsed.securityCredentials || {}),
        authorityPasswords: {
          ...DEFAULT_SECURITY_CREDENTIALS.authorityPasswords,
          ...(parsed.securityCredentials?.authorityPasswords || {}),
        },
        unitPasswords: {
          ...(parsed.securityCredentials?.unitPasswords || {}),
        },
      };

      try {
        const dedicatedRaw = localStorage.getItem('mbd_security_credentials');
        if (dedicatedRaw) {
          const dedicated = JSON.parse(dedicatedRaw);
          if (dedicated) {
            secCreds = {
              ...secCreds,
              ...dedicated,
              authorityPasswords: {
                ...secCreds.authorityPasswords,
                ...(dedicated.authorityPasswords || {}),
              },
              unitPasswords: {
                ...secCreds.unitPasswords,
                ...(dedicated.unitPasswords || {}),
              },
            };
          }
        }
      } catch (e) {}

      parsed.securityCredentials = secCreds;
    }
    if (parsed) {
      parsed = syncTenantsWithCurrentLedger(parsed);
    }
    return parsed;
  } catch (e) {
    console.error('Error loading database state from storage:', e);
    return getInitialDatabaseState();
  }
}

export function saveDatabaseState(state: AppDatabaseState): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (state.securityCredentials) {
        localStorage.setItem('mbd_security_credentials', JSON.stringify(state.securityCredentials));
      }
    } catch (e) {
      console.error('Failed to save database state to localStorage:', e);
    }
    // Asynchronously persist to server database file
    saveDatabaseToServer(state).catch((err) => {
      console.warn('Failed background save to server:', err);
    });
  }
}

export async function fetchDatabaseFromServer(): Promise<AppDatabaseState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/database');
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return null;
    const json = await res.json();
    if (json && json.success && json.data) {
      let serverData = json.data as AppDatabaseState;
      // Auto-upgrade tariff configuration if outdated on server
      if (!isTariffUpToDate(serverData.tariffConfig)) {
        serverData.tariffConfig = upgradeTariffConfig(serverData.tariffConfig);
        saveDatabaseToServer(serverData).catch((err) => console.warn('Could not sync upgraded tariff to server:', err));
      }
      // Sync tenants with current active ledger period
      serverData = syncTenantsWithCurrentLedger(serverData);
      // Sync local storage with latest server database
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
      } catch (e) {}
      return serverData;
    }
  } catch (err) {
    console.warn('Could not fetch database from server, using local cache:', err);
  }
  return null;
}

export async function saveDatabaseToServer(state: AppDatabaseState): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const res = await fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type');
    return Boolean(contentType && contentType.includes('application/json'));
  } catch (err) {
    console.warn('Could not save database to server:', err);
    return false;
  }
}

export function resetDatabaseToDefault(): AppDatabaseState {
  const defaultState = getInitialDatabaseState();
  saveDatabaseState(defaultState);
  return defaultState;
}

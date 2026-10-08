export type UserRole = 'manager' | 'owner' | 'tenant';

export type PaymentStatus = 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';

export type ElectricityBillingType = 'nesco_submeter' | 'fixed' | 'none';

export type UnitType = 'residential' | 'parking' | 'godown' | 'commercial' | 'other';

export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Rocket' | 'Bank Transfer' | 'Advance Adjustment';

export type ComplaintCategory = 'Water' | 'Electricity' | 'Plumbing' | 'Lift' | 'Security' | 'Cleaning' | 'Other';

export type ComplaintStatus = 'Submitted' | 'In Progress' | 'Resolved' | 'Rejected';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  assignedBlock?: 'Block A' | 'Block B' | 'Block C';
  flatId?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Block {
  id: string;
  name: 'Block A' | 'Block B' | 'Block C';
  ownerId: string;
  ownerName: string;
  totalFloors: number;
  totalUnits: number;
  description?: string;
}

export interface Unit {
  id: string;
  flatId: string; // e.g. "A1", "A5 Owner", "A5 Sublet", "B2", "P1", "G1"
  blockId: string;
  blockName: 'Block A' | 'Block B' | 'Block C';
  floor: number;
  unitType: UnitType;
  monthlyRent: number;
  tenantId?: string;
  isOccupied: boolean;
  electricityBillingType: ElectricityBillingType;
  isElectricityEnabled?: boolean;
  fixedElectricityAmount?: number;
  parkingSlot?: string;
  godownSlot?: string;
  meterPreviousReading?: number;
  meterCurrentReading?: number;
  notes?: string;
}

export interface Tenant {
  id: string;
  unitId: string;
  flatId: string;
  blockName: 'Block A' | 'Block B' | 'Block C';
  fullName: string;
  phone: string;
  nidNumber: string;
  email?: string;
  entryDate: string; // YYYY-MM-DD
  emergencyContact: string;
  status: 'active' | 'moved_out';
  notes?: string;
}

export interface AdvanceAccount {
  id: string;
  tenantId: string;
  unitId: string;
  flatId: string;
  totalRequired: number;
  amountPaid: number;
  remainingAdvance: number;
  status: 'paid' | 'not_paid' | 'partially_paid';
  lastPaymentDate?: string;
  notes?: string;
  updatedAt: string;
}

export interface AdvanceTransaction {
  id: string;
  advanceAccountId: string;
  tenantId: string;
  tenantName: string;
  flatId: string;
  amount: number;
  type: 'deposit' | 'adjustment_deduction' | 'refund';
  paymentDate: string;
  paymentMethod: PaymentMethod;
  receiptNo: string;
  transactionId?: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface MonthlyLedgerItem {
  id: string;
  unitId: string;
  flatId: string;
  blockName: 'Block A' | 'Block B' | 'Block C';
  blockKey?: string; // 'blockA' | 'blockB' | 'blockC'
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  entryDate: string;
  billingPeriod?: string; // Strict YYYY-MM format, e.g., '2026-10'
  month: number; // 1-12
  year: number;
  advancePayment: number;
  flatRent: number;
  electricityBill: number;
  parkingRent: number;
  godownRent: number;
  totalPayable: number;
  totalPaid: number;
  totalDue: number;
  paymentStatus: PaymentStatus;
  adjustedFromAdvance: number;
  advanceStatus?: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  advanceDate?: string;
  rentPaymentDate?: string;
  rentStatus?: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  electricityStatus?: 'Paid' | 'Not Paid' | 'Partially Paid' | 'Adjusted' | 'N/A';
  electricityDate?: string;
  notes?: string;
  lastPaymentDate?: string;
}

export interface MeterReading {
  id: string;
  unitId: string;
  flatId: string;
  month: number; // Consumption month (e.g. 9 for September)
  year: number;
  previousReading: number;
  currentReading: number;
  consumedUnits: number;
  readingDate: string;
  recordedBy: string;
}

export interface TariffSlab {
  minUnits: number;
  maxUnits: number | null; // null for infinite
  ratePerUnit: number;
  slabName: string;
}

export interface NescoTariffConfig {
  id: string;
  title: string;
  effectiveFrom: string;
  slabs: TariffSlab[];
  demandChargePerKW: number;
  vatPercentage: number;
  meterRent: number;
  rebatePercentage: number;
  isActive: boolean;
}

export interface SlabBreakdownItem {
  slabName: string;
  units: number;
  rate: number;
  amount: number;
}

export interface ElectricityBill {
  id: string;
  unitId: string;
  flatId: string;
  tenantId: string;
  tenantName: string;
  consumptionMonth: number; // e.g. 9 = Sep
  consumptionYear: number;
  billingMonth: number; // e.g. 10 = Oct (postpaid collection ledger)
  billingYear: number;
  previousReading: number;
  currentReading: number;
  consumedUnits: number;
  slabBreakdown: SlabBreakdownItem[];
  baseEnergyCost: number;
  demandCharge: number;
  vatAmount: number;
  meterRent: number;
  rebateAmount: number;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: PaymentStatus;
  generatedDate: string;
  receiptNo?: string;
  tariffSnapshotTitle: string;
  sanctionedLoadKW?: number;
}

export interface PaymentTransaction {
  id: string;
  receiptNo: string;
  tenantId: string;
  tenantName: string;
  flatId: string;
  category: 'Flat Rent' | 'Electricity' | 'Advance Payment' | 'Advance' | 'Parking' | 'Godown' | 'Combined';
  month: number;
  year: number;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  paymentDate: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface PrintableReceipt {
  receiptNumber: string;
  type: 'advance' | 'rent' | 'electricity' | 'combined' | 'adjustment';
  tenantName: string;
  tenantPhone: string;
  flatId: string;
  blockName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  purpose: string;
  monthName?: string;
  year?: number;
  remainingDue?: number;
  remainingAdvance?: number;
  authorizedSignatureBy: string;
  authorizedSignatureRole?: 'manager' | 'owner' | 'tenant';
  signatureTitle?: string;
  breakdown?: {
    label: string;
    amount: number;
  }[];
  notes?: string;
}

export interface ComplaintMessage {
  id: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  timestamp: string;
}

export interface Complaint {
  id: string;
  tenantId: string;
  tenantName: string;
  flatId: string;
  blockName: 'Block A' | 'Block B' | 'Block C';
  category: ComplaintCategory;
  subject: string;
  description: string;
  imageUrl?: string;
  submissionDate: string;
  status: ComplaintStatus;
  assignedTo?: string;
  messages: ComplaintMessage[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  flatId?: string;
  tenantId?: string;
}

export interface BlockMfsConfig {
  blockName: 'Block A' | 'Block B' | 'Block C';
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  isMfsEnabled: boolean; // Toggle ON/OFF to receive online MFS payment for this block
  mfsFeePercentage: number; // default 1.8% cashout fee added to payment
  bkashNumber: string;
  bkashType: 'Personal' | 'Merchant';
  nagadNumber: string;
  nagadType: 'Personal' | 'Merchant';
  rocketNumber: string;
  rocketType: 'Personal' | 'Merchant';
  instructions?: string;
  isBankDepositAllowed?: boolean; // Block owner permission to show Direct Bank Deposit to tenants
}

export interface OnlinePaymentRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  flatId: string;
  blockName?: 'Block A' | 'Block B' | 'Block C';
  month: number;
  year: number;
  category: string;
  baseAmount?: number;
  feeAmount?: number;
  amount: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket';
  recipientNumber?: string;
  recipientOwnerName?: string;
  transactionId: string;
  submissionDate: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedBy?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  performedBy: string;
  userRole: string;
  details: string;
  timestamp: string;
}

export interface PaymentSettings {
  bkashEnabled: boolean;
  bkashNumber: string;
  nagadEnabled: boolean;
  nagadNumber: string;
  rocketEnabled: boolean;
  rocketNumber: string;
  bankEnabled: boolean;
  bankName: string;
  bankAccountNo: string;
  bankRouting: string;
  blockConfigs: Record<'Block A' | 'Block B' | 'Block C', BlockMfsConfig>;
}

export interface AuthorityPasswords {
  manager: string; // Russell (Manager)
  ownerA: string;  // Rashed (Block A Owner)
  ownerB: string;  // Raju (Block B Owner)
  ownerC: string;  // Rony (Block C Owner)
}

export interface SecurityCredentials {
  isManagerPasswordInitialized: boolean;
  authorityPasswords: AuthorityPasswords;
  unitPasswords: Record<string, string>; // flatId -> custom password override
}

export interface AppDatabaseState {
  profiles: UserProfile[];
  blocks: Block[];
  units: Unit[];
  tenants: Tenant[];
  advanceAccounts: AdvanceAccount[];
  advanceTransactions: AdvanceTransaction[];
  ledgerItems: MonthlyLedgerItem[];
  meterReadings: MeterReading[];
  electricityBills: ElectricityBill[];
  payments: PaymentTransaction[];
  complaints: Complaint[];
  chatMessages: ChatMessage[];
  onlineRequests: OnlinePaymentRequest[];
  paymentSettings: PaymentSettings;
  tariffConfig: NescoTariffConfig;
  auditLogs: AuditLog[];
  selectedMonth: number;
  selectedYear: number;
  securityCredentials?: SecurityCredentials;
}


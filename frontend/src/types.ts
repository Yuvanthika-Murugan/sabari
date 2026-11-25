export type Role = 'md' | 'admin' | 'manager' | 'staff';

export interface User {
  id: string;
  empId: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  branchId: string;
  address: string;
  status: 'active' | 'inactive';
  joiningDate: string;
  monthlyTarget: number;
  monthlySalary: number;
  photo: string | null;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  managerId: string;
  openingDate: string;
  status: 'active' | 'inactive';
}

export interface Customer {
  id: string;
  customerId: string;
  name: string;
  fatherSpouseName: string;
  mobile: string;
  altMobile: string;
  address: string;
  area: string;
  branchId: string;
  staffId: string;
  agentId: string;
  groupId: string;
  joiningDate: string;
  /** Shown status: an active customer whose oldest unpaid due is overdue past the grace period shows as inactive. */
  status: 'active' | 'inactive' | 'closed';
  /** The status saved on the record (what the Edit form changes). */
  savedStatus: 'active' | 'inactive' | 'closed';
  /** Inactive only because of unpaid dues (5 days daily, 10 weekly, 15 monthly); paying makes them active again. */
  autoInactive: boolean;
  /** Days since the oldest unpaid due's due date (0 if nothing is overdue). */
  daysUnpaid: number;
  photo: string | null;
  repName: string;
  panNo: string;
  dob: string;
  phone: string;
  email: string;
  district: string;
  pincode: string;
  permanentAddress: boolean;
  agentType: 'single' | 'multi';
  nomineeName: string;
  nomineeRelation: string;
  nomineeMobile: string;
  nomineeAge: string;
  intimationType: 'post' | 'hand' | 'courier';
  intimationCard: boolean;
  collectionType: Frequency;
  firstDueCompleted: boolean;
  totalDue: number;
  paid: number;
  pending: number;
}

export interface Area {
  id: string;
  code: string;
  name: string;
  branchId: string;
  staffId: string;
  pincode: string;
  status: 'active' | 'inactive';
}

export interface Agent {
  id: string;
  agentCode: string;
  name: string;
  mobile: string;
  address: string;
  branchId: string;
  commissionPct: number;
  joiningDate: string;
  status: 'active' | 'inactive';
}

export interface Auction {
  id: string;
  auctionCode: string;
  groupId: string;
  groupName: string;
  groupValue: number;
  auctionNo: number;
  auctionDate: string;
  customerId: string;
  customerName: string;
  bidAmount: number;
  commissionAmount: number;
  dividendAmount: number;
  dividendPerMember: number;
  prizeAmount: number;
  payoutStatus: 'pending' | 'paid';
  payoutMode: '' | 'cash' | 'bank_transfer' | 'cheque';
  bankAccountId: string;
  payoutReference: string;
  paidDate: string;
  remarks: string;
}

export interface Group {
  id: string;
  groupCode: string;
  groupName: string;
  branchId: string;
  duration: number;
  groupValue: number;
  numberOfMembers: number;
  startDate: string;
  endDate: string;
  frequency: Frequency;
  status: 'active' | 'inactive' | 'completed';
  collected: number;
  pending: number;
  groupCodeId: string;
  series: string;
  psoNumber: string;
  psoDate: string;
  agreementNo: string;
  agreementDate: string;
  admissionFee: number;
  serviceTax: number;
  auctionTimeFrom: string;
  auctionTimeTo: string;
  auctionBy: 'day' | 'week';
  auctionByValue: string;
  companyType: string;
  companyTicketNo: string;
  companyAuctionNo: string;
  companyCommPct: number;
  authorized: boolean;
  fdrDetails: boolean;
}

/** Installment / auction frequency of a group. */
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'bimonthly';

/** Group series master ("Chit Group Code") that groups are created from. */
export interface GroupCode {
  id: string;
  series: string;
  groupValue: number;
  members: number;
  admissionFee: number;
  auctionDay: string;
  companyCommPct: number;
  status: 'active' | 'inactive';
  groupCount: number;
}

export interface DueSchedule {
  id: string;
  customerId: string;
  groupId: string;
  dueNumber: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentDate: string | null;
  status: 'upcoming' | 'due_today' | 'partially_paid' | 'paid' | 'overdue';
  receiptNo: string;
}

export interface Collection {
  id: string;
  receiptNo: string;
  receiptType: 'chit' | 'arrear';
  customerId: string;
  customerName: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  staffId: string;
  staffName: string;
  dueNumber: number;
  dueAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  referenceNo: string;
  date: string;
  time: string;
  remarks: string;
  /** "rejected" means the receipt was cancelled; those are listed in AppData.cancelledReceipts. */
  status: 'completed' | 'pending' | 'rejected';
  cancelReason: string;
  cancelledBy: string;
  cancelledAt: string;
}

export interface PaymentApproval {
  id: string;
  paymentId: string;
  paymentType: 'customer' | 'expense' | 'salary';
  customerId: string;
  customerName: string;
  /** Salary payments: the employee paid and the month (YYYY-MM) it is for. */
  employeeId: string;
  salaryMonth: string;
  amount: number;
  paymentMode: string;
  referenceNo: string;
  staffId: string;
  staffName: string;
  branchId: string;
  branchName: string;
  submittedTime: string;
  currentStage: 'payment_informed' | 'manager_accepted' | 'md_approved' | 'completed' | 'rejected' | 'sent_back';
  submittedBy: string;
  managerId: string | null;
  managerName: string | null;
  managerActionTime: string | null;
  mdId: string | null;
  mdName: string | null;
  mdActionTime: string | null;
  remarks: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  ifsc: string;
  openingBalance: number;
  currentBalance: number;
  status: 'active' | 'inactive';
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  transactionId: string;
  description: string;
  credit: number;
  debit: number;
  balance: number;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'collection';
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  date: string;
  voucherType: 'payment' | 'receipt' | 'expense' | 'contra';
  account: string;
  amount: number;
  paymentMode: string;
  narration: string;
  createdBy: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export interface Withdrawal {
  id: string;
  withdrawalId: string;
  date: string;
  account: string;
  accountId: string;
  amount: number;
  mode: string;
  reference: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Notification {
  id: string;
  type: 'due_today' | 'overdue' | 'payment_submitted' | 'manager_approval' | 'md_approval' | 'payment_approved' | 'payment_rejected' | 'transfer' | 'day_end';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  user: string;
  role: string;
  action: string;
  module: string;
  recordId: string;
  oldValue: string;
  newValue: string;
  date: string;
  time: string;
}

export interface DayEndClosing {
  id: string;
  date: string;
  openingCash: number;
  cashCollection: number;
  otherCashReceipt: number;
  expenses: number;
  withdrawals: number;
  expectedClosingCash: number;
  physicalCash: number;
  difference: number;
  bankCredits: number;
  bankDebits: number;
  upiCollection: number;
  totalCollection: number;
  pendingApprovals: number;
  rejectedTransactions: number;
  status: 'open' | 'closed';
  closedBy: string | null;
  closedTime: string | null;
  remarks: string;
}

export interface CustomerTransfer {
  id: string;
  customerId: string;
  customerName: string;
  fromGroupId: string;
  toGroupId: string;
  fromStaffId: string;
  toStaffId: string;
  fromBranchId: string;
  toBranchId: string;
  date: string;
  reason: string;
}

export interface CashTransaction {
  id: string;
  date: string;
  voucherReceipt: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'opening' | 'collection' | 'receipt' | 'payment' | 'expense' | 'withdrawal';
}

export interface DashboardData {
  stats: {
    todayCollection: number;
    todayChange: number | null;
    thisMonthCollection: number;
    monthChange: number | null;
    totalCollection: number;
    todayPending: number;
    totalPending: number;
    cashBalance: number;
    bankBalance: number;
    approvalsPending: number;
  };
  dailyTrend: { day: string; collection: number; pending: number }[];
  monthlyTrend: { month: string; collection: number; pending: number }[];
  branchPerformance: { branch: string; collection: number; pending: number }[];
  staffPerformance: { staff: string; collected: number; target: number }[];
}

export interface CompanySettings {
  companyName: string;
  gstNumber: string;
  currency: string;
  fyStart: string;
  companyAddress: string;
  /** Company UPI ID and payee name, used for the payment QR on the staff collection screen. */
  upiId: string;
  upiPayeeName: string;
}

/** Percentages applied to auctions and agent commission. */
export interface CommissionSettings {
  foremanCommissionPct: number;
  maxBidPct: number;
  agentCommissionPct: number;
}

/** Payload of GET /api/bootstrap. */
export interface AppData {
  users: User[];
  branches: Branch[];
  groups: Group[];
  groupCodes: GroupCode[];
  areas: Area[];
  agents: Agent[];
  customers: Customer[];
  dueSchedules: DueSchedule[];
  customerTransfers: CustomerTransfer[];
  collections: Collection[];
  cancelledReceipts: Collection[];
  auctions: Auction[];
  paymentApprovals: PaymentApproval[];
  vouchers: Voucher[];
  withdrawals: Withdrawal[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  cashTransactions: CashTransaction[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  dayEndClosings: DayEndClosing[];
  dashboard: DashboardData;
  settings: CompanySettings;
  commission: CommissionSettings;
  today: string;
}

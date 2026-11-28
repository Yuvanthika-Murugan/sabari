import { useState, type ReactNode } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import KPICard from '@/components/KPICard';
import Badge from '@/components/Badge';
import { Input, Select, TextArea, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange, formatCurrency } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import type { Auction, BidPayment } from '@/types';
import BidDocumentFiles from '@/components/BidDocumentFiles';
import { Gavel, Trophy, Wallet, BadgePercent, Banknote, AlertTriangle, Plus, CreditCard, CheckCircle2, XCircle, FileCheck2, Undo2, FileText } from 'lucide-react';

const blankAuction = { groupId: '', auctionNo: '', auctionDate: '', customerId: '', prizeAmount: '', remarks: '' };
const blankPayout = { payoutMode: 'cash', bankAccountId: '', payoutReference: '', paidDate: '' };

type Status = BidPayment['status'];
type Tab = 'apply' | 'verify' | 'approval' | 'document' | 'docVerify' | 'payment' | 'reports' | 'register';
type StepAction = 'verify' | 'approve' | 'document' | 'docVerify' | 'return' | 'reject';

const STATUS: Record<Status, { label: string; variant: 'warning' | 'blue' | 'success' | 'danger' | 'primary' | 'gold' }> = {
  applied: { label: 'Applied', variant: 'warning' },
  verified: { label: 'Verified', variant: 'blue' },
  approved: { label: 'MD Approved', variant: 'blue' },
  documented: { label: 'Docs Submitted', variant: 'gold' },
  doc_verified: { label: 'Docs Verified', variant: 'primary' },
  paid: { label: 'Paid', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};
/** The step tabs: which status waits at each one. */
const STAGES: { tab: Exclude<Tab, 'apply' | 'reports' | 'register'>; label: string; status: Status; hint: string }[] = [
  { tab: 'verify', label: 'Verify', status: 'applied', hint: 'Applied requests — the manager / admin checks the winner and the amount' },
  { tab: 'approval', label: 'Approval', status: 'verified', hint: 'Verified requests waiting for MD approval' },
  { tab: 'document', label: 'Document', status: 'approved', hint: 'Approved by the MD — collect the surety documents from the winner' },
  { tab: 'docVerify', label: 'Doc Verify', status: 'documented', hint: 'Documents collected — waiting for the MD to verify them' },
  { tab: 'payment', label: 'Payment Entry', status: 'doc_verified', hint: 'Documents verified — pay the winner by cash, bank transfer or cheque' },
];
const MODE_LABEL: Record<string, string> = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' };
const STEP_TITLE: Record<StepAction, string> = {
  verify: 'Verify Bid Payment', approve: 'Approve Bid Payment (MD)', document: 'Upload Documents',
  docVerify: 'Verify Documents (MD)', return: 'Send Documents Back', reject: 'Reject Bid Payment',
};
const lakh = (v: number) => (v / 100_000).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Bid Payments: the prize payment to an auction winner, moved through
 * Apply -> Verify -> Approval (MD) -> Document -> Document Verify (MD) -> Payment Entry.
 * Direct Payment pays a winner without the steps. Reports lists every request;
 * Bid Register is the list of bids (auctions) recorded with "New Bid".
 */
/** panel="superadmin": the Super Admin (MD) panel — only the MD steps (Approval, Doc Verify) and Reports. */
export default function Auctions({ panel }: { panel?: 'superadmin' } = {}) {
  const sa = panel === 'superadmin';
  const { auctions, bidPayments, groups, customers, branches, dueSchedules, bankAccounts, cashTransactions, commission, today } = useData();
  const { currentUser } = useApp();
  const role = currentUser?.role ?? 'staff';
  const isMd = role === 'md';
  const office = role !== 'staff';
  const canPay = isMd || role === 'admin';
  const [tab, setTab] = useState<Tab>(panel === 'superadmin' ? 'approval' : 'apply');
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState<{ auction?: Auction; request?: BidPayment } | null>(null);
  const [applying, setApplying] = useState(false);
  const [stepping, setStepping] = useState<{ p: BidPayment; action: StepAction } | null>(null);
  // Report filters
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(today);
  const form = useForm(blankAuction);
  const payout = useForm({ ...blankPayout, auctionId: '' });
  const apply = useForm({ auctionId: '', note: '' });
  const step = useForm({ note: '' });

  const cashInHand = cashTransactions.length ? cashTransactions[cashTransactions.length - 1].balance : 0;
  const pendingPayout = auctions.filter(a => a.payoutStatus === 'pending').reduce((s, a) => s + a.prizeAmount, 0);
  const commissionEarned = auctions.reduce((s, a) => s + a.commissionAmount, 0);
  const dividends = auctions.reduce((s, a) => s + a.dividendAmount, 0);

  // Winners whose prize is unpaid and who have no request in progress: ready to apply.
  const openAuctionIds = new Set(bidPayments.filter(p => p.status !== 'rejected').map(p => p.auctionId));
  const toApply = auctions.filter(a => a.payoutStatus === 'pending' && !openAuctionIds.has(a.id));
  const unpaid = auctions.filter(a => a.payoutStatus === 'pending');
  const atStage = (st: Status) => bidPayments.filter(p => p.status === st);

  // Live preview of the bid being entered
  const group = groups.find(g => g.id === form.values.groupId);
  const held = auctions.filter(a => a.groupId === form.values.groupId);
  const winners = new Set(held.map(a => a.customerId));
  const members = customers.filter(c => c.groupId === form.values.groupId && c.status !== 'closed');
  const bidders = members.filter(c => c.status === 'active' && !winners.has(c.id));
  // The office enters the prize the winner takes; the bid (discount) is worked out from it.
  const commissionAmt = group ? group.groupValue * commission.foremanCommissionPct / 100 : 0;
  const maxBid = group ? group.groupValue * commission.maxBidPct / 100 : 0;
  const prize = Number(form.values.prizeAmount) || 0;
  const bid = group && prize ? group.groupValue - prize : 0;
  const minPrize = group ? group.groupValue - maxBid : 0;
  const maxPrize = group ? group.groupValue - commissionAmt : 0;
  const prizeError = prize && group && (prize < minPrize || prize > maxPrize) ? `Prize must be between ${formatCurrency(minPrize)} and ${formatCurrency(maxPrize)}` : '';
  const dividend = Math.max(0, bid - commissionAmt);
  const winner = customers.find(c => c.id === form.values.customerId);
  const arrearsOf = (customerId: string) => dueSchedules.filter(d => d.customerId === customerId && d.pendingAmount > 0 && d.dueDate < today).reduce((s, d) => s + d.pendingAmount, 0);
  const winnerArrears = arrearsOf(form.values.customerId);

  const pickGroup = (groupId: string) => {
    const next = Math.max(0, ...auctions.filter(a => a.groupId === groupId).map(a => a.auctionNo)) + 1;
    form.set('groupId', groupId);
    form.set('auctionNo', groupId ? String(next) : '');
    form.set('customerId', '');
  };
  const openForm = () => { form.reset({ ...blankAuction, auctionDate: today }); setShowForm(true); };
  const save = async () => {
    if (await form.submit(v => api.post('/auctions', { groupId: v.groupId, auctionNo: v.auctionNo, auctionDate: v.auctionDate, customerId: v.customerId, remarks: v.remarks, bidAmount: bid }), 'Bid recorded and dividend applied to members\' dues')) setShowForm(false);
  };

  const openApply = (a?: Auction) => { apply.reset({ auctionId: a?.id ?? '', note: '' }); setApplying(true); };
  const saveApply = async () => {
    if (await apply.submit(v => api.post('/bid-payments', v), 'Bid payment applied — waiting for verification')) { setApplying(false); setTab('verify'); }
  };

  const openStep = (p: BidPayment, action: StepAction) => { step.reset({ note: '' }); setStepping({ p, action }); };
  // The request as it is now (refreshed after each upload).
  const live = stepping ? bidPayments.find(x => x.id === stepping.p.id) : undefined;
  const saveStep = async () => {
    if (!stepping) return;
    const { p, action } = stepping;
    const done: Record<StepAction, string> = {
      verify: `${p.requestNo} verified — sent to MD for approval`, approve: `${p.requestNo} approved — collect the documents`,
      document: `${p.requestNo} documents submitted — sent to MD`, docVerify: `${p.requestNo} documents verified — ready to pay`,
      return: `${p.requestNo} sent back for documents`, reject: `${p.requestNo} rejected`,
    };
    if (await step.submit(v => api.post(`/bid-payments/${p.id}/step`, { action, note: v.note }), done[action])) setStepping(null);
  };

  const openPay = (target: { auction?: Auction; request?: BidPayment }) => { payout.reset({ ...blankPayout, paidDate: today, auctionId: target.auction?.id ?? '' }); setPaying(target); };
  const payAuction = paying?.request ? auctions.find(a => a.id === paying.request!.auctionId) : paying?.auction ?? auctions.find(a => a.id === payout.values.auctionId);
  const pay = async () => {
    if (!paying) return;
    const { auctionId, ...v } = payout.values;
    const url = paying.request ? `/bid-payments/${paying.request.id}/pay` : `/auctions/${auctionId}/pay`;
    if (!paying.request && !auctionId) return;
    if (await payout.submit(() => api.post(url, v), paying.request ? `${paying.request.requestNo} paid` : 'Prize paid (direct payment)')) setPaying(null);
  };

  // ----- shared cells -----
  const customerCell = (name: string, code: string, mobile?: string) => (
    <div><p className="text-sm font-medium text-gray-900">{name}</p><p className="text-[11px] text-gray-500">{code}{mobile ? ` · ${mobile}` : ''}</p></div>
  );
  const money = (v: number, cls = '') => <span className={`tabular-nums whitespace-nowrap ${cls}`}>{formatCurrency(v)}</span>;
  const history = (p: BidPayment) => {
    const lines: [string, string, string][] = [
      ['Applied', p.appliedBy, p.appliedAt], ['Verified', p.verifiedBy, p.verifiedAt], ['MD approved', p.approvedBy, p.approvedAt],
      ['Docs', p.documentedBy, p.documentedAt], ['Docs verified', p.docVerifiedBy, p.docVerifiedAt],
    ];
    return (
      <div className="text-[11px] text-gray-500 space-y-0.5 max-w-[240px]">
        {lines.filter(l => l[2]).map(([k, by, at]) => <p key={k}>{k}: {by} · {at}</p>)}
        {p.files.length > 0 && <p className="text-gray-700">📄 {p.files.length} file{p.files.length === 1 ? '' : 's'} · {[...new Set(p.files.map(f => f.document))].join(', ')}</p>}
        {p.documentNote && <p className="italic">“{p.documentNote}”</p>}
        {p.applyNote && p.type === 'request' && <p className="italic">“{p.applyNote}”</p>}
        {p.status === 'rejected' && <p className="text-danger-700">Rejected at {STATUS[p.rejectedStage as Status]?.label ?? p.rejectedStage} by {p.rejectedBy}: {p.rejectNote}</p>}
        {p.status === 'paid' && <p className="text-success-700">Paid {p.paidDate} · {MODE_LABEL[p.payoutMode] ?? p.payoutMode}{p.payoutReference ? ` · ${p.payoutReference}` : ''}{p.paidBy ? ` · by ${p.paidBy}` : ''}</p>}
      </div>
    );
  };
  const btn = (label: string, icon: ReactNode, onClick: () => void, kind: 'primary' | 'success' | 'danger' | 'ghost' = 'primary') => {
    const cls = { primary: 'bg-primary-600 text-white hover:bg-primary-700', success: 'bg-success-600 text-white hover:bg-success-700',
      danger: 'border border-danger-200 text-danger-700 hover:bg-danger-50', ghost: 'border border-gray-200 text-gray-700 hover:bg-gray-50' }[kind];
    return <button key={label} onClick={onClick} className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${cls}`}>{icon} {label}</button>;
  };
  const waiting = (who: string) => <span className="text-[11px] text-gray-400 whitespace-nowrap">Waiting for {who}</span>;

  const actionsFor = (p: BidPayment) => {
    const reject = btn('Reject', <XCircle className="w-3.5 h-3.5" />, () => openStep(p, 'reject'), 'danger');
    switch (p.status) {
      case 'applied': return office ? <div className="flex gap-2">{btn('Verify', <CheckCircle2 className="w-3.5 h-3.5" />, () => openStep(p, 'verify'), 'success')}{reject}</div> : waiting('verification');
      case 'verified': return isMd ? <div className="flex gap-2">{btn('Approve', <CheckCircle2 className="w-3.5 h-3.5" />, () => openStep(p, 'approve'), 'success')}{reject}</div> : waiting('MD approval');
      case 'approved': return office ? <div className="flex gap-2">{btn('Add documents', <FileText className="w-3.5 h-3.5" />, () => openStep(p, 'document'))}{isMd && reject}</div> : waiting('documents');
      case 'documented': return isMd ? <div className="flex gap-2">{btn('Verify docs', <FileCheck2 className="w-3.5 h-3.5" />, () => openStep(p, 'docVerify'), 'success')}{btn('Send back', <Undo2 className="w-3.5 h-3.5" />, () => openStep(p, 'return'), 'ghost')}</div> : waiting('MD to verify documents');
      case 'doc_verified': return canPay ? <div className="flex gap-2">{btn('Pay', <Banknote className="w-3.5 h-3.5" />, () => openPay({ request: p }), 'success')}{isMd && reject}</div> : waiting('admin payment');
      default: return null;
    }
  };

  // ----- tables -----
  const withSno = <T,>(xs: T[]) => xs.map((x, i) => ({ ...x, sno: i + 1 }));
  type Row = BidPayment & { sno: number };
  const requestColumns = [
    { key: 'sno', label: 'S.No', render: (p: Row) => <span className="text-xs text-gray-500">{p.sno}</span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (p: Row) => customerCell(p.customerName, p.customerCode, p.mobile) },
    { key: 'requestNo', label: 'Req No', sortable: true, render: (p: Row) => <span className="font-mono text-xs text-primary-600">{p.requestNo}</span> },
    { key: 'appliedAt', label: 'Applied', sortable: true, render: (p: Row) => <span className="text-xs whitespace-nowrap">{p.appliedAt.slice(0, 10)}</span> },
    { key: 'groupName', label: 'Group', sortable: true, render: (p: Row) => <span className="text-sm">{p.groupName}</span> },
    { key: 'groupValue', label: 'Lakh', render: (p: Row) => lakh(p.groupValue) },
    { key: 'auctionNo', label: 'Auction No', render: (p: Row) => <span>{p.auctionNo}</span> },
    { key: 'auctionAmount', label: 'Auction Amt', render: (p: Row) => money(p.auctionAmount) },
    { key: 'commissionAmount', label: 'Commission', render: (p: Row) => money(p.commissionAmount) },
    { key: 'toPay', label: 'To Pay', sortable: true, render: (p: Row) => money(p.toPay, 'font-bold text-success-700') },
    { key: 'history', label: 'Details', className: 'print:hidden', render: (p: Row) => history(p) },
    { key: 'actions', label: '', render: (p: Row) => actionsFor(p) },
  ];

  type ApplyRow = Auction & { sno: number };
  const applyColumns = [
    { key: 'sno', label: 'S.No', render: (a: ApplyRow) => <span className="text-xs text-gray-500">{a.sno}</span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (a: ApplyRow) => customerCell(a.customerName, customers.find(c => c.id === a.customerId)?.customerId ?? '') },
    { key: 'auctionCode', label: 'Bid No', render: (a: ApplyRow) => <span className="font-mono text-xs text-primary-600">{a.auctionCode}</span> },
    { key: 'auctionDate', label: 'Bid Date', sortable: true },
    { key: 'groupName', label: 'Group', sortable: true },
    { key: 'groupValue', label: 'Lakh', render: (a: ApplyRow) => lakh(a.groupValue) },
    { key: 'auctionNo', label: 'Auction No' },
    { key: 'auctionAmt', label: 'Auction Amt', render: (a: ApplyRow) => money(a.groupValue - a.dividendAmount) },
    { key: 'commissionAmount', label: 'Commission', render: (a: ApplyRow) => money(a.commissionAmount) },
    { key: 'prizeAmount', label: 'To Pay', render: (a: ApplyRow) => money(a.prizeAmount, 'font-bold text-success-700') },
    { key: 'arrears', label: 'Arrears', render: (a: ApplyRow) => { const ar = arrearsOf(a.customerId); return ar > 0 ? <Badge variant="danger">{formatCurrency(ar)}</Badge> : <span className="text-xs text-gray-400">Nil</span>; } },
    { key: 'actions', label: '', render: (a: ApplyRow) => office ? btn('Apply', <Plus className="w-3.5 h-3.5" />, () => openApply(a)) : null },
  ];

  const reportRows = withSno(bidPayments.filter(p =>
    (!branchFilter || p.branchId === branchFilter) && (!groupFilter || p.groupId === groupFilter) && (!statusFilter || p.status === statusFilter)
    && (!modeFilter || p.payoutMode === modeFilter) && inDateRange(p.appliedAt.slice(0, 10), fromDate, toDate)));
  const reportColumns = [
    ...requestColumns.slice(0, 7),
    { key: 'type', label: 'Type', render: (p: Row) => <span className="text-xs whitespace-nowrap">{p.type === 'direct' ? 'Direct Payment' : 'Bid Payment Request'}</span> },
    ...requestColumns.slice(7, 10),
    { key: 'status', label: 'Status', sortable: true, render: (p: Row) => <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge> },
    { key: 'payoutMode', label: 'Payment', render: (p: Row) => p.status === 'paid'
      ? <div className="text-xs"><p>{MODE_LABEL[p.payoutMode] ?? '-'}</p><p className="text-[11px] text-gray-500">{p.paidDate}</p>{p.payoutReference && <p className="text-[11px] text-gray-500 break-all max-w-[140px]">Ref {p.payoutReference}</p>}</div>
      : <span className="text-xs text-gray-400">-</span> },
    { key: 'history', label: 'Details', className: 'print:hidden', render: (p: Row) => history(p) },
  ];
  const reportExport = reportRows.map(p => ({
    'S.No': p.sno, Customer: p.customerName, 'Customer ID': p.customerCode, 'Req No': p.requestNo, Applied: p.appliedAt.slice(0, 10),
    Branch: p.branchName, Group: p.groupName, Lakh: lakh(p.groupValue), 'Auction No': p.auctionNo, Type: p.type === 'direct' ? 'Direct Payment' : 'Bid Payment Request',
    'Auction Amt': p.auctionAmount, Commission: p.commissionAmount, 'To Pay': p.toPay, Status: STATUS[p.status].label,
    Payment: MODE_LABEL[p.payoutMode] ?? '', 'Paid Date': p.paidDate, Reference: p.payoutReference,
  }));

  const registerColumns = [
    { key: 'auctionCode', label: 'Bid No', sortable: true, render: (a: Auction) => <span className="font-mono text-xs text-primary-600">{a.auctionCode}</span> },
    { key: 'auctionDate', label: 'Date', sortable: true },
    { key: 'groupName', label: 'Group', sortable: true, render: (a: Auction) => <span>{a.groupName} <span className="text-gray-400">#{a.auctionNo}</span></span> },
    { key: 'customerName', label: 'Winner', sortable: true, render: (a: Auction) => <span className="font-medium text-gray-900">{a.customerName}</span> },
    { key: 'bidAmount', label: 'Bid Amount', sortable: true, render: (a: Auction) => formatCurrency(a.bidAmount) },
    { key: 'commissionAmount', label: 'Commission', render: (a: Auction) => formatCurrency(a.commissionAmount) },
    { key: 'dividendPerMember', label: 'Dividend / Member', render: (a: Auction) => formatCurrency(a.dividendPerMember) },
    { key: 'prizeAmount', label: 'Prize', sortable: true, render: (a: Auction) => <span className="font-bold text-success-700">{formatCurrency(a.prizeAmount)}</span> },
    { key: 'payoutStatus', label: 'Payout', render: (a: Auction) => a.payoutStatus === 'paid'
      ? <span className="text-xs text-gray-500"><StatusBadge status="paid" /> {a.paidDate} · {MODE_LABEL[a.payoutMode] ?? a.payoutMode}</span>
      : <StatusBadge status="pending" /> },
  ];

  const allTabs: { tab: Tab; label: string; count?: number }[] = [
    { tab: 'apply', label: 'Apply', count: toApply.length },
    ...STAGES.map(s => ({ tab: s.tab as Tab, label: s.label, count: atStage(s.status).length })),
    { tab: 'reports', label: 'Reports' },
    { tab: 'register', label: 'Bid Register', count: auctions.length },
  ];
  const tabs = sa ? allTabs.filter(t => ['approval', 'docVerify', 'reports'].includes(t.tab)) : allTabs;
  const stage = STAGES.find(s => s.tab === tab);
  const card = 'bg-white rounded-xl shadow-card border border-gray-100';

  return (
    <div className="animate-fade-in">
      <PageHeader title={sa ? 'Bid Payment Approvals' : 'Bid Payments'} subtitle="Apply → Verify → Approval (MD) → Document → Document Verify (MD) → Payment Entry" actions={sa ? undefined :
        <div className="flex flex-wrap items-center gap-2">
          {office && <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"><Gavel className="w-4 h-4" /> New Bid</button>}
          {canPay && <button onClick={() => openPay({})} className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"><CreditCard className="w-4 h-4" /> Direct Payment</button>}
          {office && <button onClick={() => openApply()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><Plus className="w-4 h-4" /> New Apply</button>}
        </div>
      } />

      {/* Step tabs with the number waiting at each step. */}
      <div className="flex flex-wrap gap-2 mb-2">
        {tabs.map(t => (
          <button key={t.tab} onClick={() => setTab(t.tab)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${tab === t.tab ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
            {t.count !== undefined && <span className={`min-w-[20px] px-1.5 rounded-full text-[11px] font-semibold ${tab === t.tab ? 'bg-white/20 text-white' : t.count ? 'bg-warning-100 text-warning-800' : 'bg-gray-100 text-gray-500'}`}>{t.count}</span>}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-4 print:hidden">
        {tab === 'apply' ? 'Bid winners whose prize is not paid yet — apply to start the payment'
          : tab === 'reports' ? 'Every request with its full history'
          : tab === 'register' ? `Every bid recorded · foreman commission ${commission.foremanCommissionPct}% · maximum bid ${commission.maxBidPct}% of group value`
          : stage?.hint}
      </p>

      {tab === 'apply' && (
        <div className={card}><DataTable columns={applyColumns} data={withSno(toApply)} searchKeys={['customerName', 'groupName', 'auctionCode']} emptyMessage="No bid winners waiting — record a bid with “New Bid”" /></div>
      )}

      {stage && (
        <div className={card}><DataTable columns={requestColumns} data={withSno(atStage(stage.status))} searchKeys={['customerName', 'customerCode', 'requestNo', 'groupName']} emptyMessage={`Nothing waiting at ${stage.label}`} /></div>
      )}

      {tab === 'reports' && (
        <>
          <FilterBar>
            <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All branches" />
            <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All groups" />
            <DateRangeFilter label="Applied" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
            <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={(Object.keys(STATUS) as Status[]).map(s => ({ value: s, label: STATUS[s].label }))} placeholder="All" />
            <Select label="Payment mode" value={modeFilter} onChange={setModeFilter} options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))} placeholder="All" />
          </FilterBar>
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <p className="text-sm font-semibold text-gray-900">Bid Payments — Reports <span className="ml-2 text-xs font-normal text-gray-500">{fromDate || 'Start'} to {toDate || 'today'} · {reportRows.length} records</span></p>
              <ExportButtons filename="bid-payments" rows={reportExport} />
            </div>
            <DataTable columns={reportColumns} data={reportRows} searchKeys={['customerName', 'customerCode', 'mobile', 'requestNo']} emptyMessage="No bid payments in this period" />
          </div>
        </>
      )}

      {tab === 'register' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard title="Bids Held" value={String(auctions.length)} icon={<Gavel className="w-6 h-6" />} color="primary" />
            <KPICard title="Prize Payout Pending" value={formatCurrency(pendingPayout)} icon={<Trophy className="w-6 h-6" />} color="warning" />
            <KPICard title="Foreman Commission" value={formatCurrency(commissionEarned)} icon={<BadgePercent className="w-6 h-6" />} color="gold" />
            <KPICard title="Dividends to Members" value={formatCurrency(dividends)} icon={<Wallet className="w-6 h-6" />} color="success" />
          </div>
          <div className={card}><DataTable columns={registerColumns} data={auctions} searchKeys={['auctionCode', 'customerName', 'groupName']} pageSize={10} emptyMessage="No bids yet" /></div>
        </>
      )}

      {/* New Apply */}
      <Modal isOpen={applying} onClose={() => setApplying(false)} title="New Bid Payment Apply" size="md"
        footer={<ModalFooter onCancel={() => setApplying(false)} onSubmit={saveApply} submitLabel="Apply" submitting={apply.submitting} icon={<Plus className="w-4 h-4" />} />}>
        <div className="space-y-4">
          <Select label="Bid Winner" {...apply.field('auctionId')} required
            options={toApply.map(a => ({ value: a.id, label: `${a.customerName} · ${a.groupName} #${a.auctionNo} · ${formatCurrency(a.prizeAmount)}` }))}
            placeholder={toApply.length ? 'Select the winner' : 'No winners waiting'} />
          {(() => {
            const a = auctions.find(x => x.id === apply.values.auctionId);
            if (!a) return null;
            const ar = arrearsOf(a.customerId);
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Auction Amt</p><p className="text-sm font-bold">{formatCurrency(a.groupValue - a.dividendAmount)}</p></div>
                <div className="bg-gold-50 rounded-lg p-3"><p className="text-xs text-gray-500">Commission</p><p className="text-sm font-bold text-gold-700">{formatCurrency(a.commissionAmount)}</p></div>
                <div className="bg-success-50 rounded-lg p-3"><p className="text-xs text-gray-500">To Pay</p><p className="text-sm font-bold text-success-700">{formatCurrency(a.prizeAmount)}</p></div>
                {ar > 0 && <p className="col-span-full flex items-center gap-2 text-xs text-warning-800 bg-warning-50 rounded-lg p-2"><AlertTriangle className="w-4 h-4" /> Arrears {formatCurrency(ar)} — collect with an AR receipt before payment.</p>}
              </div>
            );
          })()}
          <TextArea label="Note (optional)" {...apply.field('note')} rows={2} />
        </div>
      </Modal>

      {/* Verify / Approve / Documents / Doc verify / Send back / Reject */}
      <Modal isOpen={!!stepping} onClose={() => setStepping(null)} title={stepping ? STEP_TITLE[stepping.action] : ''} size={stepping && ['document', 'docVerify', 'return'].includes(stepping.action) ? 'lg' : 'md'}
        footer={<ModalFooter onCancel={() => setStepping(null)} onSubmit={saveStep} submitting={step.submitting}
          submitLabel={stepping ? { verify: 'Verify', approve: 'Approve', document: 'Submit to MD', docVerify: 'Documents OK', return: 'Send Back', reject: 'Reject' }[stepping.action] : ''}
          variant={stepping?.action === 'reject' ? 'danger' : 'primary'}
          disabled={stepping?.action === 'document' && !(live ?? stepping.p).files.length} />}>
        {stepping && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-gray-900">{stepping.p.customerName} · {stepping.p.groupName} #{stepping.p.auctionNo}</p>
              <p className="text-xs text-gray-500">{stepping.p.requestNo} · Auction amt {formatCurrency(stepping.p.auctionAmount)} − commission {formatCurrency(stepping.p.commissionAmount)} = <b className="text-success-700">{formatCurrency(stepping.p.toPay)}</b></p>
              {arrearsOf(stepping.p.customerId) > 0 && <p className="mt-1 text-xs text-warning-800">Arrears {formatCurrency(arrearsOf(stepping.p.customerId))}</p>}
            </div>
            {(stepping.action === 'document' || stepping.action === 'docVerify' || stepping.action === 'return') && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{stepping.action === 'document' ? 'Upload documents' : 'Documents submitted'}</p>
                <BidDocumentFiles payment={live ?? stepping.p} editable={stepping.action === 'document'} />
                {stepping.action === 'document' && <p className="mt-1 text-[11px] text-gray-500">Upload a scan or photo of each document collected — JPG, PNG, WebP or PDF, up to 5 MB each. Click a file name to view it.</p>}
                {(live ?? stepping.p).documentNote && stepping.action !== 'document' && <p className="mt-1 text-xs italic text-gray-500">“{(live ?? stepping.p).documentNote}”</p>}
                {step.errors.documents && <p className="mt-1 text-xs text-danger-600">{step.errors.documents}</p>}
              </div>
            )}
            <TextArea label={stepping.action === 'reject' || stepping.action === 'return' ? 'Reason' : 'Note (optional)'} {...step.field('note')} rows={2}
              required={stepping.action === 'reject' || stepping.action === 'return'} />
          </div>
        )}
      </Modal>

      {/* Payment Entry / Direct Payment */}
      <Modal isOpen={!!paying} onClose={() => setPaying(null)} title={paying?.request ? 'Payment Entry' : 'Direct Payment'}
        footer={<ModalFooter onCancel={() => setPaying(null)} onSubmit={pay} submitLabel="Pay" submitting={payout.submitting} disabled={!payAuction} icon={<Banknote className="w-4 h-4" />} />}>
        {paying && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!paying.request && (
              <Select label="Bid Winner" {...payout.field('auctionId')} required className="col-span-full"
                options={unpaid.map(a => ({ value: a.id, label: `${a.customerName} · ${a.groupName} #${a.auctionNo} · ${formatCurrency(a.prizeAmount)}` }))}
                placeholder={unpaid.length ? 'Select the winner' : 'No unpaid winners'} />
            )}
            {payAuction && (
              <div className="col-span-full bg-success-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500">{payAuction.customerName} · {payAuction.groupName} #{payAuction.auctionNo}{paying.request ? ` · ${paying.request.requestNo}` : ''}</p>
                <p className="text-2xl font-bold text-success-700">{formatCurrency(payAuction.prizeAmount)}</p>
                <p className="text-[11px] text-gray-500">Auction amt {formatCurrency(payAuction.groupValue - payAuction.dividendAmount)} − commission {formatCurrency(payAuction.commissionAmount)}</p>
                {!paying.request && <p className="mt-1 text-[11px] text-warning-700">Direct payment skips Verify, MD approval and documents.</p>}
              </div>
            )}
            <Select label="Payout Mode" {...payout.field('payoutMode')} required options={[{ value: 'cash', label: `Cash (in hand ${formatCurrency(cashInHand)})` }, { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }]} />
            <Input label="Payment Date" type="date" {...payout.field('paidDate')} required />
            {payout.values.payoutMode !== 'cash' && (
              <>
                <Select label="From Bank Account" {...payout.field('bankAccountId')} required
                  options={bankAccounts.filter(b => b.status === 'active').map(b => ({ value: b.id, label: `${b.bankName} ${b.accountNumber.slice(-4)} · ${formatCurrency(b.currentBalance)}` }))} />
                <Input label={payout.values.payoutMode === 'cheque' ? 'Cheque No' : 'Transaction Ref'} {...payout.field('payoutReference')} required />
              </>
            )}
          </div>
        )}
      </Modal>

      {/* New Bid (record the auction) */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Bid" size="lg"
        footer={<ModalFooter onCancel={() => setShowForm(false)} onSubmit={save} submitLabel="Record Bid" submitting={form.submitting} disabled={!!prizeError} icon={<Gavel className="w-4 h-4" />} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Chit Group" {...form.field('groupId')} onChange={pickGroup} required className="col-span-full"
            options={groups.filter(g => g.status === 'active').map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode}) · ${formatCurrency(g.groupValue)}` }))} />
          <Input label="Bid / Installment No" type="number" format="integer" min={1} {...form.field('auctionNo')} required />
          <Input label="Bid Date" type="date" {...form.field('auctionDate')} required />
          <Select label="Winning Subscriber" {...form.field('customerId')} required className="col-span-full"
            options={bidders.map(c => ({ value: c.id, label: `${c.name} (${c.customerId})` }))}
            placeholder={group ? `${bidders.length} subscribers yet to win` : 'Select a group first'} />
          <Input label="Prize to Winner (₹)" type="number" {...form.field('prizeAmount')} error={prizeError || form.errors.prizeAmount || form.errors.bidAmount} required placeholder={group ? `${Math.round(minPrize)} – ${Math.round(maxPrize)}` : ''} className="col-span-full" />
          <TextArea label="Remarks" {...form.field('remarks')} rows={2} className="col-span-full" />
          {group && (
            <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Group Value</p><p className="text-sm font-bold">{formatCurrency(group.groupValue)}</p></div>
              <div className="bg-gold-50 rounded-lg p-3"><p className="text-xs text-gray-500">Commission ({commission.foremanCommissionPct}%)</p><p className="text-sm font-bold text-gold-700">{formatCurrency(commissionAmt)}</p></div>
              <div className="bg-primary-50 rounded-lg p-3"><p className="text-xs text-gray-500">Dividend / Member ({members.length})</p><p className="text-sm font-bold text-primary-700">{formatCurrency(members.length ? dividend / members.length : 0)}</p></div>
              <div className="bg-success-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Dividend</p><p className="text-sm font-bold text-success-700">{formatCurrency(dividend)}</p></div>
            </div>
          )}
          {winner && winnerArrears > 0 && (
            <div className="col-span-full flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-lg p-3 text-sm text-warning-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {winner.name} has arrears of {formatCurrency(winnerArrears)}. Collect them with an AR receipt before paying the prize.
            </div>
          )}
          <p className="col-span-full text-xs text-gray-500">The dividend reduces each member's dues from this installment onward. Bids cannot be edited once recorded.</p>
        </div>
      </Modal>
    </div>
  );
}

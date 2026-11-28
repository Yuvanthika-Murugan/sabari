import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import { Input, Select, TextArea, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { BankAccount, BankTransaction, CashTransaction, Withdrawal } from '@/types';
import { Plus, ArrowDownToLine, Banknote, Wallet, TrendingUp, TrendingDown, Check, X, Edit } from 'lucide-react';

/** Collection staff list for statement filters. */
const staffOptions = (users: { id: string; name: string; role: string }[]) =>
  users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }));

/** Receipt / expense number → staff member, to tell whose cash-book line it is. */
function useStaffByRef() {
  const { collections, cancelledReceipts, expenses } = useData();
  const map = new Map<string, string>();
  [...collections, ...cancelledReceipts].forEach(c => map.set(c.receiptNo, c.staffId));
  expenses.forEach(e => map.set(e.expenseNo, e.staffId));
  return map;
}

export function CashStatement() {
  const { cashTransactions, users, today } = useData();
  const staffByRef = useStaffByRef();
  const [fromDate, setFromDate] = useState(today.slice(0, 8) + '01');
  const [toDate, setToDate] = useState(today);
  const [staffFilter, setStaffFilter] = useState('');
  const staffName = (id: string) => users.find(u => u.id === id)?.name ?? '';

  const inPeriod = cashTransactions.filter(t => (!fromDate || t.date >= fromDate) && (!toDate || t.date <= toDate));
  const inRange = inPeriod.filter(t => !staffFilter || staffByRef.get(t.voucherReceipt) === staffFilter);
  const before = cashTransactions.filter(t => fromDate && t.date < fromDate);
  const openingBalance = before.length ? before[before.length - 1].balance : 0;
  const totalDebit = inRange.reduce((s, t) => s + t.debit, 0);
  const totalCredit = inRange.reduce((s, t) => s + t.credit, 0);
  const closingBalance = openingBalance + inPeriod.reduce((s, t) => s + t.credit - t.debit, 0);

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'voucherReceipt', label: 'Voucher/Receipt', render: (t: CashTransaction) => <span className="font-mono text-xs text-primary-600">{t.voucherReceipt}</span> },
    { key: 'description', label: 'Description' },
    { key: 'staff', label: 'Staff', render: (t: CashTransaction) => staffName(staffByRef.get(t.voucherReceipt) ?? '') || <span className="text-gray-300">Office</span> },
    { key: 'debit', label: 'Debit', sortable: true, render: (t: CashTransaction) => t.debit > 0 ? <span className="text-danger-600 font-medium">{formatCurrency(t.debit)}</span> : <span className="text-gray-300">-</span> },
    { key: 'credit', label: 'Credit', sortable: true, render: (t: CashTransaction) => t.credit > 0 ? <span className="text-success-600 font-medium">{formatCurrency(t.credit)}</span> : <span className="text-gray-300">-</span> },
    { key: 'balance', label: 'Balance', render: (t: CashTransaction) => <span className="font-bold">{formatCurrency(t.balance)}</span> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Cash Statement" subtitle="Cash ledger with opening and closing balance" actions={<ExportButtons filename="cash-statement" rows={inRange} />} />
      <FilterBar>
        <Input label="From Date" type="date" value={fromDate} onChange={setFromDate} />
        <Input label="To Date" type="date" value={toDate} onChange={setToDate} />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={staffOptions(users)} placeholder="All (incl. office)" />
      </FilterBar>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {staffFilter
          ? <KPICard title="Staff" value={staffName(staffFilter)} icon={<Wallet className="w-6 h-6" />} color="primary" />
          : <KPICard title="Opening Balance" value={formatCurrency(openingBalance)} icon={<Wallet className="w-6 h-6" />} color="primary" />}
        <KPICard title="Total Credit" value={formatCurrency(totalCredit)} icon={<TrendingUp className="w-6 h-6" />} color="success" />
        <KPICard title="Total Debit" value={formatCurrency(totalDebit)} icon={<TrendingDown className="w-6 h-6" />} color="danger" />
        {staffFilter
          ? <KPICard title="Net (Credit − Debit)" value={formatCurrency(totalCredit - totalDebit)} icon={<Banknote className="w-6 h-6" />} color="gold" />
          : <KPICard title="Closing Balance" value={formatCurrency(closingBalance)} icon={<Banknote className="w-6 h-6" />} color="gold" />}
      </div>
      <DataTable columns={columns} data={inRange} searchKeys={['description', 'voucherReceipt']} pageSize={10} emptyMessage="No cash transactions in this period" />
    </div>
  );
}

const blankBank = { bankName: '', accountName: '', accountNumber: '', branch: '', ifsc: '', openingBalance: '', status: 'active' };

/** Add / edit bank account form, shared by Bank Accounts and Bank Statement ("Add Bank"). */
function useBankAccountForm() {
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null);
  const form = useForm(blankBank);

  const openForm = (a: BankAccount | 'new') => {
    form.reset(a === 'new' ? blankBank : {
      bankName: a.bankName, accountName: a.accountName, accountNumber: a.accountNumber, branch: a.branch,
      ifsc: a.ifsc, openingBalance: String(a.openingBalance), status: a.status,
    });
    setEditing(a);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/bank-accounts', v) : api.put(`/bank-accounts/${(editing as BankAccount).id}`, v),
      editing === 'new' ? 'Bank account added' : 'Bank account updated',
    );
    if (ok) setEditing(null);
  };

  const modal = (
    <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Bank Account' : 'Edit Bank Account'} size="lg"
      footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save" submitting={form.submitting} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Bank Name" {...form.field('bankName')} placeholder="HDFC Bank" required />
        <Input label="Account Name" format="name" check={checks.name} maxLength={160} {...form.field('accountName')} placeholder="Account Holder Name" required />
        <Input label="Account Number" format="digits" maxLength={18} check={checks.account} {...form.field('accountNumber')} placeholder="50200012345678" required />
        <Input label="Branch" {...form.field('branch')} placeholder="Anna Salai" required />
        <Input label="IFSC Code" format="upper" maxLength={11} check={checks.ifsc} {...form.field('ifsc')} placeholder="HDFC0001234" required />
        {editing === 'new'
          ? <Input label="Opening Balance" type="number" {...form.field('openingBalance')} placeholder="500000" required />
          : <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />}
        {editing !== 'new' && <p className="col-span-full text-xs text-gray-500">Balances change only through transactions. Inactive accounts are hidden from payment and payout forms.</p>}
      </div>
    </Modal>
  );
  return { openForm, modal };
}

const addBankButton = (onClick: () => void) => (
  <button onClick={onClick} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><Plus className="w-4 h-4" /> Add Bank</button>
);

export function BankAccounts() {
  const { bankAccounts } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const { openForm, modal } = useBankAccountForm();

  const columns = [
    { key: 'bankName', label: 'Bank', sortable: true, render: (a: BankAccount) => <span className="font-medium text-gray-900">{a.bankName}</span> },
    { key: 'accountName', label: 'Account Name' },
    { key: 'accountNumber', label: 'Account No', render: (a: BankAccount) => <span className="font-mono text-xs">{a.accountNumber}</span> },
    { key: 'branch', label: 'Branch' },
    { key: 'ifsc', label: 'IFSC', render: (a: BankAccount) => <span className="font-mono text-xs text-gray-500">{a.ifsc}</span> },
    { key: 'openingBalance', label: 'Opening Balance', sortable: true, render: (a: BankAccount) => formatCurrency(a.openingBalance) },
    { key: 'currentBalance', label: 'Current Balance', sortable: true, render: (a: BankAccount) => <span className="font-bold text-primary-700">{formatCurrency(a.currentBalance)}</span> },
    { key: 'status', label: 'Status', render: (a: BankAccount) => <StatusBadge status={a.status} /> },
    ...(canManage ? [{ key: 'actions', label: 'Actions', render: (a: BankAccount) => (
      <button onClick={() => openForm(a)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
    )}] : []),
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Bank Accounts" subtitle={`${bankAccounts.length} bank accounts`} actions={
        canManage && addBankButton(() => openForm('new'))
      } />
      <DataTable columns={columns} data={bankAccounts} searchKeys={['bankName', 'accountName', 'accountNumber']} pageSize={10} />
      {modal}
    </div>
  );
}

export function BankStatement() {
  const { bankAccounts, bankTransactions } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const { openForm, modal } = useBankAccountForm();
  const { collections, expenses, users } = useData();
  const [accountFilter, setAccountFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // One list: bank account entries, plus bank / UPI receipts (credit) and bank expenses
  // (debit), which carry the staff member but are not tied to a bank account.
  type Line = { id: string; date: string; ref: string; source: string; account: string; description: string; credit: number; debit: number; balance: number | null; staffId: string };
  const lines: Line[] = [
    ...bankTransactions.map((t: BankTransaction) => ({
      id: `t${t.id}`, date: t.date, ref: t.transactionId, source: 'Bank A/c', account: t.accountId, description: t.description,
      credit: t.credit, debit: t.debit, balance: t.balance as number | null, staffId: '',
    })),
    ...collections.filter(c => c.paymentMode !== 'cash').map(c => ({
      id: `c${c.id}`, date: c.date, ref: c.receiptNo, source: 'Bank/UPI Receipt', account: '',
      description: `${c.customerName}${c.upiId || c.referenceNo ? ` · ${c.upiId || c.referenceNo}` : ''}`,
      credit: c.collectedAmount, debit: 0, balance: null, staffId: c.staffId,
    })),
    ...expenses.filter(e => e.paymentMode === 'bank').map(e => ({
      id: `e${e.id}`, date: e.date, ref: e.expenseNo, source: 'Bank Expense', account: '',
      description: `${e.category}${e.agentName ? ` · ${e.agentName}` : ''}${e.remarks ? ` · ${e.remarks}` : ''}`,
      credit: 0, debit: e.amount, balance: null, staffId: e.staffId,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = lines.filter(l => inDateRange(l.date, fromDate, toDate)
    && (!accountFilter || l.account === accountFilter)
    && (!staffFilter || l.staffId === staffFilter));
  const credit = filtered.reduce((s, l) => s + l.credit, 0);
  const debit = filtered.reduce((s, l) => s + l.debit, 0);
  const staffName = (id: string) => users.find(u => u.id === id)?.name ?? '';

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'ref', label: 'Ref No', render: (l: Line) => <span className="font-mono text-xs text-primary-600">{l.ref}</span> },
    { key: 'source', label: 'Type', render: (l: Line) => <Badge variant={l.source === 'Bank A/c' ? 'gray' : l.credit ? 'success' : 'danger'}>{l.source}</Badge> },
    ...(accountFilter ? [] : [{ key: 'account', label: 'Account', render: (l: Line) => bankAccounts.find(a => a.id === l.account)?.bankName ?? '-' }]),
    { key: 'description', label: 'Description' },
    { key: 'staffId', label: 'Staff', render: (l: Line) => staffName(l.staffId) || <span className="text-gray-300">-</span> },
    { key: 'credit', label: 'Credit', sortable: true, render: (l: Line) => l.credit > 0 ? <span className="text-success-600 font-medium">{formatCurrency(l.credit)}</span> : <span className="text-gray-300">-</span> },
    { key: 'debit', label: 'Debit', sortable: true, render: (l: Line) => l.debit > 0 ? <span className="text-danger-600 font-medium">{formatCurrency(l.debit)}</span> : <span className="text-gray-300">-</span> },
    { key: 'balance', label: 'A/c Balance', render: (l: Line) => l.balance === null ? <span className="text-gray-300">-</span> : <span className="font-bold">{formatCurrency(l.balance)}</span> },
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Bank Statement" subtitle="Bank transaction ledger" actions={
        <>
          <ExportButtons filename="bank-statement" rows={filtered} />
          {canManage && addBankButton(() => openForm('new'))}
        </>
      } />
      <FilterBar>
        <DateRangeFilter from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Bank Account" value={accountFilter} onChange={setAccountFilter} options={bankAccounts.map(a => ({ value: a.id, label: `${a.bankName} - ${a.accountNumber.slice(-4)}` }))} placeholder="All Accounts" />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={staffOptions(users)} placeholder="All Staff" />
      </FilterBar>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <KPICard title="Total Credit" value={formatCurrency(credit)} icon={<TrendingUp className="w-6 h-6" />} color="success" />
        <KPICard title="Total Debit" value={formatCurrency(debit)} icon={<TrendingDown className="w-6 h-6" />} color="danger" />
        <KPICard title="Net (Credit − Debit)" value={formatCurrency(credit - debit)} icon={<Wallet className="w-6 h-6" />} color="primary" />
      </div>
      {bankAccounts.length === 0 && <p className="text-sm text-gray-500 mb-3">No bank accounts yet.{canManage ? ' Use "Add Bank" to create one.' : ''}</p>}
      <DataTable columns={columns} data={filtered} searchKeys={['ref', 'description']} pageSize={10} />
      {modal}
    </div>
  );
}

export function WithdrawalStatement() {
  const { withdrawals, bankAccounts, today } = useData();
  const { currentUser } = useApp();
  const canRequest = currentUser?.role !== 'staff';
  const isMd = currentUser?.role === 'md';
  const [showAdd, setShowAdd] = useState(false);
  const form = useForm({ date: today, accountId: '', amount: '', mode: '', reference: '', reason: '' });
  const { run, busy } = useAction();

  const save = async () => {
    if (await form.submit(v => api.post('/withdrawals', v), 'Withdrawal requested')) setShowAdd(false);
  };
  const decide = (w: Withdrawal, decision: 'approved' | 'rejected') =>
    run(() => api.post(`/withdrawals/${w.id}/decision`, { decision }), `Withdrawal ${decision}`);

  const columns = [
    { key: 'withdrawalId', label: 'Withdrawal ID', sortable: true, render: (w: Withdrawal) => <span className="font-mono text-xs text-primary-600">{w.withdrawalId}</span> },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'account', label: 'Account' },
    { key: 'amount', label: 'Amount', sortable: true, render: (w: Withdrawal) => <span className="font-bold">{formatCurrency(w.amount)}</span> },
    { key: 'mode', label: 'Mode', render: (w: Withdrawal) => <Badge variant="gray">{w.mode.replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'reference', label: 'Reference', render: (w: Withdrawal) => <span className="font-mono text-xs text-gray-500">{w.reference || '-'}</span> },
    { key: 'reason', label: 'Reason', render: (w: Withdrawal) => <span className="text-gray-500 text-xs">{w.reason}</span> },
    { key: 'requestedBy', label: 'Requested By' },
    { key: 'approvedBy', label: 'Approved By', render: (w: Withdrawal) => w.approvedBy ?? <span className="text-gray-400">Pending</span> },
    { key: 'status', label: 'Status', render: (w: Withdrawal) => <StatusBadge status={w.status} /> },
    ...(isMd ? [{ key: 'actions', label: 'Action', render: (w: Withdrawal) => w.status === 'pending' ? (
      <div className="flex gap-1">
        <button onClick={() => decide(w, 'approved')} disabled={busy} className="p-1.5 rounded-lg hover:bg-success-50 text-success-600" title="Approve"><Check className="w-4 h-4" /></button>
        <button onClick={() => decide(w, 'rejected')} disabled={busy} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600" title="Reject"><X className="w-4 h-4" /></button>
      </div>
    ) : null }] : []),
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Withdrawal Statement" subtitle="Track all withdrawals" actions={
        <>
          <ExportButtons filename="withdrawals" rows={withdrawals} />
          {canRequest && <button onClick={() => { form.reset(); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><ArrowDownToLine className="w-4 h-4" /> New Withdrawal</button>}
        </>
      } />
      <DataTable columns={columns} data={withdrawals} searchKeys={['withdrawalId', 'account', 'reason']} pageSize={10} />
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Withdrawal" size="md"
        footer={<ModalFooter onCancel={() => setShowAdd(false)} onSubmit={save} submitLabel="Request Withdrawal" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Date" type="date" {...form.field('date')} required />
          <Select label="Account" {...form.field('accountId')} options={bankAccounts.filter(a => a.status === 'active').map(a => ({ value: a.id, label: a.bankName }))} required />
          <Input label="Amount" type="number" {...form.field('amount')} placeholder="50000" required />
          <Select label="Mode" {...form.field('mode')} options={[{ value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }]} required />
          <Input label="Reference" format="reference" maxLength={60} {...form.field('reference')} placeholder="WREF12345678" className="col-span-full" />
          <TextArea label="Reason" {...form.field('reason')} placeholder="Reason for withdrawal" className="col-span-full" required />
          <p className="col-span-full text-xs text-gray-500">The MD approves withdrawals; approval debits the selected bank account.</p>
        </div>
      </Modal>
    </div>
  );
}

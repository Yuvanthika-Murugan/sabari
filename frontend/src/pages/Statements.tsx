import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import KPICard from '@/components/KPICard';
import { Input, Select, TextArea, FilterBar } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, DayEndClosing } from '@/types';
import { Wallet, TrendingUp, AlertCircle, Calendar, FileSpreadsheet, CheckCircle2, Lock } from 'lucide-react';

const modeText = (m: string) => ({ cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank', cheque: 'Cheque' }[m] ?? m);

/**
 * Passbook checking: every receipt as a passbook line, filtered by In / Out date,
 * narration and staff. With customerId, only that customer's receipts (all dates).
 */
function Passbook({ customerId }: { customerId?: string }) {
  const { collections, customers, users, today } = useData();
  const [from, setFrom] = useState(customerId ? '' : today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [narration, setNarration] = useState('');
  const [staff, setStaff] = useState('');

  const rows = collections.filter(c => !customerId || c.customerId === customerId).map(c => {
    const cust = customers.find(x => x.id === c.customerId);
    const text = [
      `${c.receiptType === 'arrear' ? 'Arrear' : 'Installment'} #${c.dueNumber}`,
      c.groupName !== '-' ? c.groupName : '',
      modeText(c.paymentMode) + (c.upiId || c.referenceNo ? ` ${c.upiId || c.referenceNo}` : ''),
      c.remarks,
    ].filter(Boolean).join(' · ');
    return { ...c, customerCode: cust?.customerId ?? '', narration: text };
  }).filter(r => inDateRange(r.date, from, to)
    && (!narration.trim() || r.narration.toLowerCase().includes(narration.trim().toLowerCase()))
    && (!staff || r.staffId === staff));
  type Row = typeof rows[0];
  const total = rows.reduce((s, r) => s + r.collectedAmount, 0);

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (r: Row) => <span>{r.date} <span className="text-gray-400">{r.time}</span></span> },
    { key: 'receiptNo', label: 'Receipt No', render: (r: Row) => <span className="font-mono text-xs text-primary-600">{r.receiptNo}</span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (r: Row) => <div><p className="font-medium">{r.customerName}</p><p className="text-xs text-gray-500 font-mono">{r.customerCode}</p></div> },
    { key: 'narration', label: 'Narration', render: (r: Row) => <span className="text-sm text-gray-600">{r.narration}</span> },
    { key: 'collectedAmount', label: 'Credit', sortable: true, render: (r: Row) => <span className="text-success-600 font-medium">{formatCurrency(r.collectedAmount)}</span> },
    { key: 'staffName', label: 'Staff' },
  ];

  return (
    <>
      <FilterBar>
        <Input label="In Date (From)" type="date" value={from} onChange={setFrom} />
        <Input label="Out Date (To)" type="date" value={to} onChange={setTo} error={from && to && to < from ? 'Must be on or after the In date' : undefined} />
        <Input label="Narration" value={narration} onChange={setNarration} placeholder="e.g. Installment, UPI, Gold" />
        <Select label="Staff" value={staff} onChange={setStaff} options={users.filter(u => u.role !== 'md').map(u => ({ value: u.id, label: u.name }))} placeholder="All Staff" />
        <ExportButtons filename="passbook" rows={rows} />
      </FilterBar>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <KPICard title="Entries" value={String(rows.length)} icon={<FileSpreadsheet className="w-6 h-6" />} color="primary" />
        <KPICard title="Total Credit" value={formatCurrency(total)} icon={<Wallet className="w-6 h-6" />} color="success" />
      </div>
      <DataTable columns={columns} data={rows} searchKeys={['customerName', 'customerCode', 'receiptNo', 'narration']} pageSize={10} emptyMessage="No passbook entries for these filters" />
    </>
  );
}

export function Statements() {
  const location = useLocation();
  const navigate = useNavigate();
  // Opened from a customer's "View statement" button: show only that customer.
  const customerId = (location.state as { customerId?: string } | null)?.customerId;
  const { customers, groups, dueSchedules } = useData();
  const [tab, setTab] = useState<'passbook' | 'customers'>('passbook');
  const tabBtn = (key: typeof tab, label: string) => (
    <button onClick={() => setTab(key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>
  );

  const focus = customerId ? customers.find(c => c.id === customerId) : undefined;
  if (focus) {
    const dues = dueSchedules.filter(d => d.customerId === focus.id).sort((a, b) => a.dueNumber - b.dueNumber);
    const next = dues.find(d => d.pendingAmount > 0);
    return (
      <div className="animate-fade-in">
        <PageHeader title={`Statement · ${focus.name}`} subtitle={`${focus.customerId} · ${focus.mobile} · ${groups.find(g => g.id === focus.groupId)?.groupName ?? '-'}`}
          actions={<button onClick={() => navigate(-1)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"><ArrowLeft className="w-4 h-4" /> Back</button>} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard title="Total Due" value={formatCurrency(focus.totalDue)} icon={<Calendar className="w-6 h-6" />} trend="neutral" trendValue={`${dues.length} instalments`} color="primary" />
          <KPICard title="Paid" value={formatCurrency(focus.paid)} icon={<CheckCircle2 className="w-6 h-6" />} trend="neutral" trendValue={`${dues.filter(d => d.pendingAmount <= 0).length} instalments paid`} color="success" />
          <KPICard title="Pending" value={formatCurrency(focus.pending)} icon={<AlertCircle className="w-6 h-6" />} trend="neutral" trendValue={focus.pending > 0 ? 'Still to pay' : 'Fully paid'} color="danger" />
          <KPICard title="Next Due" value={next ? formatCurrency(next.pendingAmount) : 'All paid'} icon={<TrendingUp className="w-6 h-6" />} trend="neutral" trendValue={next ? `${next.dueDate} · #${next.dueNumber}` : '-'} color="gold" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Receipts (passbook)</h3>
        <Passbook customerId={focus.id} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Statement" subtitle="Passbook checking and customer statements" />
      <div className="flex gap-2 border-b border-gray-200 mb-4 print:hidden">
        {tabBtn('passbook', 'Passbook Checking')}
        {tabBtn('customers', 'Customer Statements')}
      </div>
      {tab === 'passbook' ? <Passbook /> : <CustomerStatements />}
    </div>
  );
}

function CustomerStatements() {
  const { customers, branches, groups, dueSchedules } = useData();
  const [showCustomer, setShowCustomer] = useState<string | null>(null);
  const viewCustomer = customers.find(c => c.id === showCustomer);
  const customerDues = viewCustomer ? dueSchedules.filter(d => d.customerId === viewCustomer.id) : [];
  const nextDue = customerDues.find(d => d.pendingAmount > 0);

  const columns = [
    { key: 'customerId', label: 'Customer ID', render: (c: Customer) => <span className="font-mono text-xs text-primary-600">{c.customerId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (c: Customer) => <span className="font-medium">{c.name}</span> },
    { key: 'mobile', label: 'Phone' },
    { key: 'branchId', label: 'Branch', render: (c: Customer) => branches.find(b => b.id === c.branchId)?.name },
    { key: 'groupId', label: 'Group', render: (c: Customer) => groups.find(g => g.id === c.groupId)?.groupName },
    { key: 'totalDue', label: 'Total Due', sortable: true, render: (c: Customer) => formatCurrency(c.totalDue) },
    { key: 'paid', label: 'Paid', sortable: true, render: (c: Customer) => <span className="text-success-600">{formatCurrency(c.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (c: Customer) => <span className="text-danger-600">{formatCurrency(c.pending)}</span> },
    { key: 'action', label: 'Action', render: (c: Customer) => (
      <button onClick={() => setShowCustomer(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"><FileSpreadsheet className="w-4 h-4" /> View Statement</button>
    )},
  ];

  return (
    <div>
      <div className="flex justify-end mb-3"><ExportButtons filename="customer-balances" rows={customers} /></div>
      <DataTable columns={columns} data={customers} searchKeys={['name','customerId','mobile']} pageSize={10} />

      <Modal isOpen={!!showCustomer} onClose={() => setShowCustomer(null)} title="Customer Statement" size="xl"
        footer={<><button onClick={() => setShowCustomer(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Close</button><ExportButtons filename={`statement-${viewCustomer?.customerId ?? 'customer'}`} rows={customerDues} /></>}
      >
        {viewCustomer && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewCustomer.name}</h3>
                <p className="text-sm text-gray-500">{viewCustomer.customerId} • {viewCustomer.mobile}</p>
                <p className="text-xs text-gray-400">{branches.find(b => b.id === viewCustomer.branchId)?.name} • {groups.find(g => g.id === viewCustomer.groupId)?.groupName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Due</p><p className="text-lg font-bold text-primary-700">{formatCurrency(viewCustomer.totalDue)}</p></div>
              <div className="bg-success-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Paid</p><p className="text-lg font-bold text-success-700">{formatCurrency(viewCustomer.paid)}</p></div>
              <div className="bg-danger-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Pending</p><p className="text-lg font-bold text-danger-700">{formatCurrency(viewCustomer.pending)}</p></div>
              <div className="bg-gold-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Next Due</p><p className="text-lg font-bold text-gold-700">{nextDue ? formatCurrency(nextDue.pendingAmount) : '-'}</p>{nextDue && <p className="text-xs text-gray-500">{nextDue.dueDate}</p>}</div>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{['Date','Due No','Description','Due','Paid','Pending','Receipt','Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customerDues.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">{d.dueDate}</td>
                      <td className="px-3 py-2 text-sm">#{d.dueNumber}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">Installment #{d.dueNumber}</td>
                      <td className="px-3 py-2 text-sm">{formatCurrency(d.dueAmount)}</td>
                      <td className="px-3 py-2 text-sm text-success-600">{formatCurrency(d.paidAmount)}</td>
                      <td className="px-3 py-2 text-sm text-danger-600">{formatCurrency(d.pendingAmount)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-primary-600">{d.receiptNo || '-'}</td>
                      <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** A day with no figures, shown when no day-end row exists yet. */
const emptyDay = (date: string): DayEndClosing => ({
  id: '', date, openingCash: 0, cashCollection: 0, otherCashReceipt: 0, expenses: 0, withdrawals: 0,
  expectedClosingCash: 0, physicalCash: 0, difference: 0, bankCredits: 0, bankDebits: 0, upiCollection: 0,
  totalCollection: 0, pendingApprovals: 0, rejectedTransactions: 0, status: 'open', closedBy: null, closedTime: null, remarks: '',
});

export function DayEnd() {
  const { dayEndClosings, today: todayDate } = useData();
  const { currentUser } = useApp();
  const canClose = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const isOffice = currentUser?.role !== 'staff';
  const [showClose, setShowClose] = useState<string | null>(null);
  const form = useForm({ physicalCash: '', remarks: '' });

  // The list can be empty: collection staff never receive day-end data, and a new
  // install has no days yet. Fall back to zero figures instead of crashing.
  const today: DayEndClosing = dayEndClosings.find(d => d.date === todayDate) ?? dayEndClosings[0] ?? emptyDay(todayDate);
  const closing = dayEndClosings.find(d => d.id === showClose) ?? today;
  const physicalCash = form.values.physicalCash;
  const difference = physicalCash ? Number(physicalCash) - closing.expectedClosingCash : 0;

  if (!isOffice) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Day End" subtitle="Daily closing and reconciliation" />
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-10 text-center">
          <Lock className="w-8 h-8 mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-900">Day End is available to the MD, Admin and Managers only.</p>
          <p className="text-xs text-gray-500 mt-1">Ask your branch manager for the daily closing figures.</p>
        </div>
      </div>
    );
  }

  const openClose = (d: DayEndClosing) => {
    form.reset({ physicalCash: '', remarks: '' });
    setShowClose(d.id);
  };
  const confirmClose = async () => {
    if (await form.submit(v => api.post(`/day-end/${closing.id}/close`, v), `Day ${closing.date} closed`)) setShowClose(null);
  };

  const columns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'openingCash', label: 'Opening Cash', render: (d: DayEndClosing) => formatCurrency(d.openingCash) },
    { key: 'cashCollection', label: 'Cash Collection', render: (d: DayEndClosing) => <span className="text-success-600">{formatCurrency(d.cashCollection)}</span> },
    { key: 'totalCollection', label: 'Total Collection', render: (d: DayEndClosing) => <span className="font-bold">{formatCurrency(d.totalCollection)}</span> },
    { key: 'expenses', label: 'Expenses', render: (d: DayEndClosing) => <span className="text-danger-600">{formatCurrency(d.expenses)}</span> },
    { key: 'expectedClosingCash', label: 'Expected Closing', render: (d: DayEndClosing) => formatCurrency(d.expectedClosingCash) },
    { key: 'difference', label: 'Difference', render: (d: DayEndClosing) => d.difference === 0 ? <span className="text-success-600">₹0</span> : <span className="text-danger-600">{formatCurrency(d.difference)}</span> },
    { key: 'status', label: 'Status', render: (d: DayEndClosing) => <StatusBadge status={d.status} /> },
    { key: 'action', label: 'Action', render: (d: DayEndClosing) => d.status === 'open' ? (canClose &&
      <button onClick={() => openClose(d)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"><CheckCircle2 className="w-4 h-4" /> Close Day</button>
    ) : <span className="text-xs text-gray-400">Closed by {d.closedBy}</span> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Day End" subtitle="Daily closing and reconciliation" actions={<ExportButtons filename="day-end" rows={dayEndClosings} />} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Opening Cash" value={formatCurrency(today.openingCash)} icon={<Wallet className="w-6 h-6" />} color="primary" />
        <KPICard title="Cash Collection" value={formatCurrency(today.cashCollection)} icon={<TrendingUp className="w-6 h-6" />} color="success" />
        <KPICard title="Total Collection" value={formatCurrency(today.totalCollection)} icon={<Calendar className="w-6 h-6" />} color="gold" />
        <KPICard title="Pending Approvals" value={String(today.pendingApprovals)} icon={<AlertCircle className="w-6 h-6" />} color="warning" />
      </div>
      <DataTable columns={columns} data={dayEndClosings} searchable={false} pageSize={10} emptyMessage="No days to close yet — today's row appears once the server has been reached" />

      <Modal isOpen={!!showClose} onClose={() => setShowClose(null)} title={`Close Day ${closing?.date ?? ''} - Reconciliation`} size="lg"
        footer={<ModalFooter onCancel={() => setShowClose(null)} onSubmit={confirmClose} submitLabel="Confirm Day Close" submitting={form.submitting} />}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Opening Cash</span><span className="font-medium">{formatCurrency(closing.openingCash)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">+ Cash Collection</span><span className="font-medium text-success-600">{formatCurrency(closing.cashCollection)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">+ Other Cash Receipt</span><span className="font-medium text-success-600">{formatCurrency(closing.otherCashReceipt)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">- Expenses</span><span className="font-medium text-danger-600">{formatCurrency(closing.expenses)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">- Withdrawals</span><span className="font-medium text-danger-600">{formatCurrency(closing.withdrawals)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2"><span className="font-semibold">Expected Closing Cash</span><span className="font-bold text-primary-700">{formatCurrency(closing.expectedClosingCash)}</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Bank Credits</p><p className="text-sm font-bold text-primary-700">{formatCurrency(closing.bankCredits)}</p></div>
            <div className="bg-danger-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Bank Debits</p><p className="text-sm font-bold text-danger-700">{formatCurrency(closing.bankDebits)}</p></div>
            <div className="bg-gold-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">UPI Collection</p><p className="text-sm font-bold text-gold-700">{formatCurrency(closing.upiCollection)}</p></div>
          </div>
          <Input label="Physical Cash Counted" type="number" {...form.field('physicalCash')} placeholder={String(closing.expectedClosingCash)} required />
          {physicalCash && Number(physicalCash) !== closing.expectedClosingCash && (
            <div className={`rounded-lg p-3 ${Math.abs(difference) > 100 ? 'bg-danger-50 border border-danger-200' : 'bg-warning-50 border border-warning-200'}`}>
              <p className={`text-sm font-medium ${Math.abs(difference) > 100 ? 'text-danger-700' : 'text-warning-700'}`}>CASH DIFFERENCE: {formatCurrency(Math.abs(difference))} {difference > 0 ? '(Surplus)' : '(Shortage)'}</p>
            </div>
          )}
          {closing.pendingApprovals > 0 && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-3"><p className="text-sm text-warning-700">{closing.pendingApprovals} payment approval(s) pending. Only the MD can override and close the day.</p></div>
          )}
          <TextArea label="Remarks (required if difference)" {...form.field('remarks')} placeholder="Explain any cash difference" rows={2} />
        </div>
      </Modal>
    </div>
  );
}

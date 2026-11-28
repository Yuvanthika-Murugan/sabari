import { useState } from 'react';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, Select, TextArea, FilterBar } from '@/components/FormControls';
import { DateFilterPanel } from '@/components/SmartFilters';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency, inDateRange } from '@/lib/format';
import type { Expense } from '@/types';
import { Banknote, Handshake, Landmark, Plus, Receipt, Save, Trash2 } from 'lucide-react';

/** Must match ExpenseController::CATEGORIES. */
const EXPENSE_CATEGORIES = [
  'Agent Handover', 'Staff Salary', 'Rent', 'Electricity', 'Stationery & Printing',
  'Travel', 'Tea & Refreshments', 'Telephone & Internet', 'Repairs & Maintenance', 'Customer Return', 'Other',
];
const HANDOVER = 'Agent Handover';

/**
 * Expenses: entry form and list. Cash expenses reduce Total Cash (and post to the
 * cash book), bank expenses reduce Total Bank on the dashboard.
 */
export default function Expenses() {
  const { expenses, agents, users, today } = useData();
  const { currentUser } = useApp();
  const canEnter = ['md', 'admin', 'manager'].includes(currentUser?.role ?? '');
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';

  const blank = { date: today, category: '', amount: '', paymentMode: 'cash', agentId: '', staffId: '', remarks: '' };
  const form = useForm(blank);
  const v = form.values;
  const { run, busy } = useAction();
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const agentOptions = agents.filter(a => a.status === 'active' || a.id === v.agentId).map(a => ({ value: a.id, label: `${a.name} (${a.agentCode})` }));
  const needsAgent = v.category === HANDOVER;
  const problem = !v.category ? 'Choose a category' : !(Number(v.amount) > 0) ? 'Enter the amount' : needsAgent && !v.agentId ? 'Select the agent for the handover' : '';

  const save = async () => {
    if (problem) return;
    if (await form.submit(x => api.post<{ expenseNo: string }>('/expenses', x), r => `Expense ${r.expenseNo} saved`)) {
      form.reset({ ...blank, date: v.date, paymentMode: v.paymentMode });
    }
  };
  const remove = async () => {
    if (deleting && await run(() => api.delete(`/expenses/${deleting.id}`), `Expense ${deleting.expenseNo} deleted`)) setDeleting(null);
  };

  // ----- List -----
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const rows = expenses.filter(e => inDateRange(e.date, from, to)
    && (!categoryFilter || e.category === categoryFilter)
    && (!modeFilter || e.paymentMode === modeFilter)
    && (!agentFilter || e.agentId === agentFilter));
  const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);
  const handover = sum(rows.filter(e => e.category === HANDOVER));

  const columns = [
    { key: 'expenseNo', label: 'Expense No', sortable: true, render: (e: Expense) => <span className="font-mono text-xs text-primary-600">{e.expenseNo}</span> },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'category', label: 'Category', sortable: true, render: (e: Expense) => e.category === HANDOVER ? <Badge variant="gold">{e.category}</Badge> : <span>{e.category}</span> },
    { key: 'agentName', label: 'Agent (Handover)', render: (e: Expense) => e.agentName || '-' },
    { key: 'staffName', label: 'Staff', render: (e: Expense) => e.staffName || '-' },
    { key: 'amount', label: 'Amount', sortable: true, render: (e: Expense) => <span className="text-danger-600 font-medium">{formatCurrency(e.amount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (e: Expense) => <Badge variant={e.paymentMode === 'cash' ? 'success' : 'blue'}>{e.paymentMode.toUpperCase()}</Badge> },
    { key: 'remarks', label: 'Remarks', render: (e: Expense) => <span className="text-xs text-gray-600">{e.remarks || '-'}</span> },
    { key: 'createdBy', label: 'Entered By' },
    ...(canDelete ? [{ key: 'actions', label: '', render: (e: Expense) => (
      <button onClick={() => setDeleting(e)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
    )}] : []),
  ];

  const toggle = (value: string, label: string, Icon: typeof Banknote) => (
    <button type="button" onClick={() => form.set('paymentMode', value)}
      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${v.paymentMode === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Expenses" subtitle="Office expenses and cash handed over to agents" actions={<ExportButtons filename="expenses" rows={rows} />} />

      {canEnter && (
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6 print:hidden">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-4"><Plus className="w-5 h-5 text-primary-600" /> New Expense</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input label="Date" type="date" {...form.field('date')} required />
            <Select label="Category" {...form.field('category')} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} required placeholder="Select category..." />
            <Input label="Amount" type="number" min={1} {...form.field('amount')} required placeholder="0" />
            <div>
              <p className="block text-xs font-medium text-gray-600 mb-1">Payment Mode <span className="text-danger-500">*</span></p>
              <div className="flex gap-2">{toggle('cash', 'Cash', Banknote)}{toggle('bank', 'Bank', Landmark)}</div>
            </div>
            <Select label="Agent Name (handover)" {...form.field('agentId')} options={agentOptions} required={needsAgent}
              placeholder={agentOptions.length ? (needsAgent ? 'Select agent...' : 'None') : 'No agents — add one under Users › Agents'} />
            <Select label="Collection Staff (debit)" {...form.field('staffId')} placeholder="Office (none)"
              options={users.filter(u => u.role === 'staff' && u.status === 'active').map(u => ({ value: u.id, label: u.name }))} />
            <TextArea label="Remarks" {...form.field('remarks')} placeholder="e.g. Bus fare for collection round" rows={1} className="lg:col-span-2" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mr-auto">Cash expenses reduce Total Cash; bank expenses reduce Total Bank. Agent handovers are tracked by agent.</p>
            <button onClick={() => form.reset(blank)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Clear</button>
            <button onClick={save} disabled={!!problem || form.submitting} title={problem || undefined} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md disabled:opacity-50"><Save className="w-4 h-4" /> Save Expense</button>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Expense List</h3>
      <DateFilterPanel label="Expense Date" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} today={today}>
        <span className="flex items-center gap-1"><Receipt className="w-4 h-4" /> {rows.length} expenses · <span className="font-semibold text-gray-900">{formatCurrency(sum(rows))}</span></span>
      </DateFilterPanel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Cash Expenses" value={formatCurrency(sum(rows.filter(e => e.paymentMode === 'cash')))} icon={<Banknote className="w-6 h-6" />} color="warning" />
        <KPICard title="Bank Expenses" value={formatCurrency(sum(rows.filter(e => e.paymentMode === 'bank')))} icon={<Landmark className="w-6 h-6" />} color="primary" />
        <KPICard title="Agent Handover" value={formatCurrency(handover)} icon={<Handshake className="w-6 h-6" />} color="gold" />
      </div>
      <FilterBar>
        <Select label="Category" value={categoryFilter} onChange={setCategoryFilter} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))} placeholder="All categories" />
        <Select label="Payment Mode" value={modeFilter} onChange={setModeFilter} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }]} placeholder="All modes" />
        <Select label="Agent" value={agentFilter} onChange={setAgentFilter} options={agents.map(a => ({ value: a.id, label: a.name }))} placeholder="All agents" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['expenseNo', 'category', 'agentName', 'remarks']} pageSize={10} emptyMessage="No expenses for these filters" />

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete Expense" size="sm"
        footer={<ModalFooter onCancel={() => setDeleting(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        {deleting && (
          <p className="text-sm text-gray-600">
            Delete <span className="font-mono">{deleting.expenseNo}</span> ({deleting.category}, {formatCurrency(deleting.amount)})?
            {deleting.paymentMode === 'cash' && ' A reversing entry is posted to today\'s cash book.'}
          </p>
        )}
      </Modal>
    </div>
  );
}

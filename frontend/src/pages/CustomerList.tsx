import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import Badge from '@/components/Badge';
import { Input, PhoneInput, Select, TextArea, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import PhotoInput, { CustomerAvatar } from '@/components/PhotoInput';
import { api } from '@/lib/api';
import { daysBetween, formatCurrency } from '@/lib/format';
import { currentPosition } from '@/lib/geo';
import { mapsEmbed, mapsLink } from '@/lib/maps';
import { useToast } from '@/context/ToastContext';
import type { Agent, Customer, DueSchedule } from '@/types';
import { UserPlus, Eye, Edit, Trash2, Printer, CheckCircle2, Handshake, Phone, X, CalendarClock, LocateFixed } from 'lucide-react';

/** Paid / overdue (with days) / due today / upcoming, for one instalment. */
function DueBadge({ due, today }: { due: DueSchedule; today: string }) {
  if (due.pendingAmount <= 0) return <Badge variant="success">Paid</Badge>;
  if (due.dueDate < today) return <Badge variant="danger">Overdue {daysBetween(due.dueDate, today)}d</Badge>;
  if (due.dueDate === today) return <Badge variant="warning">Due today</Badge>;
  return <Badge variant={due.paidAmount > 0 ? 'gold' : 'gray'}>{due.paidAmount > 0 ? 'Part paid' : 'Upcoming'}</Badge>;
}

/** When the customer pays next: date, instalment and amount, coloured by urgency. */
function NextDue({ due, today, inline = false }: { due?: DueSchedule; today: string; inline?: boolean }) {
  if (!due) return <span className="text-success-600 font-medium">All paid</span>;
  const tone = due.dueDate < today ? 'text-danger-600' : due.dueDate === today ? 'text-warning-700' : 'text-gray-900';
  if (inline) return <span className={`font-semibold ${tone}`}>{due.dueDate} · #{due.dueNumber} · {formatCurrency(due.pendingAmount)}</span>;
  return (
    <div className="whitespace-nowrap">
      <p className={`text-sm font-medium ${tone}`}>{due.dueDate}</p>
      <p className="text-[11px] text-gray-500">#{due.dueNumber} · {formatCurrency(due.pendingAmount)}{due.dueDate < today ? ` · ${daysBetween(due.dueDate, today)}d late` : due.dueDate === today ? ' · today' : ''}</p>
    </div>
  );
}

/**
 * Shown when an agent is picked in the filter: the agent's details, totals for their
 * customers, and every unpaid instalment of those customers in date order, so the
 * office sees who pays when.
 */
function AgentPanel({ agent, customers, unpaidBy, today, onClear }: {
  agent: Agent; customers: Customer[]; unpaidBy: Map<string, DueSchedule[]>; today: string; onClear: () => void;
}) {
  const byId = new Map(customers.map(c => [c.id, c]));
  const dues = customers.flatMap(c => unpaidBy.get(c.id) ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = dues.filter(d => d.dueDate < today);
  const dueToday = dues.filter(d => d.dueDate === today);
  const weekEnd = new Date(Date.parse(today) + 7 * 86_400_000).toISOString().slice(0, 10);
  const thisWeek = dues.filter(d => d.dueDate > today && d.dueDate <= weekEnd);
  const sum = (xs: DueSchedule[]) => xs.reduce((s, d) => s + d.pendingAmount, 0);
  const tiles = [
    { label: 'Customers', value: String(customers.length), sub: `${customers.filter(c => c.status === 'active').length} active`, tone: 'text-gray-900' },
    { label: 'Overdue', value: formatCurrency(sum(overdue)), sub: `${new Set(overdue.map(d => d.customerId)).size} customers`, tone: 'text-danger-600' },
    { label: 'Due today', value: formatCurrency(sum(dueToday)), sub: `${dueToday.length} instalments`, tone: 'text-warning-700' },
    { label: 'Next 7 days', value: formatCurrency(sum(thisWeek)), sub: `${thisWeek.length} instalments`, tone: 'text-primary-700' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-card border border-primary-100 p-4 sm:p-5 mb-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center flex-shrink-0"><Handshake className="w-6 h-6" /></div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{agent.name} <span className="text-xs font-mono font-normal text-gray-400">{agent.agentCode}</span></p>
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{agent.mobile}</span>
              <span>Commission {agent.commissionPct}%</span>
              <span>{agent.loginEmail ? `Login: ${agent.loginEmail}` : 'No login'}</span>
            </p>
          </div>
        </div>
        <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Clear</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-4">
        {tiles.map(t => (
          <div key={t.label} className="rounded-lg bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
            <p className={`text-lg font-bold tabular-nums ${t.tone}`}>{t.value}</p>
            <p className="text-[11px] text-gray-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2"><CalendarClock className="w-4 h-4 text-primary-600" /> When these customers pay</h4>
      {dues.length === 0 ? <p className="text-sm text-gray-400 py-2">No unpaid instalments for this agent's customers.</p> : (
        <div className="overflow-x-auto scrollbar-thin max-h-80 border border-gray-100 rounded-lg">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['Due Date', 'Customer', 'Mobile', '#'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dues.map(d => {
                const c = byId.get(d.customerId);
                return (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{d.dueDate}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{c?.name} <span className="text-[11px] font-mono text-gray-400">{c?.customerId}</span></td>
                    <td className="px-3 py-2 text-sm text-gray-500">{c?.mobile}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{d.dueNumber}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums font-medium">{formatCurrency(d.pendingAmount)}</td>
                    <td className="px-3 py-2"><DueBadge due={d} today={today} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const emptyCustomer = {
  name: '', fatherSpouseName: '', mobile: '', altMobile: '', branchId: '', staffId: '', agentId: '', groupId: '',
  /** Add only: the group is found from its chit value and period (number of instalments). */
  chitValue: '', period: '',
  area: '', joiningDate: '', status: 'active', address: '',
  /** Map location of the customer's house / shop. */
  latitude: '', longitude: '',
  nomineeName: '', nomineeRelation: '', nomineeMobile: '',
  /** A newly chosen photo (data URL) and whether the saved one should be removed. */
  photoData: '', removePhoto: '',
};

/**
 * Customer category, worked out from the dues: anyone with an installment past
 * its due date and still unpaid (arrears) is an AR Subscriber; everyone else is
 * a Group Customer. It changes by itself once the arrears are paid.
 */
type Category = 'ar' | 'group';
const categoryLabel: Record<Category, string> = { ar: 'AR Subscriber', group: 'Group Customer' };
const categoryOptions = (Object.keys(categoryLabel) as Category[]).map(k => ({ value: k, label: categoryLabel[k] }));

export default function CustomerList() {
  const { customers, dueSchedules, branches, groups, users, areas, agents, today } = useData();
  const { currentUser } = useApp();
  const location = useLocation();
  const canManage = currentUser?.role !== 'staff';
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const form = useForm({ ...emptyCustomer, joiningDate: today });
  const { run, busy } = useAction();
  const toast = useToast();

  const [editing, setEditing] = useState<Customer | 'new' | null>(location.pathname.endsWith('/add') ? 'new' : null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Customer | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  // An agent's id, or 'direct' for customers who came without an agent.
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Arrears per customer: unpaid amounts of installments already past their due date.
  const arrearsBy = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) arrearsBy.set(d.customerId, (arrearsBy.get(d.customerId) ?? 0) + d.pendingAmount);
  }
  // Each customer's unpaid instalments, earliest first: the first one is when they pay next.
  const unpaidBy = new Map<string, DueSchedule[]>();
  for (const d of [...dueSchedules].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.dueNumber - b.dueNumber)) {
    if (d.pendingAmount > 0) unpaidBy.set(d.customerId, [...(unpaidBy.get(d.customerId) ?? []), d]);
  }
  const rows = customers.map(c => {
    const arrears = arrearsBy.get(c.id) ?? 0;
    const category: Category = arrears > 0 ? 'ar' : 'group';
    const nextDue = unpaidBy.get(c.id)?.[0];
    return {
      ...c, arrears, category, categoryName: categoryLabel[category],
      agentName: agents.find(a => a.id === c.agentId)?.name ?? '',
      nextDue, nextDueDate: nextDue?.dueDate ?? '',
    };
  });
  type Row = (typeof rows)[number];

  const filtered = rows.filter(c =>
    (!branchFilter || c.branchId === branchFilter) &&
    (!groupFilter || c.groupId === groupFilter) &&
    (!staffFilter || c.staffId === staffFilter) &&
    (!agentFilter || (agentFilter === 'direct' ? !c.agentId : c.agentId === agentFilter)) &&
    (!statusFilter || c.status === statusFilter) &&
    (!categoryFilter || c.category === categoryFilter) &&
    inDateRange(c.joiningDate, fromDate, toDate)
  );

  const viewCustomer = rows.find(c => c.id === showView);
  const viewSchedule = viewCustomer ? dueSchedules.filter(d => d.customerId === viewCustomer.id).sort((a, b) => a.dueNumber - b.dueNumber) : [];
  const pickedAgent = agents.find(a => a.id === agentFilter);
  const staffOptions = users.filter(u => u.role === 'staff' && u.status === 'active' && (!form.values.branchId || u.branchId === form.values.branchId)).map(u => ({ value: u.id, label: u.name }));
  const branchGroups = groups.filter(g => g.status === 'active' && (!form.values.branchId || g.branchId === form.values.branchId));
  const chitValueOptions = [...new Set(branchGroups.map(g => g.groupValue))].sort((a, b) => a - b)
    .map(v => ({ value: String(v), label: formatCurrency(v) }));
  // Groups with the chosen chit value and typed period. One match is used as is; several need a pick.
  const matchingGroups = form.values.chitValue && form.values.period
    ? branchGroups.filter(g => g.groupValue === Number(form.values.chitValue) && g.duration === Number(form.values.period))
    : [];
  const groupOptions = matchingGroups.map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode})` }));
  const resolvedGroupId = matchingGroups.length === 1 ? matchingGroups[0].id
    : matchingGroups.some(g => g.id === form.values.groupId) ? form.values.groupId : '';
  // Periods (instalments) of the active groups with a chit value; the Period list shows only these.
  const periodsFor = (value: string) => [...new Set(branchGroups.filter(g => g.groupValue === Number(value)).map(g => g.duration))].sort((a, b) => a - b);
  const periodsForValue = periodsFor(form.values.chitValue);
  const periodOptions = periodsForValue.map(p => {
    const freqs = [...new Set(branchGroups.filter(g => g.groupValue === Number(form.values.chitValue) && g.duration === p).map(g => g.frequency))];
    return { value: String(p), label: `${p} instalments${freqs.length === 1 ? ` (${freqs[0]})` : ''}` };
  });
  // Choosing a chit value fills in the period automatically when there is only one; a
  // period that no longer fits is cleared.
  const pickChitValue = (value: string) => {
    form.set('chitValue', value);
    const ps = periodsFor(value);
    form.set('period', ps.length === 1 ? String(ps[0]) : ps.includes(Number(form.values.period)) ? form.values.period : '');
    form.set('groupId', '');
  };
  const groupMatchNote = !form.values.chitValue || !form.values.period ? ''
    : matchingGroups.length === 0 ? `No active scheme${form.values.branchId ? ' in this branch' : ''} has this chit value and period. Available periods: ${periodsForValue.join(', ') || 'none'}.`
    : matchingGroups.length === 1 ? `Scheme Type: ${matchingGroups[0].groupName} (${matchingGroups[0].groupCode}), ${matchingGroups[0].frequency}`
    : '';
  const areaOptions = areas.filter(a => a.branchId === form.values.branchId && (a.status === 'active' || a.name === form.values.area)).map(a => ({ value: a.name, label: a.name }));
  if (form.values.area && !areaOptions.some(o => o.value === form.values.area)) areaOptions.push({ value: form.values.area, label: form.values.area });
  const agentOptions = agents.filter(a => a.status === 'active' || a.id === form.values.agentId).map(a => ({ value: a.id, label: `${a.name} (${a.agentCode})` }));

  // Customer location: from this device's GPS, or typed / pasted ("lat, lng" fills both).
  const [locating, setLocating] = useState(false);
  const fillMyLocation = async () => {
    setLocating(true);
    const p = await currentPosition();
    setLocating(false);
    if (!p) { toast('error', 'Could not get the location. Allow location for this site and try again.'); return; }
    form.set('latitude', p.latitude.toFixed(7));
    form.set('longitude', p.longitude.toFixed(7));
  };
  const setLatitude = (v: string) => {
    const m = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { form.set('latitude', m[1]); form.set('longitude', m[2]); } else form.set('latitude', v.trim());
  };

  const openForm = (c: Customer | 'new') => {
    form.reset(c === 'new' ? { ...emptyCustomer, joiningDate: today } : {
      name: c.name, fatherSpouseName: c.fatherSpouseName, mobile: c.mobile, altMobile: c.altMobile, branchId: c.branchId,
      staffId: c.staffId, agentId: c.agentId, groupId: c.groupId, chitValue: '', period: '', area: c.area, joiningDate: c.joiningDate, status: c.savedStatus, address: c.address,
      latitude: c.latitude ?? '', longitude: c.longitude ?? '',
      nomineeName: c.nomineeName, nomineeRelation: c.nomineeRelation, nomineeMobile: c.nomineeMobile,
      photoData: '', removePhoto: '',
    });
    setEditing(c);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post<Customer>('/customers', { ...v, groupId: resolvedGroupId }) : api.put<Customer>(`/customers/${(editing as Customer).id}`, v),
      c => editing === 'new' ? `Customer added with ID ${c.customerId}` : 'Customer updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/customers/${showDelete.id}`), 'Customer deleted')) setShowDelete(null);
  };

  const columns = [
    { key: 'customerId', label: 'Customer ID', sortable: true, render: (c: Customer) => <span className="font-mono text-xs text-primary-600">{c.customerId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (c: Customer) => (
      <div className="flex items-center gap-2">
        <CustomerAvatar name={c.name} photo={c.photo} />
        <div><p className="font-medium text-gray-900">{c.name}</p>{c.firstDueCompleted && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />1st Due Done</Badge>}</div>
      </div>
    )},
    { key: 'mobile', label: 'Phone', render: (c: Customer) => <span className="text-gray-500">{c.mobile}</span> },
    { key: 'branchId', label: 'Branch', render: (c: Customer) => branches.find(b => b.id === c.branchId)?.name ?? '-' },
    { key: 'groupId', label: 'Scheme Type',render: (c: Customer) => groups.find(g => g.id === c.groupId)?.groupName ?? '-' },
    { key: 'categoryName', label: 'Category', sortable: true, render: (c: Row) => (
      <div>
        <Badge variant={c.category === 'ar' ? 'danger' : 'primary'}>{c.categoryName}</Badge>
        {c.category === 'ar' && <p className="text-[11px] text-danger-600 mt-0.5 whitespace-nowrap">{formatCurrency(c.arrears)} overdue</p>}
      </div>
    )},
    { key: 'staffId', label: 'Staff',render: (c: Customer) => users.find(u => u.id === c.staffId)?.name ?? '-' },
    { key: 'agentName', label: 'Agent', sortable: true, render: (c: Row) => c.agentName || <span className="text-gray-400">Direct</span> },
    { key: 'joiningDate', label: 'Joined', sortable: true },
    { key: 'nextDueDate', label: 'Next Payment', sortable: true, render: (c: Row) => <NextDue due={c.nextDue} today={today} /> },
    { key: 'totalDue', label: 'Total Due', sortable: true, render: (c: Customer) => formatCurrency(c.totalDue) },
    { key: 'paid', label: 'Paid', sortable: true, render: (c: Customer) => <span className="text-success-600 font-medium">{formatCurrency(c.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (c: Customer) => <span className={c.pending > 0 ? 'text-danger-600 font-medium' : ''}>{formatCurrency(c.pending)}</span> },
    { key: 'status', label: 'Status', render: (c: Customer) => (
      <div><StatusBadge status={c.status} />{c.autoInactive && <p className="text-[11px] text-danger-600 mt-0.5 whitespace-nowrap">{c.daysUnpaid} days unpaid</p>}</div>
    )},
    { key: 'actions', label: 'Actions', render: (c: Customer) => (
      <div className="flex gap-1">
        <button onClick={() => setShowView(c.id)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="View" aria-label="View"><Eye className="w-4 h-4" /></button>
        {canManage && <button onClick={() => openForm(c)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Edit" aria-label="Edit"><Edit className="w-4 h-4" /></button>}
        <button onClick={() => { setShowView(c.id); setTimeout(() => window.print(), 100); }} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Print" aria-label="Print"><Printer className="w-4 h-4" /></button>
        {canDelete && <button onClick={() => setShowDelete(c)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Customer List" subtitle={`${filtered.length} customers`} actions={
        <>
          <ExportButtons filename="customers" rows={filtered} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md"><UserPlus className="w-4 h-4" /> Add Customer</button>}
        </>
      } />

      <FilterBar>
        <DateRangeFilter label="Joined" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
        <Select label="Scheme Type" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All Schemes" />
        <Select label="Category" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} placeholder="All Categories" />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All Staff" />
        <Select label="Agent" value={agentFilter} onChange={setAgentFilter} placeholder="All Agents"
          options={[...agents.map(a => ({ value: a.id, label: `${a.name} (${a.agentCode})` })), { value: 'direct', label: 'Direct (no agent)' }]} />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'closed', label: 'Closed' }]} placeholder="All Status" />
      </FilterBar>

      {/* An agent picked: their details, totals and when each of their customers pays. */}
      {pickedAgent && <AgentPanel agent={pickedAgent} customers={filtered} unpaidBy={unpaidBy} today={today} onClear={() => setAgentFilter('')} />}

      <DataTable columns={columns} data={filtered} searchKeys={['name', 'customerId', 'mobile']} pageSize={10} />

      {/* Add/Edit Customer Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Customer' : 'Edit Customer'} size="xl"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save Customer" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <PhotoInput
              current={editing && editing !== 'new' ? editing.photo : null}
              value={form.values.photoData}
              removed={form.values.removePhoto === '1'}
              onChange={dataUrl => { form.set('photoData', dataUrl); form.set('removePhoto', ''); }}
              onRemove={() => { form.set('photoData', ''); form.set('removePhoto', '1'); }}
              error={form.errors.photo}
            />
            <p className="text-xs font-medium text-gray-600">Customer ID <span className="text-primary-600 font-mono">{editing === 'new' ? 'generated on save' : (editing as Customer | null)?.customerId}</span></p>
          </div>
          <Input label="Customer Name" format="name" check={checks.name} maxLength={120} {...form.field('name')} placeholder="Full Name" required />
          <Input label="Father / Spouse Name" format="name" check={checks.name} maxLength={120} {...form.field('fatherSpouseName')} placeholder="Guardian Name" />
          <PhoneInput label="Mobile Number" {...form.field('mobile')} required />
          <PhoneInput label="Alternative Number" {...form.field('altMobile')} />
          <Select label="Branch" {...form.field('branchId')} options={branches.map(b => ({ value: b.id, label: b.name }))} required disabled={editing !== 'new'} />
          <Select label="Collection Staff" {...form.field('staffId')} options={staffOptions} required disabled={editing !== 'new'} />
          {editing === 'new' && <>
            <Select label="Chit Value" {...form.field('chitValue')} onChange={pickChitValue} options={chitValueOptions} required
              placeholder={chitValueOptions.length ? 'Select...' : 'No active groups'}
              error={form.errors.chitValue ?? (matchingGroups.length <= 1 ? form.errors.groupId : undefined)} />
            <Select label="Period" {...form.field('period')} options={periodOptions} required
              placeholder={!form.values.chitValue ? 'Select chit value first' : periodOptions.length ? 'Select...' : 'No period for this value'}
              disabled={!form.values.chitValue} />
            {matchingGroups.length > 1 && <Select label="Scheme Type" {...form.field('groupId')} options={groupOptions} required className="col-span-full" />}
            {groupMatchNote && <p className={`col-span-full text-xs ${matchingGroups.length ? 'text-gray-500' : 'text-danger-600'}`}>{groupMatchNote}</p>}
          </>}
          <Select label="Area" {...form.field('area')} options={areaOptions} placeholder={form.values.branchId ? 'Select area...' : 'Select a branch first'} />
          <Select label="Agent" {...form.field('agentId')} options={agentOptions} placeholder="No agent (direct)" />
          <Input label="Joining Date" type="date" {...form.field('joiningDate')} required />
          <Select label="Customer Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'closed', label: 'Closed' }]} />
          {editing && editing !== 'new' && editing.autoInactive && form.values.status === 'active' && (
            <p className="col-span-full text-xs text-danger-600">Shown as Inactive: the oldest due is {editing.daysUnpaid} days unpaid. It becomes Active again once the overdue dues are paid.</p>
          )}
          <TextArea label="Address" {...form.field('address')} placeholder="Full Address" className="col-span-full" />

          {/* Where the customer lives / works: pinned on the collection route map. */}
          <div className="col-span-full flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Customer Location (map)</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={fillMyLocation} disabled={locating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50">
                <LocateFixed className="w-3.5 h-3.5" /> {locating ? 'Getting location…' : 'Use my current location'}
              </button>
              {(form.values.latitude || form.values.longitude) && (
                <button type="button" onClick={() => { form.set('latitude', ''); form.set('longitude', ''); }}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Clear</button>
              )}
            </div>
          </div>
          <Input label="Latitude" {...form.field('latitude')} onChange={setLatitude} placeholder="e.g. 8.8019395" />
          <Input label="Longitude" {...form.field('longitude')} placeholder="e.g. 78.1561879" />
          <p className="col-span-full -mt-2 text-xs text-gray-500">Tip: in Google Maps, long-press the customer's house and copy the numbers shown (latitude, longitude). Paste "8.80, 78.15" into Latitude to fill both.</p>
          {form.values.latitude && form.values.longitude && (
            <div className="col-span-full rounded-lg overflow-hidden border border-gray-200">
              <iframe title="Customer location" src={mapsEmbed({ lat: form.values.latitude, lng: form.values.longitude }, 17)} className="w-full h-48 border-0" loading="lazy" />
            </div>
          )}

          <p className="col-span-full text-sm font-semibold text-gray-700 pt-2 border-t border-gray-100">Nominee Details</p>
          <Input label="Nominee Name" format="name" check={checks.name} maxLength={120} {...form.field('nomineeName')} placeholder="Nominee's full name" />
          <Input label="Nominee Relationship" format="name" check={checks.name} maxLength={60} {...form.field('nomineeRelation')} placeholder="e.g. Wife, Son, Father" />
          <PhoneInput label="Nominee Mobile Number" {...form.field('nomineeMobile')} />
          {editing === 'new'
            ? <p className="col-span-full text-xs text-gray-500">The customer joins the active scheme with this chit value and period. The due schedule is generated from that scheme's value, members, instalments and frequency, starting one period after the joining date.</p>
            : <p className="col-span-full text-xs text-gray-500">To change the branch, staff or scheme type, use Customer Transfer so the move is recorded.</p>}
        </div>
      </Modal>

      {/* View Customer */}
      <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Customer Details" size="xl">
        {viewCustomer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <CustomerAvatar name={viewCustomer.name} photo={viewCustomer.photo} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewCustomer.name}</h3>
                <p className="text-sm text-gray-500">{viewCustomer.customerId} • {viewCustomer.mobile}</p>
                {viewCustomer.firstDueCompleted && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />1st Due Completed</Badge>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Father/Spouse</p><p className="font-medium">{viewCustomer.fatherSpouseName || '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Alt. Number</p><p className="font-medium">{viewCustomer.altMobile || '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Branch</p><p className="font-medium">{branches.find(b => b.id === viewCustomer.branchId)?.name}</p></div>
              <div><p className="text-gray-500 text-xs">Scheme Type</p><p className="font-medium">{groups.find(g => g.id === viewCustomer.groupId)?.groupName ?? '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Category</p><p className="font-medium">{viewCustomer.categoryName}{viewCustomer.category === 'ar' && <span className="text-danger-600"> · {formatCurrency(viewCustomer.arrears)} overdue</span>}</p></div>
              <div><p className="text-gray-500 text-xs">Staff</p><p className="font-medium">{users.find(u => u.id === viewCustomer.staffId)?.name ?? '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Agent</p><p className="font-medium">{agents.find(a => a.id === viewCustomer.agentId)?.name ?? 'Direct'}</p></div>
              <div><p className="text-gray-500 text-xs">Area</p><p className="font-medium">{viewCustomer.area || '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Joining Date</p><p className="font-medium">{viewCustomer.joiningDate}</p></div>
              <div><p className="text-gray-500 text-xs">Nominee</p><p className="font-medium">{viewCustomer.nomineeName ? `${viewCustomer.nomineeName}${viewCustomer.nomineeRelation ? ` (${viewCustomer.nomineeRelation})` : ''}` : '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Nominee Mobile</p><p className="font-medium">{viewCustomer.nomineeMobile || '-'}</p></div>
              <div className="col-span-full"><p className="text-gray-500 text-xs">Address</p><p className="font-medium">{[viewCustomer.address, viewCustomer.area].filter(Boolean).join(', ') || '-'}</p></div>
              <div className="col-span-full">
                <p className="text-gray-500 text-xs mb-1">Location</p>
                {viewCustomer.latitude && viewCustomer.longitude ? (
                  <>
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <iframe title="Customer location" src={mapsEmbed({ lat: viewCustomer.latitude, lng: viewCustomer.longitude }, 17)} className="w-full h-48 border-0" loading="lazy" />
                    </div>
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                      <span className="tabular-nums">{viewCustomer.latitude}, {viewCustomer.longitude}</span>
                      <a href={mapsLink({ lat: viewCustomer.latitude, lng: viewCustomer.longitude })} target="_blank" rel="noreferrer" className="font-medium text-primary-600 hover:underline">Open in Google Maps</a>
                    </p>
                  </>
                ) : <p className="text-sm text-gray-400">Not set. Use Edit → "Use my current location", or the collection staff / agent can save it from their app.</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
              <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Due</p><p className="text-lg font-bold text-primary-700">{formatCurrency(viewCustomer.totalDue)}</p></div>
              <div className="bg-success-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Paid</p><p className="text-lg font-bold text-success-700">{formatCurrency(viewCustomer.paid)}</p></div>
              <div className="bg-danger-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-danger-700">{formatCurrency(viewCustomer.pending)}</p></div>
            </div>

            {/* When each instalment is due and what has been paid. */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Payment Schedule</h4>
                <span className="text-xs text-gray-500">Next payment: <NextDue due={viewCustomer.nextDue} today={today} inline /></span>
              </div>
              <div className="overflow-x-auto scrollbar-thin max-h-72 border border-gray-100 rounded-lg">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['#', 'Due Date'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                      {['Amount', 'Paid', 'Balance'].map(h => <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                      {['Status', 'Paid On'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {viewSchedule.map(d => (
                      <tr key={d.id} className={d.id === viewCustomer.nextDue?.id ? 'bg-primary-50/60' : ''}>
                        <td className="px-3 py-2 text-sm text-gray-500">{d.dueNumber}</td>
                        <td className="px-3 py-2 text-sm whitespace-nowrap">{d.dueDate}</td>
                        <td className="px-3 py-2 text-sm text-right tabular-nums">{formatCurrency(d.dueAmount)}</td>
                        <td className="px-3 py-2 text-sm text-right tabular-nums text-success-600">{d.paidAmount ? formatCurrency(d.paidAmount) : '-'}</td>
                        <td className="px-3 py-2 text-sm text-right tabular-nums text-danger-600">{d.pendingAmount ? formatCurrency(d.pendingAmount) : '-'}</td>
                        <td className="px-3 py-2"><DueBadge due={d} today={today} /></td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{d.paymentDate ? `${d.paymentDate}${d.receiptNo ? ` · ${d.receiptNo}` : ''}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete <span className="font-medium">{showDelete?.name}</span>? Customers with collection history cannot be deleted — set their status to Closed instead.</p>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import KPICard from '@/components/KPICard';
import Badge from '@/components/Badge';
import { Select, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { daysBetween, formatCurrency } from '@/lib/format';
import type { Customer } from '@/types';
import { AlertCircle, Clock, Users } from 'lucide-react';

type Figures = { totalDue: number; paid: number; pending: number };

/**
 * Filters shared by every pending report, in this order: Staff → Batch (chit group)
 * → Branch → Date. The date range picks dues by their due date; with no dates the
 * customer's whole schedule counts.
 */
function usePendingFilters() {
  const { customers, branches, groups, users, dueSchedules } = useData();
  const [staff, setStaff] = useState('');
  const [batch, setBatch] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const scoped = customers.filter(c =>
    (!staff || c.staffId === staff) && (!batch || c.groupId === batch) && (!branch || c.branchId === branch));
  const dated = !!(from || to);
  const figures = (c: Customer): Figures => {
    if (!dated) return { totalDue: c.totalDue, paid: c.paid, pending: c.pending };
    const ds = dueSchedules.filter(d => d.customerId === c.id && inDateRange(d.dueDate, from, to));
    return {
      totalDue: ds.reduce((s, d) => s + d.dueAmount, 0),
      paid: ds.reduce((s, d) => s + d.paidAmount, 0),
      pending: ds.reduce((s, d) => s + d.pendingAmount, 0),
    };
  };
  const total = (list: Customer[]) => list.map(figures).reduce(
    (t, f) => ({ totalDue: t.totalDue + f.totalDue, paid: t.paid + f.paid, pending: t.pending + f.pending }),
    { totalDue: 0, paid: 0, pending: 0 });

  const bar = (extra?: React.ReactNode) => (
    <FilterBar>
      <Select label="Staff" value={staff} onChange={setStaff} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All Staff" />
      <Select label="Batch (Group)" value={batch} onChange={setBatch}
        options={groups.filter(g => !branch || g.branchId === branch).map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode})` }))} placeholder="All Batches" />
      <Select label="Branch" value={branch} onChange={setBranch} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
      <DateRangeFilter label="Due" from={from} to={to} onFrom={setFrom} onTo={setTo} />
      {extra}
    </FilterBar>
  );
  return { scoped, figures, total, bar, staff, batch, branch };
}

const pct = (f: Figures) => (f.totalDue ? Math.round((f.paid / f.totalDue) * 100) : 0);

export function CustomerPending() {
  const { branches, groups, users, dueSchedules, today } = useData();
  const { scoped, figures, bar } = usePendingFilters();
  const [statusFilter, setStatusFilter] = useState('');

  // Days since the oldest unpaid due that has fallen due.
  const overdueDays = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today && !overdueDays.has(d.customerId)) {
      overdueDays.set(d.customerId, daysBetween(d.dueDate, today));
    }
  }

  type Row = Customer & { daysOverdue: number };
  const pending: Row[] = scoped
    .map(c => ({ ...c, ...figures(c), daysOverdue: overdueDays.get(c.id) ?? 0 }))
    .filter(c => c.pending > 0 && (!statusFilter || (statusFilter === 'overdue') === c.daysOverdue > 0));

  const columns = [
    { key: 'name', label: 'Customer', sortable: true, render: (c: Row) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'mobile', label: 'Phone' },
    { key: 'staffId', label: 'Staff', render: (c: Row) => users.find(u => u.id === c.staffId)?.name ?? '-' },
    { key: 'groupId', label: 'Batch', render: (c: Row) => groups.find(g => g.id === c.groupId)?.groupName ?? '-' },
    { key: 'branchId', label: 'Branch', render: (c: Row) => branches.find(b => b.id === c.branchId)?.name ?? '-' },
    { key: 'totalDue', label: 'Due', sortable: true, render: (c: Row) => formatCurrency(c.totalDue) },
    { key: 'paid', label: 'Paid', sortable: true, render: (c: Row) => <span className="text-success-600">{formatCurrency(c.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (c: Row) => <span className="text-danger-600 font-bold">{formatCurrency(c.pending)}</span> },
    { key: 'daysOverdue', label: 'Days Overdue', sortable: true, render: (c: Row) => (
      <Badge variant={c.daysOverdue > 30 ? 'danger' : c.daysOverdue > 7 ? 'warning' : 'gray'}>{c.daysOverdue}d</Badge>
    )},
  ];

  const totalPending = pending.reduce((s, c) => s + c.pending, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Customer Pending" subtitle="Customers with pending dues" actions={<ExportButtons filename="customer-pending" rows={pending} />} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard title="Total Pending" value={formatCurrency(totalPending)} icon={<AlertCircle className="w-6 h-6" />} color="danger" />
        <KPICard title="Pending Customers" value={String(pending.length)} icon={<Users className="w-6 h-6" />} color="warning" />
        <KPICard title="Overdue Customers" value={String(pending.filter(c => c.daysOverdue > 0).length)} icon={<Clock className="w-6 h-6" />} color="danger" />
      </div>
      {bar(<Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'overdue', label: 'Overdue' }, { value: 'normal', label: 'Not yet due' }]} placeholder="All" />)}
      <DataTable columns={columns} data={pending} searchKeys={['name', 'mobile']} pageSize={10} />
    </div>
  );
}

const progress = (value: number, color: string) => (
  <div className="flex items-center gap-2"><div className="w-24 bg-gray-100 rounded-full h-2"><div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }} /></div><span className="text-xs font-medium">{value}%</span></div>
);

export function StaffWisePending() {
  const { users } = useData();
  const { scoped, total, bar, staff } = usePendingFilters();
  const rows = users.filter(u => u.role === 'staff' && (!staff || u.id === staff)).map(s => {
    const assigned = scoped.filter(c => c.staffId === s.id);
    const f = total(assigned);
    return { id: s.id, name: s.name, assigned: assigned.length, ...f, pct: pct(f) };
  });
  type Row = typeof rows[0];

  const columns = [
    { key: 'name', label: 'Staff', sortable: true, render: (s: Row) => (
      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">{s.name.charAt(0)}</div><span className="font-medium">{s.name}</span></div>
    )},
    { key: 'assigned', label: 'Assigned Customers', sortable: true },
    { key: 'totalDue', label: 'Total Due', sortable: true, render: (s: Row) => formatCurrency(s.totalDue) },
    { key: 'paid', label: 'Collected', sortable: true, render: (s: Row) => <span className="text-success-600 font-medium">{formatCurrency(s.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (s: Row) => <span className="text-danger-600 font-medium">{formatCurrency(s.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (s: Row) => progress(s.pct, 'bg-success-500') },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Staff-wise Pending" subtitle="Pending amounts by collection staff" actions={<ExportButtons filename="staff-pending" rows={rows} />} />
      {bar()}
      <DataTable columns={columns} data={rows} searchKeys={['name']} pageSize={10} />
    </div>
  );
}

export function GroupWisePending() {
  const { groups } = useData();
  const { scoped, total, bar, batch, branch } = usePendingFilters();
  const rows = groups.filter(g => (!batch || g.id === batch) && (!branch || g.branchId === branch)).map(g => {
    const members = scoped.filter(c => c.groupId === g.id);
    const f = total(members);
    return { id: g.id, name: g.groupName, code: g.groupCode, members: members.length, ...f, pct: pct(f) };
  });
  type Row = typeof rows[0];

  const columns = [
    { key: 'name', label: 'Batch (Group)', sortable: true, render: (g: Row) => <div><p className="font-medium">{g.name}</p><p className="text-xs text-gray-500 font-mono">{g.code}</p></div> },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'totalDue', label: 'Due', sortable: true, render: (g: Row) => formatCurrency(g.totalDue) },
    { key: 'paid', label: 'Collected', sortable: true, render: (g: Row) => <span className="text-success-600 font-medium">{formatCurrency(g.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (g: Row) => <span className="text-danger-600 font-medium">{formatCurrency(g.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (g: Row) => progress(g.pct, 'bg-gold-500') },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Batch-wise Pending" subtitle="Pending amounts by batch (chit group)" actions={<ExportButtons filename="batch-pending" rows={rows} />} />
      {bar()}
      <DataTable columns={columns} data={rows} searchKeys={['name', 'code']} pageSize={10} />
    </div>
  );
}

export function BranchWisePending() {
  const { branches } = useData();
  const { scoped, total, bar, branch } = usePendingFilters();
  const rows = branches.filter(b => !branch || b.id === branch).map(b => {
    const assigned = scoped.filter(c => c.branchId === b.id);
    const f = total(assigned);
    return { id: b.id, name: b.name, customers: assigned.length, ...f, pct: pct(f) };
  });
  type Row = typeof rows[0];

  const columns = [
    { key: 'name', label: 'Branch', sortable: true, render: (b: Row) => <span className="font-medium">{b.name}</span> },
    { key: 'customers', label: 'Customers', sortable: true },
    { key: 'totalDue', label: 'Due', sortable: true, render: (b: Row) => formatCurrency(b.totalDue) },
    { key: 'paid', label: 'Collected', sortable: true, render: (b: Row) => <span className="text-success-600 font-medium">{formatCurrency(b.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (b: Row) => <span className="text-danger-600 font-medium">{formatCurrency(b.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (b: Row) => progress(b.pct, 'bg-primary-500') },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Branch-wise Pending" subtitle="Pending amounts by branch" actions={<ExportButtons filename="branch-pending" rows={rows} />} />
      {bar()}
      <DataTable columns={columns} data={rows} searchKeys={['name']} pageSize={10} />
    </div>
  );
}

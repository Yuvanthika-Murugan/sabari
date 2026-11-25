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

export function CustomerPending() {
  const { customers, branches, groups, users, dueSchedules, today } = useData();
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Days since the oldest unpaid due that has fallen due.
  const overdueDays = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today && !overdueDays.has(d.customerId)) {
      overdueDays.set(d.customerId, daysBetween(d.dueDate, today));
    }
  }
  const daysOf = (c: Customer) => overdueDays.get(c.id) ?? 0;

  const pending = customers.filter(c => c.pending > 0 &&
    (!branchFilter || c.branchId === branchFilter) &&
    (!groupFilter || c.groupId === groupFilter) &&
    inDateRange(c.joiningDate, fromDate, toDate) &&
    (!statusFilter || (statusFilter === 'overdue') === daysOf(c) > 0)
  ).map(c => ({ ...c, daysOverdue: daysOf(c) }));

  const columns = [
    { key: 'name', label: 'Customer', sortable: true, render: (c: Customer & { daysOverdue: number }) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'mobile', label: 'Phone' },
    { key: 'branchId', label: 'Branch', render: (c: Customer & { daysOverdue: number }) => branches.find(b => b.id === c.branchId)?.name },
    { key: 'groupId', label: 'Group', render: (c: Customer & { daysOverdue: number }) => groups.find(g => g.id === c.groupId)?.groupName },
    { key: 'staffId', label: 'Staff', render: (c: Customer & { daysOverdue: number }) => users.find(u => u.id === c.staffId)?.name },
    { key: 'totalDue', label: 'Due', sortable: true, render: (c: Customer & { daysOverdue: number }) => formatCurrency(c.totalDue) },
    { key: 'paid', label: 'Paid', sortable: true, render: (c: Customer & { daysOverdue: number }) => <span className="text-success-600">{formatCurrency(c.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (c: Customer & { daysOverdue: number }) => <span className="text-danger-600 font-bold">{formatCurrency(c.pending)}</span> },
    { key: 'daysOverdue', label: 'Days Overdue', sortable: true, render: (c: Customer & { daysOverdue: number }) => {
      const days = c.daysOverdue;
      return <Badge variant={days > 30 ? 'danger' : days > 7 ? 'warning' : 'gray'}>{days}d</Badge>;
    }},
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
      <FilterBar>
        <DateRangeFilter label="Joined" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All" />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All" />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{value:'overdue',label:'Overdue'},{value:'normal',label:'Not yet due'}]} placeholder="All" />
      </FilterBar>
      <DataTable columns={columns} data={pending} searchKeys={['name','mobile']} pageSize={10} />
    </div>
  );
}

export function StaffWisePending() {
  const { customers, users } = useData();
  const staff = users.filter(u => u.role === 'staff');
  const staffPending = staff.map(s => {
    const assigned = customers.filter(c => c.staffId === s.id);
    const totalDue = assigned.reduce((sum, c) => sum + c.totalDue, 0);
    const collected = assigned.reduce((sum, c) => sum + c.paid, 0);
    const pending = assigned.reduce((sum, c) => sum + c.pending, 0);
    return { id: s.id, name: s.name, assigned: assigned.length, totalDue, collected, pending, pct: totalDue ? Math.round((collected / totalDue) * 100) : 0 };
  });

  const columns = [
    { key: 'name', label: 'Staff', sortable: true, render: (s: typeof staffPending[0]) => (
      <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">{s.name.charAt(0)}</div><span className="font-medium">{s.name}</span></div>
    )},
    { key: 'assigned', label: 'Assigned Customers', sortable: true },
    { key: 'totalDue', label: 'Total Due', sortable: true, render: (s: typeof staffPending[0]) => formatCurrency(s.totalDue) },
    { key: 'collected', label: 'Collected', sortable: true, render: (s: typeof staffPending[0]) => <span className="text-success-600 font-medium">{formatCurrency(s.collected)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (s: typeof staffPending[0]) => <span className="text-danger-600 font-medium">{formatCurrency(s.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (s: typeof staffPending[0]) => (
      <div className="flex items-center gap-2"><div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-success-500 h-2 rounded-full" style={{ width: `${s.pct}%` }} /></div><span className="text-xs font-medium">{s.pct}%</span></div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Staff-wise Pending" subtitle="Pending amounts by collection staff" actions={<ExportButtons filename="staff-pending" rows={staffPending} />} />
      <DataTable columns={columns} data={staffPending} searchKeys={['name']} pageSize={10} />
    </div>
  );
}

export function BranchWisePending() {
  const { customers, branches } = useData();
  const branchPending = branches.map(b => {
    const assigned = customers.filter(c => c.branchId === b.id);
    const totalDue = assigned.reduce((sum, c) => sum + c.totalDue, 0);
    const collected = assigned.reduce((sum, c) => sum + c.paid, 0);
    const pending = assigned.reduce((sum, c) => sum + c.pending, 0);
    return { id: b.id, name: b.name, customers: assigned.length, totalDue, collected, pending, pct: totalDue ? Math.round((collected / totalDue) * 100) : 0 };
  });

  const columns = [
    { key: 'name', label: 'Branch', sortable: true, render: (b: typeof branchPending[0]) => <span className="font-medium">{b.name}</span> },
    { key: 'customers', label: 'Customers', sortable: true },
    { key: 'totalDue', label: 'Due', sortable: true, render: (b: typeof branchPending[0]) => formatCurrency(b.totalDue) },
    { key: 'collected', label: 'Collected', sortable: true, render: (b: typeof branchPending[0]) => <span className="text-success-600 font-medium">{formatCurrency(b.collected)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (b: typeof branchPending[0]) => <span className="text-danger-600 font-medium">{formatCurrency(b.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (b: typeof branchPending[0]) => (
      <div className="flex items-center gap-2"><div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-primary-500 h-2 rounded-full" style={{ width: `${b.pct}%` }} /></div><span className="text-xs font-medium">{b.pct}%</span></div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Branch-wise Pending" subtitle="Pending amounts by branch" actions={<ExportButtons filename="branch-pending" rows={branchPending} />} />
      <DataTable columns={columns} data={branchPending} searchKeys={['name']} pageSize={10} />
    </div>
  );
}

export function GroupWisePending() {
  const { customers, groups } = useData();
  const groupPending = groups.map(g => {
    const members = customers.filter(c => c.groupId === g.id);
    const totalDue = members.reduce((sum, c) => sum + c.totalDue, 0);
    const collected = members.reduce((sum, c) => sum + c.paid, 0);
    const pending = members.reduce((sum, c) => sum + c.pending, 0);
    return { id: g.id, name: g.groupName, members: members.length, totalDue, collected, pending, pct: totalDue ? Math.round((collected / totalDue) * 100) : 0 };
  });

  const columns = [
    { key: 'name', label: 'Group', sortable: true, render: (g: typeof groupPending[0]) => <span className="font-medium">{g.name}</span> },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'totalDue', label: 'Due', sortable: true, render: (g: typeof groupPending[0]) => formatCurrency(g.totalDue) },
    { key: 'collected', label: 'Collected', sortable: true, render: (g: typeof groupPending[0]) => <span className="text-success-600 font-medium">{formatCurrency(g.collected)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (g: typeof groupPending[0]) => <span className="text-danger-600 font-medium">{formatCurrency(g.pending)}</span> },
    { key: 'pct', label: 'Collection %', sortable: true, render: (g: typeof groupPending[0]) => (
      <div className="flex items-center gap-2"><div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-gold-500 h-2 rounded-full" style={{ width: `${g.pct}%` }} /></div><span className="text-xs font-medium">{g.pct}%</span></div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Group-wise Pending" subtitle="Pending amounts by group" actions={<ExportButtons filename="group-pending" rows={groupPending} />} />
      <DataTable columns={columns} data={groupPending} searchKeys={['name']} pageSize={10} />
    </div>
  );
}

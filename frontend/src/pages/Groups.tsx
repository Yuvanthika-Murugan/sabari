import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Section, RadioGroup, ReadOnly, Checkbox } from '@/components/FormSections';
import { frequencyOptions } from '@/lib/options';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, Select, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { DateFilterPanel, SearchSelect } from '@/components/SmartFilters';
import { inDateRange } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, Group } from '@/types';
import GroupDetails from '@/components/GroupDetails';
import { CalendarPlus, Eye, Edit, Trash2, Printer, X } from 'lucide-react';

const emptyGroup = {
  branchId: '', groupCodeId: '', groupName: '', psoNumber: '', psoDate: '', agreementNo: '', agreementDate: '',
  groupValue: '', duration: '', admissionFee: '', serviceTax: '0',
  startDate: '', auctionTimeFrom: '', auctionTimeTo: '', auctionBy: 'day', auctionByValue: '', frequency: 'monthly',
  companyType: '', companyTicketNo: '', companyAuctionNo: '', companyCommPct: '', authorized: '1', fdrDetails: '0',
  status: 'active',
};

const STEP_MONTHS: Record<string, [number, 'day' | 'week' | 'month']> = {
  daily: [1, 'day'], weekly: [1, 'week'], monthly: [1, 'month'], bimonthly: [2, 'month'],
};

/** Last installment date: first auction date plus (installments - 1) periods. Mirrors ChitGroup::closingDate. */
function closingDate(first: string, installments: number, frequency: string): string {
  if (!first || !(installments > 0)) return '';
  const [n, unit] = STEP_MONTHS[frequency] ?? [1, 'month'];
  const periods = (installments - 1) * n;
  const [y, m, d] = first.split('-').map(Number);
  let date: Date;
  if (unit === 'month') {
    // PHP's "+N months" rolls over (Jan 31 + 1 month = Mar 3); Date.UTC does the same.
    date = new Date(Date.UTC(y, m - 1 + periods, d));
  } else {
    date = new Date(Date.UTC(y, m - 1, d + periods * (unit === 'week' ? 7 : 1)));
  }
  return date.toISOString().slice(0, 10);
}

export function GroupList() {
  const { groups, groupCodes, branches, customers, commission, today } = useData();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const location = useLocation();
  const canManage = currentUser?.role !== 'staff';
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const form = useForm({ ...emptyGroup, startDate: today });
  const { run, busy } = useAction();

  // List filters.
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const customerGroupId = customers.find(c => c.id === customerFilter)?.groupId;
  const enrolled = (g: Group) => customers.filter(c => c.groupId === g.id && c.status !== 'closed').length;
  const filteredGroups = groups.filter(g =>
    inDateRange(g.startDate, fromDate, toDate) &&
    (!nameFilter || g.id === nameFilter) &&
    (!customerFilter || g.id === customerGroupId) &&
    (!branchFilter || g.branchId === branchFilter) &&
    (!valueFilter || String(g.groupValue) === valueFilter) &&
    (!seriesFilter || g.series === seriesFilter) &&
    (!durationFilter || String(g.duration) === durationFilter) &&
    (!frequencyFilter || g.frequency === frequencyFilter) &&
    (!statusFilter || g.status === statusFilter)
  );
  const distinct = <T extends string | number>(xs: T[]) => [...new Set(xs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const [editing, setEditing] = useState<Group | 'new' | null>(location.pathname.endsWith('/create') ? 'new' : null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Group | null>(null);

  const viewGroup = groups.find(g => g.id === showView);
  // The group chosen in the Group Name filter, or else the group of the chosen customer.
  const pickedGroup = groups.find(g => g.id === (nameFilter || customerGroupId));
  const nextCode = `GRP${String(groups.reduce((m, g) => Math.max(m, Number(g.groupCode.slice(3)) || 0), 0) + 1).padStart(3, '0')}`;

  const newGroup = { ...emptyGroup, startDate: today, companyCommPct: String(commission.foremanCommissionPct) };
  const openForm = (g: Group | 'new') => {
    form.reset(g === 'new' ? newGroup : {
      branchId: g.branchId, groupCodeId: g.groupCodeId, groupName: g.groupName,
      psoNumber: g.psoNumber, psoDate: g.psoDate, agreementNo: g.agreementNo, agreementDate: g.agreementDate,
      groupValue: String(g.groupValue), duration: String(g.duration), admissionFee: String(g.admissionFee), serviceTax: String(g.serviceTax),
      startDate: g.startDate, auctionTimeFrom: g.auctionTimeFrom, auctionTimeTo: g.auctionTimeTo,
      auctionBy: g.auctionBy, auctionByValue: g.auctionByValue, frequency: g.frequency,
      companyType: g.companyType, companyTicketNo: g.companyTicketNo, companyAuctionNo: g.companyAuctionNo,
      companyCommPct: String(g.companyCommPct), authorized: g.authorized ? '1' : '0', fdrDetails: g.fdrDetails ? '1' : '0',
      status: g.status,
    });
    setEditing(g);
  };

  // Picking a group code (series) fills in its value, installments, fees and auction day.
  const pickCode = (id: string) => {
    form.set('groupCodeId', id);
    const c = groupCodes.find(x => x.id === id);
    if (!c) return;
    form.set('groupValue', String(c.groupValue));
    form.set('duration', String(c.members));
    form.set('admissionFee', String(c.admissionFee));
    form.set('companyCommPct', String(c.companyCommPct));
    if (c.auctionDay) { form.set('auctionBy', 'day'); form.set('auctionByValue', c.auctionDay); }
  };
  const fv = form.values;
  const pickedCode = groupCodes.find(c => c.id === fv.groupCodeId);
  const codeOptions = groupCodes.filter(c => c.status === 'active' || c.id === fv.groupCodeId)
    .map(c => ({ value: c.id, label: `${c.series} · ${formatCurrency(c.groupValue)} · ${c.members} members` }));
  const installmentAmount = Number(fv.groupValue) > 0 && Number(fv.duration) > 0 ? formatCurrency(Number(fv.groupValue) / Number(fv.duration)) : '';
  const closedDate = closingDate(fv.startDate, Number(fv.duration), fv.frequency);

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/groups', v) : api.put(`/groups/${(editing as Group).id}`, v),
      editing === 'new' ? 'Group created' : 'Group updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/groups/${showDelete.id}`), 'Group deleted')) setShowDelete(null);
  };

  const columns = [
    { key: 'groupCode', label: 'Code', sortable: true, render: (g: Group) => <span className="font-mono text-xs text-primary-600">{g.groupCode}</span> },
    { key: 'groupName', label: 'Group Name', sortable: true, render: (g: Group) => <span className="font-medium text-gray-900">{g.groupName}</span> },
    { key: 'series', label: 'Series', sortable: true, render: (g: Group) => g.series || '-' },
    { key: 'branchId', label: 'Branch', render: (g: Group) => branches.find(b => b.id === g.branchId)?.name },
    { key: 'startDate', label: 'Start', sortable: true },
    { key: 'endDate', label: 'End', sortable: true },
    { key: 'groupValue', label: 'Group Value', sortable: true, render: (g: Group) => formatCurrency(g.groupValue) },
    { key: 'numberOfMembers', label: 'Members', sortable: true, render: (g: Group) => <span title="Enrolled / total seats">{enrolled(g)} / {g.numberOfMembers}</span> },
    { key: 'collected', label: 'Collected', sortable: true, render: (g: Group) => <span className="text-success-600 font-medium">{formatCurrency(g.collected)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (g: Group) => <span className="text-danger-600 font-medium">{formatCurrency(g.pending)}</span> },
    { key: 'status', label: 'Status', render: (g: Group) => <StatusBadge status={g.status} /> },
    { key: 'actions', label: 'Actions', render: (g: Group) => (
      <div className="flex gap-1">
        <button onClick={() => setShowView(g.id)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="View"><Eye className="w-4 h-4" /></button>
        {canManage && <button onClick={() => openForm(g)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Edit"><Edit className="w-4 h-4" /></button>}
        <button onClick={() => { setShowView(g.id); setTimeout(() => window.print(), 100); }} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Print"><Printer className="w-4 h-4" /></button>
        {canDelete && <button onClick={() => setShowDelete(g)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600" title="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Group List" subtitle={`${filteredGroups.length} of ${groups.length} finance groups`} actions={
        <>
          <ExportButtons filename="groups" rows={filteredGroups} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><CalendarPlus className="w-4 h-4" /> Create Group</button>}
        </>
      } />
      <DateFilterPanel label="Group Start Date" from={fromDate} to={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t); }} today={today}>
        <span>{filteredGroups.length} groups · <span className="font-semibold text-gray-900">{formatCurrency(filteredGroups.reduce((s, g) => s + g.groupValue, 0))}</span></span>
      </DateFilterPanel>
      <FilterBar>
        <SearchSelect label="Group Name" value={nameFilter} onChange={setNameFilter} placeholder="All groups" className="sm:w-56"
          options={groups.map(g => ({ value: g.id, label: g.groupName, hint: g.groupCode }))} />
        <SearchSelect label="Customer" value={customerFilter} onChange={setCustomerFilter} placeholder="Any customer" className="sm:w-56"
          options={customers.map(c => ({ value: c.id, label: c.name, hint: c.customerId, keywords: c.mobile }))} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
        <Select label="Group Value" value={valueFilter} onChange={setValueFilter} placeholder="All Values"
          options={distinct(groups.map(g => g.groupValue)).map(x => ({ value: String(x), label: formatCurrency(x) }))} />
        <Select label="Series" value={seriesFilter} onChange={setSeriesFilter} placeholder="All Series"
          options={distinct(groups.map(g => g.series).filter(Boolean)).map(s => ({ value: s, label: s }))} />
        <Select label="Instalments" value={durationFilter} onChange={setDurationFilter} placeholder="All"
          options={distinct(groups.map(g => g.duration)).map(d => ({ value: String(d), label: String(d) }))} />
        <Select label="Frequency" value={frequencyFilter} onChange={setFrequencyFilter} options={frequencyOptions} placeholder="All" />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'completed', label: 'Completed' }]} />
      </FilterBar>

      {/* A group picked in the filter (or the group of the picked customer): show all its details. */}
      {pickedGroup && (
        <div className="bg-white rounded-xl shadow-card border border-primary-100 p-4 sm:p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Selected group</p>
            <div className="flex items-center gap-2">
              {canManage && <button onClick={() => openForm(pickedGroup)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"><Edit className="w-3.5 h-3.5" /> Edit</button>}
              <button onClick={() => { setNameFilter(''); setCustomerFilter(''); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Clear</button>
            </div>
          </div>
          <GroupDetails group={pickedGroup} />
        </div>
      )}

      <DataTable columns={columns} data={filteredGroups} searchKeys={['groupName', 'groupCode']} pageSize={10} emptyMessage="No groups match these filters" />

      <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Group Details" size="2xl">
        {viewGroup && <GroupDetails group={viewGroup} />}
      </Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Chit Group Add' : 'Edit Chit Group'} size="2xl"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel={editing === 'new' ? 'Add' : 'Save'} submitting={form.submitting} />}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-600">Group Code <span className="text-primary-600 font-mono">{editing === 'new' ? `${nextCode} (auto)` : (editing as Group | null)?.groupCode}</span></p>
            {groupCodes.length === 0 && (
              <p className="text-xs text-danger-600">No group codes yet. <button type="button" onClick={() => navigate('/groups/codes')} className="underline font-medium">Add a Chit Group Code first</button>.</p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="Group">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Branch" {...form.field('branchId')} options={branches.filter(b => b.status === 'active' || b.id === fv.branchId).map(b => ({ value: b.id, label: `${b.code} · ${b.name}` }))} required />
                <Select label="Group Series (Code)" value={fv.groupCodeId} onChange={pickCode} error={form.errors.groupCodeId} options={codeOptions} required />
                <Input label="Group Name" {...form.field('groupName')} className="sm:col-span-2" required />
                <Input label="PSO Number" format="alnum" maxLength={40} {...form.field('psoNumber')} />
                <Input label="PSO Date" type="date" {...form.field('psoDate')} />
                <Input label="Agreement No" format="alnum" maxLength={40} {...form.field('agreementNo')} />
                <Input label="Agreement Date" type="date" {...form.field('agreementDate')} />
              </div>
            </Section>

            <Section title="Auction">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Auction Date" type="date" {...form.field('startDate')} required />
                <ReadOnly label="Closed Date" value={closedDate} />
                <Input label="Auction Time From" type="time" {...form.field('auctionTimeFrom')} />
                <Input label="Auction Time To" type="time" {...form.field('auctionTimeTo')} />
                <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                  <RadioGroup label="Auction By" value={fv.auctionBy} onChange={x => form.set('auctionBy', x)}
                    options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
                  <Input label={fv.auctionBy === 'day' ? 'Day (1–31)' : 'Week (1–5)'} type="number" {...form.field('auctionByValue')} />
                </div>
                <RadioGroup label="Auction Type" value={fv.frequency} onChange={x => form.set('frequency', x)} options={frequencyOptions} error={form.errors.frequency} />
              </div>
            </Section>

            <Section title="Value">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Chit Group Value" type="number" min={1} {...form.field('groupValue')} required />
                <Input label="No of Instalments" type="number" format="integer" min={1} max={1000} {...form.field('duration')} required />
                <ReadOnly label="Instalment Amount" value={installmentAmount} />
                <ReadOnly label="Members (from code)" value={pickedCode ? String(pickedCode.members) : ''} />
                <Input label="Admission Fee" type="number" {...form.field('admissionFee')} />
                <Input label="Service Tax" type="number" {...form.field('serviceTax')} />
              </div>
            </Section>

            <Section title="Company">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Company Type" {...form.field('companyType')} />
                <Input label="Company Ticket No" format="alnum" maxLength={20} {...form.field('companyTicketNo')} />
                <Input label="Company Auction No" format="alnum" maxLength={20} {...form.field('companyAuctionNo')} />
                <Input label="Company Comm (%)" type="number" max={100} {...form.field('companyCommPct')} required />
                <RadioGroup label="Authorized" value={fv.authorized} onChange={x => form.set('authorized', x)}
                  options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
                <Checkbox label="F.D.R. Details" checked={fv.fdrDetails === '1'} onChange={c => form.set('fdrDetails', c ? '1' : '0')} className="self-end pb-2" />
              </div>
            </Section>
          </div>

          {editing !== 'new' && (
            <div className="max-w-xs">
              <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'completed', label: 'Completed' }]} />
            </div>
          )}
          {pickedCode && Number(fv.duration) !== pickedCode.members && (
            <p className="text-xs text-warning-600">Instalments ({fv.duration}) differ from the series' members ({pickedCode.members}). Normally they are equal.</p>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete <span className="font-medium">{showDelete?.groupName}</span>? Groups that still have customers cannot be deleted.</p>
      </Modal>
    </div>
  );
}

export function GroupWiseCustomers() {
  const { customers, groups, branches, users, areas } = useData();
  const [groupFilter, setGroupFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [joinedFrom, setJoinedFrom] = useState('');
  const [joinedTo, setJoinedTo] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const groupValueOf = (c: Customer) => groups.find(g => g.id === c.groupId)?.groupValue;
  const filtered = customers.filter(c =>
    (!groupFilter || c.groupId === groupFilter) &&
    (!branchFilter || c.branchId === branchFilter) &&
    (!valueFilter || String(groupValueOf(c)) === valueFilter) &&
    (!staffFilter || c.staffId === staffFilter) &&
    (!areaFilter || c.area === areaFilter) &&
    (!statusFilter || c.status === statusFilter) &&
    inDateRange(c.joiningDate, joinedFrom, joinedTo)
  );

  const columns = [
    { key: 'customerId', label: 'Customer ID', render: (c: Customer) => <span className="font-mono text-xs text-primary-600">{c.customerId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (c: Customer) => <span className="font-medium">{c.name}</span> },
    { key: 'mobile', label: 'Phone' },
    { key: 'branchId', label: 'Branch', render: (c: Customer) => branches.find(b => b.id === c.branchId)?.name },
    { key: 'groupId', label: 'Group', render: (c: Customer) => groups.find(g => g.id === c.groupId)?.groupName ?? '-' },
    { key: 'staffId', label: 'Staff', render: (c: Customer) => users.find(u => u.id === c.staffId)?.name ?? '-' },
    { key: 'totalDue', label: 'Due', sortable: true, render: (c: Customer) => formatCurrency(c.totalDue) },
    { key: 'paid', label: 'Paid', sortable: true, render: (c: Customer) => <span className="text-success-600">{formatCurrency(c.paid)}</span> },
    { key: 'pending', label: 'Pending', sortable: true, render: (c: Customer) => <span className="text-danger-600">{formatCurrency(c.pending)}</span> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Group-wise Customers" subtitle="View customers organized by group" actions={<ExportButtons filename="group-customers" rows={filtered} />} />
      <FilterBar>
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All Groups" />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
        <Select label="Group Value" value={valueFilter} onChange={setValueFilter} placeholder="All Values"
          options={[...new Set(groups.map(g => g.groupValue))].sort((a, b) => a - b).map(x => ({ value: String(x), label: formatCurrency(x) }))} />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All Staff" />
        <Select label="Area" value={areaFilter} onChange={setAreaFilter} placeholder="All Areas"
          options={[...new Set(areas.filter(a => !branchFilter || a.branchId === branchFilter).map(a => a.name))].map(n => ({ value: n, label: n }))} />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'closed', label: 'Closed' }]} />
        <DateRangeFilter label="Joined" from={joinedFrom} to={joinedTo} onFrom={setJoinedFrom} onTo={setJoinedTo} />
      </FilterBar>
      <DataTable columns={columns} data={filtered} searchKeys={['name', 'customerId', 'mobile']} pageSize={10} />
    </div>
  );
}

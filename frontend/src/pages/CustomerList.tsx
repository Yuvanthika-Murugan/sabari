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
import { formatCurrency } from '@/lib/format';
import type { Customer } from '@/types';
import { UserPlus, Eye, Edit, Trash2, Printer, CheckCircle2 } from 'lucide-react';

const emptyCustomer = {
  name: '', fatherSpouseName: '', mobile: '', altMobile: '', branchId: '', staffId: '', agentId: '', groupId: '',
  /** Add only: the group is found from its chit value and period (number of instalments). */
  chitValue: '', period: '',
  area: '', joiningDate: '', status: 'active', address: '',
  nomineeName: '', nomineeRelation: '', nomineeMobile: '',
  /** A newly chosen photo (data URL) and whether the saved one should be removed. */
  photoData: '', removePhoto: '',
};

/** Chit periods offered when adding a customer (number of instalments). */
const PERIODS = [12, 20];
const periodOptions = PERIODS.map(p => ({ value: String(p), label: `${p} months` }));

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

  const [editing, setEditing] = useState<Customer | 'new' | null>(location.pathname.endsWith('/add') ? 'new' : null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Customer | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Arrears per customer: unpaid amounts of installments already past their due date.
  const arrearsBy = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) arrearsBy.set(d.customerId, (arrearsBy.get(d.customerId) ?? 0) + d.pendingAmount);
  }
  const rows = customers.map(c => {
    const arrears = arrearsBy.get(c.id) ?? 0;
    const category: Category = arrears > 0 ? 'ar' : 'group';
    return { ...c, arrears, category, categoryName: categoryLabel[category] };
  });
  type Row = (typeof rows)[number];

  const filtered = rows.filter(c =>
    (!branchFilter || c.branchId === branchFilter) &&
    (!groupFilter || c.groupId === groupFilter) &&
    (!staffFilter || c.staffId === staffFilter) &&
    (!statusFilter || c.status === statusFilter) &&
    (!categoryFilter || c.category === categoryFilter) &&
    inDateRange(c.joiningDate, fromDate, toDate)
  );

  const viewCustomer = rows.find(c => c.id === showView);
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
  const periodsForValue = [...new Set(branchGroups.filter(g => g.groupValue === Number(form.values.chitValue)).map(g => g.duration))].sort((a, b) => a - b);
  const groupMatchNote = !form.values.chitValue || !form.values.period ? ''
    : matchingGroups.length === 0 ? `No active scheme${form.values.branchId ? ' in this branch' : ''} has this chit value and period. Available periods: ${periodsForValue.join(', ') || 'none'}.`
    : matchingGroups.length === 1 ? `Scheme Type: ${matchingGroups[0].groupName} (${matchingGroups[0].groupCode}), ${matchingGroups[0].frequency}`
    : '';
  const areaOptions = areas.filter(a => a.branchId === form.values.branchId && (a.status === 'active' || a.name === form.values.area)).map(a => ({ value: a.name, label: a.name }));
  if (form.values.area && !areaOptions.some(o => o.value === form.values.area)) areaOptions.push({ value: form.values.area, label: form.values.area });
  const agentOptions = agents.filter(a => a.status === 'active' || a.id === form.values.agentId).map(a => ({ value: a.id, label: `${a.name} (${a.agentCode})` }));

  const openForm = (c: Customer | 'new') => {
    form.reset(c === 'new' ? { ...emptyCustomer, joiningDate: today } : {
      name: c.name, fatherSpouseName: c.fatherSpouseName, mobile: c.mobile, altMobile: c.altMobile, branchId: c.branchId,
      staffId: c.staffId, agentId: c.agentId, groupId: c.groupId, chitValue: '', period: '', area: c.area, joiningDate: c.joiningDate, status: c.savedStatus, address: c.address,
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
    { key: 'joiningDate', label: 'Joined', sortable: true },
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
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'closed', label: 'Closed' }]} placeholder="All Status" />
      </FilterBar>

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
            <Select label="Chit Value" {...form.field('chitValue')} options={chitValueOptions} required
              placeholder={chitValueOptions.length ? 'Select...' : 'No active groups'}
              error={form.errors.chitValue ?? (matchingGroups.length <= 1 ? form.errors.groupId : undefined)} />
            <Select label="Period" {...form.field('period')} options={periodOptions} placeholder="Select 12 or 20..." required />
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
      <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Customer Details" size="lg">
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
              <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Due</p><p className="text-lg font-bold text-primary-700">{formatCurrency(viewCustomer.totalDue)}</p></div>
              <div className="bg-success-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Paid</p><p className="text-lg font-bold text-success-700">{formatCurrency(viewCustomer.paid)}</p></div>
              <div className="bg-danger-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-danger-700">{formatCurrency(viewCustomer.pending)}</p></div>
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

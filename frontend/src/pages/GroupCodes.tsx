import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, Select, FilterBar } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { GroupCode } from '@/types';
import { Plus, Edit, Trash2 } from 'lucide-react';

const emptyCode = { series: '', groupValue: '', members: '', admissionFee: '', auctionDay: '', companyCommPct: '', status: 'active' };

/** Chit Group Code master: the group series (value, members, fees) that chit groups are created from. */
export default function GroupCodes() {
  const { groupCodes, commission } = useData();
  const { currentUser } = useApp();
  const location = useLocation();
  const canManage = currentUser?.role !== 'staff';
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const defaults = { ...emptyCode, companyCommPct: String(commission.foremanCommissionPct) };
  const form = useForm(defaults);
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<GroupCode | 'new' | null>(location.pathname.endsWith('/add') ? 'new' : null);
  const [showDelete, setShowDelete] = useState<GroupCode | null>(null);
  const [valueFilter, setValueFilter] = useState('');
  const [membersFilter, setMembersFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = groupCodes.filter(c =>
    (!valueFilter || String(c.groupValue) === valueFilter) &&
    (!membersFilter || String(c.members) === membersFilter) &&
    (!statusFilter || c.status === statusFilter)
  );
  const sortedNums = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

  const openForm = (c: GroupCode | 'new') => {
    form.reset(c === 'new' ? defaults : {
      series: c.series, groupValue: String(c.groupValue), members: String(c.members), admissionFee: String(c.admissionFee),
      auctionDay: c.auctionDay, companyCommPct: String(c.companyCommPct), status: c.status,
    });
    setEditing(c);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/group-codes', v) : api.put(`/group-codes/${(editing as GroupCode).id}`, v),
      editing === 'new' ? 'Group code added' : 'Group code updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/group-codes/${showDelete.id}`), 'Group code deleted')) setShowDelete(null);
  };

  const v = form.values;
  const installment = Number(v.groupValue) > 0 && Number(v.members) > 0 ? formatCurrency(Number(v.groupValue) / Number(v.members)) : '';

  const columns = [
    { key: 'series', label: 'Group Series', sortable: true, render: (c: GroupCode) => <span className="font-mono text-sm font-medium text-primary-700">{c.series}</span> },
    { key: 'groupValue', label: 'Group Value', sortable: true, render: (c: GroupCode) => formatCurrency(c.groupValue) },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'installment', label: 'Installment', render: (c: GroupCode) => formatCurrency(c.groupValue / Math.max(1, c.members)) },
    { key: 'admissionFee', label: 'Admission Fee', sortable: true, render: (c: GroupCode) => formatCurrency(c.admissionFee) },
    { key: 'auctionDay', label: 'Day of Auction', render: (c: GroupCode) => c.auctionDay || '-' },
    { key: 'companyCommPct', label: 'Company Comm', render: (c: GroupCode) => `${c.companyCommPct}%` },
    { key: 'groupCount', label: 'Groups', sortable: true },
    { key: 'status', label: 'Status', render: (c: GroupCode) => <StatusBadge status={c.status} /> },
    { key: 'actions', label: 'Actions', render: (c: GroupCode) => (
      <div className="flex gap-1">
        {canManage && <button onClick={() => openForm(c)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Edit"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => setShowDelete(c)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600" title="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Chit Group Code" subtitle={`${filtered.length} of ${groupCodes.length} group series`} actions={
        <>
          <ExportButtons filename="group-codes" rows={filtered} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><Plus className="w-4 h-4" /> Add Group Code</button>}
        </>
      } />
      <FilterBar>
        <Select label="Group Value" value={valueFilter} onChange={setValueFilter} placeholder="All Values"
          options={sortedNums(groupCodes.map(c => c.groupValue)).map(x => ({ value: String(x), label: formatCurrency(x) }))} />
        <Select label="Members" value={membersFilter} onChange={setMembersFilter} placeholder="All"
          options={sortedNums(groupCodes.map(c => c.members)).map(m => ({ value: String(m), label: String(m) }))} />
        <Select label="Status" value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </FilterBar>
      <DataTable columns={columns} data={filtered} searchKeys={['series']} pageSize={10}
        emptyMessage={groupCodes.length ? 'No group codes match these filters' : 'No group codes yet — add one to start creating chit groups'} />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Chit Group Code Add' : 'Edit Group Code'} size="sm"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel={editing === 'new' ? 'Add' : 'Save'} submitting={form.submitting} />}
      >
        <div className="space-y-4">
          <Input label="Group Series" format="alnum" maxLength={30} {...form.field('series')} placeholder="e.g. 1L-20" required />
          <Input label="Group Value" type="number" min={1} {...form.field('groupValue')} placeholder="100000" required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Group Members" type="number" format="integer" min={1} max={1000} {...form.field('members')} placeholder="20" required />
            <Input label="Day of Auction" type="number" format="integer" min={1} max={31} {...form.field('auctionDay')} placeholder="1–31" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Admission Fee" type="number" {...form.field('admissionFee')} placeholder="0" required />
            <Input label="Company Comm (%)" type="number" max={100} {...form.field('companyCommPct')} required />
          </div>
          {editing !== 'new' && <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />}
          {installment && <p className="text-xs text-gray-500">Installment per member: <span className="font-medium text-gray-800">{installment}</span></p>}
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete group code <span className="font-medium">{showDelete?.series}</span>? Codes already used by groups cannot be deleted — set them to Inactive instead.</p>
      </Modal>
    </div>
  );
}

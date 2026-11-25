import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, Select, FilterBar } from '@/components/FormControls';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Area } from '@/types';
import { MapPin, Edit, Trash2 } from 'lucide-react';

const emptyArea = { name: '', branchId: '', staffId: '', pincode: '', status: 'active' };

export default function Areas() {
  const { areas, branches, users, customers } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role !== 'staff';
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const [editing, setEditing] = useState<Area | 'new' | null>(null);
  const [showDelete, setShowDelete] = useState<Area | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const form = useForm(emptyArea);
  const { run, busy } = useAction();

  const rows = areas.filter(a => !branchFilter || a.branchId === branchFilter).map(a => {
    const inArea = customers.filter(c => c.branchId === a.branchId && c.area === a.name);
    return { ...a, customers: inArea.length, pending: inArea.reduce((s, c) => s + c.pending, 0) };
  });
  const staffOptions = users.filter(u => u.role === 'staff' && u.status === 'active' && (!form.values.branchId || u.branchId === form.values.branchId)).map(u => ({ value: u.id, label: u.name }));

  const openForm = (a: Area | 'new') => {
    form.reset(a === 'new' ? emptyArea : { name: a.name, branchId: a.branchId, staffId: a.staffId, pincode: a.pincode, status: a.status });
    setEditing(a);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/areas', v) : api.put(`/areas/${(editing as Area).id}`, v),
      editing === 'new' ? 'Area created' : 'Area updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/areas/${showDelete.id}`), 'Area deleted')) setShowDelete(null);
  };

  type Row = (typeof rows)[number];
  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (a: Row) => <span className="font-mono text-xs text-primary-600">{a.code}</span> },
    { key: 'name', label: 'Area', sortable: true, render: (a: Row) => <span className="font-medium text-gray-900">{a.name}</span> },
    { key: 'branchId', label: 'Branch', render: (a: Row) => branches.find(b => b.id === a.branchId)?.name ?? '-' },
    { key: 'staffId', label: 'Collection Staff', render: (a: Row) => users.find(u => u.id === a.staffId)?.name ?? <span className="text-gray-400">Not assigned</span> },
    { key: 'pincode', label: 'Pincode', render: (a: Row) => a.pincode || '-' },
    { key: 'customers', label: 'Customers', sortable: true },
    { key: 'pending', label: 'Pending', sortable: true, render: (a: Row) => <span className={a.pending > 0 ? 'text-danger-600 font-medium' : ''}>{formatCurrency(a.pending)}</span> },
    { key: 'status', label: 'Status', render: (a: Row) => <StatusBadge status={a.status} /> },
    { key: 'actions', label: 'Actions', render: (a: Row) => (
      <div className="flex gap-1">
        {canManage && <button onClick={() => openForm(a)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => setShowDelete(a)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Areas" subtitle={`${rows.length} collection areas`} actions={
        <>
          <ExportButtons filename="areas" rows={rows} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md"><MapPin className="w-4 h-4" /> Create Area</button>}
        </>
      } />
      <FilterBar>
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['name', 'code', 'pincode']} pageSize={10} emptyMessage="No areas yet" />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Create Area' : 'Edit Area'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save Area" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Area Name" {...form.field('name')} placeholder="e.g. T Nagar" required className="col-span-full" />
          <Select label="Branch" {...form.field('branchId')} options={branches.map(b => ({ value: b.id, label: b.name }))} required />
          <Select label="Collection Staff" {...form.field('staffId')} options={staffOptions} placeholder="Not assigned" />
          <Input label="Pincode" format="digits" maxLength={6} check={checks.pincode} {...form.field('pincode')} placeholder="600017" />
          <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          {editing !== 'new' && <p className="col-span-full text-xs text-gray-500">Renaming an area also updates the customers in it.</p>}
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete area <span className="font-medium">{showDelete?.name}</span>? Areas with customers cannot be deleted — set them to Inactive instead.</p>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import KPICard from '@/components/KPICard';
import { Input, Select, TextArea, PhoneInput } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Branch } from '@/types';
import { Building2, Users, Calendar, Wallet, UserCircle, Plus, Eye, Edit, Trash2 } from 'lucide-react';

const emptyBranch = { code: '', name: '', phone: '', managerId: '', openingDate: '', status: 'active', address: '' };

export default function Branches() {
  const { branches, users, customers, groups, collections, today } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Branch | null>(null);
  const form = useForm(emptyBranch);
  const { run, busy } = useAction();

  const viewBranch = branches.find(b => b.id === showView);
  const branchCustomers = viewBranch ? customers.filter(c => c.branchId === viewBranch.id) : [];
  const branchGroups = viewBranch ? groups.filter(g => g.branchId === viewBranch.id) : [];
  const branchCollections = viewBranch ? collections.filter(c => c.branchId === viewBranch.id) : [];
  const branchStaff = viewBranch ? users.filter(u => u.branchId === viewBranch.id && u.role === 'staff') : [];
  const monthStart = today.slice(0, 8) + '01';

  const openForm = (branch: Branch | 'new') => {
    form.reset(branch === 'new' ? emptyBranch : {
      code: branch.code, name: branch.name, phone: branch.phone, managerId: branch.managerId,
      openingDate: branch.openingDate, status: branch.status, address: branch.address,
    });
    setEditing(branch);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/branches', v) : api.put(`/branches/${(editing as Branch).id}`, v),
      editing === 'new' ? 'Branch added' : 'Branch updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/branches/${showDelete.id}`), 'Branch deleted')) setShowDelete(null);
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true, render: (b: Branch) => <span className="font-mono text-xs">{b.code}</span> },
    { key: 'name', label: 'Branch Name', sortable: true, render: (b: Branch) => <span className="font-medium text-gray-900">{b.name}</span> },
    { key: 'address', label: 'Address', render: (b: Branch) => <span className="text-gray-500">{b.address}</span> },
    { key: 'phone', label: 'Phone', render: (b: Branch) => <span className="text-gray-500">{b.phone}</span> },
    { key: 'managerId', label: 'Manager', render: (b: Branch) => users.find(u => u.id === b.managerId)?.name ?? '-' },
    { key: 'openingDate', label: 'Opened', sortable: true },
    { key: 'status', label: 'Status', render: (b: Branch) => <StatusBadge status={b.status} /> },
    { key: 'actions', label: 'Actions', render: (b: Branch) => (
      <div className="flex gap-1">
        <button onClick={() => setShowView(b.id)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="View"><Eye className="w-4 h-4" /></button>
        {canManage && <button onClick={() => openForm(b)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>}
        {canManage && <button onClick={() => setShowDelete(b)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Branch Management" subtitle={`${branches.length} branches`} actions={
        <>
          <ExportButtons filename="branches" rows={branches} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md"><Plus className="w-4 h-4" /> Add Branch</button>}
        </>
      } />
      <DataTable columns={columns} data={branches} searchKeys={['name', 'code', 'address']} pageSize={10} />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Branch' : 'Edit Branch'} size="lg"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Branch Code" format="code" maxLength={20} {...form.field('code')} placeholder="BR005" required />
          <Input label="Branch Name" {...form.field('name')} placeholder="Branch Name" required />
          <PhoneInput kind="phone" label="Phone" {...form.field('phone')} required />
          <Select label="Manager" {...form.field('managerId')} options={users.filter(u => u.role === 'manager').map(u => ({ value: u.id, label: u.name }))} placeholder="No manager" />
          <Input label="Opening Date" type="date" {...form.field('openingDate')} required />
          <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <TextArea label="Address" {...form.field('address')} placeholder="Full address" className="col-span-full" />
        </div>
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete branch <span className="font-medium">{showDelete?.name}</span>? Branches with users, groups or customers cannot be deleted — set them to Inactive instead.</p>
      </Modal>

      {/* View Branch Details */}
      <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="Branch Details" size="xl">
        {viewBranch && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white"><Building2 className="w-7 h-7" /></div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{viewBranch.name}</h3>
                <p className="text-sm text-gray-500">{viewBranch.code} • {viewBranch.address}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard title="Total Customers" value={String(branchCustomers.length)} icon={<Users className="w-6 h-6" />} color="primary" />
              <KPICard title="Active Groups" value={String(branchGroups.filter(g => g.status === 'active').length)} icon={<Calendar className="w-6 h-6" />} color="gold" />
              <KPICard title="Collection Staff" value={String(branchStaff.length)} icon={<UserCircle className="w-6 h-6" />} color="success" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KPICard title="Today's Collection" value={formatCurrency(branchCollections.filter(c => c.date === today).reduce((s, c) => s + c.collectedAmount, 0))} icon={<Wallet className="w-6 h-6" />} color="success" />
              <KPICard title="Monthly Collection" value={formatCurrency(branchCollections.filter(c => c.date >= monthStart).reduce((s, c) => s + c.collectedAmount, 0))} icon={<Wallet className="w-6 h-6" />} color="primary" />
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Collection Staff</h4>
              <div className="space-y-2">
                {branchStaff.map(s => (
                  <div key={s.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">{s.name.charAt(0)}</div>
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">{s.name}</p><p className="text-xs text-gray-500">{s.phone}</p></div>
                  </div>
                ))}
                {branchStaff.length === 0 && <p className="text-sm text-gray-400">No staff assigned</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

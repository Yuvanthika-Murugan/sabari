import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, PhoneInput, Select, TextArea, Dropdown } from '@/components/FormControls';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Role, User } from '@/types';
import PhotoInput, { Avatar } from '@/components/PhotoInput';
import { Eye, Edit, Trash2, KeyRound, UserPlus, Phone, Mail, Power } from 'lucide-react';

const emptyUser = {
  /** A newly chosen photo (data URL) and whether the saved one should be removed. */
  photoData: '', removePhoto: '',
  name: '', phone: '', email: '', role: '', branchId: '', joiningDate: '',
  status: 'active', address: '', monthlyTarget: '', monthlySalary: '', password: '',
  /** Only used when "Agent" is picked: the agent is saved to the Agents list, with a login account. */
  commissionPct: '',
};

const toForm = (u: User) => ({
  photoData: '', removePhoto: '',
  name: u.name, phone: u.phone, email: u.email, role: u.role, branchId: u.branchId,
  joiningDate: u.joiningDate, status: u.status, address: u.address, monthlyTarget: String(u.monthlyTarget || ''),
  monthlySalary: String(u.monthlySalary || ''), password: '', commissionPct: '',
});

export default function UserManagement({ roleFilter }: { roleFilter?: Role }) {
  const { users, branches, commission, today } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<User | null>(null);
  const [showReset, setShowReset] = useState<User | null>(null);
  const form = useForm(emptyUser);
  const resetForm = useForm({ password: '' });
  const { run, busy } = useAction();

  // This is the Admin panel: the Managing Director's account belongs to the Super Admin
  // (MD) panel and is not listed here for admins and managers.
  const listed = currentUser?.role === 'md' ? users : users.filter(u => u.role !== 'md');
  const filtered = roleFilter ? listed.filter(u => u.role === roleFilter) : listed;
  const roleLabel = roleFilter ? roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1) : 'User';
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }));
  // Preview only — the server assigns the real ID when the user is saved.
  const nextEmpId = `EMP${String(users.reduce((m, u) => Math.max(m, /^EMP\d+$/.test(u.empId) ? Number(u.empId.slice(3)) : 0), 0) + 1).padStart(3, '0')}`;
  // Role choices in this order: Admin → Agent → Staff → Manager. Agent and Staff do the collections.
  // Agent is offered only when adding (agents are kept in the Agents list, not as users);
  // Managing Director appears only when editing the MD's own record.
  const isNew = editing === 'new';
  const editingMd = !isNew && (editing as User | null)?.role === 'md';
  const roleChoices: { value: string; label: string; collection?: boolean }[] = [
    ...(editingMd ? [{ value: 'md', label: 'Managing Director' }] : []),
    { value: 'admin', label: 'Admin' },
    ...(isNew ? [{ value: 'agent', label: 'Agent', collection: true }] : []),
    { value: 'staff', label: 'Staff', collection: true },
    { value: 'manager', label: 'Manager' },
  ];
  const isAgent = form.values.role === 'agent';

  const openForm = (user: User | 'new') => {
    form.reset(user === 'new' ? { ...emptyUser, role: roleFilter ?? '', joiningDate: today } : toForm(user));
    setEditing(user);
  };

  const save = async () => {
    const v = form.values;
    const ok = isAgent
      ? await form.submit(
        () => api.post('/agents', {
          name: v.name, mobile: v.phone, branchId: v.branchId, joiningDate: v.joiningDate,
          status: v.status, address: v.address, commissionPct: v.commissionPct || String(commission.agentCommissionPct),
          // The agent's login (collection app): email + password.
          email: v.email, password: v.password,
        }),
        `Agent ${v.name} added with login ${v.email}`,
      )
      : await form.submit(
        x => editing === 'new' ? api.post('/users', x) : api.put(`/users/${(editing as User).id}`, x),
        editing === 'new' ? `${roleLabel} added` : 'User updated',
      );
    if (ok) setEditing(null);
  };

  const rolePicker = (
    <div className="col-span-full">
      <p className="block text-xs font-medium text-gray-600 mb-1">Role <span className="text-danger-500">*</span></p>
      <div className="flex flex-wrap gap-2">
        {roleChoices.map(o => (
          <label key={o.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-colors ${form.values.role === o.value ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
            <input type="radio" name="role" checked={form.values.role === o.value} onChange={() => form.set('role', o.value)} className="accent-primary-600" />
            <span className="font-medium">{o.label}</span>
            {o.collection && <span className="text-[11px] px-1.5 py-0.5 rounded bg-success-100 text-success-700">collection</span>}
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">Agent and Staff do the collections.{isAgent ? ' The agent is saved to the Agents list and signs in to the collection app with this email and password.' : ''}</p>
      {form.errors.role && <p className="text-xs text-danger-600 mt-1">{form.errors.role}</p>}
    </div>
  );

  const toggleStatus = (u: User) =>
    run(() => api.put(`/users/${u.id}`, { ...toForm(u), status: u.status === 'active' ? 'inactive' : 'active' }),
      u.status === 'active' ? `${u.name} deactivated` : `${u.name} activated`);

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/users/${showDelete.id}`), 'User deleted')) setShowDelete(null);
  };

  const resetPassword = async () => {
    if (showReset && await resetForm.submit(v => api.post(`/users/${showReset.id}/reset-password`, v), 'Password reset')) setShowReset(null);
  };

  const columns = [
    { key: 'empId', label: 'Emp ID', sortable: true, render: (u: User) => <span className="font-mono text-xs">{u.empId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (u: User) => (
      <div className="flex items-center gap-2">
        <Avatar name={u.name} photo={u.photo} className="w-8 h-8 text-xs bg-primary-100 text-primary-700" />
        <span className="font-medium text-gray-900">{u.name}</span>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (u: User) => <span className="text-gray-500">{u.phone}</span> },
    { key: 'email', label: 'Email', render: (u: User) => <span className="text-gray-500">{u.email}</span> },
    { key: 'role', label: 'Role', sortable: true, render: (u: User) => (
      <span className="capitalize px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700">{u.role === 'md' ? 'MD' : u.role}</span>
    )},
    { key: 'branchId', label: 'Branch', render: (u: User) => branches.find(b => b.id === u.branchId)?.name ?? '-' },
    { key: 'joiningDate', label: 'Joined', sortable: true, render: (u: User) => <span className="text-gray-500">{u.joiningDate}</span> },
    { key: 'status', label: 'Status', render: (u: User) => <StatusBadge status={u.status} /> },
    { key: 'actions', label: 'Actions', render: (u: User) => (
      <Dropdown label="Actions" items={[
        { label: 'View', onClick: () => setShowView(u.id), icon: <Eye className="w-3.5 h-3.5" /> },
        ...(canManage ? [
          { label: 'Edit', onClick: () => openForm(u), icon: <Edit className="w-3.5 h-3.5" /> },
          { label: 'Reset Password', onClick: () => { resetForm.reset(); setShowReset(u); }, icon: <KeyRound className="w-3.5 h-3.5" /> },
          { label: u.status === 'active' ? 'Deactivate' : 'Activate', onClick: () => toggleStatus(u), icon: <Power className="w-3.5 h-3.5" /> },
          { label: 'Delete', onClick: () => setShowDelete(u), icon: <Trash2 className="w-3.5 h-3.5" />, variant: 'danger' as const },
        ] : []),
      ]} />
    )},
  ];

  const viewUser = users.find(u => u.id === showView);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`${roleLabel} Management`}
        subtitle={`${filtered.length} ${roleLabel.toLowerCase()}${filtered.length !== 1 ? 's' : ''} registered`}
        actions={
          <>
            <ExportButtons filename={`${roleLabel.toLowerCase()}s`} rows={filtered} />
            {canManage && (
              <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md">
                <UserPlus className="w-4 h-4" /> Add {roleLabel}
              </button>
            )}
          </>
        }
      />

      <DataTable columns={columns} data={filtered} searchKeys={['name', 'empId', 'phone', 'email']} pageSize={10} />

      {/* Add/Edit Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `Add ${roleLabel}` : 'Edit User'} size="lg"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full">
            <PhotoInput
              current={editing && editing !== 'new' ? editing.photo ?? null : null}
              value={form.values.photoData}
              removed={form.values.removePhoto === '1'}
              onChange={dataUrl => { form.set('photoData', dataUrl); form.set('removePhoto', ''); }}
              onRemove={() => { form.set('photoData', ''); form.set('removePhoto', '1'); }}
              error={form.errors.photo}
            />
          </div>
          <div className="col-span-full"><p className="text-xs font-medium text-gray-600">Employee ID <span className="text-primary-600 font-mono">{editing === 'new' ? nextEmpId :(editing as User | null)?.empId}</span></p></div>
          {rolePicker}
          <Input label="Name" format="name" check={checks.name} maxLength={120} {...form.field('name')} placeholder="Full Name" required />
          <PhoneInput label={isAgent ? 'Mobile' : 'Phone'} {...form.field('phone')} error={form.errors.phone ?? form.errors.mobile} required />
          <Input label={isAgent ? 'Login Email' : 'Email'} type="email" {...form.field('email')} placeholder="user@fincol.in" required />
          <Select label="Branch" {...form.field('branchId')} options={branchOptions} required />
          <Input label="Joining Date" type="date" {...form.field('joiningDate')} required={!isAgent} />
          <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          {isAgent
            ? <Input label="Commission %" type="number" min={0} max={100} {...form.field('commissionPct')} placeholder={String(commission.agentCommissionPct)} />
            : <Input label="Monthly Salary" type="number" {...form.field('monthlySalary')} placeholder="25000" />}
          {form.values.role === 'staff' ? <Input label="Monthly Collection Target" type="number" {...form.field('monthlyTarget')} placeholder="350000" /> : <div />}
          <TextArea label="Address" {...form.field('address')} placeholder="Full address" className="col-span-full" />
          {editing === 'new' && <Input label={isAgent ? 'Login Password' : 'Password'} type="password" {...form.field('password')} placeholder="8+ characters, letters and numbers" required className="col-span-full" />}
        </div>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={!!showView} onClose={() => setShowView(null)} title="User Details" size="md">
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={viewUser.name} photo={viewUser.photo} className="w-16 h-16 text-xl bg-gradient-to-br from-primary-600 to-primary-800 text-white" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewUser.name}</h3>
                <p className="text-sm text-gray-500">{viewUser.empId} • <span className="capitalize">{viewUser.role}</span></p>
                <StatusBadge status={viewUser.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Phone</p><p className="font-medium flex items-center gap-1"><Phone className="w-3 h-3" />{viewUser.phone}</p></div>
              <div><p className="text-gray-500 text-xs">Email</p><p className="font-medium flex items-center gap-1"><Mail className="w-3 h-3" />{viewUser.email}</p></div>
              <div><p className="text-gray-500 text-xs">Branch</p><p className="font-medium">{branches.find(b => b.id === viewUser.branchId)?.name ?? '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Joining Date</p><p className="font-medium">{viewUser.joiningDate}</p></div>
              <div><p className="text-gray-500 text-xs">Monthly Salary</p><p className="font-medium">{viewUser.monthlySalary ? formatCurrency(viewUser.monthlySalary) : 'Not set'}</p></div>
              {viewUser.role === 'staff' && <div><p className="text-gray-500 text-xs">Monthly Target</p><p className="font-medium">{formatCurrency(viewUser.monthlyTarget)}</p></div>}
              <div className="col-span-full"><p className="text-gray-500 text-xs">Address</p><p className="font-medium">{viewUser.address || '-'}</p></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete <span className="font-medium">{showDelete?.name}</span>? Users with recorded transactions cannot be deleted — deactivate them instead.</p>
      </Modal>

      {/* Reset Password */}
      <Modal isOpen={!!showReset} onClose={() => setShowReset(null)} title="Reset Password" size="sm"
        footer={<ModalFooter onCancel={() => setShowReset(null)} onSubmit={resetPassword} submitLabel="Reset" submitting={resetForm.submitting} />}
      >
        <p className="text-sm text-gray-600 mb-4">Set a new password for <span className="font-medium">{showReset?.name}</span>. They will be signed out of all devices.</p>
        <Input label="New Password" type="password" {...resetForm.field('password')} placeholder="8+ characters, letters and numbers" required />
      </Modal>
    </div>
  );
}

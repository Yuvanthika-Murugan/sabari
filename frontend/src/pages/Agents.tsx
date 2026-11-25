import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import KPICard from '@/components/KPICard';
import { Input, PhoneInput, Select, TextArea, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Agent } from '@/types';
import { UserPlus, Eye, Edit, Trash2, Users, Wallet, BadgePercent } from 'lucide-react';

const emptyAgent = { name: '', mobile: '', branchId: '', commissionPct: '', joiningDate: '', status: 'active', address: '' };

export default function Agents() {
  const { agents, branches, customers, collections, commission, today } = useData();
  const { currentUser } = useApp();
  const canManage = currentUser?.role !== 'staff';
  const canDelete = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [showView, setShowView] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<Agent | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const form = useForm(emptyAgent);
  const { run, busy } = useAction();
  const monthStart = today.slice(0, 8) + '01';

  /** Customers introduced by the agent and what they have paid (all time and this month). */
  const statsFor = (a: Agent) => {
    const ids = new Set(customers.filter(c => c.agentId === a.id).map(c => c.id));
    const paid = collections.filter(c => ids.has(c.customerId) && c.status === 'completed');
    const total = paid.reduce((s, c) => s + c.collectedAmount, 0);
    const month = paid.filter(c => c.date >= monthStart).reduce((s, c) => s + c.collectedAmount, 0);
    return { customers: ids.size, total, month, commission: total * a.commissionPct / 100, monthCommission: month * a.commissionPct / 100 };
  };

  const rows = agents.filter(a => (!branchFilter || a.branchId === branchFilter) && inDateRange(a.joiningDate, fromDate, toDate)).map(a => ({ ...a, ...statsFor(a) }));
  const viewAgent = agents.find(a => a.id === showView);
  const viewStats = viewAgent && statsFor(viewAgent);
  const nextCode = `AGT${String(agents.reduce((m, a) => Math.max(m, Number(a.agentCode.slice(3)) || 0), 0) + 1).padStart(3, '0')}`;

  const openForm = (a: Agent | 'new') => {
    form.reset(a === 'new' ? { ...emptyAgent, joiningDate: today, commissionPct: String(commission.agentCommissionPct) } : {
      name: a.name, mobile: a.mobile, branchId: a.branchId, commissionPct: String(a.commissionPct),
      joiningDate: a.joiningDate, status: a.status, address: a.address,
    });
    setEditing(a);
  };

  const save = async () => {
    const ok = await form.submit(
      v => editing === 'new' ? api.post('/agents', v) : api.put(`/agents/${(editing as Agent).id}`, v),
      editing === 'new' ? 'Agent added' : 'Agent updated',
    );
    if (ok) setEditing(null);
  };

  const remove = async () => {
    if (showDelete && await run(() => api.delete(`/agents/${showDelete.id}`), 'Agent deleted')) setShowDelete(null);
  };

  type Row = (typeof rows)[number];
  const columns = [
    { key: 'agentCode', label: 'Agent ID', sortable: true, render: (a: Row) => <span className="font-mono text-xs text-primary-600">{a.agentCode}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (a: Row) => <span className="font-medium text-gray-900">{a.name}</span> },
    { key: 'mobile', label: 'Mobile', render: (a: Row) => <span className="text-gray-500">{a.mobile}</span> },
    { key: 'branchId', label: 'Branch', render: (a: Row) => branches.find(b => b.id === a.branchId)?.name ?? '-' },
    { key: 'commissionPct', label: 'Commission', sortable: true, render: (a: Row) => `${a.commissionPct}%` },
    { key: 'customers', label: 'Customers', sortable: true },
    { key: 'monthCommission', label: 'This Month', sortable: true, render: (a: Row) => <span className="text-success-600 font-medium">{formatCurrency(a.monthCommission)}</span> },
    { key: 'commission', label: 'Total Earned', sortable: true, render: (a: Row) => formatCurrency(a.commission) },
    { key: 'status', label: 'Status', render: (a: Row) => <StatusBadge status={a.status} /> },
    { key: 'actions', label: 'Actions', render: (a: Row) => (
      <div className="flex gap-1">
        <button onClick={() => setShowView(a.id)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="View"><Eye className="w-4 h-4" /></button>
        {canManage && <button onClick={() => openForm(a)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>}
        {canDelete && <button onClick={() => setShowDelete(a)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Agents" subtitle={`${rows.length} agents · commission is a percentage of what their customers pay`} actions={
        <>
          <ExportButtons filename="agents" rows={rows} />
          {canManage && <button onClick={() => openForm('new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md"><UserPlus className="w-4 h-4" /> Add Agent</button>}
        </>
      } />
      <FilterBar>
        <DateRangeFilter label="Joined" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All Branches" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['name', 'agentCode', 'mobile']} pageSize={10} emptyMessage="No agents yet" />

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Agent' : 'Edit Agent'} size="lg"
        footer={<ModalFooter onCancel={() => setEditing(null)} onSubmit={save} submitLabel="Save Agent" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full"><p className="text-xs font-medium text-gray-600 mb-1">Agent ID <span className="text-primary-600 font-mono">{editing === 'new' ? `${nextCode} (auto)` : (editing as Agent | null)?.agentCode}</span></p></div>
          <Input label="Agent Name" format="name" check={checks.name} maxLength={120} {...form.field('name')} placeholder="Full Name" required />
          <PhoneInput label="Mobile Number" {...form.field('mobile')} required />
          <Select label="Branch" {...form.field('branchId')} options={branches.map(b => ({ value: b.id, label: b.name }))} required />
          <Input label="Commission %" type="number" max={100} {...form.field('commissionPct')} placeholder={String(commission.agentCommissionPct)} required />
          <Input label="Joining Date" type="date" {...form.field('joiningDate')} />
          <Select label="Status" {...form.field('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <TextArea label="Address" {...form.field('address')} placeholder="Full address" className="col-span-full" />
        </div>
      </Modal>

      <Modal isOpen={!!viewAgent} onClose={() => setShowView(null)} title="Agent Details" size="lg">
        {viewAgent && viewStats && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-primary-950 font-bold text-xl">{viewAgent.name.charAt(0)}</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewAgent.name}</h3>
                <p className="text-sm text-gray-500">{viewAgent.agentCode} • {viewAgent.mobile} • {branches.find(b => b.id === viewAgent.branchId)?.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard title="Customers" value={String(viewStats.customers)} icon={<Users className="w-6 h-6" />} color="primary" />
              <KPICard title="Collected" value={formatCurrency(viewStats.total)} icon={<Wallet className="w-6 h-6" />} color="success" />
              <KPICard title={`Earned @ ${viewAgent.commissionPct}%`} value={formatCurrency(viewStats.commission)} icon={<BadgePercent className="w-6 h-6" />} color="gold" />
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Customers introduced</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {customers.filter(c => c.agentId === viewAgent.id).map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3 text-sm">
                    <div><p className="font-medium text-gray-900">{c.name}</p><p className="text-xs text-gray-500">{c.customerId} • {c.mobile}</p></div>
                    <div className="text-right"><p className="text-success-600 font-medium">{formatCurrency(c.paid)}</p><StatusBadge status={c.status} /></div>
                  </div>
                ))}
                {viewStats.customers === 0 && <p className="text-sm text-gray-400">No customers yet. Pick this agent when adding or editing a customer.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!showDelete} onClose={() => setShowDelete(null)} title="Confirm Delete" size="sm"
        footer={<ModalFooter onCancel={() => setShowDelete(null)} onSubmit={remove} submitLabel="Delete" submitting={busy} variant="danger" />}
      >
        <p className="text-sm text-gray-600">Delete agent <span className="font-medium">{showDelete?.name}</span>? Agents with customers cannot be deleted — set them to Inactive instead.</p>
      </Modal>
    </div>
  );
}

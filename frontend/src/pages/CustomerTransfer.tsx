import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import Badge from '@/components/Badge';
import { Select, TextArea } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Customer, CustomerTransfer as Transfer } from '@/types';
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

export default function CustomerTransfer() {
  const { customers, branches, groups, users, customerTransfers } = useData();
  const { currentUser } = useApp();
  const location = useLocation();
  const canTransfer = currentUser?.role !== 'staff';
  const placement = (c?: Customer) => ({ toBranchId: c?.branchId ?? '', toGroupId: c?.groupId ?? '', toStaffId: c?.staffId ?? '', reason: '' });

  // Opened from the customer list's "Transfer" action.
  const requested = customers.find(c => c.id === (location.state as { customerId?: string } | null)?.customerId);
  const form = useForm(placement(requested));
  const [showTransfer, setShowTransfer] = useState<string | null>(requested?.id ?? null);

  const startTransfer = (c: Customer) => {
    form.reset(placement(c));
    setShowTransfer(c.id);
  };

  const transferCustomer = customers.find(c => c.id === showTransfer);
  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '-';
  const staffName = (id: string) => users.find(u => u.id === id)?.name ?? '-';

  // A transfer must change at least one of branch, group or staff.
  const v = form.values;
  const unchanged = !!transferCustomer && v.toBranchId === transferCustomer.branchId
    && v.toGroupId === transferCustomer.groupId && v.toStaffId === (transferCustomer.staffId ?? '');
  const toGroups = groups.filter(g => g.status === 'active' && (!v.toBranchId || g.branchId === v.toBranchId));
  const toStaff = users.filter(u => u.role === 'staff' && u.status === 'active' && (!v.toBranchId || u.branchId === v.toBranchId));
  // Nothing to move to: no other branch, no other active group and no other staff member exist.
  const noTargets = !!transferCustomer
    && !branches.some(b => b.id !== transferCustomer.branchId && b.status === 'active')
    && !groups.some(g => g.id !== transferCustomer.groupId && g.status === 'active')
    && !users.some(u => u.role === 'staff' && u.status === 'active' && u.id !== transferCustomer.staffId);
  const current = (label: string, isCurrent: boolean) => isCurrent ? `${label} (current)` : label;

  // Order: customers ready to transfer (first month's due fully paid) first, then
  // group by group from the smallest chit value up (₹1,00,000, ₹2,00,000, ...),
  // keeping each group's customers together in customer ID order.
  const groupOf = (c: Customer) => groups.find(g => g.id === c.groupId);
  const sortedCustomers = [...customers].sort((a, b) => {
    const ga = groupOf(a), gb = groupOf(b);
    return Number(b.firstDueCompleted) - Number(a.firstDueCompleted)
      || (ga?.groupValue ?? Infinity) - (gb?.groupValue ?? Infinity)
      || (ga?.groupCode ?? '').localeCompare(gb?.groupCode ?? '')
      || a.customerId.localeCompare(b.customerId);
  });
  const readyCount = customers.filter(c => c.firstDueCompleted).length;

  const confirm = async () => {
    if (!transferCustomer) return;
    if (await form.submit(v => api.post(`/customers/${transferCustomer.id}/transfer`, v), `${transferCustomer.name} transferred`)) {
      setShowTransfer(null);
    }
  };

  const columns = [
    { key: 'customerId', label: 'Customer ID', render: (c: Customer) => <span className="font-mono text-xs text-primary-600">{c.customerId}</span> },
    { key: 'name', label: 'Name', render: (c: Customer) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{c.name}</span>
        {c.firstDueCompleted && <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Ready to Transfer</Badge>}
      </div>
    )},
    { key: 'branchId', label: 'Branch', render: (c: Customer) => branchName(c.branchId) },
    { key: 'groupId', label: 'Scheme Type', render: (c: Customer) => groupName(c.groupId) },
    { key: 'chitValue', label: 'Chit Value', render: (c: Customer) => { const g = groupOf(c); return g ? formatCurrency(g.groupValue) : '-'; } },
    { key: 'staffId', label: 'Staff', render: (c: Customer) => staffName(c.staffId) },
    { key: 'pending', label: 'Pending', render: (c: Customer) => <span className="text-danger-600 font-medium">{formatCurrency(c.pending)}</span> },
    { key: 'status', label: 'Status', render: (c: Customer) => c.status === 'active' ? <Badge variant="success">Active</Badge> : <Badge variant="gray">{c.status}</Badge> },
    ...(canTransfer ? [{ key: 'action', label: 'Action', render: (c: Customer) => (
      <button onClick={() => startTransfer(c)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"><ArrowRightLeft className="w-4 h-4" /> Transfer</button>
    )}] : []),
  ];

  const transferColumns = [
    { key: 'customerName', label: 'Customer', render: (t: Transfer) => <span className="font-medium">{t.customerName}</span> },
    { key: 'fromBranchId', label: 'From Branch', render: (t: Transfer) => branchName(t.fromBranchId) },
    { key: 'toBranchId', label: 'To Branch', render: (t: Transfer) => branchName(t.toBranchId) },
    { key: 'fromGroupId', label: 'From Group', render: (t: Transfer) => groupName(t.fromGroupId) },
    { key: 'toGroupId', label: 'To Group', render: (t: Transfer) => groupName(t.toGroupId) },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'reason', label: 'Reason', render: (t: Transfer) => <span className="text-gray-500 text-xs">{t.reason}</span> },
  ];

  const readOnly = (label: string, value: string) => (
    <div><p className="block text-xs font-medium text-gray-600 mb-1">{label}</p><p className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600">{value}</p></div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Customer Transfer" subtitle="Transfer customers between groups, staff, and branches" actions={<ExportButtons filename="customer-transfers" rows={customerTransfers} />} />

      <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 mb-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-gold-600 flex-shrink-0" />
        <p className="text-sm text-gold-800">
          <span className="font-semibold">{readyCount} ready to transfer</span> (first month's due paid) are listed first.
          The rest follow group by group, from the smallest chit value up.
        </p>
      </div>

      <DataTable columns={columns} data={sortedCustomers} searchKeys={['name', 'customerId']} pageSize={8} />

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer History</h3>
        <DataTable columns={transferColumns} data={customerTransfers} searchable={false} pageSize={5} emptyMessage="No transfers yet" />
      </div>

      <Modal isOpen={!!transferCustomer} onClose={() => setShowTransfer(null)} title={`Transfer ${transferCustomer?.name ?? 'Customer'}`} size="lg"
        footer={<ModalFooter onCancel={() => setShowTransfer(null)} onSubmit={confirm} submitLabel="Confirm Transfer" submitting={form.submitting} disabled={unchanged} icon={<ArrowRightLeft className="w-4 h-4" />} />}
      >
        {transferCustomer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {noTargets ? (
              <div className="col-span-full flex gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg text-sm text-warning-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>There is nowhere to transfer {transferCustomer.name} to yet: only one branch, one chit group and one collection staff exist. Add another group (Chit Groups), staff member (Users) or branch first.</span>
              </div>
            ) : unchanged && (
              <p className="col-span-full text-sm text-gray-500">Change at least one of <span className="font-medium">To Branch</span>, <span className="font-medium">To Group</span> or <span className="font-medium">To Staff</span>. Options marked "(current)" are where the customer is now.</p>
            )}
            {readOnly('From Branch', branchName(transferCustomer.branchId))}
            <Select label="To Branch" {...form.field('toBranchId')} options={branches.filter(b => b.status === 'active' || b.id === transferCustomer.branchId).map(b => ({ value: b.id, label: current(b.name, b.id === transferCustomer.branchId) }))} />
            {readOnly('From Group', groupName(transferCustomer.groupId))}
            <Select label="To Group" {...form.field('toGroupId')} options={toGroups.map(g => ({ value: g.id, label: current(g.groupName, g.id === transferCustomer.groupId) }))}
              placeholder={toGroups.length ? 'Select group...' : 'No active groups in this branch'} />
            {readOnly('From Staff', staffName(transferCustomer.staffId))}
            <Select label="To Staff" {...form.field('toStaffId')} options={toStaff.map(u => ({ value: u.id, label: current(u.name, u.id === transferCustomer.staffId) }))}
              placeholder={toStaff.length ? 'Select staff...' : 'No staff in this branch'} />
            <TextArea label="Transfer Reason" {...form.field('reason')} placeholder="Reason for transfer" className="col-span-full" required />
          </div>
        )}
      </Modal>
    </div>
  );
}

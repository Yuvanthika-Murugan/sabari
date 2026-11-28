import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import ArTransferForm from '@/components/ArTransferForm';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { formatCurrency } from '@/lib/format';
import type { Customer, CustomerTransfer as Transfer } from '@/types';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';

export default function CustomerTransfer() {
  const { customers, branches, groups, users, customerTransfers } = useData();
  const { currentUser } = useApp();
  const location = useLocation();
  const canTransfer = currentUser?.role !== 'staff';

  // Opened from the customer list's "Transfer" action. Uses the same transfer form as AR Subscribers.
  const requested = customers.find(c => c.id === (location.state as { customerId?: string } | null)?.customerId);
  const [transferFor, setTransferFor] = useState<string | null>(requested?.id ?? null);

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '-';
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '-';
  const staffName = (id: string) => users.find(u => u.id === id)?.name ?? '-';

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
      <button onClick={() => setTransferFor(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"><ArrowRightLeft className="w-4 h-4" /> Transfer</button>
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

      {/* Mounted only while open, so each opening starts from a clean form. */}
      {transferFor !== null && <ArTransferForm isOpen customerId={transferFor} title="Transfer Customer to Chit Group" onClose={() => setTransferFor(null)} />}
    </div>
  );
}

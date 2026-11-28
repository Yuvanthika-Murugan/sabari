import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import CollectionForm from '@/components/CollectionForm';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, TextArea, FilterBar } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Collection } from '@/types';
import { Receipt, Wallet, AlertCircle, HandCoins, CalendarDays, Ban } from 'lucide-react';

/** Receipt register for one receipt type, with the entry form. */
function ReceiptRegister({ type }: { type: 'chit' | 'arrear' }) {
  const { collections, cancelledReceipts, dueSchedules, today } = useData();
  const { currentUser } = useApp();
  // No Cancel button on Chit Receipt; AR Receipt keeps it for MD / Admin.
  const canCancel = type === 'arrear' && (currentUser?.role === 'md' || currentUser?.role === 'admin');
  const [showForm, setShowForm] = useState(false);
  const [cancelling, setCancelling] = useState<Collection | null>(null);
  const cancelForm = useForm({ reason: '' });

  // Only a customer's latest receipt can be cancelled (the API enforces the same rule).
  const latestId = new Map<string, number>();
  collections.forEach(c => latestId.set(c.customerId, Math.max(latestId.get(c.customerId) ?? 0, Number(c.id))));
  const cancellable = (c: Collection) => latestId.get(c.customerId) === Number(c.id) && !c.remarks.startsWith('Approved payment ');

  const openCancel = (c: Collection) => {
    cancelForm.reset();
    setCancelling(c);
  };
  const confirmCancel = async () => {
    if (cancelling && await cancelForm.submit(v => api.post(`/collections/${cancelling.id}/cancel`, v), `Receipt ${cancelling.receiptNo} cancelled`)) setCancelling(null);
  };
  const [fromDate, setFromDate] = useState(today.slice(0, 8) + '01');
  const [toDate, setToDate] = useState(today);
  const isArrear = type === 'arrear';

  const receipts = collections.filter(c => c.receiptType === type && (!fromDate || c.date >= fromDate) && (!toDate || c.date <= toDate));
  const total = receipts.reduce((s, c) => s + c.collectedAmount, 0);
  const todayTotal = receipts.filter(c => c.date === today).reduce((s, c) => s + c.collectedAmount, 0);
  const outstanding = dueSchedules.filter(d => d.pendingAmount > 0 && (isArrear ? d.dueDate < today : d.dueDate === today)).reduce((s, d) => s + d.pendingAmount, 0);

  const columns = [
    { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (c: Collection) => <span className="font-mono text-xs text-primary-600">{c.receiptNo}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (c: Collection) => <span>{c.date} <span className="text-gray-400">{c.time}</span></span> },
    { key: 'customerName', label: 'Subscriber', sortable: true, render: (c: Collection) => <span className="font-medium text-gray-900">{c.customerName}</span> },
    { key: 'groupName', label: 'Group' },
    { key: 'dueNumber', label: 'From Due', render: (c: Collection) => `#${c.dueNumber}` },
    { key: 'collectedAmount', label: 'Amount', sortable: true, render: (c: Collection) => <span className="text-success-600 font-medium">{formatCurrency(c.collectedAmount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (c: Collection) => <Badge variant={c.paymentMode === 'cash' ? 'success' : 'blue'}>{c.paymentMode.replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'staffName', label: 'Collected By' },
    { key: 'status', label: 'Status', render: (c: Collection) => <StatusBadge status={c.status} /> },
    ...(canCancel ? [{ key: 'actions', label: '', render: (c: Collection) => cancellable(c)
      ? <button onClick={() => openCancel(c)} className="flex items-center gap-1 px-2 py-1 text-xs border border-danger-200 text-danger-600 rounded-lg hover:bg-danger-50"><Ban className="w-3.5 h-3.5" /> Cancel</button>
      : null }] : []),
  ];
  const cancelled = cancelledReceipts.filter(c => c.receiptType === type);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isArrear ? 'AR Receipt' : 'Chit Receipt'}
        subtitle={isArrear ? 'Receipts collected against arrears (overdue installments)' : 'Regular chit installment receipts'}
        actions={
          <>
            <ExportButtons filename={isArrear ? 'ar-receipts' : 'chit-receipts'} rows={receipts} />
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><HandCoins className="w-4 h-4" /> {isArrear ? 'New AR Receipt' : 'New Chit Receipt'}</button>
          </>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard title="Collected Today" value={formatCurrency(todayTotal)} icon={<CalendarDays className="w-6 h-6" />} color="success" />
        <KPICard title="Collected in Period" value={formatCurrency(total)} icon={<Wallet className="w-6 h-6" />} color="primary" />
        <KPICard title={isArrear ? 'Total Arrears Outstanding' : 'Still Due Today'} value={formatCurrency(outstanding)} icon={<AlertCircle className="w-6 h-6" />} color={isArrear ? 'danger' : 'warning'} />
      </div>
      <FilterBar>
        <Input label="From Date" type="date" value={fromDate} onChange={setFromDate} />
        <Input label="To Date" type="date" value={toDate} onChange={setToDate} />
        <div className="flex items-center gap-2 text-sm text-gray-500 pb-2"><Receipt className="w-4 h-4" /> {receipts.length} receipts</div>
      </FilterBar>
      <DataTable columns={columns} data={receipts} searchKeys={['receiptNo', 'customerName']} pageSize={10} emptyMessage="No receipts in this period" />

      {cancelled.length > 0 && (
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cancelled receipts ({cancelled.length})</h3>
          <div className="space-y-2">
            {cancelled.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-gray-50 rounded-lg p-3">
                <span className="font-mono text-xs text-gray-500 line-through">{c.receiptNo}</span>
                <span className="font-medium text-gray-900">{c.customerName}</span>
                <span className="text-gray-500 line-through">{formatCurrency(c.collectedAmount)}</span>
                <span className="text-gray-500">{c.date}</span>
                <span className="text-xs text-danger-700 ml-auto">Cancelled by {c.cancelledBy} on {c.cancelledAt} — {c.cancelReason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <CollectionForm isOpen={showForm} onClose={() => setShowForm(false)} receiptType={type} />

      <Modal isOpen={!!cancelling} onClose={() => setCancelling(null)} title="Cancel Receipt" size="sm"
        footer={<ModalFooter onCancel={() => setCancelling(null)} onSubmit={confirmCancel} submitLabel="Cancel Receipt" submitting={cancelForm.submitting} variant="danger" />}
      >
        {cancelling && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Cancel <span className="font-mono">{cancelling.receiptNo}</span> for <span className="font-medium">{cancelling.customerName}</span> ({formatCurrency(cancelling.collectedAmount)})?
              The amount goes back onto their dues{cancelling.paymentMode === 'cash' ? ' and a reversing entry is posted to today\'s cash book' : ''}.
            </p>
            <TextArea label="Reason" {...cancelForm.field('reason')} placeholder="e.g. Entered against the wrong customer" required rows={2} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export const ChitReceipt = () => <ReceiptRegister type="chit" />;
export const ArrearReceipt = () => <ReceiptRegister type="arrear" />;

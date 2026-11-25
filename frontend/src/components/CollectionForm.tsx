import { useEffect } from 'react';
import Modal, { ModalFooter } from '@/components/Modal';
import { Input, Select, TextArea } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency, nowTime } from '@/lib/format';
import { paymentModeOptions } from '@/lib/options';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selects (and locks) the customer, e.g. from the staff route. */
  customerId?: string;
  /** "arrear" only lists customers with overdue dues and caps the amount at their arrears. */
  receiptType?: 'chit' | 'arrear';
}

/** Records a collection against a customer's oldest pending due. */
export default function CollectionForm({ isOpen, onClose, customerId, receiptType = 'chit' }: Props) {
  const { customers, groups, dueSchedules, today } = useData();
  const blank = { customerId: customerId ?? '', receiptType, amount: '', paymentMode: 'cash', referenceNo: '', date: today, time: nowTime(), remarks: '' };
  const form = useForm(blank);
  const isArrear = receiptType === 'arrear';

  useEffect(() => {
    if (isOpen) form.reset({ ...blank, time: nowTime() });
    // Reset only when the dialog opens or the target customer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, customerId, receiptType]);

  const customer = customers.find(c => c.id === form.values.customerId);
  const pendingDues = dueSchedules.filter(d => d.customerId === form.values.customerId && d.pendingAmount > 0);
  const nextDue = pendingDues[0];
  const overdue = pendingDues.filter(d => d.dueDate <= today).reduce((s, d) => s + d.pendingAmount, 0);
  const arrears = pendingDues.filter(d => d.dueDate < today).reduce((s, d) => s + d.pendingAmount, 0);
  const eligible = isArrear
    ? customers.filter(c => dueSchedules.some(d => d.customerId === c.id && d.pendingAmount > 0 && d.dueDate < today))
    : customers.filter(c => (c.status === 'active' || c.autoInactive) && c.pending > 0);

  const submit = async () => {
    if (await form.submit(v => api.post('/collections', v), isArrear ? 'AR receipt recorded' : 'Chit receipt recorded')) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isArrear ? 'AR Receipt (Arrears)' : 'Chit Receipt'} size="lg"
      footer={<ModalFooter onCancel={onClose} onSubmit={submit} submitLabel={isArrear ? 'Save AR Receipt' : 'Save Chit Receipt'} submitting={form.submitting} icon={<CheckCircle2 className="w-4 h-4" />} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Customer" {...form.field('customerId')} required className="col-span-full" disabled={!!customerId}
          options={eligible.map(c => ({ value: c.id, label: `${c.name} (${c.customerId})` }))}
        />
        {customer && (
          <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Group</p><p className="text-sm font-medium truncate">{groups.find(g => g.id === customer.groupId)?.groupName ?? '-'}</p></div>
            <div className="bg-primary-50 rounded-lg p-3"><p className="text-xs text-gray-500">Next Due</p><p className="text-sm font-bold text-primary-700">{nextDue ? `#${nextDue.dueNumber} · ${formatCurrency(nextDue.pendingAmount)}` : '-'}</p></div>
            {isArrear
              ? <div className="bg-danger-50 rounded-lg p-3"><p className="text-xs text-gray-500">Arrears</p><p className="text-sm font-bold text-danger-700">{formatCurrency(arrears)}</p></div>
              : <div className="bg-danger-50 rounded-lg p-3"><p className="text-xs text-gray-500">Due Till Today</p><p className="text-sm font-bold text-danger-700">{formatCurrency(overdue)}</p></div>}
            <div className="bg-gold-50 rounded-lg p-3"><p className="text-xs text-gray-500">Total Pending</p><p className="text-sm font-bold text-gold-700">{formatCurrency(customer.pending)}</p></div>
          </div>
        )}
        <Input label="Amount Received" type="number" min={1} {...form.field('amount')} placeholder={isArrear ? String(arrears) : nextDue ? String(nextDue.pendingAmount) : '0'} required />
        <Select label="Payment Mode" {...form.field('paymentMode')} options={paymentModeOptions} required />
        <Input label="Reference Number" format="reference" maxLength={60} {...form.field('referenceNo')} placeholder="Required for UPI / Bank / Cheque" className="col-span-full" />
        <Input label="Collection Date" type="date" {...form.field('date')} required />
        <Input label="Time" type="time" {...form.field('time')} />
        <TextArea label="Remarks" {...form.field('remarks')} placeholder="Optional remarks" className="col-span-full" />
        <p className="col-span-full text-xs text-gray-500">{isArrear
          ? 'Applied to overdue installments only, oldest first. The amount cannot exceed the arrears.'
          : 'The amount is applied to the oldest pending due first; any excess carries to the following dues.'}</p>
      </div>
    </Modal>
  );
}

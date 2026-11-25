import Modal, { ModalFooter } from '@/components/Modal';
import { Section, ReadOnly } from '@/components/FormSections';
import { Input, Select, TextArea } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { ArrowRightLeft } from 'lucide-react';

/**
 * Transfers an AR subscriber into a chit group. The group is picked step by step
 * (branch → group value → series → group name), its instalments and vacant places
 * are shown, and then the subscriber is chosen. Subscribers in arrears are listed first.
 */
const empty = { branchId: '', groupValue: '', series: '', toGroupId: '', transferDate: '', customerId: '', toStaffId: '', reason: '' };
const NO_SERIES = '-';

export default function ArTransferForm({ isOpen, onClose, customerId = '' }: { isOpen: boolean; onClose: () => void; customerId?: string }) {
  const { customers, dueSchedules, branches, groups, users, today } = useData();
  const form = useForm({ ...empty, transferDate: today, customerId });
  const v = form.values;

  const close = () => { form.reset({ ...empty, transferDate: today }); onClose(); };

  // Step-by-step group choice.
  const branchGroups = groups.filter(g => g.status === 'active' && g.branchId === v.branchId);
  const valueGroups = branchGroups.filter(g => String(g.groupValue) === v.groupValue);
  const seriesOf = (s: string) => s || NO_SERIES;
  const seriesGroups = valueGroups.filter(g => seriesOf(g.series) === v.series);
  const group = groups.find(g => g.id === v.toGroupId);

  const valueOptions = [...new Set(branchGroups.map(g => g.groupValue))].sort((a, b) => a - b)
    .map(x => ({ value: String(x), label: formatCurrency(x) }));
  const seriesOptions = [...new Set(valueGroups.map(g => seriesOf(g.series)))].sort()
    .map(s => ({ value: s, label: s === NO_SERIES ? 'No series' : s }));
  const groupOptions = seriesGroups.map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode})` }));

  const filled = group ? customers.filter(c => c.groupId === group.id && c.status !== 'closed').length : 0;
  const vacant = group ? Math.max(0, group.numberOfMembers - filled) : 0;

  // Subscribers who can move into the chosen group, those in arrears first.
  const arrearsBy = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) arrearsBy.set(d.customerId, (arrearsBy.get(d.customerId) ?? 0) + d.pendingAmount);
  }
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? 'No group';
  const candidates = customers
    .filter(c => c.status !== 'closed' && (!group || c.groupId !== group.id))
    .sort((a, b) => (arrearsBy.get(b.id) ?? 0) - (arrearsBy.get(a.id) ?? 0) || a.customerId.localeCompare(b.customerId));
  const customerOptions = candidates.map(c => {
    const ar = arrearsBy.get(c.id) ?? 0;
    return { value: c.id, label: `${c.customerId} · ${c.name} — ${groupName(c.groupId)}${ar > 0 ? ` · AR ${formatCurrency(ar)}` : ''}` };
  });
  const customer = customers.find(c => c.id === v.customerId);
  const staffOptions = users.filter(u => u.role === 'staff' && u.status === 'active' && u.branchId === v.branchId).map(u => ({ value: u.id, label: u.name }));
  const branchChanges = !!customer && !!v.branchId && customer.branchId !== v.branchId;

  // Each choice clears the ones after it.
  const pick = (key: 'branchId' | 'groupValue' | 'series', value: string) => {
    form.set(key, value);
    if (key === 'branchId') { form.set('groupValue', ''); form.set('toStaffId', ''); }
    if (key !== 'series') form.set('series', '');
    // When the series leaves a single group, it is picked automatically.
    const only = key === 'series' ? valueGroups.filter(g => seriesOf(g.series) === value) : [];
    form.set('toGroupId', only.length === 1 ? only[0].id : '');
  };

  const save = async () => {
    const ok = await form.submit(
      () => api.post(`/customers/${v.customerId}/transfer`, {
        toBranchId: v.branchId, toGroupId: v.toGroupId, toStaffId: v.toStaffId || undefined,
        transferDate: v.transferDate,
        reason: v.reason.trim() || `Transferred to chit group ${group?.groupName ?? ''}`.trim(),
      }),
      `${customer?.name ?? 'Subscriber'} transferred to ${group?.groupName ?? 'the group'}`,
    );
    if (ok) close();
  };

  const missing = !v.toGroupId ? 'Choose the group first' : !v.customerId ? 'Select the customer' : '';
  return (
    <Modal isOpen={isOpen} onClose={close} title="Transfer AR Subscriber to Chit Group" size="2xl"
      footer={<ModalFooter onCancel={close} onSubmit={save} submitLabel="Transfer" submitting={form.submitting}
        disabled={!!missing || vacant <= 0 || (branchChanges && !v.toStaffId)} icon={<ArrowRightLeft className="w-4 h-4" />} />}
    >
      <div className="space-y-5">
        <Section title="Chit Group">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select label="Branch" value={v.branchId} onChange={x => pick('branchId', x)} required
              options={branches.filter(b => b.status === 'active').map(b => ({ value: b.id, label: `${b.code} · ${b.name}` }))} />
            <Select label="Group Value" value={v.groupValue} onChange={x => pick('groupValue', x)} options={valueOptions} required
              placeholder={!v.branchId ? 'Select a branch first' : valueOptions.length ? 'Select value...' : 'No active groups in this branch'} />
            <Select label="Series" value={v.series} onChange={x => pick('series', x)} options={seriesOptions} required
              placeholder={!v.groupValue ? 'Select a group value first' : 'Select series...'} />
            <Select label="Name of the Group" {...form.field('toGroupId')} options={groupOptions} required
              placeholder={!v.series ? 'Select a series first' : 'Select group...'} />
            <ReadOnly label="Group Code" value={group?.groupCode ?? ''} />
            <ReadOnly label="No of Instalments" value={group ? String(group.duration) : ''} />
            <div>
              <ReadOnly label="Vacant Places" value={group ? `${vacant} of ${group.numberOfMembers}` : ''} />
              {group && vacant <= 0 && <p className="text-xs text-danger-600 mt-1">This group is full. Choose another group.</p>}
            </div>
            <Input label="Transfer Date" type="date" {...form.field('transferDate')} required />
          </div>
        </Section>

        <Section title="Customer">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Select Customer" {...form.field('customerId')} options={customerOptions} required className="sm:col-span-2"
              error={form.errors.customerId ?? form.errors.toGroupId}
              placeholder={customerOptions.length ? 'Select customer (AR subscribers first)...' : 'No customers to transfer'} />
            {customer && <>
              <ReadOnly label="Current Branch" value={branches.find(b => b.id === customer.branchId)?.name ?? '-'} />
              <ReadOnly label="Current Group" value={groupName(customer.groupId)} />
              <ReadOnly label="Arrears" value={formatCurrency(arrearsBy.get(customer.id) ?? 0)} />
              <ReadOnly label="Pending Balance" value={formatCurrency(customer.pending)} />
            </>}
            {branchChanges && (
              <Select label="Collection Staff (new branch)" {...form.field('toStaffId')} options={staffOptions} required
                placeholder={staffOptions.length ? 'Select staff...' : 'No staff in this branch'} />
            )}
            <TextArea label="Reason" {...form.field('reason')} placeholder="Optional — e.g. moved from arrears to a new group" className="sm:col-span-2" />
          </div>
        </Section>
        <p className="text-xs text-gray-500">The customer's unpaid dues move to the new group. The transfer is recorded in Customer Transfer history.</p>
      </div>
    </Modal>
  );
}

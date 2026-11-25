import Modal, { ModalFooter } from '@/components/Modal';
import { Section, RadioGroup, ReadOnly } from '@/components/FormSections';
import { frequencyOptions } from '@/lib/options';
import { Input, PhoneInput, Select } from '@/components/FormControls';
import { checks } from '@/lib/validation';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { UserPlus } from 'lucide-react';

/** Subscriber entry form (new chit subscriber with full KYC, nominee and intimation details). */
const emptySubscriber = {
  branchId: '', groupId: '',
  name: '', fatherSpouseName: '', repName: '', addr1: '', addr2: '', addr3: '',
  panNo: '', district: '', pincode: '', phone: '', mobile: '', email: '',
  dob: '', joiningDate: '', staffId: '', area: '', permanentAddress: '0',
  agentType: 'single', agentId: '',
  nomineeName: '', nomineeRelation: '', nomineeMobile: '', nomineeAge: '',
  intimationType: 'post', intimationCard: '1', collectionType: 'monthly',
};

/** Whole years between a date of birth and today, or '' if unknown. */
function ageOn(dob: string, today: string): string {
  if (!dob || dob > today) return '';
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return String(ty - y - (tm < m || (tm === m && td < d) ? 1 : 0));
}

export default function SubscriberForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { branches, groups, customers, users, areas, agents, today } = useData();
  const form = useForm({ ...emptySubscriber, joiningDate: today });
  const v = form.values;

  const close = () => { form.reset({ ...emptySubscriber, joiningDate: today }); onClose(); };

  const group = groups.find(g => g.id === v.groupId);
  const filled = group ? customers.filter(c => c.groupId === group.id && c.status !== 'closed').length : 0;
  const nextCode = `CUST${String(customers.reduce((m, c) => Math.max(m, Number(c.customerId.slice(4)) || 0), 0) + 1).padStart(5, '0')}`;
  const agent = agents.find(a => a.id === v.agentId);

  const branchOptions = branches.filter(b => b.status === 'active').map(b => ({ value: b.id, label: `${b.code} · ${b.name}` }));
  const groupOptions = groups.filter(g => g.status === 'active' && g.branchId === v.branchId).map(g => ({ value: g.id, label: `${g.groupCode} · ${g.groupName}` }));
  const staffOptions = users.filter(u => u.role === 'staff' && u.status === 'active' && u.branchId === v.branchId).map(u => ({ value: u.id, label: u.name }));
  const areaOptions = areas.filter(a => a.status === 'active' && a.branchId === v.branchId).map(a => ({ value: a.name, label: a.name }));
  const agentOptions = agents.filter(a => a.status === 'active' && (!v.branchId || a.branchId === v.branchId)).map(a => ({ value: a.id, label: `${a.agentCode} · ${a.name}` }));

  const changeBranch = (id: string) => {
    form.set('branchId', id);
    form.set('groupId', ''); form.set('staffId', ''); form.set('area', ''); form.set('agentId', '');
  };
  const changeGroup = (id: string) => {
    form.set('groupId', id);
    const g = groups.find(x => x.id === id);
    if (g) form.set('collectionType', g.frequency);
  };

  const save = async () => {
    const { addr1, addr2, addr3, ...rest } = v;
    const ok = await form.submit(
      () => api.post('/customers', { ...rest, address: [addr1, addr2, addr3].map(s => s.trim()).filter(Boolean).join(', '), status: 'active' }),
      `${v.name.trim() || 'Subscriber'} added (${nextCode}) — see Customers › List`,
    );
    if (ok) close();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add Subscriber" size="2xl"
      footer={<ModalFooter onCancel={close} onSubmit={save} submitLabel="Add" submitting={form.submitting} icon={<UserPlus className="w-4 h-4" />} />}
    >
      <div className="space-y-5">
        <Section title="Group Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select label="Branch" value={v.branchId} onChange={changeBranch} options={branchOptions} error={form.errors.branchId} required />
            <Select label="Group" value={v.groupId} onChange={changeGroup} options={groupOptions} error={form.errors.groupId}
              placeholder={!v.branchId ? 'Select a branch first' : groupOptions.length ? 'Select group...' : 'No active groups in this branch'} required />
            <ReadOnly label="Group Series" value={group ? formatCurrency(group.groupValue) : ''} />
            <ReadOnly label="No of Inst's" value={group ? String(group.duration) : ''} />
            <ReadOnly label="Customer ID" value={`${nextCode} (auto)`} />
            <ReadOnly label="No of ARNO" value="1" />
            <ReadOnly label="Filled Tickets" value={group ? `${filled} / ${group.numberOfMembers}` : ''} />
            {group && filled >= group.numberOfMembers && <p className="self-end text-xs text-danger-600 pb-2">This group is already full.</p>}
          </div>
        </Section>

        <Section title="Customer Address">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label="Subscriber Name" format="name" check={checks.name} maxLength={120} {...form.field('name')} required />
            <Input label="PAN No" format="upper" maxLength={10} check={checks.pan} {...form.field('panNo')} placeholder="ABCDE1234F" />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Date of Birth" type="date" {...form.field('dob')} className="col-span-2" />
              <ReadOnly label="Age" value={ageOn(v.dob, today)} />
            </div>
            <Input label="S/O or W/O" format="name" check={checks.name} maxLength={120} {...form.field('fatherSpouseName')} />
            <Input label="District" format="name" check={checks.name} maxLength={80} {...form.field('district')} />
            <Input label="Enrolment Date" type="date" {...form.field('joiningDate')} required />
            <Input label="Rep Name" format="name" check={checks.name} maxLength={120} {...form.field('repName')} />
            <Input label="PIN" format="digits" maxLength={6} check={checks.pincode} {...form.field('pincode')} placeholder="628001" />
            <Select label="Collection Staff" {...form.field('staffId')} options={staffOptions}
              placeholder={!v.branchId ? 'Select a branch first' : staffOptions.length ? 'Select staff...' : 'No staff in this branch'} />
            <Input label="Address Line 1" {...form.field('addr1')} error={form.errors.address} />
            <PhoneInput kind="phone" label="Phone" {...form.field('phone')} />
            <Select label="Route Name" {...form.field('area')} options={areaOptions}
              placeholder={!v.branchId ? 'Select a branch first' : areaOptions.length ? 'Select route...' : 'No areas in this branch'} />
            <Input label="Address Line 2" {...form.field('addr2')} />
            <PhoneInput label="Mobile" {...form.field('mobile')} required />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer self-end pb-2">
              <input type="checkbox" checked={v.permanentAddress === '1'} onChange={e => form.set('permanentAddress', e.target.checked ? '1' : '0')} className="accent-primary-600 w-4 h-4" />
              Permanent Address
            </label>
            <Input label="Address Line 3" {...form.field('addr3')} />
            <Input label="E-mail" type="email" {...form.field('email')} />
            <div />
            <RadioGroup label="Agent Type" value={v.agentType} onChange={x => form.set('agentType', x)}
              options={[{ value: 'single', label: 'Single' }, { value: 'multi', label: 'Multi' }]} />
            <Select label="Agent ID" {...form.field('agentId')} options={agentOptions} placeholder="No agent (direct)" />
            <ReadOnly label="Agent Name" value={agent?.name ?? ''} />
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Section title="Nominee Details" className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_2fr_1fr] gap-4">
              <Input label="Nominee Name" format="name" check={checks.name} maxLength={120} {...form.field('nomineeName')} />
              <Input label="Relation" format="name" check={checks.name} maxLength={60} {...form.field('nomineeRelation')} />
              <PhoneInput label="Nominee Mobile" {...form.field('nomineeMobile')} />
              <Input label="Age" type="number" format="integer" max={120} {...form.field('nomineeAge')} />
            </div>
          </Section>
          <Section title="Type of Intimation">
            <RadioGroup label="Send by" value={v.intimationType} onChange={x => form.set('intimationType', x)}
              options={[{ value: 'post', label: 'Post' }, { value: 'hand', label: 'Hand' }, { value: 'courier', label: 'Courier' }]} />
          </Section>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Section title="Intimation Card">
            <RadioGroup label="Issue card" value={v.intimationCard} onChange={x => form.set('intimationCard', x)}
              options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          </Section>
          <Section title="Type of Collection">
            <RadioGroup label="Collect" value={v.collectionType} onChange={x => form.set('collectionType', x)}
              options={frequencyOptions} />
          </Section>
        </div>

        <p className="text-xs text-gray-500">The due schedule is generated from the group's value, members, duration and frequency, starting one period after the enrolment date.</p>
      </div>
    </Modal>
  );
}

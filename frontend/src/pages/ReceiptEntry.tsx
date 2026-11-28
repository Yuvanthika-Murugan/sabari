import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import Modal from '@/components/Modal';
import ThermalReceipt, { type ReceiptData } from '@/components/ThermalReceipt';
import { Input, Select, TextArea, FilterBar } from '@/components/FormControls';
import { Section } from '@/components/FormSections';
import { DateFilterPanel, SearchSelect } from '@/components/SmartFilters';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency, inDateRange, nowTime } from '@/lib/format';
import { printThermalReceipt } from '@/lib/thermalPrint';
import type { Collection } from '@/types';
import { Banknote, Landmark, Printer, Save, Wallet, Receipt as ReceiptIcon, CalendarDays } from 'lucide-react';

const isBank = (c: Collection) => c.paymentMode !== 'cash';
type ModeFilter = '' | 'cash' | 'bank';

/**
 * Receipt Entry: one form for chit and AR receipts (customer picked by name, ID or
 * group; Cash or Bank with UPI ID / account holder), plus the receipt list.
 * Saving updates the customer's pending amount and the dashboard totals.
 */
export default function ReceiptEntry() {
  const { customers, groups, collections, cancelledReceipts, dueSchedules, settings, today } = useData();
  const { currentUser } = useApp();
  const location = useLocation();
  // Dashboard cards open this page with a preset filter.
  const preset = (location.state ?? {}) as { mode?: ModeFilter; period?: 'today' | 'all' };

  const blank = { receiptType: 'chit', groupId: '', customerId: '', amount: '', mode: 'cash', upiId: '', accountHolder: '', referenceNo: '', date: today, remarks: '' };
  const form = useForm(blank);
  const v = form.values;
  const [printing, setPrinting] = useState<ReceiptData | null>(null);

  const groupOf = (id: string) => groups.find(g => g.id === id);
  const customer = customers.find(c => c.id === v.customerId);
  // One receipt type: the amount is applied to the oldest pending due (overdue ones first).

  // Arrears per customer (unpaid dues past their date).
  const arrearsBy = new Map<string, number>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) arrearsBy.set(d.customerId, (arrearsBy.get(d.customerId) ?? 0) + d.pendingAmount);
  }
  const eligible = customers.filter(c =>
    (c.status === 'active' || c.autoInactive || (arrearsBy.get(c.id) ?? 0) > 0) && c.pending > 0
    && (!v.groupId || c.groupId === v.groupId));
  const groupLabel = (id: string) => { const g = groupOf(id); return g ? `${g.groupName} (${g.groupCode})` : 'No group'; };
  const nameOptions = eligible.map(c => ({ value: c.id, label: c.name, hint: `${c.customerId} · ${groupLabel(c.groupId)}`, keywords: c.mobile }));
  const idOptions = eligible.map(c => ({ value: c.id, label: c.customerId, hint: `${c.name} · ${groupLabel(c.groupId)}`, keywords: c.mobile }));
  const groupOptions = groups.filter(g => customers.some(c => c.groupId === g.id)).map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode})` }));

  // Picking a customer fills in the group; picking a group clears a customer from another group.
  const pickCustomer = (id: string) => {
    form.set('customerId', id);
    const c = customers.find(x => x.id === id);
    if (c) form.set('groupId', c.groupId);
  };
  const pickGroup = (id: string) => {
    form.set('groupId', id);
    if (customer && id && customer.groupId !== id) form.set('customerId', '');
  };

  const limit = customer ? customer.pending : 0;
  const arrears = customer ? arrearsBy.get(customer.id) ?? 0 : 0;
  const paid = Number(v.amount) || 0;
  const balanceAfter = customer ? Math.max(0, customer.pending - paid) : 0;
  const nextDue = customer ? dueSchedules.find(d => d.customerId === customer.id && d.pendingAmount > 0) : undefined;

  // Next receipt number as the server will assign it (shown for reference only).
  const prefix = 'RCP';
  const lastNo = [...collections, ...cancelledReceipts].filter(c => c.receiptNo.startsWith(prefix))
    .reduce((m, c) => Math.max(m, Number(c.receiptNo.slice(3)) || 0), 0);
  const nextNo = `${prefix}${String(lastNo + 1).padStart(6, '0')}`;

  const problem = !customer ? 'Select the customer'
    : paid <= 0 ? 'Enter the paid amount'
    : paid > limit + 0.001 ? `Paid amount is more than the pending amount of ${formatCurrency(limit)}`
    : v.mode === 'bank' && !v.upiId.trim() && !v.referenceNo.trim() ? 'Enter the UPI ID (or a reference number) for a bank payment'
    : '';

  const save = async (print: boolean) => {
    if (problem || !customer) return;
    const time = nowTime();
    const paymentMode = v.mode === 'cash' ? 'cash' : v.upiId.trim() ? 'upi' : 'bank_transfer';
    let receiptNo = '';
    const ok = await form.submit(async values => {
      const res = await api.post<{ receiptNo: string }>('/collections', {
        customerId: values.customerId, receiptType: values.receiptType, amount: values.amount, paymentMode,
        referenceNo: values.mode === 'bank' ? values.referenceNo : '',
        upiId: values.mode === 'bank' ? values.upiId : '', accountHolder: values.mode === 'bank' ? values.accountHolder : '',
        date: values.date, time, remarks: values.remarks,
      });
      receiptNo = res.receiptNo;
      return res;
    }, r => `Receipt ${r.receiptNo} saved`);
    if (!ok) return;
    if (print) {
      setPrinting({
        receiptNo, type: 'chit', date: v.date, time,
        customerName: customer.name, customerCode: customer.customerId, mobile: customer.mobile,
        groupName: groupOf(customer.groupId)?.groupName ?? '-', dueNumber: nextDue?.dueNumber ?? null,
        amount: paid, paymentMode, referenceNo: v.mode === 'bank' ? v.referenceNo.trim() : '',
        upiId: v.mode === 'bank' ? v.upiId.trim() : '', accountHolder: v.mode === 'bank' ? v.accountHolder.trim() : '',
        balance: balanceAfter, staffName: currentUser?.name ?? '', companyAddress: settings.companyAddress,
      });
    }
    form.reset({ ...blank, date: v.date });
  };

  const reprint = (c: Collection) => {
    const cust = customers.find(x => x.id === c.customerId);
    setPrinting({
      receiptNo: c.receiptNo, type: c.receiptType, date: c.date, time: c.time,
      customerName: c.customerName, customerCode: cust?.customerId ?? '', mobile: cust?.mobile ?? '',
      groupName: c.groupName, dueNumber: c.dueNumber || null, amount: c.collectedAmount,
      paymentMode: c.paymentMode, referenceNo: c.referenceNo, upiId: c.upiId, accountHolder: c.accountHolder,
      balance: cust?.pending ?? 0, staffName: c.staffName, companyAddress: settings.companyAddress,
    });
  };

  // ----- List -----
  const [from, setFrom] = useState(preset.period === 'all' ? '' : preset.period === 'today' ? today : today.slice(0, 8) + '01');
  const [to, setTo] = useState(preset.period === 'all' ? '' : today);
  const [modeFilter, setModeFilter] = useState<ModeFilter>(preset.mode ?? '');
  const [groupFilter, setGroupFilter] = useState('');
  const rows = collections.filter(c => inDateRange(c.date, from, to)
    && (!modeFilter || (modeFilter === 'bank') === isBank(c))
    && (!groupFilter || c.groupId === groupFilter));
  const sum = (xs: Collection[]) => xs.reduce((s, c) => s + c.collectedAmount, 0);
  const cashTotal = sum(rows.filter(c => !isBank(c)));
  const bankTotal = sum(rows.filter(isBank));
  const todayTotal = sum(collections.filter(c => c.date === today));

  const columns = [
    { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (c: Collection) => <span className="font-mono text-xs text-primary-600">{c.receiptNo}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (c: Collection) => <span>{c.date} <span className="text-gray-400">{c.time}</span></span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (c: Collection) => {
      const cust = customers.find(x => x.id === c.customerId);
      return <div><p className="font-medium text-gray-900">{c.customerName}</p><p className="text-xs text-gray-500 font-mono">{cust?.customerId}</p></div>;
    }},
    { key: 'groupName', label: 'Group' },
    { key: 'collectedAmount', label: 'Paid', sortable: true, render: (c: Collection) => <span className="text-success-600 font-medium">{formatCurrency(c.collectedAmount)}</span> },
    { key: 'pendingAmount', label: 'Pending', render: (c: Collection) => {
      const cust = customers.find(x => x.id === c.customerId);
      return <span className="text-danger-600">{formatCurrency(cust?.pending ?? 0)}</span>;
    }},
    { key: 'paymentMode', label: 'Mode', render: (c: Collection) => (
      <div>
        <Badge variant={isBank(c) ? 'blue' : 'success'}>{isBank(c) ? 'BANK' : 'CASH'}</Badge>
        {(c.upiId || c.referenceNo) && <p className="text-[11px] text-gray-500 mt-0.5">{c.upiId || c.referenceNo}</p>}
      </div>
    )},
    { key: 'accountHolder', label: 'A/c Holder', render: (c: Collection) => c.accountHolder || '-' },
    { key: 'staffName', label: 'Entered By' },
    { key: 'status', label: 'Status', render: (c: Collection) => <StatusBadge status={c.status} /> },
    { key: 'print', label: '', render: (c: Collection) => (
      <button onClick={() => reprint(c)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Print receipt" aria-label="Print receipt"><Printer className="w-4 h-4" /></button>
    )},
  ];

  const toggle = (value: string, label: string, Icon: typeof Banknote) => (
    <button type="button" onClick={() => form.set('mode', value)}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${v.mode === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
  const stat = (label: string, value: string, tone: string) => (
    <div className={`rounded-lg p-3 ${tone}`}><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold">{value}</p></div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Receipt Entry" subtitle="Enter customer receipts and view the receipt list" actions={<ExportButtons filename="receipts" rows={rows} />} />

      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-gray-900">New Receipt</h3>
          <div className="text-sm text-gray-600">Receipt No: <span className="font-mono font-semibold text-primary-700">{nextNo}</span> <span className="text-xs text-gray-400">(auto-generated)</span></div>
        </div>

        <div className="space-y-5">
          <Section title="Customer">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SearchSelect label="Customer Name" value={v.customerId} onChange={pickCustomer} options={nameOptions} required
                placeholder={nameOptions.length ? 'Search name or mobile...' : 'No customers with pending dues'} error={form.errors.customerId} />
              <SearchSelect label="Customer ID" value={v.customerId} onChange={pickCustomer} options={idOptions} placeholder="Search customer ID..." />
              <SearchSelect label="Group" value={v.groupId} onChange={pickGroup} options={groupOptions} placeholder="All groups" />
            </div>
          </Section>

          <Section title="Amount">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stat('Total Amount', formatCurrency(customer?.totalDue ?? 0), 'bg-gray-50 text-gray-900')}
              {stat(arrears > 0 ? `Pending (${formatCurrency(arrears)} overdue)` : 'Pending Amount', formatCurrency(limit), 'bg-danger-50 text-danger-700')}
              <Input label="Paid Amount" type="number" min={1} {...form.field('amount')} required
                placeholder={nextDue ? String(Math.min(nextDue.pendingAmount, limit)) : '0'} error={form.errors.amount ?? (customer && paid > limit + 0.001 ? `Max ${formatCurrency(limit)}` : undefined)} />
              {stat('Balance After', formatCurrency(balanceAfter), 'bg-gold-50 text-gold-800')}
            </div>
            {nextDue && <p className="text-xs text-gray-500 mt-2">Next due: #{nextDue.dueNumber} on {nextDue.dueDate} · {formatCurrency(nextDue.pendingAmount)}. The amount is applied to the oldest pending due first.</p>}
          </Section>

          <Section title="Payment">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <p className="block text-xs font-medium text-gray-600 mb-1">Payment Mode <span className="text-danger-500">*</span></p>
                <div className="flex gap-2">{toggle('cash', 'Cash', Banknote)}{toggle('bank', 'Bank', Landmark)}</div>
              </div>
              <Input label="Date" type="date" {...form.field('date')} required />
              {v.mode === 'bank' ? (
                <Input label="Reference / UTR No" format="reference" maxLength={60} {...form.field('referenceNo')} placeholder="Optional if UPI ID is given" />
              ) : <div className="hidden md:block" />}
              {v.mode === 'bank' && <>
                <Input label="UPI ID" maxLength={60} {...form.field('upiId')} placeholder="e.g. murugan@okaxis" />
                <Input label="Account Holder Name" format="name" maxLength={120} {...form.field('accountHolder')} placeholder="Name on the bank account" className="md:col-span-2" />
              </>}
              <TextArea label="Remarks" {...form.field('remarks')} placeholder="Optional remarks" rows={2} className="md:col-span-3" />
            </div>
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
          {problem && customer && <p className="text-sm text-warning-700 mr-auto">{problem}</p>}
          <button onClick={() => form.reset(blank)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Clear</button>
          <button onClick={() => save(false)} disabled={!!problem || form.submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50"><Save className="w-4 h-4" /> Save</button>
          <button onClick={() => save(true)} disabled={!!problem || form.submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md disabled:opacity-50"><Printer className="w-4 h-4" /> Save & Print Receipt</button>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Receipt List</h3>
      <DateFilterPanel label="Receipt Date" from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} today={today}>
        <span className="flex items-center gap-1"><ReceiptIcon className="w-4 h-4" /> {rows.length} receipts · <span className="font-semibold text-gray-900">{formatCurrency(sum(rows))}</span></span>
      </DateFilterPanel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Today Collect" value={formatCurrency(todayTotal)} icon={<CalendarDays className="w-6 h-6" />} color="success" />
        <KPICard title="Cash (selected dates)" value={formatCurrency(cashTotal)} icon={<Wallet className="w-6 h-6" />} color="primary" />
        <KPICard title="Bank (selected dates)" value={formatCurrency(bankTotal)} icon={<Landmark className="w-6 h-6" />} color="gold" />
      </div>
      <FilterBar>
        <Select label="Payment Mode" value={modeFilter} onChange={x => setModeFilter(x as ModeFilter)} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank / UPI' }]} placeholder="All modes" />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All groups" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['receiptNo', 'customerName', 'groupName', 'upiId', 'accountHolder', 'referenceNo']} pageSize={10} emptyMessage="No receipts for these filters" />

      <Modal isOpen={!!printing} onClose={() => setPrinting(null)} title={`Receipt ${printing?.receiptNo ?? ''}`} size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setPrinting(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Close</button>
            <button onClick={printThermalReceipt} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Printer className="w-4 h-4" /> Print</button>
          </div>
        }
      >
        {printing && <div className="flex justify-center"><ThermalReceipt data={printing} /></div>}
      </Modal>
    </div>
  );
}

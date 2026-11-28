import { useState } from 'react';
import { Input } from '@/components/FormControls';
import UpiQr from '@/components/UpiQr';
import { upiLink } from '@/lib/upi';
import ThermalReceipt, { type ReceiptData } from '@/components/ThermalReceipt';
import { printThermalReceipt } from '@/lib/thermalPrint';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { useMyCustomers } from '@/hooks/useMyCustomers';
import { api } from '@/lib/api';
import { formatCurrency, nowTime } from '@/lib/format';
import type { Collection, Customer } from '@/types';
import StaffDebit from '@/components/StaffDebit';
import { MyDaySummary } from '@/components/MyDay';
import { MyRouteToday } from '@/components/MyRouteToday';
import { currentPosition, useLocationHeartbeat } from '@/lib/geo';
import { Banknote, QrCode, Search, Receipt, Printer, Plus, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

const blank = { amount: '', paymentMode: 'cash', referenceNo: '', customerId: '' };
/** Notes and coins for the denomination count (must match CollectionController::NOTES). */
const NOTES = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/**
 * Collection staff's payment screen: amount (with a UPI QR for that amount),
 * customer, AR or chit group receipt, then a 58 mm receipt to print on a
 * Bluetooth thermal printer.
 */
export default function StaffCollect() {
  const { currentUser } = useApp();
  const { customers, groups, dueSchedules, collections, settings, today } = useData();
  const form = useForm(blank);
  const v = form.values;
  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  // While this screen is open, the phone reports its position for the office's live map.
  useLocationHeartbeat();

  const amount = Number(v.amount) || 0;
  const isUpi = v.paymentMode === 'upi';

  // Customers with something left to pay; the staff member's (or agent's) own customers first.
  const { isMine: mine } = useMyCustomers();
  const q = search.trim().toLowerCase();
  const payable = customers
    .filter(c => c.status !== 'closed' && c.pending > 0)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.customerId.toLowerCase().includes(q) || c.mobile.includes(q))
    .sort((a, b) => Number(mine(b)) - Number(mine(a)) || a.name.localeCompare(b.name))
    .slice(0, 30);

  const customer = customers.find(c => c.id === v.customerId);
  const dues = customer ? dueSchedules.filter(d => d.customerId === customer.id && d.pendingAmount > 0) : [];
  const overdue = dues.filter(d => d.dueDate < today);
  const arrears = overdue.reduce((s, d) => s + d.pendingAmount, 0);
  // Automatic group validation: a customer with overdue dues is an AR customer. An amount
  // within the arrears is an AR receipt; anything more is a chit receipt (which still
  // clears the oldest dues first). No manual choice.
  const isAr = !!customer && arrears > 0 && amount <= arrears + 0.001;
  const limit = customer ? customer.pending : 0;
  const firstDue = (isAr ? overdue : dues)[0];
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '-';

  const pickCustomer = (c: Customer) => {
    form.set('customerId', c.id);
    setSearch('');
  };

  // Cash denominations counted.
  const [notes, setNotes] = useState<Record<number, string>>({});
  const counted = NOTES.reduce((s, n) => s + n * (Number(notes[n]) || 0), 0);
  const denominations = NOTES.filter(n => Number(notes[n]) > 0).map(n => `${n}x${Number(notes[n])}`).join(',');
  const setNote = (n: number, count: string) => {
    const next = { ...notes, [n]: count.replace(/\D/g, '').slice(0, 4) };
    setNotes(next);
    // Counting the notes fills in the amount.
    const total = NOTES.reduce((s, x) => s + x * (Number(next[x]) || 0), 0);
    form.set('amount', total ? String(total) : '');
  };
  const isCash = v.paymentMode === 'cash';

  const problem = !amount ? 'Enter the amount'
    : !customer ? 'Select the customer'
    : amount > limit + 0.001 ? `Amount is more than the balance of ${formatCurrency(limit)}`
    : isCash && counted > 0 && Math.abs(counted - amount) > 0.001 ? `Notes counted (${formatCurrency(counted)}) do not match the amount`
    : isUpi && !v.referenceNo.trim() ? 'Enter the UPI reference number after the customer pays'
    : '';

  const generate = async () => {
    if (problem || !customer) return;
    const time = nowTime();
    let receiptNo = '';
    const point = await currentPosition();
    const ok = await form.submit(async values => {
      const res = await api.post<{ receiptNo: string }>('/collections', {
        customerId: values.customerId, receiptType: isAr ? 'arrear' : 'chit', amount: values.amount,
        paymentMode: values.paymentMode, referenceNo: values.referenceNo, date: today, time,
        denominations: isCash ? denominations : '', ...(point ?? {}),
      });
      receiptNo = res.receiptNo;
      return res;
    }, r => `Receipt ${r.receiptNo} generated`);
    if (!ok) return;
    setReceipt({
      receiptNo, type: isAr ? 'arrear' : 'chit', date: today, time,
      customerName: customer.name, customerCode: customer.customerId, mobile: customer.mobile,
      groupName: groupName(customer.groupId), dueNumber: firstDue?.dueNumber ?? null,
      amount, paymentMode: v.paymentMode, referenceNo: v.referenceNo.trim(),
      denominations: isCash ? denominations : '',
      balance: Math.max(0, customer.pending - amount),
      staffName: currentUser?.name ?? '', companyAddress: settings.companyAddress,
    });
  };

  const startNew = () => { form.reset(blank); setReceipt(null); setSearch(''); setNotes({}); };

  // Reprint one of today's receipts by this staff member.
  const reprint = (c: Collection) => {
    const cust = customers.find(x => x.id === c.customerId);
    setReceipt({
      receiptNo: c.receiptNo, type: c.receiptType, date: c.date, time: c.time,
      customerName: c.customerName, customerCode: cust?.customerId ?? '', mobile: cust?.mobile ?? '',
      groupName: c.groupName, dueNumber: c.dueNumber || null, amount: c.collectedAmount,
      paymentMode: c.paymentMode, referenceNo: c.referenceNo, denominations: c.denominations, balance: cust?.pending ?? 0,
      staffName: c.staffName, companyAddress: settings.companyAddress,
    });
  };

  const step = (n: number, title: string) => (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
      <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">{n}</span>{title}
    </h2>
  );
  const card = 'bg-white rounded-xl shadow-card border border-gray-100 p-4';

  if (receipt) {
    return (
      <div className="max-w-md mx-auto space-y-4 animate-fade-in">
        <div className="flex items-center gap-2 text-success-700 bg-success-50 border border-success-200 rounded-lg p-3 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> Receipt {receipt.receiptNo} — {formatCurrency(receipt.amount)}
        </div>
        <div className="flex justify-center"><ThermalReceipt data={receipt} /></div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={printThermalReceipt} className="flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700">
            <Printer className="w-5 h-5" /> Print
          </button>
          <button onClick={startNew} className="flex items-center justify-center gap-2 py-3 border border-primary-200 text-primary-700 bg-white font-medium rounded-lg hover:bg-primary-50">
            <Plus className="w-5 h-5" /> New Collection
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center">Print opens the phone's print screen — choose your Bluetooth printer (58 mm paper).</p>
      </div>
    );
  }

  // Phone: one column, My Day first. Laptop: the collection steps on the left, and
  // My Day, Debit and today's route in a column on the right.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start animate-fade-in">
      <aside className="space-y-4 lg:order-2">
        {/* Today so far: collected, handed over, debits and cash in hand. */}
        <MyDaySummary />
        <div className="hidden lg:block space-y-4">
          <StaffDebit />
          <MyRouteToday onReprint={reprint} />
        </div>
      </aside>

      <div className="space-y-4 lg:order-1 min-w-0">
      {/* 1. Amount, with the UPI QR for it */}
      <section className={card}>
        {step(1, 'Amount')}
        <Input label="Amount Received (₹)" type="number" min={1} {...form.field('amount')} placeholder="0" required />
        <div className="grid grid-cols-2 gap-2 mt-3">
          {([['cash', 'Cash', Banknote], ['upi', 'UPI / QR', QrCode]] as const).map(([mode, label, Icon]) => (
            <button key={mode} type="button" onClick={() => form.set('paymentMode', mode)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium ${v.paymentMode === mode ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        {isCash && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Denomination (notes received)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {NOTES.filter(n => n >= 10).map(n => (
                <label key={n} className="flex items-stretch rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
                  <span className="flex items-center justify-center w-14 flex-shrink-0 bg-gray-50 border-r border-gray-200 text-xs font-semibold text-gray-700 tabular-nums">₹{n}</span>
                  <input inputMode="numeric" value={notes[n] ?? ''} onChange={e => setNote(n, e.target.value)} placeholder="0"
                    className="w-full min-w-0 px-2 py-2 text-sm text-center tabular-nums outline-none" aria-label={`Number of ${n} rupee notes`} />
                </label>
              ))}
            </div>
            {counted > 0 && (
              <p className={`text-xs mt-2 ${Math.abs(counted - amount) > 0.001 ? 'text-danger-600' : 'text-success-700'}`}>
                Counted {formatCurrency(counted)}{Math.abs(counted - amount) > 0.001 ? ` — amount is ${formatCurrency(amount)}` : ' ✓'}
              </p>
            )}
          </div>
        )}
        {isUpi && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {!settings.upiId ? (
              <p className="flex gap-2 text-sm text-warning-800 bg-warning-50 border border-warning-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> The company UPI ID is not set. Ask the office to add it in Company Profile.
              </p>
            ) : (
              // Always shown: with the amount filled in once it is typed, otherwise the payer enters it.
              <>
                <UpiQr text={upiLink(settings.upiId, settings.upiPayeeName, amount, customer ? `${customer.customerId} ${isAr ? 'AR' : 'chit'}` : 'Chit collection')} size={220} />
                {amount > 0
                  ? <p className="text-sm text-gray-700">Scan to pay <span className="font-bold">{formatCurrency(amount)}</span></p>
                  : <p className="text-sm text-gray-700">Scan to pay · <span className="text-gray-500">customer enters the amount (type it above to fix it in the QR)</span></p>}
                <p className="text-xs text-gray-500">{settings.upiPayeeName || settings.upiId} · {settings.upiId}</p>
              </>
            )}
            <Input label="UPI Reference No (after payment)" format="reference" maxLength={60} {...form.field('referenceNo')} placeholder="12-digit UTR from the customer's app" className="w-full" required />
          </div>
        )}
      </section>

      {/* 2. Customer */}
      <section className={card}>
        {step(2, 'Customer')}
        {customer ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{customer.name}</p>
              <p className="text-xs text-gray-500">{customer.customerId} · {customer.mobile} · {groupName(customer.groupId)}</p>
              <p className="text-xs mt-1">Balance <span className="font-semibold">{formatCurrency(customer.pending)}</span>
                {arrears > 0 && <> · Arrears <span className="font-semibold text-danger-600">{formatCurrency(arrears)}</span></>}</p>
            </div>
            <button onClick={() => form.set('customerId', '')} className="text-xs text-primary-600 font-medium whitespace-nowrap">Change</button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, customer ID or mobile"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {payable.length === 0 && <li className="py-3 text-sm text-gray-400 text-center">No customers with dues match</li>}
              {payable.map(c => (
                <li key={c.id}>
                  <button onClick={() => pickCustomer(c)} className="w-full text-left py-2.5 px-1 hover:bg-gray-50">
                    <p className="text-sm font-medium text-gray-900">{c.name} {mine(c) && <span className="text-[10px] text-primary-600 font-semibold ml-1">MY ROUTE</span>}</p>
                    <p className="text-xs text-gray-500">{c.customerId} · {c.mobile} · Balance {formatCurrency(c.pending)}</p>
                  </button>
                </li>
              ))}
            </ul>
            {form.errors.customerId && <p className="text-xs text-danger-600 mt-1">{form.errors.customerId}</p>}
          </>
        )}
      </section>

      {/* 3. Checked automatically: chit group customer or AR customer */}
      <section className={card}>
        {step(3, 'Group Check (automatic)')}
        {!customer ? <p className="text-sm text-gray-400">Select the customer to check.</p> : (
          <div className={`flex items-start gap-3 rounded-lg p-3 border ${arrears > 0 ? 'bg-danger-50 border-danger-200' : 'bg-success-50 border-success-200'}`}>
            {arrears > 0 ? <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" /> : <ShieldCheck className="w-5 h-5 text-success-600 flex-shrink-0" />}
            <div className="text-sm">
              <p className="font-semibold text-gray-900">{arrears > 0 ? 'AR Customer' : 'Chit Group Customer'} · {groupName(customer.groupId)}</p>
              <p className="text-xs text-gray-600 mt-0.5">{arrears > 0
                ? `${overdue.length} overdue instalment${overdue.length === 1 ? '' : 's'} · ${formatCurrency(arrears)} arrears. ${amount > 0 ? (isAr ? 'This is an AR receipt.' : 'Amount covers the arrears and more — saved as a chit receipt.') : ''}`
                : `No arrears. Pays the next instalment${firstDue ? ` (#${firstDue.dueNumber}, ${formatCurrency(firstDue.pendingAmount)})` : ''} first.`}</p>
            </div>
          </div>
        )}
      </section>

      {/* 4. Generate */}
      <div>
        <button onClick={generate} disabled={!!problem || form.submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-success-600 text-white font-semibold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
          <Receipt className="w-5 h-5" /> {form.submitting ? 'Generating…' : 'Generate Receipt'}
        </button>
        {problem && <p className="text-xs text-gray-500 text-center mt-2">{problem}</p>}
        {form.errors.amount && <p className="text-xs text-danger-600 text-center mt-1">{form.errors.amount}</p>}
        {form.errors.denominations && <p className="text-xs text-danger-600 text-center mt-1">{form.errors.denominations}</p>}
      </div>

      {/* Phone only (on laptops these sit in the right column): debit and today's route. */}
      <div className="lg:hidden space-y-4">
        <StaffDebit />
        <MyRouteToday onReprint={reprint} />
      </div>
      </div>
    </div>
  );
}

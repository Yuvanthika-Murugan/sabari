import { useState } from 'react';
import { Input } from '@/components/FormControls';
import UpiQr from '@/components/UpiQr';
import { upiLink } from '@/lib/upi';
import ThermalReceipt, { type ReceiptData } from '@/components/ThermalReceipt';
import { printThermalReceipt } from '@/lib/thermalPrint';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency, nowTime } from '@/lib/format';
import type { Collection, Customer } from '@/types';
import { Banknote, QrCode, Search, Receipt, Printer, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

const blank = { amount: '', paymentMode: 'cash', referenceNo: '', customerId: '', receiptType: 'chit' };

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

  const amount = Number(v.amount) || 0;
  const isUpi = v.paymentMode === 'upi';

  // Customers with something left to pay; the staff member's own route first.
  const mine = (c: Customer) => c.staffId === currentUser?.id;
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
  const isAr = v.receiptType === 'arrear';
  const limit = customer ? (isAr ? arrears : customer.pending) : 0;
  const firstDue = (isAr ? overdue : dues)[0];
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '-';

  const pickCustomer = (c: Customer) => {
    form.set('customerId', c.id);
    // An AR customer is collected as an AR receipt by default.
    const hasArrears = dueSchedules.some(d => d.customerId === c.id && d.pendingAmount > 0 && d.dueDate < today);
    form.set('receiptType', hasArrears ? 'arrear' : 'chit');
    setSearch('');
  };

  const problem = !amount ? 'Enter the amount'
    : !customer ? 'Select the customer'
    : isAr && arrears <= 0 ? 'This customer has no arrears — choose Chit Group Customer'
    : amount > limit + 0.001 ? `Amount is more than the ${isAr ? 'arrears' : 'balance'} of ${formatCurrency(limit)}`
    : isUpi && !v.referenceNo.trim() ? 'Enter the UPI reference number after the customer pays'
    : '';

  const generate = async () => {
    if (problem || !customer) return;
    const time = nowTime();
    let receiptNo = '';
    const ok = await form.submit(async values => {
      const res = await api.post<{ receiptNo: string }>('/collections', {
        customerId: values.customerId, receiptType: values.receiptType, amount: values.amount,
        paymentMode: values.paymentMode, referenceNo: values.referenceNo, date: today, time,
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
      balance: Math.max(0, customer.pending - amount),
      staffName: currentUser?.name ?? '', companyAddress: settings.companyAddress,
    });
  };

  const startNew = () => { form.reset(blank); setReceipt(null); setSearch(''); };

  // Reprint one of today's receipts by this staff member.
  const myToday = collections.filter(c => c.date === today && c.staffId === currentUser?.id);
  const reprint = (c: Collection) => {
    const cust = customers.find(x => x.id === c.customerId);
    setReceipt({
      receiptNo: c.receiptNo, type: c.receiptType, date: c.date, time: c.time,
      customerName: c.customerName, customerCode: cust?.customerId ?? '', mobile: cust?.mobile ?? '',
      groupName: c.groupName, dueNumber: c.dueNumber || null, amount: c.collectedAmount,
      paymentMode: c.paymentMode, referenceNo: c.referenceNo, balance: cust?.pending ?? 0,
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

  return (
    <div className="max-w-md mx-auto space-y-4 animate-fade-in">
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
        {isUpi && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {!settings.upiId ? (
              <p className="flex gap-2 text-sm text-warning-800 bg-warning-50 border border-warning-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> The company UPI ID is not set. Ask the office to add it in Company Profile.
              </p>
            ) : amount > 0 ? (
              <>
                <UpiQr text={upiLink(settings.upiId, settings.upiPayeeName, amount, customer ? `${customer.customerId} ${isAr ? 'AR' : 'chit'}` : 'Chit collection')} size={220} />
                <p className="text-sm text-gray-700">Scan to pay <span className="font-bold">{formatCurrency(amount)}</span></p>
                <p className="text-xs text-gray-500">{settings.upiPayeeName || settings.upiId} · {settings.upiId}</p>
              </>
            ) : <p className="text-sm text-gray-500">Enter the amount to show the QR.</p>}
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

      {/* 3. AR or chit group customer */}
      <section className={card}>
        {step(3, 'Receipt Type')}
        <div className="grid grid-cols-2 gap-2">
          {([['chit', 'Chit Group Customer'], ['arrear', 'AR Customer']] as const).map(([type, label]) => (
            <button key={type} type="button" onClick={() => form.set('receiptType', type)}
              disabled={type === 'arrear' && !!customer && arrears <= 0}
              className={`py-2.5 rounded-lg border text-sm font-medium disabled:opacity-40 ${v.receiptType === type ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        {customer && <p className="text-xs text-gray-500 mt-2">{isAr
          ? `AR receipt: pays overdue instalments only (up to ${formatCurrency(arrears)}).`
          : `Chit receipt: pays the next instalment${firstDue ? ` (#${firstDue.dueNumber}, ${formatCurrency(firstDue.pendingAmount)})` : ''} first.`}</p>}
      </section>

      {/* 4. Generate */}
      <div>
        <button onClick={generate} disabled={!!problem || form.submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-success-600 text-white font-semibold rounded-xl hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
          <Receipt className="w-5 h-5" /> {form.submitting ? 'Generating…' : 'Generate Receipt'}
        </button>
        {problem && <p className="text-xs text-gray-500 text-center mt-2">{problem}</p>}
        {form.errors.amount && <p className="text-xs text-danger-600 text-center mt-1">{form.errors.amount}</p>}
      </div>

      {myToday.length > 0 && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">My receipts today ({formatCurrency(myToday.reduce((s, c) => s + c.collectedAmount, 0))})</h2>
          <ul className="divide-y divide-gray-100">
            {myToday.map(c => (
              <li key={c.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{c.customerName}</p>
                  <p className="text-xs text-gray-500">{c.receiptNo} · {c.time.slice(0, 5)} · {formatCurrency(c.collectedAmount)}</p>
                </div>
                <button onClick={() => reprint(c)} className="flex items-center gap-1 text-xs text-primary-600 font-medium"><Printer className="w-3.5 h-3.5" /> Reprint</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Input } from '@/components/FormControls';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Wallet, HandCoins, MinusCircle, Banknote, ChevronDown, ChevronUp } from 'lucide-react';

const card = 'bg-white rounded-xl shadow-card border border-gray-100 p-4';

/** The signed-in collection staff member's / agent's figures for today. */
export function useMyDay() {
  const { currentUser } = useApp();
  const { collections, expenses, cashHandovers, today } = useData();
  const me = currentUser?.id;
  const receipts = collections.filter(c => c.date === today && c.staffId === me).sort((a, b) => a.time.localeCompare(b.time));
  const cash = receipts.filter(c => c.paymentMode === 'cash').reduce((s, c) => s + c.collectedAmount, 0);
  const upi = receipts.reduce((s, c) => s + c.collectedAmount, 0) - cash;
  const cashDebits = expenses.filter(e => e.date === today && e.staffId === me && e.paymentMode === 'cash').reduce((s, e) => s + e.amount, 0);
  const handovers = cashHandovers.filter(h => h.date === today && h.userId === me);
  const handedOver = handovers.reduce((s, h) => s + h.amount, 0);
  const inHand = Math.max(0, cash - cashDebits - handedOver);
  return { receipts, cash, upi, total: cash + upi, cashDebits, handovers, handedOver, inHand };
}

/**
 * Collection app, top of the Collect screen: what I collected today (cash / UPI), the
 * cash I handed over to the office, my cash debits, and the cash still in my hand.
 * The handover is recorded here.
 */
export function MyDaySummary() {
  const d = useMyDay();
  const [open, setOpen] = useState(false);
  const form = useForm({ amount: '', remarks: '' });

  const save = async () => {
    if (await form.submit(v => api.post<{ handoverNo: string }>('/handovers', v), r => `Handover ${r.handoverNo} saved`)) {
      form.reset({ amount: '', remarks: '' });
      setOpen(false);
    }
  };

  const tiles = [
    { label: 'Collected today', value: d.total, sub: `${d.receipts.length} receipt${d.receipts.length === 1 ? '' : 's'}`, icon: Wallet, tone: 'text-success-700', bg: 'bg-success-50' },
    { label: 'Cash handed over', value: d.handedOver, sub: `${d.handovers.length} handover${d.handovers.length === 1 ? '' : 's'}`, icon: HandCoins, tone: 'text-primary-700', bg: 'bg-primary-50' },
    { label: 'Cash debits', value: d.cashDebits, sub: 'Expenses / returns', icon: MinusCircle, tone: 'text-danger-700', bg: 'bg-danger-50' },
    { label: 'Cash in hand', value: d.inHand, sub: 'To hand over', icon: Banknote, tone: 'text-warning-700', bg: 'bg-warning-50' },
  ];

  return (
    <section className={card}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">My Day</h2>
        <span className="text-xs text-gray-500 tabular-nums">Cash {formatCurrency(d.cash)} · UPI {formatCurrency(d.upi)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(t => (
          <div key={t.label} className={`rounded-lg ${t.bg} px-3 py-2.5`}>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600"><t.icon className="w-3.5 h-3.5" /> {t.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${t.tone}`}>{formatCurrency(t.value)}</p>
            <p className="text-[11px] text-gray-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <button onClick={() => { setOpen(o => !o); if (!form.values.amount && d.inHand) form.set('amount', String(d.inHand)); }}
        className="mt-3 w-full flex items-center justify-between text-sm font-medium text-primary-700 border border-primary-100 bg-primary-50/50 rounded-lg px-3 py-2 hover:bg-primary-50">
        <span className="flex items-center gap-2"><HandCoins className="w-4 h-4" /> Hand over cash to office</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <Input label="Amount handed over (₹)" type="number" min={1} {...form.field('amount')} required />
          <Input label="Remarks" {...form.field('remarks')} placeholder="e.g. Given to cashier" />
          <button onClick={save} disabled={form.submitting || !(Number(form.values.amount) > 0)}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {form.submitting ? 'Saving…' : 'Save Handover'}
          </button>
        </div>
      )}
      {d.handovers.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 text-xs">
          {d.handovers.map(h => (
            <li key={h.id} className="flex items-center justify-between py-1.5 gap-2">
              <span className="text-gray-500">{h.handoverNo} · {h.time}{h.remarks ? ` · ${h.remarks}` : ''}</span>
              <span className="font-semibold text-primary-700 tabular-nums">{formatCurrency(h.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

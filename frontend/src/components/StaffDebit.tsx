import { useState } from 'react';
import { Input, Select } from '@/components/FormControls';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { MinusCircle, ChevronDown, ChevronUp } from 'lucide-react';

/** Debit kinds a collection staff member can enter (must be in ExpenseController::CATEGORIES). */
const STAFF_CATEGORIES = ['Customer Return', 'Travel', 'Tea & Refreshments', 'Telephone & Internet', 'Agent Handover', 'Other'];

/**
 * Staff app: record money paid out today (expense or a return to a customer). It shows
 * as Cash / Bank Debit against the staff member in Today Collection.
 */
export default function StaffDebit() {
  const { currentUser } = useApp();
  const { expenses, agents, today } = useData();
  const [open, setOpen] = useState(false);
  const blank = { category: '', amount: '', paymentMode: 'cash', agentId: '', remarks: '' };
  const form = useForm(blank);
  const v = form.values;
  const mine = expenses.filter(e => e.date === today && e.staffId === currentUser?.id);
  const isHandover = v.category === 'Agent Handover';
  const problem = !v.category ? 'Choose what it is for' : !(Number(v.amount) > 0) ? 'Enter the amount' : isHandover && !v.agentId ? 'Select the agent' : '';

  const save = async () => {
    if (problem) return;
    if (await form.submit(x => api.post<{ expenseNo: string }>('/expenses', x), r => `Debit ${r.expenseNo} saved`)) form.reset(blank);
  };

  return (
    <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-900">
        <span className="flex items-center gap-2"><MinusCircle className="w-5 h-5 text-danger-600" /> Debit (Expense / Return)</span>
        <span className="flex items-center gap-2 text-xs font-normal text-gray-500">
          {mine.length > 0 && <>Today {formatCurrency(mine.reduce((s, e) => s + e.amount, 0))}</>}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <Select label="For" {...form.field('category')} options={STAFF_CATEGORIES.map(c => ({ value: c, label: c }))} placeholder="Select..." required />
          {isHandover && <Select label="Agent" {...form.field('agentId')} options={agents.filter(a => a.status === 'active').map(a => ({ value: a.id, label: a.name }))} placeholder="Select agent..." required />}
          <Input label="Amount (₹)" type="number" min={1} {...form.field('amount')} placeholder="0" required />
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'bank'] as const).map(m => (
              <button key={m} type="button" onClick={() => form.set('paymentMode', m)}
                className={`py-2 rounded-lg border text-sm font-medium ${v.paymentMode === m ? 'bg-danger-600 border-danger-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                {m === 'cash' ? 'Cash' : 'Bank / UPI'}
              </button>
            ))}
          </div>
          <Input label="Remarks" {...form.field('remarks')} placeholder="e.g. Petrol, refund to customer" />
          <button onClick={save} disabled={!!problem || form.submitting}
            className="w-full py-2.5 bg-danger-600 text-white text-sm font-semibold rounded-lg hover:bg-danger-700 disabled:opacity-50">
            {form.submitting ? 'Saving…' : 'Save Debit'}
          </button>
          {problem && v.category && <p className="text-xs text-gray-500 text-center">{problem}</p>}
          {mine.length > 0 && (
            <ul className="divide-y divide-gray-100 border-t border-gray-100 pt-1">
              {mine.map(e => (
                <li key={e.id} className="flex justify-between py-1.5 text-xs">
                  <span className="text-gray-700">{e.expenseNo} · {e.category}{e.remarks ? ` · ${e.remarks}` : ''}</span>
                  <span className="font-semibold text-danger-600">{formatCurrency(e.amount)} {e.paymentMode === 'bank' ? '(Bank)' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

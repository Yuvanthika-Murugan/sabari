import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import Modal, { ModalFooter } from '@/components/Modal';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import { Input, Select, TextArea } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useAction, useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { ChitSettlement } from '@/types';
import { CheckCircle2, XCircle, Banknote, Clock, ShieldCheck, HandCoins } from 'lucide-react';

type Status = ChitSettlement['status'];
const STATUS: Record<Status, { label: string; variant: 'warning' | 'blue' | 'success' | 'danger' }> = {
  requested: { label: 'Waiting for Super Admin', variant: 'warning' },
  approved: { label: 'Approved · to pay', variant: 'blue' },
  paid: { label: 'Paid', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};
const MODE_LABEL: Record<string, string> = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' };

/**
 * Chit settlements (payout when a customer's chit is finishing).
 * panel="superadmin": the Super Admin (MD) approves or rejects requests.
 * panel="admin": the Admin pays out the approved ones.
 * Both see every request and its progress.
 */
export default function Settlements({ panel }: { panel: 'superadmin' | 'admin' }) {
  const { settlements, bankAccounts, cashTransactions, customers, dueSchedules, auctions, groups, users, agents, today } = useData();
  const { run, busy } = useAction();

  // Customers ready for a settlement with no request yet: every instalment paid, or the
  // last instalment is tomorrow or earlier; not already prized in an auction.
  const ready = customers.flatMap(c => {
    if (!c.groupId || c.status === 'closed') return [];
    const dues = dueSchedules.filter(d => d.customerId === c.id && d.groupId === c.groupId);
    if (!dues.length) return [];
    const finalDue = dues.reduce((m, d) => (d.dueDate > m ? d.dueDate : m), '');
    const from = new Date(Date.parse(finalDue) - 86_400_000).toISOString().slice(0, 10);
    const fullyPaid = dues.every(d => d.pendingAmount <= 0);
    if (!fullyPaid && today < from) return [];
    if (settlements.some(s => s.customerId === c.id && s.groupId === c.groupId && s.status !== 'rejected')) return [];
    if (auctions.some(a => a.customerId === c.id && a.groupId === c.groupId)) return [];
    const g = groups.find(x => x.id === c.groupId);
    const by = users.find(u => u.id === c.staffId)?.name ?? agents.find(a => a.id === c.agentId)?.name ?? '-';
    return [{ c, g, finalDue, fullyPaid, by }];
  });
  const raise = (customerId: string, name: string) =>
    run(() => api.post('/settlements', { customerId, note: 'Raised by office' }), `Settlement requested for ${name}`);
  const [filter, setFilter] = useState<Status | ''>(panel === 'superadmin' ? 'requested' : 'approved');
  const [deciding, setDeciding] = useState<{ s: ChitSettlement; action: 'approve' | 'reject' } | null>(null);
  const [paying, setPaying] = useState<ChitSettlement | null>(null);
  const decision = useForm({ amount: '', note: '' });
  const payout = useForm({ payoutMode: 'cash', bankAccountId: '', payoutReference: '', paidDate: today });
  const cashInHand = cashTransactions.length ? cashTransactions[cashTransactions.length - 1].balance : 0;

  const count = (st: Status) => settlements.filter(s => s.status === st);
  const sum = (xs: ChitSettlement[]) => xs.reduce((t, s) => t + s.amount, 0);
  const rows = filter ? settlements.filter(s => s.status === filter) : settlements;

  const openDecide = (s: ChitSettlement, action: 'approve' | 'reject') => { decision.reset({ amount: String(s.amount), note: '' }); setDeciding({ s, action }); };
  const decide = async () => {
    if (!deciding) return;
    const { s, action } = deciding;
    if (await decision.submit(v => api.post(`/settlements/${s.id}/decide`, { action, ...v }), action === 'approve' ? `${s.settlementNo} approved — Admin can pay it now` : `${s.settlementNo} rejected`)) setDeciding(null);
  };
  const openPay = (s: ChitSettlement) => { payout.reset({ payoutMode: 'cash', bankAccountId: '', payoutReference: '', paidDate: today }); setPaying(s); };
  const pay = async () => {
    if (paying && await payout.submit(v => api.post(`/settlements/${paying.id}/pay`, v), `${paying.settlementNo} paid`)) setPaying(null);
  };

  const tabs: { value: Status | ''; label: string }[] = [
    { value: 'requested', label: `Waiting (${count('requested').length})` },
    { value: 'approved', label: `Approved (${count('approved').length})` },
    { value: 'paid', label: `Paid (${count('paid').length})` },
    { value: 'rejected', label: `Rejected (${count('rejected').length})` },
    { value: '', label: `All (${settlements.length})` },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Chit Settlements"
        subtitle={panel === 'superadmin'
          ? 'Approve or reject payout requests from collection staff and agents'
          : 'Pay out the settlements approved by the Super Admin'} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Waiting approval" value={String(count('requested').length)} icon={<Clock className="w-6 h-6" />} trend="neutral" trendValue={formatCurrency(sum(count('requested')))} color="warning" />
        <KPICard title="Approved · to pay" value={String(count('approved').length)} icon={<ShieldCheck className="w-6 h-6" />} trend="neutral" trendValue={formatCurrency(sum(count('approved')))} color="primary" />
        <KPICard title="Paid" value={String(count('paid').length)} icon={<CheckCircle2 className="w-6 h-6" />} trend="neutral" trendValue={formatCurrency(sum(count('paid')))} color="success" />
        <KPICard title="Rejected" value={String(count('rejected').length)} icon={<XCircle className="w-6 h-6" />} trend="neutral" trendValue={formatCurrency(sum(count('rejected')))} color="danger" />
      </div>

      {ready.length > 0 && (
        <div className="bg-gold-50 border border-gold-200 rounded-xl p-4 mb-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1"><HandCoins className="w-4 h-4 text-gold-700" /> Ready for settlement ({ready.length})</h3>
          <p className="text-xs text-gray-600 mb-3">Fully paid, or the last instalment is tomorrow or earlier — no request yet. The collection staff / agent can request it from their app, or raise it here.</p>
          <ul className="divide-y divide-gold-100">
            {ready.map(({ c, g, finalDue, fullyPaid, by }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name} <span className="text-[11px] font-mono text-gray-400">{c.customerId}</span></p>
                  <p className="text-xs text-gray-500">{g?.groupName ?? '-'} · value {formatCurrency(g?.groupValue ?? 0)} · last instalment {finalDue} · staff/agent {by}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={fullyPaid ? 'success' : 'warning'}>{fullyPaid ? 'Fully paid' : `Balance ${formatCurrency(c.pending)}`}</Badge>
                  <button onClick={() => raise(c.id, c.name)} disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gold-500 text-primary-950 rounded-lg hover:bg-gold-400 disabled:opacity-50">
                    <HandCoins className="w-3.5 h-3.5" /> Raise request
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.label} onClick={() => setFilter(t.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filter === t.value ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <HandCoins className="w-10 h-10 mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No settlements here.</p>
            <p className="text-xs text-gray-400">Collection staff and agents request them from their app, from the day before a customer's last instalment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gray-50">
                <tr>
                  {['No', 'Customer', 'Group', 'Last Instalment', 'Requested'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
                  {['Status', 'Details', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-xs font-mono text-primary-600 whitespace-nowrap">{s.settlementNo}</td>
                    <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{s.customerName}</p><p className="text-[11px] text-gray-500">{s.customerCode} · {s.mobile}</p></td>
                    <td className="px-4 py-3"><p className="text-sm text-gray-800">{s.groupName}</p><p className="text-[11px] text-gray-500">{s.groupCode} · value {formatCurrency(s.groupValue)}</p></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{s.finalDueDate || '-'}</td>
                    <td className="px-4 py-3"><p className="text-sm text-gray-800">{s.requestedBy}</p><p className="text-[11px] text-gray-500 whitespace-nowrap">{s.requestedAt}</p>{s.requestNote && <p className="text-[11px] text-gray-500 italic max-w-[200px]">“{s.requestNote}”</p>}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums whitespace-nowrap">{formatCurrency(s.amount)}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge></td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 max-w-[220px]">
                      {s.decidedBy && <p>{s.status === 'rejected' ? 'Rejected' : 'Approved'} by {s.decidedBy} · {s.decidedAt}</p>}
                      {s.decisionNote && <p className="italic">“{s.decisionNote}”</p>}
                      {s.status === 'paid' && <p className="text-success-700">Paid {s.paidDate} · {MODE_LABEL[s.payoutMode] ?? s.payoutMode}{s.payoutReference ? ` · ${s.payoutReference}` : ''} · by {s.paidBy}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {panel === 'superadmin' && s.status === 'requested' && (
                        <div className="flex gap-2">
                          <button onClick={() => openDecide(s, 'approve')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-success-600 text-white rounded-lg hover:bg-success-700"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                          <button onClick={() => openDecide(s, 'reject')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-danger-200 text-danger-700 rounded-lg hover:bg-danger-50"><XCircle className="w-3.5 h-3.5" /> Reject</button>
                        </div>
                      )}
                      {panel === 'admin' && s.status === 'approved' && (
                        <button onClick={() => openPay(s)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Banknote className="w-3.5 h-3.5" /> Pay out</button>
                      )}
                      {panel === 'admin' && s.status === 'requested' && <span className="text-[11px] text-gray-400">Needs Super Admin approval</span>}
                      {panel === 'superadmin' && s.status === 'approved' && <span className="text-[11px] text-gray-400">Admin will pay</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Super Admin: approve (with the amount) or reject (with a reason). */}
      <Modal isOpen={!!deciding} onClose={() => setDeciding(null)} title={deciding?.action === 'approve' ? 'Approve Settlement' : 'Reject Settlement'} size="md"
        footer={<ModalFooter onCancel={() => setDeciding(null)} onSubmit={decide} submitting={decision.submitting}
          submitLabel={deciding?.action === 'approve' ? 'Approve' : 'Reject'} variant={deciding?.action === 'reject' ? 'danger' : 'primary'} />}>
        {deciding && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-semibold text-gray-900">{deciding.s.customerName} · {deciding.s.groupName}</p>
              <p className="text-xs text-gray-500">{deciding.s.settlementNo} · requested by {deciding.s.requestedBy} · last instalment {deciding.s.finalDueDate}</p>
            </div>
            {deciding.action === 'approve' && <Input label="Amount to pay (₹)" type="number" min={1} {...decision.field('amount')} required />}
            <TextArea label={deciding.action === 'approve' ? 'Note (optional)' : 'Reason'} {...decision.field('note')} placeholder={deciding.action === 'approve' ? 'e.g. Pay by cheque' : 'Why it is rejected'} />
          </div>
        )}
      </Modal>

      {/* Admin: pay out an approved settlement. */}
      <Modal isOpen={!!paying} onClose={() => setPaying(null)} title="Pay Chit Settlement"
        footer={<ModalFooter onCancel={() => setPaying(null)} onSubmit={pay} submitLabel="Pay Out" submitting={payout.submitting} icon={<Banknote className="w-4 h-4" />} />}>
        {paying && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full bg-success-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">{paying.customerName} · {paying.groupName} · {paying.settlementNo}</p>
              <p className="text-2xl font-bold text-success-700">{formatCurrency(paying.amount)}</p>
              <p className="text-[11px] text-gray-500">Approved by {paying.decidedBy}{paying.decisionNote ? ` · “${paying.decisionNote}”` : ''}</p>
            </div>
            <Select label="Payout Mode" {...payout.field('payoutMode')} required options={[{ value: 'cash', label: `Cash (in hand ${formatCurrency(cashInHand)})` }, { value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }]} />
            <Input label="Payment Date" type="date" {...payout.field('paidDate')} required />
            {payout.values.payoutMode !== 'cash' && (
              <>
                <Select label="From Bank Account" {...payout.field('bankAccountId')} required
                  options={bankAccounts.filter(b => b.status === 'active').map(b => ({ value: b.id, label: `${b.bankName} ${b.accountNumber.slice(-4)} · ${formatCurrency(b.currentBalance)}` }))} />
                <Input label={payout.values.payoutMode === 'cheque' ? 'Cheque No' : 'Transaction Ref'} {...payout.field('payoutReference')} required />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import Badge from '@/components/Badge';
import CollectionForm from '@/components/CollectionForm';
import Modal, { ModalFooter } from '@/components/Modal';
import { TextArea } from '@/components/FormControls';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { MyDaySummary } from '@/components/MyDay';
import { MyRouteToday } from '@/components/MyRouteToday';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useMyCustomers } from '@/hooks/useMyCustomers';
import { daysBetween, formatCurrency } from '@/lib/format';
import { customerAddress, mapsLink } from '@/lib/maps';
import { Target, Wallet, AlertCircle, Users, Phone, Eye, HandCoins, MapPin, UserX, CheckCircle2, CalendarClock } from 'lucide-react';

/** One figure on the collection dashboard; every card has the same layout. */
function Stat({ label, value, unit, icon, tone }: { label: string; value: string; unit?: string; icon: ReactNode; tone: 'primary' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    primary: 'bg-primary-100 text-primary-600',
    success: 'bg-success-100 text-success-600',
    warning: 'bg-warning-100 text-warning-600',
    danger: 'bg-danger-100 text-danger-600',
  };
  const valueTone = { primary: 'text-gray-900', success: 'text-success-700', warning: 'text-warning-700', danger: 'text-gray-900' };
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-5 flex flex-col justify-between gap-3 min-h-[112px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide leading-snug">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${tones[tone]}`}>{icon}</div>
      </div>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${valueTone[tone]}`}>
        {value}{unit && <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>}
      </p>
    </div>
  );
}

export default function StaffDashboard() {
  const { currentUser } = useApp();
  const { customers, groups, branches, dueSchedules, collections, settlements, auctions, today } = useData();
  const { agent, isMine } = useMyCustomers();
  const navigate = useNavigate();
  const [showCollect, setShowCollect] = useState<string | null>(null);

  const myCustomers = customers.filter(c => isMine(c) && (c.status === 'active' || c.autoInactive));

  // Route: customers with something due today or earlier, plus what is due.
  const todayRoute = myCustomers.map(c => {
    const dues = dueSchedules.filter(d => d.customerId === c.id && d.pendingAmount > 0);
    const dueNow = dues.filter(d => d.dueDate <= today);
    return {
      ...c,
      groupName: groups.find(g => g.id === c.groupId)?.groupName ?? '-',
      dueNow: dueNow.reduce((s, d) => s + d.pendingAmount, 0),
      nextDue: dues[0],
    };
  }).filter(c => c.dueNow > 0 || collections.some(col => col.customerId === c.id && col.date === today))
    .sort((a, b) => b.dueNow - a.dueNow);

  const todayCollected = collections.filter(c => c.date === today && c.staffId === currentUser?.id).reduce((s, c) => s + c.collectedAmount, 0);
  const todayPending = todayRoute.reduce((s, c) => s + c.dueNow, 0);
  const todayTarget = todayCollected + todayPending;
  const remaining = todayRoute.filter(c => c.dueNow > 0).length;
  const progress = todayTarget ? Math.min(100, Math.round((todayCollected / todayTarget) * 100)) : 0;

  // Every assigned customer with their next unpaid instalment, soonest first: shows who
  // pays when even on days when nothing is due.
  const allMine = myCustomers.map(c => {
    const dues = dueSchedules.filter(d => d.customerId === c.id).sort((a, b) => a.dueNumber - b.dueNumber);
    const unpaid = dues.filter(d => d.pendingAmount > 0);
    // Chit settlement: can be asked for once every instalment is paid, or from the day before
    // the last instalment; once per chit, unless the customer already took the prize in an auction.
    const finalDue = dues[dues.length - 1]?.dueDate ?? '';
    const requestFrom = finalDue ? new Date(Date.parse(finalDue) - 86_400_000).toISOString().slice(0, 10) : '';
    const fullyPaid = dues.length > 0 && unpaid.length === 0;
    const settlement = settlements.find(s => s.customerId === c.id && s.groupId === c.groupId && s.status !== 'rejected');
    const wonAuction = auctions.some(a => a.customerId === c.id && a.groupId === c.groupId);
    return {
      ...c,
      groupName: groups.find(g => g.id === c.groupId)?.groupName ?? '-',
      next: unpaid[0],
      paidCount: dues.length - unpaid.length,
      dueCount: dues.length,
      finalDue, requestFrom, settlement, wonAuction, fullyPaid,
      canRequest: !!requestFrom && (fullyPaid || today >= requestFrom) && !settlement && !wonAuction,
    };
  }).sort((a, b) => (a.next?.dueDate ?? '9999').localeCompare(b.next?.dueDate ?? '9999'));

  // Request a settlement (payout) for a finishing chit: goes to the Super Admin for approval.
  const [requesting, setRequesting] = useState<(typeof allMine)[number] | null>(null);
  const requestForm = useForm({ note: '' });
  const sendRequest = async () => {
    if (requesting && await requestForm.submit(v => api.post('/settlements', { customerId: requesting.id, note: v.note }),
      `Settlement requested for ${requesting.name} — waiting for Super Admin approval`)) setRequesting(null);
  };
  const settlementCell = (c: (typeof allMine)[number]) => {
    if (c.settlement) {
      const s = c.settlement;
      const map = { requested: ['Waiting approval', 'bg-warning-50 text-warning-700'], approved: ['Approved · Admin to pay', 'bg-primary-50 text-primary-700'], paid: [`Paid ${s.paidDate}`, 'bg-success-50 text-success-700'], rejected: ['Rejected', 'bg-danger-50 text-danger-700'] } as const;
      const [label, cls] = map[s.status];
      return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cls}`} title={s.settlementNo}>{label} · {formatCurrency(s.amount)}</span>;
    }
    if (c.wonAuction) return <span className="text-[11px] text-gray-400">Prize taken in auction</span>;
    if (c.canRequest) {
      return (
        <button onClick={() => { requestForm.reset({ note: '' }); setRequesting(c); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-gold-500 text-primary-950 rounded-lg hover:bg-gold-400 whitespace-nowrap">
          <HandCoins className="w-3.5 h-3.5" /> Request settlement
        </button>
      );
    }
    return <span className="text-[11px] text-gray-400 whitespace-nowrap" title="Available once all instalments are paid, or from the day before the last instalment">{c.requestFrom ? `When fully paid / from ${c.requestFrom}` : '-'}</span>;
  };
  const dueLabel = (date?: string) => !date ? { text: 'All paid', cls: 'text-success-600' }
    : date < today ? { text: `${daysBetween(date, today)}d overdue`, cls: 'text-danger-600' }
    : date === today ? { text: 'Due today', cls: 'text-warning-700' }
    : { text: `in ${daysBetween(today, date)} days`, cls: 'text-gray-500' };

  const role = agent ? `Agent ${agent.agentCode}` : 'Collection Staff';
  // The customer on Google Maps: their saved location (exact pin), else address, area and branch town.
  const mapFor = (c: { address: string; area: string; branchId: string; latitude: string | null; longitude: string | null }) => {
    if (c.latitude && c.longitude) return mapsLink({ lat: c.latitude, lng: c.longitude });
    const q = customerAddress(c, branches.find(b => b.id === c.branchId)?.name ?? '');
    return q ? mapsLink({ address: q }) : '';
  };
  const actions = (c: { id: string; name: string; mobile: string; pending: number; address: string; area: string; branchId: string; latitude: string | null; longitude: string | null }) => (
    <div className="flex items-center gap-1">
      <a href={`tel:${c.mobile}`} className="p-2 rounded-lg hover:bg-primary-50 text-primary-600" title="Call" aria-label={`Call ${c.name}`}><Phone className="w-4 h-4" /></a>
      {mapFor(c) && <a href={mapFor(c)} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-primary-50 text-primary-600" title="Open address in Google Maps" aria-label={`Map for ${c.name}`}><MapPin className="w-4 h-4" /></a>}
      <button onClick={() => navigate('/statements', { state: { customerId: c.id } })} className="p-2 rounded-lg hover:bg-primary-50 text-primary-600" title="View statement" aria-label="View statement"><Eye className="w-4 h-4" /></button>
      {c.pending > 0 && (
        <button onClick={() => setShowCollect(c.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <HandCoins className="w-3.5 h-3.5" /> Collect
        </button>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Collection Dashboard" subtitle={`Welcome, ${currentUser?.name ?? 'Staff'} · ${role} · ${myCustomers.length} assigned customer${myCustomers.length === 1 ? '' : 's'}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Today's Target" value={formatCurrency(todayTarget)} icon={<Target className="w-5 h-5" />} tone="primary" />
        <Stat label="Collected Today" value={formatCurrency(todayCollected)} icon={<Wallet className="w-5 h-5" />} tone="success" />
        <Stat label="Still Due" value={formatCurrency(todayPending)} icon={<AlertCircle className="w-5 h-5" />} tone="warning" />
        <Stat label="Remaining" value={String(remaining)} unit={remaining === 1 ? 'customer' : 'customers'} icon={<Users className="w-5 h-5" />} tone="danger" />
      </div>

      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">Today's Progress</span>
          <span className="text-sm font-bold text-primary-700 tabular-nums">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5"><div className="bg-primary-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-xs text-gray-500 tabular-nums">{formatCurrency(todayCollected)} of {formatCurrency(todayTarget)} collected</p>
      </div>

      {/* Today: collected / handed over / cash in hand, and where I have collected so far. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 items-start">
        <MyDaySummary />
        <MyRouteToday />
      </div>

      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900"><MapPin className="w-5 h-5 text-primary-600" /> Today's Collection Route</h3>
          {todayRoute.length > 0 && <span className="text-xs text-gray-500">{todayRoute.length} customer{todayRoute.length === 1 ? '' : 's'}</span>}
        </div>

        {todayRoute.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {myCustomers.length === 0 ? (
              <>
                <UserX className="w-10 h-10 mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">No customers assigned to you yet</p>
                <p className="mt-1 text-xs text-gray-500">Ask the office to assign customers. You can still collect from any customer on the Collect screen.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-10 h-10 mx-auto text-success-400" />
                <p className="mt-3 text-sm font-medium text-gray-700">Nothing due today — all caught up</p>
                {allMine[0]?.next && (
                  <p className="mt-1 text-xs text-gray-500">Next payment: <span className="font-semibold text-gray-700">{allMine[0].next.dueDate}</span> · {allMine[0].name} · {formatCurrency(allMine[0].next.pendingAmount)}. See "My Customers &amp; Next Payment" below.</p>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Phones: one card per customer. */}
            <ul className="md:hidden divide-y divide-gray-100">
              {todayRoute.map(c => (
                <li key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.groupName} · {c.mobile}</p>
                      {c.address && <p className="text-xs text-gray-400 truncate">{c.address}</p>}
                    </div>
                    {c.dueNow > 0 ? <Badge variant="warning">Pending</Badge> : <Badge variant="success">Collected</Badge>}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-sm"><span className="text-gray-500">Due: </span><span className="font-semibold text-danger-600 tabular-nums">{formatCurrency(c.dueNow)}</span></p>
                    {actions(c)}
                  </div>
                </li>
              ))}
            </ul>

            {/* Laptop / desktop: table. */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Customer', 'Phone', 'Address', 'Group', 'Next Due'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Due Till Today</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {todayRoute.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-700 font-bold text-xs flex-shrink-0">{c.name.charAt(0)}</div><span className="text-sm font-medium text-gray-900">{c.name}</span></div></td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{c.mobile}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={c.address}>{c.address || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.groupName}</td>
                      <td className="px-4 py-3 text-sm font-medium whitespace-nowrap tabular-nums">{c.nextDue ? `#${c.nextDue.dueNumber} · ${formatCurrency(c.nextDue.pendingAmount)}` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-right text-danger-600 font-semibold tabular-nums">{formatCurrency(c.dueNow)}</td>
                      <td className="px-4 py-3">{c.dueNow > 0 ? <Badge variant="warning">Pending</Badge> : <Badge variant="success">Collected</Badge>}</td>
                      <td className="px-4 py-3">{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* All my customers and when each pays next. */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden mt-6">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900"><CalendarClock className="w-5 h-5 text-primary-600" /> My Customers &amp; Next Payment</h3>
          <span className="text-xs text-gray-500">{allMine.length} customer{allMine.length === 1 ? '' : 's'}</span>
        </div>
        {allMine.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">No customers assigned to you yet.</p>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-gray-100">
              {allMine.map(c => {
                const l = dueLabel(c.next?.dueDate);
                return (
                  <li key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.groupName} · {c.mobile}</p>
                      </div>
                      <span className={`text-xs font-semibold whitespace-nowrap ${l.cls}`}>{l.text}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm">{c.next
                        ? <><span className="text-gray-500">Next: </span><span className="font-semibold tabular-nums">{c.next.dueDate} · {formatCurrency(c.next.pendingAmount)}</span></>
                        : <span className="text-success-600 font-medium">All paid</span>}</p>
                      {actions(c)}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-500">Settlement{c.finalDue ? ` · last instalment ${c.finalDue}` : ''}</span>
                      {settlementCell(c)}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Customer', 'Phone', 'Group', 'Next Due Date', 'When'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                    {['Next Amount', 'Balance'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                    {['Paid', 'Settlement', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMine.map(c => {
                    const l = dueLabel(c.next?.dueDate);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{c.name}</p><p className="text-[11px] font-mono text-gray-400">{c.customerId}</p></td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{c.mobile}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.groupName}</td>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{c.next ? `${c.next.dueDate} · #${c.next.dueNumber}` : '-'}</td>
                        <td className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${l.cls}`}>{l.text}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold">{c.next ? formatCurrency(c.next.pendingAmount) : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums text-danger-600">{formatCurrency(c.pending)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{c.paidCount} / {c.dueCount}</td>
                        <td className="px-4 py-3">{settlementCell(c)}</td>
                        <td className="px-4 py-3">{actions(c)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CollectionForm isOpen={!!showCollect} onClose={() => setShowCollect(null)} customerId={showCollect ?? undefined} />

      {/* Settlement request: goes to the Super Admin for approval, then the Admin pays. */}
      <Modal isOpen={!!requesting} onClose={() => setRequesting(null)} title="Request Chit Settlement" size="md"
        footer={<ModalFooter onCancel={() => setRequesting(null)} onSubmit={sendRequest} submitLabel="Send Request" submitting={requestForm.submitting} icon={<HandCoins className="w-4 h-4" />} />}>
        {requesting && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gold-50 border border-gold-200 p-3 text-sm">
              <p className="font-semibold text-gray-900">{requesting.name} · {requesting.groupName}</p>
              <p className="text-xs text-gray-600">Last instalment {requesting.finalDue} · paid {requesting.paidCount} of {requesting.dueCount} · balance {formatCurrency(requesting.pending)}</p>
            </div>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
              <li>Your request goes to the <span className="font-semibold">Super Admin</span> for approval.</li>
              <li>Once approved, the <span className="font-semibold">Admin</span> pays the customer.</li>
              <li>You can see the status here in the Settlement column.</li>
            </ol>
            <TextArea label="Note (optional)" {...requestForm.field('note')} placeholder="e.g. Customer wants it by cheque" />
          </div>
        )}
      </Modal>
    </div>
  );
}

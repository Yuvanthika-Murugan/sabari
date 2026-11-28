import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import KPICard from '@/components/KPICard';
import Badge from '@/components/Badge';
import StaffDayTable from '@/components/StaffDayTable';
import LiveStaffPanel from '@/components/LiveStaffPanel';
import SuperAdminCredentials from '@/components/SuperAdminCredentials';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { daysBetween, formatCurrency } from '@/lib/format';
import {
  Banknote, Landmark, Wallet, Receipt, UserPlus, AlertCircle, CheckCircle2, UsersRound,
  Clock, HandCoins, ShieldCheck, RefreshCw,
} from 'lucide-react';

/** Section heading with a number, so the panel reads in the order the MD asked for. */
function SectionTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3 mt-2">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-sm flex items-center justify-center">{n}</span>{title}
      </h2>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
  );
}

const card = 'bg-white rounded-xl shadow-card border border-gray-100 p-5';

/**
 * Super Admin panel (MD only): today's cash / bank collection by staff, AR (new
 * customers) and completed groups, pending, customers who paid today, and where the
 * collection staff are right now. Figures refresh automatically.
 */
export default function SuperAdmin() {
  const { currentUser } = useApp();
  const { collections, customers, groups, dueSchedules, dashboard, today, refresh } = useData();
  const [updated, setUpdated] = useState(() => new Date());

  // This panel is watched live: refresh every 30 s (the app-wide refresh also runs).
  useEffect(() => {
    const t = window.setInterval(() => { refresh().then(() => setUpdated(new Date())).catch(() => {}); }, 30_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  if (currentUser?.role !== 'md') return <Navigate to="/dashboard" replace />;

  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '-';

  // 1. Today collection.
  const todayRows = collections.filter(c => c.date === today);
  const cash = todayRows.filter(c => c.paymentMode === 'cash').reduce((s, c) => s + c.collectedAmount, 0);
  const bank = todayRows.filter(c => c.paymentMode !== 'cash').reduce((s, c) => s + c.collectedAmount, 0);
  const cashCount = todayRows.filter(c => c.paymentMode === 'cash').length;
  const bankCount = todayRows.length - cashCount;

  // 2. AR (new customers) and completed groups.
  const arrearsBy = new Map<string, number>();
  const oldestOverdue = new Map<string, string>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) {
      arrearsBy.set(d.customerId, (arrearsBy.get(d.customerId) ?? 0) + d.pendingAmount);
      if (!oldestOverdue.has(d.customerId) || d.dueDate < oldestOverdue.get(d.customerId)!) oldestOverdue.set(d.customerId, d.dueDate);
    }
  }
  const monthStart = today.slice(0, 8) + '01';
  const newCustomers = customers.filter(c => c.joiningDate >= monthStart).sort((a, b) => b.joiningDate.localeCompare(a.joiningDate));
  const newInAr = newCustomers.filter(c => arrearsBy.has(c.id));
  const arTotal = [...arrearsBy.values()].reduce((s, x) => s + x, 0);
  const completedGroups = groups.filter(g => g.status === 'completed');

  // 3. Pending: most overdue first.
  const overdueList = customers
    .filter(c => oldestOverdue.has(c.id))
    .map(c => ({ c, days: daysBetween(oldestOverdue.get(c.id)!, today), arrears: arrearsBy.get(c.id) ?? 0 }))
    .sort((a, b) => b.days - a.days);

  // 4. Payment customers today (one line per customer).
  const paying = new Map<string, { id: string; name: string; group: string; staff: string; time: string; amount: number; cash: number; bank: number; count: number }>();
  for (const c of todayRows) {
    const p = paying.get(c.customerId) ?? { id: c.customerId, name: c.customerName, group: c.groupName, staff: c.staffName, time: c.time.slice(0, 5), amount: 0, cash: 0, bank: 0, count: 0 };
    p.amount += c.collectedAmount;
    if (c.paymentMode === 'cash') p.cash += c.collectedAmount; else p.bank += c.collectedAmount;
    p.count += 1;
    paying.set(c.customerId, p);
  }
  const payingToday = [...paying.values()];

  const manualRefresh = () => refresh().then(() => setUpdated(new Date())).catch(() => {});

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Super Admin Panel (MD)"
        subtitle={`Live overview for ${today} · updated ${updated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-success-700 bg-success-50 border border-success-200 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" /> Live · every 30 s
            </span>
            <button onClick={manualRefresh} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
        }
      />

      {/* 1. Today Collection: Cash / Bank */}
      <SectionTitle n={1} title="Today Collection" hint="Cash / Bank, and by staff (Credit − Debit)" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard title="Today Cash" value={formatCurrency(cash)} icon={<Banknote className="w-6 h-6" />} trend="neutral" trendValue={`${cashCount} cash receipt${cashCount === 1 ? '' : 's'}`} color="success" to="/receipts/entry" state={{ mode: 'cash', period: 'today' }} />
        <KPICard title="Today Bank" value={formatCurrency(bank)} icon={<Landmark className="w-6 h-6" />} trend="neutral" trendValue={`${bankCount} bank / UPI receipt${bankCount === 1 ? '' : 's'}`} color="primary" to="/receipts/entry" state={{ mode: 'bank', period: 'today' }} />
        <KPICard title="Today Total" value={formatCurrency(cash + bank)} icon={<Wallet className="w-6 h-6" />} trend="neutral" trendValue="Cash + Bank" color="gold" to="/collections/today" />
        <KPICard title="Receipts Today" value={String(todayRows.length)} icon={<Receipt className="w-6 h-6" />} trend="neutral" trendValue={`${payingToday.length} customers paid`} color="primary" to="/receipts/entry" state={{ period: 'today' }} />
      </div>
      <StaffDayTable title="Today Collection by Staff" />

      {/* 2. AR (New Customer) and Complete Groups */}
      <SectionTitle n={2} title="AR (New Customer) & Complete Groups" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard title="New Customers" value={String(newCustomers.length)} icon={<UserPlus className="w-6 h-6" />} trend="neutral" trendValue="Joined this month" color="gold" to="/customers/list" />
        <KPICard title="New in AR" value={String(newInAr.length)} icon={<AlertCircle className="w-6 h-6" />} trend="neutral" trendValue="New customers already overdue" color="danger" to="/subscribers/arrears" state={{ show: 'arrears' }} />
        <KPICard title="All AR Customers" value={String(arrearsBy.size)} icon={<HandCoins className="w-6 h-6" />} trend="neutral" trendValue={`${formatCurrency(arTotal)} arrears`} color="warning" to="/subscribers/arrears" state={{ show: 'arrears' }} />
        <KPICard title="Complete Groups" value={String(completedGroups.length)} icon={<CheckCircle2 className="w-6 h-6" />} trend="neutral" trendValue={`of ${groups.length} groups`} color="success" to="/groups/list" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-900 mb-3">New Customers this month</h3>
          {newCustomers.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No new customers this month</p>}
          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {newCustomers.map(c => (
              <li key={c.id} className="flex items-center justify-between py-2 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.name} <span className="text-xs font-mono text-gray-400">{c.customerId}</span></p>
                  <p className="text-xs text-gray-500">{groupName(c.groupId)} · joined {c.joiningDate}</p>
                </div>
                {arrearsBy.has(c.id)
                  ? <Badge variant="danger">AR {formatCurrency(arrearsBy.get(c.id)!)}</Badge>
                  : <Badge variant="success">Regular</Badge>}
              </li>
            ))}
          </ul>
        </div>
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Completed Groups</h3>
          {completedGroups.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No group has completed yet</p>}
          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {completedGroups.map(g => (
              <li key={g.id} className="flex items-center justify-between py-2 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{g.groupName} <span className="text-xs font-mono text-gray-400">{g.groupCode}</span></p>
                  <p className="text-xs text-gray-500">{g.startDate} → {g.endDate} · {g.numberOfMembers} members</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(g.groupValue)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 3. Pending */}
      <SectionTitle n={3} title="Pending" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KPICard title="Due Till Today" value={formatCurrency(dashboard.stats.todayPending)} icon={<AlertCircle className="w-6 h-6" />} trend="neutral" trendValue="Overdue + due today" color="warning" to="/pending/customer" />
        <KPICard title="Total Outstanding" value={formatCurrency(dashboard.stats.totalPending)} icon={<Clock className="w-6 h-6" />} trend="neutral" trendValue="Including future dues" color="danger" to="/pending/customer" />
        <KPICard title="Overdue Customers" value={String(overdueList.length)} icon={<UsersRound className="w-6 h-6" />} trend="neutral" trendValue={`${formatCurrency(arTotal)} overdue`} color="danger" to="/pending/customer" />
      </div>
      <div className={`${card} mb-6`}>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Most overdue</h3>
        {overdueList.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Nobody is overdue</p>}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px]">
            {overdueList.length > 0 && (
              <thead className="bg-gray-50"><tr>{['Customer', 'Group', 'Mobile', 'Overdue', 'Days'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}</tr></thead>
            )}
            <tbody className="divide-y divide-gray-50">
              {overdueList.slice(0, 10).map(({ c, days, arrears }) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{groupName(c.groupId)}</td>
                  <td className="px-3 py-2 text-sm text-gray-600">{c.mobile}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-danger-600">{formatCurrency(arrears)}</td>
                  <td className="px-3 py-2"><Badge variant={days > 30 ? 'danger' : days > 7 ? 'warning' : 'gray'}>{days}d</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Payment Customer  ·  5. Live Agent Collection Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <SectionTitle n={4} title="Payment Customers" hint="Paid today" />
          <div className={card}>
            {payingToday.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No payments yet today</p>}
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {payingToday.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.group} · by {p.staff} · {p.time}{p.count > 1 ? ` · ${p.count} receipts` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success-600">{formatCurrency(p.amount)}</p>
                    <p className="text-[11px] text-gray-400">{[p.cash ? `Cash ${formatCurrency(p.cash)}` : '', p.bank ? `Bank ${formatCurrency(p.bank)}` : ''].filter(Boolean).join(' · ')}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <SectionTitle n={5} title="Live Agent Collection Area" hint="Where staff are collecting now" />
          <LiveStaffPanel />
        </div>
      </div>

      {/* 6. The panel's own Login ID / password. */}
      <SectionTitle n={6} title="Super Admin Login" hint="Login ID and password for this panel" />
      <SuperAdminCredentials />

      <p className="flex items-center gap-1.5 text-xs text-gray-400"><ShieldCheck className="w-3.5 h-3.5" /> MD panel · visible to the Managing Director only.</p>
    </div>
  );
}

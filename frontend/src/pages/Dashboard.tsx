import { useState } from 'react';
import {
  Wallet, Calendar, TrendingUp, AlertCircle, Landmark, Banknote, CheckCircle2,
  Phone, Eye, Check, X, Send, Clock, Receipt, Users, UsersRound
} from 'lucide-react';
import KPICard from '@/components/KPICard';
import Badge from '@/components/Badge';
import { PageHeader, StatusBadge } from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { canActOnPayment, usePaymentActions } from '@/hooks/usePayments';
import { daysBetween, formatCurrency, formatPercent } from '@/lib/format';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

const paymentModeBadge = (mode: string) => {
  const map: Record<string, 'success' | 'blue' | 'gold' | 'gray'> = {
    cash: 'success', upi: 'blue', bank_transfer: 'gold', cheque: 'gray',
  };
  return <Badge variant={map[mode] ?? 'gray'}>{mode.replace('_', ' ').toUpperCase()}</Badge>;
};

export default function Dashboard() {
  const { dashboard, collections, customers, paymentApprovals, users, groups, dueSchedules, today } = useData();
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const { act, busy } = usePaymentActions();
  const { stats: dashboardStats, dailyTrend, monthlyTrend, branchPerformance, staffPerformance } = dashboard;
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null);
  const todayCollections = collections.filter(c => c.date === today).slice(0, 8);

  // Oldest overdue due per customer, most overdue first.
  const oldestOverdue = new Map<string, string>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today && !oldestOverdue.has(d.customerId)) oldestOverdue.set(d.customerId, d.dueDate);
  }
  // Box figures: AR subscribers = anyone with an unpaid due past its date; completed = every due paid.
  let arrearsTotal = 0;
  const inArrears = new Set<string>();
  for (const d of dueSchedules) {
    if (d.pendingAmount > 0 && d.dueDate < today) { arrearsTotal += d.pendingAmount; inArrears.add(d.customerId); }
  }
  const arSubscribers = inArrears.size;
  const completedSubscribers = customers.filter(c => c.totalDue > 0 && c.pending <= 0).length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const activeGroups = groups.filter(g => g.status === 'active');

  const pendingCustomers = customers
    .filter(c => (c.status === 'active' || c.autoInactive) && oldestOverdue.has(c.id))
    .map(c => ({ ...c, days: daysBetween(oldestOverdue.get(c.id)!, today) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 6);
  const pendingApprovals = paymentApprovals.filter(p => ['payment_informed', 'manager_accepted', 'md_approved'].includes(p.currentStage)).slice(0, 5);
  const approving = paymentApprovals.find(pa => pa.id === showApproveModal);
  const decide = async (action: 'approve' | 'reject' | 'send_back', id = showApproveModal) => {
    const p = paymentApprovals.find(pa => pa.id === id);
    if (p && await act(p, action)) setShowApproveModal(null);
  };
  const trend = (v: number | null) => (v === null ? undefined : v >= 0 ? 'up' as const : 'down' as const);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Dashboard" subtitle="Overview of collection performance and financial status" />

      {/* Main boxes — each opens its page. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard title="Today Collected" value={formatCurrency(dashboardStats.todayCollection)} icon={<Wallet className="w-6 h-6" />} trend={trend(dashboardStats.todayChange)} trendValue={formatPercent(dashboardStats.todayChange, 'vs yesterday')} color="success" to="/collections/today" />
        <KPICard title="Total Cash" value={formatCurrency(dashboardStats.cashBalance)} icon={<Banknote className="w-6 h-6" />} trend="neutral" trendValue="Cash in hand" color="success" to="/cash-bank/cash" />
        <KPICard title="Total Bank" value={formatCurrency(dashboardStats.bankBalance)} icon={<Landmark className="w-6 h-6" />} trend="neutral" trendValue="All bank accounts" color="primary" to="/cash-bank/statement" />
        {/* Placeholder: the expense figure will be defined later. */}
        <KPICard title="Expense" value={formatCurrency(0)} icon={<Receipt className="w-6 h-6" />} trend="neutral" trendValue="To be set up" color="warning" />
        <KPICard title="Total Customers" value={String(customers.length)} icon={<Users className="w-6 h-6" />} trend="neutral" trendValue={`${activeCustomers} active`} color="primary" to="/customers/list" />
        <KPICard title="AR Subscribers" value={formatCurrency(arrearsTotal)} icon={<AlertCircle className="w-6 h-6" />} trend="neutral" trendValue={`${arSubscribers} subscriber${arSubscribers === 1 ? '' : 's'} overdue`} color="danger" to="/subscribers/arrears" state={{ show: 'arrears' }} />
        <KPICard title="Chit Groups" value={String(activeGroups.length)} icon={<UsersRound className="w-6 h-6" />} trend="neutral" trendValue={`${formatCurrency(activeGroups.reduce((s, g) => s + g.groupValue, 0))} total value`} color="gold" to="/groups/list" />
        <KPICard title="Completed AR Subscribers" value={String(completedSubscribers)} icon={<CheckCircle2 className="w-6 h-6" />} trend="neutral" trendValue="All dues paid" color="success" to="/subscribers/arrears" state={{ show: 'completed' }} />
      </div>

      {/* Other figures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard title="This Month" value={formatCurrency(dashboardStats.thisMonthCollection)} icon={<Calendar className="w-6 h-6" />} trend={trend(dashboardStats.monthChange)} trendValue={formatPercent(dashboardStats.monthChange, 'vs last month')} color="primary" to="/collections/summary" />
        <KPICard title="Total Collection" value={formatCurrency(dashboardStats.totalCollection)} icon={<TrendingUp className="w-6 h-6" />} trend="neutral" trendValue="All-time" color="gold" to="/collections/statement" />
        <KPICard title="Due Till Today" value={formatCurrency(dashboardStats.todayPending)} icon={<AlertCircle className="w-6 h-6" />} trend="neutral" trendValue="Overdue + due today" color="warning" to="/pending/customer" />
        <KPICard title="Total Outstanding" value={formatCurrency(dashboardStats.totalPending)} icon={<Clock className="w-6 h-6" />} trend="neutral" trendValue="Including future dues" color="danger" to="/pending/customer" />
        <KPICard title="Approval Pending" value={`${dashboardStats.approvalsPending} Payments`} icon={<CheckCircle2 className="w-6 h-6" />} color="gold" to="/payments/approval" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Daily Collection Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyTrend}>
              <defs>
                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2b5fb5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2b5fb5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="collection" stroke="#2b5fb5" strokeWidth={2} fill="url(#colGrad)" name="Collection" />
              <Area type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2} fill="url(#pendGrad)" name="Pending" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Collection Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="collection" fill="#2b5fb5" radius={[4,4,0,0]} name="Collection" />
              <Bar dataKey="pending" fill="#e3ad33" radius={[4,4,0,0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Collection vs Pending</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Collected', value: dashboardStats.totalCollection },
                  { name: 'Outstanding', value: dashboardStats.totalPending },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {[0, 1].map(i => (
                  <Cell key={i} fill={i === 0 ? '#2b5fb5' : '#f59e0b'} />
                ))}
              </Pie>
              <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Branch Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={branchPerformance} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="branch" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
              <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="collection" fill="#2b5fb5" radius={[4,4,0,0]} name="Collection" />
              <Bar dataKey="pending" fill="#ef4444" radius={[4,4,0,0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Staff Performance <span className="text-xs font-normal text-gray-500">(this month vs target)</span></h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={staffPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="staff" tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
            <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="collected" fill="#11a84e" radius={[0,4,4,0]} name="Collected" />
            <Bar dataKey="target" fill="#d9e6f8" radius={[0,4,4,0]} name="Target" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Today's Collection */}
        <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Today's Collection</h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Customer','Group','Branch','Due','Collected','Balance','Mode','Time','Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {todayCollections.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">No collections recorded today</td></tr>}
                {todayCollections.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{c.customerName}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{c.groupName}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{c.branchName}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(c.dueAmount)}</td>
                    <td className="px-3 py-2.5 text-sm font-medium text-success-600 whitespace-nowrap">{formatCurrency(c.collectedAmount)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(c.pendingAmount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{paymentModeBadge(c.paymentMode)}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{c.time}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Collections */}
        <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Overdue Customers</h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Customer','Phone','Group','Staff','Pending','Days','Action'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingCustomers.map(c => {
                  const grp = groups.find(g => g.id === c.groupId);
                  const st = users.find(u => u.id === c.staffId);
                  const days = c.days;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{c.name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">{c.mobile}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{grp?.groupName ?? '-'}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">{st?.name ?? '-'}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-danger-600 whitespace-nowrap">{formatCurrency(c.pending)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={days > 30 ? 'danger' : days > 7 ? 'warning' : 'gray'}>{days}d</Badge>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex gap-1">
                          <a href={`tel:${c.mobile}`} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="Call"><Phone className="w-4 h-4" /></a>
                          <button onClick={() => navigate('/statements')} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition-colors" title="View statement"><Eye className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Approval Queue */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Payment Approval Queue</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Customer','Amount','Mode','Submitted By','Submitted Time','Stage','Action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendingApprovals.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">No payments awaiting approval</td></tr>}
              {pendingApprovals.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{p.customerName}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{paymentModeBadge(p.paymentMode)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">{p.submittedBy}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500 whitespace-nowrap">{p.submittedTime}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge status={p.currentStage} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {canActOnPayment(currentUser?.role, p.currentStage) ? (
                      <div className="flex gap-1">
                        <button onClick={() => setShowApproveModal(p.id)} className="p-1.5 rounded-lg hover:bg-success-50 text-success-600 transition-colors" title="Review & approve"><Check className="w-4 h-4" /></button>
                        <button onClick={() => decide('reject', p.id)} disabled={busy} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors" title="Reject"><X className="w-4 h-4" /></button>
                        <button onClick={() => decide('send_back', p.id)} disabled={busy} className="p-1.5 rounded-lg hover:bg-gold-50 text-gold-600 transition-colors" title="Send Back"><Send className="w-4 h-4" /></button>
                      </div>
                    ) : <span className="text-xs text-gray-400">Awaiting {p.currentStage === 'payment_informed' ? 'manager' : 'MD'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm" onClick={() => setShowApproveModal(null)} />
          <div className="relative bg-white rounded-xl shadow-cardLg w-full max-w-md p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Payment</h3>
            {(() => {
              const p = approving;
              return (
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Customer</span><span className="text-sm font-medium text-gray-900">{p.customerName}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Amount</span><span className="text-sm font-medium text-gray-900">{formatCurrency(p.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Payment Mode</span><span className="text-sm font-medium text-gray-900 uppercase">{p.paymentMode}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Reference</span><span className="text-sm font-medium text-gray-900">{p.referenceNo}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Submitted By</span><span className="text-sm font-medium text-gray-900">{p.submittedBy}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Current Stage</span><StatusBadge status={p.currentStage} /></div>
                </div>
              );
            })()}
            <div className="flex gap-3 mt-6">
              <button onClick={() => decide('approve')} disabled={busy} className="flex-1 px-4 py-2 bg-success-600 text-white text-sm font-medium rounded-lg hover:bg-success-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"><Check className="w-4 h-4" /> {approving.currentStage === 'payment_informed' ? 'Accept' : 'Approve'}</button>
              <button onClick={() => decide('reject')} disabled={busy} className="flex-1 px-4 py-2 bg-danger-600 text-white text-sm font-medium rounded-lg hover:bg-danger-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"><X className="w-4 h-4" /> Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import Badge from '@/components/Badge';
import CollectionForm from '@/components/CollectionForm';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';
import { Target, Wallet, AlertCircle, Users, Phone, Eye, HandCoins, MapPin } from 'lucide-react';

export default function StaffDashboard() {
  const { currentUser } = useApp();
  const { customers, groups, dueSchedules, collections, today } = useData();
  const navigate = useNavigate();
  const [showCollect, setShowCollect] = useState<string | null>(null);

  const staffCustomers = customers.filter(c => c.staffId === currentUser?.id && (c.status === 'active' || c.autoInactive));

  // Route: customers with something due today or earlier, plus what is due.
  const todayRoute = staffCustomers.map(c => {
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

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Collection Dashboard" subtitle={`Welcome, ${currentUser?.name ?? 'Staff'} · ${staffCustomers.length} assigned customers`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-500 uppercase">Today's Target</p><div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"><Target className="w-5 h-5 text-primary-600" /></div></div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(todayTarget)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-500 uppercase">Today's Collected</p><div className="w-10 h-10 rounded-lg bg-success-100 flex items-center justify-center"><Wallet className="w-5 h-5 text-success-600" /></div></div>
          <p className="text-2xl font-bold text-success-700">{formatCurrency(todayCollected)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-500 uppercase">Still Due</p><div className="w-10 h-10 rounded-lg bg-warning-100 flex items-center justify-center"><AlertCircle className="w-5 h-5 text-warning-600" /></div></div>
          <p className="text-2xl font-bold text-warning-700">{formatCurrency(todayPending)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-gray-500 uppercase">Remaining</p><div className="w-10 h-10 rounded-lg bg-danger-100 flex items-center justify-center"><Users className="w-5 h-5 text-danger-600" /></div></div>
          <p className="text-2xl font-bold text-gray-900">{remaining} <span className="text-sm font-normal text-gray-500">customers</span></p>
        </div>
      </div>

      <div className="bg-primary-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-primary-700">Today's Progress</span><span className="text-sm font-bold text-primary-700">{progress}%</span></div>
        <div className="w-full bg-primary-100 rounded-full h-3"><div className="bg-primary-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900">Today's Collection Route</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>{['Customer', 'Phone', 'Address', 'Group', 'Next Due', 'Due Till Today', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {todayRoute.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Nothing due today — all caught up.</td></tr>}
              {todayRoute.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-700 font-bold text-xs">{c.name.charAt(0)}</div><span className="text-sm font-medium text-gray-900">{c.name}</span></div></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.mobile}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{c.address}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.groupName}</td>
                  <td className="px-4 py-3 text-sm font-medium">{c.nextDue ? `#${c.nextDue.dueNumber} · ${formatCurrency(c.nextDue.pendingAmount)}` : '-'}</td>
                  <td className="px-4 py-3 text-sm text-danger-600 font-medium">{formatCurrency(c.dueNow)}</td>
                  <td className="px-4 py-3">{c.dueNow > 0 ? <Badge variant="warning">Pending</Badge> : <Badge variant="success">Collected</Badge>}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <a href={`tel:${c.mobile}`} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Call"><Phone className="w-4 h-4" /></a>
                    <button onClick={() => navigate('/statements')} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="View statement"><Eye className="w-4 h-4" /></button>
                    {c.pending > 0 && <button onClick={() => setShowCollect(c.id)} className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700" title="Collect"><HandCoins className="w-3.5 h-3.5" /> Collect</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CollectionForm isOpen={!!showCollect} onClose={() => setShowCollect(null)} customerId={showCollect ?? undefined} />
    </div>
  );
}

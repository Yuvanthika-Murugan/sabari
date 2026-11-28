import type { ReactNode } from 'react';
import KPICard from '@/components/KPICard';
import { StatusBadge } from '@/components/PageHeader';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';
import { frequencyOptions } from '@/lib/options';
import type { Group } from '@/types';
import { Users, Wallet, TrendingUp, Calendar, Gavel } from 'lucide-react';

/** One label / value pair in the group's information grid. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">{children || <span className="text-gray-400 font-normal">-</span>}</dd>
    </div>
  );
}

/**
 * Everything about one chit group: its information (series, dates, instalments, fees,
 * auction schedule, PSO / agreement, company ticket), money figures, collection
 * progress, auctions held, and the member list. Used inline on the Group List when a
 * group is picked in the filter, and in the View dialog.
 */
export default function GroupDetails({ group: g }: { group: Group }) {
  const { branches, customers, auctions } = useData();
  const members = customers.filter(c => c.groupId === g.id);
  const enrolled = members.filter(c => c.status !== 'closed').length;
  const held = auctions.filter(a => a.groupId === g.id).sort((a, b) => a.auctionNo - b.auctionNo);
  const progress = g.groupValue ? Math.min(100, Math.round((g.collected / g.groupValue) * 100)) : 0;
  const instalment = g.duration > 0 ? g.groupValue / g.duration : 0;
  const frequency = frequencyOptions.find(f => f.value === g.frequency)?.label ?? g.frequency;
  const auctionTime = [g.auctionTimeFrom, g.auctionTimeTo].filter(Boolean).join(' – ');
  const auctionOn = g.auctionByValue ? `${g.auctionBy === 'week' ? 'Every' : 'Day'} ${g.auctionByValue}` : '';

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white flex-shrink-0"><Users className="w-7 h-7" /></div>
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-gray-900 truncate">{g.groupName}</h3>
            <p className="text-sm text-gray-500">{g.groupCode}{g.series ? ` · ${g.series}` : ''} · {branches.find(b => b.id === g.branchId)?.name ?? '-'}</p>
          </div>
        </div>
        <StatusBadge status={g.status} />
      </div>

      {/* Money */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Members" value={`${enrolled} / ${g.numberOfMembers}`} icon={<Users className="w-6 h-6" />} trend="neutral" trendValue={`${Math.max(0, g.numberOfMembers - enrolled)} seats open`} color="primary" />
        <KPICard title="Group Value" value={formatCurrency(g.groupValue)} icon={<Wallet className="w-6 h-6" />} trend="neutral" trendValue={`${formatCurrency(instalment)} per instalment`} color="gold" />
        <KPICard title="Collected" value={formatCurrency(g.collected)} icon={<TrendingUp className="w-6 h-6" />} trend="neutral" trendValue={`${progress}% of group value`} color="success" />
        <KPICard title="Pending" value={formatCurrency(g.pending)} icon={<Calendar className="w-6 h-6" />} trend="neutral" trendValue="Still to collect" color="warning" />
      </div>

      <div className="bg-primary-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-primary-700">Collection Progress</span><span className="text-sm font-bold text-primary-700 tabular-nums">{progress}%</span></div>
        <div className="w-full bg-primary-100 rounded-full h-3"><div className="bg-primary-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
      </div>

      {/* Information */}
      <div className="rounded-xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Group Information</h4>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <Field label="Start Date">{g.startDate}</Field>
          <Field label="End Date">{g.endDate}</Field>
          <Field label="Instalments">{`${g.duration} · ${frequency}`}</Field>
          <Field label="Instalment Amount">{formatCurrency(instalment)}</Field>
          <Field label="Admission Fee">{formatCurrency(g.admissionFee)}</Field>
          <Field label="Service Tax">{`${g.serviceTax}%`}</Field>
          <Field label="Company Commission">{`${g.companyCommPct}%`}</Field>
          <Field label="Auction">{[auctionOn, auctionTime].filter(Boolean).join(' · ')}</Field>
          <Field label="PSO No / Date">{[g.psoNumber, g.psoDate].filter(Boolean).join(' · ')}</Field>
          <Field label="Agreement No / Date">{[g.agreementNo, g.agreementDate].filter(Boolean).join(' · ')}</Field>
          <Field label="Company Ticket / Auction">{[g.companyType, g.companyTicketNo, g.companyAuctionNo].filter(Boolean).join(' · ')}</Field>
          <Field label="Authorized / FDR">{`${g.authorized ? 'Authorized' : 'Not authorized'} · FDR ${g.fdrDetails ? 'Yes' : 'No'}`}</Field>
        </dl>
      </div>

      {/* Auctions */}
      <div className="rounded-xl border border-gray-100 p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><Gavel className="w-4 h-4 text-primary-600" /> Auctions held ({held.length} of {g.duration})</h4>
        {held.length === 0 ? <p className="text-sm text-gray-400">No auction held yet.</p> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[560px]">
              <thead className="bg-gray-50">
                <tr>
                  {['No', 'Date', 'Winner'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                  {['Bid', 'Prize', 'Dividend / Member'].map(h => <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {held.map(a => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-sm">#{a.auctionNo}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{a.auctionDate}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{a.customerName}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums">{formatCurrency(a.bidAmount)}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums">{formatCurrency(a.prizeAmount)}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums">{formatCurrency(a.dividendPerMember)}</td>
                    <td className="px-3 py-2"><StatusBadge status={a.payoutStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="rounded-xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Group Members ({members.length})</h4>
        {members.length === 0 ? <p className="text-sm text-gray-400">No customers in this group yet.</p> : (
          <div className="overflow-x-auto scrollbar-thin max-h-80">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['Customer ID', 'Name', 'Phone', 'Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                  {['Due', 'Paid', 'Pending'].map(h => <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-mono text-primary-600">{c.customerId}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{c.mobile}</td>
                    <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums">{formatCurrency(c.totalDue)}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums text-success-600">{formatCurrency(c.paid)}</td>
                    <td className="px-3 py-2 text-sm text-right tabular-nums text-danger-600">{formatCurrency(c.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

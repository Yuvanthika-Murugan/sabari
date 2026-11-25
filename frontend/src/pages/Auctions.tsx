import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import KPICard from '@/components/KPICard';
import { Input, Select, TextArea, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Auction } from '@/types';
import { Gavel, Trophy, Wallet, BadgePercent, Banknote, AlertTriangle } from 'lucide-react';

const blankAuction = { groupId: '', auctionNo: '', auctionDate: '', customerId: '', bidAmount: '', remarks: '' };
const blankPayout = { payoutMode: 'cash', bankAccountId: '', payoutReference: '', paidDate: '' };

export default function Auctions() {
  const { auctions, groups, customers, dueSchedules, bankAccounts, cashTransactions, commission, today } = useData();
  const { currentUser } = useApp();
  const canConduct = currentUser?.role !== 'staff';
  const canPay = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState<Auction | null>(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const form = useForm(blankAuction);
  const payout = useForm(blankPayout);

  const rows = auctions.filter(a => (!groupFilter || a.groupId === groupFilter) && (!statusFilter || a.payoutStatus === statusFilter) && inDateRange(a.auctionDate, fromDate, toDate));
  const pendingPayout = auctions.filter(a => a.payoutStatus === 'pending').reduce((s, a) => s + a.prizeAmount, 0);
  const commissionEarned = auctions.reduce((s, a) => s + a.commissionAmount, 0);
  const dividends = auctions.reduce((s, a) => s + a.dividendAmount, 0);
  const cashInHand = cashTransactions.length ? cashTransactions[cashTransactions.length - 1].balance : 0;

  // Live preview of the auction being entered
  const group = groups.find(g => g.id === form.values.groupId);
  const held = auctions.filter(a => a.groupId === form.values.groupId);
  const winners = new Set(held.map(a => a.customerId));
  const members = customers.filter(c => c.groupId === form.values.groupId && c.status !== 'closed');
  const bidders = members.filter(c => c.status === 'active' && !winners.has(c.id));
  const bid = Number(form.values.bidAmount) || 0;
  const commissionAmt = group ? group.groupValue * commission.foremanCommissionPct / 100 : 0;
  const maxBid = group ? group.groupValue * commission.maxBidPct / 100 : 0;
  const dividend = Math.max(0, bid - commissionAmt);
  const winner = customers.find(c => c.id === form.values.customerId);
  const winnerArrears = dueSchedules.filter(d => d.customerId === form.values.customerId && d.pendingAmount > 0 && d.dueDate < today).reduce((s, d) => s + d.pendingAmount, 0);

  const pickGroup = (groupId: string) => {
    const next = Math.max(0, ...auctions.filter(a => a.groupId === groupId).map(a => a.auctionNo)) + 1;
    form.set('groupId', groupId);
    form.set('auctionNo', groupId ? String(next) : '');
    form.set('customerId', '');
  };

  const openForm = () => {
    form.reset({ ...blankAuction, auctionDate: today });
    setShowForm(true);
  };

  const save = async () => {
    if (await form.submit(v => api.post('/auctions', v), 'Auction recorded and dividend applied to members\' dues')) setShowForm(false);
  };

  const openPay = (a: Auction) => {
    payout.reset({ ...blankPayout, paidDate: today });
    setPaying(a);
  };

  const pay = async () => {
    if (paying && await payout.submit(v => api.post(`/auctions/${paying.id}/pay`, v), 'Prize paid')) setPaying(null);
  };

  const columns = [
    { key: 'auctionCode', label: 'Auction', sortable: true, render: (a: Auction) => <span className="font-mono text-xs text-primary-600">{a.auctionCode}</span> },
    { key: 'auctionDate', label: 'Date', sortable: true },
    { key: 'groupName', label: 'Group', sortable: true, render: (a: Auction) => <span>{a.groupName} <span className="text-gray-400">#{a.auctionNo}</span></span> },
    { key: 'customerName', label: 'Winner', sortable: true, render: (a: Auction) => <span className="font-medium text-gray-900">{a.customerName}</span> },
    { key: 'bidAmount', label: 'Bid', sortable: true, render: (a: Auction) => formatCurrency(a.bidAmount) },
    { key: 'commissionAmount', label: 'Commission', render: (a: Auction) => formatCurrency(a.commissionAmount) },
    { key: 'dividendPerMember', label: 'Dividend / Member', render: (a: Auction) => formatCurrency(a.dividendPerMember) },
    { key: 'prizeAmount', label: 'Prize', sortable: true, render: (a: Auction) => <span className="font-bold text-success-700">{formatCurrency(a.prizeAmount)}</span> },
    { key: 'payoutStatus', label: 'Payout', render: (a: Auction) => a.payoutStatus === 'paid'
      ? <span className="text-xs text-gray-500"><StatusBadge status="paid" /> {a.paidDate} · {a.payoutMode.replace('_', ' ')}</span>
      : <StatusBadge status="pending" /> },
    { key: 'actions', label: 'Actions', render: (a: Auction) => canPay && a.payoutStatus === 'pending'
      ? <button onClick={() => openPay(a)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-success-600 text-white rounded-lg hover:bg-success-700"><Banknote className="w-3.5 h-3.5" /> Pay Prize</button>
      : null },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Auction" subtitle={`Foreman commission ${commission.foremanCommissionPct}% · maximum bid ${commission.maxBidPct}% of group value`} actions={
        <>
          <ExportButtons filename="auctions" rows={rows} />
          {canConduct && <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><Gavel className="w-4 h-4" /> Conduct Auction</button>}
        </>
      } />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Auctions Held" value={String(auctions.length)} icon={<Gavel className="w-6 h-6" />} color="primary" />
        <KPICard title="Prize Payout Pending" value={formatCurrency(pendingPayout)} icon={<Trophy className="w-6 h-6" />} color="warning" />
        <KPICard title="Foreman Commission" value={formatCurrency(commissionEarned)} icon={<BadgePercent className="w-6 h-6" />} color="gold" />
        <KPICard title="Dividends to Members" value={formatCurrency(dividends)} icon={<Wallet className="w-6 h-6" />} color="success" />
      </div>
      <FilterBar>
        <DateRangeFilter label="Auction" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All Groups" />
        <Select label="Payout" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }]} placeholder="All" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['auctionCode', 'customerName', 'groupName']} pageSize={10} emptyMessage="No auctions held yet" />

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Conduct Auction" size="lg"
        footer={<ModalFooter onCancel={() => setShowForm(false)} onSubmit={save} submitLabel="Record Auction" submitting={form.submitting} icon={<Gavel className="w-4 h-4" />} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Chit Group" {...form.field('groupId')} onChange={pickGroup} required className="col-span-full"
            options={groups.filter(g => g.status === 'active').map(g => ({ value: g.id, label: `${g.groupName} (${g.groupCode}) · ${formatCurrency(g.groupValue)}` }))} />
          <Input label="Auction / Installment No" type="number" format="integer" min={1} {...form.field('auctionNo')} required />
          <Input label="Auction Date" type="date" {...form.field('auctionDate')} required />
          <Select label="Winning Subscriber" {...form.field('customerId')} required className="col-span-full"
            options={bidders.map(c => ({ value: c.id, label: `${c.name} (${c.customerId})` }))}
            placeholder={group ? `${bidders.length} subscribers yet to win` : 'Select a group first'} />
          <Input label="Bid Amount (discount)" type="number" {...form.field('bidAmount')} required placeholder={group ? `${Math.round(commissionAmt)} – ${Math.round(maxBid)}` : ''} className="col-span-full" />
          <TextArea label="Remarks" {...form.field('remarks')} rows={2} className="col-span-full" />
          {group && (
            <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Group Value</p><p className="text-sm font-bold">{formatCurrency(group.groupValue)}</p></div>
              <div className="bg-gold-50 rounded-lg p-3"><p className="text-xs text-gray-500">Commission ({commission.foremanCommissionPct}%)</p><p className="text-sm font-bold text-gold-700">{formatCurrency(commissionAmt)}</p></div>
              <div className="bg-primary-50 rounded-lg p-3"><p className="text-xs text-gray-500">Dividend / Member ({members.length})</p><p className="text-sm font-bold text-primary-700">{formatCurrency(members.length ? dividend / members.length : 0)}</p></div>
              <div className="bg-success-50 rounded-lg p-3"><p className="text-xs text-gray-500">Prize to Winner</p><p className="text-sm font-bold text-success-700">{formatCurrency(group.groupValue - bid)}</p></div>
            </div>
          )}
          {winner && winnerArrears > 0 && (
            <div className="col-span-full flex items-center gap-2 bg-warning-50 border border-warning-200 rounded-lg p-3 text-sm text-warning-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {winner.name} has arrears of {formatCurrency(winnerArrears)}. Collect them with an AR receipt before paying the prize.
            </div>
          )}
          <p className="col-span-full text-xs text-gray-500">The dividend reduces each member's dues from this installment onward. Auctions cannot be edited once recorded.</p>
        </div>
      </Modal>

      <Modal isOpen={!!paying} onClose={() => setPaying(null)} title="Pay Prize Amount"
        footer={<ModalFooter onCancel={() => setPaying(null)} onSubmit={pay} submitLabel="Pay Prize" submitting={payout.submitting} icon={<Banknote className="w-4 h-4" />} />}
      >
        {paying && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full bg-success-50 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500">{paying.customerName} · {paying.groupName} #{paying.auctionNo}</p>
              <p className="text-2xl font-bold text-success-700">{formatCurrency(paying.prizeAmount)}</p>
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

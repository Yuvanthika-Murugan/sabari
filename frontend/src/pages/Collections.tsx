import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import CollectionForm from '@/components/CollectionForm';
import { paymentModeOptions } from '@/lib/options';
import { Input, Select, FilterBar } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';
import type { Collection } from '@/types';
import { Wallet, TrendingUp, AlertCircle, HandCoins, Receipt, Banknote, Landmark } from 'lucide-react';

const paymentModeBadge = (mode: string) => {
  const map: Record<string, 'success' | 'blue' | 'gold' | 'gray'> = { cash: 'success', upi: 'blue', bank_transfer: 'gold', cheque: 'gray' };
  return <Badge variant={map[mode] ?? 'gray'}>{mode.replace('_', ' ').toUpperCase()}</Badge>;
};

export function TodaysCollection() {
  const { collections, dueSchedules, today: todayDate } = useData();
  const location = useLocation();
  const [showCollect, setShowCollect] = useState(location.pathname.endsWith('/entry'));
  const today = collections.filter(c => c.date === todayDate);
  const totalCollected = today.reduce((s, c) => s + c.collectedAmount, 0);
  const totalPending = dueSchedules.filter(d => d.dueDate <= todayDate).reduce((s, d) => s + d.pendingAmount, 0);

  const columns = [
    { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (c: Collection) => <span className="font-mono text-xs text-primary-600">{c.receiptNo}</span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (c: Collection) => <span className="font-medium text-gray-900">{c.customerName}</span> },
    { key: 'groupName', label: 'Group' },
    { key: 'branchName', label: 'Branch' },
    { key: 'staffName', label: 'Staff' },
    { key: 'dueAmount', label: 'Due', sortable: true, render: (c: Collection) => formatCurrency(c.dueAmount) },
    { key: 'collectedAmount', label: 'Collected', sortable: true, render: (c: Collection) => <span className="text-success-600 font-medium">{formatCurrency(c.collectedAmount)}</span> },
    { key: 'pendingAmount', label: 'Balance', render: (c: Collection) => <span className="text-danger-600">{formatCurrency(c.pendingAmount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (c: Collection) => paymentModeBadge(c.paymentMode) },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status', render: (c: Collection) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Today's Collection" subtitle="All collections recorded today" actions={
        <>
          <ExportButtons filename="todays-collection" rows={today} />
          <button onClick={() => setShowCollect(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><HandCoins className="w-4 h-4" /> New Collection</button>
        </>
      } />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KPICard title="Total Collected Today" value={formatCurrency(totalCollected)} icon={<Wallet className="w-6 h-6" />} color="success" />
        <KPICard title="Pending Till Today" value={formatCurrency(totalPending)} icon={<AlertCircle className="w-6 h-6" />} color="warning" />
        <KPICard title="Total Receipts" value={String(today.length)} icon={<Receipt className="w-6 h-6" />} color="primary" />
      </div>
      <DataTable columns={columns} data={today} searchKeys={['receiptNo','customerName']} pageSize={10} emptyMessage="No collections recorded today" />

      <CollectionForm isOpen={showCollect} onClose={() => setShowCollect(false)} />
    </div>
  );
}

export function CollectionStatement() {
  const { collections, branches, groups, users } = useData();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');

  const filtered = collections.filter(c =>
    (!fromDate || c.date >= fromDate) &&
    (!toDate || c.date <= toDate) &&
    (!branchFilter || c.branchId === branchFilter) &&
    (!groupFilter || c.groupId === groupFilter) &&
    (!staffFilter || c.staffId === staffFilter) &&
    (!modeFilter || c.paymentMode === modeFilter)
  );

  const totalDue = filtered.reduce((s, c) => s + c.dueAmount, 0);
  const totalCollected = filtered.reduce((s, c) => s + c.collectedAmount, 0);
  const totalPending = filtered.reduce((s, c) => s + c.pendingAmount, 0);

  const columns = [
    { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (c: Collection) => <span className="font-mono text-xs text-primary-600">{c.receiptNo}</span> },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'customerName', label: 'Customer', sortable: true, render: (c: Collection) => <span className="font-medium">{c.customerName}</span> },
    { key: 'groupName', label: 'Group' },
    { key: 'branchName', label: 'Branch' },
    { key: 'staffName', label: 'Staff' },
    { key: 'dueAmount', label: 'Due Amount', sortable: true, render: (c: Collection) => formatCurrency(c.dueAmount) },
    { key: 'collectedAmount', label: 'Collected', sortable: true, render: (c: Collection) => <span className="text-success-600 font-medium">{formatCurrency(c.collectedAmount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (c: Collection) => paymentModeBadge(c.paymentMode) },
    { key: 'referenceNo', label: 'Reference', render: (c: Collection) => <span className="font-mono text-xs text-gray-500">{c.referenceNo || '-'}</span> },
    { key: 'status', label: 'Status', render: (c: Collection) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Collection Statement" subtitle="Detailed collection records with filters" actions={<ExportButtons filename="collection-statement" rows={filtered} />} />
      <FilterBar>
        <Input label="From Date" type="date" value={fromDate} onChange={setFromDate} />
        <Input label="To Date" type="date" value={toDate} onChange={setToDate} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All" />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All" />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All" />
        <Select label="Payment Mode" value={modeFilter} onChange={setModeFilter} options={paymentModeOptions} placeholder="All" />
      </FilterBar>
      <DataTable columns={columns} data={filtered} searchKeys={['receiptNo','customerName']} pageSize={10} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4"><p className="text-xs text-gray-500">Total Due</p><p className="text-xl font-bold text-primary-700">{formatCurrency(totalDue)}</p></div>
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4"><p className="text-xs text-gray-500">Total Collected</p><p className="text-xl font-bold text-success-700">{formatCurrency(totalCollected)}</p></div>
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4"><p className="text-xs text-gray-500">Total Pending</p><p className="text-xl font-bold text-danger-700">{formatCurrency(totalPending)}</p></div>
      </div>
    </div>
  );
}

export function CollectionSummary() {
  const { collections, branches, groups, users } = useData();
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');

  const filtered = collections.filter(c =>
    (!dateFilter || c.date === dateFilter) &&
    (!branchFilter || c.branchId === branchFilter) &&
    (!groupFilter || c.groupId === groupFilter) &&
    (!staffFilter || c.staffId === staffFilter)
  );
  const totalDue = filtered.reduce((s, c) => s + c.dueAmount, 0);
  const totalCollected = filtered.reduce((s, c) => s + c.collectedAmount, 0);
  const totalPending = filtered.reduce((s, c) => s + c.pendingAmount, 0);
  const cashCollected = filtered.filter(c => c.paymentMode === 'cash').reduce((s, c) => s + c.collectedAmount, 0);
  const bankCollected = filtered.filter(c => c.paymentMode !== 'cash').reduce((s, c) => s + c.collectedAmount, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Collection Summary" subtitle="Summarized financial view" actions={<ExportButtons />} />
      <FilterBar>
        <Input label="Date" type="date" value={dateFilter} onChange={setDateFilter} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All" />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All" />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All" />
      </FilterBar>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard title="Total Due" value={formatCurrency(totalDue)} icon={<TrendingUp className="w-6 h-6" />} color="primary" />
        <KPICard title="Total Collection" value={formatCurrency(totalCollected)} icon={<Wallet className="w-6 h-6" />} color="success" />
        <KPICard title="Pending Till Today" value={formatCurrency(totalPending)} icon={<AlertCircle className="w-6 h-6" />} color="warning" />
        <KPICard title="Cash Collection" value={formatCurrency(cashCollected)} icon={<Banknote className="w-6 h-6" />} color="gold" />
        <KPICard title="Bank/UPI Collection" value={formatCurrency(bankCollected)} icon={<Landmark className="w-6 h-6" />} color="primary" />
      </div>
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Summary Breakdown</h3>
        <div className="space-y-3">
          {[
            { label: 'Cash Collection', value: cashCollected, color: 'bg-success-500', pct: totalCollected ? (cashCollected / totalCollected) * 100 : 0 },
            { label: 'UPI Collection', value: filtered.filter(c => c.paymentMode === 'upi').reduce((s,c) => s + c.collectedAmount, 0), color: 'bg-primary-500', pct: totalCollected ? (filtered.filter(c => c.paymentMode === 'upi').reduce((s,c) => s + c.collectedAmount, 0) / totalCollected) * 100 : 0 },
            { label: 'Bank Transfer', value: filtered.filter(c => c.paymentMode === 'bank_transfer').reduce((s,c) => s + c.collectedAmount, 0), color: 'bg-gold-500', pct: totalCollected ? (filtered.filter(c => c.paymentMode === 'bank_transfer').reduce((s,c) => s + c.collectedAmount, 0) / totalCollected) * 100 : 0 },
            { label: 'Cheque', value: filtered.filter(c => c.paymentMode === 'cheque').reduce((s,c) => s + c.collectedAmount, 0), color: 'bg-gray-400', pct: totalCollected ? (filtered.filter(c => c.paymentMode === 'cheque').reduce((s,c) => s + c.collectedAmount, 0) / totalCollected) * 100 : 0 },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between mb-1"><span className="text-sm text-gray-600">{item.label}</span><span className="text-sm font-medium">{formatCurrency(item.value)}</span></div>
              <div className="w-full bg-gray-100 rounded-full h-2"><div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${item.pct}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

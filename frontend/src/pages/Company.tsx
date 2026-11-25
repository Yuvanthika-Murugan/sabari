import { useState } from 'react';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import { Input, Select, FilterBar, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { AuditLog, CommissionSettings } from '@/types';
import { BadgePercent, Gavel, UserCheck } from 'lucide-react';

export function CommissionSetup() {
  const { commission, agents } = useData();
  const { currentUser } = useApp();
  const canEdit = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const form = useForm({
    foremanCommissionPct: String(commission.foremanCommissionPct),
    maxBidPct: String(commission.maxBidPct),
    agentCommissionPct: String(commission.agentCommissionPct),
  });
  const save = () => form.submit(v => api.put<CommissionSettings>('/settings/commission', v), 'Commission settings saved');

  // Worked example on a ₹1,00,000 chit so the percentages are easy to check
  const value = 100000;
  const commissionAmt = value * (Number(form.values.foremanCommissionPct) || 0) / 100;
  const maxBid = value * (Number(form.values.maxBidPct) || 0) / 100;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Commission Setup" subtitle="Foreman commission, auction bid limit and default agent commission" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center"><Gavel className="w-5 h-5 text-gold-600" /></div>
            <h3 className="text-base font-semibold text-gray-900">Auction</h3>
          </div>
          <div className="space-y-4">
            <Input label="Foreman Commission (% of group value)" type="number" max={100} {...form.field('foremanCommissionPct')} required disabled={!canEdit} />
            <Input label="Maximum Bid (% of group value)" type="number" max={100} {...form.field('maxBidPct')} required disabled={!canEdit} />
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-900">On a {formatCurrency(value)} chit:</p>
              <p>Foreman keeps {formatCurrency(commissionAmt)} from each auction's bid.</p>
              <p>Bids are allowed from {formatCurrency(commissionAmt)} to {formatCurrency(maxBid)}; whatever is above the commission is shared as dividend.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center"><BadgePercent className="w-5 h-5 text-primary-600" /></div>
            <h3 className="text-base font-semibold text-gray-900">Agent</h3>
          </div>
          <div className="space-y-4">
            <Input label="Default Agent Commission (% of collections)" type="number" max={100} {...form.field('agentCommissionPct')} required disabled={!canEdit} />
            <p className="text-xs text-gray-500">Used as the starting value for new agents. Each agent's own rate can be changed on the Agents page — {agents.length} agents today.</p>
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-3 mt-6">
          <button onClick={save} disabled={form.submitting} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-60">Save Commission Settings</button>
        </div>
      )}
    </div>
  );
}

export function LoginHistory() {
  const { auditLogs } = useData();
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const logins = auditLogs.filter(a => a.module === 'Login' && (!actionFilter || a.action === actionFilter) && inDateRange(a.date, fromDate, toDate));
  const failed = auditLogs.filter(a => a.module === 'Login' && (a.action === 'Login Failed' || a.action === 'Login Blocked')).length;

  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (a: AuditLog) => <span>{a.date} <span className="text-gray-400">{a.time}</span></span> },
    { key: 'user', label: 'User', sortable: true, render: (a: AuditLog) => <div><p className="text-sm font-medium">{a.user}</p><p className="text-xs text-gray-500">{a.role}</p></div> },
    { key: 'recordId', label: 'Email', render: (a: AuditLog) => <span className="text-gray-500">{a.recordId}</span> },
    { key: 'action', label: 'Event', render: (a: AuditLog) => <Badge variant={a.action === 'Login' ? 'success' : a.action === 'Logout' ? 'gray' : a.action === 'Password Changed' ? 'blue' : 'danger'}>{a.action}</Badge> },
    { key: 'newValue', label: 'IP Address', render: (a: AuditLog) => <span className="font-mono text-xs text-gray-500">{a.newValue}</span> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Login History" subtitle="Sign-ins, sign-outs and failed attempts" actions={<ExportButtons filename="login-history" rows={logins} />} />
      {failed > 0 && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-4 flex items-center gap-3 text-sm text-danger-800">
          <UserCheck className="w-4 h-4" /> {failed} failed or blocked sign-in attempts in the log.
        </div>
      )}
      <FilterBar>
        <DateRangeFilter from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Event" value={actionFilter} onChange={setActionFilter} placeholder="All"
          options={['Login', 'Logout', 'Login Failed', 'Login Blocked', 'Password Changed'].map(a => ({ value: a, label: a }))} />
      </FilterBar>
      <DataTable columns={columns} data={logins} searchKeys={['user', 'recordId']} pageSize={15} emptyMessage="No sign-ins recorded yet" />
    </div>
  );
}

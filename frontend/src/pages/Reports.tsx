import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Select, Input, FilterBar } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { downloadCsv } from '@/lib/format';
import { useApp } from '@/context/AppContext';
import type { AppData, Role } from '@/types';
import {
  FileText, Wallet, Landmark, Users, Building,
  Calendar, AlertCircle, CreditCard, ClipboardList, CheckCircle2,
  CalendarClock, FileSpreadsheet, Download,
} from 'lucide-react';

type Row = Record<string, unknown>;

const sumBy = <T,>(rows: T[], key: (r: T) => string, value: (r: T) => number) => {
  const totals = new Map<string, number>();
  rows.forEach(r => totals.set(key(r), (totals.get(key(r)) ?? 0) + value(r)));
  return totals;
};

/** Cash, bank and day-end books are office data (the server sends staff none). */
const OFFICE: Role[] = ['md', 'admin', 'manager'];
const ADMIN: Role[] = ['md', 'admin'];

/** Each report: where "View" goes, which rows "Excel" exports, and who may see it (everyone when omitted). */
const reportList: { id: string; name: string; desc: string; icon: typeof Calendar; color: string; path: string; rows: (d: AppData) => Row[]; roles?: Role[] }[] = [
  { id: 'daily', name: 'Daily Collection Report', desc: 'Day-wise collection breakdown', icon: Calendar, color: 'bg-primary-50 text-primary-600', path: '/collections/statement',
    rows: d => [...sumBy(d.collections, c => c.date, c => c.collectedAmount)].map(([date, collected]) => ({ date, collected })) },
  { id: 'monthly', name: 'Monthly Collection Report', desc: 'Monthly collection summary', icon: CalendarClock, color: 'bg-gold-50 text-gold-600', path: '/collections/summary',
    rows: d => [...sumBy(d.collections, c => c.date.slice(0, 7), c => c.collectedAmount)].map(([month, collected]) => ({ month, collected })) },
  { id: 'customer', name: 'Customer Collection Report', desc: 'Customer-wise collections', icon: Users, color: 'bg-success-50 text-success-600', path: '/customers/list', rows: d => d.customers as unknown as Row[] },
  { id: 'staff', name: 'Staff Collection Report', desc: 'Staff performance report', icon: Users, color: 'bg-primary-50 text-primary-600', path: '/pending/staff', rows: d => d.collections as unknown as Row[] },
  { id: 'branch', name: 'Branch Collection Report', desc: 'Branch-wise performance', icon: Building, color: 'bg-gold-50 text-gold-600', path: '/pending/branch', rows: d => d.collections as unknown as Row[] },
  { id: 'group', name: 'Group Collection Report', desc: 'Group-wise collections', icon: FileSpreadsheet, color: 'bg-success-50 text-success-600', path: '/pending/group', rows: d => d.groups as unknown as Row[] },
  { id: 'pending', name: 'Pending Report', desc: 'All pending dues', icon: AlertCircle, color: 'bg-warning-50 text-warning-600', path: '/pending/customer',
    rows: d => d.dueSchedules.filter(x => x.pendingAmount > 0 && x.dueDate <= d.today) as unknown as Row[] },
  { id: 'payment', name: 'Payment Report', desc: 'Payment transactions', icon: CreditCard, color: 'bg-primary-50 text-primary-600', path: '/payments/entry', rows: d => d.paymentApprovals as unknown as Row[] },
  { id: 'cash', name: 'Cash Report', desc: 'Cash flow statement', icon: Wallet, color: 'bg-success-50 text-success-600', path: '/cash-bank/cash', rows: d => d.cashTransactions as unknown as Row[], roles: ADMIN },
  { id: 'bank', name: 'Bank Report', desc: 'Bank transactions', icon: Landmark, color: 'bg-primary-50 text-primary-600', path: '/cash-bank/statement', rows: d => d.bankTransactions as unknown as Row[], roles: ADMIN },
  { id: 'voucher', name: 'Voucher Report', desc: 'All vouchers', icon: ClipboardList, color: 'bg-gold-50 text-gold-600', path: '/payments/voucher', rows: d => d.vouchers as unknown as Row[] },
  { id: 'approval', name: 'Approval Report', desc: 'Payment approvals', icon: CheckCircle2, color: 'bg-success-50 text-success-600', path: '/payments/approval',
    rows: d => d.paymentApprovals.filter(p => p.managerId || p.mdId) as unknown as Row[] },
  { id: 'dayend', name: 'Day End Report', desc: 'Daily closing reports', icon: CalendarClock, color: 'bg-warning-50 text-warning-600', path: '/day-end', rows: d => d.dayEndClosings as unknown as Row[], roles: ADMIN },
  { id: 'closing', name: 'Customer Closing Report', desc: 'Completed customer statements', icon: FileText, color: 'bg-primary-50 text-primary-600', path: '/statements',
    rows: d => d.customers.filter(c => c.status === 'closed') as unknown as Row[] },
];

export default function Reports() {
  const navigate = useNavigate();
  const data = useData();
  const { currentUser } = useApp();
  const { branches, groups, users } = data;
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');

  /** Applies whichever filters the row type supports. */
  const applyFilters = (rows: Row[]) => rows.filter(r => {
    const date = (r.date ?? r.dueDate ?? r.month) as string | undefined;
    if (date && fromDate && date < fromDate.slice(0, date.length)) return false;
    if (date && toDate && date > toDate.slice(0, date.length)) return false;
    if (branchFilter && 'branchId' in r && r.branchId !== branchFilter) return false;
    if (groupFilter && 'groupId' in r && r.groupId !== groupFilter) return false;
    if (staffFilter && 'staffId' in r && r.staffId !== staffFilter) return false;
    return true;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reports" subtitle="Comprehensive financial reports with filters" />

      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Report Filters <span className="text-xs font-normal text-gray-500">(applied to Excel exports)</span></h3>
        <FilterBar>
          <Input label="From Date" type="date" value={fromDate} onChange={setFromDate} />
          <Input label="To Date" type="date" value={toDate} onChange={setToDate} />
          <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All" />
          <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All" />
          <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All" />
        </FilterBar>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportList.filter(r => !r.roles || (currentUser && r.roles.includes(currentUser.role))).map(r => {
          const rows = applyFilters(r.rows(data));
          return (
            <div key={r.id} className="bg-white rounded-xl shadow-card border border-gray-100 p-5 hover:shadow-cardLg transition-all group">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${r.color} flex items-center justify-center flex-shrink-0`}><r.icon className="w-6 h-6" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">{r.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{r.desc} · {rows.length} rows</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                <button onClick={() => navigate(r.path)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"><FileText className="w-3.5 h-3.5" /> View</button>
                <button onClick={() => downloadCsv(r.id + '-report', rows)} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-40"><Download className="w-3.5 h-3.5" /> Excel</button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors ml-auto">Print</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

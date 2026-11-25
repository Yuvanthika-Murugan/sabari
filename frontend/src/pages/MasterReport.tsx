import { useState } from 'react';
import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';

type Row = { id: string } & Record<string, string | number>;

/** Printable / exportable lists of every master record, with names instead of ids. */
export default function MasterReport() {
  const { customers, agents, areas, users, groups, branches } = useData();
  const name = <T extends { id: string }>(list: T[], id: string, pick: (x: T) => string) => {
    const found = list.find(x => x.id === id);
    return found ? pick(found) : '-';
  };
  const branchName = (id: string) => name(branches, id, b => b.name);
  const userName = (id: string) => name(users, id, u => u.name);

  const reports: Record<string, { label: string; rows: Row[]; money?: string[] }> = {
    customers: {
      label: 'Customers',
      money: ['Total Due', 'Paid', 'Pending'],
      rows: customers.map(c => ({
        id: c.id, 'Customer ID': c.customerId, Name: c.name, Mobile: c.mobile, Branch: branchName(c.branchId), Area: c.area || '-',
        Group: name(groups, c.groupId, g => g.groupName), Staff: userName(c.staffId), Agent: name(agents, c.agentId, a => a.name),
        Joined: c.joiningDate, 'Total Due': c.totalDue, Paid: c.paid, Pending: c.pending, Status: c.status,
      })),
    },
    agents: {
      label: 'Agents',
      rows: agents.map(a => ({
        id: a.id, 'Agent ID': a.agentCode, Name: a.name, Mobile: a.mobile, Branch: branchName(a.branchId),
        'Commission %': a.commissionPct, Customers: customers.filter(c => c.agentId === a.id).length, Joined: a.joiningDate || '-', Status: a.status,
      })),
    },
    areas: {
      label: 'Areas',
      rows: areas.map(a => ({
        id: a.id, Code: a.code, Area: a.name, Branch: branchName(a.branchId), Staff: userName(a.staffId), Pincode: a.pincode || '-',
        Customers: customers.filter(c => c.branchId === a.branchId && c.area === a.name).length, Status: a.status,
      })),
    },
    staff: {
      label: 'Collection Staff',
      money: ['Monthly Target'],
      rows: users.filter(u => u.role === 'staff').map(u => ({
        id: u.id, 'Emp ID': u.empId, Name: u.name, Phone: u.phone, Branch: branchName(u.branchId),
        Customers: customers.filter(c => c.staffId === u.id).length, 'Monthly Target': u.monthlyTarget, Joined: u.joiningDate, Status: u.status,
      })),
    },
    groups: {
      label: 'Chit Groups',
      money: ['Group Value', 'Collected'],
      rows: groups.map(g => ({
        id: g.id, Code: g.groupCode, Name: g.groupName, Branch: branchName(g.branchId), 'Group Value': g.groupValue,
        Members: `${customers.filter(c => c.groupId === g.id).length} / ${g.numberOfMembers}`, Duration: `${g.duration} ${g.frequency}`,
        Start: g.startDate, End: g.endDate, Collected: g.collected, Status: g.status,
      })),
    },
    branches: {
      label: 'Branches',
      rows: branches.map(b => ({
        id: b.id, Code: b.code, Name: b.name, Phone: b.phone, Manager: userName(b.managerId), Opened: b.openingDate,
        Customers: customers.filter(c => c.branchId === b.id).length, Staff: users.filter(u => u.branchId === b.id && u.role === 'staff').length, Status: b.status,
      })),
    },
  };

  const [tab, setTab] = useState('customers');
  const report = reports[tab];
  const keys = report.rows.length ? Object.keys(report.rows[0]).filter(k => k !== 'id') : [];
  const columns = keys.map(k => ({
    key: k, label: k, sortable: true,
    render: report.money?.includes(k) ? (r: Row) => formatCurrency(Number(r[k])) : undefined,
  }));
  const exportRows = report.rows.map(r => Object.fromEntries(keys.map(k => [k, r[k]])));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Master Report" subtitle="All master data in one place" actions={<ExportButtons filename={`master-${tab}`} rows={exportRows} />} />
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        {Object.entries(reports).map(([id, r]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${tab === id ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {r.label} <span className={tab === id ? 'text-primary-100' : 'text-gray-400'}>({r.rows.length})</span>
          </button>
        ))}
      </div>
      <DataTable key={tab} columns={columns} data={report.rows} searchKeys={keys as (keyof Row)[]} pageSize={15} emptyMessage={`No ${report.label.toLowerCase()} yet`} />
    </div>
  );
}

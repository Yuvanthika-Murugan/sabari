import { PageHeader, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { useData } from '@/context/DataContext';
import type { AuditLog as AuditEntry } from '@/types';
import Badge from '@/components/Badge';

export default function AuditLog() {
  const { auditLogs } = useData();
  const columns = [
    { key: 'date', label: 'Date', sortable: true, render: (a: AuditEntry) => <span className="text-sm">{a.date} <span className="text-gray-400">{a.time}</span></span> },
    { key: 'user', label: 'User', sortable: true, render: (a: AuditEntry) => (
      <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">{a.user.charAt(0)}</div><div><p className="text-sm font-medium">{a.user}</p><p className="text-xs text-gray-500">{a.role}</p></div></div>
    )},
    { key: 'action', label: 'Action', sortable: true, render: (a: AuditEntry) => <Badge variant={a.action.includes('Rejected') || a.action.includes('Deleted') ? 'danger' : a.action.includes('Approved') || a.action.includes('Closed') ? 'success' : 'primary'}>{a.action}</Badge> },
    { key: 'module', label: 'Module' },
    { key: 'recordId', label: 'Record ID', render: (a: AuditEntry) => <span className="font-mono text-xs text-primary-600">{a.recordId}</span> },
    { key: 'oldValue', label: 'Old Value', render: (a: AuditEntry) => <span className="text-gray-500 text-xs">{a.oldValue}</span> },
    { key: 'newValue', label: 'New Value', render: (a: AuditEntry) => <span className="text-gray-700 text-xs font-medium">{a.newValue}</span> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Audit Log" subtitle="Track all sensitive financial operations" actions={<ExportButtons filename="audit-log" rows={auditLogs} />} />
      <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 mb-4 flex items-center gap-3">
        <Badge variant="gold">SECURE</Badge>
        <p className="text-sm text-gold-800">Audit logs are immutable. Users cannot silently modify financial transactions. All changes are recorded with user, role, old value, and new value.</p>
      </div>
      <DataTable columns={columns} data={auditLogs} searchKeys={['user','action','module','recordId']} pageSize={10} />
    </div>
  );
}

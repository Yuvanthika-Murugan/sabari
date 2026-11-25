import type { ReactNode } from 'react';
import { Download, Printer } from 'lucide-react';
import Badge from './Badge';
import { downloadCsv } from '@/lib/format';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-6 print:mb-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 print:text-lg">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1 print:text-xs print:mt-0">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:flex-shrink-0 print:hidden">{actions}</div>}
    </div>
  );
}

/** Print (also "Save as PDF" from the print dialog) and, when rows are given, a CSV export. */
export function ExportButtons({ filename, rows }: { filename?: string; rows?: object[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700">
        <Printer className="w-4 h-4" /> Print
      </button>
      {filename && rows && (
        <button onClick={() => downloadCsv(filename, rows)} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-40">
          <Download className="w-4 h-4" /> Excel
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' | 'blue' | 'gold' | 'primary' }> = {
    active: { label: 'Active', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'gray' },
    closed: { label: 'Closed', variant: 'gray' },
    completed: { label: 'Completed', variant: 'success' },
    pending: { label: 'Pending', variant: 'warning' },
    rejected: { label: 'Rejected', variant: 'danger' },
    approved: { label: 'Approved', variant: 'success' },
    paid: { label: 'Paid', variant: 'success' },
    upcoming: { label: 'Upcoming', variant: 'gray' },
    due_today: { label: 'Due Today', variant: 'warning' },
    partially_paid: { label: 'Partially Paid', variant: 'gold' },
    overdue: { label: 'Overdue', variant: 'danger' },
    open: { label: 'Open', variant: 'warning' },
    payment_informed: { label: 'Payment Informed', variant: 'warning' },
    manager_accepted: { label: 'Manager Accepted', variant: 'blue' },
    md_approved: { label: 'MD Approved', variant: 'primary' },
    sent_back: { label: 'Sent Back', variant: 'gold' },
  };
  const config = map[status] ?? { label: status, variant: 'gray' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

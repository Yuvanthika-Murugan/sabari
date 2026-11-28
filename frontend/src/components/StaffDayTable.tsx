import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';

interface Row { key: string; name: string; cashCr: number; cashDr: number; bankCr: number; bankDr: number }
const net = (r: Row) => r.cashCr - r.cashDr + r.bankCr - r.bankDr;

/**
 * Today Collection by staff: Cash and Bank each split into Credit (receipts) and
 * Debit (expenses / returns booked to that staff member). Total = credits − debits.
 * Receipts or expenses with no staff member go in an "Office" row so the totals match.
 */
export default function StaffDayTable({ date, title = 'Today Collection' }: { date?: string; title?: string }) {
  const { collections, expenses, users, today } = useData();
  const day = date ?? today;
  const rows = new Map<string, Row>();
  const row = (id: string) => {
    const key = id || 'office';
    if (!rows.has(key)) rows.set(key, { key, name: id ? users.find(u => u.id === id)?.name ?? 'Unknown' : 'Office', cashCr: 0, cashDr: 0, bankCr: 0, bankDr: 0 });
    return rows.get(key)!;
  };
  // Every active collection staff member is listed, even with nothing today.
  users.filter(u => u.role === 'staff' && u.status === 'active').forEach(u => row(u.id));
  for (const c of collections) {
    if (c.date !== day) continue;
    const r = row(c.staffId);
    if (c.paymentMode === 'cash') r.cashCr += c.collectedAmount; else r.bankCr += c.collectedAmount;
  }
  for (const e of expenses) {
    if (e.date !== day) continue;
    const r = row(e.staffId);
    if (e.paymentMode === 'cash') r.cashDr += e.amount; else r.bankDr += e.amount;
  }
  const list = [...rows.values()].sort((a, b) => (a.key === 'office' ? 1 : b.key === 'office' ? -1 : a.name.localeCompare(b.name)));
  const sum = list.reduce((t, r) => ({ ...t, cashCr: t.cashCr + r.cashCr, cashDr: t.cashDr + r.cashDr, bankCr: t.bankCr + r.bankCr, bankDr: t.bankDr + r.bankDr }),
    { key: 'total', name: 'Total', cashCr: 0, cashDr: 0, bankCr: 0, bankDr: 0 });

  const money = (n: number, tone: string) => n ? <span className={tone}>{formatCurrency(n)}</span> : <span className="text-gray-300">-</span>;
  // Money columns are right-aligned (header, rows and total) so the amounts line up.
  const th = 'px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap';
  const td = 'px-4 py-3 text-sm whitespace-nowrap';
  const num = 'text-right tabular-nums';
  const sep = 'border-l border-gray-200';

  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">{day} · Total = Credit − Debit</span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[680px] table-fixed border-collapse">
          <colgroup>
            <col className="w-16" />
            <col />
            <col className="w-[13%]" /><col className="w-[13%]" />
            <col className="w-[13%]" /><col className="w-[13%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th rowSpan={2} className={`${th} text-center align-middle`}>S.No</th>
              <th rowSpan={2} className={`${th} text-left align-middle`}>Staff Name</th>
              <th colSpan={2} className={`${th} text-center ${sep}`}>Cash</th>
              <th colSpan={2} className={`${th} text-center ${sep}`}>Bank</th>
              <th rowSpan={2} className={`${th} ${num} align-middle ${sep}`}>Total</th>
            </tr>
            <tr className="border-b border-gray-200">
              <th className={`${th} ${num} ${sep}`}>Credit</th><th className={`${th} ${num}`}>Debit</th>
              <th className={`${th} ${num} ${sep}`}>Credit</th><th className={`${th} ${num}`}>Debit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((r, i) => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                <td className={`${td} font-medium text-gray-900 truncate`} title={r.name}>{r.name}</td>
                <td className={`${td} ${num} ${sep}`}>{money(r.cashCr, 'text-success-600')}</td>
                <td className={`${td} ${num}`}>{money(r.cashDr, 'text-danger-600')}</td>
                <td className={`${td} ${num} ${sep}`}>{money(r.bankCr, 'text-success-600')}</td>
                <td className={`${td} ${num}`}>{money(r.bankDr, 'text-danger-600')}</td>
                <td className={`${td} ${num} font-bold text-gray-900 ${sep}`}>{formatCurrency(net(r))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-primary-50 font-semibold border-t-2 border-primary-100">
            <tr>
              <td className={`${td} text-gray-900`} colSpan={2}>Total</td>
              <td className={`${td} ${num} text-success-700 ${sep}`}>{formatCurrency(sum.cashCr)}</td>
              <td className={`${td} ${num} text-danger-700`}>{formatCurrency(sum.cashDr)}</td>
              <td className={`${td} ${num} text-success-700 ${sep}`}>{formatCurrency(sum.bankCr)}</td>
              <td className={`${td} ${num} text-danger-700`}>{formatCurrency(sum.bankDr)}</td>
              <td className={`${td} ${num} text-primary-800 ${sep}`}>{formatCurrency(net(sum))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

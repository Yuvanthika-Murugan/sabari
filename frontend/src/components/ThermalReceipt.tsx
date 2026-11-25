import { createPortal } from 'react-dom';
import { BRAND } from '@/lib/brand';
import { formatCurrency } from '@/lib/format';
import { PRINT_ID } from '@/lib/thermalPrint';

/** What a printed collection receipt shows. */
export interface ReceiptData {
  receiptNo: string;
  type: 'chit' | 'arrear';
  date: string;
  time: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  groupName: string;
  dueNumber: number | null;
  amount: number;
  paymentMode: string;
  referenceNo: string;
  balance: number;
  staffName: string;
  companyAddress: string;
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return d && m && y ? `${d}-${m}-${y}` : iso; };
const modeLabel = (m: string) => ({ cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank Transfer', cheque: 'Cheque' }[m] ?? m);

/** The receipt itself: a 48 mm wide column (58 mm paper less the printer margins). */
function ReceiptBody({ r }: { r: ReceiptData }) {
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2mm' }}>
      <span>{label}</span><span style={{ textAlign: 'right', fontWeight: 600, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
  const rule = <div style={{ borderTop: '1px dashed #000', margin: '1.5mm 0' }} />;
  return (
    <div style={{ width: '48mm', margin: '0 auto', padding: '2mm 0', fontFamily: 'monospace, sans-serif', fontSize: '10.5px', lineHeight: 1.35, color: '#000', background: '#fff' }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>{BRAND.line1}</div>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '11px' }}>{BRAND.line2}</div>
      {r.companyAddress && <div style={{ textAlign: 'center', fontSize: '9px' }}>{r.companyAddress}</div>}
      {rule}
      <div style={{ textAlign: 'center', fontWeight: 700 }}>{r.type === 'arrear' ? 'AR RECEIPT' : 'CHIT RECEIPT'}</div>
      {rule}
      {row('Receipt No', r.receiptNo)}
      {row('Date', `${fmtDate(r.date)} ${r.time.slice(0, 5)}`)}
      {rule}
      {row('Customer', r.customerName)}
      {row('Cust ID', r.customerCode)}
      {r.mobile && row('Mobile', r.mobile)}
      {row('Group', r.groupName)}
      {r.dueNumber !== null && row('Due No', `#${r.dueNumber}`)}
      {rule}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px' }}>
        <span>AMOUNT</span><span>{formatCurrency(r.amount)}</span>
      </div>
      {row('Mode', modeLabel(r.paymentMode))}
      {r.referenceNo && row('Ref No', r.referenceNo)}
      {row('Balance', formatCurrency(r.balance))}
      {rule}
      {row('Collected by', r.staffName)}
      <div style={{ textAlign: 'center', marginTop: '2mm' }}>Thank you!</div>
      <div style={{ textAlign: 'center', fontSize: '9px' }}>Keep this receipt for your records.</div>
      <div style={{ height: '6mm' }} />
    </div>
  );
}

/** On-screen preview plus a hidden print copy (attached to <body> so it prints alone). */
export default function ThermalReceipt({ data }: { data: ReceiptData }) {
  return (
    <>
      <div className="inline-block border border-gray-300 rounded-md shadow-sm bg-white">
        <ReceiptBody r={data} />
      </div>
      {createPortal(<div id={PRINT_ID} style={{ display: 'none' }}><ReceiptBody r={data} /></div>, document.body)}
    </>
  );
}

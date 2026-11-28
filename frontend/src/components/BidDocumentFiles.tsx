import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/useForm';
import { useToast } from '@/context/ToastContext';
import type { BidPayment, BidDocumentFile } from '@/types';
import { Upload, Eye, Trash2, FileText, Image as ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';

const BID_DOCUMENTS = ['Application form', 'ID proof (Aadhaar)', 'Address proof', 'PAN card', 'Surety / guarantor form',
  'Guarantor ID proof', 'Promissory note', 'Cheque leaves', 'Bank passbook copy', 'Salary / income proof', 'Photos'];
const MAX_BYTES = 5 * 1024 * 1024;
const kb = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error('Could not read the file'));
  r.readAsDataURL(file);
});

/** Opens an uploaded document in a new tab (fetched with the sign-in token). */
async function viewBidFile(f: BidDocumentFile) {
  const tab = window.open('', '_blank');
  try {
    const { dataUrl } = await api.get<{ dataUrl: string }>(`/bid-payment-files/${f.id}`);
    const blob = await (await fetch(dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url; else window.location.href = url;
  } catch (e) {
    tab?.close();
    throw e;
  }
}

function FileChip({ f, onRemove }: { f: BidDocumentFile; onRemove?: () => void }) {
  const toast = useToast();
  const Icon = f.mime === 'application/pdf' ? FileText : ImageIcon;
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs">
      <Icon className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
      <button type="button" onClick={() => viewBidFile(f).catch(e => toast('error', e instanceof Error ? e.message : 'Could not open the file'))}
        className="truncate max-w-[160px] text-primary-700 hover:underline" title={`View ${f.fileName} · uploaded by ${f.uploadedBy} ${f.uploadedAt}`}>{f.fileName}</button>
      <span className="text-gray-400 flex-shrink-0">{kb(f.size)}</span>
      <button type="button" onClick={() => viewBidFile(f).catch(e => toast('error', e instanceof Error ? e.message : 'Could not open the file'))} className="text-gray-500 hover:text-primary-700" title="View"><Eye className="w-3.5 h-3.5" /></button>
      {onRemove && <button type="button" onClick={onRemove} className="text-gray-400 hover:text-danger-600" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>}
    </span>
  );
}

/**
 * The bid payment's documents, one row per document type. editable: upload (image or
 * PDF, up to 5 MB, several per document) and remove; otherwise view only.
 */
export default function BidDocumentFiles({ payment, editable }: { payment: BidPayment; editable: boolean }) {
  const { run, busy } = useAction();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState('');
  const [uploading, setUploading] = useState('');

  const choose = (document: string) => { setTarget(document); input.current?.click(); };
  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (input.current) input.current.value = '';
    for (const file of list) {
      if (file.size > MAX_BYTES) { toast('error', `${file.name} is larger than 5 MB`); continue; }
      setUploading(target);
      await run(async () => api.post(`/bid-payments/${payment.id}/files`, { document: target, fileName: file.name, fileData: await readAsDataUrl(file) }), `${file.name} uploaded`);
    }
    setUploading('');
  };
  const remove = (f: BidDocumentFile) => run(() => api.delete(`/bid-payment-files/${f.id}`), `${f.fileName} removed`);

  const rows = editable ? BID_DOCUMENTS : BID_DOCUMENTS.filter(d => payment.files.some(f => f.document === d));
  if (!editable && rows.length === 0) return <p className="text-sm text-gray-400">No documents uploaded.</p>;

  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={e => upload(e.target.files)} />
      {rows.map(d => {
        const files = payment.files.filter(f => f.document === d);
        return (
          <div key={d} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="flex items-center gap-1.5 w-full sm:w-48 flex-shrink-0 text-sm text-gray-800">
              {files.length ? <CheckCircle2 className="w-4 h-4 text-success-600" /> : <span className="w-4 h-4 rounded-full border border-gray-300" />} {d}
            </span>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
              {files.map(f => <FileChip key={f.id} f={f} onRemove={editable ? () => remove(f) : undefined} />)}
              {editable && (
                <button type="button" disabled={busy} onClick={() => choose(d)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-primary-300 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50">
                  {uploading === d ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {files.length ? 'Add more' : 'Upload'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

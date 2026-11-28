import { useEffect, useRef, useState } from 'react';
import { CalendarRange, ChevronDown, Search, X } from 'lucide-react';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick ranges relative to the server's "today" (YYYY-MM-DD). */
function presets(today: string): { key: string; label: string; from: string; to: string }[] {
  const [y, m, d] = today.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  const weekStart = new Date(t); weekStart.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const yesterday = new Date(t); yesterday.setDate(t.getDate() - 1);
  return [
    { key: 'today', label: 'Today', from: today, to: today },
    { key: 'yesterday', label: 'Yesterday', from: iso(yesterday), to: iso(yesterday) },
    { key: 'week', label: 'This Week', from: iso(weekStart), to: today },
    { key: 'month', label: 'This Month', from: iso(new Date(y, m - 1, 1)), to: today },
    { key: 'lastMonth', label: 'Last Month', from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m - 1, 0)) },
    { key: 'year', label: 'This Year', from: iso(new Date(y, 0, 1)), to: today },
    { key: 'all', label: 'All Dates', from: '', to: '' },
  ];
}

/**
 * The main filter of a list page: a highlighted From / To date range with one-click
 * presets (Today, This Week, This Month ...). Both empty = all dates.
 */
export function DateFilterPanel({ label = 'Date', from, to, onChange, today, children }: {
  label?: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  today: string;
  /** Extra summary shown on the right, e.g. "12 receipts · ₹45,000". */
  children?: React.ReactNode;
}) {
  const list = presets(today);
  const active = list.find(p => p.from === from && p.to === to)?.key;
  const bad = !!from && !!to && to < from;
  const dateBox = 'px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent';
  return (
    <div className="bg-white border-2 border-primary-100 rounded-xl p-4 mb-4 shadow-card print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-primary-700 font-semibold text-sm mr-2 self-center">
          <CalendarRange className="w-5 h-5" /> {label} Range
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input type="date" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} className={`${dateBox} border-gray-200`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input type="date" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} className={`${dateBox} ${bad ? 'border-danger-400' : 'border-gray-200'}`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {list.map(p => (
            <button key={p.key} type="button" onClick={() => onChange(p.from, p.to)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${active === p.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {children && <div className="ml-auto text-sm text-gray-600 self-center">{children}</div>}
      </div>
      {bad && <p className="text-xs text-danger-600 mt-2">The To date must be on or after the From date.</p>}
    </div>
  );
}

export interface SearchOption {
  value: string;
  label: string;
  /** Second line, e.g. "CUST00001 · Gold Scheme". */
  hint?: string;
  /** Extra text matched by the search but not shown. */
  keywords?: string;
}

/** A dropdown you can type into: matches label, hint and keywords anywhere in the text. */
export function SearchSelect({ label, value, onChange, options, placeholder = 'Type to search...', required, error, className = '', disabled }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (q ? options.filter(o => `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q)) : options).slice(0, 50);
  const choose = (o: SearchOption) => { onChange(o.value); setQuery(''); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setCursor(c => Math.min(c + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[cursor]) { e.preventDefault(); choose(matches[cursor]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={box}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-danger-500"> *</span>}</label>}
      <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg bg-white focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent ${error ? 'border-danger-400' : 'border-gray-200'} ${disabled ? 'bg-gray-50' : ''}`}>
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          value={open ? query : selected ? `${selected.label}${selected.hint ? ` — ${selected.hint}` : ''}` : ''}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(0); }}
          onFocus={() => { setOpen(true); setQuery(''); setCursor(0); }}
          onKeyDown={onKey}
          placeholder={selected ? `${selected.label}${selected.hint ? ` — ${selected.hint}` : ''}` : placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 text-sm outline-none bg-transparent disabled:text-gray-500"
        />
        {value && !disabled && (
          <button type="button" onClick={() => { onChange(''); setQuery(''); }} className="text-gray-400 hover:text-gray-600" aria-label="Clear"><X className="w-4 h-4" /></button>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-cardLg py-1">
          {matches.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No match</p>}
          {matches.map((o, i) => (
            <button key={o.value} type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(o)} onMouseEnter={() => setCursor(i)}
              className={`w-full text-left px-3 py-2 text-sm ${i === cursor ? 'bg-primary-50' : ''} ${o.value === value ? 'font-semibold text-primary-700' : 'text-gray-800'}`}>
              <div>{o.label}</div>
              {o.hint && <div className="text-xs text-gray-500">{o.hint}</div>}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  );
}

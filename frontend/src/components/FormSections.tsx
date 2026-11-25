import type { ReactNode } from 'react';

/** Building blocks for the long, sectioned entry forms (subscriber, chit group). */

export function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={`border border-gray-200 rounded-lg px-4 pb-4 pt-2 ${className}`}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-primary-700">{title}</legend>
      {children}
    </fieldset>
  );
}

export function RadioGroup({ label, value, onChange, options, error }: {
  label?: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string;
}) {
  return (
    <div>
      {label && <p className="block text-xs font-medium text-gray-600 mb-1">{label}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 py-2">
        {options.map(o => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
            <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} className="accent-primary-600" />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  );
}

export function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="block text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-800 min-h-[38px]">{value || '-'}</p>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, className = '' }: { label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer ${className}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-primary-600 w-4 h-4" />
      {label}
    </label>
  );
}


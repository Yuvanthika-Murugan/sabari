import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cleanValue, keyboardFor, type Check, type FieldFormat } from '@/lib/validation';

interface SelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

const fieldClass = (error?: string) =>
  `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 ${error ? 'border-danger-400' : 'border-gray-200'}`;

function FieldLabel({ label, required }: { label?: string; required?: boolean }) {
  if (!label) return null;
  return <label className="block text-xs font-medium text-gray-600 mb-1">{label}{required && <span className="text-danger-500"> *</span>}</label>;
}

function FieldError({ error }: { error?: string }) {
  return error ? <p className="text-xs text-danger-600 mt-1">{error}</p> : null;
}

export function Select({ label, value, onChange, options, placeholder = 'Select...', className = '', required, disabled, error }: SelectProps) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`${fieldClass(error)} bg-white`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldError error={error} />
    </div>
  );
}

interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  error?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Characters the field accepts; anything else is dropped as it is typed or pasted. type="number" defaults to "decimal". */
  format?: FieldFormat;
  /** Range for numeric fields, checked as the value is typed. */
  min?: number;
  max?: number;
  /** Extra rule (e.g. checks.pan), shown once the user leaves the field or fills maxLength. */
  check?: Check;
}

export function Input({ label, type = 'text', value, onChange, placeholder, required, className = '', disabled, error, maxLength, inputMode, format, min, max, check }: InputProps) {
  const [touched, setTouched] = useState(false);
  // Browsers' type="number" still accepts e, +, - and (in some) any text, so number
  // fields are rendered as text boxes that only take digits and one decimal point.
  const fmt: FieldFormat | undefined = format ?? (type === 'number' ? 'decimal' : undefined);
  // Password fields get an eye button to show / hide what was typed.
  const isPassword = type === 'password';
  const [reveal, setReveal] = useState(false);
  const inputType = type === 'number' ? 'text' : isPassword && reveal ? 'text' : type;

  let hint = '';
  if (value && fmt && (fmt === 'decimal' || fmt === 'integer')) {
    const n = Number(value);
    if (min !== undefined && n < min) hint = `Must be at least ${min.toLocaleString('en-IN')}`;
    else if (max !== undefined && n > max) hint = `Must be at most ${max.toLocaleString('en-IN')}`;
  }
  if (!hint && value && check && (touched || (maxLength !== undefined && value.length >= maxLength))) hint = check(value);
  const shown = error || hint || undefined;

  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <div className="relative">
        <input
          type={inputType}
          maxLength={maxLength}
          inputMode={inputMode ?? keyboardFor(fmt)}
          value={value}
          onChange={e => onChange(fmt ? cleanValue(fmt, e.target.value) : e.target.value)}
          onBlur={() => { setTouched(true); if (fmt === 'name' && value !== value.trim()) onChange(value.trim()); }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={isPassword ? 'new-password' : undefined}
          className={`${fieldClass(shown)}${isPassword ? ' pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal(r => !r)}
            disabled={disabled}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            title={reveal ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
          >
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <FieldError error={shown} />
    </div>
  );
}

/**
 * Phone number field that only accepts digits.
 * kind="mobile": exactly 10 digits starting with 6-9 (Indian mobile).
 * kind="phone":  mobile or landline with STD code, 10-11 digits (e.g. 04612345678).
 */
export function PhoneInput({ kind = 'mobile', placeholder, ...props }: InputProps & { kind?: 'mobile' | 'phone' }) {
  const max = kind === 'mobile' ? 10 : 11;
  const v = props.value;
  const hint = !v ? undefined
    : kind === 'mobile' && v.length === 10 && !/^[6-9]/.test(v) ? 'Mobile number must start with 6, 7, 8 or 9'
    : kind === 'phone' && v.length >= 10 && !/^(0\d{10}|[6-9]\d{9})$/.test(v) ? 'Enter a 10-digit mobile or a landline with STD code (0…)'
    : undefined;
  return (
    <Input {...props} type="tel" inputMode="numeric" maxLength={max}
      placeholder={placeholder ?? (kind === 'mobile' ? '9876543210' : '04612345678')}
      onChange={x => props.onChange(x.replace(/\D/g, '').slice(0, max))}
      error={props.error ?? hint} />
  );
}

interface TextAreaProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function TextArea({ label, value, onChange, placeholder, rows = 3, className = '', required, disabled, error }: TextAreaProps) {
  return (
    <div className={className}>
      <FieldLabel label={label} required={required} />
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`${fieldClass(error)} resize-none`}
      />
      <FieldError error={error} />
    </div>
  );
}

interface FilterBarProps {
  children: ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 mb-4 print:hidden [&>*]:min-w-0">
      {children}
    </div>
  );
}

interface DropdownProps {
  label: string;
  items: { label: string; onClick: () => void; icon?: ReactNode; variant?: 'default' | 'danger' }[];
}

/**
 * The menu is portalled to <body> with fixed positioning so a table's scroll container
 * cannot clip it, and opens upward when there is no room below the button.
 */
export function Dropdown({ label, items }: DropdownProps) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const close = () => setPos(null);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pos) return close();
    const r = e.currentTarget.getBoundingClientRect();
    const menuHeight = items.length * 36 + 8;
    const right = window.innerWidth - r.right;
    setPos(window.innerHeight - r.bottom < menuHeight + 8 && r.top > menuHeight + 8
      ? { bottom: window.innerHeight - r.top + 4, right }
      : { top: r.bottom + 4, right });
  };

  useEffect(() => {
    if (!pos) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);

  return (
    <div className="relative">
      <button onClick={toggle} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1">
        {label} <ChevronDown className="w-3 h-3" />
      </button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={close} />
          <div style={pos} className="fixed w-48 bg-white rounded-lg shadow-cardLg border border-gray-100 z-[61] py-1">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { close(); item.onClick(); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors ${item.variant === 'danger' ? 'text-danger-600' : 'text-gray-700'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

/** "From / To" date filter for a FilterBar. Both empty = all dates. */
export function DateRangeFilter({ from, to, onFrom, onTo, label = 'Date' }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
  /** Word put before "From" / "To", e.g. "Joined" → "Joined From", "Joined To". */
  label?: string;
}) {
  return (
    <>
      <Input label={`${label} From`} type="date" value={from} onChange={onFrom} />
      <Input label={`${label} To`} type="date" value={to} onChange={onTo}
        error={from && to && to < from ? 'Must be on or after the From date' : undefined} />
    </>
  );
}

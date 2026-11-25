import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BRAND } from '@/lib/brand';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: ReactNode;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Portalled to <body> with the "print-modal" class: while a popup is open, printing
  // shows only the popup (see index.css), e.g. the customer / group "Print" action.
  return createPortal(
    <div className="print-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-cardLg w-full ${sizes[size]} max-h-[95dvh] sm:max-h-[90vh] flex flex-col animate-slide-up print:max-w-none print:max-h-none print:shadow-none print:rounded-none`}>
        <div className="hidden print:flex items-end justify-between border-b-2 border-gray-800 pb-2 mb-2">
          <p className="text-base font-bold tracking-wide text-gray-900">{BRAND.name}</p>
          <p className="text-[10px] text-gray-600">Printed on {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 print:px-0 print:py-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 min-w-0">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors print:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4 print:overflow-visible print:px-0">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 print:hidden">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  variant?: 'primary' | 'danger';
  icon?: ReactNode;
  disabled?: boolean;
}

export function ModalFooter({ onCancel, onSubmit, submitLabel, submitting, variant = 'primary', icon, disabled }: ModalFooterProps) {
  const color = variant === 'danger' ? 'bg-danger-600 hover:bg-danger-700' : 'bg-primary-600 hover:bg-primary-700';
  return (
    <>
      <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
      <button onClick={onSubmit} disabled={submitting || disabled} className={`px-4 py-2 ${color} text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}>
        {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : icon}
        {submitLabel}
      </button>
    </>
  );
}

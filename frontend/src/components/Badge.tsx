import type { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'gold' | 'success' | 'warning' | 'danger' | 'gray' | 'blue';

const variants: Record<BadgeVariant, string> = {
  primary: 'bg-primary-100 text-primary-700',
  gold: 'bg-gold-100 text-gold-800',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
};

export default function Badge({ children, variant = 'gray' }: { children: ReactNode; variant?: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

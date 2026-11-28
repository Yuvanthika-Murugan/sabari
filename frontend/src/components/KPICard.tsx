import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'primary' | 'gold' | 'success' | 'warning' | 'danger';
  /** Page the card opens when clicked; the whole card becomes a link. */
  to?: string;
  /** Router state passed with the link (e.g. a filter to preselect). */
  state?: unknown;
  /** Small note under the figure, also shown as a tooltip (e.g. what the figure should include). */
  note?: string;
}

const colorClasses = {
  primary: { bg: 'bg-primary-50', iconBg: 'bg-primary-600', text: 'text-primary-700' },
  gold: { bg: 'bg-gold-50', iconBg: 'bg-gold-500', text: 'text-gold-700' },
  success: { bg: 'bg-success-50', iconBg: 'bg-success-600', text: 'text-success-700' },
  warning: { bg: 'bg-warning-50', iconBg: 'bg-warning-500', text: 'text-warning-700' },
  danger: { bg: 'bg-danger-50', iconBg: 'bg-danger-600', text: 'text-danger-700' },
};

export default function KPICard({ title, value, icon, trend, trendValue, color, to, state, note }: KPICardProps) {
  const c = colorClasses[color];
  const body = (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-medium text-gray-500 uppercase tracking-wide" title={note}>
            {title}{note && <Info className="w-3.5 h-3.5 text-gray-400" aria-label={note} />}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-success-600" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-4 h-4 text-danger-600" />
              ) : null}
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-danger-600' : 'text-gray-500'}`}>
                {trendValue}
              </span>
            </div>
          )}
          {note && <p className="text-[11px] text-gray-400 mt-1 italic">{note}</p>}
        </div>
        <div className={`w-12 h-12 flex-shrink-0 rounded-xl ${c.iconBg} flex items-center justify-center text-white shadow-md`}>
          {icon}
        </div>
      </div>
  );
  const box = 'block h-full bg-white rounded-xl shadow-card p-5 border border-gray-100 hover:shadow-cardLg transition-shadow animate-fade-in';
  return to
    ? <Link to={to} state={state} className={`${box} hover:border-primary-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`}>{body}</Link>
    : <div className={box}>{body}</div>;
}

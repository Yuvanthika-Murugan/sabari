import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { BRAND } from '@/lib/brand';
import { HandCoins, MapPin, LogOut } from 'lucide-react';

/** Collection staff layout: no sidebar, just a top bar with the two screens staff use in the field. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  const { currentUser, logout } = useApp();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium border-b-2 ${isActive ? 'border-gold-400 text-white' : 'border-transparent text-primary-200 hover:text-white'}`;
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="sticky top-0 z-30 bg-primary-950 text-white shadow-md print:hidden">
        <div className="max-w-3xl mx-auto px-4 pt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">{BRAND.line1} <span className="text-gold-400">{BRAND.line2}</span></p>
            <p className="text-xs text-primary-200 truncate">{currentUser?.name} · Collection Staff</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-primary-200 hover:text-white px-2 py-1.5 rounded-lg hover:bg-primary-800" title="Sign out">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <nav className="max-w-3xl mx-auto px-4 flex mt-2">
          <NavLink to="/collect" className={tab}><HandCoins className="w-4 h-4" /> Collect</NavLink>
          <NavLink to="/dashboard" className={tab}><MapPin className="w-4 h-4" /> My Route</NavLink>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto p-4 print:p-0">{children}</main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useMyCustomers } from '@/hooks/useMyCustomers';
import { BRAND } from '@/lib/brand';
import { HandCoins, MapPin, Landmark } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

/** Collection staff / agent layout: no sidebar, just a top bar with the two screens used in the field. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const { agent } = useMyCustomers();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex-1 sm:flex-none sm:px-6 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-gold-400 text-white' : 'border-transparent text-primary-200 hover:text-white'}`;
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <header className="sticky top-0 z-30 bg-primary-950 text-white shadow-md print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0">
              <Landmark className="w-5 h-5 text-primary-950" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">{BRAND.line1} <span className="text-gold-400">{BRAND.line2}</span></p>
              <p className="text-xs text-primary-200 truncate">{currentUser?.name} · {agent ? `Agent ${agent.agentCode}` : 'Collection Staff'}</p>
            </div>
          </div>
          <LogoutButton tone="dark" compact />
        </div>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex mt-2">
          <NavLink to="/collect" className={tab}><HandCoins className="w-4 h-4" /> Collect</NavLink>
          <NavLink to="/dashboard" className={tab}><MapPin className="w-4 h-4" /> My Route</NavLink>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 print:p-0">{children}</main>
    </div>
  );
}

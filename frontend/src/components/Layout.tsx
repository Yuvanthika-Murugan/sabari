import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { BRAND } from '@/lib/brand';
import { useApp } from '@/context/AppContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  // The MD (Super Admin) is viewing the Admin panel: offer the way back to their own panel.
  const viewingFromSuperAdmin = currentUser?.role === 'md';

  return (
    <div className="flex min-h-screen bg-gray-50 print:block print:min-h-0 print:bg-white">
      <div className="contents print:hidden"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 print:block">
        {viewingFromSuperAdmin && (
          <div className="print:hidden bg-gradient-to-r from-gold-400 to-gold-500 text-primary-950">
            <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="flex items-center gap-2 font-medium"><Eye className="w-4 h-4" /> Viewing the Admin Panel as Super Admin (MD)</p>
              <Link to="/super-admin" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary-950 text-white text-xs font-semibold hover:bg-primary-900">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Super Admin Panel
              </Link>
            </div>
          </div>
        )}
        <div className="contents print:hidden"><Header /></div>
        <main className="flex-1 p-4 sm:p-6 min-w-0 overflow-x-hidden print:p-0 print:overflow-visible">
          {/* Letterhead shown only on printouts. */}
          <div className="hidden print:flex items-end justify-between border-b-2 border-gray-800 pb-2 mb-4">
            <p className="text-base font-bold tracking-wide text-gray-900">{BRAND.name}</p>
            <p className="text-[10px] text-gray-600">Printed on {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

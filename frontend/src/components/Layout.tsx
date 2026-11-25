import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { BRAND } from '@/lib/brand';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 print:block print:min-h-0 print:bg-white">
      <div className="contents print:hidden"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 print:block">
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

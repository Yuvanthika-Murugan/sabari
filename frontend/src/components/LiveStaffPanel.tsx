import { useState } from 'react';
import Modal from '@/components/Modal';
import { useData } from '@/context/DataContext';
import { formatCurrency } from '@/lib/format';
import type { Collection, StaffLocation, User } from '@/types';
import { MapPin, Navigation, RefreshCw, ExternalLink, Crosshair } from 'lucide-react';

/** A position newer than this counts as "live". */
const LIVE_MINUTES = 10;

const ago = (m: number) => (m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`);
const hasGps = (c: Collection) => c.latitude !== null && c.longitude !== null;
const embedUrl = (lat: number | string, lng: number | string) => `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
const openUrl = (lat: number | string, lng: number | string) => `https://www.google.com/maps?q=${lat},${lng}`;

/**
 * In-app live map for one staff member: their latest phone position (updates on every
 * data refresh), and today's receipts — pick one to see where it was collected.
 */
function StaffMap({ user, loc, receipts, onClose }: { user: User; loc?: StaffLocation; receipts: Collection[]; onClose: () => void }) {
  // null = follow the live position; otherwise the receipt being shown.
  const [pinned, setPinned] = useState<Collection | null>(null);
  const gpsReceipts = receipts.filter(hasGps);
  const fallback = gpsReceipts[0];
  const point = pinned && hasGps(pinned)
    ? { lat: pinned.latitude!, lng: pinned.longitude!, label: `Receipt ${pinned.receiptNo} · ${pinned.customerName} at ${pinned.time.slice(0, 5)}` }
    : loc ? { lat: loc.latitude, lng: loc.longitude, label: `Live position · ${ago(loc.minutesAgo)}${loc.accuracy ? ` (±${loc.accuracy} m)` : ''}` }
    : fallback ? { lat: fallback.latitude!, lng: fallback.longitude!, label: `Last receipt ${fallback.receiptNo} · ${fallback.customerName} at ${fallback.time.slice(0, 5)}` }
    : null;
  const live = !!loc && loc.minutesAgo <= LIVE_MINUTES;
  const lastArea = receipts[0]?.area;

  return (
    <Modal isOpen onClose={onClose} title={`${user.name} — Live Collection Area`} size="2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${live ? 'bg-success-50 text-success-700' : loc ? 'bg-warning-50 text-warning-700' : 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-2 h-2 rounded-full ${live ? 'bg-success-500 animate-pulse' : loc ? 'bg-warning-400' : 'bg-gray-400'}`} />
            {live ? 'Live now' : loc ? `Last seen ${ago(loc.minutesAgo)}` : 'Live location not shared'}
          </span>
          {lastArea && <span className="text-gray-600">Area: <span className="font-semibold text-gray-900">{lastArea}</span></span>}
          <span className="text-gray-600">Today: <span className="font-semibold text-success-600">{formatCurrency(receipts.reduce((s, c) => s + c.collectedAmount, 0))}</span> · {receipts.length} receipt{receipts.length === 1 ? '' : 's'}</span>
        </div>

        {point ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-gray-600 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-danger-500" /> {point.label}</p>
              <div className="flex items-center gap-3">
                {pinned && loc && (
                  <button onClick={() => setPinned(null)} className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium"><Crosshair className="w-3.5 h-3.5" /> Back to live</button>
                )}
                <a href={openUrl(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
                </a>
              </div>
            </div>
            <iframe
              key={`${point.lat},${point.lng}`}
              title={`${user.name} location`}
              src={embedUrl(point.lat, point.lng)}
              className="w-full h-80 sm:h-96 rounded-lg border border-gray-200"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <div className="h-48 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-center text-sm text-gray-500 p-4">
            <MapPin className="w-8 h-8 text-gray-300 mb-2" />
            No location yet. It appears once {user.name} opens the staff app with location allowed on the phone.
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Where {user.name} collected today</h4>
          {receipts.length === 0 && <p className="text-sm text-gray-400">No receipts yet today.</p>}
          <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
            {receipts.map(c => (
              <li key={c.id} className={`flex items-center justify-between gap-3 py-2 px-2 rounded ${pinned?.id === c.id ? 'bg-primary-50' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 truncate">{c.time.slice(0, 5)} · {c.customerName}</p>
                  <p className="text-xs text-gray-500">{c.area || 'No area'} · {c.receiptNo} · {c.paymentMode === 'cash' ? 'Cash' : 'Bank'}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold text-success-600">{formatCurrency(c.collectedAmount)}</span>
                  {hasGps(c)
                    ? <button onClick={() => setPinned(c)} className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium"><MapPin className="w-3.5 h-3.5" /> Show</button>
                    : <span className="text-[11px] text-gray-400">no GPS</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Live collection area: each collection staff member's last reported phone position
 * (sent every 2 minutes while the staff app is open), the area of their latest
 * receipt today, and today's amount. "Map" opens the live map inside the app.
 */
export default function LiveStaffPanel() {
  const { users, staffLocations, collections, today, refresh } = useData();
  const [mapFor, setMapFor] = useState<string | null>(null);
  const staff = users.filter(u => u.role === 'staff' && u.status === 'active');
  const rows = staff.map(u => {
    const loc = staffLocations.find(l => l.userId === u.id);
    const mine = collections.filter(c => c.date === today && c.staffId === u.id); // newest first
    return { u, loc, mine, last: mine[0], total: mine.reduce((s, c) => s + c.collectedAmount, 0) };
  }).sort((a, b) => (a.loc?.minutesAgo ?? 1e9) - (b.loc?.minutesAgo ?? 1e9));
  const liveCount = rows.filter(r => r.loc && r.loc.minutesAgo <= LIVE_MINUTES).length;
  const open = rows.find(r => r.u.id === mapFor);

  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Navigation className="w-5 h-5 text-primary-600" /> Live Collection Area
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500"><span className="inline-block w-2 h-2 rounded-full bg-success-500 mr-1" />{liveCount} live of {staff.length}</span>
          <button onClick={() => refresh().catch(() => {})} className="p-1 text-gray-400 hover:text-primary-600" title="Refresh" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
      {rows.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No active collection staff.</p>}
      <ul className="divide-y divide-gray-100">
        {rows.map(({ u, loc, mine, last, total }) => {
          const live = !!loc && loc.minutesAgo <= LIVE_MINUTES;
          return (
            <li key={u.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${live ? 'bg-success-500 animate-pulse' : loc ? 'bg-warning-400' : 'bg-gray-300'}`} />
                  {u.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {last ? <>Area: <span className="font-medium text-gray-700">{last.area || '—'}</span> · last {last.customerName} at {last.time.slice(0, 5)}</> : 'No receipt yet today'}
                </p>
                <p className="text-xs text-gray-400">{loc ? `Location ${ago(loc.minutesAgo)}${loc.accuracy ? ` (±${loc.accuracy} m)` : ''}` : 'Location not shared yet'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-success-600">{formatCurrency(total)}</p>
                <p className="text-[11px] text-gray-400">{mine.length} receipt{mine.length === 1 ? '' : 's'}</p>
                <button onClick={() => setMapFor(u.id)} className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium mt-1 hover:underline">
                  <MapPin className="w-3.5 h-3.5" /> Map
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-gray-400 mt-2">Positions come from the staff app (sent every 2 minutes while it is open, and with each receipt). Staff must allow location on their phone.</p>
      {open && <StaffMap user={open.u} loc={open.loc} receipts={open.mine} onClose={() => setMapFor(null)} />}
    </div>
  );
}

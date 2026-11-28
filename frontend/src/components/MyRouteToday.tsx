import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useAction } from '@/hooks/useForm';
import { useMyDay } from '@/components/MyDay';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { currentPosition } from '@/lib/geo';
import { customerAddress, mapQuery, mapsEmbed, mapsLink, mapsRoute, mapsRouteEmbed, type MapPoint } from '@/lib/maps';
import type { Collection } from '@/types';
import { Navigation, MapPin, Printer, ArrowUpRight, LocateFixed } from 'lucide-react';

const card = 'bg-white rounded-xl shadow-card border border-gray-100 p-4';

/** Where a stop is on the map, and how exact that is. */
type StopSource = 'gps' | 'customer' | 'address';
const SOURCE_LABEL: Record<StopSource, string> = {
  gps: 'GPS at collection',
  customer: 'Customer location',
  address: 'Address only (no exact pin)',
};

/**
 * Today's route: each customer collected from, in the order visited, on a route map.
 * A stop is placed by the GPS saved with the receipt, else the customer's saved
 * location, else their address. The map first shows the whole route with a pin per
 * stop; tap a stop to zoom to that customer. "Save location here" stores the
 * customer's position from the phone so they are pinned exactly from then on.
 */
export function MyRouteToday({ onReprint, hideWhenEmpty = false }: { onReprint?: (c: Collection) => void; hideWhenEmpty?: boolean }) {
  const { receipts, total } = useMyDay();
  const { customers, branches } = useData();
  const { run, busy } = useAction();
  const [selected, setSelected] = useState<string | null>(null);

  if (receipts.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2"><Navigation className="w-4 h-4 text-primary-600" /> My route today</h2>
        <div className="py-6 text-center">
          <MapPin className="w-8 h-8 mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No collections yet today.</p>
          <p className="text-xs text-gray-400">Each customer you collect from appears here in order, on the route map.</p>
        </div>
      </section>
    );
  }

  const stopOf = (c: Collection): { p: MapPoint; source: StopSource } => {
    const cust = customers.find(x => x.id === c.customerId);
    const town = branches.find(b => b.id === cust?.branchId)?.name ?? '';
    const address = customerAddress(cust ?? { area: c.area }, town);
    if (c.latitude && c.longitude) return { p: { lat: c.latitude, lng: c.longitude, address }, source: 'gps' };
    if (cust?.latitude && cust?.longitude) return { p: { lat: cust.latitude, lng: cust.longitude, address }, source: 'customer' };
    return { p: { address }, source: 'address' };
  };
  const stops = receipts.map(c => ({ c, ...stopOf(c) }));
  const mappable = stops.filter(s => mapQuery(s.p));
  const pinned = mappable.filter(s => s.source !== 'address');
  const current = selected ? stops.find(s => s.c.id === selected) : undefined;
  // The whole route: the exactly pinned stops when there are 2+, else every stop that can be
  // mapped. Repeat visits to the same place count once (a route from a place to itself
  // makes Google show the whole world).
  const distinct = (xs: typeof stops) => xs.filter((s, i) => xs.findIndex(o => mapQuery(o.p) === mapQuery(s.p)) === i);
  const routeStops = distinct(pinned).length >= 2 ? distinct(pinned) : distinct(mappable);
  const mapSrc = current && mapQuery(current.p) ? mapsEmbed(current.p, 17)
    : routeStops.length >= 2 ? mapsRouteEmbed(routeStops.map(s => s.p))
    : routeStops[0] ? mapsEmbed(routeStops[0].p, 16) : '';
  const openUrl = current ? mapsLink(current.p)
    : routeStops.length >= 2 ? mapsRoute(routeStops.map(s => s.p))
    : routeStops[0] ? mapsLink(routeStops[0].p) : '';

  const saveHere = (customerId: string, name: string) => run(async () => {
    const pos = await currentPosition();
    if (!pos) throw new Error('Could not get your location. Allow location for this site and try again.');
    await api.post(`/customers/${customerId}/location`, pos);
  }, `Location saved for ${name}`);

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Navigation className="w-4 h-4 text-primary-600" /> My route today</h2>
        <span className="text-xs text-gray-500 tabular-nums">{receipts.length} stop{receipts.length === 1 ? '' : 's'} · {formatCurrency(total)}</span>
      </div>

      {mapSrc ? (
        <div className="mb-3">
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
            <iframe key={mapSrc} title="Route map" src={mapSrc} className="w-full h-64 border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <span className="absolute bottom-8 left-2 rounded-md bg-white/95 shadow px-2 py-1 text-[11px] font-semibold text-gray-700">
              {current ? `Stop ${stops.indexOf(current) + 1}: ${current.c.customerName}` : `Route · ${routeStops.length} stop${routeStops.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={current?.source === 'address' || (!current && pinned.length < stops.length) ? 'text-warning-700' : 'text-gray-500'}>
              {current ? SOURCE_LABEL[current.source]
                : pinned.length < stops.length ? `${stops.length - pinned.length} stop(s) placed by address only — use "Save location here"`
                : 'All stops pinned'}
            </span>
            <span className="flex items-center gap-3">
              {current && <button type="button" onClick={() => setSelected(null)} className="font-medium text-primary-600 hover:underline">Show full route</button>}
              {openUrl && (
                <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary-600 hover:underline">
                  Open in Maps <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-xs text-gray-400">No location or address saved for today's stops, so no map can be shown.</p>
      )}

      <ol>
        {stops.map((s, i) => {
          const active = current?.c.id === s.c.id;
          return (
            <li key={s.c.id} className="flex gap-3 pb-3 last:pb-0">
              {/* Stop number with a line to the next stop. */}
              <div className="flex flex-col items-center">
                <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${active ? 'bg-gold-500 text-primary-950' : 'bg-primary-600 text-white'}`}>{i + 1}</span>
                {i < stops.length - 1 && <span className="flex-1 w-px bg-primary-100 mt-1" />}
              </div>
              <div className={`flex-1 min-w-0 rounded-lg -mx-1 px-1 ${active ? 'bg-primary-50/60' : ''}`}>
                <button type="button" onClick={() => setSelected(s.c.id)} className="w-full text-left" title="Show this customer on the map">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.c.customerName}</p>
                      <p className="text-xs text-gray-500 truncate">{s.c.time.slice(0, 5)} · {s.c.area || s.c.groupName} · {s.c.receiptNo}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-success-700 tabular-nums">{formatCurrency(s.c.collectedAmount)}</p>
                      <p className="text-[11px] text-gray-400 uppercase">{s.c.paymentMode === 'cash' ? 'Cash' : 'UPI / Bank'}</p>
                    </div>
                  </div>
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <button type="button" onClick={() => setSelected(s.c.id)}
                    className={`inline-flex items-center gap-1 font-medium ${s.source === 'address' ? 'text-warning-700' : 'text-primary-600'}`}>
                    <MapPin className="w-3.5 h-3.5" /> {SOURCE_LABEL[s.source]}
                  </button>
                  {s.source !== 'gps' && (
                    <button type="button" disabled={busy} onClick={() => saveHere(s.c.customerId, s.c.customerName)}
                      className="inline-flex items-center gap-1 font-medium text-success-700 disabled:opacity-50" title="Stand at the customer's place and tap to pin them">
                      <LocateFixed className="w-3.5 h-3.5" /> {s.source === 'customer' ? 'Update location here' : 'Save location here'}
                    </button>
                  )}
                  {onReprint && <button onClick={() => onReprint(s.c)} className="inline-flex items-center gap-1 text-primary-600 font-medium"><Printer className="w-3.5 h-3.5" /> Reprint</button>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

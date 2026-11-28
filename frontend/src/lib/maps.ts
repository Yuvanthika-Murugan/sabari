/**
 * Google Maps links for the collection app. A point is either the GPS position saved
 * with a receipt, or (when there is none) the customer's address and area as text.
 */
export type MapPoint = { lat?: string | number | null; lng?: string | number | null; address?: string };

const hasGps = (p: MapPoint) => p.lat != null && p.lng != null && p.lat !== '' && p.lng !== '';

/** The search text for a point: "lat,lng", or the address. */
export function mapQuery(p: MapPoint): string {
  return hasGps(p) ? `${p.lat},${p.lng}` : (p.address ?? '').trim();
}

/** Opens the point in Google Maps (app on phones, website on laptops). */
export function mapsLink(p: MapPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(p))}`;
}

/** A map that can be shown inside the page (no API key needed). */
export function mapsEmbed(p: MapPoint, zoom = 15): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery(p))}&z=${zoom}&output=embed`;
}

/**
 * A route map inside the page: directions from the first point through the rest, in
 * order, with a pin at each stop (no API key needed). Up to 10 points.
 */
export function mapsRouteEmbed(points: MapPoint[]): string {
  const qs = points.slice(-10).map(mapQuery);
  const [first, ...rest] = qs;
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(first)}&daddr=${rest.map(encodeURIComponent).join('+to:')}&output=embed`;
}

/** Directions through several points, in order (Google takes about 10 in a link). */
export function mapsRoute(points: MapPoint[]): string {
  return `https://www.google.com/maps/dir/${points.slice(-10).map(p => encodeURIComponent(mapQuery(p))).join('/')}`;
}

/** The customer's address and area joined for a map search ('' when unknown). */
export function customerAddress(c?: { address?: string; area?: string } | null, extra = ''): string {
  return [c?.address, c?.area, extra].map(s => (s ?? '').trim()).filter(Boolean).join(', ');
}

export { hasGps };

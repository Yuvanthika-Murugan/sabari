import { useEffect } from 'react';
import { api } from '@/lib/api';

export interface Point { latitude: number; longitude: number; accuracy: number }

/** The phone's current position, or null if location is off / denied / slow (never throws). */
export function currentPosition(timeoutMs = 8000): Promise<Point | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** How often an open staff app reports its position. */
const HEARTBEAT_MS = 2 * 60_000;

/**
 * Sends the phone's position to the server now and every 2 minutes while the page is
 * visible, so the office dashboard can show where each collection staff member is.
 */
export function useLocationHeartbeat() {
  useEffect(() => {
    let stopped = false;
    const send = async () => {
      if (document.visibilityState !== 'visible') return;
      const p = await currentPosition();
      if (p && !stopped) api.post('/location', p).catch(() => {});
    };
    send();
    const timer = window.setInterval(send, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', send);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', send); };
  }, []);
}

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * True while the browser print dialog is preparing the page, so components can
 * render print-only content (e.g. every table row instead of one page of rows).
 * flushSync makes React re-render before the browser takes its print snapshot.
 */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return printing;
}

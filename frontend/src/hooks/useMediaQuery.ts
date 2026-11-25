import { useEffect, useState } from 'react';

/** Tracks a CSS media query, e.g. useMediaQuery('(min-width: 1024px)'). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Laptop and wider (Tailwind's lg breakpoint): the sidebar is docked instead of a drawer. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

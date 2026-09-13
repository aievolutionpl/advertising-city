// 📱 Wykrywanie urządzenia: dotyk, orientacja, szerokość ekranu, tryb oszczędny.
// Jedno źródło prawdy dla UI — bez tego HUD i sterowanie mobilne rozjeżdżały się między sesjami.
import { useEffect, useState } from 'react';

const mq = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);

/** Dotyk rozpoznajemy OD RAZU (pointer:coarse / maxTouchPoints), a nie dopiero po pierwszym tapnięciu. */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (mq('(pointer: coarse)') && mq('(pointer: coarse)').matches)
    || (navigator.maxTouchPoints || 0) > 0
    || 'ontouchstart' in window,
  );
}

export function useDevice() {
  const [dev, setDev] = useState(() => ({
    touch: isTouchDevice(),
    landscape: typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true,
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    let raf = 0;
    const read = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setDev((p) => {
        const next = {
          touch: isTouchDevice(),
          landscape: window.innerWidth > window.innerHeight,
          w: window.innerWidth,
          h: window.innerHeight,
        };
        if (p.touch === next.touch && p.landscape === next.landscape && p.w === next.w && p.h === next.h) return p;
        return next;
      }));
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    const c = mq('(pointer: coarse)');
    if (c && c.addEventListener) c.addEventListener('change', read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
      if (c && c.removeEventListener) c.removeEventListener('change', read);
    };
  }, []);

  return {
    ...dev,
    phone: dev.touch && Math.min(dev.w, dev.h) < 620,
    // tablet = też ciężki sprzęt (iPad/Android): bez cieni i z niższym DPR od startu.
    // Telefon = jw. + mniejsze tekstury. Zbyt późne wykrywanie „słabego” sprzętu
    // powodowało, że tablet nie wyrabiał pierwszej klatki i wyglądało to jak brak mapy.
    lowPower: dev.touch,
  };
}

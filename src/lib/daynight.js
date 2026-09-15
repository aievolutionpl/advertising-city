// Cykl dobowy — czysta matematyka (zero three/React), więc testowalna w node.
// Jedno źródło prawdy dla nieba, słońca, mgły, latarni i świecących okien.

/** Klatki kluczowe doby (PL, lato). azimuth liczony z godziny, elev w radianach (może być < 0 = pod horyzontem). */
const KEYS = [
  { h: 0,  sky: ['#04091c', '#081430', '#101d3c'], sun: '#9fb8ff', sunI: 0.18, ambI: 0.12, hemiI: 0.22, fog: '#0a1424', night: 1,    lamps: 1,    win: 1,    elev: -0.35 },
  { h: 4,  sky: ['#071230', '#122246', '#2a3352'], sun: '#b9c8ff', sunI: 0.22, ambI: 0.14, hemiI: 0.26, fog: '#152036', night: 0.85, lamps: 0.95, win: 0.95, elev: -0.24 },
  { h: 6,  sky: ['#1d4a86', '#5f86b4', '#e8a878'], sun: '#ffb072', sunI: 0.95, ambI: 0.20, hemiI: 0.45, fog: '#8fa4bb', night: 0.35, lamps: 0.5,  win: 0.45, elev: 0.03 },
  { h: 8,  sky: ['#2a6dbd', '#7fb2d8', '#e7eef4'], sun: '#ffe0b0', sunI: 2.00, ambI: 0.26, hemiI: 0.62, fog: '#cfdae4', night: 0.05, lamps: 0.08, win: 0.05, elev: 0.52 },
  { h: 12, sky: ['#1f66c2', '#8ec6e4', '#f2f6fa'], sun: '#fffdf5', sunI: 2.70, ambI: 0.30, hemiI: 0.72, fog: '#dde6ee', night: 0,    lamps: 0,    win: 0,    elev: 1.15 },
  { h: 16, sky: ['#2a72c0', '#93c6de', '#f6efe2'], sun: '#ffeec4', sunI: 2.30, ambI: 0.27, hemiI: 0.62, fog: '#d8e0e8', night: 0,    lamps: 0,    win: 0,    elev: 0.55 },
  { h: 18, sky: ['#2f5f9e', '#a8869c', '#ffb072'], sun: '#ffb271', sunI: 1.70, ambI: 0.22, hemiI: 0.45, fog: '#c49a86', night: 0.18, lamps: 0.3,  win: 0.25, elev: 0.10 },
  { h: 20, sky: ['#16224a', '#3b3a63', '#a05a63'], sun: '#ff9d6b', sunI: 0.55, ambI: 0.16, hemiI: 0.30, fog: '#4a4356', night: 0.70, lamps: 0.85, win: 0.80, elev: -0.14 },
  { h: 22, sky: ['#081026', '#141c3c', '#2a2a4a'], sun: '#a9bfff', sunI: 0.22, ambI: 0.13, hemiI: 0.24, fog: '#141c30', night: 0.92, lamps: 0.98, win: 0.95, elev: -0.28 },
  { h: 24, sky: ['#04091c', '#081430', '#101d3c'], sun: '#9fb8ff', sunI: 0.18, ambI: 0.12, hemiI: 0.22, fog: '#0a1424', night: 1,    lamps: 1,    win: 1,    elev: -0.35 },
];

const lerp = (a, b, t) => a + (b - a) * t;

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

export function lerpHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}

/** Godzina (0–24, może być float) → pełny stan doby. Wejście spoza zakresu zawija się modulo 24. */
export function dayState(hours) {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  const elev = lerp(a.elev, b.elev, t);
  const azim = ((h - 6) / 12) * Math.PI + Math.PI / 2; // wschód o 6:00 (+X), południe o 12:00 (−Z), zachód o 18:00 (−X)
  const ce = Math.cos(elev);
  return {
    hours: h,
    clock: `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`,
    sunI: lerp(a.sunI, b.sunI, t),
    ambI: lerp(a.ambI, b.ambI, t),
    hemiI: lerp(a.hemiI, b.hemiI, t),
    night: lerp(a.night, b.night, t),
    lamps: lerp(a.lamps, b.lamps, t),
    win: lerp(a.win, b.win, t),
    sun: lerpHex(a.sun, b.sun, t),
    fog: lerpHex(a.fog, b.fog, t),
    // Nocą dystans łagodnie się skraca, za dnia panorama pozostaje jasna i czytelna.
    fogNear: lerp(86, 132, 1 - lerp(a.night, b.night, t)),
    fogFar: lerp(255, 350, 1 - lerp(a.night, b.night, t)),
    skyTop: lerpHex(a.sky[0], b.sky[0], t),
    skyMid: lerpHex(a.sky[1], b.sky[1], t),
    skyBottom: lerpHex(a.sky[2], b.sky[2], t),
    elev,
    azim,
    // kierunek słońca (jednostkowy) — do shadera nieba i do światła kierunkowego
    sunDir: [ce * Math.sin(azim), Math.sin(elev), ce * Math.cos(azim)],
    brightness: lerp(a.sunI, b.sunI, t) + lerp(a.ambI, b.ambI, t),
  };
}

/** Ile godzin doby upływa w 1 sekundzie dla danego trybu czasu. */
export const TIME_SPEEDS = {
  pause: 0,
  real: 1 / 3600,        // 1 s = 1 s
  fast: 1 / 60,          // 1 s = 1 min
  epic: 1 / 10,          // 1 s = 6 min (do pokazywania cyklu w demo)
};

export function advance(hours, speedKey, dtSeconds) {
  return (((hours + (TIME_SPEEDS[speedKey] ?? 0) * dtSeconds) % 24) + 24) % 24;
}

// 🎪 Co się dzieje w mieście: harmonogram wydarzeń + easter eggi (UFO, Człowiek-pająk, kaczka…).
// Czysta logika na zegarze miejskim — zero three, zero Reacta → testowalne headless (test/events.test.mjs).
import { PLOTS, CITY } from '../data/city.js';

const EXTENT = CITY.extent ?? 84;

/** Deterministyczny szum 0..1 — te same wejście = ta sama pozycja (miasto nie „skacze" przy odświeżeniu). */
export function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const lerp = (a, b, t) => a + (b - a) * t;
const wrapHour = (h) => ((h % 24) + 24) % 24;

/* ── harmonogram: co o której godzinie ── */
export const EVENTS = [
  { id: 'ufo', name: 'UFO nad miastem', emoji: '🛸', from: 21, to: 4.4, kind: 'night' },
  { id: 'spider', name: 'Człowiek-pająk na linie', emoji: '🕷️', from: 8, to: 20, kind: 'day' },
  { id: 'balloon', name: 'Balon nad dachami', emoji: '🎈', from: 6.5, to: 20.3, kind: 'day' },
  { id: 'drones', name: 'Pokaz dronów', emoji: '✨', from: 20.2, to: 22.6, kind: 'night' },
  { id: 'parade', name: 'Parada reklamowa', emoji: '🚌', from: 16, to: 17.6, kind: 'day' },
  { id: 'market', name: 'Targ na skwerze', emoji: '🥨', from: 10, to: 14, kind: 'day' },
  { id: 'musician', name: 'Uliczny muzyk', emoji: '🎸', from: 15, to: 21, kind: 'day' },
  { id: 'dawn', name: 'Kurierzy i piekarze', emoji: '🥖', from: 4.4, to: 6.5, kind: 'dawn' },
];

/** Czy wydarzenie trwa o danej godzinie (obsługuje przejście przez północ). */
export function isActive(ev, hour) {
  const h = wrapHour(hour);
  return ev.from <= ev.to ? (h >= ev.from && h < ev.to) : (h >= ev.from || h < ev.to);
}

export function activeEvents(hour) {
  return EVENTS.filter((e) => isActive(e, hour));
}

/** Co pokazać w HUD: max 3 najciekawsze rzeczy dziejące się teraz. */
export function eventFeed(hour, max = 3) {
  const order = ['ufo', 'parade', 'drones', 'spider', 'balloon', 'market', 'musician', 'dawn'];
  const act = activeEvents(hour);
  return order
    .map((id) => act.find((e) => e.id === id))
    .filter(Boolean)
    .slice(0, max)
    .map((e) => ({ id: e.id, name: e.name, emoji: e.emoji, kind: e.kind }));
}

/** Czy o tej godzinie świeci słońce (do decyzji, co uruchamiać). */
export function isDaylight(hour) {
  const h = wrapHour(hour);
  return h >= 6.2 && h < 20.4;
}

/* ── UFO: krąży, co jakiś czas zawisa i „pobiera" próbki ── */
export function ufoHoverPoint(seed = 3) {
  const parks = PLOTS.filter((p) => p.park);
  if (!parks.length) return { x: 0, z: 0 };
  const p = parks[Math.floor(noise(seed) * parks.length) % parks.length];
  return { x: p.x, z: p.z, name: p.name || 'park' };
}

/** @returns {{x,z,y,angle,beam,hovering,phase}} ścieżka UFO (okres 32 s). */
export function ufoTrack(t, seed = 3) {
  const T = 32;
  const p = ((t % T) + T) % T;
  const hover = ufoHoverPoint(seed);
  const orbitR = EXTENT * 0.62;
  if (p >= 12 && p < 18.5) {
    const k = (p - 12) / 6.5;
    const fade = Math.min(1, k * 4, (1 - k) * 4);      // wiązka włącza się i gaśnie (0..1)
    return {
      x: hover.x, z: hover.z, y: 17 + Math.sin(t * 1.2) * 0.5,
      angle: t * 0.4, beam: Math.max(0, fade), hovering: true, phase: 'hover', k,
    };
  }
  const around = ((p + 8) % T) / T;              // pozostały czas = lot po okręgu
  const angle = around * Math.PI * 2;
  const r = orbitR + Math.sin(t * 0.31) * 7;
  return {
    x: Math.cos(angle) * r, z: Math.sin(angle) * r, y: 24 + Math.sin(t * 0.7) * 1.6,
    angle: -angle + Math.PI / 2, beam: 0, hovering: false, phase: 'orbit', k: 0,
  };
}

/** Punkt pobrania próbki — unosząca się krowa/królik pod UFO (do animacji snopu). */
export function abductTrack(t, seed = 3) {
  const u = ufoTrack(t, seed);
  if (!u.hovering) return null;
  const k = Math.min(1, Math.max(0, u.k));
  return { x: u.x, z: u.z, y: lerp(0, 6.4, k * k), scale: 1 - k * 0.45, k };
}

/* ── Człowiek-pająk: huśta się na linie między dachami ── */
export function swingAnchors() {
  const out = [];
  for (let i = 0; i < 14; i += 1) {
    const cx = [56, 28, 0, -28, -56][i % 5];
    const cz = [56, 28, 0, -28, -56][(i * 3) % 5];
    out.push({
      from: { x: cx + 9, y: 16 + noise(i + 1) * 20, z: cz - 9 },
      to: { x: cx - 9, y: 10 + noise(i + 9) * 16, z: cz + 9 },
    });
  }
  return out;
}

/** @returns {{x,y,z,anchor,web:{x,y,z},swing}} pozycja bohatera na linie (okres 6 s na przęsło). */
export function spiderTrack(t, anchors = swingAnchors()) {
  if (!anchors.length) return null;
  const per = 6;
  const idx = Math.floor(t / per) % anchors.length;
  const p = ((t % per) + per) % per / per;       // 0..1
  const a = anchors[idx];
  const e = Math.sin(p * Math.PI) * 3.4;                        // łuk — leci w dół i wraca
  const x = lerp(a.from.x, a.to.x, p);
  const z = lerp(a.from.z, a.to.z, p);
  const y = lerp(a.from.y, a.to.y, p) - e;
  // lina zawsze leci W GÓRĘ do zaczepu nad nim (inaczej „wisiałby" na linii do dołu)
  const web = { x: x + 3.2, y: Math.max(a.from.y, a.to.y) + 4 + Math.sin(p * Math.PI) * 1.2, z: z + 3.2 };
  return { x, y, z, anchor: idx, web, swing: e / 3.4 };
}

/* ── Balon, drony, parada: proste, deterministyczne ścieżki ── */
export function balloonTrack(t) {
  const T = 96;
  const p = ((t % T) + T) % T / T;
  return { x: lerp(-EXTENT, EXTENT, p), y: 34 + Math.sin(t * 0.18) * 2.4, z: Math.sin(p * Math.PI * 2) * 40 };
}

export function droneShowTrack(t, count = 22) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const form = Math.floor(t / 12) % 3;          // 3 formacje: koło, serce, fala
    const r = form === 1 ? 18 * (0.55 + 0.45 * Math.abs(Math.cos(a))) : 22;
    const y = 30 + Math.sin(t * 0.9 + i * 0.5) * 0.8 + (form === 2 ? Math.sin(a * 3 + t) * 3 : 0);
    out.push({ x: Math.cos(a + t * 0.25) * r, y, z: Math.sin(a + t * 0.25) * r });
  }
  return out;
}

/** Parada: kolumna pojazdów jadąca po obwodzie (okres 24 s). */
export function paradeTrack(t, vehicles = 5) {
  const R = EXTENT - 6;
  const per = 24;
  const out = [];
  for (let i = 0; i < vehicles; i += 1) {
    const k = (((t - i * 1.7) % per) + per) % per / per;
    const a = k * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    out.push({ x, z, angle: -a + Math.PI / 2, i });
  }
  return out;
}

/* ── Zbieractwo: monety rozrzucone po mieście (nowe co dzień) ── */
export function coinPicks(dayIndex = 0, count = 14) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const s = dayIndex * 31 + i * 7.3;
    out.push({
      id: `coin-${dayIndex}-${i}`,
      x: (noise(s) * 2 - 1) * (EXTENT - 8),
      z: (noise(s + 5.1) * 2 - 1) * (EXTENT - 8),
      y: 0.9,
      value: 120 + Math.floor(noise(s + 2.7) * 8) * 20,
    });
  }
  return out;
}

/* ── Easter eggi ── */
export const EASTER_EGGS = [
  { id: 'egg-ufo', emoji: '🛸', name: 'UFO pobiera próbki', hint: 'W nocy (21:00–4:00) podejdź pod snop światła', xp: 200, radius: 14 },
  { id: 'egg-spider', emoji: '🕷️', name: 'Człowiek-pająk na linie', hint: 'W dzień (8:00–20:00) złap go między dachami', xp: 150, radius: 12 },
  { id: 'egg-duck', emoji: '🦆', name: 'Gumowa kaczka w stawie', hint: 'Poszukaj w parku z wodą', xp: 80, radius: 5 },
  { id: 'egg-cat', emoji: '🐈', name: 'Kot na parapecie', hint: 'Ktoś wygrzewa się na dachu', xp: 80, radius: 5 },
  { id: 'egg-graffiti', emoji: '🎨', name: 'Graffiti „JARVIS”', hint: 'Ściana w bocznej uliczce', xp: 100, radius: 6 },
  { id: 'egg-golden', emoji: '🏆', name: 'Złota działka', hint: 'Jedna działka świeci złotem — kup ją', xp: 250, radius: 8 },
];
export const eggById = (id) => EASTER_EGGS.find((e) => e.id === id) || null;

/** Statyczne easter eggi (kaczka, kot, graffiti, złota działka) — pozycje z siatki miasta. */
export function staticEggs() {
  const parks = PLOTS.filter((p) => p.park);
  const duck = parks[1] || parks[0] || { x: -28, z: -28 };
  const cat = PLOTS.find((p) => p.park && Math.abs(p.x) === 28) || parks[2] || { x: 28, z: 28 };
  const golden = PLOTS.filter((p) => !p.park)[7] || PLOTS[0];
  return [
    { id: 'egg-duck', x: duck.x + 3.2, z: duck.z - 2.4, y: 0.45 },
    { id: 'egg-cat', x: cat.x - 4.4, z: cat.z + 3.1, y: 6.6 },
    { id: 'egg-graffiti', x: 22.5, z: -22.5, y: 2.2 },
    { id: 'egg-golden', x: golden.x, z: golden.z, y: 1.2 },
  ];
}

// 🎮 Gracz: postacie, fizyka, punkty odkrywania (POI), poziomy.
// Czyste funkcje + dane — testowane headless (test/player.test.mjs), bez three i bez DOM.
import { PLOTS } from '../data/city.js';

export const PLAYER_VERSION = 'player v1';

/** Postacie do wyboru — każda ma inny styl i inną „specialność" (wpływ na prędkość). */
export const CHARACTERS = [
  { id: 'maja', name: 'Maja', role: 'Menedżerka kampanii', blurb: 'Uwielbia mierzyć, co działa. Bonus: szybszy audyt AI.',
    speed: 1.0, xp: 0, palette: { skin: '#f2c7a5', hair: '#2b2118', shirt: '#0f7ea8', pants: '#26313d', shoe: '#e8eef4', accent: '#00E7FF' } },
  { id: 'tomek', name: 'Tomek', role: 'Inwestor', blurb: 'Kupuje działki, zanim zrobią się drogie. Bonus: +10% kredytów z najmu.',
    speed: 0.96, xp: 0, palette: { skin: '#e8b58a', hair: '#4a3524', shirt: '#1d3a2a', pants: '#1b232c', shoe: '#3a3a3a', accent: '#7CFF1E' } },
  { id: 'kasia', name: 'Kasia', role: 'Architektka', blurb: 'Widzi bryłę, zanim powstanie. Bonus: tańsze piętra.',
    speed: 1.02, xp: 0, palette: { skin: '#f6d3b3', hair: '#8b2f2f', shirt: '#f0e6d2', pants: '#3b4653', shoe: '#f2f2f2', accent: '#ffd166' } },
  { id: 'bartek', name: 'Bartek', role: 'Event manager', blurb: 'Zna każdego na mieście. Bonus: więcej ruchu przy budynku nocą.',
    speed: 1.06, xp: 0, palette: { skin: '#d8a071', hair: '#141414', shirt: '#4b2e83', pants: '#20262e', shoe: '#e5e5e5', accent: '#b98bff' } },
  { id: 'ola', name: 'Ola', role: 'Fotografka', blurb: 'Kadruje billboardy lepiej niż agencja. Bonus: szybsze wgrywanie zdjęć.',
    speed: 1.0, xp: 0, palette: { skin: '#f4cdb0', hair: '#c96a2b', shirt: '#d6417a', pants: '#2c2f38', shoe: '#ffffff', accent: '#ff6fae' } },
  { id: 'zenek', name: 'Zenek', role: 'Spacerowicz', blurb: 'Wszędzie był, wszystkich zna. Bonus: odkrywa punkty z większej odległości.',
    speed: 0.9, xp: 0, palette: { skin: '#e3b48d', hair: '#d9d9d9', shirt: '#8a6d3b', pants: '#3f4450', shoe: '#6b6b6b', accent: '#ff8a3d' } },
];

export const DEFAULT_CHAR = 'maja';
export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

/** Fizyka i poczucie ruchu — wartości dobrane pod „chodzenie jak w grze". */
export const PHYS = {
  walk: 5.6,          // m/s — zwykły spacer
  run: 9.2,           // m/s — bieg (Shift / przycisk RUN)
  accel: 14,          // jak szybko postać wchodzi w pełną prędkość
  jump: 6.2,          // impuls skoku (m/s w górę)
  gravity: 17,        // m/s² — ziemia przyciąga zdecydowanie
  eye: 2.05,          // wysokość kamery (third-person, za głową)
  camDist: 4.9,       // odległość kamery za postacią
  stepUp: 0.34,       // wysokość, na jaką postać wchodzi bez skoku
};

/** Symulacja skoku/upadku: zwraca nową wysokość i stan kontaktu z ziemią. */
export function stepVertical({ y = 0, vy = 0, grounded = true }, dt, jumpPressed = false) {
  let nvy = vy - PHYS.gravity * dt;
  let ny = y + nvy * dt;
  let ng = false;
  if (jumpPressed && grounded) { nvy = PHYS.jump; ny = y + nvy * dt; ng = false; }
  else if (ny <= 0) { ny = 0; nvy = 0; ng = true; }
  return { y: ny, vy: nvy, grounded: ng };
}

/** Rozpędzanie i wygaszanie prędkości poziomej (żeby ruch nie był „cyfrowy"). */
export function approach(current, target, dt, rate = PHYS.accel) {
  const d = target - current;
  const step = rate * dt;
  if (Math.abs(d) <= step) return target;
  return current + Math.sign(d) * step;
}

/** Kąt ciała: postać obraca się w stronę ruchu płynnie (nie skokowo o 90°). */
export function turnTo(currentYaw, targetYaw, dt, rate = 9) {
  let d = ((targetYaw - currentYaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  const step = rate * dt;
  if (Math.abs(d) <= step) return targetYaw;
  return currentYaw + Math.sign(d) * step;
}

// ── Punkty odkrywania (POI) ───────────────────────────────────────────────────
const QUAD = (x, z) => {
  const n = z > 14 ? 'Północ' : z < -14 ? 'Południe' : 'Centrum';
  const e = x > 14 ? 'Wschód' : x < -14 ? 'Zachód' : '';
  return e ? `${n}-${e}` : n;
};

/** POI budowane z siatki miasta: skwer w centrum, parki, laboratorium AI i dzielnice.
 *  Kolejność = priorytet: przy nachodzeniu na siebie wygrywa punkt ważniejszy dla zwiedzania. */
export function buildPois(plots = PLOTS) {
  const out = [{ id: 'plaza', name: 'Skwer Centralny', kind: 'plac', x: 0, z: 0, r: 7, xp: 60 }];

  const lab = plots.find((q) => q.park && Math.abs(q.x) <= 28 && Math.abs(q.z) <= 28) || plots.find((q) => q.park) || { x: 0, z: -28 };
  out.push({ id: 'ailab', name: 'AI LAB — siedziba agenta', kind: 'ai', x: lab.x, z: lab.z, r: 9, xp: 150 });
  out.push({ id: 'biznes', name: 'Dzielnica biznesowa', kind: 'dzielnica', x: 56, z: 56, r: 12, xp: 120 });
  out.push({ id: 'brama', name: 'Brama Zachodnia', kind: 'dzielnica', x: -56, z: 56, r: 12, xp: 120 });

  const parks = [];
  for (const p of plots.filter((q) => q.park)) {
    if (parks.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > 44)) parks.push(p);
  }
  const used = new Set(out.map((p) => p.name));
  parks.slice(0, 8).forEach((p, i) => {
    const base = `Park ${QUAD(p.x, p.z)}`;
    let name = base;
    let n = 1;
    while (used.has(name)) { n += 1; name = `${base} ${['', 'I', 'II', 'III'][n - 1] || n}`; }
    used.add(name);
    out.push({ id: `park-${p.id}`, name, kind: 'park', x: p.x, z: p.z, r: 8, xp: 80 + i * 10 });
  });

  // Nie mogą na siebie nachodzić: dwa punkty w jednym miejscu = podwójne XP za jedno wejście
  // i dwie tabliczki na raz. Zostawiamy pierwszy (kolejność = priorytet), resztę odsiewamy.
  const kept = [];
  for (const p of out) {
    if (kept.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > Math.max(q.r, p.r) + 3)) kept.push(p);
  }
  return kept;
}

export const POIS = buildPois();

/** Najbliższy POI oraz dystans do niego (HUD pokazuje „idź w stronę…"). */
export function nearestPoi(pois, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const p of pois) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return { poi: best, distance: bestD };
}

/** Nowo odkryte punkty (gdy gracz wejdzie w promień). Zero duplikatów. */
export function checkDiscoveries(discovered = [], x, z, pois = POIS) {
  const found = [];
  for (const p of pois) {
    if (discovered.includes(p.id)) continue;
    if (Math.hypot(p.x - x, p.z - z) <= p.r) found.push(p);
  }
  return found;
}

/** Postęp zwiedzania: 0–1 oraz ile punktów zostało. */
export function exploreProgress(discovered = [], pois = POIS) {
  const total = pois.length;
  const done = pois.filter((p) => discovered.includes(p.id)).length;
  return { done, total, ratio: total ? done / total : 0, left: total - done };
}

// ── Poziomy i XP ──────────────────────────────────────────────────────────────
const TITLES = ['Nowy w mieście', 'Bywalec', 'Znawca ulic', 'Miejski przewodnik', 'Kartograf miasta', 'Legenda miasta'];

export function levelOf(xp = 0) {
  const level = Math.min(TITLES.length, Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1);
  const floorXp = (level - 1) ** 2 * 120;
  const nextXp = level >= TITLES.length ? null : level ** 2 * 120;
  return {
    level, title: TITLES[level - 1],
    into: xp - floorXp,
    need: nextXp === null ? 0 : nextXp - floorXp,
    nextXp,
  };
}

/** Zapisz odkrycia i XP — zwraca nowy, spójny stan gracza.
 *  Idempotentne: punkt już odkryty nie daje drugi raz XP (zabezpieczenie przed podwójnym wywołaniem). */
export function applyDiscoveries(state, found) {
  const before = state.discovered || [];
  const fresh = found.filter((p) => !before.includes(p.id));
  const gained = fresh.reduce((s, p) => s + (p.xp || 0), 0);
  const discovered = [...new Set([...before, ...fresh.map((p) => p.id)])];
  const xp = (state.xp || 0) + gained;
  const prevLevel = levelOf(state.xp || 0).level;
  const after = levelOf(xp).level;
  return {
    discovered, xp, gained,
    levelUp: after > prevLevel ? after : 0,
    progress: exploreProgress(discovered),
  };
}

/** Zapis/wczytanie gracza (bezpieczne dla trybu prywatnego i SSR). */
export const PLAYER_LS_KEY = 'ac.player.v1';
export function loadPlayer(storage = globalThis.localStorage) {
  const empty = { charId: DEFAULT_CHAR, xp: 0, discovered: [], yaw: 0, plays: 0 };
  try {
    const raw = storage?.getItem(PLAYER_LS_KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw);
    return {
      charId: characterById(v?.charId).id,
      xp: Math.max(0, Number(v?.xp) || 0),
      discovered: Array.isArray(v?.discovered) ? v.discovered.filter((d) => POIS.some((p) => p.id === d)) : [],
      yaw: Number(v?.yaw) || 0,
      plays: Math.max(0, Number(v?.plays) || 0),
    };
  } catch { return empty; }
}
export function savePlayer(player, storage = globalThis.localStorage) {
  try { storage?.setItem(PLAYER_LS_KEY, JSON.stringify(player)); return true; } catch { return false; }
}

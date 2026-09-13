// Logika świata: kolizje, chodzenie, ruch NPC — CZYSTE funkcje. Testowane w test/logic.test.mjs.
import { CITY, ROADS, BLOCK_CENTERS, SIDEWALKS } from '../data/city.js';

export const WALK = {
  eye: 1.7,
  speed: 7.2,
  radius: 0.55,
  wrap: 86, // limit x/z — wychodzenie za krawędź mapy (miasto ma teraz ±84)
};

/** AABB budynku z marginesem promienia gracza. */
export function buildingBox(b, pad = 0) {
  return { minX: b.x - b.w / 2 - pad, maxX: b.x + b.w / 2 + pad, minZ: b.z - b.d / 2 - pad, maxZ: b.z + b.d / 2 + pad };
}

export function insideBox(x, z, box) {
  return x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
}

/** Czy punkt jest zajęty (budynek albo poza mapą)? */
export function isBlocked(x, z, buildings, radius = WALK.radius) {
  if (Math.abs(x) > WALK.wrap || Math.abs(z) > WALK.wrap) return true;
  for (const b of buildings) if (insideBox(x, z, buildingBox(b, radius))) return true;
  return false;
}

/**
 * Krok gracza z poślizgiem po ścianach (osobno testujemy X i Z — inaczej „wchodzi" w budynek po skosie).
 * Zwraca {x, z, blocked, moved}.
 */
export function stepPlayer(pos, dirX, dirZ, dt, buildings, speed = WALK.speed) {
  const len = Math.hypot(dirX, dirZ);
  let nx = pos.x;
  let nz = pos.z;
  let blocked = false;
  if (len > 0.001) {
    const sx = (dirX / len) * speed * dt;
    const sz = (dirZ / len) * speed * dt;
    if (!isBlocked(pos.x + sx, pos.z, buildings)) nx = pos.x + sx; else blocked = true;
    if (!isBlocked(nx, pos.z + sz, buildings)) nz = pos.z + sz; else blocked = true;
  }
  return { x: nx, z: nz, blocked, moved: Math.hypot(nx - pos.x, nz - pos.z) > 0.0005 };
}

/** Najbliższa wolna pozycja startowa dla gracza (żeby nie zrespawnować się w budynku). */
export function safeSpawn(buildings) {
  const candidates = [[0, 0], [0, 14], [14, 0], [-14, 0], [0, -14], [28, 28], [-28, -28]];
  for (const [x, z] of candidates) if (!isBlocked(x, z, buildings)) return { x, z };
  return { x: 0, z: 0 };
}

/* ---------- NPC: samochody ---------- */

/** Trasa samochodu po obwodnicy — pętla zamknięta, oba pasy w obrębie jezdni (±42 ±2).
 *  Zwraca pozycję + wektor kierunku (rotację liczy komponent renderujący). */
export function carTransform(t, lane = 0) {
  const R = CITY.ring;
  const o = lane === 0 ? 2 : -2;
  const minX = -R + o;
  const maxX = R + o;
  const minZ = -R + o;
  const maxZ = R + o;
  const w = maxX - minX;
  const h = maxZ - minZ;
  const side = 2 * (w + h);
  const u = ((t % 1) + 1) % 1;
  const s = u * side;
  if (lane === 0) {
    // kierunek zgodny z ruchem wskazówek zegara
    if (s < w) return { x: minX + s, z: minZ, dirX: 1, dirZ: 0, lane };
    if (s < w + h) return { x: maxX, z: minZ + (s - w), dirX: 0, dirZ: 1, lane };
    if (s < 2 * w + h) return { x: maxX - (s - w - h), z: maxZ, dirX: -1, dirZ: 0, lane };
    return { x: minX, z: maxZ - (s - 2 * w - h), dirX: 0, dirZ: -1, lane };
  }
  // przeciwny kierunek
  if (s < w) return { x: maxX - s, z: minZ, dirX: -1, dirZ: 0, lane };
  if (s < w + h) return { x: minX, z: minZ + (s - w), dirX: 0, dirZ: 1, lane };
  if (s < 2 * w + h) return { x: minX + (s - w - h), z: maxZ, dirX: 1, dirZ: 0, lane };
  return { x: maxX, z: maxZ - (s - 2 * w - h), dirX: 0, dirZ: -1, lane };
}

/* ---------- NPC: piesi ---------- */

/**
 * Pieszy krąży po chodniku wokół bloku (pas 8..10 od środka bloku). Czysto parametryczny —
 * ten sam wynik na kliencie i w teście; faza w [0,1) rozsuwa pieszych.
 */
export function pedestrianTransform(t, blockIndex = 0, phase = 0) {
  const i = ((blockIndex % 3) + 3) % 3;
  const j = ((Math.floor(blockIndex / 3) % 3) + 3) % 3;
  const bx = BLOCK_CENTERS[i];
  const bz = BLOCK_CENTERS[j];
  const r = CITY.block / 2 + 1; // 9 → środek pasa chodnika
  const side = 8 * r;
  const u = (((t + phase) % 1) + 1) % 1;
  const s = u * side;
  const dir = (dx, dz) => ({ dirX: dx, dirZ: dz });
  if (s < 2 * r) return { x: bx - r + s, z: bz - r, ...dir(1, 0) };
  if (s < 4 * r) return { x: bx + r, z: bz - r + (s - 2 * r), ...dir(0, 1) };
  if (s < 6 * r) return { x: bx + r - (s - 4 * r), z: bz + r, ...dir(-1, 0) };
  return { x: bx - r, z: bz + r - (s - 6 * r), ...dir(0, -1) };
}

/** Czy punkt leży na chodniku (pas wokół bloku)? */
export function isOnSidewalk(x, z) {
  return SIDEWALKS.some((s) => Math.abs(x - s.x) <= s.w / 2 && Math.abs(z - s.z) <= s.d / 2);
}

/* ---------- Pomocnicze ---------- */

/** Czy punkt leży na asfalcie? (dla podpowiedzi UI i podświetlenia kafla) */
export function isOnRoad(x, z) {
  const half = CITY.road / 2;
  return ROADS.some((r) => (r.axis === 'x' ? Math.abs(z - r.c) <= half : Math.abs(x - r.c) <= half));
}

/** Kamera miejska: pozycja orbitalna (sferyczna) wokół środka miasta. */
export function orbitPosition(target, yaw, pitch, distance) {
  const cp = Math.cos(pitch);
  return {
    x: target.x + distance * cp * Math.sin(yaw),
    y: target.y + distance * Math.sin(pitch),
    z: target.z + distance * cp * Math.cos(yaw),
  };
}

export function clampOrbit(pitch, distance) {
  return { pitch: Math.max(0.14, Math.min(1.34, pitch)), distance: Math.max(24, Math.min(240, distance)) };
}

/**
 * Kierunek fasady budynku: ZAWSZE wielokrotność 90°, więc kamienica stoi równolegle do siatki ulic.
 * (Wcześniej atan2 na skosach dawał 45° i budynki stały „krzywo” względem jezdni.)
 * Oś wybiera to odsunięcie działki od środka kwartału, które jest większe; przy remisie (działka
 * narożna) decyduje id — połowa kamienic frontem na wschód/zachód, połowa na północ/południe.
 */
export function facadeYaw(x, z, id = '') {
  const bx = Math.round(x / CITY.pitch) * CITY.pitch;
  const bz = Math.round(z / CITY.pitch) * CITY.pitch;
  const ax = x - bx;
  const az = z - bz;
  const digits = (String(id).match(/\d/g) || []).reduce((s, d) => s + Number(d), 0);
  const preferX = Math.abs(ax) > Math.abs(az) + 0.1
    || (Math.abs(Math.abs(ax) - Math.abs(az)) <= 0.1 && digits % 2 === 0);
  const yaw = preferX ? (ax >= 0 ? Math.PI / 2 : -Math.PI / 2) : (az >= 0 ? 0 : Math.PI);
  return Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
}

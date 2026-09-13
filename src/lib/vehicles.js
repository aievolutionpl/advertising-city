// 🚗 Samochody w mieście: zaparkowane pod budynkami + fizyka jazdy (czysta logika, bez three/DOM).
// Testy: test/vehicles.test.mjs — dzięki temu jazda daje się sprawdzić headless, bez przeglądarki.
import { PLOTS, CITY } from '../data/city.js';
import { facadeYaw } from './cityLogic.js';

const PS = CITY.plotSize ?? 10;

export const CAR_COLORS = ['#c0392b', '#1f6feb', '#e8b33c', '#2ecc71', '#8e44ad', '#ecf0f1', '#34495e', '#e67e22', '#00E7FF', '#7CFF1E'];

/** Parametry jazdy — w metrach i sekundach (maxSpeed 38 m/s ≈ 137 km/h, z NOS-em ~190 km/h). */
export const DRIVE = {
  accel: 15,
  brake: 26,
  reverse: 7,
  drag: 0.32,          // opór: speed *= (1 - drag*dt) — równowaga przy gazie ~47 m/s
  rollResist: 3.2,     // m/s² bez gazu
  steer: 2.1,          // rad/s przy pełnej prędkości… skaluje się z prędkością
  maxSpeed: 38,
  maxReverse: 9,
  boostMul: 1.45,
  boostMax: 55,
  radius: 1.6,         // do kolizji
};

const rnd = (n) => { const x = Math.sin(n * 91.13 + 47.7) * 43758.5453; return x - Math.floor(x); };

/** Zaparkowane auta: jedno pod każdym zbudowanym budynkiem, tuż przy elewacji frontowej. */
export function parkedCars(buildings = {}, plots = PLOTS) {
  const out = [];
  const ids = Object.keys(buildings);
  for (const pid of ids) {
    const b = buildings[pid];
    const plot = (b.x !== undefined && b.z !== undefined)
      ? { id: pid, x: b.x, z: b.z }
      : plots.find((p) => p.id === pid);
    if (!plot) continue;
    const yaw = facadeYaw(plot.x, plot.z, pid);
    const seed = ids.indexOf(pid) + 1;
    // na zewnątrz fasady, równolegle do ulicy — „pod budynkiem”
    const out_ = PS * 0.5 + 4.4;
    const side = rnd(seed) > 0.5 ? 1 : -1;
    const along = (rnd(seed + 7) - 0.5) * PS * 0.9;
    const sx = Math.cos(yaw) * out_ - Math.sin(yaw) * 0;
    const sz = -Math.sin(yaw) * out_ - Math.cos(yaw) * 0;
    out.push({
      id: `car-${pid}`,
      plotId: pid,
      x: +(plot.x + sx + Math.cos(yaw) * along).toFixed(2),
      z: +(plot.z + sz - Math.sin(yaw) * along).toFixed(2),
      yaw: +(yaw + (side > 0 ? 0 : Math.PI) + (rnd(seed + 3) - 0.5) * 0.25).toFixed(3),
      color: CAR_COLORS[Math.floor(rnd(seed + 11) * CAR_COLORS.length) % CAR_COLORS.length],
    });
  }
  return out;
}

/** Nowy stan jazdy z pozycji zaparkowanego auta. */
export function carStateFrom(car) {
  return { id: car.id, color: car.color, x: car.x, z: car.z, yaw: car.yaw, speed: 0, steer: 0, boost: 0, driving: true };
}

/** Fizyka jednej klatki. input: {throttle -1..1, steer -1..1, brake bool, boost bool} */
export function stepCar(s, input = {}, dt = 1 / 60) {
  const dtc = Math.min(0.05, Math.max(0, dt));
  const throttle = Math.max(-1, Math.min(1, input.throttle || 0));
  const steerIn = Math.max(-1, Math.min(1, input.steer || 0));
  const boost = !!input.boost && throttle > 0;

  let speed = s.speed;
  const maxF = boost ? DRIVE.boostMax : DRIVE.maxSpeed;

  if (input.brake) {
    speed -= Math.sign(speed) * DRIVE.brake * dtc;
    if (Math.abs(speed) < DRIVE.brake * dtc) speed = 0;
  } else if (throttle !== 0) {
    speed += (throttle > 0 ? DRIVE.accel : DRIVE.reverse) * throttle * dtc;
  } else {
    const drop = DRIVE.rollResist * dtc;
    speed = Math.abs(speed) <= drop ? 0 : speed - Math.sign(speed) * drop;
  }
  speed *= (1 - DRIVE.drag * dtc);
  if (speed > maxF) speed = maxF;
  if (speed < -DRIVE.maxReverse) speed = -DRIVE.maxReverse;

  // skręt tylko w ruchu i słabnie przy małej prędkości (zero kręcenia w miejscu)
  const grip = Math.min(1, Math.abs(speed) / 8);
  const steerRate = DRIVE.steer * grip * (speed < 0 ? -1 : 1);
  const yaw = s.yaw + steerIn * steerRate * dtc;

  const x = s.x + Math.sin(yaw) * speed * dtc;
  const z = s.z + Math.cos(yaw) * speed * dtc;

  return {
    ...s,
    x, z, yaw, speed,
    steer: steerIn,
    boost: boost ? 1 : Math.max(0, (s.boost || 0) - dtc * 1.6),
    driving: true,
  };
}

export function speedKmh(speed = 0) {
  return Math.round(Math.abs(speed) * 3.6);
}

/** Najbliższe auto w zasięgu ręki (do „wsiądź”) — id deterministyczne przy remisie. */
export function nearestCar(cars, x, z, maxDist = 3.6) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d <= bestD && (!best || d < bestD || c.id < best.id)) { best = c; bestD = d; }
  }
  return best;
}

/** Kolizja z bryłą budynku (prostokąt obrócony o yaw) — auto zatrzymuje się, nie przechodzi przez ścianę. */
export function blockedAt(x, z, boxes = []) {
  for (const b of boxes) {
    if (Math.hypot(x - b.x, z - b.z) > (b.r || 9)) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    const c = Math.cos(-b.yaw || 0);
    const s = Math.sin(-b.yaw || 0);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < b.w / 2 + DRIVE.radius && Math.abs(lz) < b.d / 2 + DRIVE.radius) return true;
  }
  return false;
}

/** Garaż: zjazd auta na bok (po wyjściu). */
export function parkState(s) {
  return { ...s, speed: 0, driving: false };
}

export const DRIVING_HINT = 'E — wsiądź do auta';

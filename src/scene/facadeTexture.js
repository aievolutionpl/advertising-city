// Realistyczne elewacje: siatka okien + osobna mapa emisyjna (nocą zapalają się okna).
// Wszystko proceduralnie (canvas → CanvasTexture), zero pobieranych plików, jeden materiał na budynek.
import * as THREE from 'three';

/** Warianty elewacji: piaskowiec, beton, cegła, szkło, tynk, grafit. */
export const VARIANTS = [
  { wall: '#d3cbbb', frame: '#b3ab9b', win: '#38495c', lit: '#ffd9a0' },
  { wall: '#bcbfc4', frame: '#a4a8ae', win: '#2b3947', lit: '#ffe0ad' },
  { wall: '#b07f63', frame: '#8d6350', win: '#2c3742', lit: '#ffd39a' },
  { wall: '#a9bcc7', frame: '#8fa3af', win: '#26333d', lit: '#ffe6bd' },
  { wall: '#ded3bd', frame: '#c2b7a1', win: '#3a4a5a', lit: '#ffdba6' },
  { wall: '#95979e', frame: '#7f8188', win: '#232f3b', lit: '#ffd79c' },
];

const K = 1024;      // szerokość kafelka (4 okna na piętro)
const H = 256;       // wysokość kafelka = jedno piętro

const registry = [];  // materiały elewacji — nocą wspólnie zapalają okna

function drawWall(v) {
  const c = document.createElement('canvas');
  c.width = K; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = v.wall; x.fillRect(0, 0, K, H);

  // delikatny szum tynku
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * K, Math.random() * H, 2, 2);
  }
  // poziomy pas stropu (cień między piętrami)
  x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(0, H - 18, K, 18);
  x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, 0, K, 6);

  const cell = K / 4;
  for (let i = 0; i < 4; i++) {
    const ox = i * cell;
    // gzyms nad oknem i pod nim
    x.fillStyle = v.frame;
    x.fillRect(ox + cell * 0.10, H * 0.16, cell * 0.80, H * 0.62);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(ox + cell * 0.10, H * 0.16, cell * 0.80, 5);
    // szyba + odbicie nieba
    x.fillStyle = v.win; x.fillRect(ox + cell * 0.15, H * 0.22, cell * 0.70, H * 0.50);
    const g = x.createLinearGradient(ox, H * 0.22, ox + cell, H * 0.72);
    g.addColorStop(0, 'rgba(255,255,255,0.30)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0.00)');
    x.fillStyle = g; x.fillRect(ox + cell * 0.15, H * 0.22, cell * 0.70, H * 0.50);
    // szpros (krzyżak)
    x.fillStyle = 'rgba(20,25,32,0.55)';
    x.fillRect(ox + cell * 0.49, H * 0.22, 3, H * 0.50);
    x.fillRect(ox + cell * 0.15, H * 0.46, cell * 0.70, 3);
  }
  return c;
}

function drawLit(v, seed) {
  const c = document.createElement('canvas');
  c.width = K; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, K, H);
  let s = seed || 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cell = K / 4;
  for (let i = 0; i < 4; i++) {
    const r = rnd();
    if (r < 0.38) continue;                       // okno ciemne
    const warm = r < 0.8 ? v.lit : '#cfe6ff';     // ciepłe światło / biurowe zimne
    x.fillStyle = warm;
    x.fillRect(i * cell + cell * 0.15, H * 0.22, cell * 0.70, H * 0.50);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(i * cell + cell * 0.49, H * 0.22, 3, H * 0.50);  // szpros w świetle
  }
  return c;
}

function tex(canvas, repeatX, repeatY, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const cache = new Map();

/**
 * Materiał elewacji budynku: siatka okien rozciągnięta na `floors` pięter.
 * `seed` daje różne okna w każdym budynku, `variant` różne kolory ścian.
 */
export function facadeMaterial({ variant = 0, floors = 3, width = 16, seed = 11 }) {
  const v = VARIANTS[variant % VARIANTS.length];
  const rx = Math.max(1, Math.round(width / 4.2));
  const ry = Math.max(1, Math.round(floors));
  const key = `${variant % VARIANTS.length}|${rx}|${ry}|${seed % 97}`;
  if (cache.has(key)) return cache.get(key);

  const wall = drawWall(v);
  const lit = drawLit(v, seed * 31 + variant);
  const m = new THREE.MeshStandardMaterial({
    map: tex(wall, rx, ry),
    emissiveMap: tex(lit, rx, ry),
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.03,
    metalness: 0.12,
    roughness: 0.72,
  });
  registry.push(m);
  cache.set(key, m);
  return m;
}

/** Świecąca witryna parteru (sklepy świecą wieczorem). */
export const shopWindowMaterial = new THREE.MeshStandardMaterial({
  color: '#dfeaf2', emissive: new THREE.Color('#ffd9a2'), emissiveIntensity: 0.05,
  metalness: 0.2, roughness: 0.18,
});
registry.push(shopWindowMaterial);

/** Noc: 0 → dzień (okna ciemne), 1 → pełne światło w oknach. */
export function applyFacadeNight(k) {
  const e = 0.03 + Math.max(0, Math.min(1, k)) * 1.35;
  for (const m of registry) m.emissiveIntensity = e;
}

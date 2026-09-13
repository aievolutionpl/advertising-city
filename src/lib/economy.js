// Ekonomia miasta — CZYSTE funkcje (bez three/react). Testowane w test/logic.test.mjs.

export const START_COINS = 60000;   // więcej na start: 3 działki + rozbudowa bez czekania

export const COSTS = {
  rentBase: 900,
  rentCore: 1600,
  buildBase: 1800,
  upgradeBase: 1100,
  upgradeFactor: 0.5,
  billboardSlot: 350,
};

export function rentCost(plot) {
  if (!plot) return Infinity;
  return plot.district === 'core' ? COSTS.rentCore : COSTS.rentBase;
}

export function buildCost(plot) {
  return COSTS.buildBase + (plot?.district === 'core' ? 700 : 0);
}

/** Pełna cena widoczna w UI i używana przez reducer. Jedno źródło prawdy zapobiega
 *  sytuacji, w której panel pokazuje inną kwotę niż faktycznie pobiera zakup. */
export function purchaseCost(plot, shapeId = 'tower') {
  const shape = SHAPES[shapeId] || SHAPES.tower;
  return Math.max(400, rentCost(plot) + buildCost(plot) + shape.extra);
}

export function upgradeCost(floors) {
  return Math.round(COSTS.upgradeBase + COSTS.upgradeFactor * COSTS.upgradeBase * floors);
}

export function billboardCost(floors) {
  return Math.round(COSTS.billboardSlot * Math.max(1, floors * 0.6));
}

/** Domyślna reklama — jedno źródło prawdy dla UI, sceny i seedów. */
export const DEFAULT_AD = {
  layout: 'brand', bg: '#0b1020', fg: '#ffffff', accent: '#00E7FF',
  title: 'TWOJA MARKA', subtitle: 'Dodaj logo, opis i link do swojej strony',
  cta: 'Zobacz stronę', url: '', image: '',
};
export function emptyAd() { return { ...DEFAULT_AD }; }

/** Nowy poziom budynku = koszt + wyższy billboard; max 6 pięter (YAGNI: dalej rośnie sam dochód). */
export const MAX_FLOORS = 6;
export const MIN_FLOORS = 1;

export function canAfford(state, cost) {
  return state.coins >= cost;
}

export function clampFloors(f) {
  return Math.max(MIN_FLOORS, Math.min(MAX_FLOORS, Math.round(f)));
}

/** Kształty budynków do wyboru przy budowie — gracz decyduje, co stawia na działce. */
export const SHAPES = {
  tower: { id: 'tower', label: 'wieżowiec', icon: '🏢', floors: 3, extra: 1400, w: 0.92, note: 'wysoki, najdroższy, najlepszy pod reklamę' },
  block: { id: 'block', label: 'blok', icon: '🏬', floors: 3, extra: 500, w: 1.0, note: 'szeroki, dużo witryn' },
  house: { id: 'house', label: 'kamienica', icon: '🏠', floors: 2, extra: 0, w: 0.86, note: 'tania, kameralna' },
  shop: { id: 'shop', label: 'sklep', icon: '🛍️', floors: 1, extra: -250, w: 0.8, note: 'parter handlowy, najtańszy' },
};

/** Czysty reducer: kupno działki + budowa. Zwraca {ok, state, error, spent}. */
export function purchasePlot(state, plot, shapeId = 'tower') {
  if (!plot) return { ok: false, state, error: 'Nie ma takiej działki.' };
  if (state.buildings[plot.id]) return { ok: false, state, error: 'Działka jest już zajęta.' };
  if (plot.park) return { ok: false, state, error: 'To teren zielony — nie można budować.' };
  const shape = SHAPES[shapeId] || SHAPES.tower;
  const cost = purchaseCost(plot, shapeId);
  if (!canAfford(state, cost)) return { ok: false, state, error: `Za mało środków (brakuje ${cost - state.coins}).` };
  const id = `u-${plot.id}`;
  const building = {
    id, plotId: plot.id, x: plot.x, z: plot.z, w: plot.w * shape.w, d: plot.d * shape.w,
    floors: shape.floors, style: shape.id === 'tower' ? 'tower' : 'shop', shape: shape.id,
    owner: 'player',
    ad: {
      layout: 'text', bg: '#0b1020', fg: '#ffffff', accent: '#00E7FF',
      title: 'TWOJA MARKA', subtitle: 'Kliknij „Edytuj reklamę", żeby wstawić logo i link', cta: 'twojadomena.pl', url: '',
    },
  };
  return {
    ok: true, spent: cost,
    state: {
      ...state,
      coins: state.coins - cost,
      buildings: { ...state.buildings, [plot.id]: building },
      log: [`Zbudowano budynek na działce ${plot.id} (−${cost} AC)`, ...(state.log || [])].slice(0, 40),
    },
  };
}

export function upgradeBuilding(state, plotId) {
  const b = state.buildings[plotId];
  if (!b) return { ok: false, state, error: 'Brak budynku na tej działce.' };
  if (b.owner !== 'player') return { ok: false, state, error: 'To budynek demo (house ad) — nie można go rozbudować.' };
  if (b.floors >= MAX_FLOORS) return { ok: false, state, error: `Maksymalna wysokość: ${MAX_FLOORS} pięter.` };
  const cost = upgradeCost(b.floors);
  if (!canAfford(state, cost)) return { ok: false, state, error: `Za mało środków (brakuje ${cost - state.coins}).` };
  return {
    ok: true, spent: cost,
    state: {
      ...state,
      coins: state.coins - cost,
      buildings: { ...state.buildings, [plotId]: { ...b, floors: b.floors + 1 } },
      log: [`Rozbudowa ${plotId} → ${b.floors + 1} pięter (−${cost} AC)`, ...(state.log || [])].slice(0, 40),
    },
  };
}

/** Edycja reklamy — walidacja URL i limitu znaków (twarde reguły, żeby nie było śmieci). */
export const AD_LIMITS = { title: 34, subtitle: 64, cta: 28 };

export function sanitizeAd(patch = {}) {
  const out = {};
  const clip = (s, n) => String(s ?? '').slice(0, n);
  if (patch.title !== undefined) out.title = clip(patch.title, AD_LIMITS.title);
  if (patch.subtitle !== undefined) out.subtitle = clip(patch.subtitle, AD_LIMITS.subtitle);
  if (patch.cta !== undefined) out.cta = clip(patch.cta, AD_LIMITS.cta);
  if (patch.bg !== undefined) out.bg = /^#[0-9a-fA-F]{6}$/.test(patch.bg) ? patch.bg : '#0b1020';
  if (patch.fg !== undefined) out.fg = /^#[0-9a-fA-F]{6}$/.test(patch.fg) ? patch.fg : '#ffffff';
  if (patch.accent !== undefined) out.accent = /^#[0-9a-fA-F]{6}$/.test(patch.accent) ? patch.accent : '#00E7FF';
  if (patch.layout !== undefined) out.layout = ['brand', 'text', 'image'].includes(patch.layout) ? patch.layout : 'brand';
  if (patch.image !== undefined) {
    // tylko data-URL obrazu, limit ~1.5 MB, żeby localStorage nie puchł
    const v = String(patch.image || '');
    out.image = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(v) && v.length < 2_000_000 ? v : '';
  }
  if (patch.url !== undefined) {
    const v = String(patch.url || '').trim();
    out.url = v === '' ? '' : (/^https?:\/\/[^\s<>"']+$/i.test(v) ? v : '');
  }
  if (patch.fontScale !== undefined) out.fontScale = Math.max(0.7, Math.min(1.6, Number(patch.fontScale) || 1));
  return out;
}

export function setAd(state, plotId, patch) {
  const b = state.buildings[plotId];
  if (!b) return { ok: false, state, error: 'Brak budynku.' };
  if (b.owner !== 'player') return { ok: false, state, error: 'Możesz edytować tylko reklamę na własnym budynku.' };
  const ad = { ...b.ad, ...sanitizeAd(patch) };
  return { ok: true, state: { ...state, buildings: { ...state.buildings, [plotId]: { ...b, ad } } } };
}

/** Ekonomia bierna: milisekundy → AC. 1 AC / 6 s = 10 AC/min (demo: bez czekania, ale i bez P2W). */
export const EARN_PER_MIN = 10;
export function accrue(coins, elapsedMs) {
  const earned = Math.floor((elapsedMs / 60000) * EARN_PER_MIN);
  return earned > 0 ? { coins: coins + earned, earned } : { coins, earned: 0 };
}

export function initialState(seedBuildings = [], plots = []) {
  const buildings = {};
  for (const s of seedBuildings) {
    const plot = plots.find((p) => p.id === s.plotId);
    if (!plot) continue; // odporność na literówkę w seedzie
    buildings[s.plotId] = { ...s, x: plot.x, z: plot.z, w: plot.w, d: plot.d };
  }
  return { coins: START_COINS, buildings, log: [], version: 1 };
}

/** Serializacja: pełny eksport stanu gracza (bez seedowych house-ads, żeby import był przenośny). */
export function serializePlayerState(state) {
  const buildings = Object.fromEntries(Object.entries(state.buildings).filter(([, b]) => b.owner === 'player'));
  return JSON.stringify({ v: 1, coins: state.coins, buildings }, null, 2);
}

export function deserializePlayerState(json, baseState) {
  let data;
  try { data = JSON.parse(json); } catch { return { ok: false, error: 'To nie jest poprawny JSON.' }; }
  if (!data || typeof data !== 'object' || data.v !== 1 || typeof data.buildings !== 'object') {
    return { ok: false, error: 'Nieznany format pliku (oczekuję v1 z polem buildings).' };
  }
  const buildings = { ...baseState.buildings };
  for (const [plotId, b] of Object.entries(data.buildings)) {
    if (!b || typeof b !== 'object' || b.owner !== 'player') continue;
    buildings[plotId] = { ...b, floors: clampFloors(b.floors || 2), ad: { ...(b.ad || {}) } };
  }
  return { ok: true, state: { ...baseState, coins: Math.max(0, Math.floor(data.coins ?? baseState.coins)), buildings } };
}

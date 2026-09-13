// Store miasta (zustand) + persist do localStorage. Logika ekonomiczna żyje w lib/economy.js (czysta).
import { create } from 'zustand';
import { PLOTS, SEED_BUILDINGS, plotById } from './data/city.js';
import { initialState, purchasePlot, upgradeBuilding, setAd, accrue,
  serializePlayerState, deserializePlayerState, SHAPES,
} from './lib/economy.js';
import { dayRuntime, setRuntimeHours, setRuntimeSpeed } from './scene/dayRuntime.js';
import { loadPlayer, savePlayer, characterById } from './lib/player.js';

const LS_KEY = 'advertising-city.v1';
const PLAYER_LS = 'ac.player.v1';

function loadPersisted() {
  const base = initialState(SEED_BUILDINGS, PLOTS);
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    if (!raw) return base;
    const res = deserializePlayerState(raw, base);
    return res.ok ? res.state : base;
  } catch {
    return base;
  }
}

export const useCity = create((set, get) => ({
  /* ── GRACZ: postać, pozycja, XP, odkryte punkty ── */
  charId: loadPlayer().charId,
  player: (() => { const p = loadPlayer(); return { x: 0, z: 0, y: 0, yaw: 0, xp: p.xp, discovered: p.discovered, nearest: null, speed: 0, running: false, grounded: true }; })(),
  setChar: (charId) => {
    const p = loadPlayer();
    savePlayer({ ...p, charId });
    set({ charId });
  },
  setPlayerState: (patchObj) => set((s) => {
    const player = { ...s.player, ...patchObj };
    const st = get();
    if (st.started && patchObj.xp !== undefined) {
      if (!st.__save || Date.now() - st.__save > 4000) {
        savePlayer({ charId: s.charId, xp: player.xp, discovered: player.discovered, x: player.x, z: player.z, yaw: player.yaw });
        return { player, __save: Date.now() };
      }
    }
    return { player };
  }),
  discoverPoi: (id, xp) => set((s) => {
    const discovered = s.player.discovered.includes(id) ? s.player.discovered : [...s.player.discovered, id];
    const out = { player: { ...s.player, xp: s.player.xp + (xp || 0), discovered } };
    savePlayer({ charId: s.charId, xp: out.player.xp, discovered, x: s.player.x, z: s.player.z, yaw: s.player.yaw });
    return out;
  }),
  resetPlayerProgress: () => {
    savePlayer({ charId: get().charId, xp: 0, discovered: [], x: 0, z: 0, yaw: 0 });
    set((s) => ({ player: { ...s.player, xp: 0, discovered: [], nearest: null } }));
  },

  ...loadPersisted(),
  started: false,
  mode: 'iso',             // 'iso' = izometria, 'top' = z góry, 'walk' = first-person
  clock: dayRuntime.day.clock,   // zegar doby widoczny w HUD
  timeSpeed: dayRuntime.speed,   // 'pause' | 'real' | 'fast' | 'epic'
  selected: null,          // plotId zaznaczonego budynku
  toast: null,
  lastTick: Date.now(),

  enter: () => set({ started: true }),
  setMode: (mode) => set({ mode }),
  setClock: (clock) => set({ clock }),
  setTimeSpeed: (speed) => { setRuntimeSpeed(speed); set({ timeSpeed: speed }); },
  setHours: (h) => { setRuntimeHours(h); set({ clock: dayRuntime.day.clock }); },
  select: (plotId) => set({ selected: plotId }),
  /* ── AUTO: stan jazdy dla HUD (aktualizowany z klatki, ~7×/s) ── */
  drive: { on: false, kmh: 0, near: null, car: null, color: null, boost: false },
  /* tryb grafiki: 'auto' = wykrywanie, 'light' = bez cieni, dpr 1 (słabsze GPU) */
  perf: (() => { try { return localStorage.getItem('ac.perf.v1') || 'auto'; } catch { return 'auto'; } })(),
  setPerf: (perf) => set({ perf }),
  setDrive: (patchObj) => set((s) => ({ drive: { ...s.drive, ...patchObj } })),
  /* ── kształt budynku wybierany przy budowie ── */
  buildShape: 'tower',
  setBuildShape: (buildShape) => set({ buildShape }),
  /* ── dzień/noc: ręczne sterowanie dobą (przycisk w HUD) ── */
  dayOverride: null,
  setDayOverride: (h) => {
    const hour = h === null ? null : h;
    if (hour !== null) setRuntimeHours(hour);
    set({ dayOverride: hour, clock: dayRuntime.day.clock });
  },
  toastMsg: (toast) => set({ toast }),

  buy: (plotId) => {
    const shape = get().buildShape;
    const res = purchasePlot(get(), plotById(plotId), shape);
    if (!res.ok) return set({ toast: res.error });
    set({ ...res.state, selected: plotId, toast: `🏗️ ${SHAPES[shape]?.label || 'Budynek'} gotowy · −${res.spent} AC · saldo ${res.state.coins} AC` });
    get().persist();
  },
  upgrade: (plotId) => {
    const res = upgradeBuilding(get(), plotId);
    if (!res.ok) return set({ toast: res.error });
    const floors = res.state.buildings[plotId]?.floors;
    set({ ...res.state, toast: `⬆️ Rozbudowano do ${floors} pięter · −${res.spent} AC · saldo ${res.state.coins} AC` });
    get().persist();
  },
  updateAd: (plotId, patch) => {
    const res = setAd(get(), plotId, patch);
    if (!res.ok) return set({ toast: res.error });
    set({ ...res.state, toast: 'Reklama zaktualizowana' });
    get().persist();
  },
  exportJson: () => serializePlayerState(get()),
  importJson: (json) => {
    const res = deserializePlayerState(json, initialState(SEED_BUILDINGS, PLOTS));
    if (!res.ok) return set({ toast: res.error });
    set({ ...res.state, toast: 'Projekt wczytany' });
    get().persist();
  },
  resetCity: () => {
    const base = initialState(SEED_BUILDINGS, PLOTS);
    set({ ...base, selected: null, toast: 'Miasto zresetowane (demo)' });
    get().persist();
  },
  tick: () => {
    const now = Date.now();
    const elapsed = now - (get().lastTick || now);
    if (elapsed < 5000) return;
    const { coins, earned } = accrue(get().coins, elapsed);
    set({ coins, lastTick: now, ...(earned ? { lastEarned: earned } : {}) });
    get().persist();
  },
  persist: () => {
    try { globalThis.localStorage?.setItem(LS_KEY, serializePlayerState(get())); } catch { /* brak miejsca — ignoruj */ }
  },
}));

// hook testowy dla E2E (headless browser mierzy stan, a nie tylko „canvas istnieje")
if (typeof window !== 'undefined') {
  window.__city = useCity;
}

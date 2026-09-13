// 🛡️ Zabezpieczenie sceny 3D dla SŁABYCH urządzeń (tablet/telefon).
// Zasady (nauczka z tabletu Chrisa — „mapa się nie ładuje”):
//  1. Nic nie zasłania miasta: karta błędu jest TYLKO na prawdziwe zdarzenie (utrata kontekstu WebGL).
//  2. „Wolno się wczytuje” ≠ błąd. Ładowanie to mała pigułka, nie pełnoekranowa zasłona.
//  3. Zanim pokażemy błąd, próbujemy sami: tryb lekki + auto-odświeżenie (raz na sesję).
//  4. Zawsze widoczny licznik FPS/mocy grafiki — user może zgłosić, co dokładnie widzi.
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useCity } from '../store.js';

const PERF_KEY = 'ac.perf.v1';
const TRIED_KEY = 'ac.perf.autoTried';

export function readPerf() {
  try {
    return localStorage.getItem(PERF_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

function writePerf(p) {
  try { localStorage.setItem(PERF_KEY, p); } catch { /* brak localStorage = ignoruj */ }
}

function sessionGet(k) {
  try { return sessionStorage.getItem(k); } catch { return null; }
}

function sessionSet(k, v) {
  try { sessionStorage.setItem(k, v); } catch { /* ignoruj */ }
}

/** Wewnątrz Canvas: liczy klatki, mierzy FPS, w trybie lekkim gasi cienie i zbija rozdzielczość. */
export function FrameBeacon({ lowPower = false }) {
  const { gl, scene, camera } = useThree();
  const perf = useCity((s) => s.perf);
  const setPerf = useCity((s) => s.setPerf);
  const acc = useRef({ n: 0, t: 0, measured: false, warned: false });

  useFrame((_, dt) => {
    const w = window;
    w.__frames = (w.__frames || 0) + 1;
    if (!w.__firstFrame) w.__firstFrame = performance.now();
    const a = acc.current;
    if (!a.measured) {
      a.n += 1;
      a.t += dt;
      if (a.t > 3.0) {
        a.measured = true;
        const fps = a.n / a.t;
        w.__perf = { fps: +fps.toFixed(1), perf: useCity.getState().perf, lowPower };
        // tablet/telefon lub słaby wynik → tryb lekki (bez cieni, mniejsza rozdzielczość)
        if ((fps < 45 || lowPower) && useCity.getState().perf !== 'light') {
          setPerf('light');
          if (!a.warned) {
            a.warned = true;
            if (typeof w.__toast === 'function') w.__toast('🧊 Tryb lekki: płynniejsze miasto na tym sprzęcie');
          }
        }
      }
    }
  });

  useEffect(() => {
    const light = perf === 'light' || lowPower;
    gl.shadowMap.enabled = !light;
    gl.setPixelRatio(light ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    scene.traverse((o) => {
      if (!o.isLight) return;
      o.castShadow = !light;
      // Światła punktowe = pętla w shaderze (NUM_POINT_LIGHTS). Na słabym GPU to największy
      // koszt i częsta przyczyna „pustej” sceny — w trybie lekkim gasimy je całkowicie.
      if (o.isPointLight || o.isSpotLight) o.visible = !light;
    });
    return () => {
      gl.shadowMap.enabled = true;
      scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) o.visible = true; });
    };
  }, [perf, lowPower, gl, scene]);

  /* Kontrola, czy scena NAPRAWDĘ się rysuje (nie tylko „canvas istnieje”). */
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const g = window.__cityThree && window.__cityThree.gl ? window.__cityThree.gl : gl;
        window.__render = {
          programs: g.info.programs ? g.info.programs.length : -1,
          geometries: g.info.memory.geometries,
          calls: g.info.render.calls,
          triangles: g.info.render.triangles,
        };
        window.__renderOk = g.info.memory.geometries > 0;
      } catch (e) { window.__renderOk = null; }
    }, 1500);
    return () => clearInterval(id);
  }, [gl]);

  /* Diagnostyka dla usera i agenta: window.__threeInfo() (obiekty, kamera, dpr, cienie, WebGL). */
  useEffect(() => {
    try {
      window.__cityThree = { gl, scene, camera };
      try { window.__webglVersion = gl.getContext().getParameter(gl.getContext().VERSION); } catch (e) { /* zostaw poprzednią */ }
      window.__threeInfo = () => ({
        objects: scene.children.length,
        camera: [+camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1)],
        shadows: gl.shadowMap.enabled,
        dpr: gl.getPixelRatio(),
        webgl: (() => { try { return gl.getContext().getParameter(gl.getContext().VERSION); } catch { return window.__webglVersion || '?'; } })(),
      });
    } catch (e) { /* diagnostyka nie może nigdy wywalić gry */ }
  }, [gl, scene, camera]);

  return null;
}

/** Poza Canvas: pigułka „wczytuję”, karta błędu TYLKO przy realnej utracie grafiki. */
export function SceneGate() {
  const [state, setState] = useState('idle'); // idle | slow | lost
  const setPerf = useCity((s) => s.setPerf);
  const perf = useCity((s) => s.perf);
  const started = useCity((s) => s.started ?? true);

  useEffect(() => {
    if (!started) return;
    const t0 = Date.now();
    const canvas = document.querySelector('canvas');
    const onLost = (e) => { if (e && e.preventDefault) e.preventDefault(); setState('lost'); };
    const onRestored = () => setState('idle');
    canvas && canvas.addEventListener('webglcontextlost', onLost, false);
    canvas && canvas.addEventListener('webglcontextrestored', onRestored, false);

    let prev = 0;
    const id = setInterval(() => {
      const f = window.__frames || 0;
      const grew = f > prev;
      prev = f;
      if (grew) { setState((s) => (s === 'lost' ? s : 'idle')); return; }
      const noFrames = !window.__firstFrame;
      if (noFrames && Date.now() - t0 > 4000) {
        // wolne wczytywanie: pokazujemy pigułkę, ale NIE zasłaniamy miasta
        setState((s) => (s === 'lost' ? s : 'slow'));
        if (Date.now() - t0 > 14000 && !sessionGet(TRIED_KEY) && window.__renderOk === false) {
          // jedna automatyczna próba ratunkowa: tryb lekki + odświeżenie
          // (WYŁĄCZNIE gdy scena naprawdę nic nie narysowała — inaczej ryzyko pętli przeładowań)
          sessionSet(TRIED_KEY, '1');
          writePerf('light');
          setPerf('light');
          window.location.reload();
        }
      }
    }, 1000);

    return () => {
      clearInterval(id);
      canvas && canvas.removeEventListener('webglcontextlost', onLost);
      canvas && canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [started, setPerf]);

  if (!started) return null;

  const retry = () => {
    // najpierw spróbuj ożywić kontekst bez przeładowania strony
    try {
      const gl = window.__cityThree && window.__cityThree.gl;
      const ext = gl && gl.getContext().getExtension('WEBGL_lose_context');
      if (ext && ext.restoreContext) ext.restoreContext();
    } catch (e) { /* jeżeli się nie uda — pełne odświeżenie */ }
    setPerf(perf === 'light' ? 'light' : 'light');
    setTimeout(() => window.location.reload(), 700);
  };
  const goLight = () => { writePerf('light'); setPerf('light'); window.location.reload(); };
  const info = () => {
    const t = window.__threeInfo ? window.__threeInfo() : {};
    const p = window.__perf || {};
    const wv = t.webgl && t.webgl !== '?' ? t.webgl : (window.__webglVersion || '?');
    const r = window.__render || {};
    return `FPS ${p.fps || '?'} · tryb ${perf === 'light' ? 'lekki' : 'pełny'} · dpr ${t.dpr || '?'} · WebGL ${wv} · render ${window.__renderOk ? 'OK' : 'BRAK'} (oby ${r.geometries ?? '?'}/sh ${r.programs ?? '?'}/trój ${r.triangles ?? '?'})`;
  };

  if (state === 'idle') return null;

  if (state === 'slow') {
    return (
      <div className="scene-gate is-soft">
        <div className="sg-pill">
          <span className="sg-spin" />
          <b>⏳ Wczytuję miasto…</b>
          <i>pierwsze uruchomienie na tablecie trwa chwilę</i>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-gate">
      <div className="sg-card sg-alert">
        <b>⚠️ Grafika 3D się zresetowała</b>
        <span>Tablet/telefon zgubił kontekst grafiki (za mało pamięci albo karta nie wyrabia). Kliknij, żeby wczytać miasto ponownie w trybie lekkim.</span>
        <code>{info()}</code>
        <div className="sg-actions">
          <button className="btn primary" onClick={retry}>🔄 Wczytaj ponownie</button>
          <button className="btn" onClick={goLight}>🧊 Tryb lekki (bez cieni)</button>
        </div>
      </div>
    </div>
  );
}

/** Mała plakietka FPS / trybu grafiki — klikalna (przełącza tryb lekki) + kontrola renderu. */
export function PerfBadge() {
  const [t, setT] = useState({ fps: 0, mode: 'auto', render: null });
  const perf = useCity((s) => s.perf);
  const setPerf = useCity((s) => s.setPerf);
  const started = useCity((s) => s.started ?? true);

  useEffect(() => {
    const id = setInterval(() => {
      const p = window.__perf;
      setT({ fps: (p && p.fps) || 0, mode: perf, render: window.__renderOk });
    }, 1500);
    return () => clearInterval(id);
  }, [perf]);

  if (!started) return null;
  const light = perf === 'light';
  const broken = t.render === false; // scena nie narysowała ani jednego obiektu
  if (!t.fps && !broken) return null;
  return (
    <button
      className={`perf-badge ${light ? 'is-light' : ''} ${broken ? 'is-broken' : ''}`}
      title={broken
        ? 'Scena nic nie rysuje — kliknij, żeby przełączyć grafikę'
        : (light ? 'Tryb lekki (bez cieni) — kliknij, by wrócić do pełnej grafiki' : 'Pełna grafika — kliknij, by włączyć tryb lekki')}
      onClick={() => { writePerf(light ? 'auto' : 'light'); setPerf(light ? 'auto' : 'light'); }}
    >
      {broken ? '⚠️ brak renderu — kliknij' : `${Math.round(t.fps)} FPS · ${light ? '🧊 lekka' : '✨ pełna'}`}
    </button>
  );
}

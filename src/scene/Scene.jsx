// Scena: niebo (gradient golden hour), światła, kamera hybrydowa (izometria ↔ pierwsza osoba).
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CITY } from '../data/city.js';
import { useCity } from '../store.js';
import { stepPlayer, safeSpawn, orbitPosition, clampOrbit, buildingBox, WALK } from '../lib/cityLogic.js';
import { input, setKey, movementVector, consumeLook, resetInput } from './input.js';
import { playerRuntime } from './playerRuntime.js';
import { debugState } from './debug.js';
import { skyMaterial, applyDay, glassMaterial, lampMaterial } from './materials.js';
import { applyFacadeNight } from './facadeTexture.js';
import { propsNightTick } from './Props.jsx';
import { dayRuntime, tickRuntime } from './dayRuntime.js';

/* ---------- NIEBO ---------- */
export function Sky() {
  return (
    <mesh material={skyMaterial} frustumCulled={false}>
      <sphereGeometry args={[420, 32, 20]} />
    </mesh>
  );
}

/* ---------- ŚWIATŁA (sterowane zegarem doby) ---------- */
export function Lights() {
  const sun = useRef();
  const hemi = useRef();
  const amb = useRef();
  const scene = useThree((s) => s.scene);
  const shadowSize = typeof window !== 'undefined' && window.innerWidth <= 820 ? 1024 : 2048;

  useFrame(() => {
    const d = dayRuntime.day;
    if (sun.current) {
      sun.current.position.set(d.sunDir[0] * 150, Math.max(10, d.sunDir[1] * 150), d.sunDir[2] * 150);
      sun.current.intensity = d.sunI;
      sun.current.color.set(d.sun);
    }
    if (hemi.current) hemi.current.intensity = d.hemiI;
    if (amb.current) amb.current.intensity = d.ambI;
    if (scene.fog) {
      scene.fog.color.set(d.fog);
      scene.fog.near = d.fogNear;
      scene.fog.far = d.fogFar;
    }
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#ffd9a8', '#3d5a2c', 0.72]} />
      <ambientLight ref={amb} intensity={0.3} />
      <directionalLight
        ref={sun}
        position={[62, 74, -84]}
        intensity={2.7}
        color="#fffdf5"
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={20}
        shadow-camera-far={420}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-bias={-0.00035}
        shadow-normalBias={0.035}
        shadow-radius={2}
      />
      <fog attach="fog" args={['#dde6ee', 130, 340]} />
    </group>
  );
}

/* ---------- ZEGAR DOBY ---------- */
/** Jedyny driver czasu: postęp doby + wpisanie stanu w materiały. Zegar do HUD max ~2,5×/s. */
export function DayDriver() {
  const setClock = useCity((s) => s.setClock);
  const { scene, gl } = useThree();
  const acc = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__cityScene = () => {
      const named = [];
      scene.traverse((o) => {
        if (o.name) named.push({ name: o.name, type: o.type, visible: o.visible, count: o.count ?? null });
      });
      return {
        named,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        objects: scene.children.length,
      };
    };
    return () => { delete window.__cityScene; };
  }, [scene, gl]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const rolled = tickRuntime(dt);
    applyDay(dayRuntime.day);
    applyFacadeNight(dayRuntime.day.win);
    propsNightTick();
    acc.current += dt;
    if (rolled && acc.current > 0.4) {
      acc.current = 0;
      setClock(dayRuntime.day.clock);
    }
    const d = dayRuntime.day;
    debugState.day = {
      hours: +d.hours.toFixed(2), clock: d.clock, sunI: +d.sunI.toFixed(2),
      ambI: +d.ambI.toFixed(2), night: +d.night.toFixed(2), lamps: +d.lamps.toFixed(2),
      win: +d.win.toFixed(2), fog: d.fog, skyTop: d.skyTop, sunDir: d.sunDir.map((v) => +v.toFixed(2)),
      glassEmissive: +glassMaterial.emissiveIntensity.toFixed(2),
      lampColor: +lampMaterial.color.r.toFixed(2),
    };
  });
  return null;
}

/* ---------- KAMERA ---------- */
/** Widoki kamery miejskiej — jedno miejsce prawdy dla klawiszy, HUD i animacji przejścia. */
export const VIEWS = {
  iso: { pitch: 0.60, distance: 120, fov: 44, spin: 0.030, label: 'Panorama' },
  kino: { pitch: 0.30, distance: 84, fov: 38, spin: 0.055, label: 'Kino' },
  top: { pitch: 1.30, distance: 196, fov: 34, spin: 0.008, label: 'Plan miasta' },
};
export const CITY_MODES = ['iso', 'kino', 'top'];
const isCityMode = (m) => CITY_MODES.includes(m);

export function CameraRig() {
  const { camera, gl } = useThree();
  const mode = useCity((s) => s.mode);
  const setMode = useCity((s) => s.setMode);
  const buildingsRef = useRef({ list: [], sig: '' });
  const buildings = useCity((s) => s.buildings);
  const selected = useCity((s) => s.selected);
  const orbit = useRef({ yaw: 0.62, pitch: 0.72, distance: 96, x: 0, y: 0, z: 0, init: false });
  const player = useRef({ x: 0, z: 0, yaw: 0.6, pitch: -0.05 });

  const list = useMemo(() => Object.values(buildings).map((b) => ({
    x: b.x, z: b.z, w: b.w ?? CITY.plotSize, d: b.d ?? CITY.plotSize,
  })), [buildings]);
  const sig = list.map((b) => `${b.x},${b.z},${b.w}`).join('|');
  if (sig !== buildingsRef.current.sig) buildingsRef.current = { list, sig };
  if (!orbit.current.init) {
    const sp = safeSpawn(buildingsRef.current.list);
    player.current.x = sp.x;
    player.current.z = sp.z;
    orbit.current.init = true;
  }

  /* klawiatura + pointer lock */
  useEffect(() => {
    const down = (e) => {
      const st = useCity.getState();
      if (e.code === 'KeyP') { setMode(st.mode === 'walk' ? 'iso' : 'walk'); return; }
      if (e.code === 'Digit1') { setMode('iso'); return; }
      if (e.code === 'Digit2') { setMode('kino'); return; }
      if (e.code === 'Digit3') { setMode('top'); return; }
      if (e.code === 'Digit4') { setMode('walk'); return; }
      if (e.code === 'Escape' && st.mode === 'walk') { setMode('iso'); return; }
      setKey(e.code, true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    const up = (e) => setKey(e.code, false);
    const blur = () => resetInput();
    const move = (e) => {
      if (useCity.getState().mode !== 'walk') return;
      const locked = document.pointerLockElement === gl.domElement;
      if (!locked && e.buttons === 0) return;
      input.look.dx += e.movementX || 0;
      input.look.dy += e.movementY || 0;
    };
    const wheel = (e) => {
      if (!isCityMode(useCity.getState().mode)) return;
      const o = orbit.current;
      o.distance = clampOrbit(o.pitch, o.distance + Math.sign(e.deltaY) * 7).distance;
      o.freeUntil = performance.now() + 2500; // ręczny zoom wygrywa z animacją widoku
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('mousemove', move);
    window.addEventListener('wheel', wheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('wheel', wheel);
    };
  }, [gl, setMode]);

  /* wyjście ze spaceru = wyczyść wciśnięte klawisze, żeby gracz nie „jechał" dalej */
  useEffect(() => { if (mode !== 'walk') resetInput(); }, [mode]);

  /* przeciąganie myszą = obrót kamery miejskiej; klik bez ruchu = wybór budynku */
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let moved = 0;
    let last = null;
    const down = (e) => {
      if (!isCityMode(useCity.getState().mode)) {
        if (document.pointerLockElement !== el) el.requestPointerLock?.();
        return;
      }
      dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY };
    };
    const move = (e) => {
      if (!dragging) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      moved += Math.abs(dx) + Math.abs(dy);
      orbit.current.yaw -= dx * 0.006;
      const c = clampOrbit(orbit.current.pitch + dy * 0.004, orbit.current.distance);
      orbit.current.pitch = c.pitch;
      orbit.current.pitchFreeUntil = performance.now() + 2500;
    };
    const up = () => { dragging = false; };
    // --- MOBILE: jeden palec = obrót kamery, dwa palce = pinch-zoom (perspektywa „pod palcem”) ---
    let pinch = 0;
    const tstart = (e) => {
      const st = useCity.getState().mode;
      if (st === 'walk') {                    // spacer: przeciągnięcie palcem = rozglądanie
        if (e.touches.length === 1) { dragging = true; moved = 0; last = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
        return;
      }
      if (!isCityMode(st)) return;
      if (e.touches.length === 1) {
        dragging = true; moved = 0; last = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        dragging = false;
        pinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    };
    const tmove = (e) => {
      const st = useCity.getState().mode;
      if (st === 'walk') {                    // spacer na mobile: drag = look (jak mysz)
        if (e.touches.length === 1 && dragging) {
          const t = e.touches[0];
          input.look.dx += t.clientX - last.x;
          input.look.dy += t.clientY - last.y;
          last = { x: t.clientX, y: t.clientY };
          e.preventDefault();
        }
        return;
      }
      if (!isCityMode(st)) return;
      if (e.touches.length === 2 && pinch) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const o = orbit.current;
        o.distance = clampOrbit(o.pitch, o.distance - (d - pinch) * 0.35).distance;
        o.freeUntil = performance.now() + 2500;
        pinch = d;
        e.preventDefault();
      } else if (e.touches.length === 1 && dragging) {
        const t = e.touches[0];
        const dx = t.clientX - last.x;
        const dy = t.clientY - last.y;
        last = { x: t.clientX, y: t.clientY };
        moved += Math.abs(dx) + Math.abs(dy);
        orbit.current.yaw -= dx * 0.008;
        const c = clampOrbit(orbit.current.pitch + dy * 0.006, orbit.current.distance);
        orbit.current.pitch = c.pitch;
        orbit.current.pitchFreeUntil = performance.now() + 2500;
        e.preventDefault();
      }
    };
    const tend = () => { dragging = false; pinch = 0; };
    el.addEventListener('touchstart', tstart, { passive: false });
    el.addEventListener('touchmove', tmove, { passive: false });
    el.addEventListener('touchend', tend);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('touchstart', tstart);
      el.removeEventListener('touchmove', tmove);
      el.removeEventListener('touchend', tend);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    debugState.player.mode = mode;
    if (mode === 'walk') {
      // Postać gracza ma własną fizykę (scene/Player.jsx) — tutaj kamera jedzie jej za plecami (third person).
      const pr = playerRuntime;
      const sinY = Math.sin(pr.yaw);
      const cosY = Math.cos(pr.yaw);
      const dist = (pr.running ? 5.35 : 4.75) * (window.innerWidth < 820 ? 0.92 : 1);
      const cp = Math.cos(pr.pitch);
      const horizontal = Math.max(3.5, dist * cp);
      const height = Math.max(1.48, 2.18 + Math.sin(pr.pitch) * 2.25);
      const targetX = pr.x - sinY * horizontal;
      const targetY = pr.y + height;
      const targetZ = pr.z - cosY * horizontal;
      // Tłumienie niezależne od FPS usuwa drżenie przy nierównej liczbie klatek.
      const follow = 1 - Math.exp(-dt * 15);
      camera.position.x += (targetX - camera.position.x) * follow;
      camera.position.y += (targetY - camera.position.y) * follow;
      camera.position.z += (targetZ - camera.position.z) * follow;
      camera.lookAt(pr.x + sinY * 3.2, pr.y + 1.58 + Math.sin(pr.pitch) * 2.25, pr.z + cosY * 3.2);
      debugState.player.x = pr.x;
      debugState.player.z = pr.z;
      debugState.player.yaw = pr.yaw;
      state.camera.fov = pr.running ? 78 : 72;
      state.camera.updateProjectionMatrix();
    } else {
      // Widok miejski: izometria ↔ z góry. Przejście jest animowane (płynna zmiana perspektywy),
      // a ręczny zoom/obrót gracza ma priorytet przez 2,5 s (freeUntil).
      const view = VIEWS[mode] ?? VIEWS.iso;
      const sel = selected ? buildings[selected] : null;
      const target = sel ? { x: sel.x, y: 4, z: sel.z } : { x: 0, y: 3, z: 0 };
      const o = orbit.current;
      const now = performance.now();
      const follow = Math.min(1, dt * 3);
      o.x += (target.x - o.x) * follow;
      o.y += (target.y - o.y) * follow;
      o.z += (target.z - o.z) * follow;
      const soft = Math.min(1, dt * 2.4);
      if (now > (o.freeUntil ?? 0)) o.distance += (view.distance - o.distance) * soft;
      if (now > (o.pitchFreeUntil ?? 0)) o.pitch += (view.pitch - o.pitch) * soft;
      o.yaw += dt * view.spin;
      const p = orbitPosition({ x: o.x, y: o.y, z: o.z }, o.yaw, o.pitch, o.distance);
      camera.position.set(p.x, p.y, p.z);
      camera.lookAt(o.x, o.y, o.z);
      camera.fov += (view.fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
      debugState.camera = {
        x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2),
        fov: +camera.fov.toFixed(1), pitch: +o.pitch.toFixed(3), distance: +o.distance.toFixed(1),
      };
    }
  });

  return null;
}

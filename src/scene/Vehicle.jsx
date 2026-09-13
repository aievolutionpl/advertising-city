// 🚗 Samochody w mieście: zaparkowane pod budynkami + wsiadanie i jazda (GTA/NFS feel).
// Stan auta trzymany w ref (bez re-renderów 60×/s), kamera pościgowa ustawiana w useFrame z priorytetem 1.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCity } from '../store.js';
import { CITY } from '../data/city.js';
import { DRIVE, blockedAt, carStateFrom, nearestCar, parkedCars, speedKmh, stepCar } from '../lib/vehicles.js';
import { playerRuntime } from './playerRuntime.js';

/** Sterowanie z HUD (przyciski dotykowe) — jeden kanał, bez prop-drillingu przez Canvas. */
export const driveWant = { enter: false, exit: false, keys: {} };

const KEYS = {};

function CarMesh({ color, tint = '#0b1622', carRef }) {
  const wheels = useRef([]);
  return (
    <group ref={carRef}>
      {/* nadwozie + kabina */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.9, 0.52, 3.9]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.34} />
      </mesh>
      <mesh position={[0, 1.06, -0.15]} castShadow>
        <boxGeometry args={[1.66, 0.5, 2.0]} />
        <meshStandardMaterial color={tint} metalness={0.35} roughness={0.25} />
      </mesh>
      {/* szyby (świecą lekko — czytelne nocą) */}
      <mesh position={[0, 1.08, 0.86]}>
        <planeGeometry args={[1.5, 0.44]} />
        <meshBasicMaterial color="#8fd4ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* światła */}
      <mesh position={[0.62, 0.62, 1.97]}>
        <boxGeometry args={[0.42, 0.16, 0.08]} />
        <meshBasicMaterial color="#fff8d6" toneMapped={false} />
      </mesh>
      <mesh position={[-0.62, 0.62, 1.97]}>
        <boxGeometry args={[0.42, 0.16, 0.08]} />
        <meshBasicMaterial color="#fff8d6" toneMapped={false} />
      </mesh>
      <mesh position={[0.62, 0.62, -1.97]}>
        <boxGeometry args={[0.4, 0.14, 0.08]} />
        <meshBasicMaterial color="#ff5a4d" toneMapped={false} />
      </mesh>
      <mesh position={[-0.62, 0.62, -1.97]}>
        <boxGeometry args={[0.4, 0.14, 0.08]} />
        <meshBasicMaterial color="#ff5a4d" toneMapped={false} />
      </mesh>
      {/* koła */}
      {[[-0.95, 1.28], [0.95, 1.28], [-0.95, -1.28], [0.95, -1.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]} castShadow ref={(el) => (wheels.current[i] = el)}>
          <cylinderGeometry args={[0.36, 0.36, 0.24, 12]} />
          <meshStandardMaterial color="#1a1d22" roughness={0.9} />
        </mesh>
      ))}
      {/* cień pod autem */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 4.6]} />
        <meshBasicMaterial color="#0b1622" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Vehicles() {
  const buildings = useCity((s) => s.buildings);
  const setDrive = useCity((s) => s.setDrive);
  const toastMsg = useCity((s) => s.toastMsg);
  const cars = useMemo(() => parkedCars(buildings), [buildings]);
  const [driving, setDriving] = useState(false);

  const carRef = useRef();
  const state = useRef(null);
  const sync = useRef(0);
  const wheelsPhase = useRef(0);

  const boxes = useMemo(() => Object.values(buildings).map((b) => ({
    x: b.x, z: b.z, w: (b.w ?? CITY.plotSize) * 0.92, d: (b.d ?? CITY.plotSize) * 0.92, yaw: b.yaw || 0, r: 12,
  })), [buildings]);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const carsRef = useRef(cars);
  carsRef.current = cars;

  /* klawiatura: WASD/strzałki, Shift=NOS, Space=hamulec, E=wsiądź/wysiądź */
  useEffect(() => {
    const map = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    const down = (e) => {
      if (e.code === 'KeyE') { if (state.current) driveWant.exit = true; else driveWant.enter = true; return; }
      if (e.code === 'Space' && state.current) { KEYS.brake = true; e.preventDefault(); return; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') KEYS.boost = true;
      const k = map[e.code];
      if (k) KEYS[k] = true;
    };
    const up = (e) => {
      if (e.code === 'Space') KEYS.brake = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') KEYS.boost = false;
      const k = map[e.code];
      if (k) KEYS[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /* HUD → scena: wsiadanie/wysiadanie przyciskiem (mobile) */
  useEffect(() => {
    window.__car = {
      enter: () => { driveWant.enter = true; },
      exit: () => { driveWant.exit = true; },
      state: () => (state.current ? { ...state.current, kmh: speedKmh(state.current.speed) } : null),
      /* wsiadanie „na zawołanie" — do auta można dojść, ale na dotyku to męka;
         przywołanie: najbliższe zaparkowane auto + gracz obok + wejście */
      summon: () => {
        if (state.current) { driveWant.exit = true; return true; }
        const c = nearestCar(carsRef.current, playerRuntime.x, playerRuntime.z, 1e6);
        if (!c) { toastMsg?.('🚗 Brak aut w mieście — postaw najpierw budynek'); return false; }
        playerRuntime.x = c.x + 2.0;
        playerRuntime.z = c.z;
        driveWant.enter = true;
        return true;
      },
      cars: () => carsRef.current.map((c) => ({ id: c.id, x: +c.x.toFixed(1), z: +c.z.toFixed(1), color: c.color })),
      count: () => carsRef.current.length,
    };
    return () => { delete window.__car; };
  }, []);

  useFrame((ctx, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    /* ── wysiadanie / wsiadanie ── */
    if (driveWant.exit && state.current) {
      const s = state.current;
      playerRuntime.x = s.x + Math.cos(s.yaw) * 2.6;
      playerRuntime.z = s.z - Math.sin(s.yaw) * 2.6;
      state.current = null;
      playerRuntime.driving = false;
      setDriving(false);
      setDrive?.({ on: false, kmh: 0, car: null });
      toastMsg?.('🚶 Wysiadłeś — E wraca do auta');
      driveWant.exit = false;
    }
    if (driveWant.enter && !state.current) {
      const near = nearestCar(carsRef.current, playerRuntime.x, playerRuntime.z, 3.6);
      if (near) {
        state.current = carStateFrom(near);
        playerRuntime.driving = true;
        setDriving(true);
        setDrive?.({ on: true, kmh: 0, car: near.id, color: near.color });
        toastMsg?.('🚗 Wsiadłeś — WSAD jedzie, Shift = NOS, E = wysiądź');
      } else {
        toastMsg?.('🚗 Podejdź bliżej auta (stoją pod budynkami)');
      }
      driveWant.enter = false;
    }

    /* ── jazda ── */
    if (state.current) {
      const s0 = state.current;
      const fwd = (KEYS.up ? 1 : 0) - (KEYS.down ? 1 : 0);
      const steer = (KEYS.left ? 1 : 0) - (KEYS.right ? 1 : 0);
      const input = {
        throttle: fwd,
        steer,
        brake: !!KEYS.brake,
        boost: !!KEYS.boost && fwd > 0,
      };
      let s1 = stepCar(s0, input, dt);
      // kolizja: cofnij pozycję, wyzeruj prędkość (ściana = stop, nie przenikanie)
      if (blockedAt(s1.x, s1.z, boxesRef.current)) {
        s1 = { ...s0, speed: 0 };
        toastMsg?.('💥 Ściana — jedź ostrożniej');
      }
      // granice miasta
      if (Math.abs(s1.x) > 86 || Math.abs(s1.z) > 86) s1 = { ...s1, x: Math.max(-86, Math.min(86, s1.x)), z: Math.max(-86, Math.min(86, s1.z)), speed: s1.speed * 0.2 };
      state.current = s1;
      playerRuntime.x = s1.x;
      playerRuntime.z = s1.z;
      playerRuntime.yaw = s1.yaw;

      const g = carRef.current;
      if (g) {
        g.visible = true;
        g.position.set(s1.x, 0, s1.z);
        g.rotation.y = s1.yaw;
      }
      // koła kręcą się z prędkością (czytelny ruch)
      wheelsPhase.current += s1.speed * dt * 2.4;
      carRef.current?.children?.forEach?.((c) => { if (c.geometry?.type === 'CylinderGeometry') c.rotation.x = wheelsPhase.current; });

      /* kamera pościgowa (priorytet 1 = po kamerach sceny) */
      const cam = ctx.camera;
      const back = 11 + Math.min(6, Math.abs(s1.speed) * 0.16);
      const cx = s1.x - Math.sin(s1.yaw) * back;
      const cz = s1.z - Math.cos(s1.yaw) * back;
      cam.position.lerp(new THREE.Vector3(cx, 4.6 + Math.abs(s1.speed) * 0.03, cz), Math.min(1, dt * 6));
      cam.lookAt(s1.x + Math.sin(s1.yaw) * 8, 1.6, s1.z + Math.cos(s1.yaw) * 8);
      if (Math.abs((cam.fov || 45) - (s1.speed > 26 ? 74 : 66)) > 0.2) {
        cam.fov += ((s1.speed > 26 ? 74 : 66) - cam.fov) * Math.min(1, dt * 3);
        cam.updateProjectionMatrix();
      }

      sync.current += dt;
      if (sync.current > 0.14) {
        sync.current = 0;
        setDrive?.({ on: true, kmh: speedKmh(s1.speed), car: s1.id, color: s1.color, boost: !!KEYS.boost, x: s1.x, z: s1.z });
      }
    } else {
      /* prompt „wsiądź” aktualizowany z rozsądną częstotliwością */
      sync.current += dt;
      if (sync.current > 0.25) {
        sync.current = 0;
        const near = nearestCar(carsRef.current, playerRuntime.x, playerRuntime.z, 3.6);
        setDrive?.({ on: false, kmh: 0, near: near ? near.id : null });
      }
    }
  });
  /* ⚠️ NIE dodawaj tu priorytetu (useFrame(cb, 1))!
     W @react-three/fiber 8 każdy useFrame z priorytetem > 0 WYŁĄCZA automatyczny render
     („if (!state.internal.priority && state.gl.render) gl.render(...)”) → cała scena przestaje
     się rysować (pusty ekran, choć FPS leci). Kamera pościgowa i tak działa, bo <Vehicles />
     montuje się PO <CameraRig /> w App.jsx, więc jej callback odpala się później. */

  const p = state.current;
  return (
    <>
      {/* zaparkowane auta pod budynkami */}
      {cars.map((c) => (state.current?.id === c.id ? null : (
        <group key={c.id} position={[c.x, 0, c.z]} rotation={[0, c.yaw, 0]}>
          <CarMesh color={c.color} />
        </group>
      )))}
      {/* auto gracza (jedno, sterowane) — pozycja ustawiana w klatce */}
      <group visible={!!p || driving}>
        <CarMesh color={state.current?.color || '#c0392b'} carRef={carRef} />
      </group>
    </>
  );
}

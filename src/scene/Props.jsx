// Detale ulicy: ławki, kosze, hydranty, sygnalizacja świetlna i przystanki.
// Wszystko instancjowane i wyprowadzone z BLOCK_CENTERS/ROAD_LINES, więc rośnie razem z miastem.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY, BLOCK_CENTERS, ROAD_LINES } from '../data/city.js';
import { dayRuntime } from './dayRuntime.js';

const HALF = CITY.block / 2 + 1;      // 9 — pas chodnika
const EDGE = CITY.pitch / 2 - 0.9;    // tuż przy krawężniku

const POLE_MAT = new THREE.MeshStandardMaterial({ color: '#57606b', roughness: 0.6, metalness: 0.4 });
const WOOD_MAT = new THREE.MeshStandardMaterial({ color: '#a9784a', roughness: 0.9 });
const METAL_MAT = new THREE.MeshStandardMaterial({ color: '#7b828b', roughness: 0.55, metalness: 0.5 });
const DARK_MAT = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.7, metalness: 0.25 });
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: '#cfe4f2', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55 });
const RED = new THREE.MeshBasicMaterial({ color: '#ff4b3e', toneMapped: false });
const AMBER = new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false });
const GREEN = new THREE.MeshBasicMaterial({ color: '#57e07a', toneMapped: false });
const HYD = new THREE.MeshStandardMaterial({ color: '#c8402f', roughness: 0.7 });
const PLANTER = new THREE.MeshStandardMaterial({ color: '#b98b65', roughness: 0.9 });
const PLANT = new THREE.MeshStandardMaterial({ color: '#4f8d43', roughness: 0.92, flatShading: true });

/** Pozycje detali wyprowadzone z siatki miasta. */
export function streetProps() {
  const benches = [];
  const bins = [];
  const hydrants = [];
  const lights = [];
  const stops = [];
  const planters = [];
  BLOCK_CENTERS.forEach((cx, i) => {
    BLOCK_CENTERS.forEach((cz, j) => {
      // ławki na dwóch krawędziach każdego kwartału (frontem do jezdni)
      benches.push({ x: cx - 4.5, z: cz + EDGE, yaw: Math.PI });
      benches.push({ x: cx + 4.5, z: cz - EDGE, yaw: 0 });
      bins.push({ x: cx + 3.4, z: cz + EDGE });
      bins.push({ x: cx - 3.4, z: cz - EDGE });
      if ((i + j) % 3 === 0) hydrants.push({ x: cx + HALF + 0.6, z: cz + 2.4 });
      if ((i + j) % 3 === 1) hydrants.push({ x: cx - HALF - 0.6, z: cz - 2.4 });
      if ((i + j) % 2 === 0) planters.push({ x: cx + 6.4, z: cz + EDGE, yaw: Math.PI / 2 });
      else planters.push({ x: cx - EDGE, z: cz - 6.4, yaw: 0 });
    });
  });
  ROAD_LINES.forEach((rx) => {
    ROAD_LINES.forEach((rz) => {
      lights.push({ x: rx + 5.2, z: rz + 5.2, yaw: Math.PI * 0.25 });
      lights.push({ x: rx - 5.2, z: rz - 5.2, yaw: Math.PI * 1.25 });
    });
  });
  [[0, 0], [-28, 0], [28, 0], [0, 28]].forEach(([x, z]) => stops.push({ x: x + HALF + 1.6, z: z + 6, yaw: -Math.PI / 2 }));
  return { benches, bins, hydrants, lights, stops, planters };
}

function useInstances(ref, items, place) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    items.forEach((it, i) => {
      place(dummy, it, i);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items, ref, place]);
}

export function Props() {
  const { benches, bins, hydrants, lights, stops, planters } = useMemo(streetProps, []);
  const benchSeat = useRef(); const benchBack = useRef();
  const binRef = useRef(); const hydRef = useRef();
  const tlPole = useRef(); const tlHead = useRef();
  const tlRed = useRef(); const tlAmber = useRef(); const tlGreen = useRef();
  const stopRoof = useRef(); const stopGlass = useRef(); const stopBench = useRef();
  const planterBox = useRef(); const planterShrub = useRef();

  useInstances(benchSeat, benches, (d, b) => {
    d.position.set(b.x, 0.62, b.z); d.rotation.set(0, b.yaw, 0); d.scale.setScalar(1);
    d.translateX(0.0); d.translateZ(0.0);
  });
  useInstances(benchBack, benches, (d, b) => {
    d.position.set(b.x, 0.86, b.z); d.rotation.set(0, b.yaw, 0); d.scale.setScalar(1);
    d.translateZ(0.22);
  });
  useInstances(binRef, bins, (d, b) => { d.position.set(b.x, 0.5, b.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); });
  useInstances(hydRef, hydrants, (d, h) => { d.position.set(h.x, 0.45, h.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); });
  useInstances(tlPole, lights, (d, l) => { d.position.set(l.x, 2.4, l.z); d.rotation.set(0, l.yaw, 0); d.scale.setScalar(1); });
  useInstances(tlHead, lights, (d, l) => { d.position.set(l.x, 4.9, l.z); d.rotation.set(0, l.yaw, 0); d.scale.setScalar(1); });
  useInstances(tlRed, lights, (d, l) => { d.position.set(l.x, 5.18, l.z); d.rotation.set(0, l.yaw, 0); d.scale.setScalar(1); d.translateZ(0.1); d.translateX(0); d.translateY(0.0); });
  useInstances(tlAmber, lights, (d, l) => { d.position.set(l.x, 4.9, l.z); d.rotation.set(0, l.yaw, 0); d.scale.setScalar(1); d.translateZ(0.1); });
  useInstances(tlGreen, lights, (d, l) => { d.position.set(l.x, 4.62, l.z); d.rotation.set(0, l.yaw, 0); d.scale.setScalar(1); d.translateZ(0.1); });
  useInstances(stopRoof, stops, (d, s) => { d.position.set(s.x, 2.6, s.z); d.rotation.set(0, s.yaw, 0); d.scale.setScalar(1); });
  useInstances(stopGlass, stops, (d, s) => { d.position.set(s.x, 1.35, s.z); d.rotation.set(0, s.yaw, 0); d.scale.setScalar(1); d.translateZ(0.55); });
  useInstances(stopBench, stops, (d, s) => { d.position.set(s.x, 0.55, s.z); d.rotation.set(0, s.yaw, 0); d.scale.setScalar(1); d.translateZ(0.35); });
  useInstances(planterBox, planters, (d, p) => { d.position.set(p.x, 0.34, p.z); d.rotation.set(0, p.yaw, 0); d.scale.setScalar(1); });
  useInstances(planterShrub, planters, (d, p) => { d.position.set(p.x, 0.92, p.z); d.rotation.set(0, p.yaw, 0); d.scale.set(1.1, 0.72, 0.72); });

  return (
    <group name="mala-architektura-lawki-kosze-donice">
      <instancedMesh name="lawki-miejskie" ref={benchSeat} args={[undefined, undefined, benches.length]} castShadow>
        <boxGeometry args={[1.9, 0.12, 0.55]} />
        <primitive object={WOOD_MAT} attach="material" />
      </instancedMesh>
      <instancedMesh ref={benchBack} args={[undefined, undefined, benches.length]} castShadow>
        <boxGeometry args={[1.9, 0.5, 0.1]} />
        <primitive object={WOOD_MAT} attach="material" />
      </instancedMesh>

      <instancedMesh ref={binRef} args={[undefined, undefined, bins.length]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.0, 10]} />
        <primitive object={DARK_MAT} attach="material" />
      </instancedMesh>

      <instancedMesh ref={hydRef} args={[undefined, undefined, Math.max(1, hydrants.length)]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.9, 8]} />
        <primitive object={HYD} attach="material" />
      </instancedMesh>

      <instancedMesh ref={tlPole} args={[undefined, undefined, lights.length]} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 4.8, 6]} />
        <primitive object={POLE_MAT} attach="material" />
      </instancedMesh>
      <instancedMesh ref={tlHead} args={[undefined, undefined, lights.length]}>
        <boxGeometry args={[0.42, 1.24, 0.34]} />
        <primitive object={DARK_MAT} attach="material" />
      </instancedMesh>
      <instancedMesh ref={tlRed} args={[undefined, undefined, lights.length]}>
        <circleGeometry args={[0.12, 12]} />
        <primitive object={RED} attach="material" />
      </instancedMesh>
      <instancedMesh ref={tlAmber} args={[undefined, undefined, lights.length]}>
        <circleGeometry args={[0.12, 12]} />
        <primitive object={AMBER} attach="material" />
      </instancedMesh>
      <instancedMesh ref={tlGreen} args={[undefined, undefined, lights.length]}>
        <circleGeometry args={[0.12, 12]} />
        <primitive object={GREEN} attach="material" />
      </instancedMesh>

      <instancedMesh ref={stopRoof} args={[undefined, undefined, Math.max(1, stops.length)]} castShadow>
        <boxGeometry args={[3.4, 0.16, 1.5]} />
        <primitive object={METAL_MAT} attach="material" />
      </instancedMesh>
      <instancedMesh ref={stopGlass} args={[undefined, undefined, Math.max(1, stops.length)]}>
        <boxGeometry args={[3.2, 2.2, 0.08]} />
        <primitive object={GLASS_MAT} attach="material" />
      </instancedMesh>
      <instancedMesh ref={stopBench} args={[undefined, undefined, Math.max(1, stops.length)]}>
        <boxGeometry args={[2.6, 0.12, 0.5]} />
        <primitive object={WOOD_MAT} attach="material" />
      </instancedMesh>

      <instancedMesh name="donice-miejskie" ref={planterBox} args={[undefined, undefined, planters.length]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.68, 0.72]} />
        <primitive object={PLANTER} attach="material" />
      </instancedMesh>
      <instancedMesh name="krzewy-w-donicach" ref={planterShrub} args={[undefined, undefined, planters.length]} castShadow>
        <icosahedronGeometry args={[0.62, 0]} />
        <primitive object={PLANT} attach="material" />
      </instancedMesh>
    </group>
  );
}

/** Migające światło na sygnalizatorach — tanio: podmieniamy tylko kolory materiałów. */
export function TrafficLights() {
  useLayoutEffect(() => () => {
    RED.color.set('#ff4b3e');
    AMBER.color.set('#ffb020');
    GREEN.color.set('#57e07a');
  }, []);
  return null;
}

export function propsNightTick() {
  const night = dayRuntime.day.night;
  RED.color.setRGB(0.45 + night * 0.55, 0.12, 0.1);
  AMBER.color.setRGB(0.4 + night * 0.35, 0.28 + night * 0.35, 0.06);
  GREEN.color.setRGB(0.18, 0.45 + night * 0.45, 0.26);
}

// Ruch uliczny i piesi: wszystko na instancjach (kilka draw calli na całe miasto).
// Auta: nadwozie + szyby + koła + reflektory (świecą nocą) + światła stopu. Piesi: tułów, głowa, nogi.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY, ROAD_LINES, BLOCK_CENTERS } from '../data/city.js';
import { headlightMaterial } from './materials.js';
import { dayRuntime } from './dayRuntime.js';

const CAR_COLORS = ['#c14343', '#2f6fb5', '#e0a63a', '#3f9e63', '#8b5cc7', '#d8d8dc', '#2c3238', '#d4713c'];
const CLOTHES = ['#3a6ea5', '#c0553f', '#4a8a5a', '#8a6bbf', '#d9a13b', '#4a4f57', '#c46a9a', '#3f8f95'];
const SKIN = ['#f0c9a8', '#e0ab84', '#c58b62', '#a9673f', '#7d4a2c'];

const bodyGeo = new THREE.BoxGeometry(4.0, 0.86, 1.86);
const cabinGeo = new THREE.BoxGeometry(2.05, 0.74, 1.7);
const roofGeo = new THREE.BoxGeometry(1.7, 0.14, 1.6);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10);
const lightGeo = new THREE.BoxGeometry(0.14, 0.22, 0.42);
const tailGeo = new THREE.BoxGeometry(0.12, 0.18, 0.38);
const torsoGeo = new THREE.BoxGeometry(0.44, 1.0, 0.34);
const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
const legGeo = new THREE.BoxGeometry(0.16, 0.56, 0.16);

const DARK = new THREE.MeshStandardMaterial({ color: '#1b2027', roughness: 0.45, metalness: 0.25 });
const BODY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.35 });
const ROOFMAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.3 });
const WHEEL = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.95 });
const TAIL = new THREE.MeshBasicMaterial({ color: '#ff5a4a', toneMapped: false });
const PED_BODY = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
const PED_SKIN = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 });
const PED_LEGS = new THREE.MeshStandardMaterial({ color: '#2f3540', roughness: 0.85 });

const EXT = () => CITY.extent;

/** Auto i: co druga jezdnia pozioma / pionowa, pas ±2,2 m, własna prędkość — ruch bez zderzeń. */
function carAt(i, t) {
  const E = EXT();
  const line = ROAD_LINES[i % ROAD_LINES.length];
  const horiz = i % 2 === 0;
  const dir = (i >> 2) % 2 === 0 ? 1 : -1;
  const speed = 6.5 + ((i * 37) % 9) * 1.25;
  const span = 2 * E;
  const s = ((t * speed + i * 29.7) % span) - E;
  const lane = line + dir * 2.2;
  if (horiz) return { x: dir * s, z: lane, yaw: dir > 0 ? 0 : Math.PI };
  return { x: lane, z: dir * s, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
}

export function Cars({ count = 54 }) {
  const body = useRef(); const cabin = useRef(); const roof = useRef();
  const wheels = useRef(); const lights = useRef(); const tails = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      c.set(CAR_COLORS[i % CAR_COLORS.length]);
      body.current.setColorAt(i, c);
      roof.current.setColorAt(i, c);
    }
    body.current.instanceColor.needsUpdate = true;
    roof.current.instanceColor.needsUpdate = true;
  }, [count, c]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const { x, z, yaw } = carAt(i, t);
      const big = i % 9 === 4 ? 1.8 : 1;   // co dziewiąty pojazd to bus/dostawczak — ruch nie jest monotonny
      // nadwozie (y=0.68), szyby, dach
      dummy.position.set(x, 0.68, z); dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(big, big > 1 ? 1.45 : 1, big > 1 ? 1.15 : 1); dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      const placeY = (mesh, idx, ox, oy, oz, sc = 1) => {
        dummy.position.set(x, oy, z); dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(sc); dummy.updateMatrix();
        dummy.translateX(ox * big); dummy.translateZ(oz); dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };
      const capS = big > 1 ? 1.2 : 1;
      placeY(cabin.current, i, -0.28, 1.34 * (big > 1 ? 1.35 : 1), 0, capS);
      placeY(roof.current, i, -0.3, 1.8 * (big > 1 ? 1.4 : 1), 0, capS);
      placeY(lights.current, i * 2, 2.03, 0.74, 0.62);
      placeY(lights.current, i * 2 + 1, 2.03, 0.74, -0.62);
      placeY(tails.current, i * 2, -2.03, 0.78, 0.6);
      placeY(tails.current, i * 2 + 1, -2.03, 0.78, -0.6);
      // koła: przód i tył, lewa i prawa strona
      const wp = [[1.3, 0.94], [1.3, -0.94], [-1.32, 0.94], [-1.32, -0.94]];
      wp.forEach(([wx, wz], k) => {
        dummy.position.set(x, 0.38, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        dummy.translateX(wx * big); dummy.translateZ(wz);
        dummy.rotateX(Math.PI / 2);
        dummy.updateMatrix();
        wheels.current.setMatrixAt(i * 4 + k, dummy.matrix);
      });
    }
    for (const m of [body, cabin, roof, wheels, lights, tails]) m.current.instanceMatrix.needsUpdate = true;
    // nocą reflektory mocniejsze
    const night = dayRuntime.day.night;
    headlightMaterial.color.setRGB(0.55 + night * 0.75, 0.52 + night * 0.7, 0.42 + night * 0.5);
  });

  return (
    <group>
      <instancedMesh ref={body} args={[bodyGeo, BODY, count]} castShadow />
      <instancedMesh ref={cabin} args={[cabinGeo, DARK, count]} castShadow />
      <instancedMesh ref={roof} args={[roofGeo, ROOFMAT, count]} castShadow />
      <instancedMesh ref={wheels} args={[wheelGeo, WHEEL, count * 4]} />
      <instancedMesh ref={lights} args={[lightGeo, headlightMaterial, count * 2]} />
      <instancedMesh ref={tails} args={[tailGeo, TAIL, count * 2]} />
    </group>
  );
}

/** Pieszy i: chodnik wokół kwartału, ±9,6 m od osi kwartału (nie wchodzi w budynki). */
function pedAt(i, t) {
  const E = EXT();
  const center = BLOCK_CENTERS[i % BLOCK_CENTERS.length];
  const side = (i >> 2) % 2 === 0 ? 9.6 : -9.6;
  const horiz = i % 2 === 0;
  const dir = (i >> 3) % 2 === 0 ? 1 : -1;
  const speed = 1.25 + ((i * 13) % 7) * 0.16;
  const span = 2 * E;
  const s = ((t * speed + i * 17.3) % span) - E;
  if (horiz) return { x: dir * s, z: center + side, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
  return { x: center + side, z: dir * s, yaw: dir > 0 ? Math.PI : 0 };
}

export function Pedestrians({ count = 120 }) {
  const torso = useRef(); const head = useRef(); const legs = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      c.set(CLOTHES[i % CLOTHES.length]);
      torso.current.setColorAt(i, c);
      c.set(SKIN[i % SKIN.length]);
      head.current.setColorAt(i, c);
      legs.current.setColorAt(i * 2, c.set('#2f3540'));
      legs.current.setColorAt(i * 2 + 1, c.set('#31384a'));
    }
    torso.current.instanceColor.needsUpdate = true;
    head.current.instanceColor.needsUpdate = true;
    legs.current.instanceColor.needsUpdate = true;
  }, [count, c]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const { x, z, yaw } = pedAt(i, t);
      const bob = Math.sin(t * 5.4 + i) * 0.045;
      const swing = Math.sin(t * 5.4 + i) * 0.35;
      const put = (mesh, idx, oy, ox = 0, rot = 0, scale = 1) => {
        dummy.position.set(x, oy + bob, z);
        dummy.rotation.set(rot, yaw, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        dummy.translateX(ox);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };
      put(torso.current, i, 1.12);
      put(head.current, i, 1.78);
      put(legs.current, i * 2, 0.32, 0.11, swing);
      put(legs.current, i * 2 + 1, 0.32, -0.11, -swing);
    }
    for (const m of [torso, head, legs]) m.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={torso} args={[torsoGeo, PED_BODY, count]} castShadow />
      <instancedMesh ref={head} args={[headGeo, PED_SKIN, count]} castShadow />
      <instancedMesh ref={legs} args={[legGeo, PED_LEGS, count * 2]} />
    </group>
  );
}

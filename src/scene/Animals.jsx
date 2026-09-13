// Zwierzęta w mieście: psy na spacerze, koty w parkach i stada gołębi.
// Wszystko na instancjach — pies to 4 draw calle na całe miasto, gołąb 3.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY, BLOCK_CENTERS, PLOTS } from '../data/city.js';

const FUR = ['#c9a06a', '#8a6242', '#4a4038', '#e2d6c2', '#b5793f', '#6b6f76'];
const BIRD = ['#9aa4ae', '#7c8792', '#b9c2ca', '#6f7780'];
const CAT = ['#3a3a40', '#d8cfc0', '#c2853f', '#7a6b5c'];

const dogBody = new THREE.BoxGeometry(0.78, 0.34, 0.3);
const dogHead = new THREE.BoxGeometry(0.28, 0.26, 0.26);
const dogLeg = new THREE.BoxGeometry(0.09, 0.36, 0.09);
const dogTail = new THREE.BoxGeometry(0.08, 0.08, 0.34);

const catBody = new THREE.BoxGeometry(0.5, 0.24, 0.22);
const catTail = new THREE.BoxGeometry(0.06, 0.06, 0.42);

const birdBody = new THREE.SphereGeometry(0.1, 8, 6);
const birdHead = new THREE.SphereGeometry(0.055, 8, 6);
const birdWing = new THREE.BoxGeometry(0.22, 0.02, 0.1);

const DOG_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
const DOG_HEAD = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
const DOG_LEG = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.9 });
const BIRD_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
const WING_MAT = new THREE.MeshStandardMaterial({ color: '#8f99a3', roughness: 0.75 });

/** Ruch po chodniku wokół kwartału: pozycja + kierunek (yaw), czysto parametrycznie. */
function aroundBlock(t, blockIndex, phase, speed, r = 9.6) {
  const bx = BLOCK_CENTERS[blockIndex % BLOCK_CENTERS.length];
  const bz = BLOCK_CENTERS[Math.floor(blockIndex / BLOCK_CENTERS.length) % BLOCK_CENTERS.length];
  const side = 8 * r;
  const u = ((((t * speed) / side) + phase) % 1 + 1) % 1;
  const s = u * side;
  const yawOf = (dx, dz) => Math.atan2(dx, dz);
  if (s < 2 * r) return { x: bx - r + s, z: bz - r, yaw: yawOf(1, 0) };
  if (s < 4 * r) return { x: bx + r, z: bz - r + (s - 2 * r), yaw: yawOf(0, 1) };
  if (s < 6 * r) return { x: bx + r - (s - 4 * r), z: bz + r, yaw: yawOf(-1, 0) };
  return { x: bx - r, z: bz + r - (s - 6 * r), yaw: yawOf(0, -1) };
}

/** Kręcenie się w kółko po skwerze (parki, trawniki). */
function inPark(t, index, speed, radius) {
  const parks = PLOTS.filter((p) => p.park);
  const p = parks[index % parks.length];
  const a = t * speed + index * 1.7;
  return { x: p.x + Math.cos(a) * radius, z: p.z + Math.sin(a) * radius, yaw: -a + Math.PI / 2 };
}

/** Psy: idą po chodnikach, merdają ogonem, nogi pracują w parach. */
export function Dogs({ count = 16 }) {
  const body = useRef(); const head = useRef(); const legs = useRef(); const tail = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      body.current.setColorAt(i, c.set(FUR[i % FUR.length]));
      head.current.setColorAt(i, c.set(FUR[(i + 2) % FUR.length]));
    }
    body.current.instanceColor.needsUpdate = true;
    head.current.instanceColor.needsUpdate = true;
  }, [count, c]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const speed = 1.5 + ((i * 7) % 5) * 0.22;
      const { x, z, yaw } = aroundBlock(t, i * 3, i * 0.13, speed);
      const gait = Math.sin(t * 6 + i) * 0.5;
      const put = (mesh, idx, ox, oy, oz, extra = 0, ox2 = 0) => {
        dummy.position.set(x, oy, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        dummy.translateX(ox);
        dummy.translateZ(oz);
        if (extra) dummy.rotateZ(extra);
        if (ox2) dummy.rotateY(ox2);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };
      put(body.current, i, 0, 0.62, 0);
      put(head.current, i, 0.42, 0.74, 0);
      put(tail.current, i, -0.42, 0.7, 0, 0, Math.sin(t * 12 + i) * 0.6);
      put(legs.current, i * 4, 0.28, 0.18, -0.11, gait);
      put(legs.current, i * 4 + 1, 0.28, 0.18, 0.11, -gait);
      put(legs.current, i * 4 + 2, -0.28, 0.18, -0.11, -gait);
      put(legs.current, i * 4 + 3, -0.28, 0.18, 0.11, gait);
    }
    for (const m of [body, head, legs, tail]) m.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[dogBody, DOG_MAT, count]} castShadow />
      <instancedMesh ref={head} args={[dogHead, DOG_HEAD, count]} castShadow />
      <instancedMesh ref={legs} args={[dogLeg, DOG_LEG, count * 4]} />
      <instancedMesh ref={tail} args={[dogTail, DOG_MAT, count]} />
    </group>
  );
}

/** Koty: leniwie krążą po parkach. */
export function Cats({ count = 10 }) {
  const body = useRef(); const tail = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) body.current.setColorAt(i, c.set(CAT[i % CAT.length]));
    body.current.instanceColor.needsUpdate = true;
  }, [count, c]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const { x, z, yaw } = inPark(t, i, 0.1 + (i % 3) * 0.02, 1.6 + (i % 4) * 0.5);
      dummy.position.set(x, 0.36, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.44, z);
      dummy.updateMatrix();
      dummy.translateZ(-0.36);
      dummy.rotateY(Math.sin(t * 2 + i) * 0.5);
      dummy.updateMatrix();
      tail.current.setMatrixAt(i, dummy.matrix);
    }
    body.current.instanceMatrix.needsUpdate = true;
    tail.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[catBody, DOG_MAT, count]} castShadow />
      <instancedMesh ref={tail} args={[catTail, DOG_HEAD, count]} />
    </group>
  );
}

/** Gołębie: chodzą po chodnikach, co chwilę podlatują (skok + machnięcie skrzydeł). */
export function Pigeons({ count = 44 }) {
  const body = useRef(); const head = useRef(); const wings = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const c = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) body.current.setColorAt(i, c.set(BIRD[i % BIRD.length]));
    body.current.instanceColor.needsUpdate = true;
  }, [count, c]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const speed = 0.35 + ((i * 5) % 4) * 0.08;
      const base = aroundBlock(t, i * 2, i * 0.09, speed);
      const fly = Math.max(0, Math.sin(t * 1.3 + i * 2.1));  // co kilka sekund podlot
      const y = 0.16 + fly * 1.7;
      const flap = Math.sin(t * 18 + i) * (0.35 + fly * 0.85);
      const x = base.x + Math.sin(t * 3 + i) * 0.5 * fly;
      const z = base.z + Math.cos(t * 3 + i) * 0.5 * fly;
      const put = (mesh, idx, ox, oy, oz, rx = 0, rz = 0) => {
        dummy.position.set(x, y + oy, z);
        dummy.rotation.set(rx, base.yaw, rz);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        dummy.translateX(ox);
        dummy.translateZ(oz);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };
      put(body.current, i, 0, 0, 0);
      put(head.current, i, 0, 0.03, 0.12, 0.2 + Math.sin(t * 6 + i) * 0.35);
      put(wings.current, i * 2, 0.02, 0.03, 0, 0, flap);
      put(wings.current, i * 2 + 1, -0.02, 0.03, 0, 0, -flap);
    }
    for (const m of [body, head, wings]) m.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[birdBody, BIRD_MAT, count]} castShadow />
      <instancedMesh ref={head} args={[birdHead, WING_MAT, count]} />
      <instancedMesh ref={wings} args={[birdWing, WING_MAT, count * 2]} />
    </group>
  );
}

export const WALK_RADIUS = CITY.block / 2 + 1;

// Latarnie uliczne — 3 instancje na całe miasto (słupek, żarówka, łuna), więc ~300 latarni
// kosztuje tyle samo co trzy meshe. Nocą rozjaśniają się razem z resztą miasta (dayRuntime).
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY, BLOCK_CENTERS } from '../data/city.js';
import { dayRuntime } from './dayRuntime.js';
import { lampMaterial } from './materials.js';

const POLE = '#5b6470';
const OFF = CITY.pitch / 2;          // środek chodnika wokół kwartału
const IN_BLOCK = [-9.5, 0, 9.5];     // rozstaw latarni wzdłuż krawędzi kwartału

/** Pozycje latarni na obwodzie każdego kwartału (4 krawędzie × 3 punkty). */
export function lampPosts() {
  const out = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      for (const t of IN_BLOCK) {
        out.push({ x: bx + t, z: bz + OFF });
        out.push({ x: bx + t, z: bz - OFF });
        out.push({ x: bx + OFF, z: bz + t });
        out.push({ x: bx - OFF, z: bz + t });
      }
    }
  }
  return out;
}

/** Skrzyżowania z realnym światłem punktowym (koszt GPU) — środek + dwa główne węzły.
 *  Uwaga: każde światło punktowe = pętla w shaderze; na tabletach to zabójca (NUM_POINT_LIGHTS).
 *  W trybie lekkim SceneGate i tak gasi je całkowicie (visible=false). */
export const LAMP_LIGHTS = [
  { x: 0, z: 0 },
  { x: BLOCK_CENTERS[1], z: BLOCK_CENTERS[1] },
  { x: BLOCK_CENTERS[3], z: BLOCK_CENTERS[3] },
];

export function Lamps() {
  const posts = useMemo(lampPosts, []);
  const poleRef = useRef();
  const bulbRef = useRef();
  const glowRef = useRef();
  const lights = useRef([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    if (!poleRef.current || !bulbRef.current) return;
    posts.forEach((p, i) => {
      dummy.position.set(p.x, 2.1, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      poleRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 4.32, p.z);
      dummy.updateMatrix();
      bulbRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 4.30, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      glowRef.current.setMatrixAt(i, dummy.matrix);
    });
    poleRef.current.instanceMatrix.needsUpdate = true;
    bulbRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
  }, [posts, dummy]);

  useFrame(() => {
    const k = dayRuntime.day.lamps;
    lights.current.forEach((l) => { if (l) l.intensity = k * 30; });
  });

  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, posts.length]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 4.2, 6]} />
        <meshStandardMaterial color={POLE} roughness={0.6} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={bulbRef} args={[undefined, undefined, posts.length]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <primitive object={lampMaterial} attach="material" />
      </instancedMesh>
      {/* rozproszona łuna pod latarnią — tania „poświata” bez dodatkowego światła */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, posts.length]}>
        <circleGeometry args={[1.6, 14]} />
        <primitive object={lampMaterial} attach="material" />
      </instancedMesh>
      {LAMP_LIGHTS.map((c, i) => (
        <pointLight
          key={`pl:${i}`}
          ref={(el) => { lights.current[i] = el; }}
          position={[c.x, 5.2, c.z]}
          color="#ffd9a0"
          intensity={30}
          distance={52}
          decay={1.6}
        />
      ))}
    </group>
  );
}

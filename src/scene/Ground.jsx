// Rekwizyty miasta: ziemia, jezdnie, chodniki, las, puste działki.
import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY, ROADS, SIDEWALKS, TREES, PLOTS, BLOCK_CENTERS } from '../data/city.js';
import { useCity } from '../store.js';
import { rentCost, buildCost } from '../lib/economy.js';

const FONT = '"Inter", "Segoe UI", "DejaVu Sans", Arial, sans-serif';

/* --- asfalt: przerywana linia biegnie WZDŁUŻ drogi (U), nie w poprzek --- */
function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#59636c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const v = 96 + Math.random() * 46;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.22)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
  }
  ctx.fillStyle = '#e8e2cf';
  ctx.fillRect(10, 60, 44, 5);
  ctx.fillRect(74, 60, 44, 5);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#66934c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const g = 90 + Math.random() * 70;
    ctx.fillStyle = `rgba(${Math.round(g * 0.55)},${Math.round(g)},${Math.round(g * 0.42)},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePavingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c6c0b2';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(120,114,102,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Ground() {
  const roadTex = useMemo(makeRoadTexture, []);
  const grassTex = useMemo(makeGrassTexture, []);
  const pavingTex = useMemo(makePavingTexture, []);
  const zebra = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const E = CITY.extent;

  useLayoutEffect(() => {
    if (!zebra.current) return;
    let k = 0;
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        for (const s of [-1, 1]) {
          for (const t of [-1, 1]) {
            dummy.position.set(bx + s * 12, 0.03, bz + t * 6);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            zebra.current.setMatrixAt(k++, dummy.matrix);
          }
        }
      }
    }
    zebra.current.count = k;
    zebra.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[E * 2 + 30, E * 2 + 30]} />
        <meshStandardMaterial map={grassTex} roughness={1} />
      </mesh>

      {ROADS.map((r) => (
        <mesh
          key={r.id}
          rotation={[-Math.PI / 2, 0, r.axis === 'z' ? Math.PI / 2 : 0]}
          position={[r.axis === 'x' ? 0 : r.c, 0.02, r.axis === 'x' ? r.c : 0]}
          receiveShadow
        >
          <planeGeometry args={[(E - 4) * 2, r.width]} />
          <meshStandardMaterial map={roadTex} roughness={0.95} />
        </mesh>
      ))}

      {SIDEWALKS.map((s, i) => (
        <group key={i}>
          <mesh position={[s.x, 0.16, s.z]} receiveShadow>
            <boxGeometry args={[s.w, 0.32, s.d]} />
            <meshStandardMaterial map={pavingTex} color="#ffffff" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* przejścia dla pieszych — jedno instancjowane rysowanie dla całego miasta */}
      <instancedMesh ref={zebra} args={[undefined, undefined, BLOCK_CENTERS.length * BLOCK_CENTERS.length * 4]}>
        <planeGeometry args={[7.4, 0.9]} />
        <meshStandardMaterial color="#efe9d6" roughness={1} />
      </instancedMesh>
    </group>
  );
}

/* --- las: 3 instancje (pień, korona, krzak) zamiast ~90 drzew × 3 meshe --- */
export function Forest() {
  const trunks = useRef();
  const crowns = useRef();
  const bushes = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const treesArr = useMemo(() => TREES.filter((t) => t.s >= 0.75), []);
  const bushesArr = useMemo(() => TREES.filter((t) => t.s < 0.75), []);
  const bushCount = Math.max(1, bushesArr.length);

  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    treesArr.forEach((t, i) => {
      const th = 1.6 * t.s;
      dummy.position.set(t.x, 0.3 + th / 2, t.z);
      dummy.rotation.set(0, t.tone * 6.28, 0);
      dummy.scale.set(t.s, t.s, t.s);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);
    });
    trunks.current.instanceMatrix.needsUpdate = true;
    treesArr.forEach((t, i) => {
      dummy.position.set(t.x, 0.3 + 1.6 * t.s + 1.5 * t.s, t.z);
      dummy.rotation.set(0, t.tone * 3.14, 0);
      dummy.scale.set(t.s * (0.9 + t.tone * 0.35), t.s * (1.1 + t.tone * 0.5), t.s * (0.9 + t.tone * 0.35));
      dummy.updateMatrix();
      crowns.current.setMatrixAt(i, dummy.matrix);
      crowns.current.setColorAt(i, new THREE.Color().setHSL(0.28 + t.tone * 0.06, 0.5, 0.24 + t.tone * 0.12));
    });
    crowns.current.instanceMatrix.needsUpdate = true;
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
    if (bushes.current) {
      bushesArr.forEach((t, i) => {
        dummy.position.set(t.x, 0.55, t.z);
        dummy.rotation.set(0, t.tone * 6.28, 0);
        dummy.scale.setScalar(1.1);
        dummy.updateMatrix();
        bushes.current.setMatrixAt(i, dummy.matrix);
      });
      bushes.current.instanceMatrix.needsUpdate = true;
    }
  }, [treesArr, bushesArr, dummy]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, treesArr.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.6, 6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, treesArr.length]} castShadow>
        <coneGeometry args={[1.5, 3.2, 7]} />
        <meshStandardMaterial color="#3f7a3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={bushes} args={[undefined, undefined, bushCount]} castShadow>
        <icosahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#4a8a44" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

/* --- pusta działka: pad + cena (sprite) — własny komponent, bo hooki nie mogą iść w pętli --- */
function plotPadTexture(price) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(6,12,24,0.86)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 148, 22);
  ctx.fill();
  ctx.strokeStyle = '#00E7FF';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#EAF6FF';
  ctx.font = `800 44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('WOLNA DZIAŁKA', 256, 60);
  ctx.fillStyle = '#7CFF1E';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText(`${price} AC · kliknij`, 256, 114);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function FreePlot({ plot, selected, onSelect }) {
  const price = rentCost(plot) + buildCost(plot);
  const label = useMemo(() => plotPadTexture(price), [price]);
  const color = selected ? '#7CFF1E' : '#00E7FF';
  const half = plot.w / 2;
  return (
    <group position={[plot.x, 0.34, plot.z]} onClick={(e) => { e.stopPropagation(); onSelect(plot.id); }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plot.w, plot.d]} />
        <meshStandardMaterial color={color} transparent opacity={selected ? 0.5 : 0.24} />
      </mesh>
      {[[0, -half], [0, half]].map(([dx, dz], i) => (
        <mesh key={`x${i}`} position={[dx, 0.02, dz]}>
          <boxGeometry args={[plot.w, 0.06, 0.16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      {[[-half, 0], [half, 0]].map(([dx, dz], i) => (
        <mesh key={`z${i}`} position={[dx, 0.02, dz]}>
          <boxGeometry args={[0.16, 0.06, plot.d]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      <sprite position={[0, 3.4, 0]} scale={[5.4, 1.7, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

export function FreePlots() {
  const buildings = useCity((s) => s.buildings);
  const selected = useCity((s) => s.selected);
  const select = useCity((s) => s.select);
  const free = useMemo(() => PLOTS.filter((p) => !p.park && !buildings[p.id]), [buildings]);
  return (
    <group>
      {free.map((p) => (
        <FreePlot key={p.id} plot={p} selected={selected === p.id} onSelect={select} />
      ))}
    </group>
  );
}

/* --- zaznaczenie: pulsujący pierścień --- */
export function SelectionRing({ x, z, size, color = '#7CFF1E' }) {
  const ref = useRef();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.scale.setScalar(1 + Math.sin(t * 3) * 0.03);
    ref.current.rotation.z = t * 0.6;
  });
  return (
    <mesh ref={ref} position={[x, 0.4, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[size * 0.66, size * 0.76, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
    </mesh>
  );
}

export { makePavingTexture };

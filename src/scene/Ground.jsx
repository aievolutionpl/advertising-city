// Rekwizyty miasta: ziemia, jezdnie, chodniki, las, puste działki.
import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY, ROADS, SIDEWALKS, TREES, PLOTS, BLOCK_CENTERS } from '../data/city.js';
import { useCity } from '../store.js';
import { purchaseCost } from '../lib/economy.js';

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
  const parkBeds = useRef();
  const parkPathsX = useRef();
  const parkPathsZ = useRef();
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

  useLayoutEffect(() => {
    const parks = PLOTS.filter((p) => p.park);
    parks.forEach((p, i) => {
      dummy.position.set(p.x, 0.35, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      parkBeds.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 0.452, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      parkPathsX.current?.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      dummy.updateMatrix();
      parkPathsZ.current?.setMatrixAt(i, dummy.matrix);
    });
    [parkBeds, parkPathsX, parkPathsZ].forEach((r) => {
      if (r.current) r.current.instanceMatrix.needsUpdate = true;
    });
  }, [dummy]);

  return (
    <group name="teren-drogi-chodniki-parki">
      <mesh name="teren-trawiasty" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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

      {/* Parki kieszonkowe: trawnik i dwie alejki w 3 draw callach dla całej mapy. */}
      <instancedMesh ref={parkBeds} args={[undefined, undefined, PLOTS.filter((p) => p.park).length]} receiveShadow>
        <boxGeometry args={[CITY.plotSize, 0.18, CITY.plotSize]} />
        <meshStandardMaterial color="#56883f" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={parkPathsX} args={[undefined, undefined, PLOTS.filter((p) => p.park).length]} receiveShadow>
        <planeGeometry args={[CITY.plotSize - 0.5, 0.72]} />
        <meshStandardMaterial color="#d2c6a8" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={parkPathsZ} args={[undefined, undefined, PLOTS.filter((p) => p.park).length]} receiveShadow>
        <planeGeometry args={[CITY.plotSize - 0.5, 0.72]} />
        <meshStandardMaterial color="#d2c6a8" roughness={1} />
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

function SelectedPlot({ plot, shape }) {
  const price = purchaseCost(plot, shape);
  const label = useMemo(() => plotPadTexture(price), [price]);
  return (
    <group position={[plot.x, 0.4, plot.z]}>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.025, 0]}>
        <ringGeometry args={[plot.w * 0.46, plot.w * 0.53, 4]} />
        <meshBasicMaterial color="#7CFF1E" toneMapped={false} />
      </mesh>
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
  const shape = useCity((s) => s.buildShape);
  const free = useMemo(() => PLOTS.filter((p) => !p.park && !buildings[p.id]), [buildings]);
  const pads = useRef();
  const edgesX = useRef();
  const edgesZ = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    free.forEach((p, i) => {
      dummy.position.set(p.x, 0.355, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(p.w, p.d, 1);
      dummy.updateMatrix();
      pads.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 0.39, p.z - p.d / 2);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p.w, 1, 1);
      dummy.updateMatrix();
      edgesX.current?.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.z = p.z + p.d / 2;
      dummy.updateMatrix();
      edgesX.current?.setMatrixAt(i * 2 + 1, dummy.matrix);
      dummy.position.set(p.x - p.w / 2, 0.39, p.z);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.scale.set(p.d, 1, 1);
      dummy.updateMatrix();
      edgesZ.current?.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.x = p.x + p.w / 2;
      dummy.updateMatrix();
      edgesZ.current?.setMatrixAt(i * 2 + 1, dummy.matrix);
    });
    [pads, edgesX, edgesZ].forEach((r) => {
      if (r.current) { r.current.instanceMatrix.needsUpdate = true; }
    });
    if (pads.current) pads.current.count = free.length;
    if (edgesX.current) edgesX.current.count = free.length * 2;
    if (edgesZ.current) edgesZ.current.count = free.length * 2;
  }, [free, dummy]);

  const hit = (e) => {
    e.stopPropagation();
    const p = free[e.instanceId];
    if (p) select(p.id);
  };
  const hitEdge = (e) => {
    e.stopPropagation();
    const p = free[Math.floor(e.instanceId / 2)];
    if (p) select(p.id);
  };
  const selectedPlot = free.find((p) => p.id === selected);
  return (
    <group>
      {/* 164+ wolne parcele nadal kosztują tylko 3 draw calle; etykieta pokazuje się po wyborze. */}
      <instancedMesh ref={pads} args={[undefined, undefined, free.length]} onClick={hit}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#00b9d5" transparent opacity={0.18} roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={edgesX} args={[undefined, undefined, free.length * 2]} onClick={hitEdge}>
        <boxGeometry args={[1, 0.07, 0.075]} />
        <meshBasicMaterial color="#00E7FF" transparent opacity={0.86} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={edgesZ} args={[undefined, undefined, free.length * 2]} onClick={hitEdge}>
        <boxGeometry args={[1, 0.07, 0.075]} />
        <meshBasicMaterial color="#00E7FF" transparent opacity={0.86} toneMapped={false} />
      </instancedMesh>
      {selectedPlot && <SelectedPlot plot={selectedPlot} shape={shape} />}
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

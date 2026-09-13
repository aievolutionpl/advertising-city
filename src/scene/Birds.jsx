// Ptaki: trzy stada krążą nad miastem. Jeden instancedMesh = jeden draw call dla całego stada.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CITY } from '../data/city.js';
import { dayRuntime } from './dayRuntime.js';

/** Sylwetka ptaka (dwa skrzydła w literę V) — budowana raz, bez plików. */
function birdGeometry() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0.18, -0.52, 0.14, -0.1, -0.06, 0, 0.26,
    0, 0, 0.18, 0.06, 0, 0.26, 0.52, 0.14, -0.1,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const FLOCKS = [
  { cx: 0, cz: 0, r: 74, h: 42, speed: 0.11, count: 12 },
  { cx: -14, cz: 18, r: 96, h: 52, speed: 0.085, count: 9 },
  { cx: 22, cz: -10, r: 58, h: 34, speed: 0.14, count: 7 },
];

export function Birds() {
  const ref = useRef();
  const geo = useMemo(birdGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2d3540', roughness: 0.8, side: THREE.DoubleSide, flatShading: true,
  }), []);
  const total = FLOCKS.reduce((s, f) => s + f.count, 0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (const f of FLOCKS) {
      for (let k = 0; k < f.count; k++) {
        const phase = (k / f.count) * Math.PI * 2 + f.cx * 0.01;
        const a = t * f.speed + phase;
        const rr = f.r + Math.sin(a * 2.1 + k) * 5;
        const x = f.cx + Math.cos(a) * rr;
        const z = f.cz + Math.sin(a) * rr * 0.82;
        const y = f.h + Math.sin(a * 3.4 + k) * 2.6;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, -a - Math.PI / 2, 0.35 + Math.sin(t * 7 + k) * 0.45);   // machanie skrzydłami
        const s = 1.15 + (k % 3) * 0.18;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        ref.current.setMatrixAt(i++, dummy.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
    // nocą ptaki siadają (gasną w oddali)
    mat.opacity = 0.35 + (1 - dayRuntime.day.night) * 0.6;
    mat.transparent = mat.opacity < 0.95;
  });

  return <instancedMesh ref={ref} args={[geo, mat, total]} frustumCulled={false} />;
}

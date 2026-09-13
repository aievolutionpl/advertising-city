// Realistyczne drzewa i krzaki — instancje (1 draw call na warstwę): pień, korona liściasta, iglak, krzak.
// Liściaste mają 2-3 bryły korony w różnych odcieniach zieleni, więc nie wyglądają jak "kulka na patyku".
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TREES } from '../data/city.js';

const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 1, 7, 1);
const leafGeo = new THREE.IcosahedronGeometry(1, 1);
const coneGeo = new THREE.ConeGeometry(1, 1, 9, 2);
const bushGeo = new THREE.IcosahedronGeometry(1, 0);

const BARK = new THREE.MeshStandardMaterial({ color: '#6b5138', roughness: 0.95 });
const LEAF = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
const PINE = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });
const BUSH = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true });

const GREENS = ['#3f7a34', '#4c8b3a', '#356b2f', '#57953f', '#2f5f2b'];
const PINEG = ['#275536', '#2f6140', '#1f4630'];
const BUSHG = ['#4d8a3f', '#3f7a37', '#5d9a48'];

const rnd = (s) => {
  let n = s;
  return () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
};

export function Trees() {
  const trunks = useRef();
  const broad = useRef();
  const pines = useRef();
  const bushes = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const big = TREES.filter((t) => t.s >= 0.75);
    const small = TREES.filter((t) => t.s < 0.75);
    const broadleaf = big.filter((_, i) => i % 3 !== 2);
    const conifer = big.filter((_, i) => i % 3 === 2);
    return { broadleaf, conifer, small };
  }, []);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    let li = 0;
    // pnie (wszystkie duże drzewa)
    const all = [...data.broadleaf, ...data.conifer];
    all.forEach((t, i) => {
      const r = rnd(i * 977 + 13);
      const h = 3.4 * t.s + r() * 1.2;
      dummy.position.set(t.x, h / 2, t.z);
      dummy.rotation.set((r() - 0.5) * 0.06, r() * Math.PI, (r() - 0.5) * 0.06);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      trunks.current.setMatrixAt(i, dummy.matrix);
    });
    trunks.current.count = all.length;
    trunks.current.instanceMatrix.needsUpdate = true;

    // korony liściaste: 3 bryły na drzewo (niżej szersza, wyżej węższa)
    data.broadleaf.forEach((t, i) => {
      const r = rnd(i * 613 + 7);
      const base = 3.4 * t.s;
      const blobs = [
        [0, base + 1.5 * t.s, 0, 2.05 * t.s],
        [0.85 * t.s, base + 2.5 * t.s, 0.5 * t.s, 1.35 * t.s],
        [-0.7 * t.s, base + 2.9 * t.s, -0.45 * t.s, 1.15 * t.s],
      ];
      blobs.forEach(([ox, oy, oz, rad]) => {
        dummy.position.set(t.x + ox, oy, t.z + oz);
        dummy.rotation.set(r() * 3, r() * 3, r() * 3);
        dummy.scale.set(rad * (1 + r() * 0.18), rad * (0.85 + r() * 0.2), rad * (1 + r() * 0.18));
        dummy.updateMatrix();
        broad.current.setMatrixAt(li, dummy.matrix);
        c.set(GREENS[Math.floor(r() * GREENS.length)]);
        broad.current.setColorAt(li, c);
        li++;
      });
    });
    broad.current.count = li;
    broad.current.instanceMatrix.needsUpdate = true;
    if (broad.current.instanceColor) broad.current.instanceColor.needsUpdate = true;

    // iglaki: 2 stożki (choinka)
    let pi = 0;
    data.conifer.forEach((t, i) => {
      const r = rnd(i * 331 + 29);
      const base = 3.6 * t.s;
      [[base + 1.4 * t.s, 1.5 * t.s, 2.9 * t.s], [base + 3.1 * t.s, 1.05 * t.s, 2.0 * t.s]].forEach(([oy, rad, hh]) => {
        dummy.position.set(t.x, oy, t.z);
        dummy.rotation.set(0, r() * 3, 0);
        dummy.scale.set(rad, hh, rad);
        dummy.updateMatrix();
        pines.current.setMatrixAt(pi, dummy.matrix);
        c.set(PINEG[Math.floor(r() * PINEG.length)]);
        pines.current.setColorAt(pi, c);
        pi++;
      });
    });
    pines.current.count = pi;
    pines.current.instanceMatrix.needsUpdate = true;
    if (pines.current.instanceColor) pines.current.instanceColor.needsUpdate = true;

    // krzaki
    let bi = 0;
    data.small.forEach((t, i) => {
      const r = rnd(i * 197 + 3);
      const rad = 0.5 + t.s * 0.9;
      dummy.position.set(t.x, rad * 0.75, t.z);
      dummy.rotation.set(r(), r() * 3, r());
      dummy.scale.set(rad * 1.25, rad * 0.95, rad * 1.25);
      dummy.updateMatrix();
      bushes.current.setMatrixAt(bi, dummy.matrix);
      c.set(BUSHG[Math.floor(r() * BUSHG.length)]);
      bushes.current.setColorAt(bi, c);
      bi++;
    });
    bushes.current.count = bi;
    bushes.current.instanceMatrix.needsUpdate = true;
    if (bushes.current.instanceColor) bushes.current.instanceColor.needsUpdate = true;
  }, [data, dummy]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[trunkGeo, BARK, 400]} castShadow receiveShadow />
      <instancedMesh ref={broad} args={[leafGeo, LEAF, 900]} castShadow receiveShadow />
      <instancedMesh ref={pines} args={[coneGeo, PINE, 200]} castShadow receiveShadow />
      <instancedMesh ref={bushes} args={[bushGeo, BUSH, 400]} castShadow receiveShadow />
    </group>
  );
}

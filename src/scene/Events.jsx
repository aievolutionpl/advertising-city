// 🎪 Warstwa „co się dzieje": UFO, Człowiek-pająk, balon, drony, parada, targ, muzyk + easter eggi.
// Wszystko napędzane zegarem miejskim (dayRuntime.hours) i czystą logiką z lib/events.js.
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCity } from '../store.js';
import { PLOTS, CITY } from '../data/city.js';
import { dayRuntime } from './dayRuntime.js';
import { playerRuntime } from './playerRuntime.js';
import {
  EASTER_EGGS, abductTrack, balloonTrack, coinPicks, droneShowTrack, eventFeed,
  isActive, paradeTrack, spiderTrack, staticEggs, ufoTrack,
} from '../lib/events.js';

const EXTENT = CITY.extent ?? 84;

const ufoActive = (h) => isActive({ from: 21, to: 4.4 }, h);
const spiderActive = (h) => isActive({ from: 8, to: 20 }, h);
const paradeActive = (h) => isActive({ from: 16, to: 17.6 }, h);
const marketActive = (h) => isActive({ from: 10, to: 14 }, h);
const dronesActive = (h) => isActive({ from: 20.2, to: 22.6 }, h);

/* ── UFO ── */
function ufoGeometry() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#b9c6d2', roughness: 0.35, metalness: 0.7 })));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.6, 0.5, 20),
    new THREE.MeshStandardMaterial({ color: '#8e9aa6', roughness: 0.4, metalness: 0.6 }));
  disc.position.y = -0.1;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.16, 8, 22),
    new THREE.MeshBasicMaterial({ color: '#7CFF1E', toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.35;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

function Ufo() {
  const group = useRef();
  const beam = useRef();
  const cow = useRef();
  const geo = useMemo(() => ufoGeometry(), []);

  useFrame((state) => {
    const h = dayRuntime.hours;
    const on = ufoActive(h);
    if (group.current) group.current.visible = on;
    if (beam.current) beam.current.visible = on;
    if (cow.current) cow.current.visible = on;
    if (!on) return;
    const t = state.clock.elapsedTime;
    const u = ufoTrack(t, 3);
    if (group.current) { group.current.position.set(u.x, u.y, u.z); group.current.rotation.y = u.angle; }
    if (group.current && geo.userData.ring) geo.userData.ring.rotation.z = t * 2.4;
    if (beam.current) {
      const k = u.beam;
      beam.current.visible = k > 0.2;
      beam.current.position.set(u.x, (u.y - 1) / 2, u.z);
      beam.current.scale.set(1, Math.max(0.001, k) / 10, 1);
      beam.current.material.opacity = 0.16 + Math.sin(t * 6) * 0.05;
    }
    const ab = abductTrack(t, 3);
    if (cow.current) {
      cow.current.visible = Boolean(ab);
      if (ab) {
        cow.current.position.set(ab.x + 1.2, ab.y, ab.z - 1);
        cow.current.rotation.z = Math.sin(t * 3) * 0.35;
        cow.current.scale.setScalar(Math.max(0.3, ab.scale));
      }
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={geo} />
      </group>
      <mesh ref={beam} visible={false}>
        <coneGeometry args={[3.4, 10, 18, 1, true]} />
        <meshBasicMaterial color="#7CFF1E" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* „próbka": unoszona krowa */}
      <group ref={cow} visible={false}>
        <mesh castShadow><boxGeometry args={[1.5, 0.9, 0.8]} /><meshStandardMaterial color="#f4f1ea" roughness={0.8} /></mesh>
        <mesh position={[0.95, 0.35, 0]}><boxGeometry args={[0.55, 0.5, 0.55]} /><meshStandardMaterial color="#33302c" roughness={0.8} /></mesh>
      </group>
    </>
  );
}

/* ── Człowiek-pająk ── */
function SpiderHero() {
  const group = useRef();
  const web = useRef();
  const limbs = useRef([]);

  useFrame((state) => {
    const on = spiderActive(dayRuntime.hours);
    if (group.current) group.current.visible = on;
    if (web.current) web.current.visible = on;
    if (!on) return;
    const t = state.clock.elapsedTime;
    const s = spiderTrack(t);
    if (!s) return;
    if (group.current) {
      group.current.position.set(s.x, s.y, s.z);
      group.current.rotation.z = -s.swing * 0.7;
      group.current.rotation.y = t * 0.8;
    }
    if (web.current) {
      const from = new THREE.Vector3(s.x, s.y + 0.9, s.z);
      const to = new THREE.Vector3(s.web.x, s.web.y, s.web.z);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const len = from.distanceTo(to);
      web.current.position.copy(mid);
      web.current.scale.set(1, len, 1);
      web.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    limbs.current.forEach((l, i) => l && (l.rotation.x = Math.sin(t * 4 + i) * 0.35));
  });

  return (
    <>
      <group ref={group} visible={false}>
        <mesh castShadow><capsuleGeometry args={[0.32, 0.7, 6, 12]} /><meshStandardMaterial color="#c0392b" roughness={0.6} /></mesh>
        <mesh position={[0, 0.72, 0]}><sphereGeometry args={[0.26, 14, 12]} /><meshStandardMaterial color="#c0392b" roughness={0.6} /></mesh>
        <mesh position={[0, 0.72, 0.19]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color="#1c2b3a" roughness={0.4} /></mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} ref={(el) => (limbs.current[sx > 0 ? 0 : 1] = el)} position={[sx * 0.34, 0.35, 0]} rotation={[0, 0, sx * 0.4]}>
            <capsuleGeometry args={[0.1, 0.62, 4, 8]} /><meshStandardMaterial color="#22364d" roughness={0.6} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={`l${sx}`} position={[sx * 0.16, -0.62, 0]} rotation={[Math.sin(sx) * 0.2, 0, sx * 0.15]}>
            <capsuleGeometry args={[0.11, 0.6, 4, 8]} /><meshStandardMaterial color="#1b2c40" roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* lina do zakotwiczenia */}
      <mesh ref={web} visible={false}>
        <cylinderGeometry args={[0.035, 0.035, 1, 6]} />
        <meshBasicMaterial color="#e8f6ff" toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </>
  );
}

/* ── Balon ── */
function Balloon() {
  const group = useRef();
  useFrame((state) => {
    const on = isActive({ from: 6.5, to: 19.5 }, dayRuntime.hours);
    if (group.current) group.current.visible = on;
    if (!on) return;
    const b = balloonTrack(state.clock.elapsedTime);
    group.current.position.set(b.x, b.y, b.z);
    group.current.rotation.y = state.clock.elapsedTime * 0.15;
  });
  return (
    <group ref={group} visible={false}>
      <mesh castShadow><sphereGeometry args={[4.4, 18, 14]} /><meshStandardMaterial color="#ff8a3d" roughness={0.5} /></mesh>
      <mesh position={[0, -4.6, 0]}><boxGeometry args={[1.7, 1.4, 1.7]} /><meshStandardMaterial color="#a9784a" roughness={0.9} /></mesh>
      <mesh position={[0, -3.4, 0]}><coneGeometry args={[0.5, 0.9, 8]} /><meshBasicMaterial color="#ffb020" toneMapped={false} /></mesh>
    </group>
  );
}

/* ── Drony (pokaz nocny) ── */
function Drones() {
  const ref = useRef();
  const count = 22;
  useFrame((state) => {
    const on = dronesActive(dayRuntime.hours);
    if (ref.current) ref.current.visible = on;
    if (!on || !ref.current) return;
    const pts = droneShowTrack(state.clock.elapsedTime, count);
    const dummy = new THREE.Object3D();
    pts.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.6 + Math.sin(state.clock.elapsedTime * 5 + i) * 0.15);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]} visible={false} frustumCulled={false}>
      <sphereGeometry args={[0.35, 8, 6]} />
      <meshBasicMaterial color="#00E7FF" toneMapped={false} />
    </instancedMesh>
  );
}

/* ── Parada reklamowa (obwodnica) ── */
function Parade() {
  const ref = useRef();
  useFrame((state) => {
    const on = paradeActive(dayRuntime.hours);
    if (ref.current) ref.current.visible = on;
    if (!on || !ref.current) return;
    const vs = paradeTrack(state.clock.elapsedTime, 5);
    vs.forEach((v, i) => {
      const m = ref.current.children[i];
      if (m) { m.position.set(v.x, 1.1, v.z); m.rotation.y = v.angle; }
    });
  });
  return (
    <group ref={ref} visible={false}>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i}>
          <mesh castShadow><boxGeometry args={[3.2, 2.2, 9]} /><meshStandardMaterial color={i === 0 ? '#ff5da2' : '#f2c14e'} roughness={0.5} /></mesh>
          <mesh position={[0, 1.1, 2.2]}><boxGeometry args={[3.0, 1.4, 3.4]} /><meshStandardMaterial color="#22364d" roughness={0.5} /></mesh>
          <mesh position={[0, 1.3, -2.6]}><planeGeometry args={[2.6, 0.9]} /><meshBasicMaterial color={i % 2 ? '#00E7FF' : '#7CFF1E'} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Targ na skwerze + uliczny muzyk (z ludźmi) ── */
function Market() {
  const ref = useRef();
  const crowd = useRef();
  const stalls = useMemo(() => {
    const out = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ x: Math.cos(a) * 13, z: Math.sin(a) * 13, ry: -a });
    }
    return out;
  }, []);

  useFrame((state) => {
    const market = marketActive(dayRuntime.hours);
    const music = isActive({ from: 15, to: 21 }, dayRuntime.hours);
    if (ref.current) ref.current.visible = market;
    if (crowd.current) {
      crowd.current.visible = market || music;
      if (crowd.current.visible) {
        const n = market ? 16 : 10;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 24; i += 1) {
          const a = (i / 24) * Math.PI * 2 + state.clock.elapsedTime * 0.05;
          const r = i < n ? 9 + Math.sin(i) * 1.4 : 0;
          dummy.position.set(Math.cos(a) * r, 0.9, Math.sin(a) * r);
          dummy.scale.setScalar(r > 0 ? 1 : 0.001);
          dummy.updateMatrix();
          crowd.current.setMatrixAt(i, dummy.matrix);
        }
        crowd.current.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <group ref={ref} visible={false}>
        {stalls.map((s, i) => (
          <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.ry, 0]}>
            <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[3.4, 0.9, 2]} /><meshStandardMaterial color="#c9a37a" roughness={0.9} /></mesh>
            <mesh position={[0, 1.9, 0]} rotation={[0, 0, 0]}><boxGeometry args={[3.8, 0.18, 2.4]} /><meshStandardMaterial color={i % 2 ? '#e8503a' : '#3aa1e8'} roughness={0.7} /></mesh>
            <mesh position={[0, 1.35, 0]}><boxGeometry args={[3.6, 0.7, 0.16]} /><meshStandardMaterial color="#f6f1e6" roughness={0.8} /></mesh>
          </group>
        ))}
      </group>
      <instancedMesh ref={crowd} args={[null, null, 24]} visible={false} frustumCulled={false}>
        <capsuleGeometry args={[0.28, 1.0, 4, 8]} />
        <meshStandardMaterial color="#2f4b63" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

/* ── Monety do zbierania + easter eggi ── */
function Collectibles() {
  const coins = useRef();
  const dayRef = useRef(-1);
  const list = useRef([]);
  const eggs = useRef([]);
  const taken = useRef([]);

  useFrame((state) => {
    const st = useCity.getState();
    const h = dayRuntime.hours;
    const day = Math.floor(h / 24);
    if (dayRef.current !== day) {
      dayRef.current = day;
      list.current = coinPicks(day, 14);
      taken.current = [];
      eggs.current = staticEggs();
      if (coins.current) coins.current.visible = true;
    }
    if (coins.current) {
      const dummy = new THREE.Object3D();
      list.current.forEach((c, i) => {
        const got = taken.current.includes(c.id);
        dummy.position.set(c.x, c.y + Math.sin(state.clock.elapsedTime * 2 + i) * 0.15, c.z);
        dummy.rotation.set(Math.PI / 2, state.clock.elapsedTime * 1.6, 0);
        dummy.scale.setScalar(got ? 0.001 : 1);
        dummy.updateMatrix();
        coins.current.setMatrixAt(i, dummy.matrix);
      });
      coins.current.instanceMatrix.needsUpdate = true;
    }

    /* easter eggi: sprawdzamy bliskość gracza (tylko w spacerze) */
    if (st.mode !== 'walk') return;
    const px = playerRuntime.x;
    const pz = playerRuntime.z;
    const found = [];
    for (const e of eggs.current) if (Math.hypot(e.x - px, e.z - pz) < 5 && !st.player.discovered.includes(e.id)) found.push(e);
    const u = ufoTrack(state.clock.elapsedTime, 3);
    if (ufoActive(h) && Math.hypot(u.x - px, u.z - pz) < 14 && !st.player.discovered.includes('egg-ufo')) found.push({ id: 'egg-ufo', x: u.x, z: u.z });
    const s = spiderActive(h) ? spiderTrack(state.clock.elapsedTime) : null;
    if (s && Math.hypot(s.x - px, s.z - pz) < 12 && !st.player.discovered.includes('egg-spider')) found.push({ id: 'egg-spider', x: s.x, z: s.z });

    for (const f of found) {
      const egg = EASTER_EGGS.find((e) => e.id === f.id);
      if (!egg) continue;
      st.discoverPoi(egg.id, egg.xp);
      playerRuntime.xp += egg.xp;
      st.toastMsg(`🥚 Easter egg: ${egg.name} (+${egg.xp} XP) — ${egg.hint}`);
      playerRuntime.discovered = [...new Set([...playerRuntime.discovered, egg.id])];
    }
  });

  return (
    <instancedMesh ref={coins} args={[null, null, 14]} frustumCulled={false}>
      <cylinderGeometry args={[0.5, 0.5, 0.12, 14]} />
      <meshStandardMaterial color="#ffcf3f" metalness={0.9} roughness={0.25} emissive="#6b4a00" />
    </instancedMesh>
  );
}

/* ── Statyczne eggi: kaczka, kot, graffiti, złota działka ── */
function StaticEggs() {
  const eggs = useMemo(() => staticEggs(), []);
  const cat = useRef();
  const byId = (id) => eggs.find((e) => e.id === id) || { x: 0, y: 0, z: 0 };
  useFrame((state) => {
    if (cat.current) cat.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.5;
  });
  const duck = byId('egg-duck');
  const gat = byId('egg-cat');
  const graf = byId('egg-graffiti');
  const gold = byId('egg-golden');
  return (
    <>
      {/* kaczka w stawie */}
      <group position={[duck.x, duck.y, duck.z]}>
        <mesh castShadow><sphereGeometry args={[0.42, 14, 12]} /><meshStandardMaterial color="#ffd93b" roughness={0.5} /></mesh>
        <mesh position={[0.34, 0.28, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#ffd93b" roughness={0.5} /></mesh>
        <mesh position={[0.52, 0.26, 0]} rotation={[0, 0, -0.2]}><coneGeometry args={[0.09, 0.3, 8]} /><meshStandardMaterial color="#ff8a3d" roughness={0.6} /></mesh>
      </group>
      {/* kot na dachu */}
      <group ref={cat} position={[gat.x, gat.y, gat.z]}>
        <mesh castShadow><capsuleGeometry args={[0.24, 0.6, 4, 10]} rotation={[Math.PI / 2, 0, 0]} /><meshStandardMaterial color="#2b2b31" roughness={0.8} /></mesh>
        <mesh position={[0, 0.3, 0.42]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color="#2b2b31" roughness={0.8} /></mesh>
        <mesh position={[0, 0.56, 0.34]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.07, 0.2, 6]} /><meshStandardMaterial color="#2b2b31" /></mesh>
      </group>
      {/* graffiti JARVIS na ścianie */}
      <group position={[graf.x, graf.y, graf.z]} rotation={[0, Math.PI / 4, 0]}>
        <mesh><planeGeometry args={[6, 3]} /><meshBasicMaterial color="#7CFF1E" transparent opacity={0.28} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      </group>
      {/* złota działka */}
      <group position={[gold.x, 0, gold.z]}>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[3.4, 4.2, 28]} /><meshBasicMaterial color="#ffcf3f" transparent opacity={0.55} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 3.2, 0]}><cylinderGeometry args={[0.22, 0.22, 6.4, 10, 1, true]} /><meshBasicMaterial color="#ffcf3f" transparent opacity={0.4} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      </group>
    </>
  );
}

export function Events() {
  const feed = useRef([]);
  const hour = dayRuntime.hours;
  const f = eventFeed(hour);
  feed.current = f;
  return (
    <group>
      <Ufo />
      <SpiderHero />
      <Balloon />
      <Drones />
      <Parade />
      <Market />
      <Collectibles />
      <StaticEggs />
    </group>
  );
}

export { eventFeed };
export const __eventsDebug = { ufoActive, spiderActive, paradeActive, marketActive, dronesActive, EXTENT };

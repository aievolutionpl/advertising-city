// 🏛️ AI EVOLUTION LABS — wielka siedziba w centrum: ogromna wieża z gigantycznym szyldem,
// pierścieniem holobillboardu, dronami i latarnią na szczycie. Widać ją z każdej dzielnicy.
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLOTS, CITY } from '../data/city.js';
import { facadeMaterial } from './facadeTexture.js';

const CY = '#00E7FF';
const NG = '#7CFF1E';

/** Gigantyczny szyld „AI EVOLUTION LABS” — świeci jak LED, czytelny dniem i nocą. */
function signTexture(text = 'AI EVOLUTION LABS', sub = 'SIEDZIBA GŁÓWNA · AGENT AI', accent = CY) {
  const W = 2048, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04070f');
  g.addColorStop(1, '#08131f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.textAlign = 'center';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 190px "Segoe UI", Arial, sans-serif';
  ctx.fillText(text, W / 2, 250);
  ctx.shadowBlur = 12;
  ctx.fillStyle = NG;
  ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
  ctx.fillText(sub, W / 2, 370);
  // siatka techniczna (detale, żeby szyld nie był płaską plamą)
  ctx.globalAlpha = 0.16;
  for (let x = 0; x < W; x += 64) { ctx.fillStyle = accent; ctx.fillRect(x, 430, 32, 6); }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Miejsce: park w centrum (jak landmark AI LAB), z fallbackiem. */
function hostPlot() {
  return PLOTS.find((p) => p.park && Math.abs(p.x) <= 28 && Math.abs(p.z) <= 28)
    || PLOTS.find((p) => p.park)
    || { x: 0, z: 0, id: 'hq' };
}

export function AiLab() {
  const host = useMemo(hostPlot, []);
  const sign = useMemo(() => signTexture(), []);
  const crown = useRef();
  const ring = useRef();
  const beam = useRef();
  const drones = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const PS = CITY.plotSize ?? 10;

  const matBody = useMemo(() => facadeMaterial({ variant: 2, floors: 9, width: 16, seed: 77 }), []);
  const matTop = useMemo(() => facadeMaterial({ variant: 4, floors: 5, width: 11, seed: 91 }), []);

  useLayoutEffect(() => {
    if (!drones.current) return;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 20, 46 + (i % 3) * 3, Math.sin(a) * 20);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      drones.current.setMatrixAt(i, dummy.matrix);
    }
    drones.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, dt) => {
    if (crown.current) crown.current.rotation.y += dt * 0.35;
    if (ring.current) ring.current.rotation.z += dt * 0.12;
    if (beam.current) {
      const k = 0.75 + Math.sin(performance.now() / 900) * 0.2;
      beam.current.material.opacity = 0.16 * k;
      beam.current.scale.setScalar(1 + Math.sin(performance.now() / 1400) * 0.05);
    }
  });

  return (
    <group position={[host.x + PS * 1.05, 0, host.z]}>
      {/* podest / plaza przed siedzibą */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[26, 0.24, 26]} />
        <meshStandardMaterial color="#c9d2d9" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 13.6]} rotation={[0, 0, 0]}>
        <boxGeometry args={[10, 0.16, 3]} />
        <meshStandardMaterial color={CY} emissive={CY} emissiveIntensity={0.5} />
      </mesh>

      {/* podium + bryła główna (wysoka, z cofnięciami) */}
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[17, 4.8, 17]} />
        <meshStandardMaterial color="#6f7a86" roughness={0.8} metalness={0.15} />
      </mesh>
      <mesh position={[0, 5.5 + 20, 0]} castShadow receiveShadow material={matBody}>
        <boxGeometry args={[15.4, 40, 15.4]} />
      </mesh>
      <mesh position={[0, 5.5 + 40 + 9, 0]} castShadow receiveShadow material={matTop}>
        <boxGeometry args={[10.6, 18, 10.6]} />
      </mesh>
      {/* iglica */}
      <mesh position={[0, 5.5 + 58 + 8, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.5, 16, 8]} />
        <meshStandardMaterial color="#8f9aa6" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* GIGANTYCZNY SZYLD na elewacji frontowej (i drugi z tyłu) */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, 26, s * (15.4 / 2 + 0.4)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
          <mesh position={[0, 0, -0.2]} castShadow>
            <boxGeometry args={[15.2, 6.4, 0.4]} />
            <meshStandardMaterial color="#101720" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh>
            <planeGeometry args={[14.6, 6]} />
            <meshBasicMaterial map={sign} toneMapped={false} />
          </mesh>
          <mesh position={[0, 3.35, 0.1]}>
            <boxGeometry args={[14.6, 0.16, 0.2]} />
            <meshBasicMaterial color={CY} toneMapped={false} />
          </mesh>
          <mesh position={[0, -3.35, 0.1]}>
            <boxGeometry args={[14.6, 0.16, 0.2]} />
            <meshBasicMaterial color={NG} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* pierścień holobillboardu wokół wieży */}
      <mesh ref={ring} position={[0, 44, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[11.6, 0.28, 8, 48]} />
        <meshBasicMaterial color={CY} toneMapped={false} transparent opacity={0.85} />
      </mesh>

      {/* latarnia na szczycie + słup światła */}
      <group ref={crown} position={[0, 5.5 + 58 + 17, 0]}>
        <mesh>
          <sphereGeometry args={[1.1, 18, 14]} />
          <meshBasicMaterial color={NG} toneMapped={false} />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <coneGeometry args={[1.6, 6, 12, 1, true]} />
          <meshBasicMaterial color={NG} transparent opacity={0.14} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh ref={beam} position={[0, 96, 0]}>
        <cylinderGeometry args={[2.2, 3.4, 34, 16, 1, true]} />
        <meshBasicMaterial color={NG} transparent opacity={0.15} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      {/* drony agenta krążące wokół wieży */}
      <instancedMesh ref={drones} args={[null, null, 14]} castShadow>
        <boxGeometry args={[0.7, 0.16, 0.7]} />
        <meshStandardMaterial color="#1b2430" emissive={CY} emissiveIntensity={0.6} />
      </instancedMesh>

      {/* wejście: podświetlony portal + flaga marki */}
      <mesh position={[0, 2.2, 8.7]}>
        <planeGeometry args={[5.4, 4]} />
        <meshBasicMaterial color={CY} transparent opacity={0.22} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 30, 10]} color={CY} intensity={22} distance={40} />
      <pointLight position={[0, 3, 12]} color={NG} intensity={12} distance={22} />
    </group>
  );
}

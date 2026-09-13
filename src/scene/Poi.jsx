// 🗺️ Punkty odkrywania — widoczne w mieście słupy holo z nazwą i nagrodą XP.
// Odkryty punkt zmienia kolor (cyjan → zieleń) i przestaje pulsować: gracz widzi postęp zwiedzania.
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POIS } from '../lib/player.js';
import { playerRuntime } from './playerRuntime.js';

function labelTexture(name, xp) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 160);
  ctx.fillStyle = 'rgba(6,16,28,0.82)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, 496, 144, 26); else ctx.rect(8, 8, 496, 144);
  ctx.fill();
  ctx.strokeStyle = '#00E7FF'; ctx.lineWidth = 6; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
  ctx.fillText(name.length > 22 ? `${name.slice(0, 21)}…` : name, 256, 72);
  ctx.fillStyle = '#7CFF1E';
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`+${xp} XP`, 256, 124);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function Poi() {
  const mats = useRef([]);
  const rings = useRef([]);
  const items = useMemo(() => POIS.map((p) => ({ ...p, tex: labelTexture(p.name, p.xp) })), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    items.forEach((p, i) => {
      const taken = playerRuntime.discovered.includes(p.id);
      const m = mats.current[i];
      if (m) {
        m.color.set(taken ? '#7CFF1E' : '#00E7FF');
        m.opacity = taken ? 0.55 : 0.75 + Math.sin(t * 2.4 + i) * 0.2;
      }
      const r = rings.current[i];
      if (r) {
        r.rotation.z = t * (taken ? 0.2 : 0.9);
        r.scale.setScalar(taken ? 1 : 1 + Math.sin(t * 2 + i) * 0.06);
      }
    });
  });

  return (
    <group>
      {items.map((p, i) => (
        <group key={p.id} position={[p.x, 0, p.z]}>
          {/* słup światła — przesunięty obok środka punktu, żeby nie zasłaniał postaci gracza */}
          <group position={[p.r * 0.8, 0, 0]}>
            <mesh position={[0, 3.2, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 6.4, 12, 1, true]} />
              <meshBasicMaterial ref={(el) => (mats.current[i] = el)} color="#00E7FF" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
            {/* tabliczka z nazwą */}
            <sprite position={[0, 7.2, 0]} scale={[5, 1.56, 1]}>
              <spriteMaterial map={p.tex} transparent depthWrite={false} />
            </sprite>
          </group>
          {/* pierścień na ziemi = promień odkrycia (zostaje w centrum punktu) */}
          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} ref={(el) => (rings.current[i] = el)}>
            <torusGeometry args={[p.r * 0.55, 0.13, 8, 40]} />
            <meshBasicMaterial color={p.kind === 'ai' ? '#7CFF1E' : '#00E7FF'} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

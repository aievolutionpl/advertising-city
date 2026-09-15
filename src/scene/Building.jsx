// Budynek: cokół, parter z witryną i markizą, piętra z siatką okien, gzyms, dach z klimatyzatorami.
// Wygląda jak prawdziwy budynek (nie pudełko), a okna świecą nocą (facadeTexture → applyFacadeNight).
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CITY } from '../data/city.js';
import { useCity } from '../store.js';
import { drawAdCanvas } from '../lib/adTexture.js';
import { emptyAd } from '../lib/economy.js';
import { facadeMaterial, shopWindowMaterial } from './facadeTexture.js';

const FLOOR_H = 3.5;
const GROUND_H = 3.2;

/** Reklama rysowana na canvasie; obraz doładowuje się asynchronicznie → kilka redrawów. */
export function useAdTexture(ad, w = 1024, h = 512) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }, [w, h]);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => {
    const safe = ad || emptyAd();
    const paint = () => {
      drawAdCanvas(safe, canvas, { width: w, height: h });
      texture.needsUpdate = true;
    };
    paint();
    const timers = [140, 520, 1300].map((ms) => setTimeout(paint, ms));
    return () => timers.forEach(clearTimeout);
  }, [ad, canvas, texture, w, h]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

// Kierunek fasady mieszka w lib/cityLogic (czysta funkcja → testy headless bez three/react).
import { facadeYaw } from '../lib/cityLogic.js';
export { facadeYaw };

const hashOf = (s = '') => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 99991;
  return n;
};

/** Dach: klimatyzatory, komin wentylacyjny, antena na wyższych budynkach. */
function Roof({ w, d, tower, tone, variant = 0 }) {
  return (
    <group>
      <mesh position={[w * 0.22, 0.45, -d * 0.18]} castShadow>
        <boxGeometry args={[w * 0.3, 0.9, d * 0.26]} />
        <meshStandardMaterial color="#8d9299" roughness={0.75} metalness={0.25} />
      </mesh>
      <mesh position={[-w * 0.26, 0.35, d * 0.2]} castShadow>
        <boxGeometry args={[w * 0.18, 0.7, d * 0.18]} />
        <meshStandardMaterial color={tone} roughness={0.85} />
      </mesh>
      <mesh position={[-w * 0.1, 0.28, -d * 0.02]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.56, 10]} />
        <meshStandardMaterial color="#a8adb4" roughness={0.7} metalness={0.3} />
      </mesh>
      {tower && (
        <>
          <mesh position={[w * 0.32, 2.4, -d * 0.28]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 4.6, 6]} />
            <meshStandardMaterial color="#6d747c" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[w * 0.32, 4.7, -d * 0.28]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshBasicMaterial color="#ff5f5f" toneMapped={false} />
          </mesh>
        </>
      )}
      {variant % 2 === 0 ? (
        <group position={[-w * 0.18, 0.72, -d * 0.2]} rotation={[0.18, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[Math.max(1.4, w * 0.34), 0.1, Math.max(0.9, d * 0.24)]} />
            <meshStandardMaterial color="#173c55" roughness={0.28} metalness={0.42} />
          </mesh>
          <mesh position={[0, -0.32, 0]} castShadow>
            <boxGeometry args={[0.12, 0.62, 0.12]} />
            <meshStandardMaterial color="#747c82" metalness={0.65} roughness={0.42} />
          </mesh>
        </group>
      ) : (
        <group position={[-w * 0.2, 1.0, -d * 0.18]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.58, 0.68, 1.25, 12]} />
            <meshStandardMaterial color="#66737b" roughness={0.62} metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.85, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.7, 6]} />
            <meshStandardMaterial color="#596168" metalness={0.55} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Building({ b, selected, onSelect }) {
  const setMode = useCity((s) => s.setMode);
  const texture = useAdTexture(b.ad);
  const yaw = useMemo(() => facadeYaw(b.x, b.z, b.plotId || b.id), [b.x, b.z, b.plotId, b.id]);
  const w = (b.w ?? CITY.plotSize) * 0.92;
  const d = (b.d ?? CITY.plotSize) * 0.92;
  const floors = Math.max(1, b.floors || 1);
  const seed = hashOf(b.plotId || b.id);
  const variant = seed % 6;
  const tower = b.style === 'tower' || floors >= 4;
  const accent = b.ad?.accent || (b.owner === 'house' ? '#00E7FF' : '#7CFF1E');

  const upperFloors = Math.max(0, floors - 1);
  const topFloors = tower && upperFloors >= 4 ? 2 : 0;             // cofnięcie najwyższych pięter
  const baseFloors = upperFloors - topFloors;
  const baseH = baseFloors * FLOOR_H;
  const topH = topFloors * FLOOR_H;

  const matBase = useMemo(() => facadeMaterial({ variant, floors: Math.max(1, baseFloors), width: w, seed }), [variant, baseFloors, w, seed]);
  const matTop = useMemo(() => (topFloors ? facadeMaterial({ variant, floors: topFloors, width: w * 0.72, seed: seed + 5 }) : null), [variant, topFloors, w, seed]);
  const matGround = useMemo(() => facadeMaterial({ variant, floors: 1, width: w, seed: seed + 3 }), [variant, w, seed]);

  const yPlint = 0.25;
  const yGround = 0.5 + GROUND_H / 2;
  const yTopOfGround = 0.5 + GROUND_H;
  const bodyTop = yTopOfGround + baseH + topH;

  // billboard: na elewacji frontowej, wyżej dla wyższych budynków
  const bh = Math.max(2.4, Math.min(4.0, w * 0.46));
  const bw = Math.min(w * 0.96, bh * 2.3);
  const by = Math.min(bodyTop - bh * 0.5 - 0.6, Math.max(3.6, bodyTop * 0.68));

  return (
    <group
      name={`budynek-${variant}-${b.plotId || b.id}`}
      position={[b.x, 0.34, b.z]}
      rotation={[0, yaw, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(b.plotId); }}
      onDoubleClick={(e) => { e.stopPropagation(); onSelect(b.plotId); setMode('walk'); }}
    >
      {/* cokół + stopnie wejściowe */}
      <mesh position={[0, yPlint, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.85, 0.5, d + 0.85]} />
        <meshStandardMaterial color="#6c6961" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.62, d / 2 + 0.55]} receiveShadow>
        <boxGeometry args={[w * 0.5, 0.24, 0.9]} />
        <meshStandardMaterial color="#8b8880" roughness={0.95} />
      </mesh>

      {/* parter: witryna + wejście + markiza */}
      <mesh position={[0, yGround, 0]} castShadow receiveShadow material={matGround}>
        <boxGeometry args={[w, GROUND_H, d]} />
      </mesh>
      <mesh position={[0, 1.75, d / 2 + 0.07]}>
        <boxGeometry args={[w * 0.8, 1.9, 0.14]} />
        <primitive object={shopWindowMaterial} attach="material" />
      </mesh>
      {/* wejście w ramie i daszek: głębokość daje czytelny front także z kamery ulicznej */}
      <mesh name="portal-wejsciowy" position={[-w * 0.33, 1.55, d / 2 + 0.18]} castShadow>
        <boxGeometry args={[1.32, 2.45, 0.2]} />
        <meshStandardMaterial color="#c6bda9" roughness={0.82} />
      </mesh>
      <mesh position={[-w * 0.33, 1.5, d / 2 + 0.31]} castShadow>
        <boxGeometry args={[0.88, 1.98, 0.08]} />
        <meshStandardMaterial color="#303943" roughness={0.34} metalness={0.28} />
      </mesh>
      <mesh position={[-w * 0.33, 2.9, d / 2 + 0.72]} rotation={[0.16, 0, 0]} castShadow>
        <boxGeometry args={[1.75, 0.12, 1.15]} />
        <meshStandardMaterial color={accent} roughness={0.48} metalness={0.12} />
      </mesh>
      <mesh position={[0, 2.82, d / 2 + 0.62]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[w * 0.94, 0.14, 1.25]} />
        <meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
      {/* kaseton z nazwą nad witryną */}
      <mesh position={[0, yTopOfGround - 0.42, d / 2 + 0.1]} castShadow>
        <boxGeometry args={[w * 0.78, 0.62, 0.18]} />
        <meshStandardMaterial color="#22262d" roughness={0.6} metalness={0.25} />
      </mesh>

      {/* piętra */}
      {baseFloors > 0 && (
        <mesh position={[0, yTopOfGround + baseH / 2, 0]} castShadow receiveShadow material={matBase}>
          <boxGeometry args={[w - 0.35, baseH, d - 0.35]} />
        </mesh>
      )}
      {topFloors > 0 && (
        <mesh position={[0, yTopOfGround + baseH + topH / 2, 0]} castShadow receiveShadow material={matTop}>
          <boxGeometry args={[w * 0.72, topH, d * 0.72]} />
        </mesh>
      )}

      {/* pilastry narożne — budynek przestaje być pudełkiem */}
      {[-1, 1].map((s) => (
        <mesh key={`col${s}`} position={[s * (w / 2 - 0.42), yTopOfGround + baseH / 2, d / 2 - 0.28]} castShadow>
          <boxGeometry args={[0.55, Math.max(baseH, 2), 0.5]} />
          <meshStandardMaterial color="#b9b2a4" roughness={0.85} />
        </mesh>
      ))}

      {/* Dwa lekkie warianty bryły: balkony albo pionowy wykusz. Stała liczba meshy na budynek. */}
      {baseFloors >= 2 && variant % 2 === 0 && (
        <group name="balkony-fasadowe">
          {[0.34, 0.7].map((level, i) => (
            <group key={level} position={[w * 0.23 * (i ? -1 : 1), yTopOfGround + baseH * level, d / 2 + 0.48]}>
              <mesh castShadow>
                <boxGeometry args={[w * 0.3, 0.16, 0.95]} />
                <meshStandardMaterial color="#c9c3b7" roughness={0.86} />
              </mesh>
              <mesh position={[0, 0.48, 0.4]} castShadow>
                <boxGeometry args={[w * 0.3, 0.72, 0.07]} />
                <meshStandardMaterial color="#6f7c82" roughness={0.34} metalness={0.38} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {baseFloors >= 2 && variant % 2 === 1 && (
        <mesh name="pionowy-wykusz" position={[w * 0.27, yTopOfGround + baseH / 2, d / 2 + 0.32]} castShadow>
          <boxGeometry args={[w * 0.24, baseH * 0.86, 0.62]} />
          <primitive object={shopWindowMaterial} attach="material" />
        </mesh>
      )}

      {/* gzyms + attyka */}
      <mesh position={[0, bodyTop + 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.5, 0.4, d + 0.5]} />
        <meshStandardMaterial color="#8f887b" roughness={0.9} />
      </mesh>
      <mesh position={[0, bodyTop + 0.65, 0]} castShadow>
        <boxGeometry args={[w - 0.3, 0.5, d - 0.3]} />
        <meshStandardMaterial color="#7d766a" roughness={0.95} />
      </mesh>

      {/* dach */}
      <group position={[0, bodyTop + 0.9, 0]}>
        <Roof w={tower ? w * 0.7 : w} d={tower ? d * 0.7 : d} tower={tower} tone="#9a9488" variant={variant} />
      </group>

      {/* billboard na fasadzie — świeci jak LED, więc tekst jest czytelny o każdej porze */}
      <group position={[0, by, d / 2 + 0.16]}>
        <mesh position={[0, 0, -0.14]} castShadow>
          <boxGeometry args={[bw + 0.36, bh + 0.36, 0.26]} />
          <meshStandardMaterial color="#1d2128" roughness={0.7} metalness={0.35} />
        </mesh>
        <mesh>
          <planeGeometry args={[bw, bh]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {/* oprawa LED */}
        <mesh position={[0, bh / 2 + 0.34, 0]}>
          <boxGeometry args={[bw, 0.12, 0.16]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
        <mesh position={[0, -(bh / 2 + 0.34), 0]}>
          <boxGeometry args={[bw, 0.12, 0.16]} />
          <meshBasicMaterial color={accent} toneMapped={false} />
        </mesh>
      </group>

      {/* pionowy szyld — detal dla niskich budynków */}
      {floors <= 2 && (
        <mesh position={[w / 2 + 0.12, 3.9, d * 0.12]} castShadow>
          <boxGeometry args={[0.2, 3.6, 0.85]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
      )}
      {selected && <pointLight position={[0, bodyTop + 1.4, 0]} color="#7CFF1E" intensity={9} distance={15} />}
    </group>
  );
}

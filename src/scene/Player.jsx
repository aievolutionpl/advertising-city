// 🎮 Postać gracza w mieście: trzecioosobowa, z animacją chodu, skokiem, odkrywaniem punktów.
// Cała fizyka siedzi w lib/player.js (czysta), tutaj tylko wpięcie w klatkę i model 3D.
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCity } from '../store.js';
import { CITY } from '../data/city.js';
import { POIS, PHYS, approach, applyDiscoveries, characterById, checkDiscoveries, levelOf, nearestPoi, stepVertical, turnTo } from '../lib/player.js';
import { safeSpawn, stepPlayer, WALK } from '../lib/cityLogic.js';
import { input, consumeLook, movementVector, resetInput } from './input.js';
import { playerRuntime, resetPlayerRuntime } from './playerRuntime.js';
import { debugState } from './debug.js';

/** Nazwa postaci nad głową — czytelna plakietka (gracz wie, kim gra). */
function makeTagTexture(name, accent) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(8,18,30,0.82)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(4, 4, 248, 56, 16) : ctx.rect(4, 4, 248, 56);
  ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#eaf8ff';
  ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function Player() {
  const mode = useCity((s) => s.mode);
  const charId = useCity((s) => s.charId);
  const setPlayerState = useCity((s) => s.setPlayerState);
  const discoverPoi = useCity((s) => s.discoverPoi);
  const toastMsg = useCity((s) => s.toastMsg);
  const buildings = useCity((s) => s.buildings);

  const char = useMemo(() => characterById(charId), [charId]);
  const tag = useMemo(() => makeTagTexture(char.name, char.palette.accent), [char.name, char.palette.accent]);
  const group = useRef();
  const body = useRef();
  const shadow = useRef();
  const legs = useRef([]);
  const arms = useRef([]);
  const sync = useRef(0);

  const list = useMemo(() => Object.values(buildings).map((b) => ({
    x: b.x, z: b.z, w: b.w ?? CITY.plotSize, d: b.d ?? CITY.plotSize,
  })), [buildings]);
  const listRef = useRef(list);
  listRef.current = list;

  /* start: postać pojawia się w wolnym miejscu, nie w budynku */
  useEffect(() => {
    const sp = safeSpawn(listRef.current);
    playerRuntime.x = sp.x; playerRuntime.z = sp.z;
    playerRuntime.charId = charId;
    resetPlayerRuntime(charId);
    const saved = useCity.getState().player;
    playerRuntime.xp = saved?.xp || 0;
    playerRuntime.discovered = [...(saved?.discovered || [])];
  }, [charId]);

  /* skok z klawiatury (spacja) — UI mobilne ustawia playerRuntime.want.jump */
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && useCity.getState().mode === 'walk') { playerRuntime.want.jump = true; e.preventDefault(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;
    const active = mode === 'walk';
    const inCar = !!playerRuntime.driving;                  // w aucie: postać znika, ruch przejmuje samochód
    g.visible = active && !inCar;
    if (!active || inCar) { playerRuntime.speed = 0; playerRuntime.moving = false; if (inCar) resetInput(); return; }

    /* 1. rozglądanie (mysz / przeciągnięcie palcem) */
    const look = consumeLook();
    playerRuntime.yaw -= look.dx * 0.00225;
    // Dolny limit utrzymuje kamerę ponad barkiem zamiast w modelu postaci.
    playerRuntime.pitch = Math.max(-0.32, Math.min(0.65, playerRuntime.pitch - look.dy * 0.00165));

    /* 2. ruch poziomy — kolizje z budynkami (śliskość po ścianie) */
    const mv = movementVector();
    const running = (input.run || playerRuntime.want.run) && (mv.x || mv.z);
    const speed = (running ? PHYS.run : PHYS.walk) * char.speed;
    const sinY = Math.sin(playerRuntime.yaw);
    const cosY = Math.cos(playerRuntime.yaw);
    // forward = (sin yaw, cos yaw); mv.z = -1 dla W (konwencja three), przechodzi na +forward
    const wantedX = mv.x * cosY - mv.z * sinY;
    const wantedZ = -mv.x * sinY - mv.z * cosY;
    // Krótkie rozpędzenie wygładza zmianę kierunku, ale puszczenie sterowania
    // hamuje szybciej — na ekranowym D-padzie postać nie „odpływa”.
    const braking = mv.x === 0 && mv.z === 0;
    const response = braking ? PHYS.accel * 2.6 : PHYS.accel * 1.35;
    playerRuntime.moveX = approach(playerRuntime.moveX, wantedX, dt, response);
    playerRuntime.moveZ = approach(playerRuntime.moveZ, wantedZ, dt, response);
    if (braking && Math.hypot(playerRuntime.moveX, playerRuntime.moveZ) < 0.025) {
      playerRuntime.moveX = 0; playerRuntime.moveZ = 0;
    }
    const dirX = playerRuntime.moveX;
    const dirZ = playerRuntime.moveZ;
    const res = stepPlayer({ x: playerRuntime.x, z: playerRuntime.z }, dirX, dirZ, dt, listRef.current, speed);
    const travelled = Math.hypot(res.x - playerRuntime.x, res.z - playerRuntime.z);
    playerRuntime.x = res.x; playerRuntime.z = res.z;
    playerRuntime.speed = travelled / dt;
    playerRuntime.moving = travelled > dt * 0.4;
    playerRuntime.running = running && playerRuntime.moving;

    if (Math.abs(playerRuntime.x) > WALK.wrap || Math.abs(playerRuntime.z) > WALK.wrap) {
      const sp = safeSpawn(listRef.current);
      playerRuntime.x = sp.x; playerRuntime.z = sp.z;
    }

    /* 3. skok i grawitacja (postać realnie spada, nie „unosi się") */
    const wantJump = playerRuntime.want.jump;
    playerRuntime.want.jump = false;
    const v = stepVertical(playerRuntime, dt, wantJump);
    playerRuntime.y = v.y; playerRuntime.vy = v.vy; playerRuntime.grounded = v.grounded;

    /* 4. model: pozycja, zwrot w stronę ruchu, animacja chodu/biegu */
    g.position.set(playerRuntime.x, playerRuntime.y, playerRuntime.z);
    const targetYaw = playerRuntime.moving ? Math.atan2(dirX, dirZ) : playerRuntime.yaw;
    // model ma twarz na +Z, więc zwrot = atan2(dirX, dirZ); kamera jedzie za plecami (F = (sin yaw, cos yaw))
    body.current.rotation.y = turnTo(body.current.rotation.y, targetYaw, dt);
    // grupa zewnętrzna NIE obraca się (0): zwrot ciała liczy osobno rotacja `body`,
    // inaczej dodawał się drugi obrót i postać odwracała się przodem do kamery.
    g.rotation.y = 0;

    const cadence = playerRuntime.running ? 13 : 8.4;
    if (playerRuntime.moving && playerRuntime.grounded) playerRuntime.anim += dt * cadence;
    const swing = playerRuntime.moving ? (playerRuntime.running ? 0.95 : 0.62) : 0;
    const s = Math.sin(playerRuntime.anim) * swing;
    const bob = playerRuntime.grounded ? Math.abs(Math.sin(playerRuntime.anim)) * (playerRuntime.running ? 0.09 : 0.05) : 0;
    if (body.current) body.current.position.y = bob;
    if (shadow.current) {                          // cień maleje i blednie, gdy postać skacze
      const k = Math.max(0.25, 1 - playerRuntime.y * 0.35);
      shadow.current.scale.setScalar(k);
      shadow.current.material.opacity = 0.34 * k;
    }
    legs.current.forEach((l, i) => l && (l.rotation.x = i === 0 ? s : -s));
    arms.current.forEach((a, i) => a && (a.rotation.x = i === 0 ? -s * 0.8 : s * 0.8));
    if (!playerRuntime.moving) {
      playerRuntime.anim += dt * 1.6;              // lekki oddech w bezruchu
      arms.current.forEach((a) => a && (a.rotation.x = Math.sin(playerRuntime.anim) * 0.04));
    }
    // w powietrzu: ręce w górę (czytelny skok)
    if (!playerRuntime.grounded) arms.current.forEach((a) => a && (a.rotation.x = -2.1));

    /* 5. odkrywanie punktów miasta + XP */
    const found = checkDiscoveries(playerRuntime.discovered, playerRuntime.x, playerRuntime.z, POIS);
    if (found.length) {
      const prev = { discovered: playerRuntime.discovered, xp: playerRuntime.xp };
      const next = applyDiscoveries(prev, found);
      playerRuntime.discovered = next.discovered;
      playerRuntime.xp = next.xp;
      for (const p of found) {
        discoverPoi?.(p.id, p.xp);
        toastMsg?.(`🗺️ Odkryto: ${p.name} (+${p.xp} XP)`);
      }
      if (next.levelUp) toastMsg?.(`⭐ Awans! Poziom ${next.levelUp} — ${levelOf(next.xp).title}`);
      setPlayerState?.({ xp: next.xp, discovered: next.discovered, x: playerRuntime.x, z: playerRuntime.z, yaw: playerRuntime.yaw });
    }

    /* 6. HUD/UI dostaje stan ~3×/s (bez re-renderów w każdej klatce) */
    sync.current += dt;
    if (sync.current > 0.34) {
      sync.current = 0;
      const near = nearestPoi(POIS, playerRuntime.x, playerRuntime.z);
      setPlayerState?.({
        x: playerRuntime.x, z: playerRuntime.z, yaw: playerRuntime.yaw, y: playerRuntime.y,
        xp: playerRuntime.xp, discovered: playerRuntime.discovered,
        speed: playerRuntime.speed, running: playerRuntime.running, grounded: playerRuntime.grounded,
        nearest: near.poi ? { id: near.poi.id, name: near.poi.name, distance: Math.round(near.distance) } : null,
      });
    }

    debugState.player = {
      ...debugState.player, mode, charId, x: +playerRuntime.x.toFixed(2), z: +playerRuntime.z.toFixed(2),
      y: +playerRuntime.y.toFixed(2), yaw: +playerRuntime.yaw.toFixed(3), grounded: playerRuntime.grounded,
      xp: playerRuntime.xp, discovered: playerRuntime.discovered.length,
    };
    state.camera.fov = playerRuntime.running ? 76 : 71;
    state.camera.updateProjectionMatrix();
  });

  const p = char.palette;
  return (
    <group ref={group} visible={false}>
      {/* miękki cień pod postacią — czytelny nawet tam, gdzie cienie renderera są słabe */}
      <mesh ref={shadow} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 20]} />
        <meshBasicMaterial color="#0b1622" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <group ref={body}>
        {/* nogi + buty */}
        {[-0.17, 0.17].map((x, i) => (
          <group key={i} position={[x, 0.9, 0]} ref={(el) => (legs.current[i] = el)}>
            <mesh position={[0, -0.45, 0]} castShadow>
              <boxGeometry args={[0.22, 0.9, 0.26]} />
              <meshStandardMaterial color={p.pants} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.92, 0.05]} castShadow>
              <boxGeometry args={[0.26, 0.14, 0.42]} />
              <meshStandardMaterial color={p.shoe} roughness={0.7} />
            </mesh>
          </group>
        ))}
        {/* tors: klatka piersiowa + kurtka + pas (realistyczniejsza sylwetka) */}
        <mesh position={[0, 1.34, 0]} castShadow>
          <boxGeometry args={[0.62, 0.86, 0.36]} />
          <meshStandardMaterial color={p.shirt} roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.62, 0.02]} castShadow>
          <boxGeometry args={[0.72, 0.24, 0.4]} />
          <meshStandardMaterial color={p.shirt} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.02, 0]} castShadow>
          <boxGeometry args={[0.5, 0.24, 0.34]} />
          <meshStandardMaterial color={p.pants} roughness={0.85} />
        </mesh>
        {/* kołnierz */}
        <mesh position={[0, 1.76, 0.02]}>
          <boxGeometry args={[0.34, 0.1, 0.3]} />
          <meshStandardMaterial color={p.accent} roughness={0.6} />
        </mesh>
        {/* szyja */}
        <mesh position={[0, 1.84, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.14, 10]} />
          <meshStandardMaterial color={p.skin} roughness={0.72} />
        </mesh>
        {/* akcent marki na piersi */}
        <mesh position={[0, 1.42, 0.19]}>
          <boxGeometry args={[0.3, 0.12, 0.03]} />
          <meshBasicMaterial color={p.accent} toneMapped={false} />
        </mesh>
        {/* ręce */}
        {[-0.42, 0.42].map((x, i) => (
          <group key={i} position={[x, 1.66, 0]} ref={(el) => (arms.current[i] = el)}>
            <mesh position={[0, -0.4, 0]} castShadow>
              <boxGeometry args={[0.18, 0.82, 0.22]} />
              <meshStandardMaterial color={p.shirt} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.83, 0]} castShadow>
              <sphereGeometry args={[0.11, 10, 8]} />
              <meshStandardMaterial color={p.skin} roughness={0.75} />
            </mesh>
          </group>
        ))}
        {/* głowa + włosy + oczy + rysy twarzy */}
        <mesh position={[0, 2.0, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 16]} />
          <meshStandardMaterial color={p.skin} roughness={0.72} />
        </mesh>
        {/* żuchwa (owal twarzy zamiast kuli) */}
        <mesh position={[0, 1.9, 0.02]} castShadow>
          <boxGeometry args={[0.26, 0.16, 0.3]} />
          <meshStandardMaterial color={p.skin} roughness={0.72} />
        </mesh>
        <mesh position={[0, 2.08, -0.02]} castShadow>
          <sphereGeometry args={[0.235, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
          <meshStandardMaterial color={p.hair} roughness={0.9} />
        </mesh>
        {/* grzywka */}
        <mesh position={[0, 2.14, 0.16]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.34, 0.16, 0.12]} />
          <meshStandardMaterial color={p.hair} roughness={0.9} />
        </mesh>
        {/* uszy */}
        {[-0.215, 0.215].map((x, i) => (
          <mesh key={i} position={[x, 2.0, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={p.skin} roughness={0.75} />
          </mesh>
        ))}
        {/* nos */}
        <mesh position={[0, 1.97, 0.21]}>
          <boxGeometry args={[0.06, 0.07, 0.06]} />
          <meshStandardMaterial color={p.skin} roughness={0.7} />
        </mesh>
        {[-0.09, 0.09].map((x, i) => (
          <mesh key={i} position={[x, 2.0, 0.2]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#182430" />
          </mesh>
        ))}
        {/* brwi */}
        {[-0.09, 0.09].map((x, i) => (
          <mesh key={i} position={[x, 2.07, 0.19]}>
            <boxGeometry args={[0.1, 0.02, 0.03]} />
            <meshStandardMaterial color={p.hair} roughness={0.9} />
          </mesh>
        ))}
        {/* plakietka z imieniem */}
        <sprite position={[0, 2.52, 0]} scale={[1.1, 0.28, 1]}>
          <spriteMaterial map={tag} transparent depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}

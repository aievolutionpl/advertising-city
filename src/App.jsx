import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCity } from './store.js';
import { Sky, Lights, CameraRig, DayDriver } from './scene/Scene.jsx';
import { Ground, FreePlots, SelectionRing } from './scene/Ground.jsx';
import { Trees } from './scene/Trees.jsx';
import { Birds } from './scene/Birds.jsx';
import { Building } from './scene/Building.jsx';
import { Cars, Pedestrians } from './scene/Actors.jsx';
import { Lamps } from './scene/Lamps.jsx';
import { Props } from './scene/Props.jsx';
import { AiLab } from './scene/AiLab.jsx';
import { Vehicles, driveWant } from './scene/Vehicle.jsx';
import { FrameBeacon } from './ui/SceneGate.jsx';
import { Events } from './scene/Events.jsx';
import { useDevice } from './ui/useDevice.js';
import { EASTER_EGGS } from './lib/events.js';
import { Player } from './scene/Player.jsx';
import { Poi } from './scene/Poi.jsx';
import { playerRuntime } from './scene/playerRuntime.js';
import { POIS, CHARACTERS } from './lib/player.js';
import { Dogs, Cats, Pigeons } from './scene/Animals.jsx';
import { Hud, Intro, Toast, ClauseBar } from './ui/Hud.jsx';
import { Panel } from './ui/Panel.jsx';
import { AiPanel } from './ui/AiPanel.jsx';
import { Dpad } from './ui/Dpad.jsx';
import { CITY, PLOTS, TREES } from './data/city.js';
import { debugState } from './scene/debug.js';

function Buildings() {
  const buildings = useCity((s) => s.buildings);
  const selected = useCity((s) => s.selected);
  const select = useCity((s) => s.select);
  const list = useMemo(() => Object.values(buildings), [buildings]);
  const sel = selected ? buildings[selected] : null;
  return (
    <>
      {list.map((b) => (
        <Building key={b.plotId} b={b} selected={selected === b.plotId} onSelect={select} />
      ))}
      {sel && <SelectionRing x={sel.x} z={sel.z} size={CITY.plotSize} />}
    </>
  );
}

/** Miernik klatek + draw calls → debugState (E2E czyta stąd, nie z „canvas istnieje”). */
function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, n: 0 });
  useFrame((state, dt) => {
    acc.current.t += dt;
    acc.current.n += 1;
    debugState.frames += 1;
    if (acc.current.t >= 1) {
      debugState.fps = Math.round(acc.current.n / acc.current.t);
      acc.current = { t: 0, n: 0 };
      debugState.calls = gl.info.render.calls;
      debugState.triangles = gl.info.render.triangles;
      debugState.ready = true;
    }
  });
  return null;
}

export default function App() {
  const dev = useDevice();
  const devRef = useRef(dev);
  devRef.current = dev;
  const started = useCity((s) => s.started);
  const buildings = useCity((s) => s.buildings);
  const mode = useCity((s) => s.mode);

  /* tick ekonomii biernej + start hooka E2E */
  useEffect(() => {
    useCity.getState().tick();
    const id = setInterval(() => useCity.getState().tick(), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    debugState.buildings = Object.keys(buildings).length;
    debugState.trees = TREES.length;
    debugState.cars = 16;
    debugState.pedestrians = 40;
  }, [buildings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__test = {
      state: () => {
        const s = useCity.getState();
        return {
          coins: s.coins,
          mode: s.mode,
          selected: s.selected,
          started: s.started,
          buildings: Object.values(s.buildings).map((b) => ({
            plotId: b.plotId, owner: b.owner, floors: b.floors, style: b.style, ad: b.ad,
          })),
        };
      },
      player: () => ({ ...debugState.player }),
      walk: () => ({
        x: +playerRuntime.x.toFixed(2), z: +playerRuntime.z.toFixed(2), y: +playerRuntime.y.toFixed(2),
        yaw: +playerRuntime.yaw.toFixed(3), pitch: +playerRuntime.pitch.toFixed(3),
        xp: playerRuntime.xp, discovered: [...playerRuntime.discovered], grounded: playerRuntime.grounded,
        moving: playerRuntime.moving, speed: +playerRuntime.speed.toFixed(2), charId: playerRuntime.charId,
      }),
      teleport: (x, z, yaw) => { playerRuntime.x = x; playerRuntime.z = z; if (yaw !== undefined) playerRuntime.yaw = yaw; },
      jump: () => { playerRuntime.want.jump = true; },
      eggs: () => EASTER_EGGS.map((e) => ({ id: e.id, name: e.name, xp: e.xp })),
      device: () => ({ ...devRef.current }),
      pois: () => POIS.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, r: p.r, xp: p.xp })),
      characters: () => CHARACTERS.map((c) => ({ id: c.id, name: c.name, role: c.role, speed: c.speed })),
      setChar: (id) => useCity.getState().setChar(id),
      store: () => useCity.getState(),
      freePlots: () => PLOTS.filter((p) => !p.park && !useCity.getState().buildings[p.id]).map((p) => p.id),
      day: () => ({ ...(debugState.day || {}) }),
      stats: () => ({
        fps: debugState.fps, calls: debugState.calls, triangles: debugState.triangles,
        frames: debugState.frames, ready: debugState.ready,
        camera: debugState.camera ? { ...debugState.camera } : null,
        day: debugState.day ? { ...debugState.day } : null,
      }),
      setHours: (h) => useCity.getState().setHours(h),
      setTimeSpeed: (s) => useCity.getState().setTimeSpeed(s),
      free: () => PLOTS.filter((p) => !p.park && !useCity.getState().buildings[p.id]).map((p) => ({ id: p.id, district: p.district })),
      plots: () => PLOTS.map((p) => ({ id: p.id, park: p.park, district: p.district })),
      select: (id) => useCity.getState().select(id),
      buy: (id) => useCity.getState().buy(id),
      upgrade: (id) => useCity.getState().upgrade(id),
      setAd: (id, patch) => useCity.getState().updateAd(id, patch),
      setMode: (m) => useCity.getState().setMode(m),
      car: () => window.__car?.state() || null,
      cars: () => window.__car?.cars() || [],
      enterCar: () => window.__car?.enter(),
      summonCar: () => window.__car?.summon(),
      exitCar: () => window.__car?.exit(),
      drive: () => useCity.getState().drive,
      setDay: (h) => useCity.getState().setDayOverride(h),
      setShape: (s) => useCity.getState().setBuildShape(s),
      buyShape: (id, shape) => { useCity.getState().setBuildShape(shape); useCity.getState().buy(id); },
      reset: () => useCity.getState().resetCity(),
      export: () => useCity.getState().exportJson(),
      import: (json) => useCity.getState().importJson(json),
    };
  }, []);

  return (
    <div className={`app ${mode === 'walk' ? 'walk-mode' : 'city-mode'}`}>
      <Canvas
        shadows={!dev.lowPower}
        dpr={dev.lowPower ? [1, 1.25] : [1, 1.75]}
        gl={{ antialias: !dev.lowPower, powerPreference: 'high-performance' }}
        camera={{ fov: 46, position: [72, 64, 86], near: 0.4, far: 620 }}
        onPointerMissed={() => useCity.getState().select(null)}
      >
        <color attach="background" args={['#dae9f4']} />
        <Sky />
        <Lights />
        <DayDriver />
        <CameraRig />
        <Ground />
        <Trees />
        <Birds />
        <Lamps />
        <Props />
        <AiLab />
        <FreePlots />
        <Buildings />
        <Cars />
        <Pedestrians />
        <Poi />
        <Events />
        <FrameBeacon lowPower={dev.lowPower} />
        <Vehicles />
        <Player />
        <group scale={1.35}>
          <Dogs />
          <Cats />
          <Pigeons />
        </group>
        <PerfProbe />
      </Canvas>

      <Hud />
      {!started && <Intro />}
      {started && mode === 'walk' && (dev.touch || dev.w <= 1100) && <Dpad />}
      {started && <Panel />}
      {started && <AiPanel />}
      <Toast />
      <ClauseBar />
    </div>
  );
}

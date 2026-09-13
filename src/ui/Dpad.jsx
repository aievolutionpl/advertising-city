// Stałe sterowanie POV na telefonie/tablecie: ruch wielodotykowy bez „zaciętych” osi.
import React, { useEffect, useRef } from 'react';
import { input } from '../scene/input.js';

const DIR = { forward: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] };

function ArrowIcon({ direction }) {
  const rotate = { forward: 0, right: 90, back: 180, left: -90 }[direction];
  return (
    <svg className="dpad-icon" viewBox="0 0 32 32" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M16 4 5.5 15h6.2v12h8.6V15h6.2L16 4Z" fill="currentColor" />
      <path d="M16 7.5 9.6 14h4.1v11h4.6V14h4.1L16 7.5Z" fill="rgba(3,12,18,.32)" />
    </svg>
  );
}

export function Dpad() {
  const active = useRef(new Map());

  const sync = () => {
    let x = 0; let z = 0;
    for (const key of active.current.values()) { x += DIR[key][0]; z += DIR[key][1]; }
    input.axes.x = Math.max(-1, Math.min(1, x));
    input.axes.z = Math.max(-1, Math.min(1, z));
  };
  const releaseAll = () => { active.current.clear(); input.axes.x = 0; input.axes.z = 0; input.run = false; };

  useEffect(() => {
    const stop = () => releaseAll();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); releaseAll(); };
  }, []);

  const press = (key) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    active.current.set(e.pointerId, key);
    sync();
  };
  const release = (e) => {
    e.preventDefault();
    active.current.delete(e.pointerId);
    sync();
  };
  const directionButton = (key, label, area) => (
    <button className={`dpad-btn dpad-${key}`} style={{ gridArea: area }}
      onPointerDown={press(key)} onPointerUp={release} onPointerCancel={release}
      onLostPointerCapture={release} aria-label={label} data-control={key}>
      <ArrowIcon direction={key} /><span>{label}</span>
    </button>
  );
  const run = (on) => (e) => {
    e.preventDefault();
    if (on) e.currentTarget.setPointerCapture?.(e.pointerId);
    input.run = on;
  };

  return (
    <section className="dpad-wrap" aria-label="Sterowanie ruchem POV">
      <div className="dpad">
        {directionButton('forward', 'PRZÓD', 'u')}
        {directionButton('left', 'LEWO', 'l')}
        <button className="dpad-btn dpad-run" style={{ gridArea: 'c' }}
          onPointerDown={run(true)} onPointerUp={run(false)} onPointerCancel={run(false)}
          onLostPointerCapture={run(false)} aria-label="Bieg" data-control="run">
          <svg className="dpad-icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="m18 2-9 15h6l-2 13 10-17h-6l1-11Z" /></svg><span>BIEG</span>
        </button>
        {directionButton('right', 'PRAWO', 'r')}
        {directionButton('back', 'TYŁ', 'd')}
      </div>
    </section>
  );
}

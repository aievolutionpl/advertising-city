// Sterowanie dotykowe (mobile): D-pad do ruchu + rozglądanie przeciągnięciem ekranu.
import React from 'react';
import { input } from '../scene/input.js';
import { useCity } from '../store.js';

const DOT = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function Dpad() {
  const setMode = useCity((s) => s.setMode);
  const hold = (key, on) => (e) => {
    e.preventDefault();
    const [x, z] = DOT[key];
    if (on) {
      input.axes.x = Math.max(-1, Math.min(1, input.axes.x + x));
      input.axes.z = Math.max(-1, Math.min(1, input.axes.z + z));
    } else {
      input.axes.x = Math.max(-1, Math.min(1, input.axes.x - x));
      input.axes.z = Math.max(-1, Math.min(1, input.axes.z - z));
    }
  };
  const btn = (key, glyph, style = {}) => (
    <button
      className="dpad-btn"
      style={style}
      onPointerDown={hold(key, true)}
      onPointerUp={hold(key, false)}
      onPointerLeave={hold(key, false)}
      onPointerCancel={hold(key, false)}
      aria-label={key}
    >
      {glyph}
    </button>
  );
  const run = (on) => (e) => { e.preventDefault(); input.run = on; };
  return (
    <div className="dpad-wrap">
      <div className="dpad">
        {btn('up', '▲', { gridArea: 'u' })}
        {btn('left', '◀', { gridArea: 'l' })}
        {btn('right', '▶', { gridArea: 'r' })}
        {btn('down', '▼', { gridArea: 'd' })}
        <button
          className="dpad-btn run"
          style={{ gridArea: 'c' }}
          onPointerDown={run(true)}
          onPointerUp={run(false)}
          onPointerLeave={run(false)}
        >
          ⚡
        </button>
      </div>
      <button className="btn primary" onClick={() => setMode('iso')}>← Kamera miejska</button>
    </div>
  );
}

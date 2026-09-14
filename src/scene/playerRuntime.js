// Stan gracza w klatce — wspólny dla komponentów 3D (wzorzec jak dayRuntime).
// Trzymanie tego poza Reactem = brak re-renderów 60×/s przy chodzeniu.
import { DEFAULT_CHAR } from '../lib/player.js';

export const playerRuntime = {
  x: 0, z: 0, y: 0, vy: 0, grounded: true,
  yaw: 0.6, pitch: -0.06,
  moveX: 0, moveZ: 0,
  speed: 0, running: false, moving: false,
  anim: 0,              // faza kroków (do animacji nóg/rąk)
  charId: DEFAULT_CHAR,
  discovered: [],
  xp: 0,
  frozen: false,        // true = postać stoi (np. otwarte menu / panel)

  /* bufor wejść zapisany przez UI (przyciski mobilne) */
  want: { jump: false, run: false },
};

export function resetPlayerRuntime(charId) {
  if (charId) playerRuntime.charId = charId;
  playerRuntime.y = 0; playerRuntime.vy = 0; playerRuntime.grounded = true;
  playerRuntime.speed = 0; playerRuntime.moving = false; playerRuntime.running = false;
  playerRuntime.moveX = 0; playerRuntime.moveZ = 0;
  playerRuntime.anim = 0;
  playerRuntime.want.jump = false;
  playerRuntime.want.run = false;
}

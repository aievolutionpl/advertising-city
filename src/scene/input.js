// Jedno źródło prawdy dla inputu (klawiatura + D-pad mobilny + mysz/pointer-lock).
// Trzymane poza Reactem, żeby useFrame czytał bez re-renderów.
export const input = {
  keys: new Set(),
  axes: { x: 0, z: 0 },      // D-pad na mobile / joystick
  look: { dx: 0, dy: 0 },    // skumulowany ruch myszy od ostatniej klatki
  run: false,
};

export const KEY_MAP = {
  KeyW: 'fwd', ArrowUp: 'fwd',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function setKey(code, down) {
  if (down) input.keys.add(code); else input.keys.delete(code);
  if (code === 'ShiftLeft' || code === 'ShiftRight') input.run = down;
}

export function movementVector() {
  let x = 0;
  let z = 0;
  for (const code of input.keys) {
    const a = KEY_MAP[code];
    if (a === 'fwd') z -= 1;
    if (a === 'back') z += 1;
    if (a === 'left') x -= 1;
    if (a === 'right') x += 1;
  }
  return normalizeMovement(x + input.axes.x, z + input.axes.z);
}

/** Jednolita prędkość na osi i po skosie; chroni też przed sumą klawiatura+D-pad. */
export function normalizeMovement(x, z) {
  const length = Math.hypot(x, z);
  if (length <= 1 || length === 0) return { x, z };
  return { x: x / length, z: z / length };
}

export function consumeLook() {
  const { dx, dy } = input.look;
  input.look.dx = 0;
  input.look.dy = 0;
  // Utrata klatki / ponowne złapanie dotyku nie może obrócić kamery o pół miasta.
  return { dx: Math.max(-120, Math.min(120, dx)), dy: Math.max(-90, Math.min(90, dy)) };
}

export function resetInput() {
  input.keys.clear();
  input.axes.x = 0;
  input.axes.z = 0;
  input.run = false;
  input.look.dx = 0;
  input.look.dy = 0;
}

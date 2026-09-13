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
  return { x: x + input.axes.x, z: z + input.axes.z };
}

export function consumeLook() {
  const { dx, dy } = input.look;
  input.look.dx = 0;
  input.look.dy = 0;
  return { dx, dy };
}

export function resetInput() {
  input.keys.clear();
  input.axes.x = 0;
  input.axes.z = 0;
  input.run = false;
}

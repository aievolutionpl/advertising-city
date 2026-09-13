// Stan, który scenariusz E2E mierzy bez zgadywania (klatki, draw calls, pozycja gracza).
export const debugState = {
  player: { x: 0, z: 0, yaw: 0, mode: 'iso' },
  camera: { x: 0, y: 0, z: 0, fov: 46, pitch: 0, distance: 0 },
  fps: 0,
  frames: 0,
  calls: 0,
  triangles: 0,
  cars: 0,
  pedestrians: 0,
  trees: 0,
  buildings: 0,
  ready: false,
};

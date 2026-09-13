// Współdzielone materiały sceny — mutowane raz na klatkę przez DayDriver (bez re-renderów Reacta).
import * as THREE from 'three';

const SKY_VERT = `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
varying vec3 vWorld;
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bottom;
uniform vec3 sunDir;
uniform float glow;
uniform float night;
void main() {
  vec3 d = normalize(vWorld);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(bottom, mid, smoothstep(0.42, 0.54, h));
  col = mix(col, top, smoothstep(0.5, 0.95, h));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += vec3(1.0, 0.62, 0.28) * glow * pow(sd, 12.0);
  col += vec3(1.0, 0.8, 0.5) * glow * 1.9 * pow(sd, 90.0);
  // gwiazdy tylko nocą i tylko nad horyzontem
  vec3 g = floor(d * 260.0);
  float rnd = fract(sin(dot(g.xy + g.z, vec2(12.9898, 78.233))) * 43758.5453);
  float stars = step(0.9993, rnd) * smoothstep(0.05, 0.45, d.y);
  col += vec3(0.85, 0.9, 1.0) * stars * night * 1.4;
  gl_FragColor = vec4(col, 1.0);
}`;

export const skyMaterial = new THREE.ShaderMaterial({
  vertexShader: SKY_VERT,
  fragmentShader: SKY_FRAG,
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color('#1f66c2') },
    mid: { value: new THREE.Color('#8ec6e4') },
    bottom: { value: new THREE.Color('#f2f6fa') },
    sunDir: { value: new THREE.Vector3(0.2, 0.9, -0.4) },
    glow: { value: 1 },
    night: { value: 0 },
  },
});

/** Szkło pięter — jedno na całe miasto; nocą okna świecą ciepłym światłem. */
export const glassMaterial = new THREE.MeshStandardMaterial({
  color: '#8fc7e8',
  emissive: new THREE.Color('#ffcf8a'),
  emissiveIntensity: 0.05,
  metalness: 0.35,
  roughness: 0.22,
});

/** Latarnie: kolor > 1 przy toneMapped=false = realny „blask" bez kosztownych point lightów. */
export const lampMaterial = new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false });

/** Reflektory aut — mocniejsze nocą, przygaszone w dzień. */
export const headlightMaterial = new THREE.MeshBasicMaterial({ color: '#4a4238', toneMapped: false });

/** Szyldy i akcenty (podświetlenie reklam) — lekko mocniejsze nocą. */
export const signMaterial = new THREE.MeshBasicMaterial({ color: '#00e7ff', toneMapped: false });

export function applyDay(day) {
  const u = skyMaterial.uniforms;
  u.top.value.set(day.skyTop);
  u.mid.value.set(day.skyMid);
  u.bottom.value.set(day.skyBottom);
  u.sunDir.value.set(day.sunDir[0], day.sunDir[1], day.sunDir[2]).normalize();
  u.glow.value = 0.12 + day.sunI * 0.55;
  u.night.value = day.night;

  glassMaterial.emissiveIntensity = 0.04 + day.win * 1.45;
  glassMaterial.color.set(day.win > 0.5 ? '#2b3d52' : '#8fc7e8');

  const lamp = 0.05 + day.lamps * 1.35;
  lampMaterial.color.setRGB(lamp, lamp * 0.86, lamp * 0.6);

  const hl = 0.35 + day.lamps * 0.9;
  headlightMaterial.color.setRGB(hl, hl * 0.95, hl * 0.82);

  const sign = 0.55 + day.night * 0.85;
  signMaterial.color.setRGB(0.0 * sign, 0.9 * sign, sign);
}

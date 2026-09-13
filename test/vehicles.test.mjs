// Testy jazdy samochodem: rozbieg, hamowanie, skręt, NOS, kolizje, „wsiądź do auta".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRIVE, blockedAt, carStateFrom, nearestCar, parkedCars, speedKmh, stepCar } from '../src/lib/vehicles.js';

const car = { id: 'car-p1', color: '#fff', x: 0, z: 0, yaw: 0 };
const dt = 1 / 60;
const drive = (s, input, frames = 60) => { for (let i = 0; i < frames; i++) s = stepCar(s, input, dt); return s; };

test('zaparkowane auta: jedno na budynek, w mieście, deterministycznie', () => {
  const buildings = { 'p-1': { x: 0, z: 0 }, 'p-2': { x: 28, z: -28 } };
  const a = parkedCars(buildings);
  const b = parkedCars(buildings);
  assert.equal(a.length, 2, 'jedno auto pod każdym budynkiem');
  assert.deepEqual(a, b, 'ten sam stan → te same auta (determinizm)');
  for (const c of a) {
    assert.ok(Math.abs(c.x) <= 90 && Math.abs(c.z) <= 90, 'auto stoi w granicach miasta');
    assert.ok(c.color?.startsWith('#'), 'auto ma kolor');
  }
  assert.notEqual(a[0].x + a[0].z, a[1].x + a[1].z, 'auta nie stoją w jednym punkcie');
});

test('gaz: auto przyspiesza i nie przekracza V-max', () => {
  let s = carStateFrom(car);
  s = drive(s, { throttle: 1 }, 30);
  assert.ok(s.speed > 3, `po 0,5 s jedzie (speed=${s.speed.toFixed(2)})`);
  s = drive(s, { throttle: 1 }, 600);
  assert.ok(s.speed <= DRIVE.maxSpeed + 0.01, 'nie przekracza prędkości maksymalnej');
  assert.ok(speedKmh(s.speed) >= 100, `V-max ≥ 100 km/h (jest ${speedKmh(s.speed)})`);
  assert.ok(s.z > 10, 'przestawiło się do przodu (oś +Z)');
});

test('NOS: boost podnosi V-max i wraca do normy po puszczeniu', () => {
  let s = drive(carStateFrom(car), { throttle: 1 }, 600);
  const normal = s.speed;
  s = drive(s, { throttle: 1, boost: true }, 200);
  assert.ok(s.speed > normal, `z NOS-em szybciej (${s.speed.toFixed(1)} > ${normal.toFixed(1)})`);
  assert.ok(s.speed <= DRIVE.boostMax + 0.01, 'NOS też ma limit');
  s = drive(s, { throttle: 1, boost: false }, 300);
  assert.ok(s.speed <= DRIVE.maxSpeed + 0.01, 'bez NOS-a wraca pod normalny limit');
});

test('hamulec: zatrzymuje auto, potem cofa na wstecznym', () => {
  let s = drive(carStateFrom(car), { throttle: 1 }, 120);
  const przed = s.speed;
  s = drive(s, { brake: true }, 30);                     // 0,5 s hamowania
  assert.ok(s.speed < przed * 0.5, `hamulec wyraźnie zbija prędkość (${przed.toFixed(1)} → ${s.speed.toFixed(1)})`);
  s = drive(s, { brake: true }, 200);
  assert.equal(s.speed, 0, 'auto zatrzymuje się całkowicie');
  s = drive(s, { throttle: -1 }, 120);
  assert.ok(s.speed < 0, 'wsteczny jedzie do tyłu');
  assert.ok(s.speed >= -DRIVE.maxReverse - 0.01, 'wsteczny ma limit');
});

test('skręt: w miejscu nie kręci, w ruchu zmienia kierunek (kierunek zależny od znaku)', () => {
  const still = stepCar(carStateFrom(car), { steer: 1 }, dt);
  assert.equal(still.yaw, 0, 'stojąc nie da się kręcić — jak w prawdziwym aucie');
  const left = drive(carStateFrom(car), { throttle: 1, steer: 1 }, 90);
  assert.ok(left.yaw > 0.05, `skręt w lewo zmienia yaw (${left.yaw.toFixed(3)})`);
  const right = drive(carStateFrom(car), { throttle: 1, steer: -1 }, 90);
  assert.ok(right.yaw < -0.05, 'skręt w prawo zmienia yaw w drugą stronę');
  assert.notEqual(Math.round(left.x * 100), Math.round(right.x * 100), 'tory jazdy się różnią');
});

test('opór: bez gazu auto samo zwalnia', () => {
  let s = drive(carStateFrom(car), { throttle: 1 }, 120);
  const v = s.speed;
  s = drive(s, {}, 120);
  assert.ok(s.speed < v * 0.75, 'rollResist + drag wyraźnie hamują');
});

test('kolizje: bryła budynku blokuje wjazd, obok da się przejechać', () => {
  const box = { x: 0, z: 0, w: 11, d: 11, yaw: 0, r: 12 };
  assert.ok(blockedAt(1, 1, [box]), 'środek budynku = zderzenie');
  assert.ok(blockedAt(6.5, 0, [box]), 'krawędź + promień auta też blokuje');
  assert.ok(!blockedAt(14, 0, [box]), 'przy sąsiedniej działce jest wolne');
  assert.ok(!blockedAt(0, 0, []), 'bez brył nic nie blokuje');
});

test('wsiadanie: auto wybierane tylko w zasięgu ręki', () => {
  const cars = [{ id: 'car-a', x: 0, z: 0 }, { id: 'car-b', x: 10, z: 0 }];
  assert.equal(nearestCar(cars, 1, 0)?.id, 'car-a', 'najbliższe auto w zasięgu');
  assert.equal(nearestCar(cars, 6, 0), null, 'pomiędzy autami — za daleko (2 m od b w linii prostej? nie: 4 m)');
  assert.equal(nearestCar(cars, 9.5, 0)?.id, 'car-b', 'przy drugim aucie wskakuje do niego');
});

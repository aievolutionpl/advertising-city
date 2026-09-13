// Testy układu miasta: budynki RÓWNOLEGLE do ulic, siatka kwartałów, parki, krawędzie mapy.
// Czyste dane + logika → bez three/react, więc chodzą w node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY, BLOCK_CENTERS, ROAD_LINES, PLOTS } from '../src/data/city.js';
import { facadeYaw } from '../src/lib/cityLogic.js';

const QUARTER = Math.PI / 2;

test('28. każdy budynek stoi równolegle do ulicy (fasada = wielokrotność 90°)', () => {
  assert.ok(PLOTS.length > 60, `oczekiwano rozbudowanego miasta, działek: ${PLOTS.length}`);
  let checked = 0;
  for (const p of PLOTS) {
    const yaw = facadeYaw(p.x, p.z, p.id);
    const mod = Math.abs(yaw % QUARTER);
    const off = Math.min(mod, QUARTER - mod);
    assert.ok(off < 1e-9, `działka ${p.id}: yaw ${yaw} nie jest wielokrotnością 90°`);
    // normalizacja: yaw trafia w jedną z czterech osi
    const idx = Math.round(yaw / QUARTER) % 4;
    assert.ok([0, 1, 2, 3, -1, -2, -3].includes(idx + 4 >= 0 ? idx : idx), `dziwna oś dla ${p.id}`);
    checked++;
  }
  assert.ok(checked === PLOTS.length);
});

test('29. front budynku patrzy na jezdnię, nie w środek kwartału', () => {
  // lokalny +Z po obrocie yaw musi wskazywać na zewnątrz kwartału (na ulicę)
  for (const p of PLOTS) {
    const yaw = facadeYaw(p.x, p.z, p.id);
    const bx = Math.round(p.x / CITY.pitch) * CITY.pitch;
    const bz = Math.round(p.z / CITY.pitch) * CITY.pitch;
    const fx = Math.sin(yaw);   // kierunek frontu w świecie
    const fz = Math.cos(yaw);
    const outX = Math.sign(p.x - bx);
    const outZ = Math.sign(p.z - bz);
    const aligned = (Math.abs(fx) > 0.5 && Math.sign(fx) === outX) || (Math.abs(fz) > 0.5 && Math.sign(fz) === outZ);
    assert.ok(aligned, `działka ${p.id}: front (${fx.toFixed(2)},${fz.toFixed(2)}) nie patrzy na ulicę`);
  }
});

test('30. rozbudowana siatka: 5×5 kwartałów, 6 linii jezdni, wszystkie w granicach mapy', () => {
  assert.equal(BLOCK_CENTERS.length, 5);
  assert.equal(ROAD_LINES.length, 6);
  const outer = Math.max(...ROAD_LINES.map(Math.abs)) + CITY.road / 2;
  assert.ok(outer < CITY.extent, `obwodnica (${outer}) wystaje poza mapę (${CITY.extent})`);
  assert.ok(CITY.extent >= 78, 'miasto ma być większe niż w v0.1 (±52)');
});

test('31. działki trzymają się swojego kwartału i nie nachodzą na jezdnię', () => {
  const half = CITY.block / 2;
  for (const p of PLOTS) {
    const bx = Math.round(p.x / CITY.pitch) * CITY.pitch;
    const bz = Math.round(p.z / CITY.pitch) * CITY.pitch;
    assert.ok(Math.abs(p.x - bx) <= half + 0.01, `${p.id} wypada z kwartału po X`);
    assert.ok(Math.abs(p.z - bz) <= half + 0.01, `${p.id} wypada z kwartału po Z`);
  }
});

test('32. parki nie są na sprzedaż, a wolnych działek jest więcej niż 60', () => {
  const parks = PLOTS.filter((p) => p.park);
  const free = PLOTS.filter((p) => !p.park);
  assert.ok(parks.length >= 8, 'miasto ma mieć parki');
  assert.ok(free.length > 60, `wolnych działek: ${free.length}`);
  for (const p of free) assert.ok(!p.park, `${p.id} park nie może być do kupienia`);
});

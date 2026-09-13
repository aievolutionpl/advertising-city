// Testy gracza: postacie, fizyka skoku, POI/odkrycia, XP i poziomy, zapis w localStorage.
// Czysta logika z lib/player.js — bez przeglądarki, bez three.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTERS, DEFAULT_CHAR, PHYS, POIS, PLAYER_LS_KEY,
  applyDiscoveries, buildPois, characterById, checkDiscoveries, exploreProgress,
  levelOf, loadPlayer, nearestPoi, savePlayer, stepVertical, turnTo, approach,
} from '../src/lib/player.js';

test('postacie: 6 bohaterów, unikalne id, komplet palety', () => {
  assert.equal(CHARACTERS.length, 6);
  assert.equal(new Set(CHARACTERS.map((c) => c.id)).size, 6);
  for (const c of CHARACTERS) {
    assert.ok(c.name.length >= 3, `${c.id}: imię`);
    assert.ok(c.role.length > 3, `${c.id}: rola`);
    assert.ok(c.speed >= 0.85 && c.speed <= 1.15, `${c.id}: tempo w rozsądnym zakresie`);
    for (const k of ['skin', 'hair', 'shirt', 'pants', 'shoe', 'accent']) {
      assert.match(c.palette[k], /^#[0-9a-fA-F]{6}$/, `${c.id}.${k} = kolor hex`);
    }
  }
});

test('characterById: nieznane id → postać domyślna (brak wyjątku)', () => {
  assert.equal(characterById('maja').name, 'Maja');
  assert.equal(characterById('nie-ma-takiej').id, DEFAULT_CHAR);
  assert.equal(characterById(undefined).id, DEFAULT_CHAR);
});

test('skok: postać unosi się, potem grawitacja sprowadza ją na ziemię', () => {
  let s = { y: 0, vy: 0, grounded: true };
  s = stepVertical(s, 1 / 60, true);                 // impuls skoku
  assert.ok(s.y > 0, 'po skoku jest nad ziemią');
  assert.equal(s.grounded, false, 'w powietrzu nie jest „na ziemi”');
  let peak = s.y;
  for (let i = 0; i < 200; i += 1) {
    s = stepVertical(s, 1 / 60, false);
    peak = Math.max(peak, s.y);
    if (s.grounded) break;
  }
  assert.equal(s.grounded, true, 'w końcu ląduje');
  assert.equal(s.y, 0, 'ląduje dokładnie na poziomie ziemi');
  assert.ok(peak > 0.8 && peak < 1.6, `sensowna wysokość skoku (${peak.toFixed(2)} m)`);
});

test('skok w powietrzu nie działa (bez podwójnego skoku)', () => {
  let s = { y: 0, vy: 0, grounded: true };
  s = stepVertical(s, 1 / 60, true);
  const mid = s.y;
  s = stepVertical(s, 1 / 60, true);                 // próba drugiego skoku
  assert.ok(s.y < mid + PHYS.jump / 60, 'brak drugiego impulsu w powietrzu');
});

test('prędkość: approach dochodzi do celu i nie przestrzeliwuje', () => {
  let v = 0;
  for (let i = 0; i < 60; i += 1) v = approach(v, PHYS.run, 1 / 60);
  assert.ok(Math.abs(v - PHYS.run) < 0.01, 'osiąga prędkość biegu');
  assert.equal(approach(0, 1, 1 / 60, 100), 1);
});

test('obrót ciała: zawija się przez ±180° i dochodzi do celu', () => {
  let yaw = 3.0;
  for (let i = 0; i < 90; i += 1) yaw = turnTo(yaw, -3.0, 1 / 60);
  assert.ok(Math.abs(yaw - -3.0) < 0.01, 'obrót po krótszej drodze, nie przez 6 radianów');
  const oneStep = turnTo(0, Math.PI, 1 / 60);            // dokładnie 180° = kierunek niejednoznaczny
  assert.ok(Math.abs(Math.abs(oneStep) - 0.15) < 0.02, `jedna klatka = mały krok (${oneStep.toFixed(3)}), nie skok`);
});

test('POI: sensowne nazwy, promienie, unikalne id/nazwy i poprawne kategorie', () => {
  assert.ok(POIS.length >= 6, `co najmniej 6 punktów (jest ${POIS.length})`);
  assert.equal(new Set(POIS.map((p) => p.id)).size, POIS.length, 'id unikalne');
  assert.equal(new Set(POIS.map((p) => p.name)).size, POIS.length, 'nazwy unikalne (dwie tabliczki „Park Północ" mylą)');
  for (const p of POIS) {
    assert.ok(p.name.length > 3, `${p.id}: nazwa`);
    assert.ok(p.r >= 5 && p.r <= 14, `${p.id}: promień odkrycia`);
    assert.ok(p.xp >= 50 && p.xp <= 200, `${p.id}: nagroda XP`);
    assert.ok(Math.abs(p.x) <= 84 && Math.abs(p.z) <= 84, `${p.id}: w granicach miasta`);
  }
  const plaza = POIS.find((p) => p.id === 'plaza');
  assert.deepEqual({ x: plaza.x, z: plaza.z }, { x: 0, z: 0 }, 'skwer w centrum miasta');
  assert.ok(POIS.filter((p) => p.kind === 'park').length >= 2, 'są parki do zwiedzania');
  assert.equal(POIS.find((p) => p.id === 'ailab').kind, 'ai', 'AI LAB oznaczony jako punkt AI');
  assert.ok(POIS.some((p) => p.kind === 'dzielnica'), 'jest dzielnica do odwiedzenia');
  for (let i = 0; i < POIS.length; i += 1) {
    for (let j = i + 1; j < POIS.length; j += 1) {
      const d = Math.hypot(POIS[i].x - POIS[j].x, POIS[i].z - POIS[j].z);
      assert.ok(d > Math.max(POIS[i].r, POIS[j].r) + 2.9, `punkty ${POIS[i].id}/${POIS[j].id} się nie nakładają (${d.toFixed(1)} m)`);
    }
  }
});

test('buildPois: parki rozrzucone po mieście (nie stado w jednym miejscu)', () => {
  const parks = buildPois().filter((p) => p.kind === 'park');
  for (let i = 0; i < parks.length; i += 1) {
    for (let j = i + 1; j < parks.length; j += 1) {
      const d = Math.hypot(parks[i].x - parks[j].x, parks[i].z - parks[j].z);
      assert.ok(d > 40, `parki ${parks[i].id}/${parks[j].id} oddalone o ${d.toFixed(0)} m`);
    }
  }
});

test('odkrycia: wchodzisz w promień = zaliczone, raz na punkt', () => {
  const plaza = POIS.find((p) => p.id === 'plaza');
  assert.equal(checkDiscoveries([], 0, 0).length, 1, 'start na skwerze = od razu odkryty');
  assert.equal(checkDiscoveries([], plaza.x + plaza.r + 5, 0).length, 0, 'poza promieniem = nic');
  assert.equal(checkDiscoveries(['plaza'], plaza.x, plaza.z).length, 0, 'ten sam punkt nie liczy się dwa razy');
  const near = nearestPoi(POIS, 0, 0);
  assert.equal(near.poi.id, 'plaza');
  assert.equal(Math.round(near.distance), 0);
});

test('XP i poziomy: rosną, awans następuje na progu, tytuły sensowne', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(0).title, 'Nowy w mieście');
  assert.equal(levelOf(119).level, 1);
  assert.equal(levelOf(120).level, 2, 'próg 120 XP = awans');
  assert.ok(levelOf(3000).level >= 5);
  const l = levelOf(150);
  assert.equal(l.into + (l.nextXp - 150), l.need, 'pasek postępu liczy się od progu poziomu');
  assert.equal(Math.round(levelOf(150).into), 30, '150 XP = 30 XP nad progiem');
});

test('applyDiscoveries: dodaje XP, nie duplikuje, sygnalizuje awans', () => {
  const plaza = POIS.find((p) => p.id === 'plaza');
  const par = POIS.find((p) => p.kind === 'park');
  const out = applyDiscoveries({ xp: 0, discovered: [] }, [plaza, par]);
  assert.equal(out.xp, plaza.xp + par.xp);
  assert.equal(out.discovered.length, 2);
  assert.equal(out.gained, plaza.xp + par.xp);
  assert.equal(out.levelUp, 2, 'awans na poziom 2 (funkcja zwraca nowy poziom)');
  const again = applyDiscoveries(out, [plaza]);
  assert.equal(again.xp, out.xp, 'ten sam punkt nie daje XP drugi raz');
  assert.equal(again.discovered.length, 2);
  assert.equal(out.progress.done, 2);
  assert.equal(out.progress.total, POIS.length);
});

test('exploreProgress: liczy tylko znane POI i podaje ile zostało', () => {
  const p = exploreProgress(['plaza'], POIS);
  assert.equal(p.done, 1);
  assert.equal(p.left, POIS.length - 1);
  assert.ok(p.ratio > 0 && p.ratio < 1);
  assert.equal(exploreProgress(POIS.map((x) => x.id)).ratio, 1);
});

test('zapis gracza: roundtrip w localStorage, brak danych = bezpieczny default', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(loadPlayer(storage), { charId: DEFAULT_CHAR, xp: 0, discovered: [], yaw: 0, plays: 0 });
  assert.equal(savePlayer({ charId: 'tomek', xp: 260, discovered: ['plaza', 'duch-miasta'], yaw: 1.2 }, storage), true);
  const back = loadPlayer(storage);
  assert.equal(back.charId, 'tomek');
  assert.equal(back.xp, 260);
  assert.deepEqual(back.discovered, ['plaza'], 'nieznane id POI odsiane');
  assert.ok(mem.has(PLAYER_LS_KEY));
  assert.equal(savePlayer({ xp: 1 }, { setItem: () => { throw new Error('tryb prywatny'); } }), false, 'brak wyjątku');
  assert.equal(loadPlayer(undefined).charId, DEFAULT_CHAR, 'SSR / brak storage = default');
});

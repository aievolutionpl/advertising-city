// Testy czystej logiki — odpalane bez przeglądarki: `npm test` (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLOTS, ROADS, SEED_BUILDINGS, TREES, plotById, CITY, BLOCK_CENTERS } from '../src/data/city.js';
import {
  initialState, purchasePlot, upgradeBuilding, setAd, accrue, rentCost, buildCost,
  purchaseCost, upgradeCost, serializePlayerState, deserializePlayerState, sanitizeAd, MAX_FLOORS, START_COINS, SHAPES,
} from '../src/lib/economy.js';
import {
  isBlocked, stepPlayer, safeSpawn, carTransform, trafficTransform, pedestrianTransform, isOnRoad, isOnSidewalk,
  orbitPosition, clampOrbit, buildingBox,
} from '../src/lib/cityLogic.js';
import { wrapText, pickReadable, shade } from '../src/lib/adTexture.js';

const base = () => initialState(SEED_BUILDINGS, PLOTS);

test('layout: rozbudowane miasto (5×5 kwartałów), unikalne id, parki, seed wskazuje istniejące działki', () => {
  assert.equal(PLOTS.length, BLOCK_CENTERS.length ** 2 * 4);
  assert.equal(new Set(PLOTS.map((p) => p.id)).size, PLOTS.length);
  assert.ok(PLOTS.filter((p) => p.park).length >= 8);
  for (const s of SEED_BUILDINGS) assert.ok(plotById(s.plotId), `seed plot ${s.plotId} istnieje`);
  assert.ok(TREES.length > 25, 'drzewa wygenerowane');
});

test('layout: seed budynki stoją na działkach nie-parkowych i nie nachodzą na drogi', () => {
  for (const s of SEED_BUILDINGS) {
    const p = plotById(s.plotId);
    assert.equal(p.park, false, `${s.plotId} nie jest parkiem`);
    assert.equal(isOnRoad(p.x, p.z), false, `${s.plotId} nie stoi na asfalcie`);
  }
  assert.equal(ROADS.length, BLOCK_CENTERS.length * 2 + 2);
});

test('ekonomia: ceny core > outer, upgrade rośnie z piętrami', () => {
  const core = PLOTS.find((p) => p.district === 'core');
  const outer = PLOTS.find((p) => p.district === 'outer' && !p.park);
  assert.ok(rentCost(core) > rentCost(outer));
  assert.ok(buildCost(core) > buildCost(outer));
  assert.ok(upgradeCost(4) > upgradeCost(1));
  assert.ok(upgradeCost(MAX_FLOORS) > 0);
  assert.equal(purchaseCost(outer, 'tower'), rentCost(outer) + buildCost(outer) + SHAPES.tower.extra);
  assert.ok(purchaseCost(outer, 'shop') < purchaseCost(outer, 'tower'));
});

test('purchasePlot: kupno obniża saldo i wstawia budynek pod klucz plotId', () => {
  const s0 = base();
  const plot = PLOTS.find((p) => !p.park && !s0.buildings[p.id]);
  const r = purchasePlot(s0, plot);
  assert.equal(r.ok, true);
  assert.equal(r.state.coins, s0.coins - r.spent);
  const b = r.state.buildings[plot.id];
  assert.equal(b.owner, 'player');
  assert.equal(b.x, plot.x);
  assert.equal(b.floors, 3, 'wieżowiec startuje z 3 pięter (kształt domyślny)');
  assert.equal(r.state.buildings[plot.id].ad.layout, 'text');
});

test('purchasePlot: blokuje park, drugie kupno i brak środków', () => {
  const s0 = base();
  const park = PLOTS.find((p) => p.park);
  assert.equal(purchasePlot(s0, park).ok, false);
  const plot = PLOTS.find((p) => !p.park && !s0.buildings[p.id]);
  const r1 = purchasePlot(s0, plot);
  const r2 = purchasePlot(r1.state, plot);
  assert.equal(r2.ok, false);
  assert.match(r2.error, /zajęta/);
  const broke = { ...s0, coins: 10 };
  assert.equal(purchasePlot(broke, plot).ok, false);
  assert.equal(purchasePlot(s0, null).ok, false);
});

test('upgradeBuilding: house-adowi nie rozbudujesz, graczowi tak, cap na MAX_FLOORS', () => {
  const s0 = { ...base(), coins: 500000 };
  const houseKey = Object.keys(s0.buildings)[0];
  assert.equal(upgradeBuilding(s0, houseKey).ok, false);
  const plot = PLOTS.find((p) => !p.park && !s0.buildings[p.id]);
  let s = purchasePlot(s0, plot).state;
  const before = s.coins;
  const r = upgradeBuilding(s, plot.id);
  assert.equal(r.ok, true);
  assert.equal(r.state.buildings[plot.id].floors, 4, 'rozbudowa +1 piętro (3 → 4)');
  assert.equal(r.state.coins, before - r.spent);
  s = r.state;
  for (let i = 0; i < 10; i++) s = upgradeBuilding(s, plot.id).state;
  assert.equal(s.buildings[plot.id].floors, MAX_FLOORS);
  assert.equal(upgradeBuilding(s, plot.id).ok, false);
  // realny budżet startowy pozwala rozbudować 2→3 piętra i jeszcze coś zbudować
  const fresh = base();
  const p2 = PLOTS.find((p) => !p.park && !fresh.buildings[p.id]);
  const bought = purchasePlot(fresh, p2).state;
  assert.equal(upgradeBuilding(bought, p2.id).ok, true, 'START_COINS wystarcza na start + 1 rozbudowę');
});

test('sanitizeAd: tnie długość, odrzuca zły URL/kolor, przepuszcza data-URL obrazu', () => {
  const ad = sanitizeAd({
    title: 'A'.repeat(99), subtitle: 'B'.repeat(200), cta: 'C'.repeat(99),
    url: 'javascript:alert(1)', bg: 'red', image: 'data:image/png;base64,iVBORw0KGgo=',
  });
  assert.equal(ad.title.length, 34);
  assert.equal(ad.subtitle.length, 64);
  assert.equal(ad.cta.length, 28);
  assert.equal(ad.url, '', 'javascript: odrzucone');
  assert.equal(ad.bg, '#0b1020', 'zły kolor → fallback');
  assert.ok(ad.image.startsWith('data:image/png'));
  assert.equal(sanitizeAd({ url: 'https://example.com/x' }).url, 'https://example.com/x');
  assert.equal(sanitizeAd({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }).image, 'data:image/svg+xml;base64,PHN2Zz4=');
});

test('setAd nie mutuje poprzedniego stanu i blokuje edycję cudzych budynków', () => {
  const s0 = base();
  const key = Object.keys(s0.buildings)[0];
  assert.equal(setAd(s0, key, { title: 'NOWA NAZWA' }).ok, false, 'house ad jest tylko do podglądu');
  const plot = PLOTS.find((p) => !p.park && !s0.buildings[p.id]);
  const mine = purchasePlot(s0, plot).state;
  const r = setAd(mine, plot.id, { title: 'NOWA NAZWA' });
  assert.equal(r.ok, true);
  assert.equal(r.state.buildings[plot.id].ad.title, 'NOWA NAZWA');
  assert.notEqual(mine.buildings[plot.id].ad.title, 'NOWA NAZWA', 'stary stan nietknięty');
  assert.equal(setAd(s0, 'nie-ma-takiej', {}).ok, false);
});

test('eksport/import: roundtrip zachowuje budynki gracza, odrzuca śmieci', () => {
  const s0 = base();
  const plot = PLOTS.find((p) => !p.park && !s0.buildings[p.id]);
  const s1 = purchasePlot(s0, plot).state;
  const json = serializePlayerState(s1);
  assert.ok(!json.includes('"owner": "house"'), 'eksport bez house-ads');
  const back = deserializePlayerState(json, base());
  assert.equal(back.ok, true);
  assert.equal(back.state.buildings[plot.id].owner, 'player');
  assert.equal(back.state.coins, s1.coins);
  assert.equal(deserializePlayerState('{nie json}', base()).ok, false);
  assert.equal(deserializePlayerState(JSON.stringify({ v: 2 }), base()).ok, false);
});

test('accrue: 10 AC na minutę, mniej niż 6 s nic nie daje', () => {
  assert.equal(accrue(0, 60000).coins, 10);
  assert.equal(accrue(0, 3000).earned, 0);
  assert.equal(accrue(START_COINS, 600000).coins, START_COINS + 100);
});

test('kolizje: w budynku zablokowane, poza mapą zablokowane, obok wolne', () => {
  const b = [{ x: 0, z: 0, w: 8, d: 8 }];
  assert.equal(isBlocked(0, 0, b), true);
  assert.equal(isBlocked(0, 6, b), false);
  assert.equal(isBlocked(999, 0, b), true);
  assert.equal(isBlocked(4.4, 0, b), true, 'margines promienia gracza');
  const box = buildingBox(b[0], 0.5);
  assert.deepEqual(box, { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 });
});

test('stepPlayer: idzie do przodu, ślizga się po ścianie, nie wchodzi w budynek', () => {
  const b = [{ x: 0, z: 0, w: 8, d: 8 }];
  // start na zachód od budynku, kierunek na wschód (prosto w ścianę) + lekko na północ
  const p0 = { x: -8, z: 0 };
  const r1 = stepPlayer(p0, 1, 0, 0.1, [], 7);
  assert.ok(r1.x > p0.x, 'wolna droga → ruch');
  // z poślizgiem: wektor w ścianę + wzdłuż → Z się zmienia, X zatrzymany na krawędzi
  const r2 = stepPlayer({ x: -4.6, z: 0 }, 1, 1, 0.1, b, 7);
  assert.ok(r2.z > 0, 'poślizg wzdłuż ściany działa');
  assert.ok(r2.x <= -4.5, 'nie wchodzi w bryłę');
  assert.equal(r2.blocked, true);
  // brak wejścia do środka: seria kroków w stronę środka nie kończy wewnątrz
  let p = { x: -8, z: 0 };
  for (let i = 0; i < 60; i++) p = stepPlayer(p, 1, 0, 0.05, b, 7);
  assert.equal(isBlocked(p.x, p.z, b), false, 'po 60 krokach nadal poza bryłą');
  assert.ok(p.x < -4.4);
});

test('safeSpawn: nigdy w budynku, także przy zabudowanym centrum', () => {
  const s = base();
  const buildings = Object.values(s.buildings);
  const spawn = safeSpawn(buildings);
  assert.equal(isBlocked(spawn.x, spawn.z, buildings), false);
  const wall = [{ x: 0, z: 0, w: 200, d: 200 }];
  assert.equal(isBlocked(safeSpawn(wall).x, safeSpawn(wall).z, wall), true, 'brak wolnego miejsca → zwraca domyślne');
});

test('samochody: pętla zamknięta (t=0 == t=1), trzymają się asfaltu, dwa pasy', () => {
  for (const t of [0, 0.13, 0.37, 0.62, 0.88]) {
    const a = carTransform(t, 0);
    const b = carTransform(t + 1, 0);
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, 'pętla domknięta');
    assert.equal(isOnRoad(a.x, a.z), true, `auto na drodze (t=${t})`);
    const c = carTransform(t, 1);
    assert.equal(isOnRoad(c.x, c.z), true, `auto na drodze, pas 1 (t=${t})`);
    assert.ok(Math.hypot(a.dirX, a.dirZ) > 0.99, 'kierunek znormalizowany');
  }
  const e = carTransform(0.1, 0);
  const w = carTransform(0.1, 1);
  assert.notDeepEqual([e.x, e.z], [w.x, w.z], 'dwa pasy → różne pozycje');
});

test('ruch miejski: auta objeżdżają różne kwartały, dwa pasy pozostają na jezdni', () => {
  for (const block of [0, 6, 17, 31, 48]) {
    for (const lane of [0, 1]) {
      const start = trafficTransform(0, block, lane);
      const end = trafficTransform(1, block, lane);
      assert.ok(Math.abs(start.x - end.x) < 1e-9 && Math.abs(start.z - end.z) < 1e-9, 'pętla domknięta');
      for (const t of [0.07, 0.31, 0.58, 0.83]) {
        const p = trafficTransform(t, block, lane);
        assert.equal(isOnRoad(p.x, p.z), true, `blok ${block}, pas ${lane}: auto na jezdni`);
        assert.ok(Math.hypot(p.dirX, p.dirZ) > 0.99, 'kierunek znormalizowany');
      }
    }
  }
  assert.notDeepEqual(trafficTransform(0.2, 0, 0), trafficTransform(0.2, 48, 0), 'ruch rozłożony po mieście');
});

test('piesci: deterministyczni, domknięci, chodzą po chodniku (nie po jezdni)', () => {
  const a = pedestrianTransform(0.25, 4, 0.1);
  const b = pedestrianTransform(0.25, 4, 0.1);
  assert.deepEqual(a, b);
  const first = pedestrianTransform(0.05, 3, 0);
  const wrapped = pedestrianTransform(1.05, 3, 0);
  assert.ok(Math.abs(first.x - wrapped.x) < 1e-9 && Math.abs(first.z - wrapped.z) < 1e-9);
  assert.equal(isOnSidewalk(first.x, first.z), true, 'idzie po chodniku');
  assert.equal(isOnRoad(first.x, first.z), false, 'nie wchodzi na jezdnię');
  assert.equal(isBlocked(first.x, first.z, SEED_BUILDINGS.map((s) => ({ ...plotById(s.plotId), w: 7, d: 7 })), 0), false);
  const outer = pedestrianTransform(0.2, 48, 0.2);
  assert.equal(isOnSidewalk(outer.x, outer.z), true, 'piesi docierają też do zewnętrznych 7×7 kwartałów');
  assert.ok(Math.abs(outer.x) > 70 || Math.abs(outer.z) > 70, 'trasa 48 leży na obrzeżu');
});

test('kamera miejska: orbitalna pozycja nad miastem, clamp trzyma granice', () => {
  const p = orbitPosition({ x: 0, y: 0, z: 0 }, 0, 0.6, 60);
  assert.ok(p.y > 20);
  assert.ok(Math.hypot(p.x, p.z) <= 60.001);
  assert.deepEqual(clampOrbit(9, 9999), { pitch: 1.34, distance: 240 });
  assert.deepEqual(clampOrbit(-5, 1), { pitch: 0.14, distance: 24 });
});

test('adTexture: zawijanie tekstu i kontrast tła', () => {
  const lines = wrapText('Home Fires Jersey premium fireplaces and flue systems specialists', 20, 3);
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.length <= 26));
  assert.equal(wrapText('', 20, 3).length, 0);
  assert.equal(pickReadable('#0b1020'), '#ffffff', 'ciemne tło → jasny tekst');
  assert.equal(pickReadable('#f5f5f5'), '#0b1020', 'jasne tło → ciemny tekst');
  assert.equal(shade('#000000', -0.3), '#000000');
  assert.equal(shade('#ffffff', -0.5), '#808080');
});

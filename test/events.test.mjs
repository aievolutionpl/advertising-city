// Testy harmonogramu wydarzeń i easter eggów (czysta logika, bez three/DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EASTER_EGGS, abductTrack, activeEvents, balloonTrack, coinPicks, droneShowTrack,
  eventFeed, isActive, paradeTrack, spiderTrack, staticEggs, ufoTrack,
} from '../src/lib/events.js';
import { CITY } from '../src/data/city.js';

const EXTENT = CITY.extent;

test('isActive: zakres nocny zawija się przez północ (21:00 → 4:24)', () => {
  const night = { from: 21, to: 4.4 };
  assert.equal(isActive(night, 23), true, 'o 23:00 UFO lata');
  assert.equal(isActive(night, 2), true, 'o 2:00 UFO lata');
  assert.equal(isActive(night, 10), false, 'o 10:00 nie ma UFO');
  assert.equal(isActive(night, 21), true, 'o 21:00 start');
  assert.equal(isActive({ from: 8, to: 20 }, 12), true);
  assert.equal(isActive({ from: 8, to: 20 }, 20), false, 'koniec jest wyłączny');
});

test('ufoTrack: deterministyczny, w granicach miasta, z fazą nadlatywania', () => {
  const a = ufoTrack(12, 3);
  const b = ufoTrack(12, 3);
  assert.deepEqual(a, b, 'ten sam czas = ta sama pozycja (determinizm)');
  for (let t = 0; t < 60; t += 1.3) {
    const u = ufoTrack(t, 3);
    assert.ok(Math.abs(u.x) <= EXTENT + 10 && Math.abs(u.z) <= EXTENT + 10, `UFO w mieście (t=${t})`);
    assert.ok(u.y > 15 && u.y < 45, `UFO wysoko nad dachami (t=${t} → y=${u.y})`);
    assert.ok(u.beam >= 0 && u.beam <= 1, 'moc wiązki w 0..1');
  }
  const hovering = [];
  for (let t = 0; t < 32; t += 0.5) hovering.push(ufoTrack(t, 3).beam);
  assert.ok(hovering.some((k) => k > 0.5), 'raz na cykl UFO zawisa i świeci wiązką');
});

test('abductTrack: krowa pojawia się tylko w fazie zawisu', () => {
  const cycle = [];
  for (let t = 0; t < 32; t += 0.5) cycle.push(ufoTrack(t, 3).beam > 0.5);
  assert.ok(cycle.some(Boolean), 'w cyklu jest faza zawisu z wiązką');
  assert.ok(cycle.some((v) => !v), 'w cyklu jest też faza lotu bez wiązki');
  const anyAbduct = [];
  for (let t = 0; t < 32; t += 0.5) anyAbduct.push(abductTrack(t, 3));
  const live = anyAbduct.filter(Boolean);
  assert.ok(live.length > 0, 'w trakcie zawisu widać unoszoną krowę 🐄');
  assert.equal(live.length < anyAbduct.length, true, 'poza zawisem krowy nie ma');
  for (const a of live) {
    assert.ok(a.y >= 0, 'krowa unosi się nad ziemię');
    assert.ok(a.scale > 0 && a.scale <= 1.05, 'skala krowy sensowna');
  }
});

test('spiderTrack: bohater wisi na linie między wieżowcami i się buja', () => {
  const ys = [];
  for (let t = 0; t < 12; t += 0.5) {
    const s = spiderTrack(t);
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), 'pozycja liczbowa');
    assert.ok(Math.abs(s.x) <= EXTENT && Math.abs(s.z) <= EXTENT, 'w granicach miasta');
    assert.ok(s.y > 6, 'leci nad ziemią (nie chodzi po chodniku)');
    assert.ok(s.web.y >= s.y, 'lina zaczepiona NIE NIŻEJ niż on — inaczej nie ma huśtawki');
    assert.ok(s.swing >= 0 && s.swing <= 1, 'faza huśtawki w 0..1');
    ys.push(s.y);
  }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 3, 'naprawdę się wznosi i opada (buja)');
});

test('balloonTrack: balon leci wysoko, ale nad miastem', () => {
  const b = balloonTrack(30);
  assert.ok(b.y > 20 && b.y < 60, 'balon nad dachami');
  assert.ok(Math.abs(b.x) <= EXTENT + 20 && Math.abs(b.z) <= EXTENT + 20, 'nad miastem, nie za horyzontem');
  assert.deepEqual(balloonTrack(30), b, 'deterministyczny');
});

test('droneShowTrack: pokaz dronów tworzy figurę z N punktów', () => {
  const pts = droneShowTrack(5, 22);
  assert.equal(pts.length, 22, 'dokładnie N dronów');
  for (const p of pts) {
    assert.ok(p.y > 12 && p.y < 45, 'drony lecą nad miastem');
    assert.ok(Math.abs(p.x) <= EXTENT && Math.abs(p.z) <= EXTENT, 'w granicach');
  }
  const spread = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  assert.ok(spread > 2, 'drony rozkładają się w figurę, nie w jeden punkt');
});

test('paradeTrack: 5 pojazdów parady jedzie po obwodnicy', () => {
  const vs = paradeTrack(10, 5);
  assert.equal(vs.length, 5);
  for (const v of vs) {
    assert.ok(Math.abs(v.x) > 20 || Math.abs(v.z) > 20, 'parada trzyma się obwodnicy, nie środka');
    assert.ok(Number.isFinite(v.angle), 'każdy pojazd ma kierunek');
  }
  assert.notDeepEqual(paradeTrack(10, 5), paradeTrack(13, 5), 'parada jedzie (pozycje się zmieniają)');
});

test('coinPicks: 14 monet, deterministyczne w ramach dnia, inne każdego dnia', () => {
  const a = coinPicks(2, 14);
  const b = coinPicks(2, 14);
  assert.equal(a.length, 14);
  assert.deepEqual(a, b, 'ten sam dzień = te same monety');
  assert.notDeepEqual(a, coinPicks(3, 14), 'kolejny dzień = nowe miejsca');
  const ids = new Set(a.map((c) => c.id));
  assert.equal(ids.size, 14, 'identyfikatory unikalne');
  for (const c of a) {
    assert.ok(Math.abs(c.x) <= EXTENT && Math.abs(c.z) <= EXTENT, 'monety w mieście');
    assert.ok(c.y > 0, 'moneta nad ziemią (nie w asfalcie)');
  }
});

test('staticEggs: kaczka, kot, graffiti, złota działka — zgodne z EASTER_EGGS', () => {
  const eggs = staticEggs();
  const ids = eggs.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'bez duplikatów');
  for (const id of ['egg-duck', 'egg-cat', 'egg-graffiti', 'egg-golden']) {
    assert.ok(ids.includes(id), `jest easter egg ${id}`);
  }
  const all = new Set(EASTER_EGGS.map((e) => e.id));
  for (const id of ids) assert.ok(all.has(id), `${id} ma opis w EASTER_EGGS (inaczej nagroda nie zadziała)`);
  for (const e of eggs) {
    assert.ok(EASTER_EGGS.find((x) => x.id === e.id).xp > 0, 'każdy egg daje XP');
    assert.ok(Math.abs(e.x) <= EXTENT && Math.abs(e.z) <= EXTENT, 'egg w granicach miasta');
  }
});

test('EASTER_EGGS: unikalne, z podpowiedzią i nagrodą', () => {
  const ids = EASTER_EGGS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(EASTER_EGGS.length >= 6, 'co najmniej 6 easter eggów do szukania');
  for (const e of EASTER_EGGS) {
    assert.ok(e.name && e.name.length > 2, `nazwa: ${e.id}`);
    assert.ok(e.hint && e.hint.length > 5, `podpowiedź dla gracza: ${e.id}`);
    assert.ok(e.xp >= 50, `nagroda wyczuwalna: ${e.id}`);
    assert.ok(e.emoji, `emoji do HUD: ${e.id}`);
  }
  assert.ok(EASTER_EGGS.some((e) => e.id === 'egg-spider'), 'Człowiek-pająk w easter eggach');
  assert.ok(EASTER_EGGS.some((e) => e.id === 'egg-ufo'), 'UFO w easter eggach');
});

test('eventFeed: coś dzieje się w KAŻDEJ godzinie doby', () => {
  for (let h = 0; h < 24; h += 1) {
    const f = eventFeed(h + 0.5);
    assert.ok(f.length > 0, `o ${h}:30 miasto żyje (nie ma pustej godziny)`);
    assert.ok(f.length <= 4, 'feed czytelny — maksymalnie 4 wpisy');
    for (const e of f) assert.ok(e.id && e.name && e.emoji, 'wpis ma id, nazwę i emoji');
  }
  const day = eventFeed(12.5).map((e) => e.id);
  const night = eventFeed(23).map((e) => e.id);
  assert.ok(day.includes('spider') && night.includes('ufo'), 'dzień: pająk, noc: UFO');
});

test('activeEvents: zwraca pełne obiekty wydarzeń, nie same id', () => {
  const list = activeEvents(12);
  assert.ok(list.every((e) => e.name && e.kind), 'pełny obiekt');
});

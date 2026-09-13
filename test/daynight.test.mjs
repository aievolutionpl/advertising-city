// Testy cyklu dobowego: ciągłość doby, noc/dzień, świecące okna, format zegara.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayState, advance, hexToRgb, TIME_SPEEDS } from '../src/lib/daynight.js';

const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return (r + g + b) / 3; };

test('dzień: w południe jest jasno, latarnie i okna zgaszone', () => {
  const d = dayState(12);
  assert.ok(d.sunI > 2.5, `słońce w południe mocne (${d.sunI})`);
  assert.equal(d.night, 0);
  assert.equal(d.lamps, 0);
  assert.equal(d.win, 0);
  assert.ok(d.sunDir[1] > 0.85, 'słońce wysoko nad horyzontem');
});

test('noc: o północy ciemno, latarnie i okna świecą na maksa', () => {
  const d = dayState(0);
  assert.ok(d.night > 0.99);
  assert.equal(d.lamps, 1);
  assert.equal(d.win, 1);
  assert.ok(d.sunI < 0.25);
  assert.ok(d.sunDir[1] < 0, 'słońce pod horyzontem');
  assert.ok(lum(d.skyTop) < 40, 'niebo nocne ciemne');
});

test('poranek jaśnieje: 6:00 < 8:00 < 12:00 (jasność słońca)', () => {
  assert.ok(dayState(6).sunI < dayState(8).sunI);
  assert.ok(dayState(8).sunI < dayState(12).sunI);
  assert.ok(dayState(6).night > dayState(8).night, 'o 6:00 jeszcze bardziej noc niż o 8:00');
});

test('wieczór ciemnieje: 18:00 > 20:00 > 22:00 (jasność słońca)', () => {
  assert.ok(dayState(18).sunI > dayState(20).sunI);
  assert.ok(dayState(20).sunI > dayState(22).sunI);
  assert.ok(dayState(22).night > dayState(20).night);
});

test('doba jest ciągła: 23:59 → 00:01 bez skoku', () => {
  const a = dayState(23.999);
  const b = dayState(0.001);
  assert.ok(Math.abs(a.sunI - b.sunI) < 0.05, `słońce ciągłe (${a.sunI} vs ${b.sunI})`);
  assert.ok(Math.abs(a.lamps - b.lamps) < 0.05);
  assert.ok(Math.abs(a.win - b.win) < 0.05);
  assert.ok(Math.abs(lum(a.skyTop) - lum(b.skyTop)) < 6);
});

test('wejście poza zakres zawija się modulo 24', () => {
  assert.equal(dayState(25).clock, dayState(1).clock);
  assert.equal(dayState(-1).clock, dayState(23).clock);
});

test('zegar HUD w formacie HH:MM', () => {
  assert.equal(dayState(7.5).clock, '07:30');
  assert.equal(dayState(0).clock, '00:00');
  assert.equal(dayState(19.25).clock, '19:15');
});

test('wschód na wschodzie, zachód na zachodzie (kierunek słońca poziomo)', () => {
  const rano = dayState(6);
  const wieczor = dayState(18);
  assert.ok(rano.sunDir[0] > 0.9, `o 6:00 słońce nisko na wschodzie (x=${rano.sunDir[0].toFixed(2)})`);
  assert.ok(wieczor.sunDir[0] < -0.9, `o 18:00 słońce nisko na zachodzie (x=${wieczor.sunDir[0].toFixed(2)})`);
});

test('kolory nieba zmieniają się w ciągu doby (nie jeden statyczny)', () => {
  const noc = dayState(1).skyBottom;
  const poludnie = dayState(13).skyBottom;
  const zachod = dayState(19.5).skyBottom;
  assert.notEqual(noc, poludnie);
  assert.notEqual(poludnie, zachod);
  assert.ok(lum(poludnie) > lum(noc), 'południe jaśniejsze niż noc');
});

test('advance: tryby czasu przyspieszają dobę, pauza stoi', () => {
  assert.equal(advance(10, 'pause', 60), 10);
  assert.ok(Math.abs(advance(10, 'real', 3600) - 11) < 1e-9, '1 h realna = +1 h');
  assert.ok(Math.abs(advance(10, 'fast', 60) - 11) < 1e-9, '1 min/s → +1 h po 60 s');
  assert.ok(advance(10, 'epic', 60) > 15, 'w trybie epic 60 s daje kilka godzin');
  assert.ok(TIME_SPEEDS.real < TIME_SPEEDS.fast && TIME_SPEEDS.fast < TIME_SPEEDS.epic);
});

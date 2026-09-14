import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeLook, input, movementVector, normalizeMovement, resetInput, setKey } from '../src/scene/input.js';

test('input gracza: ruch po skosie ma tę samą długość co ruch po osi', () => {
  assert.deepEqual(normalizeMovement(0, -1), { x: 0, z: -1 });
  const diagonal = normalizeMovement(1, -1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-9);
});

test('input gracza: klawiatura i D-pad nie sumują prędkości ponad 1', () => {
  resetInput();
  setKey('KeyW', true);
  input.axes.x = 1;
  input.axes.z = -1;
  const move = movementVector();
  assert.ok(Math.hypot(move.x, move.z) <= 1.000001);
  resetInput();
});

test('input gracza: reset zatrzymuje ruch, bieg i zaległy obrót kamery', () => {
  setKey('KeyD', true);
  input.axes.z = -1;
  input.run = true;
  input.look.dx = 50;
  input.look.dy = -30;
  resetInput();
  assert.deepEqual(movementVector(), { x: 0, z: 0 });
  assert.equal(input.run, false);
  assert.deepEqual(consumeLook(), { dx: 0, dy: 0 });
});

test('input gracza: skok dotyku kamery jest ograniczony i konsumowany raz', () => {
  input.look.dx = 900;
  input.look.dy = -800;
  assert.deepEqual(consumeLook(), { dx: 120, dy: -90 });
  assert.deepEqual(consumeLook(), { dx: 0, dy: 0 });
});

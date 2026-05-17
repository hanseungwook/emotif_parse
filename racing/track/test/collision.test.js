'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveWalls, resolveObstacle } = require('../collision');
const { Obstacle, OBSTACLE_KIND } = require('../obstacles');

test('resolveWalls pushes car out and reflects velocity', () => {
  const car = { x: 0, y: 1, vx: 0, vy: -10, radius: 2 };
  const walls = [{ a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }];
  const hits = resolveWalls(car, walls);
  assert.equal(hits.length, 1);
  assert.ok(car.y >= 2 - 1e-9, `car.y=${car.y}`);
  assert.ok(car.vy > 0);
});

test('resolveWalls does nothing if not overlapping', () => {
  const car = { x: 0, y: 10, vx: 0, vy: 0, radius: 2 };
  const walls = [{ a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }];
  const hits = resolveWalls(car, walls);
  assert.equal(hits.length, 0);
});

test('resolveWalls iterates to settle into a corner', () => {
  // Car overlapping with two walls forming an L corner.
  const car = { x: 0.5, y: 0.5, vx: -5, vy: -5, radius: 1 };
  const walls = [
    { a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }, // floor at y=0
    { a: { x: 0, y: -10 }, b: { x: 0, y: 10 } }, // wall at x=0
  ];
  const hits = resolveWalls(car, walls);
  assert.ok(hits.length >= 1);
  // After resolution, car should be outside both walls.
  assert.ok(car.x >= 1 - 1e-9 || car.x <= -1 + 1e-9);
  assert.ok(car.y >= 1 - 1e-9 || car.y <= -1 + 1e-9);
});

test('resolveWalls does not reverse velocity when moving away', () => {
  const car = { x: 0, y: 1, vx: 0, vy: 10, radius: 2 }; // overlapping but moving away
  const walls = [{ a: { x: -10, y: 0 }, b: { x: 10, y: 0 } }];
  const hits = resolveWalls(car, walls);
  assert.equal(hits.length, 1);
  assert.equal(car.vy, 10); // unchanged
});

test('resolveObstacle BLOCK pushes back and reflects', () => {
  const o = new Obstacle({ id: 'b', kind: OBSTACLE_KIND.BLOCK, x: 5, y: 0, radius: 2 });
  const car = { x: 2, y: 0, vx: 5, vy: 0, radius: 2 };
  const r = resolveObstacle(car, o);
  assert.ok(r);
  assert.equal(r.kind, OBSTACLE_KIND.BLOCK);
  assert.ok(Math.hypot(car.x - o.x, car.y - o.y) >= 4 - 1e-9);
  assert.ok(car.vx <= 0);
});

test('resolveObstacle SLOW damps velocity', () => {
  const o = new Obstacle({ id: 's', kind: OBSTACLE_KIND.SLOW, x: 0, y: 0, radius: 5, strength: 0.5 });
  const car = { x: 0, y: 0, vx: 10, vy: 0, radius: 2 };
  const r = resolveObstacle(car, o);
  assert.equal(r.kind, OBSTACLE_KIND.SLOW);
  assert.equal(car.vx, 5);
});

test('resolveObstacle BOOST adds impulse along velocity by default', () => {
  const o = new Obstacle({ id: 'b', kind: OBSTACLE_KIND.BOOST, x: 0, y: 0, radius: 5, strength: 10 });
  const car = { x: 0, y: 0, vx: 1, vy: 0, radius: 1 };
  resolveObstacle(car, o);
  assert.equal(car.vx, 11);
});

test('resolveObstacle BOOST honors explicit direction', () => {
  const o = new Obstacle({
    id: 'bd',
    kind: OBSTACLE_KIND.BOOST,
    x: 0, y: 0, radius: 5, strength: 10,
    direction: { x: 0, y: 2 }, // non-unit, gets normalized
  });
  const car = { x: 0, y: 0, vx: 5, vy: 0, radius: 1 };
  resolveObstacle(car, o);
  assert.equal(car.vy, 10);
  assert.equal(car.vx, 5);
});

test('resolveObstacle HAZARD reports damage without moving car', () => {
  const o = new Obstacle({ id: 'h', kind: OBSTACLE_KIND.HAZARD, x: 0, y: 0, radius: 5, strength: 25 });
  const car = { x: 1, y: 0, vx: 5, vy: 0, radius: 1 };
  const r = resolveObstacle(car, o);
  assert.equal(r.kind, OBSTACLE_KIND.HAZARD);
  assert.equal(r.damage, 25);
  assert.equal(car.x, 1);
  assert.equal(car.vx, 5);
});

test('resolveObstacle returns null when not overlapping', () => {
  const o = new Obstacle({ id: 'n', kind: OBSTACLE_KIND.BLOCK, x: 100, y: 100, radius: 2 });
  const car = { x: 0, y: 0, vx: 0, vy: 0, radius: 1 };
  assert.equal(resolveObstacle(car, o), null);
});

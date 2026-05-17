'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Obstacle, OBSTACLE_KIND, BEHAVIOR_KIND } = require('../obstacles');

test('validates required fields', () => {
  assert.throws(() => new Obstacle({ kind: 'block', x: 0, y: 0, radius: 1 }), /id/);
  assert.throws(() => new Obstacle({ id: 'a', x: 0, y: 0, radius: 1 }), /kind/);
  assert.throws(() => new Obstacle({ id: 'a', kind: 'block', radius: 1 }), /finite/);
  assert.throws(() => new Obstacle({ id: 'a', kind: 'block', x: 0, y: 0, radius: 0 }), /positive/);
  assert.throws(() => new Obstacle({ id: 'a', kind: 'unknown', x: 0, y: 0, radius: 1 }), /kind/);
});

test('defaults per kind', () => {
  assert.equal(new Obstacle({ id: 'a', kind: OBSTACLE_KIND.SLOW, x: 0, y: 0, radius: 1 }).strength, 0.4);
  assert.equal(new Obstacle({ id: 'a', kind: OBSTACLE_KIND.BOOST, x: 0, y: 0, radius: 1 }).strength, 50);
  assert.equal(new Obstacle({ id: 'a', kind: OBSTACLE_KIND.HAZARD, x: 0, y: 0, radius: 1 }).strength, 10);
});

test('testCircle detects overlap and gap', () => {
  const o = new Obstacle({ id: 'a', kind: OBSTACLE_KIND.BLOCK, x: 0, y: 0, radius: 5 });
  const r = o.testCircle(3, 0, 3);
  assert.ok(r);
  assert.ok(r.overlap > 0);
  assert.ok(Math.abs(r.normal.x - 1) < 1e-9);
  assert.equal(o.testCircle(20, 0, 1), null);
});

test('testCircle handles concentric case with safe normal', () => {
  const o = new Obstacle({ id: 'a', kind: OBSTACLE_KIND.BLOCK, x: 0, y: 0, radius: 5 });
  const r = o.testCircle(0, 0, 1);
  assert.ok(r);
  assert.ok(Math.abs(Math.hypot(r.normal.x, r.normal.y) - 1) < 1e-9);
});

test('oscillate moves obstacle along axis', () => {
  const o = new Obstacle({
    id: 'osc',
    kind: OBSTACLE_KIND.BLOCK,
    x: 100, y: 100, radius: 5,
    behavior: { type: BEHAVIOR_KIND.OSCILLATE, amplitude: 50, periodMs: 1000, direction: { x: 1, y: 0 } },
  });
  o.update(250);
  assert.ok(Math.abs(o.x - 150) < 1e-6);
  o.update(250);
  assert.ok(Math.abs(o.x - 100) < 1e-6);
  o.update(250);
  assert.ok(Math.abs(o.x - 50) < 1e-6);
});

test('patrol behavior travels along path over a cycle', () => {
  const o = new Obstacle({
    id: 'p',
    kind: OBSTACLE_KIND.BLOCK,
    x: 0, y: 0, radius: 2,
    behavior: {
      type: BEHAVIOR_KIND.PATROL,
      path: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      cycleMs: 1000,
      loop: false,
    },
  });
  o.update(500);
  assert.ok(Math.abs(o.x - 5) < 1e-6);
});

test('patrol requires at least 2 path points', () => {
  assert.throws(() => new Obstacle({
    id: 'p',
    kind: OBSTACLE_KIND.BLOCK,
    x: 0, y: 0, radius: 2,
    behavior: { type: BEHAVIOR_KIND.PATROL, path: [{ x: 0, y: 0 }] },
  }), /2 points/);
});

test('reset restores origin and clears time', () => {
  const o = new Obstacle({
    id: 'r',
    kind: OBSTACLE_KIND.BLOCK,
    x: 5, y: 5, radius: 2,
    behavior: { type: BEHAVIOR_KIND.OSCILLATE, amplitude: 10, periodMs: 1000, direction: { x: 1, y: 0 } },
  });
  o.update(250);
  assert.notEqual(o.x, 5);
  o.reset();
  assert.equal(o.x, 5);
  assert.equal(o.y, 5);
});

test('inactive obstacles do not move', () => {
  const o = new Obstacle({
    id: 'i',
    kind: OBSTACLE_KIND.BLOCK,
    x: 0, y: 0, radius: 2,
    active: false,
    behavior: { type: BEHAVIOR_KIND.OSCILLATE, amplitude: 100, periodMs: 1000, direction: { x: 1, y: 0 } },
  });
  o.update(500);
  assert.equal(o.x, 0);
});

test('containsPoint matches obstacle area', () => {
  const o = new Obstacle({ id: 'c', kind: OBSTACLE_KIND.BLOCK, x: 10, y: 10, radius: 5 });
  assert.equal(o.containsPoint(10, 10), true);
  assert.equal(o.containsPoint(13, 14), true);
  assert.equal(o.containsPoint(20, 20), false);
});

test('snapshot exposes serializable fields', () => {
  const o = new Obstacle({ id: 's', kind: OBSTACLE_KIND.BOOST, x: 1, y: 2, radius: 3 });
  const s = o.snapshot();
  assert.equal(s.id, 's');
  assert.equal(s.kind, OBSTACLE_KIND.BOOST);
  assert.equal(s.x, 1);
  assert.equal(s.y, 2);
});

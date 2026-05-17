'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry');

test('vector primitives', () => {
  const a = { x: 1, y: 2 };
  const b = { x: 3, y: 4 };
  assert.deepEqual(G.add(a, b), { x: 4, y: 6 });
  assert.deepEqual(G.sub(b, a), { x: 2, y: 2 });
  assert.deepEqual(G.scale(a, 2), { x: 2, y: 4 });
  assert.equal(G.dot(a, b), 11);
  assert.equal(G.cross(a, b), -2);
  assert.equal(G.length({ x: 3, y: 4 }), 5);
  assert.equal(G.lengthSq({ x: 3, y: 4 }), 25);
  assert.equal(G.distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('normalize handles zero vector', () => {
  assert.deepEqual(G.normalize({ x: 0, y: 0 }), { x: 0, y: 0 });
  const n = G.normalize({ x: 3, y: 4 });
  assert.ok(Math.abs(n.x - 0.6) < 1e-9);
  assert.ok(Math.abs(n.y - 0.8) < 1e-9);
});

test('perp rotates 90° CCW', () => {
  const p1 = G.perp({ x: 1, y: 0 });
  assert.ok(Math.abs(p1.x) < 1e-12);
  assert.equal(p1.y, 1);
  const p2 = G.perp({ x: 0, y: 1 });
  assert.equal(p2.x, -1);
  assert.ok(Math.abs(p2.y) < 1e-12);
});

test('closestPointOnSegment clamps to endpoints', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  const r1 = G.closestPointOnSegment({ x: -5, y: 0 }, a, b);
  assert.deepEqual(r1.point, a);
  assert.equal(r1.t, 0);
  const r2 = G.closestPointOnSegment({ x: 15, y: 5 }, a, b);
  assert.deepEqual(r2.point, b);
  assert.equal(r2.t, 1);
});

test('closestPointOnSegment interior', () => {
  const r = G.closestPointOnSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
  assert.equal(r.point.x, 3);
  assert.equal(r.point.y, 0);
  assert.ok(Math.abs(r.t - 0.3) < 1e-9);
});

test('closestPointOnSegment degenerate segment', () => {
  const r = G.closestPointOnSegment({ x: 5, y: 5 }, { x: 1, y: 1 }, { x: 1, y: 1 });
  assert.deepEqual(r.point, { x: 1, y: 1 });
  assert.equal(r.t, 0);
});

test('segmentIntersection finds crossing point', () => {
  const r = G.segmentIntersection(
    { x: 0, y: 0 }, { x: 10, y: 10 },
    { x: 0, y: 10 }, { x: 10, y: 0 },
  );
  assert.ok(r);
  assert.ok(Math.abs(r.point.x - 5) < 1e-9);
  assert.ok(Math.abs(r.point.y - 5) < 1e-9);
});

test('segmentIntersection returns null for parallel and non-crossing', () => {
  assert.equal(G.segmentIntersection(
    { x: 0, y: 0 }, { x: 10, y: 0 },
    { x: 0, y: 1 }, { x: 10, y: 1 },
  ), null);
  assert.equal(G.segmentIntersection(
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 5, y: 5 }, { x: 6, y: 5 },
  ), null);
});

test('segmentIntersection at endpoint', () => {
  const r = G.segmentIntersection(
    { x: 0, y: 0 }, { x: 10, y: 0 },
    { x: 10, y: -5 }, { x: 10, y: 5 },
  );
  assert.ok(r);
  assert.ok(Math.abs(r.point.x - 10) < 1e-9);
  assert.ok(Math.abs(r.point.y) < 1e-9);
});

test('side returns sign of cross product', () => {
  // Left of segment (0,0)→(10,0) is +y.
  assert.ok(G.side({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 5 }) > 0);
  assert.ok(G.side({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }) < 0);
});

test('circleSegmentCollision detects overlap', () => {
  const r = G.circleSegmentCollision(
    { x: 5, y: 1 }, 2,
    { x: 0, y: 0 }, { x: 10, y: 0 },
  );
  assert.ok(r);
  assert.ok(Math.abs(r.distance - 1) < 1e-9);
  assert.ok(Math.abs(r.normal.y - 1) < 1e-9);
});

test('circleSegmentCollision returns null when far', () => {
  assert.equal(
    G.circleSegmentCollision({ x: 5, y: 5 }, 1, { x: 0, y: 0 }, { x: 10, y: 0 }),
    null,
  );
});

test('circleSegmentCollision degenerate (on the line) provides safe normal', () => {
  const r = G.circleSegmentCollision(
    { x: 5, y: 0 }, 2,
    { x: 0, y: 0 }, { x: 10, y: 0 },
  );
  assert.ok(r);
  assert.equal(r.distance, 0);
  // Normal must be unit length.
  assert.ok(Math.abs(Math.hypot(r.normal.x, r.normal.y) - 1) < 1e-9);
});

test('reflect inverts normal component', () => {
  const v = { x: 1, y: -1 };
  const r = G.reflect(v, { x: 0, y: 1 });
  assert.equal(r.x, 1);
  assert.equal(r.y, 1);
});

test('project gives component along unit vector', () => {
  const r = G.project({ x: 3, y: 4 }, { x: 1, y: 0 });
  assert.equal(r.x, 3);
  assert.equal(r.y, 0);
});

test('pointInPolygon for a square', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  assert.equal(G.pointInPolygon({ x: 5, y: 5 }, square), true);
  assert.equal(G.pointInPolygon({ x: 20, y: 5 }, square), false);
  assert.equal(G.pointInPolygon({ x: -1, y: 5 }, square), false);
});

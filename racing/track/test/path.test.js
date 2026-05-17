'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TrackPath } = require('../path');

test('rejects fewer than 2 points', () => {
  assert.throws(() => new TrackPath({ points: [{ x: 0, y: 0 }] }), /at least 2/);
});

test('rejects non-finite or non-positive width', () => {
  assert.throws(
    () => new TrackPath({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], width: 0 }),
    /positive/,
  );
});

test('open path builds segments and walls', () => {
  const path = new TrackPath({
    width: 10,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  });
  assert.equal(path.segments.length, 2);
  assert.equal(path.leftWall.length, 3);
  assert.equal(path.rightWall.length, 3);
  // Total length 100 + 100 = 200
  assert.equal(path.totalLength, 200);
});

test('closed path wraps segments and walls', () => {
  const path = new TrackPath({
    width: 20,
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  });
  assert.equal(path.segments.length, 4);
  assert.equal(path.totalLength, 400);
  const walls = path.walls();
  assert.equal(walls.length, 8);
  for (const w of walls) {
    assert.ok(w.side === 'left' || w.side === 'right');
  }
});

test('walls offset by half-width perpendicular to direction', () => {
  const path = new TrackPath({
    width: 10,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  });
  // Segment dir = +x, left normal = +y. Left wall at y = +5, right wall at y = -5.
  assert.ok(Math.abs(path.leftWall[0].y - 5) < 1e-9);
  assert.ok(Math.abs(path.rightWall[0].y + 5) < 1e-9);
});

test('locate returns nearest centerline segment with arc length', () => {
  const path = new TrackPath({
    width: 10,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ],
  });
  const loc = path.locate({ x: 50, y: 3 });
  assert.ok(loc);
  assert.equal(loc.segment.index, 0);
  assert.ok(Math.abs(loc.s - 50) < 1e-9);
  assert.ok(loc.side > 0); // point above the segment is on the left
});

test('sample returns interpolated centerline point', () => {
  const path = new TrackPath({
    width: 10,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  });
  const a = path.sample(50);
  assert.ok(Math.abs(a.x - 50) < 1e-9);
  assert.ok(Math.abs(a.y) < 1e-9);
  const b = path.sample(150);
  assert.ok(Math.abs(b.x - 100) < 1e-9);
  assert.ok(Math.abs(b.y - 50) < 1e-9);
});

test('sample wraps on closed paths', () => {
  const path = new TrackPath({
    width: 10,
    closed: true,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  });
  const a = path.sample(0);
  const b = path.sample(40); // full lap
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(Math.abs(a.y - b.y) < 1e-9);
});

test('degenerate path (all coincident) throws', () => {
  assert.throws(() => new TrackPath({
    points: [{ x: 5, y: 5 }, { x: 5, y: 5 }],
  }), /degenerate/);
});

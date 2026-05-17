'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Checkpoint, LapTracker } = require('../checkpoints');

test('Checkpoint forward is perpendicular to gate (right-of-walk convention)', () => {
  // Walk from (0,0) to (0,10), so a→b is +y. Right of that is +x.
  const cp = new Checkpoint({ id: 'a', a: { x: 0, y: 0 }, b: { x: 0, y: 10 } });
  assert.ok(Math.abs(cp.forward.x - 1) < 1e-9);
  assert.ok(Math.abs(cp.forward.y) < 1e-9);
});

test('Checkpoint rejects degenerate gate', () => {
  assert.throws(() => new Checkpoint({ id: 'a', a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }), /distinct/);
});

test('LapTracker requires 2+ checkpoints', () => {
  assert.throws(() => new LapTracker({ checkpoints: [] }), /at least 2/);
});

test('LapTracker registers crossings in order', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'start', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'mid',   a: { x: 50, y: -5 }, b: { x: 50, y: 5 } },
    ],
  });
  let evts = tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 16);
  assert.equal(evts.length, 1);
  assert.equal(evts[0].id, 'start');
  assert.equal(evts[0].lapTimeMs, undefined); // first start has no lap time

  evts = tracker.update({ x: 49, y: 0 }, { x: 51, y: 0 }, 16);
  assert.equal(evts.length, 1);
  assert.equal(evts[0].id, 'mid');

  evts = tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 16);
  assert.equal(evts.length, 1);
  assert.equal(evts[0].id, 'start');
  assert.equal(tracker.lapsCompleted, 1);
  assert.ok(evts[0].lapTimeMs > 0);
});

test('LapTracker ignores out-of-order crossings', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'start', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'mid',   a: { x: 50, y: -5 }, b: { x: 50, y: 5 } },
    ],
  });
  const evts = tracker.update({ x: 49, y: 0 }, { x: 51, y: 0 }, 16);
  assert.equal(evts.length, 0);
});

test('LapTracker ignores backward crossings', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'start', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'mid',   a: { x: 50, y: -5 }, b: { x: 50, y: 5 } },
    ],
  });
  const evts = tracker.update({ x: 1, y: 0 }, { x: -1, y: 0 }, 16);
  assert.equal(evts.length, 0);
});

test('LapTracker can register multiple crossings on a single tick', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'a', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'b', a: { x: 10, y: -5 }, b: { x: 10, y: 5 } },
    ],
  });
  const evts = tracker.update({ x: -1, y: 0 }, { x: 11, y: 0 }, 16);
  assert.equal(evts.length, 2);
  assert.equal(evts[0].id, 'a');
  assert.equal(evts[1].id, 'b');
});

test('LapTracker tracks best lap', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'start', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'mid',   a: { x: 50, y: -5 }, b: { x: 50, y: 5 } },
    ],
  });
  // Lap 1: slow
  tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 0);
  tracker.update({ x: 49, y: 0 }, { x: 51, y: 0 }, 200);
  tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 100);
  assert.equal(tracker.lapsCompleted, 1);
  const t1 = tracker.lastLapTimeMs;

  // Lap 2: faster
  tracker.update({ x: 49, y: 0 }, { x: 51, y: 0 }, 50);
  tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 50);
  assert.equal(tracker.lapsCompleted, 2);
  assert.ok(tracker.lastLapTimeMs < t1);
  assert.equal(tracker.bestLapTimeMs, tracker.lastLapTimeMs);
});

test('reset clears state', () => {
  const tracker = new LapTracker({
    checkpoints: [
      { id: 'a', a: { x: 0, y: -5 }, b: { x: 0, y: 5 } },
      { id: 'b', a: { x: 10, y: -5 }, b: { x: 10, y: 5 } },
    ],
  });
  tracker.update({ x: -1, y: 0 }, { x: 1, y: 0 }, 50);
  assert.notEqual(tracker.nextCheckpointIndex, 0);
  tracker.reset();
  assert.equal(tracker.nextCheckpointIndex, 0);
  assert.equal(tracker.totalTimeMs, 0);
  assert.equal(tracker.inLap, false);
});

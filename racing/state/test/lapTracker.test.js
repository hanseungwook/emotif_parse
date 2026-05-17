'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { LapTracker, CHECKPOINT_RESULT_KIND } = require('../lapTracker');
const { ValidationError } = require('../errors');

function runCleanLap(tracker, startMs, lapDurationMs) {
  const cps = tracker.snapshot().checkpointCount;
  const step = lapDurationMs / (cps + 1);
  for (let i = 1; i <= cps; i++) {
    tracker.recordCheckpoint(i, startMs + step * i);
  }
  return tracker.recordCheckpoint(0, startMs + lapDurationMs);
}

test('first crossing of start/finish line arms the first lap', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 2 });
  const result = t.recordCheckpoint(0, 0);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.PROGRESS);
  assert.equal(result.firstCrossing, true);
  assert.equal(t.snapshot().currentLap, 1);
  assert.equal(t.snapshot().expectedCheckpoint, 1);
});

test('intermediate checkpoint emits progress and advances expected', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 3 });
  t.recordCheckpoint(0, 0);
  const r = t.recordCheckpoint(1, 1000);
  assert.equal(r.kind, CHECKPOINT_RESULT_KIND.PROGRESS);
  assert.equal(r.nextExpected, 2);
});

test('out-of-order checkpoint is ignored when strict mode (default)', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 3 });
  t.recordCheckpoint(0, 0);
  const r = t.recordCheckpoint(2, 500);
  assert.equal(r.kind, CHECKPOINT_RESULT_KIND.IGNORED);
  assert.equal(r.reason, 'out-of-order');
  assert.equal(t.snapshot().expectedCheckpoint, 1);
});

test('intermediate checkpoint before start line is ignored', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 3 });
  const r = t.recordCheckpoint(1, 0);
  assert.equal(r.kind, CHECKPOINT_RESULT_KIND.IGNORED);
  assert.equal(r.reason, 'pre-start');
});

test('completing all checkpoints + start line emits LAP', () => {
  const t = new LapTracker({ totalLaps: 3, checkpointCount: 2 });
  t.recordCheckpoint(0, 0);   // first crossing
  const lap = runCleanLap(t, 0, 60000);
  assert.equal(lap.kind, CHECKPOINT_RESULT_KIND.LAP);
  assert.equal(lap.lap.lapNumber, 1);
  assert.equal(lap.lap.durationMs, 60000);
  assert.equal(lap.lapsCompleted, 1);
  assert.equal(lap.nextLap, 2);
  assert.equal(lap.bestLap, true);
});

test('crossing start without all checkpoints is ignored in strict mode', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 3 });
  t.recordCheckpoint(0, 0);
  t.recordCheckpoint(1, 1000);
  const r = t.recordCheckpoint(0, 5000);
  assert.equal(r.kind, CHECKPOINT_RESULT_KIND.IGNORED);
  assert.equal(r.reason, 'missing-checkpoints');
});

test('allowMissedCheckpoints lets a lap close with invalid flag', () => {
  const t = new LapTracker({
    totalLaps: 2,
    checkpointCount: 3,
    allowMissedCheckpoints: true,
  });
  t.recordCheckpoint(0, 0);
  t.recordCheckpoint(1, 1000);
  const r = t.recordCheckpoint(0, 10000);
  assert.equal(r.kind, CHECKPOINT_RESULT_KIND.LAP);
  assert.equal(r.lap.invalid, true);
});

test('final lap crossing emits FINISH', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 2 });
  t.recordCheckpoint(0, 0);
  runCleanLap(t, 0, 60000);
  const finish = runCleanLap(t, 60000, 50000);
  assert.equal(finish.kind, CHECKPOINT_RESULT_KIND.FINISH);
  assert.equal(finish.lap.lapNumber, 2);
  assert.equal(finish.lap.durationMs, 50000);
  assert.equal(finish.lapsCompleted, 2);
  assert.equal(t.isFinished, true);
});

test('best lap is updated only by faster valid laps', () => {
  const t = new LapTracker({ totalLaps: 3, checkpointCount: 2 });
  t.recordCheckpoint(0, 0);
  runCleanLap(t, 0, 60000);
  runCleanLap(t, 60000, 65000);    // slower → not best
  runCleanLap(t, 125000, 55000);   // faster → best
  assert.equal(t.bestLapMs, 55000);
});

test('invalidateCurrentLap blocks best lap update', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 2 });
  t.recordCheckpoint(0, 0);
  t.recordCheckpoint(1, 1000);
  t.invalidateCurrentLap();
  t.recordCheckpoint(2, 2000);
  const lap = t.recordCheckpoint(0, 3000);
  assert.equal(lap.kind, CHECKPOINT_RESULT_KIND.LAP);
  assert.equal(lap.lap.invalid, true);
  assert.equal(lap.bestLap, false);
  assert.equal(t.bestLapMs, null);
});

test('finished race ignores further checkpoint hits', () => {
  const t = new LapTracker({ totalLaps: 1, checkpointCount: 1 });
  t.recordCheckpoint(0, 0);
  t.recordCheckpoint(1, 1000);
  t.recordCheckpoint(0, 2000);
  assert.equal(t.isFinished, true);
  const ignored = t.recordCheckpoint(1, 3000);
  assert.equal(ignored.kind, CHECKPOINT_RESULT_KIND.IGNORED);
  assert.equal(ignored.reason, 'race-finished');
});

test('reset() restores zeroed state', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 2 });
  t.recordCheckpoint(0, 0);
  runCleanLap(t, 0, 60000);
  t.reset();
  const s = t.snapshot();
  assert.equal(s.currentLap, 0);
  assert.equal(s.lapsCompleted, 0);
  assert.equal(s.bestLapMs, null);
  assert.deepEqual(s.lapHistory, []);
});

test('history limit bounds memory growth', () => {
  const t = new LapTracker({
    totalLaps: 50,
    checkpointCount: 1,
    historyLimit: 3,
  });
  t.recordCheckpoint(0, 0);
  for (let i = 0; i < 5; i++) {
    t.recordCheckpoint(1, (i + 1) * 1000 - 500);
    t.recordCheckpoint(0, (i + 1) * 1000);
  }
  const history = t.lapHistory;
  assert.equal(history.length, 3);
});

test('constructor rejects invalid configuration', () => {
  assert.throws(() => new LapTracker({ totalLaps: 0 }), ValidationError);
  assert.throws(() => new LapTracker({ totalLaps: 1.2 }), ValidationError);
  assert.throws(() => new LapTracker({ checkpointCount: -1 }), ValidationError);
});

test('recordCheckpoint rejects bad indices and timestamps', () => {
  const t = new LapTracker({ totalLaps: 2, checkpointCount: 2 });
  assert.throws(() => t.recordCheckpoint(-1, 0), ValidationError);
  assert.throws(() => t.recordCheckpoint(5, 0), ValidationError);
  assert.throws(() => t.recordCheckpoint(0, -1), ValidationError);
  assert.throws(() => t.recordCheckpoint(0, Number.POSITIVE_INFINITY), ValidationError);
});

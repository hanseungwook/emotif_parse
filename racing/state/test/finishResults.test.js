'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeFinishResults,
  summarizeLapHistory,
  formatLapTime,
} = require('../finishResults');
const { FINISH_REASON } = require('../constants');

function lap(n, ms, invalid) {
  return {
    lapNumber: n,
    durationMs: ms,
    startedAtMs: 0,
    finishedAtMs: ms,
    missedCheckpoints: 0,
    invalid: invalid === true,
  };
}

test('summarizeLapHistory ignores invalid laps for best/worst/avg', () => {
  const history = [lap(1, 60000), lap(2, 70000), lap(3, 55000, true)];
  const sum = summarizeLapHistory(history);
  assert.equal(sum.totalLaps, 3);
  assert.equal(sum.validLaps, 2);
  assert.equal(sum.invalidLaps, 1);
  assert.equal(sum.bestLap.durationMs, 60000);
  assert.equal(sum.worstLap.durationMs, 70000);
  assert.equal(sum.avgValidLapMs, 65000);
});

test('summarizeLapHistory handles empty list', () => {
  const sum = summarizeLapHistory([]);
  assert.equal(sum.totalLaps, 0);
  assert.equal(sum.validLaps, 0);
  assert.equal(sum.bestLap, null);
  assert.equal(sum.avgValidLapMs, null);
});

test('computeFinishResults defaults reason to COMPLETED and fills metadata', () => {
  const res = computeFinishResults({
    lapHistory: [lap(1, 60000), lap(2, 58000)],
    lapsCompleted: 2,
    totalLaps: 2,
    totalRaceMs: 118000,
    totalCrashes: 1,
    pauseCount: 2,
    totalPausedMs: 5000,
  });
  assert.equal(res.reason, FINISH_REASON.COMPLETED);
  assert.equal(res.finished, true);
  assert.equal(res.lapsCompleted, 2);
  assert.equal(res.totalLaps, 2);
  assert.equal(res.bestLapMs, 58000);
  assert.equal(res.bestLapNumber, 2);
  assert.equal(res.totalRaceMs, 118000);
  assert.equal(res.totalCrashes, 1);
  assert.equal(res.pauseCount, 2);
  assert.equal(res.totalPausedMs, 5000);
  assert.equal(res.completion, 1);
});

test('computeFinishResults sets finished=false for abandoned runs', () => {
  const res = computeFinishResults({
    reason: FINISH_REASON.ABANDONED,
    lapHistory: [lap(1, 60000)],
    lapsCompleted: 1,
    totalLaps: 3,
    totalRaceMs: 70000,
  });
  assert.equal(res.reason, FINISH_REASON.ABANDONED);
  assert.equal(res.finished, false);
  assert.equal(Math.round(res.completion * 100), 33);
});

test('computeFinishResults handles missing data gracefully', () => {
  const res = computeFinishResults({});
  assert.equal(res.lapsCompleted, 0);
  assert.equal(res.totalLaps, 0);
  assert.equal(res.completion, 1, 'no laps required = 100% complete');
  assert.equal(res.bestLapMs, null);
  assert.equal(res.avgValidLapMs, null);
  assert.equal(res.totalRaceMs, 0);
  assert.equal(res.totalCrashes, 0);
});

test('formatLapTime renders MM:SS.mmm', () => {
  assert.equal(formatLapTime(0), '00:00.000');
  assert.equal(formatLapTime(1234), '00:01.234');
  assert.equal(formatLapTime(60000), '01:00.000');
  assert.equal(formatLapTime(83456), '01:23.456');
  assert.equal(formatLapTime(null), '--:--.---');
  assert.equal(formatLapTime(Number.NaN), '--:--.---');
});

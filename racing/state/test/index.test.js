'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('..');

test('index exports the full public surface', () => {
  // Constructors
  assert.equal(typeof api.RaceState, 'function');
  assert.equal(typeof api.createRaceState, 'function');
  assert.equal(typeof api.Countdown, 'function');
  assert.equal(typeof api.LapTracker, 'function');
  assert.equal(typeof api.CrashHandler, 'function');
  assert.equal(typeof api.EventEmitter, 'function');

  // Constants (string enums)
  assert.equal(api.PHASE.RACING, 'racing');
  assert.equal(api.PHASE.FINISHED, 'finished');
  assert.equal(api.FINISH_REASON.COMPLETED, 'completed');
  assert.equal(api.CRASH_SEVERITY.MAJOR, 'major');
  assert.equal(api.CHECKPOINT_RESULT_KIND.LAP, 'lap');
  assert.equal(api.MODE.LAP_RACE, 'lapRace');
  assert.equal(api.EVENTS.LAP_COMPLETE, 'lap:complete');
  assert.equal(api.DEFAULTS.totalLaps, 3);

  // Helpers
  assert.equal(typeof api.computeFinishResults, 'function');
  assert.equal(typeof api.summarizeLapHistory, 'function');
  assert.equal(typeof api.formatLapTime, 'function');

  // Errors
  assert.equal(typeof api.RaceError, 'function');
  assert.equal(typeof api.ValidationError, 'function');
  assert.equal(typeof api.StateError, 'function');
});

test('PHASE / FINISH_REASON / CRASH_SEVERITY are frozen', () => {
  assert.ok(Object.isFrozen(api.PHASE));
  assert.ok(Object.isFrozen(api.FINISH_REASON));
  assert.ok(Object.isFrozen(api.CRASH_SEVERITY));
  assert.ok(Object.isFrozen(api.EVENTS));
  assert.ok(Object.isFrozen(api.DEFAULTS));
});

test('createRaceState returns a usable RaceState', () => {
  const r = api.createRaceState({ totalLaps: 1, checkpointCount: 0 });
  r.start();
  // 0 intermediate checkpoints → after countdown, two start-line crossings
  // finish the run.
  for (let i = 0; i < 3; i++) r.tick(1000);
  assert.equal(r.phase, api.PHASE.RACING);
  r.registerCheckpoint(0);   // arms lap 1
  r.tick(500);
  r.registerCheckpoint(0);   // closes lap 1 → FINISH
  assert.equal(r.phase, api.PHASE.FINISHED);
});

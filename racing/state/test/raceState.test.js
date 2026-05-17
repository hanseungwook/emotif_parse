'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RaceState,
  createRaceState,
  PHASE,
  EVENTS,
  FINISH_REASON,
  CRASH_SEVERITY,
  CHECKPOINT_RESULT_KIND,
  MODE,
  ValidationError,
  StateError,
} = require('..');

function newRace(opts) {
  return new RaceState(Object.assign({
    totalLaps: 2,
    checkpointCount: 2,
    countdownSteps: 3,
    countdownStepMs: 1000,
    respawnDelayMs: 1000,
  }, opts || {}));
}

function recordEvents(race, names) {
  const log = [];
  for (const name of names) {
    race.on(name, (payload) => log.push({ name, payload }));
  }
  return log;
}

function runCountdownToGo(race, opts = {}) {
  const stepMs = opts.stepMs != null ? opts.stepMs : 1000;
  const steps = opts.steps != null ? opts.steps : 3;
  for (let i = 0; i < steps; i++) {
    race.tick(stepMs);
  }
  // One more tick may still be COUNTDOWN if the GO beat lands exactly on
  // a boundary handled within the next tick.
  if (race.phase === PHASE.COUNTDOWN) race.tick(stepMs);
}

function runCleanLap(race, raceClockBefore, lapDurationMs, checkpoints) {
  const cps = checkpoints != null ? checkpoints : 2;
  const totalSteps = cps + 1;
  // Distribute the duration across `cps + 1` ticks while keeping the final
  // race clock exactly at raceClockBefore + lapDurationMs. Trailing tick
  // absorbs any rounding remainder.
  const baseStep = Math.floor(lapDurationMs / totalSteps);
  const remainder = lapDurationMs - baseStep * totalSteps;
  for (let i = 1; i <= cps; i++) {
    race.tick(baseStep);
    race.registerCheckpoint(i);
  }
  race.tick(baseStep + remainder);
  return race.registerCheckpoint(0);
}

// ----- lifecycle -----------------------------------------------------------

test('race starts in IDLE and exposes default snapshot', () => {
  const r = newRace();
  const s = r.snapshot();
  assert.equal(s.phase, PHASE.IDLE);
  assert.equal(s.raceClockMs, 0);
  assert.equal(s.mode, MODE.LAP_RACE);
  assert.equal(s.lap.totalLaps, 2);
  assert.equal(s.lap.lapsCompleted, 0);
  assert.equal(s.crash.totalCrashes, 0);
  assert.equal(s.results, null);
});

test('start() transitions IDLE → COUNTDOWN and emits start + first beat', () => {
  const r = newRace();
  const events = recordEvents(r, [EVENTS.START, EVENTS.COUNTDOWN_TICK, EVENTS.PHASE_CHANGE]);
  assert.equal(r.start(), true);
  assert.equal(r.phase, PHASE.COUNTDOWN);
  const names = events.map((e) => e.name);
  assert.ok(names.includes(EVENTS.START));
  assert.ok(names.includes(EVENTS.COUNTDOWN_TICK));
  assert.ok(names.includes(EVENTS.PHASE_CHANGE));
  const tick = events.find((e) => e.name === EVENTS.COUNTDOWN_TICK);
  assert.equal(tick.payload.beat, 3);
});

test('starting twice during countdown/racing throws StateError', () => {
  const r = newRace();
  r.start();
  assert.throws(() => r.start(), StateError);
});

test('start() after FINISHED resets and re-arms', () => {
  const r = newRace({ totalLaps: 1, checkpointCount: 1 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  r.registerCheckpoint(1);
  r.tick(1000);
  r.registerCheckpoint(0);
  assert.equal(r.phase, PHASE.FINISHED);
  r.start();
  assert.equal(r.phase, PHASE.COUNTDOWN);
  assert.equal(r.raceClockMs, 0);
});

test('reset() returns to IDLE and emits RESET', () => {
  const r = newRace();
  const log = recordEvents(r, [EVENTS.RESET]);
  r.start();
  r.tick(500);
  r.reset();
  assert.equal(r.phase, PHASE.IDLE);
  assert.equal(log.length, 1);
});

// ----- countdown ----------------------------------------------------------

test('countdown emits 3-2-1-GO and transitions to RACING', () => {
  const r = newRace();
  const log = recordEvents(r, [
    EVENTS.COUNTDOWN_TICK,
    EVENTS.COUNTDOWN_GO,
    EVENTS.RACE_BEGIN,
  ]);
  r.start();
  r.tick(1000); // 3 → 2
  r.tick(1000); // 2 → 1
  r.tick(1000); // 1 → GO
  const beatValues = log
    .filter((e) => e.name === EVENTS.COUNTDOWN_TICK)
    .map((e) => e.payload.beat);
  assert.deepEqual(beatValues, [3, 2, 1]);
  assert.equal(log.filter((e) => e.name === EVENTS.COUNTDOWN_GO).length, 1);
  assert.equal(log.filter((e) => e.name === EVENTS.RACE_BEGIN).length, 1);
  assert.equal(r.phase, PHASE.RACING);
});

test('countdown can be configured with custom steps and stepMs', () => {
  const r = newRace({ countdownSteps: 1, countdownStepMs: 250 });
  r.start();
  assert.equal(r.phase, PHASE.COUNTDOWN);
  r.tick(250);
  assert.equal(r.phase, PHASE.RACING);
});

test('countdown overshoot dt flows into RACING clock', () => {
  const r = newRace({ countdownSteps: 1, countdownStepMs: 100 });
  r.start();
  r.tick(300); // 100 consumes countdown + 200 left over for racing
  assert.equal(r.phase, PHASE.RACING);
  assert.ok(r.raceClockMs >= 199 && r.raceClockMs <= 201);
});

// ----- in-race tick / clock -----------------------------------------------

test('RACING phase advances the race clock and emits race:tick', () => {
  const r = newRace();
  const log = recordEvents(r, [EVENTS.RACE_TICK]);
  r.start();
  runCountdownToGo(r);
  log.length = 0;
  r.tick(500);
  assert.equal(r.raceClockMs, 500);
  assert.equal(log.length, 1);
  assert.equal(log[0].payload.dtMs, 500);
});

test('tick(0) is a no-op', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  const clock = r.raceClockMs;
  r.tick(0);
  assert.equal(r.raceClockMs, clock);
});

test('tick(<0) throws ValidationError', () => {
  const r = newRace();
  r.start();
  assert.throws(() => r.tick(-1), ValidationError);
  assert.throws(() => r.tick(Number.NaN), ValidationError);
});

// ----- checkpoints --------------------------------------------------------

test('registerCheckpoint emits CHECKPOINT progress', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 3 });
  const log = recordEvents(r, [EVENTS.CHECKPOINT]);
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0); // first crossing
  r.tick(1000);
  r.registerCheckpoint(1);
  r.tick(1000);
  r.registerCheckpoint(2);
  assert.equal(log.length, 3);
  assert.equal(log[0].payload.firstCrossing, true);
  assert.equal(log[2].payload.checkpointIndex, 2);
});

test('out-of-order checkpoints are ignored', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 3 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  const result = r.registerCheckpoint(2);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.IGNORED);
});

test('full lap emits LAP_COMPLETE and BEST_LAP', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 2 });
  const log = recordEvents(r, [EVENTS.LAP_COMPLETE, EVENTS.BEST_LAP]);
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0); // first crossing
  runCleanLap(r, 0, 60000, 2);
  assert.equal(log.filter((e) => e.name === EVENTS.LAP_COMPLETE).length, 1);
  assert.equal(log.filter((e) => e.name === EVENTS.BEST_LAP).length, 1);
  const lap = log.find((e) => e.name === EVENTS.LAP_COMPLETE).payload.lap;
  assert.equal(lap.lapNumber, 1);
});

test('checkpoint hits are ignored while CRASHED', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 2 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  const result = r.registerCheckpoint(1);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.IGNORED);
});

test('checkpoint hits are ignored while PAUSED', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 2 });
  r.start();
  runCountdownToGo(r);
  r.pause();
  const result = r.registerCheckpoint(1);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.IGNORED);
});

// ----- pause / resume -----------------------------------------------------

test('pause() halts the race clock', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  r.tick(500);
  const before = r.raceClockMs;
  assert.equal(r.pause(), true);
  r.tick(1000);
  assert.equal(r.raceClockMs, before);
});

test('resume() restores RACING and counts paused duration', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  r.tick(500);
  r.pause();
  r.tick(2000); // ignored
  assert.equal(r.resume(), true);
  assert.equal(r.phase, PHASE.RACING);
  r.tick(500);
  assert.equal(r.raceClockMs, 1000);
});

test('pause from CRASHED restores CRASHED on resume', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  assert.equal(r.phase, PHASE.CRASHED);
  r.pause();
  assert.equal(r.phase, PHASE.PAUSED);
  r.resume();
  assert.equal(r.phase, PHASE.CRASHED);
});

test('pause from IDLE / FINISHED is a no-op', () => {
  const r = newRace();
  assert.equal(r.pause(), false);
  r.start();
  runCountdownToGo(r);
  r.tick(1000);
  assert.equal(r.pause(), true);
  assert.equal(r.pause(), false);
});

test('pause / resume increments counters', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  r.tick(100);
  r.pause();
  r.resume();
  r.tick(100);
  r.pause();
  r.resume();
  assert.equal(r.snapshot().pauseCount, 2);
});

// ----- crash / respawn ----------------------------------------------------

test('registerCrash transitions to CRASHED and emits CRASH event', () => {
  const r = newRace({ respawnDelayMs: 1000 });
  const log = recordEvents(r, [EVENTS.CRASH, EVENTS.PHASE_CHANGE]);
  r.start();
  runCountdownToGo(r);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR, cause: 'wall' });
  assert.equal(r.phase, PHASE.CRASHED);
  const crashEvt = log.find((e) => e.name === EVENTS.CRASH);
  assert.ok(crashEvt);
  assert.equal(crashEvt.payload.cause, 'wall');
});

test('CRASHED phase drains respawn timer and returns to RACING', () => {
  const r = newRace({ respawnDelayMs: 1000 });
  const log = recordEvents(r, [EVENTS.RESPAWN]);
  r.start();
  runCountdownToGo(r);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  r.tick(500);
  assert.equal(r.phase, PHASE.CRASHED);
  r.tick(500);
  assert.equal(r.phase, PHASE.RACING);
  assert.equal(log.length, 1);
});

test('major/total crashes invalidate the current lap', () => {
  const r = newRace({ respawnDelayMs: 100 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  r.registerCheckpoint(1);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  r.tick(100);
  r.tick(100);
  r.registerCheckpoint(2);
  const result = r.registerCheckpoint(0);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.LAP);
  assert.equal(result.lap.invalid, true);
  assert.equal(result.bestLap, false);
});

test('minor crashes do NOT invalidate the lap', () => {
  const r = newRace({ respawnDelayMs: 100 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  r.registerCheckpoint(1);
  r.registerCrash({ severity: CRASH_SEVERITY.MINOR });
  r.tick(100);
  r.registerCheckpoint(2);
  const result = r.registerCheckpoint(0);
  assert.equal(result.kind, CHECKPOINT_RESULT_KIND.LAP);
  assert.equal(result.lap.invalid, false);
});

test('crash race clock continues to advance', () => {
  const r = newRace({ respawnDelayMs: 1500 });
  r.start();
  runCountdownToGo(r);
  const before = r.raceClockMs;
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  r.tick(500);
  assert.equal(r.raceClockMs, before + 500);
});

test('respawnNow short-circuits the timer', () => {
  const r = newRace({ respawnDelayMs: 5000 });
  r.start();
  runCountdownToGo(r);
  r.registerCrash({ severity: CRASH_SEVERITY.MAJOR });
  assert.equal(r.respawnNow(), true);
  assert.equal(r.phase, PHASE.RACING);
});

test('registerCrash outside RACING returns null', () => {
  const r = newRace();
  assert.equal(r.registerCrash({}), null);
  r.start();
  assert.equal(r.registerCrash({}), null);
});

// ----- finish flow --------------------------------------------------------

test('completing all laps emits FINISH + RESULTS and freezes clock', () => {
  const r = newRace({ totalLaps: 2, checkpointCount: 2 });
  const log = recordEvents(r, [EVENTS.FINISH, EVENTS.RESULTS, EVENTS.LAP_COMPLETE]);
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  runCleanLap(r, 0, 60000, 2);          // lap 1
  runCleanLap(r, 60000, 55000, 2);      // lap 2 → FINISH
  assert.equal(r.phase, PHASE.FINISHED);
  assert.equal(log.filter((e) => e.name === EVENTS.FINISH).length, 1);
  assert.equal(log.filter((e) => e.name === EVENTS.RESULTS).length, 1);
  // 1 lap-complete event before the final FINISH-trigger lap.
  assert.equal(log.filter((e) => e.name === EVENTS.LAP_COMPLETE).length, 1);
  const results = r.results;
  assert.equal(results.reason, FINISH_REASON.COMPLETED);
  assert.equal(results.finished, true);
  assert.equal(results.lapsCompleted, 2);
  assert.equal(results.bestLapMs, 55000);
});

test('after FINISH, additional ticks are no-ops', () => {
  const r = newRace({ totalLaps: 1, checkpointCount: 1 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  r.registerCheckpoint(1);
  r.tick(1000);
  r.registerCheckpoint(0);
  assert.equal(r.phase, PHASE.FINISHED);
  const clock = r.raceClockMs;
  r.tick(5000);
  assert.equal(r.raceClockMs, clock);
});

test('abandon() emits ABANDON + RESULTS with abandoned reason', () => {
  const r = newRace();
  const log = recordEvents(r, [EVENTS.ABANDON, EVENTS.RESULTS]);
  r.start();
  runCountdownToGo(r);
  r.tick(2000);
  assert.equal(r.abandon('player-quit'), true);
  assert.equal(r.phase, PHASE.ABANDONED);
  const abandonEvt = log.find((e) => e.name === EVENTS.ABANDON);
  assert.equal(abandonEvt.payload.detail, 'player-quit');
  assert.equal(r.results.reason, FINISH_REASON.ABANDONED);
  assert.equal(r.results.finished, false);
});

test('abandon() on already finished race returns false', () => {
  const r = newRace({ totalLaps: 1, checkpointCount: 1 });
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(1000);
  r.registerCheckpoint(1);
  r.tick(1000);
  r.registerCheckpoint(0);
  assert.equal(r.abandon(), false);
});

// ----- time attack mode ---------------------------------------------------

test('timeLimitMs enables TIME_ATTACK mode and times out', () => {
  const r = newRace({ timeLimitMs: 5000, totalLaps: 10, checkpointCount: 2 });
  const log = recordEvents(r, [EVENTS.FINISH]);
  assert.equal(r.mode, MODE.TIME_ATTACK);
  r.start();
  runCountdownToGo(r);
  r.tick(3000);
  assert.equal(r.snapshot().timeRemainingMs, 2000);
  r.tick(3000);
  assert.equal(r.phase, PHASE.FINISHED);
  assert.equal(r.results.reason, FINISH_REASON.TIMED_OUT);
  assert.equal(log.length, 1);
});

test('time attack ignores time-limit while paused', () => {
  const r = newRace({ timeLimitMs: 1000, totalLaps: 5, checkpointCount: 2 });
  r.start();
  runCountdownToGo(r);
  r.tick(500);
  r.pause();
  r.tick(2000);
  assert.equal(r.phase, PHASE.PAUSED);
});

// ----- validation / errors ------------------------------------------------

test('constructor validates options', () => {
  assert.throws(() => new RaceState({ totalLaps: 0 }), ValidationError);
  assert.throws(() => new RaceState({ checkpointCount: -1 }), ValidationError);
  assert.throws(() => new RaceState({ timeLimitMs: 0 }), ValidationError);
});

test('createRaceState is a constructor shortcut', () => {
  const r = createRaceState({ totalLaps: 4 });
  assert.ok(r instanceof RaceState);
  assert.equal(r.snapshot().lap.totalLaps, 4);
});

// ----- phase-change events ------------------------------------------------

test('phase:change events fire for every transition', () => {
  const r = newRace({ totalLaps: 1, checkpointCount: 1 });
  const changes = [];
  r.on(EVENTS.PHASE_CHANGE, (p) => changes.push([p.from, p.to]));
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(500);
  r.registerCheckpoint(1);
  r.tick(500);
  r.registerCheckpoint(0);
  const transitions = changes.map((c) => c.join('→'));
  assert.ok(transitions.includes('idle→countdown'));
  assert.ok(transitions.includes('countdown→racing'));
  assert.ok(transitions.includes('racing→finished'));
});

test('phase:change is emitted on pause/resume', () => {
  const r = newRace();
  const changes = [];
  r.on(EVENTS.PHASE_CHANGE, (p) => changes.push([p.from, p.to]));
  r.start();
  runCountdownToGo(r);
  changes.length = 0;
  r.pause();
  r.resume();
  assert.deepEqual(changes.map((c) => c.join('→')), [
    'racing→paused',
    'paused→racing',
  ]);
});

// ----- snapshot completeness ----------------------------------------------

test('snapshot has all expected sections', () => {
  const r = newRace();
  r.start();
  runCountdownToGo(r);
  r.registerCheckpoint(0);
  r.tick(500);
  const s = r.snapshot();
  assert.ok(s.lap, 'lap subtree present');
  assert.ok(s.crash, 'crash subtree present');
  assert.ok(s.countdown, 'countdown subtree present');
  assert.equal(typeof s.raceClockMs, 'number');
  assert.equal(typeof s.totalPausedMs, 'number');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ScoringRuntime,
  createScoringRuntime,
  EVENTS,
  ValidationError,
  StateError,
  BACK_TO_BACK_MULTIPLIER,
  COMBO_POINTS,
  PERFECT_CLEAR_B2B_TETRIS_BONUS,
} = require('..');

function recordEvents(runtime, names) {
  const log = [];
  for (const name of names) {
    runtime.on(name, (payload) => log.push({ name, payload }));
  }
  return log;
}

test('initial snapshot has zeroed counters and starting level', () => {
  const r = new ScoringRuntime();
  const s = r.snapshot();
  assert.equal(s.score, 0);
  assert.equal(s.level, 1);
  assert.equal(s.lines, 0);
  assert.equal(s.combo, 0);
  assert.equal(s.backToBack, 0);
  assert.equal(s.linesUntilNextLevel, 10);
  assert.equal(s.fallSpeedMs, 1000);
  assert.equal(s.paused, false);
  assert.equal(s.gameOver, false);
  assert.equal(s.started, false);
});

test('createScoringRuntime is a constructor shortcut', () => {
  const r = createScoringRuntime({ startLevel: 3 });
  assert.ok(r instanceof ScoringRuntime);
  assert.equal(r.snapshot().level, 3);
});

test('startLevel and linesPerLevel options are honored', () => {
  const r = new ScoringRuntime({ startLevel: 5, linesPerLevel: 4 });
  const s = r.snapshot();
  assert.equal(s.level, 5);
  assert.equal(s.linesUntilNextLevel, 4);
});

test('options are validated', () => {
  assert.throws(() => new ScoringRuntime({ startLevel: 0 }), ValidationError);
  assert.throws(() => new ScoringRuntime({ startLevel: 1.5 }), ValidationError);
  assert.throws(() => new ScoringRuntime({ linesPerLevel: 0 }), ValidationError);
  assert.throws(() => new ScoringRuntime({ maxLevel: 0 }), ValidationError);
  assert.throws(() => new ScoringRuntime({ softDropPointsPerCell: -1 }), ValidationError);
});

test('single line clear at level 1 scores 100', () => {
  const r = new ScoringRuntime();
  const result = r.registerLineClear({ lines: 1 });
  assert.equal(result.totalPoints, 100);
  assert.equal(r.snapshot().score, 100);
  assert.equal(r.snapshot().lines, 1);
});

test('Tetris at level 1 scores 800 and increments tetris counter', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  const s = r.snapshot();
  assert.equal(s.score, 800);
  assert.equal(s.tetrises, 1);
  assert.equal(s.backToBack, 1);
});

test('back-to-back Tetris applies 1.5x multiplier on second', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 }); // 800, combo=1, B2B=1
  r.registerLineClear({ lines: 4 }); // 800*1.5 + combo bonus 50*1*1, combo=2, B2B=2
  const s = r.snapshot();
  assert.equal(s.score, 800 + 800 * BACK_TO_BACK_MULTIPLIER + COMBO_POINTS);
  assert.equal(s.backToBack, 2);
});

test('regular line clear breaks back-to-back chain', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().backToBack, 1);
  r.registerLineClear({ lines: 2 });
  assert.equal(r.snapshot().backToBack, 0);
});

test('lock without clear does NOT break back-to-back chain', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().backToBack, 1);
  r.registerLockNoClear();
  assert.equal(r.snapshot().backToBack, 1);
});

test('lock without clear DOES break combo chain', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 1 });
  r.registerLineClear({ lines: 1 });
  assert.equal(r.snapshot().combo, 2);
  r.registerLockNoClear();
  assert.equal(r.snapshot().combo, 0);
});

test('combo bonus follows 50 * (combo - 1) * level', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 1 }); // combo=1, no bonus, +100
  assert.equal(r.snapshot().score, 100);
  r.registerLineClear({ lines: 1 }); // combo=2, bonus=50*1*1=50, +100 +50 = 150
  assert.equal(r.snapshot().score, 100 + 100 + COMBO_POINTS * 1 * 1);
  r.registerLineClear({ lines: 1 }); // combo=3, bonus=50*2*1=100, +100 +100 = 200
  assert.equal(
    r.snapshot().score,
    100 + 100 + COMBO_POINTS * 1 + 100 + COMBO_POINTS * 2
  );
});

test('combo bonus scales with current level', () => {
  const r = new ScoringRuntime({ startLevel: 4 });
  r.registerLineClear({ lines: 1 }); // +100*4, combo=1
  r.registerLineClear({ lines: 1 }); // +100*4 + 50*1*4 (combo bonus)
  const expected = 100 * 4 + 100 * 4 + COMBO_POINTS * 1 * 4;
  assert.equal(r.snapshot().score, expected);
});

test('soft drop adds 1 point per cell', () => {
  const r = new ScoringRuntime();
  const result = r.registerSoftDrop(5);
  assert.equal(result.points, 5);
  assert.equal(r.snapshot().score, 5);
});

test('hard drop adds 2 points per cell', () => {
  const r = new ScoringRuntime();
  const result = r.registerHardDrop(10);
  assert.equal(result.points, 20);
  assert.equal(r.snapshot().score, 20);
});

test('drop zero cells is a no-op', () => {
  const r = new ScoringRuntime();
  const log = recordEvents(r, [EVENTS.SCORE_CHANGE, EVENTS.SOFT_DROP, EVENTS.HARD_DROP]);
  r.registerSoftDrop(0);
  r.registerHardDrop(0);
  assert.equal(r.snapshot().score, 0);
  assert.equal(log.length, 0);
});

test('drop validates input', () => {
  const r = new ScoringRuntime();
  assert.throws(() => r.registerSoftDrop(-1), ValidationError);
  assert.throws(() => r.registerSoftDrop(1.5), ValidationError);
  assert.throws(() => r.registerHardDrop('two'), ValidationError);
});

test('level advances every linesPerLevel and emits level:up', () => {
  const r = new ScoringRuntime();
  const events = recordEvents(r, [EVENTS.LEVEL_UP]);
  // Clear 10 lines via Tetrises (4 + 4 + 2)
  r.registerLineClear({ lines: 4 });
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().level, 1);
  r.registerLineClear({ lines: 2 });
  const s = r.snapshot();
  assert.equal(s.lines, 10);
  assert.equal(s.level, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.previous, 1);
  assert.equal(events[0].payload.level, 2);
  assert.ok(events[0].payload.fallSpeedMs < 1000);
});

test('fall speed updates after level up', () => {
  const r = new ScoringRuntime();
  const before = r.getFallSpeedMs();
  r.registerLineClear({ lines: 4 });
  r.registerLineClear({ lines: 4 });
  r.registerLineClear({ lines: 4 });
  const after = r.getFallSpeedMs();
  assert.ok(after < before);
});

test('T-Spin Double scores 1200 * level', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 2, tSpin: true });
  assert.equal(r.snapshot().score, 1200);
  assert.equal(r.snapshot().tSpins, 1);
  assert.equal(r.snapshot().backToBack, 1);
});

test('Mini T-Spin counts as B2B-eligible difficult clear when it clears a line', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 1, tSpin: true, mini: true });
  assert.equal(r.snapshot().backToBack, 1);
  // Next Tetris should be back-to-back AND extend the combo to 2.
  const beforeScore = r.snapshot().score;
  r.registerLineClear({ lines: 4 });
  const delta = r.snapshot().score - beforeScore;
  assert.equal(delta, 800 * BACK_TO_BACK_MULTIPLIER + COMBO_POINTS);
});

test('Perfect clear Tetris with B2B includes both bonuses', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 }); // B2B begins, combo=1
  const baseline = r.snapshot().score;
  r.registerLineClear({ lines: 4, perfectClear: true }); // combo=2 adds combo bonus
  const delta = r.snapshot().score - baseline;
  const tetrisScaled = 800 * BACK_TO_BACK_MULTIPLIER;
  const pcBonus = 2000 + PERFECT_CLEAR_B2B_TETRIS_BONUS;
  assert.equal(delta, tetrisScaled + pcBonus + COMBO_POINTS);
});

test('snapshot tracks linesUntilNextLevel correctly across level-ups', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().linesUntilNextLevel, 6);
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().linesUntilNextLevel, 2);
  r.registerLineClear({ lines: 4 }); // 12 total -> level 2, 2 into level, 8 remaining
  const s = r.snapshot();
  assert.equal(s.lines, 12);
  assert.equal(s.level, 2);
  assert.equal(s.linesUntilNextLevel, 8);
});

test('reset clears all state and emits reset event', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  r.registerSoftDrop(3);
  const events = recordEvents(r, [EVENTS.RESET]);
  r.reset();
  const s = r.snapshot();
  assert.equal(s.score, 0);
  assert.equal(s.lines, 0);
  assert.equal(s.level, 1);
  assert.equal(s.combo, 0);
  assert.equal(s.backToBack, 0);
  assert.equal(events.length, 1);
});

test('pause/resume emit events and update flag', () => {
  const r = new ScoringRuntime();
  r.start();
  const events = recordEvents(r, [EVENTS.PAUSE, EVENTS.RESUME]);
  assert.equal(r.pause(), true);
  assert.equal(r.isPaused(), true);
  assert.equal(r.pause(), false); // idempotent
  assert.equal(r.resume(), true);
  assert.equal(r.isPaused(), false);
  assert.equal(r.resume(), false);
  assert.equal(events.length, 2);
  assert.equal(events[0].name, EVENTS.PAUSE);
  assert.equal(events[1].name, EVENTS.RESUME);
});

test('strict pause mode throws on registration while paused', () => {
  const r = new ScoringRuntime({ strictPause: true });
  r.start();
  r.pause();
  assert.throws(() => r.registerLineClear({ lines: 1 }), StateError);
  assert.throws(() => r.registerSoftDrop(2), StateError);
  r.resume();
  r.registerLineClear({ lines: 1 }); // should succeed
});

test('gameOver blocks further registrations and breaks chains', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  r.registerLineClear({ lines: 4 });
  const events = recordEvents(r, [EVENTS.GAME_OVER, EVENTS.B2B_BREAK]);
  assert.equal(r.gameOver(), true);
  assert.equal(r.gameOver(), false); // idempotent
  assert.equal(r.isGameOver(), true);
  assert.equal(r.snapshot().backToBack, 0);
  assert.equal(events[0].name, EVENTS.GAME_OVER);
  assert.equal(events[1].name, EVENTS.B2B_BREAK);
  assert.throws(() => r.registerLineClear({ lines: 1 }), StateError);
  assert.throws(() => r.registerSoftDrop(1), StateError);
});

test('start() re-initializes after gameOver', () => {
  const r = new ScoringRuntime();
  r.start();
  r.registerLineClear({ lines: 4 });
  r.gameOver();
  r.start();
  const s = r.snapshot();
  assert.equal(s.score, 0);
  assert.equal(s.gameOver, false);
  assert.equal(s.started, true);
});

test('score:change event includes breakdown', () => {
  const r = new ScoringRuntime();
  const events = recordEvents(r, [EVENTS.SCORE_CHANGE]);
  r.registerLineClear({ lines: 4 });
  r.registerLineClear({ lines: 4 });
  assert.equal(events.length, 2);
  for (const e of events) {
    assert.equal(e.payload.source, 'line-clear');
    assert.ok(e.payload.breakdown);
    assert.ok(typeof e.payload.breakdown.basePoints === 'number');
    assert.ok(typeof e.payload.breakdown.comboPoints === 'number');
    assert.ok(typeof e.payload.breakdown.b2bMultiplier === 'number');
  }
  assert.equal(events[1].payload.breakdown.b2bMultiplier, BACK_TO_BACK_MULTIPLIER);
});

test('line:clear event carries detailed metadata', () => {
  const r = new ScoringRuntime();
  const log = recordEvents(r, [EVENTS.LINE_CLEAR]);
  r.registerLineClear({ lines: 2, tSpin: true });
  assert.equal(log.length, 1);
  const p = log[0].payload;
  assert.equal(p.badge, 't-spin-double');
  assert.equal(p.difficult, true);
  assert.equal(p.lines, 2);
  assert.equal(p.tSpin, true);
  assert.equal(p.basePoints, 1200);
});

test('combo:change fires whenever combo value moves', () => {
  const r = new ScoringRuntime();
  const log = recordEvents(r, [EVENTS.COMBO_CHANGE, EVENTS.COMBO_BREAK]);
  r.registerLineClear({ lines: 1 }); // 0 -> 1
  r.registerLineClear({ lines: 1 }); // 1 -> 2
  r.registerLineClear({ lines: 1 }); // 2 -> 3
  r.registerLockNoClear();           // 3 -> 0  (+break)
  const names = log.map((e) => e.name);
  assert.deepEqual(names, [
    EVENTS.COMBO_CHANGE,
    EVENTS.COMBO_CHANGE,
    EVENTS.COMBO_CHANGE,
    EVENTS.COMBO_CHANGE,
    EVENTS.COMBO_BREAK,
  ]);
});

test('b2b:change and b2b:break fire on transitions', () => {
  const r = new ScoringRuntime();
  const log = recordEvents(r, [EVENTS.B2B_CHANGE, EVENTS.B2B_BREAK]);
  r.registerLineClear({ lines: 4 }); // 0 -> 1
  r.registerLineClear({ lines: 4 }); // 1 -> 2
  r.registerLineClear({ lines: 1 }); // 2 -> 0 (+break)
  const names = log.map((e) => e.name);
  assert.deepEqual(names, [
    EVENTS.B2B_CHANGE,
    EVENTS.B2B_CHANGE,
    EVENTS.B2B_CHANGE,
    EVENTS.B2B_BREAK,
  ]);
});

test('lines:change fires only on clears with lines', () => {
  const r = new ScoringRuntime();
  const log = recordEvents(r, [EVENTS.LINES_CHANGE]);
  r.registerLineClear({ lines: 0, tSpin: true });
  r.registerLineClear({ lines: 1 });
  r.registerLineClear({ lines: 2 });
  assert.equal(log.length, 2);
  assert.equal(log[0].payload.delta, 1);
  assert.equal(log[1].payload.delta, 2);
  assert.equal(log[1].payload.lines, 3);
});

test('soft:drop and hard:drop events include cell count and points', () => {
  const r = new ScoringRuntime();
  const soft = [];
  const hard = [];
  r.on(EVENTS.SOFT_DROP, (p) => soft.push(p));
  r.on(EVENTS.HARD_DROP, (p) => hard.push(p));
  r.registerSoftDrop(4);
  r.registerHardDrop(7);
  assert.equal(soft[0].cells, 4);
  assert.equal(soft[0].points, 4);
  assert.equal(hard[0].cells, 7);
  assert.equal(hard[0].points, 14);
});

test('snapshot.lastEvent reflects most recent registration', () => {
  const r = new ScoringRuntime();
  r.registerLineClear({ lines: 4 });
  assert.equal(r.snapshot().lastEvent.kind, 'line-clear');
  r.registerSoftDrop(2);
  assert.equal(r.snapshot().lastEvent.kind, 'soft-drop');
  r.registerLockNoClear();
  assert.equal(r.snapshot().lastEvent.kind, 'lock');
});

test('snapshot exposes max combo/B2B for run summary', () => {
  const r = new ScoringRuntime();
  for (let i = 0; i < 5; i += 1) r.registerLineClear({ lines: 1 });
  r.registerLockNoClear();
  for (let i = 0; i < 3; i += 1) r.registerLineClear({ lines: 4 });
  const s = r.snapshot();
  assert.equal(s.maxCombo, 5);
  assert.equal(s.maxBackToBack, 3);
});

test('full play: combination of clears and drops produces consistent state', () => {
  const r = new ScoringRuntime();
  r.start();
  r.registerHardDrop(18);              // +36
  r.registerLineClear({ lines: 1 });   // +100, combo=1
  r.registerHardDrop(18);              // +36
  r.registerLineClear({ lines: 2, tSpin: true }); // +1200, combo=2 (+50*1*1=50), B2B=1
  r.registerSoftDrop(3);               // +3
  r.registerLineClear({ lines: 4 });   // +800*1.5=1200, combo=3 (+50*2*1=100), B2B=2
  const s = r.snapshot();
  const expected = 36 + 100 + 36 + 1200 + 50 + 3 + 1200 + 100;
  assert.equal(s.score, expected);
  assert.equal(s.lines, 7);
  assert.equal(s.combo, 3);
  assert.equal(s.backToBack, 2);
  assert.equal(s.tetrises, 1);
  assert.equal(s.tSpins, 1);
});

test('listener errors do not break subsequent emits', () => {
  const r = new ScoringRuntime();
  const errors = [];
  r.on('error', (e) => errors.push(e));
  r.on(EVENTS.SCORE_CHANGE, () => { throw new Error('boom'); });
  r.registerLineClear({ lines: 1 });
  assert.equal(errors.length, 1);
  // Second registration still works
  r.registerLineClear({ lines: 1 });
  assert.equal(r.snapshot().score, 100 + 100 + COMBO_POINTS * 1);
});

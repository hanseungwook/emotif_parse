'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  scoreLineClear,
  basePointsFor,
  isDifficultClear,
  badgeFor,
} = require('../lineClearScorer');
const { ValidationError } = require('../errors');
const {
  BACK_TO_BACK_MULTIPLIER,
  PERFECT_CLEAR_B2B_TETRIS_BONUS,
} = require('../constants');

test('basePointsFor returns guideline values for regular clears', () => {
  assert.equal(basePointsFor({ lines: 0 }), 0);
  assert.equal(basePointsFor({ lines: 1 }), 100);
  assert.equal(basePointsFor({ lines: 2 }), 300);
  assert.equal(basePointsFor({ lines: 3 }), 500);
  assert.equal(basePointsFor({ lines: 4 }), 800);
});

test('basePointsFor returns T-Spin values when tSpin is true', () => {
  assert.equal(basePointsFor({ lines: 0, tSpin: true }), 400);
  assert.equal(basePointsFor({ lines: 1, tSpin: true }), 800);
  assert.equal(basePointsFor({ lines: 2, tSpin: true }), 1200);
  assert.equal(basePointsFor({ lines: 3, tSpin: true }), 1600);
});

test('basePointsFor returns mini T-Spin values when mini is true', () => {
  assert.equal(basePointsFor({ lines: 0, tSpin: true, mini: true }), 100);
  assert.equal(basePointsFor({ lines: 1, tSpin: true, mini: true }), 200);
  assert.equal(basePointsFor({ lines: 2, tSpin: true, mini: true }), 400);
});

test('isDifficultClear identifies Tetrises and T-Spin clears', () => {
  assert.equal(isDifficultClear({ lines: 4 }), true);
  assert.equal(isDifficultClear({ lines: 1, tSpin: true }), true);
  assert.equal(isDifficultClear({ lines: 2, tSpin: true }), true);
  assert.equal(isDifficultClear({ lines: 0, tSpin: true }), false);
  assert.equal(isDifficultClear({ lines: 1 }), false);
  assert.equal(isDifficultClear({ lines: 3 }), false);
});

test('badgeFor produces human-readable labels', () => {
  assert.equal(badgeFor({ lines: 1 }), 'single');
  assert.equal(badgeFor({ lines: 4 }), 'tetris');
  assert.equal(badgeFor({ lines: 2, tSpin: true }), 't-spin-double');
  assert.equal(badgeFor({ lines: 1, tSpin: true, mini: true }), 't-spin-mini-single');
  assert.equal(badgeFor({ lines: 0, tSpin: true }), 't-spin');
  assert.equal(badgeFor({ lines: 0, tSpin: true, mini: true }), 't-spin-mini');
  assert.equal(badgeFor({ lines: 2, perfectClear: true }), 'double-perfect-clear');
  assert.equal(badgeFor({ lines: 0 }), null);
});

test('scoreLineClear single at level 1 yields 100 with no bonuses', () => {
  const result = scoreLineClear({ lines: 1 }, { level: 1 });
  assert.equal(result.base, 100);
  assert.equal(result.scaledBase, 100);
  assert.equal(result.perfectClearPoints, 0);
  assert.equal(result.total, 100);
  assert.equal(result.difficult, false);
  assert.equal(result.b2bMultiplier, 1);
  assert.equal(result.breaksBackToBack, true);
  assert.equal(result.badge, 'single');
});

test('scoreLineClear scales with level', () => {
  const r = scoreLineClear({ lines: 4 }, { level: 5 });
  assert.equal(r.total, 800 * 5);
});

test('scoreLineClear applies back-to-back multiplier on Tetris', () => {
  const r = scoreLineClear({ lines: 4 }, { level: 1, backToBackActive: true });
  assert.equal(r.b2bMultiplier, BACK_TO_BACK_MULTIPLIER);
  assert.equal(r.scaledBase, 800 * 1 * BACK_TO_BACK_MULTIPLIER);
  assert.equal(r.total, 800 * BACK_TO_BACK_MULTIPLIER);
  assert.equal(r.difficult, true);
  assert.equal(r.breaksBackToBack, false);
});

test('scoreLineClear applies B2B multiplier on T-spin with lines but not no-lines T-Spin', () => {
  const tsd = scoreLineClear({ lines: 2, tSpin: true }, { level: 1, backToBackActive: true });
  assert.equal(tsd.b2bMultiplier, BACK_TO_BACK_MULTIPLIER);
  assert.equal(tsd.total, 1200 * BACK_TO_BACK_MULTIPLIER);
  assert.equal(tsd.difficult, true);

  const tsZero = scoreLineClear({ lines: 0, tSpin: true }, { level: 1, backToBackActive: true });
  assert.equal(tsZero.b2bMultiplier, 1);
  assert.equal(tsZero.difficult, false);
  assert.equal(tsZero.breaksBackToBack, false);
});

test('scoreLineClear does NOT apply B2B multiplier on regular triple', () => {
  const r = scoreLineClear({ lines: 3 }, { level: 1, backToBackActive: true });
  assert.equal(r.b2bMultiplier, 1);
  assert.equal(r.breaksBackToBack, true);
  assert.equal(r.total, 500);
});

test('scoreLineClear marks regular line clears as breaking B2B', () => {
  for (const lines of [1, 2, 3]) {
    const r = scoreLineClear({ lines }, { level: 1 });
    assert.equal(r.breaksBackToBack, true, `lines=${lines}`);
  }
});

test('scoreLineClear no-lines does NOT break B2B', () => {
  const r = scoreLineClear({ lines: 0 }, { level: 1, backToBackActive: true });
  assert.equal(r.breaksBackToBack, false);
  assert.equal(r.total, 0);
});

test('scoreLineClear adds perfect-clear bonus', () => {
  const r = scoreLineClear({ lines: 1, perfectClear: true }, { level: 1 });
  assert.equal(r.perfectClearPoints, 800);
  assert.equal(r.total, 100 + 800);
});

test('scoreLineClear adds extra bonus for B2B Tetris perfect clear', () => {
  const r = scoreLineClear(
    { lines: 4, perfectClear: true },
    { level: 1, backToBackActive: true }
  );
  const expectedScaled = 800 * BACK_TO_BACK_MULTIPLIER;
  const expectedPc = 2000 + PERFECT_CLEAR_B2B_TETRIS_BONUS;
  assert.equal(r.scaledBase, expectedScaled);
  assert.equal(r.perfectClearPoints, expectedPc);
  assert.equal(r.total, expectedScaled + expectedPc);
});

test('scoreLineClear validates inputs', () => {
  assert.throws(() => scoreLineClear({ lines: 5 }, { level: 1 }), ValidationError);
  assert.throws(() => scoreLineClear({ lines: -1 }, { level: 1 }), ValidationError);
  assert.throws(() => scoreLineClear({ lines: 1.5 }, { level: 1 }), ValidationError);
  assert.throws(() => scoreLineClear({ lines: 1, mini: true }, { level: 1 }), ValidationError);
  assert.throws(() => scoreLineClear({ lines: 0, perfectClear: true }, { level: 1 }), ValidationError);
  assert.throws(() => scoreLineClear({ lines: 1 }, { level: 0 }), ValidationError);
  assert.throws(() => scoreLineClear(null, { level: 1 }), ValidationError);
});

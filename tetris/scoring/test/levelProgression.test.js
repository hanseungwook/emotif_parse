'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeLevel,
  linesUntilNextLevel,
  tetrisWorldsFallSpeedMs,
  fallSpeedMs,
  describeLevel,
} = require('../levelProgression');
const { ValidationError } = require('../errors');
const {
  MIN_FALL_SPEED_MS,
  MAX_FALL_SPEED_MS,
} = require('../constants');

test('computeLevel advances every linesPerLevel', () => {
  assert.equal(computeLevel({ totalLines: 0 }), 1);
  assert.equal(computeLevel({ totalLines: 9 }), 1);
  assert.equal(computeLevel({ totalLines: 10 }), 2);
  assert.equal(computeLevel({ totalLines: 25 }), 3);
  assert.equal(computeLevel({ totalLines: 100 }), 11);
});

test('computeLevel respects startLevel', () => {
  assert.equal(computeLevel({ totalLines: 0, startLevel: 5 }), 5);
  assert.equal(computeLevel({ totalLines: 10, startLevel: 5 }), 6);
});

test('computeLevel supports custom linesPerLevel', () => {
  assert.equal(computeLevel({ totalLines: 4, linesPerLevel: 5 }), 1);
  assert.equal(computeLevel({ totalLines: 5, linesPerLevel: 5 }), 2);
  assert.equal(computeLevel({ totalLines: 24, linesPerLevel: 5 }), 5);
});

test('computeLevel validates input', () => {
  assert.throws(() => computeLevel({ totalLines: -1 }), ValidationError);
  assert.throws(() => computeLevel({ totalLines: 1.5 }), ValidationError);
  assert.throws(() => computeLevel({ totalLines: 1, startLevel: 0 }), ValidationError);
  assert.throws(() => computeLevel({ totalLines: 1, linesPerLevel: 0 }), ValidationError);
});

test('linesUntilNextLevel counts down toward next breakpoint', () => {
  assert.equal(linesUntilNextLevel({ totalLines: 0 }), 10);
  assert.equal(linesUntilNextLevel({ totalLines: 3 }), 7);
  assert.equal(linesUntilNextLevel({ totalLines: 9 }), 1);
  assert.equal(linesUntilNextLevel({ totalLines: 10 }), 10);
});

test('tetrisWorldsFallSpeedMs decreases as level rises', () => {
  const l1 = tetrisWorldsFallSpeedMs(1);
  const l5 = tetrisWorldsFallSpeedMs(5);
  const l10 = tetrisWorldsFallSpeedMs(10);
  assert.equal(l1, 1000); // exactly 1s at level 1
  assert.ok(l5 < l1);
  assert.ok(l10 < l5);
});

test('tetrisWorldsFallSpeedMs clamps at the minimum frame speed', () => {
  const speed = tetrisWorldsFallSpeedMs(200);
  assert.ok(speed >= MIN_FALL_SPEED_MS - 1e-6);
  assert.ok(speed <= MAX_FALL_SPEED_MS);
});

test('fallSpeedMs caps level at maxLevel', () => {
  const capped = fallSpeedMs(50, { maxLevel: 10 });
  const at10 = fallSpeedMs(10, { maxLevel: 10 });
  assert.equal(capped, at10);
});

test('fallSpeedMs uses custom gravity curve when provided', () => {
  const curve = (level) => 500 - level * 10;
  assert.equal(fallSpeedMs(1, { gravityCurve: curve }), 490);
  assert.equal(fallSpeedMs(10, { gravityCurve: curve }), 400);
});

test('fallSpeedMs clamps custom curve outputs to valid range', () => {
  const curve = () => 5000; // huge
  assert.equal(fallSpeedMs(1, { gravityCurve: curve }), MAX_FALL_SPEED_MS);
  const tooFast = () => 1; // ~1ms, faster than 60fps
  assert.equal(fallSpeedMs(1, { gravityCurve: tooFast }), MIN_FALL_SPEED_MS);
});

test('fallSpeedMs validates custom curve return', () => {
  assert.throws(() => fallSpeedMs(1, { gravityCurve: () => 0 }), ValidationError);
  assert.throws(() => fallSpeedMs(1, { gravityCurve: () => -10 }), ValidationError);
  assert.throws(() => fallSpeedMs(1, { gravityCurve: () => Number.NaN }), ValidationError);
  assert.throws(() => fallSpeedMs(1, { gravityCurve: () => 'fast' }), ValidationError);
});

test('describeLevel returns derived fields', () => {
  const d = describeLevel(1);
  assert.equal(d.level, 1);
  assert.equal(d.fallSpeedMs, 1000);
  assert.equal(d.cellsPerSecond, 1);
});

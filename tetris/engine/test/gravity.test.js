'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TABLE, gravityMsForLevel, levelForLines } = require('../gravity');

test('gravity table is monotonically non-increasing', () => {
  for (let i = 1; i < TABLE.length; i++) {
    assert.ok(TABLE[i] <= TABLE[i - 1], `level ${i + 1} not faster than level ${i}`);
  }
});

test('gravityMsForLevel returns expected values', () => {
  assert.equal(gravityMsForLevel(1), 1000);
  assert.equal(gravityMsForLevel(2), 793);
  assert.equal(gravityMsForLevel(10), 64);
});

test('gravityMsForLevel clamps to table for sub-1 and very-high levels', () => {
  assert.equal(gravityMsForLevel(0), 1000);
  assert.equal(gravityMsForLevel(-5), 1000);
  assert.equal(gravityMsForLevel(NaN), 1000);
  assert.equal(gravityMsForLevel(99), TABLE[TABLE.length - 1]);
});

test('levelForLines advances every 10 lines by default', () => {
  assert.equal(levelForLines(0, 1), 1);
  assert.equal(levelForLines(9, 1), 1);
  assert.equal(levelForLines(10, 1), 2);
  assert.equal(levelForLines(25, 1), 3);
  assert.equal(levelForLines(100, 1), 11);
});

test('levelForLines honors a starting level and custom lines-per-level', () => {
  assert.equal(levelForLines(0, 5), 5);
  assert.equal(levelForLines(15, 5), 6);
  assert.equal(levelForLines(20, 5, 5), 9);
});

test('levelForLines never returns less than the starting level', () => {
  assert.equal(levelForLines(-100, 3), 3);
});

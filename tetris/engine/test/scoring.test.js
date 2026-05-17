'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreLineClear, scoreSoftDrop, scoreHardDrop } = require('../scoring');

test('line clear scoring follows guideline values scaled by level', () => {
  assert.equal(scoreLineClear(1, 1), 100);
  assert.equal(scoreLineClear(2, 1), 300);
  assert.equal(scoreLineClear(3, 1), 500);
  assert.equal(scoreLineClear(4, 1), 800);
  assert.equal(scoreLineClear(4, 5), 4000);
});

test('zero / invalid clears award no points', () => {
  assert.equal(scoreLineClear(0, 1), 0);
  assert.equal(scoreLineClear(-1, 1), 0);
  assert.equal(scoreLineClear(5, 1), 0);
});

test('soft drop scores 1 per row, hard drop 2 per row', () => {
  assert.equal(scoreSoftDrop(0), 0);
  assert.equal(scoreSoftDrop(5), 5);
  assert.equal(scoreSoftDrop(-3), 0);

  assert.equal(scoreHardDrop(0), 0);
  assert.equal(scoreHardDrop(5), 10);
  assert.equal(scoreHardDrop(-3), 0);
});

test('line clear level multiplier clamps to >= 1', () => {
  assert.equal(scoreLineClear(1, 0), 100);
  assert.equal(scoreLineClear(1, -3), 100);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DIRECTION,
  DIRECTIONS,
  isDirection,
  assertDirection,
  vectorFor,
  opposite,
  isOpposite,
} = require('../direction');
const { ValidationError } = require('../errors');

test('DIRECTIONS contains exactly the four cardinal directions', () => {
  assert.deepEqual([...DIRECTIONS].sort(), ['down', 'left', 'right', 'up']);
});

test('isDirection rejects garbage', () => {
  assert.equal(isDirection('up'), true);
  assert.equal(isDirection('diagonal'), false);
  assert.equal(isDirection(null), false);
  assert.equal(isDirection(42), false);
});

test('assertDirection throws ValidationError on bad input', () => {
  assert.throws(() => assertDirection('nope'), ValidationError);
  assert.equal(assertDirection(DIRECTION.LEFT), 'left');
});

test('vectorFor returns unit vectors', () => {
  assert.deepEqual(vectorFor(DIRECTION.UP), { x: 0, y: -1 });
  assert.deepEqual(vectorFor(DIRECTION.DOWN), { x: 0, y: 1 });
  assert.deepEqual(vectorFor(DIRECTION.LEFT), { x: -1, y: 0 });
  assert.deepEqual(vectorFor(DIRECTION.RIGHT), { x: 1, y: 0 });
});

test('opposite is symmetric', () => {
  for (const d of DIRECTIONS) {
    assert.equal(opposite(opposite(d)), d);
  }
});

test('isOpposite handles every cardinal pair', () => {
  assert.equal(isOpposite('up', 'down'), true);
  assert.equal(isOpposite('left', 'right'), true);
  assert.equal(isOpposite('up', 'left'), false);
  assert.equal(isOpposite('up', 'up'), false);
  assert.equal(isOpposite('up', 'bad'), false);
});

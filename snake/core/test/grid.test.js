'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DIRECTIONS,
  isDirection,
  isOpposite,
  step,
  inBounds,
  cellKey,
  samePoint,
} = require('../grid');

test('DIRECTIONS exposes the four cardinal vectors', () => {
  assert.deepEqual(DIRECTIONS.up, { x: 0, y: -1 });
  assert.deepEqual(DIRECTIONS.down, { x: 0, y: 1 });
  assert.deepEqual(DIRECTIONS.left, { x: -1, y: 0 });
  assert.deepEqual(DIRECTIONS.right, { x: 1, y: 0 });
});

test('isDirection identifies valid direction names', () => {
  assert.ok(isDirection('up'));
  assert.ok(!isDirection('diagonal'));
});

test('isOpposite detects 180° pairs', () => {
  assert.ok(isOpposite('up', 'down'));
  assert.ok(isOpposite('left', 'right'));
  assert.ok(!isOpposite('up', 'left'));
});

test('step adds the direction vector to a point', () => {
  assert.deepEqual(step({ x: 1, y: 1 }, 'right'), { x: 2, y: 1 });
  assert.deepEqual(step({ x: 1, y: 1 }, 'up'), { x: 1, y: 0 });
});

test('inBounds respects width/height', () => {
  assert.ok(inBounds({ x: 0, y: 0 }, 10, 10));
  assert.ok(inBounds({ x: 9, y: 9 }, 10, 10));
  assert.ok(!inBounds({ x: 10, y: 0 }, 10, 10));
  assert.ok(!inBounds({ x: -1, y: 0 }, 10, 10));
});

test('cellKey is stable for equal points and unique per cell', () => {
  assert.equal(cellKey(2, 3), '2,3');
  assert.notEqual(cellKey(2, 3), cellKey(3, 2));
});

test('samePoint compares coordinates', () => {
  assert.ok(samePoint({ x: 1, y: 2 }, { x: 1, y: 2 }));
  assert.ok(!samePoint({ x: 1, y: 2 }, { x: 2, y: 1 }));
});

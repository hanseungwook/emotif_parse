'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createBoard,
  cellsEqual,
  inBounds,
  step,
  cellKey,
  cellsToSet,
  totalCells,
  assertInBounds,
} = require('../board');
const { ValidationError } = require('../errors');

test('createBoard defaults are sensible', () => {
  const board = createBoard();
  assert.equal(board.width, 24);
  assert.equal(board.height, 24);
  assert.equal(board.wrapEdges, false);
});

test('createBoard rejects out-of-range dimensions', () => {
  assert.throws(() => createBoard({ width: 1, height: 10 }), ValidationError);
  assert.throws(() => createBoard({ width: 1000, height: 10 }), ValidationError);
  assert.throws(() => createBoard({ width: 10, height: 1.5 }), ValidationError);
});

test('createBoard freezes the board', () => {
  const board = createBoard({ width: 10, height: 10 });
  assert.throws(() => {
    board.width = 5;
  });
});

test('cellsEqual is value-based', () => {
  assert.equal(cellsEqual({ x: 1, y: 2 }, { x: 1, y: 2 }), true);
  assert.equal(cellsEqual({ x: 1, y: 2 }, { x: 2, y: 1 }), false);
  assert.equal(cellsEqual(null, null), false);
});

test('inBounds checks integer coordinates within the grid', () => {
  const board = createBoard({ width: 10, height: 10 });
  assert.equal(inBounds(board, { x: 0, y: 0 }), true);
  assert.equal(inBounds(board, { x: 9, y: 9 }), true);
  assert.equal(inBounds(board, { x: 10, y: 9 }), false);
  assert.equal(inBounds(board, { x: -1, y: 0 }), false);
  assert.equal(inBounds(board, { x: 1.5, y: 2 }), false);
});

test('step without wrap leaves coords out of bounds', () => {
  const board = createBoard({ width: 10, height: 10 });
  const next = step(board, { x: 9, y: 5 }, 'right');
  assert.deepEqual(next, { x: 10, y: 5 });
  assert.equal(inBounds(board, next), false);
});

test('step with wrap wraps coords', () => {
  const board = createBoard({ width: 10, height: 10, wrapEdges: true });
  assert.deepEqual(step(board, { x: 9, y: 5 }, 'right'), { x: 0, y: 5 });
  assert.deepEqual(step(board, { x: 0, y: 0 }, 'up'), { x: 0, y: 9 });
  assert.deepEqual(step(board, { x: 0, y: 0 }, 'left'), { x: 9, y: 0 });
});

test('cellKey + cellsToSet produce membership lookups', () => {
  const set = cellsToSet([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(set.has(cellKey({ x: 1, y: 2 })), true);
  assert.equal(set.has(cellKey({ x: 3, y: 4 })), true);
  assert.equal(set.has(cellKey({ x: 9, y: 9 })), false);
});

test('totalCells reports area', () => {
  assert.equal(totalCells(createBoard({ width: 10, height: 8 })), 80);
});

test('assertInBounds throws when out of bounds', () => {
  const board = createBoard({ width: 10, height: 10 });
  assert.throws(() => assertInBounds(board, { x: 50, y: 0 }), ValidationError);
});

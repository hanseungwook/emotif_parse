'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSnake,
  head,
  tail,
  length,
  bodySet,
  occupies,
  queueDirection,
  advance,
  applyGrowth,
  consumeGrowth,
  kill,
  snapshot,
} = require('../snake');
const { ValidationError } = require('../errors');
const { cellKey } = require('../board');

function fixture() {
  return createSnake({
    body: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: 'right',
  });
}

test('createSnake requires a body and direction', () => {
  assert.throws(() => createSnake({ body: [], direction: 'right' }), ValidationError);
  assert.throws(() => createSnake({ body: [{ x: 0, y: 0 }], direction: 'sideways' }), ValidationError);
});

test('createSnake sets defaults', () => {
  const snake = fixture();
  assert.equal(snake.alive, true);
  assert.equal(snake.growth, 0);
  assert.equal(snake.pendingDirection, 'right');
  assert.equal(snake.skinId, 'classic-green');
});

test('head and tail return the right endpoints', () => {
  const snake = fixture();
  assert.deepEqual(head(snake), { x: 5, y: 5 });
  assert.deepEqual(tail(snake), { x: 3, y: 5 });
  assert.equal(length(snake), 3);
});

test('bodySet produces unique cell keys', () => {
  const snake = fixture();
  const set = bodySet(snake);
  assert.equal(set.size, 3);
  assert.equal(set.has(cellKey({ x: 5, y: 5 })), true);
});

test('occupies checks cell membership', () => {
  const snake = fixture();
  assert.equal(occupies(snake, { x: 4, y: 5 }), true);
  assert.equal(occupies(snake, { x: 9, y: 9 }), false);
});

test('queueDirection rejects 180 reversals', () => {
  const snake = fixture();
  const next = queueDirection(snake, 'left');
  assert.equal(next.pendingDirection, 'right'); // unchanged
});

test('queueDirection accepts perpendicular turns', () => {
  const snake = fixture();
  const next = queueDirection(snake, 'up');
  assert.equal(next.pendingDirection, 'up');
});

test('queueDirection allows reversal when explicitly allowed', () => {
  const snake = fixture();
  const next = queueDirection(snake, 'left', { allowReversal: true });
  assert.equal(next.pendingDirection, 'left');
});

test('advance moves head and pops tail by default', () => {
  const snake = fixture();
  const next = advance(snake, { x: 6, y: 5 });
  assert.deepEqual(head(next), { x: 6, y: 5 });
  assert.equal(length(next), 3);
  assert.deepEqual(tail(next), { x: 4, y: 5 });
});

test('advance with grow keeps the tail', () => {
  const snake = fixture();
  const next = advance(snake, { x: 6, y: 5 }, { grow: true });
  assert.equal(length(next), 4);
  assert.deepEqual(tail(next), { x: 3, y: 5 });
});

test('advance promotes pendingDirection to direction', () => {
  const snake = queueDirection(fixture(), 'up');
  const next = advance(snake, { x: 5, y: 4 });
  assert.equal(next.direction, 'up');
});

test('applyGrowth and consumeGrowth balance', () => {
  const snake = fixture();
  const grown = applyGrowth(snake, 2);
  assert.equal(grown.growth, 2);
  const after = consumeGrowth(grown);
  assert.equal(after.consumed, true);
  assert.equal(after.snake.growth, 1);
});

test('kill marks alive=false but is idempotent', () => {
  const snake = fixture();
  const killed = kill(snake);
  assert.equal(killed.alive, false);
  assert.strictEqual(kill(killed), killed);
});

test('snapshot is a plain serializable copy', () => {
  const snake = fixture();
  const snap = snapshot(snake);
  assert.deepEqual(snap.body, [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
  ]);
  assert.equal(JSON.stringify(snap).length > 0, true);
});

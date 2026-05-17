'use strict';

const { ValidationError } = require('./errors');
const { assertCell, cellKey } = require('./board');
const { assertDirection, isOpposite } = require('./direction');

const DEFAULT_LENGTH = 3;

// A snake's body is an array of cells where index 0 is the head and the last
// element is the tail. Body cells are stored newest-first so head ops are O(1).
function createSnake(input) {
  const opts = input || {};
  if (!Array.isArray(opts.body) || opts.body.length === 0) {
    throw new ValidationError('snake.body must be a non-empty array of cells');
  }
  const body = opts.body.map((cell) => {
    assertCell(cell);
    return { x: cell.x, y: cell.y };
  });
  const direction = assertDirection(opts.direction);
  return {
    id: opts.id || 'snake',
    body,
    direction,
    pendingDirection: opts.pendingDirection
      ? assertDirection(opts.pendingDirection)
      : direction,
    skinId: opts.skinId || 'classic-green',
    growth: Number.isInteger(opts.growth) && opts.growth >= 0 ? opts.growth : 0,
    alive: opts.alive !== false,
  };
}

function head(snake) {
  return snake.body[0];
}

function tail(snake) {
  return snake.body[snake.body.length - 1];
}

function length(snake) {
  return snake.body.length;
}

function bodySet(snake) {
  const set = new Set();
  for (const c of snake.body) set.add(cellKey(c));
  return set;
}

function occupies(snake, cell) {
  if (!cell) return false;
  return snake.body.some((c) => c.x === cell.x && c.y === cell.y);
}

// Queue a turn that will be applied on the next move. Reject reversals so the
// snake can't run into its own neck — caller can pass `allowReversal` to bypass
// when needed (e.g. reseting on respawn).
function queueDirection(snake, direction, opts) {
  assertDirection(direction);
  const allowReversal = !!(opts && opts.allowReversal);
  if (!allowReversal && isOpposite(snake.direction, direction)) {
    return snake;
  }
  return { ...snake, pendingDirection: direction };
}

// Advance the snake to `nextHead`. If `grow` is true the tail stays put;
// otherwise it's popped. This is pure data mutation: callers handle collision
// detection, wrapping, etc.
function advance(snake, nextHead, opts) {
  assertCell(nextHead);
  const grow = !!(opts && opts.grow);
  const newBody = [{ x: nextHead.x, y: nextHead.y }, ...snake.body];
  if (!grow) newBody.pop();
  return {
    ...snake,
    body: newBody,
    direction: snake.pendingDirection || snake.direction,
  };
}

function applyGrowth(snake, amount) {
  if (!Number.isInteger(amount) || amount <= 0) return snake;
  return { ...snake, growth: snake.growth + amount };
}

function consumeGrowth(snake) {
  if (snake.growth <= 0) return { snake, consumed: false };
  return { snake: { ...snake, growth: snake.growth - 1 }, consumed: true };
}

function kill(snake) {
  if (!snake.alive) return snake;
  return { ...snake, alive: false };
}

function snapshot(snake) {
  return {
    id: snake.id,
    body: snake.body.map((c) => ({ x: c.x, y: c.y })),
    direction: snake.direction,
    pendingDirection: snake.pendingDirection,
    skinId: snake.skinId,
    growth: snake.growth,
    alive: snake.alive,
  };
}

module.exports = {
  DEFAULT_LENGTH,
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
};

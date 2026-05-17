'use strict';

const { DIRECTIONS, cellKey, inBounds, step } = require('./grid');

// Create a snake of `length` segments centered horizontally, moving right.
// segments[0] is always the head; the tail is the last entry.
function createSnake({ width, height, length = 3, direction = 'right' }) {
  if (length < 1) {
    throw new TypeError('snake length must be >= 1');
  }
  if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, direction)) {
    throw new TypeError(`unknown direction: ${direction}`);
  }
  const headX = Math.floor(width / 2);
  const headY = Math.floor(height / 2);
  const segments = [];
  for (let i = 0; i < length; i += 1) {
    segments.push({ x: headX - i, y: headY });
  }
  return { segments, direction, pendingGrowth: 0 };
}

// Compute the snake's next head cell given the current direction.
function nextHead(snake) {
  return step(snake.segments[0], snake.direction);
}

// Move the snake one cell. If grow is true, the tail is preserved so the
// snake gains a segment; otherwise the tail is dropped. Returns a new snake
// object — the original is not mutated.
function advance(snake, { grow = false } = {}) {
  const head = nextHead(snake);
  const nextSegments = [head, ...snake.segments];
  let pendingGrowth = snake.pendingGrowth;
  if (grow) {
    pendingGrowth += 1;
  }
  if (pendingGrowth > 0) {
    pendingGrowth -= 1;
  } else {
    nextSegments.pop();
  }
  return { segments: nextSegments, direction: snake.direction, pendingGrowth };
}

// Returns true if `point` overlaps any body segment (including the head).
function occupies(snake, point) {
  for (const segment of snake.segments) {
    if (segment.x === point.x && segment.y === point.y) return true;
  }
  return false;
}

// Set of "key" strings for fast occupancy tests in spawn placement.
function bodyKeys(snake) {
  const keys = new Set();
  for (const segment of snake.segments) {
    keys.add(cellKey(segment.x, segment.y));
  }
  return keys;
}

function hitsSelf(snake) {
  const head = snake.segments[0];
  for (let i = 1; i < snake.segments.length; i += 1) {
    const seg = snake.segments[i];
    if (seg.x === head.x && seg.y === head.y) return true;
  }
  return false;
}

function hitsWall(snake, width, height) {
  return !inBounds(snake.segments[0], width, height);
}

module.exports = {
  createSnake,
  nextHead,
  advance,
  occupies,
  bodyKeys,
  hitsSelf,
  hitsWall,
};

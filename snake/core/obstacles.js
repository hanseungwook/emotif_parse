'use strict';

const { cellKey } = require('./grid');

// Obstacle Mode: deterministic patterns the engine layers on top of the grid
// when mode === 'obstacle'. Patterns return an array of {x,y} cells the snake
// must avoid; passing in `rng` makes layouts reproducible for tests.

function pillars({ width, height }) {
  // Four interior pillars near the corners — safe for any board >= 8x8.
  if (width < 8 || height < 8) return [];
  const pad = 2;
  return [
    { x: pad, y: pad },
    { x: width - pad - 1, y: pad },
    { x: pad, y: height - pad - 1 },
    { x: width - pad - 1, y: height - pad - 1 },
  ];
}

function crossbars({ width, height }) {
  // A short horizontal bar and a short vertical bar that don't intersect the
  // starting snake row. Skipped on tiny boards.
  if (width < 8 || height < 8) return [];
  const cells = [];
  const midY = Math.floor(height / 2);
  const barY = Math.max(1, midY - 3);
  for (let i = 2; i <= width - 3; i += 3) {
    cells.push({ x: i, y: barY });
  }
  const barX = Math.max(1, Math.floor(width / 2) - 3);
  for (let j = midY + 2; j <= height - 3; j += 3) {
    cells.push({ x: barX, y: j });
  }
  return cells;
}

function scattered({ width, height, rng, count }) {
  // Random scatter, avoiding the start row so the snake has space to move.
  const startY = Math.floor(height / 2);
  const goal = count != null ? count : Math.max(4, Math.floor((width * height) / 40));
  const seen = new Set();
  const cells = [];
  let attempts = 0;
  const maxAttempts = goal * 20;
  while (cells.length < goal && attempts < maxAttempts) {
    attempts += 1;
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    if (y === startY) continue;
    const key = cellKey(x, y);
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ x, y });
  }
  return cells;
}

const PATTERNS = Object.freeze({
  pillars,
  crossbars,
  scattered,
});

const DEFAULT_PATTERN = 'pillars';

function generateObstacles({ pattern = DEFAULT_PATTERN, width, height, rng, count }) {
  const fn = PATTERNS[pattern];
  if (!fn) return [];
  return fn({ width, height, rng, count });
}

function obstacleKeys(obstacles) {
  const keys = new Set();
  for (const cell of obstacles) {
    keys.add(cellKey(cell.x, cell.y));
  }
  return keys;
}

function hits(obstacles, point) {
  for (const cell of obstacles) {
    if (cell.x === point.x && cell.y === point.y) return true;
  }
  return false;
}

module.exports = {
  PATTERNS,
  DEFAULT_PATTERN,
  generateObstacles,
  obstacleKeys,
  hits,
};

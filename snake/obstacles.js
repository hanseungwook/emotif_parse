'use strict';

const { ValidationError } = require('./errors');
const { assertCell, cellKey } = require('./board');

// Obstacle entity for Obstacle Mode. A layout is a collection of immovable
// cells the snake must avoid. Layouts are data-driven so the catalog can ship
// fresh maps without code changes.

const OBSTACLE_KIND = Object.freeze({
  WALL: 'wall', // static, kills on contact
  BLOCK: 'block', // single static cell
  GATE: 'gate', // currently open/closed (future use, default open)
  HAZARD: 'hazard', // damages but does not always kill (future use)
});

const LAYOUT_DIFFICULTY = Object.freeze({
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  INSANE: 'insane',
});

function createObstacle(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('obstacle requires an object');
  }
  const id = typeof input.id === 'string' && input.id ? input.id : null;
  if (!id) throw new ValidationError('obstacle.id is required');
  const kind = input.kind || OBSTACLE_KIND.WALL;
  if (!Object.values(OBSTACLE_KIND).includes(kind)) {
    throw new ValidationError(`obstacle.kind unknown: ${kind}`);
  }
  if (!Array.isArray(input.cells) || input.cells.length === 0) {
    throw new ValidationError('obstacle.cells must be a non-empty array');
  }
  const seen = new Set();
  const cells = [];
  for (const c of input.cells) {
    assertCell(c);
    const key = cellKey(c);
    if (seen.has(key)) continue; // dedupe — layouts may overlap; deterministic
    seen.add(key);
    cells.push({ x: c.x, y: c.y });
  }
  return Object.freeze({
    id,
    kind,
    cells: Object.freeze(cells),
    destructible: !!input.destructible,
    label: input.label || null,
  });
}

function createObstacleLayout(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('layout requires an object');
  }
  if (typeof input.id !== 'string' || !input.id) {
    throw new ValidationError('layout.id is required');
  }
  if (typeof input.name !== 'string' || !input.name) {
    throw new ValidationError('layout.name is required');
  }
  const difficulty = input.difficulty || LAYOUT_DIFFICULTY.EASY;
  if (!Object.values(LAYOUT_DIFFICULTY).includes(difficulty)) {
    throw new ValidationError(`layout.difficulty unknown: ${difficulty}`);
  }
  const obstacles = (input.obstacles || []).map(createObstacle);
  // Validate that obstacles fit any provided board hint
  if (input.boardHint) {
    const { width, height } = input.boardHint;
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new ValidationError('layout.boardHint requires integer width and height');
    }
    for (const o of obstacles) {
      for (const c of o.cells) {
        if (c.x < 0 || c.y < 0 || c.x >= width || c.y >= height) {
          throw new ValidationError(
            `obstacle ${o.id} cell (${c.x},${c.y}) outside boardHint ${width}x${height}`
          );
        }
      }
    }
  }
  return Object.freeze({
    id: input.id,
    name: input.name,
    description: input.description || '',
    difficulty,
    boardHint: input.boardHint
      ? Object.freeze({ width: input.boardHint.width, height: input.boardHint.height })
      : null,
    obstacles: Object.freeze(obstacles),
    spawnSafeZone: input.spawnSafeZone
      ? Object.freeze(input.spawnSafeZone.map((c) => ({ x: c.x, y: c.y })))
      : null,
    tags: Object.freeze(Array.isArray(input.tags) ? [...input.tags] : []),
  });
}

// Flatten the layout into a set of blocked cell keys for fast lookup during
// movement / spawning.
function layoutBlockedCells(layout) {
  const set = new Set();
  for (const o of layout.obstacles) {
    for (const c of o.cells) {
      set.add(cellKey(c));
    }
  }
  return set;
}

// Render the layout as a 2D occupancy grid (rows of booleans). Useful when
// callers need a board-wide picture (e.g. for renderers or food spawning).
function layoutToGrid(layout, board) {
  const blocked = layoutBlockedCells(layout);
  const grid = [];
  for (let y = 0; y < board.height; y++) {
    const row = new Array(board.width);
    for (let x = 0; x < board.width; x++) {
      row[x] = blocked.has(`${x},${y}`);
    }
    grid.push(row);
  }
  return grid;
}

module.exports = {
  OBSTACLE_KIND,
  LAYOUT_DIFFICULTY,
  createObstacle,
  createObstacleLayout,
  layoutBlockedCells,
  layoutToGrid,
};

'use strict';

const { ObstacleGenerationError } = require('./errors');

// Obstacle Mode layouts. Layouts are deterministic given a seed and difficulty
// so other modules (Core Workflow / Data Model) can persist just the params.
const DIFFICULTIES = Object.freeze({
  off: { density: 0, name: 'Off' },
  light: { density: 0.04, name: 'Light' },
  medium: { density: 0.08, name: 'Medium' },
  heavy: { density: 0.14, name: 'Heavy' },
});

const DEFAULT_GRID = Object.freeze({ width: 24, height: 24 });

// Tiny deterministic LCG: avoids relying on Math.random for reproducibility.
function makeRng(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function coerceSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.floor(seed);
  if (typeof seed === 'string' && seed.length > 0) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  return 0x12345678;
}

function pointKey(x, y) {
  return x + ',' + y;
}

function isProtected(x, y, spawn, food) {
  for (const p of spawn) {
    if (p.x === x && p.y === y) return true;
  }
  if (food) {
    for (const f of food) {
      if (f.x === x && f.y === y) return true;
    }
  }
  return false;
}

function generateLayout(params) {
  const p = params || {};
  const difficulty = typeof p.difficulty === 'string' ? p.difficulty : 'medium';
  const cfg = DIFFICULTIES[difficulty];
  if (!cfg) {
    throw new ObstacleGenerationError('unknown difficulty: ' + difficulty, {
      recoverable: false,
    });
  }
  const width = typeof p.width === 'number' && p.width > 4 ? Math.floor(p.width) : DEFAULT_GRID.width;
  const height =
    typeof p.height === 'number' && p.height > 4 ? Math.floor(p.height) : DEFAULT_GRID.height;
  const seed = coerceSeed(p.seed);
  const spawn = Array.isArray(p.protectedSpawn) ? p.protectedSpawn : defaultSpawn(width, height);
  const food = Array.isArray(p.protectedFood) ? p.protectedFood : [];

  const total = width * height;
  let target = Math.floor(total * cfg.density);
  if (cfg.density > 0 && target === 0) target = 1;
  if (target >= total - spawn.length - food.length) {
    throw new ObstacleGenerationError('density too high for grid', {
      recoverable: false,
      details: { width, height, density: cfg.density },
    });
  }

  const rng = makeRng(seed);
  const cells = new Map();
  let attempts = 0;
  const maxAttempts = target * 25 + 50;
  while (cells.size < target && attempts < maxAttempts) {
    attempts += 1;
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    if (isProtected(x, y, spawn, food)) continue;
    const key = pointKey(x, y);
    if (cells.has(key)) continue;
    cells.set(key, { x, y });
  }
  if (cells.size < target) {
    throw new ObstacleGenerationError('unable to place obstacles', {
      details: { requested: target, placed: cells.size },
    });
  }
  return Object.freeze({
    difficulty,
    difficultyName: cfg.name,
    width,
    height,
    seed,
    count: cells.size,
    cells: Object.freeze(Array.from(cells.values()).map((c) => Object.freeze(c))),
  });
}

function defaultSpawn(width, height) {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
}

class ObstacleLayoutLoader {
  constructor(options) {
    const opts = options || {};
    this._defaultDifficulty = opts.defaultDifficulty || 'medium';
    this._current = null;
  }

  get defaultDifficulty() {
    return this._defaultDifficulty;
  }

  get current() {
    return this._current;
  }

  // Loads (synchronously generates) the layout. Returns a Promise so the
  // caller can chain it into the loading sequence and capture errors
  // uniformly with async loaders.
  load(params) {
    return Promise.resolve()
      .then(() => {
        const merged = Object.assign({ difficulty: this._defaultDifficulty }, params || {});
        if (merged.difficulty === 'off') {
          const empty = Object.freeze({
            difficulty: 'off',
            difficultyName: DIFFICULTIES.off.name,
            width: merged.width || DEFAULT_GRID.width,
            height: merged.height || DEFAULT_GRID.height,
            seed: coerceSeed(merged.seed),
            count: 0,
            cells: Object.freeze([]),
          });
          this._current = empty;
          return empty;
        }
        const layout = generateLayout(merged);
        this._current = layout;
        return layout;
      })
      .catch((err) => {
        if (err instanceof ObstacleGenerationError) throw err;
        throw new ObstacleGenerationError(
          err && err.message ? err.message : 'obstacle generation failed',
          { cause: err }
        );
      });
  }

  clear() {
    this._current = null;
  }
}

module.exports = {
  ObstacleLayoutLoader,
  DIFFICULTIES,
  DEFAULT_GRID,
  generateLayout,
  coerceSeed,
};

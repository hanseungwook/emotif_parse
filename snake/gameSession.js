'use strict';

const { ValidationError } = require('./errors');
const { createBoard, assertCell, cellKey } = require('./board');
const { createSnake, snapshot: snapshotSnake } = require('./snake');
const { getMode, isObstacleMode } = require('./modes');

// GameSession is the per-run aggregate: board, snake(s), food, obstacles, and
// score. It is intentionally inert — the renderer/runtime ticks the world by
// calling discrete state operations, but the data shape here is the canonical
// source of truth that gets serialized for save/resume.

const SESSION_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
});

const FOOD_KIND = Object.freeze({
  STANDARD: 'standard',
  BONUS: 'bonus',
  GROW2: 'grow2',
});

const FOOD_POINTS = Object.freeze({
  [FOOD_KIND.STANDARD]: 10,
  [FOOD_KIND.BONUS]: 30,
  [FOOD_KIND.GROW2]: 15,
});

function createFood(input) {
  if (!input) throw new ValidationError('food requires an object');
  assertCell(input.cell);
  const kind = input.kind || FOOD_KIND.STANDARD;
  if (!Object.values(FOOD_KIND).includes(kind)) {
    throw new ValidationError(`food.kind unknown: ${kind}`);
  }
  return Object.freeze({
    cell: Object.freeze({ x: input.cell.x, y: input.cell.y }),
    kind,
    points: Number.isInteger(input.points) ? input.points : FOOD_POINTS[kind],
    spawnedAt: input.spawnedAt || 0,
  });
}

function createGameSession(input) {
  const opts = input || {};
  if (typeof opts.id !== 'string' || !opts.id) {
    throw new ValidationError('session.id is required');
  }
  const mode = getMode(opts.mode);
  if (isObstacleMode(mode.id) && !opts.obstacleLayoutId) {
    throw new ValidationError('obstacle mode requires obstacleLayoutId');
  }
  const board = createBoard({
    width: opts.board && opts.board.width,
    height: opts.board && opts.board.height,
    wrapEdges:
      opts.board && opts.board.wrapEdges !== undefined
        ? opts.board.wrapEdges
        : !!mode.wrapEdges,
  });
  const snake = createSnake(opts.snake);
  const foods = (opts.foods || []).map(createFood);
  const score = Number.isInteger(opts.score) && opts.score >= 0 ? opts.score : 0;
  const ticks = Number.isInteger(opts.ticks) && opts.ticks >= 0 ? opts.ticks : 0;
  const status = opts.status || SESSION_STATUS.IDLE;
  if (!Object.values(SESSION_STATUS).includes(status)) {
    throw new ValidationError(`session.status unknown: ${status}`);
  }
  const startedAt = opts.startedAt || null;
  const endedAt = opts.endedAt || null;
  return {
    id: opts.id,
    mode: mode.id,
    board,
    snake,
    foods,
    score,
    ticks,
    status,
    obstacleLayoutId: opts.obstacleLayoutId || null,
    skinId: opts.skinId || snake.skinId || null,
    timeLimitSec: opts.timeLimitSec || mode.timeLimitSec || null,
    elapsedMs: Number.isInteger(opts.elapsedMs) ? opts.elapsedMs : 0,
    seed: opts.seed || null,
    startedAt,
    endedAt,
    foodEaten: Number.isInteger(opts.foodEaten) ? opts.foodEaten : 0,
    obstaclesHit: Number.isInteger(opts.obstaclesHit) ? opts.obstaclesHit : 0,
  };
}

// ---- Pure state transitions ----------------------------------------------

function start(session, clock) {
  const now = typeof clock === 'function' ? clock() : Date.now();
  return {
    ...session,
    status: SESSION_STATUS.RUNNING,
    startedAt: session.startedAt || now,
  };
}

function pause(session) {
  if (session.status !== SESSION_STATUS.RUNNING) return session;
  return { ...session, status: SESSION_STATUS.PAUSED };
}

function resume(session) {
  if (session.status !== SESSION_STATUS.PAUSED) return session;
  return { ...session, status: SESSION_STATUS.RUNNING };
}

function gameOver(session, clock) {
  if (session.status === SESSION_STATUS.GAME_OVER) return session;
  const now = typeof clock === 'function' ? clock() : Date.now();
  return {
    ...session,
    status: SESSION_STATUS.GAME_OVER,
    endedAt: now,
    snake: { ...session.snake, alive: false },
  };
}

function setSnake(session, snake) {
  return { ...session, snake };
}

function setFoods(session, foods) {
  return { ...session, foods };
}

function addScore(session, delta) {
  if (!Number.isInteger(delta) || delta === 0) return session;
  return { ...session, score: Math.max(0, session.score + delta) };
}

function tick(session) {
  return { ...session, ticks: session.ticks + 1 };
}

function recordFoodEaten(session, food) {
  const points = food && Number.isInteger(food.points) ? food.points : 0;
  return {
    ...session,
    score: session.score + points,
    foodEaten: session.foodEaten + 1,
  };
}

function recordObstacleHit(session) {
  return { ...session, obstaclesHit: session.obstaclesHit + 1 };
}

// Snapshot a session into a plain serializable object. Used by persistence.
function snapshot(session) {
  return {
    id: session.id,
    mode: session.mode,
    board: { width: session.board.width, height: session.board.height, wrapEdges: session.board.wrapEdges },
    snake: snapshotSnake(session.snake),
    foods: session.foods.map((f) => ({
      cell: { x: f.cell.x, y: f.cell.y },
      kind: f.kind,
      points: f.points,
      spawnedAt: f.spawnedAt,
    })),
    score: session.score,
    ticks: session.ticks,
    status: session.status,
    obstacleLayoutId: session.obstacleLayoutId,
    skinId: session.skinId,
    timeLimitSec: session.timeLimitSec,
    elapsedMs: session.elapsedMs,
    seed: session.seed,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    foodEaten: session.foodEaten,
    obstaclesHit: session.obstaclesHit,
  };
}

// Restore from a snapshot. We re-run validators so a tampered save fails fast.
function restore(plain) {
  return createGameSession({
    id: plain.id,
    mode: plain.mode,
    board: plain.board,
    snake: plain.snake,
    foods: plain.foods,
    score: plain.score,
    ticks: plain.ticks,
    status: plain.status,
    obstacleLayoutId: plain.obstacleLayoutId,
    skinId: plain.skinId,
    timeLimitSec: plain.timeLimitSec,
    elapsedMs: plain.elapsedMs,
    seed: plain.seed,
    startedAt: plain.startedAt,
    endedAt: plain.endedAt,
    foodEaten: plain.foodEaten,
    obstaclesHit: plain.obstaclesHit,
  });
}

// Convenience: build a cell-key set covering snake body + foods for a session.
// Used by collision and spawning helpers.
function occupiedKeys(session) {
  const set = new Set();
  for (const c of session.snake.body) set.add(cellKey(c));
  for (const f of session.foods) set.add(cellKey(f.cell));
  return set;
}

module.exports = {
  SESSION_STATUS,
  FOOD_KIND,
  FOOD_POINTS,
  createFood,
  createGameSession,
  start,
  pause,
  resume,
  gameOver,
  setSnake,
  setFoods,
  addScore,
  tick,
  recordFoodEaten,
  recordObstacleHit,
  snapshot,
  restore,
  occupiedKeys,
};

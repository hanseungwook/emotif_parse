'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGameSession,
  createFood,
  start,
  pause,
  resume,
  gameOver,
  addScore,
  tick,
  recordFoodEaten,
  recordObstacleHit,
  snapshot,
  restore,
  occupiedKeys,
  SESSION_STATUS,
  FOOD_KIND,
  FOOD_POINTS,
} = require('../gameSession');
const { ValidationError } = require('../errors');

function baseInput(overrides) {
  return {
    id: 's1',
    mode: 'classic',
    board: { width: 12, height: 12 },
    snake: {
      body: [{ x: 5, y: 5 }, { x: 4, y: 5 }],
      direction: 'right',
    },
    ...(overrides || {}),
  };
}

test('createFood requires a cell', () => {
  assert.throws(() => createFood({}), ValidationError);
  assert.throws(() => createFood({ cell: { x: 1 } }), ValidationError);
});

test('createFood applies default points by kind', () => {
  const food = createFood({ cell: { x: 1, y: 2 } });
  assert.equal(food.kind, FOOD_KIND.STANDARD);
  assert.equal(food.points, FOOD_POINTS[FOOD_KIND.STANDARD]);
});

test('createGameSession validates mode', () => {
  assert.throws(() => createGameSession({ ...baseInput(), mode: 'bogus' }), ValidationError);
});

test('createGameSession requires obstacle layout id for obstacle mode', () => {
  assert.throws(
    () => createGameSession({ ...baseInput(), mode: 'obstacle' }),
    ValidationError
  );
});

test('createGameSession accepts obstacle mode with layout', () => {
  const session = createGameSession({
    ...baseInput(),
    mode: 'obstacle',
    obstacleLayoutId: 'corridor',
  });
  assert.equal(session.mode, 'obstacle');
  assert.equal(session.obstacleLayoutId, 'corridor');
});

test('zen mode wraps edges by default', () => {
  const session = createGameSession({ ...baseInput(), mode: 'zen' });
  assert.equal(session.board.wrapEdges, true);
});

test('start sets status RUNNING and startedAt', () => {
  const session = createGameSession(baseInput());
  let now = 1000;
  const next = start(session, () => now);
  assert.equal(next.status, SESSION_STATUS.RUNNING);
  assert.equal(next.startedAt, 1000);
});

test('pause/resume only toggle in valid states', () => {
  let session = createGameSession(baseInput());
  session = start(session, () => 1);
  session = pause(session);
  assert.equal(session.status, SESSION_STATUS.PAUSED);
  // pausing again should be a no-op
  assert.equal(pause(session).status, SESSION_STATUS.PAUSED);
  session = resume(session);
  assert.equal(session.status, SESSION_STATUS.RUNNING);
  // resuming when running should no-op
  assert.equal(resume(session).status, SESSION_STATUS.RUNNING);
});

test('gameOver marks snake dead and sets endedAt', () => {
  let session = createGameSession(baseInput());
  session = start(session, () => 1);
  session = gameOver(session, () => 99);
  assert.equal(session.status, SESSION_STATUS.GAME_OVER);
  assert.equal(session.snake.alive, false);
  assert.equal(session.endedAt, 99);
});

test('addScore clamps to >= 0 and ignores zero delta', () => {
  const session = createGameSession(baseInput());
  assert.equal(addScore(session, 0), session);
  assert.equal(addScore(session, 5).score, 5);
  assert.equal(addScore(session, -100).score, 0);
});

test('tick increments tick count', () => {
  let session = createGameSession(baseInput());
  session = tick(tick(session));
  assert.equal(session.ticks, 2);
});

test('recordFoodEaten adds points and counts food', () => {
  const session = createGameSession(baseInput());
  const food = createFood({ cell: { x: 1, y: 1 }, kind: FOOD_KIND.BONUS });
  const next = recordFoodEaten(session, food);
  assert.equal(next.foodEaten, 1);
  assert.equal(next.score, FOOD_POINTS[FOOD_KIND.BONUS]);
});

test('recordObstacleHit increments counter', () => {
  const session = createGameSession(baseInput());
  const next = recordObstacleHit(session);
  assert.equal(next.obstaclesHit, 1);
});

test('snapshot + restore round-trips through JSON', () => {
  const session = createGameSession({
    ...baseInput(),
    foods: [{ cell: { x: 2, y: 2 } }],
    score: 30,
  });
  const json = JSON.stringify(snapshot(session));
  const restored = restore(JSON.parse(json));
  assert.equal(restored.id, session.id);
  assert.equal(restored.score, 30);
  assert.equal(restored.foods.length, 1);
  assert.deepEqual(restored.foods[0].cell, { x: 2, y: 2 });
});

test('occupiedKeys covers snake body and food cells', () => {
  const session = createGameSession({
    ...baseInput(),
    foods: [{ cell: { x: 9, y: 9 } }],
  });
  const keys = occupiedKeys(session);
  assert.equal(keys.has('5,5'), true);
  assert.equal(keys.has('4,5'), true);
  assert.equal(keys.has('9,9'), true);
});

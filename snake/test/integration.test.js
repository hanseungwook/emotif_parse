'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGame,
  MemoryStorageAdapter,
  PersistenceManager,
  GAME_MODE,
  SEED_SKINS,
  SEED_OBSTACLE_LAYOUTS,
} = require('../');

function buildPersistence() {
  return new PersistenceManager({ adapter: new MemoryStorageAdapter() });
}

test('createGame hydrates seed catalog and a default player', async () => {
  const { store } = await createGame({ persistence: buildPersistence() });
  const state = store.getState();
  assert.equal(state.ready, true);
  assert.equal(state.loading, false);
  assert.equal(state.catalog.skins.length, SEED_SKINS.length);
  assert.equal(state.catalog.obstacleLayouts.length, SEED_OBSTACLE_LAYOUTS.length);
  assert.ok(state.player);
});

test('end-to-end: play a classic game and persist the result', async () => {
  const persistence = buildPersistence();
  const { store, repositories } = await createGame({ persistence });
  // Equip default skin
  store.equipSkin('classic-green');
  // Start session
  store.startSession({
    id: 'g1',
    mode: GAME_MODE.CLASSIC,
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
    skinId: 'classic-green',
  });
  // End with a non-trivial score
  store.endSession({ score: 200, snakeLength: 10, foodEaten: 8 });
  // Persist player + high scores together
  repositories.saveAll({
    player: store.getState().player,
    highScores: store.getState().highScores,
  });

  // Boot a fresh store and verify data is recovered
  const { store: store2 } = await createGame({ persistence });
  const state2 = store2.getState();
  assert.equal(state2.player.stats.gamesPlayed, 1);
  assert.equal(state2.player.stats.bestScore, 200);
  assert.equal(state2.highScores.classic.length, 1);
  assert.equal(state2.highScores.classic[0].score, 200);
});

test('end-to-end: clearing an obstacle layout unlocks ember skin via repository', async () => {
  const persistence = buildPersistence();
  const { store, repositories } = await createGame({ persistence });

  // Simulate clearing three layouts
  store.startSession({
    id: 'g-ob',
    mode: GAME_MODE.OBSTACLE,
    obstacleLayoutId: 'corridor',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 100, snakeLength: 5, foodEaten: 3, obstacleLayoutCleared: true });
  store.startSession({
    id: 'g-ob2',
    mode: GAME_MODE.OBSTACLE,
    obstacleLayoutId: 'fortress',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 100, snakeLength: 5, foodEaten: 3, obstacleLayoutCleared: true });
  store.startSession({
    id: 'g-ob3',
    mode: GAME_MODE.OBSTACLE,
    obstacleLayoutId: 'crosshair',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 100, snakeLength: 5, foodEaten: 3, obstacleLayoutCleared: true });

  // After 3 clears the ember skin's eligibility flips
  const decorated = repositories.catalog.skins.withUnlockState(store.getState().player);
  const ember = decorated.find((s) => s.id === 'ember');
  assert.equal(ember.eligible, true);
});

test('end-to-end: snapshot restoration preserves session-in-progress', async () => {
  const persistence = buildPersistence();
  const { store } = await createGame({ persistence });
  store.startSession({
    id: 'g1',
    mode: GAME_MODE.CLASSIC,
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  // Save with includeSession
  const snap = store.snapshot();
  // Build a fresh store and restore from snapshot
  const { store: fresh } = await createGame({ persistence });
  fresh.restore(snap);
  assert.equal(fresh.getState().session.id, 'g1');
});

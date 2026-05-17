'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GameStore,
  selectEquippedSkin,
  selectAvailableSkins,
  selectObstacleLayout,
  selectObstacleLayoutsByDifficulty,
} = require('../store');
const { buildSeedSkins, buildSeedObstacleLayouts } = require('../seedData');
const { createPlayer } = require('../player');

function captureEvents(store, names) {
  const events = [];
  for (const name of names) {
    store.on(name, (payload) => events.push({ name, payload }));
  }
  return events;
}

test('store starts in an empty state', () => {
  const store = new GameStore();
  const state = store.getState();
  assert.equal(state.player, null);
  assert.equal(state.session, null);
  assert.deepEqual(state.catalog.skins, []);
  assert.deepEqual(state.catalog.obstacleLayouts, []);
});

test('subscribe fires on every commit', () => {
  const store = new GameStore();
  let calls = 0;
  store.subscribe(() => {
    calls += 1;
  });
  store.setLoading(true);
  store.setLoading(false);
  assert.equal(calls, 2);
});

test('setCatalog emits catalog:loaded with counts', () => {
  const store = new GameStore();
  const events = captureEvents(store, ['catalog:loaded']);
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  assert.equal(events.length, 1);
  assert.equal(events[0].payload.skins > 0, true);
  assert.equal(events[0].payload.obstacleLayouts > 0, true);
});

test('ensurePlayer is idempotent', () => {
  const store = new GameStore();
  const a = store.ensurePlayer();
  const b = store.ensurePlayer();
  assert.equal(a, b);
});

test('equipSkin updates player and emits skin:equipped', () => {
  const store = new GameStore();
  store.setPlayer(createPlayer({ unlockedSkinIds: ['classic-green', 'ember'] }));
  const events = captureEvents(store, ['skin:equipped']);
  store.equipSkin('ember');
  assert.equal(events.length, 1);
  assert.equal(store.getState().player.equippedSkinId, 'ember');
  assert.equal(store.getState().ui.selectedSkinId, 'ember');
});

test('unlockSkin only emits once even when called twice', () => {
  const store = new GameStore();
  store.setPlayer(createPlayer());
  const events = captureEvents(store, ['skin:unlocked']);
  store.unlockSkin('midnight');
  store.unlockSkin('midnight');
  assert.equal(events.length, 1);
});

test('selectMode rejects unknown modes', () => {
  const store = new GameStore();
  assert.throws(() => store.selectMode('not-a-mode'));
});

test('startSession transitions to play screen and updates session', () => {
  const store = new GameStore();
  const events = captureEvents(store, ['session:started']);
  const session = store.startSession({
    id: 'g1',
    mode: 'classic',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  assert.equal(store.getState().ui.screen, 'play');
  assert.equal(store.getState().session.id, session.id);
  assert.equal(events.length, 1);
});

test('endSession records high score and updates player stats', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer());
  store.startSession({
    id: 'g1',
    mode: 'classic',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 250, snakeLength: 12, foodEaten: 9 });
  const state = store.getState();
  assert.equal(state.session.status, 'game_over');
  assert.equal(state.player.stats.gamesPlayed, 1);
  assert.equal(state.player.stats.bestScore, 250);
  assert.equal(state.highScores.classic.length, 1);
  assert.equal(state.highScores.classic[0].score, 250);
});

test('endSession in zen mode does not persist high score', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer());
  store.startSession({
    id: 'g-zen',
    mode: 'zen',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 90, snakeLength: 4, foodEaten: 3 });
  const state = store.getState();
  assert.equal(state.player.stats.gamesPlayed, 1);
  assert.equal(state.highScores.zen, undefined);
});

test('endSession records obstacle clear when flagged', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer());
  store.startSession({
    id: 'g-ob',
    mode: 'obstacle',
    obstacleLayoutId: 'corridor',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 500, snakeLength: 20, foodEaten: 30, obstacleLayoutCleared: true });
  const player = store.getState().player;
  assert.deepEqual(player.completedObstacleLayoutIds, ['corridor']);
  assert.equal(player.stats.obstacleClears, 1);
});

test('snapshot + restore preserves player and high scores', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer({ unlockedSkinIds: ['classic-green', 'ember'], equippedSkinId: 'ember' }));
  store.startSession({
    id: 'g1',
    mode: 'classic',
    snake: { body: [{ x: 5, y: 5 }, { x: 4, y: 5 }], direction: 'right' },
  });
  store.endSession({ score: 100, snakeLength: 5, foodEaten: 4 });
  const snap = store.snapshot();

  const restored = new GameStore();
  restored.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  restored.restore(snap);
  assert.equal(restored.getState().player.equippedSkinId, 'ember');
  assert.equal(restored.getState().highScores.classic.length, 1);
});

test('selectEquippedSkin returns full skin record from catalog', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer({ unlockedSkinIds: ['classic-green', 'midnight'], equippedSkinId: 'midnight' }));
  const skin = selectEquippedSkin(store.getState());
  assert.equal(skin.id, 'midnight');
  assert.equal(skin.name, 'Midnight');
});

test('selectAvailableSkins includes an unlocked flag', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.setPlayer(createPlayer({ unlockedSkinIds: ['classic-green', 'midnight'] }));
  const available = selectAvailableSkins(store.getState());
  const midnight = available.find((s) => s.id === 'midnight');
  const ember = available.find((s) => s.id === 'ember');
  assert.equal(midnight.unlocked, true);
  assert.equal(ember.unlocked, false);
});

test('selectObstacleLayout returns by selected layout id', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  store.selectObstacleLayout('corridor');
  const layout = selectObstacleLayout(store.getState());
  assert.equal(layout.id, 'corridor');
});

test('selectObstacleLayoutsByDifficulty groups layouts', () => {
  const store = new GameStore();
  store.setCatalog({ skins: buildSeedSkins(), obstacleLayouts: buildSeedObstacleLayouts() });
  const grouped = selectObstacleLayoutsByDifficulty(store.getState());
  assert.equal(Array.isArray(grouped.easy), true);
  assert.equal(grouped.easy.length >= 1, true);
});

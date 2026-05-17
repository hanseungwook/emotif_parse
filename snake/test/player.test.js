'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPlayer,
  setEquippedSkin,
  unlockSkin,
  recordObstacleClear,
  recordGameFinished,
  setPreferences,
  setName,
} = require('../player');
const { ValidationError } = require('../errors');

test('createPlayer applies defaults', () => {
  const p = createPlayer();
  assert.equal(p.id, 'local');
  assert.equal(p.name, 'Player');
  assert.equal(p.equippedSkinId, 'classic-green');
  assert.deepEqual(p.unlockedSkinIds, ['classic-green']);
  assert.equal(p.stats.gamesPlayed, 0);
});

test('createPlayer dedupes unlocked skin list', () => {
  const p = createPlayer({ unlockedSkinIds: ['a', 'a', 'b'] });
  assert.deepEqual(p.unlockedSkinIds, ['a', 'b']);
});

test('setEquippedSkin requires the skin be unlocked', () => {
  const p = createPlayer();
  assert.throws(() => setEquippedSkin(p, 'unknown'), ValidationError);
});

test('setEquippedSkin updates equippedSkinId', () => {
  const p = createPlayer({ unlockedSkinIds: ['classic-green', 'ember'] });
  const next = setEquippedSkin(p, 'ember');
  assert.equal(next.equippedSkinId, 'ember');
});

test('unlockSkin is idempotent', () => {
  const p = createPlayer();
  const after = unlockSkin(p, 'midnight');
  assert.deepEqual(after.unlockedSkinIds, ['classic-green', 'midnight']);
  const again = unlockSkin(after, 'midnight');
  assert.equal(again, after); // no change → same reference
});

test('recordObstacleClear adds to completed list once', () => {
  let p = createPlayer();
  p = recordObstacleClear(p, 'corridor');
  p = recordObstacleClear(p, 'corridor');
  assert.deepEqual(p.completedObstacleLayoutIds, ['corridor']);
  assert.equal(p.stats.obstacleClears, 2);
});

test('recordGameFinished updates aggregate stats', () => {
  let p = createPlayer();
  p = recordGameFinished(p, {
    mode: 'classic',
    score: 50,
    snakeLength: 7,
    foodEaten: 5,
  });
  p = recordGameFinished(p, {
    mode: 'obstacle',
    score: 120,
    snakeLength: 9,
    foodEaten: 8,
  });
  assert.equal(p.stats.gamesPlayed, 2);
  assert.equal(p.stats.bestScore, 120);
  assert.equal(p.stats.totalScore, 170);
  assert.equal(p.stats.longestSnake, 9);
  assert.equal(p.stats.bestScoresByMode.classic, 50);
  assert.equal(p.stats.bestScoresByMode.obstacle, 120);
  assert.equal(p.stats.foodEatenTotal, 13);
});

test('setPreferences whitelists keys', () => {
  const p = createPlayer();
  const next = setPreferences(p, { soundEnabled: false, controls: 'wasd', evil: true });
  assert.equal(next.preferences.soundEnabled, false);
  assert.equal(next.preferences.controls, 'wasd');
  assert.equal(next.preferences.evil, undefined);
});

test('setName trims and caps length', () => {
  const p = createPlayer();
  const long = 'x'.repeat(100);
  const next = setName(p, '  Alice  ');
  assert.equal(next.name, 'Alice');
  const trimmed = setName(p, long);
  assert.equal(trimmed.name.length, 40);
});

test('setName rejects empty', () => {
  assert.throws(() => setName(createPlayer(), '   '), ValidationError);
});

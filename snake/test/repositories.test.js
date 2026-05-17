'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SkinRepository,
  ObstacleLayoutRepository,
  CatalogRepository,
  PlayerRepository,
  HighScoreRepository,
  Repositories,
  loadSeedCatalog,
  buildSeedCatalogSync,
} = require('../repositories');
const { PersistenceManager } = require('../persistence');
const { MemoryStorageAdapter } = require('../memoryStorageAdapter');
const { buildSeedSkins, buildSeedObstacleLayouts } = require('../seedData');
const { createPlayer } = require('../player');
const { createHighScore } = require('../highScore');
const { NotFoundError, ValidationError } = require('../errors');

test('SkinRepository.list returns all skins', () => {
  const repo = new SkinRepository({ skins: buildSeedSkins() });
  assert.equal(repo.list().length, buildSeedSkins().length);
});

test('SkinRepository.get throws for unknown id', () => {
  const repo = new SkinRepository({ skins: buildSeedSkins() });
  assert.throws(() => repo.get('not-a-skin'), NotFoundError);
});

test('SkinRepository.find returns null for unknown id', () => {
  const repo = new SkinRepository({ skins: buildSeedSkins() });
  assert.equal(repo.find('not-a-skin'), null);
  assert.equal(repo.find('classic-green').id, 'classic-green');
});

test('SkinRepository.withUnlockState marks each skin', () => {
  const repo = new SkinRepository({ skins: buildSeedSkins() });
  const player = createPlayer({ unlockedSkinIds: ['classic-green', 'midnight'] });
  const decorated = repo.withUnlockState(player);
  const midnight = decorated.find((s) => s.id === 'midnight');
  const ember = decorated.find((s) => s.id === 'ember');
  assert.equal(midnight.unlocked, true);
  assert.equal(ember.unlocked, false);
  // eligible reflects unlock conditions, independent of unlocked
  assert.equal(typeof ember.eligible, 'boolean');
});

test('ObstacleLayoutRepository.byDifficulty filters', () => {
  const repo = new ObstacleLayoutRepository({ layouts: buildSeedObstacleLayouts() });
  const easy = repo.byDifficulty('easy');
  for (const l of easy) assert.equal(l.difficulty, 'easy');
});

test('ObstacleLayoutRepository.get throws on missing', () => {
  const repo = new ObstacleLayoutRepository({ layouts: buildSeedObstacleLayouts() });
  assert.throws(() => repo.get('does-not-exist'), NotFoundError);
});

test('CatalogRepository.asPayload returns serializable lists', () => {
  const repo = new CatalogRepository({
    skins: buildSeedSkins(),
    obstacleLayouts: buildSeedObstacleLayouts(),
  });
  const payload = repo.asPayload();
  assert.equal(Array.isArray(payload.skins), true);
  assert.equal(Array.isArray(payload.obstacleLayouts), true);
});

test('loadSeedCatalog returns a populated CatalogRepository', async () => {
  const catalog = await loadSeedCatalog();
  assert.ok(catalog.skins.list().length > 0);
  assert.ok(catalog.obstacleLayouts.list().length > 0);
});

test('buildSeedCatalogSync returns same shape', () => {
  const catalog = buildSeedCatalogSync();
  assert.ok(catalog.skins.list().length > 0);
});

test('PlayerRepository round-trips through persistence', () => {
  const persistence = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const repo = new PlayerRepository({ persistence });
  assert.equal(repo.load(), null);
  const player = createPlayer({ name: 'Repo' });
  repo.save(player);
  const loaded = repo.load();
  assert.equal(loaded.name, 'Repo');
});

test('PlayerRepository.save preserves existing high scores', () => {
  const persistence = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const playerRepo = new PlayerRepository({ persistence });
  const hsRepo = new HighScoreRepository({ persistence });
  hsRepo.add(createHighScore({ id: 'a', mode: 'classic', score: 100 }));
  playerRepo.save(createPlayer({ name: 'After' }));
  assert.equal(hsRepo.loadForMode('classic').length, 1);
});

test('HighScoreRepository.add caps and persists', () => {
  const persistence = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const repo = new HighScoreRepository({ persistence });
  repo.add(createHighScore({ id: 'a', mode: 'classic', score: 5 }));
  repo.add(createHighScore({ id: 'b', mode: 'classic', score: 100 }));
  const list = repo.loadForMode('classic');
  assert.equal(list.length, 2);
  assert.equal(list[0].score, 100);
});

test('HighScoreRepository.clear removes scores', () => {
  const persistence = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const repo = new HighScoreRepository({ persistence });
  repo.add(createHighScore({ id: 'a', mode: 'classic', score: 5 }));
  repo.add(createHighScore({ id: 'b', mode: 'obstacle', score: 100 }));
  repo.clear('classic');
  assert.equal(repo.loadForMode('classic').length, 0);
  assert.equal(repo.loadForMode('obstacle').length, 1);
  repo.clear();
  assert.equal(repo.loadForMode('obstacle').length, 0);
});

test('Repositories.hydrate returns catalog, player, highScores', async () => {
  const repos = new Repositories({
    persistence: new PersistenceManager({ adapter: new MemoryStorageAdapter() }),
  });
  const result = await repos.hydrate();
  assert.equal(Array.isArray(result.catalog.skins), true);
  assert.equal(result.player.name, 'Player');
  assert.deepEqual(result.highScores, {});
});

test('Repositories.saveAll writes player + high scores together', () => {
  const repos = new Repositories({
    persistence: new PersistenceManager({ adapter: new MemoryStorageAdapter() }),
  });
  const player = createPlayer({ name: 'Saved' });
  const hs = createHighScore({ id: 'a', mode: 'classic', score: 100 });
  repos.saveAll({ player, highScores: { classic: [hs] } });
  const loaded = repos.persistence.load();
  assert.equal(loaded.payload.player.name, 'Saved');
  assert.equal(loaded.payload.highScores.classic[0].score, 100);
});

test('Repositories requires a persistence on player/high score repos', () => {
  assert.throws(() => new PlayerRepository({}), ValidationError);
  assert.throws(() => new HighScoreRepository({}), ValidationError);
});

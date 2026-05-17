'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PersistenceManager, SCHEMA_VERSION } = require('../persistence');
const { MemoryStorageAdapter } = require('../memoryStorageAdapter');
const { createPlayer } = require('../player');
const { createHighScore } = require('../highScore');
const { PersistenceError, MigrationError } = require('../errors');

test('save writes a versioned envelope', () => {
  const adapter = new MemoryStorageAdapter();
  const mgr = new PersistenceManager({ adapter });
  const player = createPlayer({ name: 'Alice' });
  const envelope = mgr.save({ player, highScores: {} });
  assert.equal(envelope.version, SCHEMA_VERSION);
  const raw = adapter.getItem(mgr.namespace);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.version, SCHEMA_VERSION);
  assert.equal(parsed.payload.player.name, 'Alice');
});

test('load returns null when storage is empty', () => {
  const mgr = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  assert.equal(mgr.load(), null);
});

test('save then load round-trips player and high scores', () => {
  const mgr = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const player = createPlayer({ name: 'Bob' });
  const hs = createHighScore({ id: 'a', mode: 'classic', score: 100, playerName: 'Bob' });
  mgr.save({ player, highScores: { classic: [hs] } });
  const loaded = mgr.load();
  assert.equal(loaded.payload.player.name, 'Bob');
  assert.equal(loaded.payload.highScores.classic[0].score, 100);
});

test('save with includeSession persists session', () => {
  const mgr = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  const session = { id: 's1', mode: 'classic', score: 50 };
  mgr.save({ session, player: createPlayer() }, { includeSession: true });
  const loaded = mgr.load();
  assert.equal(loaded.payload.session.id, 's1');
});

test('save without includeSession omits session', () => {
  const mgr = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  mgr.save({ session: { id: 's1' }, player: createPlayer() });
  const loaded = mgr.load();
  assert.equal(loaded.payload.session, undefined);
});

test('load with corrupt JSON throws PersistenceError', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem('snake:save:v1', '{not-json}');
  const mgr = new PersistenceManager({ adapter });
  assert.throws(() => mgr.load(), PersistenceError);
});

test('load with downgrade throws MigrationError', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    'snake:save:v1',
    JSON.stringify({ version: 999, payload: {} })
  );
  const mgr = new PersistenceManager({ adapter });
  assert.throws(() => mgr.load(), MigrationError);
});

test('load with legacy unversioned data accepts payload', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem(
    'snake:save:v1',
    JSON.stringify({ payload: { player: createPlayer({ name: 'Legacy' }) } })
  );
  const mgr = new PersistenceManager({ adapter });
  const loaded = mgr.load();
  assert.equal(loaded.payload.player.name, 'Legacy');
});

test('clear removes saved data', () => {
  const mgr = new PersistenceManager({ adapter: new MemoryStorageAdapter() });
  mgr.save({ player: createPlayer() });
  assert.equal(mgr.hasSavedData(), true);
  mgr.clear();
  assert.equal(mgr.hasSavedData(), false);
  assert.equal(mgr.load(), null);
});

test('custom namespace isolates two managers', () => {
  const adapter = new MemoryStorageAdapter();
  const a = new PersistenceManager({ adapter, namespace: 'snake:save:a' });
  const b = new PersistenceManager({ adapter, namespace: 'snake:save:b' });
  a.save({ player: createPlayer({ name: 'A' }) });
  b.save({ player: createPlayer({ name: 'B' }) });
  assert.equal(a.load().payload.player.name, 'A');
  assert.equal(b.load().payload.player.name, 'B');
});

test('MemoryStorageAdapter behaves like Storage', () => {
  const adapter = new MemoryStorageAdapter();
  adapter.setItem('a', '1');
  adapter.setItem('b', '2');
  assert.equal(adapter.getItem('a'), '1');
  assert.equal(adapter.length, 2);
  adapter.removeItem('a');
  assert.equal(adapter.getItem('a'), null);
  adapter.clear();
  assert.equal(adapter.length, 0);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SnapshotStore,
  MemoryStorage,
  SNAPSHOT_VERSION,
  validateSnapshot,
} = require('../snapshotStore');
const { SnapshotCorruptError } = require('../errors');

function fakeClock() {
  let t = 100;
  return () => {
    t += 1;
    return t;
  };
}

test('save() records a normalized envelope with version and timestamp', () => {
  const store = new SnapshotStore({ clock: fakeClock() });
  const rec = store.save({
    skinId: 'midnight',
    skin: { id: 'midnight', name: 'Midnight' },
    obstacles: { difficulty: 'medium', cells: [{ x: 1, y: 2 }] },
    score: 17,
    level: 3,
    gameplay: { body: [{ x: 5, y: 5 }] },
  });
  assert.equal(rec.version, SNAPSHOT_VERSION);
  assert.equal(rec.skinId, 'midnight');
  assert.equal(rec.score, 17);
  assert.equal(rec.level, 3);
  assert.ok(rec.savedAt > 100);
  assert.equal(rec.obstacles.cells[0].x, 1);
  assert.equal(rec.gameplay.body[0].y, 5);
});

test('load() restores what save() wrote', () => {
  const store = new SnapshotStore({ clock: fakeClock() });
  store.save({ skinId: 'classic', obstacles: null, score: 0 });
  const loaded = store.load();
  assert.equal(loaded.skinId, 'classic');
  assert.equal(loaded.obstacles, null);
});

test('load() returns null when nothing is stored', () => {
  const store = new SnapshotStore();
  assert.equal(store.load(), null);
  assert.equal(store.has(), false);
});

test('load() throws SnapshotCorruptError for invalid JSON', () => {
  const storage = new MemoryStorage();
  storage.set('snake:operations:snapshot', '{not json');
  const store = new SnapshotStore({ storage });
  assert.throws(() => store.load(), SnapshotCorruptError);
});

test('load() throws when version mismatches', () => {
  const storage = new MemoryStorage();
  storage.set(
    'snake:operations:snapshot',
    JSON.stringify({ version: 99, savedAt: 1, skinId: 'classic' })
  );
  const store = new SnapshotStore({ storage });
  assert.throws(() => store.load(), SnapshotCorruptError);
});

test('load() throws when savedAt is not numeric', () => {
  const storage = new MemoryStorage();
  storage.set(
    'snake:operations:snapshot',
    JSON.stringify({ version: SNAPSHOT_VERSION, savedAt: 'yesterday' })
  );
  const store = new SnapshotStore({ storage });
  assert.throws(() => store.load(), SnapshotCorruptError);
});

test('validateSnapshot enforces obstacle envelope shape', () => {
  assert.throws(
    () =>
      validateSnapshot({
        version: SNAPSHOT_VERSION,
        savedAt: 1,
        obstacles: { difficulty: 'medium' }, // missing cells
      }),
    SnapshotCorruptError
  );
});

test('clear() removes the persisted snapshot', () => {
  const store = new SnapshotStore({ clock: fakeClock() });
  store.save({ skinId: 'classic' });
  assert.equal(store.has(), true);
  store.clear();
  assert.equal(store.has(), false);
});

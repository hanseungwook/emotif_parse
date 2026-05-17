'use strict';

const { SnapshotCorruptError } = require('./errors');

const SNAPSHOT_VERSION = 1;

function deepFreezeShallow(value) {
  if (value && typeof value === 'object') return Object.freeze(value);
  return value;
}

// A small snapshot describes everything operations needs to recover after
// an error: the active skin, the obstacle layout, the active score, and
// whichever gameplay state (snake body, food, direction) callers chose to
// hand us. We do not interpret gameplay payload — we just persist and
// validate the envelope.
function validateSnapshot(snap) {
  if (!snap || typeof snap !== 'object') {
    throw new SnapshotCorruptError('snapshot must be an object');
  }
  if (snap.version !== SNAPSHOT_VERSION) {
    throw new SnapshotCorruptError(
      'unsupported snapshot version: ' + String(snap.version)
    );
  }
  if (typeof snap.savedAt !== 'number' || !Number.isFinite(snap.savedAt)) {
    throw new SnapshotCorruptError('snapshot.savedAt must be a finite number');
  }
  if (snap.skin && typeof snap.skin !== 'object') {
    throw new SnapshotCorruptError('snapshot.skin must be an object or null');
  }
  if (snap.skinId !== undefined && typeof snap.skinId !== 'string') {
    throw new SnapshotCorruptError('snapshot.skinId must be a string');
  }
  if (snap.obstacles !== undefined && snap.obstacles !== null) {
    if (typeof snap.obstacles !== 'object') {
      throw new SnapshotCorruptError('snapshot.obstacles must be an object');
    }
    if (!Array.isArray(snap.obstacles.cells)) {
      throw new SnapshotCorruptError('snapshot.obstacles.cells must be an array');
    }
  }
  return true;
}

class SnapshotStore {
  constructor(options) {
    const opts = options || {};
    this._storage = opts.storage || new MemoryStorage();
    this._key = opts.key || 'snake:operations:snapshot';
    this._clock = opts.clock || (() => Date.now());
  }

  // Saves a snapshot, normalizing into a stable envelope. Returns the saved
  // record so callers can echo what was persisted.
  save(payload) {
    const body = payload || {};
    const record = Object.freeze({
      version: SNAPSHOT_VERSION,
      savedAt: this._clock(),
      skinId: body.skinId || null,
      skin: body.skin ? deepFreezeShallow(Object.assign({}, body.skin)) : null,
      obstacles: body.obstacles
        ? Object.freeze(Object.assign({}, body.obstacles, {
            cells: Object.freeze(Array.isArray(body.obstacles.cells)
              ? body.obstacles.cells.map((c) => Object.freeze(Object.assign({}, c)))
              : []),
          }))
        : null,
      score: typeof body.score === 'number' ? body.score : 0,
      level: typeof body.level === 'number' ? body.level : 1,
      reason: body.reason || null,
      gameplay: body.gameplay ? deepFreezeShallow(Object.assign({}, body.gameplay)) : null,
    });
    this._storage.set(this._key, JSON.stringify(record));
    return record;
  }

  // Loads and validates a snapshot from storage. Returns null when none
  // exists; throws SnapshotCorruptError when the stored value cannot be
  // interpreted so the runtime can fall back to EMPTY.
  load() {
    const raw = this._storage.get(this._key);
    if (raw === null || raw === undefined) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new SnapshotCorruptError('snapshot is not valid JSON', { cause: err });
    }
    validateSnapshot(parsed);
    return parsed;
  }

  has() {
    const raw = this._storage.get(this._key);
    return raw !== null && raw !== undefined;
  }

  clear() {
    this._storage.delete(this._key);
  }
}

class MemoryStorage {
  constructor() {
    this._map = new Map();
  }
  get(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }
  set(key, value) {
    this._map.set(key, value);
  }
  delete(key) {
    this._map.delete(key);
  }
  size() {
    return this._map.size;
  }
}

module.exports = {
  SnapshotStore,
  MemoryStorage,
  SNAPSHOT_VERSION,
  validateSnapshot,
};

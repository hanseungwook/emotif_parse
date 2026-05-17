'use strict';

const { PersistenceError, MigrationError } = require('./errors');
const { MemoryStorageAdapter } = require('./memoryStorageAdapter');

// PersistenceManager orchestrates serialization of player profile + high
// scores + UI preferences into a Storage-like adapter under a single
// namespace key. It supports versioning + migrations so future schema bumps
// don't lose existing players' progress.
//
// Format on disk: `{ version, savedAt, payload }` JSON-encoded.
//
// Notes:
//   * The current game session is intentionally NOT included by default — a
//     game in progress is ephemeral. Callers that want resume support can
//     opt in via `includeSession: true` when calling save().
//   * High scores ARE persisted (they're long-lived).

const SCHEMA_VERSION = 1;
const DEFAULT_NAMESPACE = 'snake:save:v1';

const MIGRATIONS = Object.freeze({
  // future: 1 -> 2, 2 -> 3 ...
});

class PersistenceManager {
  constructor(options) {
    const opts = options || {};
    this._adapter = opts.adapter || new MemoryStorageAdapter();
    this._namespace = opts.namespace || DEFAULT_NAMESPACE;
    this._version = SCHEMA_VERSION;
  }

  get namespace() {
    return this._namespace;
  }

  get adapter() {
    return this._adapter;
  }

  // ---- Save -------------------------------------------------------------

  save(stateSnapshot, options) {
    const opts = options || {};
    const payload = this._buildPayload(stateSnapshot, opts);
    const envelope = {
      version: this._version,
      savedAt: Date.now(),
      payload,
    };
    let serialized;
    try {
      serialized = JSON.stringify(envelope);
    } catch (err) {
      throw new PersistenceError('failed to serialize state', err);
    }
    this._adapter.setItem(this._namespace, serialized);
    return envelope;
  }

  _buildPayload(stateSnapshot, opts) {
    const snap = stateSnapshot || {};
    const payload = {
      player: snap.player || null,
      highScores: snap.highScores || {},
      ui: snap.ui || null,
    };
    if (opts.includeSession && snap.session) {
      payload.session = snap.session;
    }
    return payload;
  }

  // ---- Load -------------------------------------------------------------

  load() {
    const raw = this._adapter.getItem(this._namespace);
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new PersistenceError('saved data is corrupt JSON', err);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new PersistenceError('saved data is malformed');
    }
    if (typeof parsed.version !== 'number') {
      // Unversioned legacy data — wrap and migrate from 0.
      parsed.version = 0;
      parsed.payload = parsed.payload || parsed;
    }
    const migrated = this._migrate(parsed.payload, parsed.version, this._version);
    return {
      version: this._version,
      savedAt: parsed.savedAt || 0,
      payload: migrated,
    };
  }

  _migrate(payload, fromVersion, toVersion) {
    if (fromVersion === toVersion) return payload;
    if (fromVersion > toVersion) {
      throw new MigrationError(
        `cannot downgrade save from v${fromVersion} to v${toVersion}`
      );
    }
    let current = payload;
    for (let v = fromVersion; v < toVersion; v++) {
      const step = MIGRATIONS[v];
      if (typeof step !== 'function') {
        // No migration defined — accept the data as-is. This is a forward
        // contract: future versions must register migrations explicitly.
        continue;
      }
      try {
        current = step(current);
      } catch (err) {
        throw new MigrationError(`migration v${v} -> v${v + 1} failed: ${err.message}`);
      }
    }
    return current;
  }

  clear() {
    this._adapter.removeItem(this._namespace);
  }

  hasSavedData() {
    return this._adapter.getItem(this._namespace) != null;
  }
}

module.exports = {
  PersistenceManager,
  SCHEMA_VERSION,
  DEFAULT_NAMESPACE,
};

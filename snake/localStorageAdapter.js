'use strict';

const { PersistenceError } = require('./errors');

// Thin wrapper around browser localStorage. Catches the usual failure modes
// (quota exceeded, disabled storage) and surfaces them as PersistenceError so
// callers can decide whether to retry, fall back, or warn the user.
//
// The adapter is constructed eagerly so the constructor can probe for
// availability. In Node tests, use MemoryStorageAdapter instead.

class LocalStorageAdapter {
  constructor(storage) {
    const target = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) {
      throw new PersistenceError('localStorage is not available in this environment');
    }
    this._storage = target;
    this._probe();
  }

  _probe() {
    const key = '__snake_probe__';
    try {
      this._storage.setItem(key, '1');
      this._storage.removeItem(key);
    } catch (err) {
      throw new PersistenceError('localStorage is not writable', err);
    }
  }

  getItem(key) {
    try {
      return this._storage.getItem(key);
    } catch (err) {
      throw new PersistenceError(`failed to read ${key}`, err);
    }
  }

  setItem(key, value) {
    try {
      this._storage.setItem(key, value);
    } catch (err) {
      throw new PersistenceError(`failed to write ${key} (storage quota or disabled?)`, err);
    }
  }

  removeItem(key) {
    try {
      this._storage.removeItem(key);
    } catch (err) {
      throw new PersistenceError(`failed to remove ${key}`, err);
    }
  }
}

module.exports = { LocalStorageAdapter };

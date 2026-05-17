'use strict';

// In-memory storage adapter. Useful for tests and Node-side persistence where
// no browser localStorage is available. Mirrors a Storage-like interface.

class MemoryStorageAdapter {
  constructor(initial) {
    this._map = new Map();
    if (initial && typeof initial === 'object') {
      for (const [k, v] of Object.entries(initial)) {
        this._map.set(String(k), String(v));
      }
    }
  }

  getItem(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }

  setItem(key, value) {
    this._map.set(String(key), String(value));
  }

  removeItem(key) {
    this._map.delete(String(key));
  }

  clear() {
    this._map.clear();
  }

  get length() {
    return this._map.size;
  }

  key(index) {
    const keys = Array.from(this._map.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  // Test helper — return all stored entries as a plain object.
  entries() {
    const out = {};
    for (const [k, v] of this._map.entries()) out[k] = v;
    return out;
  }
}

module.exports = { MemoryStorageAdapter };

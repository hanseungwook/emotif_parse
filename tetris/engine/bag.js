'use strict';

const { PIECE_TYPES } = require('./pieces');

// Mulberry32 PRNG — deterministic when seeded.
function createSeededRng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SevenBag {
  constructor(options) {
    const opts = options || {};
    this._rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
    this._types = (Array.isArray(opts.types) && opts.types.length > 0)
      ? opts.types.slice()
      : PIECE_TYPES.slice();
    if (this._types.length === 0) {
      throw new RangeError('SevenBag requires at least one piece type');
    }
    this._queue = [];
  }

  next() {
    if (this._queue.length === 0) this._refill();
    return this._queue.shift();
  }

  peek(n) {
    const want = Math.max(0, n | 0);
    while (this._queue.length < want) this._refill();
    return this._queue.slice(0, want);
  }

  size() {
    return this._queue.length;
  }

  _refill() {
    const next = this._types.slice();
    // Fisher-Yates with the configured RNG.
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
    }
    for (const t of next) this._queue.push(t);
  }
}

module.exports = { SevenBag, createSeededRng };

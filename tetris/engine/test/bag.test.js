'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SevenBag, createSeededRng } = require('../bag');
const { PIECE_TYPES } = require('../pieces');

test('every 7 pulls contain each piece type exactly once', () => {
  const bag = new SevenBag({ rng: createSeededRng(42) });
  const seen = [];
  for (let i = 0; i < 7; i++) seen.push(bag.next());
  assert.deepEqual(seen.slice().sort(), PIECE_TYPES.slice().sort());
});

test('two consecutive bags contain each piece exactly twice', () => {
  const bag = new SevenBag({ rng: createSeededRng(1234) });
  const counts = {};
  for (let i = 0; i < 14; i++) {
    const t = bag.next();
    counts[t] = (counts[t] || 0) + 1;
  }
  for (const t of PIECE_TYPES) {
    assert.equal(counts[t], 2, `${t} count`);
  }
});

test('seeded RNG produces reproducible sequences', () => {
  const a = new SevenBag({ rng: createSeededRng(99) });
  const b = new SevenBag({ rng: createSeededRng(99) });
  for (let i = 0; i < 21; i++) {
    assert.equal(a.next(), b.next());
  }
});

test('peek returns upcoming pieces without consuming them', () => {
  const bag = new SevenBag({ rng: createSeededRng(7) });
  const preview = bag.peek(5);
  assert.equal(preview.length, 5);
  for (const p of preview) assert.ok(PIECE_TYPES.includes(p));
  // Subsequent next() calls match the preview in order.
  for (let i = 0; i < 5; i++) {
    assert.equal(bag.next(), preview[i]);
  }
});

test('peek expands across bag boundaries', () => {
  const bag = new SevenBag({ rng: createSeededRng(2025) });
  const preview = bag.peek(10);
  assert.equal(preview.length, 10);
  // First seven still contain each piece exactly once.
  assert.deepEqual(preview.slice(0, 7).slice().sort(), PIECE_TYPES.slice().sort());
});

test('falls back to Math.random when no rng is provided', () => {
  const bag = new SevenBag();
  const seen = new Set();
  for (let i = 0; i < 7; i++) seen.add(bag.next());
  assert.equal(seen.size, 7);
});

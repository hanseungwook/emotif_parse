'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateObstacles,
  obstacleKeys,
  hits,
  PATTERNS,
} = require('../obstacles');
const { createSeededRng } = require('./seedRng');

test('pillars pattern returns the four corner-adjacent cells on a large board', () => {
  const cells = generateObstacles({ pattern: 'pillars', width: 10, height: 10 });
  assert.equal(cells.length, 4);
});

test('pillars pattern returns nothing on tiny boards', () => {
  assert.deepEqual(generateObstacles({ pattern: 'pillars', width: 6, height: 6 }), []);
});

test('crossbars pattern produces obstacles spread across the board', () => {
  const cells = generateObstacles({ pattern: 'crossbars', width: 12, height: 12 });
  assert.ok(cells.length >= 4);
});

test('scattered pattern produces the requested count and avoids duplicates', () => {
  const rng = createSeededRng(99);
  const cells = generateObstacles({
    pattern: 'scattered',
    width: 12,
    height: 12,
    rng,
    count: 8,
  });
  assert.equal(cells.length, 8);
  const seen = new Set();
  for (const cell of cells) {
    const k = `${cell.x},${cell.y}`;
    assert.ok(!seen.has(k), 'no duplicate cells');
    seen.add(k);
  }
});

test('hits detects collision with obstacle cells', () => {
  const cells = [{ x: 2, y: 3 }, { x: 5, y: 5 }];
  assert.ok(hits(cells, { x: 5, y: 5 }));
  assert.ok(!hits(cells, { x: 0, y: 0 }));
});

test('obstacleKeys returns a Set of cellKey strings', () => {
  const keys = obstacleKeys([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.ok(keys instanceof Set);
  assert.ok(keys.has('1,2'));
  assert.ok(keys.has('3,4'));
});

test('PATTERNS exposes all known patterns', () => {
  assert.ok(typeof PATTERNS.pillars === 'function');
  assert.ok(typeof PATTERNS.crossbars === 'function');
  assert.ok(typeof PATTERNS.scattered === 'function');
});

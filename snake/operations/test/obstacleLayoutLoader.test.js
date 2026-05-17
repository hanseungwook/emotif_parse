'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ObstacleLayoutLoader,
  DIFFICULTIES,
  generateLayout,
  coerceSeed,
} = require('../obstacleLayoutLoader');
const { ObstacleGenerationError } = require('../errors');

test('DIFFICULTIES exposes off/light/medium/heavy bands', () => {
  for (const key of ['off', 'light', 'medium', 'heavy']) {
    assert.ok(DIFFICULTIES[key], 'missing band: ' + key);
  }
  assert.equal(DIFFICULTIES.off.density, 0);
  assert.ok(DIFFICULTIES.heavy.density > DIFFICULTIES.medium.density);
});

test('generateLayout is deterministic for a given seed', () => {
  const a = generateLayout({ difficulty: 'medium', seed: 'snake-1', width: 16, height: 16 });
  const b = generateLayout({ difficulty: 'medium', seed: 'snake-1', width: 16, height: 16 });
  assert.equal(a.count, b.count);
  assert.deepEqual(
    a.cells.map((c) => c.x + ',' + c.y),
    b.cells.map((c) => c.x + ',' + c.y)
  );
});

test('generateLayout avoids the spawn cells', () => {
  const layout = generateLayout({
    difficulty: 'heavy',
    seed: 99,
    width: 20,
    height: 20,
    protectedSpawn: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ],
  });
  for (const cell of layout.cells) {
    assert.ok(
      !(cell.x === 10 && cell.y === 10),
      'spawn cell should never have an obstacle'
    );
  }
});

test('generateLayout rejects unknown difficulty', () => {
  assert.throws(
    () => generateLayout({ difficulty: 'impossible' }),
    ObstacleGenerationError
  );
});

test('load("off") returns an empty layout but still records the difficulty', async () => {
  const loader = new ObstacleLayoutLoader();
  const layout = await loader.load({ difficulty: 'off' });
  assert.equal(layout.difficulty, 'off');
  assert.equal(layout.count, 0);
  assert.equal(layout.cells.length, 0);
  assert.equal(loader.current, layout);
});

test('load() with a default difficulty produces a non-empty layout', async () => {
  const loader = new ObstacleLayoutLoader({ defaultDifficulty: 'light' });
  const layout = await loader.load({ seed: 'fixed' });
  assert.equal(layout.difficulty, 'light');
  assert.ok(layout.count > 0, 'light difficulty must place at least one obstacle');
  assert.ok(layout.cells.length === layout.count);
});

test('load() rejects with ObstacleGenerationError when the grid is too crowded', async () => {
  const loader = new ObstacleLayoutLoader();
  // Fill most of a 5×5 grid with protected spawn so any non-zero density
  // exceeds the remaining capacity.
  const crowdedSpawn = [];
  for (let x = 0; x < 5; x += 1) {
    for (let y = 0; y < 5; y += 1) {
      crowdedSpawn.push({ x, y });
      if (crowdedSpawn.length >= 22) break;
    }
    if (crowdedSpawn.length >= 22) break;
  }
  await assert.rejects(
    loader.load({
      difficulty: 'heavy',
      width: 5,
      height: 5,
      protectedSpawn: crowdedSpawn,
    }),
    ObstacleGenerationError
  );
});

test('clear() drops the current layout', async () => {
  const loader = new ObstacleLayoutLoader();
  await loader.load({ difficulty: 'light', seed: 1 });
  assert.ok(loader.current);
  loader.clear();
  assert.equal(loader.current, null);
});

test('coerceSeed accepts numbers and hashes strings deterministically', () => {
  assert.equal(coerceSeed(42), 42);
  assert.equal(coerceSeed('alpha'), coerceSeed('alpha'));
  assert.notEqual(coerceSeed('alpha'), coerceSeed('beta'));
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createHighScore,
  compareHighScores,
  insertHighScore,
  isPersonalBest,
  HIGH_SCORE_LIMIT_PER_MODE,
} = require('../highScore');
const { ValidationError } = require('../errors');

test('createHighScore validates required fields', () => {
  assert.throws(() => createHighScore({}), ValidationError);
  assert.throws(() => createHighScore({ id: 'a', mode: 'classic' }), ValidationError);
  assert.throws(
    () => createHighScore({ id: 'a', mode: 'bogus', score: 1 }),
    ValidationError
  );
});

test('createHighScore freezes record', () => {
  const entry = createHighScore({ id: 'a', mode: 'classic', score: 100 });
  assert.throws(() => {
    entry.score = 999;
  });
});

test('compareHighScores sorts highest score first', () => {
  const list = [
    createHighScore({ id: 'a', mode: 'classic', score: 50, achievedAt: 2 }),
    createHighScore({ id: 'b', mode: 'classic', score: 100, achievedAt: 1 }),
    createHighScore({ id: 'c', mode: 'classic', score: 100, achievedAt: 3 }),
  ];
  list.sort(compareHighScores);
  assert.deepEqual(list.map((e) => e.id), ['c', 'b', 'a']);
});

test('insertHighScore caps list to limit', () => {
  let list = [];
  for (let i = 0; i < HIGH_SCORE_LIMIT_PER_MODE + 5; i++) {
    list = insertHighScore(
      list,
      createHighScore({ id: `e${i}`, mode: 'classic', score: i, achievedAt: i })
    );
  }
  assert.equal(list.length, HIGH_SCORE_LIMIT_PER_MODE);
  assert.equal(list[0].score, HIGH_SCORE_LIMIT_PER_MODE + 4);
});

test('insertHighScore dedupes by id', () => {
  let list = [];
  list = insertHighScore(list, createHighScore({ id: 'a', mode: 'classic', score: 10 }));
  list = insertHighScore(list, createHighScore({ id: 'a', mode: 'classic', score: 50 }));
  assert.equal(list.length, 1);
  assert.equal(list[0].score, 50);
});

test('insertHighScore skips modes that do not persist (zen)', () => {
  const list = insertHighScore(
    [],
    createHighScore({ id: 'a', mode: 'zen', score: 50 })
  );
  assert.deepEqual(list, []);
});

test('isPersonalBest compares against current top entry', () => {
  const top = createHighScore({ id: 'a', mode: 'classic', score: 100 });
  const better = createHighScore({ id: 'b', mode: 'classic', score: 200 });
  const worse = createHighScore({ id: 'c', mode: 'classic', score: 50 });
  assert.equal(isPersonalBest([], better), true);
  assert.equal(isPersonalBest([top], better), true);
  assert.equal(isPersonalBest([top], worse), false);
});

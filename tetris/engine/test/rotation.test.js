'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JLSTZ_KICKS, I_KICKS, O_KICKS, getKickTable, getKicks } = require('../rotation');

test('JLSTZ table covers all 8 rotation transitions with 5 kicks each', () => {
  const keys = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'];
  for (const k of keys) {
    assert.ok(JLSTZ_KICKS[k], `JLSTZ missing ${k}`);
    assert.equal(JLSTZ_KICKS[k].length, 5);
    assert.deepEqual(JLSTZ_KICKS[k][0], [0, 0], `${k} should start with no-op`);
  }
});

test('I table covers all 8 rotation transitions with 5 kicks each', () => {
  const keys = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'];
  for (const k of keys) {
    assert.ok(I_KICKS[k], `I missing ${k}`);
    assert.equal(I_KICKS[k].length, 5);
    assert.deepEqual(I_KICKS[k][0], [0, 0], `${k} should start with no-op`);
  }
});

test('O piece uses identity kicks', () => {
  for (const k of Object.keys(O_KICKS)) {
    assert.deepEqual(O_KICKS[k], [[0, 0]], `O ${k} should be identity`);
  }
});

test('getKickTable routes to correct table by piece type', () => {
  assert.strictEqual(getKickTable('I'), I_KICKS);
  assert.strictEqual(getKickTable('O'), O_KICKS);
  for (const t of ['T', 'S', 'Z', 'J', 'L']) {
    assert.strictEqual(getKickTable(t), JLSTZ_KICKS, `${t} should map to JLSTZ`);
  }
});

test('getKicks returns matching kick list', () => {
  const kicks = getKicks('T', 0, 1);
  assert.equal(kicks.length, 5);
  assert.deepEqual(kicks[0], [0, 0]);
});

test('getKicks throws on unknown transition', () => {
  assert.throws(() => getKicks('T', 0, 7), /No kicks defined/);
});

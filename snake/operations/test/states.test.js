'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STATES,
  STATE_VALUES,
  TRANSITIONS,
  isState,
  canTransition,
  assertTransition,
} = require('../states');

test('STATES exposes the five operational phases plus structural states', () => {
  assert.equal(STATES.LOADING, 'loading');
  assert.equal(STATES.EMPTY, 'empty');
  assert.equal(STATES.ERROR, 'error');
  assert.equal(STATES.RECOVERING, 'recovering');
  assert.equal(STATES.COMPLETED, 'completed');
  for (const required of ['loading', 'empty', 'error', 'recovering', 'completed']) {
    assert.ok(STATE_VALUES.indexOf(required) !== -1, 'missing required state: ' + required);
  }
});

test('isState recognizes only known values', () => {
  assert.equal(isState('empty'), true);
  assert.equal(isState('completed'), true);
  assert.equal(isState('something-else'), false);
  assert.equal(isState(undefined), false);
  assert.equal(isState(42), false);
});

test('booting can only go to loading or error', () => {
  assert.equal(canTransition(STATES.BOOTING, STATES.LOADING), true);
  assert.equal(canTransition(STATES.BOOTING, STATES.ERROR), true);
  assert.equal(canTransition(STATES.BOOTING, STATES.ACTIVE), false);
  assert.equal(canTransition(STATES.BOOTING, STATES.EMPTY), false);
});

test('loading flows to empty on success and error on failure', () => {
  assert.equal(canTransition(STATES.LOADING, STATES.EMPTY), true);
  assert.equal(canTransition(STATES.LOADING, STATES.ERROR), true);
  assert.equal(canTransition(STATES.LOADING, STATES.ACTIVE), false);
});

test('empty can start a game, reload, recover, or fail', () => {
  assert.equal(canTransition(STATES.EMPTY, STATES.ACTIVE), true);
  assert.equal(canTransition(STATES.EMPTY, STATES.LOADING), true);
  assert.equal(canTransition(STATES.EMPTY, STATES.RECOVERING), true);
  assert.equal(canTransition(STATES.EMPTY, STATES.ERROR), true);
  assert.equal(canTransition(STATES.EMPTY, STATES.COMPLETED), false);
});

test('error can recover, retry-load, or reset to empty', () => {
  assert.equal(canTransition(STATES.ERROR, STATES.RECOVERING), true);
  assert.equal(canTransition(STATES.ERROR, STATES.LOADING), true);
  assert.equal(canTransition(STATES.ERROR, STATES.EMPTY), true);
  assert.equal(canTransition(STATES.ERROR, STATES.ACTIVE), false);
});

test('recovering can resume, fall back to empty, or fail', () => {
  assert.equal(canTransition(STATES.RECOVERING, STATES.ACTIVE), true);
  assert.equal(canTransition(STATES.RECOVERING, STATES.EMPTY), true);
  assert.equal(canTransition(STATES.RECOVERING, STATES.ERROR), true);
});

test('completed only flows back through empty or loading', () => {
  assert.equal(canTransition(STATES.COMPLETED, STATES.EMPTY), true);
  assert.equal(canTransition(STATES.COMPLETED, STATES.LOADING), true);
  assert.equal(canTransition(STATES.COMPLETED, STATES.ACTIVE), false);
});

test('assertTransition throws with a readable message', () => {
  assertTransition(STATES.LOADING, STATES.EMPTY);
  assert.throws(
    () => assertTransition(STATES.COMPLETED, STATES.ACTIVE),
    /invalid transition: completed → active/
  );
  assert.throws(() => assertTransition(STATES.EMPTY, 'mystery'), /unknown target state/);
});

test('TRANSITIONS map is frozen so it cannot be mutated at runtime', () => {
  assert.throws(() => {
    TRANSITIONS[STATES.EMPTY] = [];
  });
});

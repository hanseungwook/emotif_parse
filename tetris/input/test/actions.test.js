'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  Actions,
  REPEATABLE_ACTIONS,
  GAMEPLAY_ACTIONS,
  SYSTEM_ACTIONS,
  isRepeatable,
  isGameplay,
  isSystem,
} = require('../actions');

test('Actions enum contains every required arcade action', () => {
  const expected = [
    'MoveLeft', 'MoveRight', 'SoftDrop', 'HardDrop',
    'RotateCW', 'RotateCCW', 'Rotate180', 'Hold',
    'PauseToggle', 'Restart',
  ];
  for (const name of expected) {
    assert.ok(Actions[name], `Actions.${name} should exist`);
    assert.equal(typeof Actions[name], 'string');
  }
});

test('Action constants are frozen to avoid accidental mutation', () => {
  assert.throws(() => { Actions.MoveLeft = 'changed'; }, /./);
});

test('Repeatable set covers movement and soft drop only', () => {
  assert.equal(REPEATABLE_ACTIONS.size, 3);
  assert.ok(REPEATABLE_ACTIONS.has(Actions.MoveLeft));
  assert.ok(REPEATABLE_ACTIONS.has(Actions.MoveRight));
  assert.ok(REPEATABLE_ACTIONS.has(Actions.SoftDrop));
  assert.equal(REPEATABLE_ACTIONS.has(Actions.HardDrop), false);
  assert.equal(REPEATABLE_ACTIONS.has(Actions.RotateCW), false);
});

test('Gameplay set excludes pause and restart', () => {
  assert.equal(GAMEPLAY_ACTIONS.has(Actions.PauseToggle), false);
  assert.equal(GAMEPLAY_ACTIONS.has(Actions.Restart), false);
  assert.ok(GAMEPLAY_ACTIONS.has(Actions.HardDrop));
});

test('System set is exactly pause+restart', () => {
  assert.equal(SYSTEM_ACTIONS.size, 2);
  assert.ok(SYSTEM_ACTIONS.has(Actions.PauseToggle));
  assert.ok(SYSTEM_ACTIONS.has(Actions.Restart));
});

test('predicates match their sets', () => {
  assert.equal(isRepeatable(Actions.MoveLeft), true);
  assert.equal(isRepeatable(Actions.HardDrop), false);
  assert.equal(isGameplay(Actions.Hold), true);
  assert.equal(isGameplay(Actions.PauseToggle), false);
  assert.equal(isSystem(Actions.Restart), true);
  assert.equal(isSystem(Actions.MoveLeft), false);
});

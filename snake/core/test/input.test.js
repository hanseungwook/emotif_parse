'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  directionForKey,
  actionForKey,
  attachKeyboard,
} = require('../input');
const { createEngine } = require('../engine');

test('directionForKey maps arrows and WASD to directions', () => {
  assert.equal(directionForKey('ArrowUp'), 'up');
  assert.equal(directionForKey('ArrowDown'), 'down');
  assert.equal(directionForKey('ArrowLeft'), 'left');
  assert.equal(directionForKey('ArrowRight'), 'right');
  assert.equal(directionForKey('KeyW'), 'up');
  assert.equal(directionForKey('w'), 'up');
  assert.equal(directionForKey('s'), 'down');
  assert.equal(directionForKey('a'), 'left');
  assert.equal(directionForKey('d'), 'right');
  assert.equal(directionForKey('Tab'), null);
});

test('actionForKey maps the expected control keys', () => {
  assert.equal(actionForKey('Space'), 'TOGGLE');
  assert.equal(actionForKey(' '), 'TOGGLE');
  assert.equal(actionForKey('Enter'), 'START');
  assert.equal(actionForKey('KeyP'), 'PAUSE');
  assert.equal(actionForKey('KeyR'), 'RESET');
  assert.equal(actionForKey('Backspace'), null);
});

test('attachKeyboard dispatches direction and start actions through a fake target', () => {
  const engine = createEngine({ width: 8, height: 8 });
  const target = createFakeKeyTarget();
  const detach = attachKeyboard(engine, target);
  target.fire({ code: 'Enter' });
  assert.equal(engine.getState().status, 'playing');
  target.fire({ code: 'ArrowDown' });
  // Pending direction is applied on next tick.
  engine.dispatch({ type: 'TICK' });
  assert.equal(engine.getState().snake.direction, 'down');
  detach();
});

function createFakeKeyTarget() {
  const listeners = new Set();
  return {
    addEventListener(_event, fn) {
      listeners.add(fn);
    },
    removeEventListener(_event, fn) {
      listeners.delete(fn);
    },
    fire(event) {
      const evt = { preventDefault() {}, ...event };
      for (const fn of listeners) fn(evt);
    },
  };
}

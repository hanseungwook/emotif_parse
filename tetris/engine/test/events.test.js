'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../events');

test('on returns unsubscribe function', () => {
  const bus = new EventBus();
  let calls = 0;
  const off = bus.on('x', () => { calls += 1; });
  bus.emit('x');
  off();
  bus.emit('x');
  assert.equal(calls, 1);
});

test('off removes a specific handler', () => {
  const bus = new EventBus();
  let a = 0, b = 0;
  const hA = () => { a += 1; };
  const hB = () => { b += 1; };
  bus.on('e', hA);
  bus.on('e', hB);
  bus.off('e', hA);
  bus.emit('e');
  assert.equal(a, 0);
  assert.equal(b, 1);
});

test('rejects non-function handlers', () => {
  const bus = new EventBus();
  assert.throws(() => bus.on('x', null), /handler/);
});

test('listener errors are swallowed (don\'t affect siblings)', () => {
  const bus = new EventBus();
  let reached = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { reached = true; });
  assert.doesNotThrow(() => bus.emit('x'));
  assert.equal(reached, true);
});

test('listenerCount reports current set size', () => {
  const bus = new EventBus();
  bus.on('a', () => {});
  bus.on('a', () => {});
  assert.equal(bus.listenerCount('a'), 2);
  assert.equal(bus.listenerCount('missing'), 0);
});

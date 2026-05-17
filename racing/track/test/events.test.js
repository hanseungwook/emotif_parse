'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventBus } = require('../events');

test('on/emit dispatches to registered handlers', () => {
  const bus = new EventBus();
  let received = null;
  bus.on('ping', (p) => { received = p; });
  bus.emit('ping', { v: 1 });
  assert.deepEqual(received, { v: 1 });
});

test('returned unsubscribe stops further events', () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on('x', () => { n++; });
  bus.emit('x');
  off();
  bus.emit('x');
  assert.equal(n, 1);
});

test('emit returns false with no listeners', () => {
  const bus = new EventBus();
  assert.equal(bus.emit('none'), false);
});

test('listener errors are swallowed', () => {
  const bus = new EventBus();
  bus.on('x', () => { throw new Error('boom'); });
  let called = false;
  bus.on('x', () => { called = true; });
  bus.emit('x');
  assert.equal(called, true);
});

test('off removes a specific handler', () => {
  const bus = new EventBus();
  let n = 0;
  const handler = () => { n++; };
  bus.on('x', handler);
  bus.off('x', handler);
  bus.emit('x');
  assert.equal(n, 0);
});

test('on rejects non-functions', () => {
  const bus = new EventBus();
  assert.throws(() => bus.on('x', null), /function/);
});

test('clear wipes listeners', () => {
  const bus = new EventBus();
  bus.on('a', () => {});
  bus.on('b', () => {});
  bus.clear('a');
  assert.equal(bus.listenerCount('a'), 0);
  assert.equal(bus.listenerCount('b'), 1);
  bus.clear();
  assert.equal(bus.listenerCount('b'), 0);
});

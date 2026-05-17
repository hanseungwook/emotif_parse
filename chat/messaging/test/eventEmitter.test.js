'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('../eventEmitter');

test('emits to registered listeners', () => {
  const ee = new EventEmitter();
  const received = [];
  ee.on('hello', (a, b) => received.push([a, b]));
  ee.emit('hello', 1, 2);
  ee.emit('hello', 3, 4);
  assert.deepEqual(received, [[1, 2], [3, 4]]);
});

test('off removes listener and returns true', () => {
  const ee = new EventEmitter();
  const fn = () => { throw new Error('should not fire'); };
  ee.on('e', fn);
  assert.equal(ee.off('e', fn), true);
  ee.emit('e');
});

test('on returns an unsubscribe function', () => {
  const ee = new EventEmitter();
  let called = 0;
  const off = ee.on('x', () => { called += 1; });
  ee.emit('x');
  off();
  ee.emit('x');
  assert.equal(called, 1);
});

test('once fires exactly once', () => {
  const ee = new EventEmitter();
  let count = 0;
  ee.once('y', () => { count += 1; });
  ee.emit('y');
  ee.emit('y');
  assert.equal(count, 1);
});

test('listener errors are surfaced via "error" event', () => {
  const ee = new EventEmitter();
  const errs = [];
  ee.on('error', (err) => errs.push(err));
  ee.on('boom', () => { throw new Error('listener fail'); });
  ee.emit('boom');
  assert.equal(errs.length, 1);
  assert.equal(errs[0].message, 'listener fail');
});

test('listenerCount and removeAllListeners', () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('a', () => {});
  ee.on('b', () => {});
  assert.equal(ee.listenerCount('a'), 2);
  ee.removeAllListeners('a');
  assert.equal(ee.listenerCount('a'), 0);
  assert.equal(ee.listenerCount('b'), 1);
  ee.removeAllListeners();
  assert.equal(ee.listenerCount('b'), 0);
});

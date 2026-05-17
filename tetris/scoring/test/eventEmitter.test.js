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

test('listener errors surface via "error" event', () => {
  const ee = new EventEmitter();
  const errs = [];
  ee.on('error', (err) => errs.push(err));
  ee.on('boom', () => { throw new Error('boom!'); });
  ee.emit('boom');
  assert.equal(errs.length, 1);
  assert.equal(errs[0].message, 'boom!');
});

test('removeAllListeners clears handlers', () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('b', () => {});
  ee.removeAllListeners();
  assert.equal(ee.listenerCount('a'), 0);
  assert.equal(ee.listenerCount('b'), 0);
});

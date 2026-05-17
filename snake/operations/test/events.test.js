'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('../events');

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
  let calls = 0;
  const off = ee.on('x', () => { calls += 1; });
  ee.emit('x');
  off();
  ee.emit('x');
  assert.equal(calls, 1);
});

test('once fires exactly once', () => {
  const ee = new EventEmitter();
  let calls = 0;
  ee.once('y', () => { calls += 1; });
  ee.emit('y');
  ee.emit('y');
  assert.equal(calls, 1);
});

test('listener errors surface on "error" without breaking other listeners', () => {
  const ee = new EventEmitter();
  const seen = [];
  ee.on('error', (e) => seen.push(e.message));
  ee.on('boom', () => { throw new Error('listener fail'); });
  ee.on('boom', () => seen.push('still ran'));
  ee.emit('boom');
  assert.ok(seen.indexOf('listener fail') !== -1);
  assert.ok(seen.indexOf('still ran') !== -1);
});

test('listenerCount and removeAllListeners', () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('a', () => {});
  ee.on('b', () => {});
  assert.equal(ee.listenerCount('a'), 2);
  ee.removeAllListeners('a');
  assert.equal(ee.listenerCount('a'), 0);
  ee.removeAllListeners();
  assert.equal(ee.listenerCount('b'), 0);
});

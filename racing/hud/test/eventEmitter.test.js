'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('../eventEmitter');

test('on/emit dispatches handlers in order', () => {
  const ee = new EventEmitter();
  const seen = [];
  ee.on('hit', (n) => seen.push('a:' + n));
  ee.on('hit', (n) => seen.push('b:' + n));
  ee.emit('hit', 1);
  assert.deepEqual(seen, ['a:1', 'b:1']);
});

test('on returns an unsubscribe function', () => {
  const ee = new EventEmitter();
  const seen = [];
  const off = ee.on('hit', (n) => seen.push(n));
  ee.emit('hit', 1);
  off();
  ee.emit('hit', 2);
  assert.deepEqual(seen, [1]);
});

test('once fires only the first time', () => {
  const ee = new EventEmitter();
  let n = 0;
  ee.once('go', () => { n++; });
  ee.emit('go');
  ee.emit('go');
  assert.equal(n, 1);
});

test('emit returns false when no listeners', () => {
  const ee = new EventEmitter();
  assert.equal(ee.emit('nope'), false);
  ee.on('nope', () => {});
  assert.equal(ee.emit('nope'), true);
});

test('on rejects non-function handlers', () => {
  const ee = new EventEmitter();
  assert.throws(() => ee.on('go', 'notfn'), /handler must be a function/);
});

test('handler errors do not break subsequent listeners', () => {
  const ee = new EventEmitter();
  const errors = [];
  ee.on('error', (err) => errors.push(err));
  let ok = false;
  ee.on('go', () => { throw new Error('boom'); });
  ee.on('go', () => { ok = true; });
  ee.emit('go');
  assert.equal(ok, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'boom');
});

test('listenerCount and removeAllListeners', () => {
  const ee = new EventEmitter();
  ee.on('a', () => {});
  ee.on('a', () => {});
  ee.on('b', () => {});
  assert.equal(ee.listenerCount('a'), 2);
  assert.equal(ee.listenerCount('b'), 1);
  ee.removeAllListeners('a');
  assert.equal(ee.listenerCount('a'), 0);
  ee.removeAllListeners();
  assert.equal(ee.listenerCount('b'), 0);
});

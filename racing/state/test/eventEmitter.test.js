'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { EventEmitter } = require('../eventEmitter');

test('on/emit invokes handlers in registration order', () => {
  const e = new EventEmitter();
  const log = [];
  e.on('hi', () => log.push('a'));
  e.on('hi', () => log.push('b'));
  e.emit('hi', null);
  assert.deepEqual(log, ['a', 'b']);
});

test('on returns an unsubscribe function', () => {
  const e = new EventEmitter();
  let count = 0;
  const off = e.on('x', () => { count += 1; });
  e.emit('x');
  off();
  e.emit('x');
  assert.equal(count, 1);
});

test('once handlers fire exactly once', () => {
  const e = new EventEmitter();
  let count = 0;
  e.once('x', () => { count += 1; });
  e.emit('x');
  e.emit('x');
  assert.equal(count, 1);
});

test('off removes handler and reports success', () => {
  const e = new EventEmitter();
  const h = () => {};
  e.on('x', h);
  assert.equal(e.off('x', h), true);
  assert.equal(e.off('x', h), false);
});

test('handler errors are funnelled to the error event', () => {
  const e = new EventEmitter();
  const errors = [];
  e.on('error', (err) => errors.push(err.message));
  e.on('x', () => { throw new Error('boom'); });
  e.emit('x');
  assert.deepEqual(errors, ['boom']);
});

test('listenerCount and removeAllListeners', () => {
  const e = new EventEmitter();
  e.on('x', () => {});
  e.on('x', () => {});
  e.on('y', () => {});
  assert.equal(e.listenerCount('x'), 2);
  e.removeAllListeners('x');
  assert.equal(e.listenerCount('x'), 0);
  assert.equal(e.listenerCount('y'), 1);
  e.removeAllListeners();
  assert.equal(e.listenerCount('y'), 0);
});

test('on rejects non-function handlers', () => {
  const e = new EventEmitter();
  assert.throws(() => e.on('x', 'not a function'), TypeError);
});

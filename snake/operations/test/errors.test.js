'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OperationsError,
  SkinLoadError,
  ObstacleGenerationError,
  SnapshotCorruptError,
  RecoveryFailedError,
  InvalidStateError,
  serializeError,
} = require('../errors');

test('OperationsError captures code and message', () => {
  const err = new OperationsError('boom', 'X');
  assert.equal(err.name, 'OperationsError');
  assert.equal(err.code, 'X');
  assert.equal(err.message, 'boom');
  assert.equal(err.recoverable, true);
});

test('SkinLoadError defaults to recoverable=true with a stable code', () => {
  const err = new SkinLoadError();
  assert.equal(err.name, 'SkinLoadError');
  assert.equal(err.code, 'SKIN_LOAD_FAILED');
  assert.equal(err.recoverable, true);
});

test('SnapshotCorruptError defaults to recoverable=false', () => {
  const err = new SnapshotCorruptError();
  assert.equal(err.recoverable, false);
  assert.equal(err.code, 'SNAPSHOT_CORRUPT');
});

test('ObstacleGenerationError accepts cause and details', () => {
  const cause = new Error('rng exhausted');
  const err = new ObstacleGenerationError('nope', { cause, details: { density: 2 } });
  assert.equal(err.cause, cause);
  assert.deepEqual(err.details, { density: 2 });
});

test('RecoveryFailedError + InvalidStateError carry their codes', () => {
  assert.equal(new RecoveryFailedError().code, 'RECOVERY_FAILED');
  assert.equal(new InvalidStateError().code, 'INVALID_STATE');
  assert.equal(new InvalidStateError().recoverable, false);
});

test('serializeError yields a JSON-stable payload', () => {
  const err = new SkinLoadError('missing');
  const json = serializeError(err);
  assert.deepEqual(json, {
    name: 'SkinLoadError',
    code: 'SKIN_LOAD_FAILED',
    message: 'missing',
    recoverable: true,
  });
  assert.equal(serializeError(null), null);
});

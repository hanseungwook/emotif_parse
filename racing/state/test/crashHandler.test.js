'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CrashHandler } = require('../crashHandler');
const { CRASH_SEVERITY } = require('../constants');
const { ValidationError } = require('../errors');

test('default crash uses major multiplier on respawn delay', () => {
  const c = new CrashHandler({ respawnDelayMs: 2000 });
  const info = c.registerCrash({});
  assert.equal(info.severity, CRASH_SEVERITY.MAJOR);
  assert.equal(info.delayMs, 2000);
  assert.equal(c.remainingMs, 2000);
  assert.equal(c.totalCrashes, 1);
  assert.equal(c.isActive, true);
});

test('minor crash uses half the base delay', () => {
  const c = new CrashHandler({ respawnDelayMs: 2000 });
  const info = c.registerCrash({ severity: CRASH_SEVERITY.MINOR });
  assert.equal(info.delayMs, 1000);
});

test('total crash uses 1.75x multiplier', () => {
  const c = new CrashHandler({ respawnDelayMs: 2000 });
  const info = c.registerCrash({ severity: CRASH_SEVERITY.TOTAL });
  assert.equal(info.delayMs, 3500);
});

test('explicit delayMs overrides the multiplier', () => {
  const c = new CrashHandler({ respawnDelayMs: 2000 });
  const info = c.registerCrash({ delayMs: 500 });
  assert.equal(info.delayMs, 500);
});

test('advance drains the respawn timer and signals completion', () => {
  const c = new CrashHandler({ respawnDelayMs: 1000 });
  c.registerCrash({});
  assert.equal(c.advance(400), false);
  assert.equal(c.remainingMs, 600);
  assert.equal(c.advance(600), true);
  assert.equal(c.isActive, false);
  assert.equal(c.advance(100), false);
});

test('completeNow short-circuits the timer', () => {
  const c = new CrashHandler({ respawnDelayMs: 5000 });
  c.registerCrash({});
  assert.equal(c.completeNow(), true);
  assert.equal(c.remainingMs, 0);
  assert.equal(c.isActive, false);
  assert.equal(c.completeNow(), false);
});

test('crash count accumulates across resets', () => {
  const c = new CrashHandler({ respawnDelayMs: 1000 });
  c.registerCrash({});
  c.advance(2000);
  c.registerCrash({ severity: CRASH_SEVERITY.MINOR });
  assert.equal(c.totalCrashes, 2);
  c.reset();
  assert.equal(c.totalCrashes, 0);
});

test('snapshot reports current respawn metadata', () => {
  const c = new CrashHandler({ respawnDelayMs: 1500 });
  c.registerCrash({
    severity: CRASH_SEVERITY.MAJOR,
    cause: 'wall',
    atMs: 12345,
    respawnCheckpoint: 2,
  });
  const snap = c.snapshot();
  assert.equal(snap.active, true);
  assert.equal(snap.severity, CRASH_SEVERITY.MAJOR);
  assert.equal(snap.remainingMs, 1500);
  assert.equal(snap.totalCrashes, 1);
  assert.equal(snap.lastRespawnCheckpoint, 2);
  assert.equal(snap.cause, 'wall');
  assert.equal(snap.lastCrashAtMs, 12345);
});

test('invalid configuration is rejected', () => {
  assert.throws(() => new CrashHandler({ respawnDelayMs: -1 }), ValidationError);
  assert.throws(() => new CrashHandler({ respawnDelayMs: Number.NaN }), ValidationError);
});

test('invalid crash inputs are rejected', () => {
  const c = new CrashHandler({ respawnDelayMs: 1000 });
  assert.throws(() => c.registerCrash({ severity: 'fender-bender' }), ValidationError);
  assert.throws(() => c.registerCrash({ delayMs: -10 }), ValidationError);
  assert.throws(() => c.advance(-1), ValidationError);
});

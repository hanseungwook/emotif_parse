'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Countdown } = require('../countdown');
const { ValidationError } = require('../errors');

test('default countdown announces 3, 2, 1, GO on a 1s cadence', () => {
  const c = new Countdown();
  assert.equal(c.totalDurationMs, 3000);

  const opening = c.advance(0);
  assert.deepEqual(opening, { kind: 'beat', value: 3, remaining: 3 });

  assert.equal(c.advance(500), null, 'no beat at mid-step');
  const second = c.advance(500);
  assert.deepEqual(second, { kind: 'beat', value: 2, remaining: 2 });

  const third = c.advance(1000);
  assert.deepEqual(third, { kind: 'beat', value: 1, remaining: 1 });

  const go = c.advance(1000);
  assert.equal(go.kind, 'go');
  assert.equal(go.value, 0);
  assert.ok(c.isComplete);
});

test('countdown with steps=0 emits GO immediately on first advance', () => {
  const c = new Countdown({ steps: 0 });
  assert.equal(c.totalDurationMs, 0);
  const go = c.advance(0);
  assert.equal(go.kind, 'go');
  assert.ok(c.isComplete);
});

test('countdown stepMs is configurable', () => {
  const c = new Countdown({ steps: 2, stepMs: 250 });
  assert.equal(c.totalDurationMs, 500);
  assert.deepEqual(c.advance(0), { kind: 'beat', value: 2, remaining: 2 });
  assert.equal(c.advance(249), null);
  assert.deepEqual(c.advance(1), { kind: 'beat', value: 1, remaining: 1 });
  assert.equal(c.advance(250).kind, 'go');
});

test('countdown reset() restores the initial state', () => {
  const c = new Countdown({ steps: 2, stepMs: 100 });
  c.advance(0); // beat=2
  c.advance(100); // beat=1
  c.reset();
  assert.equal(c.elapsedMs, 0);
  assert.equal(c.currentBeat, 2);
  assert.equal(c.isComplete, false);
  assert.deepEqual(c.advance(0), { kind: 'beat', value: 2, remaining: 2 });
});

test('countdown rejects invalid options', () => {
  assert.throws(() => new Countdown({ steps: -1 }), ValidationError);
  assert.throws(() => new Countdown({ steps: 1.5 }), ValidationError);
  assert.throws(() => new Countdown({ stepMs: 0 }), ValidationError);
  assert.throws(() => new Countdown({ stepMs: -10 }), ValidationError);
});

test('countdown rejects invalid dtMs', () => {
  const c = new Countdown();
  assert.throws(() => c.advance(-1), ValidationError);
  assert.throws(() => c.advance(Number.NaN), ValidationError);
});

test('countdown returns null once complete', () => {
  const c = new Countdown({ steps: 1, stepMs: 100 });
  c.advance(0); // opening beat
  const go = c.advance(150);
  assert.equal(go.kind, 'go');
  assert.equal(c.advance(50), null);
});

test('peekInitialBeat returns the opening beat without consuming time', () => {
  const c = new Countdown({ steps: 3, stepMs: 1000 });
  const first = c.peekInitialBeat();
  assert.deepEqual(first, { kind: 'beat', value: 3, remaining: 3 });
  // Subsequent peek returns null because the beat was already announced.
  assert.equal(c.peekInitialBeat(), null);
  // Advancing by a sub-step duration should not emit a new beat.
  assert.equal(c.advance(500), null);
});

test('snapshot reports elapsed and current beat', () => {
  const c = new Countdown({ steps: 3, stepMs: 1000 });
  c.advance(0);
  c.advance(1000);
  const snap = c.snapshot();
  assert.equal(snap.steps, 3);
  assert.equal(snap.stepMs, 1000);
  assert.equal(snap.totalDurationMs, 3000);
  assert.equal(snap.currentBeat, 2);
  assert.equal(snap.complete, false);
});

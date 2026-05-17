'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRacingEngine, PHASE, DRIFT_STATE, EVENTS, VEHICLE, BOOST } = require('../index');

function newEngine(opts) {
  const e = createRacingEngine(opts);
  e.start();
  return e;
}

function tick(engine, ms, frames) {
  const f = frames || 1;
  const stepMs = ms / f;
  for (let i = 0; i < f; i++) engine.tick(stepMs);
}

test('engine starts in READY and transitions to RACING', () => {
  const e = createRacingEngine();
  assert.equal(e.phase, PHASE.READY);
  e.start();
  assert.equal(e.phase, PHASE.RACING);
});

test('start is idempotent while racing', () => {
  const e = newEngine();
  assert.equal(e.start(), false);
  assert.equal(e.phase, PHASE.RACING);
});

test('start emits a start event with snapshot', () => {
  const e = createRacingEngine();
  let received = null;
  e.on(EVENTS.START, (snap) => { received = snap; });
  e.start();
  assert.ok(received, 'start handler was called');
  assert.equal(received.phase, PHASE.RACING);
});

test('tick does nothing before start', () => {
  const e = createRacingEngine();
  let count = 0;
  e.on(EVENTS.TICK, () => count++);
  e.tick(16);
  assert.equal(count, 0);
});

test('throttle drives the car forward', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  tick(e, 1000, 60);
  const snap = e.snapshot();
  assert.ok(snap.vehicle.forwardSpeed > 5, `speed=${snap.vehicle.forwardSpeed}`);
  assert.ok(snap.vehicle.x > 0, `x=${snap.vehicle.x}`);
});

test('steering at speed turns the car', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  tick(e, 1000, 60);
  e.setInputs({ throttle: 1, steer: 1 });
  tick(e, 1000, 60);
  const snap = e.snapshot();
  assert.ok(Math.abs(snap.vehicle.heading) > 0.1, `heading=${snap.vehicle.heading}`);
});

test('handbrake at speed enters DRIFTING and emits driftStart', () => {
  const e = newEngine();
  let started = 0;
  e.on(EVENTS.DRIFT_START, () => started++);
  e.setInputs({ throttle: 1 });
  tick(e, 2000, 120);
  e.setInputs({ throttle: 1, steer: 0.8, handbrake: true });
  tick(e, 200, 12);
  assert.equal(e.isDrifting, true);
  assert.equal(started, 1);
});

test('releasing the handbrake mid-drift transitions to recovery then grip', () => {
  const e = newEngine();
  let ended = 0;
  e.on(EVENTS.DRIFT_END, () => ended++);
  e.setInputs({ throttle: 1 });
  tick(e, 2000, 120);
  e.setInputs({ throttle: 1, steer: 0.8, handbrake: true });
  tick(e, 300, 18);
  e.setInputs({ throttle: 1, steer: 0 });
  tick(e, 2500, 150);
  assert.equal(ended, 1);
  assert.notEqual(e.snapshot().drift.state, DRIFT_STATE.DRIFTING);
});

test('drifting at the sweet spot fills the boost meter', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  tick(e, 2000, 120);
  e.setInputs({ throttle: 1, steer: 1, handbrake: true });
  tick(e, 4000, 240);
  const snap = e.snapshot();
  assert.ok(snap.boost.charge > 25, `charge=${snap.boost.charge}`);
});

test('boost activation lifts forward speed past the normal top speed', () => {
  const e = newEngine({ initialBoost: { charge: BOOST.maxCharge } });
  e.start();
  e.setInputs({ throttle: 1 });
  tick(e, 10000, 600);
  const beforeSpeed = e.snapshot().vehicle.forwardSpeed;
  // The car should be near the normal cap.
  assert.ok(beforeSpeed > VEHICLE.topSpeed * 0.9, `pre-boost speed=${beforeSpeed}`);
  e.setInputs({ throttle: 1, boost: true });
  tick(e, 2000, 120);
  const after = e.snapshot();
  assert.equal(after.boost.active, true);
  assert.ok(after.vehicle.forwardSpeed > VEHICLE.topSpeed, `post-boost speed=${after.vehicle.forwardSpeed}`);
});

test('boost meter drains while active and locks out on empty', () => {
  const e = newEngine({ initialBoost: { charge: BOOST.minActivationCharge + 5 } });
  e.start();
  let endedEmpty = false;
  e.on(EVENTS.BOOST_END, (evt) => { if (evt.reason === 'empty') endedEmpty = true; });
  e.setInputs({ throttle: 1, boost: true });
  tick(e, 4000, 240);
  const snap = e.snapshot();
  assert.equal(snap.boost.active, false);
  assert.equal(snap.boost.charge, 0);
  assert.equal(endedEmpty, true);
});

test('boostFull fires once when meter tops out', () => {
  const e = newEngine({ initialBoost: { charge: BOOST.maxCharge - 5 } });
  e.start();
  let fullCount = 0;
  e.on(EVENTS.BOOST_FULL, () => fullCount++);
  e.setInputs({ throttle: 1 });
  tick(e, 1000, 60);
  e.setInputs({ throttle: 1, steer: 1, handbrake: true });
  tick(e, 3000, 180);
  assert.ok(fullCount >= 1, `fullCount=${fullCount}`);
});

test('crash freezes the car and emits a crash event', () => {
  const e = newEngine();
  let crashed = null;
  e.on(EVENTS.CRASH, (evt) => { crashed = evt; });
  e.setInputs({ throttle: 1 });
  tick(e, 1000, 60);
  e.crash('wall');
  assert.equal(e.phase, PHASE.CRASHED);
  assert.ok(crashed && crashed.reason === 'wall');
  // Crashed car should ignore subsequent ticks.
  const beforeX = e.snapshot().vehicle.x;
  e.setInputs({ throttle: 1 });
  tick(e, 1000, 60);
  assert.equal(e.snapshot().vehicle.x, beforeX);
});

test('tick payload exposes vehicle, drift, boost, inputs, tuning', () => {
  const e = newEngine();
  let payload = null;
  e.on(EVENTS.TICK, (p) => { payload = p; });
  e.setInputs({ throttle: 1 });
  tick(e, 100, 6);
  assert.ok(payload);
  assert.ok(payload.vehicle && typeof payload.vehicle.forwardSpeed === 'number');
  assert.ok(payload.drift && typeof payload.drift.state === 'string');
  assert.ok(payload.boost && typeof payload.boost.charge === 'number');
  assert.ok(payload.inputs && payload.tuning);
});

test('large dt is split into safe sub-steps without losing motion', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  // One giant tick — should sub-step internally rather than diverging.
  e.tick(500);
  const snap = e.snapshot();
  assert.ok(Number.isFinite(snap.vehicle.forwardSpeed));
  assert.ok(snap.vehicle.forwardSpeed > 0);
  assert.ok(snap.vehicle.forwardSpeed <= VEHICLE.topSpeed + 0.001);
});

test('invalid inputs are normalized', () => {
  const e = newEngine();
  e.setInputs({ throttle: 999, brake: -3, steer: 'left' });
  tick(e, 100);
  // Should not throw and forwardSpeed should still be finite and non-negative.
  const snap = e.snapshot();
  assert.ok(Number.isFinite(snap.vehicle.forwardSpeed));
  assert.ok(snap.vehicle.forwardSpeed >= 0);
});

test('cornering at speed without handbrake still tracks heading (grippy)', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  tick(e, 1500, 90);
  e.setInputs({ throttle: 1, steer: 0.6 });
  tick(e, 2000, 120);
  const snap = e.snapshot();
  // Slip angle should remain modest in pure grip cornering.
  assert.ok(Math.abs(snap.vehicle.slipAngle) < 0.4, `slipAngle=${snap.vehicle.slipAngle}`);
  assert.ok(snap.vehicle.forwardSpeed > 5);
});

test('snapshot is independent — mutating inputs does not affect prior snapshot', () => {
  const e = newEngine();
  e.setInputs({ throttle: 1 });
  tick(e, 100);
  const before = e.snapshot();
  before.inputs.throttle = 0;
  e.setInputs({ throttle: 1 });
  tick(e, 100);
  const after = e.snapshot();
  assert.equal(after.inputs.throttle, 1);
});

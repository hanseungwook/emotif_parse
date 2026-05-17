'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const drift = require('../drift');
const { createVehicleState } = require('../vehicle');
const { DRIFT_STATE, VEHICLE } = require('../constants');

const initial = () => ({ state: DRIFT_STATE.GRIP, elapsedMs: 0, drifting: false });

test('shouldEnterDrift requires handbrake and minimum speed', () => {
  const fast = createVehicleState({ forwardSpeed: 20 });
  const slow = createVehicleState({ forwardSpeed: 2 });
  assert.equal(drift.shouldEnterDrift(fast, { handbrake: false }), false);
  assert.equal(drift.shouldEnterDrift(fast, { handbrake: true }), true);
  assert.equal(drift.shouldEnterDrift(slow, { handbrake: true }), false);
});

test('GRIP → DRIFTING when handbrake engaged at speed', () => {
  const state = createVehicleState({ forwardSpeed: 20 });
  const next = drift.advanceState(initial(), state, { handbrake: true }, 16);
  assert.equal(next.state, DRIFT_STATE.DRIFTING);
  assert.equal(next.elapsedMs, 0);
});

test('DRIFTING → RECOVERY when handbrake released', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 5 });
  const drifting = { state: DRIFT_STATE.DRIFTING, elapsedMs: 400, drifting: true };
  const next = drift.advanceState(drifting, state, { handbrake: false }, 16);
  assert.equal(next.state, DRIFT_STATE.RECOVERY);
});

test('DRIFTING bails out if speed collapses', () => {
  const state = createVehicleState({ forwardSpeed: 1, lateralSpeed: 5 });
  const drifting = { state: DRIFT_STATE.DRIFTING, elapsedMs: 400, drifting: true };
  const next = drift.advanceState(drifting, state, { handbrake: true }, 16);
  assert.equal(next.state, DRIFT_STATE.RECOVERY);
});

test('RECOVERY → GRIP after lateral velocity settles', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 0.1 });
  const recovering = { state: DRIFT_STATE.RECOVERY, elapsedMs: 200, drifting: false };
  const next = drift.advanceState(recovering, state, { handbrake: false }, 16);
  assert.equal(next.state, DRIFT_STATE.GRIP);
});

test('RECOVERY holds while still sliding hard', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 10 });
  const recovering = { state: DRIFT_STATE.RECOVERY, elapsedMs: 300, drifting: false };
  const next = drift.advanceState(recovering, state, { handbrake: false }, 16);
  assert.equal(next.state, DRIFT_STATE.RECOVERY);
});

test('RECOVERY can be re-entered into DRIFTING by tapping handbrake', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 6 });
  const recovering = { state: DRIFT_STATE.RECOVERY, elapsedMs: 100, drifting: false };
  const next = drift.advanceState(recovering, state, { handbrake: true }, 16);
  assert.equal(next.state, DRIFT_STATE.DRIFTING);
});

test('RECOVERY falls back to GRIP after the safety timeout', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 12 });
  const recovering = { state: DRIFT_STATE.RECOVERY, elapsedMs: 950, drifting: false };
  const next = drift.advanceState(recovering, state, { handbrake: false }, 16);
  assert.equal(next.state, DRIFT_STATE.GRIP);
});

test('applyLateral with high grip pulls lateral velocity toward zero quickly', () => {
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 8 });
  for (let i = 0; i < 30; i++) {
    drift.applyLateral(state, DRIFT_STATE.GRIP, 1 / 60);
  }
  assert.ok(Math.abs(state.lateralSpeed) < 4, `lateralSpeed=${state.lateralSpeed}`);
});

test('applyLateral during DRIFTING preserves more slide than GRIP', () => {
  const a = createVehicleState({ forwardSpeed: 20, lateralSpeed: 8, yawRate: 1.5 });
  const b = createVehicleState({ forwardSpeed: 20, lateralSpeed: 8, yawRate: 1.5 });
  for (let i = 0; i < 30; i++) {
    drift.applyLateral(a, DRIFT_STATE.GRIP, 1 / 60);
    drift.applyLateral(b, DRIFT_STATE.DRIFTING, 1 / 60);
  }
  assert.ok(Math.abs(b.lateralSpeed) > Math.abs(a.lateralSpeed), `grip=${a.lateralSpeed} drift=${b.lateralSpeed}`);
});

test('applyLateral generates lateral velocity when yawing at speed with low grip', () => {
  // Heading is rotating but velocity in body frame is forward — low grip means
  // the velocity vector lags behind, building lateral speed.
  const state = createVehicleState({ forwardSpeed: 20, lateralSpeed: 0, yawRate: 2 });
  drift.applyLateral(state, DRIFT_STATE.DRIFTING, 0.1);
  assert.ok(Math.abs(state.lateralSpeed) > 0.5, `lateralSpeed=${state.lateralSpeed}`);
});

test('applyLateral clamps to maxLateralSpeed', () => {
  const state = createVehicleState({ forwardSpeed: 60, lateralSpeed: 30, yawRate: 5 });
  drift.applyLateral(state, DRIFT_STATE.DRIFTING, 0.5);
  assert.ok(Math.abs(state.lateralSpeed) <= VEHICLE.maxLateralSpeed + 1e-6);
});

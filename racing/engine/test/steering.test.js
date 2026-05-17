'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const steering = require('../steering');
const { createVehicleState } = require('../vehicle');
const { VEHICLE } = require('../constants');

test('steering authority is zero at a stop', () => {
  assert.equal(steering.steeringAuthority(0), 0);
});

test('steering authority eases in below the low-speed threshold', () => {
  const low = steering.steeringAuthority(VEHICLE.lowSpeedSteerEase * 0.25);
  const mid = steering.steeringAuthority(VEHICLE.lowSpeedSteerEase);
  assert.ok(low < mid, `low=${low} mid=${mid}`);
  assert.ok(mid <= 1.0001);
});

test('steering authority tapers but never collapses at high speed', () => {
  const peak = steering.steeringAuthority(VEHICLE.lowSpeedSteerEase);
  const fast = steering.steeringAuthority(VEHICLE.topSpeed);
  assert.ok(fast < peak, `peak=${peak} fast=${fast}`);
  assert.ok(fast >= 0.35, `fast=${fast} fell below floor`);
});

test('smoothSteerInput approaches target over time', () => {
  let v = 0;
  for (let i = 0; i < 60; i++) {
    v = steering.smoothSteerInput(v, 1, 1 / 60);
  }
  assert.ok(v > 0.9, `smoothed=${v}`);
  assert.ok(v <= 1.0001);
});

test('smoothSteerInput clamps target', () => {
  const v = steering.smoothSteerInput(0, 5, 1);
  assert.ok(v <= 1.0001 && v >= -1.0001);
});

test('applySteering builds yaw rate in the steer direction', () => {
  const s = createVehicleState({ forwardSpeed: 20 });
  for (let i = 0; i < 30; i++) {
    steering.applySteering(s, 1, 1 / 60, false);
  }
  assert.ok(s.yawRate > 0, `yawRate=${s.yawRate}`);
});

test('applySteering reverses yaw direction when driving backwards', () => {
  const fwd = createVehicleState({ forwardSpeed: 20 });
  const rev = createVehicleState({ forwardSpeed: -8 });
  for (let i = 0; i < 30; i++) {
    steering.applySteering(fwd, 1, 1 / 60, false);
    steering.applySteering(rev, 1, 1 / 60, false);
  }
  assert.ok(fwd.yawRate > 0, `fwd=${fwd.yawRate}`);
  assert.ok(rev.yawRate < 0, `rev=${rev.yawRate}`);
});

test('drift boost amplifies yaw rate', () => {
  const a = createVehicleState({ forwardSpeed: 20 });
  const b = createVehicleState({ forwardSpeed: 20 });
  for (let i = 0; i < 60; i++) {
    steering.applySteering(a, 1, 1 / 60, false);
    steering.applySteering(b, 1, 1 / 60, true);
  }
  assert.ok(b.yawRate > a.yawRate, `a=${a.yawRate} b=${b.yawRate}`);
});

test('zero steer input bleeds existing yaw back to zero', () => {
  const s = createVehicleState({ forwardSpeed: 20 });
  s.yawRate = 2;
  for (let i = 0; i < 120; i++) {
    steering.applySteering(s, 0, 1 / 60, false);
  }
  assert.ok(Math.abs(s.yawRate) < 0.05, `yawRate=${s.yawRate}`);
});

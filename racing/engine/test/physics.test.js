'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const physics = require('../physics');
const { createVehicleState } = require('../vehicle');
const { VEHICLE, BOOST } = require('../constants');

function step(state, inputs, dtSec, boostActive) {
  physics.applyLongitudinal(state, inputs, dtSec, boostActive === true);
}

test('throttle accelerates the vehicle forward', () => {
  const s = createVehicleState();
  step(s, { throttle: 1, brake: 0 }, 0.1);
  assert.ok(s.forwardSpeed > 0, `forwardSpeed=${s.forwardSpeed}`);
});

test('zero throttle and zero brake decelerates a moving car', () => {
  const s = createVehicleState({ forwardSpeed: 20 });
  step(s, { throttle: 0, brake: 0 }, 0.1);
  assert.ok(s.forwardSpeed < 20, `forwardSpeed=${s.forwardSpeed}`);
});

test('brake stops a moving car quicker than coasting', () => {
  const coast = createVehicleState({ forwardSpeed: 20 });
  const brake = createVehicleState({ forwardSpeed: 20 });
  for (let i = 0; i < 20; i++) {
    step(coast, { throttle: 0, brake: 0 }, 1 / 60);
    step(brake, { throttle: 0, brake: 1 }, 1 / 60);
  }
  assert.ok(brake.forwardSpeed < coast.forwardSpeed, `brake=${brake.forwardSpeed} coast=${coast.forwardSpeed}`);
});

test('top speed is enforced under continuous full throttle', () => {
  const s = createVehicleState();
  for (let i = 0; i < 600; i++) {
    step(s, { throttle: 1, brake: 0 }, 1 / 60);
  }
  assert.ok(s.forwardSpeed <= VEHICLE.topSpeed + 0.001, `forwardSpeed=${s.forwardSpeed}`);
  // should approach near top speed
  assert.ok(s.forwardSpeed > VEHICLE.topSpeed * 0.9, `forwardSpeed=${s.forwardSpeed} too far from cap`);
});

test('boost lifts the top speed cap while active', () => {
  const s = createVehicleState({ forwardSpeed: VEHICLE.topSpeed });
  for (let i = 0; i < 240; i++) {
    step(s, { throttle: 1, brake: 0 }, 1 / 60, true);
  }
  assert.ok(s.forwardSpeed > VEHICLE.topSpeed * 1.05, `forwardSpeed=${s.forwardSpeed}`);
  assert.ok(s.forwardSpeed <= VEHICLE.topSpeed * BOOST.topSpeedMultiplier + 0.001);
});

test('boost increases acceleration force at the same speed', () => {
  const a = createVehicleState({ forwardSpeed: 15 });
  const b = createVehicleState({ forwardSpeed: 15 });
  step(a, { throttle: 1, brake: 0 }, 0.1, false);
  step(b, { throttle: 1, brake: 0 }, 0.1, true);
  assert.ok(b.forwardSpeed > a.forwardSpeed, `b=${b.forwardSpeed} a=${a.forwardSpeed}`);
});

test('reverse from a stop accelerates backwards', () => {
  const s = createVehicleState();
  for (let i = 0; i < 30; i++) {
    step(s, { throttle: 1, brake: 0, reverse: true }, 1 / 60);
  }
  assert.ok(s.forwardSpeed < 0, `forwardSpeed=${s.forwardSpeed}`);
  assert.ok(s.forwardSpeed >= -VEHICLE.reverseTopSpeed - 0.001);
});

test('reverse engaged while moving forward acts as a brake', () => {
  const s = createVehicleState({ forwardSpeed: 20 });
  const before = s.forwardSpeed;
  step(s, { throttle: 1, brake: 0, reverse: true }, 0.1);
  assert.ok(s.forwardSpeed < before, `forwardSpeed=${s.forwardSpeed}`);
  assert.ok(s.forwardSpeed > 0, 'should not snap negative at speed');
});

test('drag scales with speed^2 — high-speed deceleration > low-speed', () => {
  const slow = physics.passiveDeceleration(5);
  const fast = physics.passiveDeceleration(50);
  assert.ok(fast > slow * 3, `slow=${slow} fast=${fast}`);
});

test('engine power tapers near top speed', () => {
  const low = physics.enginePowerAtSpeed(VEHICLE.topSpeed * 0.1, false);
  const mid = physics.enginePowerAtSpeed(VEHICLE.topSpeed * 0.5, false);
  const high = physics.enginePowerAtSpeed(VEHICLE.topSpeed * 0.95, false);
  assert.ok(low >= mid, `low=${low} mid=${mid}`);
  assert.ok(mid > high, `mid=${mid} high=${high}`);
  assert.ok(high < low * 0.5, `expected sharp falloff: low=${low} high=${high}`);
});

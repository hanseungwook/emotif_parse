'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vehicle = require('../vehicle');

test('createVehicleState produces sane defaults', () => {
  const s = vehicle.createVehicleState();
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
  assert.equal(s.heading, 0);
  assert.equal(s.forwardSpeed, 0);
  assert.equal(s.lateralSpeed, 0);
  assert.equal(s.yawRate, 0);
});

test('createVehicleState honors initial values and wraps heading', () => {
  const s = vehicle.createVehicleState({ x: 5, y: -3, heading: Math.PI * 3, forwardSpeed: 12 });
  assert.equal(s.x, 5);
  assert.equal(s.y, -3);
  // 3π wraps to ±π — wrapAngle returns the canonical (-π, π] form.
  assert.ok(Math.abs(Math.abs(s.heading) - Math.PI) < 1e-9, `heading=${s.heading}`);
  assert.equal(s.forwardSpeed, 12);
});

test('worldVelocity matches forward speed when heading is zero', () => {
  const s = vehicle.createVehicleState({ forwardSpeed: 10 });
  const v = vehicle.worldVelocity(s);
  assert.ok(Math.abs(v.vx - 10) < 1e-9);
  assert.ok(Math.abs(v.vy) < 1e-9);
});

test('worldVelocity rotates with heading', () => {
  const s = vehicle.createVehicleState({ heading: Math.PI / 2, forwardSpeed: 10 });
  const v = vehicle.worldVelocity(s);
  assert.ok(Math.abs(v.vx) < 1e-9);
  assert.ok(Math.abs(v.vy - 10) < 1e-9);
});

test('worldVelocity composes lateral and forward components', () => {
  const s = vehicle.createVehicleState({ heading: 0, forwardSpeed: 6, lateralSpeed: 8 });
  // lateral axis is +y in body frame, so vy should be 8 and vx should be 6
  const v = vehicle.worldVelocity(s);
  assert.ok(Math.abs(v.vx - 6) < 1e-9);
  assert.ok(Math.abs(v.vy - 8) < 1e-9);
  const speed = vehicle.speed(s);
  assert.ok(Math.abs(speed - 10) < 1e-9, `speed=${speed}`);
});

test('slipAngle is zero on a straight, signed during a slide', () => {
  const straight = vehicle.createVehicleState({ forwardSpeed: 12 });
  assert.equal(vehicle.slipAngle(straight), 0);

  const sliding = vehicle.createVehicleState({ forwardSpeed: 10, lateralSpeed: 5 });
  const slip = vehicle.slipAngle(sliding);
  assert.ok(slip > 0 && slip < Math.PI / 2);
});

test('slipAngle is zero when nearly stopped', () => {
  const stopped = vehicle.createVehicleState({ forwardSpeed: 0.01, lateralSpeed: 0.01 });
  assert.equal(vehicle.slipAngle(stopped), 0);
});

test('integratePosition advances along heading', () => {
  const s = vehicle.createVehicleState({ forwardSpeed: 10, heading: 0 });
  vehicle.integratePosition(s, 0.1);
  assert.ok(Math.abs(s.x - 1) < 1e-6, `x=${s.x}`);
  assert.ok(Math.abs(s.y) < 1e-6, `y=${s.y}`);
});

test('integratePosition rotates heading using yawRate', () => {
  const s = vehicle.createVehicleState({ forwardSpeed: 0, yawRate: Math.PI });
  vehicle.integratePosition(s, 0.5);
  // π rad/s * 0.5s = π/2
  assert.ok(Math.abs(s.heading - Math.PI / 2) < 1e-6, `heading=${s.heading}`);
});

test('snapshot exposes derived fields and matches state', () => {
  const s = vehicle.createVehicleState({ forwardSpeed: 6, lateralSpeed: 8, heading: 0 });
  const snap = vehicle.snapshot(s);
  assert.equal(snap.forwardSpeed, 6);
  assert.equal(snap.lateralSpeed, 8);
  assert.ok(Math.abs(snap.speed - 10) < 1e-9);
  assert.ok(snap.slipAngle > 0);
  assert.equal(typeof snap.vx, 'number');
  assert.equal(typeof snap.vy, 'number');
});

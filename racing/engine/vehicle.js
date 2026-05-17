'use strict';

const { VEHICLE, wrapAngle } = require('./constants');

// VehicleState holds the kinematic state in the car's local frame. World-space
// velocity is derived on demand so the physics, drift, and boost modules can
// reason about forward / lateral motion independently — that split is what
// makes arcade drifting feel deliberate instead of accidental.

function createVehicleState(initial) {
  const start = initial || {};
  return {
    // World position.
    x: Number.isFinite(start.x) ? start.x : 0,
    y: Number.isFinite(start.y) ? start.y : 0,
    // Heading angle (radians). 0 == +x.
    heading: Number.isFinite(start.heading) ? wrapAngle(start.heading) : 0,
    // Velocity split in the vehicle's local frame.
    forwardSpeed: Number.isFinite(start.forwardSpeed) ? start.forwardSpeed : 0,
    lateralSpeed: Number.isFinite(start.lateralSpeed) ? start.lateralSpeed : 0,
    // Angular velocity (rad/s) — the steering model normally writes this,
    // but tests and replays need to be able to seed it.
    yawRate: Number.isFinite(start.yawRate) ? start.yawRate : 0,
    // Smoothed steering input so a hard tap doesn't snap the model.
    steerInput: 0,
    // Cached body-frame metadata for downstream modules.
    wheelbase: VEHICLE.wheelbase,
  };
}

// Resolve world-space velocity components from the local-frame split.
function worldVelocity(state) {
  const cos = Math.cos(state.heading);
  const sin = Math.sin(state.heading);
  return {
    vx: state.forwardSpeed * cos - state.lateralSpeed * sin,
    vy: state.forwardSpeed * sin + state.lateralSpeed * cos,
  };
}

function speed(state) {
  const f = state.forwardSpeed;
  const l = state.lateralSpeed;
  return Math.sqrt(f * f + l * l);
}

// Slip angle: the angle between the chassis heading and the actual velocity
// vector. Positive when the car is sliding to its right relative to where the
// nose is pointed (i.e. a left-hand drift).
function slipAngle(state) {
  const f = state.forwardSpeed;
  const l = state.lateralSpeed;
  if (Math.abs(f) < 0.05 && Math.abs(l) < 0.05) return 0;
  return Math.atan2(l, f);
}

// Integrate position from the local-frame velocity using midpoint heading so
// that yaw and translation stay coherent across a single frame.
function integratePosition(state, dtSec) {
  const midHeading = state.heading + state.yawRate * dtSec * 0.5;
  const cos = Math.cos(midHeading);
  const sin = Math.sin(midHeading);
  state.x += (state.forwardSpeed * cos - state.lateralSpeed * sin) * dtSec;
  state.y += (state.forwardSpeed * sin + state.lateralSpeed * cos) * dtSec;
  state.heading = wrapAngle(state.heading + state.yawRate * dtSec);
}

function snapshot(state) {
  const { vx, vy } = worldVelocity(state);
  return {
    x: state.x,
    y: state.y,
    heading: state.heading,
    forwardSpeed: state.forwardSpeed,
    lateralSpeed: state.lateralSpeed,
    speed: speed(state),
    slipAngle: slipAngle(state),
    yawRate: state.yawRate,
    vx,
    vy,
    steerInput: state.steerInput,
  };
}

module.exports = {
  createVehicleState,
  worldVelocity,
  speed,
  slipAngle,
  integratePosition,
  snapshot,
};

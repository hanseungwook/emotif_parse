'use strict';

const { VEHICLE, clamp, approach } = require('./constants');

// Speed-dependent steering authority. At a complete stop we don't allow the
// car to spin in place (no input authority), and at very high speeds we taper
// off the responsiveness so the car remains controllable.
function steeringAuthority(forwardSpeed) {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 0.05) return 0;
  // Ease-in from 0..lowSpeedSteerEase.
  const easeIn = Math.min(absSpeed / VEHICLE.lowSpeedSteerEase, 1);
  // Tail-off above highSpeedSteerDamp — never below 35% so high-speed corners
  // still respond.
  const ratio = absSpeed / VEHICLE.highSpeedSteerDamp;
  const tail = ratio <= 1 ? 1 : 1 / (1 + (ratio - 1) * 1.2);
  return easeIn * Math.max(tail, 0.35);
}

// Smoothly approach the new steering input from the previous frame.
function smoothSteerInput(prev, raw, dtSec) {
  const target = clamp(raw, -1, 1);
  const maxStep = VEHICLE.steerInputSmoothing * dtSec;
  return approach(prev, target, maxStep);
}

// Resolve the desired yaw rate for the current frame.
function targetYawRate(state, driftBoosting) {
  const authority = steeringAuthority(state.forwardSpeed);
  const base = state.steerInput * VEHICLE.baseTurnRate * authority;
  // Reverse driving flips the steer direction so wheel-down inputs still feel
  // intuitive (think of an arcade hatchback reversing out of a wall).
  const directed = state.forwardSpeed < 0 ? -base : base;
  return driftBoosting ? directed * VEHICLE.driftCounterSteerBoost : directed;
}

function applySteering(state, rawSteerInput, dtSec, driftBoosting) {
  state.steerInput = smoothSteerInput(state.steerInput, rawSteerInput, dtSec);
  // Yaw rate snaps toward target faster than the input itself so the car
  // feels eager once you commit to a direction.
  const target = targetYawRate(state, driftBoosting);
  const yawStep = (VEHICLE.baseTurnRate * 3) * dtSec;
  state.yawRate = approach(state.yawRate, target, yawStep);
}

module.exports = {
  steeringAuthority,
  smoothSteerInput,
  targetYawRate,
  applySteering,
};

'use strict';

const { VEHICLE, BOOST, clamp } = require('./constants');

// Engine torque tapers off as speed approaches the cap so arcade vehicles
// don't accelerate forever. While boosting we lift both the available force
// and the top-speed cap to give the meter a noticeable kick.
function enginePowerAtSpeed(speed, boosting) {
  const cap = boosting ? VEHICLE.topSpeed * BOOST.topSpeedMultiplier : VEHICLE.topSpeed;
  const ratio = clamp(speed / cap, 0, 1);
  let scale = 1;
  if (ratio > VEHICLE.powerFalloffStart) {
    const t = (ratio - VEHICLE.powerFalloffStart) / (1 - VEHICLE.powerFalloffStart);
    scale = 1 - t;
  }
  const base = VEHICLE.enginePower * Math.max(scale, 0);
  return boosting ? base * BOOST.forceMultiplier : base;
}

// Drag is quadratic in speed, rolling resistance is linear (and only matters
// when the car is actually moving). This combination keeps arcade-feel
// responsiveness at low speed and forces top-speed convergence at high speed.
function passiveDeceleration(forwardSpeed) {
  const absSpeed = Math.abs(forwardSpeed);
  if (absSpeed < 1e-4) return 0;
  const drag = VEHICLE.dragCoefficient * absSpeed * absSpeed;
  const rolling = VEHICLE.rollingResistance;
  return drag + rolling;
}

// Apply throttle, brake, drag, and rolling resistance to forward velocity.
// All inputs are normalised to [0, 1] / [-1, 1]; the caller already clamped.
function applyLongitudinal(state, inputs, dtSec, boostActive) {
  const throttle = inputs.throttle;
  const brake = inputs.brake;
  const reverse = inputs.reverse === true;

  let accel = 0;
  if (throttle > 0 && !reverse) {
    accel += enginePowerAtSpeed(Math.max(state.forwardSpeed, 0), boostActive) * throttle;
  }
  if (reverse && throttle > 0) {
    // Reverse only engages from a stop or already-reversing motion to avoid
    // instant direction flips at speed (which feels broken in arcade games).
    if (state.forwardSpeed <= 0.1) {
      accel -= VEHICLE.reverseEnginePower * throttle;
    } else {
      // Engaging reverse while still moving forward acts as a brake instead.
      accel -= VEHICLE.brakeStrength * throttle;
    }
  }
  if (brake > 0) {
    if (state.forwardSpeed > 0) {
      accel -= VEHICLE.brakeStrength * brake;
    } else if (state.forwardSpeed < 0) {
      accel += VEHICLE.brakeStrength * brake;
    }
  }

  // Drag / rolling: opposes current motion.
  const passive = passiveDeceleration(state.forwardSpeed);
  if (state.forwardSpeed > 0) accel -= passive;
  else if (state.forwardSpeed < 0) accel += passive;

  // Idle deceleration when no input — keeps the car from coasting forever in
  // an arcade title that lacks a clutch / gearbox sim.
  if (throttle === 0 && brake === 0) {
    if (state.forwardSpeed > 0) accel -= Math.min(VEHICLE.idleDeceleration, state.forwardSpeed / Math.max(dtSec, 1e-4));
    else if (state.forwardSpeed < 0) accel += Math.min(VEHICLE.idleDeceleration, -state.forwardSpeed / Math.max(dtSec, 1e-4));
  }

  const next = state.forwardSpeed + accel * dtSec;

  // Snap to zero when we cross past it under deceleration so the car doesn't
  // creep backwards from drag alone.
  let nextClamped = next;
  if ((state.forwardSpeed > 0 && next < 0 && throttle === 0 && (!reverse || throttle === 0)) ||
      (state.forwardSpeed < 0 && next > 0 && (reverse || throttle === 0) && brake === 0)) {
    nextClamped = 0;
  }

  // Hard caps. Boost lifts the forward cap; reverse has its own cap.
  const topForward = boostActive ? VEHICLE.topSpeed * BOOST.topSpeedMultiplier : VEHICLE.topSpeed;
  const topReverse = -VEHICLE.reverseTopSpeed;
  state.forwardSpeed = clamp(nextClamped, topReverse, topForward);
}

module.exports = {
  enginePowerAtSpeed,
  passiveDeceleration,
  applyLongitudinal,
};

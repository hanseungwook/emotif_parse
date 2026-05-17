'use strict';

// All tuning values for the arcade driving feel. Distances are in metres,
// speeds in m/s, angles in radians, time in seconds. The runtime API still
// accepts dt in milliseconds for parity with the tetris runtime; the engine
// converts internally.

const TWO_PI = Math.PI * 2;

const VEHICLE = Object.freeze({
  // Engine / brake forces (m/s^2 at the wheels with mass already factored in).
  enginePower: 28,           // peak longitudinal acceleration at low speed
  brakeStrength: 38,         // deceleration while braking
  reverseEnginePower: 14,    // reverse acceleration is weaker than forward

  // Top-speed shaping.
  topSpeed: 60,              // m/s ~ 216 km/h
  reverseTopSpeed: 14,
  powerFalloffStart: 0.55,   // fraction of topSpeed where power begins falling off

  // Passive resistance.
  dragCoefficient: 0.0018,   // applied to speed^2 (in vehicle frame)
  rollingResistance: 0.45,   // constant deceleration when moving on grip
  idleDeceleration: 8,       // extra deceleration when no throttle/brake input

  // Steering / yaw response.
  baseTurnRate: 2.6,         // rad/s at the steering sweet spot
  lowSpeedSteerEase: 6,      // m/s below which steering smoothly engages
  highSpeedSteerDamp: 32,    // m/s at which steering authority halves
  steerInputSmoothing: 14,   // rate at which raw input eases into the model

  // Lateral grip / drift. These are exponential decay rates (1/s) on the
  // lateral velocity. baseGrip is high enough to dominate the rotating-frame
  // coupling during normal cornering; driftGrip is low so lateral velocity
  // builds into a deliberate slide.
  baseGrip: 25,              // grip-mode decay rate (1/s)
  driftGrip: 4,              // drift-mode decay rate (1/s)
  driftEntrySpeed: 6,        // minimum speed to enter a drift
  driftCounterSteerBoost: 1.35, // multiplier on yaw rate while drifting
  maxLateralSpeed: 22,       // hard clamp so cars don't fly sideways
  driftRecoveryGrip: 12,     // recovery decay rate (1/s)

  // Visual / chassis feel (not used for physics, but exposed in snapshots).
  wheelbase: 2.5,
});

const BOOST = Object.freeze({
  // Meter shape.
  maxCharge: 100,             // arbitrary points; UI maps to a 0..1 bar
  minActivationCharge: 25,    // can't tap-boost from empty dust

  // Gain rates (points/second).
  driftGainBase: 18,          // base while sliding within the drift window
  driftGainMaxBonus: 22,      // additional when slip angle is at the sweet spot
  driftGainSlipSweetSpot: 0.55, // radians of slip giving peak gain
  driftGainSlipFalloff: 0.85, // beyond this slip the bonus tapers
  airtimeGain: 14,            // when airborne / off-road triggers are set
  draftGain: 9,               // while in another car's slipstream

  // Activation.
  consumptionRate: 35,        // points/second while boost is held — full meter lasts ~2.85s
  forceMultiplier: 1.7,       // throttle force scaling while boosting
  topSpeedMultiplier: 1.25,   // top-speed cap is lifted while boosting
  releaseDecayMs: 220,        // forced cooldown after letting go to avoid spam
  emptyLockoutMs: 600,        // cooldown when the meter empties mid-boost
});

const PHASE = Object.freeze({
  READY: 'ready',
  RACING: 'racing',
  CRASHED: 'crashed',
});

const DRIFT_STATE = Object.freeze({
  GRIP: 'grip',
  DRIFTING: 'drifting',
  RECOVERY: 'recovery',
});

const EVENTS = Object.freeze({
  START: 'start',
  TICK: 'tick',
  DRIFT_START: 'driftStart',
  DRIFT_END: 'driftEnd',
  BOOST_FULL: 'boostFull',
  BOOST_START: 'boostStart',
  BOOST_END: 'boostEnd',
  BOOST_EMPTY: 'boostEmpty',
  CRASH: 'crash',
});

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function wrapAngle(angle) {
  // Wrap to (-PI, PI]. Using TWO_PI keeps the result stable for large inputs.
  let a = angle;
  if (!Number.isFinite(a)) return 0;
  a = ((a % TWO_PI) + TWO_PI) % TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  return a;
}

function approach(current, target, maxStep) {
  if (current < target) return Math.min(current + maxStep, target);
  if (current > target) return Math.max(current - maxStep, target);
  return target;
}

module.exports = {
  VEHICLE,
  BOOST,
  PHASE,
  DRIFT_STATE,
  EVENTS,
  TWO_PI,
  clamp,
  wrapAngle,
  approach,
};

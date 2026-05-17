'use strict';

const { VEHICLE, DRIFT_STATE, clamp } = require('./constants');

const RECOVERY_EXIT_LATERAL = 0.6; // m/s of slide below which RECOVERY → GRIP
const RECOVERY_MIN_TIME_MS = 120;  // brief minimum so transitions are visible
const RECOVERY_MAX_TIME_MS = 900;  // backstop in case grip never fully wins

function gripForState(driftState) {
  switch (driftState) {
    case DRIFT_STATE.DRIFTING: return VEHICLE.driftGrip;
    case DRIFT_STATE.RECOVERY: return VEHICLE.driftRecoveryGrip;
    case DRIFT_STATE.GRIP:
    default: return VEHICLE.baseGrip;
  }
}

function shouldEnterDrift(state, inputs) {
  if (!inputs.handbrake) return false;
  if (Math.abs(state.forwardSpeed) < VEHICLE.driftEntrySpeed) return false;
  return true;
}

// Pure transition function — separated so tests can exercise the state machine
// without running the integrator.
function advanceState(prev, state, inputs, dtMs) {
  const next = {
    state: prev.state,
    elapsedMs: prev.elapsedMs + dtMs,
    drifting: false,
  };
  switch (prev.state) {
    case DRIFT_STATE.GRIP: {
      if (shouldEnterDrift(state, inputs)) {
        next.state = DRIFT_STATE.DRIFTING;
        next.elapsedMs = 0;
      }
      break;
    }
    case DRIFT_STATE.DRIFTING: {
      next.drifting = true;
      if (!inputs.handbrake) {
        next.state = DRIFT_STATE.RECOVERY;
        next.elapsedMs = 0;
      } else if (Math.abs(state.forwardSpeed) < VEHICLE.driftEntrySpeed * 0.5) {
        // Plummeted in speed — drop the drift so the player isn't trapped.
        next.state = DRIFT_STATE.RECOVERY;
        next.elapsedMs = 0;
      }
      break;
    }
    case DRIFT_STATE.RECOVERY: {
      const lateral = Math.abs(state.lateralSpeed);
      if (next.elapsedMs >= RECOVERY_MIN_TIME_MS && lateral < RECOVERY_EXIT_LATERAL) {
        next.state = DRIFT_STATE.GRIP;
        next.elapsedMs = 0;
      } else if (next.elapsedMs >= RECOVERY_MAX_TIME_MS) {
        next.state = DRIFT_STATE.GRIP;
        next.elapsedMs = 0;
      } else if (shouldEnterDrift(state, inputs)) {
        // Player re-pressed handbrake mid-recovery → straight back into a drift.
        next.state = DRIFT_STATE.DRIFTING;
        next.elapsedMs = 0;
      }
      break;
    }
    default:
      next.state = DRIFT_STATE.GRIP;
  }
  return next;
}

// Integrate the lateral-velocity model. The rotating-frame coupling
// (yawRate * forwardSpeed) is what generates slide in the first place; grip is
// modelled as exponential decay so it scales with the size of the slide — at
// large slip the tires bleed more m/s per second than at small slip, which is
// what keeps grip-mode cornering tight and drift-mode cornering loose.
function applyLateral(state, driftState, dtSec) {
  // Rotating-reference coupling — heading is changing relative to velocity.
  state.lateralSpeed += -state.yawRate * state.forwardSpeed * dtSec;
  // Forward coupling is much smaller in practice but kept for completeness:
  state.forwardSpeed += state.yawRate * state.lateralSpeed * dtSec * 0.25;

  // Per-state decay rate (1/s). Linearised exponential, clamped so a single
  // huge dt can't drive the multiplier negative and flip the sign.
  const rate = gripForState(driftState);
  const decay = Math.max(0, 1 - rate * dtSec);
  state.lateralSpeed *= decay;

  // Final clamp — safety rail so a chain of long frames can't fling the car
  // sideways forever.
  state.lateralSpeed = clamp(state.lateralSpeed, -VEHICLE.maxLateralSpeed, VEHICLE.maxLateralSpeed);
}

module.exports = {
  DRIFT_STATE,
  RECOVERY_EXIT_LATERAL,
  RECOVERY_MIN_TIME_MS,
  RECOVERY_MAX_TIME_MS,
  gripForState,
  shouldEnterDrift,
  advanceState,
  applyLateral,
};

'use strict';

const { BOOST, DRIFT_STATE, clamp } = require('./constants');

function createBoostState(initial) {
  const start = initial || {};
  return {
    charge: clamp(Number.isFinite(start.charge) ? start.charge : 0, 0, BOOST.maxCharge),
    active: false,
    requested: false,        // mirror of last inputs.boost for edge detection
    lockoutMs: 0,            // forced cooldown after release / empty
    consumedThisActivation: 0,
    wasFullEmitted: false,   // ensures boostFull fires once per top-up
  };
}

// Drift gain: peaks when slip angle is near the sweet spot, falls off as the
// slide becomes extreme (the car is losing forward speed, so the meter should
// stop rewarding the slide).
function driftGainRate(slipAngle) {
  const abs = Math.abs(slipAngle);
  if (abs < 0.05) return 0; // straight-line drift isn't really a drift
  const peak = BOOST.driftGainSlipSweetSpot;
  let bonusFactor;
  if (abs <= peak) {
    bonusFactor = abs / peak;
  } else {
    const t = clamp((abs - peak) / (BOOST.driftGainSlipFalloff - peak), 0, 1);
    bonusFactor = 1 - t;
  }
  return BOOST.driftGainBase + BOOST.driftGainMaxBonus * bonusFactor;
}

// Compute the total charge-per-second for this frame.
function chargeRate(context) {
  let rate = 0;
  if (context.driftState === DRIFT_STATE.DRIFTING) {
    rate += driftGainRate(context.slipAngle);
  }
  if (context.airborne) rate += BOOST.airtimeGain;
  if (context.drafting) rate += BOOST.draftGain;
  return rate;
}

// Update the boost meter for one tick. Returns an array of named events the
// runtime should re-emit on its bus.
function updateBoost(boost, context, dtMs) {
  const events = [];
  const dtSec = dtMs / 1000;

  // Cool down lockout first so a single tick can both lock and re-arm if the
  // dt is huge. (Mostly defensive — under normal frame pacing we never hit
  // both branches in a single update.)
  if (boost.lockoutMs > 0) {
    boost.lockoutMs = Math.max(0, boost.lockoutMs - dtMs);
  }

  const wantsBoost = context.inputs.boost === true;
  const canActivate = boost.charge >= BOOST.minActivationCharge && boost.lockoutMs <= 0;

  // Activation / deactivation transitions.
  if (!boost.active) {
    if (wantsBoost && canActivate) {
      boost.active = true;
      boost.consumedThisActivation = 0;
      events.push({ type: 'boostStart', charge: boost.charge });
    }
  } else {
    if (!wantsBoost) {
      boost.active = false;
      boost.lockoutMs = Math.max(boost.lockoutMs, BOOST.releaseDecayMs);
      events.push({
        type: 'boostEnd',
        reason: 'released',
        consumed: boost.consumedThisActivation,
        charge: boost.charge,
      });
    } else if (boost.charge <= 0) {
      boost.active = false;
      boost.charge = 0;
      boost.lockoutMs = Math.max(boost.lockoutMs, BOOST.emptyLockoutMs);
      events.push({
        type: 'boostEnd',
        reason: 'empty',
        consumed: boost.consumedThisActivation,
        charge: 0,
      });
      events.push({ type: 'boostEmpty' });
    }
  }

  // Apply consumption / gain — but never both. If you're boosting we ignore
  // drift gain so you can't tap-boost forever from a perfectly held slide.
  if (boost.active) {
    const consume = BOOST.consumptionRate * dtSec;
    boost.charge = Math.max(0, boost.charge - consume);
    boost.consumedThisActivation += consume;
    boost.wasFullEmitted = false;
  } else {
    const gain = chargeRate(context) * dtSec;
    if (gain > 0) {
      boost.charge = Math.min(BOOST.maxCharge, boost.charge + gain);
    }
  }

  // Edge: meter just topped out. Only emit once until something pulls it back
  // down again.
  if (!boost.wasFullEmitted && boost.charge >= BOOST.maxCharge) {
    boost.wasFullEmitted = true;
    events.push({ type: 'boostFull' });
  }
  if (boost.charge < BOOST.maxCharge - 0.5) {
    boost.wasFullEmitted = false;
  }

  boost.requested = wantsBoost;
  return events;
}

function chargeFraction(boost) {
  return clamp(boost.charge / BOOST.maxCharge, 0, 1);
}

function snapshot(boost) {
  return {
    charge: boost.charge,
    fraction: chargeFraction(boost),
    active: boost.active,
    lockoutMs: boost.lockoutMs,
    canActivate: boost.charge >= BOOST.minActivationCharge && boost.lockoutMs <= 0,
  };
}

module.exports = {
  createBoostState,
  driftGainRate,
  chargeRate,
  updateBoost,
  chargeFraction,
  snapshot,
};

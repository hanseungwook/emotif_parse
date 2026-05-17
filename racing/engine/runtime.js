'use strict';

const { PHASE, DRIFT_STATE, EVENTS, VEHICLE, BOOST, clamp } = require('./constants');
const vehicle = require('./vehicle');
const physics = require('./physics');
const steering = require('./steering');
const drift = require('./drift');
const boost = require('./boost');
const { EventBus } = require('./events');

const DEFAULT_INPUTS = Object.freeze({
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  boost: false,
  reverse: false,
  airborne: false,
  drafting: false,
});

function normalizeInputs(raw) {
  const safe = raw || {};
  return {
    throttle: clamp(Number.isFinite(safe.throttle) ? safe.throttle : 0, 0, 1),
    brake: clamp(Number.isFinite(safe.brake) ? safe.brake : 0, 0, 1),
    steer: clamp(Number.isFinite(safe.steer) ? safe.steer : 0, -1, 1),
    handbrake: safe.handbrake === true,
    boost: safe.boost === true,
    reverse: safe.reverse === true,
    airborne: safe.airborne === true,
    drafting: safe.drafting === true,
  };
}

class RacingEngine {
  constructor(options) {
    const opts = options || {};
    this._events = new EventBus();
    this._vehicle = vehicle.createVehicleState(opts.initial);
    this._boost = boost.createBoostState(opts.initialBoost);
    this._drift = {
      state: DRIFT_STATE.GRIP,
      elapsedMs: 0,
      drifting: false,
    };
    this._inputs = Object.assign({}, DEFAULT_INPUTS);
    this._phase = PHASE.READY;
    this._lastSnapshot = null;
    this._initial = opts.initial || null;
    this._initialBoost = opts.initialBoost || null;
    this._crashReason = null;
    this._elapsedMs = 0;
  }

  // ----- subscriptions -----
  on(event, handler) { return this._events.on(event, handler); }
  off(event, handler) { return this._events.off(event, handler); }

  // ----- lifecycle -----
  start() {
    if (this._phase === PHASE.RACING) return false;
    this._vehicle = vehicle.createVehicleState(this._initial);
    this._boost = boost.createBoostState(this._initialBoost);
    this._drift = { state: DRIFT_STATE.GRIP, elapsedMs: 0, drifting: false };
    this._inputs = Object.assign({}, DEFAULT_INPUTS);
    this._phase = PHASE.RACING;
    this._crashReason = null;
    this._elapsedMs = 0;
    this._events.emit(EVENTS.START, this.snapshot());
    return true;
  }

  crash(reason) {
    if (this._phase === PHASE.CRASHED) return false;
    this._phase = PHASE.CRASHED;
    this._crashReason = reason || 'unknown';
    // Hard-stop the car — gameplay can decide to respawn.
    this._vehicle.forwardSpeed = 0;
    this._vehicle.lateralSpeed = 0;
    this._vehicle.yawRate = 0;
    this._boost.active = false;
    this._events.emit(EVENTS.CRASH, { reason: this._crashReason, snapshot: this.snapshot() });
    return true;
  }

  setInputs(raw) {
    this._inputs = normalizeInputs(raw);
  }

  // ----- main step -----
  tick(dtMs) {
    if (this._phase !== PHASE.RACING) return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;

    // Split very large dt into safe sub-steps so the integrator stays stable
    // (drift coupling is most sensitive to large yaw * speed products).
    const MAX_STEP_MS = 33; // ~30Hz inner cap
    let remaining = dtMs;
    while (remaining > 0 && this._phase === PHASE.RACING) {
      const step = Math.min(remaining, MAX_STEP_MS);
      this._stepOnce(step);
      remaining -= step;
    }

    const snap = this.snapshot();
    this._lastSnapshot = snap;
    this._events.emit(EVENTS.TICK, snap);
  }

  _stepOnce(dtMs) {
    const dtSec = dtMs / 1000;
    this._elapsedMs += dtMs;
    const inputs = this._inputs;
    const state = this._vehicle;

    // --- drift state transition (before forces so grip is consistent) ---
    const prevDrift = this._drift;
    const nextDrift = drift.advanceState(prevDrift, state, inputs, dtMs);
    if (nextDrift.state !== prevDrift.state) {
      if (nextDrift.state === DRIFT_STATE.DRIFTING) {
        this._events.emit(EVENTS.DRIFT_START, {
          speed: vehicle.speed(state),
          slipAngle: vehicle.slipAngle(state),
        });
      } else if (prevDrift.state === DRIFT_STATE.DRIFTING) {
        this._events.emit(EVENTS.DRIFT_END, {
          recovery: nextDrift.state === DRIFT_STATE.RECOVERY,
          speed: vehicle.speed(state),
        });
      }
    }
    this._drift = nextDrift;

    // --- steering / yaw ---
    const drifting = this._drift.state === DRIFT_STATE.DRIFTING;
    steering.applySteering(state, inputs.steer, dtSec, drifting);

    // --- longitudinal forces ---
    physics.applyLongitudinal(state, inputs, dtSec, this._boost.active);

    // --- lateral / drift coupling ---
    drift.applyLateral(state, this._drift.state, dtSec);

    // --- integrate position from updated body-frame velocity ---
    vehicle.integratePosition(state, dtSec);

    // --- boost meter ---
    const boostContext = {
      inputs,
      driftState: this._drift.state,
      slipAngle: vehicle.slipAngle(state),
      airborne: inputs.airborne,
      drafting: inputs.drafting,
    };
    const boostEvents = boost.updateBoost(this._boost, boostContext, dtMs);
    for (const evt of boostEvents) {
      switch (evt.type) {
        case 'boostStart': this._events.emit(EVENTS.BOOST_START, evt); break;
        case 'boostEnd':   this._events.emit(EVENTS.BOOST_END, evt);   break;
        case 'boostFull':  this._events.emit(EVENTS.BOOST_FULL, evt);  break;
        case 'boostEmpty': this._events.emit(EVENTS.BOOST_EMPTY, evt); break;
        default: break;
      }
    }
  }

  // ----- accessors -----
  get phase() { return this._phase; }
  get crashReason() { return this._crashReason; }
  get isDrifting() { return this._drift.state === DRIFT_STATE.DRIFTING; }
  get isBoosting() { return this._boost.active; }

  snapshot() {
    const vs = vehicle.snapshot(this._vehicle);
    const bs = boost.snapshot(this._boost);
    return {
      phase: this._phase,
      crashReason: this._crashReason,
      elapsedMs: this._elapsedMs,
      vehicle: vs,
      drift: {
        state: this._drift.state,
        elapsedMs: this._drift.elapsedMs,
        slipAngle: vs.slipAngle,
        lateralSpeed: vs.lateralSpeed,
      },
      boost: bs,
      inputs: Object.assign({}, this._inputs),
      tuning: {
        topSpeed: VEHICLE.topSpeed,
        boostTopSpeed: VEHICLE.topSpeed * BOOST.topSpeedMultiplier,
        maxCharge: BOOST.maxCharge,
      },
    };
  }
}

function createRacingEngine(options) {
  return new RacingEngine(options);
}

module.exports = {
  RacingEngine,
  createRacingEngine,
  normalizeInputs,
  DEFAULT_INPUTS,
};

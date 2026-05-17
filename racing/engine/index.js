'use strict';

const constants = require('./constants');
const events = require('./events');
const vehicle = require('./vehicle');
const physics = require('./physics');
const steering = require('./steering');
const drift = require('./drift');
const boost = require('./boost');
const runtime = require('./runtime');

module.exports = {
  // Main engine
  RacingEngine: runtime.RacingEngine,
  createRacingEngine: runtime.createRacingEngine,
  DEFAULT_INPUTS: runtime.DEFAULT_INPUTS,
  normalizeInputs: runtime.normalizeInputs,

  // Constants & enums
  VEHICLE: constants.VEHICLE,
  BOOST: constants.BOOST,
  PHASE: constants.PHASE,
  DRIFT_STATE: constants.DRIFT_STATE,
  EVENTS: constants.EVENTS,
  clamp: constants.clamp,
  wrapAngle: constants.wrapAngle,
  approach: constants.approach,

  // Event bus
  EventBus: events.EventBus,

  // Sub-modules (exposed for advanced consumers / tests)
  vehicle,
  physics,
  steering,
  drift,
  boost,
};

'use strict';

const { EventEmitter } = require('./eventEmitter');
const {
  RaceError,
  ValidationError,
  StateError,
} = require('./errors');
const {
  PHASE,
  FINISH_REASON,
  CRASH_SEVERITY,
  EVENTS,
  DEFAULTS,
  MODE,
} = require('./constants');
const { Countdown } = require('./countdown');
const { LapTracker, CHECKPOINT_RESULT_KIND } = require('./lapTracker');
const { CrashHandler } = require('./crashHandler');
const {
  computeFinishResults,
  summarizeLapHistory,
  formatLapTime,
} = require('./finishResults');
const { RaceState } = require('./raceState');

function createRaceState(options) {
  return new RaceState(options || {});
}

module.exports = {
  // Constructors
  createRaceState,
  RaceState,
  Countdown,
  LapTracker,
  CrashHandler,
  EventEmitter,

  // Constants
  PHASE,
  FINISH_REASON,
  CRASH_SEVERITY,
  EVENTS,
  DEFAULTS,
  MODE,
  CHECKPOINT_RESULT_KIND,

  // Helpers
  computeFinishResults,
  summarizeLapHistory,
  formatLapTime,

  // Errors
  RaceError,
  ValidationError,
  StateError,
};

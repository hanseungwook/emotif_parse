'use strict';

// Public entry point for the racing HUD subsystem. Other arcade-racer modules
// (gameplay simulation, scoring, input loop) integrate by:
//
//   1. Creating a HUD via `createRacingHud({ container, ... })`.
//   2. Pushing state through the returned `hudState`: setSpeed, setBoost,
//      tickTime, reachCheckpoint, completeLap, setCountdown, pushMessage,
//      recordCollision, finishRace, ...
//   3. Subscribing to UI intents — `hudState.on('intent:start', ...)`,
//      `hudState.on('intent:restart', ...)`, etc. — to react to player
//      actions on the overlay buttons.

const {
  HudState,
  STATUS,
  MESSAGE_CATEGORIES,
  SPEED_UNITS,
  DEFAULTS,
} = require('./hudState');
const { HudRenderer, MOUNT_KEYS } = require('./hudRenderer');
const { EventEmitter } = require('./eventEmitter');
const { BoostMeter, LOW_BOOST_THRESHOLD } = require('./boostMeter');
const { SpeedGauge, REDLINE_THRESHOLD } = require('./speedGauge');
const { LapTracker } = require('./lapTracker');
const { RaceTimer, BEST_FLASH_MS } = require('./raceTimer');
const { Countdown, GO_SENTINEL } = require('./countdown');
const { MessageFeed, BADGE_BY_CATEGORY, DEFAULT_MAX_VISIBLE } = require('./messageFeed');
const { StatusOverlay, VARIANT_BY_STATUS, COPY } = require('./statusOverlay');
const {
  formatLapTime,
  formatRaceTime,
  formatSpeed,
  formatBoostPercent,
  formatOrdinal,
} = require('./format');

function createRacingHud(options) {
  const opts = options || {};
  const hudState = opts.hudState || new HudState(opts.initial, { clock: opts.clock });
  let renderer = null;
  if (opts.container) {
    renderer = new HudRenderer({
      container: opts.container,
      document: opts.document,
      hudState,
      classNames: opts.classNames,
      panelOpts: opts.panelOpts,
    });
    if (opts.autoMount !== false) renderer.mount();
  }
  return {
    hudState,
    renderer,
    mount() {
      if (renderer) renderer.mount();
    },
    unmount() {
      if (renderer) renderer.unmount();
    },
  };
}

module.exports = {
  createRacingHud,
  HudState,
  HudRenderer,
  EventEmitter,
  BoostMeter,
  SpeedGauge,
  LapTracker,
  RaceTimer,
  Countdown,
  MessageFeed,
  StatusOverlay,
  STATUS,
  MESSAGE_CATEGORIES,
  SPEED_UNITS,
  DEFAULTS,
  MOUNT_KEYS,
  VARIANT_BY_STATUS,
  COPY,
  BADGE_BY_CATEGORY,
  DEFAULT_MAX_VISIBLE,
  LOW_BOOST_THRESHOLD,
  REDLINE_THRESHOLD,
  BEST_FLASH_MS,
  GO_SENTINEL,
  formatLapTime,
  formatRaceTime,
  formatSpeed,
  formatBoostPercent,
  formatOrdinal,
};

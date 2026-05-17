'use strict';

const {
  resolveDocument,
  appendClass,
} = require('./domHelpers');
const { BoostMeter } = require('./boostMeter');
const { SpeedGauge } = require('./speedGauge');
const { LapTracker } = require('./lapTracker');
const { RaceTimer } = require('./raceTimer');
const { Countdown } = require('./countdown');
const { MessageFeed } = require('./messageFeed');
const { StatusOverlay } = require('./statusOverlay');

// Wires the individual racing-HUD panels into a parent container and routes
// state changes from HudState into each panel's update method. The renderer
// can pick up host-provided mount points (via data-hud-mount="..." or
// matching class names) or create its own inline.

const MOUNT_KEYS = Object.freeze([
  'speedMount',
  'boostMount',
  'lapMount',
  'timerMount',
  'countdownMount',
  'messagesMount',
  'overlayMount',
]);

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-root',
  speedMount: 'hud-root__speed',
  boostMount: 'hud-root__boost',
  lapMount: 'hud-root__lap',
  timerMount: 'hud-root__timer',
  countdownMount: 'hud-root__countdown',
  messagesMount: 'hud-root__messages',
  overlayMount: 'hud-root__overlay',
});

const DATA_KEY = Object.freeze({
  speedMount: 'speed',
  boostMount: 'boost',
  lapMount: 'lap',
  timerMount: 'timer',
  countdownMount: 'countdown',
  messagesMount: 'messages',
  overlayMount: 'overlay',
});

function findChildByClass(node, className) {
  if (!node || !node.childNodes || !className) return null;
  for (const child of node.childNodes) {
    const cls = (child.className || '').split(' ');
    if (cls.includes(className)) return child;
  }
  return null;
}

class HudRenderer {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('HudRenderer requires a container');
    if (!opts.hudState) throw new TypeError('HudRenderer requires hudState');
    this._container = opts.container;
    this._hudState = opts.hudState;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('HudRenderer requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._panelOpts = opts.panelOpts || {};
    this._mounted = false;
    this._panels = {};
    this._mounts = {};
    this._ownedMounts = new Set();
    this._unsubscribers = [];
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._ensureMounts();
    this._buildPanels();
    this._subscribe();
    this._syncFromState();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const off of this._unsubscribers) {
      try { off(); } catch (_e) { /* ignore */ }
    }
    this._unsubscribers = [];
    for (const panel of Object.values(this._panels)) {
      if (panel && typeof panel.unmount === 'function') {
        try { panel.unmount(); } catch (_e) { /* ignore */ }
      }
    }
    this._panels = {};
    for (const node of this._ownedMounts) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
    this._ownedMounts.clear();
    this._mounts = {};
  }

  getPanels() {
    return { ...this._panels };
  }

  getMounts() {
    return { ...this._mounts };
  }

  _ensureMounts() {
    const doc = this._document;
    this._container.className = appendClass(this._container.className, this._classNames.root);

    for (const key of MOUNT_KEYS) {
      const dataName = DATA_KEY[key];
      const provided =
        findChildByClass(this._container, this._classNames[key]) ||
        this._maybeQuery(`[data-hud-mount="${dataName}"]`);
      if (provided) {
        this._mounts[key] = provided;
        continue;
      }
      const node = doc.createElement('div');
      node.className = this._classNames[key];
      node.setAttribute('data-hud-mount', dataName);
      this._container.appendChild(node);
      this._mounts[key] = node;
      this._ownedMounts.add(node);
    }
  }

  _buildPanels() {
    const initial = this._hudState.getState();

    this._panels.speedGauge = new SpeedGauge({
      container: this._mounts.speedMount,
      document: this._document,
      maxSpeed: initial.maxSpeed,
      unit: initial.speedUnit,
      ...(this._panelOpts.speedGauge || {}),
    });
    this._panels.boostMeter = new BoostMeter({
      container: this._mounts.boostMount,
      document: this._document,
      capacity: initial.boostCapacity,
      ...(this._panelOpts.boostMeter || {}),
    });
    this._panels.lapTracker = new LapTracker({
      container: this._mounts.lapMount,
      document: this._document,
      ...(this._panelOpts.lapTracker || {}),
    });
    this._panels.raceTimer = new RaceTimer({
      container: this._mounts.timerMount,
      document: this._document,
      ...(this._panelOpts.raceTimer || {}),
    });
    this._panels.countdown = new Countdown({
      container: this._mounts.countdownMount,
      document: this._document,
      ...(this._panelOpts.countdown || {}),
    });
    this._panels.messageFeed = new MessageFeed({
      container: this._mounts.messagesMount,
      document: this._document,
      ...(this._panelOpts.messageFeed || {}),
    });
    this._panels.statusOverlay = new StatusOverlay({
      container: this._mounts.overlayMount,
      document: this._document,
      hudState: this._hudState,
      ...(this._panelOpts.statusOverlay || {}),
    });

    for (const panel of Object.values(this._panels)) {
      panel.mount();
    }
  }

  _subscribe() {
    const state = this._hudState;
    this._unsubscribers.push(
      state.on('speed:change', (evt) => this._panels.speedGauge.setSpeed(evt.value)),
      state.on('maxSpeed:change', (evt) => this._panels.speedGauge.setMaxSpeed(evt.value)),
      state.on('speedUnit:change', (evt) => this._panels.speedGauge.setUnit(evt.value)),
      state.on('boost:change', (evt) => this._panels.boostMeter.setBoost(evt.value, evt.active)),
      state.on('boostCapacity:change', (evt) => this._panels.boostMeter.setCapacity(evt.value)),
      state.on('lap:change', (evt) => this._panels.lapTracker.setLap(evt.value, evt.totalLaps)),
      state.on('totalLaps:change', (evt) => this._panels.lapTracker.setLap(undefined, evt.value)),
      state.on('checkpoint:change', (evt) =>
        this._panels.lapTracker.setCheckpoint(evt.value, evt.totalCheckpoints)
      ),
      state.on('totalCheckpoints:change', (evt) =>
        this._panels.lapTracker.setCheckpoint(undefined, evt.value)
      ),
      state.on('lap:complete', (detail) => {
        this._panels.raceTimer.setBestLap(detail.bestLap);
        if (detail.isBestLap) this._panels.raceTimer.flashBest();
      }),
      state.on('time:tick', (evt) => {
        this._panels.raceTimer.setRaceTime(evt.raceTime);
        this._panels.raceTimer.setLapTime(evt.lapTime);
      }),
      state.on('raceTime:change', (evt) => this._panels.raceTimer.setRaceTime(evt.value)),
      state.on('lapTime:change', (evt) => this._panels.raceTimer.setLapTime(evt.value)),
      state.on('countdown:change', (evt) => this._panels.countdown.setValue(evt.value)),
      state.on('status:change', (evt) => {
        this._panels.raceTimer.setPaused(evt.value === 'paused');
        if (evt.value === 'finished') this._panels.lapTracker.setComplete(true);
        if (evt.value === 'idle' || evt.value === 'countdown') {
          this._panels.lapTracker.setComplete(false);
        }
      }),
      state.on('message:push', (msg) => this._panels.messageFeed.push(msg)),
      state.on('message:dismiss', (evt) => this._panels.messageFeed.dismiss(evt.id)),
      state.on('message:clear', () => this._panels.messageFeed.clear()),
      state.on('reset', () => this._syncFromState())
    );
  }

  _syncFromState() {
    const state = this._hudState.getState();
    this._panels.speedGauge.setUnit(state.speedUnit);
    this._panels.speedGauge.setMaxSpeed(state.maxSpeed);
    this._panels.speedGauge.setSpeed(state.speed);
    this._panels.boostMeter.setCapacity(state.boostCapacity);
    this._panels.boostMeter.setBoost(state.boost, state.boostActive);
    this._panels.lapTracker.setLap(state.currentLap, state.totalLaps);
    this._panels.lapTracker.setCheckpoint(state.nextCheckpoint, state.totalCheckpoints);
    this._panels.lapTracker.setComplete(state.status === 'finished');
    this._panels.raceTimer.setRaceTime(state.raceTime);
    this._panels.raceTimer.setLapTime(state.lapTime);
    this._panels.raceTimer.setBestLap(state.bestLap);
    this._panels.raceTimer.setPaused(state.status === 'paused');
    this._panels.countdown.setValue(state.countdown);
    this._panels.messageFeed.clear();
    for (const message of state.messages) {
      this._panels.messageFeed.push(message);
    }
  }

  _maybeQuery(selector) {
    if (typeof this._container.querySelector !== 'function') return null;
    try {
      return this._container.querySelector(selector);
    } catch (_e) {
      return null;
    }
  }
}

module.exports = { HudRenderer, MOUNT_KEYS };

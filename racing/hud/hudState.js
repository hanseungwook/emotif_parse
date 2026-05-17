'use strict';

const { EventEmitter } = require('./eventEmitter');

// Lifecycle of an arcade race round. The HUD treats every other status as
// "not currently driving," and the renderer/overlay decides which surface to
// show based on it.
const STATUS = Object.freeze({
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  PAUSED: 'paused',
  FINISHED: 'finished',
});

const VALID_STATUSES = new Set(Object.values(STATUS));

// Categories the message feed knows how to style.
const MESSAGE_CATEGORIES = Object.freeze({
  INFO: 'info',
  COLLISION: 'collision',
  BOOST: 'boost',
  CHECKPOINT: 'checkpoint',
  LAP: 'lap',
  FINISH: 'finish',
  WARNING: 'warning',
});

const VALID_MESSAGE_CATEGORIES = new Set(Object.values(MESSAGE_CATEGORIES));

const SPEED_UNITS = Object.freeze({
  KMH: 'km/h',
  MPH: 'mph',
});

const VALID_SPEED_UNITS = new Set(Object.values(SPEED_UNITS));

const DEFAULTS = Object.freeze({
  MAX_SPEED: 320,
  SPEED_UNIT: SPEED_UNITS.KMH,
  BOOST_CAPACITY: 100,
  TOTAL_LAPS: 3,
  TOTAL_CHECKPOINTS: 4,
});

function clampNonNegativeNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function clampNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function clampPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function clampBoost(value, capacity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(0, n), capacity);
}

function pickStatus(value, fallback) {
  return VALID_STATUSES.has(value) ? value : fallback;
}

function pickUnit(value, fallback) {
  return VALID_SPEED_UNITS.has(value) ? value : fallback;
}

function pickCategory(value, fallback) {
  return VALID_MESSAGE_CATEGORIES.has(value) ? value : fallback;
}

let _messageSeq = 0;
function nextMessageId(clock) {
  _messageSeq += 1;
  return `msg-${clock()}-${_messageSeq}`;
}

// HudState owns the visible state for the racing HUD subsystem. The
// gameplay simulation drives it via setSpeed / setBoost / completeLap /
// reachCheckpoint / tickTime / pushMessage and listens to intents
// (`intent:start`, `intent:restart`, `intent:resume`, `intent:pause`) that
// the overlay buttons emit. The state is intentionally decoupled from
// rendering — any UI shell can consume the same emitter.
class HudState extends EventEmitter {
  constructor(initial, options) {
    super();
    const seed = initial || {};
    const opts = options || {};
    this._clock = typeof opts.clock === 'function' ? opts.clock : Date.now;

    const maxSpeed = clampNonNegativeNumber(seed.maxSpeed, DEFAULTS.MAX_SPEED) || DEFAULTS.MAX_SPEED;
    const capacity = clampNonNegativeNumber(seed.boostCapacity, DEFAULTS.BOOST_CAPACITY) || DEFAULTS.BOOST_CAPACITY;
    const totalLaps = clampPositiveInt(seed.totalLaps, DEFAULTS.TOTAL_LAPS);
    const totalCheckpoints = clampPositiveInt(seed.totalCheckpoints, DEFAULTS.TOTAL_CHECKPOINTS);

    this._state = {
      status: pickStatus(seed.status, STATUS.IDLE),
      speed: clampNonNegativeNumber(seed.speed, 0),
      maxSpeed,
      speedUnit: pickUnit(seed.speedUnit, DEFAULTS.SPEED_UNIT),
      boost: clampBoost(seed.boost, capacity),
      boostCapacity: capacity,
      boostActive: seed.boostActive === true,
      currentLap: clampPositiveInt(seed.currentLap, 1),
      totalLaps,
      nextCheckpoint: clampNonNegativeInt(seed.nextCheckpoint, 0),
      totalCheckpoints,
      raceTime: clampNonNegativeNumber(seed.raceTime, 0),
      lapTime: clampNonNegativeNumber(seed.lapTime, 0),
      bestLap: seed.bestLap == null ? null : clampNonNegativeNumber(seed.bestLap, null),
      lapTimes: Array.isArray(seed.lapTimes)
        ? seed.lapTimes.map((v) => clampNonNegativeNumber(v, 0))
        : [],
      countdown: seed.countdown == null ? null : seed.countdown,
      position: seed.position == null ? null : clampPositiveInt(seed.position, null),
      totalRacers: seed.totalRacers == null ? null : clampPositiveInt(seed.totalRacers, null),
      messages: [],
    };
  }

  getState() {
    const s = this._state;
    return {
      status: s.status,
      speed: s.speed,
      maxSpeed: s.maxSpeed,
      speedUnit: s.speedUnit,
      boost: s.boost,
      boostCapacity: s.boostCapacity,
      boostActive: s.boostActive,
      currentLap: s.currentLap,
      totalLaps: s.totalLaps,
      nextCheckpoint: s.nextCheckpoint,
      totalCheckpoints: s.totalCheckpoints,
      raceTime: s.raceTime,
      lapTime: s.lapTime,
      bestLap: s.bestLap,
      lapTimes: s.lapTimes.slice(),
      countdown: s.countdown,
      position: s.position,
      totalRacers: s.totalRacers,
      messages: s.messages.map((m) => ({ ...m })),
    };
  }

  // ---- Speed ----

  setSpeed(value) {
    const next = clampNonNegativeNumber(value, this._state.speed);
    const capped = Math.min(next, this._state.maxSpeed);
    if (capped === this._state.speed) return;
    const prev = this._state.speed;
    this._state.speed = capped;
    this.emit('speed:change', {
      value: capped,
      prev,
      delta: capped - prev,
      maxSpeed: this._state.maxSpeed,
    });
    this._emitChange();
  }

  setMaxSpeed(value) {
    const next = clampNonNegativeNumber(value, this._state.maxSpeed) || this._state.maxSpeed;
    if (next === this._state.maxSpeed) return;
    this._state.maxSpeed = next;
    if (this._state.speed > next) this._state.speed = next;
    this.emit('maxSpeed:change', { value: next });
    this._emitChange();
  }

  setSpeedUnit(unit) {
    const next = pickUnit(unit, this._state.speedUnit);
    if (next === this._state.speedUnit) return;
    this._state.speedUnit = next;
    this.emit('speedUnit:change', { value: next });
    this._emitChange();
  }

  // ---- Boost ----

  setBoost(value, active) {
    const next = clampBoost(value, this._state.boostCapacity);
    const prevValue = this._state.boost;
    const prevActive = this._state.boostActive;
    const nextActive = active === undefined ? prevActive : active === true;
    if (next === prevValue && nextActive === prevActive) return;
    this._state.boost = next;
    this._state.boostActive = nextActive;
    this.emit('boost:change', {
      value: next,
      prev: prevValue,
      capacity: this._state.boostCapacity,
      active: nextActive,
    });
    if (nextActive !== prevActive) {
      this.emit(nextActive ? 'boost:activate' : 'boost:deactivate', {
        value: next,
        capacity: this._state.boostCapacity,
      });
    }
    this._emitChange();
  }

  consumeBoost(amount) {
    const drain = clampNonNegativeNumber(amount, 0);
    if (drain === 0) return;
    const next = Math.max(0, this._state.boost - drain);
    // Auto-deactivate when fully drained.
    const stillActive = this._state.boostActive && next > 0;
    this.setBoost(next, stillActive);
  }

  chargeBoost(amount) {
    const gain = clampNonNegativeNumber(amount, 0);
    if (gain === 0) return;
    const next = Math.min(this._state.boostCapacity, this._state.boost + gain);
    this.setBoost(next);
  }

  setBoostCapacity(value) {
    const next = clampNonNegativeNumber(value, this._state.boostCapacity) || this._state.boostCapacity;
    if (next === this._state.boostCapacity) return;
    this._state.boostCapacity = next;
    if (this._state.boost > next) this._state.boost = next;
    this.emit('boostCapacity:change', { value: next });
    this._emitChange();
  }

  // ---- Laps / checkpoints ----

  setLap(value) {
    const next = clampPositiveInt(value, this._state.currentLap);
    if (next === this._state.currentLap) return;
    const prev = this._state.currentLap;
    this._state.currentLap = next;
    this.emit('lap:change', {
      value: next,
      prev,
      totalLaps: this._state.totalLaps,
    });
    this._emitChange();
  }

  setTotalLaps(value) {
    const next = clampPositiveInt(value, this._state.totalLaps);
    if (next === this._state.totalLaps) return;
    this._state.totalLaps = next;
    if (this._state.currentLap > next) this._state.currentLap = next;
    this.emit('totalLaps:change', { value: next });
    this._emitChange();
  }

  // Record a finished lap and roll forward. Updates lap timing, the current
  // lap counter, and notifies subscribers. Returns the recorded lap detail.
  completeLap(time) {
    const lapTime = clampNonNegativeNumber(time, this._state.lapTime);
    const prevBest = this._state.bestLap;
    const isBest = prevBest == null || lapTime < prevBest;
    if (isBest) this._state.bestLap = lapTime;
    this._state.lapTimes.push(lapTime);
    const completedLap = this._state.currentLap;
    const detail = {
      lap: completedLap,
      lapTime,
      bestLap: this._state.bestLap,
      isBestLap: isBest,
      totalLaps: this._state.totalLaps,
    };
    this.emit('lap:complete', detail);
    if (completedLap >= this._state.totalLaps) {
      // Final lap finished — the runtime is expected to call finishRace().
      this._state.lapTime = lapTime;
      this._emitChange();
      return detail;
    }
    const prev = this._state.currentLap;
    this._state.currentLap = prev + 1;
    this._state.lapTime = 0;
    this._state.nextCheckpoint = 0;
    this.emit('lap:change', {
      value: this._state.currentLap,
      prev,
      totalLaps: this._state.totalLaps,
    });
    this._emitChange();
    return detail;
  }

  setNextCheckpoint(value) {
    const total = this._state.totalCheckpoints;
    const requested = clampNonNegativeInt(value, this._state.nextCheckpoint);
    const next = Math.min(requested, total);
    if (next === this._state.nextCheckpoint) return;
    const prev = this._state.nextCheckpoint;
    this._state.nextCheckpoint = next;
    this.emit('checkpoint:change', {
      value: next,
      prev,
      totalCheckpoints: total,
    });
    this._emitChange();
  }

  setTotalCheckpoints(value) {
    const next = clampPositiveInt(value, this._state.totalCheckpoints);
    if (next === this._state.totalCheckpoints) return;
    this._state.totalCheckpoints = next;
    if (this._state.nextCheckpoint > next) this._state.nextCheckpoint = next;
    this.emit('totalCheckpoints:change', { value: next });
    this._emitChange();
  }

  reachCheckpoint(index) {
    const total = this._state.totalCheckpoints;
    const idx = clampNonNegativeInt(index, this._state.nextCheckpoint);
    if (idx >= total) {
      // Reaching the final checkpoint just leaves nextCheckpoint pegged at
      // the total; the runtime calls completeLap() to actually advance.
      const detail = {
        index: idx,
        nextCheckpoint: total,
        totalCheckpoints: total,
      };
      this.emit('checkpoint:reach', detail);
      this._state.nextCheckpoint = total;
      this._emitChange();
      return detail;
    }
    const next = idx + 1;
    const prev = this._state.nextCheckpoint;
    this._state.nextCheckpoint = next;
    const detail = {
      index: idx,
      nextCheckpoint: next,
      totalCheckpoints: total,
      prev,
    };
    this.emit('checkpoint:reach', detail);
    this.emit('checkpoint:change', {
      value: next,
      prev,
      totalCheckpoints: total,
    });
    this._emitChange();
    return detail;
  }

  // ---- Timing ----

  tickTime(deltaMs) {
    const delta = clampNonNegativeNumber(deltaMs, 0);
    if (delta === 0) return;
    if (this._state.status !== STATUS.RACING) return;
    const prevRace = this._state.raceTime;
    const prevLap = this._state.lapTime;
    this._state.raceTime = prevRace + delta;
    this._state.lapTime = prevLap + delta;
    this.emit('time:tick', {
      delta,
      raceTime: this._state.raceTime,
      lapTime: this._state.lapTime,
    });
    this._emitChange();
  }

  setRaceTime(value) {
    const next = clampNonNegativeNumber(value, this._state.raceTime);
    if (next === this._state.raceTime) return;
    this._state.raceTime = next;
    this.emit('raceTime:change', { value: next });
    this._emitChange();
  }

  setLapTime(value) {
    const next = clampNonNegativeNumber(value, this._state.lapTime);
    if (next === this._state.lapTime) return;
    this._state.lapTime = next;
    this.emit('lapTime:change', { value: next });
    this._emitChange();
  }

  // ---- Countdown ----
  //
  // Countdown can be either an integer (3, 2, 1) or a sentinel string like
  // 'GO'. Passing null clears the countdown.

  setCountdown(value) {
    const next = value == null ? null : value;
    if (next === this._state.countdown) return;
    const prev = this._state.countdown;
    this._state.countdown = next;
    this.emit('countdown:change', { value: next, prev });
    this._emitChange();
  }

  // ---- Status / lifecycle ----

  setStatus(status) {
    if (!VALID_STATUSES.has(status)) {
      throw new RangeError(`unknown status: ${status}`);
    }
    if (status === this._state.status) return;
    const prev = this._state.status;
    this._state.status = status;
    this.emit('status:change', { value: status, prev });
    this._emitChange();
  }

  // Convenience entry from IDLE → COUNTDOWN. The runtime will then drive the
  // countdown values via setCountdown and finally call `beginRace()`.
  startCountdown() {
    if (this._state.status === STATUS.RACING || this._state.status === STATUS.PAUSED) return;
    this.setStatus(STATUS.COUNTDOWN);
  }

  beginRace() {
    this.setCountdown(null);
    this.setStatus(STATUS.RACING);
  }

  pause() {
    if (this._state.status !== STATUS.RACING) return;
    this.setStatus(STATUS.PAUSED);
  }

  resume() {
    if (this._state.status !== STATUS.PAUSED) return;
    this.setStatus(STATUS.RACING);
  }

  togglePause() {
    if (this._state.status === STATUS.RACING) this.pause();
    else if (this._state.status === STATUS.PAUSED) this.resume();
  }

  finishRace(detail) {
    const info = detail || {};
    if (info.position != null) {
      this._state.position = clampPositiveInt(info.position, this._state.position);
    }
    if (info.totalRacers != null) {
      this._state.totalRacers = clampPositiveInt(info.totalRacers, this._state.totalRacers);
    }
    this.setStatus(STATUS.FINISHED);
    const finishDetail = {
      raceTime: this._state.raceTime,
      bestLap: this._state.bestLap,
      lapTimes: this._state.lapTimes.slice(),
      position: this._state.position,
      totalRacers: this._state.totalRacers,
    };
    this.emit('race:finish', finishDetail);
    return finishDetail;
  }

  setPosition(position, totalRacers) {
    let changed = false;
    if (position != null) {
      const next = clampPositiveInt(position, this._state.position);
      if (next !== this._state.position) {
        this._state.position = next;
        changed = true;
      }
    }
    if (totalRacers != null) {
      const next = clampPositiveInt(totalRacers, this._state.totalRacers);
      if (next !== this._state.totalRacers) {
        this._state.totalRacers = next;
        changed = true;
      }
    }
    if (!changed) return;
    this.emit('position:change', {
      position: this._state.position,
      totalRacers: this._state.totalRacers,
    });
    this._emitChange();
  }

  // Resets the run-state to a fresh race. Carries through optional config
  // overrides for total laps / checkpoints / max speed / boost capacity, but
  // does not preserve them from the previous run unless explicitly passed.
  reset(seed) {
    const base = seed || {};
    const prev = this.getState();
    if (base.maxSpeed != null) {
      this._state.maxSpeed = clampNonNegativeNumber(base.maxSpeed, this._state.maxSpeed) || this._state.maxSpeed;
    }
    if (base.speedUnit != null) {
      this._state.speedUnit = pickUnit(base.speedUnit, this._state.speedUnit);
    }
    if (base.boostCapacity != null) {
      this._state.boostCapacity = clampNonNegativeNumber(base.boostCapacity, this._state.boostCapacity) || this._state.boostCapacity;
    }
    if (base.totalLaps != null) {
      this._state.totalLaps = clampPositiveInt(base.totalLaps, this._state.totalLaps);
    }
    if (base.totalCheckpoints != null) {
      this._state.totalCheckpoints = clampPositiveInt(base.totalCheckpoints, this._state.totalCheckpoints);
    }
    this._state.speed = 0;
    this._state.boost = clampBoost(base.boost, this._state.boostCapacity);
    this._state.boostActive = false;
    this._state.currentLap = 1;
    this._state.nextCheckpoint = 0;
    this._state.raceTime = 0;
    this._state.lapTime = 0;
    this._state.bestLap = null;
    this._state.lapTimes = [];
    this._state.countdown = null;
    this._state.position = null;
    this._state.totalRacers = null;
    this._state.messages = [];
    this._state.status = pickStatus(base.status, STATUS.IDLE);
    this.emit('reset', { prev, value: this.getState() });
    this._emitChange();
  }

  // ---- Messages ----

  pushMessage(detail) {
    const info = detail && typeof detail === 'object' ? detail : {};
    const text = typeof info.text === 'string' ? info.text : '';
    if (text === '') return null;
    const category = pickCategory(info.category, MESSAGE_CATEGORIES.INFO);
    const durationMs = clampNonNegativeNumber(info.durationMs, 0) || 2500;
    const at = clampNonNegativeNumber(info.at, this._clock());
    const id = typeof info.id === 'string' ? info.id : nextMessageId(this._clock);
    const message = { id, text, category, durationMs, at };
    this._state.messages = this._state.messages.concat([message]);
    this.emit('message:push', message);
    this._emitChange();
    return message;
  }

  dismissMessage(id) {
    if (!id) return false;
    const filtered = this._state.messages.filter((m) => m.id !== id);
    if (filtered.length === this._state.messages.length) return false;
    this._state.messages = filtered;
    this.emit('message:dismiss', { id });
    this._emitChange();
    return true;
  }

  clearMessages() {
    if (this._state.messages.length === 0) return;
    this._state.messages = [];
    this.emit('message:clear');
    this._emitChange();
  }

  recordCollision(detail) {
    const info = detail && typeof detail === 'object' ? detail : {};
    const text = typeof info.text === 'string' && info.text
      ? info.text
      : 'Collision!';
    return this.pushMessage({
      text,
      category: MESSAGE_CATEGORIES.COLLISION,
      durationMs: info.durationMs,
    });
  }

  // ---- UI intents ----
  //
  // These are emitted by the HUD's interactive controls (start / restart /
  // pause buttons). They are intents, not state changes — the runtime owning
  // the simulation listens for them and decides how to apply them.

  requestStart(meta) {
    this.emit('intent:start', meta || {});
  }

  requestRestart(meta) {
    this.emit('intent:restart', meta || {});
  }

  requestResume() {
    this.emit('intent:resume');
  }

  requestPause() {
    this.emit('intent:pause');
  }

  _emitChange() {
    this.emit('change', this.getState());
  }
}

module.exports = {
  HudState,
  STATUS,
  MESSAGE_CATEGORIES,
  SPEED_UNITS,
  DEFAULTS,
};

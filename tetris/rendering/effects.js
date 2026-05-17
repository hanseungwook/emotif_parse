'use strict';

const {
  EFFECTS,
  DEFAULT_LINE_CLEAR_MS,
  DEFAULT_GAME_OVER_FADE_MS,
  DEFAULT_LEVEL_UP_MS,
  DEFAULT_HARD_DROP_MS,
  DEFAULT_LOCK_FLASH_MS,
} = require('./constants');

class EffectTimeline {
  constructor(options) {
    const opts = options || {};
    this._durations = Object.assign(
      {
        [EFFECTS.LINE_CLEAR]: DEFAULT_LINE_CLEAR_MS,
        [EFFECTS.GAME_OVER]: DEFAULT_GAME_OVER_FADE_MS,
        [EFFECTS.LEVEL_UP]: DEFAULT_LEVEL_UP_MS,
        [EFFECTS.HARD_DROP]: DEFAULT_HARD_DROP_MS,
        [EFFECTS.LOCK]: DEFAULT_LOCK_FLASH_MS,
      },
      opts.durations || {}
    );
    this._effects = new Map();
    this._idCounter = 0;
  }

  start(name, payload) {
    const duration = this._durations[name];
    if (!isFinitePositive(duration)) {
      throw new TypeError('EffectTimeline: unknown effect "' + String(name) + '"');
    }
    const id = ++this._idCounter;
    const record = {
      id,
      name,
      duration,
      elapsed: 0,
      payload: payload || null,
      done: false,
    };
    this._effects.set(id, record);
    return id;
  }

  cancel(id) {
    return this._effects.delete(id);
  }

  cancelByName(name) {
    let removed = 0;
    for (const [id, record] of this._effects) {
      if (record.name === name) {
        this._effects.delete(id);
        removed++;
      }
    }
    return removed;
  }

  clear() {
    this._effects.clear();
  }

  advance(deltaMs) {
    const dt = Math.max(0, Number(deltaMs) || 0);
    const completed = [];
    for (const [id, record] of this._effects) {
      record.elapsed += dt;
      if (record.elapsed >= record.duration) {
        record.elapsed = record.duration;
        record.done = true;
        completed.push({ id, name: record.name, payload: record.payload });
        this._effects.delete(id);
      }
    }
    return completed;
  }

  active(name) {
    const out = [];
    for (const record of this._effects.values()) {
      if (name && record.name !== name) continue;
      out.push(snapshot(record));
    }
    return out;
  }

  has(name) {
    for (const record of this._effects.values()) {
      if (record.name === name) return true;
    }
    return false;
  }

  size() {
    return this._effects.size;
  }
}

function snapshot(record) {
  const progress = record.duration > 0 ? record.elapsed / record.duration : 1;
  return {
    id: record.id,
    name: record.name,
    duration: record.duration,
    elapsed: record.elapsed,
    progress: progress > 1 ? 1 : progress,
    payload: record.payload,
  };
}

function isFinitePositive(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

function easeOutCubic(t) {
  if (!isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInQuad(t) {
  if (!isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t;
}

module.exports = {
  EffectTimeline,
  easeOutCubic,
  easeInQuad,
};

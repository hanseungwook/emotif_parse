'use strict';

const G = require('./geometry');

// Forward direction convention: walking from a to b, the gate's "forward"
// direction is on your right side. So `forward = ({ ab.y, -ab.x })`.
// Order gate endpoints consistently around the track for correct lap tracking.
class Checkpoint {
  constructor(options) {
    const opts = options || {};
    if (typeof opts.id !== 'string' || opts.id.length === 0) {
      throw new TypeError('Checkpoint: id must be a non-empty string');
    }
    if (!opts.a || !Number.isFinite(opts.a.x) || !Number.isFinite(opts.a.y)) {
      throw new TypeError('Checkpoint: a must be a point with finite x,y');
    }
    if (!opts.b || !Number.isFinite(opts.b.x) || !Number.isFinite(opts.b.y)) {
      throw new TypeError('Checkpoint: b must be a point with finite x,y');
    }
    this.id = opts.id;
    this.a = { x: opts.a.x, y: opts.a.y };
    this.b = { x: opts.b.x, y: opts.b.y };
    const abx = this.b.x - this.a.x;
    const aby = this.b.y - this.a.y;
    if (Math.abs(abx) < G.EPS && Math.abs(aby) < G.EPS) {
      throw new RangeError('Checkpoint: a and b must be distinct points');
    }
    const fLen = Math.hypot(aby, -abx);
    this.forward = { x: aby / fLen, y: -abx / fLen };
    this.isFinish = !!opts.isFinish;
  }
}

class LapTracker {
  constructor(options) {
    const opts = options || {};
    const list = opts.checkpoints;
    if (!Array.isArray(list) || list.length < 2) {
      throw new TypeError('LapTracker: checkpoints must contain at least 2 entries');
    }
    this.checkpoints = list.map((c) => (c instanceof Checkpoint ? c : new Checkpoint(c)));
    // Index 0 is treated as the start/finish line by convention.
    this.checkpoints[0].isFinish = true;
    this.maxCrossingsPerUpdate = Number.isInteger(opts.maxCrossingsPerUpdate) && opts.maxCrossingsPerUpdate > 0
      ? opts.maxCrossingsPerUpdate
      : this.checkpoints.length + 1;
    this.reset();
  }

  reset() {
    this._nextIndex = 0;
    this._laps = 0;
    this._inLap = false;
    this._lapStartMs = null;
    this._lastLapTimeMs = null;
    this._bestLapTimeMs = null;
    this._totalTimeMs = 0;
  }

  get totalTimeMs() { return this._totalTimeMs; }
  get lapsCompleted() { return this._laps; }
  get lastLapTimeMs() { return this._lastLapTimeMs; }
  get bestLapTimeMs() { return this._bestLapTimeMs; }
  get nextCheckpoint() { return this.checkpoints[this._nextIndex] || null; }
  get nextCheckpointIndex() { return this._nextIndex; }
  get inLap() { return this._inLap; }

  // Detect checkpoint crossings between prev and next car positions.
  // Returns events: [{ id, index, isFinish, point, lap, lapTimeMs? }].
  update(prev, next, dtMs) {
    const tickMs = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
    this._totalTimeMs += tickMs;
    const events = [];
    if (!prev || !next) return events;
    if (!Number.isFinite(prev.x) || !Number.isFinite(prev.y)) return events;
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return events;
    if (prev.x === next.x && prev.y === next.y) return events;

    let safety = this.maxCrossingsPerUpdate;
    // Start below the valid t range so the very first crossing (possibly at
    // t = 0, when prev lies on the gate) is allowed. After each crossing the
    // bar advances, preventing a single straight-line motion from re-crossing
    // the same gate.
    let minT = -Infinity;
    while (safety-- > 0) {
      const cp = this.checkpoints[this._nextIndex];
      if (!cp) break;
      const hit = G.segmentIntersection(prev, next, cp.a, cp.b);
      if (!hit) break;
      if (hit.t <= minT) break;
      const motion = { x: next.x - prev.x, y: next.y - prev.y };
      const dirDot = motion.x * cp.forward.x + motion.y * cp.forward.y;
      if (dirDot <= 0) break; // wrong direction; ignore
      minT = hit.t;

      const evt = {
        id: cp.id,
        index: this._nextIndex,
        isFinish: cp.isFinish,
        point: hit.point,
        lap: this._laps,
      };

      if (cp.isFinish) {
        if (this._inLap && this._lapStartMs != null) {
          const lapTime = this._totalTimeMs - this._lapStartMs;
          this._laps += 1;
          this._lastLapTimeMs = lapTime;
          if (this._bestLapTimeMs == null || lapTime < this._bestLapTimeMs) {
            this._bestLapTimeMs = lapTime;
          }
          evt.lapTimeMs = lapTime;
          evt.lap = this._laps;
        }
        this._inLap = true;
        this._lapStartMs = this._totalTimeMs;
      }
      this._nextIndex = (this._nextIndex + 1) % this.checkpoints.length;
      events.push(evt);
    }
    return events;
  }
}

module.exports = { Checkpoint, LapTracker };

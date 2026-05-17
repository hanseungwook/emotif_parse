'use strict';

const G = require('./geometry');

const OBSTACLE_KIND = Object.freeze({
  BLOCK: 'block',     // solid; collides like a wall
  SLOW: 'slow',       // damps velocity while overlapping (mud/grass)
  BOOST: 'boost',     // adds impulse on entry (boost pad)
  HAZARD: 'hazard',   // reports damage on overlap (with cooldown via runtime)
});

const BEHAVIOR_KIND = Object.freeze({
  STATIC: 'static',
  OSCILLATE: 'oscillate',
  PATROL: 'patrol',
});

const VALID_KINDS = Object.values(OBSTACLE_KIND);

class Obstacle {
  constructor(options) {
    const opts = options || {};
    if (typeof opts.id !== 'string' || opts.id.length === 0) {
      throw new TypeError('Obstacle: id must be a non-empty string');
    }
    if (!VALID_KINDS.includes(opts.kind)) {
      throw new TypeError(`Obstacle: kind must be one of ${VALID_KINDS.join(', ')}`);
    }
    if (!Number.isFinite(opts.x) || !Number.isFinite(opts.y)) {
      throw new TypeError('Obstacle: x and y must be finite numbers');
    }
    if (!Number.isFinite(opts.radius) || opts.radius <= 0) {
      throw new RangeError('Obstacle: radius must be a positive number');
    }
    this.id = opts.id;
    this.kind = opts.kind;
    this.x = opts.x;
    this.y = opts.y;
    this.radius = opts.radius;
    this.strength = Number.isFinite(opts.strength) ? opts.strength : Obstacle.defaultStrengthFor(opts.kind);
    this.active = opts.active !== false;
    this._origin = { x: opts.x, y: opts.y };
    this.behavior = Obstacle._normalizeBehavior(opts.behavior);
    // Optional fixed direction (used e.g. by BOOST pads to push in a specific
    // direction regardless of the car's heading).
    this.direction = null;
    if (opts.direction && Number.isFinite(opts.direction.x) && Number.isFinite(opts.direction.y)) {
      const d = G.normalize(opts.direction);
      if (Math.abs(d.x) > G.EPS || Math.abs(d.y) > G.EPS) this.direction = d;
    }
    this._time = 0;
  }

  static defaultStrengthFor(kind) {
    switch (kind) {
      case OBSTACLE_KIND.SLOW: return 0.4;   // velocity damp ratio per overlap
      case OBSTACLE_KIND.BOOST: return 50;   // impulse magnitude
      case OBSTACLE_KIND.HAZARD: return 10;  // damage reported
      default: return 1;
    }
  }

  static _normalizeBehavior(behavior) {
    if (!behavior) return { type: BEHAVIOR_KIND.STATIC };
    const t = behavior.type;
    if (t === BEHAVIOR_KIND.STATIC) return { type: BEHAVIOR_KIND.STATIC };
    if (t === BEHAVIOR_KIND.OSCILLATE) {
      const periodMs = Number.isFinite(behavior.periodMs) && behavior.periodMs > 0 ? behavior.periodMs : 1000;
      const amplitude = Number.isFinite(behavior.amplitude) ? behavior.amplitude : 0;
      const direction = G.normalize(behavior.direction || { x: 1, y: 0 });
      const phase = Number.isFinite(behavior.phase) ? behavior.phase : 0;
      return { type: BEHAVIOR_KIND.OSCILLATE, periodMs, amplitude, direction, phase };
    }
    if (t === BEHAVIOR_KIND.PATROL) {
      if (!Array.isArray(behavior.path) || behavior.path.length < 2) {
        throw new TypeError('Obstacle.behavior(patrol): path must have at least 2 points');
      }
      const cycleMs = Number.isFinite(behavior.cycleMs) && behavior.cycleMs > 0 ? behavior.cycleMs : 2000;
      const loop = behavior.loop !== false;
      const path = behavior.path.map((p, i) => {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          throw new TypeError(`Obstacle.behavior(patrol): path[${i}] requires finite x,y`);
        }
        return { x: p.x, y: p.y };
      });
      return { type: BEHAVIOR_KIND.PATROL, path, cycleMs, loop };
    }
    throw new TypeError(`Obstacle: unknown behavior.type "${t}"`);
  }

  update(dtMs) {
    if (!this.active) return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    const b = this.behavior;
    if (b.type === BEHAVIOR_KIND.STATIC) return;
    this._time += dtMs;
    if (b.type === BEHAVIOR_KIND.OSCILLATE) {
      const phase = (this._time / b.periodMs) * Math.PI * 2 + b.phase;
      const offset = Math.sin(phase) * b.amplitude;
      this.x = this._origin.x + b.direction.x * offset;
      this.y = this._origin.y + b.direction.y * offset;
      return;
    }
    if (b.type === BEHAVIOR_KIND.PATROL) {
      this._stepPatrol(b);
    }
  }

  _stepPatrol(b) {
    const path = b.path;
    const n = path.length;
    const lens = [];
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
      const l = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      lens.push(l);
      total += l;
    }
    if (b.loop) {
      const l = Math.hypot(path[0].x - path[n - 1].x, path[0].y - path[n - 1].y);
      lens.push(l);
      total += l;
    }
    if (total < G.EPS) return;
    const phase = ((this._time % b.cycleMs) + b.cycleMs) % b.cycleMs / b.cycleMs;
    let target = phase * total;
    for (let i = 0; i < lens.length; i++) {
      if (target <= lens[i] || i === lens.length - 1) {
        const segLen = lens[i];
        const t = segLen > 0 ? Math.max(0, Math.min(1, target / segLen)) : 0;
        const a = path[i];
        const bPt = path[(i + 1) % n];
        this.x = a.x + (bPt.x - a.x) * t;
        this.y = a.y + (bPt.y - a.y) * t;
        return;
      }
      target -= lens[i];
    }
  }

  reset() {
    this.x = this._origin.x;
    this.y = this._origin.y;
    this._time = 0;
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  // Test against a circle. Returns null or { distance, normal (obstacle→circle), overlap }.
  testCircle(cx, cy, cr) {
    const dx = cx - this.x;
    const dy = cy - this.y;
    const dist = Math.hypot(dx, dy);
    const sum = this.radius + cr;
    if (dist >= sum) return null;
    let normal;
    if (dist < G.EPS) {
      normal = { x: 1, y: 0 };
    } else {
      normal = { x: dx / dist, y: dy / dist };
    }
    return { distance: dist, normal, overlap: sum - dist };
  }

  snapshot() {
    return {
      id: this.id,
      kind: this.kind,
      x: this.x,
      y: this.y,
      radius: this.radius,
      active: this.active,
      strength: this.strength,
      behavior: this.behavior.type,
    };
  }
}

module.exports = { Obstacle, OBSTACLE_KIND, BEHAVIOR_KIND };

'use strict';

const { TrackPath } = require('./path');
const { Obstacle, OBSTACLE_KIND } = require('./obstacles');
const { Checkpoint, LapTracker } = require('./checkpoints');
const { resolveWalls, resolveObstacle } = require('./collision');
const { EventBus } = require('./events');

const PHASE = Object.freeze({
  READY: 'ready',
  RACING: 'racing',
  FINISHED: 'finished',
});

const DEFAULTS = Object.freeze({
  lapsToFinish: 3,
  wallRestitution: 0.2,
  wallFriction: 0.0,
  obstacleRestitution: 0.2,
  obstacleFriction: 0.0,
  hazardCooldownMs: 1000,
});

// TrackRuntime owns the static world of an arcade racing course
// (boundaries, obstacles, checkpoints) and the rules governing how a car
// interacts with it. Car physics — acceleration, steering, integration —
// belong to the caller; on each step the caller updates car position,
// then calls runtime.update(dtMs) and the runtime corrects penetrations,
// applies obstacle effects, and registers checkpoint/lap progress.
class TrackRuntime {
  constructor(options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    if (!opts.path) {
      throw new TypeError('TrackRuntime: options.path is required');
    }
    if (!Array.isArray(opts.checkpoints) || opts.checkpoints.length < 2) {
      throw new TypeError('TrackRuntime: options.checkpoints must contain at least 2 gates');
    }
    if (!Number.isInteger(opts.lapsToFinish) || opts.lapsToFinish < 1) {
      throw new RangeError('TrackRuntime: lapsToFinish must be a positive integer');
    }
    if (!Number.isFinite(opts.hazardCooldownMs) || opts.hazardCooldownMs < 0) {
      throw new RangeError('TrackRuntime: hazardCooldownMs must be non-negative');
    }
    this._opts = opts;
    this.path = opts.path instanceof TrackPath ? opts.path : new TrackPath(opts.path);
    this._wallSegments = this.path.walls();
    this.obstacles = (opts.obstacles || []).map((o) =>
      o instanceof Obstacle ? o : new Obstacle(o)
    );
    this.lapTracker = new LapTracker({ checkpoints: opts.checkpoints });
    this._events = new EventBus();
    this._phase = PHASE.READY;
    this._car = null;
    this._prevPos = null;
    this._hazardCooldown = new Map();
    this._currentEffects = new Set();
  }

  on(event, handler) { return this._events.on(event, handler); }
  off(event, handler) { return this._events.off(event, handler); }

  get phase() { return this._phase; }
  get walls() { return this._wallSegments; }
  get checkpoints() { return this.lapTracker.checkpoints; }
  get totalTimeMs() { return this.lapTracker.totalTimeMs; }
  get lapsCompleted() { return this.lapTracker.lapsCompleted; }
  get lapsToFinish() { return this._opts.lapsToFinish; }
  get lastLapTimeMs() { return this.lapTracker.lastLapTimeMs; }
  get bestLapTimeMs() { return this.lapTracker.bestLapTimeMs; }
  get nextCheckpoint() { return this.lapTracker.nextCheckpoint; }
  get car() { return this._car; }

  start(car) {
    if (!car || !Number.isFinite(car.x) || !Number.isFinite(car.y)) {
      throw new TypeError('TrackRuntime.start: car must have finite x and y');
    }
    if (!Number.isFinite(car.radius) || car.radius <= 0) {
      throw new RangeError('TrackRuntime.start: car.radius must be positive');
    }
    if (!Number.isFinite(car.vx)) car.vx = 0;
    if (!Number.isFinite(car.vy)) car.vy = 0;
    this._car = car;
    this._prevPos = { x: car.x, y: car.y };
    this.lapTracker.reset();
    for (const obs of this.obstacles) obs.reset();
    this._hazardCooldown.clear();
    this._currentEffects.clear();
    this._phase = PHASE.RACING;
    this._events.emit('start', {
      totalLaps: this._opts.lapsToFinish,
      car: this._snapshotCar(),
    });
    return true;
  }

  // Reset to READY without clearing the held car reference (caller can restart).
  reset() {
    this.lapTracker.reset();
    for (const obs of this.obstacles) obs.reset();
    this._hazardCooldown.clear();
    this._currentEffects.clear();
    this._phase = PHASE.READY;
    this._prevPos = this._car ? { x: this._car.x, y: this._car.y } : null;
  }

  // Advance the runtime by dtMs. The caller is responsible for having
  // already updated the car's position and velocity using its own physics.
  update(dtMs) {
    if (this._phase !== PHASE.RACING || !this._car) return null;
    const tick = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;

    for (const obs of this.obstacles) obs.update(tick);

    const wallHits = resolveWalls(this._car, this._wallSegments, {
      restitution: this._opts.wallRestitution,
      friction: this._opts.wallFriction,
    });
    for (const hit of wallHits) {
      this._events.emit('wallHit', {
        wall: hit.wall,
        normal: hit.normal,
        point: hit.point,
        overlap: hit.overlap,
        car: this._snapshotCar(),
      });
    }

    // Tick hazard cooldowns.
    if (tick > 0 && this._hazardCooldown.size > 0) {
      for (const [k, v] of this._hazardCooldown) {
        const remaining = v - tick;
        if (remaining <= 0) this._hazardCooldown.delete(k);
        else this._hazardCooldown.set(k, remaining);
      }
    }

    const obstacleEvents = [];
    const nowEffects = new Set();
    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const onCooldown = obs.kind === OBSTACLE_KIND.HAZARD && this._hazardCooldown.has(obs.id);
      if (onCooldown) continue;
      const result = resolveObstacle(this._car, obs, {
        restitution: this._opts.obstacleRestitution,
        friction: this._opts.obstacleFriction,
      });
      if (!result) continue;
      nowEffects.add(obs.id);
      if (obs.kind === OBSTACLE_KIND.HAZARD) {
        this._hazardCooldown.set(obs.id, this._opts.hazardCooldownMs);
      }
      obstacleEvents.push(result);
      this._events.emit('obstacleHit', { ...result, car: this._snapshotCar() });
    }
    // Emit obstacleExit for effects no longer touching this tick.
    for (const id of this._currentEffects) {
      if (!nowEffects.has(id)) {
        this._events.emit('obstacleExit', { obstacleId: id });
      }
    }
    this._currentEffects = nowEffects;

    const prev = this._prevPos || { x: this._car.x, y: this._car.y };
    const cur = { x: this._car.x, y: this._car.y };
    const checkpointEvents = this.lapTracker.update(prev, cur, tick);
    for (const ev of checkpointEvents) {
      this._events.emit('checkpointCrossed', ev);
      if (ev.isFinish && ev.lapTimeMs != null) {
        this._events.emit('lapCompleted', {
          lap: ev.lap,
          lapTimeMs: ev.lapTimeMs,
          bestLapTimeMs: this.lapTracker.bestLapTimeMs,
          totalTimeMs: this.lapTracker.totalTimeMs,
        });
        if (this.lapTracker.lapsCompleted >= this._opts.lapsToFinish) {
          this._phase = PHASE.FINISHED;
          this._events.emit('raceFinished', {
            totalTimeMs: this.lapTracker.totalTimeMs,
            bestLapTimeMs: this.lapTracker.bestLapTimeMs,
            laps: this.lapTracker.lapsCompleted,
          });
          break;
        }
      }
    }

    this._prevPos = cur;
    return {
      phase: this._phase,
      wallHits,
      obstacleEvents,
      checkpointEvents,
    };
  }

  locateCar() {
    if (!this._car) return null;
    return this.path.locate({ x: this._car.x, y: this._car.y });
  }

  // True when the car (as a point) is between the two derived wall polylines —
  // i.e., between the left and right walls of its nearest segment.
  isCarOnTrack() {
    if (!this._car) return false;
    const loc = this.locateCar();
    if (!loc) return false;
    const half = (loc.segment.a.width + (loc.segment.b.width - loc.segment.a.width) * loc.t) / 2;
    return loc.distance <= half;
  }

  snapshot() {
    return {
      phase: this._phase,
      lapsCompleted: this.lapTracker.lapsCompleted,
      lapsToFinish: this._opts.lapsToFinish,
      totalTimeMs: this.lapTracker.totalTimeMs,
      lastLapTimeMs: this.lapTracker.lastLapTimeMs,
      bestLapTimeMs: this.lapTracker.bestLapTimeMs,
      nextCheckpointId: this.lapTracker.nextCheckpoint ? this.lapTracker.nextCheckpoint.id : null,
      nextCheckpointIndex: this.lapTracker.nextCheckpointIndex,
      car: this._snapshotCar(),
      obstacles: this.obstacles.map((o) => o.snapshot()),
    };
  }

  _snapshotCar() {
    if (!this._car) return null;
    return {
      x: this._car.x,
      y: this._car.y,
      vx: this._car.vx,
      vy: this._car.vy,
      radius: this._car.radius,
    };
  }
}

module.exports = { TrackRuntime, PHASE, DEFAULTS };

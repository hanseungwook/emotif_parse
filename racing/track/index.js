'use strict';

const geometry = require('./geometry');
const path = require('./path');
const obstacles = require('./obstacles');
const checkpoints = require('./checkpoints');
const collision = require('./collision');
const events = require('./events');
const runtime = require('./trackRuntime');

function createTrackRuntime(options) {
  return new runtime.TrackRuntime(options);
}

module.exports = {
  // Runtime
  TrackRuntime: runtime.TrackRuntime,
  createTrackRuntime,
  PHASE: runtime.PHASE,
  DEFAULTS: runtime.DEFAULTS,

  // Path / boundaries
  TrackPath: path.TrackPath,
  DEFAULT_WIDTH: path.DEFAULT_WIDTH,

  // Obstacles
  Obstacle: obstacles.Obstacle,
  OBSTACLE_KIND: obstacles.OBSTACLE_KIND,
  BEHAVIOR_KIND: obstacles.BEHAVIOR_KIND,

  // Checkpoints
  Checkpoint: checkpoints.Checkpoint,
  LapTracker: checkpoints.LapTracker,

  // Collision
  resolveWalls: collision.resolveWalls,
  resolveObstacle: collision.resolveObstacle,

  // Event bus
  EventBus: events.EventBus,

  // Geometry namespace (for advanced callers)
  geometry,
};

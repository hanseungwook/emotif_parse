'use strict';

const G = require('./geometry');
const { OBSTACLE_KIND } = require('./obstacles');

// Push a car (treated as a circle) out of any overlapping wall segments and
// reflect its velocity. Mutates the car in place. Returns an array of hits.
function resolveWalls(car, walls, options) {
  const opts = options || {};
  const restitution = Number.isFinite(opts.restitution) ? opts.restitution : 0.2;
  const friction = Number.isFinite(opts.friction) ? opts.friction : 0.0;
  const maxIterations = Number.isInteger(opts.maxIterations) && opts.maxIterations > 0 ? opts.maxIterations : 4;
  const hits = [];
  for (let iter = 0; iter < maxIterations; iter++) {
    let worst = null;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const c = G.circleSegmentCollision({ x: car.x, y: car.y }, car.radius, w.a, w.b);
      if (!c) continue;
      const overlap = car.radius - c.distance;
      if (overlap <= 0) continue;
      if (!worst || overlap > worst.overlap) {
        worst = { wall: w, normal: c.normal, overlap, point: c.point, t: c.t };
      }
    }
    if (!worst) break;
    car.x += worst.normal.x * worst.overlap;
    car.y += worst.normal.y * worst.overlap;
    const vDotN = car.vx * worst.normal.x + car.vy * worst.normal.y;
    if (vDotN < 0) {
      const tx = -worst.normal.y;
      const ty = worst.normal.x;
      const vT = car.vx * tx + car.vy * ty;
      const newVN = -vDotN * restitution;
      const newVT = vT * (1 - friction);
      car.vx = worst.normal.x * newVN + tx * newVT;
      car.vy = worst.normal.y * newVN + ty * newVT;
    }
    hits.push({
      wall: worst.wall,
      normal: worst.normal,
      point: worst.point,
      overlap: worst.overlap,
    });
  }
  return hits;
}

// Resolve a single obstacle interaction. Mutates car as appropriate.
// Returns null (no contact) or { kind, obstacle, ...details }.
function resolveObstacle(car, obstacle, options) {
  const opts = options || {};
  const contact = obstacle.testCircle(car.x, car.y, car.radius);
  if (!contact) return null;

  switch (obstacle.kind) {
    case OBSTACLE_KIND.BLOCK: {
      const restitution = Number.isFinite(opts.restitution) ? opts.restitution : 0.2;
      const friction = Number.isFinite(opts.friction) ? opts.friction : 0.0;
      car.x += contact.normal.x * contact.overlap;
      car.y += contact.normal.y * contact.overlap;
      const vDotN = car.vx * contact.normal.x + car.vy * contact.normal.y;
      if (vDotN < 0) {
        const tx = -contact.normal.y;
        const ty = contact.normal.x;
        const vT = car.vx * tx + car.vy * ty;
        const newVN = -vDotN * restitution;
        const newVT = vT * (1 - friction);
        car.vx = contact.normal.x * newVN + tx * newVT;
        car.vy = contact.normal.y * newVN + ty * newVT;
      }
      // Contact point is on the obstacle's surface along the normal toward the car.
      const cpx = obstacle.x + contact.normal.x * obstacle.radius;
      const cpy = obstacle.y + contact.normal.y * obstacle.radius;
      return {
        kind: OBSTACLE_KIND.BLOCK,
        obstacle,
        overlap: contact.overlap,
        normal: contact.normal,
        point: { x: cpx, y: cpy },
      };
    }
    case OBSTACLE_KIND.SLOW: {
      const s = Math.max(0, Math.min(1, obstacle.strength));
      car.vx *= 1 - s;
      car.vy *= 1 - s;
      return {
        kind: OBSTACLE_KIND.SLOW,
        obstacle,
        overlap: contact.overlap,
        damp: s,
      };
    }
    case OBSTACLE_KIND.BOOST: {
      const speed = Math.hypot(car.vx, car.vy);
      let dirx;
      let diry;
      if (obstacle.direction) {
        dirx = obstacle.direction.x;
        diry = obstacle.direction.y;
      } else if (speed > G.EPS) {
        dirx = car.vx / speed;
        diry = car.vy / speed;
      } else {
        dirx = 1; diry = 0;
      }
      const impulse = obstacle.strength;
      car.vx += dirx * impulse;
      car.vy += diry * impulse;
      return {
        kind: OBSTACLE_KIND.BOOST,
        obstacle,
        overlap: contact.overlap,
        impulse,
        direction: { x: dirx, y: diry },
      };
    }
    case OBSTACLE_KIND.HAZARD:
      return {
        kind: OBSTACLE_KIND.HAZARD,
        obstacle,
        overlap: contact.overlap,
        damage: obstacle.strength,
      };
    default:
      return null;
  }
}

module.exports = { resolveWalls, resolveObstacle };

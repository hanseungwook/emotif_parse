'use strict';

const EPS = 1e-9;

function vec(x, y) {
  return { x, y };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(a, s) {
  return { x: a.x * s, y: a.y * s };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function lengthSq(a) {
  return a.x * a.x + a.y * a.y;
}

function length(a) {
  return Math.sqrt(lengthSq(a));
}

function normalize(a) {
  const len = length(a);
  if (len < EPS) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

// Rotate vector 90 degrees CCW (in a +y-up coordinate system).
function perp(a) {
  return { x: -a.y, y: a.x };
}

function distance(a, b) {
  return length(sub(a, b));
}

// Closest point on segment (a,b) to p. Returns { point, t } with t in [0,1].
function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const denom = abx * abx + aby * aby;
  if (denom < EPS) return { point: { x: a.x, y: a.y }, t: 0 };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { point: { x: a.x + abx * t, y: a.y + aby * t }, t };
}

// Intersection of segments (p1,p2) and (p3,p4). Returns null or
// { point, t (along 1st segment), u (along 2nd segment) }.
function segmentIntersection(p1, p2, p3, p4) {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = p4.x - p3.x;
  const sy = p4.y - p3.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < EPS) return null; // parallel or collinear
  const qx = p3.x - p1.x;
  const qy = p3.y - p1.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  const tc = Math.max(0, Math.min(1, t));
  return {
    point: { x: p1.x + rx * tc, y: p1.y + ry * tc },
    t: tc,
    u: Math.max(0, Math.min(1, u)),
  };
}

// Signed side of (a,b) that point p lies on. Positive = left of a→b, negative = right.
function side(a, b, p) {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

// Circle vs segment. Returns null or { point (closest), distance, normal (from segment to circle), t }.
function circleSegmentCollision(center, radius, a, b) {
  const cp = closestPointOnSegment(center, a, b);
  const dx = center.x - cp.point.x;
  const dy = center.y - cp.point.y;
  const distSq = dx * dx + dy * dy;
  const r2 = radius * radius;
  if (distSq > r2) return null;
  const dist = Math.sqrt(distSq);
  let normal;
  if (dist < EPS) {
    // Degenerate: circle center exactly on segment. Use the segment's left normal.
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < EPS) {
      normal = { x: 1, y: 0 };
    } else {
      normal = { x: -(b.y - a.y) / segLen, y: (b.x - a.x) / segLen };
    }
  } else {
    normal = { x: dx / dist, y: dy / dist };
  }
  return { point: cp.point, distance: dist, normal, t: cp.t };
}

// Reflect vector v across the line orthogonal to (unit) normal n.
function reflect(v, n) {
  const k = 2 * (v.x * n.x + v.y * n.y);
  return { x: v.x - n.x * k, y: v.y - n.y * k };
}

// Project vector v onto (unit) vector u.
function project(v, u) {
  const k = v.x * u.x + v.y * u.y;
  return { x: u.x * k, y: u.y * k };
}

// Point-in-polygon by ray casting. polygon is an array of {x,y}.
function pointInPolygon(p, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || EPS) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

module.exports = {
  EPS,
  vec,
  add,
  sub,
  scale,
  dot,
  cross,
  lengthSq,
  length,
  normalize,
  perp,
  distance,
  closestPointOnSegment,
  segmentIntersection,
  side,
  circleSegmentCollision,
  reflect,
  project,
  pointInPolygon,
};

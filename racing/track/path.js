'use strict';

const G = require('./geometry');

const DEFAULT_WIDTH = 80;

// A track path is a polyline (open or closed) with a per-point width.
// Two offset polylines are derived for the two sides of the road (the
// "left" and "right" walls, where left means the +90° perpendicular to
// the direction of travel a→b). Naming is left/right relative to travel,
// not interior/exterior of the loop — that depends on track winding.
class TrackPath {
  constructor(options) {
    const opts = options || {};
    const points = opts.points;
    if (!Array.isArray(points) || points.length < 2) {
      throw new TypeError('TrackPath: points must be an array of at least 2 points');
    }
    this.closed = !!opts.closed;
    const defaultWidth = Number.isFinite(opts.width) ? opts.width : DEFAULT_WIDTH;
    if (defaultWidth <= 0) {
      throw new RangeError('TrackPath: width must be positive');
    }
    this.defaultWidth = defaultWidth;
    this.points = points.map((p, i) => {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new TypeError(`TrackPath: points[${i}] must have finite x and y`);
      }
      const w = Number.isFinite(p.width) ? p.width : this.defaultWidth;
      if (w <= 0) {
        throw new RangeError(`TrackPath: points[${i}].width must be positive`);
      }
      return { x: p.x, y: p.y, width: w };
    });

    this._buildSegments();
    this._buildWalls();
  }

  _buildSegments() {
    const pts = this.points;
    const n = pts.length;
    const lastIdx = this.closed ? n : n - 1;
    const segs = [];
    let cumulative = 0;
    for (let i = 0; i < lastIdx; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < G.EPS) continue;
      const dir = { x: dx / len, y: dy / len };
      const normal = { x: -dir.y, y: dir.x }; // left perpendicular
      segs.push({
        index: segs.length,
        a: { x: a.x, y: a.y, width: a.width },
        b: { x: b.x, y: b.y, width: b.width },
        length: len,
        dir,
        normal,
        startS: cumulative,
        endS: cumulative + len,
      });
      cumulative += len;
    }
    if (segs.length === 0) {
      throw new RangeError('TrackPath: degenerate path (all points coincident)');
    }
    this.segments = segs;
    this.totalLength = cumulative;
  }

  _buildWalls() {
    const pts = this.points;
    const n = pts.length;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const prevP = i === 0 ? (this.closed ? pts[n - 1] : null) : pts[i - 1];
      const nextP = i === n - 1 ? (this.closed ? pts[0] : null) : pts[i + 1];
      const p = pts[i];
      let nrm;
      if (prevP && nextP) {
        const d1 = G.normalize({ x: p.x - prevP.x, y: p.y - prevP.y });
        const d2 = G.normalize({ x: nextP.x - p.x, y: nextP.y - p.y });
        const avg = G.normalize({ x: d1.x + d2.x, y: d1.y + d2.y });
        if (avg.x === 0 && avg.y === 0) {
          // 180° reversal — fall back to outgoing tangent.
          nrm = { x: -d2.y, y: d2.x };
        } else {
          nrm = { x: -avg.y, y: avg.x };
        }
      } else if (nextP) {
        const d = G.normalize({ x: nextP.x - p.x, y: nextP.y - p.y });
        nrm = { x: -d.y, y: d.x };
      } else {
        const d = G.normalize({ x: p.x - prevP.x, y: p.y - prevP.y });
        nrm = { x: -d.y, y: d.x };
      }
      const half = p.width / 2;
      left.push({ x: p.x + nrm.x * half, y: p.y + nrm.y * half });
      right.push({ x: p.x - nrm.x * half, y: p.y - nrm.y * half });
    }
    this.leftWall = left;
    this.rightWall = right;
  }

  // Returns wall segments [{ a, b, side: 'left'|'right', index }] for collision.
  walls() {
    const segs = [];
    const collectFrom = (poly, sideName) => {
      const n = poly.length;
      const last = this.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        segs.push({
          a: { x: a.x, y: a.y },
          b: { x: b.x, y: b.y },
          side: sideName,
          index: segs.length,
        });
      }
    };
    collectFrom(this.leftWall, 'left');
    collectFrom(this.rightWall, 'right');
    return segs;
  }

  // Locate the nearest centerline segment for a query point. Returns
  // { segment, t, distance, s (arc length along path), side (signed) }.
  locate(point) {
    let best = null;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const cp = G.closestPointOnSegment(point, seg.a, seg.b);
      const dx = point.x - cp.point.x;
      const dy = point.y - cp.point.y;
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.distance) {
        const sgn = G.side(seg.a, seg.b, point); // positive = left
        best = {
          segment: seg,
          t: cp.t,
          distance: dist,
          s: seg.startS + cp.t * seg.length,
          side: sgn,
          closest: cp.point,
        };
      }
    }
    return best;
  }

  // Sample the centerline at arc length s. Returns { x, y, width, dir }.
  sample(s) {
    if (this.segments.length === 0) return null;
    let target = s;
    if (this.closed && this.totalLength > 0) {
      target = ((s % this.totalLength) + this.totalLength) % this.totalLength;
    } else if (target < 0) {
      target = 0;
    } else if (target > this.totalLength) {
      target = this.totalLength;
    }
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (target <= seg.endS || i === this.segments.length - 1) {
        const localT = seg.length > 0 ? Math.max(0, Math.min(1, (target - seg.startS) / seg.length)) : 0;
        const x = seg.a.x + (seg.b.x - seg.a.x) * localT;
        const y = seg.a.y + (seg.b.y - seg.a.y) * localT;
        const width = seg.a.width + (seg.b.width - seg.a.width) * localT;
        return { x, y, width, dir: { x: seg.dir.x, y: seg.dir.y } };
      }
    }
    return null;
  }
}

module.exports = { TrackPath, DEFAULT_WIDTH };

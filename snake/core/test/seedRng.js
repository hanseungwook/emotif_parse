'use strict';

// Tiny seeded PRNG (mulberry32) — gives tests reproducible food/obstacle
// placement without pulling in a dependency.
function createSeededRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { createSeededRng };

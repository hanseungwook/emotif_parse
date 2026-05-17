'use strict';

// Deterministic scheduler for runtime tests. Frame requests are queued and
// executed manually via tick()/advance() so we can advance virtual time without
// relying on real timers.
function createMockScheduler(startMs) {
  let current = typeof startMs === 'number' ? startMs : 0;
  let nextId = 1;
  const pending = new Map();

  return {
    now: () => current,
    requestFrame: (cb) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id) => {
      pending.delete(id);
    },
    // Advance time without flushing any frames.
    setNow: (ms) => { current = ms; },
    advance: (deltaMs) => { current += deltaMs; },
    // Run all currently queued frames (snapshot before draining, so callbacks
    // that schedule new frames don't run in the same flush).
    flush: () => {
      const callbacks = Array.from(pending.values());
      pending.clear();
      for (const cb of callbacks) cb(current);
      return callbacks.length;
    },
    // Convenience: advance time then flush.
    tick: (deltaMs) => {
      current += deltaMs;
      const callbacks = Array.from(pending.values());
      pending.clear();
      for (const cb of callbacks) cb(current);
      return callbacks.length;
    },
    pendingCount: () => pending.size,
  };
}

module.exports = { createMockScheduler };

'use strict';

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('handler must be a function');
    }
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this._listeners.get(event);
    if (!set) return false;
    const removed = set.delete(handler);
    if (set.size === 0) this._listeners.delete(event);
    return removed;
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const handler of Array.from(set)) {
      try { handler(payload); } catch (_err) { /* swallow listener errors */ }
    }
    return true;
  }

  listenerCount(event) {
    const set = this._listeners.get(event);
    return set ? set.size : 0;
  }
}

module.exports = { EventBus };

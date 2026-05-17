'use strict';

// Minimal synchronous event emitter — purpose-built so the engine has no
// dependency on Node's events module and can run identically in the browser.
class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (typeof fn !== 'function') throw new TypeError('listener must be a function');
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err) {
        // Listeners must not break the engine loop.
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[snake] listener error on "${event}":`, err);
        }
      }
    }
  }

  removeAllListeners() {
    this._listeners.clear();
  }
}

module.exports = { EventBus };

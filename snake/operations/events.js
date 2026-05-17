'use strict';

class EventEmitter {
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

  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    const set = this._listeners.get(event);
    if (!set) return false;
    const removed = set.delete(handler);
    if (set.size === 0) this._listeners.delete(event);
    return removed;
  }

  emit(event, ...args) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const handler of Array.from(set)) {
      try {
        handler(...args);
      } catch (err) {
        if (event !== 'error') this.emit('error', err);
      }
    }
    return true;
  }

  listenerCount(event) {
    const set = this._listeners.get(event);
    return set ? set.size : 0;
  }

  removeAllListeners(event) {
    if (event === undefined) {
      this._listeners.clear();
    } else {
      this._listeners.delete(event);
    }
  }
}

module.exports = { EventEmitter };

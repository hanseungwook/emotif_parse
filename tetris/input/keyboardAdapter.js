'use strict';

// DOM keyboard adapter — bridges the browser's `keydown`/`keyup` events to the
// InputController. Kept in its own module so the controller core stays free of
// DOM dependencies and is testable in plain Node.

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createDomKeyboardAdapter(options) {
  const opts = options || {};
  const target = opts.target ||
    (typeof window !== 'undefined' ? window : null);
  const preventDefaultCodes = opts.preventDefaultCodes
    ? new Set(opts.preventDefaultCodes)
    : null;
  const interceptCodes = opts.interceptCodes
    ? new Set(opts.interceptCodes)
    : null;

  let onDown = null;
  let onUp = null;
  let domDown = null;
  let domUp = null;

  return {
    on(downHandler, upHandler) {
      if (!target) {
        throw new Error('createDomKeyboardAdapter: no target element provided and no global window available');
      }
      onDown = downHandler;
      onUp = upHandler;
      domDown = (e) => {
        if (interceptCodes && !interceptCodes.has(e.code)) return;
        if (preventDefaultCodes && preventDefaultCodes.has(e.code)) {
          e.preventDefault();
        }
        onDown({ code: e.code, repeat: !!e.repeat, timestamp: nowMs() });
      };
      domUp = (e) => {
        if (interceptCodes && !interceptCodes.has(e.code)) return;
        onUp({ code: e.code, timestamp: nowMs() });
      };
      target.addEventListener('keydown', domDown);
      target.addEventListener('keyup', domUp);
    },
    off() {
      if (target && domDown) target.removeEventListener('keydown', domDown);
      if (target && domUp) target.removeEventListener('keyup', domUp);
      onDown = onUp = domDown = domUp = null;
    },
  };
}

// Minimal in-memory adapter used by tests (and convenient for headless game
// state replays). Records nothing — pushes events through to the controller.
function createMemoryKeyboardAdapter() {
  let onDown = null;
  let onUp = null;
  return {
    on(downHandler, upHandler) {
      onDown = downHandler;
      onUp = upHandler;
    },
    off() {
      onDown = null;
      onUp = null;
    },
    keydown(code, opts) {
      if (!onDown) return;
      const e = opts || {};
      onDown({
        code,
        repeat: !!e.repeat,
        timestamp: typeof e.timestamp === 'number' ? e.timestamp : nowMs(),
      });
    },
    keyup(code, opts) {
      if (!onUp) return;
      const e = opts || {};
      onUp({
        code,
        timestamp: typeof e.timestamp === 'number' ? e.timestamp : nowMs(),
      });
    },
  };
}

module.exports = { createDomKeyboardAdapter, createMemoryKeyboardAdapter };

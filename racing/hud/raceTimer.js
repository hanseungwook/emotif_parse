'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
  schedulerWithFallback,
  cancelWithFallback,
} = require('./domHelpers');
const { formatLapTime, formatRaceTime } = require('./format');

// RaceTimer renders three timing readouts side-by-side: the overall race
// clock, the current lap clock, and the player's best lap so far. When a
// new best lap is recorded the renderer flashes the value to give the
// player visual reinforcement.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-timer',
  block: 'hud-timer__block',
  label: 'hud-timer__label',
  value: 'hud-timer__value',
  bestFlash: 'hud-timer__block--best-flash',
  paused: 'hud-timer--paused',
});

const BEST_FLASH_MS = 1400;

class RaceTimer {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('RaceTimer requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('RaceTimer requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._scheduler = opts.scheduler || schedulerWithFallback();
    this._cancel = opts.cancelScheduler || cancelWithFallback();
    this._mounted = false;
    this._nodes = {};
    this._raceMs = 0;
    this._lapMs = 0;
    this._bestMs = null;
    this._bestFlashTimer = null;
    this._paused = false;
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._build();
    this._render();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    if (this._bestFlashTimer) {
      this._cancel(this._bestFlashTimer);
      this._bestFlashTimer = null;
    }
    clearChildren(this._container);
    this._nodes = {};
  }

  setRaceTime(ms) {
    const n = Number(ms);
    this._raceMs = Number.isFinite(n) && n > 0 ? n : 0;
    if (this._mounted && this._nodes.raceValue) {
      this._nodes.raceValue.textContent = formatRaceTime(this._raceMs);
    }
  }

  setLapTime(ms) {
    const n = Number(ms);
    this._lapMs = Number.isFinite(n) && n > 0 ? n : 0;
    if (this._mounted && this._nodes.lapValue) {
      this._nodes.lapValue.textContent = formatLapTime(this._lapMs);
    }
  }

  setBestLap(ms) {
    if (ms == null) {
      this._bestMs = null;
    } else {
      const n = Number(ms);
      this._bestMs = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (this._mounted && this._nodes.bestValue) {
      this._nodes.bestValue.textContent = this._bestMs == null
        ? '--:--.---'
        : formatLapTime(this._bestMs);
    }
  }

  setPaused(paused) {
    this._paused = paused === true;
    if (!this._mounted) return;
    if (this._paused) {
      this._container.className = appendClass(this._container.className, this._classNames.paused);
    } else {
      this._container.className = removeClass(this._container.className, this._classNames.paused);
    }
  }

  // Flash the best-lap block for a moment to highlight a new personal best.
  flashBest() {
    if (!this._mounted) return;
    const block = this._nodes.bestBlock;
    if (!block) return;
    block.className = appendClass(block.className, this._classNames.bestFlash);
    if (this._bestFlashTimer) this._cancel(this._bestFlashTimer);
    this._bestFlashTimer = this._scheduler(() => {
      this._bestFlashTimer = null;
      if (!this._nodes.bestBlock) return;
      this._nodes.bestBlock.className = removeClass(
        this._nodes.bestBlock.className,
        this._classNames.bestFlash
      );
    }, BEST_FLASH_MS);
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('aria-label', 'Race timer');

    const blocks = [
      { key: 'race', label: 'Race', initial: formatRaceTime(0) },
      { key: 'lap', label: 'Lap', initial: formatLapTime(0) },
      { key: 'best', label: 'Best', initial: '--:--.---' },
    ];
    this._nodes = {};
    for (const meta of blocks) {
      const block = doc.createElement('div');
      block.className = this._classNames.block;
      block.setAttribute('data-timer', meta.key);
      const label = doc.createElement('div');
      label.className = this._classNames.label;
      label.textContent = meta.label;
      const value = doc.createElement('div');
      value.className = this._classNames.value;
      value.setAttribute('data-role', meta.key + '-value');
      value.textContent = meta.initial;
      block.appendChild(label);
      block.appendChild(value);
      this._container.appendChild(block);
      this._nodes[meta.key + 'Block'] = block;
      this._nodes[meta.key + 'Value'] = value;
    }
  }

  _render() {
    if (!this._mounted) return;
    this._nodes.raceValue.textContent = formatRaceTime(this._raceMs);
    this._nodes.lapValue.textContent = formatLapTime(this._lapMs);
    this._nodes.bestValue.textContent = this._bestMs == null
      ? '--:--.---'
      : formatLapTime(this._bestMs);
  }
}

module.exports = { RaceTimer, BEST_FLASH_MS };

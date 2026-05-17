'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
} = require('./domHelpers');

// LapTracker renders the lap counter and a dot-per-checkpoint progress bar
// underneath. Each dot has a state class — pending / next / reached — so
// the renderer can light the upcoming checkpoint differently from the ones
// already cleared.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-lap',
  lapBlock: 'hud-lap__block',
  lapLabel: 'hud-lap__label',
  lapValue: 'hud-lap__value',
  lapTotal: 'hud-lap__total',
  lapSep: 'hud-lap__sep',
  checkpointList: 'hud-lap__checkpoints',
  checkpoint: 'hud-lap__checkpoint',
  checkpointReached: 'hud-lap__checkpoint--reached',
  checkpointNext: 'hud-lap__checkpoint--next',
  checkpointPending: 'hud-lap__checkpoint--pending',
  final: 'hud-lap--final',
  complete: 'hud-lap--complete',
});

class LapTracker {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('LapTracker requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('LapTracker requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._mounted = false;
    this._nodes = {};
    this._currentLap = 1;
    this._totalLaps = 3;
    this._nextCheckpoint = 0;
    this._totalCheckpoints = 4;
    this._complete = false;
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
    clearChildren(this._container);
    this._nodes = {};
  }

  setLap(current, total) {
    if (current !== undefined) {
      const n = Math.floor(Number(current));
      if (Number.isFinite(n) && n >= 1) this._currentLap = n;
    }
    if (total !== undefined) {
      const n = Math.floor(Number(total));
      if (Number.isFinite(n) && n >= 1) {
        this._totalLaps = n;
        // If the renderer hasn't been built yet, just track the value; the
        // next mount cycle will reflect it.
        if (this._mounted) this._rebuildIfNeeded();
      }
    }
    if (this._mounted) this._render();
  }

  setCheckpoint(nextIndex, total) {
    if (nextIndex !== undefined) {
      const n = Math.floor(Number(nextIndex));
      if (Number.isFinite(n) && n >= 0) this._nextCheckpoint = n;
    }
    if (total !== undefined) {
      const n = Math.floor(Number(total));
      if (Number.isFinite(n) && n >= 1) {
        this._totalCheckpoints = n;
        if (this._mounted) this._rebuildCheckpoints();
      }
    }
    if (this._mounted) this._render();
  }

  setComplete(complete) {
    this._complete = complete === true;
    if (this._mounted) this._render();
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('aria-label', 'Lap progress');

    const block = doc.createElement('div');
    block.className = this._classNames.lapBlock;

    const label = doc.createElement('div');
    label.className = this._classNames.lapLabel;
    label.textContent = 'Lap';

    const value = doc.createElement('div');
    value.className = this._classNames.lapValue;
    value.setAttribute('data-role', 'lap-current');
    value.textContent = '1';

    const sep = doc.createElement('div');
    sep.className = this._classNames.lapSep;
    sep.textContent = '/';

    const total = doc.createElement('div');
    total.className = this._classNames.lapTotal;
    total.setAttribute('data-role', 'lap-total');
    total.textContent = String(this._totalLaps);

    block.appendChild(label);
    block.appendChild(value);
    block.appendChild(sep);
    block.appendChild(total);

    const list = doc.createElement('div');
    list.className = this._classNames.checkpointList;
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Checkpoints');
    list.setAttribute('data-role', 'checkpoint-list');

    this._container.appendChild(block);
    this._container.appendChild(list);

    this._nodes = {
      block,
      label,
      value,
      sep,
      total,
      checkpointList: list,
      checkpointDots: [],
    };
    this._rebuildCheckpoints();
  }

  _rebuildIfNeeded() {
    if (this._nodes.total) this._nodes.total.textContent = String(this._totalLaps);
  }

  _rebuildCheckpoints() {
    const doc = this._document;
    const list = this._nodes.checkpointList;
    if (!list) return;
    clearChildren(list);
    this._nodes.checkpointDots = [];
    for (let i = 0; i < this._totalCheckpoints; i++) {
      const dot = doc.createElement('span');
      dot.className = this._classNames.checkpoint;
      dot.setAttribute('role', 'listitem');
      dot.setAttribute('data-checkpoint-index', String(i));
      list.appendChild(dot);
      this._nodes.checkpointDots.push(dot);
    }
  }

  _render() {
    if (!this._mounted) return;
    if (this._nodes.value) this._nodes.value.textContent = String(this._currentLap);
    if (this._nodes.total) this._nodes.total.textContent = String(this._totalLaps);

    let containerCls = this._container.className;
    containerCls = removeClass(containerCls, this._classNames.final);
    containerCls = removeClass(containerCls, this._classNames.complete);
    if (this._currentLap >= this._totalLaps) {
      containerCls = appendClass(containerCls, this._classNames.final);
    }
    if (this._complete) {
      containerCls = appendClass(containerCls, this._classNames.complete);
    }
    this._container.className = containerCls;

    const dots = this._nodes.checkpointDots || [];
    const next = this._nextCheckpoint;
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      let cls = removeClass(dot.className, this._classNames.checkpointReached);
      cls = removeClass(cls, this._classNames.checkpointNext);
      cls = removeClass(cls, this._classNames.checkpointPending);
      let state = 'pending';
      if (i < next) state = 'reached';
      else if (i === next) state = 'next';
      if (state === 'reached') cls = appendClass(cls, this._classNames.checkpointReached);
      else if (state === 'next') cls = appendClass(cls, this._classNames.checkpointNext);
      else cls = appendClass(cls, this._classNames.checkpointPending);
      dot.className = cls;
      dot.setAttribute('data-state', state);
    }
  }
}

module.exports = { LapTracker };

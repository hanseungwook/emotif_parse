// Renders the score / level / lines / combo readouts. Pulses each value
// briefly when it changes so a player gets visual feedback even outside the
// playfield. Combo and "last clear" badges surface scoring streaks at a
// glance.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-score',
  block: 'hud-score__block',
  blockLabel: 'hud-score__label',
  blockValue: 'hud-score__value',
  pulse: 'is-pulse',
  combo: 'hud-score__combo',
  comboActive: 'hud-score__combo--active',
  comboValue: 'hud-score__combo-value',
  comboLabel: 'hud-score__combo-label',
  clear: 'hud-score__clear',
  clearVisible: 'is-visible',
  clearType: 'hud-score__clear-type',
  clearPoints: 'hud-score__clear-points',
  clearPerfect: 'hud-score__clear--perfect',
});

const PULSE_DURATION_MS = 600;
const CLEAR_BANNER_MS = 1400;

function resolveDocument(opts) {
  if (opts && opts.document) return opts.document;
  if (opts && opts.container && opts.container.ownerDocument) {
    return opts.container.ownerDocument;
  }
  if (typeof document !== 'undefined') return document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

function formatNumber(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '0';
  const value = Math.max(0, Math.floor(Number(n)));
  return value.toLocaleString('en-US');
}

function describeClear(detail) {
  if (!detail) return null;
  switch (detail.type) {
    case 'single': return 'Single';
    case 'double': return 'Double';
    case 'triple': return 'Triple';
    case 'tetris': return 'TETRIS!';
    case 'tspin': return 'T-Spin';
    case 'tspinMini': return 'T-Spin Mini';
    case 'perfectClear': return 'Perfect Clear';
    default:
      if (detail.lines === 4) return 'TETRIS!';
      if (detail.lines === 3) return 'Triple';
      if (detail.lines === 2) return 'Double';
      if (detail.lines === 1) return 'Single';
      return null;
  }
}

export class ScorePanel {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('ScorePanel requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('ScorePanel requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._scheduler = opts.scheduler || schedulerWithFallback();
    this._cancel = opts.cancelScheduler || cancelWithFallback();
    this._mounted = false;
    this._nodes = {};
    this._timers = new Map();
    this._lastClearTimer = null;
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._build();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const [, timer] of this._timers) this._cancel(timer);
    this._timers.clear();
    if (this._lastClearTimer) {
      this._cancel(this._lastClearTimer);
      this._lastClearTimer = null;
    }
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._nodes = {};
  }

  setScore(value) {
    this._writeStat('score', value, true);
  }

  setBestScore(value) {
    this._writeStat('best', value, false);
  }

  setLevel(value) {
    this._writeStat('level', value, true);
  }

  setLines(value) {
    this._writeStat('lines', value, true);
  }

  setCombo(value) {
    if (!this._mounted) return;
    const comboValue = this._nodes.comboValue;
    const comboRoot = this._nodes.combo;
    if (!comboValue || !comboRoot) return;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    comboValue.textContent = String(n);
    if (n > 1) {
      comboRoot.className = this._appendClass(
        comboRoot.className,
        this._classNames.comboActive
      );
      this._pulse('combo');
    } else {
      comboRoot.className = this._removeClass(
        comboRoot.className,
        this._classNames.comboActive
      );
    }
  }

  showClear(detail) {
    if (!this._mounted) return;
    const banner = this._nodes.clear;
    const type = this._nodes.clearType;
    const points = this._nodes.clearPoints;
    if (!banner || !type || !points) return;
    const label = describeClear(detail);
    if (!label) {
      this._hideClear();
      return;
    }
    type.textContent = label;
    points.textContent = detail && detail.points ? `+${formatNumber(detail.points)}` : '';
    banner.className = this._appendClass(banner.className, this._classNames.clearVisible);
    if (detail && detail.perfect) {
      banner.className = this._appendClass(banner.className, this._classNames.clearPerfect);
    } else {
      banner.className = this._removeClass(banner.className, this._classNames.clearPerfect);
    }
    if (this._lastClearTimer) this._cancel(this._lastClearTimer);
    this._lastClearTimer = this._scheduler(() => {
      this._lastClearTimer = null;
      this._hideClear();
    }, CLEAR_BANNER_MS);
  }

  hideClear() {
    this._hideClear();
  }

  _hideClear() {
    if (!this._mounted) return;
    const banner = this._nodes.clear;
    if (!banner) return;
    banner.className = this._removeClass(banner.className, this._classNames.clearVisible);
    banner.className = this._removeClass(banner.className, this._classNames.clearPerfect);
  }

  _build() {
    const doc = this._document;
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._container.className = this._appendClass(
      this._container.className,
      this._classNames.root
    );

    this._nodes = {};
    const blocks = [
      { key: 'score', label: 'Score' },
      { key: 'level', label: 'Level' },
      { key: 'lines', label: 'Lines' },
      { key: 'best', label: 'Best' },
    ];
    for (const meta of blocks) {
      const block = doc.createElement('div');
      block.className = this._classNames.block;
      block.setAttribute('data-stat', meta.key);
      const label = doc.createElement('div');
      label.className = this._classNames.blockLabel;
      label.textContent = meta.label;
      const value = doc.createElement('div');
      value.className = this._classNames.blockValue;
      value.textContent = '0';
      block.appendChild(label);
      block.appendChild(value);
      this._container.appendChild(block);
      this._nodes[meta.key] = block;
      this._nodes[`${meta.key}Value`] = value;
    }

    const combo = doc.createElement('div');
    combo.className = this._classNames.combo;
    combo.setAttribute('data-stat', 'combo');
    combo.setAttribute('aria-live', 'polite');
    const comboLabel = doc.createElement('span');
    comboLabel.className = this._classNames.comboLabel;
    comboLabel.textContent = 'Combo';
    const comboValue = doc.createElement('span');
    comboValue.className = this._classNames.comboValue;
    comboValue.textContent = '0';
    combo.appendChild(comboLabel);
    combo.appendChild(comboValue);
    this._container.appendChild(combo);
    this._nodes.combo = combo;
    this._nodes.comboValue = comboValue;

    const clear = doc.createElement('div');
    clear.className = this._classNames.clear;
    clear.setAttribute('data-stat', 'clear');
    clear.setAttribute('aria-live', 'polite');
    const clearType = doc.createElement('span');
    clearType.className = this._classNames.clearType;
    clearType.textContent = '';
    const clearPoints = doc.createElement('span');
    clearPoints.className = this._classNames.clearPoints;
    clearPoints.textContent = '';
    clear.appendChild(clearType);
    clear.appendChild(clearPoints);
    this._container.appendChild(clear);
    this._nodes.clear = clear;
    this._nodes.clearType = clearType;
    this._nodes.clearPoints = clearPoints;
  }

  _writeStat(key, value, pulse) {
    if (!this._mounted) return;
    const node = this._nodes[`${key}Value`];
    if (!node) return;
    node.textContent = formatNumber(value);
    if (pulse) this._pulse(key);
  }

  _pulse(key) {
    const node = this._nodes[key];
    if (!node) return;
    const pulseClass = this._classNames.pulse;
    node.className = this._appendClass(node.className, pulseClass);
    const existing = this._timers.get(key);
    if (existing) this._cancel(existing);
    const timer = this._scheduler(() => {
      this._timers.delete(key);
      const target = this._nodes[key];
      if (!target) return;
      target.className = this._removeClass(target.className, pulseClass);
    }, PULSE_DURATION_MS);
    this._timers.set(key, timer);
  }

  _appendClass(base, addition) {
    const list = (base || '').split(' ').filter(Boolean);
    if (addition && !list.includes(addition)) list.push(addition);
    return list.join(' ');
  }

  _removeClass(base, removal) {
    if (!removal) return base || '';
    return (base || '').split(' ').filter((c) => c && c !== removal).join(' ');
  }
}

function schedulerWithFallback() {
  if (typeof globalThis.setTimeout === 'function') {
    return (cb, ms) => globalThis.setTimeout(cb, ms);
  }
  return () => null;
}

function cancelWithFallback() {
  if (typeof globalThis.clearTimeout === 'function') {
    return (handle) => globalThis.clearTimeout(handle);
  }
  return () => undefined;
}

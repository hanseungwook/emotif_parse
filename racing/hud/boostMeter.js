'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
  setStyleProperty,
} = require('./domHelpers');
const { formatBoostPercent } = require('./format');

// Renders a horizontal boost meter. The fill bar tracks the current boost
// amount as a fraction of capacity and exposes a "depleting" class while
// the player is actively burning boost so renderers can paint a flame /
// glow effect.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-boost',
  label: 'hud-boost__label',
  meter: 'hud-boost__meter',
  fill: 'hud-boost__fill',
  value: 'hud-boost__value',
  active: 'hud-boost--active',
  empty: 'hud-boost--empty',
  full: 'hud-boost--full',
  low: 'hud-boost--low',
});

// Thresholds used by the modifier classes. The `low` class is added once the
// meter dips below 25% so the renderer can pulse the bar to warn the player.
const LOW_BOOST_THRESHOLD = 0.25;

class BoostMeter {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('BoostMeter requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('BoostMeter requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._title = typeof opts.title === 'string' ? opts.title : 'Boost';
    this._mounted = false;
    this._nodes = {};
    this._value = 0;
    this._capacity = Number(opts.capacity) > 0 ? Number(opts.capacity) : 100;
    this._active = false;
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

  setBoost(value, active) {
    const v = Number(value);
    this._value = Number.isFinite(v) ? Math.max(0, Math.min(v, this._capacity)) : 0;
    if (active !== undefined) this._active = active === true;
    if (this._mounted) this._render();
  }

  setActive(active) {
    this._active = active === true;
    if (this._mounted) this._render();
  }

  setCapacity(capacity) {
    const next = Number(capacity);
    if (Number.isFinite(next) && next > 0) {
      this._capacity = next;
      if (this._value > next) this._value = next;
    }
    if (this._mounted) this._render();
  }

  getRatio() {
    if (this._capacity <= 0) return 0;
    return Math.max(0, Math.min(1, this._value / this._capacity));
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('role', 'meter');
    this._container.setAttribute('aria-label', this._title);

    const label = doc.createElement('div');
    label.className = this._classNames.label;
    label.textContent = this._title;

    const meter = doc.createElement('div');
    meter.className = this._classNames.meter;
    meter.setAttribute('data-role', 'boost-meter');

    const fill = doc.createElement('div');
    fill.className = this._classNames.fill;
    fill.setAttribute('data-role', 'boost-fill');
    meter.appendChild(fill);

    const value = doc.createElement('div');
    value.className = this._classNames.value;
    value.setAttribute('data-role', 'boost-value');
    value.textContent = '0%';

    this._container.appendChild(label);
    this._container.appendChild(meter);
    this._container.appendChild(value);

    this._nodes = { label, meter, fill, value };
  }

  _render() {
    if (!this._mounted) return;
    const ratio = this.getRatio();
    const percent = formatBoostPercent(this._value, this._capacity);
    this._nodes.value.textContent = percent;
    setStyleProperty(this._nodes.fill, 'width', (ratio * 100).toFixed(2) + '%');
    setStyleProperty(this._nodes.fill, '--hud-boost-ratio', ratio.toFixed(3));
    this._nodes.fill.setAttribute('data-ratio', ratio.toFixed(3));
    this._container.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    this._container.setAttribute('aria-valuemin', '0');
    this._container.setAttribute('aria-valuemax', '100');

    let cls = this._container.className;
    cls = removeClass(cls, this._classNames.active);
    cls = removeClass(cls, this._classNames.empty);
    cls = removeClass(cls, this._classNames.full);
    cls = removeClass(cls, this._classNames.low);
    if (this._active && ratio > 0) cls = appendClass(cls, this._classNames.active);
    if (ratio <= 0) cls = appendClass(cls, this._classNames.empty);
    else if (ratio >= 1) cls = appendClass(cls, this._classNames.full);
    else if (ratio < LOW_BOOST_THRESHOLD) cls = appendClass(cls, this._classNames.low);
    this._container.className = cls;
  }
}

module.exports = { BoostMeter, LOW_BOOST_THRESHOLD };

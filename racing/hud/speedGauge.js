'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
  setStyleProperty,
} = require('./domHelpers');
const { formatSpeed } = require('./format');

// Speed display: a big numeric readout plus a thin "redline" bar that tracks
// the current speed as a fraction of the top speed. Adds a class when the
// player is in the top ~10% so the gauge can pulse for the speed-thrill feel.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-speed',
  value: 'hud-speed__value',
  unit: 'hud-speed__unit',
  bar: 'hud-speed__bar',
  fill: 'hud-speed__fill',
  redline: 'hud-speed--redline',
  reverse: 'hud-speed--reverse',
});

const REDLINE_THRESHOLD = 0.9;

class SpeedGauge {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('SpeedGauge requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('SpeedGauge requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._mounted = false;
    this._nodes = {};
    this._speed = 0;
    this._maxSpeed = Number(opts.maxSpeed) > 0 ? Number(opts.maxSpeed) : 320;
    this._unit = typeof opts.unit === 'string' ? opts.unit : 'km/h';
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

  setSpeed(value) {
    const v = Number(value);
    this._speed = Number.isFinite(v) ? v : 0;
    if (this._mounted) this._render();
  }

  setMaxSpeed(max) {
    const m = Number(max);
    if (Number.isFinite(m) && m > 0) this._maxSpeed = m;
    if (this._mounted) this._render();
  }

  setUnit(unit) {
    if (typeof unit === 'string' && unit) {
      this._unit = unit;
      if (this._mounted && this._nodes.unit) this._nodes.unit.textContent = this._unit;
    }
  }

  getRatio() {
    if (this._maxSpeed <= 0) return 0;
    const r = this._speed / this._maxSpeed;
    return Math.max(0, Math.min(1, r));
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('role', 'group');
    this._container.setAttribute('aria-label', 'Speed');

    const value = doc.createElement('div');
    value.className = this._classNames.value;
    value.setAttribute('data-role', 'speed-value');
    value.setAttribute('aria-live', 'off');
    value.textContent = '0';

    const unit = doc.createElement('div');
    unit.className = this._classNames.unit;
    unit.setAttribute('data-role', 'speed-unit');
    unit.textContent = this._unit;

    const bar = doc.createElement('div');
    bar.className = this._classNames.bar;
    bar.setAttribute('data-role', 'speed-bar');

    const fill = doc.createElement('div');
    fill.className = this._classNames.fill;
    fill.setAttribute('data-role', 'speed-fill');
    bar.appendChild(fill);

    this._container.appendChild(value);
    this._container.appendChild(unit);
    this._container.appendChild(bar);

    this._nodes = { value, unit, bar, fill };
  }

  _render() {
    if (!this._mounted) return;
    const ratio = this.getRatio();
    const speedAbs = Math.abs(this._speed);
    this._nodes.value.textContent = formatSpeed(speedAbs);
    this._nodes.unit.textContent = this._unit;
    setStyleProperty(this._nodes.fill, 'width', (ratio * 100).toFixed(2) + '%');
    setStyleProperty(this._nodes.fill, '--hud-speed-ratio', ratio.toFixed(3));
    this._nodes.fill.setAttribute('data-ratio', ratio.toFixed(3));
    this._container.setAttribute('aria-valuenow', String(Math.round(speedAbs)));
    this._container.setAttribute('aria-valuemin', '0');
    this._container.setAttribute('aria-valuemax', String(Math.round(this._maxSpeed)));

    let cls = this._container.className;
    cls = removeClass(cls, this._classNames.redline);
    cls = removeClass(cls, this._classNames.reverse);
    if (ratio >= REDLINE_THRESHOLD) cls = appendClass(cls, this._classNames.redline);
    if (this._speed < 0) cls = appendClass(cls, this._classNames.reverse);
    this._container.className = cls;
  }
}

module.exports = { SpeedGauge, REDLINE_THRESHOLD };

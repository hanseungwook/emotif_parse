'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
} = require('./domHelpers');

// Countdown overlay: the giant number/text the player sees right before a
// race starts (3 → 2 → 1 → GO!). The display state is driven by the
// gameplay runtime via `setValue(value)` — the panel just renders whatever
// it is told and decides whether to be visible.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-countdown',
  hidden: 'hud-countdown--hidden',
  go: 'hud-countdown--go',
  number: 'hud-countdown__number',
  text: 'hud-countdown__text',
});

const GO_SENTINEL = 'GO';

function describeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return { kind: 'text', text: trimmed.toUpperCase() };
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return { kind: 'text', text: GO_SENTINEL };
  return { kind: 'number', text: String(Math.floor(n)) };
}

class Countdown {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('Countdown requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('Countdown requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._mounted = false;
    this._nodes = {};
    this._value = null;
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

  setValue(value) {
    this._value = value;
    if (this._mounted) this._render();
  }

  hide() {
    this.setValue(null);
  }

  isVisible() {
    return this._value !== null && this._value !== undefined;
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('role', 'status');
    this._container.setAttribute('aria-live', 'assertive');

    const number = doc.createElement('div');
    number.className = this._classNames.number;
    number.setAttribute('data-role', 'countdown-number');

    const text = doc.createElement('div');
    text.className = this._classNames.text;
    text.setAttribute('data-role', 'countdown-text');

    this._container.appendChild(number);
    this._container.appendChild(text);

    this._nodes = { number, text };
  }

  _render() {
    if (!this._mounted) return;
    const desc = describeValue(this._value);
    let cls = this._container.className;
    cls = removeClass(cls, this._classNames.hidden);
    cls = removeClass(cls, this._classNames.go);
    if (!desc) {
      cls = appendClass(cls, this._classNames.hidden);
      this._container.className = cls;
      this._container.setAttribute('aria-hidden', 'true');
      if (this._container.style) this._container.style.display = 'none';
      if (this._nodes.number) this._nodes.number.textContent = '';
      if (this._nodes.text) this._nodes.text.textContent = '';
      this._container.removeAttribute('data-countdown');
      return;
    }
    this._container.setAttribute('aria-hidden', 'false');
    if (this._container.style) this._container.style.display = '';
    if (desc.kind === 'number') {
      this._nodes.number.textContent = desc.text;
      this._nodes.text.textContent = '';
      this._container.setAttribute('data-countdown', desc.text);
    } else {
      this._nodes.number.textContent = '';
      this._nodes.text.textContent = desc.text;
      this._container.setAttribute('data-countdown', desc.text);
      cls = appendClass(cls, this._classNames.go);
    }
    this._container.className = cls;
  }
}

module.exports = { Countdown, GO_SENTINEL };

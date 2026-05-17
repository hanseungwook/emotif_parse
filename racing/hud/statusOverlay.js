'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
} = require('./domHelpers');
const { formatLapTime, formatRaceTime, formatOrdinal } = require('./format');
const { STATUS } = require('./hudState');

// StatusOverlay sits on top of the track surface and is visible whenever
// the player is not actively racing — at the start grid (idle), during a
// pause, and after the finish line. It provides the Start / Resume /
// Restart affordances and emits intent events that the runtime listens to.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-overlay',
  hidden: 'hud-overlay--hidden',
  panel: 'hud-overlay__panel',
  title: 'hud-overlay__title',
  message: 'hud-overlay__message',
  meta: 'hud-overlay__meta',
  metaItem: 'hud-overlay__meta-item',
  actions: 'hud-overlay__actions',
  primary: 'hud-overlay__action hud-overlay__action--primary',
  secondary: 'hud-overlay__action hud-overlay__action--secondary',
  hint: 'hud-overlay__hint',
  variantIdle: 'hud-overlay--idle',
  variantPaused: 'hud-overlay--paused',
  variantFinished: 'hud-overlay--finished',
  variantCountdown: 'hud-overlay--countdown',
});

const VARIANT_BY_STATUS = Object.freeze({
  [STATUS.IDLE]: 'variantIdle',
  [STATUS.PAUSED]: 'variantPaused',
  [STATUS.FINISHED]: 'variantFinished',
  [STATUS.COUNTDOWN]: 'variantCountdown',
});

const COPY = Object.freeze({
  [STATUS.IDLE]: {
    title: 'Ready to Race',
    message: 'Light up the engine and hit the throttle.',
    primary: 'Start Race',
    secondary: null,
    hint: 'Press Enter to launch',
  },
  [STATUS.PAUSED]: {
    title: 'Race Paused',
    message: 'Catch your breath. The track is waiting.',
    primary: 'Resume',
    secondary: 'Restart',
    hint: 'Press P or Esc to resume',
  },
  [STATUS.FINISHED]: {
    title: 'Race Complete',
    message: 'Nice run. Want to push for a better time?',
    primary: 'Race Again',
    secondary: null,
    hint: 'Press Enter to restart',
  },
  [STATUS.COUNTDOWN]: {
    title: 'Get Ready',
    message: 'Hold the wheel — green light is coming.',
    primary: null,
    secondary: null,
    hint: '',
  },
});

class StatusOverlay {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('StatusOverlay requires a container');
    if (!opts.hudState) throw new TypeError('StatusOverlay requires hudState');
    this._container = opts.container;
    this._hudState = opts.hudState;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('StatusOverlay requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._copy = { ...COPY, ...(opts.copy || {}) };
    this._mounted = false;
    this._nodes = {};
    this._unsubscribers = [];
    this._handlers = {
      primary: () => this._dispatchPrimary(),
      secondary: () => this._dispatchSecondary(),
    };
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._build();
    this._applyState();
    this._unsubscribers.push(
      this._hudState.on('status:change', () => this._applyState()),
      this._hudState.on('race:finish', () => this._applyState()),
      this._hudState.on('lap:complete', () => this._applyState()),
      this._hudState.on('reset', () => this._applyState()),
      this._hudState.on('position:change', () => this._applyState())
    );
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const off of this._unsubscribers) {
      try { off(); } catch (_e) { /* ignore */ }
    }
    this._unsubscribers = [];
    if (this._nodes.primaryBtn) {
      this._removeListener(this._nodes.primaryBtn, 'click', this._handlers.primary);
    }
    if (this._nodes.secondaryBtn) {
      this._removeListener(this._nodes.secondaryBtn, 'click', this._handlers.secondary);
    }
    clearChildren(this._container);
    this._nodes = {};
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('role', 'dialog');
    this._container.setAttribute('aria-modal', 'false');

    const panel = doc.createElement('div');
    panel.className = this._classNames.panel;

    const title = doc.createElement('h2');
    title.className = this._classNames.title;

    const message = doc.createElement('p');
    message.className = this._classNames.message;

    const meta = doc.createElement('div');
    meta.className = this._classNames.meta;
    meta.setAttribute('aria-live', 'polite');

    const actions = doc.createElement('div');
    actions.className = this._classNames.actions;

    const primary = doc.createElement('button');
    primary.type = 'button';
    primary.className = this._classNames.primary;
    primary.setAttribute('data-action', 'primary');

    const secondary = doc.createElement('button');
    secondary.type = 'button';
    secondary.className = this._classNames.secondary;
    secondary.setAttribute('data-action', 'secondary');

    actions.appendChild(primary);
    actions.appendChild(secondary);

    const hint = doc.createElement('p');
    hint.className = this._classNames.hint;

    panel.appendChild(title);
    panel.appendChild(message);
    panel.appendChild(meta);
    panel.appendChild(actions);
    panel.appendChild(hint);
    this._container.appendChild(panel);

    this._addListener(primary, 'click', this._handlers.primary);
    this._addListener(secondary, 'click', this._handlers.secondary);

    this._nodes = {
      panel,
      title,
      message,
      meta,
      actions,
      primaryBtn: primary,
      secondaryBtn: secondary,
      hint,
    };
  }

  _applyState() {
    if (!this._mounted) return;
    const state = this._hudState.getState();
    const status = state.status;
    const copy = this._copy[status];

    if (status === STATUS.RACING || !copy) {
      this._hide();
      return;
    }

    this._show(status);
    this._nodes.title.textContent = copy.title;
    this._nodes.message.textContent = copy.message;
    this._nodes.hint.textContent = copy.hint || '';

    if (copy.primary) {
      this._nodes.primaryBtn.textContent = copy.primary;
      this._nodes.primaryBtn.setAttribute('data-intent', this._intentFor(status, 'primary'));
      this._showButton(this._nodes.primaryBtn);
    } else {
      this._nodes.primaryBtn.textContent = '';
      this._hideButton(this._nodes.primaryBtn);
    }

    if (copy.secondary) {
      this._nodes.secondaryBtn.textContent = copy.secondary;
      this._nodes.secondaryBtn.setAttribute('data-intent', this._intentFor(status, 'secondary'));
      this._showButton(this._nodes.secondaryBtn);
    } else {
      this._nodes.secondaryBtn.textContent = '';
      this._hideButton(this._nodes.secondaryBtn);
    }

    this._renderMeta(state, status);
  }

  _renderMeta(state, status) {
    const meta = this._nodes.meta;
    clearChildren(meta);
    if (status === STATUS.FINISHED) {
      if (state.position != null) {
        const label = state.totalRacers
          ? `${formatOrdinal(state.position)} / ${state.totalRacers}`
          : formatOrdinal(state.position);
        this._appendMeta(meta, 'Finish', label);
      }
      this._appendMeta(meta, 'Race Time', formatRaceTime(state.raceTime));
      if (state.bestLap != null) {
        this._appendMeta(meta, 'Best Lap', formatLapTime(state.bestLap));
      }
      this._appendMeta(meta, 'Laps', `${state.totalLaps} / ${state.totalLaps}`);
    } else if (status === STATUS.PAUSED) {
      this._appendMeta(meta, 'Lap', `${state.currentLap} / ${state.totalLaps}`);
      this._appendMeta(meta, 'Race Time', formatRaceTime(state.raceTime));
      if (state.bestLap != null) {
        this._appendMeta(meta, 'Best Lap', formatLapTime(state.bestLap));
      }
    } else if (status === STATUS.IDLE) {
      this._appendMeta(meta, 'Laps', String(state.totalLaps));
      this._appendMeta(meta, 'Top Speed', `${Math.round(state.maxSpeed)} ${state.speedUnit}`);
    }
  }

  _appendMeta(parent, label, value) {
    const item = this._document.createElement('div');
    item.className = this._classNames.metaItem;
    const k = this._document.createElement('span');
    k.textContent = label;
    const v = this._document.createElement('strong');
    v.textContent = value;
    item.appendChild(k);
    item.appendChild(v);
    parent.appendChild(item);
  }

  _intentFor(status, slot) {
    if (status === STATUS.IDLE) return 'start';
    if (status === STATUS.FINISHED) return 'restart';
    if (status === STATUS.PAUSED && slot === 'primary') return 'resume';
    if (status === STATUS.PAUSED && slot === 'secondary') return 'restart';
    return 'none';
  }

  _dispatchPrimary() {
    const status = this._hudState.getState().status;
    if (status === STATUS.IDLE) {
      this._hudState.requestStart({ reason: 'idle' });
    } else if (status === STATUS.PAUSED) {
      this._hudState.requestResume();
    } else if (status === STATUS.FINISHED) {
      this._hudState.requestRestart({ reason: 'finished' });
    }
  }

  _dispatchSecondary() {
    const status = this._hudState.getState().status;
    if (status === STATUS.PAUSED) {
      this._hudState.requestRestart({ reason: 'paused' });
    }
  }

  _show(status) {
    this._container.className = removeClass(this._container.className, this._classNames.hidden);
    if (typeof this._container.removeAttribute === 'function') {
      this._container.removeAttribute('hidden');
    }
    this._container.setAttribute('aria-hidden', 'false');
    if (this._container.style) this._container.style.display = '';
    const variantKey = VARIANT_BY_STATUS[status];
    const variantClass = variantKey ? this._classNames[variantKey] : null;
    for (const key of Object.values(VARIANT_BY_STATUS)) {
      const c = this._classNames[key];
      if (c && c !== variantClass) {
        this._container.className = removeClass(this._container.className, c);
      }
    }
    if (variantClass) {
      this._container.className = appendClass(this._container.className, variantClass);
    }
    this._container.setAttribute('data-status', status);
  }

  _hide() {
    this._container.className = appendClass(this._container.className, this._classNames.hidden);
    this._container.setAttribute('aria-hidden', 'true');
    if (this._container.style) this._container.style.display = 'none';
    this._container.setAttribute('data-status', STATUS.RACING);
  }

  _showButton(btn) {
    if (!btn) return;
    if (typeof btn.removeAttribute === 'function') btn.removeAttribute('hidden');
    btn.setAttribute('aria-hidden', 'false');
    if (btn.style) btn.style.display = '';
  }

  _hideButton(btn) {
    if (!btn) return;
    btn.setAttribute('hidden', 'hidden');
    btn.setAttribute('aria-hidden', 'true');
    if (btn.style) btn.style.display = 'none';
  }

  _addListener(node, event, handler) {
    if (node && typeof node.addEventListener === 'function') {
      node.addEventListener(event, handler);
    } else if (node) {
      node[`on${event}`] = handler;
    }
  }

  _removeListener(node, event, handler) {
    if (node && typeof node.removeEventListener === 'function') {
      node.removeEventListener(event, handler);
    } else if (node) {
      node[`on${event}`] = null;
    }
  }
}

module.exports = { StatusOverlay, VARIANT_BY_STATUS, COPY };

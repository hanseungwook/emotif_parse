import { STATUS } from './hudState.mjs';

// Overlay surface shown on top of the playfield when the game is in a
// non-playing state (ready, paused, game over). Provides the primary action
// affordance — Start / Resume / Restart — and emits intent events that the
// gameplay runtime listens for.

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
  variantReady: 'hud-overlay--ready',
  variantPaused: 'hud-overlay--paused',
  variantGameOver: 'hud-overlay--game-over',
  hint: 'hud-overlay__hint',
});

function resolveDocument(opts) {
  if (opts && opts.document) return opts.document;
  if (opts && opts.container && opts.container.ownerDocument) {
    return opts.container.ownerDocument;
  }
  if (typeof document !== 'undefined') return document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

const VARIANT_BY_STATUS = Object.freeze({
  [STATUS.READY]: 'variantReady',
  [STATUS.PAUSED]: 'variantPaused',
  [STATUS.GAME_OVER]: 'variantGameOver',
});

const COPY = Object.freeze({
  [STATUS.READY]: {
    title: 'Modern Tetris',
    message: 'Drop pieces, clear lines, chase your best.',
    primary: 'Start',
    secondary: null,
    hint: 'Press Enter / Space to start',
  },
  [STATUS.PAUSED]: {
    title: 'Paused',
    message: 'Take a breath. Your run is waiting.',
    primary: 'Resume',
    secondary: 'Restart',
    hint: 'Press P or Esc to resume',
  },
  [STATUS.GAME_OVER]: {
    title: 'Game Over',
    message: 'Nice run. Ready to try again?',
    primary: 'Restart',
    secondary: null,
    hint: 'Press Enter to restart',
  },
});

export class StatusOverlay {
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
      this._hudState.on('score:change', () => this._applyState()),
      this._hudState.on('bestScore:change', () => this._applyState()),
      this._hudState.on('level:change', () => this._applyState()),
      this._hudState.on('lines:change', () => this._applyState())
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
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._nodes = {};
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

    if (status === STATUS.PLAYING || !copy) {
      this._hide();
      return;
    }

    this._show(status);
    this._nodes.title.textContent = copy.title;
    this._nodes.message.textContent = copy.message;
    this._nodes.hint.textContent = copy.hint || '';

    // Primary button
    this._nodes.primaryBtn.textContent = copy.primary;
    this._nodes.primaryBtn.setAttribute('data-intent', this._intentFor(status, 'primary'));

    // Secondary button (only used during pause for "Restart")
    if (copy.secondary) {
      this._nodes.secondaryBtn.textContent = copy.secondary;
      this._nodes.secondaryBtn.setAttribute('data-intent', this._intentFor(status, 'secondary'));
      this._nodes.secondaryBtn.removeAttribute?.('hidden');
      this._nodes.secondaryBtn.setAttribute('aria-hidden', 'false');
      if (this._nodes.secondaryBtn.style) {
        this._nodes.secondaryBtn.style.display = '';
      }
    } else {
      this._nodes.secondaryBtn.textContent = '';
      this._nodes.secondaryBtn.setAttribute('hidden', 'hidden');
      this._nodes.secondaryBtn.setAttribute('aria-hidden', 'true');
      if (this._nodes.secondaryBtn.style) {
        this._nodes.secondaryBtn.style.display = 'none';
      }
    }

    this._renderMeta(state, status);
  }

  _renderMeta(state, status) {
    const meta = this._nodes.meta;
    while (meta.firstChild) meta.removeChild(meta.firstChild);
    if (status === STATUS.GAME_OVER) {
      this._appendMeta(meta, 'Final Score', formatNumber(state.score));
      this._appendMeta(meta, 'Best', formatNumber(state.bestScore));
      this._appendMeta(meta, 'Level', formatNumber(state.level));
      this._appendMeta(meta, 'Lines', formatNumber(state.lines));
      if (state.maxCombo > 1) {
        this._appendMeta(meta, 'Max Combo', formatNumber(state.maxCombo));
      }
    } else if (status === STATUS.PAUSED) {
      this._appendMeta(meta, 'Score', formatNumber(state.score));
      this._appendMeta(meta, 'Level', formatNumber(state.level));
      this._appendMeta(meta, 'Lines', formatNumber(state.lines));
    } else if (status === STATUS.READY && state.bestScore > 0) {
      this._appendMeta(meta, 'Best', formatNumber(state.bestScore));
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
    if (status === STATUS.READY) return 'restart';
    if (status === STATUS.GAME_OVER) return 'restart';
    if (status === STATUS.PAUSED && slot === 'primary') return 'resume';
    if (status === STATUS.PAUSED && slot === 'secondary') return 'restart';
    return 'none';
  }

  _dispatchPrimary() {
    const status = this._hudState.getState().status;
    if (status === STATUS.PAUSED) {
      this._hudState.requestResume();
    } else {
      this._hudState.requestRestart({ reason: status === STATUS.GAME_OVER ? 'gameOver' : 'ready' });
    }
  }

  _dispatchSecondary() {
    const status = this._hudState.getState().status;
    if (status === STATUS.PAUSED) {
      this._hudState.requestRestart({ reason: 'paused' });
    }
  }

  _show(status) {
    this._container.className = this._removeClass(this._container.className, this._classNames.hidden);
    this._container.removeAttribute?.('hidden');
    this._container.setAttribute('aria-hidden', 'false');
    if (this._container.style) this._container.style.display = '';
    const variantClass = this._classNames[VARIANT_BY_STATUS[status]];
    // Clear other variants
    for (const v of Object.values(VARIANT_BY_STATUS)) {
      const c = this._classNames[v];
      if (c && c !== variantClass) {
        this._container.className = this._removeClass(this._container.className, c);
      }
    }
    if (variantClass) {
      this._container.className = this._appendClass(this._container.className, variantClass);
    }
    this._container.setAttribute('data-status', status);
  }

  _hide() {
    this._container.className = this._appendClass(this._container.className, this._classNames.hidden);
    this._container.setAttribute('aria-hidden', 'true');
    if (this._container.style) this._container.style.display = 'none';
    this._container.setAttribute('data-status', STATUS.PLAYING);
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

function formatNumber(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '0';
  const value = Math.max(0, Math.floor(Number(n)));
  return value.toLocaleString('en-US');
}

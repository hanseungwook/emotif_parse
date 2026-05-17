import { NextPreviewPanel } from './nextPreview.mjs';
import { ScorePanel } from './scorePanel.mjs';
import { StatusOverlay } from './statusOverlay.mjs';

// Wires the individual HUD panels into a parent container and routes state
// changes from HudState into each panel's update method. The HUD does not
// own the playfield; it expects a host page to provide a layout container
// with three mount points (one each for next preview, score panel, and
// overlay). When the host omits mount points, the renderer creates them
// inline.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-root',
  nextMount: 'hud-root__next',
  scoreMount: 'hud-root__score',
  overlayMount: 'hud-root__overlay',
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

function findChildByClass(node, className) {
  if (!node || !node.childNodes || !className) return null;
  for (const child of node.childNodes) {
    const cls = (child.className || '').split(' ');
    if (cls.includes(className)) return child;
  }
  return null;
}

export class HudRenderer {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('HudRenderer requires a container');
    if (!opts.hudState) throw new TypeError('HudRenderer requires hudState');
    this._container = opts.container;
    this._hudState = opts.hudState;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('HudRenderer requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._nextSlots = opts.nextSlots || 5;
    this._mounted = false;
    this._panels = {};
    this._mounts = {};
    this._ownedMounts = new Set();
    this._unsubscribers = [];
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._ensureMounts();
    this._buildPanels();
    this._subscribe();
    this._syncFromState();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    for (const off of this._unsubscribers) {
      try { off(); } catch (_e) { /* ignore */ }
    }
    this._unsubscribers = [];
    if (this._panels.nextPreview) this._panels.nextPreview.unmount();
    if (this._panels.scorePanel) this._panels.scorePanel.unmount();
    if (this._panels.statusOverlay) this._panels.statusOverlay.unmount();
    this._panels = {};
    // Remove any mount nodes the renderer created itself, leaving
    // host-provided nodes intact for the host to manage.
    for (const node of this._ownedMounts) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
    this._ownedMounts.clear();
    this._mounts = {};
  }

  getPanels() {
    return { ...this._panels };
  }

  getMounts() {
    return { ...this._mounts };
  }

  _ensureMounts() {
    const doc = this._document;
    this._container.className = this._appendClass(
      this._container.className,
      this._classNames.root
    );

    const provided = {
      nextMount:
        findChildByClass(this._container, this._classNames.nextMount) ||
        this._maybeQuery('[data-hud-mount="next"]'),
      scoreMount:
        findChildByClass(this._container, this._classNames.scoreMount) ||
        this._maybeQuery('[data-hud-mount="score"]'),
      overlayMount:
        findChildByClass(this._container, this._classNames.overlayMount) ||
        this._maybeQuery('[data-hud-mount="overlay"]'),
    };

    for (const key of ['nextMount', 'scoreMount', 'overlayMount']) {
      if (provided[key]) {
        this._mounts[key] = provided[key];
        continue;
      }
      const node = doc.createElement('div');
      node.className = this._classNames[key];
      node.setAttribute('data-hud-mount', key.replace('Mount', ''));
      this._container.appendChild(node);
      this._mounts[key] = node;
      this._ownedMounts.add(node);
    }
  }

  _buildPanels() {
    this._panels.nextPreview = new NextPreviewPanel({
      container: this._mounts.nextMount,
      document: this._document,
      slots: this._nextSlots,
    });
    this._panels.scorePanel = new ScorePanel({
      container: this._mounts.scoreMount,
      document: this._document,
    });
    this._panels.statusOverlay = new StatusOverlay({
      container: this._mounts.overlayMount,
      document: this._document,
      hudState: this._hudState,
    });

    this._panels.nextPreview.mount();
    this._panels.scorePanel.mount();
    this._panels.statusOverlay.mount();
  }

  _subscribe() {
    this._unsubscribers.push(
      this._hudState.on('score:change', (evt) => this._panels.scorePanel.setScore(evt.value)),
      this._hudState.on('bestScore:change', (evt) => this._panels.scorePanel.setBestScore(evt.value)),
      this._hudState.on('level:change', (evt) => this._panels.scorePanel.setLevel(evt.value)),
      this._hudState.on('lines:change', (evt) => this._panels.scorePanel.setLines(evt.value)),
      this._hudState.on('combo:change', (evt) => this._panels.scorePanel.setCombo(evt.value)),
      this._hudState.on('clear', (detail) => this._panels.scorePanel.showClear(detail)),
      this._hudState.on('clear:expire', () => this._panels.scorePanel.hideClear()),
      this._hudState.on('next:change', (evt) => this._panels.nextPreview.setQueue(evt.queue)),
      this._hudState.on('reset', () => this._syncFromState())
    );
  }

  _syncFromState() {
    const state = this._hudState.getState();
    this._panels.scorePanel.setScore(state.score);
    this._panels.scorePanel.setBestScore(state.bestScore);
    this._panels.scorePanel.setLevel(state.level);
    this._panels.scorePanel.setLines(state.lines);
    this._panels.scorePanel.setCombo(state.combo);
    this._panels.nextPreview.setQueue(state.nextQueue);
    if (state.lastClear) this._panels.scorePanel.showClear(state.lastClear);
    else this._panels.scorePanel.hideClear();
  }

  _maybeQuery(selector) {
    if (typeof this._container.querySelector !== 'function') return null;
    try {
      return this._container.querySelector(selector);
    } catch (_e) {
      return null;
    }
  }

  _appendClass(base, addition) {
    const list = (base || '').split(' ').filter(Boolean);
    if (addition && !list.includes(addition)) list.push(addition);
    return list.join(' ');
  }
}

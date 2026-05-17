'use strict';

const {
  resolveDocument,
  appendClass,
  removeClass,
  clearChildren,
  schedulerWithFallback,
  cancelWithFallback,
} = require('./domHelpers');

// MessageFeed renders transient banner notifications — collisions, lap
// completions, boost pickups, race-completion notes. Each entry knows its
// category (which drives a CSS modifier) and a duration after which it
// expires automatically. Multiple entries stack chronologically.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-messages',
  list: 'hud-messages__list',
  empty: 'hud-messages--empty',
  item: 'hud-messages__item',
  itemText: 'hud-messages__item-text',
  itemBadge: 'hud-messages__item-badge',
  exiting: 'hud-messages__item--exiting',
  category: (cat) => `hud-messages__item--${cat}`,
});

const DEFAULT_MAX_VISIBLE = 4;
const EXIT_ANIMATION_MS = 200;

const BADGE_BY_CATEGORY = Object.freeze({
  info: 'i',
  collision: '!',
  boost: 'B',
  checkpoint: 'CP',
  lap: 'L',
  finish: 'F',
  warning: '!',
});

class MessageFeed {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('MessageFeed requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('MessageFeed requires a document');
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._scheduler = opts.scheduler || schedulerWithFallback();
    this._cancel = opts.cancelScheduler || cancelWithFallback();
    this._maxVisible = Math.max(1, Number(opts.maxVisible) || DEFAULT_MAX_VISIBLE);
    this._mounted = false;
    this._nodes = {};
    this._entries = new Map();
    this._order = [];
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
    for (const entry of this._entries.values()) {
      if (entry.expireTimer) this._cancel(entry.expireTimer);
      if (entry.removeTimer) this._cancel(entry.removeTimer);
    }
    this._entries.clear();
    this._order = [];
    clearChildren(this._container);
    this._nodes = {};
  }

  push(message) {
    if (!this._mounted) return null;
    const detail = message && typeof message === 'object' ? message : {};
    const text = typeof detail.text === 'string' ? detail.text : '';
    if (!text) return null;
    const category = typeof detail.category === 'string' && detail.category
      ? detail.category
      : 'info';
    const durationMs = Number(detail.durationMs);
    const lifeMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 2500;
    const id = typeof detail.id === 'string' && detail.id
      ? detail.id
      : `m-${Date.now()}-${this._order.length}`;
    if (this._entries.has(id)) return null;
    const node = this._buildItem(id, text, category);
    const entry = { id, text, category, node, durationMs: lifeMs };
    this._entries.set(id, entry);
    this._order.push(id);
    this._nodes.list.appendChild(node);
    this._trimOverflow();
    this._render();
    entry.expireTimer = this._scheduler(() => {
      entry.expireTimer = null;
      this.dismiss(id);
    }, lifeMs);
    return entry;
  }

  dismiss(id) {
    if (!this._mounted) return false;
    const entry = this._entries.get(id);
    if (!entry) return false;
    if (entry.expireTimer) {
      this._cancel(entry.expireTimer);
      entry.expireTimer = null;
    }
    entry.node.className = appendClass(entry.node.className, this._classNames.exiting);
    entry.removeTimer = this._scheduler(() => {
      entry.removeTimer = null;
      this._remove(id);
    }, EXIT_ANIMATION_MS);
    return true;
  }

  clear() {
    if (!this._mounted) return;
    for (const id of Array.from(this._entries.keys())) {
      this._remove(id);
    }
    this._render();
  }

  list() {
    return this._order.map((id) => {
      const e = this._entries.get(id);
      return { id: e.id, text: e.text, category: e.category };
    });
  }

  _build() {
    const doc = this._document;
    clearChildren(this._container);
    this._container.className = appendClass(this._container.className, this._classNames.root);
    this._container.setAttribute('aria-live', 'polite');
    this._container.setAttribute('aria-label', 'Race events');

    const list = doc.createElement('ul');
    list.className = this._classNames.list;
    list.setAttribute('role', 'list');
    list.setAttribute('data-role', 'message-list');
    this._container.appendChild(list);
    this._nodes = { list };
  }

  _buildItem(id, text, category) {
    const doc = this._document;
    const node = doc.createElement('li');
    let cls = this._classNames.item;
    const categoryClass = this._classNames.category(category);
    if (categoryClass) cls = appendClass(cls, categoryClass);
    node.className = cls;
    node.setAttribute('role', 'listitem');
    node.setAttribute('data-message-id', id);
    node.setAttribute('data-category', category);

    const badge = doc.createElement('span');
    badge.className = this._classNames.itemBadge;
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = BADGE_BY_CATEGORY[category] || BADGE_BY_CATEGORY.info;

    const textNode = doc.createElement('span');
    textNode.className = this._classNames.itemText;
    textNode.textContent = text;

    node.appendChild(badge);
    node.appendChild(textNode);
    return node;
  }

  _trimOverflow() {
    while (this._order.length > this._maxVisible) {
      const id = this._order[0];
      this._remove(id);
    }
  }

  _remove(id) {
    const entry = this._entries.get(id);
    if (!entry) return;
    if (entry.expireTimer) this._cancel(entry.expireTimer);
    if (entry.removeTimer) this._cancel(entry.removeTimer);
    this._entries.delete(id);
    this._order = this._order.filter((x) => x !== id);
    if (entry.node && entry.node.parentNode) {
      entry.node.parentNode.removeChild(entry.node);
    }
    this._render();
  }

  _render() {
    if (!this._mounted) return;
    let cls = this._container.className;
    cls = removeClass(cls, this._classNames.empty);
    if (this._order.length === 0) cls = appendClass(cls, this._classNames.empty);
    this._container.className = cls;
  }
}

module.exports = { MessageFeed, BADGE_BY_CATEGORY, DEFAULT_MAX_VISIBLE };

'use strict';

const { SkinLoadError } = require('./errors');

// Built-in skin manifest. Other modules (Product Shell, Core Workflow) can
// reference these IDs without a runtime dependency on this module.
const BUILTIN_SKINS = Object.freeze([
  Object.freeze({
    id: 'classic',
    name: 'Classic',
    head: '#34d399',
    body: '#10b981',
    accent: '#065f46',
    unlocked: true,
    builtin: true,
  }),
  Object.freeze({
    id: 'midnight',
    name: 'Midnight',
    head: '#a78bfa',
    body: '#7c3aed',
    accent: '#312e81',
    unlocked: true,
    builtin: true,
  }),
  Object.freeze({
    id: 'sunset',
    name: 'Sunset',
    head: '#fb923c',
    body: '#f97316',
    accent: '#9a3412',
    unlocked: false,
    builtin: true,
  }),
  Object.freeze({
    id: 'arctic',
    name: 'Arctic',
    head: '#e0f2fe',
    body: '#7dd3fc',
    accent: '#0c4a6e',
    unlocked: false,
    builtin: true,
  }),
]);

const DEFAULT_SKIN_ID = 'classic';

function normalizeSkin(raw) {
  if (!raw || typeof raw.id !== 'string' || raw.id.length === 0) {
    throw new SkinLoadError('skin requires non-empty id');
  }
  const name = typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : raw.id;
  const head = typeof raw.head === 'string' ? raw.head : '#cccccc';
  const body = typeof raw.body === 'string' ? raw.body : head;
  const accent = typeof raw.accent === 'string' ? raw.accent : body;
  const unlocked = raw.unlocked !== false;
  const builtin = raw.builtin === true;
  return Object.freeze({ id: raw.id, name, head, body, accent, unlocked, builtin });
}

class SkinCatalog {
  constructor(options) {
    const opts = options || {};
    this._skins = new Map();
    this._defaultId = opts.defaultId || DEFAULT_SKIN_ID;
    this._selectedId = null;
    for (const skin of BUILTIN_SKINS) {
      this._skins.set(skin.id, skin);
    }
    if (Array.isArray(opts.seed)) {
      for (const raw of opts.seed) this._skins.set(raw.id, normalizeSkin(raw));
    }
  }

  get defaultId() {
    return this._defaultId;
  }

  get selectedId() {
    return this._selectedId || this._defaultId;
  }

  list() {
    return Array.from(this._skins.values());
  }

  has(id) {
    return this._skins.has(id);
  }

  get(id) {
    return this._skins.get(id) || null;
  }

  getSelected() {
    return this.get(this.selectedId);
  }

  // Async loader for skin packs. The loader is expected to return an array
  // of skin definitions; supplying a rejecting loader produces a
  // SkinLoadError so callers can map it to the ERROR state.
  load(loader) {
    if (typeof loader !== 'function') {
      return Promise.reject(new TypeError('loader must be a function'));
    }
    return Promise.resolve()
      .then(() => loader())
      .then((result) => {
        if (!Array.isArray(result)) {
          throw new SkinLoadError('skin loader must resolve to an array');
        }
        const added = [];
        for (const raw of result) {
          const skin = normalizeSkin(raw);
          this._skins.set(skin.id, skin);
          added.push(skin);
        }
        return added;
      })
      .catch((err) => {
        if (err instanceof SkinLoadError) throw err;
        throw new SkinLoadError(err && err.message ? err.message : 'skin load failed', {
          cause: err,
        });
      });
  }

  select(id) {
    const skin = this.get(id);
    if (!skin) {
      throw new SkinLoadError('unknown skin id: ' + id, { recoverable: false });
    }
    if (!skin.unlocked) {
      throw new SkinLoadError('skin is locked: ' + id, { recoverable: false });
    }
    this._selectedId = skin.id;
    return skin;
  }

  unlock(id) {
    const skin = this.get(id);
    if (!skin) throw new SkinLoadError('unknown skin id: ' + id);
    if (skin.unlocked) return skin;
    const next = Object.freeze(Object.assign({}, skin, { unlocked: true }));
    this._skins.set(id, next);
    return next;
  }
}

module.exports = {
  SkinCatalog,
  BUILTIN_SKINS,
  DEFAULT_SKIN_ID,
  normalizeSkin,
};

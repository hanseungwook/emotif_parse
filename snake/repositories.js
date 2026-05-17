'use strict';

const { NotFoundError, ValidationError } = require('./errors');
const { buildSeedSkins, buildSeedObstacleLayouts } = require('./seedData');
const { createSkin, isSkinUnlocked } = require('./skins');
const { createObstacleLayout } = require('./obstacles');
const { createPlayer } = require('./player');
const { insertHighScore, createHighScore } = require('./highScore');
const { PersistenceManager } = require('./persistence');

// Repositories sit between the game state and the underlying data sources
// (seed catalog, persisted save). Anything that wants to *read* the data
// model goes through here so we have a single place to add fetch / cache /
// stub behavior. Anything that wants to *write* persistent state also funnels
// through here so we don't sprinkle save() calls across the codebase.
//
// Two boundaries:
//   - Catalog source: pure data — skins + obstacle layouts. Right now this is
//     bundled seed data; later it can be a fetch() against an API.
//   - Persistence: player profile, high scores, preferences.

// ----- Catalog repository ---------------------------------------------------

class SkinRepository {
  constructor(options) {
    const opts = options || {};
    this._skins = (opts.skins || []).map((s) => createSkin(s));
    this._byId = new Map(this._skins.map((s) => [s.id, s]));
  }

  list() {
    return this._skins.slice();
  }

  get(id) {
    const skin = this._byId.get(id);
    if (!skin) throw new NotFoundError(`skin not found: ${id}`);
    return skin;
  }

  find(id) {
    return this._byId.get(id) || null;
  }

  has(id) {
    return this._byId.has(id);
  }

  // Compute unlock state against a player profile. Returns a new array of
  // { ...skin, unlocked: boolean, eligible: boolean } so the UI can present
  // both already-unlocked and "ready to claim" skins.
  withUnlockState(player) {
    const stats = player ? player.stats : null;
    const unlocked = new Set(player ? player.unlockedSkinIds : []);
    return this._skins.map((skin) => ({
      ...skin,
      unlocked: unlocked.has(skin.id),
      eligible: isSkinUnlocked(skin, stats),
    }));
  }

  defaultSkinId() {
    const def = this._skins.find((s) => s.unlock && s.unlock.kind === 'default');
    return def ? def.id : (this._skins[0] ? this._skins[0].id : null);
  }
}

class ObstacleLayoutRepository {
  constructor(options) {
    const opts = options || {};
    this._layouts = (opts.layouts || []).map((l) => createObstacleLayout(l));
    this._byId = new Map(this._layouts.map((l) => [l.id, l]));
  }

  list() {
    return this._layouts.slice();
  }

  get(id) {
    const layout = this._byId.get(id);
    if (!layout) throw new NotFoundError(`obstacle layout not found: ${id}`);
    return layout;
  }

  find(id) {
    return this._byId.get(id) || null;
  }

  has(id) {
    return this._byId.has(id);
  }

  byDifficulty(difficulty) {
    return this._layouts.filter((l) => l.difficulty === difficulty);
  }

  defaultLayoutId() {
    return this._layouts[0] ? this._layouts[0].id : null;
  }
}

class CatalogRepository {
  constructor(options) {
    const opts = options || {};
    this.skins = opts.skins instanceof SkinRepository
      ? opts.skins
      : new SkinRepository({ skins: opts.skins || [] });
    this.obstacleLayouts = opts.obstacleLayouts instanceof ObstacleLayoutRepository
      ? opts.obstacleLayouts
      : new ObstacleLayoutRepository({ layouts: opts.obstacleLayouts || [] });
  }

  asPayload() {
    return {
      skins: this.skins.list(),
      obstacleLayouts: this.obstacleLayouts.list(),
    };
  }
}

// Catalog loaders — the data-loading boundary the rest of the app uses.
//
// Today: synchronous seed loader.
// Tomorrow: an HTTP/file loader can fulfill the same shape; callers only see
// a Promise<CatalogRepository>.

async function loadSeedCatalog() {
  return new CatalogRepository({
    skins: new SkinRepository({ skins: buildSeedSkins() }),
    obstacleLayouts: new ObstacleLayoutRepository({ layouts: buildSeedObstacleLayouts() }),
  });
}

function buildSeedCatalogSync() {
  return new CatalogRepository({
    skins: new SkinRepository({ skins: buildSeedSkins() }),
    obstacleLayouts: new ObstacleLayoutRepository({ layouts: buildSeedObstacleLayouts() }),
  });
}

// ----- Persistence-backed repositories --------------------------------------

class PlayerRepository {
  constructor(options) {
    const opts = options || {};
    if (!opts.persistence) {
      throw new ValidationError('PlayerRepository requires a persistence manager');
    }
    this._persistence = opts.persistence;
  }

  load() {
    const envelope = this._persistence.load();
    if (!envelope || !envelope.payload || !envelope.payload.player) return null;
    return createPlayer(envelope.payload.player);
  }

  save(player, extras) {
    if (!player) throw new ValidationError('player is required');
    const previous = this._persistence.load();
    const previousPayload = previous ? previous.payload : {};
    const snapshot = {
      ...previousPayload,
      player,
      ...(extras || {}),
    };
    return this._persistence.save(snapshot);
  }
}

class HighScoreRepository {
  constructor(options) {
    const opts = options || {};
    if (!opts.persistence) {
      throw new ValidationError('HighScoreRepository requires a persistence manager');
    }
    this._persistence = opts.persistence;
  }

  loadAll() {
    const envelope = this._persistence.load();
    if (!envelope || !envelope.payload) return {};
    const map = envelope.payload.highScores || {};
    const result = {};
    for (const [mode, list] of Object.entries(map)) {
      result[mode] = (list || []).map((e) => createHighScore(e));
    }
    return result;
  }

  loadForMode(mode) {
    const all = this.loadAll();
    return all[mode] || [];
  }

  add(entry) {
    const all = this.loadAll();
    const list = insertHighScore(all[entry.mode] || [], entry);
    const next = { ...all, [entry.mode]: list };
    const previous = this._persistence.load();
    const payload = previous ? previous.payload : {};
    this._persistence.save({
      ...payload,
      highScores: next,
    });
    return list;
  }

  clear(mode) {
    const all = this.loadAll();
    if (mode) {
      delete all[mode];
    } else {
      for (const m of Object.keys(all)) delete all[m];
    }
    const previous = this._persistence.load();
    const payload = previous ? previous.payload : {};
    this._persistence.save({
      ...payload,
      highScores: all,
    });
  }
}

// ----- Repositories aggregate ----------------------------------------------

class Repositories {
  constructor(options) {
    const opts = options || {};
    this.persistence = opts.persistence || new PersistenceManager();
    this.catalog = opts.catalog || null; // populated by loadCatalog()
    this.player = new PlayerRepository({ persistence: this.persistence });
    this.highScores = new HighScoreRepository({ persistence: this.persistence });
  }

  async loadCatalog() {
    if (!this.catalog) {
      this.catalog = await loadSeedCatalog();
    }
    return this.catalog;
  }

  // High-level "give me everything needed to boot" entry point. Used by the
  // app shell during hydration.
  async hydrate() {
    const catalog = await this.loadCatalog();
    const player = this.player.load() || createPlayer({});
    const highScores = this.highScores.loadAll();
    return {
      catalog: catalog.asPayload(),
      player,
      highScores,
    };
  }

  // Convenience: persist player + high scores together so callers don't have
  // to do two trips.
  saveAll({ player, highScores, ui } = {}) {
    const previous = this.persistence.load();
    const previousPayload = previous ? previous.payload : {};
    const payload = { ...previousPayload };
    if (player) payload.player = player;
    if (highScores) payload.highScores = highScores;
    if (ui) payload.ui = ui;
    return this.persistence.save(payload);
  }

  clearAll() {
    this.persistence.clear();
  }
}

module.exports = {
  SkinRepository,
  ObstacleLayoutRepository,
  CatalogRepository,
  PlayerRepository,
  HighScoreRepository,
  Repositories,
  loadSeedCatalog,
  buildSeedCatalogSync,
};

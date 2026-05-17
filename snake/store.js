'use strict';

const { EventEmitter } = require('./eventEmitter');
const { ValidationError } = require('./errors');
const { createPlayer, setEquippedSkin, unlockSkin, recordObstacleClear, recordGameFinished, setPreferences, setName } = require('./player');
const { createGameSession, snapshot: snapshotSession, restore: restoreSession, SESSION_STATUS } = require('./gameSession');
const { insertHighScore, createHighScore } = require('./highScore');
const { getMode, modePersistsHighScore } = require('./modes');

// GameStore is the top-level observable state container. It mirrors the chat
// app's `frontend/js/store.js` and `chat/messaging/conversationStore.js`
// patterns: shallow state object, subscriber set, emitted domain events.
//
// State slices:
//   player        — local profile, equipped skin, unlocked content, stats
//   catalog       — loaded skins + obstacle layouts (populated by repository)
//   session       — current game session (or null)
//   highScores    — { [modeId]: [HighScore, ...] }
//   ui            — selected mode, selected layout, screen state
//   loading       — boolean for async hydration
//   ready         — once initial load completes
//
// All mutations go through action functions on the store so subscribers can
// observe a single "state" event and event-specific listeners can react to
// the surgical change (e.g. "skin:equipped").

function emptyState() {
  return {
    player: null,
    catalog: { skins: [], obstacleLayouts: [] },
    session: null,
    highScores: {},
    ui: {
      screen: 'menu', // 'menu' | 'play' | 'skins' | 'obstacles' | 'highscores' | 'settings'
      selectedMode: 'classic',
      selectedObstacleLayoutId: null,
      selectedSkinId: 'classic-green',
    },
    loading: false,
    ready: false,
    version: 1,
  };
}

class GameStore extends EventEmitter {
  constructor(initialState) {
    super();
    this._state = { ...emptyState(), ...(initialState || {}) };
    this._subscribers = new Set();
  }

  getState() {
    return this._state;
  }

  subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('subscribe requires a function');
    }
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  // Internal: apply a partial patch and notify subscribers + a domain event.
  _commit(patch, eventName, eventPayload) {
    if (!patch || typeof patch !== 'object') {
      throw new ValidationError('commit requires an object patch');
    }
    const next = { ...this._state, ...patch };
    this._state = next;
    for (const fn of this._subscribers) {
      try {
        fn(next);
      } catch (err) {
        this.emit('error', err);
      }
    }
    if (eventName) this.emit(eventName, eventPayload);
  }

  // ---- Hydration / lifecycle ---------------------------------------------

  setLoading(loading) {
    this._commit({ loading: !!loading }, 'loading:changed', { loading: !!loading });
  }

  hydrate(initial) {
    const next = { ...emptyState(), ...this._state, ...(initial || {}), ready: true, loading: false };
    this._state = next;
    for (const fn of this._subscribers) {
      try {
        fn(next);
      } catch (err) {
        this.emit('error', err);
      }
    }
    this.emit('hydrated', next);
  }

  reset() {
    this._state = emptyState();
    for (const fn of this._subscribers) {
      try {
        fn(this._state);
      } catch (err) {
        this.emit('error', err);
      }
    }
    this.emit('reset', this._state);
  }

  // ---- Catalog -----------------------------------------------------------

  setCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object') {
      throw new ValidationError('catalog must be an object');
    }
    const skins = Array.isArray(catalog.skins) ? [...catalog.skins] : [];
    const obstacleLayouts = Array.isArray(catalog.obstacleLayouts)
      ? [...catalog.obstacleLayouts]
      : [];
    this._commit(
      { catalog: { skins, obstacleLayouts } },
      'catalog:loaded',
      { skins: skins.length, obstacleLayouts: obstacleLayouts.length }
    );
  }

  // ---- Player ------------------------------------------------------------

  setPlayer(player) {
    if (!player) throw new ValidationError('player is required');
    this._commit({ player }, 'player:set', { player });
  }

  ensurePlayer() {
    if (this._state.player) return this._state.player;
    const player = createPlayer({});
    this._commit({ player }, 'player:set', { player });
    return player;
  }

  equipSkin(skinId) {
    const player = this.ensurePlayer();
    const next = setEquippedSkin(player, skinId);
    this._commit(
      {
        player: next,
        ui: { ...this._state.ui, selectedSkinId: skinId },
      },
      'skin:equipped',
      { skinId }
    );
    return next;
  }

  unlockSkin(skinId) {
    const player = this.ensurePlayer();
    if (player.unlockedSkinIds.includes(skinId)) return player;
    const next = unlockSkin(player, skinId);
    this._commit({ player: next }, 'skin:unlocked', { skinId });
    return next;
  }

  setPlayerName(name) {
    const player = this.ensurePlayer();
    const next = setName(player, name);
    this._commit({ player: next }, 'player:renamed', { name: next.name });
    return next;
  }

  updatePreferences(patch) {
    const player = this.ensurePlayer();
    const next = setPreferences(player, patch);
    this._commit({ player: next }, 'preferences:changed', { preferences: next.preferences });
    return next;
  }

  // ---- Session lifecycle -------------------------------------------------

  startSession(sessionInput) {
    const session = createGameSession(sessionInput);
    this._commit(
      { session, ui: { ...this._state.ui, screen: 'play', selectedMode: session.mode } },
      'session:started',
      { sessionId: session.id, mode: session.mode }
    );
    return session;
  }

  setSession(session) {
    this._commit({ session }, 'session:updated', { sessionId: session ? session.id : null });
  }

  patchSession(patch) {
    if (!this._state.session) return null;
    const next = { ...this._state.session, ...(patch || {}) };
    this._commit({ session: next }, 'session:updated', { sessionId: next.id });
    return next;
  }

  endSession({ score, snakeLength, foodEaten, obstacleLayoutCleared } = {}) {
    const current = this._state.session;
    if (!current) return null;
    const mode = current.mode;
    const ended = {
      ...current,
      status: SESSION_STATUS.GAME_OVER,
      endedAt: current.endedAt || Date.now(),
      score: Number.isInteger(score) ? score : current.score,
    };

    // Update player stats
    let player = this.ensurePlayer();
    player = recordGameFinished(player, {
      mode,
      score: ended.score,
      snakeLength: Number.isInteger(snakeLength) ? snakeLength : current.snake.body.length,
      foodEaten: Number.isInteger(foodEaten) ? foodEaten : current.foodEaten,
    });
    if (obstacleLayoutCleared && current.obstacleLayoutId) {
      player = recordObstacleClear(player, current.obstacleLayoutId);
    }

    // Record high score — only for modes whose descriptor persists scores.
    let highScores = this._state.highScores;
    if (modePersistsHighScore(mode)) {
      try {
        const entry = createHighScore({
          id: `${mode}:${ended.id}`,
          mode,
          score: ended.score,
          playerName: player.name,
          skinId: ended.skinId || player.equippedSkinId,
          obstacleLayoutId: ended.obstacleLayoutId,
          achievedAt: ended.endedAt,
          durationMs: ended.startedAt ? Math.max(0, ended.endedAt - ended.startedAt) : 0,
          foodEaten: ended.foodEaten,
          snakeLength: Number.isInteger(snakeLength) ? snakeLength : current.snake.body.length,
        });
        const list = insertHighScore(highScores[mode], entry);
        highScores = { ...highScores, [mode]: list };
      } catch (err) {
        this.emit('error', err);
      }
    }

    this._commit({ session: ended, player, highScores }, 'session:ended', {
      sessionId: ended.id,
      score: ended.score,
      mode,
    });
    return ended;
  }

  clearSession() {
    this._commit({ session: null }, 'session:cleared', {});
  }

  // ---- UI ---------------------------------------------------------------

  selectMode(modeId) {
    getMode(modeId); // throws on invalid
    this._commit(
      { ui: { ...this._state.ui, selectedMode: modeId } },
      'ui:mode-selected',
      { modeId }
    );
  }

  selectObstacleLayout(layoutId) {
    this._commit(
      { ui: { ...this._state.ui, selectedObstacleLayoutId: layoutId } },
      'ui:layout-selected',
      { layoutId }
    );
  }

  setScreen(screen) {
    if (typeof screen !== 'string' || !screen) {
      throw new ValidationError('screen must be a non-empty string');
    }
    this._commit({ ui: { ...this._state.ui, screen } }, 'ui:screen-changed', { screen });
  }

  // ---- Snapshot / restore -----------------------------------------------

  snapshot() {
    const s = this._state;
    return {
      version: s.version,
      player: s.player ? { ...s.player } : null,
      session: s.session ? snapshotSession(s.session) : null,
      highScores: cloneHighScores(s.highScores),
      ui: { ...s.ui },
    };
  }

  restore(snapshot) {
    if (!snapshot) return;
    const player = snapshot.player ? createPlayer(snapshot.player) : null;
    const session = snapshot.session ? restoreSession(snapshot.session) : null;
    const highScores = cloneHighScores(snapshot.highScores || {});
    const ui = { ...this._state.ui, ...(snapshot.ui || {}) };
    this._state = {
      ...this._state,
      player,
      session,
      highScores,
      ui,
    };
    this.emit('restored', this._state);
    for (const fn of this._subscribers) {
      try {
        fn(this._state);
      } catch (err) {
        this.emit('error', err);
      }
    }
  }
}

function cloneHighScores(map) {
  const out = {};
  for (const [mode, list] of Object.entries(map || {})) {
    out[mode] = (list || []).map((e) => ({ ...e }));
  }
  return out;
}

// ---- Selectors -----------------------------------------------------------

function selectPlayer(state) {
  return state.player;
}

function selectCatalog(state) {
  return state.catalog;
}

function selectSession(state) {
  return state.session;
}

function selectHighScores(state, modeId) {
  if (!modeId) return state.highScores;
  return state.highScores[modeId] || [];
}

function selectEquippedSkin(state) {
  if (!state.player) return null;
  return (state.catalog.skins || []).find((s) => s.id === state.player.equippedSkinId) || null;
}

function selectUnlockedSkins(state) {
  if (!state.player) return [];
  const ids = new Set(state.player.unlockedSkinIds);
  return (state.catalog.skins || []).filter((s) => ids.has(s.id));
}

function selectAvailableSkins(state) {
  if (!state.player) return state.catalog.skins || [];
  const unlocked = new Set(state.player.unlockedSkinIds);
  return (state.catalog.skins || []).map((s) => ({
    ...s,
    unlocked: unlocked.has(s.id),
  }));
}

function selectObstacleLayout(state, layoutId) {
  const id = layoutId || state.ui.selectedObstacleLayoutId;
  if (!id) return null;
  return (state.catalog.obstacleLayouts || []).find((l) => l.id === id) || null;
}

function selectObstacleLayoutsByDifficulty(state) {
  const grouped = {};
  for (const layout of state.catalog.obstacleLayouts || []) {
    if (!grouped[layout.difficulty]) grouped[layout.difficulty] = [];
    grouped[layout.difficulty].push(layout);
  }
  return grouped;
}

module.exports = {
  GameStore,
  emptyState,
  selectPlayer,
  selectCatalog,
  selectSession,
  selectHighScores,
  selectEquippedSkin,
  selectUnlockedSkins,
  selectAvailableSkins,
  selectObstacleLayout,
  selectObstacleLayoutsByDifficulty,
};

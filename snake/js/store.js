// Minimal observable store + event bus shared across Modern Snake shell
// modules. Sibling subsystems (gameplay, persistence, leaderboard) read state
// via getState() and react to changes via subscribe() / on(). The shell owns
// only navigation, view selection, and shell-level user preferences (skin
// selection, obstacle-mode toggle). Game runtime state lives in the gameplay
// module's own store.

const listeners = new Set();
const events = new Map();

const DEFAULT_STATE = {
  view: "play", // "play" | "skins" | "obstacles" | "scores" | "settings"
  navOpen: true,
  // Skins (cosmetic selection — gameplay reads selectedSkinId to colorize)
  selectedSkinId: "classic",
  unlockedSkinIds: ["classic", "neon", "forest"],
  // Obstacle Mode (shell-level toggle + parameter set — gameplay reads to
  // decide whether to spawn walls and at what density)
  obstacleMode: {
    enabled: false,
    difficulty: "normal", // "easy" | "normal" | "hard"
    layoutId: "open", // "open" | "pillars" | "maze" | "tunnel" | "random"
  },
  // High score is duplicated here so the topbar/HUD can show a value before
  // the data-model module is wired in. Persistence module overwrites it.
  highScore: 0,
  // Generic loading/error flags for the shell so empty states stay consistent
  // across views.
  loading: false,
  errorMessage: null,
};

let state = { ...DEFAULT_STATE };

export function getState() {
  return state;
}

export function setState(partial) {
  const next = { ...state, ...partial };
  if (shallowEqual(state, next)) return;
  state = next;
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error("snake store listener error", err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function on(eventName, fn) {
  if (!events.has(eventName)) events.set(eventName, new Set());
  events.get(eventName).add(fn);
  return () => events.get(eventName).delete(fn);
}

export function emit(eventName, payload) {
  const set = events.get(eventName);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`snake event listener error (${eventName})`, err);
    }
  }
}

// ---- Navigation actions ----

const KNOWN_VIEWS = new Set(["play", "skins", "obstacles", "scores", "settings"]);

export function navigateTo(view) {
  if (!KNOWN_VIEWS.has(view)) return;
  if (state.view === view) return;
  setState({ view });
  emit("view:changed", { view });
}

export function setNavOpen(open) {
  setState({ navOpen: !!open });
}

export function toggleNav() {
  setNavOpen(!state.navOpen);
}

// ---- Skin actions ----

export function selectSkin(skinId) {
  if (!skinId) return;
  if (state.selectedSkinId === skinId) return;
  setState({ selectedSkinId: skinId });
  emit("skin:changed", { skinId });
}

export function setUnlockedSkins(ids) {
  if (!Array.isArray(ids)) return;
  setState({ unlockedSkinIds: Array.from(new Set(ids)) });
}

export function isSkinUnlocked(skinId) {
  return state.unlockedSkinIds.includes(skinId);
}

// ---- Obstacle mode actions ----

export function setObstacleMode(partial) {
  const next = { ...state.obstacleMode, ...partial };
  setState({ obstacleMode: next });
  emit("obstacleMode:changed", next);
}

export function toggleObstacleMode() {
  setObstacleMode({ enabled: !state.obstacleMode.enabled });
}

// ---- Generic ----

export function setLoading(loading) {
  setState({ loading: !!loading });
}

export function setErrorMessage(message) {
  setState({ errorMessage: message || null });
}

export function setHighScore(score) {
  const n = Number(score) || 0;
  if (n === state.highScore) return;
  setState({ highScore: n });
}

// ---- Selectors ----

export function getView() {
  return state.view;
}

export function getSelectedSkinId() {
  return state.selectedSkinId;
}

export function getObstacleMode() {
  return { ...state.obstacleMode };
}

function shallowEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

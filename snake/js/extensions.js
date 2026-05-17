// Mount-point registry + renderer hooks shared across Modern Snake shell.
// Sibling subsystems (gameplay runtime, persistence/data-model, leaderboard,
// operations-states) register against these so the shell owns layout while
// modules own their content.
//
// Mount names used by the shell:
//   - "game-canvas"     : Play view, where the game canvas is mounted
//   - "hud-stats"       : Play view, score/lives/timer display
//   - "skins-grid"      : Skins view, where the skins gallery is rendered
//   - "obstacle-controls" : Obstacles view, advanced controls injected here
//   - "scores"          : Scores view, where the leaderboard is rendered
//   - "operations-overlay" : Root-level slot for loading/error/game-over modals
//
// Usage from a sibling module:
//   import { registerRenderer, getMount } from "./extensions.js";
//   registerRenderer("game-canvas", ({ mount, state }) => { ... });

const renderers = new Map();
const mounts = new Map();

export function registerMount(name, element) {
  if (!element) return;
  mounts.set(name, element);
}

export function getMount(name) {
  return mounts.get(name) || null;
}

export function registerRenderer(name, fn) {
  renderers.set(name, fn);
  return () => renderers.delete(name);
}

export function invokeRenderer(name, context) {
  const fn = renderers.get(name);
  const mount = mounts.get(name);
  if (!fn || !mount) return false;
  try {
    fn({ ...context, mount });
    return true;
  } catch (err) {
    console.error(`snake renderer error (${name})`, err);
    return false;
  }
}

export function clearMount(name) {
  const mount = mounts.get(name);
  if (mount) mount.replaceChildren();
}

export function hasRenderer(name) {
  return renderers.has(name);
}

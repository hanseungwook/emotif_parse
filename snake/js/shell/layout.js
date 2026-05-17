import { getState, subscribe } from "../store.js";
import { registerMount, invokeRenderer, hasRenderer } from "../extensions.js";
import { renderTopbar } from "./topbar.js";
import { renderSidebar } from "./sidebar.js";
import { renderPlayView } from "./views/play.js";
import { renderSkinsView } from "./views/skins.js";
import { renderObstaclesView } from "./views/obstacles.js";
import { renderScoresView } from "./views/scores.js";
import { renderSettingsView } from "./views/settings.js";

// Top-level shell layout. Builds the persistent chrome (top bar, side
// navigation, main content slot, modal overlay slot) and keeps body-level
// data attributes in sync so CSS can react to view + skin + obstacle mode.
//
// The main content area is swapped wholesale per view; this keeps the shell
// resilient even if a sibling module breaks: only that view is affected.
export function renderLayout(root) {
  root.replaceChildren();
  root.classList.add("snake-root");

  const topbarMount = document.createElement("div");
  topbarMount.style.gridArea = "topbar";
  const navMount = document.createElement("div");
  navMount.style.gridArea = "nav";
  const mainMount = document.createElement("main");
  mainMount.className = "snake-main";
  mainMount.setAttribute("aria-live", "polite");

  // Top-level slot for game-over / paused / loading modals owned by the
  // operations-states module. Lives outside the main content so it floats
  // above the entire UI.
  const overlayMount = document.createElement("div");
  overlayMount.dataset.mount = "operations-overlay";

  root.append(topbarMount, navMount, mainMount, overlayMount);
  registerMount("operations-overlay", overlayMount);

  const refreshTopbar = renderTopbar(topbarMount);
  const refreshSidebar = renderSidebar(navMount);

  function renderCurrentView() {
    const state = getState();
    root.dataset.view = state.view;
    root.dataset.skin = state.selectedSkinId;
    root.dataset.obstacles = state.obstacleMode.enabled ? "on" : "off";
    document.title = describeTitle(state);

    switch (state.view) {
      case "skins":
        renderSkinsView(mainMount);
        break;
      case "obstacles":
        renderObstaclesView(mainMount);
        break;
      case "scores":
        renderScoresView(mainMount);
        break;
      case "settings":
        renderSettingsView(mainMount);
        break;
      case "play":
      default:
        renderPlayView(mainMount);
    }
  }

  let lastView = null;
  let lastSkin = null;
  let lastObstaclesEnabled = null;

  function reactToStore() {
    const state = getState();
    // Topbar + sidebar redraw whenever state changes — they're cheap.
    refreshTopbar();
    refreshSidebar();

    // Only re-render the main view when the view itself changes, the
    // selected skin changes (so skins gallery selection reflects), or the
    // obstacle-mode enabled flag flips (so badges and labels update).
    if (
      state.view !== lastView ||
      state.selectedSkinId !== lastSkin ||
      state.obstacleMode.enabled !== lastObstaclesEnabled
    ) {
      lastView = state.view;
      lastSkin = state.selectedSkinId;
      lastObstaclesEnabled = state.obstacleMode.enabled;
      renderCurrentView();
    }

    // Optional operations overlay rerender on every state change. If no
    // module has registered, the slot stays empty.
    if (hasRenderer("operations-overlay")) {
      invokeRenderer("operations-overlay", { state });
    }
  }

  subscribe(reactToStore);
  renderCurrentView();
  reactToStore();
}

function describeTitle(state) {
  const parts = ["Modern Snake"];
  if (state.view === "play") {
    if (state.obstacleMode.enabled) parts.push("Obstacle Mode");
  } else if (state.view === "skins") {
    parts.push("Skins");
  } else if (state.view === "obstacles") {
    parts.push("Obstacle Mode");
  } else if (state.view === "scores") {
    parts.push("High Scores");
  } else if (state.view === "settings") {
    parts.push("Settings");
  }
  return parts.join(" · ");
}

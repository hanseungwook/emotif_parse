import { getState, navigateTo, setObstacleMode } from "../store.js";

// Hash-based routing for the Modern Snake shell. Routes correspond to the
// nav items. Keyboard shortcuts handle quick navigation. Conversation deep
// links are not relevant here, but bookmarking a view is, so the hash is
// kept in sync with the active view.
//
// Hash format:
//   #/play
//   #/skins
//   #/obstacles
//   #/scores
//   #/settings
//
// Optional query-style modifiers:
//   #/play?obstacles=on   -> turn obstacle mode on as part of the deep link

const VIEW_PATHS = {
  play: "#/play",
  skins: "#/skins",
  obstacles: "#/obstacles",
  scores: "#/scores",
  settings: "#/settings",
};

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]),
);

export function installNavigation() {
  applyHash();
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("keydown", onGlobalKeydown);
}

export function syncHashFromState() {
  const state = getState();
  const target = VIEW_PATHS[state.view] || VIEW_PATHS.play;
  if (window.location.hash !== target) {
    history.replaceState(null, "", target);
  }
}

function applyHash() {
  const hash = window.location.hash || "#/play";
  const [path, query] = hash.split("?");
  const view = PATH_TO_VIEW[path] || PATH_TO_VIEW["#/play"];
  navigateTo(view);

  if (!query) return;
  const params = new URLSearchParams(query);
  if (params.has("obstacles")) {
    const value = params.get("obstacles");
    if (value === "on" || value === "true") {
      setObstacleMode({ enabled: true });
    } else if (value === "off" || value === "false") {
      setObstacleMode({ enabled: false });
    }
  }
}

function onGlobalKeydown(event) {
  if (event.defaultPrevented) return;
  if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key) {
    case "1":
      navigateTo("play");
      break;
    case "2":
      navigateTo("skins");
      break;
    case "3":
      navigateTo("obstacles");
      break;
    case "4":
      navigateTo("scores");
      break;
    case "5":
      navigateTo("settings");
      break;
    case "?":
      // Reserved for future help overlay. Sibling modules can listen for
      // this dispatch and show their own help UI.
      window.dispatchEvent(new CustomEvent("snake:help-requested"));
      break;
  }
}

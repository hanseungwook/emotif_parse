import { getState, toggleNav, navigateTo } from "../store.js";

// Builds the top bar: brand mark on the left, status pills (high score and
// obstacle-mode indicator), and a settings shortcut on the right. Pills
// re-render whenever state changes so the topbar stays in sync with the
// shell store.
export function renderTopbar(mount) {
  const header = document.createElement("header");
  header.className = "snake-topbar";

  const menuToggle = document.createElement("button");
  menuToggle.type = "button";
  menuToggle.className = "icon-button";
  menuToggle.setAttribute("aria-label", "Toggle navigation");
  menuToggle.innerHTML = "&#9776;";
  menuToggle.addEventListener("click", () => toggleNav());

  const brand = document.createElement("div");
  brand.className = "snake-brand";
  brand.innerHTML = `
    <span class="logo" aria-hidden="true">S</span>
    <span class="wordmark">Modern <em>Snake</em></span>
  `;

  const spacer = document.createElement("span");
  spacer.className = "spacer";

  const scorePill = document.createElement("span");
  scorePill.className = "stat-pill";
  scorePill.dataset.role = "high-score";

  const obstaclePill = document.createElement("button");
  obstaclePill.type = "button";
  obstaclePill.className = "stat-pill";
  obstaclePill.dataset.role = "obstacle-mode";
  obstaclePill.title = "Open obstacle mode settings";
  obstaclePill.addEventListener("click", () => navigateTo("obstacles"));

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "icon-button";
  settingsButton.setAttribute("aria-label", "Open settings");
  settingsButton.title = "Settings";
  settingsButton.innerHTML = "&#9881;";
  settingsButton.addEventListener("click", () => navigateTo("settings"));

  header.append(
    menuToggle,
    brand,
    spacer,
    scorePill,
    obstaclePill,
    settingsButton,
  );

  mount.append(header);

  function refresh() {
    const state = getState();
    scorePill.innerHTML = `Best <strong>${state.highScore || 0}</strong>`;
    const mode = state.obstacleMode;
    obstaclePill.dataset.kind = mode.enabled ? "obstacles-on" : "obstacles-off";
    obstaclePill.innerHTML = mode.enabled
      ? `Obstacles <strong>${capitalize(mode.difficulty)}</strong>`
      : `Obstacles <strong>Off</strong>`;
  }

  refresh();
  return refresh;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

import { getState, navigateTo } from "../../store.js";
import {
  registerMount,
  invokeRenderer,
  hasRenderer,
  clearMount,
} from "../../extensions.js";

// Play view. Owns the game stage chrome, the HUD panels, and the call-to-
// action buttons. The actual game canvas, score values, and lives readout
// are filled in by the gameplay/data-model modules through the renderer
// registry. Until those modules attach, the shell shows tasteful
// placeholders so the page is fully browsable.
export function renderPlayView(mount) {
  mount.replaceChildren();

  const header = buildHeader();
  const body = document.createElement("div");
  body.className = "view-body";

  const stage = document.createElement("div");
  stage.className = "play-stage";

  const canvasFrame = document.createElement("div");
  canvasFrame.className = "play-canvas-frame";

  const canvasMount = document.createElement("div");
  canvasMount.className = "play-canvas-mount";
  canvasMount.dataset.mount = "game-canvas";
  canvasFrame.append(canvasMount);

  const sidebar = document.createElement("div");
  sidebar.className = "play-sidebar";

  const scorePanel = document.createElement("section");
  scorePanel.className = "panel";
  scorePanel.innerHTML = `
    <h3>Run</h3>
    <div class="score-grid" data-mount="hud-stats">
      <div class="stat">
        <div class="label">Score</div>
        <div class="value" data-hud="score">0</div>
      </div>
      <div class="stat">
        <div class="label">Length</div>
        <div class="value" data-hud="length">3</div>
      </div>
      <div class="stat">
        <div class="label">Best</div>
        <div class="value" data-hud="best">0</div>
      </div>
      <div class="stat">
        <div class="label">Mode</div>
        <div class="value" data-hud="mode" style="font-size:14px;">—</div>
      </div>
    </div>
  `;

  const controlsPanel = document.createElement("section");
  controlsPanel.className = "panel";
  controlsPanel.innerHTML = `
    <h3>Controls</h3>
    <div class="play-controls">
      <button type="button" class="primary-button" data-action="start">Start game</button>
      <button type="button" class="secondary-button" data-action="pause">Pause</button>
      <button type="button" class="secondary-button" data-action="reset">Reset</button>
    </div>
    <p class="key-hints" style="margin-top:12px;">
      Move with <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>
      or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>.<br/>
      Press <kbd>Space</kbd> to pause/resume.
    </p>
  `;

  const shortcutsPanel = document.createElement("section");
  shortcutsPanel.className = "panel";
  const shortcutsHeading = document.createElement("h3");
  shortcutsHeading.textContent = "Quick switch";
  const shortcutsControls = document.createElement("div");
  shortcutsControls.className = "play-controls";
  const skinsShortcut = document.createElement("button");
  skinsShortcut.type = "button";
  skinsShortcut.className = "secondary-button";
  skinsShortcut.textContent = "Change skin";
  skinsShortcut.addEventListener("click", () => navigateTo("skins"));
  const obstaclesShortcut = document.createElement("button");
  obstaclesShortcut.type = "button";
  obstaclesShortcut.className = "secondary-button";
  obstaclesShortcut.textContent = "Obstacle mode";
  obstaclesShortcut.addEventListener("click", () => navigateTo("obstacles"));
  shortcutsControls.append(skinsShortcut, obstaclesShortcut);
  shortcutsPanel.append(shortcutsHeading, shortcutsControls);

  sidebar.append(scorePanel, controlsPanel, shortcutsPanel);
  stage.append(canvasFrame, sidebar);
  body.append(stage);

  mount.append(header, body);

  // Register mounts so the gameplay/data-model modules can plug in.
  registerMount("game-canvas", canvasMount);
  registerMount("hud-stats", scorePanel.querySelector("[data-mount=hud-stats]"));

  // Game canvas: ask gameplay module to draw. If unavailable, render the
  // placeholder so the page communicates its purpose.
  if (!invokeRenderer("game-canvas", { state: getState() })) {
    clearMount("game-canvas");
    const placeholder = document.createElement("div");
    placeholder.className = "play-canvas-placeholder";
    placeholder.innerHTML = `
      <strong>Game canvas mounts here</strong>
      <span>The gameplay module will draw the snake inside
      <code>data-mount="game-canvas"</code>.</span>
    `;
    canvasMount.append(placeholder);
  }

  // HUD values: keep the shell-provided numbers visible until the data-model
  // module overwrites them.
  if (hasRenderer("hud-stats")) {
    invokeRenderer("hud-stats", { state: getState() });
  } else {
    paintShellHudFallback(scorePanel);
  }

  // The Start/Pause/Reset buttons are owned by gameplay. We surface them
  // here so the shell looks complete; the gameplay module rebinds these by
  // re-rendering hud-stats with its own DOM, or by listening for the
  // `play:control` event below.
  wireGameControls(controlsPanel);
}

function buildHeader() {
  const header = document.createElement("header");
  header.className = "view-header";

  const titles = document.createElement("div");
  titles.className = "titles";
  titles.innerHTML = `
    <h2>Play</h2>
    <p class="subtitle">Modern Snake — slither, score, survive.</p>
  `;

  const actions = document.createElement("div");
  actions.className = "actions";

  header.append(titles, actions);
  return header;
}

function paintShellHudFallback(scorePanel) {
  const state = getState();
  const modeText = state.obstacleMode.enabled
    ? `Obstacles · ${cap(state.obstacleMode.difficulty)}`
    : "Classic";
  const best = scorePanel.querySelector('[data-hud="best"]');
  const mode = scorePanel.querySelector('[data-hud="mode"]');
  if (best) best.textContent = String(state.highScore || 0);
  if (mode) mode.textContent = modeText;
}

function wireGameControls(panel) {
  for (const button of panel.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      // The shell does not implement gameplay. We dispatch a DOM event the
      // gameplay module can listen for. This keeps the shell decoupled.
      window.dispatchEvent(
        new CustomEvent("snake:control", { detail: { action } }),
      );
    });
  }
}

function cap(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

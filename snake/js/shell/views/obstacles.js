import {
  getState,
  setObstacleMode,
  toggleObstacleMode,
} from "../../store.js";
import {
  registerMount,
  invokeRenderer,
} from "../../extensions.js";
import {
  obstacleLayouts,
  difficultyPresets,
} from "../../data/skinsCatalog.js";

// Obstacle Mode controls. Owns the user-facing toggle, difficulty pickers,
// and layout chooser. Settings persist in the shell store; the gameplay
// module reads obstacleMode at run start to spawn the right wall set.
export function renderObstaclesView(mount) {
  mount.replaceChildren();

  const header = buildHeader();
  const body = document.createElement("div");
  body.className = "view-body";

  const layout = document.createElement("div");
  layout.className = "obstacle-summary";

  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "16px";

  const enableRow = buildEnableRow();
  const difficultyPanel = buildDifficultyPanel();
  const layoutPanel = buildLayoutPanel();
  left.append(enableRow, difficultyPanel, layoutPanel);

  const right = document.createElement("aside");
  right.className = "panel";
  right.innerHTML = `
    <h3>About obstacle mode</h3>
    <p style="margin:0 0 8px;font-size:13px;color:var(--color-text-muted);line-height:1.55;">
      Obstacle Mode adds static walls to the playfield. Hitting a wall ends
      the run, just like hitting your own tail.
    </p>
    <p style="margin:0;font-size:13px;color:var(--color-text-muted);line-height:1.55;">
      Use difficulty to control snake speed and wall density. Use layouts to
      pick a preset arrangement, or set <strong>Random</strong> for a fresh
      board each run.
    </p>
    <div data-mount="obstacle-controls" style="margin-top:14px;"></div>
  `;

  layout.append(left, right);
  body.append(layout);
  mount.append(header, body);

  registerMount(
    "obstacle-controls",
    right.querySelector('[data-mount="obstacle-controls"]'),
  );
  invokeRenderer("obstacle-controls", { state: getState() });
}

function buildHeader() {
  const header = document.createElement("header");
  header.className = "view-header";
  header.innerHTML = `
    <div class="titles">
      <h2>Obstacle Mode</h2>
      <p class="subtitle">Add walls and pillars for a tougher run. Toggle, tune, and ship it.</p>
    </div>
  `;
  return header;
}

function buildEnableRow() {
  const state = getState();
  const row = document.createElement("div");
  row.className = "toggle-row";
  row.innerHTML = `
    <div class="label">
      <span class="name">Enable Obstacle Mode</span>
      <span class="desc">Spawn walls in the playfield. Hit one and the run ends.</span>
    </div>
    <button type="button" class="toggle-switch" aria-pressed="${state.obstacleMode.enabled ? "true" : "false"}" aria-label="Toggle obstacle mode">
      <span class="knob"></span>
    </button>
  `;

  const toggle = row.querySelector(".toggle-switch");
  toggle.addEventListener("click", () => {
    toggleObstacleMode();
    const enabled = getState().obstacleMode.enabled;
    toggle.setAttribute("aria-pressed", enabled ? "true" : "false");
  });

  return row;
}

function buildDifficultyPanel() {
  const state = getState();
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `<h3>Difficulty</h3>`;

  const row = document.createElement("div");
  row.className = "difficulty-row";

  const chips = new Map();
  for (const preset of difficultyPresets) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "difficulty-chip";
    chip.dataset.difficulty = preset.id;
    chip.setAttribute(
      "aria-pressed",
      state.obstacleMode.difficulty === preset.id ? "true" : "false",
    );
    chip.innerHTML = `
      <div>${escapeHtml(preset.name)}</div>
      <div style="font-size:11px;color:var(--color-text-subtle);margin-top:4px;">
        ${escapeHtml(preset.description)}
      </div>
    `;
    chip.addEventListener("click", () => {
      setObstacleMode({ difficulty: preset.id });
      for (const [id, btn] of chips) {
        btn.setAttribute("aria-pressed", id === preset.id ? "true" : "false");
      }
    });
    row.append(chip);
    chips.set(preset.id, chip);
  }

  panel.append(row);
  return panel;
}

function buildLayoutPanel() {
  const state = getState();
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.innerHTML = `<h3>Layout</h3>`;

  const row = document.createElement("div");
  row.className = "layout-row";

  const cards = new Map();
  for (const layout of obstacleLayouts) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "layout-card";
    card.dataset.layoutId = layout.id;
    card.setAttribute(
      "aria-pressed",
      state.obstacleMode.layoutId === layout.id ? "true" : "false",
    );

    const mini = document.createElement("div");
    mini.className = "mini";
    mini.setAttribute("aria-hidden", "true");
    const wallSet = new Set(layout.wallCells.map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = document.createElement("span");
        if (wallSet.has(`${x},${y}`)) cell.dataset.cell = "wall";
        mini.append(cell);
      }
    }

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = layout.name;

    card.append(mini, name);
    card.title = layout.description;

    card.addEventListener("click", () => {
      setObstacleMode({ layoutId: layout.id });
      for (const [id, btn] of cards) {
        btn.setAttribute("aria-pressed", id === layout.id ? "true" : "false");
      }
    });

    row.append(card);
    cards.set(layout.id, card);
  }

  panel.append(row);
  return panel;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

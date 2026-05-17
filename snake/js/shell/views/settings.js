import { getState, setObstacleMode, selectSkin } from "../../store.js";

// Settings + About. Mirrors a few shell-level preferences (selected skin,
// obstacle mode toggle) so users can change them without leaving this view,
// and gives the data-model module a stable spot to attach more controls.
export function renderSettingsView(mount) {
  mount.replaceChildren();

  const header = document.createElement("header");
  header.className = "view-header";
  header.innerHTML = `
    <div class="titles">
      <h2>Settings</h2>
      <p class="subtitle">Tune the shell, peek at the project info.</p>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "view-body";

  const list = document.createElement("section");
  list.className = "settings-list";

  list.append(
    buildToggle({
      name: "Obstacle Mode",
      desc: "Spawn walls into the playfield.",
      pressed: getState().obstacleMode.enabled,
      onToggle: () => {
        const next = !getState().obstacleMode.enabled;
        setObstacleMode({ enabled: next });
        return next;
      },
    }),
    buildSelectRow({
      name: "Snake skin",
      desc: "Quick switch without leaving settings.",
      options: ["classic", "neon", "forest", "ember", "frost", "twilight", "gold"],
      value: getState().selectedSkinId,
      onChange: (value) => selectSkin(value),
    }),
    buildToggle({
      name: "Reduced motion",
      desc: "Dims animations for accessibility. Modules may listen to honor this.",
      pressed: false,
      onToggle: () => {
        // Stub: shell raises an event the gameplay module can honor.
        const enabled = document.documentElement.dataset.reducedMotion !== "true";
        document.documentElement.dataset.reducedMotion = enabled ? "true" : "false";
        window.dispatchEvent(
          new CustomEvent("snake:setting-changed", {
            detail: { key: "reducedMotion", value: enabled },
          }),
        );
        return enabled;
      },
    }),
  );

  const about = document.createElement("section");
  about.className = "panel";
  about.innerHTML = `
    <h3>About</h3>
    <div class="about-card">
      <span class="badge">v0.1</span>
      <p style="margin:0;font-size:13px;color:var(--color-text-muted);">
        Modern Snake — arcade snake with cosmetic skins and an obstacle mode.
        This page is the product shell; gameplay, persistence, and operations
        states are provided by sibling modules.
      </p>
    </div>
  `;

  body.append(list, about);
  mount.append(header, body);
}

function buildToggle({ name, desc, pressed, onToggle }) {
  const row = document.createElement("div");
  row.className = "toggle-row";
  row.innerHTML = `
    <div class="label">
      <span class="name">${escapeHtml(name)}</span>
      <span class="desc">${escapeHtml(desc)}</span>
    </div>
    <button type="button" class="toggle-switch" aria-pressed="${pressed ? "true" : "false"}" aria-label="Toggle ${escapeHtml(name)}">
      <span class="knob"></span>
    </button>
  `;
  const toggle = row.querySelector(".toggle-switch");
  toggle.addEventListener("click", () => {
    const result = onToggle();
    toggle.setAttribute("aria-pressed", result ? "true" : "false");
  });
  return row;
}

function buildSelectRow({ name, desc, options, value, onChange }) {
  const row = document.createElement("div");
  row.className = "toggle-row";
  row.innerHTML = `
    <div class="label">
      <span class="name">${escapeHtml(name)}</span>
      <span class="desc">${escapeHtml(desc)}</span>
    </div>
    <select class="select" aria-label="${escapeHtml(name)}">
      ${options
        .map(
          (o) =>
            `<option value="${escapeHtml(o)}" ${o === value ? "selected" : ""}>${escapeHtml(cap(o))}</option>`,
        )
        .join("")}
    </select>
  `;
  row.querySelector("select").addEventListener("change", (e) => {
    onChange(e.target.value);
  });
  return row;
}

function cap(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

import {
  getState,
  selectSkin,
  isSkinUnlocked,
} from "../../store.js";
import {
  registerMount,
  invokeRenderer,
  hasRenderer,
} from "../../extensions.js";
import { defaultSkinsCatalog } from "../../data/skinsCatalog.js";

// Skins gallery view. The shell ships with a default catalog so the gallery
// is always browsable; the data-model module can replace the catalog at
// runtime by registering a "skins-grid" renderer. Selection state lives in
// the shell store — gameplay/canvas reads selectedSkinId to colorize.
export function renderSkinsView(mount) {
  mount.replaceChildren();

  const header = buildHeader();
  const body = document.createElement("div");
  body.className = "view-body";

  const summary = document.createElement("p");
  summary.className = "subtitle";
  summary.style.margin = "0";
  summary.textContent =
    "Pick a snake skin. Starter skins are unlocked from day one; the rest unlock as you play.";

  const grid = document.createElement("div");
  grid.className = "skins-grid";
  grid.dataset.mount = "skins-grid";

  body.append(summary, grid);
  mount.append(header, body);

  registerMount("skins-grid", grid);

  if (!invokeRenderer("skins-grid", { catalog: defaultSkinsCatalog, state: getState() })) {
    paintDefaultGrid(grid, defaultSkinsCatalog);
  } else if (!hasRenderer("skins-grid")) {
    paintDefaultGrid(grid, defaultSkinsCatalog);
  }
}

function buildHeader() {
  const header = document.createElement("header");
  header.className = "view-header";
  header.innerHTML = `
    <div class="titles">
      <h2>Snake Skins</h2>
      <p class="subtitle">Cosmetic palettes that change how your snake looks. Performance-neutral.</p>
    </div>
  `;
  return header;
}

function paintDefaultGrid(grid, catalog) {
  grid.replaceChildren();
  const selected = getState().selectedSkinId;

  for (const skin of catalog) {
    grid.append(buildCard(skin, skin.id === selected));
  }
}

function buildCard(skin, isSelected) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "skin-card";
  card.dataset.skinId = skin.id;
  card.setAttribute("aria-pressed", isSelected ? "true" : "false");

  const locked = !isSkinUnlocked(skin.id);
  if (locked) card.dataset.locked = "true";

  card.style.setProperty("--seg-color", skin.body);
  card.style.setProperty("--head-color", skin.head);

  const segs = Array.from({ length: 4 }, (_, i) => {
    if (i === 0) return `<span class="seg head"></span>`;
    return `<span class="seg" style="background:${skin.body}"></span>`;
  }).join("");

  card.innerHTML = `
    <div class="preview" aria-hidden="true">
      <div class="segments">
        ${segs}
      </div>
    </div>
    <div class="name">${escapeHtml(skin.name)}</div>
    <div class="meta">${escapeHtml(skin.description || "")}</div>
    <div class="lock">${locked ? `🔒 ${escapeHtml(skin.unlockHint || "Locked")}` : ""}</div>
    <div class="selected-badge">Equipped</div>
  `;

  card.addEventListener("click", () => {
    if (locked) {
      // Visual nudge — siblings can listen for this event to show a toast.
      window.dispatchEvent(
        new CustomEvent("snake:skin-locked", { detail: { skinId: skin.id } }),
      );
      return;
    }
    selectSkin(skin.id);
  });

  return card;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

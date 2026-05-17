import { getState, navigateTo } from "../store.js";

// Side navigation. Single source of truth for the visible views and their
// labels. Other modules can read this list to render their own quick links
// if needed (it stays small on purpose).
export const NAV_ITEMS = [
  {
    id: "play",
    label: "Play",
    glyph: "▶",
    section: "main",
  },
  {
    id: "skins",
    label: "Skins",
    glyph: "✩",
    section: "customize",
  },
  {
    id: "obstacles",
    label: "Obstacle Mode",
    glyph: "▣",
    section: "customize",
  },
  {
    id: "scores",
    label: "High Scores",
    glyph: "★",
    section: "more",
  },
  {
    id: "settings",
    label: "Settings",
    glyph: "⚙",
    section: "more",
  },
];

const SECTION_LABELS = {
  main: "Game",
  customize: "Customize",
  more: "More",
};

export function renderSidebar(mount) {
  const nav = document.createElement("nav");
  nav.className = "snake-nav";
  nav.setAttribute("aria-label", "Modern Snake sections");

  let lastSection = null;
  const linkButtons = new Map();

  for (const item of NAV_ITEMS) {
    if (item.section !== lastSection) {
      lastSection = item.section;
      const sectionLabel = document.createElement("div");
      sectionLabel.className = "nav-section-label";
      sectionLabel.textContent = SECTION_LABELS[item.section] || "";
      nav.append(sectionLabel);
    }

    const link = document.createElement("button");
    link.type = "button";
    link.className = "nav-link";
    link.dataset.view = item.id;
    link.innerHTML = `
      <span class="glyph" aria-hidden="true">${item.glyph}</span>
      <span class="label">${item.label}</span>
      <span class="badge" data-badge hidden></span>
    `;
    link.addEventListener("click", () => navigateTo(item.id));
    nav.append(link);
    linkButtons.set(item.id, link);
  }

  const footer = document.createElement("div");
  footer.className = "nav-footer";
  footer.textContent = "v0.1 · Shell preview";
  nav.append(footer);

  mount.append(nav);

  function refresh() {
    const state = getState();
    for (const [id, link] of linkButtons) {
      if (id === state.view) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }

      const badge = link.querySelector("[data-badge]");
      if (!badge) continue;

      if (id === "obstacles" && state.obstacleMode.enabled) {
        badge.hidden = false;
        badge.textContent = "On";
      } else if (id === "skins") {
        badge.hidden = false;
        const skinName = describeSelectedSkin(state.selectedSkinId);
        badge.textContent = skinName;
      } else {
        badge.hidden = true;
        badge.textContent = "";
      }
    }
  }

  refresh();
  return refresh;
}

function describeSelectedSkin(id) {
  if (!id) return "";
  if (id === "classic") return "Classic";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

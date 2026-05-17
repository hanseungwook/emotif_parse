import { setSearch } from "../store.js";

// Three shell-owned empty states:
//   - List empty: no conversations / no search results in the sidebar.
//   - No selection: nothing selected in the main pane.
//   - (Loading and not-connected states are intentionally not duplicated here;
//     they live next to the data layer that owns the underlying signal.)

export function renderListEmptyState(mount, { searching = false } = {}) {
  mount.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "list-empty";

  if (searching) {
    wrap.textContent = "No conversations match your search.";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "empty-action";
    action.style.marginTop = "12px";
    action.textContent = "Clear search";
    action.addEventListener("click", () => {
      setSearch("");
      const input = document.querySelector('[data-input="search"]');
      if (input) input.value = "";
    });
    wrap.append(document.createElement("br"), action);
  } else {
    wrap.textContent = "No conversations yet. Start one from the + button above.";
  }

  mount.append(wrap);
}

export function renderNoSelectionEmptyState(mount, { hasConversations = false } = {}) {
  mount.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const glyph = document.createElement("span");
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "\u{1F4AC}"; // speech balloon

  const title = document.createElement("h2");
  const body = document.createElement("p");

  if (hasConversations) {
    title.textContent = "Pick a conversation";
    body.textContent =
      "Choose a conversation from the list on the left to see its messages here.";
  } else {
    title.textContent = "No conversations yet";
    body.textContent =
      "Start a new conversation to begin chatting. The list on the left will populate as conversations arrive.";
  }

  empty.append(glyph, title, body);
  mount.append(empty);
}

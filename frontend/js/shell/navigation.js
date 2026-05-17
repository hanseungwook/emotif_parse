import {
  clearSelection,
  getState,
  selectConversation,
  setSidebarOpen,
} from "../store.js";

// Wires navigation: keyboard shortcuts and history sync so deep links survive
// reloads and back/forward work. Conversation IDs are kept in the URL hash to
// keep server-side concerns out of the shell.
//
// Hash format:
//   #/                  -> conversation list (no selection)
//   #/c/<id>            -> active conversation by id

export function installNavigation() {
  applyHash();
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("keydown", onGlobalKeydown);
}

export function syncHashFromState() {
  const state = getState();
  const desired = state.selectedConversationId
    ? `#/c/${state.selectedConversationId}`
    : "#/";
  if (window.location.hash !== desired) {
    history.replaceState(null, "", desired);
  }
}

function applyHash() {
  const hash = window.location.hash || "#/";
  const match = hash.match(/^#\/c\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const state = getState();
    if (state.conversations.some((c) => c.id === id)) {
      selectConversation(id);
      // On narrow viewports keep the sidebar collapsed so the chat fills the
      // viewport after deep-linking.
      if (window.matchMedia("(max-width: 720px)").matches) {
        setSidebarOpen(false);
      }
      return;
    }
  }
  if (hash !== "#/") clearSelection();
}

function onGlobalKeydown(event) {
  if (event.defaultPrevented) return;
  if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;

  if (event.key === "Escape") {
    clearSelection();
    history.replaceState(null, "", "#/");
  }
}

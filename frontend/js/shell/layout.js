import {
  clearSelection,
  getState,
  setSearch,
  setSidebarOpen,
  setState,
  subscribe,
  toggleSidebar,
} from "../store.js";
import { renderConversationList } from "./conversationList.js";
import { renderChatView } from "./chatView.js";

// Builds the persistent two-column layout shell and keeps body-level data
// attributes in sync so CSS can react to view/sidebar state.
export function renderLayout(root) {
  root.replaceChildren();
  root.classList.add("app-root");

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";
  sidebar.setAttribute("aria-label", "Conversations");

  const sidebarHeader = document.createElement("header");
  sidebarHeader.className = "sidebar-header";
  sidebarHeader.innerHTML = `
    <h1>Chats</h1>
    <button
      type="button"
      class="icon-button"
      data-action="new-conversation"
      aria-label="Start a new conversation"
      title="Start a new conversation"
    >+</button>
  `;

  const search = document.createElement("div");
  search.className = "sidebar-search";
  search.innerHTML = `
    <input
      type="search"
      placeholder="Search conversations"
      aria-label="Search conversations"
      data-input="search"
    />
  `;

  const listMount = document.createElement("div");
  listMount.className = "conversation-list";
  listMount.setAttribute("role", "listbox");
  listMount.setAttribute("aria-label", "Conversation list");

  sidebar.append(sidebarHeader, search, listMount);

  const main = document.createElement("section");
  main.className = "app-main";
  main.setAttribute("aria-label", "Active conversation");

  root.append(sidebar, main);

  // Wire static handlers
  sidebarHeader
    .querySelector('[data-action="new-conversation"]')
    .addEventListener("click", () => {
      // New-conversation flow is a sibling concern — emit a hook so the
      // messaging module can take over. For now, just clear selection so
      // the empty state's CTA shows.
      clearSelection();
    });

  search.querySelector('[data-input="search"]').addEventListener("input", (e) => {
    setSearch(e.target.value);
  });

  // Reactive render: list + main view + root attributes.
  const renderAll = () => {
    const state = getState();
    root.dataset.view = state.view;
    root.dataset.sidebar = state.sidebarOpen ? "open" : "closed";
    renderConversationList(listMount);
    renderChatView(main, { onBack: showListView });
  };

  subscribe(renderAll);
  renderAll();
}

// Returns to the list pane without dropping the active conversation. Used by
// the narrow-viewport back affordance in the chat header.
function showListView() {
  setSidebarOpen(true);
  if (getState().view === "conversation") {
    setState({ view: "conversations" });
  }
}

export function bindToggleSidebar(button) {
  button?.addEventListener("click", () => toggleSidebar());
}

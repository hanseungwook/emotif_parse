import {
  getFilteredConversations,
  getState,
  selectConversation,
} from "../store.js";
import { renderListEmptyState } from "./emptyStates.js";

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function renderConversationList(mount) {
  const state = getState();
  const conversations = getFilteredConversations();

  mount.replaceChildren();

  if (state.loading) {
    const loading = document.createElement("div");
    loading.className = "list-empty";
    loading.textContent = "Loading conversations…";
    mount.append(loading);
    return;
  }

  if (conversations.length === 0) {
    renderListEmptyState(mount, { searching: state.search.length > 0 });
    return;
  }

  for (const conv of conversations) {
    mount.append(buildItem(conv, state.selectedConversationId === conv.id));
  }
}

function buildItem(conv, isSelected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "conversation-item";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", isSelected ? "true" : "false");
  button.dataset.conversationId = conv.id;

  const initials = makeInitials(conv.name || "?");
  const last = conv.lastMessage;
  const previewText = last ? formatPreview(last) : "No messages yet";
  const time = last?.timestamp ? formatTime(last.timestamp) : "";
  const unread = conv.unreadCount && conv.unreadCount > 0 ? conv.unreadCount : 0;

  button.innerHTML = `
    <span class="avatar" aria-hidden="true">${escapeHtml(initials)}</span>
    <span class="body">
      <span class="row">
        <span class="name">${escapeHtml(conv.name || "Untitled")}</span>
        ${time ? `<span class="time">${escapeHtml(time)}</span>` : ""}
      </span>
      <span class="row">
        <span class="preview">${escapeHtml(previewText)}</span>
        ${unread ? `<span class="unread-badge" aria-label="${unread} unread">${unread}</span>` : ""}
      </span>
    </span>
  `;

  button.addEventListener("click", () => selectConversation(conv.id));
  return button;
}

function formatPreview(message) {
  const author = message.authorName ? `${message.authorName}: ` : "";
  return `${author}${message.text || ""}`;
}

function formatTime(ts) {
  const d = new Date(ts);
  const diffMs = Date.now() - ts;
  const day = 1000 * 60 * 60 * 24;
  if (diffMs < day) return TIME_FMT.format(d);
  if (diffMs < day * 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function makeInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

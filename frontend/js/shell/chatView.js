import { getSelectedConversation, getState } from "../store.js";
import {
  registerMount,
  invokeRenderer,
  hasRenderer,
  clearMount,
} from "../extensions.js";
import { renderNoSelectionEmptyState } from "./emptyStates.js";

// Renders the right-hand chat container. The shell owns the chrome (header,
// scroll container, composer area) and exposes three mount points by name
// that other subsystems write into:
//   - "messages":  rendered into chat-messages-mount  (messaging runtime)
//   - "presence":  rendered into chat-presence-mount  (presence signals)
//   - "composer":  rendered into chat-composer-mount  (messaging runtime)
export function renderChatView(mount, { onBack } = {}) {
  const state = getState();
  const conv = getSelectedConversation();

  mount.replaceChildren();

  if (!conv) {
    renderNoSelectionEmptyState(mount, {
      hasConversations: state.conversations.length > 0,
    });
    return;
  }

  const header = buildHeader(conv, { onBack });
  const presence = document.createElement("div");
  presence.className = "chat-presence-mount";
  presence.dataset.mount = "presence";

  const body = document.createElement("div");
  body.className = "chat-body";

  const messages = document.createElement("div");
  messages.className = "chat-messages-mount";
  messages.dataset.mount = "messages";
  body.append(messages);

  const composer = document.createElement("div");
  composer.className = "chat-composer-mount";
  composer.dataset.mount = "composer";

  mount.append(header, presence, body, composer);

  // Register mounts so sibling modules can write into them.
  registerMount("messages", messages);
  registerMount("presence", presence);
  registerMount("composer", composer);

  // Ask registered renderers to draw their content. If a renderer is missing
  // (which is the expected state when the shell ships before the other
  // modules), fall back to a tasteful placeholder.
  if (!invokeRenderer("messages", { conversation: conv })) {
    clearMount("messages");
    const placeholder = document.createElement("div");
    placeholder.className = "list-empty";
    placeholder.textContent = "Messages will appear here once the messaging runtime is connected.";
    messages.append(placeholder);
  }

  if (!invokeRenderer("composer", { conversation: conv })) {
    clearMount("composer");
    const placeholder = document.createElement("div");
    placeholder.className = "composer-placeholder";
    placeholder.setAttribute("role", "note");
    placeholder.textContent = "Composer is provided by the messaging runtime.";
    composer.append(placeholder);
  }

  if (!hasRenderer("presence")) {
    presence.textContent = "";
  } else {
    invokeRenderer("presence", { conversation: conv });
  }
}

function buildHeader(conv, { onBack }) {
  const header = document.createElement("header");
  header.className = "chat-header";

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "menu-button";
  menuButton.setAttribute("aria-label", "Show conversations");
  menuButton.innerHTML = "&larr;";
  menuButton.addEventListener("click", () => {
    if (typeof onBack === "function") onBack();
  });

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = makeInitials(conv.name || "?");

  const info = document.createElement("div");
  info.className = "info";

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = conv.name || "Untitled";

  const status = document.createElement("span");
  status.className = "status";
  status.textContent = describeParticipants(conv.participants);

  info.append(name, status);
  header.append(menuButton, avatar, info);
  return header;
}

function describeParticipants(participants) {
  if (!Array.isArray(participants) || participants.length === 0) {
    return "Direct message";
  }
  const others = participants.filter((p) => p !== "you");
  if (others.length === 1) return "1 participant";
  return `${others.length} participants`;
}

function makeInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// Minimal observable store + event bus shared across shell modules.
// Sibling subsystems (messaging, presence) read state via getState() and
// react to changes via subscribe() / on().

const listeners = new Set();
const events = new Map();

let state = {
  conversations: [],
  selectedConversationId: null,
  view: "conversations", // "conversations" | "conversation"
  sidebarOpen: true,
  loading: false,
  search: "",
};

export function getState() {
  return state;
}

export function setState(partial) {
  const next = { ...state, ...partial };
  if (shallowEqual(state, next)) return;
  state = next;
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error("store listener error", err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function on(eventName, fn) {
  if (!events.has(eventName)) events.set(eventName, new Set());
  events.get(eventName).add(fn);
  return () => events.get(eventName).delete(fn);
}

export function emit(eventName, payload) {
  const set = events.get(eventName);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`event listener error (${eventName})`, err);
    }
  }
}

// ---- Conversation actions ----

export function setConversations(conversations) {
  setState({ conversations: Array.isArray(conversations) ? conversations : [] });
}

export function selectConversation(id) {
  if (state.selectedConversationId === id) {
    setState({ view: "conversation" });
  } else {
    setState({ selectedConversationId: id, view: "conversation" });
    emit("conversation:selected", { id });
  }
}

export function clearSelection() {
  setState({ selectedConversationId: null, view: "conversations" });
  emit("conversation:cleared");
}

export function setSearch(search) {
  setState({ search: search || "" });
}

export function setSidebarOpen(open) {
  setState({ sidebarOpen: !!open });
}

export function toggleSidebar() {
  setSidebarOpen(!state.sidebarOpen);
}

export function setLoading(loading) {
  setState({ loading: !!loading });
}

// ---- Selectors ----

export function getSelectedConversation() {
  if (!state.selectedConversationId) return null;
  return (
    state.conversations.find((c) => c.id === state.selectedConversationId) ||
    null
  );
}

export function getFilteredConversations() {
  const q = state.search.trim().toLowerCase();
  if (!q) return state.conversations;
  return state.conversations.filter((c) => {
    const haystack = `${c.name || ""} ${c.lastMessage?.text || ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

function shallowEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

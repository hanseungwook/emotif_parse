// Demo data the shell uses when no messaging backend has populated the store.
// The messaging runtime module replaces this by calling setConversations()
// with live data.

export const sampleConversations = [
  {
    id: "c-1",
    name: "Design crit",
    participants: ["maya", "jules", "you"],
    unreadCount: 2,
    lastMessage: {
      text: "Pushed the new onboarding mocks for review.",
      authorName: "Maya",
      timestamp: Date.now() - 1000 * 60 * 4,
    },
  },
  {
    id: "c-2",
    name: "Jules Park",
    participants: ["jules", "you"],
    unreadCount: 0,
    lastMessage: {
      text: "Sounds good — let's catch up tomorrow.",
      authorName: "Jules",
      timestamp: Date.now() - 1000 * 60 * 60 * 3,
    },
  },
  {
    id: "c-3",
    name: "Launch room",
    participants: ["maya", "jules", "ravi", "you"],
    unreadCount: 0,
    lastMessage: {
      text: "Status check at 4pm.",
      authorName: "Ravi",
      timestamp: Date.now() - 1000 * 60 * 60 * 26,
    },
  },
];

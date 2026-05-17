// Default skins catalog used by the shell so the Skins gallery is browsable
// before the data-model module is wired in. The data-model module replaces
// this list at runtime by calling setSkinsCatalog().
//
// Each entry intentionally avoids gameplay-specific fields (segment size,
// animation frames, etc.) — those belong to the gameplay/skin renderer
// module. The shell only needs id, name, palette, and unlock metadata to
// render the gallery.

export const defaultSkinsCatalog = [
  {
    id: "classic",
    name: "Classic",
    description: "The original arcade green.",
    head: "#4ade80",
    body: "#22c55e",
    accent: "#16a34a",
    rarity: "starter",
    unlockHint: null,
  },
  {
    id: "neon",
    name: "Neon Pulse",
    description: "Cyan-magenta glow trail.",
    head: "#22d3ee",
    body: "#06b6d4",
    accent: "#d946ef",
    rarity: "starter",
    unlockHint: null,
  },
  {
    id: "forest",
    name: "Forest",
    description: "Mossy greens and bark.",
    head: "#84cc16",
    body: "#65a30d",
    accent: "#4d7c0f",
    rarity: "starter",
    unlockHint: null,
  },
  {
    id: "ember",
    name: "Ember",
    description: "Molten orange-red gradient.",
    head: "#f97316",
    body: "#ea580c",
    accent: "#fbbf24",
    rarity: "unlockable",
    unlockHint: "Reach score 50",
  },
  {
    id: "frost",
    name: "Frost",
    description: "Icy blues with white highlights.",
    head: "#bae6fd",
    body: "#60a5fa",
    accent: "#3b82f6",
    rarity: "unlockable",
    unlockHint: "Reach score 100",
  },
  {
    id: "twilight",
    name: "Twilight",
    description: "Deep violet shifting into pink.",
    head: "#c084fc",
    body: "#a855f7",
    accent: "#ec4899",
    rarity: "unlockable",
    unlockHint: "Clear obstacle mode on Hard",
  },
  {
    id: "gold",
    name: "Gold Ribbon",
    description: "Champion skin — earned, not given.",
    head: "#fde047",
    body: "#facc15",
    accent: "#a16207",
    rarity: "rare",
    unlockHint: "Top 10 on the global leaderboard",
  },
];

export const obstacleLayouts = [
  {
    id: "open",
    name: "Open Field",
    description: "No interior walls — just the board edges.",
    wallCells: [],
  },
  {
    id: "pillars",
    name: "Pillars",
    description: "Four short pillars in the corners.",
    wallCells: [
      [1, 1], [2, 1],
      [6, 1], [5, 1],
      [1, 4], [2, 4],
      [6, 4], [5, 4],
    ],
  },
  {
    id: "maze",
    name: "Maze",
    description: "Tight corridors. High risk, high reward.",
    wallCells: [
      [2, 0], [2, 1], [2, 2],
      [5, 3], [5, 4], [5, 5],
      [3, 2], [4, 2],
    ],
  },
  {
    id: "tunnel",
    name: "Tunnel",
    description: "Horizontal walls force long sweeping turns.",
    wallCells: [
      [1, 2], [2, 2], [3, 2], [4, 2],
      [3, 3], [4, 3], [5, 3], [6, 3],
    ],
  },
  {
    id: "random",
    name: "Random",
    description: "Layout reshuffles every run.",
    wallCells: [],
  },
];

export const difficultyPresets = [
  {
    id: "easy",
    name: "Easy",
    description: "Fewer walls, slower snake.",
    tickRateMs: 140,
    wallDensity: 0.5,
  },
  {
    id: "normal",
    name: "Normal",
    description: "Balanced challenge.",
    tickRateMs: 100,
    wallDensity: 1.0,
  },
  {
    id: "hard",
    name: "Hard",
    description: "Dense walls, faster snake, no walking through edges.",
    tickRateMs: 75,
    wallDensity: 1.5,
  },
];

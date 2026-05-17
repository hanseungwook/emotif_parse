'use strict';

// Snake Skins: cosmetic palettes that drive how the renderer paints the snake.
// The engine only stores the active skin id; the renderer reads the full
// definition. Skins are pure data so they are safe to share with persistence
// and UI modules without coupling.
const SKINS = Object.freeze({
  classic: Object.freeze({
    id: 'classic',
    label: 'Classic Green',
    head: '#1f8a4c',
    body: '#2cb86b',
    accent: '#b9f5cf',
    eye: '#0d2818',
    description: 'The original arcade pixel snake.',
  }),
  neon: Object.freeze({
    id: 'neon',
    label: 'Neon Pulse',
    head: '#ff2bd6',
    body: '#7cf6ff',
    accent: '#fff66b',
    eye: '#1c0033',
    description: 'High-contrast neon for night-mode play.',
  }),
  ember: Object.freeze({
    id: 'ember',
    label: 'Ember Coil',
    head: '#ff6b1a',
    body: '#ffb347',
    accent: '#fff1c1',
    eye: '#3b0f00',
    description: 'Warm gradient that pulses with each tick.',
  }),
  shadow: Object.freeze({
    id: 'shadow',
    label: 'Shadow Mamba',
    head: '#222633',
    body: '#3c4256',
    accent: '#7a83a8',
    eye: '#f0f3ff',
    description: 'Stealth palette tuned for obstacle mode.',
  }),
});

const DEFAULT_SKIN_ID = 'classic';

function listSkins() {
  return Object.values(SKINS);
}

function hasSkin(skinId) {
  return Object.prototype.hasOwnProperty.call(SKINS, skinId);
}

function getSkin(skinId) {
  if (!hasSkin(skinId)) return SKINS[DEFAULT_SKIN_ID];
  return SKINS[skinId];
}

module.exports = { SKINS, DEFAULT_SKIN_ID, listSkins, hasSkin, getSkin };

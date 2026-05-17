'use strict';

const { ValidationError } = require('./errors');

// Skin entity. Skins control how a snake renders: colors, pattern, eyes.
// Unlock conditions describe how the player earns the skin — kept as data so
// the catalog can be loaded from JSON without changing code.

const SKIN_RARITY = Object.freeze({
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
});

const SKIN_PATTERNS = Object.freeze({
  SOLID: 'solid',
  STRIPED: 'striped',
  GRADIENT: 'gradient',
  CHECKER: 'checker',
  DOTTED: 'dotted',
  SCALE: 'scale',
});

const EYE_STYLES = Object.freeze({
  ROUND: 'round',
  SLIT: 'slit',
  ANGRY: 'angry',
  SLEEPY: 'sleepy',
  CYBER: 'cyber',
});

const UNLOCK_KIND = Object.freeze({
  DEFAULT: 'default', // unlocked from the start
  SCORE: 'score', // reach a score in some mode
  GAMES: 'games', // play N games
  OBSTACLE_CLEAR: 'obstacle_clear', // clear N obstacle layouts
  PURCHASE: 'purchase', // bought (placeholder for future economy)
});

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function assertHex(value, field) {
  if (typeof value !== 'string' || !HEX.test(value)) {
    throw new ValidationError(`${field} must be a hex color (got ${value})`);
  }
  return value;
}

function assertEnum(value, allowed, field) {
  const list = Object.values(allowed);
  if (!list.includes(value)) {
    throw new ValidationError(`${field} must be one of ${list.join(', ')}`);
  }
  return value;
}

function normalizeUnlock(unlock) {
  if (!unlock) return { kind: UNLOCK_KIND.DEFAULT };
  const kind = assertEnum(unlock.kind, UNLOCK_KIND, 'skin.unlock.kind');
  switch (kind) {
    case UNLOCK_KIND.DEFAULT:
      return { kind };
    case UNLOCK_KIND.SCORE: {
      if (!Number.isInteger(unlock.score) || unlock.score <= 0) {
        throw new ValidationError('skin.unlock.score must be a positive integer');
      }
      const mode = unlock.mode ? String(unlock.mode) : null;
      return { kind, score: unlock.score, mode };
    }
    case UNLOCK_KIND.GAMES: {
      if (!Number.isInteger(unlock.games) || unlock.games <= 0) {
        throw new ValidationError('skin.unlock.games must be a positive integer');
      }
      return { kind, games: unlock.games };
    }
    case UNLOCK_KIND.OBSTACLE_CLEAR: {
      if (!Number.isInteger(unlock.clears) || unlock.clears <= 0) {
        throw new ValidationError('skin.unlock.clears must be a positive integer');
      }
      return { kind, clears: unlock.clears };
    }
    case UNLOCK_KIND.PURCHASE: {
      if (!Number.isInteger(unlock.price) || unlock.price < 0) {
        throw new ValidationError('skin.unlock.price must be a non-negative integer');
      }
      return { kind, price: unlock.price, currency: unlock.currency || 'coins' };
    }
    default:
      throw new ValidationError(`unsupported unlock kind ${kind}`);
  }
}

function createSkin(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('skin requires an object');
  }
  if (typeof input.id !== 'string' || !input.id) {
    throw new ValidationError('skin.id is required');
  }
  if (typeof input.name !== 'string' || !input.name) {
    throw new ValidationError('skin.name is required');
  }
  const primaryColor = assertHex(input.primaryColor, 'skin.primaryColor');
  const secondaryColor = assertHex(
    input.secondaryColor || input.primaryColor,
    'skin.secondaryColor'
  );
  const pattern = assertEnum(input.pattern || SKIN_PATTERNS.SOLID, SKIN_PATTERNS, 'skin.pattern');
  const eyeStyle = assertEnum(input.eyeStyle || EYE_STYLES.ROUND, EYE_STYLES, 'skin.eyeStyle');
  const rarity = assertEnum(input.rarity || SKIN_RARITY.COMMON, SKIN_RARITY, 'skin.rarity');
  const unlock = normalizeUnlock(input.unlock);
  return Object.freeze({
    id: input.id,
    name: input.name,
    description: input.description || '',
    primaryColor,
    secondaryColor,
    pattern,
    eyeStyle,
    rarity,
    unlock,
    headColor: assertHex(input.headColor || primaryColor, 'skin.headColor'),
    accentColor: input.accentColor
      ? assertHex(input.accentColor, 'skin.accentColor')
      : secondaryColor,
  });
}

// Evaluate whether the player meets a skin's unlock conditions.
function isSkinUnlocked(skin, playerStats) {
  const stats = playerStats || {};
  switch (skin.unlock.kind) {
    case UNLOCK_KIND.DEFAULT:
      return true;
    case UNLOCK_KIND.SCORE: {
      const required = skin.unlock.score;
      if (skin.unlock.mode) {
        const byMode = stats.bestScoresByMode || {};
        return (byMode[skin.unlock.mode] || 0) >= required;
      }
      return (stats.bestScore || 0) >= required;
    }
    case UNLOCK_KIND.GAMES:
      return (stats.gamesPlayed || 0) >= skin.unlock.games;
    case UNLOCK_KIND.OBSTACLE_CLEAR:
      return (stats.obstacleClears || 0) >= skin.unlock.clears;
    case UNLOCK_KIND.PURCHASE: {
      const owned = stats.purchasedSkinIds || [];
      return owned.includes(skin.id);
    }
    default:
      return false;
  }
}

module.exports = {
  SKIN_RARITY,
  SKIN_PATTERNS,
  EYE_STYLES,
  UNLOCK_KIND,
  createSkin,
  isSkinUnlocked,
};

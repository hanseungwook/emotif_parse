'use strict';

// Operational lifecycle states for Modern Snake.
//
// Gameplay and rendering live in other modules; this module owns the
// observable lifecycle: booting → loading → empty → (active|recovering)
// → completed | error.
//
// active/paused are exposed so transitions remain coherent across modules,
// even though gameplay itself is implemented by Core Workflow.
const STATES = Object.freeze({
  BOOTING: 'booting',
  LOADING: 'loading',
  EMPTY: 'empty',
  ACTIVE: 'active',
  PAUSED: 'paused',
  RECOVERING: 'recovering',
  ERROR: 'error',
  COMPLETED: 'completed',
});

const STATE_VALUES = Object.freeze(Object.values(STATES));

// Adjacency list: which states each state may transition into.
const TRANSITIONS = Object.freeze({
  [STATES.BOOTING]: Object.freeze([STATES.LOADING, STATES.ERROR]),
  [STATES.LOADING]: Object.freeze([STATES.EMPTY, STATES.ERROR]),
  [STATES.EMPTY]: Object.freeze([
    STATES.LOADING,
    STATES.ACTIVE,
    STATES.RECOVERING,
    STATES.ERROR,
  ]),
  [STATES.ACTIVE]: Object.freeze([
    STATES.PAUSED,
    STATES.COMPLETED,
    STATES.ERROR,
  ]),
  [STATES.PAUSED]: Object.freeze([
    STATES.ACTIVE,
    STATES.COMPLETED,
    STATES.ERROR,
    STATES.EMPTY,
  ]),
  [STATES.RECOVERING]: Object.freeze([
    STATES.ACTIVE,
    STATES.EMPTY,
    STATES.ERROR,
  ]),
  [STATES.ERROR]: Object.freeze([
    STATES.RECOVERING,
    STATES.LOADING,
    STATES.EMPTY,
  ]),
  [STATES.COMPLETED]: Object.freeze([STATES.EMPTY, STATES.LOADING]),
});

function isState(value) {
  return typeof value === 'string' && STATE_VALUES.indexOf(value) !== -1;
}

function canTransition(from, to) {
  if (!isState(from) || !isState(to)) return false;
  const allowed = TRANSITIONS[from];
  return allowed.indexOf(to) !== -1;
}

function assertTransition(from, to) {
  if (!isState(to)) {
    throw new TypeError('unknown target state: ' + String(to));
  }
  if (!canTransition(from, to)) {
    throw new Error('invalid transition: ' + String(from) + ' → ' + String(to));
  }
}

module.exports = {
  STATES,
  STATE_VALUES,
  TRANSITIONS,
  isState,
  canTransition,
  assertTransition,
};

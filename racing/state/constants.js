'use strict';

// Race phases. The race state machine progresses linearly through them with
// pause/resume able to suspend any active phase.
//   IDLE       → race has been created but not armed; awaiting start().
//   COUNTDOWN  → starting lights are running; vehicles cannot accelerate.
//   RACING     → green flag; lap/checkpoint progression is active.
//   PAUSED     → menu pause; previous phase is preserved for resume().
//   CRASHED    → vehicle is in the crash-respawn window; race clock keeps
//                running but lap progress is frozen until respawn completes.
//   FINISHED   → finish line crossed on the final lap; finish results
//                computed.
//   ABANDONED  → run gave up (DNF) before crossing the finish line.
const PHASE = Object.freeze({
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  PAUSED: 'paused',
  CRASHED: 'crashed',
  FINISHED: 'finished',
  ABANDONED: 'abandoned',
});

const FINISH_REASON = Object.freeze({
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
  TIMED_OUT: 'timedOut',
});

const CRASH_SEVERITY = Object.freeze({
  MINOR: 'minor',
  MAJOR: 'major',
  TOTAL: 'total',
});

const EVENTS = Object.freeze({
  RESET: 'reset',
  START: 'start',
  COUNTDOWN_TICK: 'countdown:tick',
  COUNTDOWN_GO: 'countdown:go',
  RACE_BEGIN: 'race:begin',
  RACE_TICK: 'race:tick',
  PAUSE: 'pause',
  RESUME: 'resume',
  CHECKPOINT: 'checkpoint',
  LAP_COMPLETE: 'lap:complete',
  BEST_LAP: 'lap:best',
  CRASH: 'crash',
  RESPAWN: 'respawn',
  ABANDON: 'abandon',
  FINISH: 'finish',
  RESULTS: 'results',
  PHASE_CHANGE: 'phase:change',
});

const DEFAULTS = Object.freeze({
  totalLaps: 3,
  // Number of intermediate checkpoints between the start/finish line.
  // The start/finish line itself counts as checkpoint index 0; intermediate
  // checkpoints have indices 1..checkpointCount, then index 0 again closes
  // the lap.
  checkpointCount: 3,
  // Countdown beats. Default: 3, 2, 1, GO.
  countdownSteps: 3,
  countdownStepMs: 1000,
  // Time the vehicle is held in the CRASHED phase before respawning.
  respawnDelayMs: 1500,
  // Optional time-trial timeout. null disables it.
  timeLimitMs: null,
  // Allow finishing even if a checkpoint was missed (set true for casual
  // mode; default enforces lap validity).
  allowMissedCheckpoints: false,
  // Number of best lap records to keep (also stored in results).
  topLapHistory: 32,
});

// Mode flags returned in snapshots to help HUDs render the right widgets.
const MODE = Object.freeze({
  LAP_RACE: 'lapRace',
  TIME_ATTACK: 'timeAttack',
});

module.exports = {
  PHASE,
  FINISH_REASON,
  CRASH_SEVERITY,
  EVENTS,
  DEFAULTS,
  MODE,
};

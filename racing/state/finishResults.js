'use strict';

const { FINISH_REASON } = require('./constants');

// Pure helpers that turn a RaceState snapshot into a results record.
// Keeping them as functions (rather than methods on RaceState) makes them
// trivial to call from delivered scoreboards or end-of-race overlays.

function summarizeLapHistory(lapHistory) {
  const valid = lapHistory.filter((l) => !l.invalid);
  let bestLap = null;
  let worstLap = null;
  let totalValidMs = 0;
  for (const lap of valid) {
    if (bestLap == null || lap.durationMs < bestLap.durationMs) bestLap = lap;
    if (worstLap == null || lap.durationMs > worstLap.durationMs) worstLap = lap;
    totalValidMs += lap.durationMs;
  }
  const avgValidLapMs = valid.length > 0 ? Math.round(totalValidMs / valid.length) : null;
  return {
    totalLaps: lapHistory.length,
    validLaps: valid.length,
    invalidLaps: lapHistory.length - valid.length,
    bestLap,
    worstLap,
    avgValidLapMs,
  };
}

function computeFinishResults(input) {
  const reason = input.reason || FINISH_REASON.COMPLETED;
  const lapHistory = Array.isArray(input.lapHistory) ? input.lapHistory.slice() : [];
  const summary = summarizeLapHistory(lapHistory);
  const totalRaceMs = Number.isFinite(input.totalRaceMs) ? input.totalRaceMs : 0;
  const lapsCompleted = Number.isInteger(input.lapsCompleted) ? input.lapsCompleted : 0;
  const totalLaps = Number.isInteger(input.totalLaps) ? input.totalLaps : lapsCompleted;
  const completion = totalLaps > 0
    ? Math.max(0, Math.min(1, lapsCompleted / totalLaps))
    : 1;
  const finished = reason === FINISH_REASON.COMPLETED;
  return {
    reason,
    finished,
    lapsCompleted,
    totalLaps,
    completion,
    totalRaceMs,
    bestLapMs: summary.bestLap ? summary.bestLap.durationMs : null,
    bestLapNumber: summary.bestLap ? summary.bestLap.lapNumber : null,
    worstLapMs: summary.worstLap ? summary.worstLap.durationMs : null,
    avgValidLapMs: summary.avgValidLapMs,
    validLaps: summary.validLaps,
    invalidLaps: summary.invalidLaps,
    totalCrashes: Number.isInteger(input.totalCrashes) ? input.totalCrashes : 0,
    pauseCount: Number.isInteger(input.pauseCount) ? input.pauseCount : 0,
    totalPausedMs: Number.isFinite(input.totalPausedMs) ? input.totalPausedMs : 0,
    lapHistory,
    finishedAtMs: Number.isFinite(input.finishedAtMs) ? input.finishedAtMs : totalRaceMs,
    timestamp: input.timestamp != null ? input.timestamp : Date.now(),
  };
}

// Convenience formatter for HUD/result screens (e.g. "01:23.456"). Returns
// "--:--.---" when input is null/undefined so HUDs do not need to special
// case.
function formatLapTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return '--:--.---';
  const totalMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const fff = String(millis).padStart(3, '0');
  return mm + ':' + ss + '.' + fff;
}

module.exports = {
  computeFinishResults,
  summarizeLapHistory,
  formatLapTime,
};

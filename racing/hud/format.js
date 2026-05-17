'use strict';

// Shared formatters for the racing HUD. Centralized so every panel shows
// the same number/time conventions and tests can verify a single source.

function formatInteger(value) {
  if (value === null || value === undefined) return '0';
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return String(Math.max(0, Math.round(n)));
}

// Format milliseconds as mm:ss.mmm — the canonical race-time display used
// across timer, lap board, and finish screen. Negative or non-finite values
// collapse to 00:00.000 so the layout never jitters.
function formatLapTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return '00:00.000';
  const totalMs = Math.floor(n);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}

// Same shape but for the race timer, which may extend past an hour during
// long arcade sessions. Switches to h:mm:ss.mmm only when needed so short
// races stay compact.
function formatRaceTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return '00:00.000';
  const totalMs = Math.floor(n);
  if (totalMs < 3600000) return formatLapTime(totalMs);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return (
    String(hours) +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}

function formatSpeed(value) {
  return formatInteger(value);
}

function formatBoostPercent(value, capacity) {
  const cap = Number(capacity);
  if (!Number.isFinite(cap) || cap <= 0) return '0%';
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return '0%';
  const ratio = Math.min(1, v / cap);
  return Math.round(ratio * 100) + '%';
}

function formatOrdinal(n) {
  const value = Number(n);
  if (!Number.isFinite(value) || value <= 0) return '-';
  const i = Math.floor(value);
  const mod100 = i % 100;
  if (mod100 >= 11 && mod100 <= 13) return i + 'th';
  switch (i % 10) {
    case 1: return i + 'st';
    case 2: return i + 'nd';
    case 3: return i + 'rd';
    default: return i + 'th';
  }
}

module.exports = {
  formatInteger,
  formatLapTime,
  formatRaceTime,
  formatSpeed,
  formatBoostPercent,
  formatOrdinal,
};

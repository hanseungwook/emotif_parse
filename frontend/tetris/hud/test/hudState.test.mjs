import test from 'node:test';
import assert from 'node:assert/strict';
import { HudState, STATUS, CLEAR_TYPES } from '../hudState.mjs';

test('seeds initial values and normalizes invalid inputs', () => {
  const hud = new HudState({
    score: 1200,
    level: 3,
    lines: 7,
    combo: 2,
    nextQueue: ['T', 'i', 'bad', 'L'],
    hold: 'J',
    status: STATUS.PLAYING,
    bestScore: 9999,
  });
  const state = hud.getState();
  assert.equal(state.score, 1200);
  assert.equal(state.bestScore, 9999);
  assert.equal(state.level, 3);
  assert.equal(state.lines, 7);
  assert.equal(state.combo, 2);
  assert.deepEqual(state.nextQueue, ['T', 'I', 'L']);
  assert.equal(state.hold, 'J');
  assert.equal(state.status, STATUS.PLAYING);
});

test('setScore emits score:change with delta and bumps best score', () => {
  const hud = new HudState();
  const events = [];
  const bestEvents = [];
  hud.on('score:change', (e) => events.push(e));
  hud.on('bestScore:change', (e) => bestEvents.push(e));
  hud.setScore(500);
  hud.setScore(800);
  hud.setScore(800); // no-op
  assert.equal(events.length, 2);
  assert.equal(events[0].value, 500);
  assert.equal(events[0].delta, 500);
  assert.equal(events[1].value, 800);
  assert.equal(events[1].delta, 300);
  assert.equal(bestEvents.length, 2);
  assert.equal(hud.getState().bestScore, 800);
});

test('addScore accumulates score', () => {
  const hud = new HudState({ score: 100 });
  hud.addScore(50);
  hud.addScore(0); // no-op
  hud.addScore(NaN); // ignored
  assert.equal(hud.getState().score, 150);
});

test('setLevel clamps to at least 1', () => {
  const hud = new HudState();
  hud.setLevel(0);
  assert.equal(hud.getState().level, 1);
  hud.setLevel(5);
  assert.equal(hud.getState().level, 5);
  hud.setLevel(-3);
  assert.equal(hud.getState().level, 1);
});

test('combo: bump, break, max tracking', () => {
  const hud = new HudState();
  const changes = [];
  hud.on('combo:change', (e) => changes.push(e));
  hud.bumpCombo();
  hud.bumpCombo();
  hud.bumpCombo();
  assert.equal(hud.getState().combo, 3);
  assert.equal(hud.getState().maxCombo, 3);
  hud.bumpCombo();
  assert.equal(hud.getState().combo, 4);
  assert.equal(hud.getState().maxCombo, 4);
  hud.breakCombo();
  assert.equal(hud.getState().combo, 0);
  assert.equal(hud.getState().maxCombo, 4);
  const last = changes[changes.length - 1];
  assert.equal(last.broken, true);
});

test('recordClear emits clear event with normalized detail', () => {
  const hud = new HudState();
  const clears = [];
  hud.on('clear', (e) => clears.push(e));
  hud.recordClear({ type: CLEAR_TYPES.TETRIS, lines: 4, points: 800, perfect: true });
  assert.equal(clears.length, 1);
  assert.equal(clears[0].type, 'tetris');
  assert.equal(clears[0].lines, 4);
  assert.equal(clears[0].points, 800);
  assert.equal(clears[0].perfect, true);
  assert.equal(hud.getState().lastClear.type, 'tetris');
});

test('recordClear ignores empty events', () => {
  const hud = new HudState();
  const clears = [];
  hud.on('clear', (e) => clears.push(e));
  hud.recordClear({ lines: 0 });
  hud.recordClear(null);
  assert.equal(clears.length, 0);
});

test('setNextQueue dedupes equal arrays', () => {
  const hud = new HudState();
  const events = [];
  hud.on('next:change', (e) => events.push(e));
  hud.setNextQueue(['I', 'O', 'T']);
  hud.setNextQueue(['I', 'O', 'T']);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].queue, ['I', 'O', 'T']);
});

test('setHold accepts only valid kinds, normalizes to upper case', () => {
  const hud = new HudState();
  hud.setHold('t');
  assert.equal(hud.getState().hold, 'T');
  hud.setHold('XX');
  assert.equal(hud.getState().hold, null);
  hud.setHold('L');
  assert.equal(hud.getState().hold, 'L');
});

test('status transitions: start, pause, resume, gameOver', () => {
  const hud = new HudState();
  const status = [];
  hud.on('status:change', (e) => status.push(e.value));
  hud.start();
  hud.pause();
  hud.resume();
  hud.gameOver();
  assert.deepEqual(status, [STATUS.PLAYING, STATUS.PAUSED, STATUS.PLAYING, STATUS.GAME_OVER]);
});

test('pause is a no-op outside playing', () => {
  const hud = new HudState();
  const status = [];
  hud.on('status:change', (e) => status.push(e.value));
  hud.pause();
  hud.resume();
  assert.deepEqual(status, []);
});

test('togglePause flips between paused and playing', () => {
  const hud = new HudState();
  hud.start();
  hud.togglePause();
  assert.equal(hud.getState().status, STATUS.PAUSED);
  hud.togglePause();
  assert.equal(hud.getState().status, STATUS.PLAYING);
});

test('gameOver breaks combo', () => {
  const hud = new HudState();
  hud.bumpCombo();
  hud.bumpCombo();
  assert.equal(hud.getState().combo, 2);
  hud.gameOver();
  assert.equal(hud.getState().combo, 0);
});

test('reset preserves best score and emits reset', () => {
  const hud = new HudState({ score: 500, bestScore: 1500 });
  hud.bumpCombo();
  hud.recordClear({ type: 'tetris', lines: 4, points: 800 });
  let resetEvent = null;
  hud.on('reset', (e) => { resetEvent = e; });
  hud.reset();
  const state = hud.getState();
  assert.equal(state.score, 0);
  assert.equal(state.lines, 0);
  assert.equal(state.level, 1);
  assert.equal(state.combo, 0);
  assert.equal(state.lastClear, null);
  assert.equal(state.bestScore, 1500); // preserved by caller (since we passed no seed)
  assert.ok(resetEvent !== null);
});

test('requestRestart emits intent:restart with meta', () => {
  const hud = new HudState();
  const intents = [];
  hud.on('intent:restart', (m) => intents.push(m));
  hud.requestRestart({ reason: 'gameOver' });
  assert.equal(intents.length, 1);
  assert.equal(intents[0].reason, 'gameOver');
});

test('requestResume and requestPause emit intents', () => {
  const hud = new HudState();
  const intents = [];
  hud.on('intent:resume', () => intents.push('resume'));
  hud.on('intent:pause', () => intents.push('pause'));
  hud.requestResume();
  hud.requestPause();
  assert.deepEqual(intents, ['resume', 'pause']);
});

test('setStatus rejects unknown values', () => {
  const hud = new HudState();
  assert.throws(() => hud.setStatus('zooming'), /unknown status/);
});

test('change event fires for granular updates', () => {
  const hud = new HudState();
  let changes = 0;
  hud.on('change', () => { changes++; });
  hud.setScore(10);
  hud.setLevel(2);
  hud.setLines(1);
  assert.equal(changes, 3);
});

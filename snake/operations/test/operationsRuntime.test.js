'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OperationsRuntime,
  STATES,
  SkinCatalog,
  ObstacleLayoutLoader,
  SnapshotStore,
  MemoryStorage,
  SkinLoadError,
  ObstacleGenerationError,
  InvalidStateError,
  RecoveryFailedError,
  SnapshotCorruptError,
} = require('..');

function makeRuntime(extra) {
  return new OperationsRuntime(
    Object.assign(
      {
        defaultDifficulty: 'light',
        clock: (() => {
          let t = 1000;
          return () => {
            t += 1;
            return t;
          };
        })(),
      },
      extra || {}
    )
  );
}

function captureStates(rt) {
  const seq = [];
  rt.on('state:change', (evt) => seq.push(evt.to));
  return seq;
}

// ─── BOOTING / LOADING ──────────────────────────────────────────────────────

test('runtime starts in BOOTING and view describes setup', () => {
  const rt = makeRuntime();
  assert.equal(rt.state, STATES.BOOTING);
  const v = rt.view();
  assert.equal(v.state, 'booting');
  assert.match(v.message, /Preparing/);
});

test('load() transitions BOOTING → LOADING → EMPTY and emits progress', async () => {
  const rt = makeRuntime();
  const seq = captureStates(rt);
  const progress = [];
  rt.on('loading:progress', (evt) => progress.push(evt.stage));
  await rt.load({ obstacles: { difficulty: 'light', seed: 7 } });
  assert.deepEqual(seq, ['loading', 'empty']);
  assert.deepEqual(progress, ['skins', 'obstacles']);
});

test('loading view exposes progress and partial readiness', async () => {
  const rt = makeRuntime();
  rt.on('state:loading', () => {
    const v = rt.view();
    assert.equal(v.state, 'loading');
    assert.equal(v.skinsLoaded, false);
    assert.equal(v.obstaclesReady, false);
    assert.match(v.message, /Loading/);
  });
  await rt.load();
});

test('load() honors a skinLoader option and ingests custom skins', async () => {
  const rt = makeRuntime({
    skinLoader: () => [
      { id: 'gold', name: 'Gold', head: '#ffd700', body: '#daa520', accent: '#7a5c00' },
    ],
  });
  await rt.load();
  assert.equal(rt.skinCatalog.has('gold'), true);
});

test('load() failure on skins transitions LOADING → ERROR', async () => {
  const rt = makeRuntime({
    skinLoader: () => Promise.reject(new Error('cdn down')),
  });
  const seq = captureStates(rt);
  await assert.rejects(rt.load(), SkinLoadError);
  assert.deepEqual(seq, ['loading', 'error']);
  assert.equal(rt.state, STATES.ERROR);
  assert.ok(rt.lastError instanceof SkinLoadError);
});

test('load() failure on obstacle layout transitions to ERROR', async () => {
  const rt = makeRuntime();
  const seq = captureStates(rt);
  await assert.rejects(
    rt.load({ obstacles: { difficulty: 'invalid-band' } }),
    ObstacleGenerationError
  );
  assert.equal(rt.state, STATES.ERROR);
  assert.deepEqual(seq, ['loading', 'error']);
  assert.match(rt.view().message, /obstacle|difficulty/i);
});

// ─── EMPTY STATE ────────────────────────────────────────────────────────────

test('empty view advertises skins and obstacles for the UI', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'light', seed: 'fixed' } });
  const v = rt.view();
  assert.equal(v.state, 'empty');
  assert.equal(v.canStart, true);
  assert.equal(v.canRecover, false);
  assert.ok(v.skins.length >= 1);
  assert.ok(v.obstacles && v.obstacles.count >= 0);
  assert.equal(v.selectedSkin.id, rt.skinCatalog.defaultId);
});

test('empty view advertises canRecover when a snapshot exists', async () => {
  const storage = new MemoryStorage();
  const snapshots = new SnapshotStore({ storage });
  const rt = makeRuntime({ snapshotStore: snapshots });
  await rt.load();
  // Simulate a prior session writing a snapshot.
  snapshots.save({ skinId: 'classic', obstacles: { difficulty: 'off', cells: [] } });
  assert.equal(rt.view().canRecover, true);
});

test('startGame() requires EMPTY and moves to ACTIVE', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  assert.equal(rt.state, STATES.ACTIVE);
  assert.throws(() => rt.startGame(), InvalidStateError);
});

test('startGame(skinId) selects a custom skin', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.skinCatalog.unlock('sunset');
  rt.startGame({ skinId: 'sunset' });
  assert.equal(rt.skinCatalog.selectedId, 'sunset');
});

// ─── ACTIVE / PAUSED / COMPLETED ────────────────────────────────────────────

test('pause and resume cycle through PAUSED', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.pauseGame();
  assert.equal(rt.state, STATES.PAUSED);
  assert.equal(rt.view().canResume, true);
  rt.resumeGame();
  assert.equal(rt.state, STATES.ACTIVE);
});

test('completeGame() captures score, skin, obstacles and clears snapshot', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'light', seed: 'x' } });
  rt.startGame();
  rt.saveSnapshot({ score: 5 });
  assert.equal(rt.snapshotStore.has(), true);
  const completion = rt.completeGame({ reason: 'collision', score: 42, stats: { eaten: 6 } });
  assert.equal(rt.state, STATES.COMPLETED);
  assert.equal(completion.reason, 'collision');
  assert.equal(completion.score, 42);
  assert.equal(completion.skin.id, rt.skinCatalog.selectedId);
  assert.ok(completion.obstacles);
  assert.deepEqual(completion.stats, { eaten: 6 });
  assert.equal(rt.snapshotStore.has(), false);
});

test('completion view exposes a restart-friendly summary', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.completeGame({ reason: 'win', score: 100 });
  const v = rt.view();
  assert.equal(v.state, 'completed');
  assert.match(v.message, /You win/);
  assert.equal(v.canRestart, true);
  assert.equal(v.reason, 'win');
});

test('restart() from COMPLETED loops back through LOADING → EMPTY', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.completeGame({ score: 1 });
  const seq = captureStates(rt);
  await rt.restart({ obstacles: { difficulty: 'light', seed: 'z' } });
  // restart resets COMPLETED → EMPTY → LOADING → EMPTY
  assert.deepEqual(seq, ['empty', 'loading', 'empty']);
  assert.equal(rt.state, STATES.EMPTY);
});

// ─── ERROR / RECOVERY ───────────────────────────────────────────────────────

test('reportError() from ACTIVE transitions to ERROR', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.reportError(new Error('input device unplugged'));
  assert.equal(rt.state, STATES.ERROR);
  assert.match(rt.view().message, /input device/);
});

test('error view advertises canRecover only when a snapshot or retry exists', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.reportError(new Error('oops'));
  // no snapshot, no loader → not recoverable
  assert.equal(rt.view().canRecover, false);
});

test('recover() restores the snapshot and resumes the game', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'light', seed: 'a' } });
  rt.startGame();
  rt.skinCatalog.unlock('sunset');
  rt.skinCatalog.select('sunset');
  rt.saveSnapshot({ score: 13, gameplay: { body: [{ x: 1, y: 1 }] } });
  rt.reportError(new Error('renderer crash'));
  const seq = captureStates(rt);
  const result = await rt.recover();
  assert.equal(result.state, STATES.ACTIVE);
  assert.equal(rt.skinCatalog.selectedId, 'sunset');
  assert.deepEqual(seq, ['recovering', 'active']);
});

test('recover({to:"empty"}) returns to EMPTY after restoring identity', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.saveSnapshot({});
  rt.reportError(new Error('boom'));
  await rt.recover({ to: 'empty' });
  assert.equal(rt.state, STATES.EMPTY);
});

test('recover() without a snapshot transitions RECOVERING → ERROR', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.reportError(new Error('boom'));
  await assert.rejects(rt.recover(), RecoveryFailedError);
  assert.equal(rt.state, STATES.ERROR);
});

test('recover() surfaces SnapshotCorruptError without losing the operator path', async () => {
  const storage = new MemoryStorage();
  storage.set('snake:operations:snapshot', '{');
  const snapshots = new SnapshotStore({ storage });
  const rt = makeRuntime({ snapshotStore: snapshots });
  await rt.load();
  rt.startGame();
  rt.reportError(new Error('crash'));
  await assert.rejects(rt.recover(), SnapshotCorruptError);
  assert.equal(rt.state, STATES.ERROR);
});

test('reset() from ERROR or COMPLETED returns to EMPTY and clears state', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  rt.saveSnapshot({ score: 9 });
  rt.reportError(new Error('explode'));
  rt.reset();
  assert.equal(rt.state, STATES.EMPTY);
  assert.equal(rt.snapshotStore.has(), false);
  assert.equal(rt.lastError, null);
});

test('reset() refuses to run from ACTIVE', async () => {
  const rt = makeRuntime();
  await rt.load();
  rt.startGame();
  assert.throws(() => rt.reset(), InvalidStateError);
});

// ─── Skins + Obstacle coverage across operational states ────────────────────

test('snake skins coverage: catalog stays available through error and recovery', async () => {
  const rt = makeRuntime();
  await rt.load();
  const beforeIds = rt.skinCatalog.list().map((s) => s.id).sort();
  rt.startGame();
  rt.saveSnapshot({});
  rt.reportError(new Error('blip'));
  // Even in error, the catalog is intact for the UI to display.
  const errorIds = rt.skinCatalog.list().map((s) => s.id).sort();
  assert.deepEqual(errorIds, beforeIds);
  await rt.recover();
  const afterIds = rt.skinCatalog.list().map((s) => s.id).sort();
  assert.deepEqual(afterIds, beforeIds);
});

test('obstacle mode coverage: layout survives error and is identical after recovery', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'light', seed: 'recover-me' } });
  const before = rt.obstacleLoader.current;
  rt.startGame();
  rt.saveSnapshot({});
  rt.reportError(new Error('whoops'));
  await rt.recover();
  const after = rt.obstacleLoader.current;
  assert.equal(after.difficulty, before.difficulty);
  assert.equal(after.count, before.count);
  assert.deepEqual(
    after.cells.map((c) => c.x + ',' + c.y).sort(),
    before.cells.map((c) => c.x + ',' + c.y).sort()
  );
});

test('obstacle mode "off" still produces a coherent empty/active cycle', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'off' } });
  assert.equal(rt.obstacleLoader.current.count, 0);
  rt.startGame();
  rt.completeGame({ score: 7 });
  assert.equal(rt.lastCompletion.obstacles.difficulty, 'off');
});

// ─── State events ──────────────────────────────────────────────────────────

test('listeners receive both state:change and state:<name> events', async () => {
  const rt = makeRuntime();
  const generic = [];
  const named = [];
  rt.on('state:change', (e) => generic.push(e.to));
  rt.on('state:empty', () => named.push('empty'));
  await rt.load();
  assert.deepEqual(generic, ['loading', 'empty']);
  assert.deepEqual(named, ['empty']);
});

test('a second load() while loading is rejected with InvalidStateError', async () => {
  let resolveSkins;
  const slow = () =>
    new Promise((resolve) => {
      resolveSkins = resolve;
    });
  const rt = makeRuntime({ skinLoader: slow });
  const firstP = rt.load();
  // Kick off a second load before the first one finishes — the runtime
  // refuses concurrent loads rather than racing tickets.
  await assert.rejects(rt.load(), InvalidStateError);
  resolveSkins([]);
  await firstP;
  assert.equal(rt.state, STATES.EMPTY);
});

test('after a successful load() a second load() reloads cleanly from EMPTY', async () => {
  const rt = makeRuntime();
  await rt.load({ obstacles: { difficulty: 'light', seed: 'one' } });
  const firstCount = rt.obstacleLoader.current.count;
  await rt.load({ obstacles: { difficulty: 'medium', seed: 'two' } });
  assert.equal(rt.state, STATES.EMPTY);
  assert.equal(rt.obstacleLoader.current.difficulty, 'medium');
  // Different seed/difficulty → almost certainly a different layout.
  assert.notEqual(rt.obstacleLoader.current.count, firstCount);
});

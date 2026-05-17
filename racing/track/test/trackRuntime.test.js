'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TrackRuntime, PHASE } = require('../trackRuntime');
const { TrackPath } = require('../path');
const { Obstacle, OBSTACLE_KIND } = require('../obstacles');

function buildSquareTrack(overrides) {
  return new TrackRuntime(Object.assign({
    path: new TrackPath({
      width: 200,
      closed: true,
      points: [
        { x: -100, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 100 },
        { x: -100, y: 100 },
      ],
    }),
    // Endpoints are ordered so that walking a→b puts "forward" on the right,
    // matching CCW travel around the track.
    checkpoints: [
      { id: 'start', a: { x: 0, y: -120 }, b: { x: 0, y: -80 } },
      { id: 'east',  a: { x: 120, y: 0 }, b: { x: 80, y: 0 } },
      { id: 'north', a: { x: 0, y: 120 }, b: { x: 0, y: 80 } },
      { id: 'west',  a: { x: -120, y: 0 }, b: { x: -80, y: 0 } },
    ],
    lapsToFinish: 1,
  }, overrides));
}

test('TrackRuntime constructs in READY phase', () => {
  const rt = buildSquareTrack();
  assert.equal(rt.phase, PHASE.READY);
  assert.equal(rt.lapsCompleted, 0);
  assert.equal(rt.walls.length, 8);
});

test('start validates car and transitions to RACING', () => {
  const rt = buildSquareTrack();
  assert.throws(() => rt.start({ x: 0, y: 0, radius: 0 }), /positive/);
  assert.throws(() => rt.start({ radius: 5 }), /finite/);
  rt.start({ x: 0, y: -100, vx: 0, vy: 0, radius: 2 });
  assert.equal(rt.phase, PHASE.RACING);
});

test('start emits a start event with totalLaps', () => {
  const rt = buildSquareTrack({ lapsToFinish: 3 });
  let received = null;
  rt.on('start', (e) => { received = e; });
  rt.start({ x: 0, y: -100, vx: 0, vy: 0, radius: 2 });
  assert.ok(received);
  assert.equal(received.totalLaps, 3);
});

test('update returns null when not racing', () => {
  const rt = buildSquareTrack();
  assert.equal(rt.update(16), null);
});

test('completing all laps switches to FINISHED', () => {
  const rt = buildSquareTrack({ lapsToFinish: 1 });
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);

  let finished = null;
  rt.on('raceFinished', (e) => { finished = e; });
  const teleport = (x, y) => { car.x = x; car.y = y; rt.update(16); };

  // Move CCW around the square hitting each checkpoint in turn.
  teleport(1, -100);    // crosses start (forward +x)
  teleport(100, -1);    // approach east — no crossing yet
  teleport(100, 1);     // crosses east (forward +y)
  teleport(1, 100);     // approach north
  teleport(-1, 100);    // crosses north (forward -x)
  teleport(-100, 1);    // approach west
  teleport(-100, -1);   // crosses west (forward -y)
  teleport(-1, -100);   // back to south
  teleport(1, -100);    // crosses start again — lap complete

  assert.equal(rt.lapsCompleted, 1);
  assert.equal(rt.phase, PHASE.FINISHED);
  assert.ok(finished);
});

test('wallHit event fires when car penetrates a boundary', () => {
  const rt = new TrackRuntime({
    path: new TrackPath({
      width: 20,
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    }),
    checkpoints: [
      { id: 'a', a: { x: 50, y: -20 }, b: { x: 50, y: 20 } },
      { id: 'b', a: { x: 150, y: -20 }, b: { x: 150, y: 20 } },
    ],
    lapsToFinish: 1,
  });
  const car = { x: 100, y: 0, vx: 0, vy: -100, radius: 5 };
  rt.start(car);
  let hits = 0;
  rt.on('wallHit', () => hits++);
  // Move the car into the right wall (at y = -10).
  car.y = -7;
  rt.update(16);
  assert.ok(hits >= 1);
  // Car should now be pushed back to y >= -5.
  assert.ok(car.y >= -5 - 1e-9);
});

test('obstacle BLOCK collision pushes car out and emits obstacleHit', () => {
  const rt = buildSquareTrack({
    obstacles: [
      new Obstacle({ id: 'cone', kind: OBSTACLE_KIND.BLOCK, x: 0, y: -100, radius: 5 }),
    ],
  });
  const car = { x: 4, y: -100, vx: -10, vy: 0, radius: 2 };
  rt.start(car);
  const events = [];
  rt.on('obstacleHit', (e) => events.push(e));
  rt.update(16);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, OBSTACLE_KIND.BLOCK);
  // After resolution, distance to obstacle center must be at least sum of radii.
  const dist = Math.hypot(car.x - 0, car.y - -100);
  assert.ok(dist >= 7 - 1e-9);
});

test('hazard obstacle only fires once per cooldown window', () => {
  const rt = buildSquareTrack({
    obstacles: [
      new Obstacle({ id: 'spike', kind: OBSTACLE_KIND.HAZARD, x: 0, y: -100, radius: 8, strength: 10 }),
    ],
    hazardCooldownMs: 500,
  });
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);
  const damage = [];
  rt.on('obstacleHit', (e) => {
    if (e.kind === OBSTACLE_KIND.HAZARD) damage.push(e.damage);
  });
  rt.update(50);  // overlap — fires once
  rt.update(50);  // still overlapping, cooldown active — silent
  rt.update(50);
  assert.equal(damage.length, 1);
  rt.update(400); // cooldown expires (50+50+50+400=550 > 500)
  rt.update(50);  // overlap — fires again
  assert.equal(damage.length, 2);
});

test('boost obstacle adds impulse and emits obstacleHit', () => {
  const rt = buildSquareTrack({
    obstacles: [
      new Obstacle({ id: 'pad', kind: OBSTACLE_KIND.BOOST, x: 0, y: -100, radius: 8, strength: 20 }),
    ],
  });
  const car = { x: 0, y: -100, vx: 5, vy: 0, radius: 2 };
  rt.start(car);
  rt.update(16);
  assert.ok(car.vx > 5);
});

test('slow obstacle damps velocity', () => {
  const rt = buildSquareTrack({
    obstacles: [
      new Obstacle({ id: 'mud', kind: OBSTACLE_KIND.SLOW, x: 0, y: -100, radius: 8, strength: 0.5 }),
    ],
  });
  const car = { x: 0, y: -100, vx: 10, vy: 0, radius: 2 };
  rt.start(car);
  rt.update(16);
  assert.equal(car.vx, 5);
});

test('locateCar reports nearest centerline segment', () => {
  const rt = buildSquareTrack();
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);
  const loc = rt.locateCar();
  assert.ok(loc);
  assert.equal(loc.segment.index, 0);
});

test('isCarOnTrack matches whether car is between walls', () => {
  const rt = buildSquareTrack();
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);
  assert.equal(rt.isCarOnTrack(), true);
  // Move the car well off the centerline.
  car.x = 0; car.y = -300;
  assert.equal(rt.isCarOnTrack(), false);
});

test('snapshot exposes runtime state', () => {
  const rt = buildSquareTrack({
    obstacles: [
      new Obstacle({ id: 'x', kind: OBSTACLE_KIND.BLOCK, x: 10, y: -100, radius: 4 }),
    ],
  });
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);
  const snap = rt.snapshot();
  assert.equal(snap.phase, PHASE.RACING);
  assert.equal(snap.lapsToFinish, 1);
  assert.equal(snap.obstacles.length, 1);
  assert.equal(snap.nextCheckpointId, 'start');
});

test('checkpointCrossed event fires for each gate', () => {
  const rt = buildSquareTrack();
  const car = { x: 0, y: -100, vx: 0, vy: 0, radius: 2 };
  rt.start(car);
  const ids = [];
  rt.on('checkpointCrossed', (e) => ids.push(e.id));
  car.x = 1; car.y = -100; rt.update(16);
  car.x = 100; car.y = 1; rt.update(16);
  assert.ok(ids.includes('start'));
  assert.ok(ids.includes('east'));
});

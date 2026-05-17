'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const boost = require('../boost');
const { DRIFT_STATE, BOOST } = require('../constants');

function ctx(overrides) {
  return Object.assign({
    inputs: { boost: false },
    driftState: DRIFT_STATE.GRIP,
    slipAngle: 0,
    airborne: false,
    drafting: false,
  }, overrides || {});
}

test('createBoostState starts empty and inactive', () => {
  const b = boost.createBoostState();
  assert.equal(b.charge, 0);
  assert.equal(b.active, false);
  assert.equal(b.lockoutMs, 0);
});

test('createBoostState clamps initial charge into range', () => {
  const high = boost.createBoostState({ charge: 9999 });
  const low = boost.createBoostState({ charge: -50 });
  assert.equal(high.charge, BOOST.maxCharge);
  assert.equal(low.charge, 0);
});

test('drift gain peaks near the sweet spot', () => {
  const flat = boost.driftGainRate(0);
  const peak = boost.driftGainRate(BOOST.driftGainSlipSweetSpot);
  const beyond = boost.driftGainRate(BOOST.driftGainSlipFalloff + 0.5);
  assert.equal(flat, 0);
  assert.ok(peak > BOOST.driftGainBase, `peak=${peak}`);
  assert.ok(beyond <= peak, `beyond=${beyond} peak=${peak}`);
});

test('drift charge accrues over time while drifting at the sweet spot', () => {
  const b = boost.createBoostState();
  for (let i = 0; i < 60; i++) {
    boost.updateBoost(b, ctx({
      driftState: DRIFT_STATE.DRIFTING,
      slipAngle: BOOST.driftGainSlipSweetSpot,
    }), 1000 / 60);
  }
  assert.ok(b.charge > 25, `charge=${b.charge}`);
});

test('charge does not accrue while in GRIP and going straight', () => {
  const b = boost.createBoostState();
  for (let i = 0; i < 30; i++) {
    boost.updateBoost(b, ctx(), 1000 / 60);
  }
  assert.equal(b.charge, 0);
});

test('airborne and drafting both grant passive gain', () => {
  const air = boost.createBoostState();
  const draft = boost.createBoostState();
  for (let i = 0; i < 30; i++) {
    boost.updateBoost(air, ctx({ airborne: true }), 1000 / 60);
    boost.updateBoost(draft, ctx({ drafting: true }), 1000 / 60);
  }
  assert.ok(air.charge > 0);
  assert.ok(draft.charge > 0);
});

test('boost cannot activate below the minimum charge', () => {
  const b = boost.createBoostState({ charge: BOOST.minActivationCharge - 1 });
  const events = boost.updateBoost(b, ctx({ inputs: { boost: true } }), 16);
  assert.equal(b.active, false);
  assert.equal(events.filter(e => e.type === 'boostStart').length, 0);
});

test('boost activates and consumes charge', () => {
  const b = boost.createBoostState({ charge: BOOST.maxCharge });
  const events = boost.updateBoost(b, ctx({ inputs: { boost: true } }), 100);
  assert.equal(b.active, true);
  assert.ok(b.charge < BOOST.maxCharge, `charge=${b.charge}`);
  assert.equal(events.filter(e => e.type === 'boostStart').length, 1);
});

test('releasing boost ends it and triggers release lockout', () => {
  const b = boost.createBoostState({ charge: BOOST.maxCharge });
  boost.updateBoost(b, ctx({ inputs: { boost: true } }), 100);
  const events = boost.updateBoost(b, ctx({ inputs: { boost: false } }), 16);
  assert.equal(b.active, false);
  assert.ok(b.lockoutMs > 0, `lockoutMs=${b.lockoutMs}`);
  const ends = events.filter(e => e.type === 'boostEnd');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].reason, 'released');
});

test('boost depletes to zero, ends, and emits empty', () => {
  const b = boost.createBoostState({ charge: BOOST.minActivationCharge + 1 });
  const collected = [];
  let safety = 0;
  while (b.active || safety < 1) {
    const evts = boost.updateBoost(b, ctx({ inputs: { boost: true } }), 50);
    for (const e of evts) collected.push(e);
    safety += 1;
    if (safety > 500) break;
  }
  assert.equal(b.charge, 0);
  assert.equal(b.active, false);
  assert.ok(collected.find(e => e.type === 'boostEmpty'), 'expected boostEmpty event');
  const ends = collected.filter(e => e.type === 'boostEnd');
  assert.ok(ends.find(e => e.reason === 'empty'), 'expected boostEnd reason=empty');
  assert.ok(b.lockoutMs >= BOOST.emptyLockoutMs - 1, `lockoutMs=${b.lockoutMs}`);
});

test('boost cannot re-activate during lockout', () => {
  const b = boost.createBoostState({ charge: BOOST.maxCharge });
  boost.updateBoost(b, ctx({ inputs: { boost: true } }), 100);
  boost.updateBoost(b, ctx({ inputs: { boost: false } }), 50);
  const events = boost.updateBoost(b, ctx({ inputs: { boost: true } }), 50);
  assert.equal(b.active, false);
  assert.equal(events.filter(e => e.type === 'boostStart').length, 0);
});

test('charge tops out and emits boostFull exactly once per top-up', () => {
  const b = boost.createBoostState({ charge: BOOST.maxCharge - 1 });
  const evts1 = boost.updateBoost(b, ctx({
    driftState: DRIFT_STATE.DRIFTING,
    slipAngle: BOOST.driftGainSlipSweetSpot,
  }), 200);
  const evts2 = boost.updateBoost(b, ctx({
    driftState: DRIFT_STATE.DRIFTING,
    slipAngle: BOOST.driftGainSlipSweetSpot,
  }), 200);
  assert.equal(b.charge, BOOST.maxCharge);
  assert.equal(evts1.filter(e => e.type === 'boostFull').length, 1);
  assert.equal(evts2.filter(e => e.type === 'boostFull').length, 0);
});

test('snapshot mirrors charge and computed flags', () => {
  const b = boost.createBoostState({ charge: BOOST.maxCharge / 2 });
  const snap = boost.snapshot(b);
  assert.equal(snap.charge, BOOST.maxCharge / 2);
  assert.ok(Math.abs(snap.fraction - 0.5) < 1e-9);
  assert.equal(snap.active, false);
  assert.equal(snap.canActivate, true);
});

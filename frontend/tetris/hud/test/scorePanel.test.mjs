import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockContainer } from './mockDom.mjs';
import { ScorePanel } from '../scorePanel.mjs';

function fakeScheduler() {
  const tasks = [];
  let next = 1;
  return {
    schedule(cb, ms) {
      const id = next++;
      tasks.push({ id, cb, ms });
      return id;
    },
    cancel(id) {
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx >= 0) tasks.splice(idx, 1);
    },
    flush() {
      while (tasks.length) {
        const t = tasks.shift();
        try { t.cb(); } catch (_e) { /* ignore */ }
      }
    },
    pending() { return tasks.slice(); },
  };
}

function build(opts) {
  const { document, container } = createMockContainer();
  const sched = fakeScheduler();
  const panel = new ScorePanel({
    container,
    document,
    scheduler: (cb, ms) => sched.schedule(cb, ms),
    cancelScheduler: (id) => sched.cancel(id),
    ...(opts || {}),
  });
  panel.mount();
  return { document, container, panel, sched };
}

test('renders score, level, lines, best, combo blocks', () => {
  const { container } = build();
  assert.ok(container.querySelector('[data-stat="score"]'));
  assert.ok(container.querySelector('[data-stat="level"]'));
  assert.ok(container.querySelector('[data-stat="lines"]'));
  assert.ok(container.querySelector('[data-stat="best"]'));
  assert.ok(container.querySelector('[data-stat="combo"]'));
});

test('setScore formats with thousands separator and pulses', () => {
  const { container, panel, sched } = build();
  panel.setScore(12345);
  const block = container.querySelector('[data-stat="score"]');
  const value = block.querySelector('.hud-score__value');
  assert.equal(value.textContent, '12,345');
  assert.ok(block.className.includes('is-pulse'), 'pulse class added');
  sched.flush();
  assert.ok(!block.className.includes('is-pulse'), 'pulse class removed after timer');
});

test('setLevel and setLines update with pulse', () => {
  const { container, panel } = build();
  panel.setLevel(7);
  panel.setLines(42);
  assert.equal(
    container.querySelector('[data-stat="level"] .hud-score__value').textContent,
    '7'
  );
  assert.equal(
    container.querySelector('[data-stat="lines"] .hud-score__value').textContent,
    '42'
  );
});

test('setBestScore does not pulse', () => {
  const { container, panel } = build();
  panel.setBestScore(9000);
  const block = container.querySelector('[data-stat="best"]');
  assert.equal(block.querySelector('.hud-score__value').textContent, '9,000');
  assert.ok(!block.className.includes('is-pulse'));
});

test('setCombo above 1 marks combo active and pulses; 0 clears active', () => {
  const { container, panel } = build();
  panel.setCombo(3);
  const combo = container.querySelector('[data-stat="combo"]');
  assert.equal(combo.querySelector('.hud-score__combo-value').textContent, '3');
  assert.ok(combo.className.includes('hud-score__combo--active'));
  panel.setCombo(0);
  assert.ok(!combo.className.includes('hud-score__combo--active'));
});

test('showClear renders type, points, and perfect modifier', () => {
  const { container, panel } = build();
  panel.showClear({ type: 'tetris', lines: 4, points: 800 });
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(banner.className.includes('is-visible'));
  assert.equal(banner.querySelector('.hud-score__clear-type').textContent, 'TETRIS!');
  assert.equal(banner.querySelector('.hud-score__clear-points').textContent, '+800');
  panel.showClear({ type: 'perfectClear', lines: 4, points: 2000, perfect: true });
  assert.ok(banner.className.includes('hud-score__clear--perfect'));
});

test('clear banner hides after scheduler ticks', () => {
  const { container, panel, sched } = build();
  panel.showClear({ type: 'double', lines: 2, points: 100 });
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(banner.className.includes('is-visible'));
  sched.flush();
  assert.ok(!banner.className.includes('is-visible'));
});

test('hideClear immediately hides banner', () => {
  const { container, panel } = build();
  panel.showClear({ type: 'single', lines: 1, points: 100 });
  panel.hideClear();
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(!banner.className.includes('is-visible'));
});

test('showClear with no recognizable detail hides the banner', () => {
  const { container, panel } = build();
  panel.showClear({ type: 'unknown', lines: 0 });
  const banner = container.querySelector('[data-stat="clear"]');
  assert.ok(!banner.className.includes('is-visible'));
});

test('unmount cancels pending pulse timers and clears container', () => {
  const { container, panel, sched } = build();
  panel.setScore(100);
  assert.equal(sched.pending().length, 1);
  panel.unmount();
  assert.equal(sched.pending().length, 0);
  assert.equal(container.childNodes.length, 0);
});

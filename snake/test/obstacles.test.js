'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createObstacle,
  createObstacleLayout,
  layoutBlockedCells,
  layoutToGrid,
  OBSTACLE_KIND,
  LAYOUT_DIFFICULTY,
} = require('../obstacles');
const { ValidationError } = require('../errors');
const { createBoard, cellKey } = require('../board');

test('createObstacle rejects empty cells', () => {
  assert.throws(() => createObstacle({ id: 'a', cells: [] }), ValidationError);
});

test('createObstacle dedupes overlapping cells', () => {
  const obstacle = createObstacle({
    id: 'a',
    cells: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  });
  assert.equal(obstacle.cells.length, 2);
});

test('createObstacle defaults kind to wall', () => {
  const obstacle = createObstacle({ id: 'a', cells: [{ x: 0, y: 0 }] });
  assert.equal(obstacle.kind, OBSTACLE_KIND.WALL);
});

test('obstacle is frozen', () => {
  const obstacle = createObstacle({ id: 'a', cells: [{ x: 0, y: 0 }] });
  assert.throws(() => {
    obstacle.id = 'changed';
  });
});

test('createObstacleLayout requires id, name', () => {
  assert.throws(() => createObstacleLayout({}), ValidationError);
  assert.throws(() => createObstacleLayout({ id: 'a' }), ValidationError);
});

test('createObstacleLayout validates obstacles against boardHint', () => {
  assert.throws(
    () =>
      createObstacleLayout({
        id: 'l',
        name: 'L',
        boardHint: { width: 10, height: 10 },
        obstacles: [{ id: 'o', cells: [{ x: 20, y: 5 }] }],
      }),
    ValidationError
  );
});

test('createObstacleLayout accepts a valid layout', () => {
  const layout = createObstacleLayout({
    id: 'l',
    name: 'Layout',
    difficulty: LAYOUT_DIFFICULTY.MEDIUM,
    boardHint: { width: 10, height: 10 },
    obstacles: [
      { id: 'o1', cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'o2', cells: [{ x: 5, y: 5 }] },
    ],
    tags: ['demo'],
  });
  assert.equal(layout.id, 'l');
  assert.equal(layout.obstacles.length, 2);
  assert.deepEqual([...layout.tags], ['demo']);
});

test('layoutBlockedCells returns the union of cell keys', () => {
  const layout = createObstacleLayout({
    id: 'l',
    name: 'Layout',
    obstacles: [
      { id: 'o1', cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }] },
      { id: 'o2', cells: [{ x: 5, y: 5 }] },
    ],
  });
  const blocked = layoutBlockedCells(layout);
  assert.equal(blocked.size, 3);
  assert.equal(blocked.has(cellKey({ x: 1, y: 1 })), true);
  assert.equal(blocked.has(cellKey({ x: 5, y: 5 })), true);
});

test('layoutToGrid produces a 2D boolean grid', () => {
  const layout = createObstacleLayout({
    id: 'l',
    name: 'Layout',
    obstacles: [{ id: 'o', cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }] }],
  });
  const board = createBoard({ width: 6, height: 6 });
  const grid = layoutToGrid(layout, board);
  assert.equal(grid.length, 6);
  assert.equal(grid[0][1], true);
  assert.equal(grid[1][0], true);
  assert.equal(grid[0][0], false);
});

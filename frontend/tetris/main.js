import {
  createPlayfieldRenderer,
  STATES,
  TETROMINO_TYPES,
} from '/tetris/rendering.bundle.js';

const COLUMNS = 10;
const VISIBLE_ROWS = 20;
const HIDDEN_ROWS = 2;
const TOTAL_ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
const CELL_SIZE = 28;

const canvas = document.getElementById('tetris-canvas');
const statusEl = document.getElementById('tetris-status');

const renderer = createPlayfieldRenderer({
  canvas,
  columns: COLUMNS,
  visibleRows: VISIBLE_ROWS,
  hiddenRows: HIDDEN_ROWS,
  cellSize: CELL_SIZE,
  padding: 14,
});

const state = createDemoState();

let lastFrameMs = performance.now();
function tick(now) {
  const dt = now - lastFrameMs;
  lastFrameMs = now;
  advance(dt);
  draw();
  requestAnimationFrame(tick);
}

function draw() {
  renderer.draw({
    board: state.board,
    active: state.active,
    ghost: state.showGhost ? state.ghost : null,
    state: state.runState,
    level: state.level,
    message: state.message,
  });
}

function advance(dt) {
  renderer.advance(dt);
  if (state.runState === STATES.PLAYING) {
    state.activeAccum += dt;
    while (state.activeAccum > 600) {
      moveActiveDown();
      state.activeAccum -= 600;
    }
  }
}

function createDemoState() {
  const board = [];
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLUMNS; c++) row.push(null);
    board.push(row);
  }
  // Seed some settled blocks for the demo.
  const seedTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  for (let r = TOTAL_ROWS - 4; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      if (Math.random() > 0.45) {
        board[r][c] = { type: seedTypes[(r + c) % seedTypes.length] };
      }
    }
  }
  return {
    board,
    active: spawnActive(),
    ghost: null,
    activeAccum: 0,
    showGhost: true,
    runState: STATES.PLAYING,
    level: 1,
    message: '',
  };
}

function spawnActive() {
  const type = TETROMINO_TYPES[Math.floor(Math.random() * TETROMINO_TYPES.length)];
  const cells = shapeFor(type, 4, HIDDEN_ROWS);
  const active = { type, cells, locking: false };
  return active;
}

function shapeFor(type, x, y) {
  switch (type) {
    case 'I':
      return [
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
        { x: x + 3, y: y + 1 },
      ];
    case 'O':
      return [
        { x: x + 1, y },
        { x: x + 2, y },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
      ];
    case 'T':
      return [
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
      ];
    case 'S':
      return [
        { x: x + 1, y },
        { x: x + 2, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ];
    case 'Z':
      return [
        { x, y },
        { x: x + 1, y },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
      ];
    case 'J':
      return [
        { x, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
      ];
    case 'L':
      return [
        { x: x + 2, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
        { x: x + 2, y: y + 1 },
      ];
    default:
      return [{ x, y }];
  }
}

function projectGhost(active) {
  let drop = 0;
  while (canMove(active.cells, 0, drop + 1)) drop++;
  if (drop === 0) return null;
  return {
    type: active.type,
    cells: active.cells.map((c) => ({ x: c.x, y: c.y + drop })),
  };
}

function canMove(cells, dx, dy) {
  for (const cell of cells) {
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    if (nx < 0 || nx >= COLUMNS) return false;
    if (ny >= TOTAL_ROWS) return false;
    if (ny >= 0 && state.board[ny][nx]) return false;
  }
  return true;
}

function moveActiveDown() {
  if (!state.active) return;
  if (canMove(state.active.cells, 0, 1)) {
    state.active.cells = state.active.cells.map((c) => ({ x: c.x, y: c.y + 1 }));
  } else {
    const cells = state.active.cells.slice();
    for (const cell of cells) {
      if (cell.y >= 0 && cell.y < TOTAL_ROWS) {
        state.board[cell.y][cell.x] = { type: state.active.type };
      }
    }
    renderer.lockFlash(cells);
    state.active = spawnActive();
  }
  state.ghost = projectGhost(state.active);
}

function findCompleteRows() {
  const rows = [];
  for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
    let full = true;
    for (let c = 0; c < COLUMNS; c++) {
      if (!state.board[r][c]) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  return rows;
}

function triggerLineClear() {
  let rows = findCompleteRows();
  if (rows.length === 0) {
    const candidate = TOTAL_ROWS - 2;
    for (let c = 0; c < COLUMNS; c++) {
      state.board[candidate][c] = state.board[candidate][c] || { type: TETROMINO_TYPES[c % TETROMINO_TYPES.length] };
    }
    rows = [candidate];
  }
  renderer.lineClear(rows);
  setStatus('Line clear scheduled for rows: ' + rows.join(', '));
  setTimeout(() => {
    for (const r of rows) {
      for (let c = 0; c < COLUMNS; c++) state.board[r][c] = null;
    }
  }, 340);
}

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.getAttribute('data-action');
  if (!action) return;
  switch (action) {
    case 'line-clear':
      triggerLineClear();
      break;
    case 'lock-flash':
      if (state.active) renderer.lockFlash(state.active.cells);
      setStatus('Lock flash triggered');
      break;
    case 'hard-drop': {
      if (!state.active) break;
      let drop = 0;
      while (canMove(state.active.cells, 0, drop + 1)) drop++;
      const fromY = Math.min.apply(null, state.active.cells.map((c) => c.y));
      const toY = fromY + drop;
      const column = state.active.cells[0].x;
      renderer.hardDrop(column, fromY, toY);
      state.active.cells = state.active.cells.map((c) => ({ x: c.x, y: c.y + drop }));
      moveActiveDown();
      setStatus('Hard drop ' + drop + ' rows');
      break;
    }
    case 'level-up':
      state.level += 1;
      renderer.levelUp(state.level);
      setStatus('Level up → ' + state.level);
      break;
    case 'pause':
      if (state.runState === STATES.PAUSED) {
        state.runState = STATES.PLAYING;
        setStatus('Resumed');
      } else {
        state.runState = STATES.PAUSED;
        setStatus('Paused');
      }
      break;
    case 'game-over':
      state.runState = STATES.GAME_OVER;
      renderer.gameOver();
      setStatus('Game over overlay');
      break;
    case 'reset': {
      renderer.reset();
      const fresh = createDemoState();
      state.board = fresh.board;
      state.active = fresh.active;
      state.ghost = projectGhost(fresh.active);
      state.runState = STATES.PLAYING;
      state.level = 1;
      state.activeAccum = 0;
      setStatus('Reset');
      break;
    }
    case 'toggle-ghost':
      state.showGhost = !state.showGhost;
      renderer.setShowGhost(state.showGhost);
      setStatus('Ghost ' + (state.showGhost ? 'on' : 'off'));
      break;
    default:
      break;
  }
});

state.ghost = projectGhost(state.active);
setStatus('Renderer ready · ' + state.board.length + ' rows × ' + COLUMNS + ' cols · cell ' + CELL_SIZE + 'px');
requestAnimationFrame(tick);

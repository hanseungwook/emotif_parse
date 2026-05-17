'use strict';

const DEFAULT_COLS = 10;
const DEFAULT_VISIBLE_ROWS = 20;
const DEFAULT_BUFFER_ROWS = 2;

class Board {
  constructor(options) {
    const opts = options || {};
    const cols = opts.cols == null ? DEFAULT_COLS : opts.cols;
    const visibleRows = opts.visibleRows == null ? DEFAULT_VISIBLE_ROWS : opts.visibleRows;
    const bufferRows = opts.bufferRows == null ? DEFAULT_BUFFER_ROWS : opts.bufferRows;
    if (!Number.isInteger(cols) || cols < 4) {
      throw new RangeError('cols must be an integer >= 4');
    }
    if (!Number.isInteger(visibleRows) || visibleRows < 4) {
      throw new RangeError('visibleRows must be an integer >= 4');
    }
    if (!Number.isInteger(bufferRows) || bufferRows < 0) {
      throw new RangeError('bufferRows must be an integer >= 0');
    }
    this.cols = cols;
    this.visibleRows = visibleRows;
    this.bufferRows = bufferRows;
    this.totalRows = visibleRows + bufferRows;
    this._grid = this._makeEmptyGrid();
  }

  _makeEmptyGrid() {
    const grid = new Array(this.totalRows);
    for (let r = 0; r < this.totalRows; r++) {
      grid[r] = new Array(this.cols).fill(null);
    }
    return grid;
  }

  reset() {
    this._grid = this._makeEmptyGrid();
  }

  // Bounds for the storage grid (excludes the vanish zone above the buffer).
  inBounds(col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.totalRows;
  }

  cellAt(col, row) {
    if (!this.inBounds(col, row)) return undefined;
    return this._grid[row][col];
  }

  // Cells outside the side walls, or below the floor, are blocked.
  // Cells above the storage grid (row < 0) are considered empty so SRS kicks
  // and spawn rotations can probe into the vanish zone.
  isCellEmpty(col, row) {
    if (col < 0 || col >= this.cols) return false;
    if (row >= this.totalRows) return false;
    if (row < 0) return true;
    return this._grid[row][col] == null;
  }

  collides(cells) {
    for (let i = 0; i < cells.length; i++) {
      const [c, r] = cells[i];
      if (!this.isCellEmpty(c, r)) return true;
    }
    return false;
  }

  setCell(col, row, value) {
    if (!this.inBounds(col, row)) {
      throw new RangeError(`setCell out of bounds: (${col}, ${row})`);
    }
    this._grid[row][col] = value;
  }

  // Lock a set of cells, returning a report so callers can detect lock-out.
  // - aboveBuffer: at least one cell was above the storage grid (row < 0).
  // - anyInVisible: at least one cell ended up in the visible playfield.
  lockCells(cells, value) {
    let aboveBuffer = false;
    let anyInVisible = false;
    for (let i = 0; i < cells.length; i++) {
      const [c, r] = cells[i];
      if (r < 0) { aboveBuffer = true; continue; }
      if (r >= this.totalRows || c < 0 || c >= this.cols) {
        throw new RangeError(`lockCells out of bounds: (${c}, ${r})`);
      }
      this._grid[r][c] = value;
      if (r >= this.bufferRows) anyInVisible = true;
    }
    return { aboveBuffer, anyInVisible };
  }

  findFullRows() {
    const full = [];
    for (let r = 0; r < this.totalRows; r++) {
      let allFilled = true;
      for (let c = 0; c < this.cols; c++) {
        if (this._grid[r][c] == null) { allFilled = false; break; }
      }
      if (allFilled) full.push(r);
    }
    return full;
  }

  // Remove the given rows, shifting everything above downward. Returns number cleared.
  clearRows(rowIndices) {
    if (!rowIndices || rowIndices.length === 0) return 0;
    const toClear = new Set(rowIndices);
    const kept = [];
    for (let r = 0; r < this.totalRows; r++) {
      if (!toClear.has(r)) kept.push(this._grid[r]);
    }
    const cleared = this.totalRows - kept.length;
    const empties = new Array(cleared);
    for (let i = 0; i < cleared; i++) {
      empties[i] = new Array(this.cols).fill(null);
    }
    this._grid = empties.concat(kept);
    return cleared;
  }

  // Deep-copy snapshot for renderers and tests.
  snapshot() {
    return this._grid.map((row) => row.slice());
  }
}

module.exports = { Board, DEFAULT_COLS, DEFAULT_VISIBLE_ROWS, DEFAULT_BUFFER_ROWS };

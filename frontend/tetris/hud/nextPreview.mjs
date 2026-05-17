import { getPieceShape } from './pieces.mjs';

// Renders the upcoming-piece preview column. Each slot is sized to fit a 4x4
// tetromino bounding box; the actual piece is drawn as a grid of cells with
// the canonical color. The first slot is given a "next" highlight modifier.

const DEFAULT_CLASS_NAMES = Object.freeze({
  root: 'hud-next',
  title: 'hud-next__title',
  list: 'hud-next__list',
  slot: 'hud-next__slot',
  slotHead: 'hud-next__slot--head',
  empty: 'hud-next__slot--empty',
  piece: 'hud-next__piece',
  row: 'hud-next__row',
  cell: 'hud-next__cell',
  cellFilled: 'hud-next__cell--filled',
});

const DEFAULT_BOX = 4;

function resolveDocument(opts) {
  if (opts && opts.document) return opts.document;
  if (opts && opts.container && opts.container.ownerDocument) {
    return opts.container.ownerDocument;
  }
  if (typeof document !== 'undefined') return document;
  if (typeof window !== 'undefined' && window.document) return window.document;
  return null;
}

export class NextPreviewPanel {
  constructor(options) {
    const opts = options || {};
    if (!opts.container) throw new TypeError('NextPreviewPanel requires a container');
    this._container = opts.container;
    this._document = resolveDocument(opts);
    if (!this._document) throw new TypeError('NextPreviewPanel requires a document');
    this._slots = Math.max(1, Number(opts.slots) || 5);
    this._title = typeof opts.title === 'string' ? opts.title : 'Next';
    this._classNames = { ...DEFAULT_CLASS_NAMES, ...(opts.classNames || {}) };
    this._mounted = false;
    this._listMount = null;
    this._slotNodes = [];
    this._lastQueue = [];
  }

  mount() {
    if (this._mounted) return;
    this._mounted = true;
    this._build();
  }

  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._listMount = null;
    this._slotNodes = [];
    this._lastQueue = [];
  }

  setQueue(queue) {
    const next = Array.isArray(queue) ? queue.slice(0, this._slots) : [];
    this._lastQueue = next;
    if (!this._mounted) return;
    this._renderQueue(next);
  }

  // Internal convenience for tests / debugging.
  getSlotCount() {
    return this._slots;
  }

  _build() {
    const doc = this._document;
    while (this._container.firstChild) {
      this._container.removeChild(this._container.firstChild);
    }
    this._container.className = this._joinClass(this._container.className, this._classNames.root);

    const title = doc.createElement('h2');
    title.className = this._classNames.title;
    title.textContent = this._title;
    this._container.appendChild(title);

    const list = doc.createElement('div');
    list.className = this._classNames.list;
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Upcoming pieces');
    this._container.appendChild(list);
    this._listMount = list;

    this._slotNodes = [];
    for (let i = 0; i < this._slots; i++) {
      const slot = doc.createElement('div');
      slot.className = this._joinClass(
        this._classNames.slot,
        i === 0 ? this._classNames.slotHead : ''
      );
      slot.setAttribute('role', 'listitem');
      slot.setAttribute('data-slot-index', String(i));
      list.appendChild(slot);
      this._slotNodes.push(slot);
    }

    this._renderQueue(this._lastQueue);
  }

  _renderQueue(queue) {
    for (let i = 0; i < this._slotNodes.length; i++) {
      const slot = this._slotNodes[i];
      const kind = queue[i] || null;
      this._renderSlot(slot, kind);
    }
  }

  _renderSlot(slot, kind) {
    while (slot.firstChild) slot.removeChild(slot.firstChild);
    if (!kind) {
      slot.setAttribute('data-piece', '');
      slot.setAttribute('aria-label', 'Empty preview slot');
      slot.className = this._joinClass(slot.className, this._classNames.empty);
      return;
    }
    slot.className = this._stripClass(slot.className, this._classNames.empty);
    slot.setAttribute('data-piece', kind);
    slot.setAttribute('aria-label', `Upcoming piece: ${kind}`);

    const shape = getPieceShape(kind);
    if (!shape) return;

    const piece = this._document.createElement('div');
    piece.className = this._classNames.piece;
    piece.setAttribute('data-piece-kind', kind);
    if (shape.color && typeof piece.style === 'object' && piece.style) {
      piece.style.setProperty?.('--piece-color', shape.color);
    }

    const width = Math.max(shape.boxWidth || 0, 1);
    const height = Math.max(shape.boxHeight || 0, 1);
    const offsetX = Math.floor((DEFAULT_BOX - width) / 2);
    const offsetY = Math.floor((DEFAULT_BOX - height) / 2);
    const filled = new Set();
    for (const cell of shape.cells) {
      filled.add(`${cell.x + offsetX},${cell.y + offsetY}`);
    }

    for (let y = 0; y < DEFAULT_BOX; y++) {
      const row = this._document.createElement('div');
      row.className = this._classNames.row;
      for (let x = 0; x < DEFAULT_BOX; x++) {
        const cell = this._document.createElement('div');
        const isFilled = filled.has(`${x},${y}`);
        cell.className = this._joinClass(
          this._classNames.cell,
          isFilled ? this._classNames.cellFilled : ''
        );
        if (isFilled && shape.color && cell.style && typeof cell.style.setProperty === 'function') {
          cell.style.setProperty('--piece-color', shape.color);
        }
        row.appendChild(cell);
      }
      piece.appendChild(row);
    }
    slot.appendChild(piece);
  }

  _joinClass(base, addition) {
    const existing = (base || '').split(' ').filter(Boolean);
    if (addition && !existing.includes(addition)) existing.push(addition);
    return existing.join(' ');
  }

  _stripClass(base, removal) {
    if (!removal) return base || '';
    return (base || '')
      .split(' ')
      .filter((c) => c && c !== removal)
      .join(' ');
  }
}

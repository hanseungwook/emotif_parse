// Browser-only canvas renderer. Translates engine snapshots into pixels and
// applies the active skin's colors so Snake Skins ship as a visible feature.
// Loaded as an ES module from the demo page.

import { getSkin } from './engine-bundle.js';

const BACKGROUND = '#0b1020';
const GRID_LINE = 'rgba(255, 255, 255, 0.03)';
const FOOD_COLOR = '#ff5c8a';
const FOOD_GLOW = 'rgba(255, 92, 138, 0.35)';
const OBSTACLE_FILL = '#5a4a78';
const OBSTACLE_HIGHLIGHT = '#8b7ab8';

export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

  function fit(width, height) {
    const size = Math.min(
      options.maxSize || 560,
      Math.floor(canvas.parentElement.clientWidth || 480)
    );
    const cell = Math.floor(size / Math.max(width, height));
    const pxW = cell * width;
    const pxH = cell * height;
    canvas.style.width = pxW + 'px';
    canvas.style.height = pxH + 'px';
    canvas.width = pxW * dpr;
    canvas.height = pxH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return cell;
  }

  function paintBackground(width, height, cell) {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, width * cell, height * cell);
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, height * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(width * cell, y * cell + 0.5);
      ctx.stroke();
    }
  }

  function paintObstacles(obstacles, cell) {
    for (const o of obstacles) {
      const px = o.x * cell;
      const py = o.y * cell;
      ctx.fillStyle = OBSTACLE_FILL;
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      ctx.fillStyle = OBSTACLE_HIGHLIGHT;
      ctx.fillRect(px + 2, py + 2, cell - 6, 3);
    }
  }

  function paintFood(food, cell) {
    if (!food) return;
    const cx = food.x * cell + cell / 2;
    const cy = food.y * cell + cell / 2;
    const r = cell / 2 - 2;
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, r + 6);
    glow.addColorStop(0, FOOD_COLOR);
    glow.addColorStop(1, FOOD_GLOW);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintSnake(snake, cell, skin, tickCount) {
    const segments = snake.segments;
    for (let i = segments.length - 1; i >= 1; i -= 1) {
      const seg = segments[i];
      const t = i / segments.length;
      ctx.fillStyle = blend(skin.body, skin.accent, 1 - t);
      const inset = i === segments.length - 1 ? 4 : 2;
      ctx.fillRect(
        seg.x * cell + inset,
        seg.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2
      );
    }
    const head = segments[0];
    const pulse = (Math.sin(tickCount / 4) + 1) / 2;
    ctx.fillStyle = blend(skin.head, skin.accent, pulse * 0.2);
    ctx.fillRect(head.x * cell + 1, head.y * cell + 1, cell - 2, cell - 2);
    paintEyes(head, snake.direction, cell, skin);
  }

  function paintEyes(head, direction, cell, skin) {
    ctx.fillStyle = skin.eye;
    const off = cell / 4;
    const dot = Math.max(2, cell / 8);
    let ex1;
    let ey1;
    let ex2;
    let ey2;
    if (direction === 'right') {
      ex1 = head.x * cell + cell - off;
      ey1 = head.y * cell + off;
      ex2 = head.x * cell + cell - off;
      ey2 = head.y * cell + cell - off;
    } else if (direction === 'left') {
      ex1 = head.x * cell + off;
      ey1 = head.y * cell + off;
      ex2 = head.x * cell + off;
      ey2 = head.y * cell + cell - off;
    } else if (direction === 'up') {
      ex1 = head.x * cell + off;
      ey1 = head.y * cell + off;
      ex2 = head.x * cell + cell - off;
      ey2 = head.y * cell + off;
    } else {
      ex1 = head.x * cell + off;
      ey1 = head.y * cell + cell - off;
      ex2 = head.x * cell + cell - off;
      ey2 = head.y * cell + cell - off;
    }
    ctx.beginPath();
    ctx.arc(ex1, ey1, dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex2, ey2, dot, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(state) {
    const cell = fit(state.width, state.height);
    paintBackground(state.width, state.height, cell);
    paintObstacles(state.obstacles, cell);
    paintFood(state.food, cell);
    paintSnake(state.snake, cell, getSkin(state.skinId), state.tickCount);
  }

  return { render };
}

function blend(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

'use strict';

// =============================================================
// 2Ray-C — Prototype C: plain JS, no build, no dependencies.
// Behavior spec: docs/plans/plan-2ray-c-2026-09-07.md (U-001..U-013).
// Monochrome: white geometry on black, nothing else.
//
// Formula tunables (U-tunables): focal / pow / fish / maxh are
// number inputs stepping 0.1 (Shift+arrows = 0.01). The live
// formula is drawn big and centered at 0.5 opacity. Press B to
// run the 600-update benchmark (fixed dt, identical scripted
// input) and time it.
// =============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const angleInput = document.getElementById('angleInput');
const densityInput = document.getElementById('densityInput');
const fpsEl = document.getElementById('fps');
const formulaEl = document.getElementById('formula');
const benchEl = document.getElementById('bench');

const WORLD_SCALE = 2;     // world = viewport * scale (top map spans 2x viewport)
const PLAYER_RADIUS = 6;
const RAY_ALPHA = 0.25;
const MOVE_SPEED = 180;    // px / s
const ROT_SPEED = 2.0;     // rad / s
const WALL_MARGIN = 80;    // min distance of random wall from borders

// Bottom-view formula parameters. Defaults reproduce the original
// formula exactly:  colH = min(renderH, (renderH * focal) / perp)
const formula = { focal: 1.5, pow: 1, fish: 1, maxh: 1 };

const BENCH_FRAMES = 600;      // updates per benchmark run
const BENCH_DT = 1 / 60;       // fixed dt for the benchmark

// Floor reference grid (movement cues in the bottom view).
const FLOOR_GRID = 100;        // world px between floor points
const FLOOR_GRID_MAXD = 1600;  // max forward distance for floor points

// Top-map zoom around the player (+ / - keys).
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

let viewW = 0, viewH = 0, mapH = 0, renderH = 0;
let worldW = 0, worldH = 0;
let walls = [];
let player = { x: 0, y: 0, heading: 0 };
let init = false;

let viewAngle = 60;   // degrees, no rails
let rayDensity = 2;   // rays per degree, no rails

let zoom = 1;         // top-map zoom factor, centered on the player

let bench = null;     // { frames, t0 } while a benchmark run is active

const keys = new Set();
const fps = { frames: 0, t: performance.now(), last: performance.now() };

// --- World ---------------------------------------------------

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function randomWall() {
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const dir = dirs[(Math.random() * dirs.length) | 0];
  const cx = WALL_MARGIN + Math.random() * (worldW - 2 * WALL_MARGIN);
  const cy = WALL_MARGIN + Math.random() * (worldH - 2 * WALL_MARGIN);
  const half = 60 + Math.random() * 80;
  return {
    ax: cx - Math.cos(dir) * half, ay: cy - Math.sin(dir) * half,
    bx: cx + Math.cos(dir) * half, by: cy + Math.sin(dir) * half,
  };
}

function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  mapH = Math.floor(viewH / 2);
  renderH = viewH - mapH;
  canvas.width = viewW;
  canvas.height = viewH;
  worldW = viewW * WORLD_SCALE;
  worldH = mapH * 2;
  walls = [
    { ax: 0, ay: 0, bx: worldW, by: 0 },                    // top border
    { ax: worldW, ay: 0, bx: worldW, by: worldH },          // right border
    { ax: worldW, ay: worldH, bx: 0, by: worldH },          // bottom border
    { ax: 0, ay: worldH, bx: 0, by: 0 },                    // left border
  ];
  walls.push(randomWall());
  if (!init) {
    player.x = worldW / 2;
    player.y = worldH / 2;
    player.heading = 0;
    init = true;
  } else {
    player.x = clamp(player.x, PLAYER_RADIUS, worldW - PLAYER_RADIUS);
    player.y = clamp(player.y, PLAYER_RADIUS, worldH - PLAYER_RADIUS);
  }
}

// --- Ray casting ---------------------------------------------

// Ray P + t*D against wall A + u*E. Returns t (>0) or Infinity.
function intersect(px, py, dx, dy, w) {
  const ex = w.bx - w.ax, ey = w.by - w.ay;
  const denom = dx * ey - dy * ex;
  if (denom === 0) return Infinity;
  const t = ((w.ax - px) * ey - (w.ay - py) * ex) / denom;
  if (t <= 0) return Infinity;
  const u = ((w.ax - px) * dy - (w.ay - py) * dx) / denom;
  if (u < 0 || u > 1) return Infinity;
  return t;
}

function castRays() {
  const count = Math.max(1, Math.floor(viewAngle * rayDensity) + 1);
  const fov = (viewAngle * Math.PI) / 180;
  const maxLen = Math.hypot(worldW, worldH);
  const rays = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const offset = -fov / 2 + t * fov;
    const dirX = Math.cos(player.heading + offset);
    const dirY = Math.sin(player.heading + offset);
    let dist = Infinity;
    for (const w of walls) {
      const d = intersect(player.x, player.y, dirX, dirY, w);
      if (d < dist) dist = d;
    }
    const len = dist === Infinity ? maxLen : dist;
    rays.push({
      x1: player.x, y1: player.y,
      x2: player.x + dirX * len, y2: player.y + dirY * len,
      dist, offset,
    });
  }
  return rays;
}

// --- Rendering ------------------------------------------------

function renderMap(rays) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, viewW, mapH);
  ctx.save();
  ctx.translate(viewW / 2, mapH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-player.x, -player.y);
  ctx.strokeStyle = 'rgba(255,255,255,' + RAY_ALPHA + ')';
  ctx.lineWidth = 1;
  for (const r of rays) {
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1);
    ctx.lineTo(r.x2, r.y2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (const w of walls) {
    ctx.beginPath();
    ctx.moveTo(w.ax, w.ay);
    ctx.lineTo(w.bx, w.by);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Project the world floor lattice onto the bottom panel with the same
// tuned projection as the walls, so movement is visible in empty views.
function renderFloorGrid() {
  const fov = (viewAngle * Math.PI) / 180;
  const cosH = Math.cos(player.heading);
  const sinH = Math.sin(player.heading);
  const minX = Math.max(0, Math.floor((player.x - FLOOR_GRID_MAXD) / FLOOR_GRID) * FLOOR_GRID);
  const maxX = Math.min(worldW, Math.ceil((player.x + FLOOR_GRID_MAXD) / FLOOR_GRID) * FLOOR_GRID);
  const minY = Math.max(0, Math.floor((player.y - FLOOR_GRID_MAXD) / FLOOR_GRID) * FLOOR_GRID);
  const maxY = Math.min(worldH, Math.ceil((player.y + FLOOR_GRID_MAXD) / FLOOR_GRID) * FLOOR_GRID);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let gx = minX; gx <= maxX; gx += FLOOR_GRID) {
    for (let gy = minY; gy <= maxY; gy += FLOOR_GRID) {
      const dx = gx - player.x;
      const dy = gy - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > FLOOR_GRID_MAXD) continue;
      const dot = dx * cosH + dy * sinH;
      if (dot <= 0) continue;
      const cross = -dx * sinH + dy * cosH;
      const offset = Math.atan2(cross, dot);
      if (offset < -fov / 2 || offset > fov / 2) continue;
      const perp = dist * Math.cos(offset * formula.fish);
      if (perp <= 0 || perp > FLOOR_GRID_MAXD) continue;
      const bare = (renderH * formula.focal) / Math.pow(perp, formula.pow);
      const h = Math.min(renderH * formula.maxh, bare);
      if (h <= 0) continue;
      const sx = viewW * (0.5 + offset / fov);
      const sy = mapH + renderH / 2 + h / 2;
      if (sy >= mapH + renderH) continue;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
}

function renderScene(rays) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, mapH, viewW, renderH);
  renderFloorGrid();
  const count = rays.length;
  if (count === 0) return;
  const colW = viewW / count;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < count; i++) {
    const r = rays[i];
    if (r.dist === Infinity) continue;
    // Tuned projection: perpendicular distance with fisheye amount,
    // column height with focal, exponent, max-height fraction.
    const perp = r.dist * Math.cos(r.offset * formula.fish);
    if (perp <= 0) continue;
    const bare = (renderH * formula.focal) / Math.pow(perp, formula.pow);
    const h = Math.min(renderH * formula.maxh, bare);
    if (h <= 0) continue;
    ctx.fillRect(Math.floor(i * colW), mapH + (renderH - h) / 2, Math.ceil(colW) + 1, h);
  }
}

// --- Formula readout ------------------------------------------

function fmt(v) { return String(Math.round(v * 100) / 100); }

function updateFormula() {
  const text =
    'colH = min( R\u00B7maxh , (R\u00B7focal) / (d\u00B7cos(\u03C6\u00B7fish))^pow )\n' +
    'R=' + (renderH | 0) +
    '  focal=' + fmt(formula.focal) +
    '  pow=' + fmt(formula.pow) +
    '  fish=' + fmt(formula.fish) +
    '  maxh=' + fmt(formula.maxh);
  if (formulaEl.textContent !== text) formulaEl.textContent = text;
}

// --- Simulation ------------------------------------------------

function update(dt) {
  const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  if (forward !== 0) {
    player.x = clamp(
      player.x + Math.cos(player.heading) * MOVE_SPEED * dt * forward,
      PLAYER_RADIUS, worldW - PLAYER_RADIUS
    );
    player.y = clamp(
      player.y + Math.sin(player.heading) * MOVE_SPEED * dt * forward,
      PLAYER_RADIUS, worldH - PLAYER_RADIUS
    );
  }
  if (keys.has('KeyA')) player.heading -= ROT_SPEED * dt;
  if (keys.has('KeyD')) player.heading += ROT_SPEED * dt;
  if (player.heading > Math.PI * 2) player.heading -= Math.PI * 2;
  if (player.heading < 0) player.heading += Math.PI * 2;
}

function frame(now) {
  const benchActive = bench !== null;
  const dt = benchActive ? BENCH_DT : Math.min(0.05, (now - fps.last) / 1000);
  if (!benchActive) fps.last = now;

  if (benchActive) {
    // Identical scripted input for every benchmark run.
    keys.add('KeyW');
    keys.add('KeyD');
  }

  update(dt);
  const rays = castRays();
  renderMap(rays);
  renderScene(rays);

  if (benchActive) {
    bench.frames++;
    if (bench.frames >= BENCH_FRAMES) {
      const ms = performance.now() - bench.t0;
      benchEl.textContent = 'BENCH: ' + BENCH_FRAMES + ' updates in ' + ms.toFixed(1) + ' ms';
      keys.delete('KeyW');
      keys.delete('KeyD');
      bench = null;
    }
  } else {
    fps.frames++;
    if (now - fps.t >= 500) {
      fpsEl.textContent = 'FPS: ' + Math.round((fps.frames * 1000) / (now - fps.t));
      fps.frames = 0;
      fps.t = now;
    }
  }

  updateFormula();
  requestAnimationFrame(frame);
}

// --- Input ----------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    e.preventDefault();
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', resize);

window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyB') return;
  if (e.target instanceof HTMLInputElement) return; // allow typing in inputs
  if (bench !== null) return;                       // a run is in progress
  bench = { frames: 0, t0: performance.now() };
  benchEl.textContent = 'BENCH: running ' + BENCH_FRAMES + ' updates...';
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return; // allow typing in inputs
  if (e.key === '+') zoom = clamp(zoom * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
  if (e.key === '-') zoom = clamp(zoom / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
});

function wireShiftNudge(el) {
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!e.shiftKey) return; // native step="0.1" handles the plain arrows
    e.preventDefault();
    const step = e.key === 'ArrowUp' ? 0.01 : -0.01;
    const v = (parseFloat(el.value) || 0) + step;
    el.value = String(Math.round(v * 100) / 100);
    el.dispatchEvent(new Event('input'));
  });
}

function wireFormulaInput(el, key) {
  el.addEventListener('input', () => { formula[key] = Number(el.value); });
  wireShiftNudge(el);
}

angleInput.addEventListener('input', () => { viewAngle = Number(angleInput.value); });
densityInput.addEventListener('input', () => { rayDensity = Number(densityInput.value); });
wireShiftNudge(angleInput);
wireShiftNudge(densityInput);

wireFormulaInput(document.getElementById('focalInput'), 'focal');
wireFormulaInput(document.getElementById('powInput'), 'pow');
wireFormulaInput(document.getElementById('fishInput'), 'fish');
wireFormulaInput(document.getElementById('maxhInput'), 'maxh');

// --- Start ----------------------------------------------------

resize();
requestAnimationFrame(frame);
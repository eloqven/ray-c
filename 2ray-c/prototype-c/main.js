'use strict';

// =============================================================
// 2Ray-C — Prototype C: plain JS, no build, no dependencies.
// Behavior spec: docs/plans/plan-2ray-c-2026-09-07.md (U-001..U-013).
// Monochrome: white geometry on black, nothing else.
// =============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const angleInput = document.getElementById('angleInput');
const densityInput = document.getElementById('densityInput');
const fpsEl = document.getElementById('fps');

const WORLD_SCALE = 2;     // world = viewport * scale (top map spans 2x viewport)
const PLAYER_RADIUS = 6;
const RAY_ALPHA = 0.25;
const FOCAL = 1.5;         // column-height focal factor
const MOVE_SPEED = 180;    // px / s
const ROT_SPEED = 2.0;     // rad / s
const WALL_MARGIN = 80;    // min distance of random wall from borders

let viewW = 0, viewH = 0, mapH = 0, renderH = 0;
let worldW = 0, worldH = 0;
let walls = [];
let player = { x: 0, y: 0, heading: 0 };
let init = false;

let viewAngle = 60;   // degrees, no rails
let rayDensity = 2;   // rays per degree, no rails

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
  ctx.translate(viewW / 2 - player.x, mapH / 2 - player.y);
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

function renderScene(rays) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, mapH, viewW, renderH);
  const count = rays.length;
  if (count === 0) return;
  const colW = viewW / count;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < count; i++) {
    const r = rays[i];
    if (r.dist === Infinity) continue;
    const perp = r.dist * Math.cos(r.offset);
    if (perp <= 0) continue;
    const h = Math.min(renderH, (renderH * FOCAL) / perp);
    ctx.fillRect(Math.floor(i * colW), mapH + (renderH - h) / 2, Math.ceil(colW) + 1, h);
  }
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
  const dt = Math.min(0.05, (now - fps.last) / 1000);
  fps.last = now;
  update(dt);
  const rays = castRays();
  renderMap(rays);
  renderScene(rays);
  fps.frames++;
  if (now - fps.t >= 500) {
    fpsEl.textContent = 'FPS: ' + Math.round((fps.frames * 1000) / (now - fps.t));
    fps.frames = 0;
    fps.t = now;
  }
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

angleInput.addEventListener('input', () => { viewAngle = Number(angleInput.value); });
densityInput.addEventListener('input', () => { rayDensity = Number(densityInput.value); });

// --- Start ----------------------------------------------------

resize();
requestAnimationFrame(frame);
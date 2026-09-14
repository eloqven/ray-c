// =============================================================
// 2Ray-C — Prototype A: render module.
// Top map panel (white walls/rays/circle on black) + bottom
// ray-cast panel (white columns on black, height by distance).
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

import type { Ray } from './raycast';
import { walls, player, worldW, worldH, PLAYER_RADIUS } from './world';
import { columnHeight } from './formula';

export const RAY_ALPHA = 0.25;

// Floor reference grid (movement cues in the bottom view).
const FLOOR_GRID = 100;        // world px between floor points
const FLOOR_GRID_MAXD = 1600;  // max forward distance for floor points

export const zoom = { value: 1 };

export function renderMap(ctx: CanvasRenderingContext2D, rays: Ray[], viewW: number, viewH: number): void {
  const mapH = Math.floor(viewH / 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, viewW, mapH);
  ctx.save();
  ctx.translate(viewW / 2, mapH / 2);
  ctx.scale(zoom.value, zoom.value);
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

export function renderScene(ctx: CanvasRenderingContext2D, rays: Ray[], viewW: number, viewH: number): void {
  const mapH = Math.floor(viewH / 2);
  const renderH = viewH - mapH;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, mapH, viewW, renderH);
  renderFloorGrid(ctx, rays, viewW, mapH, renderH);
  const count = rays.length;
  if (count === 0) return;
  const colW = viewW / count;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < count; i++) {
    const r = rays[i];
    if (r.dist === Infinity) continue;
    const h = columnHeight(r.dist, r.offset, renderH);
    if (h <= 0) continue;
    ctx.fillRect(
      Math.floor(i * colW),
      mapH + (renderH - h) / 2,
      Math.ceil(colW) + 1,
      h
    );
  }
}

// Project the world floor lattice onto the bottom panel with the same
// tuned projection as the walls, so movement is visible in empty views.
function renderFloorGrid(ctx: CanvasRenderingContext2D, rays: Ray[], viewW: number, mapH: number, renderH: number): void {
  if (rays.length < 2) return;
  const fov = rays[rays.length - 1].offset - rays[0].offset;
  if (fov <= 0) return;
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
      const h = columnHeight(dist, offset, renderH);
      if (h <= 0) continue;
      const sx = viewW * (0.5 + offset / fov);
      const sy = mapH + renderH / 2 + h / 2;
      if (sy >= mapH + renderH) continue;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
}

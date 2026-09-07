// =============================================================
// 2Ray-C — Prototype A: render module.
// Top map panel (white walls/rays/circle on black) + bottom
// ray-cast panel (white columns on black, height by distance).
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

import type { Ray } from './raycast';
import { walls, player, PLAYER_RADIUS } from './world';

export const RAY_ALPHA = 0.25;
export const FOCAL = 1.5;  // column-height focal factor

export function renderMap(ctx: CanvasRenderingContext2D, rays: Ray[], viewW: number, viewH: number): void {
  const mapH = Math.floor(viewH / 2);
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

export function renderScene(ctx: CanvasRenderingContext2D, rays: Ray[], viewW: number, viewH: number): void {
  const mapH = Math.floor(viewH / 2);
  const renderH = viewH - mapH;
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
    ctx.fillRect(
      Math.floor(i * colW),
      mapH + (renderH - h) / 2,
      Math.ceil(colW) + 1,
      h
    );
  }
}

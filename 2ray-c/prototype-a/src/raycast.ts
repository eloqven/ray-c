// =============================================================
// 2Ray-C — Prototype A: raycast module.
// Deterministic ray/<wall> intersection + FOV fan casting.
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

import { worldW, worldH, walls, player, type Wall } from './world';

export interface Ray {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dist: number;
  offset: number;
}

// Ray P + t*D against wall A + u*E. Returns t (>0) or Infinity.
function intersect(px: number, py: number, dx: number, dy: number, w: Wall): number {
  const ex = w.bx - w.ax;
  const ey = w.by - w.ay;
  const denom = dx * ey - dy * ex;
  if (denom === 0) return Infinity;
  const t = ((w.ax - px) * ey - (w.ay - py) * ex) / denom;
  if (t <= 0) return Infinity;
  const u = ((w.ax - px) * dy - (w.ay - py) * dx) / denom;
  if (u < 0 || u > 1) return Infinity;
  return t;
}

export function castRays(viewAngle: number, rayDensity: number): Ray[] {
  const count = Math.max(1, Math.floor(viewAngle * rayDensity) + 1);
  const fov = (viewAngle * Math.PI) / 180;
  const maxLen = Math.hypot(worldW, worldH);
  const rays: Ray[] = [];
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
      x1: player.x,
      y1: player.y,
      x2: player.x + dirX * len,
      y2: player.y + dirY * len,
      dist,
      offset,
    });
  }
  return rays;
}

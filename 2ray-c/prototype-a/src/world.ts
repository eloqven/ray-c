// =============================================================
// 2Ray-C — Prototype A: world module.
// Owns the world box (4 border walls + 1 random interior wall),
// the player state, and window-resize logic.
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

export interface Wall {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Player {
  x: number;
  y: number;
  heading: number;
}

export const WORLD_SCALE = 2;    // world = viewport * scale
export const PLAYER_RADIUS = 6;
export const WALL_MARGIN = 80;   // min distance of random wall from borders

export let worldW = 0;
export let worldH = 0;
export let walls: Wall[] = [];
export const player: Player = { x: 0, y: 0, heading: 0 };

let initialized = false;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function randomWall(): Wall {
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const dir = dirs[(Math.random() * dirs.length) | 0];
  const cx = WALL_MARGIN + Math.random() * (worldW - 2 * WALL_MARGIN);
  const cy = WALL_MARGIN + Math.random() * (worldH - 2 * WALL_MARGIN);
  const half = 60 + Math.random() * 80;
  return {
    ax: cx - Math.cos(dir) * half,
    ay: cy - Math.sin(dir) * half,
    bx: cx + Math.cos(dir) * half,
    by: cy + Math.sin(dir) * half,
  };
}

export function resize(viewW: number, viewH: number): void {
  const mapH = Math.floor(viewH / 2);
  worldW = viewW * WORLD_SCALE;
  worldH = mapH * 2;
  walls = [
    { ax: 0, ay: 0, bx: worldW, by: 0 },                      // top border
    { ax: worldW, ay: 0, bx: worldW, by: worldH },            // right border
    { ax: worldW, ay: worldH, bx: 0, by: worldH },            // bottom border
    { ax: 0, ay: worldH, bx: 0, by: 0 },                      // left border
  ];
  walls.push(randomWall());
  if (!initialized) {
    player.x = worldW / 2;
    player.y = worldH / 2;
    player.heading = 0;
    initialized = true;
  } else {
    player.x = clamp(player.x, PLAYER_RADIUS, worldW - PLAYER_RADIUS);
    player.y = clamp(player.y, PLAYER_RADIUS, worldH - PLAYER_RADIUS);
  }
}

export function resetWorld(): void {
  initialized = false;
}

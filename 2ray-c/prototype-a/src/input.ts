// =============================================================
// 2Ray-C — Prototype A: input module.
// WASD movement/rotation + keyboard state. No sprint, no
// collision pushback; position clamped to world box.
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

import { worldW, worldH, player, clamp, PLAYER_RADIUS } from './world';

export const MOVE_SPEED = 180;  // px / s
export const ROT_SPEED = 2.0;   // rad / s

export const keys = new Set<string>();

export function init(): void {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
      e.preventDefault();
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e: KeyboardEvent) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}

export function update(dt: number): void {
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

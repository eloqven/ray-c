// =============================================================
// 2Ray-C — Prototype A: TS + Canvas2D + Vite (no runtime deps).
// Entry point wiring world / raycast / input / render / fps.
// Behavior mirror of prototype-c per docs/plans/plan-2ray-c-2026-09-07.md
// (U-001..U-013). Monochrome: white on black, nothing else.
// =============================================================

import { resize as resizeWorld } from './world';
import { castRays } from './raycast';
import { init as initInput, update as updateInput } from './input';
import { renderMap, renderScene } from './render';
import { createFpsState, tickFps } from './fps';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const angleInput = document.getElementById('angleInput') as HTMLInputElement;
const densityInput = document.getElementById('densityInput') as HTMLInputElement;
const fpsEl = document.getElementById('fps') as HTMLDivElement;

// Defaults: view angle 60, rays/degree 2 (U-013).
let viewAngle = 60;
let rayDensity = 2;

const fps = createFpsState();

function resize(): void {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
  resizeWorld(viewW, viewH);
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - fps.last) / 1000);
  updateInput(dt);
  const rays = castRays(viewAngle, rayDensity);
  renderMap(ctx, rays, window.innerWidth, window.innerHeight);
  renderScene(ctx, rays, window.innerWidth, window.innerHeight);
  const fpsText = tickFps(fps, now);
  if (fpsText !== null) {
    fpsEl.textContent = fpsText;
  }
  requestAnimationFrame(frame);
}

// --- Input listeners ---
angleInput.addEventListener('input', () => {
  viewAngle = Number(angleInput.value);
});
densityInput.addEventListener('input', () => {
  rayDensity = Number(densityInput.value);
});
window.addEventListener('resize', resize);

initInput();
resize();
requestAnimationFrame(frame);

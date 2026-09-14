// =============================================================
// 2Ray-C — Prototype A: TS + Canvas2D + Vite (no runtime deps).
// Entry point wiring world / raycast / input / render / fps.
// Behavior mirror of prototype-c per docs/plans/plan-2ray-c-2026-09-07.md
// (U-001..U-013). Monochrome: white on black, nothing else.
//
// Formula tunables (focal / pow / fish / maxh) are number inputs
// stepping 0.1 (Shift+arrows = 0.01). The live formula is drawn
// big and centered at 0.5 opacity. Press B to run the 600-update
// benchmark (fixed dt, identical scripted input) and time it.
// =============================================================

import { resize as resizeWorld, clamp } from './world';
import { castRays } from './raycast';
import { init as initInput, update as updateInput, keys } from './input';
import { renderMap, renderScene, zoom } from './render';
import { createFpsState, tickFps } from './fps';
import { formula, updateFormulaText } from './formula';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const angleInput = document.getElementById('angleInput') as HTMLInputElement;
const densityInput = document.getElementById('densityInput') as HTMLInputElement;
const fpsEl = document.getElementById('fps') as HTMLDivElement;
const formulaEl = document.getElementById('formula') as HTMLDivElement;
const benchEl = document.getElementById('bench') as HTMLDivElement;

const BENCH_FRAMES = 600;  // updates per benchmark run
const BENCH_DT = 1 / 60;   // fixed dt for the benchmark

// Top-map zoom around the player (+ / - keys).
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

// Defaults: view angle 60, rays/degree 2 (U-013).
let viewAngle = 60;
let rayDensity = 2;

let bench: { frames: number; t0: number } | null = null;

const fps = createFpsState();

function resize(): void {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
  resizeWorld(viewW, viewH);
}

function frame(now: number): void {
  const benchActive = bench !== null;
  const dt = benchActive ? BENCH_DT : Math.min(0.05, (now - fps.last) / 1000);
  if (!benchActive) fps.last = now;

  if (bench !== null) {
    // Identical scripted input for every benchmark run.
    keys.add('KeyW');
    keys.add('KeyD');
  }

  updateInput(dt);
  const rays = castRays(viewAngle, rayDensity);
  renderMap(ctx, rays, window.innerWidth, window.innerHeight);
  renderScene(ctx, rays, window.innerWidth, window.innerHeight);

  if (bench !== null) {
    bench.frames++;
    if (bench.frames >= BENCH_FRAMES) {
      const ms = performance.now() - bench.t0;
      benchEl.textContent = 'BENCH: ' + BENCH_FRAMES + ' updates in ' + ms.toFixed(1) + ' ms';
      keys.delete('KeyW');
      keys.delete('KeyD');
      bench = null;
    }
  } else {
    const fpsText = tickFps(fps, now);
    if (fpsText !== null) {
      fpsEl.textContent = fpsText;
    }
  }

  updateFormulaText(formulaEl, window.innerHeight - Math.floor(window.innerHeight / 2));
  requestAnimationFrame(frame);
}

function wireShiftNudge(el: HTMLInputElement): void {
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!e.shiftKey) return; // native step="0.1" handles the plain arrows
    e.preventDefault();
    const step = e.key === 'ArrowUp' ? 0.01 : -0.01;
    const v = (parseFloat(el.value) || 0) + step;
    el.value = String(Math.round(v * 100) / 100);
    el.dispatchEvent(new Event('input'));
  });
}

function wireFormulaInput(el: HTMLInputElement, key: keyof typeof formula): void {
  el.addEventListener('input', () => {
    formula[key] = Number(el.value);
  });
  wireShiftNudge(el);
}

// --- Input listeners ---
angleInput.addEventListener('input', () => {
  viewAngle = Number(angleInput.value);
});
densityInput.addEventListener('input', () => {
  rayDensity = Number(densityInput.value);
});
wireShiftNudge(angleInput);
wireShiftNudge(densityInput);
wireFormulaInput(document.getElementById('focalInput') as HTMLInputElement, 'focal');
wireFormulaInput(document.getElementById('powInput') as HTMLInputElement, 'pow');
wireFormulaInput(document.getElementById('fishInput') as HTMLInputElement, 'fish');
wireFormulaInput(document.getElementById('maxhInput') as HTMLInputElement, 'maxh');
window.addEventListener('resize', resize);

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code !== 'KeyB') return;
  if (e.target instanceof HTMLInputElement) return; // allow typing in inputs
  if (bench !== null) return;                       // a run is in progress
  bench = { frames: 0, t0: performance.now() };
  benchEl.textContent = 'BENCH: running ' + BENCH_FRAMES + ' updates...';
});

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement) return; // allow typing in inputs
  if (e.key === '+') zoom.value = clamp(zoom.value * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
  if (e.key === '-') zoom.value = clamp(zoom.value / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);
});

initInput();
resize();
requestAnimationFrame(frame);
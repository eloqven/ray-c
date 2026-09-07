// =============================================================
// 2Ray-C — Prototype A: fps module.
// On-screen FPS counter; uncapped render loop (no throttle).
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

export interface FpsState {
  frames: number;
  t: number;
  last: number;
}

export function createFpsState(): FpsState {
  return { frames: 0, t: performance.now(), last: performance.now() };
}

// Tick the counter; returns true when the display should update.
export function tickFps(state: FpsState, now: number): boolean {
  state.last = now;
  state.frames++;
  if (now - state.t >= 500) {
    state.frames = 0;
    state.t = now;
    return true;
  }
  return false;
}

export function fpsText(state: FpsState, now: number): string {
  return 'FPS: ' + Math.round((state.frames * 1000) / (now - state.t));
}

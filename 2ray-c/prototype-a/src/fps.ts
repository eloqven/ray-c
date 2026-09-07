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

// Tick the counter. Returns the FPS text when the display should update
// (every >=500ms), else null. The text is computed from the PRE-RESET state
// before the counter/timestamp are reset — mirroring prototype-c exactly:
//   fps.frames++;
//   if (now - fps.t >= 500) {
//     fpsEl.textContent = 'FPS: ' + Math.round((fps.frames * 1000) / (now - fps.t));
//     fps.frames = 0;
//     fps.t = now;
//   }
export function tickFps(state: FpsState, now: number): string | null {
  state.last = now;
  state.frames++;
  if (now - state.t >= 500) {
    const text = 'FPS: ' + Math.round((state.frames * 1000) / (now - state.t));
    state.frames = 0;
    state.t = now;
    return text;
  }
  return null;
}
---
title: 'FPS counter shows "FPS: NaN" in prototype-a'
date: 2026-09-07
category: ui-bugs
module: 2ray-c/prototype-a
problem_type: ui_bug
component: frontend
symptoms:
  - "On-screen FPS counter displays 'FPS: NaN' instead of a number"
  - "Gameplay and rendering otherwise behave correctly (NaN is confined to the counter)"
root_cause: logic_error
resolution_type: code_fix
severity: low
tags: [fps, nan, frame-timing, prototype-a, canvas2d]
---

# FPS counter shows "FPS: NaN" in prototype-a

## Problem
The on-screen FPS counter in `2ray-c/prototype-a` displayed `FPS: NaN` instead of a real frames-per-second number. The counter logic reset its own frame/timestamp state *before* the caller computed the display text, so the text was computed from a just-reset state (`0 * 1000 / 0` = `NaN`).

## Symptoms
- On-screen FPS counter renders `FPS: NaN` (defect id U-009/TS-006, caught by external review of commit `9ada3c0` on `eloqven/ray-c` issue #1). Both `9ada3c0` and the fix `f8b9c03` are reachable from the pushed `origin/experiment/2ray-c` branch (no merge to `origin/main`; there is no PR — delivery was reviewed through the issue's comment thread).
- Gameplay, world, ray-casting, and rendering are unaffected — the NaN is confined to the counter text.

## What Didn't Work
- The initial implementation: `tickFps` returned a boolean ("display should update?") and reset `state.frames = 0` / `state.t = now` *inside* `tickFps` when the 500 ms window elapsed, then `main.ts` called a separate `fpsText(state, now)` on the *already-reset* state. Because the reset happened before the read, the naive port produced `frames * 1000 / (now - t)` = `0 * 1000 / 0` = `NaN` — type-safe, builds clean, entirely wrong on screen.
- The blind spot was structural: splitting "advance the counter" (mutates + resets) from "render the text" (reads state) meant the render step read post-reset values, and nothing in the type system or build caught the ordering violation.

## Solution
Made `tickFps` the single owner of compute-and-reset ordering: it computes the FPS text from the **pre-reset** state, then resets, then returns the text (`string | null`). `main.ts` renders exactly what it returns. This mirrors `prototype-c` (the reference) line-for-line.

**Pre-fix** (`2ray-c/prototype-a/src/fps.ts`, `tickFps` + separate `fpsText`):

```ts
export function tickFps(state: FpsState, now: number): boolean {
  state.last = now;
  state.frames++;
  if (now - state.t >= 500) {
    state.frames = 0;      // reset BEFORE text computed
    state.t = now;
    return true;
  }
  return false;
}

export function fpsText(state: FpsState, now: number): string {
  return 'FPS: ' + Math.round((state.frames * 1000) / (now - state.t)); // sees frames=0, now-t=0
}
```

Caller (`2ray-c/prototype-a/src/main.ts:34-45`, pre-fix):

```ts
if (tickFps(fps, now)) {
  fpsEl.textContent = fpsText(fps, now); // 0/0 -> NaN
}
```

**Post-fix** (`2ray-c/prototype-a/src/fps.ts:26-36`, current HEAD):

```ts
export function tickFps(state: FpsState, now: number): string | null {
  state.last = now;
  state.frames++;
  if (now - state.t >= 500) {
    const text = 'FPS: ' + Math.round((state.frames * 1000) / (now - state.t)); // pre-reset read
    state.frames = 0;
    state.t = now;
    return text;
  }
  return null;
}
```

Caller (`2ray-c/prototype-a/src/main.ts:40-43`, current HEAD):

```ts
const fpsText = tickFps(fps, now);
if (fpsText !== null) {
  fpsEl.textContent = fpsText;
}
```

**Reference ordering** — `2ray-c/prototype-c/main.js:191-195` computes the text before resetting the counters; the fix reproduces that exact ordering:

```js
fps.frames++;
if (now - fps.t >= 500) {
  fpsEl.textContent = 'FPS: ' + Math.round((fps.frames * 1000) / (now - fps.t));
  fps.frames = 0;
  fps.t = now;
}
```

## Why This Works
`tickFps` now computes the display text from the pre-reset counter state, which is the only state that contains a meaningful frame count and elapsed time. Resetting after the read keeps subsequent 500 ms windows starting from zero, exactly like the reference. Returning `string | null` instead of a boolean forces the caller to render the computed value rather than re-deriving it from post-reset state — the coupling that caused the NaN is gone at the API level. TypeScript cannot catch this class of bug (it is a state-ordering error, not a type error), so the fix relies on mirroring the reference's ordering and on the parity harness asserting the *value*, not just absence of exceptions.

## Prevention
- **Mirror the reference's internal ordering when porting.** For counter/timer modules ported from a reference implementation, the order of "read/compute" vs "mutate/reset" is part of the contract. Compare the ported function's statement order against the reference, not just its inputs/outputs and types.
- **Don't split compute-from-reset into two functions.** A function that resets its own state should compute and return the value from the pre-reset state in the same call — splitting "advance+reset" from "read" invites reading post-reset values.
- **Assert the displayed/returned value, not just "no exception".** The parity harness's TS-006 check asserts the counter text parses as a *finite* number (`PASS (FPS: 120)`), which catches `0/0 = NaN` that a mere "did it throw" assertion would miss. See `2ray-c/prototype-a/PARITY-CHECK.md:34-36`.
- **Review pairs, not files.** For clean-room reimplementations, review the ported subsystem side-by-side against the reference for behavioral ordering differences — this defect surfaced exactly there (external review against `2ray-c/prototype-c/main.js`).

## Related Issues
- `eloqven/ray-c` issue #1 — full review thread: defect raised (comment 5574150829: U-009/TS-006), fix delivered (comment 5574232910), independently verified and approved (comment 5574332563: "FIX VERIFIED - prototype-a APPROVED").
- Commits: `9ada3c0` (buggy delivery), `f8b9c03` (fix); both reachable from the pushed `origin/experiment/2ray-c` branch at HEAD (no PR — this delivery was reviewed through issue #1's comment thread).
- Parity evidence: `2ray-c/prototype-a/PARITY-CHECK.md` (TS-006 row), `~/.handoff-artifacts/ts-004-005-006.txt`.
# 2Ray-C — VM Agent Handoff Prompt

Paste this whole file into the opencode session on the Azure VM (VM2, `vm-opencode-247`, Ubuntu).
Read everything before acting. You are the remote build agent; the host (local Sisyphus)
is your coordinator/reviewer, the project owner reviews alongside.

---

## Mission

Clone `https://github.com/eloqven/ray-c`, work on branch **`experiment/2ray-c`**,
and complete the **2Ray-C** prototype pair to the spec in the repo:

- `docs/plans/plan-2ray-c-2026-09-07.md` — the authoritative spec (U-IDs, tests TS-001..TS-007, DoD)
- `docs/plans/2ray-c-brainstorm.md` — origin notes

## Current state (as of push `ceaaede`)

- `2ray-c/prototype-c/` — **DONE**: plain JS, zero deps, opens by double-clicking `index.html`. This is the behavioral reference.
- `2ray-c/prototype-a/` — **MISSING**: must be built by you.

## Your task

1. Build `2ray-c/prototype-a/` — **TypeScript + Canvas2D + Vite** (dev dep only, no runtime deps).
2. Make it **behaviorally identical** to prototype-c: same startup state, inputs, controls,
   rendering, monochrome palette, uncapped FPS — parity per TS-001..TS-007. Split into small
   TypeScript modules (world / particle+raycast / render / input / main); compile-clean under strict mode.
3. Reuse **no** code files from `2ray-c/prototype-c/` and **no** v1/v2 p5-era files — clean-room
   reimplementation of the same behavior. Reading them for reference is allowed.

## Hard requirements (from the plan + owner)

- Exactly two controls, **positive-number inputs only, NO sliders, NO validation/clamping rails**.
- WASD only: W/S move, A/D rotate. **No sprint, no Shift behavior, no collision pushback** —
  player position clamped to the world box.
- World: 4 border walls (box) + **exactly 1 random interior wall, re-rolled on every refresh**.
- Top map panel: white walls/rays/circle on black. Bottom cast panel: white columns on black.
- FPS counter on screen; render loop uncapped (no artificial throttle) — and must use delta-time
  movement so speed is frame-rate independent (match prototype-c exactly).
- Defaults: view angle 60, rays/degree 2, player centered.

## Verification (you are headless — do it like this)

- `node --check` on all JS; `npm install` + `tsc --noEmit` (or `vite build`) for prototype-a must pass.
- Spin prototype-a with `npm run dev -- --port 4174` and prototype-c with a static server
  (`python3 -m http.server`), both in the background.
- If Playwright/Chromium is available: screenshot **both** panels of both prototypes at the same
  world seed/angle, save under `~/.handoff-artifacts/`, and confirm console error-free.
  If browser tooling is unavailable, verify via logic: ray-cast math is deterministic —
  port the cast pipeline as a small node script and compare distances/columns between both
  implementations programmatically instead. Do not claim visual parity without some evidence.
- Run through TS-001..TS-007 explicitly and record each result.

## Commit discipline

- Work only inside `2ray-c/` (and `docs/` only if strictly needed). Do **not** touch v1/v2 files
  (`index.html`, `sketch.js`, `boundary.js`, `particle.js`, `index_v2.html`, `sketch_v2.js`,
  `styles_v2.css`, the `index_*`/`sketch_snapshot*` files that are gitignored-untracked leftovers).
- Commit atomically on `experiment/2ray-c` with clear messages, push to origin. No squashing history, no force-push.

## Report back (in your final message)

1. Files added/changed (paths).
2. Per U-ID: done / partial / skipped — U-001..U-013, U-101..U-104.
3. TS-001..TS-007 results + evidence (screenshot paths or the parity script output).
4. Any deviation from plan or from prototype-c behavior, with the reason.
5. Anything needing human eyes (aesthetic calls) — flag it explicitly.

## Constraints

- You may consult code in the repo freely, but do not redesign scope. If something in the plan
  is ambiguous, follow prototype-c's behavior — it is the reference — and note it.
- Keep the prototype minimal per the plan's Out-of-scope list: no colors beyond white-on-black,
  no sliders, no extra features, no UI frameworks, no tests frameworks.

## Session rule (persistent, written down)

- NEVER use/impersonate another model persona, or invoke another provider's model ID,
  without explicit confirmation from the project owner first.
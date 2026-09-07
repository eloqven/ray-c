# 2Ray-C — Prototype A Parity Check (2026-09-07)

Branch: `experiment/2ray-c` · HEAD seeded from plan `docs/plans/plan-2ray-c-2026-09-07.md`
Reference: `2ray-c/prototype-c/` (plain JS, no build)

## Build evidence

- `tsc --noEmit` — PASS (strict mode)
- `vite build` — PASS (dist generated, no runtime deps; vite + typescript are devDeps only)
- `node --check` on `prototype-c/main.js` — PASS

## Programmatic parity (no browser tooling available on build host)

Both prototypes' cast pipelines were exercised against **identical seeded worlds**
(4 border walls + 1 interior wall from the same seeded `Math.random`), across
6 scenarios. Ray distances and column heights matched exactly (delta = 0):

| Scenario | rays C/A | dist delta | columns C/A | match |
|---|---|---|---|---|
| TS-003 nominal 60/2 centered | 121 / 121 | 0 | 121 / 121 | PASS |
| TS-003 sparse density 0.5 | 31 / 31 | 0 | 31 / 31 | PASS |
| TS-003 wide FOV 478 | 957 / 957 | 0 | 361 / 361 | PASS |
| corner player 214/2 | 429 / 429 | 0 | 360 / 360 | PASS |
| near wall 90/1 | 91 / 91 | 0 | 91 / 91 | PASS |
| wide 200/8 | 1601 / 1601 | 0 | 1441 / 1441 | PASS |

Evidence: `~/.handoff-artifacts/parity-a-vs-c.txt` (host-side, not committed).

## TS-004..TS-006 (real compiled modules, not re-typed math)

- TS-004 — borders fixed, exactly 1 interior wall, wall re-rolled per refresh: PASS
- TS-005 — `update()` from `src/input.ts` keeps player in-box (clamped at
  `PLAYER_RADIUS`), heading wraps, no pushback: PASS
- TS-006 — real `tickFps` from `src/fps.ts` ticks 4x over ~2s (uncapped rAF):
  PASS

Evidence: `~/.handoff-artifacts/ts-004-005-006.txt`.

## U-ID coverage (prototype A)

U-001..U-013, U-101, U-103, U-104 — implemented; verified via parity + module
checks above. U-102 refers to prototype C (runs by direct file open, verified
served over HTTP).

## Deviation note

None from prototype-c behavior. One structural difference is intentional per
spec: prototype A is split into TypeScript modules (`world` / `raycast` /
`input` / `render` / `fps` / `main`), clean-room, no files copied from
prototype-c.
# 2Ray-C — Brainstorm (Requirements-Only Unified Plan)

Status: brainstorm complete → feeds `/ce-plan`
Author: Andrei + host (inline Q&A, one question at a time)
Date: 2026-09-07
Branch: `experiment/2ray-c`

## Problem statement

Rebuild the ray-casting playground ground-up as **2Ray-C**: keep only the core
essential experience — the two stacked views, two numeric controls, and raw
monochrome rendering — and evaluate two modern technology stacks side by side
(plain-JS global-sketch style (no build, no deps) vs. a modular TypeScript
toolchain) with
identical, minimal scope so the stack decision is an apples-to-apples comparison.

## Goals and success metrics

- G-01: Two runnable prototypes implementing the SAME minimal feature scope
  - Prototype A: TypeScript + Canvas2D + Vite
  - Prototype C: plain JavaScript, no build step, no dependencies
- G-02: Each prototype opens and runs at uncapped frame rate with an on-screen FPS counter
- G-03: Scope parity — a feature checklist a human can tick identically in both
- G-04: Clean-room minimalism — nothing beyond the listed scope (no colors, no
  effects, no persistence, no audio, no wall controls)

## Key requirements

### Functional

- R-01: Two stacked screens (top map / bottom ray-cast view)
- R-02: Top screen renders the world map: white wall lines, white rays from the
  player, white circle player, black background
- R-03: Bottom screen renders the ray-cast view: white vertical columns on
  black; column height driven by hit distance
- R-04: Exactly two controls, as positive-number inputs (NO sliders):
  - view angle (field of view)
  - ray density (rays per degree)
- R-05: No validation/clamping rails on those inputs — free positive numbers,
  whatever is typed is rendered (garbage in = garbage out)
- R-06: World consists of the 4 border walls (the box) + exactly 1 random
  interior wall, re-rolled on every page refresh
- R-07: Movement: W/S move forward/backward, A/D rotate. No sprint.
- R-08: FPS counter displayed on screen (white text)
- R-09: No FPS cap — uncapped render loop
- R-10: Monochrome only: black background, white lines/circle/columns.
  No colors, gradients, textures, shading, or post-effects

### Non-functional

- NFR-01: Prototype A — TypeScript, Canvas2D, Vite dev tooling, no runtime deps
- NFR-02: Prototype C — plain JS, no build, no deps, double-click-openable
- NFR-03: Same behavior across both prototypes (comparability)
- NFR-04: Structure/style left to the implementer's discretion ("lots of freedom")

## Constraints

- C-01: No extra features beyond the listed scope (deliberate minimalism)
- C-02: Built without subagents (single-model budget)
- C-03: Inspired by ray-c, not a line-for-line port — structure may differ per stack

## Open questions / assumptions (vetoable at /ce-plan)

- A-01 (assumption): player movement is bounded to the world box (v2 behavior),
  but there is no wall-collision pushback — rays still intersect walls
- A-02 (assumption): default input values on load — angle 60, density 2
  (v1/v2 defaults)
- A-03 (assumption): FPS counter placement top corner — implementer's choice
- OQ-01 (risk): Prototype A needs `npm install` (network); Prototype C has zero
  friction — DX friction is part of what we're comparing

## Stakeholders

- Andrei — owner, tester, final stack decision
- Host — engineer (inline, no subagents)

## Parked follow-up (post-2Ray-C, do not forget)

- Tool/plugin/terminal add-on (WARP-like): press a key → speech-to-text
  transcription lands directly inside the text/command input field.
  Motivation: Andrei types slowly, runs many writing tasks in parallel.
  Remind him after 2Ray-C ships.
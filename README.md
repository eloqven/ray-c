# ray-c

Small browser ray-casting playground built with `p5.js`.

This repo currently documents and ships the active `v1` app:
- `index.html`
- `sketch.js`
- `boundary.js`
- `particle.js`

`v2` exists locally as experimental work and is intentionally not part of this write-up yet.

## What it does

- full-screen split view playground
- faux-3D top map with extruded walls
- ray-cast bottom view
- movable player with live rays
- random interior walls with adjustable count and scale
- catnip pickups with temporary speed boost
- local save with `Ctrl+S`
- ambient cat purr track switching from wall cat icons

## How to use

Open `index.html` in the browser.

Main controls:
- `W` / `S` move
- `A` / `D` rotate
- `Shift` move 50% faster
- `H` toggle HUD
- `R` reset to startup state
- `Ctrl+S` save current settings to `localStorage`
- `C` toggle the hidden bottom-wall color controls

Quick parameter keys:
- `1` field of view
- `2` wall count
- `3` fish-eye correction
- `4` ray density
- `5` depth pad X
- `6` depth pad Y
- `7` catnip count
- `8` interior wall scale
- `9` wall roundness
- `0` top depth

Extra HUD controls:
- split-height slider adjusts top/bottom panel heights
- hover the FPS badge to reveal `AVG / MIN / MAX`, speed, and FPS cap
- click the cat icons on the outer walls to switch purr tracks

## Hidden color controls

Press `C` to show six RGB sliders on the right:
- near wall `R/G/B`
- far wall `R/G/B`

These affect the bottom ray-cast wall colors from close range to far distance.

## Current technical highlights

- thick walls with real wall width, not single lines
- top map now uses faux height extrusion instead of plain flat walls
- top view supports rays + player overlay again
- top wall face selection was corrected so the player-facing side is the visible one
- same-height top wall overlaps were reduced by separating front faces from top caps in render order
- world scaling survives browser resize / zoom changes much better than before
- settings, audio choice, pickups, and most HUD values persist locally

## Notes

- audio files live in `assets/audio/`
- the app is meant to be tweaked live from the HUD
- if you want screenshots added into this README later, place them in the repo and wire them in

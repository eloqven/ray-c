// =============================================================
// 2Ray-C — Prototype A: formula module.
// Tunable bottom-view projection (focal / pow / fish / maxh) and
// the live formula readout text. Defaults reproduce the original
// formula exactly: colH = min(renderH, (renderH * focal) / perp).
// Behavior mirror of prototype-c (clean-room, TS).
// =============================================================

export interface Formula {
  focal: number;  // focal factor (default 1.5)
  pow: number;    // exponent on the perpendicular distance (default 1)
  fish: number;   // fisheye correction amount on the ray offset (default 1)
  maxh: number;   // max column height as a fraction of renderH (default 1)
}

export const formula: Formula = { focal: 1.5, pow: 1, fish: 1, maxh: 1 };

// Tuned projection:
//   perp = dist * cos(offset * fish)
//   bare = (renderH * focal) / perp^pow
//   colH = min(renderH * maxh, bare)
export function columnHeight(dist: number, offset: number, renderH: number): number {
  const perp = dist * Math.cos(offset * formula.fish);
  if (perp <= 0) return 0;
  const bare = (renderH * formula.focal) / Math.pow(perp, formula.pow);
  const h = Math.min(renderH * formula.maxh, bare);
  return h <= 0 ? 0 : h;
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export function updateFormulaText(el: HTMLDivElement, renderH: number): void {
  const text =
    'colH = min( R\u00B7maxh , (R\u00B7focal) / (d\u00B7cos(\u03C6\u00B7fish))^pow )\n' +
    'R=' + (renderH | 0) +
    '  focal=' + fmt(formula.focal) +
    '  pow=' + fmt(formula.pow) +
    '  fish=' + fmt(formula.fish) +
    '  maxh=' + fmt(formula.maxh);
  if (el.textContent !== text) el.textContent = text;
}
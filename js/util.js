// Small shared helpers: colour parsing / interpolation and misc utilities.
// Kept dependency-free so every other module can import from here cheaply.

/** Parse "#rgb" or "#rrggbb" (or an rgb()/name via a canvas fallback) to [r,g,b] 0..255. */
export function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex;
  let s = String(hex).trim();
  if (s[0] === '#') s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 6) {
    const n = parseInt(s, 16);
    if (!Number.isNaN(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Fallback: let the browser resolve names / rgb() strings.
  const cv = hexToRgb._cv || (hexToRgb._cv = document.createElement('canvas'));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillStyle = String(hex);
  const m = /^#([0-9a-f]{6})$/i.exec(ctx.fillStyle);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return [0, 0, 0];
}

/** "#rrggbb" from an [r,g,b] triple. */
export function rgbToHex([r, g, b]) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

/** Linear interpolate two [r,g,b] triples, t in 0..1. */
export function lerpRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Sample a multi-stop gradient (array of [r,g,b]) at t in 0..1. */
export function gradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return lerpRgb(stops[i], stops[i + 1], x - i);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Debounce a function by `ms` (trailing edge). */
export function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

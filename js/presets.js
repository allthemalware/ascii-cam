// "Machine" presets: cohesive bundles of palette + ramp + colour mode + CRT
// effects, in the spirit of cool-retro-term profiles. Selecting one sets every
// underlying control; the user can then tweak individual knobs freely.

/** CRT parameters are all 0..1 and interpreted by crt.js / renderer.js. */
export const DEFAULT_CRT = {
  scanlines: 0.35,   // horizontal scanline darkness
  scanScroll: 0,     // 0/1: slowly drift the scanlines
  glow: 0.35,        // phosphor bloom around glyphs
  curvature: 0.12,   // screen-face rounding / glass bulge
  flicker: 0.05,     // brightness jitter
  aberration: 0.12,  // red/cyan chromatic split
  vignette: 0.4,     // edge darkening
  noise: 0.05,       // animated static
  trails: 0.0,       // phosphor persistence (motion ghosting)
  grid: 0.0,         // LCD pixel-grid overlay
};

export const MACHINES = {
  olive: {
    label: 'Olive Terminal',
    palette: 'oliveMuted', ramp: 'ascii', colorMode: 'phosphor',
    crt: { scanlines: 0.35, scanScroll: 0, glow: 0.35, curvature: 0.12, flicker: 0.05, aberration: 0.12, vignette: 0.4, noise: 0.05, trails: 0.0, grid: 0.0 },
  },
  crt: {
    label: 'Green CRT Monitor',
    palette: 'green', ramp: 'ascii', colorMode: 'phosphor',
    crt: { scanlines: 0.5, scanScroll: 1, glow: 0.5, curvature: 0.22, flicker: 0.08, aberration: 0.2, vignette: 0.5, noise: 0.06, trails: 0.12, grid: 0.0 },
  },
  amberTerm: {
    label: 'Amber Terminal',
    palette: 'amber', ramp: 'ascii', colorMode: 'phosphor',
    crt: { scanlines: 0.45, scanScroll: 0, glow: 0.55, curvature: 0.16, flicker: 0.06, aberration: 0.1, vignette: 0.45, noise: 0.05, trails: 0.1, grid: 0.0 },
  },
  oldtv: {
    label: 'Old TV (colour)',
    palette: 'vt220', ramp: 'asciiLong', colorMode: 'source',
    crt: { scanlines: 0.6, scanScroll: 1, glow: 0.4, curvature: 0.3, flicker: 0.16, aberration: 0.5, vignette: 0.6, noise: 0.2, trails: 0.15, grid: 0.0 },
  },
  gameboy: {
    label: 'Game Boy LCD',
    palette: 'gameboy', ramp: 'blocksShade', colorMode: 'phosphor',
    crt: { scanlines: 0.0, scanScroll: 0, glow: 0.0, curvature: 0.05, flicker: 0.0, aberration: 0.0, vignette: 0.2, noise: 0.0, trails: 0.08, grid: 0.55 },
  },
  matrix: {
    label: 'Matrix',
    palette: 'matrix', ramp: 'katakana', colorMode: 'phosphor',
    crt: { scanlines: 0.3, scanScroll: 1, glow: 0.6, curvature: 0.1, flicker: 0.05, aberration: 0.15, vignette: 0.5, noise: 0.06, trails: 0.28, grid: 0.0 },
  },
  clean: {
    label: 'Clean (no CRT)',
    palette: 'oliveMuted', ramp: 'ascii', colorMode: 'phosphor',
    crt: { scanlines: 0.0, scanScroll: 0, glow: 0.12, curvature: 0.0, flicker: 0.0, aberration: 0.0, vignette: 0.15, noise: 0.0, trails: 0.0, grid: 0.0 },
  },
};

export const DEFAULT_MACHINE = 'olive';

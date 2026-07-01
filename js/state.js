// Settings shape + localStorage persistence. Persistence is client-side only:
// preferences live in the user's browser, never on a server.

import { DEFAULT_PALETTE } from './palettes.js';
import { DEFAULT_RAMP } from './ramps.js';
import { DEFAULT_CRT, DEFAULT_MACHINE } from './presets.js';

const STORAGE_KEY = 'ascii-cam:settings:v1';

export function defaultSettings() {
  return {
    machine: DEFAULT_MACHINE,
    palette: DEFAULT_PALETTE,
    colors: null,          // {bg,dim,fg,bright} custom override, or null = use palette
    colorMode: 'phosphor', // 'mono' | 'phosphor' | 'source'
    ramp: DEFAULT_RAMP,
    customRamp: '',        // non-empty overrides the selected ramp
    invert: false,
    resolution: 120,       // number of columns
    charAspect: 0.5,       // cell width / height correction
    dither: false,
    mirror: true,          // horizontal flip (mirror-like webcam default)
    fit: 'cover',          // 'cover' | 'contain'
    fps: 30,
    crt: { ...DEFAULT_CRT },
  };
}

export function loadSettings() {
  const base = defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return { ...base, ...saved, crt: { ...base.crt, ...(saved.crt || {}) } };
  } catch (_) {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {
    /* storage may be unavailable (private mode / disabled) — non-fatal */
  }
}

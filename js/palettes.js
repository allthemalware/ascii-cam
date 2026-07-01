// Colour presets modelled on historic gaming / PC displays.
// Each palette is four stops used across the app:
//   bg     screen background (darkest)
//   dim    low-luminance phosphor
//   fg     the signature "on" colour (used as the monochrome default)
//   bright hot highlight for the brightest cells / bloom
// Every value is user-overridable in the UI; these are just the starting points.

export const PALETTES = {
  oliveMuted: { label: 'Muted Olive',      bg: '#0d100b', dim: '#4a5535', fg: '#8a9a5b', bright: '#b9c78a' },
  gameboy:    { label: 'Game Boy DMG',     bg: '#0f380f', dim: '#306230', fg: '#8bac0f', bright: '#9bbc0f' },
  amber:      { label: 'Amber P3',         bg: '#140a00', dim: '#7a3d00', fg: '#ffb000', bright: '#ffd489' },
  green:      { label: 'Green P1',         bg: '#001200', dim: '#116611', fg: '#33ff33', bright: '#c7ffc7' },
  appleII:    { label: 'Apple II',         bg: '#000600', dim: '#1f8a2f', fg: '#33ff66', bright: '#c8ffd6' },
  cga:        { label: 'IBM CGA',          bg: '#000000', dim: '#0000aa', fg: '#55ffff', bright: '#ffffff' },
  c64:        { label: 'Commodore 64',     bg: '#40318d', dim: '#7869c4', fg: '#b0a4e3', bright: '#ffffff' },
  hercules:   { label: 'Hercules Amber',   bg: '#100800', dim: '#8a5a00', fg: '#ffcc44', bright: '#fff0c0' },
  vt220:      { label: 'DEC VT220',        bg: '#0a0b0a', dim: '#6f7568', fg: '#cfd6c0', bright: '#ffffff' },
  plasma:     { label: 'Plasma Orange',    bg: '#180400', dim: '#a03400', fg: '#ff6a1f', bright: '#ffc08a' },
  ibm5151:    { label: 'IBM 5151 Green',   bg: '#031703', dim: '#1c7a1c', fg: '#39d739', bright: '#a9ffa9' },
  matrix:     { label: 'Matrix',           bg: '#000000', dim: '#003b00', fg: '#00ff41', bright: '#ccffcc' },
  mono:       { label: 'Paper White',      bg: '#111111', dim: '#777777', fg: '#e8e8e8', bright: '#ffffff' },
};

export const DEFAULT_PALETTE = 'oliveMuted';

/** Resolve a palette by key, falling back to the default. */
export function getPalette(key) {
  return PALETTES[key] || PALETTES[DEFAULT_PALETTE];
}

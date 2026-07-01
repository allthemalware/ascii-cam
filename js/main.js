// App entry point: build the controls, wire them to the renderer / CRT / sources
// / recorder, and run the render loop. All state lives in `settings` and is
// persisted to localStorage — nothing is ever sent anywhere.

import { RAMPS } from './ramps.js';
import { PALETTES, getPalette } from './palettes.js';
import { MACHINES } from './presets.js';
import { AsciiRenderer } from './renderer.js';
import { applyCRT, tickFlicker } from './crt.js';
import { SourceManager } from './sources.js';
import { Recorder, downloadBlob } from './recorder.js';
import { downloadPNG, copyText } from './export.js';
import { loadSettings, saveSettings } from './state.js';
import { debounce, rgbToHex, hexToRgb } from './util.js';

const $ = (id) => document.getElementById(id);

const settings = loadSettings();

const video = $('video');
const canvas = $('output');
const screen = $('screen');

const renderer = new AsciiRenderer(canvas);
const sources = new SourceManager(video);
const recorder = new Recorder({ maxMs: 30000, bitsPerSecond: 2_000_000 });

let flickerAmp = 0;
const saveDebounced = debounce(() => saveSettings(settings), 300);

// ------------------------------------------------------------------ helpers

/** Effective four-stop colours: custom override if set, else the palette. */
function colorsOf() {
  if (settings.colors) return settings.colors;
  const p = getPalette(settings.palette);
  return { bg: p.bg, dim: p.dim, fg: p.fg, bright: p.bright };
}

/** Effective ramp string. */
function rampChars() {
  if (settings.ramp === 'custom') {
    const c = (settings.customRamp || '').trim();
    return c.length >= 2 ? c : ' .:-=+*#%@';
  }
  return (RAMPS[settings.ramp] || RAMPS.ascii).chars;
}

function fillSelect(el, entries, selected) {
  el.innerHTML = '';
  for (const [value, label] of entries) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (value === selected) o.selected = true;
    el.appendChild(o);
  }
}

// ------------------------------------------------------------------ apply

function applyRendererConfig() {
  renderer.setColors(colorsOf());
  renderer.setRamp(rampChars(), settings.invert);
  renderer.setColorMode(settings.colorMode);
  renderer.setOptions({
    dither: settings.dither, charAspect: settings.charAspect,
    resolution: settings.resolution, fit: settings.fit, mirror: settings.mirror,
  });
  renderer.setCrt(settings.crt);
}

function applyLayout() {
  const w = screen.clientWidth || 640;
  const h = screen.clientHeight || 480;
  renderer.layout(w, h);
  screen.style.setProperty('--cell-size', renderer.cellCssSize.toFixed(2) + 'px');
}

function applyPresentation() {
  ({ flicker: flickerAmp } = applyCRT({ root: screen, canvas }, settings.crt));
  // Theme the control panel to match the current palette.
  const c = colorsOf();
  const root = document.documentElement.style;
  root.setProperty('--ui-bg', c.bg);
  root.setProperty('--ui-fg', c.fg);
  root.setProperty('--ui-dim', c.dim);
  root.setProperty('--ui-bright', c.bright);
}

// Colour / ramp / effect changes: no canvas resize needed (the atlas rebuilds
// itself via dirty flags in the renderer setters).
function applyAll() {
  applyRendererConfig();
  applyPresentation();
  saveDebounced();
}

// Geometry changes (resolution / char-aspect / fit / container resize) need the
// grid + backing store recomputed.
function applyGeometry() {
  applyRendererConfig();
  applyLayout();
  applyPresentation();
  saveDebounced();
}

// ------------------------------------------------------------------ UI sync

function syncUI() {
  $('machineSelect').value = settings.machine;
  $('paletteSelect').value = settings.palette;
  $('colorModeSelect').value = settings.colorMode;
  $('rampSelect').value = settings.ramp;
  $('customRamp').value = settings.customRamp || '';
  $('fitSelect').value = settings.fit;
  $('invert').checked = settings.invert;
  $('dither').checked = settings.dither;
  $('mirror').checked = settings.mirror;

  const c = colorsOf();
  $('colBg').value = rgbToHex(hexToRgb(c.bg));
  $('colDim').value = rgbToHex(hexToRgb(c.dim));
  $('colFg').value = rgbToHex(hexToRgb(c.fg));
  $('colBright').value = rgbToHex(hexToRgb(c.bright));

  setRange('resolution', settings.resolution);
  setRange('charAspect', settings.charAspect);
  setRange('fps', settings.fps);
  for (const k of CRT_KEYS) setRange('crt_' + k, settings.crt[k]);
}

function setRange(id, value) {
  const el = $(id);
  if (!el) return;
  const scale = Number(el.dataset.scale || 1);
  el.value = String(value * scale);
  const out = $(id + 'Val');
  if (out) out.textContent = el.dataset.pct ? Math.round(value * 100) + '%' : String(value);
}

// ------------------------------------------------------------------ wiring

const CRT_KEYS = ['scanlines', 'glow', 'curvature', 'flicker', 'aberration', 'vignette', 'noise', 'trails', 'grid'];

function buildControls() {
  fillSelect($('machineSelect'), Object.entries(MACHINES).map(([k, m]) => [k, m.label]), settings.machine);
  fillSelect($('paletteSelect'), Object.entries(PALETTES).map(([k, p]) => [k, p.label]), settings.palette);
  fillSelect($('rampSelect'),
    [...Object.entries(RAMPS).map(([k, r]) => [k, r.label]), ['custom', 'Custom…']],
    settings.ramp);
  fillSelect($('colorModeSelect'), [
    ['mono', 'Monochrome (single colour)'],
    ['phosphor', 'Phosphor (theme gradient)'],
    ['source', 'Full colour (from source)'],
  ], settings.colorMode);
  fillSelect($('fitSelect'), [['cover', 'Cover (fill)'], ['contain', 'Contain (letterbox)']], settings.fit);
}

function wireEvents() {
  // --- machine preset: sets everything ---
  $('machineSelect').addEventListener('change', (e) => {
    const m = MACHINES[e.target.value];
    if (!m) return;
    settings.machine = e.target.value;
    settings.palette = m.palette;
    settings.colors = null;
    settings.ramp = m.ramp;
    settings.colorMode = m.colorMode;
    settings.crt = { ...settings.crt, ...m.crt };
    syncUI();
    applyAll();
  });

  // --- palette + colours ---
  $('paletteSelect').addEventListener('change', (e) => {
    settings.palette = e.target.value;
    settings.colors = null; // switch back to palette colours
    syncUI();
    applyAll();
  });
  const colorInput = (id, key) => $(id).addEventListener('input', (e) => {
    const c = { ...colorsOf() };
    c[key] = e.target.value;
    settings.colors = c;
    applyAll();
  });
  colorInput('colBg', 'bg');
  colorInput('colDim', 'dim');
  colorInput('colFg', 'fg');
  colorInput('colBright', 'bright');
  $('btnResetColors').addEventListener('click', () => {
    settings.colors = null;
    syncUI();
    applyAll();
  });
  $('colorModeSelect').addEventListener('change', (e) => {
    settings.colorMode = e.target.value;
    applyAll();
  });

  // --- characters ---
  $('rampSelect').addEventListener('change', (e) => {
    settings.ramp = e.target.value;
    applyAll();
  });
  $('customRamp').addEventListener('input', (e) => {
    settings.customRamp = e.target.value;
    if (e.target.value.trim().length >= 2) {
      settings.ramp = 'custom';
      $('rampSelect').value = 'custom';
    }
    applyAll();
  });
  $('invert').addEventListener('change', (e) => { settings.invert = e.target.checked; applyAll(); });
  $('dither').addEventListener('change', (e) => { settings.dither = e.target.checked; applyAll(); });
  $('mirror').addEventListener('change', (e) => { settings.mirror = e.target.checked; applyAll(); });
  $('fitSelect').addEventListener('change', (e) => { settings.fit = e.target.value; applyGeometry(); });

  bindRange('resolution', (v) => { settings.resolution = Math.round(v); }, 1, false, true);
  bindRange('charAspect', (v) => { settings.charAspect = v; }, 100, false, true);
  bindRange('fps', (v) => { settings.fps = Math.round(v); }, 1);
  for (const k of CRT_KEYS) {
    bindRange('crt_' + k, (v) => { settings.crt[k] = v; }, 100, true);
  }

  // --- sources ---
  $('btnCam').addEventListener('click', () => startSource('webcam'));
  $('btnScreen').addEventListener('click', () => startSource('screen'));
  $('btnFile').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) startSource('file', f);
    e.target.value = '';
  });
  $('btnStop').addEventListener('click', () => {
    sources.stop();
    setStatus('stopped');
  });
  sources.onended = () => setStatus('stopped');

  // --- capture ---
  $('btnSnapshot').addEventListener('click', () => {
    downloadPNG(canvas, `ascii-cam-${stamp()}.png`);
  });
  $('btnCopy').addEventListener('click', async () => {
    const ok = await copyText(renderer.snapshotText());
    flash($('btnCopy'), ok ? 'Copied!' : 'Copy failed');
  });
  const btnRec = $('btnRecord');
  if (!Recorder.supported) {
    btnRec.disabled = true;
    btnRec.title = 'Recording is not supported in this browser.';
  }
  btnRec.addEventListener('click', () => {
    if (recorder.recording) { recorder.stop(); return; }
    const ext = recorder.start(canvas, settings.fps);
    if (ext) {
      btnRec.classList.add('recording');
      btnRec.textContent = '■ Stop';
      $('recBadge').hidden = false;
    }
  });
  recorder.onprogress = (elapsed, max) => {
    $('recTime').textContent = ((max - elapsed) / 1000).toFixed(1) + 's';
  };
  recorder.onstop = (blob, ext) => {
    downloadBlob(blob, `ascii-cam-${stamp()}.${ext}`);
    btnRec.classList.remove('recording');
    btnRec.textContent = '● Record';
    $('recBadge').hidden = true;
  };

  // --- panel toggle (mobile) + resize ---
  $('panelToggle').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  window.addEventListener('resize', debounce(() => { applyLayout(); }, 120));
}

function bindRange(id, setter, scale = 1, pct = false, relayout = false) {
  const el = $(id);
  if (!el) return;
  el.dataset.scale = String(scale);
  if (pct) el.dataset.pct = '1';
  el.addEventListener('input', () => {
    const v = Number(el.value) / scale;
    setter(v);
    const out = $(id + 'Val');
    if (out) out.textContent = pct ? Math.round(v * 100) + '%' : String(v);
    if (relayout) applyGeometry(); else applyAll();
  });
}

// ------------------------------------------------------------------ sources

async function startSource(kind, file) {
  try {
    setStatus('starting ' + kind + '…');
    if (kind === 'webcam') { settings.mirror = true; await sources.webcam(); }
    else if (kind === 'screen') { settings.mirror = false; await sources.screen(); }
    else if (kind === 'file') { settings.mirror = false; await sources.file(file); }
    $('mirror').checked = settings.mirror;
    applyRendererConfig();
    setStatus(kind + ' running');
  } catch (err) {
    console.error(err);
    setStatus('⚠ ' + friendlyError(err, kind));
  }
}

function friendlyError(err, kind) {
  if (!window.isSecureContext && kind !== 'file') {
    return 'camera/screen need HTTPS (or localhost).';
  }
  if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
    return 'permission denied.';
  }
  if (err && err.name === 'NotFoundError') return 'no device found.';
  return (err && err.message) || 'could not start ' + kind;
}

function setStatus(text) { $('srcStatus').textContent = text; }

function flash(el, text) {
  const old = el.textContent;
  el.textContent = text;
  setTimeout(() => { el.textContent = old; }, 1200);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ------------------------------------------------------------------ loop

let last = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const interval = 1000 / Math.max(1, settings.fps);
  if (now - last < interval) return;
  last = now;

  if (sources.active && video.readyState >= 2 && video.videoWidth) {
    renderer.render(video);
  } else {
    renderer.renderIdle(sources.active ? 'connecting…' : 'press  ▸ start camera');
  }
  tickFlicker(screen, flickerAmp);
}

// ------------------------------------------------------------------ boot

function boot() {
  buildControls();
  wireEvents();
  syncUI();
  applyGeometry();
  // Keep the canvas grid matched to the screen element's real size.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(debounce(applyLayout, 100)).observe(screen);
  }
  if (!window.isSecureContext) setStatus('note: camera needs HTTPS or localhost');
  else setStatus('ready — choose a source');
  requestAnimationFrame(loop);
}

boot();

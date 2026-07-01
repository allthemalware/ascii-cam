// The heart of the app: turn a video frame into a grid of coloured glyphs on a
// canvas. This is the browser port of ascii_tube's build_cells/quantize logic.
//
// Pipeline per frame:
//   <video>  --drawImage (area downscale, cover/contain, optional mirror)-->
//   sampler canvas (cols x rows)  --getImageData--> luminance -> ramp index
//   -> draw glyphs onto the display canvas (via a pre-rendered glyph atlas for
//      the monochrome/phosphor modes, or per-cell fillText for source colour).
//
// A glyph atlas (each ramp glyph rendered once, tinted for its brightness) makes
// the common path a cheap drawImage blit per cell, keeping 30fps comfortable.

import { hexToRgb, gradient } from './util.js';

const LUMA = (r, g, b) => (r * 77 + g * 150 + b * 29) >> 8; // ~Rec.601, 0..255

// 4x4 Bayer matrix -> ordered-dither offsets in [-0.5, 0.5), tiled to the grid.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class AsciiRenderer {
  constructor(displayCanvas) {
    this.canvas = displayCanvas;
    this.ctx = displayCanvas.getContext('2d');

    this.sampler = document.createElement('canvas');
    this.sctx = this.sampler.getContext('2d', { willReadFrequently: true });

    this.atlas = document.createElement('canvas');
    this.actx = this.atlas.getContext('2d');

    // Config with sane starting values (overwritten by the setters below).
    this.chars = ' .:-=+*#%@';
    this.nlevels = this.chars.length - 1;
    this.colorMode = 'phosphor';
    this.colors = { bg: [13, 16, 11], dim: [74, 85, 53], fg: [138, 154, 91], bright: [185, 199, 138] };
    this.dither = false;
    this.charAspect = 0.5;
    this.resolution = 120;
    this.fit = 'cover';
    this.mirror = true;
    this.trails = 0;
    this.crt = null;        // baked CRT post-processing (scanlines/glow/... 0..1)
    this._noiseTile = null;

    // Grid geometry (device pixels).
    this.cols = 0; this.rows = 0;
    this.cellW = 0; this.cellH = 0; this.offX = 0; this.offY = 0;
    this.fontPx = 0; this.scaleX = 1;

    this.levels = new Int16Array(0);
    this.ditherMap = new Float32Array(0);
    this._atlasDirty = true;
  }

  setRamp(chars, invert) {
    let s = chars && chars.length >= 2 ? chars : ' .:-=+*#%@';
    if (invert) s = [...s].reverse().join('');
    this.chars = s;
    this.nlevels = s.length - 1;
    this._atlasDirty = true;
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this._atlasDirty = true;
  }

  /** colours: {bg,dim,fg,bright} as hex strings. */
  setColors(colors) {
    this.colors = {
      bg: hexToRgb(colors.bg), dim: hexToRgb(colors.dim),
      fg: hexToRgb(colors.fg), bright: hexToRgb(colors.bright),
    };
    this._atlasDirty = true;
  }

  setOptions({ dither, charAspect, resolution, fit, mirror }) {
    if (dither !== undefined) this.dither = dither;
    if (charAspect !== undefined) this.charAspect = charAspect;
    if (resolution !== undefined) this.resolution = resolution;
    if (fit !== undefined) this.fit = fit;
    if (mirror !== undefined) this.mirror = mirror;
  }

  /** Baked CRT effects (scanlines/glow/vignette/noise/grid/trails). */
  setCrt(crt) {
    this.crt = crt;
    this.trails = crt ? (crt.trails || 0) : 0;
  }

  get cellCssSize() {
    const dpr = this._dpr || 1;
    return this.cellW / dpr;
  }

  /** Recompute grid + backing store for a CSS pixel container size. */
  layout(cssW, cssH) {
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this._dpr = dpr;
    const W = Math.max(1, Math.round(cssW * dpr));
    const H = Math.max(1, Math.round(cssH * dpr));
    this.canvas.width = W;
    this.canvas.height = H;

    const cols = Math.max(8, Math.min(400, Math.round(this.resolution)));
    const cellW = Math.max(2, Math.floor(W / cols));
    const cellH = Math.max(2, Math.floor(cellW / this.charAspect));
    const rows = Math.max(1, Math.floor(H / cellH));

    this.cols = cols; this.rows = rows;
    this.cellW = cellW; this.cellH = cellH;
    this.offX = Math.floor((W - cellW * cols) / 2);
    this.offY = Math.floor((H - cellH * rows) / 2);

    this.sampler.width = cols;
    this.sampler.height = rows;

    // Font sized to fill the cell height; horizontally condensed so a full block
    // glyph's advance maps exactly to the cell width (crisp, gap-free blocks).
    this.fontPx = Math.max(1, Math.floor(cellH));
    this.ctx.font = `${this.fontPx}px ui-monospace, "DejaVu Sans Mono", "Menlo", monospace`;
    const adv = this.ctx.measureText('█').width || this.fontPx * 0.6;
    this.scaleX = cellW / adv;

    this.levels = new Int16Array(cols * rows);
    this._buildDither();
    this._atlasDirty = true;
  }

  _buildDither() {
    const { cols, rows } = this;
    const map = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const b = BAYER4[(y & 3) * 4 + (x & 3)];
        map[y * cols + x] = (b + 0.5) / 16 - 0.5; // [-0.5, 0.5)
      }
    }
    this.ditherMap = map;
  }

  _colorForLevel(i) {
    const t = this.nlevels ? i / this.nlevels : 0;
    const { dim, fg, bright } = this.colors;
    if (this.colorMode === 'mono') return fg;
    // phosphor: dim -> fg -> bright across the brightness range.
    return gradient([dim, fg, bright], t);
  }

  _buildAtlas() {
    const { cellW, cellH, chars, fontPx, scaleX } = this;
    const n = chars.length;
    this.atlas.width = Math.max(1, cellW * n);
    this.atlas.height = Math.max(1, cellH);
    const a = this.actx;
    a.clearRect(0, 0, this.atlas.width, this.atlas.height);
    a.font = `${fontPx}px ui-monospace, "DejaVu Sans Mono", "Menlo", monospace`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const ch = chars[i];
      if (ch === ' ') continue;
      const [r, g, b] = this._colorForLevel(i);
      a.save();
      a.translate(i * cellW + cellW / 2, cellH / 2);
      a.scale(scaleX, 1);
      a.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      a.fillText(ch, 0, 0);
      a.restore();
    }
    this._atlasDirty = false;
  }

  // Map the video into the cols x rows sampler grid. Each sampler pixel becomes
  // one on-screen cell (cellW x cellH), so we work in the display rectangle's
  // aspect (dispAspect) and convert to sampler space, which keeps the picture
  // undistorted regardless of the character-aspect squash.
  _sample(video) {
    const { cols, rows, sctx } = this;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;

    const dispW = this.cellW * cols, dispH = this.cellH * rows;
    const dispAspect = dispW / dispH;
    const vidAspect = vw / vh;

    sctx.save();
    if (this.mirror) { sctx.translate(cols, 0); sctx.scale(-1, 1); }

    if (this.fit === 'contain') {
      sctx.fillStyle = '#000';
      sctx.fillRect(0, 0, cols, rows);
      // Whole frame fitted inside the display rect, then scaled to sampler space.
      let drawnW, drawnH;
      if (vidAspect > dispAspect) { drawnW = dispW; drawnH = dispW / vidAspect; }
      else { drawnH = dispH; drawnW = dispH * vidAspect; }
      const dw = (drawnW / dispW) * cols, dh = (drawnH / dispH) * rows;
      const dx = (cols - dw) / 2, dy = (rows - dh) / 2;
      sctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
    } else {
      // Cover: crop the source to the display aspect, fill the whole grid.
      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (vidAspect > dispAspect) { sw = vh * dispAspect; sx = (vw - sw) / 2; }
      else { sh = vw / dispAspect; sy = (vh - sh) / 2; }
      sctx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
    }
    sctx.restore();
    return true;
  }

  render(video) {
    if (this._atlasDirty && this.colorMode !== 'source') this._buildAtlas();
    if (!this._sample(video)) return;

    const { cols, rows, ctx } = this;
    const data = this.sctx.getImageData(0, 0, cols, rows).data;
    const levels = this.levels;
    const nlevels = this.nlevels;
    const useDither = this.dither;
    const dmap = this.ditherMap;

    for (let i = 0, p = 0; i < cols * rows; i++, p += 4) {
      const lum = LUMA(data[p], data[p + 1], data[p + 2]);
      let v = (lum * nlevels) / 255;
      if (useDither) v += dmap[i];
      let idx = Math.round(v);
      idx = idx < 0 ? 0 : idx > nlevels ? nlevels : idx;
      levels[i] = idx;
    }

    const W = this.canvas.width, H = this.canvas.height;
    const { bg } = this.colors;
    if (this.trails > 0) {
      const a = Math.max(0.05, 1 - this.trails * 0.95);
      ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${a})`;
    } else {
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    }
    ctx.fillRect(0, 0, W, H);

    const { cellW, cellH, offX, offY } = this;
    if (this.colorMode === 'source') {
      ctx.font = `${this.fontPx}px ui-monospace, "DejaVu Sans Mono", "Menlo", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = this.chars, scaleX = this.scaleX;
      for (let y = 0, i = 0; y < rows; y++) {
        const dy = offY + y * cellH + cellH / 2;
        for (let x = 0; x < cols; x++, i++) {
          const idx = levels[i];
          const ch = chars[idx];
          if (ch === ' ') continue;
          const p = i * 4;
          ctx.save();
          ctx.translate(offX + x * cellW + cellW / 2, dy);
          ctx.scale(scaleX, 1);
          ctx.fillStyle = `rgb(${data[p]},${data[p + 1]},${data[p + 2]})`;
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        }
      }
    } else {
      const atlas = this.atlas;
      const spaceIdx = this.chars.indexOf(' ');
      for (let y = 0, i = 0; y < rows; y++) {
        const dy = offY + y * cellH;
        for (let x = 0; x < cols; x++, i++) {
          const idx = levels[i];
          if (idx === spaceIdx) continue;
          ctx.drawImage(atlas, idx * cellW, 0, cellW, cellH,
                        offX + x * cellW, dy, cellW, cellH);
        }
      }
    }
    this._post();
  }

  _ensureNoise() {
    if (this._noiseTile) return this._noiseTile;
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const x = c.getContext('2d');
    const img = x.createImageData(c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    this._noiseTile = c;
    return c;
  }

  // Baked CRT post-processing, applied to the display canvas after the glyphs so
  // it is captured by snapshots and recordings. Curvature/aberration/flicker are
  // handled live in CSS (see crt.js) and intentionally stay out of the capture.
  _post() {
    const crt = this.crt;
    if (!crt) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, dpr = this._dpr || 1;

    if (crt.glow > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.8, crt.glow * 0.7);
      ctx.filter = `blur(${(crt.glow * 3 * dpr).toFixed(2)}px)`;
      ctx.drawImage(this.canvas, 0, 0);
      ctx.restore();
      ctx.filter = 'none';
    }

    if (crt.scanlines > 0.001) {
      const period = Math.max(2, Math.round(3 * dpr));
      const th = Math.max(1, Math.floor(period / 2));
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${(crt.scanlines * 0.6).toFixed(3)})`;
      for (let y = 0; y < H; y += period) ctx.fillRect(0, y, W, th);
      ctx.restore();
    }

    if (crt.grid > 0.001) {
      const gw = this.cellW * this.cols, gh = this.cellH * this.rows;
      ctx.save();
      ctx.strokeStyle = `rgba(0,0,0,${(crt.grid * 0.5).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, Math.floor(dpr));
      ctx.beginPath();
      for (let x = this.offX; x <= this.offX + gw; x += this.cellW) {
        ctx.moveTo(x + 0.5, this.offY); ctx.lineTo(x + 0.5, this.offY + gh);
      }
      for (let y = this.offY; y <= this.offY + gh; y += this.cellH) {
        ctx.moveTo(this.offX, y + 0.5); ctx.lineTo(this.offX + gw, y + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (crt.vignette > 0.001) {
      const cx = W / 2, cy = H / 2, r = Math.hypot(cx, cy);
      const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, crt.vignette * 0.9).toFixed(3)})`);
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (crt.noise > 0.001) {
      const tile = this._ensureNoise();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.5, crt.noise * 0.5);
      const ox = -((Math.random() * tile.width) | 0);
      const oy = -((Math.random() * tile.height) | 0);
      ctx.fillStyle = ctx.createPattern(tile, 'repeat');
      ctx.translate(ox, oy);
      ctx.fillRect(-ox, -oy, W, H);
      ctx.restore();
    }
  }

  /** Draw a "no signal" idle screen. */
  renderIdle(message) {
    const { ctx, canvas } = this;
    const { bg, dim, fg } = this.colors;
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const dpr = this._dpr || 1;
    ctx.fillStyle = `rgb(${dim[0]},${dim[1]},${dim[2]})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(16 * dpr)}px ui-monospace, monospace`;
    ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
    ctx.fillText(message || 'no signal', canvas.width / 2, canvas.height / 2);
    this._post();
  }

  /** The most recent frame as plain text (rows joined by newlines). */
  snapshotText() {
    const { cols, rows, chars, levels } = this;
    const out = [];
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) line += chars[levels[y * cols + x]] || ' ';
      out.push(line.replace(/\s+$/, ''));
    }
    return out.join('\n');
  }
}

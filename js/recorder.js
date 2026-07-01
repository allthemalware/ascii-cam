// Record the ASCII output canvas to a small video file, entirely client-side.
// mp4 is preferred where the browser's MediaRecorder supports it, otherwise we
// fall back to WebM. Capped at maxMs (default 30s) and a modest bitrate to keep
// files small. The finished clip downloads straight to the user's machine.

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=h264',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export class Recorder {
  constructor({ maxMs = 30000, bitsPerSecond = 2_000_000 } = {}) {
    this.maxMs = maxMs;
    this.bitsPerSecond = bitsPerSecond;
    this.rec = null;
    this.chunks = [];
    this.timer = 0;
    this.startedAt = 0;
    this.onstop = null;      // (blob, ext) => void
    this.onprogress = null;  // (elapsedMs, maxMs) => void
    this._raf = 0;
  }

  static get supported() {
    return typeof MediaRecorder !== 'undefined'
      && typeof HTMLCanvasElement !== 'undefined'
      && typeof HTMLCanvasElement.prototype.captureStream === 'function'
      && MIME_CANDIDATES.some((m) => {
        try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; }
      });
  }

  get recording() {
    return this.rec !== null && this.rec.state === 'recording';
  }

  _pickMime() {
    for (const m of MIME_CANDIDATES) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) { /* keep trying */ }
    }
    return '';
  }

  /** Begin recording `canvas` at `fps`. Returns the file extension it will use. */
  start(canvas, fps = 30) {
    if (this.recording) return null;
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') return null;
    const mime = this._pickMime();
    const stream = canvas.captureStream(fps);
    this.rec = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: this.bitsPerSecond,
    });
    this.chunks = [];
    const ext = (mime || this.rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm';

    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.onstop = () => {
      cancelAnimationFrame(this._raf);
      clearTimeout(this.timer);
      const type = (this.rec && this.rec.mimeType) || mime || 'video/webm';
      const blob = new Blob(this.chunks, { type });
      this.rec = null;
      if (this.onstop) this.onstop(blob, ext);
    };

    this.rec.start();
    this.startedAt = performance.now();
    this.timer = setTimeout(() => this.stop(), this.maxMs);

    const tick = () => {
      if (!this.recording) return;
      if (this.onprogress) this.onprogress(performance.now() - this.startedAt, this.maxMs);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    return ext;
  }

  stop() {
    if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
  }
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

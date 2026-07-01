// Input sources, all handled entirely in the browser. Nothing is uploaded:
// webcam / screen frames stay in the page, and picked video files are read via
// a local object URL. Every source feeds a single shared <video> element that
// the renderer samples each frame.

export class SourceManager {
  /** @param {HTMLVideoElement} videoEl shared, hidden, muted, playsinline */
  constructor(videoEl) {
    this.video = videoEl;
    this.video.muted = true;
    this.video.playsInline = true;
    this.stream = null;     // active MediaStream (webcam/screen) or null
    this.objectUrl = null;  // active blob: URL (file) or null
    this.kind = null;       // 'webcam' | 'screen' | 'file' | null
  }

  get active() {
    return this.kind !== null;
  }

  /** Live webcam. facingMode 'user' (default) or 'environment'. */
  async webcam(facingMode = 'user') {
    this._teardown();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    await this._attachStream(stream, 'webcam');
    return 'webcam';
  }

  /** Screen / window / tab share. */
  async screen() {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser.');
    }
    this._teardown();
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    // The browser's own "Stop sharing" button ends the track — surface that.
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (this.stream === stream) this.stop();
      if (this.onended) this.onended('screen');
    });
    await this._attachStream(stream, 'screen');
    return 'screen';
  }

  /** A local video File chosen by the user; loops silently. */
  async file(file) {
    this._teardown();
    this.objectUrl = URL.createObjectURL(file);
    this.video.srcObject = null;
    this.video.src = this.objectUrl;
    this.video.loop = true;
    await this._play();
    this.kind = 'file';
    return 'file';
  }

  async _attachStream(stream, kind) {
    this.stream = stream;
    this.video.loop = false;
    this.video.src = '';
    this.video.srcObject = stream;
    await this._play();
    this.kind = kind;
  }

  async _play() {
    // Wait for dimensions so the renderer can size its grid correctly.
    if (this.video.readyState < 1) {
      await new Promise((res) => this.video.addEventListener('loadedmetadata', res, { once: true }));
    }
    try {
      await this.video.play();
    } catch (_) {
      /* Autoplay can reject if not user-initiated; the caller triggers on a click. */
    }
  }

  _teardown() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  stop() {
    this._teardown();
    this.video.pause();
    this.video.srcObject = null;
    this.video.src = '';
    this.kind = null;
  }
}

# ASCII Cam

Turn your **webcam**, a **local video file**, or a **screen share** into live
ASCII art — right in the browser. Retro terminal palettes, cool-retro-term-style
CRT effects, and one-click recording.

**100% client-side.** Camera/screen frames and picked files are processed in the
page and never leave your machine. There is no server, no upload, no tracking.

> Live: `https://<user>.github.io/ascii-cam/`
> (e.g. https://thewhytewolf.github.io/ascii-cam/ once Pages is enabled)

This is the browser sibling of the terminal tool
[`ascii_tube` / `ascii_cam`](https://github.com/TheWhyteWolf/ascii_tube).

## Features

- **Olive-green theme by default**, with full RGB control over every colour
  (background, dim, foreground, highlight).
- **Historic display presets** — Game Boy DMG, amber P3, green P1 phosphor,
  Apple II, IBM CGA, Commodore 64, Hercules, DEC VT220, Plasma, IBM 5151,
  Matrix, Paper White.
- **Gradient maps** — ASCII (short & long 70-level), gradient blocks (shade
  `░▒▓█` and eighths `▁…█`), braille dots, half-width katakana, hexadecimal,
  numeric, binary, stipple, or your own custom ramp.
- **Colour modes** — monochrome, phosphor (theme gradient by brightness), or
  full colour sampled from the source.
- **CRT / terminal effects** (à la cool-retro-term) — scanlines, phosphor bloom,
  screen curvature, flicker, chromatic aberration, vignette, static/noise,
  phosphor trails, and an LCD pixel grid — bundled into one-click **machine
  presets** (Olive Terminal, Green CRT, Amber, Old TV, Game Boy LCD, Matrix,
  Clean).
- **Capture** — save a **PNG** snapshot, **copy** the current frame as text, or
  **record** up to 30 s of the output (mp4 where the browser supports it, WebM
  otherwise).
- Your settings persist locally via `localStorage`.

Scanlines, glow, vignette, noise, grid and phosphor trails are baked into the
canvas, so snapshots and recordings match the on-screen look. Curvature,
chromatic aberration and flicker are live-only display flourishes (kept out of
captures by design).

## Run it locally

Cameras require a secure context, and ES modules can't load over `file://`, so
serve the folder over `http://localhost`:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

(Any static server works — `npx serve`, `php -S localhost:8000`, etc.)

## Deploy to GitHub Pages

The site is plain static files — **no build step**.

1. Create a repo (e.g. `ascii-cam`) and push this folder to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source:
   _GitHub Actions_**.
3. The included workflow (`.github/workflows/pages.yml`) publishes the site on
   every push to `main`. It'll be live at `https://<user>.github.io/<repo>/`.

Prefer no Actions? You can instead set **Source: _Deploy from a branch_ →
`main` / `/ (root)`** — the `.nojekyll` file makes Pages serve the files as-is.

All paths are relative, so the app works at any base path (project pages,
user pages, or a custom domain) with no configuration.

## Project layout

```
index.html          UI shell (screen + control panel)
css/styles.css      olive theme, CRT bezel/curvature, responsive panel
js/
  main.js           wiring, state, render loop, localStorage
  renderer.js       video -> luminance -> ramp -> glyph canvas (+ baked CRT)
  crt.js            live-only effects (curvature, aberration, flicker)
  ramps.js          gradient maps
  palettes.js       retro display presets
  presets.js        "machine" bundles (palette + ramp + mode + effects)
  sources.js        webcam / video file / screen share
  recorder.js       MediaRecorder capture (mp4-preferred, 30 s cap)
  export.js         PNG snapshot + copy-as-text
  state.js          settings + persistence
  util.js           colour helpers
.github/workflows/pages.yml   GitHub Pages deployment
```

## Browser support

Needs a reasonably modern browser (ES modules, `getUserMedia`, Canvas 2D
filters). Recording uses `MediaRecorder` + `canvas.captureStream`; where mp4
isn't offered the recorder falls back to WebM, and if neither is available the
record button is disabled. Screen share uses `getDisplayMedia`.

// Live-only CRT presentation effects — the ones that make sense as a display
// skin rather than part of the ASCII image itself, so they're applied in CSS on
// the screen element and deliberately kept OUT of snapshots/recordings:
//   curvature   -> rounded "glass" screen face (--radius / --glass)
//   aberration  -> red/cyan chromatic split via a canvas CSS filter
//   flicker     -> per-frame brightness/opacity jitter (driven by the loop)
//
// The heavier, image-level effects (scanlines, glow, vignette, noise, grid,
// phosphor trails) are baked into the canvas by the renderer so captures match
// what's on screen.

/**
 * @param {{root:HTMLElement, canvas:HTMLElement}} dom
 * @param {object} crt  0..1 effect parameters
 * @returns {{flicker:number}}
 */
export function applyCRT(dom, crt) {
  const { root, canvas } = dom;

  root.style.setProperty('--radius', (crt.curvature * 4.5).toFixed(2) + '%');
  root.style.setProperty('--glass', (crt.curvature * 0.6).toFixed(3));
  root.classList.toggle('curved', crt.curvature > 0.02);

  let filter = '';
  if (crt.aberration > 0.001) {
    const a = (crt.aberration * 2.4).toFixed(2);
    filter = `drop-shadow(-${a}px 0 rgba(255,0,64,0.5)) drop-shadow(${a}px 0 rgba(0,192,255,0.5))`;
  }
  canvas.style.filter = filter;

  return { flicker: crt.flicker };
}

/** Per-frame flicker jitter; call from the render loop. */
export function tickFlicker(root, flicker) {
  root.style.opacity = flicker > 0.001
    ? (1 - Math.random() * flicker * 0.14).toFixed(3)
    : '1';
}

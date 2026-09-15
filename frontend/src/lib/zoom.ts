/**
 * Viewport coordinates and shell coordinates, and the one number between them.
 *
 * Presentation mode puts a CSS `zoom` on the shell (see PRESENTATION in
 * tokens.ts). Zoom does not create a containing block, so a `position: fixed`
 * element inside the shell is still placed against the viewport, but the
 * length it is given is read in the shell's own scaled pixels. The two spaces
 * therefore differ by exactly the zoom factor:
 *
 *     viewport px = shell px × zoom
 *
 * Anything that arrives from the browser in viewport pixels (`clientX`, a
 * `getBoundingClientRect()` edge, `window.innerHeight`) has to be divided by
 * that factor before it is compared with, or written back as, a shell-space
 * length. Anything that stays inside one space needs no conversion, which is
 * why a rect-against-rect comparison is left alone.
 *
 * Only the band chart does its own pixel arithmetic, so it is the only caller.
 */

/** Set on the document element by App.svelte; the fallback path reads it. */
const SCALE_PROP = '--display-scale';

/**
 * The zoom in force on `el`, counting every zoomed ancestor.
 *
 * `currentCSSZoom` is the browser's own answer and is exact, including the
 * nested case. Where it is missing the declared scale is the next best thing:
 * this app applies zoom in exactly one place, so the two agree.
 */
export function cssZoom(el: Element | null | undefined): number {
  const own = (el as { currentCSSZoom?: number } | null | undefined)?.currentCSSZoom;
  if (typeof own === 'number' && own > 0) return own;
  if (typeof document === 'undefined') return 1;
  const declared = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(SCALE_PROP),
  );
  return Number.isFinite(declared) && declared > 0 ? declared : 1;
}

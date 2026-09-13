/**
 * The colour of light of one wavelength: the tint a Raman laser wears, both on
 * the band chart's shift zero and on the per-claim wavelength tag.
 *
 * Like the element colours (elementColors.ts) this is data rather than design:
 * a colour that follows from physics, computed here instead of taken from
 * tokens.ts. Inside the visible range it is the usual piecewise approximation
 * of the spectrum (after D. Bruton), dimmed towards both ends where the eye
 * loses sensitivity. Outside it, where light has no colour, the convention
 * carries on from the nearest edge: ultraviolet as a violet that darkens into
 * indigo, infrared as a red that darkens into maroon.
 *
 * Nothing renders the saturated colour. `lightTint` washes it out into the
 * same pale-fill / mid-border / dark-text shape every other tag pill uses
 * (TAG_STYLES in tokens.ts), so a 532 nm chip reads as green without shouting
 * louder than the tags beside it, and the zero field wears the same tone.
 */

type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, k: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * k) as RGB;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const hex = (c: RGB) => '#' + c.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
const lum = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function visible(nm: number): RGB {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else { r = 1; }
  // The eye's sensitivity falls off at both ends of the range.
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const gamma = (v: number) => (v <= 0 ? 0 : Math.pow(v * f, 0.8));
  return [gamma(r), gamma(g), gamma(b)];
}

const UV_EDGE = visible(380);
const UV_DEEP: RGB = [0.17, 0.09, 0.3];
const IR_EDGE = visible(780);
const IR_DEEP: RGB = [0.3, 0.1, 0.1];

const WHITE: RGB = [1, 1, 1];

/**
 * Pulled towards its own grey. Spectral colours are fully saturated, which is
 * true of the light and wrong for a pill: undimmed, a 532 nm border comes out
 * neon beside the hand-picked tag styles it sits next to.
 */
function desaturate(c: RGB, k: number): RGB {
  const g = lum(c);
  return mix(c, [g, g, g], k);
}

/** The full-strength colour of light at this wavelength. */
function rgbOf(nm: number): RGB {
  if (!Number.isFinite(nm) || nm <= 0) return [0.5, 0.5, 0.5];
  if (nm < 380) return mix(UV_DEEP, UV_EDGE, clamp01((nm - 200) / 180));
  if (nm > 780) return mix(IR_EDGE, IR_DEEP, clamp01((nm - 780) / 420));
  return visible(nm);
}

export interface Tint {
  background: string;
  border: string;
  color: string;
}

/**
 * The wavelength as a tag pill: pale fill, mid border, dark text of its own
 * hue, the shape every entry in TAG_STYLES has.
 *
 * The text is scaled down rather than mixed towards ink, which is what keeps
 * the hue: mixing a bright green towards black lands on something
 * indistinguishable from the default grey pill, where scaling it lands on a
 * dark green. How far it scales depends on the colour, because a 532 nm green
 * starts an order of magnitude brighter than a 405 nm violet and one constant
 * cannot serve both.
 */
export function lightTint(nm: number): Tint {
  const c = desaturate(rgbOf(nm), 0.3);
  // Bring it to a fixed, readable darkness, but never lighten a colour that
  // is already dark enough (the ultraviolet and infrared ends both are).
  const k = Math.min(1, 0.15 / Math.max(lum(c), 0.001));
  return {
    background: hex(mix(c, WHITE, 0.86)),
    border: hex(mix(c, WHITE, 0.5)),
    color: hex([c[0] * k, c[1] * k, c[2] * k]),
  };
}

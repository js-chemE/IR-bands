/**
 * The colour of light of one wavelength, for the band chart's shift zero: the
 * laser suggestions and the zero field wear the colour of the light they
 * name.
 *
 * Like the element colours (elementColors.ts) this is data rather than
 * design: a colour that follows from physics, computed here instead of taken
 * from tokens.ts. Inside the visible range it is the usual piecewise
 * approximation of the spectrum (after D. Bruton), dimmed towards both ends
 * where the eye loses sensitivity. Outside it, where light has no colour, the
 * convention carries on from the nearest edge: ultraviolet as a violet that
 * darkens into indigo, infrared as a red that darkens into maroon.
 */

type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, k: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * k) as RGB;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const hex = (c: RGB) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

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

/** The light's colour as hex, and whether text on it should be light or dark. */
export function lightColor(nm: number): { bg: string; text: 'light' | 'dark' } {
  let c: RGB;
  if (!Number.isFinite(nm) || nm <= 0) c = [0.5, 0.5, 0.5];
  else if (nm < 380) c = mix(UV_DEEP, UV_EDGE, clamp01((nm - 200) / 180));
  else if (nm > 780) c = mix(IR_EDGE, IR_DEEP, clamp01((nm - 780) / 420));
  else c = visible(nm);
  // Relative luminance decides the text: dark ink on a bright green or
  // yellow, light on the rest.
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return { bg: hex(c), text: lum > 0.55 ? 'dark' : 'light' };
}

import type { Band, GroupMap, ColorDim } from './types';
import {
  C,
  VIBRATION_PALETTE,
  ATOMS_PALETTE,
  TAG_STYLES,
  DEFAULT_TAG_STYLE,
} from './tokens';

// Palettes and tag styles live in tokens.ts (the single source of truth for
// every colour in the atlas) and are re-exported here so existing imports of
// `./colors` keep working. Edit the values there, not here.
export { VIBRATION_PALETTE, ATOMS_PALETTE, TAG_STYLES, DEFAULT_TAG_STYLE };

const GREY = C['data-grey'];

/**
 * A colour faded: mixed with white, keeping its own hue, and returned
 * opaque. It looks like the colour laid over white at low opacity, but it is
 * how the chart fades a band (unreferenced) instead of opacity, so faded
 * bands that overlap keep one flat colour and nothing shows through them.
 * `strength` 1 is the fill, a smaller value a stronger edge in the same hue.
 * Anything that is not a #rrggbb hex comes back unchanged.
 */
export function fadeColor(hex: string, strength = 1): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  // How much white goes in: 70 %, the look of the colour at 0.3 opacity.
  const w = 0.7 * strength;
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.round(v + (255 - v) * w).toString(16).padStart(2, '0'))
    .join('');
}

export function vibrationKey(b: Band): string {
  const cat = b.vibration.category;
  const sub = b.vibration.subtype;
  return sub ? `${cat}.${sub}` : cat;
}

export function vibrationLabel(key: string): string {
  if (!key.includes('.')) return key;
  const [cat, sub] = key.split('.', 2);
  return `${cat} (${sub})`;
}

export function getCat(b: Band, dim: ColorDim): string {
  switch (dim) {
    case 'group':      return b.group;
    case 'vibration':  return vibrationKey(b);
    case 'atoms':      return b.atoms;
    case 'references': return b.references.length > 0 ? 'cited' : 'uncited';
  }
}

export function getCatLabel(cat: string, dim: ColorDim, groups: GroupMap): string {
  switch (dim) {
    case 'group':      return groups[cat]?.label ?? cat;
    case 'vibration':  return vibrationLabel(cat);
    case 'atoms':      return cat;
    case 'references': return cat === 'cited' ? 'Backed by references' : 'No reference yet';
  }
}

export function getColor(b: Band, groups: GroupMap, dim: ColorDim): string {
  switch (dim) {
    case 'group':      return groups[b.group]?.color ?? GREY;
    case 'vibration':  return VIBRATION_PALETTE[vibrationKey(b)] ?? GREY;
    case 'atoms':      return ATOMS_PALETTE[b.atoms] ?? GREY;
    case 'references': return b.references.length > 0 ? C['data-cited'] : C['data-uncited'];
  }
}

export function getCatColor(cat: string, dim: ColorDim, groups: GroupMap): string {
  switch (dim) {
    case 'group':      return groups[cat]?.color ?? GREY;
    case 'vibration':  return VIBRATION_PALETTE[cat] ?? GREY;
    case 'atoms':      return ATOMS_PALETTE[cat] ?? GREY;
    case 'references': return cat === 'cited' ? C['data-cited'] : C['data-uncited'];
  }
}

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

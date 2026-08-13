import type { Band, GroupMap, ColorDim, VibSubtype } from './types';

const GREY = '#7F7F7F';

export const VIBRATION_PALETTE: Record<string, string> = {
  'stretch':            '#3B82C4',
  'stretch.symmetric':  '#1F5FA0',
  'stretch.asymmetric': '#7FB3DC',
  'bend':               '#E89B3C',
  'bend.symmetric':     '#C77B1F',
  'bend.asymmetric':    '#F4B468',
  'bend.scissoring':    '#D9523A',
  'bend.rocking':       '#B8853D',
  'bend.wagging':       '#C99A2E',
  'bend.twisting':      '#A86B4A',
  'combination':        '#8C7A95',
  'lattice':            '#9B6B3D',
};

export const ATOMS_PALETTE: Record<string, string> = {
  'O-H':     '#3FA7A0',
  'H-O-H':   '#2A7873',
  'C-O-H':   '#7DC9C3',
  'C-H':     '#5BA84F',
  'H-C-H':   '#3D7C36',
  'O-C-H':   '#9CCB91',
  // Deuterated counterparts of the O-H / C-H entries above: same hue family
  // (so a ν(C-D) band still reads as "a C-H-family mode"), lifted lighter
  // and softer to mark it as the heavy twin. Which band is the isotopologue
  // is carried structurally by isotopologue_of + the hatched fill, not by
  // colour alone — this just keeps the two from colliding in the legend.
  'O-D':     '#7AC4BF',
  'C-D':     '#93C088',
  'D-C-D':   '#6FA167',
  'C-O':     '#E07856',
  'C=O':     '#E2624A',
  'O-C-O':   '#C03B36',
  'O=C=O':   '#E84940',
  'M-H':     '#D9A036',
  'M-O':     '#5C5C5C',
  'M-C':     '#4A7AB5',
  // The whole metal-oxygen-carbon chain moving as one unit (frustrated
  // rotation/translation of a surface-bound -O-C, methoxy's M-O-C wobble) —
  // a steel blue-grey that sits between M-O's neutral grey and M-C's blue,
  // keeping it visually part of the same M-* metal family.
  'M-O-C':   '#6B8299',
  'diverse': GREY,
};

// Per-tag style overrides — add entries here to style specific tags differently.
// Each entry overrides the default light-grey pill: { background, border, color }.
export const TAG_STYLES: Record<string, { background: string; border: string; color: string }> = {
  // Warm orange/red — infrared/heat association. Distinguishable from
  // raman-active's cool violet, and from the neutral grey default reserved
  // for an eventual "inactive" tag (a muted/warning treatment, not this).
  'ir-active':    { background: '#FDE9DD', border: '#F0A876', color: '#9A4A12' },
  // Cool violet — evokes the laser excitation line used in Raman scattering.
  'raman-active': { background: '#EEE3FB', border: '#C3A0EA', color: '#5B2E91' },
  // Teal — a third hue distinct from both of the above, for the
  // translation/rotation a free adsorbate would have but can't anymore once
  // trapped in the adsorption well (CO's and methoxy's frustrated modes).
  'frustrated-mode': { background: '#DCF3F0', border: '#7EC8BE', color: '#1F6B5C' },
  // Slate blue-grey — a fourth hue, deliberately the most neutral of the
  // four: an isotopologue is the same mode as its parent, just heavier, so
  // it shouldn't shout louder than the activity tags above. Pairs with the
  // diagonal hatch fill these bands get in the chart.
  'isotopic-shift': { background: '#E8EDF2', border: '#A2B5C6', color: '#3D5A70' },
  // Example (uncomment to activate):
  // 'overtone': { background: '#ede9fe', border: '#c4b5fd', color: '#5b21b6' },
};

export const DEFAULT_TAG_STYLE = { background: '#f9fafb', border: '#eaecef', color: '#8a8f98' };

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
    case 'references': return b.references.length > 0 ? '#2C8A3E' : '#BFBFBF';
  }
}

export function getCatColor(cat: string, dim: ColorDim, groups: GroupMap): string {
  switch (dim) {
    case 'group':      return groups[cat]?.color ?? GREY;
    case 'vibration':  return VIBRATION_PALETTE[cat] ?? GREY;
    case 'atoms':      return ATOMS_PALETTE[cat] ?? GREY;
    case 'references': return cat === 'cited' ? '#2C8A3E' : '#BFBFBF';
  }
}

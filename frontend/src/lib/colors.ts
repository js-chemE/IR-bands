import type { Band, GroupMap, ColorDim } from './types';
import {
  C,
  VIBRATION_PALETTE,
  ATOMS_PALETTE,
  EVIDENCE_PALETTE,
  TAG_STYLES,
  DEFAULT_TAG_STYLE,
} from './tokens';
import { anyLaserNm } from './dataModel';
import { lightTint } from './lightColor';

// Palettes and tag styles live in tokens.ts (the single source of truth for
// every colour in the atlas) and are re-exported here so existing imports of
// `./colors` keep working. Edit the values there, not here.
export { VIBRATION_PALETTE, ATOMS_PALETTE, TAG_STYLES, DEFAULT_TAG_STYLE };

export interface TagStyle {
  background: string;
  border: string;
  color: string;
}

/**
 * The pill style for any tag, including the one no table can hold.
 *
 * A Raman excitation wavelength ("514.5 nm") is a number rather than a member
 * of a vocabulary, so it can have no TAG_STYLES entry. It is coloured from the
 * light itself instead (lib/lightColor.ts), washed out into the same pale
 * fill / mid border / dark text every other pill uses, so a green line reads
 * as green without shouting over the tags beside it. Everything else comes
 * from the table, and anything unknown falls back to the neutral grey.
 *
 * Use this rather than indexing TAG_STYLES directly wherever the tag comes
 * from the data, or a wavelength chip renders grey.
 */
export function tagStyle(tag: string): TagStyle {
  // Both a single line ("515 nm") and a whole colour of them ("green laser"),
  // the family taking the colour of its representative wavelength.
  const nm = anyLaserNm(tag);
  if (nm !== null) return lightTint(nm);
  return TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE;
}

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

/* ---------------------------------------------------------------------------
   Evidence: how many independent ways a band has been demonstrated
   --------------------------------------------------------------------------- */

/** The infrared sampling geometries. Raman and computational are not among them. */
const IR_GEOMETRIES = new Set([
  'drifts', 'transmission', 'atr', 'ftir', 'irras', 'pm_irras', 'emission',
]);

/**
 * The Raman methods, counted the same way the geometries above are.
 *
 * This has to be a set rather than a boolean. When it was `t === 'raman'`,
 * adding `srs` silently broke the ladder: a spontaneous-Raman claim matched
 * neither that test nor IR_GEOMETRIES, so a band resting only on it fell
 * through every branch and was reported as "Computational only", which is the
 * one thing it certainly was not.
 */
const RAMAN_METHODS = new Set(['raman', 'srs']);

/**
 * The placeholders: each family's value for a source that named the family
 * and nothing finer.
 *
 * They count as evidence, but never towards "two methods agreeing". `raman`
 * beside `srs` is not two Raman techniques, because `raman` may well BE that
 * spontaneous measurement, only described more loosely; the same goes for
 * `ftir` beside `drifts`. Corroboration is the whole point of the upper
 * rungs, so it has to mean two methods known to differ.
 */
const UNSPECIFIED = new Set(['ftir', 'raman']);

/**
 * Which rung of the evidence ladder a band stands on.
 *
 * Two infrared geometries agreeing is worth more than one, because DRIFTS and
 * transmission have different artefacts. Infrared and Raman agreeing is worth
 * more again: they obey different selection rules, so a band that shows in
 * both cannot be an artefact of either. A calculation on top of that is the
 * top rung, but a calculation on its own is not measurement at all and sits
 * off the ladder rather than at the bottom of it.
 */
export function evidenceTier(b: Band): string {
  const refs = b.references ?? [];
  if (refs.length === 0) return 'none';

  const ir = new Set<string>();
  const raman = new Set<string>();
  let calculated = false;
  let typed = false;
  for (const r of refs) {
    const t = r.technique;
    if (!t) continue;
    typed = true;
    if (t === 'computational') calculated = true;
    else if (RAMAN_METHODS.has(t)) raman.add(t);
    else if (IR_GEOMETRIES.has(t)) ir.add(t);
  }

  // Claims exist but none says how it was measured: a gap in the record, not
  // a level of evidence, so it gets its own colour rather than the weakest.
  if (!typed) return 'untyped';
  if (ir.size === 0 && raman.size === 0) return 'computational';
  if (ir.size > 0 && raman.size > 0) return calculated ? 'complete' : 'cross';
  /* Raman alone is its own pair of rungs, not "1 IR method": these are single
     methods like an infrared geometry, but under a different selection rule,
     and calling them infrared would be simply wrong for the methane branches
     and the whole of H2 and N2, which have no infrared spectrum at all.
     Counted the same way as the geometries, so two Raman methods agreeing
     reads as the same strength of evidence as two infrared ones. */
  // Only named methods corroborate each other; see UNSPECIFIED above.
  const named = (s: Set<string>) => [...s].filter(t => !UNSPECIFIED.has(t)).length;
  if (raman.size > 0) return named(raman) >= 2 ? 'raman2' : 'raman1';
  return named(ir) >= 2 ? 'ir2' : 'ir1';
}

export const EVIDENCE_LABEL: Record<string, string> = {
  none:         'No reference yet',
  untyped:      'Method not recorded',
  computational:'Computational only',
  ir1:          '1 IR method',
  raman1:       '1 Raman method',
  ir2:          '2+ IR methods',
  raman2:       '2+ Raman methods',
  cross:        'IR and Raman',
  complete:     'IR, Raman and computational',
};

/**
 * Weakest first, so the legend reads as the ladder it is.
 *
 * One infrared geometry and Raman alone are both single methods, so they sit
 * side by side rather than one above the other; Raman follows only because
 * infrared is the larger part of this atlas.
 */
export const EVIDENCE_ORDER: Record<string, number> = {
  none: 0, untyped: 1, computational: 2,
  // Each technique runs its own ladder to completion before the next starts,
  // so the row reads as infrared, then Raman, then the two agreeing, then
  // everything agreeing. Interleaving the single-method rungs put 1 IR beside
  // 1 Raman and split each technique in half.
  ir1: 3, ir2: 4, raman1: 5, raman2: 6, cross: 7, complete: 8,
};

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
    case 'technique':  return evidenceTier(b);
  }
}

export function getCatLabel(cat: string, dim: ColorDim, groups: GroupMap): string {
  switch (dim) {
    case 'group':      return groups[cat]?.label ?? cat;
    case 'vibration':  return vibrationLabel(cat);
    case 'atoms':      return cat;
    case 'references': return cat === 'cited' ? 'Backed by references' : 'No reference yet';
    case 'technique':  return EVIDENCE_LABEL[cat] ?? cat;
  }
}

export function getColor(b: Band, groups: GroupMap, dim: ColorDim): string {
  switch (dim) {
    case 'group':      return groups[b.group]?.color ?? GREY;
    case 'vibration':  return VIBRATION_PALETTE[vibrationKey(b)] ?? GREY;
    case 'atoms':      return ATOMS_PALETTE[b.atoms] ?? GREY;
    case 'references': return b.references.length > 0 ? C['data-cited'] : C['data-uncited'];
    case 'technique':  return EVIDENCE_PALETTE[evidenceTier(b)] ?? GREY;
  }
}

export function getCatColor(cat: string, dim: ColorDim, groups: GroupMap): string {
  switch (dim) {
    case 'group':      return groups[cat]?.color ?? GREY;
    case 'vibration':  return VIBRATION_PALETTE[cat] ?? GREY;
    case 'atoms':      return ATOMS_PALETTE[cat] ?? GREY;
    case 'references': return cat === 'cited' ? C['data-cited'] : C['data-uncited'];
    case 'technique':  return EVIDENCE_PALETTE[cat] ?? GREY;
  }
}

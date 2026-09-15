/**
 * Key to label resolution for the tables that live outside bands.jsonc.
 *
 * `band.species` and `references[].measured_on` are keys now, not display
 * text: the readable name lives in species.jsonc / surfaces.jsonc and arrives
 * with the dataset. Four components need to resolve those keys (the chart
 * label, the chart tooltip, the references page, the dataset page), and
 * threading the lookup maps through all of them as props buys nothing: the
 * tables are loaded once, before anything renders, and never change.
 *
 * So they are installed once from App.svelte, the same way installTokens()
 * installs the design tokens, and read as plain functions. Every resolver
 * falls back to the key itself, so a page still renders if a table is missing.
 */

import type { Band, Dataset, Group, Species, Surface, SurfaceLevel, BandReference } from './types';

/**
 * The rotational branch, as a suffix on a band's display name.
 *
 * It used to be written into `short` as a literal "(R)", so the same fact sat
 * in two places and three call sites parsed it back out with
 * `/\s*\([PQR]\)$/`. `vibration.branch` is the only record of it now and the
 * suffix is built here, so a band cannot be labelled a branch it is not, and
 * a branch cannot be renamed without the label following.
 */
export function branchSuffix(b: Band): string {
  const branch = b.vibration?.branch;
  if (!branch) return '';
  /* One resolved line takes the spectroscopist's form, S(3), where the
     number is the level the transition starts from (Long, The Raman Effect,
     p. 174). A whole unresolved branch keeps the bare letter in brackets, so
     the two never read alike: "ν(HH) H₂ S(3)" is one line, "ν(NN) N₂ (S)" is
     the envelope. */
  const j = b.vibration?.j;
  return j === null || j === undefined ? ` (${branch})` : ` ${branch}(${j})`;
}

/**
 * The branch on its own, for a slot of its own: `S`, or `S(3)` where the
 * source resolved a single line. Same spelling as the title's suffix, minus
 * the brackets that mark it as an afterthought there.
 */
export function branchLabel(b: Band): string {
  const branch = b.vibration?.branch;
  if (!branch) return '';
  const j = b.vibration?.j;
  return j === null || j === undefined ? branch : `${branch}(${j})`;
}

let SPECIES: Record<string, Species> = {};
let SURFACES: Record<string, Surface> = {};
let GROUPS: Record<string, Group> = {};
/**
 * Group key -> its place in the chart's row order. The lanes table is the
 * atlas's one statement of what order the families come in, and anything
 * listing bands outside the chart should use it rather than invent a second
 * order: a reader who knows where formate sits on the chart should find it
 * in the same place in a list.
 */
let GROUP_RANK: Record<string, number> = {};

/** Called once from App.svelte as soon as bands.json has loaded. */
export function installLookups(dataset: Dataset): void {
  SPECIES = dataset.species ?? {};
  SURFACES = dataset.surfaces ?? {};
  GROUPS = dataset.groups ?? {};
  GROUP_RANK = {};
  let n = 0;
  for (const lane of dataset.lanes ?? []) for (const key of lane) GROUP_RANK[key] = n++;
}

export function groupLabel(key: string): string {
  return GROUPS[key]?.label ?? key;
}

export function groupColor(key: string): string {
  return GROUPS[key]?.color ?? '';
}

/** Where the chart puts this group, top to bottom. Unknown groups sort last. */
export function groupRank(key: string): number {
  return GROUP_RANK[key] ?? Number.MAX_SAFE_INTEGER;
}

export function speciesLabel(key: string): string {
  return SPECIES[key]?.label ?? key;
}

/** The formula, for the places that want CH₃O* rather than "Methoxy". */
export function speciesFormula(key: string): string {
  return SPECIES[key]?.formula ?? key;
}

export function speciesRecord(key: string): Species | undefined {
  return SPECIES[key];
}

export function surfaceLabel(key: string): string {
  return SURFACES[key]?.label ?? key;
}

export function surfaceRecord(key: string): Surface | undefined {
  return SURFACES[key];
}

/** Every surface, for the pages that list the table rather than resolve it. */
export function allSurfaces(): Record<string, Surface> {
  return SURFACES;
}

/**
 * The level a key sits at, defaulting to 'sample'.
 *
 * The badge is drawn from this: a site is filled, a phase or sample is
 * hollow, so a claim about Cu⁺ reads differently from one about Cu/ZnO
 * without anyone having to look the key up.
 */
export function surfaceLevel(key: string): SurfaceLevel {
  return SURFACES[key]?.level ?? 'sample';
}

/** What each level means, as the badge's title attribute. */
export const SURFACE_LEVEL_TITLE: Record<SurfaceLevel, string> = {
  site: 'Site: the atom-scale spot the molecule is bonded to',
  phase: 'Phase: a constituent of the sample, named by composition',
  sample: 'Sample: what was in the cell, not a specific site',
};

/** Normalize the scalar-or-array fields to a list of keys. */
export function asKeys(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** The keys one citation names, in the file's own order. */
export function measuredOnKeys(ref: BandReference): string[] {
  return asKeys(ref.measured_on);
}

/** Label plus level, which is everything a badge needs. */
export interface SurfaceBadge {
  key: string;
  label: string;
  level: SurfaceLevel;
}

export function measuredOnBadges(ref: BandReference): SurfaceBadge[] {
  return measuredOnKeys(ref).map(key => ({
    key,
    label: surfaceLabel(key),
    level: surfaceLevel(key),
  }));
}

/** The most specific level first, so the site leads and the sample follows. */
const LEVEL_RANK: Record<SurfaceLevel, number> = { site: 0, phase: 1, sample: 2 };

export function sortedMeasuredOnBadges(ref: BandReference): SurfaceBadge[] {
  return measuredOnBadges(ref).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

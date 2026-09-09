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

import type { Dataset, Species, Surface, SurfaceLevel, BandReference } from './types';

let SPECIES: Record<string, Species> = {};
let SURFACES: Record<string, Surface> = {};

/** Called once from App.svelte as soon as bands.json has loaded. */
export function installLookups(dataset: Dataset): void {
  SPECIES = dataset.species ?? {};
  SURFACES = dataset.surfaces ?? {};
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

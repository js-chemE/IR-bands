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

import type { Band, Dataset, Group, Species, Surface, SurfaceLevel, BandReference, ElementInfo } from './types';

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
let ELEMENTS: Record<string, ElementInfo> = {};

/** Called once from App.svelte as soon as bands.json has loaded. */
export function installLookups(dataset: Dataset): void {
  SPECIES = dataset.species ?? {};
  SURFACES = dataset.surfaces ?? {};
  GROUPS = dataset.groups ?? {};
  ELEMENTS = dataset.elements ?? {};
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
 * The level a key sits at, defaulting to 'material'.
 *
 * The badge is drawn from this: a site is filled, a material is hollow, so a
 * claim about Cu⁺ reads differently from one about Cu/ZnO without anyone
 * having to look the key up.
 */
export function surfaceLevel(key: string): SurfaceLevel {
  return SURFACES[key]?.level ?? 'material';
}

/** What each level means, as the badge's title attribute. */
export const SURFACE_LEVEL_TITLE: Record<SurfaceLevel, string> = {
  site: 'Site: the atom-scale spot the molecule is bonded to',
  material: 'Material: a piece of solid, one compound or a whole catalyst',
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
const LEVEL_RANK: Record<SurfaceLevel, number> = { site: 0, material: 1 };

export function sortedMeasuredOnBadges(ref: BandReference): SurfaceBadge[] {
  return measuredOnBadges(ref).sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
}

/**
 * One claim's surfaces, each with the role it plays in the claim.
 *
 * The fill says the role, so a row needs no words beside its badges and
 * keeps one height: a FILLED badge is where the paper put the species (a
 * site, or a material inside the specimen, or a specimen that is one
 * compound and nothing finer is named); a HOLLOW one is the specimen as
 * context. "[Cu⁺] [ZnO] [Cu/ZnO]" with the first two filled reads "on Cu⁺
 * and ZnO of Cu/ZnO"; a hollow catalyst on its own reads "seen there,
 * location not stated", and its title says so. Placed first, specimen last.
 */
export type ClaimRole = 'placed' | 'specimen' | 'unlocated';

export interface ClaimBadge extends SurfaceBadge {
  role: ClaimRole;
}

export const CLAIM_ROLE_TITLE: Record<ClaimRole, string> = {
  placed: 'Where the paper placed the species',
  specimen: 'The specimen measured',
  unlocated: 'The specimen measured; the paper does not say where on it the species sits',
};

export function claimSurfaces(ref: BandReference): ClaimBadge[] {
  const specimens = new Set(ref.specimens ?? []);
  const all = sortedMeasuredOnBadges(ref);
  const placed = all.filter(b => !specimens.has(b.key));
  const rest = all.filter(b => specimens.has(b.key));
  // A specimen named with nothing finer is the placement itself where it is
  // one compound (bare TiO₂), and an unlocated catalyst where it is not.
  const alone: ClaimRole = ref.placement === 'specimen' ? 'unlocated' : 'placed';
  return [
    ...placed.map(b => ({ ...b, role: 'placed' as ClaimRole })),
    ...rest.map(b => ({ ...b, role: placed.length ? 'specimen' as ClaimRole : alone })),
  ];
}

/** A badge's title: its role in the claim, then its level in the table. */
export function claimBadgeTitle(b: ClaimBadge): string {
  return `${CLAIM_ROLE_TITLE[b.role]} (${b.level === 'site' ? 'a site' : 'a material'})`;
}

/** A record and every record that refines it, transitively: what a search
 *  for `key` should find. Al₂O₃ reaches γ-Al₂O₃; γ-Al₂O₃ reaches only itself. */
export function refinementsOf(key: string): Set<string> {
  const out = new Set([key]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of Object.values(SURFACES)) {
      if (s.refines && out.has(s.refines) && !out.has(s.key)) { out.add(s.key); grew = true; }
    }
  }
  return out;
}

/** The element a site stands for, inherited along `refines`: Ga³⁺(t) is a Ga
 *  site even though only its parent names the element. */
export function siteElement(key: string): string | null {
  let rec: Surface | undefined = SURFACES[key];
  const seen = new Set<string>();
  while (rec && !seen.has(rec.key)) {
    if (rec.element) return rec.element;
    seen.add(rec.key);
    rec = rec.refines ? SURFACES[rec.refines] : undefined;
  }
  return null;
}

/** The title of a diluent badge. */
export const DILUENT_TITLE = 'Diluent: what the sample was mixed with, not part of the catalyst';

/** The diluent keys of a claim, as badges. Drawn apart from measured_on. */
export function diluentBadges(ref: BandReference): SurfaceBadge[] {
  return (ref.diluent ?? []).map(key => ({ key, label: surfaceLabel(key), level: surfaceLevel(key) }));
}

/** The whole Element table, for the periodic-table pickers. */
export function allElements(): Record<string, ElementInfo> {
  return ELEMENTS;
}
export function elementInfo(sym: string): ElementInfo | undefined {
  return ELEMENTS[sym];
}
/** The order the element selector uses, read off the periodic table. */
export const ELEMENT_CATEGORY_ORDER = [
  'alkali metal', 'alkaline earth metal', 'transition metal', 'post-transition metal',
  'lanthanide', 'actinide', 'metalloid', 'nonmetal', 'halogen',
];

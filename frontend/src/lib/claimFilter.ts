/**
 * Which claims count: the one filter the band chart and the References page
 * both read, and the vocabulary its sidebar sections are drawn from.
 *
 * Three questions, each a section in the sidebar and each answered per claim:
 *   Techniques  how the spectrum was taken
 *   Phases      how the sample was held (form and medium)
 *   Elements    what the surface named by the claim contains, read either
 *               off the site (where the molecule could be bonded) or off the
 *               whole specimen (anything in the solid investigated)
 *
 * Every part is a set of the EXCLUDED, so a value the filter does not list is
 * never silently dropped and the empty filter is the default. Elements add one
 * more set, `onlyElements`: a claim names several elements at once, so "only
 * Cu" cannot be written as "everything but Cu excluded" without also dropping
 * every Cu/ZnO claim for containing Zn. Double-click fills it, as a
 * double-click isolates a tag in the legend.
 */

import type { BandReference, Technique } from './types';
import { surfaceRecord, asKeys } from './labels';
// The technique vocabulary is data (data/techniques.jsonc); the lists below
// are empty until installTechniques() fills them from bands.json.

/* ── Technique vocabulary ──────────────────────────────────────────────── */

/* The technique lists, filled once from the Technique records in bands.json
   (data/techniques.jsonc) by installTechniques(), in the file's own order.
   They are filled in place, so an import taken before the data arrived sees
   the filled list: nothing here may be reassigned. */

/** The infrared family, the unspecified value first, as the file orders it. */
export const IR_TECHNIQUES: string[] = [];
/** The Raman family, as IR_TECHNIQUES is for the infrared one. */
export const RAMAN_TECHNIQUES: string[] = [];
/** Every value the filter can switch, in the file's order. */
export const ALL_TECHNIQUES: string[] = [];
export const TECHNIQUE_LABEL: Record<string, string> = {};
/**
 * A technique that is a more specific version of another (the record's
 * `parent`). ATR-SEIRAS is ATR with an enhancing metal film on the prism,
 * PM-IRRAS is IRRAS with the polarisation modulated: selecting or switching
 * off the parent takes its refinements with it, and the refinement can still
 * be picked on its own. The claim keeps its own value; only the filter reads this.
 */
export const TECHNIQUE_PARENT: Record<string, string> = {};
/* What each technique is, in one sentence: the tooltip on its row. */
export const TECHNIQUE_TIP: Record<string, string> = {};

export interface TechniqueRecord {
  label: string;
  family: 'infrared' | 'raman' | 'computational';
  spectroscopy: 'ir' | 'raman' | null;
  parent?: string;
  tip: string;
  note: string;
}

/** Fill the lists above from the records. Called once, when bands.json has loaded. */
export function installTechniques(table: Record<string, TechniqueRecord> | undefined): void {
  for (const list of [IR_TECHNIQUES, RAMAN_TECHNIQUES, ALL_TECHNIQUES]) list.length = 0;
  for (const rec of [TECHNIQUE_LABEL, TECHNIQUE_PARENT, TECHNIQUE_TIP]) for (const k of Object.keys(rec)) delete rec[k];
  for (const [key, r] of Object.entries(table ?? {})) {
    ALL_TECHNIQUES.push(key);
    if (r.family === 'infrared') IR_TECHNIQUES.push(key);
    if (r.family === 'raman') RAMAN_TECHNIQUES.push(key);
    TECHNIQUE_LABEL[key] = r.label;
    TECHNIQUE_TIP[key] = r.tip;
    if (r.parent) TECHNIQUE_PARENT[key] = r.parent;
  }
}

/** A technique and every refinement of it: what "ATR" selects. */
export function techniqueWithRefinements(key: string): string[] {
  return [key, ...Object.keys(TECHNIQUE_PARENT).filter(k => TECHNIQUE_PARENT[k] === key)];
}


/* Both families are offered in either view, each under a switch of its own,
   and the calculations after them. */
export const TECHNIQUE_FAMILIES: { key: string; label: string; title: string; members: readonly string[] }[] = [
  { key: 'infrared', label: 'IR', title: 'Absorption of infrared light by vibrations that change the dipole moment.', members: IR_TECHNIQUES },
  { key: 'raman', label: 'Raman', title: 'Inelastic scattering of laser light by vibrations that change the polarizability.', members: RAMAN_TECHNIQUES },
];

/* ── Phase vocabulary ──────────────────────────────────────────────────── */

/** Key for a claim that records no form, no medium, or no surface. */
export const UNRECORDED = 'unrecorded';

export type PhasePart = 'form' | 'medium';
export type PhaseRow = { key: string; label: string; title: string; tag: string | null };
export const PHASE_PARTS: { key: PhasePart; label: string; rows: PhaseRow[] }[] = [
  { key: 'form', label: 'Form', rows: [
    { key: 'free', tag: 'free', label: 'Free', title: 'The molecule on its own: a gas, the liquid itself, or isolated in a matrix.' },
    { key: 'dissolved', tag: 'dissolved', label: 'Dissolved', title: 'A solute in a liquid.' },
    { key: 'adsorbed', tag: 'adsorbed', label: 'Adsorbed', title: 'Held on a surface.' },
    { key: 'surface', tag: 'surface', label: 'Surface group', title: 'A group belonging to the solid, such as a hydroxyl or a hydride.' },
    { key: 'lattice', tag: 'lattice', label: 'Lattice', title: 'A vibration or a defect of the solid itself.' },
    { key: UNRECORDED, tag: null, label: 'Not recorded', title: 'No form recorded.' },
  ] },
  { key: 'medium', label: 'Medium', rows: [
    { key: 'vacuum', tag: 'in vacuum', label: 'Vacuum', title: 'An evacuated or ultra-high-vacuum cell with no gas let in.' },
    { key: 'gas', tag: 'in gas', label: 'Gas', title: 'A gas atmosphere, from a fraction of a mbar of dosed gas to a flowing feed at pressure.' },
    { key: 'liquid', tag: 'in liquid', label: 'Liquid', title: 'A liquid or an electrolyte.' },
    { key: 'supercritical', tag: 'in supercritical', label: 'Supercritical', title: 'A dense fluid above its critical point, neither gas nor liquid.' },
    { key: 'matrix', tag: 'in matrix', label: 'Matrix', title: 'A frozen noble gas the molecule is isolated in.' },
    { key: UNRECORDED, tag: null, label: 'Not recorded', title: 'No medium recorded.' },
  ] },
];
export const PHASE_ROW_COUNT = PHASE_PARTS.reduce((n, part) => n + part.rows.length, 0);

/* ── Element scope ─────────────────────────────────────────────────────── */

/**
 * Which of a claim's two derived element sets the Elements section reads.
 * `site`: the elements of where the claim placed the species (its sites, the
 * materials inside its specimen, a specimen that is one compound), i.e. what
 * the molecule could be bonded to; empty where only a composite is named. `specimen`: everything it names, so a band
 * assigned to Zr⁴⁺ on CuGaZrOx is found under Cu too. Diluents count in
 * neither.
 */
export type ElementScope = 'site' | 'specimen';

export const ELEMENT_SCOPES: { key: ElementScope; label: string; title: string }[] = [
  { key: 'site', label: 'In site', title: 'The elements of the site or material the paper placed the molecule on.' },
  { key: 'specimen', label: 'In specimen', title: 'Every element anywhere in the specimen the claim names.' },
];

/** The elements a claim stands on in this scope, or [UNRECORDED] for none. */
export function claimElements(ref: Pick<BandReference, 'site_elements' | 'specimen_elements'>, scope: ElementScope): string[] {
  const list = scope === 'site' ? ref.site_elements : ref.specimen_elements;
  return list?.length ? list : [UNRECORDED];
}

/* ── The filter ────────────────────────────────────────────────────────── */

export interface ClaimFilter {
  techniques: ReadonlySet<string>;
  forms: ReadonlySet<string>;
  media: ReadonlySet<string>;
  /** A claim containing any of these (in the scope) does not count. */
  elements: ReadonlySet<string>;
  /** Non-empty: a claim counts only if it contains one of these. */
  onlyElements: ReadonlySet<string>;
  elementScope: ElementScope;
  /** Materials: a claim reaching any of these surfaces does not count. */
  surfaces: ReadonlySet<string>;
  /** Non-empty: a claim counts only if it reaches one of these surfaces. */
  onlySurfaces: ReadonlySet<string>;
  /** Single claims switched off by hand, by their claim id. */
  claims: ReadonlySet<number>;
}

export function emptyFilter(): ClaimFilter {
  return {
    techniques: new Set(), forms: new Set(), media: new Set(),
    elements: new Set(), onlyElements: new Set(), elementScope: 'specimen',
    surfaces: new Set(), onlySurfaces: new Set(), claims: new Set(),
  };
}
export const NO_FILTER: ClaimFilter = emptyFilter();

export type OffReason = 'unknown' | 'hidden' | 'excluded' | 'excluded-phase' | 'excluded-element' | 'excluded-material';

type FilterableRef = {
  id?: number | null;
  uid?: string;
  measured_on?: string | string[] | null;
  technique?: Technique | string | null;
  form?: string | null;
  medium?: string | null;
  site_elements?: string[];
  specimen_elements?: string[];
};

/**
 * Which section has switched this claim off, or null when it passes all
 * three. A claim that records no technique is not excluded by the Techniques
 * section: switching a technique off says "not this kind of measurement",
 * which is no statement about a claim that never named one.
 */
export function claimExcluded(ref: FilterableRef, filter: ClaimFilter = NO_FILTER): Exclude<OffReason, 'unknown'> | null {
  if (ref.id != null && filter.claims.has(ref.id)) return 'hidden';
  if (ref.technique && filter.techniques.has(ref.technique)) return 'excluded';
  if (filter.forms.has(ref.form || UNRECORDED)) return 'excluded-phase';
  if (filter.media.has(ref.medium || UNRECORDED)) return 'excluded-phase';
  if (filter.elements.size || filter.onlyElements.size) {
    const els = claimElements(ref, filter.elementScope);
    if (els.some(e => filter.elements.has(e))) return 'excluded-element';
    if (filter.onlyElements.size && !els.some(e => filter.onlyElements.has(e))) return 'excluded-element';
  }
  if (filter.surfaces.size || filter.onlySurfaces.size) {
    const reach = claimReach(ref);
    if ([...filter.surfaces].some(k => reach.has(k))) return 'excluded-material';
    if (filter.onlySurfaces.size && ![...filter.onlySurfaces].some(k => reach.has(k))) return 'excluded-material';
  }
  return null;
}

/**
 * Every surface record a claim reaches: the ones it names, everything they
 * are made of (parts, and the parts a refinement inherits), and every parent
 * of all of those along `refines`. Picking Al₂O₃ in the materials filter
 * therefore keeps a claim on γ-Al₂O₃ and one on Ru/Al₂O₃; picking γ-Al₂O₃
 * keeps the first and not a claim on plain Al₂O₃. The same routes as the
 * Dataset page's Total column.
 */
const REACH = new Map<string, Set<string>>();
export function claimReach(ref: FilterableRef): Set<string> {
  const cacheKey = ref.uid ?? (ref.id != null ? `#${ref.id}` : null);
  if (cacheKey && REACH.has(cacheKey)) return REACH.get(cacheKey)!;
  const out = new Set<string>();
  const walk = (k: string) => {
    if (out.has(k)) return;
    const rec = surfaceRecord(k);
    if (!rec) return;
    out.add(k);
    for (const up of rec.lineage ?? []) walk(up);
    for (const p of rec.parts ?? []) walk(p);
  };
  for (const k of asKeys(ref.measured_on ?? null)) walk(k);
  if (cacheKey) REACH.set(cacheKey, out);
  return out;
}

/**
 * Whether a claim stands on the band chart, or is greyed out and folded:
 * 'unknown' when it records no technique (so it is neither IR nor Raman
 * evidence yet), otherwise whatever `claimExcluded` says.
 *
 * This is the one place that decides which claims count on the chart.
 * Everything that follows from it (a band being unreferenced, drawn faded,
 * taken out) reads `isReferenced` in chart.ts, which asks this per claim.
 */
export function refOff(ref: FilterableRef, filter: ClaimFilter = NO_FILTER): OffReason | null {
  if (!ref.technique) return 'unknown';
  return claimExcluded(ref, filter);
}

/* ── Editing a filter (immutably, so Svelte sees every change) ─────────── */

function flip(set: ReadonlySet<string>, keys: readonly string[], on: boolean): Set<string> {
  const next = new Set(set);
  for (const k of keys) if (on) next.delete(k); else next.add(k);
  return next;
}

/** Count only `keep` out of `all`; asked again, count everything. */
export function isolate(all: readonly string[], keep: readonly string[], excluded: ReadonlySet<string>): ReadonlySet<string> {
  const others = all.filter(k => !keep.includes(k));
  const already = others.every(k => excluded.has(k)) && keep.every(k => !excluded.has(k));
  return already ? new Set() : new Set(others);
}

/** How many of `keys` are counted. */
export const countOn = (keys: readonly string[], excluded: ReadonlySet<string>) =>
  keys.filter(k => !excluded.has(k)).length;

/** A switch over several techniques: all off if any is on, else all on. */
export function toggleTechniques(f: ClaimFilter, keys: readonly string[]): ClaimFilter {
  return { ...f, techniques: flip(f.techniques, keys, countOn(keys, f.techniques) === 0) };
}
export function setTechniques(f: ClaimFilter, keys: readonly string[], on: boolean): ClaimFilter {
  return { ...f, techniques: flip(f.techniques, keys, on) };
}
export function onlyTechniques(f: ClaimFilter, keep: readonly string[]): ClaimFilter {
  return { ...f, techniques: isolate(ALL_TECHNIQUES, keep, f.techniques) };
}

const partField = (part: PhasePart) => (part === 'form' ? 'forms' : 'media') as 'forms' | 'media';
export function phaseExcluded(f: ClaimFilter, part: PhasePart): ReadonlySet<string> {
  return f[partField(part)];
}
export function setPhase(f: ClaimFilter, part: PhasePart, key: string, on: boolean): ClaimFilter {
  return { ...f, [partField(part)]: flip(f[partField(part)], [key], on) };
}
export function togglePhase(f: ClaimFilter, part: PhasePart, key: string): ClaimFilter {
  return setPhase(f, part, key, f[partField(part)].has(key));
}
export function onlyPhase(f: ClaimFilter, part: PhasePart, keep: readonly string[]): ClaimFilter {
  const all = PHASE_PARTS.find(p => p.key === part)!.rows.map(r => r.key);
  return { ...f, [partField(part)]: isolate(all, keep, f[partField(part)]) };
}

/** Whether an element row reads as on: not excluded, and in the only-set if there is one. */
export function elementOn(f: ClaimFilter, el: string): boolean {
  return !f.elements.has(el) && (f.onlyElements.size === 0 || f.onlyElements.has(el));
}

/**
 * Click on one or several element rows. With an only-set standing, the click
 * edits that set (add to it, take out of it); otherwise it edits the excluded
 * set. Either way a row that read on reads off afterwards and vice versa.
 */
export function toggleElements(f: ClaimFilter, keys: readonly string[]): ClaimFilter {
  const anyOn = keys.some(k => elementOn(f, k));
  if (f.onlyElements.size) {
    const only = new Set(f.onlyElements);
    for (const k of keys) if (anyOn) only.delete(k); else only.add(k);
    return { ...f, onlyElements: only, elements: anyOn ? f.elements : flip(f.elements, keys, true) };
  }
  return { ...f, elements: flip(f.elements, keys, !anyOn) };
}

/** Double-click: only claims containing one of `keep`; asked again, all of them. */
export function onlyElements(f: ClaimFilter, keep: readonly string[]): ClaimFilter {
  const same = f.onlyElements.size === keep.length && keep.every(k => f.onlyElements.has(k));
  return same
    ? { ...f, onlyElements: new Set() }
    : { ...f, onlyElements: new Set(keep), elements: flip(f.elements, keep, true) };
}

export function filterIsEmpty(f: ClaimFilter): boolean {
  return !f.techniques.size && !f.forms.size && !f.media.size && !f.elements.size && !f.onlyElements.size
    && !f.surfaces.size && !f.onlySurfaces.size && !f.claims.size;
}

/* ── Materials: the same two sets as the elements, over surface keys ── */
export function materialOn(f: ClaimFilter, key: string): boolean {
  return !f.surfaces.has(key) && (f.onlySurfaces.size === 0 || f.onlySurfaces.has(key));
}
export function toggleMaterials(f: ClaimFilter, keys: readonly string[]): ClaimFilter {
  const anyOn = keys.some(k => materialOn(f, k));
  if (f.onlySurfaces.size) {
    const only = new Set(f.onlySurfaces);
    for (const k of keys) if (anyOn) only.delete(k); else only.add(k);
    return { ...f, onlySurfaces: only, surfaces: anyOn ? f.surfaces : flip(f.surfaces, keys, true) };
  }
  return { ...f, surfaces: flip(f.surfaces, keys, !anyOn) };
}
export function onlyMaterials(f: ClaimFilter, keep: readonly string[]): ClaimFilter {
  const same = f.onlySurfaces.size === keep.length && keep.every(k => f.onlySurfaces.has(k));
  return same
    ? { ...f, onlySurfaces: new Set() }
    : { ...f, onlySurfaces: new Set(keep), surfaces: flip(f.surfaces, keep, true) };
}

/* ── Single claims switched off by hand ── */
export function toggleClaim(f: ClaimFilter, id: number): ClaimFilter {
  const next = new Set(f.claims);
  if (next.has(id)) next.delete(id); else next.add(id);
  return { ...f, claims: next };
}

/** Several claims at once (one paper's on one band): all off if any counts, else all back on. */
export function toggleClaims(f: ClaimFilter, ids: readonly number[]): ClaimFilter {
  const anyOn = ids.some(id => !f.claims.has(id));
  const next = new Set(f.claims);
  for (const id of ids) if (anyOn) next.add(id); else next.delete(id);
  return { ...f, claims: next };
}

/** A copy that shares nothing with the original, for handing a selection to the other page. */
export function cloneFilter(f: ClaimFilter): ClaimFilter {
  return {
    ...f,
    techniques: new Set(f.techniques), forms: new Set(f.forms), media: new Set(f.media),
    elements: new Set(f.elements), onlyElements: new Set(f.onlyElements),
    surfaces: new Set(f.surfaces), onlySurfaces: new Set(f.onlySurfaces), claims: new Set(f.claims),
  };
}

/* ── Counting ──────────────────────────────────────────────────────────── */

/** How many of something carry each value, per section, for the row counts. */
export interface FilterCounts {
  technique: Record<string, number>;
  form: Record<string, number>;
  medium: Record<string, number>;
  element: Record<string, number>;
  /** Per surface record: units with a claim that reaches it. */
  material: Record<string, number>;
  /** Per technique family (infrared, raman, computational). */
  family: Record<string, number>;
}

/**
 * Count units (bands on the chart, claims on the References page): each unit
 * is a list of claims and is counted once per value any of them carries.
 */
export function countClaims(units: Iterable<readonly FilterableRef[]>, scope: ElementScope): FilterCounts {
  const out: FilterCounts = { technique: {}, form: {}, medium: {}, element: {}, material: {}, family: {} };
  const bump = (rec: Record<string, number>, keys: Iterable<string>) => {
    for (const k of new Set(keys)) rec[k] = (rec[k] ?? 0) + 1;
  };
  for (const refs of units) {
    // A refinement counts towards its parent too, so the ATR row says how
    // many it selects with ATR-SEIRAS included.
    const techs = refs.map(r => r.technique).filter(Boolean) as string[];
    bump(out.technique, techs.flatMap(t => (TECHNIQUE_PARENT[t] ? [t, TECHNIQUE_PARENT[t]] : [t])));
    bump(out.form, refs.map(r => r.form || UNRECORDED));
    bump(out.medium, refs.map(r => r.medium || UNRECORDED));
    bump(out.element, refs.flatMap(r => claimElements(r, scope)));
    bump(out.material, refs.flatMap(r => [...claimReach(r)]));
    bump(out.family, techs.map(t => (IR_TECHNIQUES.includes(t) ? 'infrared' : RAMAN_TECHNIQUES.includes(t) ? 'raman' : 'computational')));
  }
  return out;
}

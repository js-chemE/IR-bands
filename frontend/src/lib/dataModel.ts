/**
 * The atlas data model, written down.
 *
 * The atlas is really six small databases that reference each other:
 * bands.jsonc, vibrations.jsonc, references.bib, tags.jsonc, plus two sets of
 * lookups (groups, regions) that live inside bands.jsonc. Some of what they
 * hold is a proper record with an id; the rest is a bare string repeated in
 * many places (a site, a species, an author, a technique). This module states
 * which is which, how the records link up, and what the cardinality of each
 * link is, so that the Data model page can render it and so that anything
 * built on top (site filtering, a site page, a materials list) starts from an
 * agreed vocabulary instead of a fresh guess.
 *
 * Two halves:
 *   1. The *specification* below (ENTITIES, RELATIONS, SELF_LINKS, TAG_ROLES).
 *      Hand-authored, the single source of truth for the page's prose.
 *   2. `analyse()`, which reads the live JSON and fills the specification in
 *      with real counts and, for the string-valued entities, the full
 *      inventory of distinct values. That inventory doubles as the to-do list
 *      for promoting one of them to a real record.
 *
 * Keep this in step with schema.py and types.ts: adding a field there means
 * adding it here, same as the JSONC preambles.
 */

import type { Band, Dataset, RefMap, Vibrations } from './types';

/* ---------------------------------------------------------------------------
   Specification
   --------------------------------------------------------------------------- */

/**
 * How real an entity is today.
 *   record   — has its own object with an id, in a data file
 *   lookup   — has its own object, but nested inside another file's header
 *   inline   — exists only as fields on a parent record, no id of its own
 *   string   — exists only as a repeated bare string, no record anywhere
 *   derived  — not authored at all; computed at load or render time
 */
export type EntityStatus = 'record' | 'lookup' | 'inline' | 'string' | 'derived';

export const STATUS_LABEL: Record<EntityStatus, string> = {
  record: 'Record',
  lookup: 'Lookup',
  inline: 'Inline',
  string: 'Bare string',
  derived: 'Derived',
};

export const STATUS_NOTE: Record<EntityStatus, string> = {
  record: 'Own object with its own id, in its own data file.',
  lookup: 'Own object with a key, but nested in another file’s header block.',
  inline: 'A structured object, but owned by its parent and with no id of its own.',
  string: 'Only ever a repeated bare string. Nothing can be attached to it, nothing validates it.',
  derived: 'Never authored. Computed from other records at load or render time.',
};

export interface FieldSpec {
  name: string;
  type: string;
  /** required | optional | computed | authored elsewhere */
  req: 'req' | 'opt' | 'calc';
  note: string;
}

export interface EntitySpec {
  key: string;
  label: string;
  status: EntityStatus;
  /** Where it is authored, as a path the reader can go and open. */
  source: string;
  /** What identifies one instance. */
  id: string;
  /** One sentence: what one instance of this is. */
  blurb: string;
  fields: FieldSpec[];
  /** Set when the entity is a string/inline one and promoting it would unlock something. */
  promote?: string;
}

export const ENTITIES: EntitySpec[] = [
  {
    key: 'band',
    label: 'Band',
    status: 'record',
    source: 'data/bands.jsonc',
    id: 'id (append-only; renaming breaks based_on)',
    blurb:
      'One vibrational feature of one species, with the wavenumber window it is reported in. The hub of the whole dataset.',
    fields: [
      { name: 'id', type: 'string', req: 'req', note: 'Stable key, referenced by based_on, fermi_partner, isotopologue_of.' },
      { name: 'species', type: 'string', req: 'req', note: 'Bare string today. See the Species entity.' },
      { name: 'group', type: 'string', req: 'req', note: 'Foreign key into the groups lookup.' },
      { name: 'vibration', type: '{category, subtype, branch}', req: 'req', note: 'Closed enums, validated in schema.py.' },
      { name: 'atoms', type: 'string', req: 'req', note: 'Bond environment (O=C=O, M-O, diverse). Drives the atoms colormap.' },
      { name: 'wn_start / wn_end', type: 'int', req: 'req', note: 'The band’s window in cm⁻¹. wn_min/max/center derive from it.' },
      { name: 'short / description', type: 'string', req: 'opt', note: 'Label and the 100 to 120 word general description.' },
      { name: 'references[]', type: 'Assignment[]', req: 'opt', note: 'The per-source claims. See the Assignment entity.' },
      { name: 'based_on[]', type: 'BasedOn[]', req: 'opt', note: 'Parent modes of a combination or overtone, with a multiplier.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Free-form; some auto-assigned by build.py.' },
      { name: 'intensity / width / confidence', type: 'enum', req: 'opt', note: 'Observation-dependent, but authored on the band. See Open questions.' },
      { name: 'vibration_modes[]', type: 'string[]', req: 'opt', note: 'Link up into vibrations.jsonc. Back-filled for derived bands.' },
      { name: 'lane / sub_lane', type: 'int', req: 'calc', note: 'Set in place by layout.py, not authored.' },
    ],
  },
  {
    key: 'assignment',
    label: 'Assignment',
    status: 'inline',
    source: 'data/bands.jsonc → band.references[]',
    id: 'none (position in the array)',
    blurb:
      'One paper’s claim about one band: the wavenumber it reports, the surface it saw it on, the caveat it attaches. The join between Band and Reference, and already the natural home for everything observation-dependent.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'Foreign key into references.bib.' },
      { name: 'wn', type: 'int | int[]', req: 'opt', note: 'This source’s reported position. An array means several resolved components.' },
      { name: 'site', type: 'string | string[]', req: 'opt', note: 'Bare string today. See the Site entity.' },
      { name: 'note', type: 'string', req: 'opt', note: 'What this one paper reported, ≤150 words. Conditions live here as prose.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Scoped to this claim, not the band. Mixes technique, evidence and caveat. See Tag roles.' },
    ],
    promote:
      'Give it an id and it becomes addressable: a site page can list claims, a claim can carry its own confidence, and the wn/site arrays can split into one row per claim.',
  },
  {
    key: 'reference',
    label: 'Reference',
    status: 'record',
    source: 'data/references.bib',
    id: 'citekey',
    blurb: 'One bibliographic entry. Parsed by loader.py into references.json and rendered IEEE-style by citations.ts.',
    fields: [
      { name: 'citekey', type: 'string', req: 'req', note: 'Every assignment.key must resolve to one of these.' },
      { name: 'author', type: 'string', req: 'req', note: 'BibTeX "A and B and C". Unparsed. See the Author entity.' },
      { name: 'title / journaltitle / volume / pages / date', type: 'string', req: 'opt', note: 'Standard BibTeX, used for the citation line.' },
      { name: 'doi / url', type: 'string', req: 'opt', note: 'Resolved to the ↗ link on every citation.' },
    ],
  },
  {
    key: 'site',
    label: 'Site',
    status: 'string',
    source: 'data/bands.jsonc → band.references[].site',
    id: 'none (the display string is the identity)',
    blurb:
      'Where the band was observed. Written as a display string, so nothing can be attached to it and nothing checks that two spellings mean the same surface.',
    fields: [
      { name: '(the string)', type: 'string | string[]', req: 'opt', note: 'An array when one source reports the band on several surfaces.' },
    ],
    promote:
      'The values in use are not one kind of thing: cations, reduced metals, oxide surfaces, facets, interfaces, defect ensembles and whole catalysts all share the field. Splitting Site from Material is what makes "every band seen on Cu⁺" answerable.',
  },
  {
    key: 'material',
    label: 'Material',
    status: 'string',
    source: 'data/bands.jsonc → the catalyst-shaped values in site',
    id: 'none',
    blurb:
      'The sample: active phase, promoter, support. Currently indistinguishable from a Site because both are written into the same field.',
    fields: [
      { name: '(the string)', type: 'string', req: 'opt', note: 'Cu/ZnO, Ru/"Na₂O"/Al₂O₃, La-Al₂O₃, CuGaZrOx …' },
    ],
    promote:
      'A material declaring which sites it exposes is what lets a band cited on Cu/ZnO show up under Cu⁰ and Cu⁺ without anyone re-typing the link.',
  },
  {
    key: 'species',
    label: 'Species',
    status: 'string',
    source: 'data/bands.jsonc → band.species, data/vibrations.jsonc → molecule.species',
    id: 'none (matched by string equality between two files)',
    blurb:
      'The adsorbate or gas molecule the band belongs to. The only thing tying a band to a molecule on the vibration-modes page is that the two strings are spelled identically, and mostly they are not: bands.jsonc writes a display label ("Methoxy (CH₃O*)"), vibrations.jsonc writes a formula ("CH₃O*").',
    fields: [
      { name: '(the string)', type: 'string', req: 'req', note: 'Free text. Nothing validates it, in either file.' },
    ],
    promote:
      'A species record makes the band ↔ molecule link a real foreign key instead of a coincidence, separates the formula from the display label, and gives phase (gas or adsorbed) somewhere to live.',
  },
  {
    key: 'author',
    label: 'Author',
    status: 'string',
    source: 'data/references.bib → author field',
    id: 'none (parsed at render time by citations.ts)',
    blurb: 'A person. Split out of the BibTeX author field only for display, never stored.',
    fields: [
      { name: '(name)', type: 'string', req: 'req', note: 'Last, First or First Last, joined by " and ".' },
    ],
    promote: 'Cheap to derive in build.py if a "who reports what" view is ever wanted. Nothing depends on it today.',
  },
  {
    key: 'technique',
    label: 'Technique',
    status: 'string',
    source: 'data/bands.jsonc → band.references[].tags',
    id: 'none (a tag string)',
    blurb:
      'How the observation was made: DRIFTS, transmission FTIR, a calculation. Currently smuggled in as a per-citation tag alongside evidence and caveat tags that are not techniques at all.',
    fields: [
      { name: '(a tag)', type: 'string', req: 'opt', note: 'drifts, ftir, computational …' },
    ],
    promote: 'A field on the assignment rather than a tag: one value per claim, closed vocabulary, filterable without string matching against the tag list.',
  },
  {
    key: 'group',
    label: 'Group',
    status: 'lookup',
    source: 'data/bands.jsonc → groups',
    id: 'key',
    blurb: 'The chemical family a band belongs to. Owns its own colour, deliberately: it belongs to the dataset, not to the design system.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'Referenced by band.group and molecule.band_groups.' },
      { name: 'label', type: 'string', req: 'req', note: 'Lane label in the chart.' },
      { name: 'color', type: 'hex', req: 'req', note: 'The one colour the design system does not own.' },
    ],
  },
  {
    key: 'region',
    label: 'Region',
    status: 'derived',
    source: 'data/bands.jsonc → regions (membership is computed)',
    id: 'key',
    blurb:
      'A named stretch of the spectrum. A band is not assigned one: Band.region_for() picks whichever region contains the band centre, so the two can never disagree.',
    fields: [
      { name: 'key / label', type: 'string', req: 'req', note: 'Identity and display name.' },
      { name: 'wn_min / wn_max', type: 'int', req: 'req', note: 'The window. Membership follows from it.' },
    ],
  },
  {
    key: 'tag',
    label: 'Tag',
    status: 'record',
    source: 'data/tags.jsonc',
    id: 'the tag string',
    blurb:
      'A label attached to a band, an assignment or a vibration mode. tags.jsonc is a tooltip lookup only: it does not gate which tags are allowed, so the namespace is open.',
    fields: [
      { name: 'tag', type: 'string', req: 'req', note: 'The exact string as written in the data.' },
      { name: 'tip', type: 'string', req: 'req', note: 'One sentence, shown on the chip. Missing entry means no tooltip, not an error.' },
    ],
    promote: 'One flat namespace holds five different kinds of statement. See Tag roles below.',
  },
  {
    key: 'molecule',
    label: 'Molecule',
    status: 'record',
    source: 'data/vibrations.jsonc',
    id: 'id',
    blurb: 'A molecule on the vibration-modes page, with its shape, its binding geometries and its normal modes.',
    fields: [
      { name: 'id / label', type: 'string', req: 'req', note: 'Identity and display name.' },
      { name: 'species', type: 'string', req: 'req', note: 'Meant to match a band.species string. Not actually checked: validate_vibrations() validates band_groups, topology ids and citekeys, but never species.' },
      { name: 'shape', type: 'linear | nonlinear', req: 'req', note: 'Feeds the 3N−5 / 3N−6 mode count.' },
      { name: 'band_groups[]', type: 'string[]', req: 'opt', note: 'Foreign keys into the groups lookup.' },
      { name: 'topologies[]', type: 'Topology[]', req: 'req', note: 'At least one. Keys the diagram geometry.' },
      { name: 'modes[]', type: 'VibrationMode[]', req: 'opt', note: 'Owned, not referenced.' },
    ],
  },
  {
    key: 'topology',
    label: 'Topology',
    status: 'inline',
    source: 'data/vibrations.jsonc → molecule.topologies[]',
    id: 'id (unique within its molecule)',
    blurb: 'One binding geometry of a molecule: monodentate, bidentate, or just "gas phase". Carries its own point group, because geometry changes it.',
    fields: [
      { name: 'id', type: 'string', req: 'req', note: 'Keys moleculeGeometry.ts alongside the molecule id.' },
      { name: 'short / long', type: 'string', req: 'req', note: 'Selector pill and its tooltip.' },
      { name: 'point_group', type: 'string', req: 'opt', note: 'One of the two fields allowed literal <sub>/<sup> markup.' },
    ],
  },
  {
    key: 'mode',
    label: 'VibrationMode',
    status: 'inline',
    source: 'data/vibrations.jsonc → molecule.modes[]',
    id: 'id',
    blurb:
      'One named normal mode. Bands point up at modes rather than modes listing bands, so the link is authored in exactly one place; category, atoms and often subtype are then derived from the linked bands.',
    fields: [
      { name: 'id / label', type: 'string', req: 'req', note: 'Identity and display name.' },
      { name: 'topology', type: 'string | null', req: 'opt', note: 'null means "applies to every topology". Otherwise a Topology.id on the owning molecule.' },
      { name: 'category / subtype / atoms', type: 'enum', req: 'opt', note: 'Manual fallback only: overwritten from the linked bands when there are any.' },
      { name: 'herzberg_notation / symmetry', type: 'string', req: 'opt', note: 'ν₁ and the Mulliken label. symmetry is the second markup-exempt field.' },
      { name: 'wn_start / wn_end', type: 'float', req: 'opt', note: 'The mode’s own canonical position. Deliberately not validated against the linked bands.' },
      { name: 'reference[]', type: 'string[]', req: 'opt', note: 'Citekeys, validated against references.bib.' },
      { name: 'bands[]', type: 'string[]', req: 'calc', note: 'Computed by _link_modes_to_bands(), including a one-level based_on chase.' },
    ],
  },
];

export const ENTITY_BY_KEY: Record<string, EntitySpec> = Object.fromEntries(
  ENTITIES.map(e => [e.key, e]),
);

/* ---------------------------------------------------------------------------
   Relations
   --------------------------------------------------------------------------- */

export interface RelationSpec {
  from: string;
  to: string;
  /** Read as "one `from` relates to N `to`". */
  card: '1:N' | 'N:1' | 'N:M' | '0..1' | '1:1';
  /** The field that carries the link. */
  via: string;
  note: string;
  /** true when the link only exists because two strings happen to match. */
  weak?: boolean;
}

export const RELATIONS: RelationSpec[] = [
  { from: 'band', to: 'assignment', card: '1:N', via: 'band.references[]', note: 'A band collects one claim per citing paper. 0 for an uncited band.' },
  { from: 'reference', to: 'assignment', card: '1:N', via: 'assignment.key', note: 'One paper can be cited by many bands. This plus the row above is what makes Assignment a join.' },
  { from: 'assignment', to: 'site', card: 'N:M', via: 'assignment.site', note: 'Scalar or array. The array form is why a claim cannot currently pin one wavenumber to one surface.', weak: true },
  { from: 'site', to: 'material', card: 'N:1', via: '(none yet)', note: 'Proposed. A site sits on a material; a material exposes several sites.', weak: true },
  { from: 'assignment', to: 'technique', card: 'N:1', via: 'assignment.tags[]', note: 'A technique tag on the claim. Not enforced, not exclusive.', weak: true },
  { from: 'reference', to: 'author', card: 'N:M', via: 'reference.author', note: 'Parsed at render time, never stored.', weak: true },
  { from: 'band', to: 'group', card: 'N:1', via: 'band.group', note: 'Required, validated. Drives lane order and the default colour dimension.' },
  { from: 'band', to: 'region', card: 'N:1', via: 'Band.region_for(regions)', note: 'Computed from the band centre. Deliberately not stored on the band.' },
  { from: 'band', to: 'species', card: 'N:1', via: 'band.species', note: 'String equality only.', weak: true },
  { from: 'molecule', to: 'species', card: 'N:1', via: 'molecule.species', note: 'String equality against band.species, and unchecked: most molecule species strings match no band at all, because bands.jsonc writes species as a display label and vibrations.jsonc writes it as a formula.', weak: true },
  { from: 'band', to: 'mode', card: 'N:M', via: 'band.vibration_modes[]', note: 'Authored on the band. Usually 0 or 1 entries; 2 for a real degenerate pair.' },
  { from: 'molecule', to: 'mode', card: '1:N', via: 'molecule.modes[]', note: 'Ownership, not reference: a mode belongs to exactly one molecule.' },
  { from: 'molecule', to: 'topology', card: '1:N', via: 'molecule.topologies[]', note: 'At least one per molecule.' },
  { from: 'mode', to: 'topology', card: '0..1', via: 'mode.topology', note: 'null means the mode applies whatever the binding geometry.' },
  { from: 'molecule', to: 'group', card: 'N:M', via: 'molecule.band_groups[]', note: 'Validated against the groups lookup.' },
];

/** Which entities a tag can hang off. Drawn separately: it would cross the whole diagram. */
export const TAG_TARGETS = ['band', 'assignment', 'mode'];

/* ---------------------------------------------------------------------------
   Band-to-band links

   Six of them, all inside one file, each with different reciprocity rules.
   They are documented in schema.py docstrings and nowhere a reader can see.
   --------------------------------------------------------------------------- */

export interface SelfLinkSpec {
  key: string;
  label: string;
  field: string;
  /** How the two ends relate. */
  shape: string;
  note: string;
}

export const SELF_LINKS: SelfLinkSpec[] = [
  {
    key: 'based_on',
    label: 'Built from',
    field: 'based_on[] → band_id | branch_group | label',
    shape: 'directed, N:M, weighted',
    note: 'A combination or overtone points at its parent modes, with a multiplier. Points at a branch_group instead of one band when the parent itself splits into R/P/Q, and carries only a label when the parent is outside the dataset (an IR-inactive ν₁, say).',
  },
  {
    key: 'fermi',
    label: 'Fermi partner',
    field: 'fermi_partner | fermi_partner_group',
    shape: 'symmetric, 1:1 (or group to group)',
    note: 'The two halves of a Fermi doublet. Reciprocal when complete; tag_fermi_pairs() then auto-assigns "fermi-resonance" to both, expanding across branch groups where the group form is used.',
  },
  {
    key: 'branch',
    label: 'Rotational branch siblings',
    field: 'branch_group',
    shape: 'undirected set',
    note: 'Every band sharing a non-null branch_group is a branch of the same vibrational transition: 2-way for R/P, 3-way when Q is IR-allowed. tag_branch_groups() tags all members.',
  },
  {
    key: 'isotopologue',
    label: 'Isotopologue of',
    field: 'isotopologue_of + isotope',
    shape: 'directed, child → parent, no chains',
    note: 'The same normal mode measured on a substituted molecule. Deliberately one-directional: the parent belongs to the ordinary molecule and is not relabelled because someone measured its heavy twin. Only the child gets the "isotopic-shift" tag. Not to be confused with the per-citation "isotope-labeling" tag, which says isotopes were used as evidence for an ordinary band.',
  },
  {
    key: 'pair',
    label: 'Lane pair',
    field: 'pair',
    shape: 'undirected set',
    note: 'Layout only, not chemistry: bands sharing a pair value are packed into the same lane by assign_lanes(). Marked legacy in schema.py.',
  },
];

/* ---------------------------------------------------------------------------
   Tag roles

   tags.jsonc is one flat namespace, but the tags in it make five different
   kinds of statement. Classifying them costs nothing today and is the
   groundwork for splitting the ones that are really fields (technique) or
   really structure (overtone) out of the free-form pile.
   --------------------------------------------------------------------------- */

export type TagRole = 'technique' | 'evidence' | 'caveat' | 'structure' | 'phase' | 'activity' | 'other';

export const TAG_ROLE_LABEL: Record<TagRole, string> = {
  technique: 'Technique',
  evidence: 'Evidence',
  caveat: 'Caveat',
  structure: 'Structure',
  phase: 'Phase / behaviour',
  activity: 'Selection rule',
  other: 'Unclassified',
};

export const TAG_ROLE_NOTE: Record<TagRole, string> = {
  technique: 'How the spectrum was taken. Belongs on the assignment as a field, not as a tag.',
  evidence: 'What backs the claim up. Genuinely per-citation, correctly a tag.',
  caveat: 'A warning about the assignment. Exists at both band and citation level, which is right.',
  structure: 'A fact about the band itself, several of them auto-assigned by build.py from the link fields.',
  phase: 'What the species is doing. A property of the band, arguably of the species.',
  activity: 'IR / Raman selection rule. A property of the mode.',
  other: 'Not yet classified.',
};

export const TAG_ROLES: Record<string, TagRole> = {
  drifts: 'technique',
  ftir: 'technique',
  computational: 'technique',
  'direct-dosing': 'evidence',
  'isotope-labeling': 'evidence',
  'misassignment-warning': 'caveat',
  'drifts-artifact': 'caveat',
  combination: 'structure',
  overtone: 'structure',
  'fermi-resonance': 'structure',
  'rotational-branches': 'structure',
  'isotopic-shift': 'structure',
  degenerated: 'structure',
  'gas-phase': 'phase',
  'molecular-adsorption': 'phase',
  'site-sensitive': 'phase',
  'hydride-marker': 'phase',
  'frustrated-mode': 'phase',
  'ir-active': 'activity',
  'ir-inactive': 'activity',
  'raman-active': 'activity',
};

export function tagRole(tag: string): TagRole {
  return TAG_ROLES[tag] ?? 'other';
}

/* ---------------------------------------------------------------------------
   Measurement technique

   Today three tags carry this: "drifts", "ftir" and "computational". They do
   not describe the same axis. DRIFTS and ATR are sampling geometries; FTIR is
   the interferometer, which almost every one of these measurements uses
   whatever the geometry; and "computational" is not a measurement at all. A
   technique field would separate the two questions a reader actually asks:
   how was the sample presented to the beam, and was this measured or
   calculated.

   The vocabulary below is a proposal, not something the data uses yet. The
   Data model page marks which entries already appear as a tag.
   --------------------------------------------------------------------------- */

export interface TechniqueSpec {
  key: string;
  label: string;
  /** The tag that currently stands in for it, if any. */
  currentTag?: string;
  note: string;
}

export const PROPOSED_TECHNIQUES: TechniqueSpec[] = [
  { key: 'drifts', label: 'DRIFTS', currentTag: 'drifts', note: 'Diffuse reflectance off a powder bed. The workhorse for supported catalysts, and the most common tag in the data.' },
  { key: 'transmission', label: 'Transmission', currentTag: 'ftir', note: 'Self-supporting wafer, beam straight through. What the bare "ftir" tag usually means in practice.' },
  { key: 'atr', label: 'ATR', note: 'Attenuated total reflectance against an internal-reflection crystal. Common for liquid-phase and wet surfaces; not yet in the data.' },
  { key: 'irras', label: 'IRRAS / RAIRS', note: 'Grazing-incidence reflection off a flat single crystal. The surface-science counterpart, relevant for the Fe₃O₄(001) and (111) entries.' },
  { key: 'pm-irras', label: 'PM-IRRAS', note: 'Polarisation-modulated IRRAS, which is where p- and s-polarised components get resolved separately. Exactly the case the multi-valued wn field was added for.' },
  { key: 'emission', label: 'Emission / photoacoustic', note: 'Rarer geometries, listed so the vocabulary is closed rather than open-ended.' },
  { key: 'computational', label: 'Calculated', currentTag: 'computational', note: 'Not a geometry at all: a frequency from a calculation. Arguably a separate "origin" field, measured or calculated, rather than a technique value.' },
];

/* ---------------------------------------------------------------------------
   Site classification

   A heuristic, not a decision. It reads the 30-odd strings currently in the
   site field and proposes what kind of thing each one is, so the split into
   Site and Material starts from a sorted list instead of a blank file. Every
   row is marked sure or guess; nothing here writes back to the data.
   --------------------------------------------------------------------------- */

export type SiteKind =
  | 'metal' | 'cation' | 'oxide' | 'facet' | 'interface' | 'defect' | 'bronsted' | 'material';

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  metal: 'Reduced metal',
  cation: 'Cation',
  oxide: 'Oxide surface',
  facet: 'Facet',
  interface: 'Interface',
  defect: 'Defect ensemble',
  bronsted: 'Brønsted site',
  material: 'Material',
};

export const SITE_KIND_NOTE: Record<SiteKind, string> = {
  metal: 'A metal atom in the zero oxidation state, e.g. Cu⁰.',
  cation: 'A Lewis-acidic cation at a stated oxidation state, e.g. Zn²⁺.',
  oxide: 'An oxide surface named by its formula, e.g. TiO₂. One metal element.',
  facet: 'A specific crystallographic termination, e.g. Fe₃O₄(001).',
  interface: 'The boundary between two phases, e.g. Pt⁰-CeO₂.',
  defect: 'A named defect or ensemble around one, e.g. Zn–Vₒ–Hf.',
  bronsted: 'A proton-donating surface hydroxyl.',
  material: 'Not a site at all: a whole sample, with an active phase and a support.',
};

/** Element symbols that turn up in site and species strings. Parsing only. */
const ELEMENT_SYMBOLS = new Set([
  'H', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br',
  'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I',
  'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Sm', 'Eu', 'Gd', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir',
  'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Th', 'U',
]);

const NON_METALS = new Set(['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Se', 'Br', 'I', 'Si', 'B']);

const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Strip everything that is not part of a formula, so the element scan does not
 * read words as symbols. Parenthesised text goes first: without that,
 * "H⁺ (Brønsted)" yields bromine.
 */
function plainFormula(value: string): string {
  const withoutWords = value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/Vₒ|V_O/g, ' ');       // an oxygen vacancy, not vanadium
  return [...withoutWords]
    .filter(c => !SUP_DIGITS.includes(c) && !SUB_DIGITS.includes(c))
    .join('')
    .replace(/["'⁺⁻]/g, '');
}

/** Element symbols appearing in a site or species string, in order, deduplicated. */
export function elementsOf(value: string): string[] {
  const out: string[] = [];
  for (const m of plainFormula(value).matchAll(/[A-Z][a-z]?/g)) {
    const sym = m[0];
    if (ELEMENT_SYMBOLS.has(sym) && !out.includes(sym)) out.push(sym);
  }
  return out;
}

export interface SiteClass {
  kind: SiteKind;
  /** false when the rule that fired is a fallback rather than a positive match. */
  sure: boolean;
}

export function classifySite(value: string): SiteClass {
  const v = value.trim();
  if (/interface/i.test(v)) return { kind: 'interface', sure: true };
  if (/\(\d{3}\)/.test(v)) return { kind: 'facet', sure: true };
  if (/brønsted|bronsted/i.test(v) || /^H⁺/.test(v)) return { kind: 'bronsted', sure: true };
  if (/Vₒ|V_O|vacancy/i.test(v)) return { kind: 'defect', sure: true };
  // Cu⁰, Pd⁰ — a bare element carrying an explicit zero charge.
  if (/^[A-Z][a-z]?⁰$/.test(v)) return { kind: 'metal', sure: true };
  // Cu⁺, Zn²⁺, Hf⁴⁺ — a bare element carrying an explicit charge.
  if (new RegExp(`^[A-Z][a-z]?[${SUP_DIGITS}]*[⁺⁻]$`).test(v)) return { kind: 'cation', sure: true };
  // Anything written as a composite (Cu/ZnO, La-Al₂O₃) is a sample, not a site.
  if (/[/]/.test(v) || /[-–]/.test(v)) return { kind: 'material', sure: true };

  const els = elementsOf(v);
  // One element plus oxygen is a simple oxide (TiO₂, SiO₂); several is a mixed
  // oxide, which is a sample rather than a site (CuGaZrOx).
  const others = els.filter(e => e !== 'O');
  if (els.includes('O') && others.length === 1) return { kind: 'oxide', sure: true };
  if (els.includes('O') && others.length >= 2) return { kind: 'material', sure: true };
  // A bare element symbol with no charge given: metallic, most likely.
  if (others.length === 1 && !NON_METALS.has(others[0])) return { kind: 'metal', sure: false };
  return { kind: 'material', sure: false };
}

/* ---------------------------------------------------------------------------
   Live analysis
   --------------------------------------------------------------------------- */

/** One distinct value of a string-valued entity, with everywhere it is used. */
export interface ValueRow {
  value: string;
  /** Number of times the value is used (assignments for a site, bands for a species…). */
  uses: number;
  bands: string[];
  refs: string[];
  /** Site only. */
  kind?: SiteKind;
  sure?: boolean;
  elements?: string[];
  /** Species only: the molecule id whose species string matches, if any. */
  molecule?: string | null;
  /** Tag only. */
  role?: TagRole;
  scopes?: string[];
  hasTip?: boolean;
}

export interface ModelStats {
  /** Instance count per entity key, for the diagram boxes. */
  counts: Record<string, number>;
  sites: ValueRow[];
  species: ValueRow[];
  authors: ValueRow[];
  techniques: ValueRow[];
  tags: ValueRow[];
  /** Integrity checks that the build does not currently make. */
  checks: { label: string; detail: string; hits: string[] }[];
}

function push(map: Map<string, ValueRow>, value: string, band?: string, ref?: string): ValueRow {
  let row = map.get(value);
  if (!row) {
    row = { value, uses: 0, bands: [], refs: [] };
    map.set(value, row);
  }
  row.uses += 1;
  if (band && !row.bands.includes(band)) row.bands.push(band);
  if (ref && !row.refs.includes(ref)) row.refs.push(ref);
  return row;
}

const asArray = <T,>(v: T | T[] | null | undefined): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

const byUses = (a: ValueRow, b: ValueRow) => b.uses - a.uses || a.value.localeCompare(b.value);

/** Last names out of a BibTeX author field, same splitting rule as citations.ts. */
function authorNames(raw: string): string[] {
  return raw
    .split(/\s+and\s+/i)
    .map(a => a.replace(/[{}]/g, '').trim())
    .filter(Boolean);
}

export function analyse(
  dataset: Dataset,
  refs: RefMap,
  vibrations: Vibrations,
  tagTips: Record<string, { tip: string }>,
): ModelStats {
  const bands: Band[] = dataset.bands;
  const sites = new Map<string, ValueRow>();
  const species = new Map<string, ValueRow>();
  const authors = new Map<string, ValueRow>();
  const techniques = new Map<string, ValueRow>();
  const tags = new Map<string, ValueRow>();

  const tagScope = (value: string, scope: string, band?: string) => {
    const row = push(tags, value, band);
    row.scopes = row.scopes ?? [];
    if (!row.scopes.includes(scope)) row.scopes.push(scope);
    row.role = tagRole(value);
    row.hasTip = Boolean(tagTips[value]);
  };

  let assignments = 0;
  const multiSite: string[] = [];
  const ambiguousClaim: string[] = [];
  const uncited: string[] = [];

  for (const b of bands) {
    push(species, b.species, b.id);
    for (const t of b.tags) tagScope(t, 'band', b.id);
    if (b.references.length === 0) uncited.push(b.id);
    for (const r of b.references) {
      assignments += 1;
      const siteValues = asArray(r.site);
      const wnValues = asArray(r.wn);
      if (siteValues.length > 1) multiSite.push(`${b.id} · ${r.key}`);
      if (siteValues.length > 1 && wnValues.length > 1) ambiguousClaim.push(`${b.id} · ${r.key}`);
      for (const s of siteValues) push(sites, s, b.id, r.key);
      for (const t of r.tags) {
        tagScope(t, 'assignment', b.id);
        if (tagRole(t) === 'technique') push(techniques, t, b.id, r.key);
      }
    }
  }

  const moleculeBySpecies = new Map<string, string>();
  let modes = 0;
  let topologies = 0;
  for (const m of vibrations.molecules) {
    moleculeBySpecies.set(m.species, m.id);
    topologies += m.topologies.length;
    modes += m.modes.length;
    for (const mode of m.modes) for (const t of mode.tags) tagScope(t, 'mode');
  }
  for (const row of species.values()) row.molecule = moleculeBySpecies.get(row.value) ?? null;

  for (const [key, entry] of Object.entries(refs ?? {})) {
    for (const name of authorNames(entry['author'] ?? '')) push(authors, name, undefined, key);
  }

  for (const row of sites.values()) {
    const c = classifySite(row.value);
    row.kind = c.kind;
    row.sure = c.sure;
    row.elements = elementsOf(row.value);
  }

  const siteRows = [...sites.values()].sort(byUses);
  const materialRows = siteRows.filter(r => r.kind === 'material');

  // Site strings whose element also turns up inside a material string. These
  // are exactly the pairs a materials file would have to declare explicitly.
  const impliedBySample: string[] = [];
  for (const s of siteRows) {
    if (s.kind === 'material') continue;
    const el = (s.elements ?? [])[0];
    if (!el) continue;
    const hosts = materialRows.filter(m => (m.elements ?? []).includes(el));
    if (hosts.length) impliedBySample.push(`${s.value} ⊂ ${hosts.map(h => h.value).join(', ')}`);
  }

  const checks = [
    {
      label: 'Site values that are really materials',
      detail:
        'A whole sample written into the site field. Under a Site/Material split these move to the material side and their real sites get named.',
      hits: materialRows.map(r => `${r.value} (${r.uses}×)`),
    },
    {
      label: 'Sites implied by a material, not stated',
      detail:
        'The site string names an element that also appears in a material string. Today nothing connects the two, so a query for the site misses every band cited on the sample.',
      hits: impliedBySample,
    },
    {
      label: 'Claims with several sites',
      detail:
        'One citation, several surfaces. Fine as a claim, but it means the site cannot be paired with one wavenumber.',
      hits: multiSite,
    },
    {
      label: 'Claims with several sites and several wavenumbers',
      detail:
        'Ambiguous today: nothing says which peak was seen on which surface. Splitting the assignment into one row per claim resolves it.',
      hits: ambiguousClaim,
    },
    {
      label: 'Molecules whose species string matches no band',
      detail:
        'The two files spell the same species differently, and nothing checks it, so the band ↔ molecule bridge silently does not exist for these. The explicit band.vibration_modes link is what actually holds the vibration-modes page together.',
      hits: vibrations.molecules
        .filter(m => !species.has(m.species))
        .map(m => `${m.id} → "${m.species}"`),
    },
    {
      label: 'Tags with no tooltip in tags.jsonc',
      detail: 'Renders without a tooltip rather than failing. The file is a lookup, not a gate.',
      hits: [...tags.values()].filter(t => !t.hasTip).map(t => t.value),
    },
    {
      label: 'Bands with no citation yet',
      detail: 'Drawn grey in the chart. Not an error, just the state of the work.',
      hits: uncited,
    },
  ];

  const counts: Record<string, number> = {
    band: bands.length,
    assignment: assignments,
    reference: Object.keys(refs ?? {}).length,
    site: siteRows.filter(r => r.kind !== 'material').length,
    material: materialRows.length,
    species: species.size,
    author: authors.size,
    technique: techniques.size,
    group: Object.keys(dataset.groups).length,
    region: Object.keys(dataset.regions).length,
    tag: tags.size,
    molecule: vibrations.molecules.length,
    topology: topologies,
    mode: modes,
  };

  return {
    counts,
    sites: siteRows,
    species: [...species.values()].sort(byUses),
    authors: [...authors.values()].sort(byUses),
    techniques: [...techniques.values()].sort(byUses),
    tags: [...tags.values()].sort(byUses),
    checks,
  };
}

/**
 * The atlas data model, written down.
 *
 * The atlas is a handful of small databases that reference each other:
 * bands.jsonc, species.jsonc, surfaces.jsonc, vibrations.jsonc, references.bib
 * and tags.jsonc, plus two lookups (groups, regions) inside bands.jsonc. This
 * module states what each of them holds, how the records link up, what the
 * cardinality of each link is, and which links the build actually enforces.
 *
 * Two halves:
 *   1. The *specification* below (ENTITIES, RELATIONS, SELF_LINKS, TAG_ROLES,
 *      TECHNIQUES). Hand-authored, the single source of truth for the page's
 *      prose.
 *   2. `analyse()`, which reads the live JSON and fills the specification in
 *      with real counts, per-record usage and the integrity checks the build
 *      does not make yet.
 *
 * Keep this in step with schema.py and types.ts: adding a field there means
 * adding it here, same as the JSONC preambles.
 */

import type { Band, Dataset, RefMap, SurfaceLevel, Vibrations, Spectroscopy } from './types';

/* ---------------------------------------------------------------------------
   Specification
   --------------------------------------------------------------------------- */

/**
 * How real an entity is.
 *   record:  has its own object with a key, in its own data file
 *   lookup:  has its own object with a key, nested in another file's header
 *   inline:  a structured object owned by its parent
 *   enum:    a closed vocabulary in schema.py, validated but not a table
 *   string:  only ever a repeated bare string, no record anywhere
 *   derived: never authored, computed at load or render time
 */
export type EntityStatus = 'record' | 'lookup' | 'inline' | 'enum' | 'string' | 'derived';

export const STATUS_LABEL: Record<EntityStatus, string> = {
  record: 'Record',
  lookup: 'Lookup',
  inline: 'Inline',
  enum: 'Enum',
  string: 'Bare string',
  derived: 'Derived',
};

export const STATUS_NOTE: Record<EntityStatus, string> = {
  record: 'Own object with its own key, in its own data file. The build fails on an unresolved key.',
  lookup: 'Own object with a key, but nested in another file’s header block.',
  inline: 'A structured object, but owned by its parent rather than stored on its own.',
  enum: 'A closed vocabulary in schema.py. Validated, but it carries no attributes of its own.',
  string: 'Only ever a repeated bare string. Nothing can be attached to it, nothing validates it.',
  derived: 'Never authored. Computed from other records at load or render time.',
};

/** Statuses in order of how formal they are, for the map legend. */
export const STATUS_ORDER: EntityStatus[] = ['record', 'lookup', 'inline', 'enum', 'string', 'derived'];

export interface FieldSpec {
  name: string;
  type: string;
  /** required | optional | computed */
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
  /** What one instance of this is. */
  blurb: string;
  fields: FieldSpec[];
  /** What is still open about this entity, if anything. */
  open?: string;
}

export const ENTITIES: EntitySpec[] = [
  {
    key: 'band',
    label: 'Band',
    status: 'record',
    source: 'data/bands.jsonc',
    id: 'id, built from what the band is and never from where it sits',
    blurb:
      'One vibrational feature of one species, with the wavenumber window it is reported in. The hub of the whole dataset.',
    fields: [
      { name: 'id', type: 'string', req: 'req', note: 'Species, mode and whatever qualifier separates it from its siblings. Never a wavenumber: the position gets refined, and an id that encodes it forces a rename every time. Referenced by based_on, fermi_partner and isotopologue_of.' },
      { name: 'species', type: 'species key', req: 'req', note: 'Into species.jsonc. The chemical identity only.' },
      { name: 'phase', type: 'gas | adsorbed | surface', req: 'opt', note: 'Omitted on purpose when the band covers both the free molecule and its adsorbed form. Derives no tag: the phase chips come from the claims’ own state.' },
      { name: 'topology', type: 'topology id', req: 'opt', note: 'Binding geometry, as a Topology declared by this species’ molecule in vibrations.jsonc.' },
      { name: 'group', type: 'group key', req: 'req', note: 'Into the groups lookup. Drives lane order and the default colour dimension.' },
      { name: 'vibration', type: '{category, subtype, branch, j}', req: 'req', note: 'Three closed enums and one integer, validated in schema.py.' },
      { name: 'atoms', type: 'string', req: 'req', note: 'Bond environment (O=C=O, M-O, diverse). Drives the atoms colormap.' },
      { name: 'wn_start / wn_end', type: 'int', req: 'req', note: 'The band’s window in cm⁻¹. wn_min/max/center derive from it.' },
      { name: 'short / description', type: 'string', req: 'opt', note: 'Label, and the general description: what the mode is and what it is confused with, 120 words at most.' },
      { name: 'references[]', type: 'Assignment[]', req: 'opt', note: 'The per-source claims. See the Assignment entity.' },
      { name: 'based_on[]', type: 'BasedOn[]', req: 'opt', note: 'Parent modes of a combination or overtone, with a multiplier.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Free-form, but most of the ones in use are derived by build.py from a field and must not be authored. DERIVED_TAGS below is the list.' },
      { name: 'intensity / width / confidence', type: 'enum', req: 'opt', note: 'Observation-dependent, but still authored on the band. See what is still open.' },
      { name: 'vibration_modes[]', type: 'mode id[]', req: 'opt', note: 'Link up into vibrations.jsonc. Back-filled for derived bands.' },
      { name: 'lane / sub_lane', type: 'int', req: 'calc', note: 'Set in place by layout.py, not authored.' },
    ],
    open:
      'intensity, width and confidence describe an observation but are authored once per band. They belong on the assignment, with the band keeping a rollup for the chart.',
  },
  {
    key: 'assignment',
    label: 'Assignment',
    status: 'inline',
    source: 'data/bands.jsonc → band.references[]',
    id: 'uid, computed as "<band id>::<citekey>"',
    blurb:
      'One paper’s claim about one band: the wavenumber it reports, the surface it saw it on, how it was measured, the caveat it attaches. The join between Band and Reference, and the home of everything observation-dependent.',
    fields: [
      { name: 'key', type: 'citekey', req: 'req', note: 'Into references.bib.' },
      { name: 'wn', type: 'int | int[]', req: 'opt', note: 'This source’s reported position. An array means several resolved components.' },
      { name: 'measured_on', type: 'surface key | surface key[]', req: 'opt', note: 'Into surfaces.jsonc, at whatever scale the paper stated. A paper naming both the site and the catalyst gets both keys; one naming only the catalyst gets one, and that is a complete record of what it said.' },
      { name: 'technique', type: 'enum', req: 'opt', note: 'How the spectrum was taken. Derives two tags: its own name, and the family it belongs to (infrared, raman, computational), so the legend can ask "seen in the infrared at all" without ticking seven chips.' },
      { name: 'laser_nm', type: 'number', req: 'opt', note: 'Raman excitation wavelength in nm, recorded only where the source names the line. Derives two chips, the colour family and the line itself ("green laser", "515 nm"), both coloured from the light rather than from a fixed table, since a wavelength is a number and no vocabulary can hold one. Only meaningful on a Raman technique, raman or srs; the build warns otherwise.' },
      { name: 'state', type: 'gas | liquid | matrix | solid | adsorbed', req: 'opt', note: 'What was in the beam for this claim, and every claim should carry one. Not band.phase, which says what the band is wherever it appears: this says how the sample was held here, and it moves the number. Methanol’s O-H stretch is 3687 cm⁻¹ as a vapour, near 3300 hydrogen-bonded in the liquid and 3690 isolated in solid neon; without the field those read as a disagreement instead of three experiments. Derives a tag of the same name.' },
      { name: 'note', type: 'string', req: 'opt', note: 'What this one paper reported, ≤150 words. Conditions still live here as prose.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Scoped to this claim, not the band.' },
      { name: 'uid', type: 'string', req: 'calc', note: 'Computed by build.py, with an ordinal when one paper makes several claims about the same band.' },
    ],
    open:
      'Reaction conditions (temperature, pressure, feed, pretreatment) are still prose inside note. Structuring them only pays off with several times the current number of claims.',
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
    key: 'vibration',
    label: 'Vibration',
    status: 'inline',
    source: 'data/bands.jsonc → band.vibration',
    id: 'none (one per band)',
    blurb:
      'What the band’s atoms are doing: the motion, its symmetry, which rotational branch of it this band is, and which rotational level that branch starts from. Three closed enums and one integer in one object, validated in schema.py; the enums make it the only descriptor on a band that is fully vocabulary-controlled.',
    fields: [
      { name: 'category', type: 'stretch | bend | combination | lattice | electronic | rotational', req: 'req', note: 'An overtone is not a category: it uses the parent’s and adds the "overtone" tag. Two of these are not normal modes. `electronic` is a defect-to-conduction-band transition that absorbs across the infrared. `rotational` is a pure rotation, where nothing vibrates at all: Raman reaches it directly through the polarizability, and since only ΔJ = +2 arises for pure rotation such a band is always an S branch.' },
      { name: 'subtype', type: 'symmetric | asymmetric | scissoring | rocking | wagging | twisting', req: 'opt', note: 'Never on a combination, which is not itself symmetric or asymmetric.' },
      { name: 'branch', type: 'O | P | Q | R | S', req: 'opt', note: 'Which rotational branch, as ΔJ from the band centre: O = −2, P = −1, Q = 0, R = +1, S = +2. The infrared reaches ΔJ = 0, ±1 only (P, Q, R), so an O or S band on infrared-only claims is a contradiction the build warns about. Raman reaches ±2 as well, but which of the five it shows depends on the rotor: O, Q, S for a linear molecule in a non-degenerate vibration, all five for a symmetric or spherical top. Set together with branch_group, and only on bands of a freely turning molecule.' },
      { name: 'j', type: 'integer ⩾ 0', req: 'opt', note: 'The rotational level the transition starts from, set only where a source resolves one line instead of a branch envelope. With it the band is labelled S(3); without it the label is the bare branch letter and the band is the whole envelope. Worth using where the lines are genuinely apart (H₂, B ≈ 59 cm⁻¹) and not where they blur into a tail (N₂, B ≈ 2 cm⁻¹). Requires branch.' },
    ],
  },
  {
    key: 'atoms',
    label: 'Atoms',
    status: 'string',
    source: 'data/bands.jsonc → band.atoms',
    id: 'none (the string is the identity)',
    blurb:
      'Which atoms actually move: the bond environment, written as a small formula (O=C=O, C-H, M-O, M-O-C), with "diverse" for a combination whose parents involve unrelated groups, or for an electronic band where no atom moves at all. Drives the atoms colormap and the chip on the vibration-modes page.',
    fields: [
      { name: '(the string)', type: 'string', req: 'req', note: 'Free text. Nothing validates it, so a new spelling silently gets the fallback colour instead of failing.' },
    ],
    open:
      'The obvious next record: a table keyed by the string, carrying the elements that move (C, O, H) and a flag for the generic metal M. That would validate the spelling, and would answer "every band whose moving atoms include H". Keep those elements a separate axis from a sample’s elements though: carbon in the bond and copper in the catalyst are different questions, and merging them into one Element filter would mislead.',
  },
  {
    key: 'species',
    label: 'Species',
    status: 'record',
    source: 'data/species.jsonc',
    id: 'key',
    blurb:
      'The chemical identity a band belongs to, and nothing else. The old free-text label carried five facts at once (identity, phase, binding geometry, isotopologue, sometimes the site); each of those now has its own field.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'ASCII identifier, referenced by band.species.' },
      { name: 'label', type: 'string', req: 'req', note: 'Display name, Unicode. Resolved by lib/labels.ts wherever a band is named.' },
      { name: 'formula', type: 'string', req: 'req', note: 'Unicode formula. A trailing * marks a surface species.' },
      { name: 'molecule', type: 'molecule id | null', req: 'opt', note: 'Into vibrations.jsonc. Authored here and only here: Molecule.species is computed back from it.' },
      { name: 'note', type: 'string', req: 'opt', note: 'For a distinction the label cannot carry (the two hydroxyls).' },
    ],
  },
  {
    key: 'surface',
    label: 'Surface',
    status: 'record',
    source: 'data/surfaces.jsonc',
    id: 'key',
    blurb:
      'Where a band was measured, at whatever scale the paper stated. One table rather than a Site table and a Material table, because the same entry genuinely plays both roles: TiO₂ is the sample when a paper measures bare titania and a constituent when that titania supports Pt. `level` records how specific the entry is (site, phase, sample), and the badge is drawn from it: a site is filled, a phase or sample hollow.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'ASCII, element plus charge for a site (cu_1p). Element-symbol keys here always mean the element.' },
      { name: 'label', type: 'string', req: 'req', note: 'Display text, Unicode (Cu⁺).' },
      { name: 'level', type: 'site | phase | sample', req: 'req', note: 'How specific this entry is. A site is the atom-scale spot, a phase a constituent named by composition, a sample what was in the cell.' },
      { name: 'kind', type: 'enum', req: 'opt', note: 'Sites only: metal | cation | defect | interface | bronsted.' },
      { name: 'element / oxidation_state', type: 'string / int', req: 'opt', note: 'On a site. What makes "every Cu site regardless of oxidation state" answerable.' },
      { name: 'formula / composition', type: 'string', req: 'opt', note: 'The phase’s formula, or the sample as the literature writes it. Deliberately not parsed.' },
      { name: 'elements[]', type: 'symbol[]', req: 'opt', note: 'What this entry alone contains, authored rather than parsed out of the composition string.' },
      { name: 'facet', type: 'string', req: 'opt', note: 'Crystallographic termination, on a single crystal. It narrows a phase — a cut oxide is still that oxide — and never sits on a site.' },
      { name: 'parts[]', type: 'surface key[]', req: 'opt', note: 'The single containment link, pointing down the scale: a sample lists its phases and sites, a phase the sites within it, a composite site the simpler sites it is built from. It is what lets a site query reach the bands whose paper named only the catalyst.' },
      { name: 'all_elements[]', type: 'symbol[]', req: 'calc', note: 'elements unioned over the whole parts tree, computed by build.py. What the Element view runs against, so a band assigned to Zr⁴⁺ on CuGaZrOx answers a query for Cu.' },
    ],
    open:
      'A phase’s parts are mostly empty: TiO₂ really means a Ti⁴⁺ or a surface O, but those site records are only worth adding when a paper actually distinguishes them.',
  },
  {
    key: 'technique',
    label: 'Technique',
    status: 'enum',
    source: 'schema.py → VALID_TECHNIQUES',
    id: 'the enum value',
    blurb:
      'How the spectrum was taken. Used to be three tags mixed in with evidence and caveat tags; it is a field on the assignment now, with a closed vocabulary.',
    fields: [
      { name: '(value)', type: 'enum', req: 'opt', note: 'One per claim. Derives the tag chip the chart legend filters on.' },
    ],
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
    open: 'Cheap to derive in build.py if a "who reports what" view is ever wanted. Nothing depends on it today, so it stays underived.',
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
    key: 'set',
    label: 'Set',
    status: 'lookup',
    source: 'data/bands.jsonc → sets',
    id: 'key',
    blurb:
      'A named selection of groups, offered by the band chart\u2019s filter. Which families belong to one question is an editorial judgement about the dataset, the same kind of statement as a group\u2019s colour, so it lives with the data rather than in the frontend.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'ASCII identifier. Nothing points at a set: it is a view over the groups, not a property of a band.' },
      { name: 'label', type: 'string', req: 'req', note: 'What the filter shows.' },
      { name: 'groups[]', type: 'group key[]', req: 'req', note: 'The groups this set turns on. Validated; an empty set is an error, since it would render as a filter that hides everything.' },
      { name: 'note', type: 'string', req: 'opt', note: 'One sentence under the selector, saying what the set leaves out and why.' },
      { name: 'phases[]', type: 'phase enum[]', req: 'opt', note: 'Keeps only bands of these phases while the set is active; a band with no phase applies to both forms and stays. For groups that hold the free molecule and its adsorbed form alike (co2, methanol_product): the Gases + Fluids set uses it to drop their adsorbed bands.' },
    ],
    open:
      '"All groups" is built into the filter rather than authored here, and a selection that matches no set shows as "Custom". Neither is a record.',
  },
  {
    key: 'lane',
    label: 'Lane',
    status: 'lookup',
    source: 'data/bands.jsonc → lanes',
    id: 'position in the list',
    blurb:
      'One row of the chart, naming the groups that share it. Two groups share a row when they read as one family on screen: CO with CH₄, methoxy with the methanol it turns into.',
    fields: [
      { name: '(the list)', type: 'group key[]', req: 'req', note: 'Every group sits in exactly one lane, and the build fails otherwise. Order in the file is order on screen, top to bottom.' },
    ],
    open:
      'This replaced a per-band `pair` integer that said the same thing 92 times over and left the row order falling out of the numbering rather than being written down.',
  },
  {
    key: 'region',
    label: 'Region',
    status: 'derived',
    source: 'data/bands.jsonc → regions (membership is computed)',
    id: 'key',
    blurb:
      'A named stretch of the spectrum. A band is not assigned one: Band.region_for() picks whichever region contains the band centre, so the two can never disagree. The pattern the rest of the model copies.',
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
      'A label attached to a band, an assignment or a vibration mode. tags.jsonc is a tooltip lookup only: it does not gate which tags are allowed, so the namespace stays open.',
    fields: [
      { name: 'tag', type: 'string', req: 'req', note: 'The exact string as written in the data.' },
      { name: 'tip', type: 'string', req: 'req', note: 'One sentence, shown on the chip. A missing entry means no tooltip, not an error.' },
    ],
    open: 'One flat namespace still holds six different kinds of statement. Half of them are now derived from fields rather than authored.',
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
      { name: 'species', type: 'species key', req: 'calc', note: 'Computed: back-filled from Species.molecule, so the two files cannot drift.' },
      { name: 'shape', type: 'linear | nonlinear', req: 'req', note: 'Feeds the 3N−5 / 3N−6 mode count.' },
      { name: 'band_groups[]', type: 'group key[]', req: 'opt', note: 'Into the groups lookup.' },
      { name: 'topologies[]', type: 'Topology[]', req: 'req', note: 'At least one. Keys the diagram geometry, and now also band.topology.' },
      { name: 'modes[]', type: 'VibrationMode[]', req: 'opt', note: 'Owned, not referenced.' },
    ],
  },
  {
    key: 'topology',
    label: 'Topology',
    status: 'inline',
    source: 'data/vibrations.jsonc → molecule.topologies[]',
    id: 'id (unique within its molecule)',
    blurb:
      'One binding geometry of a molecule: monodentate, bidentate, linear, bridged, and so on. Carries its own point group, because geometry changes it. Now does double duty as the vocabulary for band.topology.',
    fields: [
      { name: 'id', type: 'string', req: 'req', note: 'Keys moleculeGeometry.ts alongside the molecule id, and referenced by band.topology.' },
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
      { name: 'topology', type: 'topology id | null', req: 'opt', note: 'null means "applies to every topology".' },
      { name: 'category / subtype / atoms', type: 'enum', req: 'opt', note: 'Manual fallback only: overwritten from the linked bands when there are any.' },
      { name: 'ir_active / raman_active', type: 'bool', req: 'opt', note: 'The selection-rule tags are derived from these by the loader, never authored.' },
      { name: 'herzberg_notation / symmetry', type: 'string', req: 'opt', note: 'ν₁ and the Mulliken label. symmetry is the second markup-exempt field.' },
      { name: 'wn_start / wn_end', type: 'float', req: 'opt', note: 'The mode’s own canonical position. Deliberately not validated against the linked bands.' },
      { name: 'bands[]', type: 'band id[]', req: 'calc', note: 'Computed by _link_modes_to_bands(), including a one-level based_on chase.' },
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
  /** true when nothing authors it: it falls out of records that already exist. */
  derived?: boolean;
}

export const RELATIONS: RelationSpec[] = [
  { from: 'band', to: 'assignment', card: '1:N', via: 'band.references[]', note: 'A band collects one claim per citing paper. 0 for an uncited band.' },
  { from: 'reference', to: 'assignment', card: '1:N', via: 'assignment.key', note: 'One paper can be cited by many bands. This plus the row above is what makes Assignment a join.' },
  { from: 'assignment', to: 'surface', card: 'N:M', via: 'assignment.measured_on', note: 'Scalar or array, at any level. An array means one source named several surfaces: both the site and the catalyst, or two samples it compared.' },
  { from: 'surface', to: 'surface', card: 'N:M', via: 'surface.parts[]', note: 'Containment, pointing down the scale: a sample lists its phases and sites, a phase the sites within it, a composite site (an interface, a defect ensemble) the simpler sites it is built from. This is what lets a query for Cu⁺ reach the bands whose paper named only Cu/ZnO.' },
  { from: 'assignment', to: 'technique', card: 'N:1', via: 'assignment.technique', note: 'One value per claim, closed vocabulary. Derives the technique tag chip.' },
  { from: 'reference', to: 'author', card: 'N:M', via: 'reference.author', note: 'Parsed at render time, never stored.', weak: true },
  { from: 'band', to: 'species', card: 'N:1', via: 'band.species', note: 'Required and validated. The label and formula are resolved from the record at render time.' },
  { from: 'species', to: 'molecule', card: '1:1', via: 'species.molecule', note: 'Authored on the species side only; Molecule.species is computed back from it. Used to be two unrelated free strings that mostly disagreed.' },
  { from: 'band', to: 'topology', card: 'N:1', via: 'band.topology', note: 'Binding geometry, validated against the topologies this species’ molecule declares.' },
  { from: 'band', to: 'group', card: 'N:1', via: 'band.group', note: 'Required, validated. Drives lane order and the default colour dimension.' },
  { from: 'set', to: 'group', card: 'N:M', via: 'set.groups[]', note: 'A set names the groups it turns on: a saved filter, not a fact about the chemistry.' },
  { from: 'lane', to: 'group', card: '1:N', via: 'lanes[]', note: 'A lane names the groups sharing one row of the chart. Every group is in exactly one lane, validated, and the order in the file is the order on screen.' },
  { from: 'band', to: 'vibration', card: 'N:1', via: 'band.vibration', note: 'Owned, not referenced: one vibration object per band, with three closed enums inside it.' },
  { from: 'band', to: 'atoms', card: 'N:1', via: 'band.atoms', note: 'String equality only, and nothing checks it.', weak: true },
  { from: 'band', to: 'region', card: 'N:1', via: 'Band.region_for(regions)', note: 'Computed from the band centre. Deliberately not stored on the band.', derived: true },
  { from: 'species', to: 'group', card: 'N:M', via: '(the bands that carry both)', note: 'Real, and deliberately not authored. It is N:M rather than N:1 in both directions: CO appears under co, co_metal and co_cation, while carbonyl holds formaldehyde, formyl, hydroxymethyl, methylenebisoxy and acyl. Since every band already names a species and a group, an authored copy could only ever disagree with the bands.', derived: true },
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

   Five of them, all inside one file, each with different reciprocity rules.
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
    note: 'A combination or overtone points at its parent modes, with a multiplier. Points at a branch_group instead of one band when the parent itself splits into branches, and carries only a label when the parent is outside the dataset (an IR-inactive ν₁, say).',
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
    note: 'Every band sharing a non-null branch_group is a branch of the same transition: 2-way for P/R, 3-way with Q, and up to 5-way in Raman, where a symmetric or spherical top adds the ΔJ = ±2 branches O and S. A pure rotational spectrum uses the same key for the lines of its single S branch, one per starting level, and those take the "rotational" tag instead of "rotational-branches". Since it is one transition of one species, the build checks that the siblings agree on species and phase; rotational structure exists only for a freely rotating gas molecule, so an adsorbed sibling is a contradiction rather than a typo. The layout treats a family as one unit, splitting it only where its ΔJ = ±1 and ±2 bands actually run over each other.',
  },
  {
    key: 'isotopologue',
    label: 'Isotopologue of',
    field: 'isotopologue_of + isotope',
    shape: 'directed, child → parent, no chains',
    note: 'The same normal mode measured on a substituted molecule. Deliberately one-directional: the parent belongs to the ordinary molecule and is not relabelled because someone measured its heavy twin. Only the child gets the "isotope" tag. Not to be confused with the per-citation "isotope-labeling" tag, which says isotopes were used as evidence for an ordinary band.',
  },
];

/* ---------------------------------------------------------------------------
   Tag roles

   tags.jsonc is one flat namespace, but the tags in it make six different
   kinds of statement. Half are now derived from a field by build.py rather
   than authored, which is what a tag should be when the fact behind it has a
   proper home.
   --------------------------------------------------------------------------- */

export type TagRole = 'structure' | 'isotope' | 'phase' | 'activity' | 'technique' | 'laser' | 'evidence' | 'caveat' | 'other';

/**
 * Reading order, and the only place it is decided.
 *
 * It falls in two halves, and the legend draws them as two rows (TAG_ROLE_BAND
 * below). First what the band *is*, whoever measured it: what kind of
 * transition it is, whether it is a labelled twin, which selection rule it
 * obeys, and last the caveat, which comes last for the same reason a caveat
 * comes last in a sentence. Then how it was *measured*: the state the sample
 * was in, the technique, the laser that technique used, and what the claim
 * rests on. Everything that renders tags in sequence sorts by this.
 */
export const TAG_ROLE_ORDER: TagRole[] = [
  // What the band is.
  'structure', 'isotope', 'activity', 'caveat',
  // How it was measured.
  'phase', 'technique', 'laser', 'evidence', 'other',
];

/** The two halves of TAG_ROLE_ORDER, as the legend's two rows. */
export type TagBand = 'band' | 'measurement';

/**
 * Which row a role belongs to.
 *
 * The cut is whether the tag would still be true if a different group had
 * measured the band. A combination band stays a combination and an
 * IR-inactive mode stays forbidden; the state the sample was in, the
 * technique and the laser are facts about one experiment. "Untagged" is
 * neither, and trails at the end of the second row.
 */
export const TAG_ROLE_BAND: Record<TagRole, TagBand> = {
  structure: 'band',
  isotope: 'band',
  activity: 'band',
  caveat: 'band',
  phase: 'measurement',
  technique: 'measurement',
  laser: 'measurement',
  evidence: 'measurement',
  other: 'measurement',
};

/**
 * Within a role, the tag named after the role itself leads.
 *
 * Only the isotope role has one: `isotope` says a band is a labelled twin at
 * all, and the three substitutions answer which label. Sorting the umbrella
 * ahead of them by name rather than by count keeps the general chip in front
 * of the specific ones however the counts fall.
 */
export function isUmbrellaTag(tag: string, role: TagRole): boolean {
  // The technique role has three families rather than one umbrella, so the
  // leader is whichever tag names a family: "infrared" ahead of the seven
  // geometries, "raman" ahead of the scattering ones. "raman" is both the
  // family and the generic value, so it leads its own family by being it.
  if (role === 'technique') return TECHNIQUE_FAMILY[tag] === tag || tag === 'infrared';
  return tag === role;
}

/**
 * Technique tag -> the family it belongs to, which is also the umbrella tag
 * derived beside it (loader.py's TECHNIQUE_FAMILY; keep the two in step).
 *
 * The legend puts a gap at each change of family, so the row reads as three
 * groups rather than eleven chips: the infrared geometries, then the Raman
 * ones, then the calculations, which are not a measurement at all.
 */
export const TECHNIQUE_FAMILY_ORDER: Record<string, number> = {
  infrared: 0,
  raman: 1,
  // Last because it is not a measurement: everything above it was seen.
  computational: 2,
};

export const TECHNIQUE_FAMILY: Record<string, 'infrared' | 'raman' | 'computational'> = {
  infrared: 'infrared',
  drifts: 'infrared',
  transmission: 'infrared',
  atr: 'infrared',
  ftir: 'infrared',
  irras: 'infrared',
  pm_irras: 'infrared',
  emission: 'infrared',
  raman: 'raman',
  srs: 'raman',
  computational: 'computational',
};

/** Index of a role in TAG_ROLE_ORDER, for sort comparators. */
export function tagRoleRank(role: TagRole): number {
  const i = TAG_ROLE_ORDER.indexOf(role);
  return i < 0 ? TAG_ROLE_ORDER.length : i;
}

export const TAG_ROLE_LABEL: Record<TagRole, string> = {
  structure: 'Structure',
  isotope: 'Isotope',
  phase: 'Sample state',
  activity: 'Selection rule',
  technique: 'Technique',
  laser: 'Laser',
  evidence: 'Evidence',
  caveat: 'Caveat',
  other: 'Unclassified',
};

export const TAG_ROLE_NOTE: Record<TagRole, string> = {
  structure: 'A fact about the band itself. Mostly derived by build.py from the link fields.',
  isotope: 'The band is a labelled twin of another one, not the ordinary molecule. All derived from band.isotope, with the umbrella tag first and the substitution behind it.',
  phase: 'What was in the beam. Derived from assignment.state, on the claim rather than on the band: a band has no sample of its own, so it shows the union of the states its claims were measured in. Band.phase is an editorial statement about the species, used by the sets, and the build warns where it contradicts the claims underneath it.',
  activity: 'IR / Raman selection rule, derived by the loader from the mode’s booleans.',
  technique: 'How the spectrum was taken. Now derived from assignment.technique.',
  laser: 'Which light the Raman measurement used, grouped by the colour of it and derived from assignment.laser_nm. A role of its own rather than part of the technique: it qualifies one technique rather than naming another, and the chips are coloured from the light itself instead of from the tag table.',
  evidence: 'What backs the claim up. Genuinely per-citation, correctly a tag.',
  caveat: 'A warning about how to read the band: a position that is a known trap, or one that moves with the surface. It goes on the band rather than on a claim, since it is a property of where the band sits and not of the paper that happened to notice. The only role with a colour of its own, because it is the only one that asks the reader to slow down.',
  other: 'Not yet classified.',
};

export const TAG_ROLES: Record<string, TagRole> = {
  // Structure: what the band is.
  fundamental: 'structure',
  combination: 'structure',
  overtone: 'structure',
  'fermi-resonance': 'structure',
  'rotational-branches': 'structure',
  rotational: 'structure',
  // Isotope: the umbrella, then which substitution.
  isotope: 'isotope',
  deuterium: 'isotope',
  'carbon-13': 'isotope',
  'oxygen-18': 'isotope',
  degenerated: 'structure',
  // What the species does on the surface: stays intact rather than
  // dissociating. Still a phase statement, about the form the species is in
  // rather than about the mode, which is why it sits with the phase tags even
  // though it is authored on the band and the state tags are derived from the
  // claims. Not the same as the per-claim "adsorbed": every methoxy claim is
  // adsorbed, and methoxy is not undissociated.
  undissociated: 'phase',
  'frustrated-mode': 'phase',
  // What was in the beam for one claim, from assignment.state, and the whole
  // of the phase vocabulary: a band carries no phase tag of its own, it shows
  // the union of its claims'.
  gas: 'phase',
  liquid: 'phase',
  matrix: 'phase',
  solid: 'phase',
  adsorbed: 'phase',
  // Selection rule.
  'ir-active': 'activity',
  'ir-inactive': 'activity',
  'raman-active': 'activity',
  'raman-inactive': 'activity',
  // How it was measured: the family first, then the values under it.
  infrared: 'technique',
  drifts: 'technique',
  transmission: 'technique',
  atr: 'technique',
  ftir: 'technique',
  irras: 'technique',
  pm_irras: 'technique',
  emission: 'technique',
  raman: 'technique',
  srs: 'technique',
  computational: 'technique',
  'direct-dosing': 'evidence',
  'isotope-labeling': 'evidence',
  // What to watch out for. A site-sensitive band moves with the surface it is
  // on, so a shifted position is not by itself a different species: that is a
  // warning about reading the number, not a statement about the species.
  'misassignment-warning': 'caveat',
  'site-sensitive': 'caveat',
  'to-be-revised': 'caveat',
};

/** Tags build.py or the loader writes from a field. Authoring one is an error. */
export const DERIVED_TAGS: Record<string, string> = {
  infrared: 'assignment.technique',
  drifts: 'assignment.technique',
  transmission: 'assignment.technique',
  atr: 'assignment.technique',
  ftir: 'assignment.technique',
  irras: 'assignment.technique',
  pm_irras: 'assignment.technique',
  emission: 'assignment.technique',
  raman: 'assignment.technique',
  srs: 'assignment.technique',
  // Both levels of it: the claim tag from its own technique, the band tag
  // from every claim on the band having that technique and no other.
  computational: 'assignment.technique',
  gas: 'assignment.state',
  liquid: 'assignment.state',
  matrix: 'assignment.state',
  solid: 'assignment.state',
  adsorbed: 'assignment.state',
  fundamental: 'vibration.category + band.based_on',
  'fermi-resonance': 'band.fermi_partner',
  'rotational-branches': 'band.branch_group',
  rotational: 'band.branch_group + vibration.category',
  isotope: 'band.isotopologue_of',
  deuterium: 'band.isotope',
  'carbon-13': 'band.isotope',
  'oxygen-18': 'band.isotope',
  'ir-active': 'mode.ir_active',
  'raman-active': 'mode.raman_active',
};

/**
 * A Raman excitation wavelength, as the tag chip spells it: "515 nm".
 *
 * This is the one tag that cannot live in TAG_ROLES or TAG_STYLES, because a
 * wavelength is a number rather than a member of a vocabulary. It is matched
 * by shape instead, and coloured from the light itself (lib/lightColor.ts).
 */
const LASER_TAG = /^(\d+(?:\.\d+)?) nm$/;

/** The wavelength in nm if this tag is a laser line, else null. */
export function laserTagNm(tag: string): number | null {
  const m = LASER_TAG.exec(tag);
  return m ? Number(m[1]) : null;
}

/**
 * Laser lines grouped by the colour of the light, so a whole colour can be
 * switched at once rather than one line at a time.
 *
 * The boundaries are the ordinary ones of the visible spectrum, and `nm` is
 * the representative wavelength the family's chip is coloured from. 785 nm
 * comes out as near-infrared rather than red on purpose: the visible range
 * ends near 700 nm, and a 785 nm beam is invisible however red the pointer
 * on the bench looks.
 */
const LASER_FAMILIES: { from: number; to: number; key: string }[] = [
  { from: 250, to: 400, key: 'UV laser' },
  { from: 400, to: 450, key: 'violet laser' },
  { from: 450, to: 495, key: 'blue laser' },
  { from: 495, to: 570, key: 'green laser' },
  { from: 570, to: 590, key: 'yellow laser' },
  { from: 590, to: 620, key: 'orange laser' },
  // Red runs to 790 rather than stopping at the visible edge near 700, so the
  // 785 nm diode that half of Raman is done with lands in red where people
  // actually put it, instead of alone in a near-infrared bucket.
  { from: 620, to: 790, key: 'red laser' },
  { from: 790, to: 1100, key: 'near-infrared laser' },
];

/**
 * The colour a family's chip takes: the midpoint of its own range, not one
 * member's wavelength. A family is a band of the spectrum, so it should look
 * like the middle of that band however few lines happen to sit in it, and it
 * must not change colour when a second line is added.
 */
function familyNm(f: { from: number; to: number }): number {
  return (f.from + f.to) / 2;
}

/** Which colour family a wavelength belongs to. */
export function laserFamily(nm: number): { key: string; nm: number } {
  const f = LASER_FAMILIES.find(x => nm < x.to) ?? LASER_FAMILIES[LASER_FAMILIES.length - 1];
  return { key: f.key, nm: familyNm(f) };
}

/** The representative wavelength if this tag is a family, else null. */
export function laserFamilyNm(tag: string): number | null {
  const f = LASER_FAMILIES.find(x => x.key === tag);
  return f ? familyNm(f) : null;
}

/** Either kind of laser tag: one line, or a whole colour of them. */
export function anyLaserNm(tag: string): number | null {
  return laserTagNm(tag) ?? laserFamilyNm(tag);
}

export function tagRole(tag: string): TagRole {
  // Its own role, sorted immediately after the techniques: the excitation
  // line qualifies one technique rather than naming another, so it reads as a
  // footnote to the group before it rather than a member of it.
  if (anyLaserNm(tag) !== null) return 'laser';
  return TAG_ROLES[tag] ?? 'other';
}

/** Which field the build derived this tag from, or undefined if it is authored. */
export function tagDerivedFrom(tag: string): string | undefined {
  if (anyLaserNm(tag) !== null) return 'assignment.laser_nm';
  return DERIVED_TAGS[tag];
}

/** The tooltip for a tag the build generated, which tags.jsonc cannot key. */
export function generatedTagTip(tag: string): string | undefined {
  if (laserFamilyNm(tag) !== null) {
    return `Every Raman excitation line of this colour. Switching it off takes out the bands whose only Raman claim was measured with one, whatever the exact wavelength.`;
  }
  const nm = laserTagNm(tag);
  if (nm === null) return undefined;
  return `Raman excitation at ${tag}: the laser this claim was measured with, rounded to the nearest nanometre. The chip wears the colour of that light.`;
}

/* ---------------------------------------------------------------------------
   Measurement technique

   DRIFTS and ATR are sampling geometries; FTIR is the interferometer, which
   nearly every one of these measurements uses whatever the geometry, so it is
   not a value here: a claim says how the sample met the beam, or that the
   number was calculated. Mirror of VALID_TECHNIQUES in schema.py.
   --------------------------------------------------------------------------- */

export interface TechniqueSpec {
  key: string;
  label: string;
  /** The tag this technique derives, so the legend chips keep working. */
  tag: string;
  /** Which spectroscopy it is, for the chart's IR/Raman switch; null for a calculation. */
  spectroscopy: Spectroscopy | null;
  note: string;
}

export const TECHNIQUES: TechniqueSpec[] = [
  { key: 'drifts', label: 'DRIFTS', tag: 'drifts', spectroscopy: 'ir', note: 'Diffuse reflectance off a powder bed. The workhorse for supported catalysts.' },
  { key: 'transmission', label: 'Transmission', tag: 'transmission', spectroscopy: 'ir', note: 'Self-supporting wafer, beam straight through.' },
  { key: 'atr', label: 'ATR', tag: 'atr', spectroscopy: 'ir', note: 'Attenuated total reflectance against an internal-reflection crystal. Common for liquid-phase and wet surfaces.' },
  { key: 'ftir', label: 'FTIR', tag: 'ftir', spectroscopy: 'ir', note: 'The placeholder of the infrared family: the source says only that it used FTIR, which names the interferometer rather than the sampling geometry. Distinct from the "infrared" umbrella tag, which every infrared claim carries whatever its geometry: this one says the geometry was never stated. Use it when the paper genuinely does not say, and replace it once it does.' },
  { key: 'irras', label: 'IRRAS', tag: 'irras', spectroscopy: 'ir', note: 'Grazing-incidence reflection off a flat, usually single-crystal sample, in vacuum. The surface selection rule applies: only dipole components along the surface normal absorb, so a mode missing from the spectrum may be lying flat rather than absent.' },
  { key: 'pm_irras', label: 'PM-IRRAS', tag: 'pm_irras', spectroscopy: 'ir', note: 'IRRAS with the polarisation modulated between s and p, which cancels the isotropic gas and window background. It is what makes reflection work outside vacuum.' },
  { key: 'emission', label: 'Emission', tag: 'emission', spectroscopy: 'ir', note: 'The hot sample is the source: no beam is passed through it. Used where a bed is too opaque or too hot for the other geometries.' },
  { key: 'raman', label: 'Raman (unspecified)', tag: 'raman', spectroscopy: 'raman', note: 'Inelastic scattering of a laser rather than absorption: a Raman shift, the same vibrational energy seen through the polarizability. Greyed out in the chart while it is set to IR, as the infrared claims are while it is set to Raman. The placeholder of its family, the way ftir is for the infrared: it says the source named Raman and nothing finer. Use srs where the paper says spontaneous.' },
  { key: 'srs', label: 'Spontaneous Raman', tag: 'srs', spectroscopy: 'raman', note: 'Spontaneous Raman scattering, named explicitly. The specific value under raman, the way DRIFTS and transmission sit under the infrared: the scattering happens by itself from one laser, rather than being driven by a second beam as in the coherent techniques (CARS, stimulated Raman). Use it only where the source says spontaneous; plain raman stays the value for a paper that does not.' },
  { key: 'computational', label: 'Computational', tag: 'computational', spectroscopy: null, note: 'Not a geometry at all: a frequency from a calculation. Arguably a separate origin axis.' },
];

/* ---------------------------------------------------------------------------
   Surface levels and site kinds
   --------------------------------------------------------------------------- */

export const SURFACE_LEVELS: SurfaceLevel[] = ['site', 'phase', 'sample'];

/**
 * Oxidation state in Stock notation: Cu(I), Ga(III), Zr(IV). This is how a
 * chemist writes an oxidation number, and it reads as one — where "(+1)" reads
 * like a charge on an ion, which is a different statement about a lattice
 * cation. Zero has no Roman numeral and is written as the digit, as usual.
 */
export function stockNotation(element: string, oxidationState?: number | null): string {
  if (oxidationState == null) return element;
  if (oxidationState === 0) return `${element}(0)`;
  const n = Math.abs(oxidationState);
  const NUMERALS: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rest = n;
  let roman = '';
  for (const [v, sym] of NUMERALS) {
    while (rest >= v) { roman += sym; rest -= v; }
  }
  // Non-integer or out-of-range states fall back to the number itself rather
  // than silently rendering an empty numeral.
  if (!roman || !Number.isInteger(oxidationState)) return `${element}(${oxidationState})`;
  return `${element}(${oxidationState < 0 ? '−' : ''}${roman})`;
}

export const LEVEL_LABEL: Record<SurfaceLevel, string> = {
  site: 'Site',
  phase: 'Phase',
  sample: 'Sample',
};

export const LEVEL_NOTE: Record<SurfaceLevel, string> = {
  site: 'The atom-scale spot the molecule is bonded to: a cation, a reduced metal atom, a vacancy, a proton, or a named ensemble of those.',
  phase: 'A constituent of a sample, named by composition. Strictly the molecule sits on some site within it, but papers very often report only the phase, and recording that honestly beats guessing.',
  sample: 'What was actually in the cell. The same entry can be a phase or a sample depending on the paper: bare titania is a sample, the titania under Pt is a phase.',
};

/** A kind is a site's own subdivision; a phase and a sample have none. */
export type SiteKind = 'metal' | 'cation' | 'defect' | 'interface' | 'bronsted';

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  metal: 'Reduced metal',
  cation: 'Cation',
  defect: 'Defect',
  interface: 'Interface',
  bronsted: 'Brønsted site',
};

export const SITE_KIND_NOTE: Record<SiteKind, string> = {
  metal: 'A metal atom in the zero oxidation state, e.g. Cu⁰.',
  cation: 'A Lewis-acidic cation at a stated oxidation state, e.g. Zn²⁺.',
  defect: 'A vacancy, or an ensemble built around one.',
  interface: 'The boundary between two phases, e.g. Pt⁰-CeO₂. The one site that may name a phase among its parts.',
  bronsted: 'A proton-donating surface hydroxyl.',
};

/* ---------------------------------------------------------------------------
   Live analysis
   --------------------------------------------------------------------------- */

/** One record of a lookup table, with everywhere it is used. */
export interface ValueRow {
  /** The key as written in the data. */
  value: string;
  /** Display label from the record, falling back to the key. */
  label: string;
  /** Claims (for a site/material/technique) or bands (for a species). */
  uses: number;
  bands: string[];
  refs: string[];
  /** A short characterisation: oxidation state, formula, molecule link. */
  detail?: string;
  kind?: SiteKind;
  /** Surfaces only: how specific this entry is. */
  level?: SurfaceLevel;
  /** Surfaces one scale down, straight off the record. */
  parts?: string[];
  /** Claims that reach this surface only through a coarser one's parts list. */
  viaContainer?: number;
  molecule?: string | null;
  role?: TagRole;
  scopes?: string[];
  hasTip?: boolean;
  derivedFrom?: string;
}

export interface ModelStats {
  counts: Record<string, number>;
  species: ValueRow[];
  /** Every level in one list; the page splits it by `level` where it helps. */
  surfaces: ValueRow[];
  techniques: ValueRow[];
  authors: ValueRow[];
  tags: ValueRow[];
  checks: { label: string; detail: string; hits: string[] }[];
}

const asArray = <T,>(v: T | T[] | null | undefined): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

const byUses = (a: ValueRow, b: ValueRow) => b.uses - a.uses || a.value.localeCompare(b.value);

/** Names out of a BibTeX author field, same splitting rule as citations.ts. */
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
  const speciesTable = dataset.species ?? {};
  const surfaceTable = dataset.surfaces ?? {};

  /** Everything below `key` in the parts tree, the surface itself excluded. */
  const partsBelow = (key: string): string[] => {
    const out = new Set<string>();
    const walk = (k: string) => {
      for (const child of surfaceTable[k]?.parts ?? []) {
        if (out.has(child)) continue;
        out.add(child);
        walk(child);
      }
    };
    walk(key);
    return [...out];
  };

  const mk = (key: string, label: string): ValueRow => ({
    value: key, label, uses: 0, bands: [], refs: [],
  });

  const species = new Map<string, ValueRow>(
    Object.entries(speciesTable).map(([k, v]) => [k, mk(k, v.label)]),
  );
  const surfaces = new Map<string, ValueRow>(
    Object.entries(surfaceTable).map(([k, v]) => [k, mk(k, v.label)]),
  );
  const techniques = new Map<string, ValueRow>(
    TECHNIQUES.map(t => [t.key, mk(t.key, t.label)]),
  );
  const authors = new Map<string, ValueRow>();
  const tags = new Map<string, ValueRow>();

  const touch = (map: Map<string, ValueRow>, key: string, band?: string, ref?: string) => {
    let row = map.get(key);
    if (!row) {
      row = mk(key, key);
      map.set(key, row);
    }
    row.uses += 1;
    if (band && !row.bands.includes(band)) row.bands.push(band);
    if (ref && !row.refs.includes(ref)) row.refs.push(ref);
    return row;
  };

  const tagScope = (value: string, scope: string, band?: string) => {
    const row = touch(tags, value, band);
    row.scopes = row.scopes ?? [];
    if (!row.scopes.includes(scope)) row.scopes.push(scope);
    row.role = tagRole(value);
    row.hasTip = Boolean(tagTips[value]);
    row.derivedFrom = tagDerivedFrom(value);
  };

  let assignments = 0;
  const noSurface: string[] = [];
  const ambiguousClaim: string[] = [];
  const uncited: string[] = [];
  const noPhase: string[] = [];
  const noTechnique: string[] = [];
  const gasWithSurface: string[] = [];
  const caveatOnClaim: string[] = [];

  for (const b of bands) {
    touch(species, b.species, b.id);
    for (const t of b.tags) tagScope(t, 'band', b.id);
    if (b.references.length === 0) uncited.push(b.id);
    if (b.phase == null) noPhase.push(b.id);
    for (const r of b.references) {
      assignments += 1;
      const surfaceKeys = asArray(r.measured_on);
      const siteKeys = surfaceKeys.filter(k => surfaceTable[k]?.level === 'site');
      const wnValues = asArray(r.wn);
      // A gas-phase claim is *supposed* to name nothing, so it is not a gap.
      if (!surfaceKeys.length && b.phase !== 'gas') noSurface.push(r.uid || `${b.id}::${r.key}`);
      if (b.phase === 'gas' && surfaceKeys.length) {
        gasWithSurface.push(`${b.id} → ${surfaceKeys.join(', ')}`);
      }
      if (siteKeys.length > 1 && wnValues.length > 1) ambiguousClaim.push(r.uid || `${b.id}::${r.key}`);
      for (const k of surfaceKeys) touch(surfaces, k, b.id, r.key);
      if (r.technique) touch(techniques, r.technique, b.id, r.key);
      else noTechnique.push(r.uid || `${b.id}::${r.key}`);
      for (const t of r.tags) {
        tagScope(t, 'assignment', b.id);
        // A caveat describes where the band sits, so it is true whoever
        // measured it. On a claim it warns only the readers of that one paper.
        if (tagRole(t) === 'caveat') caveatOnClaim.push(`${b.id} → ${t} (${r.key})`);
      }
    }
  }

  // Claims that reach a surface only through a coarser one they named: the
  // paper said Cu/ZnO, and the parts list is what carries that to Cu⁺. This is
  // the number the containment link exists to make visible.
  for (const b of bands) {
    for (const r of b.references) {
      const direct = new Set(asArray(r.measured_on));
      for (const key of direct) {
        for (const below of partsBelow(key)) {
          if (direct.has(below)) continue;
          const row = surfaces.get(below);
          if (row) row.viaContainer = (row.viaContainer ?? 0) + 1;
        }
      }
    }
  }

  let modes = 0;
  let topologies = 0;
  const topologyIds = new Set<string>();
  for (const m of vibrations.molecules) {
    topologies += m.topologies.length;
    for (const t of m.topologies) topologyIds.add(t.id);
    modes += m.modes.length;
    for (const mode of m.modes) for (const t of mode.tags) tagScope(t, 'mode');
  }

  for (const [key, entry] of Object.entries(refs ?? {})) {
    for (const name of authorNames(entry['author'] ?? '')) touch(authors, name, undefined, key);
  }

  // ── Record detail, read off the tables rather than guessed from a string ──
  for (const [key, row] of species) {
    const rec = speciesTable[key];
    row.detail = rec?.formula ?? '';
    row.molecule = rec?.molecule ?? null;
  }
  for (const [key, row] of surfaces) {
    const rec = surfaceTable[key];
    row.level = rec?.level;
    row.kind = rec?.kind ?? undefined;
    row.parts = rec?.parts ?? [];
    // What characterises the entry differs by level, so read the field that
    // level actually fills: an oxidation state for a site, a formula or
    // composition above it. Suppressed where it would only repeat the label,
    // which is most phases (label "Ga₂O₃", formula "Ga₂O₃"): a column that
    // restates the one beside it reads as noise rather than as information.
    // The facet is deliberately not folded in: a termination is not part of
    // the chemistry, and Fe₃O₄(001) and Fe₃O₄(111) are the same compound cut
    // two ways. Leaving the formula bare is what shows that — the label
    // already carries the cut.
    const formula = rec
      ? rec.level === 'site'
        ? rec.element
          ? stockNotation(rec.element, rec.oxidation_state)
          : ''
        : rec.formula ?? rec.composition ?? ''
      : '';
    row.detail = formula === row.label ? '' : formula;
  }
  for (const t of TECHNIQUES) {
    const row = techniques.get(t.key);
    if (row) row.detail = t.note;
  }

  // ── Integrity checks the build does not make ──
  const molecules = vibrations.molecules;
  const moleculeById = new Map(molecules.map(m => [m.id, m]));

  const branchGroups = new Map<string, Band[]>();
  for (const b of bands) {
    if (b.branch_group) {
      const list = branchGroups.get(b.branch_group) ?? [];
      list.push(b);
      branchGroups.set(b.branch_group, list);
    }
  }
  const branchDisagreements: string[] = [];
  for (const [key, members] of branchGroups) {
    const sp = new Set(members.map(m => m.species));
    const ph = new Set(members.filter(m => m.phase != null).map(m => m.phase));
    if (sp.size > 1) branchDisagreements.push(`${key}: species ${[...sp].join(' vs ')}`);
    if (ph.size > 1) branchDisagreements.push(`${key}: phase ${[...ph].join(' vs ')}`);
  }

  const undeclaredTopology: string[] = [];
  for (const b of bands) {
    if (!b.topology) continue;
    const molId = speciesTable[b.species]?.molecule;
    const declared = molId ? moleculeById.get(molId)?.topologies.map(t => t.id) ?? [] : [];
    if (!declared.includes(b.topology)) {
      undeclaredTopology.push(`${b.id} → ${b.topology} (${molId ?? 'no molecule'})`);
    }
  }

  const unusedSurfaces = [...surfaces.values()]
    .filter(r => r.uses === 0)
    .map(r => `${r.label}${r.viaContainer ? ` (${r.viaContainer} via a container)` : ' (unused)'}`);

  const checks = [
    {
      label: 'Surfaces reached only through a coarser one',
      detail:
        'The claim named the catalyst, not the site, and the parts list is what connects the two. Without it these bands would be invisible to any site query.',
      hits: [...surfaces.values()]
        .filter(r => (r.viaContainer ?? 0) > 0)
        .sort((a, b) => (b.viaContainer ?? 0) - (a.viaContainer ?? 0))
        .map(r => `${r.label}: ${r.viaContainer} claims`),
    },
    {
      label: 'Claims that name no surface',
      detail: 'The source did not say what it was measured on, or the field has not been filled in yet. Gas-phase claims are excluded: naming nothing is the correct answer for them.',
      hits: noSurface,
    },
    {
      label: 'Caveat tags authored on a claim',
      detail:
        'A caveat belongs on the band. It describes where the band sits — a position that is a known trap, or one that moves with the surface — which is true whoever measured it, so on a single claim it warns only the readers of that one paper and is invisible to everyone else.',
      hits: caveatOnClaim,
    },
    {
      label: 'Gas-phase claims that name a surface',
      detail:
        'A free molecule sits on nothing, at any level. The same gas band appears over whatever is in the beam, so a key here answers no query and credits the sample with a band it did not cause. Either the surface belongs in the note, or the claim belongs on an adsorbed band instead.',
      hits: gasWithSurface,
    },
    {
      label: 'Claims with no technique',
      detail: 'Nothing says how the spectrum was taken. These are the ones to check against the paper first.',
      hits: noTechnique,
    },
    {
      label: 'Branch groups that disagree with themselves',
      detail:
        'Branch siblings are one transition of one species, so they must agree on species and phase. Rotational structure also only exists for a freely rotating gas molecule, which makes an adsorbed branch sibling a contradiction rather than a typo. The letters are checked against the evidence separately, by check_branches(): an O or S band is a ΔJ = ±2 step that the infrared cannot reach, so infrared-only claims on one are a contradiction. The mirror is deliberately not checked, because it is not an error: Raman reaches ΔJ = ±1 too whenever the rotor allows it, and methane’s degenerate bands genuinely carry P and R.',
      hits: branchDisagreements,
    },
    {
      label: 'Topologies the molecule does not declare',
      detail:
        'The band names a binding geometry that its species’ molecule has no Topology for, so the vibration-modes page cannot draw it. A to-do for vibrations.jsonc, not an error in the band.',
      hits: undeclaredTopology,
    },
    {
      label: 'Bands with no phase',
      detail:
        'Deliberate where the band covers both the free molecule and its adsorbed form, which is the case for several methanol fundamentals. Worth a look anywhere else.',
      hits: noPhase,
    },
    {
      label: 'Surfaces never named directly',
      detail:
        'Present in the table but never written into a claim. Fine for an entry that only exists inside another one’s parts list.',
      hits: unusedSurfaces,
    },
    {
      label: 'Claims with several sites and several wavenumbers',
      detail:
        'Still ambiguous: nothing says which peak was seen on which site. Splitting the claim into one row per site resolves it.',
      hits: ambiguousClaim,
    },
    {
      label: 'Species with no molecule',
      detail: 'No vibration-modes page for this species yet. Not an error, just work not done.',
      hits: Object.values(speciesTable).filter(s => !s.molecule).map(s => s.label),
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
    // One vibration object per band; atoms counts the distinct strings in use.
    vibration: bands.length,
    atoms: new Set(bands.map(b => b.atoms)).size,
    assignment: assignments,
    reference: Object.keys(refs ?? {}).length,
    species: species.size,
    surface: surfaces.size,
    technique: [...techniques.values()].filter(t => t.uses > 0).length,
    author: authors.size,
    group: Object.keys(dataset.groups).length,
    set: Object.keys(dataset.sets ?? {}).length,
    lane: (dataset.lanes ?? []).length,
    region: Object.keys(dataset.regions).length,
    tag: tags.size,
    molecule: molecules.length,
    topology: topologies,
    mode: modes,
  };

  return {
    counts,
    species: [...species.values()].sort(byUses),
    surfaces: [...surfaces.values()].sort(byUses),
    techniques: [...techniques.values()].sort(byUses),
    authors: [...authors.values()].sort(byUses),
    tags: [...tags.values()].sort(byUses),
    checks,
  };
}

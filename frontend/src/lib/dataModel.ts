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

import type { TechniqueRecord } from './claimFilter';
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
      { name: 'phase', type: 'gas | adsorbed | surface | solution | solid', req: 'opt', note: 'Omitted on purpose when the band covers both the free molecule and its adsorbed form. solution is a species in a liquid, dissolved in it or the liquid itself: CO₂(aq), or the interfacial water an electrode sees. solid is the solid itself rather than anything on it: a lattice phonon, a framework overtone, a bulk defect, whose claims have form lattice. Derives no tag: the phase chips come from the claims’ own state.' },
      { name: 'topology', type: 'topology id', req: 'opt', note: 'Binding geometry, as a Topology declared by this species’ molecule in vibrations.jsonc.' },
      { name: 'symmetry', type: 'string', req: 'opt', note: 'The Mulliken label of the mode, its irreducible representation, with literal <sub>/<sup> like VibrationMode.symmetry: the one band field that may carry markup. Derived by build.py from the band’s own vibration_modes where they agree on one label, never passed on to an overtone, combination or isotopologue, whose symmetry is not its parent’s. Authored where no mode carries it, as for a lattice phonon; the build warns where an authored value disagrees with the modes. Shown in the band card after the mode line.' },
      { name: 'group', type: 'group key', req: 'req', note: 'Into the groups lookup. Drives lane order and the default colour dimension.' },
      { name: 'vibration', type: '{category, subtype, branch, j}', req: 'req', note: 'Three closed enums and one integer, validated in schema.py.' },
      { name: 'atoms', type: 'string', req: 'req', note: 'Bond environment (O=C=O, M-O, diverse). Drives the atoms colormap.' },
      { name: 'wn_start / wn_end', type: 'int', req: 'req', note: 'The band’s window in cm⁻¹. wn_min/max/center derive from it.' },
      { name: 'short / description', type: 'string', req: 'opt', note: 'Label, and the general description: what the mode is and what it is confused with, 120 words at most.' },
      { name: 'references[]', type: 'Claim[]', req: 'opt', note: 'The per-source claims. See the Claim entity.' },
      { name: 'based_on[]', type: 'BasedOn[]', req: 'opt', note: 'Parent modes of a combination or overtone, with a multiplier.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Free-form, but most of the ones in use are derived by build.py from a field and must not be authored. DERIVED_TAGS below is the list.' },
      { name: 'intensity / width / confidence', type: 'enum', req: 'opt', note: 'Observation-dependent, but still authored on the band. See what is still open.' },
      { name: 'vibration_modes[]', type: 'mode id[]', req: 'opt', note: 'Link up into vibrations.jsonc. Back-filled for derived bands.' },
      { name: 'lane / sub_lane', type: 'int', req: 'calc', note: 'Set in place by layout.py, not authored.' },
    ],
    open:
      'intensity, width and confidence describe an observation but are authored once per band. They belong on the claim, with the band keeping a rollup for the chart.',
  },
  {
    key: 'claim',
    label: 'Claim',
    status: 'inline',
    source: 'data/bands.jsonc → band.references[]',
    id: 'id, an authored integer, unique and never reused',
    blurb:
      'One paper’s claim about one band: the wavenumber it reports, the surface it saw it on, how it was measured, the caveat it attaches. The join between Band and Reference, and the home of everything observation-dependent.',
    fields: [
      { name: 'id', type: 'int', req: 'req', note: 'The claim’s own number, unique across bands.jsonc. A new claim takes metadata.next_claim_id and the mark goes up by one; it never goes down, so a deleted claim’s number is never handed out again, and an edited claim keeps its own. One band can hold several claims from one paper (a second site, a second position), each with its own number. build.py fails on a missing, repeated or out-of-range id. Shown small beside the claim’s links in the band card.' },
      { name: 'key', type: 'citekey', req: 'req', note: 'Into references.bib.' },
      { name: 'wn', type: 'int | int[]', req: 'opt', note: 'This source’s reported position. An array means several resolved components.' },
      { name: 'measured_on', type: 'surface key | surface key[]', req: 'opt', note: 'Into surfaces.jsonc, at whatever scale the paper stated. A paper naming both the site and the catalyst gets both keys; one naming only the catalyst gets one, and that is a complete record of what it said. Name the most specific record the paper supports (γ-Al₂O₃ rather than Al₂O₃): a search for the parent still finds it through refines.' },
      { name: 'diluent', type: 'surface key[]', req: 'opt', note: 'What the specimen was mixed with but is not made of: KBr in a DRIFTS cup, an α-Al₂O₃ bed. Kept out of measured_on so it never enters the site description, and out of both element sets. Drawn as a dashed badge reading "in KBr".' },
      { name: 'site_elements', type: 'symbol[]', req: 'calc', note: 'The elements of where the claim placed the species, by build.py: its sites, the materials inside its specimen, and the specimen itself only where it is one compound. What the molecule could be bonded to; empty where only a composite is named. The Elements filter reads it in its "in site" scope.' },
      { name: 'specimen_elements', type: 'symbol[]', req: 'calc', note: 'The elements of every key in measured_on: anything in the specimen. A band assigned to Zr⁴⁺ on CuGaZrOx has Cu here and not in site_elements. The Elements filter reads it in its "in specimen" scope, and the References page’s Element grouping always.' },
      { name: 'specimens', type: 'surface key[]', req: 'calc', note: 'What was investigated, by build.py: the materials measured_on names that no other material it names contains. The hierarchy of the keys decides the role, not the record: TiO₂ named alone is the specimen, TiO₂ beside Pt/MoOₓ/TiO₂ is a part of it. More than one is warned about, since one row is one measurement on one solid. The References page’s Specimen grouping reads it.' },
      { name: 'placement', type: 'site | material | specimen', req: 'calc', note: 'How far the claim places its species, by build.py. site: it names a site. material: it names a material inside the specimen, or the specimen is one compound. specimen: it names only a composite, so the paper saw the species on that catalyst and did not say where in it. Drawn in every claim’s badges by the fill: filled where the paper placed the species, hollow for the specimen, so a hollow catalyst alone is a claim not located. The References page’s Placed on grouping reads it.' },
      { name: 'technique', type: 'enum', req: 'opt', note: 'How the spectrum was taken. Derives its own name as a tag on the claim, and its family (infrared, raman, computational) as an umbrella on the band, so the legend can ask "seen in the infrared at all" without ticking seven chips. The umbrella is a legend switch only: it is not drawn on the band or the claim, where the specific chip already says it.' },
      { name: 'laser_nm', type: 'number', req: 'opt', note: 'Raman excitation wavelength in nm, recorded only where the source names the line. Derives two chips, the colour family and the line itself ("green laser", "515 nm"), both coloured from the light rather than from a fixed table, since a wavelength is a number and no vocabulary can hold one. Only meaningful on a Raman technique, raman or srs; the build warns otherwise.' },
      { name: 'scattering', type: 'stokes | anti-stokes', req: 'opt', note: 'Which side of the laser line a Raman claim was read on. A Stokes photon leaves redder by the mode’s energy and an anti-Stokes one bluer by the same amount, so both are the same mode on the same band and wn is the magnitude either way: an anti-Stokes line at −418 cm⁻¹ is a claim of 418 with scattering anti-stokes. Authored only for an anti-Stokes reading, and only where the source prints an anti-Stokes position; one that merely saw the anti-Stokes lines says so in the Stokes claim’s note. The build fills in stokes on every other Raman claim, so every Raman claim carries one of the two. Derives a tag of the same name; Raman only, and the build warns otherwise. A band with a counted anti-Stokes claim is drawn again at the negative shift.' },
      { name: 'medium', type: 'vacuum | gas | liquid | supercritical | matrix', req: 'opt', note: 'What surrounded the sample for this claim: an evacuated or UHV cell, any gas atmosphere (a fraction of a mbar of dosed CO counts), a liquid or electrolyte, a dense fluid above its critical point, or a frozen noble-gas matrix. A calculation records what its model contains: a slab or cluster in vacuum, unless the model adds a solvent. Derives the tag "in vacuum", "in gas", "in liquid" or "in matrix". Left out where the paper does not say, which is honest where a guess is not.' },
      { name: 'form', type: 'free | dissolved | adsorbed | surface | lattice', req: 'opt', note: 'Where the species was: on its own (a gas, the liquid itself, matrix-isolated), dissolved in a liquid, held on a surface, a group of the solid (a hydroxyl, a hydride), or a vibration or defect of the solid itself. Derives a tag of the same name. With medium it separates what one word could not: CO adsorbed in UHV, under a gas and at an electrode in an electrolyte. Not band.phase, which says what the band is wherever it appears.' },
      { name: 'note', type: 'string', req: 'opt', note: 'What this one paper reported, ≤150 words. Conditions still live here as prose.' },
      { name: 'tags[]', type: 'string[]', req: 'opt', note: 'Scoped to this claim, not the band.' },
      { name: 'uid', type: 'string', req: 'calc', note: 'Computed by build.py, with an ordinal when one paper makes several claims about the same band. A readable handle for the References page; the authored id is the stable one.' },
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
      { name: 'citekey', type: 'string', req: 'req', note: 'Every claim.key must resolve to one of these.' },
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
      'The obvious next record: a table keyed by the string, carrying the elements that move (C, O, H) and a flag for the generic metal M. That would validate the spelling, and would answer "every band whose moving atoms include H". Keep those elements a separate axis from a specimen’s elements though: carbon in the bond and copper in the catalyst are different questions, and merging them into one Element filter would mislead.',
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
      'Where a band was measured, at whatever scale the paper stated. Two levels: a site (the atom-scale spot, or an ion) and a material (any piece of solid, one compound or a whole catalyst). The role is not the record’s: TiO₂ is the specimen when a paper measures bare titania and a part of it when that titania supports Pt, and the claim says which by what else it names (its derived specimens and placement). The badge is drawn from the level: a site is filled, a material hollow. Two links and only two: parts (is made of, same level or lower; elements flow up) and refines (is a more specific version of, same level; searches flow down).',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'ASCII, element plus charge for a site (cu_1p). Element-symbol keys here always mean the element.' },
      { name: 'label', type: 'string', req: 'req', note: 'Display text, Unicode (Cu⁺).' },
      { name: 'level', type: 'site | material', req: 'req', note: 'The scale. A site is the atom-scale spot or an ion a material is made of; a material is a piece of solid that exists physically, one compound (a phase in XRD, a support) or a composite (a catalyst, an electrode, the model a calculation used).' },
      { name: 'compound', type: 'boolean', req: 'calc', note: 'Materials only, by build.py: made only of ionic sites (cation, anion, defect, hydroxyl, bronsted) through its parts and the record it refines. One compound, so a claim naming it alone has placed the species on it; a composite named alone has not.' },
      { name: 'refines', type: 'surface key', req: 'opt', note: 'The one record, on the same level, this is a more specific version of: γ-Al₂O₃ refines Al₂O₃, Fe₃O₄(001) refines Fe₃O₄, Ga³⁺(t) refines Ga³⁺, Vₒ⁺ refines Vₒ. A refinement inherits its parent’s parts and elements and must set at least one refinement attribute. Searches flow down it: asking for Al₂O₃ finds γ-Al₂O₃, asking for γ finds only γ.' },
      { name: 'kind', type: 'enum', req: 'opt', note: 'By level. A compound: oxide | mixed oxide | halide. A site: metal | atom | cation | anion | bronsted | hydroxyl | defect | interface. A composite has none, and a refinement inherits its parent’s.' },
      { name: 'element', type: 'symbol', req: 'opt', note: 'On an atom-scale site, inherited along refines. What makes "every Cu site regardless of oxidation state" answerable.' },
      { name: 'oxidation_state / charge / coordination / polymorph / facet / form / stoichiometry', type: 'refinement attributes', req: 'opt', note: 'What a refinement adds to its parent: Vₒ → Vₒ⁺, Ga³⁺ → tetrahedral Ga³⁺, Al₂O₃ → γ, Fe₃O₄ → (001), Ag/Au → its film electrode, ZnO → O-deficient ZnO₁₋ₓ. A facet is never a material of its own: the cut is a termination, not a composition.' },
      { name: 'formula / composition', type: 'string', req: 'opt', note: 'A compound’s formula, or a material as the literature writes it where label and parts cannot say it. Deliberately not parsed.' },
      { name: 'elements[]', type: 'symbol[]', req: 'opt', note: 'Only what the parts and the parent do not already supply, validated against elements.jsonc. build.py warns where an authored element is redundant.' },
      { name: 'parts[]', type: 'surface key[]', req: 'opt', note: '"Is made of", pointing to records on the same level or lower, never up. A material lists the materials it contains, and a site directly only where it belongs to none of them (an isolated SOMC cation, an exchanged cation, a zero-valent metal atom, an interface). A compound lists its ions: Al₂O₃ is Al³⁺ + O²⁻, KBr is K⁺ + Br⁻. A metal is never a material: the catalyst names its atom (Pd⁰) directly. A composite site lists the simpler sites it is built from. Elements flow up along it.' },
      { name: 'all_elements[]', type: 'symbol[]', req: 'calc', note: 'The closure over parts and refines, computed by build.py.' },
      { name: 'lineage[]', type: 'surface key[]', req: 'calc', note: 'The refinement chain upwards, nearest first, computed by build.py.' },
    ],
    open:
      'Whether a material is one compound is read off its parts, so it is only as right as they are: a composite listed with ions alone (a doped oxide, say) reads as one compound, and a claim naming it alone as placed.',
  },
  {
    key: 'element',
    label: 'Element',
    status: 'record',
    source: 'data/elements.jsonc',
    id: 'the symbol',
    blurb:
      'A chemical element as an entity of its own, so a surface’s elements are validated rather than typed freely, and the band chart’s and References page’s Elements sections can group their rows by category.',
    fields: [
      { name: 'symbol', type: 'string', req: 'req', note: 'The key: H, Cu, Zr.' },
      { name: 'name / z', type: 'string / int', req: 'req', note: 'English name and atomic number; the selector orders by z.' },
      { name: 'group / period / block', type: 'int | null / int / s|p|d|f', req: 'req', note: 'Lanthanides and actinides carry group null rather than take a side on which sits in group 3.' },
      { name: 'category', type: 'enum', req: 'req', note: 'alkali metal, alkaline earth metal, transition metal, post-transition metal, lanthanide, actinide, metalloid, nonmetal, halogen.' },
    ],
    open:
      'Properties that need a cited scale (electronegativity, oxophilicity) are not carried yet: add them with the source, not as bare numbers.',
  },
  {
    key: 'technique',
    label: 'Technique',
    status: 'record',
    source: 'data/techniques.jsonc',
    id: 'key, the value a claim writes',
    blurb:
      'How the spectrum was taken. Began as three tags, became a closed enum on the claim, and is a record now, because it carries more than its name: a family, a spectroscopy, the technique it refines, a tooltip and a note, which used to live in four files and drifted apart.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'What claim.technique writes; build.py fails on any other value. Also the tag the build derives on the claim.' },
      { name: 'label', type: 'string', req: 'req', note: 'Display text: DRIFTS, ATR-SEIRAS, IR (unspecified).' },
      { name: 'family', type: 'infrared | raman | computational', req: 'req', note: 'The family switch in the Techniques filter and the gap in the legend.' },
      { name: 'spectroscopy', type: 'ir | raman | null', req: 'req', note: 'Which selection rule its evidence speaks to; null for a calculation.' },
      { name: 'parent', type: 'technique key', req: 'opt', note: 'The technique it refines: ATR-SEIRAS under ATR, PM-IRRAS under IRRAS. Switching or isolating the parent takes it along.' },
      { name: 'tip / note', type: 'string', req: 'req', note: 'One sentence for the filter row, and the longer account on this page.' },
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
    blurb: 'The species family a band belongs to, one lane of the chart. Owns its own colour, deliberately: it belongs to the dataset, not to the design system. Shown as “Species family” in the interface.',
    fields: [
      { name: 'key', type: 'string', req: 'req', note: 'Referenced by band.group and molecule.band_groups.' },
      { name: 'label', type: 'string', req: 'req', note: 'Lane label in the chart.' },
      { name: 'color', type: 'hex', req: 'req', note: 'The one colour the design system does not own.' },
      { name: 'of', type: 'species | specimen', req: 'opt', note: 'What vibrates: a molecule or an adsorbate (species, the default; a hydride included) or the solid itself (specimen: Support OH, Oxide). Specimen lanes sit below every species lane under a divider; build.py fails on a lanes table that interleaves them.' },
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
      'A label attached to a band, a claim or a vibration mode. tags.jsonc is a tooltip lookup only: it does not gate which tags are allowed, so the namespace stays open.',
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
  { from: 'band', to: 'claim', card: '1:N', via: 'band.references[]', note: 'A band collects one claim per citing paper. 0 for an uncited band.' },
  { from: 'reference', to: 'claim', card: '1:N', via: 'claim.key', note: 'One paper can be cited by many bands. This plus the row above is what makes Claim a join.' },
  { from: 'claim', to: 'surface', card: 'N:M', via: 'claim.measured_on', note: 'Scalar or array, at any level. An array means one source named several surfaces for one measurement: the site and the catalyst, or the support and the catalyst. Two specimens it compared are two claims.' },
  { from: 'surface', to: 'surface', card: 'N:M', via: 'surface.parts[]', note: '"Is made of", same level or lower, never up: a material lists the materials it contains (and a site only where it belongs to none of them), a compound its ions, a composite site (Si-(OH)-Al, an interface, a defect ensemble) the simpler sites it is built from. Elements flow up along it.' },
  { from: 'surface', to: 'surface', card: 'N:1', via: 'surface.refines', note: '"Is a more specific version of", same level, exactly one parent: γ-Al₂O₃ → Al₂O₃, Fe₃O₄(001) → Fe₃O₄, Ga³⁺(t) → Ga³⁺. Searches flow down it, so a query for the parent finds the refinement and not the other way round.' },
  { from: 'surface', to: 'element', card: 'N:M', via: 'surface.element, surface.elements[]', note: 'Validated against elements.jsonc. Authored only where parts and parent do not supply it; all_elements is the closure.' },
  { from: 'claim', to: 'surface', card: 'N:M', via: 'claim.diluent[]', note: 'What the specimen was mixed with (KBr, an α-Al₂O₃ bed). Validated like measured_on, but never part of the site description or the element sets.' },
  { from: 'claim', to: 'technique', card: 'N:1', via: 'claim.technique', note: 'One technique per claim, validated against the records. Derives the technique tag chip.' },
  { from: 'technique', to: 'technique', card: 'N:1', via: 'technique.parent', note: 'Refinement: ATR-SEIRAS is a more specific ATR. The filter switches a parent with its refinements.' },
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
export const TAG_TARGETS = ['band', 'claim', 'mode'];

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
 * derived beside it, read from each record's `family`.
 *
 * The legend puts a gap at each change of family, so the row reads as three
 * groups rather than eleven chips: the infrared geometries, then the Raman
 * ones, then the calculations, which are not a measurement at all.
 */
/** The two halves of the phase role, for the legend's gap between them:
    what the species is, then what surrounded it. */
export const PHASE_PART: Record<string, 'form' | 'medium'> = {
  free: 'form', dissolved: 'form', adsorbed: 'form', surface: 'form', lattice: 'form',
  'in vacuum': 'medium', 'in gas': 'medium', 'in liquid': 'medium', 'in supercritical': 'medium', 'in matrix': 'medium',
};

export const TECHNIQUE_FAMILY_ORDER: Record<string, number> = {
  infrared: 0,
  raman: 1,
  // Last because it is not a measurement: everything above it was seen.
  computational: 2,
};

/** Filled from the Technique records by installTechniqueSpecs(). */
export const TECHNIQUE_FAMILY: Record<string, 'infrared' | 'raman' | 'computational'> = {};

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
  phase: 'How the sample was held, in two parts: the form (free, dissolved, adsorbed, surface, lattice) and the medium around it (in vacuum, in gas, in liquid, in matrix). Derived from claim.form and claim.medium, on the claim rather than on the band: a band has no sample of its own, so it shows the union of the states its claims were measured in. Band.phase is an editorial statement about the species, used by the sets, and the build warns where it contradicts the claims underneath it.',
  activity: 'IR / Raman selection rule, derived by the loader from the mode’s booleans.',
  technique: 'How the spectrum was taken. Now derived from claim.technique.',
  laser: 'Which light the Raman measurement used, grouped by the colour of it and derived from claim.laser_nm, and which side of that line it was read on, derived from claim.scattering. A role of its own rather than part of the technique: it qualifies one technique rather than naming another, and the wavelength chips are coloured from the light itself instead of from the tag table.',
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
  // How the sample was held for one claim, from claim.form and
  // claim.medium, and the whole of the phase vocabulary: a band carries
  // no phase tag of its own, it shows the union of its claims'.
  free: 'phase',
  dissolved: 'phase',
  adsorbed: 'phase',
  surface: 'phase',
  lattice: 'phase',
  'in vacuum': 'phase',
  'in gas': 'phase',
  'in liquid': 'phase',
  'in supercritical': 'phase',
  'in matrix': 'phase',
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
  irras: 'technique',
  pm_irras: 'technique',
  seiras: 'technique',
  emission: 'technique',
  mioirs: 'technique',
  raman: 'technique',
  srs: 'technique',
  computational: 'technique',
  // Which side of the Raman line, from claim.scattering. Beside the
  // wavelength, since both qualify the one Raman technique.
  stokes: 'laser',
  'anti-stokes': 'laser',
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
  infrared: 'claim.technique',
  drifts: 'claim.technique',
  transmission: 'claim.technique',
  atr: 'claim.technique',
  irras: 'claim.technique',
  pm_irras: 'claim.technique',
  seiras: 'claim.technique',
  emission: 'claim.technique',
  mioirs: 'claim.technique',
  raman: 'claim.technique',
  srs: 'claim.technique',
  // Both levels of it: the claim tag from its own technique, the band tag
  // from every claim on the band having that technique and no other.
  computational: 'claim.technique',
  stokes: 'claim.scattering',
  'anti-stokes': 'claim.scattering',
  free: 'claim.form',
  dissolved: 'claim.form',
  adsorbed: 'claim.form',
  surface: 'claim.form',
  lattice: 'claim.form',
  'in vacuum': 'claim.medium',
  'in gas': 'claim.medium',
  'in liquid': 'claim.medium',
  'in supercritical': 'claim.medium',
  'in matrix': 'claim.medium',
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
  if (anyLaserNm(tag) !== null) return 'claim.laser_nm';
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
   not a value here: a claim says how the sample met the beam, that it was an
   infrared or Raman measurement of unstated kind, or that the number was
   calculated. The records are data/techniques.jsonc, read from bands.json.
   --------------------------------------------------------------------------- */

export interface TechniqueSpec {
  key: string;
  label: string;
  /** The tag this technique derives, so the legend chips keep working. */
  tag: string;
  /** Which spectroscopy it is, for the chart's IR/Raman switch; null for a calculation. */
  spectroscopy: Spectroscopy | null;
  note: string;
  family: 'infrared' | 'raman' | 'computational';
  /** The technique this one refines, if any. */
  parent: string | null;
  tip: string;
}

export const TECHNIQUES: TechniqueSpec[] = [];

/** Fill TECHNIQUES and TECHNIQUE_FAMILY from data/techniques.jsonc, in place. */
export function installTechniqueSpecs(table: Record<string, TechniqueRecord> | undefined): void {
  TECHNIQUES.length = 0;
  for (const k of Object.keys(TECHNIQUE_FAMILY)) delete TECHNIQUE_FAMILY[k];
  for (const [key, r] of Object.entries(table ?? {})) {
    TECHNIQUES.push({ key, label: r.label, tag: key, spectroscopy: r.spectroscopy, note: r.note,
                      family: r.family, parent: r.parent ?? null, tip: r.tip });
    TECHNIQUE_FAMILY[key] = r.family;
  }
}

/* ---------------------------------------------------------------------------
   Surface levels and site kinds
   --------------------------------------------------------------------------- */

export const SURFACE_LEVELS: SurfaceLevel[] = ['material', 'site'];

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
  material: 'Material',
};

export const LEVEL_NOTE: Record<SurfaceLevel, string> = {
  site: 'The atom-scale spot the molecule is bonded to, or an ion a material is made of: a cation, an anion, a zero-valent atom, a vacancy, a proton, or a named ensemble of those.',
  material: 'A piece of solid that exists physically: one compound (a phase in XRD, a support, made of its ions) or a whole catalyst, electrode or model made of other materials and sites. Never a bare metal, which is only its atom. Whether it was the specimen or a part of one is the claim’s to say: the material a claim names that no other material it names contains is its specimen, so TiO₂ is the specimen named alone and a part beside Pt/TiO₂.',
};

/** A kind subdivides a level: a site by what it is, a material by its class
 *  of compound where it is one. A composite has none; a refinement inherits
 *  its parent's. */
export type MaterialKind = 'oxide' | 'mixed oxide' | 'halide';
export type SurfaceKind = SiteKind | MaterialKind;
export type SiteKind = 'metal' | 'atom' | 'cation' | 'anion' | 'defect' | 'interface' | 'bronsted' | 'hydroxyl';

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  oxide: 'Oxide',
  'mixed oxide': 'Mixed oxide',
  halide: 'Halide',
};
export const MATERIAL_KIND_NOTE: Record<MaterialKind, string> = {
  oxide: 'An oxide of one metal, whatever its valence: Al₂O₃, TiO₂, Fe₃O₄, MoOₓ.',
  'mixed oxide': 'An oxide of two or more metals as one phase, such as the NiAl₂O₄ spinel.',
  halide: 'A salt of a halogen, such as the KBr a powder is diluted in.',
};

export const SITE_KIND_LABEL: Record<SiteKind, string> = {
  metal: 'Metal',
  atom: 'Zero-valent atom',
  cation: 'Cation',
  anion: 'Anion',
  defect: 'Defect',
  interface: 'Interface',
  bronsted: 'Brønsted site',
  hydroxyl: 'Hydroxyl',
};

export const SITE_KIND_NOTE: Record<SiteKind, string> = {
  metal: 'A metal atom in the zero oxidation state, e.g. Cu⁰.',
  atom: 'An atom of a non-metal in the zero oxidation state, e.g. the silicon of a prism (Si⁰).',
  cation: 'A cation at a stated charge, e.g. Zn²⁺: the Lewis acid of an oxide or an exchanged ion.',
  anion: 'An anion at a stated charge, e.g. the lattice O²⁻ of an oxide or the Br⁻ of KBr.',
  defect: 'A vacancy, or an ensemble built around one.',
  interface: 'The perimeter where two materials meet, e.g. Pt⁰-Ce, built from a site on each side.',
  bronsted: 'A proton-donating bridging hydroxyl, e.g. Si-(OH)-Al.',
  hydroxyl: 'A terminal surface hydroxyl that is not notably acidic, e.g. a silanol.',
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
  kind?: SurfaceKind;
  /** Surfaces only: how specific this entry is. */
  level?: SurfaceLevel;
  /** Surfaces one scale down, straight off the record. */
  parts?: string[];
  /** Surfaces only: parts it has through another record, each with that record. */
  partsVia?: { key: string; via: string }[];
  /** Claims that reach this surface only through a coarser one's parts list. */
  viaContainer?: number;
  /** Claims that name a refinement of this surface, found by a search for it. */
  viaRefinement?: number;
  /** Claims naming this surface as their diluent. */
  asDiluent?: number;
  /** Materials only: claims where it was the specimen. */
  asSpecimen?: number;
  /** Materials only: claims with it as specimen that place the species on
   *  none of its parts, "seen on this catalyst" and no more. */
  unlocated?: number;
  /** Materials only: one compound (true) or a composite (false). */
  compound?: boolean;
  /** Surfaces only: every claim that reaches it, each once: uses + via parts + via refinement. */
  total?: number;
  /** Surfaces only: the record this one refines, its chain up, and the records refining it. */
  refines?: string | null;
  lineage?: string[];
  refinedBy?: string[];
  /** Surfaces only: what a refinement adds to its parent, in words. */
  refinement?: string;
  /** Surfaces only: the closure of elements over parts and refines. */
  elements?: string[];
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

  /** Everything `key` is made of, the surface itself excluded. A refinement
   *  inherits its parent's parts, so γ-Al₂O₃ is made of Al³⁺ like Al₂O₃. */
  const partsBelow = (key: string): string[] => {
    const out = new Set<string>();
    const seen = new Set<string>();
    const walk = (k: string) => {
      if (seen.has(k)) return;
      seen.add(k);
      const rec = surfaceTable[k];
      for (const child of rec?.parts ?? []) {
        if (!out.has(child)) out.add(child);
        walk(child);
      }
      if (rec?.refines) walk(rec.refines);
    };
    walk(key);
    out.delete(key);
    return [...out];
  };
  /** Every record that refines `key`, transitively. */
  const refinementsBelow = (key: string): string[] =>
    Object.values(surfaceTable).filter(s => (s.lineage ?? []).includes(key)).map(s => s.key);

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

  /** A site's oxidation state, inherited along refines: Ga³⁺(t) is +3 because Ga³⁺ is. */
  const oxidationOf = (key: string): number | null => {
    for (const k of [key, ...(surfaceTable[key]?.lineage ?? [])]) {
      const ox = surfaceTable[k]?.oxidation_state;
      if (ox != null) return ox;
    }
    return null;
  };
  /** A site's element, inherited along refines (Ga³⁺(t) is a Ga site). */
  const siteElementOf = (key: string): string | null => {
    for (const k of [key, ...(surfaceTable[key]?.lineage ?? [])]) {
      const el = surfaceTable[k]?.element;
      if (el) return el;
    }
    return null;
  };

  let claims = 0;
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
      claims += 1;
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
        tagScope(t, 'claim', b.id);
        // A caveat describes where the band sits, so it is true whoever
        // measured it. On a claim it warns only the readers of that one paper.
        if (tagRole(t) === 'caveat') caveatOnClaim.push(`${b.id} → ${t} (${r.key})`);
      }
    }
  }

  // Every claim reaches a set of records, each by exactly one route, so the
  // three columns add up to the total and no claim is counted twice:
  //   direct          the record is in measured_on
  //   via refinement  a more specific record is (γ-Al₂O₃ named, so Al₂O₃
  //                   is found): the refinement link carries searches down
  //   via parts       a coarser record is, and this one is part of it, or
  //                   the parent of such a part (Cu/ZnO named, so Cu⁺,
  //                   ZnO, Zn²⁺ and O²⁻ are found)
  // Direct wins over refinement, refinement over parts.
  for (const b of bands) {
    for (const r of b.references) {
      const direct = new Set(asArray(r.measured_on));
      const lifted = new Set<string>();
      const reached = new Set<string>();
      for (const key of direct) {
        for (const up of surfaceTable[key]?.lineage ?? []) lifted.add(up);
        for (const below of partsBelow(key)) {
          reached.add(below);
          for (const up of surfaceTable[below]?.lineage ?? []) reached.add(up);
        }
      }
      for (const k of lifted) {
        if (direct.has(k)) continue;
        const row = surfaces.get(k);
        if (row) row.viaRefinement = (row.viaRefinement ?? 0) + 1;
      }
      for (const k of reached) {
        if (direct.has(k) || lifted.has(k)) continue;
        const row = surfaces.get(k);
        if (row) row.viaContainer = (row.viaContainer ?? 0) + 1;
      }
      // How often a material was the specimen (build.py's specimens), and
      // how often it was only that: seen on it, placed on none of its parts.
      for (const k of r.specimens ?? []) {
        const row = surfaces.get(k);
        if (!row) continue;
        row.asSpecimen = (row.asSpecimen ?? 0) + 1;
        if (r.placement === 'specimen') row.unlocated = (row.unlocated ?? 0) + 1;
      }
      for (const d of r.diluent ?? []) {
        const row = surfaces.get(d);
        if (row) row.asDiluent = (row.asDiluent ?? 0) + 1;
      }
    }
  }
  for (const row of surfaces.values()) {
    row.total = row.uses + (row.viaContainer ?? 0) + (row.viaRefinement ?? 0);
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
    row.compound = rec?.compound ?? false;
    // A refinement inherits its parent's kind: γ-Al₂O₃ is an oxide because Al₂O₃ is.
    row.kind = ([key, ...(rec?.lineage ?? [])].map(k => surfaceTable[k]?.kind).find(Boolean) ?? undefined) as SurfaceKind | undefined;
    row.parts = rec?.parts ?? [];
    // What it is made of without saying so: the parts of its parts, and for a
    // refinement its parent's parts, each with the record that brought it in
    // (Au-Ag/silicalite-1 names SiO₂, so Si⁴⁺ and O²⁻ arrive via SiO₂).
    {
      const listed = new Set(row.parts);
      const via: { key: string; via: string }[] = [];
      const seen = new Set<string>([key, ...listed]);
      const walk = (k: string, from: string) => {
        const r = surfaceTable[k];
        for (const p of [...(r?.parts ?? []), ...(r?.refines ? partsBelow(r.refines) : [])]) {
          if (seen.has(p)) continue;
          seen.add(p);
          via.push({ key: p, via: from });
          walk(p, from);
        }
      };
      if (rec?.refines) {
        for (const p of partsBelow(rec.refines)) {
          if (!seen.has(p)) { seen.add(p); via.push({ key: p, via: rec.refines }); }
        }
      }
      for (const p of row.parts) walk(p, p);
      row.partsVia = via;
    }
    row.refines = rec?.refines ?? null;
    row.lineage = rec?.lineage ?? [];
    row.refinedBy = refinementsBelow(key);
    row.elements = rec?.all_elements ?? [];
    // What a refinement adds, in words: γ, (001), tetrahedral, charge +1.
    row.refinement = rec ? [
      rec.polymorph, rec.facet, rec.coordination, rec.form, rec.stoichiometry,
      rec.oxidation_state != null && rec.refines ? stockNotation(siteElementOf(key) ?? '', rec.oxidation_state) : null,
      rec.charge != null ? `charge ${rec.charge > 0 ? '+' : ''}${rec.charge}` : null,
    ].filter(Boolean).join(', ') : '';
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
        ? siteElementOf(key)
          ? stockNotation(siteElementOf(key)!, oxidationOf(key))
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
    claim: claims,
    reference: Object.keys(refs ?? {}).length,
    species: species.size,
    surface: surfaces.size,
    technique: TECHNIQUES.length,
    element: Object.keys(dataset.elements ?? {}).length,
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

/** Label and note of any surface kind, site or material. */
export const KIND_LABEL: Record<SurfaceKind, string> = { ...SITE_KIND_LABEL, ...MATERIAL_KIND_LABEL };
export const KIND_NOTE: Record<SurfaceKind, string> = { ...SITE_KIND_NOTE, ...MATERIAL_KIND_NOTE };

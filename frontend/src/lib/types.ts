/**
 * What the atoms are doing. Two of these are not normal modes at all:
 * `electronic` (a defect or charge-transfer transition) and `rotational`
 * (the molecule turns and does not vibrate, which Raman sees directly
 * through the polarizability).
 */
export type VibCategory =
  | 'stretch' | 'bend' | 'combination' | 'lattice' | 'electronic' | 'rotational';
export type VibSubtype = 'symmetric' | 'asymmetric' | 'scissoring' | 'rocking' | 'wagging' | 'twisting';
/**
 * Which rotational branch, as ΔJ counted out from the band centre:
 * O = −2, P = −1, Q = 0, R = +1, S = +2.
 *
 * P and R are the infrared pair (one photon, ΔJ = ±1); O and S are the Raman
 * pair (two photons, ΔJ = ±2). Q sits at the centre in both, where symmetry
 * allows it.
 */
export type Branch = 'O' | 'P' | 'Q' | 'R' | 'S';
export type BandIntensity = 'vs' | 's' | 'm' | 'w' | 'vw';
export type BandWidth = 'sharp' | 'medium' | 'broad' | 'very_broad';
export type BandConfidence = 'confirmed' | 'likely' | 'tentative' | 'speculative';
export type Phase = 'gas' | 'adsorbed' | 'surface' | 'solution' | 'solid';
export type Medium = 'vacuum' | 'gas' | 'liquid' | 'supercritical' | 'matrix';
export type Form = 'free' | 'dissolved' | 'adsorbed' | 'surface' | 'lattice';
/** A key of data/techniques.jsonc. */
export type Technique = string;
export type SurfaceLevel = 'site' | 'material';
export type MaterialKind = 'oxide' | 'mixed oxide' | 'halide';
/** How far a claim places its species: on a site, on a material (a part of
 *  the specimen, or a specimen that is one compound), or only on a composite
 *  specimen, seen there and not located in it. */
export type Placement = 'site' | 'material' | 'specimen';
export type SiteKind = 'metal' | 'atom' | 'cation' | 'anion' | 'defect' | 'interface' | 'bronsted' | 'hydroxyl';
export type ColorDim = 'group' | 'vibration' | 'atoms' | 'references' | 'technique';
/** Which selection rule the band chart draws: the other technique's silent bands fade. */
export type Spectroscopy = 'ir' | 'raman';

export type AxisProperty = 'wavenumber' | 'wavelength' | 'energy';

export interface Vibration {
  category: VibCategory;
  subtype: VibSubtype | null;
  branch: Branch | null;
  /**
   * The rotational level the transition starts from, where a source resolves
   * one line rather than a branch envelope. Null means the band IS the
   * envelope. Set only alongside a branch.
   */
  j?: number | null;
}

export interface BasedOn {
  band_id: string | null;
  branch_group: string | null;
  multiplier: number;
  label: string | null;
}

export interface BandReference {
  key: string;
  /** The claim's own number: unique, never reused, kept through edits. */
  id?: number | null;
  wn: number | number[] | null;
  // Keys into Dataset.surfaces, not display text: where this source measured
  // the band, at whatever scale it stated. A paper naming both the site and
  // the sample gets both keys; one naming only the catalyst gets one.
  measured_on: string | string[] | null;
  technique: Technique | null;
  /** Raman excitation wavelength in nm. Derives the coloured wavelength tag. */
  laser_nm?: number | null;
  /** Which side of the laser line a Raman claim was read on; wn is the
   *  magnitude either way. Derives the "stokes" / "anti-stokes" tag. */
  scattering?: 'stokes' | 'anti-stokes' | null;
  /** What surrounded the sample. Derives the "in gas" style tag. */
  medium?: Medium | null;
  /** Where the species was. Derives a tag of the same name. */
  form?: Form | null;
  /** Surfaces the sample was mixed with but is not made of (KBr, an α-Al₂O₃
   *  bed). Kept out of measured_on and out of both element sets. */
  diluent?: string[];
  /** Derived by build.py: elements of where the claim placed the species. */
  site_elements?: string[];
  /** Derived by build.py: elements of every key named. */
  specimen_elements?: string[];
  /** Derived by build.py: what was investigated, the materials named that no
   *  other named material contains (Pd/TiO₂ beside TiO₂; TiO₂ named alone). */
  specimens?: string[];
  /** Derived by build.py: how far the claim places its species. */
  placement?: Placement | null;
  note: string | null;
  tags: string[];
  // Computed by build.py: "<band id>::<citekey>", with an ordinal when one
  // paper makes several claims about the same band.
  uid: string;
}

/** Where a band was measured, at whatever scale the paper stated.
 *
 *  Two levels: a site (the atom-scale spot, or an ion) and a material (any
 *  piece of solid, one compound or a whole catalyst). The role is not the
 *  record's: TiO₂ is the specimen when a paper measures bare titania and a
 *  part of it when that titania supports Pt, and the claim says which by what
 *  else it names. `level` is what the badge is drawn from: a site is filled,
 *  a material hollow, so the scale of a claim is readable at a glance.
 */
export interface Surface {
  key: string;
  label: string;
  level: SurfaceLevel;
  /** Sites only. */
  /** A site's or a compound's kind; a refinement inherits its parent's. */
  kind: SiteKind | MaterialKind | null;
  element: string | null;
  oxidation_state: number | null;
  formula: string | null;
  composition: string | null;
  /** Authored: what this entry contains that its parts and parent do not. */
  elements: string[];
  /** The record this one is a more specific version of, on the same level.
   *  Searches flow down it: Al₂O₃ finds γ-Al₂O₃, not the other way. */
  refines: string | null;
  charge: number | null;
  coordination: string | null;
  polymorph: string | null;
  facet: string | null;
  form: string | null;
  stoichiometry: string | null;
  /** "Is made of": records on the same level or lower. Elements flow up. */
  parts: string[];
  /** Computed by build.py: the closure over parts and refines. */
  all_elements: string[];
  /** Computed by build.py: the refinement chain upwards, nearest first. */
  lineage: string[];
  /** Computed by build.py: a material made only of ionic sites, one compound
   *  (TiO₂, ZSM-5) rather than a composite (Cu/ZnO). False for a site. */
  compound?: boolean;
  note: string;
}

/** An element as an entity: data/elements.jsonc. */
export interface ElementInfo {
  name: string;
  z: number;
  group: number | null;
  period: number;
  block: string;
  category: string;
}

export interface Species {
  key: string;
  label: string;
  formula: string;
  /** Molecule id in vibrations.json, authored here and only here. */
  molecule: string | null;
  note: string;
}

export interface Band {
  id: string;
  /** Key into Dataset.species. The chemical identity only. */
  species: string;
  group: string;
  vibration: Vibration;
  atoms: string;
  wn_start: number;
  wn_end: number;
  wn_min: number;
  wn_max: number;
  short: string;
  description: string;
  based_on: BasedOn[];
  references: BandReference[];
  tags: string[];
  fermi_partner: string | null;
  fermi_partner_group: string | null;
  branch_group: string | null;
  // This band is the same normal mode as `isotopologue_of`, measured on an
  // isotope-substituted molecule (e.g. ν(C-D) of DCOO* vs ν(C-H) of HCOO*).
  // One-directional child -> parent: only the substituted band carries it,
  // and only it gets the auto substitution tag. `isotope` names the
  // substitution ("D", "¹³C", ...) and is set exactly when the link is.
  isotopologue_of: string | null;
  isotope: string | null;
  // What the species string used to carry alongside the identity. phase is
  // null when the band applies to both the free molecule and its adsorbed
  // form; topology is a Topology id on this species' molecule.
  phase: Phase | null;
  topology: string | null;
  /** The mode's Mulliken label, with literal <sub>/<sup> ("A<sub>1g</sub>"),
   *  so it is rendered with {@html}. Authored, or derived by build.py from
   *  the band's own vibration_modes. */
  symmetry?: string | null;
  intensity: BandIntensity | null;
  width: BandWidth | null;
  confidence: BandConfidence | null;
  vibration_modes: string[];
  lane: number;
  sub_lane: number;
}

export interface Group {
  key: string;
  label: string;
  color: string;
  /** What vibrates: a molecule or adsorbate (species) or the solid itself (specimen). */
  of?: 'species' | 'specimen';
}

/** A named selection of groups, offered by the chart's filter. */
export interface GroupSet {
  key: string;
  label: string;
  groups: string[];
  note: string;
  /** Optional: keep only bands of these phases; a band with no phase stays. */
  phases?: string[];
}

export interface Region {
  key: string;
  label: string;
  wn_min: number;
  wn_max: number;
}

export interface Dataset {
  metadata: Record<string, string>;
  regions: Record<string, Region>;
  groups: Record<string, Group>;
  sets: Record<string, GroupSet>;
  /** The chart's rows, top to bottom; each names the groups sharing it. */
  lanes: string[][];
  species: Record<string, Species>;
  surfaces: Record<string, Surface>;
  elements: Record<string, ElementInfo>;
  /** The Technique records, in the order the filter lists them. */
  techniques: Record<string, import('./claimFilter').TechniqueRecord>;
  bands: Band[];
}

export interface VibrationMode {
  id: string;
  category: VibCategory;
  subtype: VibSubtype | null;
  label: string;
  note: string;
  ir_active: boolean | null;
  raman_active: boolean | null;
  atoms: string;
  tags: string[];
  reference: string[];
  // Which Topology.id (on the owning Molecule) this specific mode entry
  // represents, or null if it applies regardless of binding geometry. When
  // a vibration genuinely differs by topology (point group, Mulliken label,
  // frequency...), it gets two separate VibrationMode entries instead of
  // one shared one — see schema.py's VibrationMode docstring. The frontend
  // filters a molecule's mode list to topology===null || topology===selected.
  topology: string | null;
  // Herzberg's classic normal-mode index/Mulliken symmetry label for this
  // mode (e.g. "ν₁", "Σg⁺") — unset for now on most modes, rendered only
  // when present. symmetry uses literal <sub> tags where it needs a letter
  // subscript, rendered with {@html}.
  herzberg_notation: string | null;
  symmetry: string | null;
  // This mode's own characteristic wavenumber — independent of `bands`
  // below, can legitimately differ from any one linked band's position.
  wn_start: number | null;
  wn_end: number | null;
  // Computed by loader.py from Band.vibration_modes (+ a based_on chase for
  // combinations/overtones) — see vibrations.jsonc's own preamble.
  bands: string[];
}

export type MoleculeShape = 'linear' | 'nonlinear';

export interface Topology {
  id: string;
  short: string;
  long: string;
  // This topology's own symmetry point group (e.g. "D<sub>∞h</sub>",
  // rendered with {@html}) — binding geometry changes the point group, same
  // reason VibrationMode.symmetry can differ between topology-specific
  // mode entries. Mostly unset.
  point_group: string | null;
}

export interface Molecule {
  id: string;
  label: string;
  species: string;
  shape: MoleculeShape;
  band_groups: string[];
  topologies: Topology[];
  modes: VibrationMode[];
}

export interface Vibrations {
  molecules: Molecule[];
}

export type GroupMap = Record<string, Group>;
export type RefEntry = Record<string, string | undefined>;
export type RefMap = Record<string, RefEntry> | null;

export interface LegendCategory {
  key: string;
  label: string;
  color: string;
  count: number;
}

export type VibCategory = 'stretch' | 'bend' | 'combination' | 'lattice' | 'electronic';
export type VibSubtype = 'symmetric' | 'asymmetric' | 'scissoring' | 'rocking' | 'wagging' | 'twisting';
export type Branch = 'R' | 'P' | 'Q';
export type BandIntensity = 'vs' | 's' | 'm' | 'w' | 'vw';
export type BandWidth = 'sharp' | 'medium' | 'broad' | 'very_broad';
export type BandConfidence = 'confirmed' | 'likely' | 'tentative' | 'speculative';
export type Phase = 'gas' | 'adsorbed' | 'surface';
export type Technique =
  | 'drifts' | 'transmission' | 'atr' | 'irras' | 'pm_irras' | 'emission'
  | 'ftir' | 'raman' | 'computational';
export type SurfaceLevel = 'site' | 'phase' | 'sample';
export type SiteKind = 'metal' | 'cation' | 'defect' | 'interface' | 'bronsted';
export type ColorDim = 'group' | 'vibration' | 'atoms' | 'references';
/** Which selection rule the band chart draws: the other technique's silent bands fade. */
export type Spectroscopy = 'ir' | 'raman';

export type AxisProperty = 'wavenumber' | 'wavelength' | 'energy';

export interface Vibration {
  category: VibCategory;
  subtype: VibSubtype | null;
  branch: Branch | null;
}

export interface BasedOn {
  band_id: string | null;
  branch_group: string | null;
  multiplier: number;
  label: string | null;
}

export interface BandReference {
  key: string;
  wn: number | number[] | null;
  // Keys into Dataset.surfaces, not display text: where this source measured
  // the band, at whatever scale it stated. A paper naming both the site and
  // the sample gets both keys; one naming only the catalyst gets one.
  measured_on: string | string[] | null;
  technique: Technique | null;
  /** Raman excitation wavelength in nm. Derives the coloured wavelength tag. */
  laser_nm?: number | null;
  /** What was in the beam for this claim. Derives a tag of the same name. */
  state?: 'gas' | 'liquid' | 'matrix' | 'solid' | 'adsorbed' | null;
  note: string | null;
  tags: string[];
  // Computed by build.py: "<band id>::<citekey>", with an ordinal when one
  // paper makes several claims about the same band.
  uid: string;
}

/** Where a band was measured, at whatever scale the paper stated.
 *
 *  One table at three levels rather than separate sites and materials: TiO₂
 *  is the sample when a paper measures bare titania and a phase when that
 *  titania supports Pt, so the entry does not change, only the role. `level`
 *  is what the badge is drawn from: a site is filled, a phase or sample is
 *  hollow, so the scale of a claim is readable at a glance.
 */
export interface Surface {
  key: string;
  label: string;
  level: SurfaceLevel;
  /** Sites only. */
  kind: SiteKind | null;
  element: string | null;
  oxidation_state: number | null;
  formula: string | null;
  composition: string | null;
  /** Authored: what this entry alone contains. */
  elements: string[];
  facet: string | null;
  /** The surfaces one scale down: a sample's phases and sites, a phase's
   *  sites, a composite site's simpler sites. The only containment link. */
  parts: string[];
  /** Computed by build.py: `elements` unioned over the whole `parts` tree.
   *  What an element query ("anything with Cu in it") runs against. */
  all_elements: string[];
  note: string;
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

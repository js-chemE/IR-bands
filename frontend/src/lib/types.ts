export type VibCategory = 'stretch' | 'bend' | 'combination' | 'lattice';
export type VibSubtype = 'symmetric' | 'asymmetric' | 'scissoring' | 'rocking' | 'wagging' | 'twisting';
export type Branch = 'R' | 'P' | 'Q';
export type BandIntensity = 'vs' | 's' | 'm' | 'w' | 'vw';
export type BandWidth = 'sharp' | 'medium' | 'broad' | 'very_broad';
export type BandConfidence = 'confirmed' | 'likely' | 'tentative' | 'speculative';
export type ColorDim = 'group' | 'vibration' | 'atoms' | 'references';
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
  site: string | string[] | null;
  note: string | null;
  tags: string[];
}

export interface Band {
  id: string;
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

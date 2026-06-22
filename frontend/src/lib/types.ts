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
  wn: number | null;
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
  // Computed by loader.py from Band.vibration_modes (+ a based_on chase for
  // combinations/overtones) — see vibrations.jsonc's own preamble.
  bands: string[];
}

export type MoleculeShape = 'linear' | 'nonlinear';

export interface Topology {
  id: string;
  short: string;
  long: string;
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

/**
 * The electromagnetic spectrum, cut into the regions spectroscopy names.
 *
 * One table, three readers: `emRegion()` says which region a wavenumber,
 * wavelength, frequency or photon energy falls in; the band chart draws the
 * borders it can see behind the bands (lib/chart.ts) and names the regions in
 * a strip above them (BandChart.svelte); and the Electromagnetic Spectrum card
 * on the Knowledge page draws the whole of it.
 *
 * The borders are conventions, not physics: nothing happens to a photon at
 * 4000 cm⁻¹. Where the Springer Handbook of Advanced Catalyst Characterization
 * (Wachs and Bañares, 2023) states one, that is the one used, so the chart and
 * the card agree with the book the rest of the Knowledge page rests on:
 *
 *   10, 400, 4000 cm⁻¹     far- and medium-infrared limits   Ch. 1, p. 4
 *   800, 200 nm            near-infrared, vacuum UV          Ch. 11, p. 238
 *   380 nm                 visible against ultraviolet       Ch. 12, p. 265
 *
 * The handbook ends the visible at 400 nm in Ch. 11 and at 380 nm in Ch. 12;
 * 380 is the author's choice between the two.
 *   0.1, 5, 200 keV        X-rays, soft against hard         Ch. 28, pp. 602, 606
 *
 * The handbook names no border between microwaves and radio waves, and the
 * usual ones disagree by two decades (300 MHz, 1 GHz, 30 GHz). 1 GHz is the
 * one used, because it is the one that agrees with how the handbook speaks:
 * it keeps EPR, at 9.5 GHz, in the microwaves (Ch. 38, p. 870) and NMR, at
 * hundreds of MHz, in the radio waves (Ch. 34, p. 758). It is the only border
 * here that is not the handbook's own number.
 *
 * A region is either whole or split into parts: the infrared into far, mid and
 * near, the ultraviolet into near and vacuum, the X-rays into soft and hard.
 * Everything that draws regions chooses one of the two levels, `main` or
 * `sub`, and never mixes them.
 */

import { toWavenumber } from './units';

/** Region borders, in cm⁻¹, low energy to high. */
const EDGE = {
  radioMicrowave: toWavenumber(1, 'GHz'),
  microwaveIr: 10,
  farMid: 400,
  midNear: 4000,
  irVisible: toWavenumber(800, 'nm'),
  visibleUv: toWavenumber(380, 'nm'),
  nearVacuumUv: toWavenumber(200, 'nm'),
  uvXray: toWavenumber(0.1, 'keV'),
  softHard: toWavenumber(5, 'keV'),
  xrayGamma: toWavenumber(200, 'keV'),
} as const;

export interface EmRegion {
  /** Machine key; its tint is the colour token `em-<key>`. */
  key: string;
  /**
   * The name, longest spelling first: `Mid-Infrared`, `Mid-IR`, `MIR`. A
   * label takes the first one that fits the room it has.
   */
  names: string[];
  /** Lower border in cm⁻¹, inclusive. 0 for radio waves. */
  wnMin: number;
  /** Upper border in cm⁻¹, exclusive. Infinity for gamma rays. */
  wnMax: number;
  /** The region in the unit it is usually quoted in, for a reader. */
  range: string;
  /** What a photon of this energy does to matter. */
  excites: string;
  /** The technique that uses it. */
  probe: string;
}

export interface EmMain extends EmRegion {
  /** The finer regions it is split into, low energy to high; empty if whole. */
  parts: EmRegion[];
}

export const EM_REGIONS: EmMain[] = [
  {
    key: 'radio',
    names: ['Radio Waves', 'Radio', 'RF'],
    wnMin: 0,
    wnMax: EDGE.radioMicrowave,
    range: 'below 1 GHz (longer than 30 cm)',
    excites: 'nuclear spins in a magnetic field',
    probe: 'NMR',
    parts: [],
  },
  {
    key: 'microwave',
    names: ['Microwaves', 'Microwave', 'MW'],
    wnMin: EDGE.radioMicrowave,
    wnMax: EDGE.microwaveIr,
    range: '1 to 300 GHz (30 cm to 1 mm)',
    excites: 'rotation of a free molecule; electron spins in a magnetic field',
    probe: 'EPR',
    parts: [],
  },
  {
    key: 'ir',
    names: ['Infrared', 'IR'],
    wnMin: EDGE.microwaveIr,
    wnMax: EDGE.irVisible,
    range: '10 to 12 500 cm⁻¹',
    excites: 'vibrations',
    probe: 'IR',
    parts: [
      {
        key: 'far-ir',
        names: ['Far-Infrared', 'Far-IR', 'FIR'],
        wnMin: EDGE.microwaveIr,
        wnMax: EDGE.farMid,
        range: '10 to 400 cm⁻¹',
        excites: 'lattice and metal–oxygen modes, frustrated motion, pure rotation of light molecules',
        probe: 'far-IR',
      },
      {
        key: 'mid-ir',
        names: ['Mid-Infrared', 'Mid-IR', 'MIR'],
        wnMin: EDGE.farMid,
        wnMax: EDGE.midNear,
        range: '400 to 4000 cm⁻¹',
        excites: 'fundamental vibrations',
        probe: 'IR',
      },
      {
        key: 'near-ir',
        names: ['Near-Infrared', 'Near-IR', 'NIR'],
        wnMin: EDGE.midNear,
        wnMax: EDGE.irVisible,
        range: '4000 to 12 500 cm⁻¹ (2500 to 800 nm)',
        excites: 'overtones and combinations of vibrations',
        probe: 'NIR',
      },
    ],
  },
  {
    key: 'visible',
    names: ['Visible', 'Vis'],
    wnMin: EDGE.irVisible,
    wnMax: EDGE.visibleUv,
    range: '800 to 380 nm',
    excites: 'valence electrons: d–d and charge-transfer transitions',
    probe: 'UV-Vis, Raman lasers',
    parts: [],
  },
  {
    key: 'uv',
    names: ['Ultraviolet', 'UV'],
    wnMin: EDGE.visibleUv,
    wnMax: EDGE.uvXray,
    range: '380 to 12 nm',
    excites: 'valence electrons',
    probe: 'UV-Vis',
    parts: [
      {
        key: 'near-uv',
        names: ['Near-Ultraviolet', 'Near-UV', 'NUV'],
        wnMin: EDGE.visibleUv,
        wnMax: EDGE.nearVacuumUv,
        range: '380 to 200 nm',
        excites: 'valence electrons: n → π*, π → π*, charge transfer, band gaps',
        probe: 'UV-Vis, UV Raman lasers',
      },
      {
        key: 'vacuum-uv',
        names: ['Vacuum-Ultraviolet', 'Vacuum-UV', 'VUV'],
        wnMin: EDGE.nearVacuumUv,
        wnMax: EDGE.uvXray,
        range: '200 to 12 nm',
        excites: 'valence electrons: σ → σ*, and the air in the beam path with them',
        probe: 'vacuum or synchrotron UV',
      },
    ],
  },
  {
    key: 'xray',
    names: ['X-Rays', 'X-Ray', 'X'],
    wnMin: EDGE.uvXray,
    wnMax: EDGE.xrayGamma,
    range: '0.1 to 200 keV',
    excites: 'core electrons',
    probe: 'XAS, XPS, XRD',
    parts: [
      {
        key: 'soft-xray',
        names: ['Soft X-Rays', 'Soft X-Ray', 'Soft X'],
        wnMin: EDGE.uvXray,
        wnMax: EDGE.softHard,
        range: '0.1 to 5 keV',
        excites: 'core electrons of light elements, L and M shells of metals',
        probe: 'soft XAS, XPS',
      },
      {
        key: 'hard-xray',
        names: ['Hard X-Rays', 'Hard X-Ray', 'Hard X'],
        wnMin: EDGE.softHard,
        wnMax: EDGE.xrayGamma,
        range: '5 to 200 keV',
        excites: 'K-shell electrons of the transition metals',
        probe: 'XAS, XRD',
      },
    ],
  },
  {
    key: 'gamma',
    names: ['Gamma Rays', 'γ-Rays', 'γ'],
    wnMin: EDGE.xrayGamma,
    wnMax: Infinity,
    range: 'above 200 keV',
    excites: 'the nucleus',
    probe: 'Mössbauer',
    parts: [],
  },
];

export type EmLevel = 'main' | 'sub';

/** The regions at one level: the seven, or every part with the whole ones. */
export function emRegionsAt(level: EmLevel): EmRegion[] {
  return level === 'main'
    ? EM_REGIONS
    : EM_REGIONS.flatMap(m => (m.parts.length ? m.parts : [m]));
}

const within = (r: EmRegion, wn: number) => wn >= r.wnMin && wn < r.wnMax;

/**
 * The region a photon belongs to, from whatever it is quoted in.
 *
 * `emRegion(2143)` and `emRegion(4.67, 'μm')` are both the mid-infrared;
 * `emRegion(532, 'nm')` is the visible, with no finer part; `emRegion(8.98,
 * 'keV')` is the hard X-rays. The unit is any of SPECTRAL_UNITS in
 * lib/units.ts and defaults to cm⁻¹. A border belongs to the region above it.
 *
 * Returns null for a value that is not a photon at all: zero, negative or not
 * a number.
 */
export function emRegion(value: number, unit: string = 'cm⁻¹'): { main: EmMain; sub: EmRegion | null } | null {
  const wn = toWavenumber(value, unit);
  if (!Number.isFinite(wn) || wn <= 0) return null;
  const main = EM_REGIONS.find(r => within(r, wn));
  if (!main) return null;
  return { main, sub: main.parts.find(p => within(p, wn)) ?? null };
}

/** One region as far as a window shows it. */
export interface EmSpan {
  region: EmRegion;
  /** The part of the region inside the window, in cm⁻¹. */
  wnLo: number;
  wnHi: number;
  /** Whether each end is the region's own border, or only where the window stops. */
  borderLo: boolean;
  borderHi: boolean;
}

/**
 * Every region, low energy first, with the ones named in `whole` drawn whole
 * and every other split into its parts. The band chart asks for this rather
 * than for one level, since it splits each region on its own.
 */
export function emRegionsSplit(whole: ReadonlySet<string>): EmRegion[] {
  return EM_REGIONS.flatMap(m => (m.parts.length && !whole.has(m.key) ? m.parts : [m]));
}

/** The region a part belongs to; a region without parts is its own. */
export function emMainOf(region: EmRegion): EmMain {
  return EM_REGIONS.find(m => m.key === region.key || m.parts.includes(region))!;
}

/**
 * The regions a window of light `[wnLo, wnHi]` (cm⁻¹) runs through, low
 * energy first: at one level, or out of a list such as emRegionsSplit gives.
 */
export function emSpans(wnLo: number, wnHi: number, level: EmLevel | EmRegion[]): EmSpan[] {
  const lo = Math.max(0, Math.min(wnLo, wnHi));
  const hi = Math.max(wnLo, wnHi);
  return (Array.isArray(level) ? level : emRegionsAt(level))
    .filter(r => r.wnMax > lo && r.wnMin < hi)
    .map(r => ({
      region: r,
      wnLo: Math.max(r.wnMin, lo),
      wnHi: Math.min(r.wnMax, hi),
      borderLo: r.wnMin > lo,
      borderHi: r.wnMax < hi,
    }));
}

/**
 * The longest of a region's names that fits, or null when even the
 * abbreviation does not: a sliver of a region keeps its border and goes
 * unnamed rather than running over its neighbour.
 */
export function emLabel(region: EmRegion, fits: (name: string) => boolean): string | null {
  return region.names.find(fits) ?? null;
}

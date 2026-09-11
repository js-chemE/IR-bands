import type { AxisProperty } from './types';

// Physical constants
const H  = 6.62607015e-34;   // J·s
const C  = 299792458;         // m/s
const EV = 1.602176634e-19;   // J/eV
const NA = 6.02214076e23;     // /mol
const CAL = 4.184;            // J/cal

export interface AxisSpec {
  units: readonly string[];
  defaultUnit: string;
  /** Whether the axis opens reversed (large values on the left); the chart's reverse button flips it. */
  reversed: boolean;
  /** Units that open a new group in the unit list, drawn with a rule above them. */
  breaks?: readonly string[];
}

/** Each axis' units run from the smallest unit to the largest, within a group where there are several. */
export const AXES: Record<AxisProperty, AxisSpec> = {
  wavenumber: { units: ['m⁻¹', 'dm⁻¹', 'cm⁻¹', 'mm⁻¹'],   defaultUnit: 'cm⁻¹',   reversed: true  },
  wavelength: { units: ['Å', 'nm', 'μm'],                    defaultUnit: 'μm',     reversed: false },
  energy:     { units: ['meV', 'eV', 'J/mol', 'kJ/mol', 'cal/mol', 'kcal/mol'], defaultUnit: 'kJ/mol', reversed: false, breaks: ['J/mol', 'cal/mol'] },
};

/*
 * A shift is any of these axes read from a zero instead of from nothing: the
 * laser line of a Raman spectrum, say. Each band then stands for light that
 * lost that much energy to the vibration, zero − ν̃, and the axis shows how
 * far that light sits from the zero in the chosen unit, signed so that the
 * Stokes side (energy lost) is positive and grows to the right:
 *   wavenumber, energy:  u(zero) − u(zero − ν̃)   the band itself, any zero
 *   wavelength:          u(zero − ν̃) − u(zero)   Δλ, which depends on the zero
 * Below the zero (anti-Stokes, ν̃ < 0) it is negative.
 */

/**
 * The zero a shift is read from when none has been entered, as an absolute
 * wavenumber in cm⁻¹: a 532 nm laser. A shift in wavenumber or energy units
 * does not depend on it, one in wavelength units does.
 */
export const DEFAULT_LASER_WN = 1e7 / 532;

/** The units the zero itself can be typed in, independent of the shift's own unit. */
export const ZERO_UNITS = ['Å', 'nm', 'cm⁻¹', 'meV', 'eV', 'THz'] as const;
/** Where the zero's units change quantity: wavelength, wavenumber, energy, frequency. */
export const ZERO_UNIT_BREAKS: readonly string[] = ['cm⁻¹', 'meV', 'THz'];

/**
 * Common Raman lasers, offered as the shift's zero. Each is shown in the
 * colour of its light (lib/lightColor.ts), ultraviolet and infrared included.
 */
export const RAMAN_LASERS: { nm: number; name: string }[] = [
  { nm: 244, name: 'deep UV' },
  { nm: 325, name: 'UV, He–Cd' },
  { nm: 405, name: 'violet' },
  { nm: 488, name: 'blue, Ar⁺' },
  { nm: 532, name: 'green' },
  { nm: 633, name: 'red, He–Ne' },
  { nm: 785, name: 'near-infrared' },
  { nm: 1064, name: 'near-infrared, Nd:YAG' },
];

/** Does a shift on this axis depend on the zero? Only where the unit is not linear in energy. */
export const shiftNeedsZero = (axis: AxisProperty) => axis === 'wavelength';

/** A wavenumber (cm⁻¹) as a photon energy in an energy unit. */
function wnToEnergy(wn: number, unit: string): number {
  const eJ = H * C * wn * 100;
  if (unit === 'meV')      return eJ / EV * 1000;
  if (unit === 'eV')       return eJ / EV;
  if (unit === 'J/mol')    return eJ * NA;
  if (unit === 'cal/mol')  return eJ * NA / CAL;
  if (unit === 'kJ/mol')   return eJ * NA / 1000;
  if (unit === 'kcal/mol') return eJ * NA / CAL / 1000;
  throw new Error(`Unknown energy unit: ${unit}`);
}

function energyToWn(value: number, unit: string): number {
  let eJ: number;
  if (unit === 'meV')           eJ = (value / 1000) * EV;
  else if (unit === 'eV')       eJ = value * EV;
  else if (unit === 'J/mol')    eJ = value / NA;
  else if (unit === 'cal/mol')  eJ = (value * CAL) / NA;
  else if (unit === 'kJ/mol')   eJ = (value * 1000) / NA;
  else if (unit === 'kcal/mol') eJ = (value * 1000 * CAL) / NA;
  else throw new Error(`Unknown energy unit: ${unit}`);
  return eJ / (H * C * 100);
}

/** cm⁻¹ → THz: the frequency, c · ν̃. */
const THZ_PER_WN = (C * 100) / 1e12;

function plainValue(wn: number, axis: AxisProperty, unit: string): number {
  if (wn <= 0) return Infinity;

  if (axis === 'wavenumber') {
    if (unit === 'cm⁻¹') return wn;
    if (unit === 'mm⁻¹') return wn / 10;
    if (unit === 'dm⁻¹') return wn * 10;
    if (unit === 'm⁻¹')  return wn * 100;
  } else if (axis === 'wavelength') {
    const wlM = 1 / (wn * 100);
    if (unit === 'μm') return wlM * 1e6;
    if (unit === 'nm') return wlM * 1e9;
    if (unit === 'Å')  return wlM * 1e10;
  } else if (axis === 'energy') {
    return wnToEnergy(wn, unit);
  }
  throw new Error(`Unknown axis/unit: ${axis}/${unit}`);
}

function plainWn(value: number, axis: AxisProperty, unit: string): number {
  if (axis === 'wavenumber') {
    if (unit === 'cm⁻¹') return value;
    if (unit === 'mm⁻¹') return value * 10;
    if (unit === 'dm⁻¹') return value / 10;
    if (unit === 'm⁻¹')  return value / 100;
  } else if (axis === 'wavelength') {
    if (unit === 'μm') return 1e4 / value;
    if (unit === 'nm') return 1e7 / value;
    if (unit === 'Å')  return 1e8 / value;
  } else if (axis === 'energy') {
    return energyToWn(value, unit);
  }
  throw new Error(`Unknown axis/unit: ${axis}/${unit}`);
}

/**
 * A band (cm⁻¹) as a position on the axis. With `shiftZero` (the zero's
 * absolute wavenumber) the axis is a shift from it, see above.
 */
export function wnToValue(wn: number, axis: AxisProperty, unit: string, shiftZero: number | null = null): number {
  if (shiftZero === null) return plainValue(wn, axis, unit);
  const light = shiftZero - wn;
  if (light <= 0) return Infinity;
  return shiftNeedsZero(axis)
    ? plainValue(light, axis, unit) - plainValue(shiftZero, axis, unit)
    : plainValue(shiftZero, axis, unit) - plainValue(light, axis, unit);
}

export function axisRange(
  wnLo: number,
  wnHi: number,
  axis: AxisProperty,
  unit: string,
  shiftZero: number | null = null,
  reversed: boolean = AXES[axis].reversed,
): [number, number] {
  const vLo = wnToValue(wnLo, axis, unit, shiftZero);
  const vHi = wnToValue(wnHi, axis, unit, shiftZero);
  if (reversed) return [Math.max(vLo, vHi), Math.min(vLo, vHi)];
  return [Math.min(vLo, vHi), Math.max(vLo, vHi)];
}

export function axisLabel(axis: AxisProperty, unit: string, shiftZero: number | null = null): string {
  if (shiftZero === null) return `${axis} / ${unit}`;
  return shiftNeedsZero(axis)
    ? `${axis} shift from ${formatLaser(shiftZero, 'nm')} nm / ${unit}`
    : `${axis} shift / ${unit}`;
}

/** Inverse of wnToValue — converts a display value back to wavenumber (cm⁻¹). */
export function valueToWn(value: number, axis: AxisProperty, unit: string, shiftZero: number | null = null): number {
  if (shiftZero === null) return plainWn(value, axis, unit);
  const zero = plainValue(shiftZero, axis, unit);
  const light = shiftNeedsZero(axis) ? plainWn(zero + value, axis, unit) : plainWn(zero - value, axis, unit);
  return shiftZero - light;
}

/**
 * The zero itself in one of the units it can be typed in: its absolute
 * wavenumber, wavelength, photon energy or frequency. This is the number the
 * zero field shows and takes.
 */
export function laserToUnit(laserWn: number, unit: string): number {
  if (unit === 'cm⁻¹') return laserWn;
  if (unit === 'nm')   return 1e7 / laserWn;
  if (unit === 'Å')    return 1e8 / laserWn;
  if (unit === 'THz')  return laserWn * THZ_PER_WN;
  return wnToEnergy(laserWn, unit);
}

export function unitToLaser(value: number, unit: string): number {
  if (unit === 'cm⁻¹') return value;
  if (unit === 'nm')   return 1e7 / value;
  if (unit === 'Å')    return 1e8 / value;
  if (unit === 'THz')  return value / THZ_PER_WN;
  return energyToWn(value, unit);
}

/** A laser for display in a unit, rounded to what that unit is quoted to. */
export function formatLaser(laserWn: number, unit: string): string {
  const v = laserToUnit(laserWn, unit);
  const digits = unit === 'eV' ? 3 : unit === 'nm' || unit === 'meV' || unit === 'THz' ? 1 : 0;
  return String(Number(v.toFixed(digits)));
}

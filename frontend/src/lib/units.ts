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
  reversed: boolean;
}

export const AXES: Record<AxisProperty, AxisSpec> = {
  wavenumber: { units: ['cm⁻¹', 'm⁻¹'],                    defaultUnit: 'cm⁻¹',   reversed: true  },
  wavelength: { units: ['μm', 'nm'],                         defaultUnit: 'μm',     reversed: false },
  energy:     { units: ['meV', 'eV', 'kJ/mol', 'kcal/mol'], defaultUnit: 'kJ/mol', reversed: true  },
};

export function wnToValue(wn: number, axis: AxisProperty, unit: string): number {
  if (wn <= 0) return Infinity;

  if (axis === 'wavenumber') {
    if (unit === 'cm⁻¹') return wn;
    if (unit === 'm⁻¹')  return wn * 100;
  } else if (axis === 'wavelength') {
    const wlM = 1 / (wn * 100);
    if (unit === 'μm') return wlM * 1e6;
    if (unit === 'nm') return wlM * 1e9;
  } else if (axis === 'energy') {
    const eJ = H * C * wn * 100;
    if (unit === 'meV')      return eJ / EV * 1000;
    if (unit === 'eV')       return eJ / EV;
    if (unit === 'kJ/mol')   return eJ * NA / 1000;
    if (unit === 'kcal/mol') return eJ * NA / CAL / 1000;
  }
  throw new Error(`Unknown axis/unit: ${axis}/${unit}`);
}

export function axisRange(wnLo: number, wnHi: number, axis: AxisProperty, unit: string): [number, number] {
  const vLo = wnToValue(wnLo, axis, unit);
  const vHi = wnToValue(wnHi, axis, unit);
  const spec = AXES[axis];
  if (spec.reversed) return [Math.max(vLo, vHi), Math.min(vLo, vHi)];
  return [Math.min(vLo, vHi), Math.max(vLo, vHi)];
}

export function axisLabel(axis: AxisProperty, unit: string): string {
  return `${axis} / ${unit}`;
}

/** Inverse of wnToValue — converts a display value back to wavenumber (cm⁻¹). */
export function valueToWn(value: number, axis: AxisProperty, unit: string): number {
  if (axis === 'wavenumber') {
    if (unit === 'cm⁻¹') return value;
    if (unit === 'm⁻¹')  return value / 100;
  } else if (axis === 'wavelength') {
    if (unit === 'μm') return 1e4 / value;
    if (unit === 'nm') return 1e7 / value;
  } else if (axis === 'energy') {
    let eJ: number;
    if (unit === 'meV')      eJ = (value / 1000) * EV;
    else if (unit === 'eV')       eJ = value * EV;
    else if (unit === 'kJ/mol')   eJ = (value * 1000) / NA;
    else if (unit === 'kcal/mol') eJ = (value * 1000 * CAL) / NA;
    else throw new Error(`Unknown unit: ${unit}`);
    return eJ / (H * C * 100);
  }
  throw new Error(`Unknown axis/unit: ${axis}/${unit}`);
}

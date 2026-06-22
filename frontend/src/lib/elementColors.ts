// CPK-style element colors for the vibration-theory molecule diagrams. Kept
// consistent across every molecule regardless of bonding context — distinct
// from ATOMS_PALETTE in colors.ts, which colors whole bond-environments
// (e.g. 'O=C=O') for the band chart's legend, a different concern.
export const ELEMENT_COLORS: Record<string, string> = {
  C: '#3A3A3A',
  O: '#D9453D',
  H: '#E8E8E8',
  N: '#3A6FD8',
  // Generic metal center (Lewis-acidic cation, isolated surface atom, etc.)
  // — for diagrams that need a real bonded/pivot atom drawn, but where the
  // underlying mode is deliberately metal-generic rather than tied to one
  // specific element.
  M: '#8C8C94',
};

const DEFAULT_ELEMENT_COLOR = '#9B6B3D';

export function colorForElement(element: string): string {
  return ELEMENT_COLORS[element] ?? DEFAULT_ELEMENT_COLOR;
}

// Single-bond covalent radii (pm) — real relative atom sizes, not arbitrary.
// H's value is nudged down slightly from its literature covalent radius
// (31pm) — even at the true proportion it still reads as visually too
// prominent at this rendering scale, sitting right next to its own text
// label.
export const ELEMENT_RADIUS_PM: Record<string, number> = {
  C: 70,
  N: 65,
  O: 60,
  H: 38,
  M: 135,
};

const DEFAULT_RADIUS_PM = 65;

export function radiusForElement(element: string): number {
  return ELEMENT_RADIUS_PM[element] ?? DEFAULT_RADIUS_PM;
}

// Label text needs to stay legible against both light (H) and dark/saturated
// (C, O, N) atom fills.
export function textColorForElement(element: string): string {
  return element === 'H' ? '#2A2A2A' : '#FFFFFF';
}

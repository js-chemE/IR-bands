// Explicit, hand-authored geometry + displacement vectors for the vibration-
// modes molecule diagrams, keyed by Molecule.id + Topology.id, then by
// VibrationMode.id, from vibrations.json. Deliberately not inferred from a
// generic shape — each (molecule, topology) pair gets its own accurate
// geometry; adding a new molecule or topology later is just a new entry
// here plus the matching vibrations.jsonc content.
//
// Physics convention used throughout: a STRETCH mode keeps each bond's own
// direction unchanged and only changes its length (an atom translates along
// its existing bond-direction vector, see ModeVector.dx/dy below); a BEND
// mode keeps every bond's length unchanged and only changes its direction
// (an atom genuinely rotates about a fixed pivot, see ModeVector.rotateDeg).
// For a surface-bound topology, whichever atom(s) are bound to the surface
// (geometry.surface.boundAtoms) are NEVER displaced by any mode — they're
// the fixed anchor everything else moves relative to.

export interface AtomSpec {
  element: string;
  x: number;
  y: number;
}

export interface ModeVector {
  dx: number;
  dy: number;
  // Out-of-plane motion can't be shown as a real 2D displacement, so it's
  // symbolized by the atom growing/shrinking instead — peak fractional
  // radius change at the oscillation's extreme (e.g. 0.35 = ±35%).
  scale?: number;
  // Peak rotation (degrees) about the molecule's local origin — i.e.
  // wherever the fixed/pivot atom sits, by convention always (0, 0). When
  // set, dx/dy are ignored for this atom: its position is the rest position
  // genuinely rotated, which preserves its distance from the pivot (bond
  // length) exactly, and keeps the mutual angle between two atoms that
  // share the same rotateDeg exactly constant too (they rotate together as
  // one rigid unit) — unlike a dx/dy translation, which only approximates
  // that for small amplitudes.
  rotateDeg?: number;
}

export interface SurfaceSpec {
  y: number; // where the horizontal "surface" line is drawn
  boundAtoms: number[]; // indices into atoms[] that are bonded to it (dotted line, and never displaced by any mode)
}

export interface MoleculeGeometry {
  atoms: AtomSpec[];
  bonds: [number, number][];
  modes: Record<string, ModeVector[]>; // mode id -> one vector per atom, same order as atoms[]
  surface?: SurfaceSpec; // omitted for gas-phase topologies
}

// moleculeId -> topologyId -> geometry
export const MOLECULE_GEOMETRY: Record<string, Record<string, MoleculeGeometry>> = {
  co2: {
    gas: {
      atoms: [
        { element: 'O', x: -24, y: 0 },
        { element: 'C', x: 0, y: 0 },
        { element: 'O', x: 24, y: 0 },
      ],
      bonds: [[0, 1], [1, 2]],
      modes: {
        // Outer atoms move oppositely along the bond axis, center fixed.
        co2_stretch_symmetric: [
          { dx: -1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
        ],
        // Outer atoms move the same direction, center stays visually fixed —
        // lengthens one bond while shortening the other.
        co2_stretch_asymmetric: [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
        ],
        // Outer atoms move the same direction perpendicular to the bond axis,
        // center recoils oppositely — this is what bends the O-C-O angle.
        co2_bend: [
          { dx: 0, dy: 1 },
          { dx: 0, dy: -0.6 },
          { dx: 0, dy: 1 },
        ],
        // Same antisymmetric pattern as co2_bend (outer atoms together,
        // center opposite) but along the out-of-plane axis, which a flat SVG
        // can't show as a real displacement — rendered as a size pulse instead.
        co2_bend_wagging: [
          { dx: 0, dy: 0, scale: 0.35 },
          { dx: 0, dy: 0, scale: -0.2 },
          { dx: 0, dy: 0, scale: 0.35 },
        ],
      },
    },
  },
  co: {
    gas: {
      atoms: [
        { element: 'C', x: -14, y: 0 },
        { element: 'O', x: 14, y: 0 },
      ],
      bonds: [[0, 1]],
      modes: {
        // Only one bond, so both atoms simply move apart/together — no
        // symmetric/asymmetric distinction is possible with just two atoms.
        co_stretch: [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ],
      },
    },
  },
  // HCOO* — only bidentate is offered (no monodentate content yet). Both
  // O's are bonded to the surface, H points away from it.
  formate: {
    bidentate: {
      atoms: [
        { element: 'C', x: 0, y: 0 },
        { element: 'O', x: -19, y: 10 },
        { element: 'O', x: 19, y: 10 },
        { element: 'H', x: 0, y: -22 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: 26, boundAtoms: [1, 2] },
      modes: {
        // Both O's are bound to the surface, so they can't move — instead C
        // moves along the O1-O2 perpendicular bisector (straight toward/away
        // from the surface). Since C stays equidistant from both fixed O's
        // along this line, both C-O bond lengths grow/shrink together — the
        // "breathing" symmetric stretch.
        formate_stretch_symmetric: [
          { dx: 0, dy: 1 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
        // C slides sideways, parallel to the O1-O2 line — moving closer to
        // one fixed O (shortening that bond) and farther from the other
        // (lengthening it). The natural asymmetric counterpart of the
        // symmetric "breathing" motion above, with the same two O's pinned.
        formate_stretch_asymmetric: [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
        // H moves along the C-H bond axis, center fixed — the bound O's
        // aren't involved in this local mode.
        formate_ch_stretch: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
        // O-C-H bending: C and both bound O's stay completely fixed (so the
        // O-C-O angle and every C-O bond length are exactly unchanged), and
        // only H rotates about C — a genuine rotation, not a translation, so
        // the C-H bond length stays exactly constant too. The changing thing
        // is purely the O-C-H angle, which is what this mode actually is.
        formate_och_scissoring: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 20 },
        ],
      },
    },
  },
  // CO3^2- — trigonal planar, C at center, 3 O's 120° apart. Bidentate binds
  // two O's to the surface (the third points away); monodentate binds one
  // (the other two point away).
  carbonate: {
    bidentate: {
      atoms: [
        { element: 'C', x: 0, y: 0 },
        { element: 'O', x: -15, y: 16 },
        { element: 'O', x: 15, y: 16 },
        { element: 'O', x: 0, y: -22 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: 32, boundAtoms: [1, 2] },
      modes: {
        // Same "breathing" trick as formate's bidentate stretch: both bound
        // O's are fixed, so C moves along their perpendicular bisector.
        carbonate_stretch_symmetric: [
          { dx: 0, dy: 1 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
        // C slides sideways between the two fixed, bound O's — one bond
        // shortens as the other lengthens.
        carbonate_stretch_asymmetric: [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
        // The free (unbound) O rotates about C — C and both bound O's stay
        // fixed, so every bond length is exactly preserved; only the angle
        // the free O makes with the bound pair changes.
        carbonate_scissoring: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 20 },
        ],
        // Out-of-plane: the central C moves out of the O-C-O plane —
        // symbolized by C pulsing in size, with every O (bound or not) fixed.
        carbonate_wagging: [
          { dx: 0, dy: 0, scale: 0.4 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
      },
    },
    monodentate: {
      atoms: [
        { element: 'C', x: 0, y: 0 },
        { element: 'O', x: 0, y: 18 },
        { element: 'O', x: -19, y: -11 },
        { element: 'O', x: 19, y: -11 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: 34, boundAtoms: [1] },
      modes: {
        // Only one O is bound (fixed); C stays fixed too, and the two free
        // O's move outward along their own bond directions, in phase.
        carbonate_stretch_symmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.866, dy: -0.501 },
          { dx: 0.866, dy: -0.501 },
        ],
        // One free O moves outward while the other moves inward — C and the
        // bound O stay fixed.
        carbonate_stretch_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.866, dy: -0.501 },
          { dx: -0.866, dy: 0.501 },
        ],
        // The two free O's rotate by equal and opposite angles about C, so
        // their mutual angle genuinely changes while every bond length stays
        // exact. The bound O and C stay fixed.
        carbonate_scissoring: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 15 },
          { dx: 0, dy: 0, rotateDeg: -15 },
        ],
        // Out-of-plane: the central C moves out of the O-C-O plane —
        // symbolized by C pulsing in size, with every O (bound or not) fixed.
        carbonate_wagging: [
          { dx: 0, dy: 0, scale: 0.4 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
        ],
      },
    },
  },
};

export function geometryFor(moleculeId: string, topologyId: string): MoleculeGeometry | null {
  return MOLECULE_GEOMETRY[moleculeId]?.[topologyId] ?? null;
}

export interface FundamentalModeCount {
  formulaLabel: string; // "3N − 5" or "3N − 6", N already substituted in
  max: number;
  atomCount: number;
}

// Standard normal-mode-counting formula: linear molecules have 3N-5
// vibrational degrees of freedom, non-linear ones 3N-6 (the difference is
// that a linear molecule only has 2 rotational degrees of freedom, not 3).
export function fundamentalModeCount(shape: 'linear' | 'nonlinear', atomCount: number): FundamentalModeCount {
  const max = shape === 'linear' ? 3 * atomCount - 5 : 3 * atomCount - 6;
  const formulaLabel = shape === 'linear'
    ? `3(${atomCount}) − 5 = ${max}`
    : `3(${atomCount}) − 6 = ${max}`;
  return { formulaLabel, max, atomCount };
}

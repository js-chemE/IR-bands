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
  // Overrides radiusForElement(element) (pm) for this one atom — used
  // sparingly, to suggest an atom sits closer to the viewer in an
  // otherwise-2D diagram (e.g. one C-H bond of a tetrahedral molecule drawn
  // coming out of the page) without a real 3D perspective renderer.
  radiusOverride?: number;
}

export interface ModeVector {
  dx: number;
  dy: number;
  // Out-of-plane motion can't be shown as a real 2D displacement, so it's
  // symbolized by the atom growing/shrinking instead — peak fractional
  // radius change at the oscillation's extreme (e.g. 0.35 = ±35%).
  scale?: number;
  // Peak rotation (degrees) about `pivot` (defaults to (0, 0) if omitted —
  // only correct when the actual pivot atom's rest position really is the
  // origin). When set, dx/dy are ignored for this atom: its position is the
  // rest position genuinely rotated about the pivot, which preserves its
  // distance from the pivot (bond length) exactly, and keeps the mutual
  // angle between two atoms that share the same rotateDeg exactly constant
  // too (they rotate together as one rigid unit) — unlike a dx/dy
  // translation, which only approximates that for small amplitudes.
  rotateDeg?: number;
  // The rotation center for rotateDeg above — almost always the position of
  // whichever atom is the actual fixed pivot in this mode (e.g. the central
  // C a free O swings around). Required whenever that atom's rest position
  // isn't (0, 0) — every geometry in this file now positions atoms relative
  // to a shared surface line rather than always putting the pivot at the
  // origin, so this needs to be supplied explicitly per use.
  pivot?: { x: number; y: number };
}

export interface SurfaceAnchor {
  atomIndex: number; // index into atoms[] that is bonded to the surface
  // One connector line per offset, each drawn from this atom's CURRENT
  // (animated) position down to the FIXED point (atoms[atomIndex].x +
  // offset, surface.y) — i.e. the offset is measured from the atom's own
  // rest x, not its animated x, since it represents a real, immobile metal
  // atom's location. A single offset of 0 (on-top/mono-coordinate) draws
  // one line straight down; multiple offsets fan out to represent multiple
  // real metal neighbors (e.g. [-8, 8] for a 2-fold bridge site, three or
  // four evenly spaced for a hollow site) — this is what actually
  // distinguishes a bridged/hollow diagram from a linear one, since the
  // adsorbate's own atoms otherwise look identical across binding sites.
  offsets: number[];
}

export interface SurfaceSpec {
  y: number; // where the horizontal "surface" line is drawn — SURFACE_Y for every topology that has one, see that constant below
  boundAtoms: SurfaceAnchor[];
  // Indices into atoms[] that are drawn as real, on-diagram atoms embedded
  // IN the surface rather than floating above it (e.g. a metal cation drawn
  // at the vertex of a geminal dicarbonyl) — unlike boundAtoms above, which
  // are never actually drawn crossing the line, these atoms' own circles are
  // positioned straddling the line and get their lower portion covered by
  // an opaque slab, so they read as "poking up out of" the surface rather
  // than floating freely or fully buried. Any bond touching one of these
  // atoms renders with the same dashed style as a surface-bond connector,
  // since it's now a bond crossing the surface boundary rather than a bond
  // between two free-floating atoms.
  buriedAtoms?: number[];
}

// Single shared surface-line position for every surface-bound topology in
// this file (formate, carbonate, methoxy, and CO's linear/bridged/hollow) —
// so switching molecules never makes the "ground" jump. Each molecule's own
// atoms are shifted up/down as a rigid block so its bound atom always sits
// BOUND_ATOM_GAP above this line, regardless of how tall that molecule's own
// free-floating atoms are above the bound one — keeping that gap constant
// keeps every surface-bond connector line the same rest length too.
export const SURFACE_Y = 30;
const BOUND_ATOM_GAP = 16;
export const BOUND_ATOM_Y = SURFACE_Y - BOUND_ATOM_GAP;

export interface MoleculeGeometry {
  atoms: AtomSpec[];
  bonds: [number, number][];
  modes: Record<string, ModeVector[]>; // mode id -> one vector per atom, same order as atoms[]
  surface?: SurfaceSpec; // omitted for gas-phase topologies
  // Atom indices whose bond(s) render with the same dashed style as a
  // surface-crossing connector — independent of `surface` above, since this
  // is for a different reason: indicating a bond going INTO the page (away
  // from the viewer) in an otherwise flat 2D diagram, not a surface
  // boundary. (surface.buriedAtoms also triggers this same dashed style,
  // for its own, surface-crossing reason — the two causes are unrelated but
  // share the rendering.)
  dashedBondAtoms?: number[];
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
  // CH4 — 
  ch4: {
    gas: {
      atoms: [
        { element: 'C', x: 0, y: 0 },
        { element: 'H', x: 12.3, y: 16.9 },
        { element: 'H', x: -27, y: 12.8 },
        { element: 'H', x: 0, y: -30 },
        { element: 'H', x: 25.2, y: 11.4 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
      modes: {
        // All four C-H bonds stretch outward together, in phase — C stays
        // fixed, each H moves along its own (projected) bond direction.
        ch4_stretch_symmetric: [
          { dx: 0, dy: 0 },
          { dx: 0.472, dy: 0.882 },
          { dx: -0.942, dy: 0.336 },
          { dx: 0, dy: 1 },
          { dx: 0.916, dy: 0.401 },
        ],
        // One representative component of the doubly-degenerate E bend: the
        // two lower-right H's scissor toward/apart from each other (equal
        // and opposite rotation about the fixed C), the other two untouched.
        ch4_bend_e: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 15 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: -15 },
        ],
        // One representative component of the triply-degenerate asymmetric
        // stretch: the upper-left H stretches outward while the top H
        // compresses inward, the other two untouched.
        ch4_stretch_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.942, dy: 0.336 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: 0 },
        ],
        // One representative component of the triply-degenerate T2 bend:
        // the lower-right and upper-right H's rock sideways together, in
        // phase, the other two untouched.
        ch4_bend_t2: [
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
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
    // Adsorbed topologies all share the same vertical C-O layout — C
    // (bonded to the metal in real life via its C end) sits just above the
    // surface line, O points away from it. CO itself is only ever 2 atoms
    // regardless of how many metal neighbors it's coordinated to, so unlike
    // carbonate/formate's differently-shaped topologies, what distinguishes
    // linear/bridged/hollow here is which modes move which way, the
    // mode-list content, and the topology/point-group labels — not the
    // diagram's silhouette. C is in `boundAtoms` (drawn with a connector
    // down to the surface), but — unlike every other molecule's bound
    // atoms, which always stay exactly fixed — the M-C stretch mode below
    // deliberately gives C its own nonzero vector: the connector is drawn
    // from C's current (animated) position to the fixed surface line, so a
    // moving "bound" atom there reads correctly as the M-C bond itself
    // stretching, not as a rendering bug.
    linear: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y },
        { element: 'O', x: 0, y: BOUND_ATOM_Y - 28 },
      ],
      bonds: [[0, 1]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 0, offsets: [0] }] },
      modes: {
        // C fixed, O moves along the bond — same motion as gas-phase
        // co_stretch, just relabeled per topology.
        co_stretch_linear: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
        // The whole C-O unit translates rigidly toward/away from the metal
        // — the M-C bond itself stretching, exactly preserving the C-O
        // bond length (both atoms move by the same vector).
        co_mstretch_linear: [
          { dx: 0, dy: -1 },
          { dx: 0, dy: -1 },
        ],
        // Frustrated rotation: O swings sideways about the fixed C, a
        // genuine rotation (rotateDeg) that preserves the C-O bond length
        // exactly — the whole axis tilting away from perpendicular.
        co_frustrated_tilt_linear: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 25, pivot: { x: 0, y: BOUND_ATOM_Y } },
        ],
        // Frustrated translation: the whole C-O unit slides sideways,
        // rigidly, both atoms by the same vector — distinct from the
        // M-C stretch above (which slides along the surface normal,
        // not parallel to it).
        co_frustrated_translate_linear: [
          { dx: 1, dy: 0 },
          { dx: 1, dy: 0 },
        ],
      },
    },
    // Same 2-atom C-O geometry as linear above — what actually shows the
    // 2-fold coordination is the surface itself: two connector lines fan
    // out from C to two separate fixed points on the surface line (the two
    // real metal neighbors), instead of linear's single straight-down one.
    bridged: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y },
        { element: 'O', x: 0, y: BOUND_ATOM_Y - 28 },
      ],
      bonds: [[0, 1]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 0, offsets: [-9, 9] }] },
      modes: {
        co_stretch_bridged: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
        co_mstretch_bridged: [
          { dx: 0, dy: -1 },
          { dx: 0, dy: -1 },
        ],
        // Shearing: C (and O rigidly with it) shifts sideways along the
        // bridge axis — one fixed metal-contact connector visibly shortens
        // as the other lengthens, rather than both stretching together as
        // in the symmetric M-C stretch above.
        co_mstretch_asym_bridged: [
          { dx: 1, dy: 0 },
          { dx: 1, dy: 0 },
        ],
      },
    },
    // Same again, but three fanned-out connectors — representing either a
    // real 3-fold (fcc/hcp) or 4-fold hollow site, combined into one
    // generic "more than 2 neighbors" picture per this topology's own note.
    hollow: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y },
        { element: 'O', x: 0, y: BOUND_ATOM_Y - 28 },
      ],
      bonds: [[0, 1]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 0, offsets: [-11, 0, 11] }] },
      modes: {
        co_stretch_hollow: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
      },
    },
    // M(CO)2 geminal dicarbonyl — twice the CO content of every other "co"
    // topology, and a bent (nonlinear) shape rather than linear, but still
    // folded in here as just another adsorption topology rather than its
    // own molecule (the fundamental-mode-count formula above doesn't
    // perfectly fit this one as a result — same already-accepted situation
    // as linear/bridged/hollow's own "extra modes" mismatch, just in the
    // opposite direction). The metal center IS drawn here (a generic "M"
    // atom, unlike every OTHER topology in this file, where the metal is
    // never drawn at all) since it's the literal shared pivot both CO
    // ligands bond to and rotate around — positioned straddling the shared
    // surface line itself (buriedAtoms below), with only its top ~2/5
    // poking up out of it, rather than floating above like a normal bound
    // atom. M-C bond lengths are deliberately longer than the other CO
    // topologies' own C-O bonds so that (a) the dashed surface-crossing
    // bonds actually have room to show their dash pattern instead of
    // reading as solid, and (b) the asymmetric C-O stretch's inward-moving
    // oxygen has enough room that it never visually reaches the metal atom.
    geminal: {
      atoms: [
        { element: 'M', x: 0, y: 33.5 },
        { element: 'C', x: -20, y: 8 },
        { element: 'O', x: -36, y: -12 },
        { element: 'C', x: 20, y: 8 },
        { element: 'O', x: 36, y: -12 },
      ],
      bonds: [[0, 1], [1, 2], [0, 3], [3, 4]],
      // M straddles the line (33.5 puts ~2/5 of its drawn radius above
      // SURFACE_Y=30, the rest cut off by the slab) — see SurfaceSpec.
      surface: { y: SURFACE_Y, boundAtoms: [], buriedAtoms: [0] },
      modes: {
        // Both C-O bonds stretch outward together, in phase — M and both
        // C's stay fixed, only the O's move, along their own bond
        // directions (same convention as every other symmetric stretch in
        // this file).
        co_geminal_stretch_symmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.625, dy: -0.781 },
          { dx: 0, dy: 0 },
          { dx: 0.625, dy: -0.781 },
        ],
        // One C-O bond stretches outward while the other compresses inward
        // — the same pair of O's, just out of phase with each other. The
        // longer C-O bonds keep the inward-moving O well clear of M even at
        // full amplitude.
        co_geminal_stretch_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.625, dy: -0.781 },
          { dx: 0, dy: 0 },
          { dx: -0.625, dy: 0.781 },
        ],
        // Both rigid C-O ligands (C+O moving together as one unit) translate
        // away from the fixed M, in phase — the M-C bonds stretching
        // together rather than the internal C-O bonds above.
        co_geminal_mstretch_symmetric: [
          { dx: 0, dy: 0 },
          { dx: -0.617, dy: -0.787 },
          { dx: -0.617, dy: -0.787 },
          { dx: 0.617, dy: -0.787 },
          { dx: 0.617, dy: -0.787 },
        ],
        // One rigid C-O ligand translates away from M while the other
        // translates toward it — the two M-C bonds stretching in antiphase.
        co_geminal_mstretch_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: -0.617, dy: -0.787 },
          { dx: -0.617, dy: -0.787 },
          { dx: -0.617, dy: 0.787 },
          { dx: -0.617, dy: 0.787 },
        ],
        // Scissoring: both rigid ligands rotate about the fixed M by equal
        // and opposite angles, so the C-M-C angle genuinely opens/closes
        // while every M-C (and C-O) bond length stays exact.
        co_geminal_scissoring: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 15, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: 15, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: -15, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: -15, pivot: { x: 0, y: 33.5 } },
        ],
        // Rocking: both rigid ligands rotate about the fixed M by the SAME
        // angle and sense this time — like a pair of windshield wipers —
        // so the C-M-C angle itself stays constant, only its orientation
        // relative to the rest of the diagram changes.
        co_geminal_rocking: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: 33.5 } },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: 33.5 } },
        ],
      },
    },
    // Same vertical C-O layout as `linear`, but flipped end-for-end: O is
    // the bound atom here, C points away from the surface, since this
    // topology is specifically CO coordinated through its oxygen end.
    isocarbonyl: {
      atoms: [
        { element: 'O', x: 0, y: BOUND_ATOM_Y },
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 28 },
      ],
      bonds: [[0, 1]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 0, offsets: [0] }] },
      modes: {
        // O fixed, C moves along the bond — same single-bond motion as
        // every other CO stretch in this file, just with the bound atom
        // swapped.
        co_iso_stretch: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
      },
    },
  },
  // HCOO* — bidentate has both O's bonded to the surface, H pointing away;
  // monodentate has only one bound O, with the free O and H both pointing
  // away from it (drawn at mirrored x-positions purely for layout clarity —
  // unlike carbonate's two free O's, formate's free O and H are NOT
  // physically equivalent, so this left-right symmetry is a stylization,
  // not a real symmetry element).
  formate: {
    monodentate: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 18 },
        { element: 'O', x: 0, y: BOUND_ATOM_Y },
        { element: 'O', x: -19, y: BOUND_ATOM_Y - 29 },
        { element: 'H', x: 19, y: BOUND_ATOM_Y - 29 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 1, offsets: [0] }] },
      // Every mode below gives every atom — including the surface-bound O —
      // some real motion, even where it's only small. This is a deliberate
      // departure from this file's usual "bound atom stays exactly fixed"
      // simplification: a real M-O bond isn't infinitely rigid, just much
      // stiffer than the rest of the molecule, so the bound O still moves
      // a little — it just moves LESS than its unbound neighbors do. The
      // existing surface-connector rendering (MoleculeViewer.svelte) already
      // handles a moving bound atom correctly (see `linear` CO's own M-C
      // stretch for the precedent), so animating that small motion here is
      // just a more faithful picture, not a rendering workaround.
      modes: {
        // H moves with most of the amplitude, away from C along the C-H
        // bond; C recoils slightly the opposite way along that same axis to
        // keep the pair's combined motion balanced. The bound O, free O, and
        // (implicitly) the metal stay essentially still — this mode is
        // localized almost entirely on the light H atom.
        formate_ch_stretch_monodentate: [
          { dx: -0.15, dy: 0.09 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0.866, dy: -0.501 },
        ],
        // The free O moves strongly along its own C=O bond direction; C
        // reciprocates along that exact same axis (not just sideways) since
        // the two are directly bonded. H and the bound O each pick up a
        // small compensating swing in the plane — not part of the C=O bond
        // itself, just the rest of the frame absorbing the shifting center
        // of mass.
        formate_stretch_asymmetric_monodentate: [
          { dx: 0.26, dy: 0.15 },
          { dx: 0.05, dy: -0.05 },
          { dx: -0.866, dy: -0.501 },
          { dx: 0.05, dy: 0.03 },
        ],
        // H genuinely rotates about C's fixed rest position — a true arc,
        // perpendicular to the C-H bond, that keeps the C-H bond length
        // exactly constant. C wiggles slightly sideways, opposite to H's
        // swing, and both oxygens tilt by a small counter-rotation of their
        // own (same rotation trick, much smaller angle) — every bond length
        // in the molecule stays exact throughout, only the angles change.
        formate_och_scissoring_monodentate: [
          { dx: -0.15, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: -3, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0, dy: 0, rotateDeg: -3, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0, dy: 0, rotateDeg: 20, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
        ],
        // The C-Obound bond itself stretches: C and the bound O move apart
        // along their shared (vertical) axis, the bound O by a visibly
        // smaller amount since it's anchored to the heavy surface metal —
        // stiffer, not immovable. The free O and H translate rigidly along
        // with C (the same vector, not a fraction of it), since they aren't
        // part of the bond that's actually stretching here.
        formate_stretch_symmetric_monodentate: [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 0.3 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: -1 },
        ],
        // Both oxygens now move, genuinely rotating about C's fixed rest
        // position by equal and opposite angles, so the Obound-C-Ofree angle
        // itself opens and closes while every bond length stays exact — the
        // bound O is no longer the odd one out the way it is in every other
        // mode here. C and H both shift outward together along the angle's
        // bisector (which happens to point roughly toward H's own rest
        // position), in the opposite sense from the oxygens, to keep the
        // frame's overall motion balanced.
        formate_bend_monodentate: [
          { dx: 0.26, dy: -0.15 },
          { dx: 0, dy: 0, rotateDeg: 15, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0, dy: 0, rotateDeg: -15, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0.26, dy: -0.15 },
        ],
        // Out-of-plane: H pushes out of the plane while C recoils the
        // opposite way, same antisymmetric pattern as the bidentate γ(CH)
        // below — but here both oxygens also push slightly the same
        // direction as H, a small extra counterweight against the heavier
        // C's larger swing the other way.
        formate_ch_wagging_monodentate: [
          { dx: 0, dy: 0, scale: -0.4 },
          { dx: 0, dy: 0, scale: 0.15 },
          { dx: 0, dy: 0, scale: 0.15 },
          { dx: 0, dy: 0, scale: 0.3 },
        ],
      },
    },
    bidentate: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 10 },
        { element: 'O', x: -19, y: BOUND_ATOM_Y },
        { element: 'O', x: 19, y: BOUND_ATOM_Y },
        { element: 'H', x: 0, y: BOUND_ATOM_Y - 32 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 1, offsets: [0] }, { atomIndex: 2, offsets: [0] }] },
      // As with monodentate above, both bound O's now get some real motion
      // of their own in every mode below, rather than sitting perfectly
      // rigid — anchored to two separate heavy surface metal atoms makes
      // their own bonds stiffer than the rest of the molecule, not
      // infinitely fixed.
      modes: {
        // H moves with most of the amplitude, away from C along the C-H
        // bond; C recoils slightly the opposite way. Both bound O's, on the
        // far side of C from this motion, stay essentially still.
        formate_ch_stretch_bidentate: [
          { dx: 0, dy: 0.15 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
        // Both O's pull outward along their own C-O bond directions, in
        // phase — the "breathing" symmetric stretch. C plunges further down
        // into the pocket between them as they retreat, and H rides along
        // rigidly with C (the same vector), since the C-H bond itself isn't
        // what's stretching here.
        formate_stretch_symmetric_bidentate: [
          { dx: 0, dy: 1 },
          { dx: -0.31, dy: 0.16 },
          { dx: 0.31, dy: 0.16 },
          { dx: 0, dy: 1 },
        ],
        // O-C-O scissor: both O's swing toward each other along x, genuinely
        // narrowing their separation, while C and H both retreat together
        // (the same vector) away from the closing pocket — two compounding
        // effects on the same angle, rather than one atom alone faking it.
        formate_bend_bidentate: [
          { dx: 0, dy: -0.5 },
          { dx: 0.3, dy: 0 },
          { dx: -0.3, dy: 0 },
          { dx: 0, dy: -0.5 },
        ],
        // Asymmetric stretch: one O moves toward C (shortening that bond)
        // while the other moves away (lengthening it) — and C itself shifts
        // sideways toward whichever O is shortening, establishing a more
        // localized, double-bond-like character on that side. H shears
        // sideways the opposite way from C, a smaller coupled motion.
        formate_stretch_asymmetric_bidentate: [
          { dx: -1, dy: 0 },
          { dx: 0.27, dy: -0.14 },
          { dx: 0.27, dy: 0.14 },
          { dx: 0.3, dy: 0 },
        ],
        // O-C-H bending: H genuinely rotates about C's fixed rest position —
        // a true arc that keeps the C-H bond length exactly constant. C
        // wiggles slightly sideways, opposite to H's swing, and both O's
        // tilt by a small counter-rotation of their own (same trick, much
        // smaller angle) rather than staying perfectly inert.
        formate_och_scissoring_bidentate: [
          { dx: -0.15, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: -3, pivot: { x: 0, y: BOUND_ATOM_Y - 10 } },
          { dx: 0, dy: 0, rotateDeg: -3, pivot: { x: 0, y: BOUND_ATOM_Y - 10 } },
          { dx: 0, dy: 0, rotateDeg: 20, pivot: { x: 0, y: BOUND_ATOM_Y - 10 } },
        ],
        // Out-of-plane: H pushes out of the plane while C recoils the
        // opposite way — but now both O's also push slightly the same
        // direction as H, in unison, a small extra counterweight against
        // the heavier C's larger swing the other way.
        formate_ch_wagging_bidentate: [
          { dx: 0, dy: 0, scale: -0.4 },
          { dx: 0, dy: 0, scale: 0.15 },
          { dx: 0, dy: 0, scale: 0.15 },
          { dx: 0, dy: 0, scale: 0.3 },
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
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 16 },
        { element: 'O', x: -15, y: BOUND_ATOM_Y },
        { element: 'O', x: 15, y: BOUND_ATOM_Y },
        { element: 'O', x: 0, y: BOUND_ATOM_Y - 38 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 1, offsets: [0] }, { atomIndex: 2, offsets: [0] }] },
      modes: {
        // Same "breathing" trick as formate's bidentate stretch: both bound
        // O's are fixed, so C moves along their perpendicular bisector,
        // expanding/contracting both C-Ob bonds in unison — with the free O
        // drifting slightly the opposite way as a small counter-motion.
        carbonate_stretch_symmetric_bidentate: [
          { dx: 0, dy: 1 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -0.3 },
        ],
        // C slides sideways between the two fixed, bound O's — one bond
        // shortens as the other lengthens — while the free O leans slightly
        // the opposite way.
        carbonate_stretch_asymmetric_bidentate: [
          { dx: 1, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.3, dy: 0 },
        ],
        // Ring flattening: C and the free O draw apart from each other
        // symmetrically along their shared axis — both bound O's, which
        // define the ring and can't move, stay exactly fixed either way.
        // Distinct from the symmetric stretch above (C alone moves there;
        // here both C and the free O move, equally, apart).
        carbonate_scissoring_bidentate: [
          { dx: 0, dy: 0.5 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -0.5 },
        ],
        // The odd-one-out stretch: the free O is the one oxygen NOT bound to
        // the surface, so unlike the other two stretches (which move C
        // relative to the fixed bound pair) this one moves the free O along
        // its own bond direction, with C recoiling slightly the other way —
        // both bound O's stay fixed regardless.
        carbonate_stretch_anchor_bidentate: [
          { dx: 0, dy: 0.3 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
        ],
        // Rocking: C and the free O tilt sideways together, in phase, as
        // the whole non-anchored part of the structure swings relative to
        // the two fixed bound O's — distinct from scissoring above, where
        // they instead move apart from each other along their shared axis.
        carbonate_rocking_bidentate: [
          { dx: 0.4, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 1, dy: 0 },
        ],
        // Out-of-plane: the free (unbound) O pushes out of the plane while C
        // recoils the opposite way — same antisymmetric out-of-plane pattern
        // as co2_bend_wagging above, just with one O instead of two. Both
        // bound O's, which anchor the plane itself, stay fixed.
        carbonate_wagging_bidentate: [
          { dx: 0, dy: 0, scale: -0.4 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, scale: 0.3 },
        ],
      },
    },
    monodentate: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 18 },
        { element: 'O', x: 0, y: BOUND_ATOM_Y },
        { element: 'O', x: -19, y: BOUND_ATOM_Y - 29 },
        { element: 'O', x: 19, y: BOUND_ATOM_Y - 29 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 1, offsets: [0] }] },
      modes: {
        // Only one O is bound; the two free O's move outward along their
        // own bond directions, in phase, while C itself dips slightly
        // toward the bound O — a small extra motion Solis et al.'s figure
        // shows alongside the breathing terminal pair.
        carbonate_stretch_symmetric_monodentate: [
          { dx: 0, dy: 0.3 },
          { dx: 0, dy: 0 },
          { dx: -0.866, dy: -0.501 },
          { dx: 0.866, dy: -0.501 },
        ],
        // One free O moves outward while the other moves inward — and C
        // itself leans slightly toward whichever free O is moving inward
        // toward it, purely horizontally (Solis et al.'s figure shows a
        // small horizontal C arrow pointing at that same oxygen, not a
        // diagonal one). The bound O stays fixed regardless.
        carbonate_stretch_asymmetric_monodentate: [
          { dx: 0.3, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.866, dy: -0.501 },
          { dx: -0.866, dy: 0.501 },
        ],
        // The two free O's rotate by equal and opposite angles about C, so
        // their mutual angle genuinely changes while every bond length stays
        // exact — and C itself dips slightly toward the bound O at the same
        // time, per Solis et al.'s figure. The bound O alone stays fixed.
        carbonate_scissoring_monodentate: [
          { dx: 0, dy: 0.3 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 15, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0, dy: 0, rotateDeg: -15, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
        ],
        // The odd-one-out stretch: Os is the one oxygen bound to the
        // surface, so it can't move — C translates away from it (stretching
        // the C-Os bond), while the two free O's lean slightly toward C
        // rather than just rigidly following it (the coupled ν(C-Os)+ν(C-O)
        // character the figure's label calls out).
        carbonate_stretch_anchor_monodentate: [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 0 },
          { dx: 0.4, dy: -0.6 },
          { dx: -0.4, dy: -0.6 },
        ],
        // Rocking: C shifts one way (a modest amount) while both free O's
        // genuinely ROTATE about C's rest position, by the same angle and
        // sense — not a sideways slide, so each O-C bond length and the
        // O-C-O angle between them both stay exactly constant throughout,
        // only their shared orientation relative to the fixed bound O
        // changes. Since they share one pivot and rotate together, the pair
        // swings as a rigid unit toward the opposite side from C, like a
        // seesaw — per Solis et al.'s figure, where the free O arrows point
        // opposite the C arrow.
        carbonate_rocking_monodentate: [
          { dx: -0.6, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
          { dx: 0, dy: 0, rotateDeg: 12, pivot: { x: 0, y: BOUND_ATOM_Y - 18 } },
        ],
        // Out-of-plane: both free O's push out of the plane together while C
        // recoils the opposite way — same antisymmetric out-of-plane pattern
        // as co2_bend_wagging above, just with two O's instead of two on
        // either side of a center. The bound O, which anchors the plane
        // itself, stays fixed.
        carbonate_wagging_monodentate: [
          { dx: 0, dy: 0, scale: -0.4 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, scale: 0.3 },
          { dx: 0, dy: 0, scale: 0.3 },
        ],
      },
    },
  },
  // CH3O* — C bonded to O (bound to the surface) and 3 H's fanning away from
  // it. Only one real topology, conventionally called monodentate (the
  // dominant binding mode): the bound O is always the single anchor, mono-
  // vs bidentate (one M-O bond vs. O bridging two M's) doesn't change which
  // atoms move or how, only the C-O bond's frequency — so unlike carbonate
  // there's nothing for a second topology to actually animate differently.
  methoxy: {
    monodentate: {
      atoms: [
        { element: 'C', x: 0, y: BOUND_ATOM_Y - 24 },
        { element: 'O', x: 0, y: BOUND_ATOM_Y },
        { element: 'H', x: -15, y: BOUND_ATOM_Y - 40 },
        { element: 'H', x: 15, y: BOUND_ATOM_Y - 40 },
        { element: 'H', x: 0, y: BOUND_ATOM_Y - 52 },
      ],
      bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
      surface: { y: SURFACE_Y, boundAtoms: [{ atomIndex: 1, offsets: [0] }] },
      modes: {
        // O is bound (fixed); each H moves outward along its own C-H bond
        // direction, in phase — C stays fixed too, same convention as the
        // other molecules' symmetric stretches.
        methoxy_stretch_symmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.684, dy: -0.73 },
          { dx: 0.684, dy: -0.73 },
          { dx: 0, dy: -1 },
        ],
        // One H moves outward while a second moves inward (along its own
        // bond direction, negated) — the third H is the spectator.
        methoxy_stretch_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: -0.684, dy: -0.73 },
          { dx: -0.684, dy: 0.73 },
          { dx: 0, dy: 0 },
        ],
        // Umbrella deformation: all three H's swing away from (or toward)
        // the C-O axis together. A true 3-fold-symmetric cone-angle motion
        // can't be drawn as a single 2D in-plane displacement without
        // breaking that symmetry, so — same trick as the other molecules'
        // genuinely out-of-plane bends — it's shown as the three H's
        // pulsing in size together instead.
        methoxy_bend_symmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0, scale: 0.3 },
          { dx: 0, dy: 0, scale: 0.3 },
          { dx: 0, dy: 0, scale: 0.3 },
        ],
        // Two H's rock in antiphase (one toward the surface, one away)
        // while the third stays put — breaks the 3-fold symmetry, so unlike
        // the symmetric version above this one IS a real in-plane motion.
        methoxy_bend_asymmetric: [
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: 0.4 },
          { dx: 0, dy: -0.4 },
          { dx: 0, dy: 0 },
        ],
        // O is bound (fixed); the whole CH3 group (C plus all three H's)
        // translates together along the C-O axis, away from the fixed O —
        // a rigid-body shift that exactly preserves every C-H bond length.
        methoxy_co_stretch: [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: -1 },
        ],
      },
    },
  },
};

export function geometryFor(moleculeId: string, topologyId: string): MoleculeGeometry | null {
  return MOLECULE_GEOMETRY[moleculeId]?.[topologyId] ?? null;
}

// Reducible-representation decomposition of Γvib, hand-derived per molecule
// per textbook group theory (character table reduction, translations and
// rotations already subtracted) — deliberately NOT the generic 3N-5/3N-6
// atom-counting formula, which only gives a bare number and says nothing
// about which symmetry species are actually present. `symbol` matches
// VibrationMode.symmetry exactly (same HTML-subscript convention) so the
// dataset's own authored modes can be cross-checked against this term by
// term; `count` is how many representations of that symmetry Γvib contains
// (e.g. count=2 for the "2T₂" term of CH4) — NOT multiplied by degeneracy,
// which mullikenDegeneracy() below derives from the symbol itself.
export interface MullikenTerm {
  symbol: string;
  count: number;
}

export interface PointCloudSymmetry {
  // Plain-text description of the atomic arrangement itself — the "point
  // cloud" — and why it has the point group it does, written out before
  // any group-theory machinery, not asserted as a bare label.
  pointCloud: string;
  terms: MullikenTerm[];
}

// Degeneracy implied by a Mulliken/Herzberg symbol's own letter, inferred
// from the label text rather than stored redundantly alongside each term:
// A/B (and Σ) are non-degenerate, E/Π/Δ/Φ doubly, T/F triply. Strips HTML
// sub/sup tags and trailing +/-/digit decorations first so e.g.
// "Σ<sub>g</sub>⁺" and "T₂" both resolve to their bare leading letter.
export function mullikenDegeneracy(symbol: string): number {
  const bare = symbol.replace(/<[^>]+>/g, '').replace(/[⁺⁻'″₀₁₂₃₄₅₆₇₈₉]/g, '');
  const letter = bare.charAt(0);
  if (letter === 'E' || letter === 'Π' || letter === 'Δ' || letter === 'Φ') return 2;
  if (letter === 'T' || letter === 'F') return 3;
  return 1;
}

// moleculeId -> topologyId -> Γvib decomposition. Only populated for
// topologies where the full character-table derivation has actually been
// worked out by hand; VibrationModesPage falls back to omitting the
// symmetry-analysis block entirely when a topology has no entry here.
export const VIBRATIONAL_SYMMETRY: Record<string, Record<string, PointCloudSymmetry>> = {
  co2: {
    gas: {
      pointCloud: '3 atoms in a straight line, O-C-O, with C at the centroid and the two O\'s equivalent through it — a center of inversion, giving the full linear D∞h point group (not just C∞v, which a heteronuclear linear molecule like CO is limited to).',
      terms: [
        { symbol: 'Σ<sub>g</sub>⁺', count: 1 },
        { symbol: 'Σ<sub>u</sub>⁺', count: 1 },
        { symbol: 'Π<sub>u</sub>', count: 1 },
      ],
    },
  },
  co: {
    gas: {
      pointCloud: '2 atoms, necessarily collinear — a C∞ axis along the bond plus an infinite set of mirror planes containing it, but no inversion center (the two atoms are different elements), giving C∞v rather than D∞h.',
      terms: [
        { symbol: 'Σ⁺', count: 1 },
      ],
    },
    isocarbonyl: {
      pointCloud: 'Still just 2 atoms — the same C∞v point cloud as gas-phase CO, just bound through the other end. Flipping which atom faces the surface doesn\'t add a particle or remove a symmetry element, so the molecule itself has exactly the same single Σ⁺ stretch.',
      terms: [
        { symbol: 'Σ⁺', count: 1 },
      ],
    },
  },
  ch4: {
    gas: {
      pointCloud: '5 atoms: C at the centroid, 4 H\'s at the corners of a regular tetrahedron around it. Every C-H bond is equivalent and every H-C-H angle is the same 109.47°, the defining point cloud of the Td point group.',
      terms: [
        { symbol: 'A₁', count: 1 },
        { symbol: 'E', count: 1 },
        { symbol: 'T₂', count: 2 },
      ],
    },
  },
  formate: {
    monodentate: {
      pointCloud: '4 atoms in one plane: C at the centroid, with three genuinely distinct substituents — one surface-bound O, one free O, and H — no two of them equivalent to any other. Unlike carbonate\'s monodentate (whose two free O\'s are still equivalent to each other), there\'s no axis left at all here, only the molecular plane itself as a mirror — Cs.',
      terms: [
        { symbol: "A′", count: 5 },
        { symbol: "A″", count: 1 },
      ],
    },
    bidentate: {
      pointCloud: '4 atoms in one plane: C at the centroid, H on one side along the symmetry axis, and the two O\'s equivalent to each other across that same axis on the other side — one C2 axis (through C and H) plus the molecular plane itself as a mirror, giving C2v.',
      terms: [
        { symbol: 'A₁', count: 3 },
        { symbol: 'B₁', count: 2 },
        { symbol: 'B₂', count: 1 },
      ],
    },
  },
  carbonate: {
    bidentate: {
      pointCloud: '4 atoms in one plane: C at the centroid, one free O along the symmetry axis, and the two surface-bound O\'s equivalent to each other across that same axis — the same C2v point cloud as formate, with the free O playing the role formate\'s H plays.',
      terms: [
        { symbol: 'A₁', count: 3 },
        { symbol: 'B₁', count: 1 },
        { symbol: 'B₂', count: 2 },
      ],
    },
    monodentate: {
      pointCloud: '4 atoms in one plane: C at the centroid, one surface-bound O along the would-be symmetry axis, and the two free O\'s equivalent to each other across it — but unlike bidentate\'s pair, here it\'s the *anchor* atom alone on the axis, with nothing on the other side to make a true C2 axis, leaving only the molecular plane itself as a mirror — Cs, not C2v.',
      terms: [
        { symbol: "A′", count: 5 },
        { symbol: "A″", count: 1 },
      ],
    },
  },
  methoxy: {
    monodentate: {
      pointCloud: '5 atoms: O and C both on the 3-fold axis (O bound to the surface on one end, C on the other), 3 equivalent H\'s arranged around C — the same local point cloud as a CH₃X molecule, giving C3v.',
      terms: [
        { symbol: 'A₁', count: 3 },
        { symbol: 'E', count: 3 },
      ],
    },
  },
};

// Sum of count × mullikenDegeneracy(symbol) across every term — the total
// number of fundamental vibrational modes Γvib actually contains, written
// out as an explicit term-by-term sum rather than the bare 3N-5/3N-6
// formula result (which gives the same number with none of the species
// breakdown).
export function vibrationalModeTotal(sym: PointCloudSymmetry): number {
  return sym.terms.reduce((total, t) => total + t.count * mullikenDegeneracy(t.symbol), 0);
}
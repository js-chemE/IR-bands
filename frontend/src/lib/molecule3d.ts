// Real 3D molecules for the vibration animations.
//
// The data is docs/data/molecules3d.json, built by src/ir_bands/molecules3d.py
// from NIST CCCBDB geometries and normal modes (see data/molecules3d.jsonc for
// sources, frames and the mode mapping). This file loads it once and turns one
// frame of one molecule into an ordered list of things to draw; the Svelte
// component MoleculeViewer3D only paints that list.
//
// Drawing rules (the same as phd_ui.structure, re-implemented here so IR-bands
// stays independent of phd_ui):
//   * Orthographic projection: x right, y up, z toward the viewer.
//   * Depth cue: an atom's radius grows by up to `depth_cue` at the molecule's
//     full reach toward the viewer and shrinks the same behind. Normalised by
//     the rest geometry's reach, which a rotation does not change, so a
//     turning or vibrating molecule never pulses.
//   * Painter order: atoms far to near; each bond is drawn just before the
//     nearer of its two atoms.
//   * A bond starts where it leaves the far atom's sphere (in 3D, then
//     projected) and runs to the near atom's centre, which the near atom then
//     covers. So a bond pointing at the viewer visibly comes out of the far
//     ball, and nothing stops short of an atom.
//   * The element symbol is part of its atom: drawn right after its circle, at
//     its centre, scaled with it, so it moves, grows and hides with the atom.
//   * A vibration is the harmonic motion x(t) = x0 + A e sin(2πt/T) along the
//     displacement vector e (CCCBDB modes are scaled so the most-moving atom
//     travels A). Linear, as the normal-mode picture is; bends therefore
//     stretch bonds a little at the turning points. An atom may instead (or
//     as well) carry a rotation: it turns by deg·sin(2πt/T) about an axis
//     through a fixed pivot, which keeps its distance to the pivot. The
//     adsorbate modes use that for bends and rocks.
//   * Adsorbates (`surface` present): the surface is the plane y = 0 of the
//     model, drawn as a flat slab behind everything; each bound atom gets a
//     dotted surface bond to a fixed point on it. Their default view is
//     applied here (not baked in), so dragging turns them about the surface
//     normal only and the surface stays underneath.

import { writable, type Readable } from 'svelte/store';

export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export interface Atom3D { element: string; xyz: Vec3 }
export interface Rotation3D { pivot: Vec3; axis: Vec3; deg: number }
export interface Mode3D {
  cccbdb_index: number | null;
  symmetry: string | null;
  harmonic_cm: number | null;
  ir_intensity: number | null;
  displacement: Vec3[];
  rotations?: (Rotation3D | null)[];
}
export interface Surface3D {
  anchors: { atom: number; at: Vec3 }[];  // surface bonds: atom -> fixed point
  view: { turn: number; tip: number };    // default view, applied in frame()
}
export interface Model3D {
  atoms: Atom3D[];
  bonds: [number, number, number][];
  modes: Record<string, Mode3D>;
  source: string;
  surface?: Surface3D;
}
export interface Molecules3D {
  depth_cue: number;
  molecules: Record<string, Record<string, Model3D>>;
}

// ---------------------------------------------------------------------------
// Loading: once, on first use. undefined = still loading, null = unavailable
// (then every caller keeps the hand-drawn viewer).
// ---------------------------------------------------------------------------

const store = writable<Molecules3D | null | undefined>(undefined);
let requested = false;

export function molecules3d(): Readable<Molecules3D | null | undefined> {
  if (!requested && typeof fetch !== 'undefined') {
    requested = true;
    fetch('data/molecules3d.json')
      .then(r => (r.ok ? r.json() : null))
      .then(d => store.set(d))
      .catch(() => store.set(null));
  }
  return store;
}

export function model3dFor(
  data: Molecules3D | null | undefined, moleculeId: string | undefined, topologyId: string | undefined,
): Model3D | null {
  if (!data || !moleculeId || !topologyId) return null;
  return data.molecules[moleculeId]?.[topologyId] ?? null;
}

// ---------------------------------------------------------------------------
// Rotations, same sign conventions as phd_ui.structure and molecules3d.py
// ---------------------------------------------------------------------------

export const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** About the vertical; positive brings the right side toward the viewer. */
export function turn(deg: number): Mat3 {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}

/** About the horizontal; positive brings the top toward the viewer. */
export function tip(deg: number): Mat3 {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as Mat3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return r;
}

/** Rodrigues: v turned by deg about the unit axis. */
function rotateAbout(v: Vec3, axis: Vec3, deg: number): Vec3 {
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const [kx, ky, kz] = axis;
  const d = kx * v[0] + ky * v[1] + kz * v[2];
  return [
    v[0] * c + (ky * v[2] - kz * v[1]) * s + kx * d * (1 - c),
    v[1] * c + (kz * v[0] - kx * v[2]) * s + ky * d * (1 - c),
    v[2] * c + (kx * v[1] - ky * v[0]) * s + kz * d * (1 - c),
  ];
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

// ---------------------------------------------------------------------------
// The atom and bond look: phd_ui.colors.atoms, copied so IR-bands needs no
// phd_ui. If phd_ui changes, change it here too.
//   * Flat disc, one fill, a thin edge in a darker tone of the same hue.
//   * Size from the single-bond covalent radius (Cordero et al. 2008),
//     compressed to 130 * (r / 130) ** 0.5 so sizes are indicated, not to
//     scale, then drawn at BALL_SCALE of that, in the same pm as the
//     positions. So bond sticks are about half the centre distance.
//   * Bonds in the light ink; double and triple as thinner parallel lines.
// Widths are phd_ui's pt values times PT, the viewBox units one pt maps to
// here (single bond 1.4 pt = 2 units, the old stroke).
// F, Cl, Br, I are not in phd_ui yet: fill is CPK from elementColors.ts,
// edge the fill at 0.6 in sRGB, radius Cordero.
// ---------------------------------------------------------------------------

export const BALL_SCALE = 0.38;
export const SIZE_EXPONENT = 0.5;
export const SIZE_REFERENCE_PM = 130;
export const PT = 2 / 1.4;

export interface AtomStyle { fill: string; edge: string; text: string; radiusPm: number }

const INK_BASE = '#413b34';
const WHITE = '#ffffff';
export const ATOM_STYLE: Record<string, AtomStyle> = {
  H:  { fill: '#f4f3f1', edge: '#a7a195', text: INK_BASE, radiusPm: 31 },
  C:  { fill: '#3f4245', edge: '#2b2d30', text: WHITE,    radiusPm: 76 },
  N:  { fill: '#4160c4', edge: '#13246d', text: WHITE,    radiusPm: 71 },
  O:  { fill: '#c44036', edge: '#7a1f1a', text: WHITE,    radiusPm: 66 },
  F:  { fill: '#90E050', edge: '#568630', text: INK_BASE, radiusPm: 57 },
  Cl: { fill: '#1FF01F', edge: '#139013', text: INK_BASE, radiusPm: 102 },
  Br: { fill: '#A62929', edge: '#641919', text: WHITE,    radiusPm: 120 },
  I:  { fill: '#940094', edge: '#590059', text: WHITE,    radiusPm: 139 },
  Zn: { fill: '#797caa', edge: '#3d3f60', text: WHITE,    radiusPm: 122 },
  Ga: { fill: '#be7e7f', edge: '#724445', text: INK_BASE, radiusPm: 122 },
  Cu: { fill: '#bb731e', edge: '#683b02', text: WHITE,    radiusPm: 132 },
  M:  { fill: '#9aa1ac', edge: '#5e6570', text: INK_BASE, radiusPm: 135 },
};
const FALLBACK_STYLE: AtomStyle = { fill: '#9B6B3D', edge: '#5d4025', text: WHITE, radiusPm: 130 };

export function atomStyle(element: string): AtomStyle {
  return ATOM_STYLE[element] ?? FALLBACK_STYLE;
}

/** Drawn ball radius in pm: compressed covalent radius times BALL_SCALE. */
export function drawnRadiusPm(element: string): number {
  const r = atomStyle(element).radiusPm;
  return SIZE_REFERENCE_PM * (r / SIZE_REFERENCE_PM) ** SIZE_EXPONENT * BALL_SCALE;
}

export const ATOM_EDGE_WIDTH = 0.6 * PT;
export const BOND_COLOR = '#675f56';
/** phd_ui 'surface' bond: dotted, grey, 1.1 pt, dash (1, 2) x width. */
export const SURFACE_BOND = { color: '#5e6570', widthPt: 1.1, dash: [1, 2] };
/** phd_ui support slab: SAND.base fill, SAND.dark edge. */
export const SLAB = { fill: '#e8e3da', edge: '#a99f8f' };
/** phd_ui BOND_STYLES: width and centre spacing per bond order, in pt. */
export const BOND_STYLE: Record<number, { widthPt: number; spacingPt: number }> = {
  1: { widthPt: 1.4, spacingPt: 0 },
  2: { widthPt: 0.9, spacingPt: 2.0 },
  3: { widthPt: 0.8, spacingPt: 1.8 },
};

// ---------------------------------------------------------------------------
// One frame
// ---------------------------------------------------------------------------

export interface FrameOptions {
  rotation: Mat3;
  modeId: string | null;
  phase: number;          // -1..1
  depthCue: number;
  maxPxPerPm: number;     // scale upper bound, viewBox units per pm (positions and balls)
  amplitudePx: number;    // peak travel of the most-moving atom, viewBox units
  halfBox: number;        // the drawing must stay inside ±halfBox
}

export interface PlaneItem { kind: 'plane'; points: string; front: { x1: number; y1: number; x2: number; y2: number } }
export interface SurfaceBondItem { kind: 'surface-bond'; key: string; x1: number; y1: number; x2: number; y2: number }
export interface AtomItem { kind: 'atom'; i: number; element: string; x: number; y: number; r: number; rRest: number }
export interface BondItem { kind: 'bond'; key: string; lines: { x1: number; y1: number; x2: number; y2: number }[]; order: number; width: number }
export type DrawItem = PlaneItem | SurfaceBondItem | AtomItem | BondItem;

/** Position scale for a model: the house scale, shrunk only when the molecule
    would not fit. Rotation-invariant, so the size never changes while dragging. */
export function fitScale(model: Model3D, o: FrameOptions): number {
  // Balls scale with the positions, so the extent in pm is fixed and the
  // scale is whatever makes it fit: (halfBox - amplitude) / extent.
  let extentPm = 0;
  const c = centre(model);
  if (model.surface) {
    // An adsorbate only turns about the surface normal: what has to fit is
    // its distance from that axis across, and its own height up and down
    // (a little more, for the tip of the default view).
    for (const a of model.atoms) {
      const r = drawnRadiusPm(a.element) * (1 + o.depthCue);
      const d = sub(a.xyz, c);
      extentPm = Math.max(extentPm, Math.hypot(d[0], d[2]) + r, Math.abs(d[1]) * 1.1 + r);
    }
  } else {
    for (const a of model.atoms)
      extentPm = Math.max(extentPm, Math.hypot(...sub(a.xyz, c)) + drawnRadiusPm(a.element) * (1 + o.depthCue));
  }
  return Math.min(o.maxPxPerPm, (o.halfBox - o.amplitudePx) / extentPm);
}

const MAX_TRAVEL_OF_BOND = 0.2;
/** Seen straight from the front, motion toward the viewer is invisible as a
    position change, so it also scales the atom: up to this fraction larger
    at full travel toward the viewer, smaller away. The same cue the
    hand-drawn diagrams used for out-of-plane motion (their `scale`, ±30-40%). */
const MOTION_DEPTH_CUE = 0.35;

function sub(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

/** The point the drawing turns about and is centred on: the origin for a gas
    molecule (the build centres it), the middle of the atoms' and anchors'
    vertical extent above x = z = 0 for an adsorbate. */
function centre(model: Model3D): Vec3 {
  if (!model.surface) return [0, 0, 0];
  const ys = [...model.atoms.map(a => a.xyz[1]), ...model.surface.anchors.map(a => a.at[1])];
  return [0, (Math.max(...ys) + Math.min(...ys)) / 2, 0];
}

/** Full rotation for a frame: gas molecules carry their default view in the
    data; an adsorbate's is applied here, under the user's turn. */
export function viewRotation(model: Model3D, user: Mat3, userTurnDeg = 0): Mat3 {
  if (!model.surface) return user;
  return mul(tip(model.surface.view.tip), turn(model.surface.view.turn + userTurnDeg));
}

export function frame(model: Model3D, o: FrameOptions): DrawItem[] {
  const scale = fitScale(model, o);
  const c = centre(model);
  const reach = Math.max(1e-6, ...model.atoms.map(a => Math.hypot(...sub(a.xyz, c))));
  const mode = o.modeId ? model.modes[o.modeId] ?? null : null;
  // Peak travel: the house amplitude, but never more than a fifth of the
  // shortest bond, so a short bond (H2) cannot collapse at the turning point.
  const shortest = Math.min(Infinity, ...model.bonds.map(([a, b]) =>
    Math.hypot(...model.atoms[a].xyz.map((c, k) => c - model.atoms[b].xyz[k]))));
  const ampPm = Math.min(o.amplitudePx / scale, MAX_TRAVEL_OF_BOND * shortest);

  // 3D positions (pm, rotated) and drawn radii (viewBox units)
  const p: Vec3[] = model.atoms.map((a, i) => {
    const e = mode?.displacement[i] ?? [0, 0, 0];
    const k = ampPm * o.phase;
    let q: Vec3 = [a.xyz[0], a.xyz[1], a.xyz[2]];
    const rot = mode?.rotations?.[i];
    if (rot) {
      const r = rotateAbout(sub(q, rot.pivot), rot.axis, rot.deg * o.phase);
      q = [rot.pivot[0] + r[0], rot.pivot[1] + r[1], rot.pivot[2] + r[2]];
    }
    return apply(o.rotation, sub([q[0] + e[0] * k, q[1] + e[1] * k, q[2] + e[2] * k], c));
  });
  const rRest = model.atoms.map(a => drawnRadiusPm(a.element) * scale);
  const restZ = model.atoms.map(a => apply(o.rotation, sub(a.xyz, c))[2]);
  const r = rRest.map((r0, i) => r0
    * (1 + o.depthCue * (p[i][2] / reach))
    * (1 + Math.max(-0.4, Math.min(0.4, MOTION_DEPTH_CUE * (p[i][2] - restZ[i]) / Math.max(1e-6, ampPm)))));
  const sx = (v: Vec3) => v[0] * scale;
  const sy = (v: Vec3) => -v[1] * scale;   // SVG y runs down

  const order = model.atoms.map((_, i) => i).sort((a, b) => p[a][2] - p[b][2]);
  const rank = new Map(order.map((i, k) => [i, k]));

  // bonds grouped by the atom they are drawn just before
  const before = new Map<number, BondItem[]>();
  for (const [a, b, bondOrder] of model.bonds) {
    const [far, near] = rank.get(a)! < rank.get(b)! ? [a, b] : [b, a];
    const d: Vec3 = [p[near][0] - p[far][0], p[near][1] - p[far][1], p[near][2] - p[far][2]];
    const len = Math.hypot(...d) || 1;
    const rFarPm = r[far] / scale;
    const start: Vec3 = [
      p[far][0] + d[0] / len * rFarPm,
      p[far][1] + d[1] / len * rFarPm,
      p[far][2] + d[2] / len * rFarPm,
    ];
    const x1 = sx(start), y1 = sy(start), x2 = sx(p[near]), y2 = sy(p[near]);
    // parallel lines for double/triple bonds, offset across the drawn bond
    const ex = sx(p[near]) - sx(p[far]), ey = sy(p[near]) - sy(p[far]);
    const el = Math.hypot(ex, ey);
    const nx = el > 1e-6 ? -ey / el : 0, ny = el > 1e-6 ? ex / el : 1;
    const style = BOND_STYLE[Math.min(3, Math.max(1, bondOrder))];
    const n = Math.min(3, Math.max(1, bondOrder));
    const gap = style.spacingPt * PT;
    const lines = Array.from({ length: n }, (_, k) => {
      const f = (k - (n - 1) / 2) * gap;
      return { x1: x1 + nx * f, y1: y1 + ny * f, x2: x2 + nx * f, y2: y2 + ny * f };
    });
    const item: BondItem = { kind: 'bond', key: `${a}-${b}`, lines, order: bondOrder, width: style.widthPt * PT };
    (before.get(near) ?? before.set(near, []).get(near)!).push(item);
  }

  const items: DrawItem[] = [];
  if (model.surface) {
    // The slab: the plane y = 0, wide enough to fill the box, then the
    // dotted surface bonds from each bound atom to its fixed point.
    const h = (o.halfBox + 4) / scale;
    const corner = (x: number, z: number) => apply(o.rotation, sub([x, 0, z], c));
    const q = [corner(-h, -h), corner(h, -h), corner(h, h), corner(-h, h)];
    // front edge: the one nearest the viewer
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0]].sort((m, n) =>
      (q[n[0]][2] + q[n[1]][2]) - (q[m[0]][2] + q[m[1]][2]));
    const [f0, f1] = edges[0];
    items.push({
      kind: 'plane',
      points: q.map(v => `${sx(v)},${sy(v)}`).join(' '),
      front: { x1: sx(q[f0]), y1: sy(q[f0]), x2: sx(q[f1]), y2: sy(q[f1]) },
    });
    model.surface.anchors.forEach((an, k) => {
      const at = apply(o.rotation, sub(an.at, c));
      items.push({ kind: 'surface-bond', key: `s${k}`, x1: sx(at), y1: sy(at), x2: sx(p[an.atom]), y2: sy(p[an.atom]) });
    });
  }
  for (const i of order) {
    for (const b of before.get(i) ?? []) items.push(b);
    items.push({
      kind: 'atom', i, element: model.atoms[i].element,
      x: sx(p[i]), y: sy(p[i]), r: r[i], rRest: rRest[i],
    });
  }
  return items;
}

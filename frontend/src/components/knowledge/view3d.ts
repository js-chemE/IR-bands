/**
 * A few lines of 3D for the Knowledge diagrams: turn a point, then project
 * it onto the page in perspective. x points right, y up, z towards the
 * viewer; on the page y points down. The view is turned by `yaw` about the
 * vertical, then tipped by `tilt` towards the viewer, so no axis lies flat
 * in the page and the drawing reads as a solid rather than an isometric plan.
 */

export type V3 = [number, number, number];
export type Axis = 'x' | 'y' | 'z';

const D2R = Math.PI / 180;

export function rotX(v: V3, deg: number): V3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

export function rotY(v: V3, deg: number): V3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export function rotZ(v: V3, deg: number): V3 {
  const c = Math.cos(deg * D2R);
  const s = Math.sin(deg * D2R);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** Turn about one of the three axes. */
export const rotAbout = (axis: Axis, v: V3, deg: number): V3 =>
  axis === 'x' ? rotX(v, deg) : axis === 'y' ? rotY(v, deg) : rotZ(v, deg);

export const UNIT: Record<Axis, V3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

export interface View {
  yaw: number;
  tilt: number;
  /** Distance to the eye; smaller means stronger perspective. */
  dist: number;
}

export const VIEW: View = { yaw: -28, tilt: 16, dist: 110 };

/** A point on the page, its depth (larger is nearer) and its perspective scale. */
export function project(v: V3, view: View = VIEW) {
  const w = rotX(rotY(v, view.yaw), view.tilt);
  const f = view.dist / (view.dist - w[2]);
  return { x: w[0] * f, y: -w[1] * f, z: w[2], f };
}

/* ── Symmetry operations, continuous ──
   For the Point Group and Mulliken diagrams: each takes a point and a
   progress s, where s = 1 is one application, s = 2 two, and so on. A
   reflection runs the coordinate across the plane through zero
   (x → x·cos πs), so an atom passes through the mirror rather than jumping;
   an inversion does the same to all three at once. Every operation is
   linear, so a displacement vector transforms by the same call. */

export type SymOp = (p: V3, s: number) => V3;

/** Cₙ about the vertical (y) axis. */
export const turnY = (n: number): SymOp => (p, s) => rotY(p, (360 / n) * s);

/** Across the plane x = 0. */
export const mirrorX: SymOp = (p, s) => [p[0] * Math.cos(Math.PI * s), p[1], p[2]];

/** Across the plane z = 0: the plane of the page. */
export const mirrorZ: SymOp = (p, s) => [p[0], p[1], p[2] * Math.cos(Math.PI * s)];

/** Through the origin. */
export const invert: SymOp = (p, s) => {
  const c = Math.cos(Math.PI * s);
  return [p[0] * c, p[1] * c, p[2] * c];
};

/** Sₙ about y: each step a turn by 360°/n, then the mirror y = 0. */
export const improperY = (n: number): SymOp => (p, s) => {
  const whole = Math.floor(s);
  const f = s - whole;
  const v = rotY(p, (360 / n) * (whole + Math.min(1, 2 * f)));
  const refl = whole + Math.max(0, 2 * f - 1);
  return [v[0], v[1] * Math.cos(Math.PI * refl), v[2]];
};

/** The operation that does nothing. */
export const identity: SymOp = p => p;

/** An open arrowhead at (bx, by), pointing along a → b. */
export function arrowHead(ax: number, ay: number, bx: number, by: number, size = 3): string {
  const dx = bx - ax;
  const dy = by - ay;
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  return `M${bx - ux * size - uy * size * 0.7},${by - uy * size + ux * size * 0.7} L${bx},${by} L${bx - ux * size + uy * size * 0.7},${by - uy * size - ux * size * 0.7}`;
}

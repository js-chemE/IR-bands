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

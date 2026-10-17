/**
 * Where a menu that belongs to a field opens: in a fixed layer over the page,
 * so it never stretches the sidebar it sits in, joined to the field's lower
 * edge, or to its upper edge when the room below is too short for it and the
 * room above is larger.
 *
 * The menu lives inside the shell, so while presentation mode's zoom is on
 * the lengths it is given are read in shell pixels, and the field's rect and
 * the window arrive in viewport pixels. Everything is taken into shell space
 * first (lib/zoom.ts); without that the menu opened the zoom factor too far
 * down and to the right, off screen at 1.75×, and only typing still worked.
 */
import { cssZoom } from './zoom';

export interface Float {
  /** Opens upwards, joined to the field's top. */
  above: boolean;
  /** Inline position for a `position: fixed` element. */
  style: string;
}

/** `estHeight` and `minWidth` are the menu's own CSS lengths, in shell pixels. */
export function floatAt(anchor: HTMLElement, estHeight: number, minWidth = 0): Float {
  const z = cssZoom(anchor);
  const r = anchor.getBoundingClientRect();
  const top = r.top / z, bottom = r.bottom / z, left = r.left / z;
  const viewH = window.innerHeight / z;
  const below = viewH - bottom;
  const above = below < estHeight + 8 && top > below;
  const width = Math.max(r.width / z, minWidth);
  const edge = above ? `bottom:${viewH - top}px` : `top:${bottom}px`;
  return { above, style: `left:${left}px;width:${width}px;${edge}` };
}

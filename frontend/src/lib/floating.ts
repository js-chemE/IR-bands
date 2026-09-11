/**
 * Where a menu that belongs to a field opens: in a fixed layer over the page,
 * so it never stretches the sidebar it sits in, joined to the field's lower
 * edge, or to its upper edge when the room below is too short for it and the
 * room above is larger.
 */
export interface Float {
  /** Opens upwards, joined to the field's top. */
  above: boolean;
  /** Inline position for a `position: fixed` element. */
  style: string;
}

export function floatAt(anchor: HTMLElement, estHeight: number, minWidth = 0): Float {
  const r = anchor.getBoundingClientRect();
  const below = window.innerHeight - r.bottom;
  const above = below < estHeight + 8 && r.top > below;
  const width = Math.max(r.width, minWidth);
  const edge = above ? `bottom:${window.innerHeight - r.top}px` : `top:${r.bottom}px`;
  return { above, style: `left:${r.left}px;width:${width}px;${edge}` };
}

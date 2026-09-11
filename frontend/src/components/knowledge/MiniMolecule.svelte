<svelte:options namespace="svg" />

<script lang="ts" context="module">
  import type { MoleculeGeometry } from '../../lib/moleculeGeometry';

  export interface PosedAtom {
    x: number;
    y: number;
    r: number;
    el: string;
  }

  /** Drawing radius per element, in the geometry's own units. */
  const RADIUS: Record<string, number> = { C: 5.4, O: 5.2, N: 5.2, H: 3.8 };

  /**
   * A molecule from lib/moleculeGeometry.ts, displaced along one of its modes:
   * `s` is the phase of the swing (−1 … 1), `amp` how far a unit vector
   * moves an atom. The same vectors the Vibration modes view animates.
   */
  export function pose(g: MoleculeGeometry, modeId: string | null, s = 0, amp = 4): PosedAtom[] {
    const vecs = modeId ? g.modes[modeId] : null;
    return g.atoms.map((a, i) => {
      const v = vecs?.[i];
      let x = a.x;
      let y = a.y;
      if (v?.rotateDeg) {
        const p = v.pivot ?? { x: 0, y: 0 };
        const th = (v.rotateDeg * s * Math.PI) / 180;
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        x = p.x + dx * Math.cos(th) - dy * Math.sin(th);
        y = p.y + dx * Math.sin(th) + dy * Math.cos(th);
      } else if (v) {
        x += v.dx * amp * s;
        y += v.dy * amp * s;
      }
      const r = (RADIUS[a.element] ?? 5) * (1 + (v?.scale ?? 0) * s);
      return { x, y, r, el: a.element };
    });
  }
</script>

<script lang="ts">
  /**
   * One small molecule inside a Knowledge diagram: bonds, then atoms in
   * their element colours. Placed at (x, y), scaled by k, and turned by
   * `rotate` degrees about `pivot` (in the molecule's own units).
   */
  import { colorForElement } from '../../lib/elementColors';

  export let atoms: PosedAtom[];
  export let bonds: [number, number][];
  export let x = 0;
  export let y = 0;
  export let k = 1;
  export let rotate = 0;
  export let pivot = { x: 0, y: 0 };
  export let opacity = 1;
</script>

<g transform="translate({x} {y}) scale({k}) rotate({rotate} {pivot.x} {pivot.y})" style="opacity:{opacity}">
  {#each bonds as [a, b]}
    <line class="bond" x1={atoms[a].x} y1={atoms[a].y} x2={atoms[b].x} y2={atoms[b].y} />
  {/each}
  {#each atoms as at}
    <circle cx={at.x} cy={at.y} r={Math.max(0.5, at.r)} fill={colorForElement(at.el)} />
  {/each}
</g>

<style>
  .bond { stroke: var(--ink-slate-400); stroke-width: 2; stroke-linecap: round; }
  /* A hairline, so a white hydrogen still reads on the pale card. */
  circle { stroke: var(--ink-slate-400); stroke-width: 0.6; }
</style>

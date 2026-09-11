<svelte:options namespace="svg" />

<script lang="ts">
  /**
   * Three axes through a molecule's centre of mass, drawn in the same
   * perspective as the molecule (view3d.ts): x, y and z with arrowheads and
   * labels. `active` lights one of them. With `rings`, each axis also gets
   * a curved arrow round it, for turning; `still` marks one ring as the turn
   * that moves no atom (the bond axis of a linear molecule).
   */
  import { project, rotAbout, UNIT, type Axis, type V3 } from './view3d';

  export let x = 0;
  export let y = 0;
  export let len = 26;
  export let active: Axis | null = null;
  export let rings = false;
  export let still: Axis | null = null;
  export let labels = true;

  const AXES: Axis[] = ['x', 'y', 'z'];
  const times = (v: V3, f: number): V3 => [v[0] * f, v[1] * f, v[2] * f];

  $: ends = AXES.map(a => ({
    a,
    from: project(times(UNIT[a], -len)),
    to: project(times(UNIT[a], len)),
    label: project(times(UNIT[a], len + 7)),
  }));

  /** An arrowhead at `to`, pointing away from `from`. */
  function head(from: { x: number; y: number }, to: { x: number; y: number }, size = 4) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    return `M${to.x - ux * size - uy * size * 0.6},${to.y - uy * size + ux * size * 0.6} L${to.x},${to.y} L${to.x - ux * size + uy * size * 0.6},${to.y - uy * size - ux * size * 0.6}`;
  }

  /** A curved arrow round an axis, near its tip: most of a circle, projected. */
  function ring(a: Axis) {
    const r = len * 0.28;
    const at = times(UNIT[a], len * 0.62);
    // A vector across the axis to start the circle from.
    const across: V3 = a === 'y' ? [r, 0, 0] : [0, r, 0];
    const pts = [];
    for (let deg = 20; deg <= 320; deg += 15) {
      const p = rotAbout(a, across, deg);
      pts.push(project([at[0] + p[0], at[1] + p[1], at[2] + p[2]]));
    }
    const d = 'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    return { d, head: head(pts[pts.length - 2], pts[pts.length - 1], 3.2) };
  }
  $: ringPaths = rings ? AXES.map(a => ({ a, ...ring(a) })) : [];
</script>

<g transform="translate({x} {y})">
  {#each ends as e (e.a)}
    <line
      class="axis"
      class:on={active === e.a}
      class:still={still === e.a}
      x1={e.from.x}
      y1={e.from.y}
      x2={e.to.x}
      y2={e.to.y}
    />
    <path class="axis-head" class:on={active === e.a} d={head(e.from, e.to)} />
    {#if labels}
      <text class="axis-lbl" class:on={active === e.a} x={e.label.x} y={e.label.y + 3} text-anchor="middle">{e.a}</text>
    {/if}
  {/each}
  {#each ringPaths as r (r.a)}
    <path class="ring" class:on={active === r.a} class:still={still === r.a} d={r.d} />
    <path class="ring-head" class:on={active === r.a} class:still={still === r.a} d={r.head} />
  {/each}
</g>

<style>
  .axis { stroke: var(--ink-025); stroke-width: 1; }
  .axis.still { stroke-dasharray: 3 2; }
  .axis-head { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
  .axis-lbl {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-style: italic;
    fill: var(--ink-050);
  }
  .ring, .ring-head { fill: none; stroke: var(--ink-slate-400); stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
  .ring.still, .ring-head.still { stroke-dasharray: 2 2; stroke-opacity: 0.6; }

  /* The axis in use, in the Knowledge green. */
  .axis.on, .axis-head.on, .ring.on, .ring-head.on { stroke: var(--accent-green-fg); stroke-width: 1.6; }
  .axis-lbl.on { fill: var(--accent-green-fg); }
</style>

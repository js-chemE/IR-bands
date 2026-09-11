<svelte:options namespace="svg" />

<script lang="ts" context="module">
  export type GroupKind = 'ch2' | 'ch3';
  export type GroupMotion = 'sym' | 'asym' | 'scissor' | 'rock' | 'wag' | 'twist' | 'umbrella' | 'deform';
</script>

<script lang="ts">
  /**
   * A CH₂ or CH₃ group as a small 3D model: a tetrahedral carbon, its
   * hydrogens, and the bonds to the rest of the molecule as fading stubs,
   * turned to an oblique view and drawn in perspective (nearer atoms larger,
   * everything painted back to front, each atom a shaded sphere).
   *
   * `motion` displaces the hydrogens in 3D, so the out-of-plane motions are
   * real motions rather than a size pulse:
   *   CH₂  sym, asym (along the bonds); scissor, rock (in the H–C–H plane);
   *        wag (both out of the plane, the same way); twist (about the
   *        bisector, opposite ways).
   *   CH₃  umbrella (all three H–C–axis angles together); deform (one opens
   *        while the other two close, one component of the degenerate pair).
   * `s` is the phase of the swing, −1 … 1.
   */
  import { colorForElement } from '../../lib/elementColors';

  export let kind: GroupKind = 'ch2';
  export let motion: GroupMotion = 'sym';
  export let s = 0;
  export let x = 0;
  export let y = 0;
  export let k = 1;
  /** The view: turned about the vertical, then tipped towards the viewer. */
  export let yaw = 32;
  export let tilt = 18;

  type V = [number, number, number];
  const D2R = Math.PI / 180;
  const L = 14;
  const DIST = 90;
  // Ball and stick: atoms small against the bonds, so the angles read.
  const RADIUS: Record<string, number> = { C: 4.4, H: 2.9 };

  const rotX = (v: V, a: number): V => {
    const c = Math.cos(a * D2R);
    const n = Math.sin(a * D2R);
    return [v[0], v[1] * c - v[2] * n, v[1] * n + v[2] * c];
  };
  const rotY = (v: V, a: number): V => {
    const c = Math.cos(a * D2R);
    const n = Math.sin(a * D2R);
    return [v[0] * c + v[2] * n, v[1], -v[0] * n + v[2] * c];
  };
  const rotZ = (v: V, a: number): V => {
    const c = Math.cos(a * D2R);
    const n = Math.sin(a * D2R);
    return [v[0] * c - v[1] * n, v[0] * n + v[1] * c, v[2]];
  };
  const times = (v: V, f: number): V => [v[0] * f, v[1] * f, v[2] * f];

  // Half the tetrahedral angle, and the H–C–axis angle of a methyl group.
  const HALF = 54.74;
  const BETA = 70.53;
  /** A methyl hydrogen at angle `beta` from the axis and azimuth `phi`. */
  const methylH = (beta: number, phi: number): V => [
    L * Math.sin(beta * D2R) * Math.cos(phi * D2R),
    L * Math.cos(beta * D2R),
    L * Math.sin(beta * D2R) * Math.sin(phi * D2R),
  ];

  function build(kind: GroupKind, m: GroupMotion, s: number): { hs: V[]; stubs: V[] } {
    if (kind === 'ch3') {
      const d = [0, 0, 0];
      if (m === 'umbrella') d.fill(20 * s);
      if (m === 'deform') { d[0] = 22 * s; d[1] = -11 * s; d[2] = -11 * s; }
      return {
        hs: [methylH(BETA + d[0], 90), methylH(BETA + d[1], 210), methylH(BETA + d[2], 330)],
        stubs: [[0, -L * 1.15, 0]],
      };
    }
    const sin = Math.sin(HALF * D2R);
    const cos = Math.cos(HALF * D2R);
    let h1: V = [-L * sin, L * cos, 0];
    let h2: V = [L * sin, L * cos, 0];
    const th = 22 * s;
    if (m === 'sym') { h1 = times(h1, 1 + 0.3 * s); h2 = times(h2, 1 + 0.3 * s); }
    if (m === 'asym') { h1 = times(h1, 1 + 0.3 * s); h2 = times(h2, 1 - 0.3 * s); }
    if (m === 'scissor') { h1 = rotZ(h1, -th); h2 = rotZ(h2, th); }
    if (m === 'rock') { h1 = rotZ(h1, th); h2 = rotZ(h2, th); }
    if (m === 'wag') { h1 = rotX(h1, 1.3 * th); h2 = rotX(h2, 1.3 * th); }
    if (m === 'twist') { h1 = rotY(h1, 1.6 * th); h2 = rotY(h2, 1.6 * th); }
    return {
      hs: [h1, h2],
      // The two bonds to the chain, in the plane across the H–C–H plane.
      stubs: [
        [0, -L * cos * 1.15, L * sin * 1.15],
        [0, -L * cos * 1.15, -L * sin * 1.15],
      ],
    };
  }

  /** Into the view, then onto the page: perspective, y pointing down. */
  function project(v: V) {
    const w = rotX(rotY(v, yaw), tilt);
    const f = DIST / (DIST - w[2]);
    return { x: w[0] * f, y: -w[1] * f, z: w[2], f };
  }

  $: model = build(kind, motion, s);
  $: c = project([0, 0, 0]);
  $: atoms = [
    { el: 'C', ...c },
    ...model.hs.map(h => ({ el: 'H', ...project(h) })),
  ].sort((a, b) => a.z - b.z);
  $: hs = model.hs.map(project);
  $: stubs = model.stubs.map(project);

  // Gradient ids must be unique in the document; every instance gets its own.
  const uid = `g3d${Math.random().toString(36).slice(2, 8)}`;
</script>

<g transform="translate({x} {y}) scale({k})">
  <defs>
    {#each ['C', 'H'] as el}
      <radialGradient id="{uid}-{el}" cx="0.36" cy="0.32" r="0.7">
        <stop offset="0" class="hi" />
        <stop offset="0.5" stop-color={colorForElement(el)} />
        <stop offset="1" stop-color={colorForElement(el)} />
      </radialGradient>
    {/each}
  </defs>

  {#each stubs as st}
    <line class="stub" x1={c.x} y1={c.y} x2={st.x} y2={st.y} style="stroke-width:{1.4 * st.f}" />
  {/each}
  {#each hs as h}
    <line class="bond" x1={c.x} y1={c.y} x2={h.x} y2={h.y} style="stroke-width:{1.7 * h.f}" />
  {/each}
  {#each atoms as a}
    <circle
      cx={a.x}
      cy={a.y}
      r={RADIUS[a.el] * a.f}
      fill="url(#{uid}-{a.el})"
      style="opacity:{a.z < -2 ? 0.82 : 1}"
    />
  {/each}
</g>

<style>
  .hi { stop-color: var(--surface); }
  .bond { stroke: var(--ink-slate-400); stroke-linecap: round; }
  .stub { stroke: var(--ink-025); stroke-linecap: round; }
  circle { stroke: var(--ink-slate-400); stroke-width: 0.5; }
</style>

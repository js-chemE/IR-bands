<script lang="ts">
  /**
   * Rotation, and nothing else: a molecule turning as a whole.
   *
   *   t = 0  the card: a free CO with its three axes through the centre of
   *          mass, turning about z, then y, then x (the bond axis, where no
   *          atom moves), beside its ladder of rotational levels, each with a
   *          bar for how full it is at room temperature.
   *   t = 1  the opened card, two rows:
   *            the same, labelled: E(J) = B·J(J + 1), CO's B, kT, and the
   *              most filled level (J ≈ 7);
   *            shape sets the ladder: CO₂ (linear, one B), CH₄ (a spherical
   *              top, one B) and H₂O (three different moments), each turning.
   *
   * No vibration and no light here: what a photon does with these levels is
   * the Rotational branches card, what a surface does to the turn is the
   * Frustrated motion card.
   */
  import { onDestroy } from 'svelte';
  import { geometryFor } from '../../lib/moleculeGeometry';
  import MiniMolecule, { pose } from './MiniMolecule.svelte';
  import Axes3D from './Axes3D.svelte';
  import { project, rotAbout, type Axis, type V3 } from './view3d';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 300 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  /* ── Clock ── */
  let clock = 0;
  let raf = 0;
  let started = 0;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function frame(now: number) {
    if (!started) started = now;
    clock = now - started;
    raf = requestAnimationFrame(frame);
  }
  $: running = playing && !reduced;
  $: if (running && !raf) {
    started = 0;
    raf = requestAnimationFrame(frame);
  } else if (!running && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
    clock = 0;
  }
  onDestroy(() => raf && cancelAnimationFrame(raf));
  $: time = running ? clock / 1000 : 0;

  /* ── CO, turning about each axis through its centre of mass in turn ── */
  // C 12, O 16, 26 apart: the centre of mass sits 11.1 from O and 14.9 from C.
  // The bond lies along x, so turning about x moves no atom.
  const CO_3D: { el: string; p: V3; r: number }[] = [
    { el: 'C', p: [-14.86, 0, 0], r: 5.4 },
    { el: 'O', p: [11.14, 0, 0], r: 5.2 },
  ];
  const CO_BOND: [number, number][] = [[0, 1]];
  const ORDER: Axis[] = ['z', 'y', 'x'];
  const PH = 2.4;
  $: phase = running ? Math.floor(time / PH) % 3 : -1;
  $: axis = phase >= 0 ? ORDER[phase] : null;
  // One whole turn per phase, easing in and out.
  $: angle = running ? (360 * (1 - Math.cos(Math.PI * ((time % PH) / PH)))) / 2 : 0;
  $: coAtoms = CO_3D.map(a => {
    const pr = project(axis ? rotAbout(axis, a.p, angle) : a.p);
    return { x: pr.x, y: pr.y, z: pr.z, r: a.r * pr.f, el: a.el };
  }).sort((a, b) => a.z - b.z);
  $: co = { x: lerp(52, 70, t), y: lerp(50, 92, t) };

  /* ── The ladder and its population ── */
  // CO at room temperature: kT / B ≈ 207 / 1.93 ≈ 107.
  const KT_OVER_B = 107;
  const pop = (J: number) => (2 * J + 1) * Math.exp(-(J * (J + 1)) / KT_OVER_B);
  const POP_MAX = pop(7);
  $: ladder = {
    x1: lerp(114, 190, t),
    x2: lerp(160, 250, t),
    y0: lerp(88, 150, t),
    px: lerp(0.8, 1.0, t),
    bar: lerp(40, 72, t),
  };
  $: maxJ = t > 0.5 ? 10 : 8;
  $: levels = Array.from({ length: maxJ + 1 }, (_, J) => ({
    J,
    y: ladder.y0 - ladder.px * J * (J + 1),
    w: (ladder.bar * pop(J)) / POP_MAX,
  }));

  /* ── Shape sets the ladder ── */
  const SHAPES = [
    { id: 'co2', x: 80, label: 'CO₂: linear', note: 'one B, 0.39 cm⁻¹' },
    { id: 'ch4', x: 236, label: 'CH₄: spherical top', note: 'one B, 5.24 cm⁻¹' },
    { id: 'water', x: 392, label: 'H₂O: asymmetric top', note: 'three: 27.9, 14.5, 9.3' },
  ].map(sh => ({ ...sh, g: geometryFor(sh.id, 'gas')! }));
  // Each turns about the middle of its own drawing.
  const centre = (id: string) => (id === 'water' ? { x: 0, y: -4 } : { x: 0, y: 0 });

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A free CO molecule turns about its centre of mass, on a manifold of rotational energy levels spread out by temperature; CO₂, CH₄ and H₂O turn differently because of their shapes"
>
  <!-- ── Row 1: CO turning about its axes, and its ladder ── -->
  <Axes3D x={co.x} y={co.y} len={lerp(30, 44, t)} active={axis} rings still="x" labels={t > 0.5} />
  <MiniMolecule atoms={coAtoms} bonds={CO_BOND} x={co.x} y={co.y} />
  <circle class="com" cx={co.x} cy={co.y} r="1.4" />

  {#each levels as l (l.J)}
    <line class="level" x1={ladder.x1} x2={ladder.x2} y1={l.y} y2={l.y} />
    <rect class="pop" class:peak={l.J === 7} x={ladder.x2 + 5} y={l.y - 1.2} width={l.w} height="2.4" rx="1.2" />
  {/each}

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Free: Turning about Its Centre of Mass</text>
    <text class="lbl faint" class:lit={axis === 'x'} x="14" y="150">
      {axis === 'x' ? 'about x: no motion' : 'two that count'}
    </text>
    {#each levels.filter(l => l.J % 4 === 0 || l.J === 10) as l (l.J)}
      <text class="lbl faint" x={ladder.x1 - 6} y={l.y + 4} text-anchor="end">J = {l.J}</text>
    {/each}
    <text class="lbl strong" x="332" y="60">E(J) = B · J(J + 1)</text>
    <text class="lbl" x="332" y="80">CO: B = 1.93 cm⁻¹</text>
    <text class="lbl" x="332" y="100">kT(25 °C) ≈ 207 cm⁻¹</text>
    <text class="lbl peak-lbl" x="332" y="120">most filled: J ≈ 7</text>
    <text class="lbl faint" x="332" y="140">bars: population</text>
  </g>

  <!-- ── Row 2: shape sets the ladder ── -->
  <g style="opacity:{fullOpacity}">
    {#each SHAPES as sh (sh.id)}
      <MiniMolecule
        atoms={pose(sh.g, null)}
        bonds={sh.g.bonds}
        x={sh.x}
        y={sh.id === 'water' ? 242 : 236}
        k={sh.id === 'ch4' ? 0.8 : 1}
        rotate={running ? 90 * time * (sh.id === 'co2' ? 1 : sh.id === 'ch4' ? 0.7 : 1.3) : 0}
        pivot={centre(sh.id)}
      />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="190">Shape Sets the Ladder</text>
    {#each SHAPES as sh (sh.id)}
      <text class="lbl strong" x={sh.x} y="278" text-anchor="middle">{sh.label}</text>
      <text class="lbl faint" x={sh.x} y="294" text-anchor="middle">{sh.note}</text>
    {/each}
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .com { fill: var(--ink-slate-500); }

  .level { stroke: var(--ink-slate-400); stroke-width: 1; stroke-linecap: round; }
  .pop { fill: var(--brand-700); fill-opacity: 0.55; }
  .pop.peak { fill: var(--accent-green-fg); fill-opacity: 1; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.peak-lbl, .lbl.lit { fill: var(--accent-green-fg); }
</style>

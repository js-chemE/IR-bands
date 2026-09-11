<script lang="ts">
  /**
   * Normal modes: 3N ways to move, and what is left for vibration.
   *
   *   t = 0  the card: H₂O beside its nine degrees of freedom, three to
   *          travel, three to turn, three to vibrate. Playing, the molecule
   *          runs through them in turn and the block it is using lights up.
   *   t = 1  the opened card, three rows:
   *            the bookkeeping for H₂O (3N − 6 = 3) and for CO₂, which is
   *              linear and has one rotation fewer (3N − 5 = 4);
   *            the three normal modes of H₂O, each moving at once;
   *            the four of CO₂, the bend twice, in the page and out of it
   *              (drawn as the atoms growing and shrinking).
   *
   * The molecules and their displacement vectors are the Vibration modes
   * view's own (lib/moleculeGeometry.ts), so the two pages draw one motion.
   */
  import { onDestroy } from 'svelte';
  import { geometryFor } from '../../lib/moleculeGeometry';
  import MiniMolecule, { pose } from './MiniMolecule.svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 400 };

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

  const WATER = geometryFor('water', 'gas')!;
  const CO2 = geometryFor('co2', 'gas')!;
  const WATER_MODES = ['h2o_stretch_symmetric', 'h2o_bend', 'h2o_stretch_asymmetric'];
  const CO2_MODES = ['co2_stretch_symmetric', 'co2_bend', 'co2_bend_wagging', 'co2_stretch_asymmetric'];
  // The molecule turns about its middle, not about O.
  const WATER_PIVOT = { x: 0, y: -4 };

  /* ── The cycle: travel, turn, then each vibration, 1.8 s apiece ── */
  const PH = 1.8;
  $: phase = running ? Math.floor(time / PH) % 5 : -1;
  $: u = running ? (time % PH) / PH : 0;
  $: travel = phase === 0 ? 9 * Math.sin(2 * Math.PI * u) : 0;
  $: turn = phase === 1 ? 180 * (1 - Math.cos(Math.PI * u)) : 0;
  $: cycleMode = phase >= 2 ? WATER_MODES[phase - 2] : null;
  $: cycleSwing = phase >= 2 ? Math.sin(2 * Math.PI * 2 * u) : 0;
  $: cycled = pose(WATER, cycleMode, cycleSwing, 4);

  // Every mode of the opened rows at once, on one clock.
  $: swing = running ? Math.sin(2 * Math.PI * 1.1 * time) : 0;

  /* ── The bookkeeping bars ── */
  type Kind = 'T' | 'R' | 'V';
  interface Block { x: number; kind: Kind; i: number }
  function blocks(groups: [number, number, number], x0: number, b: number): Block[] {
    const out: Block[] = [];
    const kinds: Kind[] = ['T', 'R', 'V'];
    let x = x0;
    let i = 0;
    groups.forEach((n, gi) => {
      for (let j = 0; j < n; j++) {
        out.push({ x, kind: kinds[gi], i: i++ });
        x += b + b * 0.2;
      }
      x += b * 0.4;
    });
    return out;
  }
  /** The middle of each group, for its label. */
  const groupMid = (bl: Block[], kind: Kind, b: number) => {
    const xs = bl.filter(x => x.kind === kind).map(x => x.x);
    return (Math.min(...xs) + Math.max(...xs) + b) / 2;
  };

  $: b = lerp(8.8, 16, t);
  $: waterBar = blocks([3, 3, 3], lerp(110, 132, t), b);
  $: barY = lerp(45, 44, t);
  const co2Bar = blocks([3, 2, 4], 132, 16);
  const active = (bl: Block, ph: number) =>
    (ph === 0 && bl.kind === 'T') || (ph === 1 && bl.kind === 'R') || (ph >= 2 && bl.i === 6 + ph - 2);

  $: mol = { x: lerp(54, 62, t), y: lerp(58, 58, t), k: lerp(1.1, 1, t) };

  /* ── The opened rows ── */
  const WATER_ROW = [
    { x: 100, local: 'νₛ(OH)', num: 'ν₁ · 3657 cm⁻¹' },
    { x: 240, local: 'δ(HOH)', num: 'ν₂ · 1595 cm⁻¹' },
    { x: 380, local: 'νₐₛ(OH)', num: 'ν₃ · 3756 cm⁻¹' },
  ];
  const CO2_ROW = [
    { x: 72, local: 'νₛ(OCO)', num: 'ν₁ · Raman only', extra: '' },
    { x: 188, local: 'δ(OCO)', num: 'ν₂ · 667 cm⁻¹', extra: 'in the page' },
    { x: 304, local: 'δ(OCO)', num: 'ν₂ · 667 cm⁻¹', extra: 'out of it' },
    { x: 420, local: 'νₐₛ(OCO)', num: 'ν₃ · 2349 cm⁻¹', extra: '' },
  ];

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A molecule of N atoms has 3N degrees of freedom: three translations, three rotations (two if linear), and 3N − 6 (or 3N − 5) vibrations, drawn for H₂O and CO₂"
>
  <!-- ── Row 1: the bookkeeping ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Degrees of freedom: 3N</text>
    <text class="lbl faint" x={groupMid(waterBar, 'T', b)} y="36" text-anchor="middle">travel</text>
    <text class="lbl faint" x={groupMid(waterBar, 'R', b)} y="36" text-anchor="middle">turn</text>
    <text class="lbl faint" x={groupMid(waterBar, 'V', b)} y="36" text-anchor="middle">vibrate</text>
    <text class="lbl strong" x="326" y="56">H₂O: 3N − 6 = 3</text>
    <text class="lbl strong" x="326" y="102">CO₂: 3N − 5 = 4</text>
    <text class="lbl faint" x="132" y="124">linear: the turn about its axis moves no atom</text>
  </g>

  <MiniMolecule
    atoms={cycled}
    bonds={WATER.bonds}
    x={mol.x + travel}
    y={mol.y}
    k={mol.k}
    rotate={turn}
    pivot={WATER_PIVOT}
  />

  {#each waterBar as bl (bl.i)}
    <rect
      class="block {bl.kind}"
      class:on={active(bl, phase)}
      x={bl.x}
      y={barY}
      width={b}
      height={b}
      rx={b * 0.18}
    />
  {/each}

  <g style="opacity:{fullOpacity}">
    <MiniMolecule atoms={pose(CO2, null)} bonds={CO2.bonds} x={62} y={98} k={0.95} />
    {#each co2Bar as bl (bl.i)}
      <rect class="block {bl.kind}" x={bl.x} y="90" width="16" height="16" rx="2.9" />
    {/each}
  </g>

  <!-- ── Row 2: the three modes of H₂O ── -->
  <g style="opacity:{fullOpacity}">
    {#each WATER_ROW as m, i}
      <MiniMolecule atoms={pose(WATER, WATER_MODES[i], swing, 4)} bonds={WATER.bonds} x={m.x} y={200} k={1.15} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="162">The three modes of H₂O</text>
    {#each WATER_ROW as m}
      <text class="lbl strong" x={m.x} y="232" text-anchor="middle">{m.local}</text>
      <text class="lbl faint" x={m.x} y="248" text-anchor="middle">{m.num}</text>
    {/each}
  </g>

  <!-- ── Row 3: the four modes of CO₂ ── -->
  <g style="opacity:{fullOpacity}">
    {#each CO2_ROW as m, i}
      <MiniMolecule atoms={pose(CO2, CO2_MODES[i], swing, 4)} bonds={CO2.bonds} x={m.x} y={324} k={1.2} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="290">The four modes of CO₂</text>
    {#each CO2_ROW as m}
      <text class="lbl strong" x={m.x} y="354" text-anchor="middle">{m.local}</text>
      <text class="lbl faint" x={m.x} y="370" text-anchor="middle">{m.num}</text>
      {#if m.extra}<text class="lbl faint" x={m.x} y="386" text-anchor="middle">{m.extra}</text>{/if}
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

  /* Travelling and turning: outlined, not vibrations. Vibrating: filled. The
     one in use while the cycle plays: the Knowledge green. */
  .block { stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
  .block.T, .block.R { fill: var(--surface); stroke: var(--line-slate-strong); }
  .block.V { fill: var(--brand-700); fill-opacity: 0.8; stroke: var(--brand-700); }
  .block.on { fill: var(--accent-green-fg); fill-opacity: 1; stroke: var(--accent-green-fg); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong { fill: var(--ink-slate-900); }
  .lbl.name { fill: var(--ink-slate-900); }
</style>

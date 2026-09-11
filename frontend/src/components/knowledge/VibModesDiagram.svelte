<script lang="ts">
  /**
   * Vibration modes: the atoms moving against each other, the centre of
   * mass still.
   *
   *   t = 0  the card: the three normal modes of H₂O, side by side, all
   *          moving at once while playing.
   *   t = 1  the opened card, two rows:
   *            the three modes of H₂O, each named both ways (group-frequency
   *              label, Herzberg number) with its wavenumber;
   *            the four of CO₂, the bend twice, in the page and out of it
   *              (drawn as the atoms growing and shrinking).
   *
   * The molecules and their displacement vectors are the Vibration Modes
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
  const F = { W: 480, H: 262 };

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
  $: swing = running ? Math.sin(2 * Math.PI * 1.1 * time) : 0;

  const WATER = geometryFor('water', 'gas')!;
  const CO2 = geometryFor('co2', 'gas')!;

  const WATER_ROW = [
    { id: 'h2o_stretch_symmetric', local: 'νₛ(OH)', num: 'ν₁ · 3657 cm⁻¹', sx: 42, fx: 100 },
    { id: 'h2o_bend', local: 'δ(HOH)', num: 'ν₂ · 1595 cm⁻¹', sx: 110, fx: 240 },
    { id: 'h2o_stretch_asymmetric', local: 'νₐₛ(OH)', num: 'ν₃ · 3756 cm⁻¹', sx: 178, fx: 380 },
  ];
  const CO2_ROW = [
    { id: 'co2_stretch_symmetric', local: 'νₛ(OCO)', num: 'ν₁ · Raman only', extra: '', x: 72 },
    { id: 'co2_bend', local: 'δ(OCO)', num: 'ν₂ · 667 cm⁻¹', extra: 'in the page', x: 188 },
    { id: 'co2_bend_wagging', local: 'δ(OCO)', num: 'ν₂ · 667 cm⁻¹', extra: 'out of it', x: 304 },
    { id: 'co2_stretch_asymmetric', local: 'νₐₛ(OCO)', num: 'ν₃ · 2349 cm⁻¹', extra: '', x: 420 },
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
  aria-label="The three normal modes of H₂O and the four of CO₂, each a pattern in which every atom moves in step while the centre of mass stays put"
>
  <!-- ── Row 1: the three modes of H₂O, on the card and opened ── -->
  {#each WATER_ROW as m (m.id)}
    <MiniMolecule
      atoms={pose(WATER, m.id, swing, 4)}
      bonds={WATER.bonds}
      x={lerp(m.sx, m.fx, t)}
      y={lerp(58, 64, t)}
      k={lerp(0.95, 1.15, t)}
    />
  {/each}
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">The Three Modes of H₂O</text>
    {#each WATER_ROW as m (m.id)}
      <text class="lbl strong" x={m.fx} y="96" text-anchor="middle">{m.local}</text>
      <text class="lbl faint" x={m.fx} y="112" text-anchor="middle">{m.num}</text>
    {/each}
  </g>

  <!-- ── Row 2 (opened): the four modes of CO₂ ── -->
  <g style="opacity:{fullOpacity}">
    {#each CO2_ROW as m (m.id)}
      <MiniMolecule atoms={pose(CO2, m.id, swing, 4)} bonds={CO2.bonds} x={m.x} y={186} k={1.2} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="152">The Four Modes of CO₂</text>
    {#each CO2_ROW as m (m.id)}
      <text class="lbl strong" x={m.x} y="216" text-anchor="middle">{m.local}</text>
      <text class="lbl faint" x={m.x} y="232" text-anchor="middle">{m.num}</text>
      {#if m.extra}<text class="lbl faint" x={m.x} y="248" text-anchor="middle">{m.extra}</text>{/if}
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

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
</style>

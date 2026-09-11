<script lang="ts">
  /**
   * The two notations the atlas writes a mode in, one diagram for each card.
   *
   * kind = 'labels', group-frequency labels:
   *   t = 0  six CH₂ groups, each doing one of the motions the letters name
   *          (νₛ νₐₛ δ ρ ω τ), and two CH₃ groups for the umbrella (δₛ) and
   *          the asymmetric deformation (δₐₛ), all at once while playing.
   *   t = 1  the eight, larger, with their names; below them one band label
   *          taken apart into motion, moving atoms, species and the star
   *          for adsorbed, each part lit in turn while playing.
   *
   * kind = 'numbering', Herzberg numbering:
   *   t = 0  the three modes of H₂O with their numbers and symmetry species.
   *   t = 1  the same three set on a wavenumber axis, where ν₃ is the
   *          highest yet numbered last (B₂ after A₁); below them CO₂'s four
   *          modes, whose traditional numbering makes the bend ν₂.
   *
   * The CH₂ and CH₃ groups are small 3D models in perspective (Group3D), so
   * wag and twist really leave the plane. H₂O and CO₂ are the Vibration modes
   * view's own geometry, where out-of-plane motion is drawn as the atom
   * growing and shrinking.
   */
  import { onDestroy } from 'svelte';
  import { geometryFor } from '../../lib/moleculeGeometry';
  import MiniMolecule, { pose } from './MiniMolecule.svelte';
  import Group3D, { type GroupMotion } from './Group3D.svelte';

  export let kind = 'labels';
  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  $: F = kind === 'labels' ? { W: 480, H: 452 } : { W: 480, H: 344 };

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

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);

  /* ── Group-frequency labels: six motions of a CH₂ group, two of a CH₃ ── */
  const MOTIONS: { m: GroupMotion; sym: string; name: string; ch3?: boolean }[] = [
    { m: 'sym', sym: 'νₛ', name: 'symmetric stretch' },
    { m: 'asym', sym: 'νₐₛ', name: 'asymmetric stretch' },
    { m: 'scissor', sym: 'δ', name: 'scissor' },
    { m: 'rock', sym: 'ρ', name: 'rock' },
    { m: 'wag', sym: 'ω', name: 'wag, out of plane' },
    { m: 'twist', sym: 'τ', name: 'twist, out of plane' },
    { m: 'umbrella', sym: 'δₛ', name: 'umbrella', ch3: true },
    { m: 'deform', sym: 'δₐₛ', name: 'asymmetric deformation', ch3: true },
  ];
  // Closed: one row of eight, the CH₃ pair set a little apart. Opened: the
  // CH₂ motions in two rows of three, the CH₃ pair in a third row.
  $: glyphs = MOTIONS.map((g, i) => {
    const small = { x: 13 + 26.4 * i + (g.ch3 ? 6 : 0), y: 46 };
    const full = g.ch3
      ? { x: i === 6 ? 160 : 320, y: 256 }
      : { x: 80 + 160 * (i % 3), y: i < 3 ? 52 : 148 };
    return {
      ...g,
      x: lerp(small.x, full.x, t),
      y: lerp(small.y, full.y, t),
      k: lerp(0.72, 1.45, t),
      symY: lerp(small.y + 30, full.y + 36, t),
      nameY: full.y + 52,
    };
  });

  // One label taken apart: its four parts, each with what it says.
  const PARTS = [
    { text: 'νₐₛ', x: 70, w: 44, what: 'motion', detail: 'asymmetric stretch' },
    { text: '(OCO)', x: 176, w: 96, what: 'moving atoms', detail: 'O, C, O' },
    { text: 'HCOO', x: 300, w: 78, what: 'species', detail: 'formate' },
    { text: '*', x: 380, w: 20, what: 'adsorbed', detail: 'on a surface' },
  ];
  $: litPart = running && t > 0.9 ? Math.floor(time / 1.2) % PARTS.length : -1;

  /* ── Herzberg numbering: H₂O and CO₂ ── */
  const WATER = geometryFor('water', 'gas')!;
  const CO2 = geometryFor('co2', 'gas')!;
  const WATER_MODES = [
    { id: 'h2o_stretch_symmetric', num: 'ν₁', sp: 'A₁', local: 'νₛ(OH)', wn: 3657 },
    { id: 'h2o_bend', num: 'ν₂', sp: 'A₁', local: 'δ(HOH)', wn: 1595 },
    { id: 'h2o_stretch_asymmetric', num: 'ν₃', sp: 'B₂', local: 'νₐₛ(OH)', wn: 3756 },
  ];
  $: water = WATER_MODES.map((m, i) => ({
    ...m,
    x: lerp(40 + 70 * i, 80 + 120 * i, t),
    y: lerp(44, 60, t),
    k: lerp(0.9, 1.2, t),
    numY: lerp(78, 100, t),
    spY: lerp(93, 116, t),
  }));
  // The axis, 4000 to 1000 cm⁻¹, high wavenumber on the left as on the chart.
  const AX = { x0: 40, x1: 440, y: 170, hi: 4000, lo: 1000 };
  const wnX = (wn: number) => AX.x0 + ((AX.hi - wn) / (AX.hi - AX.lo)) * (AX.x1 - AX.x0);
  const CO2_MODES = [
    { id: 'co2_stretch_symmetric', num: 'ν₁', sp: ['Σ', 'g', '⁺'], local: 'νₛ(OCO)' },
    { id: 'co2_bend', num: 'ν₂', sp: ['Π', 'u', ''], local: 'δ(OCO)' },
    { id: 'co2_bend_wagging', num: 'ν₂', sp: ['Π', 'u', ''], local: 'δ(OCO)' },
    { id: 'co2_stretch_asymmetric', num: 'ν₃', sp: ['Σ', 'u', '⁺'], local: 'νₐₛ(OCO)' },
  ];
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label={kind === 'labels'
    ? 'The six motions of a CH₂ group and their symbols, and a band label taken apart into motion, atoms, species and the adsorbed mark'
    : 'The modes of H₂O numbered by symmetry species and then by falling wavenumber, and CO₂ with its traditional numbering'}
>
  {#if kind === 'labels'}
    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x="14" y="16">Six motions of a CH₂ group</text>
      <text class="lbl name" x="14" y="218">Two more of a CH₃ group</text>
    </g>
    {#each glyphs as g (g.m)}
      <!-- The methyl is seen from higher up, so its front hydrogen clears the carbon. -->
      <Group3D
        kind={g.ch3 ? 'ch3' : 'ch2'}
        motion={g.m}
        s={swing}
        x={g.x}
        y={g.y}
        k={g.k}
        yaw={g.ch3 ? 28 : 24}
        tilt={g.ch3 ? 30 : 14}
      />
      <text class="sym" x={g.x} y={g.symY} text-anchor="middle">{g.sym}</text>
      <text class="lbl faint" x={g.x} y={g.nameY} text-anchor="middle" style="opacity:{labelOpacity}">{g.name}</text>
    {/each}

    <!-- ── The anatomy of one label ── -->
    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x="14" y="346">One label, taken apart</text>
      {#each PARTS as p, i}
        <text class="big" class:lit={litPart === i} x={p.x} y="388" text-anchor="middle">{p.text}</text>
        <path class="bracket" class:lit={litPart === i} d="M {p.x - p.w / 2} 398 v 5 h {p.w} v -5" />
        <text class="lbl strong" class:lit={litPart === i} x={p.x} y="422" text-anchor="middle">{p.what}</text>
        <text class="lbl faint" x={p.x} y="438" text-anchor="middle">{p.detail}</text>
      {/each}
    </g>
  {:else}
    <!-- ── H₂O: numbered by symmetry, then by wavenumber ── -->
    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x="14" y="16">H₂O: by symmetry, then by wavenumber</text>
    </g>
    {#each water as m (m.id)}
      <MiniMolecule atoms={pose(WATER, m.id, swing, 4)} bonds={WATER.bonds} x={m.x} y={m.y} k={m.k} />
      <text class="sym" x={m.x} y={m.numY} text-anchor="middle">{m.num}</text>
      <text class="lbl sp" x={m.x} y={m.spY} text-anchor="middle">{m.sp}</text>
      <text class="lbl faint" x={m.x} y={m.spY + 16} text-anchor="middle" style="opacity:{labelOpacity}">{m.local}</text>
    {/each}

    <g style="opacity:{fullOpacity}">
      <line class="axis" x1={AX.x0} x2={AX.x1} y1={AX.y} y2={AX.y} />
      {#each [4000, 3000, 2000, 1000] as wn}
        <line class="axis" x1={wnX(wn)} x2={wnX(wn)} y1={AX.y} y2={AX.y + 4} />
      {/each}
      {#each WATER_MODES as m}
        <line class="mark" class:b2={m.sp === 'B₂'} x1={wnX(m.wn)} x2={wnX(m.wn)} y1={AX.y - 12} y2={AX.y} />
      {/each}
    </g>
    <g style="opacity:{labelOpacity}">
      {#each [4000, 3000, 2000, 1000] as wn}
        <text class="lbl faint" x={wnX(wn)} y={AX.y + 18} text-anchor="middle">{wn}</text>
      {/each}
      <text class="lbl strong" x={wnX(3756) - 4} y={AX.y - 16} text-anchor="end">ν₃ 3756</text>
      <text class="lbl strong" x={wnX(3657) + 4} y={AX.y - 16}>ν₁ 3657</text>
      <text class="lbl strong" x={wnX(1595)} y={AX.y - 16} text-anchor="middle">ν₂ 1595</text>
      <text class="lbl faint" x={AX.x0} y={AX.y + 38}>ν₃ sits highest, yet comes last: B₂ after A₁</text>
    </g>

    <!-- ── CO₂: the traditional numbering ── -->
    <g style="opacity:{fullOpacity}">
      {#each CO2_MODES as m, i (m.id)}
        <MiniMolecule atoms={pose(CO2, m.id, swing, 4)} bonds={CO2.bonds} x={72 + 116 * i} y={276} k={1.1} />
      {/each}
    </g>
    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x="14" y="244">CO₂: the bend is always ν₂</text>
      {#each CO2_MODES as m, i (m.id)}
        <text class="lbl strong" x={72 + 116 * i} y="308" text-anchor="middle">{m.num}<tspan dx="8">{m.sp[0]}</tspan><tspan class="sub" dy="3">{m.sp[1]}</tspan><tspan dy="-3">{m.sp[2]}</tspan></text>
        <text class="lbl faint" x={72 + 116 * i} y="326" text-anchor="middle">{m.local}</text>
      {/each}
      <text class="lbl faint" x={72 + 116 * 2} y="340" text-anchor="middle">out of the page</text>
    </g>
  {/if}
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .mark { stroke: var(--brand-700); stroke-width: 2.2; stroke-linecap: round; }
  .mark.b2 { stroke: var(--diagram-photon); }

  .bracket { fill: none; stroke: var(--ink-025); stroke-width: 1; }
  .bracket.lit { stroke: var(--accent-green-fg); }

  .sym {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-slate-900);
  }

  .big {
    font-family: var(--font-sans);
    font-size: calc(var(--t-code-size) * 2);
    fill: var(--ink-slate-900);
    transition: fill 0.2s;
  }
  .big.lit, .lbl.lit { fill: var(--accent-green-fg); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.sp { fill: var(--ink-400); }
  .sub { font-size: 0.75em; }
</style>

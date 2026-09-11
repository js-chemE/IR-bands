<script lang="ts">
  /**
   * Rotation: free to turn in the gas, only able to rock on a surface.
   *
   *   t = 0  the card: a free CO spinning beside a CO held on a surface,
   *          which can only rock about its carbon.
   *   t = 1  the opened card, three rows:
   *            free: the rotational ladder, E(J) = B·J(J + 1), its first gap
   *              set against the vibration's;
   *            with the vibration: J changes with v, +1 (R, bluer, higher
   *              wavenumber) or −1 (P, redder, lower), and each line of the
   *              stick spectrum is one arrow; CO has no Q branch. Playing,
   *              the arrows light up one after another with their lines;
   *            held: the turn becomes a rock (frustrated rotation) and the
   *              travel a slide (frustrated translation), vibrations of their
   *              own with no branches.
   *
   * Level spacings are schematic; the two ladders are not drawn to one scale.
   */
  import { onDestroy } from 'svelte';
  import MiniMolecule from './MiniMolecule.svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 476 };

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

  /* ── The two molecules ── */
  const FREE_CO = [
    { x: -13, y: 0, r: 5.4, el: 'C' },
    { x: 13, y: 0, r: 5.2, el: 'O' },
  ];
  const HELD_CO = [
    { x: 0, y: 0, r: 5.4, el: 'C' },
    { x: 0, y: -26, r: 5.2, el: 'O' },
  ];
  const CO_BOND: [number, number][] = [[0, 1]];

  // Free: a steady turn. Held: a rock about the carbon, and (opened) a slide.
  $: spin = running ? -30 + 120 * time : -30;
  $: rock = running ? 24 * Math.sin(2 * Math.PI * 0.9 * time) : 14;
  $: slide = running ? 8 * Math.sin(2 * Math.PI * 0.7 * time) : 0;

  $: free = { x: lerp(55, 70, t), y: lerp(50, 76, t), r: lerp(20, 24, t) };
  $: held = { x: lerp(162, 110, t), y: lerp(76, 430, t) };
  $: surf = { x1: lerp(120, 20, t), x2: lerp(205, 460, t), y: lerp(84, 438, t) };

  /* ── Row 1: the ladder ── */
  const LADDER = { x1: 150, x2: 246, y0: 132, px: 2.1 };
  const LEVELS = [0, 1, 2, 3, 4, 5, 6].map(J => ({ J, y: LADDER.y0 - LADDER.px * J * (J + 1) }));

  /* ── Row 2: branches ── */
  const V0 = 294;
  const V1 = 222;
  const RP = 1.3;
  const lvl = (v: number, J: number) => (v ? V1 : V0) - RP * J * (J + 1);
  // How full a starting level is: (2J + 1) Boltzmann-weighted, schematic.
  const pop = (J: number) => (2 * J + 1) * Math.exp(-(J * (J + 1)) / 8);
  const POP_MAX = Math.max(...[0, 1, 2, 3, 4, 5].map(pop));
  const ORIGIN = 370;
  const PX_PER_2B = 13;
  const LINES = [
    ...[0, 1, 2, 3].map(J => ({ branch: 'R' as const, J, to: J + 1, x: ORIGIN - PX_PER_2B * (J + 1), h: 52 * pop(J) / POP_MAX, ax: 52 + 13 * J })),
    ...[1, 2, 3, 4].map(J => ({ branch: 'P' as const, J, to: J - 1, x: ORIGIN + PX_PER_2B * J, h: 52 * pop(J) / POP_MAX, ax: 128 + 13 * J })),
  ];
  // Playing, one transition at a time, R then P.
  $: lit = running ? Math.floor(time / 0.55) % LINES.length : -1;

  const ROCK = (24 * Math.PI) / 180;
  const arc = (cx: number, cy: number) =>
    `M ${cx - 26 * Math.sin(ROCK)} ${cy - 26 * Math.cos(ROCK)} A 26 26 0 0 1 ${cx + 26 * Math.sin(ROCK)} ${cy - 26 * Math.cos(ROCK)}`;

  const up = (x: number, y: number) => `M${x - 2.8},${y + 4.4} L${x},${y} L${x + 2.8},${y + 4.4}`;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A free CO molecule turns on a ladder of rotational levels, which splits its vibrational band into P and R branches; held on a surface it can only rock and slide, as vibrations of their own"
>
  <!-- ── Free CO, turning ── -->
  <circle class="path" cx={free.x} cy={free.y} r={free.r} />
  <MiniMolecule atoms={FREE_CO} bonds={CO_BOND} x={free.x} y={free.y} rotate={spin} />

  <!-- ── Held CO, rocking ── -->
  <line class="surface" x1={surf.x1} x2={surf.x2} y1={surf.y} y2={surf.y} style="opacity:{1 - fullOpacity}" />
  <rect class="metal" x="20" y="438" width="440" height="14" style="opacity:{fullOpacity}" />
  <!-- The arc the oxygen rocks along, about the carbon held to the surface. -->
  <path class="path" d={arc(held.x, held.y - 7)} />
  <line class="anchor" x1={held.x} x2={held.x} y1={held.y - 2} y2={surf.y} />
  <MiniMolecule atoms={HELD_CO} bonds={CO_BOND} x={held.x} y={held.y - 7} rotate={rock} />

  <!-- ── Row 1 (opened): the ladder ── -->
  <g style="opacity:{fullOpacity}">
    {#each LEVELS as l (l.J)}
      <line class="level" x1={LADDER.x1} x2={LADDER.x2} y1={l.y} y2={l.y} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Free: a ladder of its own</text>
    {#each LEVELS.filter(l => l.J % 2 === 0) as l (l.J)}
      <text class="lbl faint" x={LADDER.x2 + 6} y={l.y + 4}>J = {l.J}</text>
    {/each}
    <text class="lbl strong" x="316" y="62">E(J) = B · J(J + 1)</text>
    <text class="lbl" x="316" y="82">CO: B = 1.93 cm⁻¹</text>
    <text class="lbl" x="316" y="100">J 0 → 1: 3.9 cm⁻¹</text>
    <text class="lbl faint" x="316" y="118">v 0 → 1: 2143 cm⁻¹</text>
  </g>

  <!-- ── Row 2 (opened): the branches ── -->
  <g style="opacity:{fullOpacity}">
    {#each [0, 1, 2, 3, 4] as J}
      <line class="level thin" x1="40" x2="236" y1={lvl(0, J)} y2={lvl(0, J)} />
      <line class="level thin" x1="40" x2="236" y1={lvl(1, J)} y2={lvl(1, J)} />
    {/each}
    {#each LINES as ln, i}
      {@const y0 = lvl(0, ln.J)}
      {@const y1 = lvl(1, ln.to)}
      <g class="tr {ln.branch}" class:dim={lit >= 0 && lit !== i}>
        <line x1={ln.ax} x2={ln.ax} y1={y0} y2={y1 + 1} />
        <path d={up(ln.ax, y1)} />
      </g>
    {/each}

    <line class="axis" x1="276" x2="466" y1={V0} y2={V0} />
    {#each LINES as ln, i}
      <line class="stick {ln.branch}" class:dim={lit >= 0 && lit !== i} x1={ln.x} x2={ln.x} y1={V0} y2={V0 - ln.h} />
    {/each}
    <line class="origin" x1={ORIGIN} x2={ORIGIN} y1={V0} y2={V0 - 60} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="172">With the vibration: P and R</text>
    <text class="lbl faint" x="240" y={V0 + 4}>v = 0</text>
    <text class="lbl faint" x="240" y={V1 + 4}>v = 1</text>
    <text class="lbl R" x={ORIGIN - 3.2 * PX_PER_2B} y={V0 - 66} text-anchor="middle">R: ΔJ = +1</text>
    <text class="lbl P" x={ORIGIN + 3.2 * PX_PER_2B} y={V0 - 66} text-anchor="middle">P: ΔJ = −1</text>
    <text class="lbl faint" x={ORIGIN} y={V0 + 16} text-anchor="middle">no Q for CO</text>
    <text class="lbl faint" x="276" y={V0 + 30}>← higher wavenumber</text>
  </g>

  <!-- ── Row 3 (opened): held on a surface ── -->
  <g style="opacity:{fullOpacity}">
    <line class="anchor" x1={270 + slide} x2="270" y1="428" y2="438" />
    <MiniMolecule atoms={HELD_CO} bonds={CO_BOND} x={270 + slide} y={423} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="354">Held: the turn becomes a rock</text>
    <text class="lbl faint" x="110" y="470" text-anchor="middle">frustrated rotation</text>
    <text class="lbl faint" x="270" y="470" text-anchor="middle">frustrated translation</text>
    <text class="lbl" x="364" y="392">a band each,</text>
    <text class="lbl" x="364" y="410">low wavenumber,</text>
    <text class="lbl" x="364" y="428">no P or R</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .path { fill: none; stroke: var(--ink-slate-400); stroke-width: 1; stroke-dasharray: 3 2; stroke-opacity: 0.7; }
  .surface { stroke: var(--line-slate-strong); stroke-width: 1.4; }
  .anchor { stroke: var(--ink-slate-400); stroke-width: 1.2; stroke-dasharray: 2 1.5; }
  .metal { fill: var(--line-slate); stroke: var(--line-slate-strong); stroke-width: 1; }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.3; stroke-linecap: round; }
  .level.thin { stroke-width: 1; stroke-opacity: 0.8; }

  /* R is the bluer branch (higher energy), P the redder: the Raman card's colours. */
  .tr line, .tr path { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; transition: opacity 0.2s; }
  .tr.R line, .tr.R path { stroke: var(--diagram-anti-stokes); }
  .tr.P line, .tr.P path { stroke: var(--diagram-stokes); }
  .dim { opacity: 0.2; }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .stick { stroke-width: 2.2; stroke-linecap: round; transition: opacity 0.2s; }
  .stick.R { stroke: var(--diagram-anti-stokes); }
  .stick.P { stroke: var(--diagram-stokes); }
  .origin { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 2 2; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.R { fill: var(--diagram-anti-stokes); }
  .lbl.P { fill: var(--diagram-stokes); }
</style>

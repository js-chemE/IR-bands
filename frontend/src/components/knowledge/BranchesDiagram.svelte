<script lang="ts">
  /**
   * Rotational branches: one photon changes v and J together.
   *
   *   t = 0  the card: a free CO turning beside its band, a row of lines in
   *          two branches, R to the left (higher wavenumber) and P to the
   *          right, with the two-lobed envelope a low-resolution spectrum
   *          shows dashed over them.
   *   t = 1  the opened card, two rows:
   *            the ladders of v = 0 and v = 1, each with its rotational
   *              levels, and the transitions between them: ΔJ = +1 (R, the
   *              bluer) and −1 (P, the redder), each arrow one line of the
   *              spectrum beside it; CO has no Q branch. Playing, the arrows
   *              light up one after another with their lines;
   *            a band whose dipole swings across the axis (the CO₂ bend),
   *              where ΔJ = 0 is allowed too and the Q branch piles up at
   *              the centre.
   *
   * Line heights follow the room-temperature population of the starting
   * level (the Rotation card); spacings are schematic.
   */
  import { onDestroy } from 'svelte';
  import MiniMolecule from './MiniMolecule.svelte';

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

  /* ── The free CO on the card ── */
  const FREE_CO = [
    { x: -13, y: 0, r: 5.4, el: 'C' },
    { x: 13, y: 0, r: 5.2, el: 'O' },
  ];
  const CO_BOND: [number, number][] = [[0, 1]];
  const COM = { x: (12 * -13 + 16 * 13) / 28, y: 0 };
  $: spin = running ? -30 + 110 * time : -30;

  /* ── Population of the starting level, schematic ── */
  const pop = (J: number) => (2 * J + 1) * Math.exp(-(J * (J + 1)) / 12);
  const POP_MAX = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(pop));

  /* ── Row 1: ladders, arrows and the spectrum they make ── */
  const V0 = 168;
  const V1 = 96;
  const RP = 1.3;
  const lvl = (v: number, J: number) => (v ? V1 : V0) - RP * J * (J + 1);
  const ORIGIN = 371;
  const STEP = 13;
  const LINES = [
    ...[0, 1, 2, 3, 4, 5].map(J => ({ b: 'R' as const, J, to: J + 1, xf: ORIGIN - STEP * (J + 1) })),
    ...[1, 2, 3, 4, 5, 6].map(J => ({ b: 'P' as const, J, to: J - 1, xf: ORIGIN + STEP * J })),
  ].map(l => ({ ...l, h: (52 * pop(l.J)) / POP_MAX }));
  // The arrows drawn on the ladders: the first four of each branch.
  const ARROWS = LINES.filter(l => (l.b === 'R' ? l.J <= 3 : l.J <= 4)).map((l, i) => ({
    ...l,
    ax: l.b === 'R' ? 52 + 13 * l.J : 128 + 13 * l.J,
    i,
  }));
  $: lit = running ? Math.floor(time / 0.55) % ARROWS.length : -1;
  const litLine = (l: (typeof LINES)[number], k: number) =>
    k >= 0 && ARROWS[k].b === l.b && ARROWS[k].J === l.J;

  // The spectrum's frame: small on the card, the full row once opened.
  const FULL = { x0: 276, x1: 466, base: V0 };
  const SMALL = { x0: 110, x1: 212, base: 86 };
  $: sx = (xf: number) => lerp(SMALL.x0 + ((xf - FULL.x0) * (SMALL.x1 - SMALL.x0)) / (FULL.x1 - FULL.x0), xf, t);
  $: base = lerp(SMALL.base, FULL.base, t);
  $: hk = lerp(0.8, 1, t);
  // What a spectrometer of a few cm⁻¹ resolution makes of the lines.
  function envelope(lines: { xf: number; h: number }[], x0: number, x1: number, sigma: number, bs: number, k: number, map: (x: number) => number) {
    const pts: string[] = [];
    for (let x = x0; x <= x1; x += 1) {
      let y = 0;
      for (const l of lines) y += l.h * 0.62 * Math.exp(-(((x - l.xf) / sigma) ** 2));
      pts.push(`${map(x).toFixed(1)},${(bs - y * k).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  $: env1 = envelope(LINES, FULL.x0, FULL.x1, 11, base, hk, sx);

  const up = (x: number, y: number) => `M${x - 2.8},${y + 4.4} L${x},${y} L${x + 2.8},${y + 4.4}`;

  /* ── Row 2: with a Q branch ── */
  const BASE2 = 372;
  const O2 = 240;
  const LINES2 = [
    ...[0, 1, 2, 3, 4, 5, 6].map(J => ({ b: 'R', xf: O2 - 12 * (J + 1), h: (44 * pop(J)) / POP_MAX })),
    ...[1, 2, 3, 4, 5, 6, 7].map(J => ({ b: 'P', xf: O2 + 12 * J, h: (44 * pop(J)) / POP_MAX })),
  ];
  // The Q lines barely move with J, so they pile up into one tall line.
  const Q_H = 84;
  const env2 = envelope([...LINES2, { xf: O2, h: Q_H * 0.7 }], 60, 420, 9, BASE2, 1, x => x);

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A vibrational transition of a free molecule changes its rotational level too, so its band is a row of lines in a P and an R branch, and a Q branch where the symmetry allows"
>
  <!-- ── The free CO, on the card only ── -->
  <g style="opacity:{1 - fullOpacity}">
    <circle class="path" cx={52 + COM.x} cy="52" r="20" />
    <MiniMolecule atoms={FREE_CO} bonds={CO_BOND} x={52} y={52} rotate={spin} pivot={COM} />
  </g>

  <!-- ── Row 1: the spectrum, small on the card, then beside its ladders ── -->
  <line class="axis" x1={sx(FULL.x0)} x2={sx(FULL.x1)} y1={base} y2={base} />
  <path class="env" d={env1} />
  {#each LINES as l}
    <line class="stick {l.b}" class:dim={lit >= 0 && !litLine(l, lit)} x1={sx(l.xf)} x2={sx(l.xf)} y1={base} y2={base - l.h * hk} />
  {/each}
  <line class="origin" x1={sx(ORIGIN)} x2={sx(ORIGIN)} y1={base} y2={base - 60 * hk} />

  <g style="opacity:{fullOpacity}">
    {#each [0, 1, 2, 3, 4] as J}
      <line class="level" x1="40" x2="236" y1={lvl(0, J)} y2={lvl(0, J)} />
      <line class="level" x1="40" x2="236" y1={lvl(1, J)} y2={lvl(1, J)} />
    {/each}
    {#each ARROWS as a}
      {@const y1 = lvl(1, a.to)}
      <g class="tr {a.b}" class:dim={lit >= 0 && lit !== a.i}>
        <line x1={a.ax} x2={a.ax} y1={lvl(0, a.J)} y2={y1 + 1} />
        <path d={up(a.ax, y1)} />
      </g>
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">One Photon Changes v and J Together</text>
    <text class="lbl faint" x="240" y={V0 + 4}>v = 0</text>
    <text class="lbl faint" x="240" y={V1 + 4}>v = 1</text>
    <text class="lbl R" x={ORIGIN - 3.4 * STEP} y={V0 - 66} text-anchor="middle">R: ΔJ = +1</text>
    <text class="lbl P" x={ORIGIN + 3.4 * STEP} y={V0 - 66} text-anchor="middle">P: ΔJ = −1</text>
    <text class="lbl faint" x={ORIGIN} y={V0 + 16} text-anchor="middle">no Q for CO</text>
    <text class="lbl faint" x={FULL.x0} y={V0 + 32}>← higher wavenumber</text>
    <text class="lbl faint" x={FULL.x0} y={V0 + 48}>dashed: at low resolution</text>
  </g>

  <!-- ── Row 2: a Q branch ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis" x1="60" x2="420" y1={BASE2} y2={BASE2} />
    <path class="env" d={env2} />
    {#each LINES2 as l}
      <line class="stick {l.b}" x1={l.xf} x2={l.xf} y1={BASE2} y2={BASE2 - l.h} />
    {/each}
    <line class="stick Q" x1={O2} x2={O2} y1={BASE2} y2={BASE2 - Q_H} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="250">Where the Symmetry Allows It: A Q Branch</text>
    <text class="lbl R" x={O2 - 48} y={BASE2 - 62} text-anchor="middle">R</text>
    <text class="lbl Q" x={O2} y={BASE2 - Q_H - 6} text-anchor="middle">Q: ΔJ = 0</text>
    <text class="lbl P" x={O2 + 48} y={BASE2 - 62} text-anchor="middle">P</text>
    <text class="lbl faint" x={O2} y={BASE2 + 18} text-anchor="middle">the CO₂ bend: its dipole swings across the axis</text>
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
  .level { stroke: var(--ink-slate-400); stroke-width: 1; stroke-opacity: 0.8; stroke-linecap: round; }
  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .origin { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 2 2; }
  .env { fill: none; stroke: var(--ink-slate-500); stroke-width: 1; stroke-dasharray: 3 2; }

  /* R is the bluer branch (higher energy), P the redder: the Raman card's colours. */
  .tr line, .tr path { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; transition: opacity 0.2s; }
  .tr.R line, .tr.R path { stroke: var(--diagram-anti-stokes); }
  .tr.P line, .tr.P path { stroke: var(--diagram-stokes); }
  .dim { opacity: 0.2; }

  .stick { stroke-width: 2.2; stroke-linecap: round; transition: opacity 0.2s; }
  .stick.R { stroke: var(--diagram-anti-stokes); }
  .stick.P { stroke: var(--diagram-stokes); }
  .stick.Q { stroke: var(--brand-700); stroke-width: 2.6; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.R { fill: var(--diagram-anti-stokes); }
  .lbl.P { fill: var(--diagram-stokes); }
  .lbl.Q { fill: var(--brand-700); }
</style>

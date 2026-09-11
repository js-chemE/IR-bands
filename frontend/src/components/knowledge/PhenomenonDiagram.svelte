<script lang="ts">
  /**
   * The Band patterns cards: one small diagram per phenomenon, chosen by
   * `kind` (the phenomenon's key in lib/phenomena.ts).
   *
   * Every diagram has the same two halves: on the left what happens to the
   * molecule or its levels, on the right what that does to a little spectrum
   * (wavenumber falling to the right, as on the IR card). At rest the still
   * already shows the effect; while `playing` it runs in and out, so the
   * spectrum can be watched changing with the cause.
   *
   * Opened, the same drawing is simply shown twice as large, with its labels.
   * The labels are sized in drawing units at half the code size, so they land
   * at the code size once scaled up.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let kind = '';
  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const W = 220;
  const H = 100;
  $: scale = lerp(238 / 220, 2, t);

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
  /**
   * How far the effect is switched on, 0 … 1. At rest each diagram shows
   * its phenomenon (1), except degeneracy, whose point is the single band
   * before the symmetry is lowered (0). Playing, it goes out and back over
   * four seconds.
   */
  const REST: Record<string, number> = { degeneracy: 0 };
  $: rest = REST[kind] ?? 1;
  $: k = running
    ? (1 - Math.cos(2 * Math.PI * 0.25 * time + (rest ? Math.PI : 0))) / 2
    : rest;

  /* ── The little spectrum on the right ── */
  const SX0 = 110;
  const SX1 = 212;
  const BASE = 86;
  type Peak = { x: number; h: number; w: number; ghost?: boolean };
  function trace(peaks: Peak[]): string {
    const pts: string[] = [];
    for (let x = SX0; x <= SX1; x += 0.5) {
      let y = 0;
      for (const p of peaks) if (!p.ghost) y += p.h * Math.exp(-(((x - p.x) / p.w) ** 2));
      pts.push(`${x.toFixed(1)},${(BASE - y).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  function ghostPath(p: Peak): string {
    const pts: string[] = [];
    for (let x = p.x - 3 * p.w; x <= p.x + 3 * p.w; x += 0.5) {
      pts.push(`${x.toFixed(1)},${(BASE - p.h * Math.exp(-(((x - p.x) / p.w) ** 2))).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  /* ── Per kind ── */
  $: vib = Math.sin(2 * Math.PI * 1.1 * time); // a quick stretch, for molecules that move

  // Fermi: two levels close in energy repel and share intensity.
  $: fermi = {
    upper: 42 - 9 * k,
    lower: 52 + 9 * k,
    peaks: [
      { x: 156 - 13 * k, h: 44 * (1 - 0.42 * k), w: 3 },
      { x: 170 + 13 * k, h: 44 * 0.78 * k + 1, w: 3 },
    ] as Peak[],
  };

  // Isotope: the oxygen grows heavier, the band slides to lower wavenumber.
  $: iso = {
    rO: lerp(5.4, 7, k),
    peak: { x: 150 + 24 * k, h: 44, w: 4 } as Peak,
    ghost: { x: 150, h: 44, w: 4, ghost: true } as Peak,
    stretch: 3 * vib * (1 - 0.2 * k),
  };

  // Overtone: the weak two-rung step, and its weak band at a bit under twice.
  $: combo = [
    { x: 182, h: 44, w: 3 },
    { x: 126, h: 12 * k + 0.5, w: 3.5 },
  ] as Peak[];

  // Degeneracy: one level for two motions; a surface lowers the symmetry
  // and it splits.
  $: degen = {
    split: 7 * k,
    peaks: [
      { x: 160 - 11 * k, h: lerp(44, 28, k), w: 3.2 },
      { x: 160 + 11 * k, h: lerp(0, 28, k), w: 3.2 },
    ] as Peak[],
  };

  // Site: CO hops from a cation to a top site to a bridge; the band moves.
  // Spaced so the three one-word labels under the peaks stay clear of each other.
  const SITES = [
    { x: 76, y: 66, wn: 124, label: 'cation' },
    { x: 40, y: 64, wn: 156, label: 'top' },
    { x: 49, y: 67, wn: 192, label: 'bridge' },
  ];
  $: siteIndex = running ? Math.floor(time / 1.6) % 3 : 1;
  $: siteBlend = running ? ramp((time % 1.6) / 1.6, 0, 0.35) : 1;
  $: prevSite = SITES[(siteIndex + 2) % 3];
  $: site = SITES[siteIndex];
  $: coX = lerp(prevSite.x, site.x, siteBlend);
  $: coY = lerp(prevSite.y, site.y, siteBlend);
  $: sitePeak = { x: lerp(prevSite.wn, site.wn, siteBlend), h: 44, w: 3.5 } as Peak;

  $: labelOpacity = ramp(t, 0.75, 1);

  const up = (x: number, y: number) => `M${x - 2.6},${y + 4} L${x},${y} L${x + 2.6},${y + 4}`;

  const C_FILL = colorForElement('C');
  const O_FILL = colorForElement('O');
  const M_FILL = colorForElement('M');
</script>

<svg class="diagram" width={W * scale} height={H * scale} viewBox="0 0 {W} {H}" role="img" aria-label="{kind} diagram">
  <line class="axis" x1={SX0} x2={SX1} y1={BASE} y2={BASE} />

  {#if kind === 'fermi'}
    <!-- Levels: dashed where they would sit alone, solid where the mixing puts them. -->
    <line class="level faint" x1="18" x2="84" y1="42" y2="42" />
    <line class="level faint" x1="18" x2="84" y1="52" y2="52" />
    <line class="level" x1="18" x2="84" y1={fermi.upper} y2={fermi.upper} />
    <line class="level" x1="18" x2="84" y1={fermi.lower} y2={fermi.lower} />
    <line class="level" x1="18" x2="84" y1="88" y2="88" />
    <line class="arrow" x1="36" x2="36" y1="88" y2={fermi.upper + 1} />
    <path class="arrow-head" d={up(36, fermi.upper)} />
    <g style="opacity:{0.15 + 0.85 * k}">
      <line class="arrow" x1="62" x2="62" y1="88" y2={fermi.lower + 1} />
      <path class="arrow-head" d={up(62, fermi.lower)} />
    </g>
    <path class="trace" d={trace(fermi.peaks)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="88" y={fermi.upper + 2}>ν₁</text>
      <text class="lbl" x="88" y={fermi.lower + 3}>2ν₂</text>
      <text class="lbl faint" x="18" y="97">dashed: without mixing</text>
      <text class="lbl faint" x="161" y="30" text-anchor="middle">intensity shared</text>
    </g>
  {:else if kind === 'isotopologue'}
    <line class="bond" x1={34 - iso.stretch / 2} x2={66 + iso.stretch / 2} y1="50" y2="50" />
    <circle cx={34 - iso.stretch / 2} cy="50" r="5.8" fill={C_FILL} />
    <circle cx={66 + iso.stretch / 2} cy="50" r={iso.rO} fill={O_FILL} />
    <text class="iso" x={66 + iso.stretch / 2} y="36" text-anchor="middle">{k > 0.5 ? '¹⁸O' : '¹⁶O'}</text>
    <path class="ghost" d={ghostPath(iso.ghost)} style="opacity:{k}" />
    <path class="trace" d={trace([iso.peak])} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl faint" x="150" y="30" text-anchor="middle">¹⁶O</text>
      <text class="lbl" x="176" y="30" text-anchor="middle">¹⁸O</text>
      <text class="lbl faint" x="50" y="76" text-anchor="middle">heavier: lower wavenumber</text>
    </g>
  {:else if kind === 'combination'}
    <line class="level" x1="18" x2="70" y1="88" y2="88" />
    <line class="level" x1="18" x2="70" y1="62" y2="62" />
    <line class="level" x1="18" x2="70" y1="38" y2="38" />
    <line class="arrow" x1="32" x2="32" y1="88" y2="63" />
    <path class="arrow-head" d={up(32, 62)} />
    <g style="opacity:{0.2 + 0.8 * k}">
      <line class="arrow dashed" x1="52" x2="52" y1="88" y2="39" />
      <path class="arrow-head" d={up(52, 38)} />
    </g>
    <path class="trace" d={trace(combo)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="74" y="90">v = 0</text>
      <text class="lbl" x="74" y="64">v = 1</text>
      <text class="lbl" x="74" y="40">v = 2</text>
      <text class="lbl faint" x="182" y="36" text-anchor="middle">fundamental</text>
      <text class="lbl faint" x="114" y="68">overtone, weak</text>
    </g>
  {:else if kind === 'degeneracy'}
    <!-- CO₂'s bend, in the plane and out of it: one frequency. -->
    <line class="bond" x1="32" x2="68" y1="26" y2="26" />
    <circle cx="32" cy="26" r="5" fill={O_FILL} />
    <circle cx="50" cy="26" r="5.3" fill={C_FILL} />
    <circle cx="68" cy="26" r="5" fill={O_FILL} />
    <path class="motion" d="M50,17 L50,11 M47.5,13.5 L50,11 L52.5,13.5" />
    <circle class="motion" cx="50" cy="40" r="3.4" />
    <circle class="motion-dot" cx="50" cy="40" r="1" />
    <line class="surface" x1="18" x2="82" y1="48" y2="48" style="opacity:{k}" />
    <line class="level" x1="22" x2="78" y1={66 - degen.split} y2={66 - degen.split} />
    <line class="level" x1="22" x2="78" y1={66 + degen.split} y2={66 + degen.split} />
    <path class="trace" d={trace(degen.peaks)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl faint" x="86" y="22">in the plane</text>
      <text class="lbl faint" x="86" y="42">out of it</text>
      <text class="lbl faint" x="50" y="87" text-anchor="middle">a surface lowers</text>
      <text class="lbl faint" x="50" y="95" text-anchor="middle">the symmetry</text>
      <text class="lbl faint" x="160" y="34" text-anchor="middle">one band, or two</text>
    </g>
  {:else if kind === 'site-sensitivity'}
    <line class="surface" x1="10" x2="96" y1="80" y2="80" />
    <circle cx="22" cy="80" r="6" fill={M_FILL} />
    <circle cx="40" cy="80" r="6" fill={M_FILL} />
    <circle cx="58" cy="80" r="6" fill={M_FILL} />
    <circle class="cation" cx="76" cy="80" r="6" />
    <text class="cation-lbl" x="76" y="83" text-anchor="middle">+</text>
    <line class="bond" x1={coX} x2={coX} y1={coY} y2={coY - 16} />
    <circle cx={coX} cy={coY} r="5.4" fill={C_FILL} />
    <circle cx={coX} cy={coY - 16} r="5.2" fill={O_FILL} />
    {#each SITES as s}
      <path class="ghost" d={ghostPath({ x: s.wn, h: 44, w: 3.5 })} style="opacity:{s === site ? 0 : 0.5}" />
    {/each}
    <path class="trace" d={trace([sitePeak])} />
    <g style="opacity:{labelOpacity}">
      {#each SITES as s}
        <text class="lbl" class:faint={s !== site} x={s.wn} y="96" text-anchor="middle">{s.label}</text>
      {/each}
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

  .axis { stroke: var(--line-slate-strong); stroke-width: 0.6; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.2; stroke-linejoin: round; }
  .ghost { fill: none; stroke: var(--ink-025); stroke-width: 0.9; stroke-dasharray: 2 2; }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.3; stroke-linecap: round; }
  .level.faint { stroke-opacity: 0.45; stroke-dasharray: 3 2; }

  .arrow { stroke: var(--diagram-photon); stroke-width: 1.4; }
  .arrow.dashed { stroke-dasharray: 3 2; }
  .arrow-head { fill: none; stroke: var(--diagram-photon); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2; }
  .surface { stroke: var(--line-slate-strong); stroke-width: 1.2; }
  .motion { fill: none; stroke: var(--ink-slate-500); stroke-width: 1; stroke-linecap: round; }
  .motion-dot { fill: var(--ink-slate-500); }
  .cation { fill: var(--surface); stroke: var(--charge-positive); stroke-width: 1.2; }
  .cation-lbl {
    font-family: var(--font-sans);
    font-size: calc(var(--t-code-size) * 0.75);
    font-weight: var(--t-label-weight);
    fill: var(--charge-positive);
  }

  /* In drawing units: the opened card doubles the drawing, so half the code
     size lands at the code size. */
  .lbl {
    font-family: var(--t-code-ff);
    font-size: calc(var(--t-code-size) * 0.5);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .iso {
    font-family: var(--font-sans);
    font-size: calc(var(--t-code-size) * 0.75);
    fill: var(--ink-slate-500);
  }
</style>

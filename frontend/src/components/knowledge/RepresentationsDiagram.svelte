<script lang="ts">
  /**
   * Spectral representations: the vertical axis of a spectrum, how much
   * light a band takes.
   *
   *   t = 0  the card: a small spectrum with its vertical axis lit in the
   *          Knowledge green (the horizontal one is the Spectral Units
   *          card's). Playing, the same sample is replotted as signal,
   *          transmittance, absorbance, reflectance, log(1/R) and
   *          Kubelka–Munk, the label on the axis changing with it.
   *   t = 1  the opened card, three rows:
   *            through the sample: the signal over its background, T, A;
   *            back from a powder, against the catalyst itself: the signal
   *              over its background, R₀, log(1/R₀), F(R₀); the two rows in
   *              parallel, column by column. Near R₀ = 1 the weak band stays in
   *              log(1/R₀) and all but vanishes in F(R₀) (Meunier 2026);
   *            the background sets zero: against the catalyst itself, a
   *              band gained points up and a band lost points down;
   *            a Raman spectrum: counts against the Raman shift, the laser
   *              line filtered out, the lines on a fluorescence background.
   *
   * One schematic sample throughout: a strong band and a weak one, the
   * same two in every panel.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 512 };

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

  /* ── One schematic sample ── */
  const WN = Array.from({ length: 61 }, (_, i) => 4000 - i * 50);
  const G = (wn: number, c: number, w: number) => Math.exp(-(((wn - c) / w) ** 2));
  const alpha = (wn: number) => G(wn, 2900, 80) + 0.3 * G(wn, 1650, 70);
  const lamp = (wn: number) => 0.45 + 0.5 * Math.exp(-(((wn - 2600) / 1300) ** 2));
  // Diffuse reflectance as an adsorbate experiment is run: against the
  // catalyst itself (Meunier 2026), so R₀ = R / R(catalyst) stays close to 1.
  // The weak band is 0.035 deep, the strong one 0.2.
  const r0 = (wn: number) => 1 - (0.2 * G(wn, 2900, 80) + 0.035 * G(wn, 1650, 70));
  const catalyst = (wn: number) => lamp(wn) * 0.62;
  const km = (wn: number) => (1 - r0(wn)) ** 2 / (2 * r0(wn));
  const trans = (wn: number) => Math.pow(10, -0.9 * alpha(wn));

  interface Series { key: string; label: string; caption: string; f: (wn: number) => number; lo: number; hi: number; bg?: boolean }
  const SERIES: Record<string, Series> = {
    It: { key: 'It', label: 'I / a.u.', caption: 'I over I₀', f: wn => lamp(wn) * trans(wn), lo: 0, hi: 1, bg: true },
    T: { key: 'T', label: 'T / –', caption: 'T = I / I₀', f: trans, lo: 0, hi: 1 },
    A: { key: 'A', label: 'A / –', caption: 'A = −log T', f: wn => 0.9 * alpha(wn), lo: 0, hi: 1 },
    Ir: { key: 'Ir', label: 'I / a.u.', caption: 'I over I₀', f: wn => catalyst(wn) * r0(wn), lo: 0, hi: 1, bg: true },
    R: { key: 'R', label: 'R₀ / –', caption: 'R₀ = I / I₀', f: r0, lo: 0.75, hi: 1.01 },
    L: { key: 'L', label: 'log(1/R₀) / –', caption: 'log(1/R₀)', f: wn => -Math.log10(r0(wn)), lo: 0, hi: 0.105 },
    K: { key: 'K', label: 'F(R₀) / –', caption: 'F(R₀)', f: km, lo: 0, hi: 0.027 },
  };
  // The card's cycle ends on a Raman spectrum: counts against shift.
  const ORDER = ['It', 'T', 'A', 'Ir', 'R', 'L', 'K', 'Ra'];
  $: cycleKey = running ? ORDER[Math.floor(time / 1.5) % ORDER.length] : 'A';

  function path(sr: Series, x0: number, x1: number, top: number, base: number, f = sr.f) {
    return 'M' + WN.map(wn => {
      const x = x0 + ((4000 - wn) / 3000) * (x1 - x0);
      const v = (f(wn) - sr.lo) / (sr.hi - sr.lo);
      return `${x.toFixed(1)},${(base - v * (base - top)).toFixed(1)}`;
    }).join(' L');
  }

  /* ── The small spectrum on the card ── */
  const SF = { x0: 26, x1: 210, top: 14, base: 82 };

  /* ── The opened rows ── */
  const COLS = [14, 126, 238, 350];
  const PW = 92;
  const ROW_T = { top: 50, base: 110, keys: ['It', 'T', 'A'] };
  const ROW_R = { top: 164, base: 224, keys: ['Ir', 'R', 'L', 'K'] };

  // Against the catalyst itself as background: CO gained, OH lost.
  const DIFF = (wn: number) => 0.55 * G(wn, 2050, 45) - 0.4 * G(wn, 3650, 70);
  const DR = { x0: 40, x1: 460, zero: 330, amp: 70 };
  const diffPath = 'M' + WN.map(wn => {
    const x = DR.x0 + ((4000 - wn) / 3000) * (DR.x1 - DR.x0);
    return `${x.toFixed(1)},${(DR.zero - DIFF(wn) * DR.amp).toFixed(1)}`;
  }).join(' L');
  const dx = (wn: number) => DR.x0 + ((4000 - wn) / 3000) * (DR.x1 - DR.x0);

  // A Raman spectrum: counts against shift, lines on a fluorescence
  // background, the laser line itself filtered out at zero.
  const RM = { x0: 40, x1: 460, base: 480, top: 412, max: 3400 };
  const rx = (shift: number) => RM.x0 + (shift / RM.max) * (RM.x1 - RM.x0);
  const LINES = [
    { s: 1285, h: 0.55 },
    { s: 1388, h: 0.85 },
    { s: 2330, h: 0.35 },
  ];
  const counts = (shift: number) =>
    0.08 + 0.25 * (shift / RM.max) + LINES.reduce((a, l) => a + l.h * Math.exp(-(((shift - l.s) / 14) ** 2)), 0);
  const ramanIn = (x0: number, x1: number, top: number, base: number) =>
    'M' + Array.from({ length: 341 }, (_, i) => 120 + i * 9.6)
      .map(sh => `${(x0 + (sh / RM.max) * (x1 - x0)).toFixed(1)},${(base - counts(sh) * (base - top) * 0.9).toFixed(1)}`)
      .join(' L');
  const ramanPath = ramanIn(RM.x0, RM.x1, RM.top, RM.base);

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: cardOpacity = 1 - ramp(t, 0.1, 0.5);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="The vertical axis of a spectrum: one sample plotted as signal, transmittance and absorbance through the sample, and as reflectance, log(1/R) and Kubelka–Munk back from a powder; against the catalyst as background, gained bands point up and lost ones down"
>
  <!-- ── The card: one spectrum, its vertical axis lit, replotted ── -->
  <g style="opacity:{cardOpacity}">
    <line class="axis lit" x1={SF.x0} x2={SF.x0} y1={SF.top - 4} y2={SF.base} />
    <path class="axis-head lit" d="M {SF.x0 - 3} {SF.top} L {SF.x0} {SF.top - 5} L {SF.x0 + 3} {SF.top}" />
    <line class="axis" x1={SF.x0} x2={SF.x1} y1={SF.base} y2={SF.base} />
    {#if cycleKey === 'Ra'}
      <path class="trace raman" d={ramanIn(SF.x0, SF.x1, SF.top, SF.base)} />
      <text class="tick lit" x={SF.x0 + 5} y={SF.top + 4}>intensity / counts</text>
    {:else}
      {#if SERIES[cycleKey].bg}
        <path class="bg" d={path(SERIES[cycleKey], SF.x0, SF.x1, SF.top, SF.base, cycleKey === 'Ir' ? catalyst : lamp)} />
      {/if}
      <path class="trace" d={path(SERIES[cycleKey], SF.x0, SF.x1, SF.top, SF.base)} />
      <text class="tick lit" x={SF.x0 + 5} y={SF.top + 4}>{SERIES[cycleKey].label}</text>
    {/if}
  </g>

  <!-- ── The opened rows: the two families, column by column ── -->
  <g style="opacity:{fullOpacity}">
    {#each [ROW_T, ROW_R] as row}
      {#each row.keys as key, c}
        {@const sr = SERIES[key]}
        {@const x0 = COLS[c]}
        <line class="axis lit" x1={x0} x2={x0} y1={row.top} y2={row.base} />
        <line class="axis" x1={x0} x2={x0 + PW} y1={row.base} y2={row.base} />
        {#if sr.bg}
          <path class="bg" d={path(sr, x0, x0 + PW, row.top, row.base, key === 'Ir' ? catalyst : lamp)} />
        {/if}
        <path class="trace" class:on={running && cycleKey === key} d={path(sr, x0, x0 + PW, row.top, row.base)} />
        {#if c < row.keys.length - 1}
          <path class="step" d="M {x0 + PW + 4} {(row.top + row.base) / 2} h 12 M {x0 + PW + 12} {(row.top + row.base) / 2 - 3} l 4 3 l -4 3" />
        {/if}
      {/each}
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">One Sample, Two Families</text>
    <text class="lbl strong" x="14" y="40">Through the Sample: Transmission</text>
    <text class="lbl strong" x="14" y="154">Back from a Powder: Against the Catalyst</text>
    {#each [ROW_T, ROW_R] as row}
      {#each row.keys as key, c}
        <text class="lbl" class:on={running && cycleKey === key} x={COLS[c] + PW / 2} y={row.base + 16} text-anchor="middle">{SERIES[key].caption}</text>
      {/each}
    {/each}
    <!-- The transmission row's fourth column: its scaling law. -->
    <text class="lbl strong" x={COLS[3] + PW / 2} y="76" text-anchor="middle">A = ε · c · l</text>
    <text class="lbl faint" x={COLS[3] + PW / 2} y="94" text-anchor="middle">∝ amount</text>
    <!-- Under the reflection row: what each form does to the weak band. -->
    <text class="lbl good" x={COLS[2] + PW / 2} y={ROW_R.base + 30} text-anchor="middle">weak: kept</text>
    <text class="lbl bad" x={COLS[3] + PW / 2} y={ROW_R.base + 30} text-anchor="middle">weak: squashed</text>
  </g>

  <!-- ── Row 3: the background sets zero ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis lit" x1={DR.x0} x2={DR.x0} y1={DR.zero - 50} y2={DR.zero + 40} />
    <line class="zero" x1={DR.x0} x2={DR.x1} y1={DR.zero} y2={DR.zero} />
    <path class="trace" d={diffPath} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="270">The Background Sets Zero</text>
    <text class="lbl faint" x={DR.x0 + 110} y={DR.zero - 6}>0: as the background</text>
    <text class="lbl gain" x={dx(2050)} y={DR.zero - 46} text-anchor="middle">gained: CO</text>
    <text class="lbl loss" x={dx(3650)} y={DR.zero + 44} text-anchor="middle">lost: OH</text>
  </g>

  <!-- ── Row 4: a Raman spectrum, counts against shift ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis lit" x1={RM.x0} x2={RM.x0} y1={RM.top - 6} y2={RM.base} />
    <line class="axis" x1={RM.x0} x2={RM.x1} y1={RM.base} y2={RM.base} />
    <rect class="notch" x={RM.x0 + 1} y={RM.top - 4} width={rx(120) - RM.x0 - 1} height={RM.base - RM.top + 4} />
    <line class="laser" x1={RM.x0 + 1} x2={RM.x0 + 1} y1={RM.top - 6} y2={RM.base} />
    <path class="trace raman" class:on={running && cycleKey === 'Ra'} d={ramanPath} />
    {#each [0, 1000, 2000, 3000] as sh}
      <line class="axis" x1={rx(sh)} x2={rx(sh)} y1={RM.base} y2={RM.base + 4} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="398">A Raman Spectrum: Counts against Shift</text>
    <text class="tick lit" x={RM.x0 + 5} y={RM.top + 2}>intensity / counts</text>
    {#each [0, 1000, 2000, 3000] as sh}
      <text class="tick" x={rx(sh)} y={RM.base + 14} text-anchor="middle">{sh}</text>
    {/each}
    <text class="tick" x={RM.x1} y={RM.base + 26} text-anchor="end">Raman shift / cm⁻¹</text>
    <text class="tick" x={rx(120) + 4} y={RM.top + 12}>laser filtered</text>
    <text class="tick" x={rx(2800)} y={RM.base - 34} text-anchor="middle">fluorescence</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  /* The axis this card is about, in the Knowledge green. */
  .axis.lit, .axis-head.lit { stroke: var(--accent-green-fg); stroke-width: 1.4; }
  .axis-head { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .zero { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.3; stroke-linejoin: round; transition: stroke 0.2s; }
  .trace.on { stroke: var(--accent-green-fg); stroke-width: 1.8; }
  .trace.raman { stroke: var(--diagram-stokes); }
  .laser { stroke: var(--diagram-laser); stroke-width: 2; }
  .notch { fill: var(--line-slate); opacity: 0.5; }
  .bg { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  .step { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: calc(var(--t-code-size) * 0.8);
    fill: var(--ink-050);
  }
  .tick.lit { fill: var(--accent-green-fg); }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.on { fill: var(--accent-green-fg); }
  .lbl.gain { fill: var(--charge-positive); }
  .lbl.good { fill: var(--accent-green-fg); }
  .lbl.bad { fill: var(--diagram-stokes); }
  .lbl.loss { fill: var(--charge-negative); }
</style>

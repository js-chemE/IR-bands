<script lang="ts">
  /**
   * Spectral representations: the vertical axis of a spectrum, how much
   * light a band takes.
   *
   *   t = 0  the card: a small spectrum with its vertical axis lit in the
   *          Knowledge green (the horizontal one is the Spectral Units
   *          card's). Playing, the same sample is replotted as signal,
   *          transmittance, absorbance, reflectance, log(1/R) and
   *          Kubelka–Munk, the label on the axis changing with it. Raman
   *          counts are not in the cycle: they are a ratio to nothing, and
   *          the Raman Spectroscopy card has them.
   *   t = 1  the opened card: the chain runs downward, two columns wide,
   *          transmission on the left and diffuse reflection on the right:
   *
   *            I and I₀   the raw signal over its background
   *            T and R    the ratio
   *            A and log(1/R)
   *            Kubelka–Munk, F(R), which the transmission side has no
   *                         counterpart for
   *
   *          One sample throughout, a strong band and a weak one, and each
   *          panel scaled to its own strong band. That is the lesson: the
   *          two families give the same curve at every step until
   *          Kubelka–Munk, where the weak band all but disappears (Meunier
   *          2026). The grey line under a trace is the form it is being
   *          compared with, on the same scale; the dashed line is the
   *          reference the trace is read from (I₀, then 1, then 0).
   *
   *   Below that: the background sets zero, which is true of every
   *   representation in the chain, so it belongs here rather than with any
   *   one technique. Against the catalyst itself, a band gained points up
   *   and a band lost points down.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));
  /** Smooth in and out, so one plot bends into the next without a jolt. */
  const ease = (k: number) => k * k * (3 - 2 * k);

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 514 };

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

  /* ── One schematic sample, measured twice ──────────────────────────────
   * A strong band and a weak one, three tenths of it. The same sample is
   * put through a wafer and into a diffuse-reflectance cell, and both
   * experiments take a fifth of the light at the strong band, so the two
   * columns are comparable at every step.
   */
  // 4 cm-1 a step: fine enough that a band is a curve, not a polygon.
  const WN = Array.from({ length: 751 }, (_, i) => 4000 - i * 4);
  const G = (wn: number, c: number, w: number) => Math.exp(-(((wn - c) / w) ** 2));
  const alpha = (wn: number) => G(wn, 2900, 80) + 0.3 * G(wn, 1650, 70);

  // Two different optical paths, so the two raw signals look nothing alike.
  const lampT = (wn: number) => 0.45 + 0.5 * Math.exp(-(((wn - 2600) / 1300) ** 2));
  const lampR = (wn: number) => 0.25 + 0.55 * Math.exp(-(((wn - 3300) / 1500) ** 2));

  const A_STRONG = -Math.log10(0.8); // the strong band takes a fifth of the light
  const absorbance = (wn: number) => A_STRONG * alpha(wn);
  const trans = (wn: number) => Math.pow(10, -absorbance(wn));
  const refl = (wn: number) => 1 - 0.2 * alpha(wn);
  const pseudo = (wn: number) => -Math.log10(refl(wn));
  const km = (wn: number) => (1 - refl(wn)) ** 2 / (2 * refl(wn));

  const sigT = (wn: number) => lampT(wn) * trans(wn);
  const sigR = (wn: number) => lampR(wn) * refl(wn);

  const maxOf = (f: (wn: number) => number) => Math.max(...WN.map(f));
  const MAX_T = maxOf(lampT);
  const MAX_R = maxOf(lampR);

  /* ── The card's cycle ── */
  interface Series { label: string; f: (wn: number) => number; lo: number; hi: number; bg?: (wn: number) => number }
  const SERIES: Record<string, Series> = {
    It: { label: 'I / a.u.', f: sigT, lo: 0, hi: MAX_T * 1.06, bg: lampT },
    T: { label: 'T / –', f: trans, lo: 0.72, hi: 1.03 },
    A: { label: 'A / –', f: absorbance, lo: 0, hi: A_STRONG * 1.12 },
    Ir: { label: 'I / a.u.', f: sigR, lo: 0, hi: MAX_R * 1.06, bg: lampR },
    R: { label: 'R / –', f: refl, lo: 0.72, hi: 1.03 },
    L: { label: 'log(1/R) / –', f: pseudo, lo: 0, hi: A_STRONG * 1.12 },
    K: { label: 'F(R) / –', f: km, lo: 0, hi: km(2900) * 1.12 },
  };
  /* ── The card's cycle ────────────────────────────────────────────────
   * The chain, one family then the other. One plot does not replace the
   * next: it turns into it. Each series is sampled as a fraction of its
   * own scale, so what is interpolated is the shape, and a curve that is
   * a dip on one scale rises into a peak on the next rather than cutting
   * to it. Only the label crossfades, since a word cannot bend.
   */
  const ORDER = ['It', 'T', 'A', 'Ir', 'R', 'L', 'K'];
  /** What the card shows when nothing is playing: absorbance. */
  const AT_REST = ORDER.indexOf('A');
  const DWELL = 0.7;
  const BEND = 0.5;
  const STEP_T = DWELL + BEND;
  /**
   * A head start on the first plot only, so hovering does something at
   * once instead of holding a still picture for a beat. The cycle is
   * otherwise unchanged, and the first move is still a bend, not a jump.
   */
  const FIRST = 0.15;
  // The cycle starts on the resting plot, so the first move is a bend like
  // every other one rather than a jump out of the still picture.
  $: runTime = time + (DWELL - FIRST);
  $: pos = running
    ? (AT_REST + Math.floor(runTime / STEP_T)) % ORDER.length
    : AT_REST;
  $: bend = running ? ease(ramp(runTime % STEP_T, DWELL, STEP_T)) : 0;
  $: cardA = SERIES[ORDER[pos]];
  $: cardB = SERIES[ORDER[(pos + 1) % ORDER.length]];
  /** The line bends; the label does not, so it changes over at the middle. */
  $: card = bend < 0.5 ? cardA : cardB;
  /** The same wavenumber on two scales, blended: 0 is the floor, 1 the top. */
  const frac = (sr: Series, wn: number) => (sr.f(wn) - sr.lo) / (sr.hi - sr.lo);
  const fracBg = (sr: Series, wn: number) =>
    sr.bg ? (sr.bg(wn) - sr.lo) / (sr.hi - sr.lo) : frac(sr, wn);

  /** A curve from normalised values: 0 at the base, 1 at the top. */
  function plotFrac(
    of: (wn: number) => number, x0: number, x1: number, top: number, base: number,
  ) {
    return 'M' + WN.map(wn => {
      const x = x0 + ((4000 - wn) / 3000) * (x1 - x0);
      return `${x.toFixed(1)},${(base - of(wn) * (base - top)).toFixed(1)}`;
    }).join(' L');
  }

  function plot(
    f: (wn: number) => number,
    x0: number, x1: number, top: number, base: number, lo: number, hi: number,
  ) {
    return 'M' + WN.map(wn => {
      const x = x0 + ((4000 - wn) / 3000) * (x1 - x0);
      const v = (f(wn) - lo) / (hi - lo);
      return `${x.toFixed(1)},${(base - v * (base - top)).toFixed(1)}`;
    }).join(' L');
  }
  const levelY = (v: number, top: number, base: number, lo: number, hi: number) =>
    base - ((v - lo) / (hi - lo)) * (base - top);

  /* ── The small spectrum on the card ── */
  const SF = { x0: 26, x1: 210, top: 14, base: 82 };

  /* ── The opened chain: four stages down, two families across ──────────
   * Every panel is scaled so its own strong band reaches nine tenths of
   * the height. Shapes are therefore directly comparable, which is what
   * makes the Kubelka–Munk panel's short weak band mean something.
   */
  const CX = [70, 280];
  const PW = 170;
  const PH = 42;
  // Pitch 72: the panel and its equation, then air before the next panel.
  const ROWS = [62, 134, 206, 278].map(top => ({ top, base: top + PH }));
  const fit = (f: (wn: number) => number) => f(2900) / 0.9;

  interface Panel {
    row: number; col: number;
    f: (wn: number) => number; lo: number; hi: number;
    /** The dashed line the trace is read from: a flat level or the background. */
    refLevel?: number; refCurve?: (wn: number) => number; refLabel: string;
    /** Drawn thick and grey underneath: the form this one is compared with. */
    over?: { f: (wn: number) => number; lo: number; hi: number };
    eq: string;
  }
  const PANELS: Panel[] = [
    { row: 0, col: 0, f: sigT, lo: 0, hi: MAX_T * 1.06, refCurve: lampT, refLabel: 'I₀', eq: 'I, through the sample' },
    { row: 0, col: 1, f: sigR, lo: 0, hi: MAX_R * 1.06, refCurve: lampR, refLabel: 'I₀', eq: 'I, back from the powder' },
    { row: 1, col: 0, f: trans, lo: 0.74, hi: 1.04, refLevel: 1, refLabel: '1', eq: 'T = I / I₀' },
    { row: 1, col: 1, f: refl, lo: 0.74, hi: 1.04, refLevel: 1, refLabel: '1',
      over: { f: trans, lo: 0.74, hi: 1.04 }, eq: 'R = I / I₀' },
    { row: 2, col: 0, f: absorbance, lo: 0, hi: fit(absorbance), refLevel: 0, refLabel: '0', eq: 'A = −log₁₀ T' },
    { row: 2, col: 1, f: pseudo, lo: 0, hi: fit(pseudo), refLevel: 0, refLabel: '0',
      over: { f: absorbance, lo: 0, hi: fit(absorbance) }, eq: 'log(1/R) = −log₁₀ R' },
    { row: 3, col: 1, f: km, lo: 0, hi: fit(km), refLevel: 0, refLabel: '0',
      over: { f: pseudo, lo: 0, hi: fit(pseudo) }, eq: 'Kubelka–Munk: F(R) = (1−R)²/2R' },
  ];
  // Where the weak band sits in a panel, for the Kubelka–Munk annotation.
  const WEAK = 1650;
  const wx = (col: number) => CX[col] + ((4000 - WEAK) / 3000) * PW;
  const kmRow = ROWS[3];
  const weakKm = levelY(km(WEAK), kmRow.top, kmRow.base, 0, fit(km));
  const weakLog = levelY(pseudo(WEAK), kmRow.top, kmRow.base, 0, fit(pseudo));

  // While the opened diagram plays, the chain assembles downward: every
  // stage reached so far is lit, so the order of the derivation reads.
  $: builtTo = running ? Math.floor(time / 1.1) % 4 : -1;

  /* ── The background sets zero ── */
  const DIFF = (wn: number) => 0.55 * G(wn, 2050, 45) - 0.4 * G(wn, 3650, 70);
  const DR = { x0: 40, x1: 460, zero: 460, amp: 58 };
  const diffPath = 'M' + WN.map(wn => {
    const x = DR.x0 + ((4000 - wn) / 3000) * (DR.x1 - DR.x0);
    return `${x.toFixed(1)},${(DR.zero - DIFF(wn) * DR.amp).toFixed(1)}`;
  }).join(' L');
  const dx = (wn: number) => DR.x0 + ((4000 - wn) / 3000) * (DR.x1 - DR.x0);

  /** The chain's arrow: one stage feeding the next. */
  const down = (x: number, y0: number, y1: number) =>
    `M ${x} ${y0} V ${y1} M ${x - 3} ${y1 - 4} L ${x} ${y1} L ${x + 3} ${y1 - 4}`;

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
  aria-label="The vertical axis of a spectrum: one sample as a raw signal over its background, then as transmittance and reflectance, then as absorbance and log(1/R), which give the same curve, then as Kubelka–Munk, where the weak band all but disappears; below, the background sets zero, so a band gained points up and a band lost points down"
>
  <!-- ── The card: one spectrum, its vertical axis lit, replotted ── -->
  <g style="opacity:{cardOpacity}">
    <line class="axis lit" x1={SF.x0} x2={SF.x0} y1={SF.top - 4} y2={SF.base} />
    <path class="axis-head lit" d="M {SF.x0 - 3} {SF.top} L {SF.x0} {SF.top - 5} L {SF.x0 + 3} {SF.top}" />
    <line class="axis" x1={SF.x0} x2={SF.x1} y1={SF.base} y2={SF.base} />
    {#if cardA.bg || cardB.bg}
      <path
        class="ref"
        style="opacity:{lerp(cardA.bg ? 1 : 0, cardB.bg ? 1 : 0, bend)}"
        d={plotFrac(wn => lerp(fracBg(cardA, wn), fracBg(cardB, wn), bend), SF.x0, SF.x1, SF.top, SF.base)}
      />
    {/if}
    <path
      class="trace"
      d={plotFrac(wn => lerp(frac(cardA, wn), frac(cardB, wn), bend), SF.x0, SF.x1, SF.top, SF.base)}
    />
    <text class="tick lit" x={SF.x0 + 5} y={SF.top + 4}>{card.label}</text>
  </g>

  <!-- ── The opened chain: four stages down, two families across ── -->
  <g style="opacity:{fullOpacity}">
    {#each PANELS as p}
      {@const r = ROWS[p.row]}
      {@const x0 = CX[p.col]}
      <line class="axis lit" x1={x0} x2={x0} y1={r.top - 4} y2={r.base} />
      <line class="axis" x1={x0} x2={x0 + PW} y1={r.base} y2={r.base} />
      <!-- The dashed line is always the reference the trace is read from. -->
      {#if p.refCurve}
        <path class="ref" d={plot(p.refCurve, x0, x0 + PW, r.top, r.base, p.lo, p.hi)} />
      {:else if p.refLevel !== undefined}
        {@const y = levelY(p.refLevel, r.top, r.base, p.lo, p.hi)}
        <line class="ref" x1={x0} x2={x0 + PW} y1={y} y2={y} />
      {/if}
      <!-- Grey and thick underneath: the form this panel is compared with. -->
      {#if p.over}
        <path class="over" d={plot(p.over.f, x0, x0 + PW, r.top, r.base, p.over.lo, p.over.hi)} />
      {/if}
      <path class="trace" class:on={builtTo >= p.row} d={plot(p.f, x0, x0 + PW, r.top, r.base, p.lo, p.hi)} />
      {#if p.row > 0}
        <path class="step" class:on={builtTo >= p.row} d={down(x0 - 12, ROWS[p.row - 1].base + 4, r.top - 4)} />
      {/if}
    {/each}
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">One Sample, Two Families, One Curve</text>
    <text class="lbl strong" x={CX[0]} y="40">Through the Sample</text>
    <text class="lbl strong" x={CX[1]} y="40">Back from a Powder</text>

    {#each PANELS as p}
      {@const r = ROWS[p.row]}
      <text class="lbl" x={CX[p.col] + PW / 2} y={r.base + 14} text-anchor="middle">{p.eq}</text>
      <text class="tick" x={CX[p.col] - 4} y={(p.refCurve
        ? r.top + 8
        : levelY(p.refLevel ?? 0, r.top, r.base, p.lo, p.hi)) + 3} text-anchor="end">{p.refLabel}</text>
    {/each}

    <!-- The transmission family stops at A, and that is where it pays off. -->
    <text class="lbl strong" x={CX[0] + PW / 2} y={ROWS[3].top + 16} text-anchor="middle">A = ε · c · l</text>
    <text class="lbl faint" x={CX[0] + PW / 2} y={ROWS[3].top + 32} text-anchor="middle">∝ amount present</text>

    <!-- The one place the two curves part: the weak band, squared away. -->
    <line class="mark" x1={wx(1)} x2={wx(1)} y1={weakLog} y2={weakKm} />
    <text class="lbl bad" x={CX[1] + PW} y={ROWS[3].base + 28} text-anchor="end">the weak band, squashed</text>

    <text class="lbl faint" x="14" y={ROWS[3].base + 50}>grey: the form beside it, on the same scale</text>
    <text class="lbl faint" x="14" y={ROWS[3].base + 64}>dashed: the reference it is read from</text>
  </g>

  <!-- ── The background sets zero ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis lit" x1={DR.x0} x2={DR.x0} y1={DR.zero - 44} y2={DR.zero + 34} />
    <line class="ref" x1={DR.x0} x2={DR.x1} y1={DR.zero} y2={DR.zero} />
    <path class="trace" d={diffPath} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={DR.zero - 60}>The Background Sets Zero</text>
    <text class="lbl faint" x={DR.x0 + 110} y={DR.zero - 6}>0: as the background</text>
    <text class="lbl gain" x={dx(2050)} y={DR.zero - 40} text-anchor="middle">gained: CO</text>
    <text class="lbl loss" x={dx(3650)} y={DR.zero + 38} text-anchor="middle">lost: OH</text>
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
  /* Dashed, everywhere, means the reference the trace is read from. */
  .ref { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  /* The form a panel is compared with, under its trace. */
  .over { fill: none; stroke: var(--ink-slate-400); stroke-width: 2.6; stroke-linejoin: round; opacity: 0.45; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.3; stroke-linejoin: round; transition: stroke 0.25s; }
  .trace.on { stroke: var(--accent-green-fg); }
  .step { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.25s; }
  .step.on { stroke: var(--accent-green-fg); }
  .mark { stroke: var(--diagram-stokes); stroke-width: 1; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.8), var(--t-diagram-note-size));
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
  .lbl.gain { fill: var(--charge-positive); }
  .lbl.bad { fill: var(--diagram-stokes); }
  .lbl.loss { fill: var(--charge-negative); }
</style>

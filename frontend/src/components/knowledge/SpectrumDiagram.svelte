<script context="module" lang="ts">
  /** One band as the diagram draws it; built from a real atlas band. */
  export interface SpectrumExample {
    id: string;
    label: string;
    /** Centre, cm⁻¹. */
    wn: number;
    /** Full width at half depth, cm⁻¹. */
    fwhm: number;
    /** 0–1: how much of the light at the centre goes missing. */
    depth: number;
  }
</script>

<script lang="ts">
  /**
   * Gap → position: why each vibration leaves a band at its own place.
   *
   *   t = 0  the card: three bare two-level ladders over one detector trace,
   *          each with its dip beneath it. No text, no axes.
   *   t = 1  the opened card: two plots stacked on one wavenumber axis.
   *          Above, the detector signal, with the empty-beam level I₀ and the
   *          transmitted I marked; below, the same measurement as absorbance,
   *          A = log₁₀(I₀/I), the dips turned into peaks. The ladders hang
   *          above, labelled, joined to their bands through both plots.
   *
   * Signal rather than transmittance on purpose: transmittance is the name
   * for I/I₀ in a transmission measurement only, while every technique has a
   * detector signal and an I₀.
   *
   * Every coordinate is a blend of the two frames, so opening the card moves
   * the lines: the absorbance trace peels off the signal trace, drops into
   * its own plot and turns over on the way.
   *
   * Each ladder's gap is drawn to scale with its wavenumber (E = hc·ν̃), so
   * the tallest ladder sits furthest left; that proportion is the lesson.
   *
   * While `playing`, a photon sweeps the axis from long wavelength to short,
   * its wave tightening as it goes. Both traces draw in behind it; as it
   * crosses each band that ladder climbs and the photon is swallowed.
   * Script-driven rather than CSS, because the photon's wavelength has to
   * change continuously with its position.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;
  export let examples: SpectrumExample[] = [];

  const dispatch = createEventDispatcher<{ band: { id: string } }>();

  const WN_HI = 4000;
  const WN_LO = 400;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  /* ── The two frames ─────────────────────────────────────────────────── */

  // Card: 220 × 100 units, drawn a little over 1px per unit.
  //   base   the I₀ line of the one trace; depth: how far a total dip reaches
  const S = { W: 220, H: 100, px: 238 / 220, x0: 12, x1: 208, base: 86, depth: 22, foot: 58, gap: 42, half: 11 };
  // Opened: 480 × 344 at 1 unit = 1px, so labels use the type tokens.
  //   signal plot  sTop … sBot, I₀ at sI0
  //   absorbance   aTop … aBot
  const F = {
    W: 480, H: 344, x0: 52, x1: 466, foot: 106, gap: 66, half: 16,
    sTop: 124, sI0: 132, sBot: 208,
    aTop: 222, aBot: 306,
  };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  const frac = (wn: number) => (WN_HI - wn) / (WN_HI - WN_LO);
  $: X = (wn: number) => lerp(S.x0 + frac(wn) * (S.x1 - S.x0), F.x0 + frac(wn) * (F.x1 - F.x0), t);
  $: foot = lerp(S.foot, F.foot, t);
  $: gapPerWn = lerp(S.gap, F.gap, t) / 3600;
  $: half = lerp(S.half, F.half, t);

  /** I/I₀ at a wavenumber: a Gaussian dip per band. */
  function ratio(wn: number, bands: SpectrumExample[]): number {
    let absorbed = 0;
    for (const b of bands) {
      const s = b.fwhm / 2.355;
      absorbed += b.depth * Math.exp(-((wn - b.wn) ** 2) / (2 * s * s));
    }
    return Math.max(0.02, 1 - absorbed);
  }

  // The absorbance plot is scaled to its tallest peak, with some headroom.
  $: aMax = Math.max(0.1, ...examples.map(b => -Math.log10(Math.max(0.02, 1 - b.depth)))) * 1.15;

  /** Where a point of the signal trace sits, in either frame. */
  $: ySignal = (r: number) =>
    lerp(S.base + (1 - r) * S.depth, F.sBot - r * (F.sBot - F.sI0), t);
  /** The absorbance trace: born on top of the signal trace, then its own plot. */
  $: yAbs = (r: number) =>
    lerp(S.base + (1 - r) * S.depth, F.aBot - (-Math.log10(r) / aMax) * (F.aBot - F.aTop), t);

  /* ── The sweep ──────────────────────────────────────────────────────── */

  const CYCLE = 4600; // ms per sweep, including the pause at the end
  const SWEEP = 0.8; // fraction of the cycle spent moving
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

  $: p = running ? (clock % CYCLE) / CYCLE : 1;
  // Where the photon is, in cm⁻¹; at rest it has passed the whole axis.
  $: scanWn = running ? lerp(WN_LO, WN_HI, Math.min(1, p / SWEEP)) : WN_HI;
  $: sweeping = running && p < SWEEP;

  /** How excited each band's ladder is right now: a bump as the photon passes. */
  $: excite = examples.map(b =>
    sweeping ? Math.exp(-(((scanWn - b.wn) / Math.max(b.fwhm, 160)) ** 2)) : 0,
  );

  /* ── Paths ──────────────────────────────────────────────────────────── */

  // Both traces, drawn in from the right edge up to wherever the photon is.
  function trace(yOf: (r: number) => number, bands: SpectrumExample[], stopWn: number): string {
    const xa = X(WN_HI);
    const xb = X(WN_LO);
    const xStop = X(stopWn);
    const pts: string[] = [];
    for (let px = xb; px >= xa - 0.5; px -= 1) {
      if (px < xStop) break;
      const wn = WN_HI - ((px - xa) / (xb - xa)) * (WN_HI - WN_LO);
      pts.push(`${px.toFixed(1)},${yOf(ratio(wn, bands)).toFixed(1)}`);
    }
    return pts.length > 1 ? 'M' + pts.join(' L') : '';
  }

  $: signalPath = trace(ySignal, examples, scanWn);
  $: absPath = trace(yAbs, examples, scanWn);

  // The photon: a short wave packet whose wavelength tracks 1/ν̃, squashed
  // into a range that stays readable at both ends of the axis. At rest it
  // waits at the long-wavelength end, where the sweep starts, so the card
  // shows there is light before anything moves; during the pause at the end
  // of a sweep it is gone (absorbed or through).
  $: photon = (() => {
    if (running && !sweeping) return null;
    const span = lerp(16, 24, t);
    const restX = X(WN_LO) - span * 0.8;
    const wn = sweeping ? scanWn : WN_LO;
    const cx = sweeping ? Math.min(restX, X(scanWn)) : restX;
    const cy = lerp(S.foot + 12, F.foot + 9, t);
    const period = lerp(3, 4, t) + lerp(9, 12, t) * Math.sqrt(WN_LO / wn);
    const fade = 1 - 0.85 * Math.max(0, ...excite);
    const amp = lerp(3.4, 4, t) * fade;
    const phase = sweeping ? (clock / 90) * 2 * Math.PI : 0;
    const pts: string[] = [];
    for (let dx = -span; dx <= span; dx += 0.75) {
      const env = Math.exp(-((dx / (span * 0.55)) ** 2));
      const y = cy + amp * env * Math.sin((dx / period) * 2 * Math.PI - phase);
      pts.push(`${(cx + dx).toFixed(1)},${y.toFixed(1)}`);
    }
    return { d: 'M' + pts.join(' L'), cx, cy, amp: lerp(3.4, 4, t), fade };
  })();

  $: ladders = examples.map((b, i) => {
    const x = X(b.wn);
    const y0 = foot;
    const y1 = foot - b.wn * gapPerWn;
    const ex = excite[i] ?? 0;
    const r = ratio(b.wn, examples);
    return { ...b, x, y0, y1, ex, dotY: lerp(y0, y1, ex), dipY: ySignal(r), absY: yAbs(r) };
  });

  // I is marked on the deepest dip: that is where the gap to I₀ reads best.
  $: deepest = ladders.reduce<(typeof ladders)[number] | null>(
    (best, l) => (!best || l.dipY > best.dipY ? l : best),
    null,
  );

  const up = (xa: number, ya: number, s: number) =>
    `M${xa - s},${ya + s * 1.5} L${xa},${ya} L${xa + s},${ya + s * 1.5}`;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: absOpacity = ramp(t, 0.05, 0.45);
  const TICKS = [4000, 3000, 2000, 1000];
  const sMid = (F.sTop + F.sBot) / 2;
  const aMid = (F.aTop + F.aBot) / 2;
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Three vibrations with different energy gaps; each absorbs at its own wavenumber, a dip in the detector signal and a peak in absorbance"
>
  <!-- Two plot frames on one wavenumber axis. -->
  <g style="opacity:{fullOpacity}">
    <path class="axis-line" d="M{F.x0 - 6},{F.sTop} V{F.sBot} H{F.x1}" />
    <path class="axis-line" d="M{F.x0 - 6},{F.aTop} V{F.aBot} H{F.x1}" />
    {#each TICKS as wn}
      <line class="axis-line" x1={X(wn)} x2={X(wn)} y1={F.sBot} y2={F.sBot + 3} />
      <line class="axis-line" x1={X(wn)} x2={X(wn)} y1={F.aBot} y2={F.aBot + 4} />
    {/each}
    <!-- The empty-beam level: what the detector would see with nothing in the way. -->
    <line class="i0" x1={F.x0 - 6} x2={F.x1} y1={F.sI0} y2={F.sI0} />
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl ax-title" transform="translate({F.x0 - 30} {sMid}) rotate(-90)" text-anchor="middle">signal</text>
    <text class="lbl ax-title" transform="translate({F.x0 - 30} {aMid}) rotate(-90)" text-anchor="middle">absorbance</text>

    <text class="lbl sym" x={F.x0 - 10} y={F.sI0 + 4} text-anchor="end">I₀</text>
    {#if deepest && (!sweeping || scanWn >= deepest.wn)}
      <line class="i-mark" x1={deepest.x + 5} x2={deepest.x + 14} y1={deepest.dipY} y2={deepest.dipY} />
      <text class="lbl sym" x={deepest.x + 17} y={deepest.dipY + 4}>I</text>
    {/if}
    <text class="lbl faint" x={F.x1} y={F.aTop + 10} text-anchor="end">A = log₁₀(I₀/I)</text>

    {#each TICKS as wn}
      <text class="lbl" x={X(wn)} y={F.aBot + 16} text-anchor="middle">{wn}</text>
    {/each}
    <text class="lbl faint" x={F.x0} y={F.aBot + 32}>← higher energy</text>
    <text class="lbl faint" x={F.x1} y={F.aBot + 32} text-anchor="end">wavenumber (cm⁻¹)</text>
  </g>

  {#each ladders as l (l.id)}
    <!-- One position, three views of it: the gap, the dip, the peak. -->
    <line
      class="link"
      x1={l.x} x2={l.x}
      y1={l.y0 + 3}
      y2={lerp(l.dipY - 2, F.aBot, t)}
      style="opacity:{lerp(0.55, 1, t)}"
    />
  {/each}

  <!-- A faint baseline under each trace, so a half-drawn trace still reads. -->
  <line class="baseline" x1={X(WN_HI)} x2={X(WN_LO)} y1={ySignal(1)} y2={ySignal(1)} />
  <line class="baseline" x1={X(WN_HI)} x2={X(WN_LO)} y1={yAbs(1)} y2={yAbs(1)} style="opacity:{absOpacity}" />
  {#if absPath}<path class="trace" d={absPath} style="opacity:{absOpacity}" />{/if}
  {#if signalPath}<path class="trace" d={signalPath} />{/if}

  {#each ladders as l (l.id)}
    <line class="level" x1={l.x - half} x2={l.x + half} y1={l.y0} y2={l.y0} />
    <line class="level" class:hot={l.ex > 0.35} x1={l.x - half} x2={l.x + half} y1={l.y1} y2={l.y1} />

    <!-- At rest every arrow is drawn; while sweeping, only as the photon hits. -->
    <g style="opacity:{running ? l.ex : 1}">
      <line class="arrow" x1={l.x - half * 0.35} x2={l.x - half * 0.35} y1={l.y0} y2={l.y1 + 1} />
      <path class="arrow-head" d={up(l.x - half * 0.35, l.y1, lerp(2.4, 3.2, t))} />
    </g>

    <circle class="dot" class:filled={l.ex > 0.3} cx={l.x + half * 0.35} cy={l.dotY} r={lerp(2.8, 3.8, t)} />

    <!-- A band name opens that band in the chart. -->
    <g
      class="band-lbl"
      style="opacity:{labelOpacity}; pointer-events:{t > 0.95 ? 'auto' : 'none'}"
      role="button"
      tabindex={t > 0.95 ? 0 : -1}
      aria-label="Open {l.label} in the band chart"
      on:click|stopPropagation={() => dispatch('band', { id: l.id })}
      on:keydown={e => e.key === 'Enter' && dispatch('band', { id: l.id })}
    >
      <text class="lbl name" x={l.x} y={l.y1 - 24} text-anchor="middle">{l.label}</text>
      <text class="lbl faint" x={l.x} y={l.y1 - 11} text-anchor="middle">{Math.round(l.wn)} cm⁻¹</text>
    </g>
  {/each}

  {#if photon}
    <path class="photon" d={photon.d} />
    <!-- Named, as on the vibration card; it dims as the photon is swallowed. -->
    <text class="lbl photon-lbl" x={photon.cx} y={photon.cy - photon.amp - 7} text-anchor="middle" style="opacity:{photon.fade}">hν</text>
  {/if}
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis-line {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1;
  }

  .i0 {
    stroke: var(--line-slate-strong);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .i-mark {
    stroke: var(--ink-slate-500);
    stroke-width: 1;
  }

  .baseline {
    stroke: var(--line-slate);
    stroke-width: 1;
  }

  .trace {
    fill: none;
    stroke: var(--brand-700);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .link {
    stroke: var(--line-slate-strong);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .level {
    stroke: var(--ink-slate-400);
    stroke-width: 1.5;
    stroke-linecap: round;
  }
  .level.hot { stroke: var(--accent-green-fg); }

  .arrow {
    stroke: var(--accent-green-fg);
    stroke-width: 1.6;
  }
  .arrow-head {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Hollow in the ground state, filled while excited: as on the vibration card. */
  .dot {
    fill: var(--surface);
    stroke: var(--brand-700);
    stroke-width: 1.4;
  }
  .dot.filled { fill: var(--brand-700); }

  .photon {
    fill: none;
    stroke: var(--diagram-photon);
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.photon-lbl { fill: var(--diagram-photon); }
  .lbl.sym { font-family: var(--font-sans); font-style: italic; fill: var(--ink-slate-900); }
  .lbl.ax-title { font-family: var(--font-sans); fill: var(--ink-slate-500); }

  .band-lbl { cursor: pointer; outline: none; }
  .band-lbl:hover .name,
  .band-lbl:focus-visible .name { fill: var(--accent-green-fg); text-decoration: underline; }
</style>

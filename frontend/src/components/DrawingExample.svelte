<script lang="ts">
  /**
   * A specimen plate for the style guide: a diagram that is not about
   * anything, drawn and animated exactly the way the Knowledge cards are, so
   * the **Drawing molecules & atoms** section can show the rules rather than
   * only list them.
   *
   * Every rung of the ladder appears once and only once:
   *
   *   construction  the dashed plane, the molecular axis, the rest positions
   *   dimension     the capped line under the bond
   *   structure     the spectrum's baseline
   *   content       the bond and the two atoms
   *   subject       the band, the one saturated thing on the plate
   *
   * It is deliberately a single viewBox rather than the card/opened pair a
   * real diagram carries: what it demonstrates is the ink, not the two
   * layouts, and those have a section of their own.
   *
   * CO stretching, with the carbon moving further than the oxygen because it
   * is the lighter of the two (the amplitudes go as the other atom's mass,
   * 16 : 12), which is the same rule the mode drawings follow.
   */
  import { onDestroy, onMount } from 'svelte';
  import { colorForElement } from '../lib/elementColors';

  const W = 340;
  const H = 172;

  /* ── The molecule ── */
  const CY = 70;
  const C_X = 70;
  const O_X = 122;
  const A = 9;
  const M_C = 16 / 28; // the carbon swings further: it is the lighter atom
  const M_O = 12 / 28;
  const R_C = 5.4;
  const R_O = 5.2;
  const C_FILL = colorForElement('C');
  const O_FILL = colorForElement('O');

  /* ── The band ── */
  const SP = { x0: 196, x1: 330, cx: 252, base: 48, d: 44, w: 9 };
  const band = (() => {
    const pts: string[] = [];
    for (let x = SP.x0; x <= SP.x1; x += 0.6) {
      const y = SP.d * Math.exp(-(((x - SP.cx) / SP.w) ** 2));
      pts.push(`${x.toFixed(1)},${(SP.base + y).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();

  /* ── Clock. Runs only while the plate is on screen and only where motion
        is wanted: a specimen is not worth a frame the reader cannot see. ── */
  let el: SVGSVGElement;
  let phase = 0.55;
  let raf = 0;
  let started = 0;
  let visible = false;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function frame(now: number) {
    if (!started) started = now;
    phase = Math.sin(2 * Math.PI * 0.55 * ((now - started) / 1000));
    raf = requestAnimationFrame(frame);
  }
  $: if (visible && !reduced && !raf) {
    started = 0;
    raf = requestAnimationFrame(frame);
  } else if ((!visible || reduced) && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  let io: IntersectionObserver | null = null;
  onMount(() => {
    if (typeof IntersectionObserver === 'undefined') {
      visible = true;
      return;
    }
    io = new IntersectionObserver(es => (visible = es[0]?.isIntersecting ?? false));
    io.observe(el);
  });
  onDestroy(() => {
    io?.disconnect();
    if (raf) cancelAnimationFrame(raf);
  });

  $: s = A * phase;
  $: cx = C_X - M_C * s;
  $: ox = O_X + M_O * s;

  /* The dimension spans the full travel, not the current bond: a dimension
     line states an extent, so it does not move with what it measures. */
  const D0 = C_X - M_C * A;
  const D1 = O_X + M_O * A;
  const DIM_Y = 112;
</script>

<svg
  bind:this={el}
  class="plate"
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A specimen diagram: a carbon monoxide molecule stretching inside a dashed plane, with a dimension line under it, beside an absorption band hanging from its baseline"
>
  <!-- construction: the plane the motion happens in, and the axis it runs along -->
  <rect class="plane" x="40" y="44" width="110" height="52" rx="2" />
  <line class="guide" x1="34" y1={CY} x2="156" y2={CY} />

  <!-- construction: where the atoms sit at rest, to measure the motion against -->
  <circle class="rest" cx={C_X} cy={CY} r={R_C} />
  <circle class="rest" cx={O_X} cy={CY} r={R_O} />

  <!-- content: the molecule itself -->
  <line class="bond" x1={cx} y1={CY} x2={ox} y2={CY} />
  <circle class="atom" cx={cx} cy={CY} r={R_C} fill={C_FILL} />
  <circle class="atom" cx={ox} cy={CY} r={R_O} fill={O_FILL} />

  <!-- dimension: how far the stretch runs, capped at both ends -->
  <line class="dim" x1={D0} y1={DIM_Y} x2={D1} y2={DIM_Y} />
  <line class="dim" x1={D0} y1={DIM_Y - 4} x2={D0} y2={DIM_Y + 4} />
  <line class="dim" x1={D1} y1={DIM_Y - 4} x2={D1} y2={DIM_Y + 4} />

  <!-- structure: the baseline a band is read against -->
  <line class="axis-line" x1={SP.x0} y1={SP.base} x2={SP.x1} y2={SP.base} />
  <line class="guide" x1={SP.cx} y1={SP.base} x2={SP.cx} y2={SP.base + SP.d + 14} />
  <!-- subject: the one saturated thing on the plate -->
  <path class="trace" d={band} />

  <text class="lbl name" x="12" y="18">Specimen Plate</text>
  <text class="lbl faint" x="40" y="38">plane</text>
  <text class="lbl faint" x="158" y={CY + 4}>axis</text>
  <text class="lbl strong" x={(D0 + D1) / 2} y={DIM_Y - 8} text-anchor="middle">Δr</text>
  <text class="lbl faint" x={SP.x1} y="40" text-anchor="end">wavenumber</text>
  <text class="lbl" x={SP.cx} y={SP.base + SP.d + 26} text-anchor="middle">ν(CO)</text>
  <text class="lbl faint" x="12" y="160">one band of weights, six inks, nothing shaded</text>
</svg>

<style>
  .plate {
    display: block;
    width: 100%;
    max-width: 340px;
    height: auto;
    overflow: visible;
  }

  /* The ladder, faintest first. Every stroke is between 0.6 and 2px: what
     ranks them is the ink, not the width. */
  .plane,
  .guide { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 3; }
  .rest { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 2 2; }
  .dim { stroke: var(--ink-050); stroke-width: 1; }
  .axis-line { stroke: var(--line-slate-strong); stroke-width: 1; }
  .bond { stroke: var(--ink-slate-400); stroke-width: 2; }
  .atom { stroke: var(--ink-slate-400); stroke-width: 0.6; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.3; stroke-linejoin: round; }

  /* One family, one size, four fills. */
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong { fill: var(--ink-slate-900); }
  .lbl.name { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }
</style>

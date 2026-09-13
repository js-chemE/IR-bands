<script lang="ts">
  /**
   * The Lambert–Beer law: why absorbance and not transmittance is the
   * quantity a band height is read in.
   *
   *   t = 0  the card: a beam through one cell, the cell filling and
   *          emptying while playing, the beam that leaves dimming with it.
   *   t = 1  the opened card: four cells of rising concentration with the
   *          light that survives each, then the two plots that follow,
   *          T against c curving away and A against c a straight line.
   *          A third panel makes the same point with path length: slices
   *          of one sample, each taking the same fraction of what reaches
   *          it, so transmittance multiplies and absorbance adds.
   *
   * The numbers are schematic: ε c l = 0.25 per step, so T goes
   * 1, 0.56, 0.32, 0.18 and A goes 0, 0.25, 0.50, 0.75.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 424 };

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

  /** One step of concentration takes this much absorbance. */
  const STEP = 0.25;
  const A_MAX = 3 * STEP;
  const transOf = (a: number) => Math.pow(10, -a);

  /* ── The card: one cell, filling and emptying ── */
  const C = { x: 92, y: 38, w: 44, h: 42 };
  // 0 → 1 → 0, so the cell fills and clears rather than jumping back.
  $: fill = running ? (1 - Math.cos((time / 1.6) * Math.PI)) / 2 : 0.6;
  $: cardA = fill * A_MAX;

  /* ── The opened card ── */
  const CELLS = [0, 1, 2, 3];
  const CELL = { x0: 52, dx: 96, y: 56, w: 56, h: 48 };
  const cellA = (i: number) => i * STEP;

  // The two plots, side by side under the cells.
  const P = { y0: 174, h: 96, w: 150 };
  const PT = { x: 52 };
  const PA = { x: 280 };
  const px = (x: number, i: number) => x + (i / 3) * P.w;
  const pyT = (v: number) => P.y0 + P.h - v * P.h;
  const pyA = (v: number) => P.y0 + P.h - (v / A_MAX) * P.h;
  const pathOf = (x: number, f: (i: number) => number) =>
    'M' + CELLS.map(i => `${px(x, i).toFixed(1)},${f(i).toFixed(1)}`).join(' L');

  /* ── The third panel: slices of one sample ── */
  const SLICE = { x: 52, y: 336, w: 46, h: 40, n: 3 };
  const sliceMid = SLICE.y + SLICE.h / 2;

  // While playing, the cells light one after another.
  $: litCell = running ? Math.floor(time / 1.1) % 4 : -1;

  const arrow = (x1: number, y: number, x2: number) =>
    `M ${x1} ${y} L ${x2} ${y} M ${x2 - 4.5} ${y - 3} L ${x2} ${y} L ${x2 - 4.5} ${y + 3}`;

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
  aria-label="Cells of rising concentration dim the beam that leaves: transmittance falls away as a curve while absorbance rises as a straight line, and slicing one sample shows why, since each slice takes the same fraction of what reaches it"
>
  <!-- ── The card: one cell, filling ── -->
  <g style="opacity:{cardOpacity}">
    <path class="beam" d={arrow(24, C.y + C.h / 2, C.x - 3)} />
    <rect class="cell" x={C.x} y={C.y} width={C.w} height={C.h} rx="2" />
    <rect class="fill" x={C.x} y={C.y} width={C.w} height={C.h} rx="2" style="opacity:{0.12 + fill * 0.6}" />
    <path class="beam out" d={arrow(C.x + C.w + 3, C.y + C.h / 2, 196)}
      style="opacity:{transOf(cardA)}" />
    <text class="lbl sym" x="20" y={C.y + C.h / 2 - 7}>I₀</text>
    <text class="lbl sym" x="184" y={C.y + C.h / 2 - 7} text-anchor="end">I</text>
  </g>

  <!-- ── The opened card: four cells ── -->
  <g style="opacity:{fullOpacity}">
    {#each CELLS as i}
      {@const x = CELL.x0 + i * CELL.dx}
      {@const mid = CELL.y + CELL.h / 2}
      <rect class="cell" x={x} y={CELL.y} width={CELL.w} height={CELL.h} rx="2" />
      <rect class="fill" class:lit={litCell === i} x={x} y={CELL.y} width={CELL.w} height={CELL.h} rx="2"
        style="opacity:{0.1 + (i / 3) * 0.62}" />
      <!-- What goes in is what came out of the cell before it. -->
      <path class="beam" class:lit={litCell === i} d={arrow(x - 30, mid, x - 3)}
        style="opacity:{i === 0 ? 1 : transOf(cellA(i - 1))}" />
      {#if i === 3}
        <path class="beam" d={arrow(x + CELL.w + 3, mid, x + CELL.w + 26)} style="opacity:{transOf(cellA(3))}" />
      {/if}
    {/each}
  </g>

  <!-- ── The two plots ── -->
  <g style="opacity:{fullOpacity}">
    {#each [PT, PA] as p}
      <line class="axis" x1={p.x} x2={p.x} y1={P.y0 - 6} y2={P.y0 + P.h} />
      <line class="axis" x1={p.x} x2={p.x + P.w} y1={P.y0 + P.h} y2={P.y0 + P.h} />
    {/each}
    <path class="curve" d={pathOf(PT.x, i => pyT(transOf(cellA(i))))} />
    <path class="curve straight" d={pathOf(PA.x, i => pyA(cellA(i)))} />
    {#each CELLS as i}
      <circle class="dot" class:lit={litCell === i} cx={px(PT.x, i)} cy={pyT(transOf(cellA(i)))} r="3" />
      <circle class="dot straight" class:lit={litCell === i} cx={px(PA.x, i)} cy={pyA(cellA(i))} r="3" />
    {/each}
  </g>

  <!-- ── Slices of one sample: why the logarithm ──
       One sample with two cuts through it, not three cells: the point is
       that the beam meets the same absorber over and over. -->
  <g style="opacity:{fullOpacity}">
    <rect class="fill" x={SLICE.x} y={SLICE.y} width={SLICE.w * 3} height={SLICE.h} rx="2" style="opacity:0.3" />
    <rect class="cell" x={SLICE.x} y={SLICE.y} width={SLICE.w * 3} height={SLICE.h} rx="2" />
    {#each [1, 2] as k}
      <line class="divide" x1={SLICE.x + k * SLICE.w} x2={SLICE.x + k * SLICE.w} y1={SLICE.y} y2={SLICE.y + SLICE.h} />
    {/each}
    <path class="beam" d={arrow(SLICE.x - 30, sliceMid, SLICE.x - 3)} />
    <path class="beam" d={arrow(SLICE.x + SLICE.w * 3 + 3, sliceMid, SLICE.x + SLICE.w * 3 + 30)}
      style="opacity:{Math.max(0.3, Math.pow(0.56, 3))}" />
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="18">More Absorber, Less Light</text>
    <text class="lbl faint" x="14" y="36">One cell after another, each holding the same amount again.</text>

    {#each CELLS as i}
      {@const x = CELL.x0 + i * CELL.dx}
      <text class="tick" x={x + CELL.w / 2} y={CELL.y + CELL.h + 14} text-anchor="middle">c = {i}</text>
      <text class="tick" x={x + CELL.w / 2} y={CELL.y + CELL.h + 26} text-anchor="middle">T = {transOf(cellA(i)).toFixed(2)}</text>
      <text class="tick abs" x={x + CELL.w / 2} y={CELL.y + CELL.h + 38} text-anchor="middle">A = {cellA(i).toFixed(2)}</text>
    {/each}

    <text class="lbl strong" x={PT.x} y={P.y0 - 14}>transmittance: a curve</text>
    <text class="lbl strong abs" x={PA.x} y={P.y0 - 14}>absorbance: a straight line</text>
    <text class="tick" x={PT.x - 6} y={P.y0 + 4} text-anchor="end">1</text>
    <text class="tick" x={PT.x - 6} y={P.y0 + P.h + 4} text-anchor="end">0</text>
    <text class="tick" x={PA.x - 6} y={P.y0 + 4} text-anchor="end">{A_MAX.toFixed(2)}</text>
    <text class="tick" x={PA.x - 6} y={P.y0 + P.h + 4} text-anchor="end">0</text>
    {#each [PT, PA] as p}
      <text class="tick faint" x={p.x + P.w} y={P.y0 + P.h + 16} text-anchor="end">concentration →</text>
    {/each}

    <text class="lbl name" x="14" y={SLICE.y - 30}>Why a Logarithm</text>
    <text class="lbl faint" x="14" y={SLICE.y - 14}>Each slice takes the same fraction of what reaches it.</text>
    {#each [0, 1, 2] as k}
      {@const x = SLICE.x + k * SLICE.w}
      <text class="tick" x={x + SLICE.w / 2} y={SLICE.y + SLICE.h + 14} text-anchor="middle">×0.56</text>
    {/each}
    <text class="lbl" x={SLICE.x + 3 * SLICE.w + 26} y={SLICE.y + 16}>T multiplies</text>
    <text class="lbl abs" x={SLICE.x + 3 * SLICE.w + 26} y={SLICE.y + 32}>A adds up</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .cell {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1;
  }
  .divide { stroke: var(--surface); stroke-width: 1.4; opacity: 0.9; }
  .fill { fill: var(--brand-700); transition: opacity 0.25s; }
  .fill.lit { fill: var(--accent-green-fg); }

  .beam {
    fill: none;
    stroke: var(--diagram-photon);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .beam.lit { stroke: var(--accent-green-fg); }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .curve { fill: none; stroke: var(--brand-700); stroke-width: 1.5; stroke-linejoin: round; }
  .curve.straight { stroke: var(--diagram-photon); }
  .dot { fill: var(--surface); stroke: var(--brand-700); stroke-width: 1.4; }
  .dot.straight { stroke: var(--diagram-photon); }
  .dot.lit { fill: var(--accent-green-fg); stroke: var(--accent-green-fg); }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.8), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
  .tick.abs { fill: var(--diagram-photon); }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name, .lbl.strong { fill: var(--ink-slate-900); }
  .lbl.abs { fill: var(--diagram-photon); }
  .lbl.sym { font-family: var(--font-sans); font-style: italic; fill: var(--ink-slate-900); }
</style>

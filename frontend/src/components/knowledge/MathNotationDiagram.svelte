<script lang="ts">
  /**
   * Slanted or upright: the one thing a reader has to know to read a formula
   * on this page, and the one rule an author has to follow to write one.
   *
   *   t = 0  the card: one expression, ν̃(CO₂) = 2349 cm⁻¹, its slanted and
   *          upright parts already distinguishable.
   *   t = 1  the opened card: what it is, how it is set and why, a row per
   *          kind; then the same expression set wrongly, with everything
   *          italic, for contrast.
   *
   * Nothing here moves, and the card is listed in STATIC_CARD/STATIC_OPEN in
   * KnowledgePage so it does not promise a hover it cannot keep.
   *
   * The glyphs are drawn as SVG text rather than typeset by KaTeX, because a
   * diagram is an image: the formula boxes in the prose beside it are the
   * real KaTeX (components/knowledge/FormulaLine).
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 356 };

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

  /**
   * A run of characters in one style. `sub` and `sup` shift the baseline;
   * `kind` is what the run is, which is what decides italic or upright.
   */
  type Kind = 'quantity' | 'index' | 'label' | 'unit' | 'chem' | 'plain';
  interface Run { s: string; kind: Kind; sub?: boolean; sup?: boolean }

  const ITALIC: Kind[] = ['quantity', 'index'];
  const isItalic = (k: Kind) => ITALIC.includes(k);

  /** Baseline offsets, resolved into the relative dy each tspan needs. */
  function laid(runs: Run[]) {
    let prev = 0;
    return runs.map(r => {
      const off = r.sub ? 3.4 : r.sup ? -4.6 : 0;
      const dy = off - prev;
      prev = off;
      return { ...r, dy, small: !!(r.sub || r.sup) };
    });
  }

  // The card's expression: a quantity, a substance, a number and a unit.
  const EXAMPLE: Run[] = [
    { s: 'ν̃', kind: 'quantity' },
    { s: '(', kind: 'plain' },
    { s: 'CO', kind: 'chem' },
    { s: '2', kind: 'chem', sub: true },
    { s: ')', kind: 'plain' },
    { s: ' = 2349 ', kind: 'plain' },
    { s: 'cm', kind: 'unit' },
    { s: '−1', kind: 'unit', sup: true },
  ];
  // Everything italic: the mistake the rule exists to stop.
  const WRONG: Run[] = EXAMPLE.map(r => ({ ...r, kind: r.kind === 'plain' ? 'plain' : 'quantity' }));

  interface Row { what: string; runs: Run[]; why: string }
  const ROWS: Row[] = [
    {
      what: 'a quantity',
      runs: [{ s: 'E', kind: 'quantity' }, { s: ', ', kind: 'plain' }, { s: 'ν', kind: 'quantity' },
        { s: ', ', kind: 'plain' }, { s: 'α', kind: 'quantity' }],
      why: 'it has a value',
    },
    {
      what: 'a running index',
      runs: [{ s: 'm', kind: 'quantity' }, { s: 'i', kind: 'index', sub: true }],
      why: 'the i counts atoms',
    },
    {
      what: 'a naming index',
      runs: [{ s: 'μ', kind: 'quantity' }, { s: 'ind', kind: 'label', sub: true }],
      why: 'ind is a word',
    },
    {
      what: 'a unit',
      runs: [{ s: '2349 ', kind: 'plain' }, { s: 'cm', kind: 'unit' }, { s: '−1', kind: 'unit', sup: true }],
      why: 'a name, not a value',
    },
    {
      what: 'a substance',
      runs: [{ s: 'CO', kind: 'chem' }, { s: '2', kind: 'chem', sub: true }],
      why: 'C and O are elements',
    },
    {
      what: 'an operator',
      runs: [{ s: 'log', kind: 'unit' }, { s: ' T', kind: 'quantity' }],
      why: 'log is a name too',
    },
  ];

  const COL = { what: 14, set: 150, tex: 268 };
  const ROW_Y = ROWS.map((_, i) => 76 + i * 34);

  // While the card plays, the slanted part and the upright parts take turns.
  $: litKind = running ? (Math.floor(time / 1.4) % 2 === 0 ? 'slanted' : 'upright') : null;
  $: isLit = (k: Kind) =>
    litKind === null ? false : litKind === 'slanted' ? isItalic(k) : k === 'unit' || k === 'chem';

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
  aria-label="Slanted or upright: a quantity and a running index are italic, a naming index, a unit and a chemical formula are upright"
>
  <!-- ── The card: one expression, its two kinds of part lit in turn ── -->
  <g style="opacity:{cardOpacity}">
    <text class="expr" x="110" y="48" text-anchor="middle">
      {#each laid(EXAMPLE) as r}<tspan
        class="run {r.kind}" class:it={isItalic(r.kind)} class:lit={isLit(r.kind)}
        dy={r.dy} font-size={r.small ? '0.68em' : '1em'}>{r.s}</tspan>{/each}
    </text>
    <text class="cap" x="110" y="74" text-anchor="middle">italic = a quantity · upright = a name</text>
  </g>

  <!-- ── The opened card: the rule, row by row ── -->
  <g style="opacity:{fullOpacity}">
    {#each ROW_Y as y}
      <line class="rule" x1={COL.what} x2={F.W - 14} y1={y + 10} y2={y + 10} />
    {/each}
    <line class="rule strong" x1={COL.what} x2={F.W - 14} y1={ROW_Y[5] + 28} y2={ROW_Y[5] + 28} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x={COL.what} y="18">Slanted or Upright</text>
    <text class="lbl faint" x={COL.what} y="36">What is slanted carries meaning, so it is not a matter of taste.</text>

    <text class="lbl head" x={COL.what} y="58">what it is</text>
    <text class="lbl head" x={COL.set} y="58">set as</text>
    <text class="lbl head" x={COL.tex} y="58">why</text>

    {#each ROWS as row, i}
      <text class="lbl" x={COL.what} y={ROW_Y[i]}>{row.what}</text>
      <text class="expr small" x={COL.set} y={ROW_Y[i]}>
        {#each laid(row.runs) as r}<tspan
          class="run {r.kind}" class:it={isItalic(r.kind)}
          dy={r.dy} font-size={r.small ? '0.68em' : '1em'}>{r.s}</tspan>{/each}
      </text>
      <text class="lbl faint" x={COL.tex} y={ROW_Y[i]}>{row.why}</text>
    {/each}

    <!-- The same expression with everything slanted: the usual mistake. -->
    <text class="lbl bad" x={COL.what} y={ROW_Y[5] + 48}>never</text>
    <text class="expr small" x={COL.set} y={ROW_Y[5] + 48}>
      {#each laid(WRONG) as r}<tspan
        class="run wrong" class:it={isItalic(r.kind)}
        dy={r.dy} font-size={r.small ? '0.68em' : '1em'}>{r.s}</tspan>{/each}
    </text>
    <text class="lbl faint" x={COL.set} y={ROW_Y[5] + 68}>a slanted CO₂ reads as C times O times two</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .rule { stroke: var(--line-slate); stroke-width: 1; }
  .rule.strong { stroke: var(--line-slate-strong); }

  /* A serif face, as mathematics is set; the slant is the whole point. */
  .expr {
    font-family: var(--font-serif);
    font-size: 22px;
    fill: var(--ink-slate-900);
  }
  .expr.small { font-size: 17px; }
  .run { font-style: normal; transition: fill 0.25s; }
  .run.it { font-style: italic; }
  .run.unit, .run.chem, .run.label { fill: var(--ink-slate-500); }
  .run.lit { fill: var(--accent-green-fg); }
  .run.wrong { fill: var(--diagram-stokes); font-style: italic; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.head {
    fill: var(--ink-050);
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .lbl.bad { fill: var(--diagram-stokes); }
  .cap {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.9), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
</style>

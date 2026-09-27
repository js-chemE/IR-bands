<script lang="ts">
  /**
   * Mulliken symmetry: a mode is labelled by what the point group's
   * operations do to it. Carry out an operation on a vibrating molecule and
   * compare the displacement arrows with where they were: unchanged is +1,
   * reversed is −1. That number is the character, and the row of them is the
   * label.
   *
   *   t = 0  the card: H₂O's symmetric stretch ν₁ and asymmetric stretch ν₃,
   *          each with its arrows, turned by the C₂ axis. The ghost is where
   *          the arrows were. ν₁ comes back the same (+1, an A mode); ν₃
   *          comes back reversed (−1, a B mode).
   *   t = 1  the opened card, two rows:
   *            H₂O carries out E, C₂, σᵥ(xz) and σᵥ′(yz) on ν₃ and then on
   *              ν₁, and each result lights its cell in the C₂ᵥ character
   *              table beside it, with the column that says whether the row
   *              absorbs (x, y, z) or scatters (the squares);
   *            CO₂ under inversion: ν₁ comes back the same (g), ν₃ reversed
   *              (u), which is where the g and u of Σ(g)⁺ and Σ(u)⁺ come from.
   *
   * The table follows Mulliken's convention for a planar C₂ᵥ molecule, in
   * the yz plane: σᵥ(xz) is the mirror across the molecule, σᵥ′(yz) the
   * molecule's own plane, and the in-plane asymmetric stretch is B₂.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';
  import {
    arrowHead,
    identity,
    invert,
    mirrorX,
    mirrorZ,
    project,
    turnY,
    type SymOp,
    type V3,
  } from './view3d';
  import SvgSubbed from './SvgSubbed.svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));
  const ease = (k: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, k)))) / 2;

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 330 };

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
   * One operation per step: carried out, held while the result is read,
   * then undone, so nothing ever jumps back.
   */
  const STEP = 2.6;
  const there = (f: number) => (f < 0.72 ? ease(f / 0.36) : 1 - ease((f - 0.72) / 0.26));
  $: step = Math.floor(time / STEP);
  $: f = (time % STEP) / STEP;
  $: s = running ? there(f) : 0;
  // The result is shown once the operation has arrived.
  $: settled = running && f > 0.36 && f < 0.72;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: cardOpacity = 1 - ramp(t, 0.05, 0.4);

  /* ── Molecules with a mode on them: atoms, bonds, one arrow per atom ── */
  type Atom = { el: string; p: V3; r: number; v: V3 };
  interface Mode {
    atoms: Atom[];
    bonds: [number, number][];
  }
  const R: Record<string, number> = { C: 5.4, O: 5.2, H: 3.8 };
  const unit = (v: V3, len: number): V3 => {
    const n = Math.hypot(...v) || 1;
    return [(v[0] / n) * len, (v[1] / n) * len, (v[2] / n) * len];
  };
  const minus = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

  // H₂O in the page: O above, the two H below. The arrows follow the O–H
  // bonds; O moves a little to keep the centre of mass still.
  const O: V3 = [0, 6, 0];
  const HL: V3 = [-12, -5, 0];
  const HR: V3 = [12, -5, 0];
  const W_BONDS: [number, number][] = [[0, 1], [0, 2]];
  const NU1: Mode = {
    atoms: [
      { el: 'O', p: O, r: R.O, v: [0, 3, 0] },
      { el: 'H', p: HL, r: R.H, v: unit(minus(HL, O), 9) },
      { el: 'H', p: HR, r: R.H, v: unit(minus(HR, O), 9) },
    ],
    bonds: W_BONDS,
  };
  const NU3: Mode = {
    atoms: [
      { el: 'O', p: O, r: R.O, v: [3, 0, 0] },
      { el: 'H', p: HL, r: R.H, v: unit(minus(HL, O), 9) },
      { el: 'H', p: HR, r: R.H, v: unit(minus(O, HR), 9) },
    ],
    bonds: W_BONDS,
  };
  // CO₂ along x: ν₁ the two O out together, ν₃ both O one way and C the other.
  const CO2_BONDS: [number, number][] = [[0, 1], [1, 2]];
  const CO2_NU1: Mode = {
    atoms: [
      { el: 'O', p: [-19, 0, 0], r: R.O, v: [-8, 0, 0] },
      { el: 'C', p: [0, 0, 0], r: R.C, v: [0, 0, 0] },
      { el: 'O', p: [19, 0, 0], r: R.O, v: [8, 0, 0] },
    ],
    bonds: CO2_BONDS,
  };
  const CO2_NU3: Mode = {
    atoms: [
      { el: 'O', p: [-19, 0, 0], r: R.O, v: [7, 0, 0] },
      { el: 'C', p: [0, 0, 0], r: R.C, v: [-9, 0, 0] },
      { el: 'O', p: [19, 0, 0], r: R.O, v: [7, 0, 0] },
    ],
    bonds: CO2_BONDS,
  };

  /** A mode after an operation carried s of the way: positions and arrows both. */
  function draw(m: Mode, op: SymOp, s: number) {
    const pts = m.atoms.map((a, i) => {
      const p = op(a.p, s);
      const v = op(a.v, s);
      const pr = project(p);
      const tip = project([p[0] + v[0], p[1] + v[1], p[2] + v[2]]);
      const len = Math.hypot(...v);
      return { i, x: pr.x, y: pr.y, z: pr.z, r: a.r * pr.f, el: a.el, tx: tip.x, ty: tip.y, len };
    });
    return {
      bonds: m.bonds.map(([a, b]) => ({ x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y })),
      atoms: [...pts].sort((a, b) => a.z - b.z),
      arrows: pts.filter(p => p.len > 0.5),
    };
  }
  /** The arrows as they were, for the ghost the result is compared with. */
  const ghost = (m: Mode) => draw(m, identity, 0).arrows;

  const C2_AXIS = (() => {
    const a = project([0, -18, 0]);
    const b = project([0, 20, 0]);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  })();

  /* ── The card: both stretches turned by C₂ ── */
  $: cardNu1 = draw(NU1, turnY(2), running && t < 0.5 ? s : 0);
  $: cardNu3 = draw(NU3, turnY(2), running && t < 0.5 ? s : 0);

  /* ── Opened: the character table, filled by the molecule ── */
  const OPS: { label: string; op: SymOp }[] = [
    { label: 'E', op: identity },
    { label: 'C₂', op: turnY(2) },
    { label: 'σᵥ(xz)', op: mirrorX },
    { label: 'σᵥ′(yz)', op: mirrorZ },
  ];
  const ROWS = [
    { label: 'A₁', chi: [1, 1, 1, 1], modes: 'ν₁, ν₂' },
    { label: 'A₂', chi: [1, 1, -1, -1], modes: '' },
    { label: 'B₁', chi: [1, -1, 1, -1], modes: '' },
    { label: 'B₂', chi: [1, -1, -1, 1], modes: 'ν₃' },
  ];
  // ν₃ first: it is the one whose row is not all +1.
  const SEQUENCE = [
    { mode: NU3, name: 'ν₃', row: 3 },
    { mode: NU1, name: 'ν₁', row: 0 },
  ];
  $: seqIndex = running ? Math.floor(step / OPS.length) % SEQUENCE.length : 0;
  $: opIndex = running ? step % OPS.length : -1;
  $: current = SEQUENCE[seqIndex];
  $: fullMode = draw(current.mode, running && opIndex >= 0 ? OPS[opIndex].op : identity, running && t > 0.5 ? s : 0);
  $: fullGhost = ghost(current.mode);

  // The table's frame: a label column, one per operation, then H₂O's
  // modes. What each row absorbs or scatters is in the card's own table.
  const TX = 170;
  const COLS = [
    { x: TX, w: 32 },
    ...OPS.map((_, i) => ({ x: TX + 32 + i * 56, w: 56 })),
    { x: TX + 256, w: 50 },
  ];
  const TW = 306;
  const TY = 58;
  const RH = 20;
  const colMid = (c: number) => COLS[c].x + COLS[c].w / 2;
  const cellY = (r: number) => TY + RH * (r + 1) + 14;

  /** What the reader has already seen of the current mode's row. */
  $: shown = (r: number, c: number) =>
    r === current.row && running && (c < opIndex || (c === opIndex && settled));

  /* ── Opened, second row: CO₂ under inversion ── */
  $: coNu1 = draw(CO2_NU1, invert, running && t > 0.5 ? s : 0);
  $: coNu3 = draw(CO2_NU3, invert, running && t > 0.5 ? s : 0);

  /* ── Placement, closed to opened ── */
  $: nu1At = { x: 52, y: 44, k: 1.45 };
  $: nu3At = { x: lerp(158, 70, t), y: lerp(44, 110, t), k: lerp(1.45, 1.9, t) };
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Water's symmetric and asymmetric stretches turned about the two-fold axis: the first comes back unchanged, an A mode, the second reversed, a B mode; opened, the C2v character table filled in by the molecule, and CO2 under inversion giving g and u"
>
  <!-- ── The card: ν₁ beside ν₃, both turned by C₂ ── -->
  <g style="opacity:{cardOpacity}">
    <g transform="translate({nu1At.x} {nu1At.y}) scale({nu1At.k})">
      <line class="axis" class:on={running} {...C2_AXIS} />
      {#each ghost(NU1) as a}
        <line class="ghost" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} />
      {/each}
      {#each cardNu1.bonds as b}<line class="bond" {...b} />{/each}
      {#each cardNu1.atoms as a (a.i)}<circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={colorForElement(a.el)} />{/each}
      {#each cardNu1.arrows as a}
        <line class="arrow" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} /><path class="arrow" d={arrowHead(a.x, a.y, a.tx, a.ty, 2.4)} />
      {/each}
    </g>
    <text class="lbl strong" x={nu1At.x} y="90" text-anchor="middle">ν₁ <tspan class:lit={settled}>A</tspan><tspan class="sub" dy="3">1</tspan></text>
    <text class="lbl chi" class:shown={settled} x={nu1At.x + 30} y="20">+1</text>
  </g>

  <g transform="translate({nu3At.x} {nu3At.y}) scale({nu3At.k})">
    <line class="axis" class:on={running && (t < 0.5 || opIndex === 1)} {...C2_AXIS} />
    {#each t < 0.5 ? ghost(NU3) : fullGhost as a}
      <line class="ghost" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} />
    {/each}
    {#each (t < 0.5 ? cardNu3 : fullMode).bonds as b}<line class="bond" {...b} />{/each}
    {#each (t < 0.5 ? cardNu3 : fullMode).atoms as a (a.i)}<circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={colorForElement(a.el)} />{/each}
    {#each (t < 0.5 ? cardNu3 : fullMode).arrows as a}
      <line class="arrow" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} /><path class="arrow" d={arrowHead(a.x, a.y, a.tx, a.ty, 2.4)} />
    {/each}
  </g>
  <g style="opacity:{cardOpacity}">
    <text class="lbl strong" x="158" y="90" text-anchor="middle">ν₃ <tspan class:lit={settled}>B</tspan><tspan class="sub" dy="3">2</tspan></text>
    <text class="lbl chi" class:shown={settled} x="188" y="20">−1</text>
    <text class="lbl faint" x="105" y="14" text-anchor="middle">C₂</text>
  </g>

  <!-- ── Opened, row 1: the character table ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Reading a Character off a Mode: H₂O in <SvgSubbed text="C(2v)" /></text>
    <text class="lbl" x="14" y="170">{current.name}{#if running && opIndex >= 0}, under {OPS[opIndex].label}{/if}</text>
    <text class="lbl faint" x="14" y="186">dashed: before; arrows: after</text>
  </g>
  <g style="opacity:{fullOpacity}">
    <!-- The header, then a rule under it; the table is ruled, not boxed. -->
    {#each ['', ...OPS.map(o => o.label), 'H₂O'] as h, c}
      <text class="th" class:lit={c - 1 === opIndex} x={colMid(c)} y={TY + 14} text-anchor="middle">{h}</text>
    {/each}
    <line class="rule" x1={TX} x2={TX + TW} y1={TY + RH} y2={TY + RH} />
    <line class="rule faint" x1={COLS[1].x} x2={COLS[1].x} y1={TY} y2={TY + RH * 5} />
    <line class="rule faint" x1={COLS[5].x} x2={COLS[5].x} y1={TY} y2={TY + RH * 5} />
    {#if running && opIndex >= 0}
      <rect class="colhi" x={COLS[opIndex + 1].x + 2} y={TY + 2} width={COLS[opIndex + 1].w - 4} height={RH * 5 - 4} rx="3" />
    {/if}
    <rect class="rowhi" x={TX} y={TY + RH * (current.row + 1) + 1} width={TW} height={RH - 2} rx="3" />
    {#each ROWS as row, r}
      <text class="td strong" x={colMid(0)} y={cellY(r)} text-anchor="middle">{row.label}</text>
      {#each row.chi as chi, c}
        <text
          class="td"
          class:lit={shown(r, c + 1)}
          class:neg={chi < 0}
          x={colMid(c + 1)}
          y={cellY(r)}
          text-anchor="middle">{chi > 0 ? '1' : '−1'}</text>
      {/each}
      <text class="td strong" x={colMid(5)} y={cellY(r)} text-anchor="middle">{row.modes}</text>
    {/each}
  </g>

  <!-- ── Opened, row 2: CO₂ under inversion, g and u ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="218">Inversion Sets g and u: CO₂ in <SvgSubbed text="D(∞h)" /></text>
  </g>
  <g style="opacity:{fullOpacity}">
    {#each [{ d: coNu1, g: ghost(CO2_NU1), x: 120 }, { d: coNu3, g: ghost(CO2_NU3), x: 360 }] as m}
      <g transform="translate({m.x} 262) scale(1.5)">
        <circle class="centre" cx="0" cy="0" r="1.4" />
        {#each m.g as a}<line class="ghost" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} />{/each}
        {#each m.d.bonds as b}<line class="bond" {...b} />{/each}
        {#each m.d.atoms as a (a.i)}<circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={colorForElement(a.el)} />{/each}
        {#each m.d.arrows as a}
          <line class="arrow" x1={a.x} y1={a.y} x2={a.tx} y2={a.ty} /><path class="arrow" d={arrowHead(a.x, a.y, a.tx, a.ty, 2.4)} />
        {/each}
      </g>
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl strong" x="120" y="300" text-anchor="middle">ν₁ <SvgSubbed text="Σ(g)⁺" />: <tspan class:lit={settled}>χ(i) = +1</tspan></text>
    <text class="lbl faint" x="120" y="316" text-anchor="middle">gerade, even: Raman only</text>
    <text class="lbl strong" x="360" y="300" text-anchor="middle">ν₃ <SvgSubbed text="Σ(u)⁺" />: <tspan class:lit={settled}>χ(i) = −1</tspan></text>
    <text class="lbl faint" x="360" y="316" text-anchor="middle">ungerade, odd: IR only</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis {
    stroke: var(--ink-025);
    stroke-width: 1;
    stroke-dasharray: 3 2;
    vector-effect: non-scaling-stroke;
  }
  .axis.on { stroke: var(--brand-700); stroke-width: 1.3; stroke-dasharray: none; }
  .centre { fill: var(--brand-700); }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .atom { stroke: var(--ink-slate-400); stroke-width: 0.6; vector-effect: non-scaling-stroke; }
  /* The mode's arrows are the subject; where they were is construction. */
  .arrow {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .ghost {
    stroke: var(--ink-050);
    stroke-width: 1;
    stroke-dasharray: 2 2;
    vector-effect: non-scaling-stroke;
  }

  .rule { stroke: var(--line-slate-strong); stroke-width: 1; }
  .rule.faint { stroke: var(--line-faint); }
  .colhi { fill: var(--brand-tint); }
  .rowhi { fill: none; stroke: var(--brand-tint-line); stroke-width: 1; }

  .lbl, .th, .td {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name, .th, .td.strong { fill: var(--ink-slate-900); }
  .td.off { fill: var(--ink-050); }
  .td.neg { fill: var(--ink-slate-500); }
  .lit, .td.lit { fill: var(--brand-700); font-weight: var(--t-label-weight); }
  .chi { opacity: 0; transition: opacity 0.2s; fill: var(--brand-700); font-weight: var(--t-label-weight); }
  .chi.shown { opacity: 1; }
  .sub { font-size: 0.75em; }
</style>

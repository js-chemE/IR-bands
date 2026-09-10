<script lang="ts">
  /**
   * The induced dipole: a field makes one where there was none.
   *
   * The electron cloud is drawn as a density, not a ball that moves: in a
   * field it stays where it is but grows denser on the side the electrons
   * are pushed to, and the nuclei shift slightly the other way. δ− marks the
   * dense side, δ+ the thin one, and μ(ind) runs from − to +.
   *
   *   t = 0  the card: a light wave runs slowly across N₂. Its field,
   *          perpendicular to the way it travels, polarizes the cloud up and
   *          down, and μ(ind) follows it.
   *   t = 1  the opened card:
   *            switch a field on: N₂ with no field (no dipole) beside one in
   *              a field that slowly grows and fades; μ(ind) grows with E and
   *              is gone when E is;
   *            in light: the card's N₂, its dipole swinging with the wave,
   *              and rings of scattered light spreading from it, because an
   *              oscillating dipole radiates;
   *            any field will do: an ion beside N₂ pulls its electrons towards
   *              itself, a neighbour's permanent dipole pushes them away from
   *              its δ− end. Steady sources, so these do not swing.
   *
   * How easily the cloud gives, α, is the Polarizability card's subject.
   * μ(ind) is displayed with a subscript; see lib/notation.ts.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  // Gradient ids must be unique in the document; every instance gets its own.
  const uid = `ind${Math.random().toString(36).slice(2, 8)}`;

  // The card's N₂ becomes the opened card's second row.
  const S = { W: 220, H: 100, px: 238 / 220, mx: 110, my: 52, bond: 20, rN: 4.8, rx: 30, ry: 16, waveX0: 8, waveX1: 212, amp: 15, lambda: 80 };
  const F = { W: 480, H: 392, mx: 120, my: 206, bond: 24, rN: 5.8, rx: 34, ry: 16, waveX0: 14, waveX1: 226, amp: 18, lambda: 96 };

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

  // Slow enough to watch the charge move: one swing of the light in two
  // seconds; the switched field grows and fades over four.
  const NU_L = 0.5;
  const NU_SWITCH = 0.25;
  $: time = running ? clock / 1000 : 0;

  /* ── The light wave, and the field it puts at the molecule ── */
  $: cx = lerp(S.mx, F.mx, t);
  $: cy = lerp(S.my, F.my, t);
  $: amp = lerp(S.amp, F.amp, t);
  $: lambda = lerp(S.lambda, F.lambda, t);
  $: wx0 = lerp(S.waveX0, F.waveX0, t);
  $: wx1 = lerp(S.waveX1, F.waveX1, t);
  // A wave travelling to the right, phased so that at rest the field at the
  // molecule is at its peak.
  const field = (x: number, lam: number, mx: number, tt: number) =>
    Math.cos(2 * Math.PI * ((x - mx) / lam - NU_L * tt));
  $: wavePath = (() => {
    const pts: string[] = [];
    for (let x = wx0; x <= wx1; x += 1) {
      pts.push(`${x.toFixed(1)},${(cy - amp * field(x, lambda, cx, time)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();
  $: e = field(cx, lambda, cx, time); // positive: pointing up

  /** Densest point of a cloud, as a fraction of its box: against the field. */
  const focus = (pol: number) => 0.5 + 0.44 * Math.max(-1, Math.min(1, pol));
  const sign = (pol: number, side: 'field' | 'against') =>
    (pol > 0) === (side === 'field') ? 'δ+' : 'δ−';
  const signCls = (pol: number, side: 'field' | 'against') =>
    sign(pol, side) === 'δ+' ? 'pos' : 'neg';
  const signOpacity = (pol: number) => Math.min(1, Math.abs(pol) * 1.6);

  const vHead = (x: number, y: number, dir: number, sz = 4) =>
    `M${x - sz * 0.75},${y + dir * sz} L${x},${y} L${x + sz * 0.75},${y + dir * sz}`;

  /* ── Row 1: no field, and a field switched on ── */
  const R1 = { y: 64, off: 100, on: 270, bond: 24, rx: 30, ry: 14 };
  // At rest the field is fully on; playing, it grows and fades.
  $: f = running ? (1 - Math.cos(2 * Math.PI * NU_SWITCH * time)) / 2 : 1;

  /* ── Row 2: rings of scattered light, one set per swing ── */
  $: rings = [0, 1, 2].map(k => {
    const phase = ((running ? time * NU_L : 0.35) + k / 3) % 1;
    return { r: F.rx + 6 + phase * 64, opacity: 0.55 * (1 - phase) };
  });

  /* ── Row 3: other sources of a field (steady, so drawn still) ── */
  const R3 = { y: 336, ion: 52, n2a: 122, co: 286, n2b: 374, bond: 22, rx: 28, ry: 13 };

  const N_FILL = colorForElement('N');
  const C_FILL = colorForElement('C');
  const O_FILL = colorForElement('O');

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="An electric field pulls N₂'s electron cloud off-centre: denser on one side (δ−), thinner on the other (δ+), an induced dipole that grows with the field and is gone without it. In light the dipole swings with the wave and radiates scattered light."
>
  <!-- Beside the ion the electrons crowd towards it (left); beside CO's δ−
       end they are pushed away from it (right). -->
  <defs>
    {#each [
      { id: 'off', fy: 0.5 },
      { id: 'on', fy: focus(f) },
      { id: 'n2', fy: focus(0.9 * e) },
      { id: 'byIon', fx: 0.5 - 0.4, fy: 0.5 },
      { id: 'byDipole', fx: 0.5 + 0.3, fy: 0.5 },
    ] as g (g.id)}
      <radialGradient id="{uid}-{g.id}" cx="0.5" cy="0.5" r="0.62" fx={g.fx ?? 0.5} fy={g.fy}>
        <stop offset="0" class="dense" />
        <stop offset="0.45" class="mid" />
        <stop offset="1" class="thin" />
      </radialGradient>
    {/each}
  </defs>

  <!-- ── Row 1 (opened): no field, then a field switched on ── -->
  <g style="opacity:{fullOpacity}">
    {#each [R1.off, R1.on] as x, i}
      {@const shift = i ? -1.8 * f : 0}
      <ellipse class="cloud" cx={x} cy={R1.y} rx={R1.rx} ry={R1.ry} fill="url(#{uid}-{i ? 'on' : 'off'})" />
      {#each [-2.2, 0, 2.2] as o}
        <line class="bond" x1={x - R1.bond / 2} x2={x + R1.bond / 2} y1={R1.y + o + shift} y2={R1.y + o + shift} />
      {/each}
      <circle cx={x - R1.bond / 2} cy={R1.y + shift} r="5.4" fill={N_FILL} />
      <circle cx={x + R1.bond / 2} cy={R1.y + shift} r="5.4" fill={N_FILL} />
    {/each}
    {#if f > 0.06}
      <line class="field" x1={R1.on - R1.rx - 14} x2={R1.on - R1.rx - 14} y1={R1.y + 16 * f} y2={R1.y - 16 * f} />
      <path class="field-head" d={vHead(R1.on - R1.rx - 14, R1.y - 16 * f, 1)} />
      <line class="induced" x1={R1.on + R1.rx + 14} x2={R1.on + R1.rx + 14} y1={R1.y + 12 * f} y2={R1.y - 12 * f} />
      <path class="induced-head" d={vHead(R1.on + R1.rx + 14, R1.y - 12 * f, 1, 3.5)} />
    {/if}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Switch a field on</text>
    <text class="lbl faint" x={R1.off} y={R1.y + 36} text-anchor="middle">no field: μ = 0</text>
    <text class="lbl faint" x={R1.on} y={R1.y + 36} text-anchor="middle">in a field: a dipole</text>
    <text class="charge pos" x={R1.on} y={R1.y - R1.ry - 4} text-anchor="middle" style="opacity:{signOpacity(f)}">δ+</text>
    <text class="charge neg" x={R1.on} y={R1.y + R1.ry + 12} text-anchor="middle" style="opacity:{signOpacity(f)}">δ−</text>
    <text class="sym field-lbl" x={R1.on - R1.rx - 22} y={R1.y + 4} text-anchor="end">E</text>
    <text class="sym ind-lbl" x={R1.on + R1.rx + 21} y={R1.y + 4}>μ<tspan class="sub" dy="4">ind</tspan></text>
    <text class="lbl strong" x="380" y={R1.y - 8}>μ<tspan class="sub" dy="4">ind</tspan><tspan dy="-4"> ∝ E</tspan></text>
    <text class="lbl faint" x="380" y={R1.y + 10}>gone when</text>
    <text class="lbl faint" x="380" y={R1.y + 24}>E is gone</text>
  </g>

  <!-- ── Row 2: in light. The card's N₂ lands here. ── -->
  <g style="opacity:{fullOpacity}">
    {#each rings as ring, k (k)}
      <circle class="ring" cx={F.mx} cy={F.my} r={ring.r} style="opacity:{ring.opacity}" />
    {/each}
  </g>
  <path class="wave" d={wavePath} />
  <ellipse class="cloud" cx={cx} cy={cy} rx={lerp(S.rx, F.rx, t)} ry={lerp(S.ry, F.ry, t)} fill="url(#{uid}-n2)" />
  {#each [-lerp(1.8, 2.2, t), 0, lerp(1.8, 2.2, t)] as o}
    <line class="bond" x1={cx - lerp(S.bond, F.bond, t) / 2} x2={cx + lerp(S.bond, F.bond, t) / 2} y1={cy + o - 1.8 * 0.9 * e} y2={cy + o - 1.8 * 0.9 * e} />
  {/each}
  <circle cx={cx - lerp(S.bond, F.bond, t) / 2} cy={cy - 1.8 * 0.9 * e} r={lerp(S.rN, F.rN, t)} fill={N_FILL} />
  <circle cx={cx + lerp(S.bond, F.bond, t) / 2} cy={cy - 1.8 * 0.9 * e} r={lerp(S.rN, F.rN, t)} fill={N_FILL} />
  <text class="charge {signCls(e, 'field')}" x={cx} y={cy - lerp(S.ry, F.ry, t) - 4} text-anchor="middle" style="opacity:{signOpacity(0.9 * e)}">{sign(e, 'field')}</text>
  <text class="charge {signCls(e, 'against')}" x={cx} y={cy + lerp(S.ry, F.ry, t) + 12} text-anchor="middle" style="opacity:{signOpacity(0.9 * e)}">{sign(e, 'against')}</text>
  {#if Math.abs(e) > 0.08}
    {@const x = cx - lerp(S.rx, F.rx, t) - lerp(12, 14, t)}
    <line class="field" x1={x} x2={x} y1={cy + 14 * e} y2={cy - 14 * e} />
    <path class="field-head" d={vHead(x, cy - 14 * e, Math.sign(e))} />
    {@const ax = cx + lerp(S.rx, F.rx, t) + lerp(14, 16, t)}
    <line class="induced" x1={ax} x2={ax} y1={cy + 13 * e} y2={cy - 13 * e} />
    <path class="induced-head" d={vHead(ax, cy - 13 * e, Math.sign(e))} />
  {/if}
  <text class="sym field-lbl" x={cx - lerp(S.rx, F.rx, t) - lerp(20, 22, t)} y={cy + 4} text-anchor="end">E</text>
  <text class="sym ind-lbl" x={cx + lerp(S.rx, F.rx, t) + lerp(21, 23, t)} y={cy + 4}>μ<tspan class="sub" dy="4">ind</tspan></text>

  <!-- ── Row 3 (opened): any field will do ── -->
  <g style="opacity:{fullOpacity}">
    <!-- An ion, or a charged site on a surface. -->
    <circle class="ion" cx={R3.ion} cy={R3.y} r="11" />
    <ellipse class="cloud" cx={R3.n2a} cy={R3.y} rx={R3.rx} ry={R3.ry} fill="url(#{uid}-byIon)" />
    {#each [-2, 0, 2] as o}
      <line class="bond" x1={R3.n2a - R3.bond / 2 + 1.6} x2={R3.n2a + R3.bond / 2 + 1.6} y1={R3.y + o} y2={R3.y + o} />
    {/each}
    <circle cx={R3.n2a - R3.bond / 2 + 1.6} cy={R3.y} r="5" fill={N_FILL} />
    <circle cx={R3.n2a + R3.bond / 2 + 1.6} cy={R3.y} r="5" fill={N_FILL} />
    <line class="induced" x1={R3.n2a - 12} x2={R3.n2a + 11} y1={R3.y + 22} y2={R3.y + 22} />
    <path class="induced-head" d="M{R3.n2a + 8},{R3.y + 19} L{R3.n2a + 12},{R3.y + 22} L{R3.n2a + 8},{R3.y + 25}" />

    <!-- A neighbour's permanent dipole: CO, its δ− oxygen facing N₂. -->
    {#each [-1.5, 0, 1.5] as o}
      <line class="bond" x1={R3.co - 14} x2={R3.co + 14} y1={R3.y + o} y2={R3.y + o} />
    {/each}
    <circle cx={R3.co - 14} cy={R3.y} r="6.2" fill={C_FILL} />
    <circle cx={R3.co + 14} cy={R3.y} r="5.8" fill={O_FILL} />
    <line class="mu" x1={R3.co + 13} x2={R3.co - 12} y1={R3.y + 22} y2={R3.y + 22} />
    <path class="mu-head" d="M{R3.co - 9},{R3.y + 19} L{R3.co - 13},{R3.y + 22} L{R3.co - 9},{R3.y + 25}" />
    <ellipse class="cloud" cx={R3.n2b} cy={R3.y} rx={R3.rx} ry={R3.ry} fill="url(#{uid}-byDipole)" />
    {#each [-2, 0, 2] as o}
      <line class="bond" x1={R3.n2b - R3.bond / 2 - 1.4} x2={R3.n2b + R3.bond / 2 - 1.4} y1={R3.y + o} y2={R3.y + o} />
    {/each}
    <circle cx={R3.n2b - R3.bond / 2 - 1.4} cy={R3.y} r="5" fill={N_FILL} />
    <circle cx={R3.n2b + R3.bond / 2 - 1.4} cy={R3.y} r="5" fill={N_FILL} />
    <line class="induced" x1={R3.n2b + 11} x2={R3.n2b - 10} y1={R3.y + 22} y2={R3.y + 22} />
    <path class="induced-head" d="M{R3.n2b - 7},{R3.y + 19} L{R3.n2b - 11},{R3.y + 22} L{R3.n2b - 7},{R3.y + 25}" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="290">Any field will do</text>
    <text class="ion-lbl" x={R3.ion} y={R3.y + 4} text-anchor="middle">M⁺</text>
    <text class="charge neg" x={R3.n2a - R3.rx - 3} y={R3.y - 12} text-anchor="middle">δ−</text>
    <text class="charge pos" x={R3.n2a + R3.rx + 3} y={R3.y - 12} text-anchor="middle">δ+</text>
    <text class="lbl faint" x={(R3.ion + R3.n2a) / 2} y={R3.y + 46} text-anchor="middle">an ion or charged site</text>

    <text class="charge pos" x={R3.co - 14} y={R3.y - 12} text-anchor="middle">δ+</text>
    <text class="charge neg" x={R3.co + 14} y={R3.y - 12} text-anchor="middle">δ−</text>
    <text class="charge pos" x={R3.n2b - R3.rx - 3} y={R3.y - 12} text-anchor="middle">δ+</text>
    <text class="charge neg" x={R3.n2b + R3.rx + 3} y={R3.y - 12} text-anchor="middle">δ−</text>
    <text class="lbl faint" x={(R3.co + R3.n2b) / 2} y={R3.y + 46} text-anchor="middle">a neighbour’s permanent dipole</text>
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="124">In light</text>
    <text class="lbl strong" x="300" y={F.my - 8}>it swings with the light</text>
    <text class="lbl faint" x="300" y={F.my + 10}>and radiates: the</text>
    <text class="lbl faint" x="300" y={F.my + 24}>molecule scatters it</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .wave { fill: none; stroke: var(--diagram-laser); stroke-width: 1.2; stroke-opacity: 0.35; }
  .ring { fill: none; stroke: var(--diagram-laser); stroke-width: 1.2; stroke-dasharray: 4 3; }

  /* The electron density, as on the Polarizability card. */
  .dense { stop-color: var(--diagram-laser); stop-opacity: 0.85; }
  .mid { stop-color: var(--diagram-laser); stop-opacity: 0.3; }
  .thin { stop-color: var(--diagram-laser); stop-opacity: 0.02; }
  .cloud { stroke: var(--diagram-laser); stroke-opacity: 0.45; stroke-width: 1; stroke-dasharray: 3 2; }
  .bond { stroke: var(--ink-slate-400); stroke-width: 1.1; }
  .ion { fill: var(--surface); stroke: var(--charge-positive); stroke-width: 1.4; }
  .ion-lbl {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--charge-positive);
  }
  .mu, .mu-head { stroke: var(--diagram-photon); stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }

  .field, .field-head { stroke: var(--diagram-laser); stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .induced, .induced-head { stroke: var(--brand-700); stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }

  /* The Dipole card's δ labels: same face and weight, red negative, blue positive. */
  .charge {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
  }
  .charge.neg { fill: var(--charge-negative); }
  .charge.pos { fill: var(--charge-positive); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.strong { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }

  .sym {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-style: italic;
    fill: var(--ink-slate-500);
  }
  .sym.field-lbl { fill: var(--diagram-laser); }
  .sym.ind-lbl { fill: var(--brand-700); }
  .sub { font-size: 0.75em; font-style: normal; }
</style>

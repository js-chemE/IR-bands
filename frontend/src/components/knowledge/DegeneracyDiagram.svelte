<script lang="ts">
  /**
   * Degeneracy: two modes at one frequency, and the one band they share.
   *
   *   t = 0  the card: one CO₂ seen slightly from the front, bending, with a
   *          faded twin sitting exactly on top of it bending the other way,
   *          out of the paper instead of in it. Two modes in one silhouette,
   *          one band beside them.
   *   t = 1  the opened card as a drawn plate: the twin has come out from
   *          behind the first and taken a row of its own, each molecule
   *          inside the plane it bends in and tied to the other by an equals
   *          sign; the band beside them, pulled apart into the two equal
   *          contributions it is made of and put back together, over a small
   *          table of the count.
   *
   * **Opening is one continuous move, not two drawings.** Every position is
   * lerped by `t`, so the card's faded twin IS the plate's second molecule:
   * it separates out of the first as the card opens, which is the claim the
   * card makes. Nothing is swapped in or out; the plate's furniture (the
   * planes, the dimensions, the equals, the table) only fades up over
   * drawing that was already there.
   *
   * Drawn to the page's rules, which are the Normal Modes, Rotation Modes,
   * Where the Radiation Goes and Vibration Modes cards': one narrow band of
   * line weights, and the hierarchy carried by how saturated a line or a
   * label is rather than by how thick it is. Construction lines are the
   * palest thing on the plate and a bond is the darkest; the labels are the
   * same family at the same size throughout, separated only by fill.
   *
   * The two components are driven by ONE sine and never come out of step,
   * because nothing here lowers the symmetry. What a real loss of symmetry
   * does to them is the card's prose.
   */
  export let t = 0;
  export let playing = false;

  import { onDestroy } from 'svelte';
  import { project, type V3 } from './view3d';
  import { colorForElement } from '../../lib/elementColors';
  import Axes3D from './Axes3D.svelte';

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 300 };
  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  /** The card's two words go before the plate's furniture arrives. */
  $: cardIn = 1 - ramp(t, 0.06, 0.4);
  /** Planes, dimensions, the equals, the table: added to the drawing rather
      than substituted for it, so they come up once the rows have parted. */
  $: plateIn = ramp(t, 0.45, 0.92);
  $: labelOpacity = ramp(t, 0.7, 1);

  /* ── Clock, the shape every card on this page uses ── */
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

  $: secs = running ? clock / 1000 : 0;
  /** The bend: fast, and one sine for both components. */
  $: u = running ? Math.sin(2 * Math.PI * 1.05 * secs) : 0.6;
  /**
   * How far the band's two contributions are drawn apart: slow, and back to
   * nothing every cycle. They are separated to be counted, not split.
   */
  $: reveal = running ? (1 - Math.cos(2 * Math.PI * 0.2 * secs)) / 2 : 0;

  /* ── The molecule ──────────────────────────────────────────────────
   * Atom radii and the bond weight are MiniMolecule's, so a CO₂ here is the
   * size a CO₂ is anywhere else on the page. A long focal length: enough
   * perspective for the bend that leaves the paper to read, not enough to
   * make the drawing swell.
   *
   * The tilt is the one number that matters. Seen from nearly the side, a
   * bend out of the paper projects to a third of the one in it and the pair
   * stops looking equal, which is the whole claim. At 34° the two excursions
   * come out within a fifth of each other, one straight up the page and one
   * down to the left, so they read as the same motion turned by 90°.
   */
  const VIEW_D = { yaw: -26, tilt: 34, dist: 240 };
  const R_O = 5.2;
  const R_C = 5.4;
  const RECOIL = 0.6;
  const PULSE = 0.32;
  const C_FILL = colorForElement('C');
  const O_FILL = colorForElement('O');

  /**
   * CO₂ bending along `n`, projected and depth-sorted. The oxygens swing
   * together and the carbon recoils the other way at 0.6 of their amplitude
   * (lib/moleculeGeometry.ts), so every atom moves and the middle one least.
   *
   * The phase is an argument rather than `u` read from the closure: Svelte
   * works out a reactive statement's dependencies from the call site.
   */
  function molecule(cx: number, cy: number, n: V3, amp: number, half: number, ph: number) {
    const atom = (x: number, w: number, fill: string, r: number) => {
      const p = project([x, w * amp * ph * n[1], w * amp * ph * n[2]], VIEW_D);
      // Coming out of the paper is drawn as a size pulse as well as a
      // displacement (lib/moleculeGeometry.ts). Perspective alone gives four
      // per cent at this focal length, which nobody sees; this is what makes
      // the second row read as the first one turned rather than merely
      // leaning. The weight w is +1 on an oxygen and −0.6 on the carbon, so
      // the pair swells while the middle atom shrinks, as the mode does it.
      const pulse = 1 + PULSE * w * ph * n[2];
      return { x: cx + p.x, y: cy + p.y, r: r * p.f * pulse, z: p.z, fill };
    };
    const atoms = [
      atom(-half, 1, O_FILL, R_O),
      atom(0, -RECOIL, C_FILL, R_C),
      atom(half, 1, O_FILL, R_O),
    ];
    return { atoms, sorted: [...atoms].sort((a, b) => a.z - b.z) };
  }

  const at = (cx: number, cy: number, v: V3) => {
    const p = project(v, VIEW_D);
    return { x: cx + p.x, y: cy + p.y };
  };

  /** The rectangle a bend sweeps: the molecular axis, and the way it bends. */
  const planeOf = (cx: number, cy: number, n: V3, half: number, h: number) =>
    ([[-1, 1], [1, 1], [1, -1], [-1, -1]] as [number, number][])
      .map(([sx, sy]) => at(cx, cy, [sx * half, sy * h * n[1], sy * h * n[2]]))
      .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');

  const IN_PLANE: V3 = [0, 1, 0];
  const OUT_OF_PLANE: V3 = [0, 0, 1];

  /* ── One geometry, lerped ──────────────────────────────────────────
   * Card values on the left of every lerp, plate values on the right. The
   * two rows start at the SAME centre, which is what makes the twin behind
   * the first molecule and the second row of the plate one object rather
   * than two drawings that happen to follow each other.
   */
  const CARD = { cx: 56, cy: 46, half: 20, amp: 4.5, h: 9, dim: 14 };
  const PLATE = { cx: 128, cy0: 100, cy1: 232, half: 42, amp: 13, h: 23, dim: 26 };

  $: geo = {
    cx: lerp(CARD.cx, PLATE.cx, t),
    half: lerp(CARD.half, PLATE.half, t),
    amp: lerp(CARD.amp, PLATE.amp, t),
    h: lerp(CARD.h, PLATE.h, t),
    dim: lerp(CARD.dim, PLATE.dim, t),
  };

  const ROWS = [
    { key: 'in', n: IN_PLANE, name: 'δ(OCO)', where: 'in the plane', from: CARD.cy, to: PLATE.cy0, ty: 52 },
    { key: 'out', n: OUT_OF_PLANE, name: 'ω(OCO)', where: 'out of the plane', from: CARD.cy, to: PLATE.cy1, ty: 184 },
  ];
  $: rows = ROWS.map(r => {
    const cy = lerp(r.from, r.to, t);
    return {
      ...r,
      cy,
      mol: molecule(geo.cx, cy, r.n, geo.amp, geo.half, u),
      plane: planeOf(geo.cx, cy, r.n, geo.half + 10, geo.h),
      a0: at(geo.cx, cy, [-geo.half - 18, 0, 0]),
      a1: at(geo.cx, cy, [geo.half + 18, 0, 0]),
      // A dimension line clear of the plane: how far the bend runs.
      d0: at(geo.cx, cy, [geo.half + geo.dim, geo.h * r.n[1], geo.h * r.n[2]]),
      d1: at(geo.cx, cy, [geo.half + geo.dim, -geo.h * r.n[1], -geo.h * r.n[2]]),
      // The cap sits square to the line it ends, whichever way that runs.
      cap: r.n === IN_PLANE ? ([4, 0] as const) : ([3.2, 2.4] as const),
    };
  });
  /** Behind the first until it has somewhere of its own to be. */
  $: twinOpacity = lerp(0.28, 1, ramp(t, 0.15, 0.7));

  /* ── The band ──────────────────────────────────────────────────────
   * Two equal contributions. Lying on top of each other they sum to one band
   * of twice the depth, so the drawing makes the card's claim rather than
   * asserting it. An absorption: baseline on top and the band hanging from
   * it, as on the Overtone and Combination cards.
   */
  type Peak = { x: number; d: number; w: number };
  function trace(peaks: Peak[], x0: number, x1: number, base: number): string {
    const pts: string[] = [];
    const step = (x1 - x0) / 220;
    for (let x = x0; x <= x1; x += step) {
      let y = 0;
      for (const p of peaks) y += p.d * Math.exp(-(((x - p.x) / p.w) ** 2));
      pts.push(`${x.toFixed(1)},${(base + y).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  const SP_CARD = { x0: 118, x1: 208, cx: 160, base: 24, d: 19, w: 4.2 };
  const SP_PLATE = { x0: 272, x1: 466, cx: 369, base: 52, d: 40, w: 11 };
  const SPREAD = 26;

  $: sp = {
    x0: lerp(SP_CARD.x0, SP_PLATE.x0, t),
    x1: lerp(SP_CARD.x1, SP_PLATE.x1, t),
    cx: lerp(SP_CARD.cx, SP_PLATE.cx, t),
    base: lerp(SP_CARD.base, SP_PLATE.base, t),
    d: lerp(SP_CARD.d, SP_PLATE.d, t),
    w: lerp(SP_CARD.w, SP_PLATE.w, t),
  };
  /** Only the plate is wide enough to take the band apart: at card size the
      two contributions resolve into two peaks, which is the opposite of what
      the card says. */
  $: sep = SPREAD * reveal * ramp(t, 0.6, 1);
  /**
   * So the card animates the other half of the same fact. The second
   * contribution fades in and out, and the band breathes between the depth
   * of one mode and the depth of two without ever splitting: the intensity
   * belongs to the pair. By the time the plate has opened it is always
   * there, and the separation does the work instead.
   */
  $: second = lerp(reveal, 1, ramp(t, 0.3, 0.75));
  $: peaks = [
    { x: sp.cx - sep, d: sp.d, w: sp.w },
    { x: sp.cx + sep, d: sp.d * second, w: sp.w },
  ];
  /** Each contribution alone, so the band is visibly their sum. Drawn only
      on the plate: at card size two dashed curves inside one band is clutter,
      and the band moving is the point there. */
  $: parts = peaks.map(p => trace([p], sp.x0, sp.x1, sp.base));
  $: partsIn = ramp(sep, 6, 14) * ramp(t, 0.6, 1);

  /* The count, as a small table with hairline rules: the Normal Modes card's
     way of stating a bookkeeping fact under the drawing that shows it. */
  const TABLE: [string, string][] = [
    ['modes', '2'],
    ['frequencies', '1'],
    ['bands seen', '1'],
  ];
  const TABLE_Y = 200;
  const TABLE_STEP = 22;
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Two bending modes of CO₂ at one frequency, one in the plane of the paper and one out of it, and the single band the two of them share"
>
  <!-- ══ Left: the two components, one coming out from behind the other ══ -->
  {#each rows as r (r.key)}
    <g style="opacity:{r.key === 'out' ? twinOpacity : 1}">
      <g style="opacity:{plateIn}">
        <polygon class="plane" points={r.plane} />
        <!-- The axes the two bends are told apart by, drawn the way the
             Rotation Modes card draws them and lit on the one this row
             swings along: the molecule lies on x, so one bend runs along y
             and the other along z, and that is the whole difference between
             them. Opened only: at card size they would crowd the molecule. -->
        {#if t > 0.5}
          <!-- Through the molecule's own centre, the way the Rotation Modes
               card places them, so the lit axis lies along the drawn plane
               and along the way the oxygens actually swing. Beside the
               molecule the correspondence would have to be taken on trust.
               The axis is read off `n` rather than named, so it cannot drift
               from the motion and the plane, which are built from the same
               vector. -->
          <Axes3D
            x={geo.cx}
            y={r.cy}
            len={lerp(14, 30, t)}
            active={r.n[2] ? 'z' : r.n[1] ? 'y' : 'x'}
          />
        {/if}
      </g>
      <line class="guide" x1={r.a0.x} y1={r.a0.y} x2={r.a1.x} y2={r.a1.y} />
      <line class="bond" x1={r.mol.atoms[0].x} y1={r.mol.atoms[0].y} x2={r.mol.atoms[1].x} y2={r.mol.atoms[1].y} />
      <line class="bond" x1={r.mol.atoms[1].x} y1={r.mol.atoms[1].y} x2={r.mol.atoms[2].x} y2={r.mol.atoms[2].y} />
      {#each r.mol.sorted as a}
        <circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={a.fill} />
      {/each}
      <g style="opacity:{plateIn}">
        <line class="dim" x1={r.d0.x} y1={r.d0.y} x2={r.d1.x} y2={r.d1.y} />
        <line class="dim" x1={r.d0.x - r.cap[0]} y1={r.d0.y - r.cap[1]} x2={r.d0.x + r.cap[0]} y2={r.d0.y + r.cap[1]} />
        <line class="dim" x1={r.d1.x - r.cap[0]} y1={r.d1.y - r.cap[1]} x2={r.d1.x + r.cap[0]} y2={r.d1.y + r.cap[1]} />
      </g>
    </g>
  {/each}

  <!-- ══ Right: the band, as an absorption ══ -->
  <line class="axis-line" x1={sp.x0} y1={sp.base} x2={sp.x1} y2={sp.base} />
  <g style="opacity:{plateIn}">
    <line class="guide" x1={sp.cx} y1={sp.base} x2={sp.cx} y2={sp.base + sp.d * 2 + 12} />
  </g>
  {#each parts as d, i (i)}
    <path class="part" d={d} style="opacity:{partsIn}" />
  {/each}
  <path class="trace" d={trace(peaks, sp.x0, sp.x1, sp.base)} />

  <g style="opacity:{plateIn}">
    {#each TABLE as row, i}
      <line class="rule" x1={sp.x0} x2={sp.x1} y1={TABLE_Y - 14 + TABLE_STEP * i} y2={TABLE_Y - 14 + TABLE_STEP * i} />
    {/each}
  </g>

  <!-- ══ The labels: one family, one size, four fills ══ -->
  {#if cardIn > 0.01}
    <g style="opacity:{cardIn}">
      <text class="lbl faint" x={CARD.cx} y="84" text-anchor="middle">two modes</text>
      <text class="lbl faint" x={SP_CARD.cx} y="84" text-anchor="middle">one band</text>
    </g>
  {/if}
  {#if labelOpacity > 0.01}
    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x="14" y="20">Two Modes, One Frequency</text>
      {#each rows as r (r.key)}
        <text class="lbl strong" x="14" y={r.ty}>{r.name}<tspan class="faint" dx="9">{r.where}</tspan></text>
      {/each}
      <text class="lbl name" x={SP_PLATE.x0} y="20">One Band, Two Contributions</text>
      <g style="opacity:{partsIn}">
        <text class="lbl faint" x={sp.cx - sep} y={sp.base + sp.d * 2 + 26} text-anchor="middle">δ</text>
        <text class="lbl faint" x={sp.cx + sep} y={sp.base + sp.d * 2 + 26} text-anchor="middle">ω</text>
      </g>
      {#each TABLE as row, i}
        <text class="lbl faint" x={SP_PLATE.x0} y={TABLE_Y + TABLE_STEP * i}>{row[0]}</text>
        <text class="lbl strong" x={SP_PLATE.x1} y={TABLE_Y + TABLE_STEP * i} text-anchor="end">{row[1]}</text>
      {/each}
      <text class="lbl faint" x="14" y="286">lower the symmetry and the two part for good</text>
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

  /* One narrow band of weights; the ranking is in the saturation. Palest is
     construction, darkest is the thing being drawn. */

  /* Content: the molecule itself. */
  .bond { stroke: var(--ink-slate-400); stroke-width: 2; }
  .atom { stroke: var(--ink-slate-400); stroke-width: 0.6; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.3; stroke-linejoin: round; }
  /* One contribution on its own, under the band that is their sum. */
  .part { fill: none; stroke: var(--brand-700); stroke-opacity: 0.55; stroke-width: 1; stroke-dasharray: 3 3; }

  /* Structure: an axis a reading is taken against. */
  .axis-line { stroke: var(--line-slate-strong); stroke-width: 1; }
  /* A dimension, capped at both ends: how far the bend runs. */
  .dim { stroke: var(--ink-050); stroke-width: 1; }

  /* Construction: a plane, a centre line, a table rule. The palest marks on
     the plate, because none of them is a measurement. */
  .plane { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 3; }
  .guide { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  .rule { stroke: var(--line-faint); stroke-width: 1; }

  /* One family, one size, four fills: every other card's labels. */
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong { fill: var(--ink-slate-900); }
  .lbl.name { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }
</style>

<script lang="ts">
  /**
   * Normal modes: the 3N ways to move, collected and compared.
   *
   *   t = 0  the card: H₂O beside its nine degrees of freedom, three to
   *          travel, three to turn, three to vibrate. Playing, the molecule
   *          runs through them in turn and the block it is using lights up.
   *   t = 1  the opened card, two rows:
   *            the bookkeeping for CO (3N − 5 = 1), H₂O (3N − 6 = 3) and
   *              CO₂ (3N − 5 = 4), each running through its own motions;
   *              the two linear ones have one rotation fewer;
   *            the three kinds side by side: a grid of CO, H₂O and CO₂
   *              each travelling, turning and vibrating (the vibration cell
   *              stepping through the molecule's own modes), over a table of
   *              what changes, how many, what pulls back, how far apart the
   *              levels are, how they are filled at 25 °C, how a spectrum
   *              sees them, and what a surface does to them. The column of
   *              the kind the top row is showing lights up.
   *
   * The molecules and their displacement vectors are the Vibration Modes
   * view's own (lib/moleculeGeometry.ts), so the two pages draw one motion.
   */
  import { onDestroy } from 'svelte';
  import { geometryFor } from '../../lib/moleculeGeometry';
  import MiniMolecule, { pose, type PosedAtom } from './MiniMolecule.svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 492 };

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

  const CO = geometryFor('co', 'gas')!;
  const WATER = geometryFor('water', 'gas')!;
  const CO2 = geometryFor('co2', 'gas')!;

  /*
   * The three molecules of the opened card, smallest first: a linear
   * diatomic, a bent triatomic and a linear triatomic. Each turns about its
   * own middle (CO about its centre of mass, nearer the O).
   */
  const MOLS = [
    { key: 'co', name: 'CO', g: CO, groups: [3, 2, 1], modes: ['co_stretch'], count: 'CO: 3N − 5 = 1', pivot: { x: 2, y: 0 }, y: 50, k: 0.9 },
    { key: 'water', name: 'H₂O', g: WATER, groups: [3, 3, 3], modes: ['h2o_stretch_symmetric', 'h2o_bend', 'h2o_stretch_asymmetric'], count: 'H₂O: 3N − 6 = 3', pivot: { x: 0, y: -4 }, y: 92, k: 1 },
    { key: 'co2', name: 'CO₂', g: CO2, groups: [3, 2, 4], modes: ['co2_stretch_symmetric', 'co2_bend', 'co2_bend_wagging', 'co2_stretch_asymmetric'], count: 'CO₂: 3N − 5 = 4', pivot: { x: 0, y: 0 }, y: 132, k: 0.9 },
  ];

  /**
   * A turn about the vertical axis through `pivot`, in perspective: the
   * molecule swings out of the page and back rather than standing up in it,
   * so a long molecule never leaves its row.
   */
  const DIST = 110;
  function turnY(atoms: PosedAtom[], deg: number, pivot: { x: number; y: number }): PosedAtom[] {
    const a = (deg * Math.PI) / 180;
    return atoms.map(p => {
      const dx = p.x - pivot.x;
      const f = DIST / (DIST - dx * Math.sin(a));
      return { ...p, x: pivot.x + dx * Math.cos(a) * f, y: pivot.y + (p.y - pivot.y) * f, r: p.r * f };
    });
  }

  /* ── The cycle: travel, turn, then each vibration, 1.8 s apiece ── */
  // One clock for all three, so they travel and turn together. The cycle is
  // as long as the molecule with the most vibrations (CO₂, four); in each
  // vibration step a molecule moves only if it has that vibration, and
  // otherwise rests.
  const PH = 1.8;
  const STEPS = 2 + Math.max(...MOLS.map(m => m.modes.length));
  $: step = running ? Math.floor(time / PH) % STEPS : -1;
  function cycle(m: (typeof MOLS)[number], step: number, time: number) {
    const u = step >= 0 ? (time % PH) / PH : 0;
    const mode = step >= 2 ? m.modes[step - 2] ?? null : null;
    return {
      // -1 when resting, so no block lights.
      phase: step >= 2 && !mode ? -1 : step,
      travel: step === 0 ? 9 * Math.sin(2 * Math.PI * u) : 0,
      atoms: turnY(
        pose(m.g, mode, mode ? Math.sin(2 * Math.PI * 2 * u) : 0, 4),
        step === 1 ? 180 * (1 - Math.cos(Math.PI * u)) : 0,
        m.pivot,
      ),
    };
  }
  $: states = MOLS.map(m => cycle(m, step, time));

  // The comparison's examples, all moving at once.
  $: swing = running ? Math.sin(2 * Math.PI * 1.1 * time) : 0;

  /* ── The bookkeeping bars ── */
  // Three slots for travel, three for turning, four for vibrating, the same
  // for every molecule, so the columns line up and a missing rotation shows
  // as a gap.
  type Kind = 'T' | 'R' | 'V';
  interface Block { x: number; kind: Kind; i: number }
  const START = [0, 3, 6];
  function blocks(groups: number[], x0: number, b: number): Block[] {
    const out: Block[] = [];
    const kinds: Kind[] = ['T', 'R', 'V'];
    groups.forEach((n, gi) => {
      for (let j = 0; j < n; j++) {
        out.push({ x: x0 + (START[gi] + j) * b * 1.2 + gi * b * 0.5, kind: kinds[gi], i: out.length });
      }
    });
    return out;
  }
  const slotMid = (x0: number, b: number, gi: number, n: number) =>
    x0 + START[gi] * b * 1.2 + gi * b * 0.5 + (n * b * 1.2 - b * 0.2) / 2;
  const active = (bl: Block, ph: number, travel: number) =>
    (ph === 0 && bl.kind === 'T') || (ph === 1 && bl.kind === 'R') || (ph >= 2 && bl.i === travel + ph - 2);

  // On the card only H₂O is drawn; opened, all three.
  $: b = lerp(8.8, 16, t);
  $: x0 = lerp(110, 132, t);
  $: rows = MOLS.map(m => {
    const small = m.key === 'water';
    return {
      ...m,
      mx: small ? lerp(54, 62, t) : 62,
      my: small ? lerp(58, m.y, t) : m.y,
      mk: small ? lerp(1.1, m.k, t) : m.k,
      barY: small ? lerp(45, m.y - 8, t) : m.y - 8,
      bar: blocks(m.groups, small ? x0 : 132, small ? b : 16),
      bs: small ? b : 16,
      show: small ? 1 : fullOpacity,
    };
  });

  /* ── The comparison ── */
  const COLS = [
    { kind: 'T', name: 'Translation', x: 168 },
    { kind: 'R', name: 'Rotation', x: 288 },
    { kind: 'V', name: 'Vibration', x: 408 },
  ];
  const TABLE = [
    ['changes', 'position', 'orientation', 'shape'],
    ['how many', '3', '3 (linear: 2)', '3N − 6 (or − 5)'],
    ['pulled back', 'no', 'no', 'by the bonds'],
    ['level gaps', 'continuous', 'a few cm⁻¹', '10²–10³ cm⁻¹'],
    ['at 25 °C', 'all moving', 'many J filled', 'nearly all v = 0'],
    ['in a spectrum', 'no band', 'P, Q, R branches', 'IR, Raman bands'],
    ['on a surface', 'frustrated', 'frustrated', 'unchanged'],
  ];
  // The column lit follows the shared cycle.
  $: activeKind = step === 0 ? 'T' : step === 1 ? 'R' : step >= 2 ? 'V' : null;
  const TOP = 184;
  // The grid of examples: one row per molecule, one column per kind.
  const GRID_Y = TOP + 56;
  const GRID_STEP = 40;
  const TABLE_Y = GRID_Y + GRID_STEP * 2 + 50;
  /*
   * At rest the grid still says what each cell does, with faint arrows in the
   * style of the axes on the Translation and Rotation Modes cards: a slide,
   * a turn about the vertical, and for a vibration each moving atom's own
   * displacement (lib/moleculeGeometry.ts; out-of-plane parts are left out).
   */
  const head = (x: number, y: number, dx: number, dy: number, sz = 3) => {
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    return `M${x - ux * sz - uy * sz * 0.6},${y - uy * sz + ux * sz * 0.6} L${x},${y} L${x - ux * sz + uy * sz * 0.6},${y - uy * sz - ux * sz * 0.6}`;
  };
  /** Arrows on the atoms that move in `modeId`, each from the atom outward. */
  function vibArrows(m: (typeof MOLS)[number], modeId: string, cx: number, cy: number, k: number) {
    const vecs = m.g.modes[modeId] ?? [];
    return m.g.atoms.flatMap((a, i) => {
      const v = vecs[i];
      if (!v || v.rotateDeg || Math.hypot(v.dx, v.dy) < 0.15) return [];
      const n = Math.hypot(v.dx, v.dy);
      const ux = v.dx / n;
      const uy = v.dy / n;
      const r = 6.5 * k;
      const x1 = cx + a.x * k + ux * r;
      const y1 = cy + a.y * k + uy * r;
      const x2 = x1 + ux * 7 * n;
      const y2 = y1 + uy * 7 * n;
      return [{ x1, y1, x2, y2, head: head(x2, y2, ux, uy) }];
    });
  }
  /** A turn about the vertical: most of a flat ellipse, above the molecule. */
  function turnArrow(cx: number, cy: number) {
    const pts = [];
    for (let deg = 30; deg <= 330; deg += 15) {
      const a = (deg * Math.PI) / 180;
      pts.push({ x: cx + 16 * Math.sin(a), y: cy - 16 + 3.5 * Math.cos(a) });
    }
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    return {
      d: 'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L'),
      head: head(last.x, last.y, last.x - prev.x, last.y - prev.y),
    };
  }

  // The vibration column steps through each molecule's own modes.
  $: gridMode = (m: (typeof MOLS)[number]) => m.modes[Math.floor(time / PH) % m.modes.length];

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A molecule of N atoms has 3N degrees of freedom: three translations, three rotations (two if linear), and 3N − 6 (or 3N − 5) vibrations, counted for CO, H₂O and CO₂ and compared side by side"
>
  <!-- ── Row 1: the bookkeeping, CO, H₂O and CO₂ ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Degrees of Freedom: 3N</text>
    <text class="lbl faint" x={slotMid(132, 16, 0, 3)} y="32" text-anchor="middle">travel</text>
    <text class="lbl faint" x={slotMid(132, 16, 1, 3)} y="32" text-anchor="middle">turn</text>
    <text class="lbl faint" x={slotMid(132, 16, 2, 4)} y="32" text-anchor="middle">vibrate</text>
    {#each MOLS as m (m.key)}
      <text class="lbl strong" x="350" y={m.y + 4}>{m.count}</text>
    {/each}
    <text class="lbl faint" x="132" y="160">linear: the turn about its axis moves no atom</text>
  </g>

  {#each rows as r, ri (r.key)}
    <g style="opacity:{r.show}">
      <MiniMolecule
        atoms={states[ri].atoms}
        bonds={r.g.bonds}
        x={r.mx + states[ri].travel}
        y={r.my}
        k={r.mk}
      />
      {#each r.bar as bl (bl.i)}
        <rect
          class="block {bl.kind}"
          class:on={active(bl, states[ri].phase, r.groups[0] + r.groups[1])}
          x={bl.x}
          y={r.barY}
          width={r.bs}
          height={r.bs}
          rx={r.bs * 0.18}
        />
      {/each}
    </g>
  {/each}

  <!-- ── Row 2 (opened): the three kinds, a grid of examples over the table ── -->
  <g style="opacity:{fullOpacity}">
    {#each MOLS as m, r (m.key)}
      {@const y = GRID_Y + GRID_STEP * r}
      <MiniMolecule atoms={pose(m.g, null)} bonds={m.g.bonds} x={COLS[0].x + 9 * swing} y={y} k={m.k * 0.9} />
      <MiniMolecule atoms={turnY(pose(m.g, null), running ? 100 * time : 0, m.pivot)} bonds={m.g.bonds} x={COLS[1].x} y={y} k={m.k * 0.9} />
      <MiniMolecule atoms={pose(m.g, gridMode(m), swing, 4)} bonds={m.g.bonds} x={COLS[2].x} y={y} k={m.k * 0.9} />
    {/each}
    {#each TABLE as row, r}
      <line class="rule" x1="14" x2="470" y1={TABLE_Y - 13 + 18 * r} y2={TABLE_Y - 13 + 18 * r} />
    {/each}

    <!-- Still: the arrows say what would move. -->
    {#if !running}
      {#each MOLS as m, r (m.key)}
        {@const y = GRID_Y + GRID_STEP * r}
        <path class="hint" d="M {COLS[0].x - 13} {y + 15} H {COLS[0].x + 13}" />
        <path class="hint" d={head(COLS[0].x + 13, y + 15, 1, 0)} />
        <path class="hint" d={head(COLS[0].x - 13, y + 15, -1, 0)} />
        {@const ta = turnArrow(COLS[1].x, y - (m.key === 'water' ? 4 : 0))}
        <path class="hint" d={ta.d} />
        <path class="hint" d={ta.head} />
        {#each vibArrows(m, gridMode(m), COLS[2].x, y, m.k * 0.9) as va}
          <line class="hint" x1={va.x1} y1={va.y1} x2={va.x2} y2={va.y2} />
          <path class="hint" d={va.head} />
        {/each}
      {/each}
    {/if}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={TOP}>Three Kinds of Motion, Side by Side</text>
    {#each COLS as c (c.kind)}
      <text class="lbl head" class:on={activeKind === c.kind} x={c.x} y={TOP + 26} text-anchor="middle">{c.name}</text>
    {/each}
    {#each MOLS as m, r (m.key)}
      <text class="lbl strong" x="14" y={GRID_Y + GRID_STEP * r + 4}>{m.name}</text>
    {/each}
    {#each TABLE as row, r}
      <text class="lbl faint" x="14" y={TABLE_Y + 18 * r}>{row[0]}</text>
      {#each COLS as c, i (c.kind)}
        <text class="lbl" class:on={activeKind === c.kind} x={c.x} y={TABLE_Y + 18 * r} text-anchor="middle">{row[i + 1]}</text>
      {/each}
    {/each}
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  /* Travelling and turning: outlined. Vibrating: a light fill, so the one in
     use while the cycle plays, in the Knowledge green, stands out from both. */
  .block { stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
  .block.T, .block.R { fill: var(--surface); stroke: var(--line-slate-strong); }
  .block.V { fill: var(--line-slate); stroke: var(--ink-025); }
  .block.on { fill: var(--accent-green-fg); stroke: var(--accent-green-fg); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong { fill: var(--ink-slate-900); }
  .lbl.name, .lbl.head { fill: var(--ink-slate-900); }
  .lbl.head { font-weight: var(--t-label-weight); }
  .lbl.on { fill: var(--accent-green-fg); }
  .rule { stroke: var(--line-faint); stroke-width: 1; }
  /* The resting arrows: as faint as the axes on the other motion cards. */
  .hint { fill: none; stroke: var(--ink-025); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }
</style>

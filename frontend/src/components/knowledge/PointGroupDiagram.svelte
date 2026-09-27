<script lang="ts">
  /**
   * Point group notation: a symbol built from what a molecule survives.
   *
   *   t = 0  the card: H₂O in perspective with its C₂ axis and its two
   *          mirror planes. Playing, it carries out each operation in turn
   *          (a half turn about the axis, then a pass through each mirror)
   *          while the symbol beside it assembles: C₂, then C₂ᵥ. After the
   *          three the molecule is back where it started, which is the
   *          group closing on itself.
   *   t = 1  the opened card: the four symmetry elements, each at work on a
   *          molecule of the atlas. C₃ turns NH₃ by a third, σ reflects H₂O
   *          through the plane that swaps its hydrogens, i sends every atom
   *          of CO₂ through the carbon, and S₄ turns CH₄ by a quarter and
   *          then reflects it. Each repeats its operation; one atom is
   *          ringed so the reader can follow where it went.
   *
   * A reflection is drawn as the coordinate across the plane running through
   * zero (x → x·cos πs), so the atoms pass through the mirror rather than
   * jumping; an inversion, all three coordinates at once.
   *
   * Everything is built in a molecule's own units, drawn inside a scaled
   * group; strokes do not scale with it.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';
  import { project, rotY, turnY, mirrorX, mirrorZ, invert, improperY, arrowHead, type SymOp as Op, type V3 } from './view3d';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));
  const ease = (k: number) => (1 - Math.cos(Math.PI * Math.max(0, Math.min(1, k)))) / 2;

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 372 };

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

  /** One operation per step: it moves for the first part, then holds. */
  const STEP = 2.4;
  const MOVE = 0.55;
  $: step = Math.floor(time / STEP);
  $: e = running ? ease((time % STEP) / (STEP * MOVE)) : 0;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: cardOpacity = 1 - ramp(t, 0.05, 0.4);

  /* ── Molecules, in their own units: y up, z towards the viewer ── */
  type Atom = { el: string; p: V3; r: number };
  interface Mol {
    atoms: Atom[];
    bonds: [number, number][];
    /** The atom ringed, to follow through the operation. */
    tracer: number;
  }
  const R: Record<string, number> = { C: 5.4, O: 5.2, N: 5.2, H: 3.8 };
  const at = (el: string, p: V3): Atom => ({ el, p, r: R[el] });

  const WATER: Mol = {
    atoms: [at('O', [0, 6, 0]), at('H', [-12, -5, 0]), at('H', [12, -5, 0])],
    bonds: [[0, 1], [0, 2]],
    tracer: 2,
  };
  const h3 = (deg: number): V3 => [13 * Math.sin((deg * Math.PI) / 180), -6, 13 * Math.cos((deg * Math.PI) / 180)];
  const AMMONIA: Mol = {
    atoms: [at('N', [0, 6, 0]), at('H', h3(20)), at('H', h3(140)), at('H', h3(260))],
    bonds: [[0, 1], [0, 2], [0, 3]],
    tracer: 1,
  };
  const CO2: Mol = {
    atoms: [at('O', [-19, 0, 0]), at('C', [0, 0, 0]), at('O', [19, 0, 0])],
    bonds: [[0, 1], [1, 2]],
    tracer: 2,
  };
  // The S₄ axis runs vertically, bisecting two H–C–H angles.
  const q = 9;
  const METHANE: Mol = {
    atoms: [at('C', [0, 0, 0]), at('H', [q, q, q]), at('H', [-q, q, -q]), at('H', [q, -q, -q]), at('H', [-q, -q, q])],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
    tracer: 1,
  };

  /* ── The operations (view3d.ts), each continuous in s ── */
  const turn = turnY;
  const s4 = improperY(4);

  /** Where each atom is, drawn: projected, painted back to front. */
  function draw(mol: Mol, where: (p: V3) => V3) {
    const pts = mol.atoms.map((a, i) => {
      const pr = project(where(a.p));
      return { i, x: pr.x, y: pr.y, z: pr.z, r: a.r * pr.f, el: a.el };
    });
    return {
      bonds: mol.bonds.map(([a, b]) => ({ x1: pts[a].x, y1: pts[a].y, x2: pts[b].x, y2: pts[b].y })),
      atoms: [...pts].sort((a, b) => a.z - b.z),
      tracer: pts[mol.tracer],
    };
  }

  const P = (v: V3) => project(v);
  const line = (a: V3, b: V3) => {
    const p = P(a);
    const r = P(b);
    return { x1: p.x, y1: p.y, x2: r.x, y2: r.y };
  };
  const poly = (pts: V3[]) => pts.map(v => P(v)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  /** A curved arrow round the vertical axis at height y, for a turn. */
  function ringArrow(y: number, r: number) {
    const pts = [];
    for (let deg = 200; deg <= 480; deg += 12) pts.push(P(rotY([r, y, 0], deg)));
    const d = 'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const head = arrowHead(a.x, a.y, b.x, b.y);
    return { d, head };
  }

  /* ── The card: H₂O, E → C₂ → σᵥ → σᵥ′ and round again ──
     The three compose to the identity (C₂·σᵥ = σᵥ′), so every third step
     the molecule is back as drawn. */
  const WATER_OPS: Op[] = [turn(2), mirrorX, mirrorZ];
  $: cardPhase = running ? step % 3 : -1;
  $: waterWhere = (p: V3): V3 => {
    if (!running || t > 0.5) {
      // Opened, water shows the σᵥ that swaps its hydrogens, over and over.
      return t > 0.5 && running ? mirrorX(p, step + e) : p;
    }
    let v = p;
    for (let k = 0; k < cardPhase; k++) v = WATER_OPS[k](v, 1);
    return WATER_OPS[cardPhase](v, e);
  };
  $: water = draw(WATER, waterWhere);
  $: waterAt = { x: lerp(58, 360, t), y: lerp(52, 78, t), k: lerp(1.5, 1.6, t) };

  // The card's elements: the axis, σᵥ across the page (swaps the H), σᵥ′ the page.
  const C2_AXIS = line([0, -20, 0], [0, 22, 0]);
  const SIGMA_V = poly([[0, -17, -16], [0, -17, 16], [0, 19, 16], [0, 19, -16]]);
  const SIGMA_V2 = poly([[-19, -17, 0], [19, -17, 0], [19, 19, 0], [-19, 19, 0]]);
  const C2_RING = ringArrow(17, 6);

  /* ── The opened card: four elements at work ── */
  interface Panel {
    key: string;
    mol: Mol;
    op: Op;
    x: number;
    y: number;
    k: number;
    sym: string;
    subs: string;
    name: string;
    what: string;
    example: string;
  }
  const PANELS: Panel[] = [
    { key: 'cn', mol: AMMONIA, op: turn(3), x: 120, y: 80, k: 1.6, sym: 'C', subs: 'n', name: 'proper rotation axis', what: 'turn by 360°/n', example: 'NH₃: C₃, a third of a turn' },
    { key: 'sigma', mol: WATER, op: mirrorX, x: 360, y: 80, k: 1.6, sym: 'σ', subs: '', name: 'mirror plane', what: 'reflect through the plane', example: 'H₂O: σᵥ swaps the two H' },
    { key: 'i', mol: CO2, op: invert, x: 120, y: 250, k: 1.6, sym: 'i', subs: '', name: 'centre of inversion', what: 'every atom through one point', example: 'CO₂: the two O change places' },
    { key: 'sn', mol: METHANE, op: s4, x: 360, y: 250, k: 1.5, sym: 'S', subs: 'n', name: 'improper rotation axis', what: 'turn by 360°/n, then reflect', example: 'CH₄: S₄, a quarter and a mirror' },
  ];
  $: panels = PANELS.map(pn => ({
    ...pn,
    d: pn.key === 'sigma' ? water : draw(pn.mol, p => (running ? pn.op(p, step + e) : p)),
  }));

  const C3_AXIS = line([0, -18, 0], [0, 22, 0]);
  const C3_RING = ringArrow(17, 6);
  const S4_AXIS = line([0, -24, 0], [0, 24, 0]);
  const S4_RING = ringArrow(20, 6);
  const S4_PLANE = poly([[-17, 0, -17], [17, 0, -17], [17, 0, 17], [-17, 0, 17]]);
  const I_POINT = P([0, 0, 0]);

  // Which half of S₄ is moving: the turn, then the mirror.
  $: s4Half = running ? ((time % STEP) / (STEP * MOVE) < 0.5 ? 'turn' : 'mirror') : null;
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Water with its two-fold axis and two mirror planes, and the point group symbol C2v built from them; opened, the four symmetry elements, a rotation axis, a mirror plane, a centre of inversion and an improper axis, each at work on a molecule"
>
  <!-- ── Water: on the card with all three elements, opened with σᵥ ── -->
  <g transform="translate({waterAt.x} {waterAt.y}) scale({waterAt.k})">
    <polygon class="plane" class:on={cardPhase === 2} points={SIGMA_V2} style="opacity:{cardOpacity}" />
    <polygon class="plane" class:on={cardPhase === 1 || (t > 0.5 && running)} points={SIGMA_V} />
    <line class="axis" class:on={cardPhase === 0} {...C2_AXIS} style="opacity:{cardOpacity}" />
    {#if cardPhase === 0}
      <path class="ring" d={C2_RING.d} /><path class="ring" d={C2_RING.head} />
    {/if}
    {#each water.bonds as b}<line class="bond" {...b} />{/each}
    {#each water.atoms as a (a.i)}
      <circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={colorForElement(a.el)} />
    {/each}
    <circle class="tracer" cx={water.tracer.x} cy={water.tracer.y} r={water.tracer.r + 2.2} />
  </g>

  <!-- The card's symbol, assembling as the operations are found. -->
  <g style="opacity:{cardOpacity}">
    <text class="lbl faint" x="112" y="26">point group</text>
    <text class="symbol" x="112" y="60">C<tspan class="symsub" dy="7">2</tspan><tspan
        class="symsub"
        class:dim={cardPhase === 0}
        class:lit={cardPhase === 1 || cardPhase === 2}>v</tspan></text>
    <text class="lbl ops" x="112" y="84">
      <tspan>E</tspan>
      <tspan dx="6" class:lit={cardPhase === 0}>C₂</tspan>
      <tspan dx="6" class:lit={cardPhase === 1}>σᵥ</tspan>
      <tspan dx="6" class:lit={cardPhase === 2}>σᵥ′</tspan>
    </text>
  </g>

  <!-- ── Opened: the other three elements ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Four Symmetry Elements, Each at Work</text>
  </g>
  <g style="opacity:{fullOpacity}">
    {#each panels as pn (pn.key)}
      {#if pn.key !== 'sigma'}
        <g transform="translate({pn.x} {pn.y}) scale({pn.k})">
          {#if pn.key === 'cn'}
            <line class="axis on" {...C3_AXIS} />
            <path class="ring on" d={C3_RING.d} /><path class="ring on" d={C3_RING.head} />
          {:else if pn.key === 'sn'}
            <polygon class="plane" class:on={s4Half === 'mirror'} points={S4_PLANE} />
            <line class="axis" class:on={s4Half !== 'mirror'} {...S4_AXIS} />
            <path class="ring" class:on={s4Half !== 'mirror'} d={S4_RING.d} />
            <path class="ring" class:on={s4Half !== 'mirror'} d={S4_RING.head} />
          {/if}
          {#each pn.d.bonds as b}<line class="bond" {...b} />{/each}
          {#each pn.d.atoms as a (a.i)}
            <circle class="atom" cx={a.x} cy={a.y} r={a.r} fill={colorForElement(a.el)} />
          {/each}
          {#if pn.key === 'i'}
            <circle class="centre" cx={I_POINT.x} cy={I_POINT.y} r="1.6" />
          {/if}
          <circle class="tracer" cx={pn.d.tracer.x} cy={pn.d.tracer.y} r={pn.d.tracer.r + 2.2} />
        </g>
      {/if}
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    {#each PANELS as pn (pn.key)}
      <text class="lbl strong" x={pn.x} y={pn.y + 58} text-anchor="middle">
        <tspan class="elsym">{pn.sym}</tspan>{#if pn.subs}<tspan class="sub" dy="3">{pn.subs}</tspan><tspan dy="-3"> </tspan>{:else}<tspan> </tspan>{/if}<tspan dx="4">{pn.name}</tspan>
      </text>
      <text class="lbl" x={pn.x} y={pn.y + 74} text-anchor="middle">{pn.what}</text>
      <text class="lbl faint" x={pn.x} y={pn.y + 90} text-anchor="middle">{pn.example}</text>
    {/each}
    <text class="lbl faint" x="240" y={F.H - 4} text-anchor="middle">ringed: one atom, to follow where the operation takes it</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  /* Construction until the element is at work; then the subject. */
  .axis {
    stroke: var(--ink-025);
    stroke-width: 1;
    stroke-dasharray: 3 2;
    vector-effect: non-scaling-stroke;
  }
  .axis.on { stroke: var(--brand-700); stroke-width: 1.4; }
  .plane {
    fill: var(--ink-025);
    fill-opacity: 0.12;
    stroke: var(--ink-025);
    stroke-width: 1;
    stroke-dasharray: 3 2;
    vector-effect: non-scaling-stroke;
    transition: fill 0.2s, stroke 0.2s;
  }
  .plane.on { fill: var(--brand-700); fill-opacity: 0.1; stroke: var(--brand-700); stroke-dasharray: none; }
  .ring {
    fill: none;
    stroke: var(--ink-025);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .ring.on { stroke: var(--brand-700); stroke-width: 1.3; }
  .centre { fill: var(--brand-700); }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  /* A hairline, so a white hydrogen still reads on the pale card. */
  .atom { stroke: var(--ink-slate-400); stroke-width: 0.6; vector-effect: non-scaling-stroke; }
  .tracer {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.3;
    vector-effect: non-scaling-stroke;
  }

  .symbol {
    font-family: var(--font-sans);
    font-size: calc(var(--t-code-size) * 3);
    fill: var(--ink-slate-900);
  }
  .symsub { font-size: 0.62em; transition: fill 0.2s, opacity 0.2s; }
  .symsub.dim { opacity: 0.2; }
  .symsub.lit { fill: var(--brand-700); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.ops tspan { transition: fill 0.2s; }
  .lbl .lit { fill: var(--brand-700); font-weight: var(--t-label-weight); }
  .elsym { font-weight: var(--t-label-weight); }
  .sub { font-size: 0.75em; }
</style>

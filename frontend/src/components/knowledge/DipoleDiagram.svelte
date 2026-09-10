<script lang="ts">
  /**
   * The dipole moment, and why IR needs it to change.
   *
   *   t = 0  the card, the phenomenon itself: C–O with its partial charges
   *          and a dipole arrow that grows and shrinks as the bond stretches.
   *   t = 1  the opened card, three rows:
   *            what a dipole is: +q and −q a distance d apart, μ = q·d;
   *            the two molecules vibrating beside their μ(Q) lines, a slope
   *              for CO and a flat line for N₂: (∂μ/∂Q)₀ ≠ 0 or not;
   *            on a metal: the reflected field stands along the surface
   *              normal, so CO standing up is driven and CO lying flat is not
   *              (the surface dipole selection rule, Ranjan and Trenary).
   *
   * Arrows point from the negative charge to the positive one (the physics
   * convention, stated in the card's text). Orange is IR throughout.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220, co: { x: 110, y: 46 }, bond: 34, rC: 7.2, rO: 6.8 };
  const F = { W: 480, H: 350, co: { x: 80, y: 128 }, nn: { x: 80, y: 180 }, bond: 30, rC: 7, rO: 6.6, rN: 6.6, surf: 320 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: bond = lerp(S.bond, F.bond, t);

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

  const HZ = 0.7;
  // At rest, frozen at the stretched end of the swing.
  $: phi = running ? Math.PI / 2 + (clock / 1000) * HZ * 2 * Math.PI : Math.PI / 2;
  $: s = Math.sin(phi);

  /* ── CO and N≡N ── */
  $: coC = { x: lerp(S.co.x, F.co.x, t), y: lerp(S.co.y, F.co.y, t) };
  // N₂ only belongs to the opened card, as the molecule with nothing to swing.
  const nnC = F.nn;
  $: nnOpacity = ramp(t, 0.3, 0.75);
  // Hydrogen is sixteen times lighter, so it does nearly all the moving.
  $: stretch = lerp(4, 3.6, t) * s;
  // Each atom moves in proportion to the other's mass (C 12, O 16), so the
  // centre of mass stays put.
  $: cX = coC.x - bond / 2 - (stretch * 16) / 28;
  $: oX = coC.x + bond / 2 + (stretch * 12) / 28;
  $: n1 = nnC.x - bond / 2 - stretch / 2;
  $: n2 = nnC.x + bond / 2 + stretch / 2;
  // The dipole of CO changes with the bond (μ = q·d): an arrow from O (δ−) to
  // C (δ+), drawn with its change exaggerated so the swing is plain to see.
  $: muLen = lerp(26, 30, t) + lerp(3.4, 2.6, t) * stretch;
  $: muY = coC.y + 16;
  // The symbol itself swells and shrinks with the dipole it names.
  $: muScale = 1.2 * (1 + 0.24 * (stretch / lerp(4, 3.6, t)));

  const arrowHead = (x: number, y: number, dx: number, dy: number, sz = 4) => {
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    return `M${x - ux * sz - uy * sz * 0.7},${y - uy * sz + ux * sz * 0.7} L${x},${y} L${x - ux * sz + uy * sz * 0.7},${y - uy * sz - ux * sz * 0.7}`;
  };

  /* ── μ(Q) lines ── */
  const PX0 = 190;
  const PX1 = 300;
  const qToX = (q: number) => PX0 + ((q + 1) / 2) * (PX1 - PX0);

  /* ── The surface row ── */
  const FIELD_X = [40, 92, 236, 288, 440];
  // CO standing on the metal through carbon, and the same CO lying flat.
  const UP = { x: 150 };
  const FLAT = { x: 364 };
  // Carbon is held by the metal, so the oxygen end does the moving.
  $: coStretch = 2.6 * s;
  $: upO = F.surf - 9 - 26 - coStretch;

  const O_FILL = colorForElement('O');
  const C_FILL = colorForElement('C');
  const N_FILL = colorForElement('N');

  $: cardFade = 1 - ramp(t, 0, 0.35);
  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="CO carries a dipole that changes as the bond stretches, so it absorbs infrared light; N≡N has none and does not; on a metal only a dipole change along the surface normal is seen"
>
  <!-- ── Row 1 (opened): what a dipole is ── -->
  <g style="opacity:{fullOpacity}">
    <line class="dim" x1="60" x2="160" y1="18" y2="18" />
    <line class="dim" x1="60" x2="60" y1="14" y2="22" />
    <line class="dim" x1="160" x2="160" y1="14" y2="22" />
    <circle class="charge neg" cx="60" cy="42" r="10" />
    <circle class="charge pos" cx="160" cy="42" r="10" />
    <line class="mu" x1="60" x2="158" y1="66" y2="66" />
    <path class="mu-head" d={arrowHead(160, 66, 1, 0, 5)} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="sign neg" x="60" y="46" text-anchor="middle">−</text>
    <text class="sign pos" x="160" y="46" text-anchor="middle">+</text>
    <text class="sym" x="110" y="13" text-anchor="middle">d</text>
    <text class="sym neg" x="40" y="46" text-anchor="end">−q</text>
    <text class="sym pos" x="180" y="46">+q</text>
    <text class="lbl strong" x="250" y="46">μ = q · d</text>
    <text class="lbl faint" x="250" y="64">from − to +</text>
  </g>

  <!-- ── Row 2: CO and N≡N vibrating ── -->
  {#each [-1.6, 1.6] as off}
    <line class="bond thin" x1={cX} x2={oX} y1={coC.y + off} y2={coC.y + off} />
  {/each}
  <line class="bond thin" x1={cX} x2={oX} y1={coC.y} y2={coC.y} />
  <circle cx={cX} cy={coC.y} r={lerp(S.rC, F.rC, t)} fill={C_FILL} />
  <circle cx={oX} cy={coC.y} r={lerp(S.rO, F.rO, t)} fill={O_FILL} />
  <text class="delta pos" x={cX} y={coC.y - 13} text-anchor="middle">δ+</text>
  <text class="delta neg" x={oX} y={coC.y - 13} text-anchor="middle">δ−</text>
  <!-- From − (O) to + (C), and longer the further apart they are. -->
  <line class="mu" x1={coC.x + muLen / 2} x2={coC.x - muLen / 2 + 1} y1={muY} y2={muY} />
  <path class="mu-head" d={arrowHead(coC.x - muLen / 2, muY, -1, 0, 4.5)} />
  <text
    class="sym mu-lbl"
    transform="translate({coC.x} {muY + 19}) scale({muScale})"
    text-anchor="middle"
    style="opacity:{cardFade}"
  >μ</text>

  <g style="opacity:{nnOpacity}">
    {#each [-2.4, 0, 2.4] as off}
      <line class="bond thin" x1={n1} x2={n2} y1={nnC.y + off} y2={nnC.y + off} />
    {/each}
    <circle cx={n1} cy={nnC.y} r={F.rN} fill={N_FILL} />
    <circle cx={n2} cy={nnC.y} r={F.rN} fill={N_FILL} />
    <text class="lbl faint" x={nnC.x + 30} y={nnC.y + 20}>μ = 0</text>
  </g>

  <g style="opacity:{fullOpacity}">
    {#each [{ c: F.co, slope: 1 }, { c: F.nn, slope: 0 }] as row}
      <line class="axis-line" x1={PX0} x2={PX1} y1={row.c.y} y2={row.c.y} />
      <line class="axis-line" x1={qToX(0)} x2={qToX(0)} y1={row.c.y - 16} y2={row.c.y + 16} />
      <line
        class="mu-line"
        class:flat={!row.slope}
        x1={PX0} x2={PX1}
        y1={row.c.y + 12 * row.slope}
        y2={row.c.y - 12 * row.slope}
      />
      <circle class="cursor" class:flat={!row.slope} cx={qToX(s)} cy={row.c.y - 12 * row.slope * s} r="2.6" />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="sym" x={PX0 - 4} y={F.co.y - 12} text-anchor="end">μ</text>
    <text class="sym" x={PX1 + 4} y={F.co.y + 4}>Q</text>
    <text class="sym" x={PX0 - 4} y={F.nn.y - 12} text-anchor="end">μ</text>
    <text class="sym" x={PX1 + 4} y={F.nn.y + 4}>Q</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={F.co.y + 28} text-anchor="middle">slope ≠ 0</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={F.nn.y + 28} text-anchor="middle">slope = 0</text>
    <text class="verdict yes" x="344" y={F.co.y + 4}>IR ✓</text>
    <text class="verdict" x="344" y={F.nn.y + 4}>IR ✗</text>
  </g>

  <!-- ── Row 3 (opened): on a metal ── -->
  <g style="opacity:{fullOpacity}">
    <rect class="metal" x="10" y={F.surf} width="460" height="16" />
    {#each FIELD_X as fx}
      {@const L = 22 * s}
      <line class="field" x1={fx} x2={fx} y1={F.surf - 4} y2={F.surf - 4 - L} />
      {#if Math.abs(L) > 3}
        <path class="field-head" d={arrowHead(fx, F.surf - 4 - L, 0, -Math.sign(L), 3.5)} />
      {/if}
    {/each}

    <!-- Standing: its stretch moves charge along the normal, where the field is. -->
    <line class="bond" x1={UP.x} x2={UP.x} y1={F.surf - 9} y2={upO} />
    <circle cx={UP.x} cy={F.surf - 9} r="6.3" fill={C_FILL} />
    <circle cx={UP.x} cy={upO} r="6" fill={O_FILL} />
    <line class="mu" x1={UP.x + 18} x2={UP.x + 18} y1={F.surf - 12} y2={F.surf - 30 - coStretch * 2} />
    <path class="mu-head" d={arrowHead(UP.x + 18, F.surf - 31 - coStretch * 2, 0, -1, 4)} />

    <!-- Flat: its stretch moves charge along the surface, where there is none. -->
    <line class="bond" x1={FLAT.x - 15} x2={FLAT.x + 15} y1={F.surf - 9} y2={F.surf - 9} />
    <circle cx={FLAT.x - 15} cy={F.surf - 9} r="6.3" fill={C_FILL} />
    <circle cx={FLAT.x + 15} cy={F.surf - 9} r="6" fill={O_FILL} />
    <line class="mu off" x1={FLAT.x - 14} x2={FLAT.x + 12} y1={F.surf - 26} y2={F.surf - 26} />
    <path class="mu-head off" d={arrowHead(FLAT.x + 14, F.surf - 26, 1, 0, 4)} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl faint" x="14" y="238">field of reflected p-polarized light</text>
    <text class="verdict yes" x={UP.x} y="262" text-anchor="middle">standing: seen ✓</text>
    <text class="verdict" x={FLAT.x} y="262" text-anchor="middle">lying flat: not seen ✗</text>
    <text class="lbl faint" x="466" y={F.surf + 12} text-anchor="end">metal</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2.2; }
  .bond.thin { stroke-width: 1.1; }

  .mu { stroke: var(--diagram-photon); stroke-width: 1.7; }
  .mu-head { fill: none; stroke: var(--diagram-photon); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .mu.off, .mu-head.off { stroke: var(--ink-025); }

  .field { stroke: var(--diagram-photon); stroke-width: 1.2; stroke-opacity: 0.55; }
  .field-head { fill: none; stroke: var(--diagram-photon); stroke-opacity: 0.55; stroke-width: 1.2; stroke-linecap: round; }

  .charge { fill: var(--surface); stroke: var(--ink-slate-500); stroke-width: 1.3; }
  .dim { stroke: var(--ink-slate-400); stroke-width: 1; }

  .metal { fill: var(--line-slate); stroke: var(--line-slate-strong); stroke-width: 1; }

  .axis-line { stroke: var(--line-slate-strong); stroke-width: 1; }
  .mu-line { stroke: var(--diagram-photon); stroke-width: 1.6; }
  .mu-line.flat { stroke: var(--ink-025); }
  .cursor { fill: var(--diagram-photon); }
  .cursor.flat { fill: var(--ink-050); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong { fill: var(--ink-slate-900); }

  .sym, .sign, .delta {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .sym { font-style: italic; }
  .sym.mu-lbl { fill: var(--diagram-photon); }
  .sign { font-weight: var(--t-label-weight); fill: var(--ink-slate-900); }
  /* Shared with the Polarizability and Selection rules cards: same face,
     same weight, red for negative and blue for positive. */
  .delta { font-weight: var(--t-label-weight); }
  .neg { fill: var(--charge-negative); }
  .pos { fill: var(--charge-positive); }
  .charge.neg { fill: var(--surface); stroke: var(--charge-negative); }
  .charge.pos { fill: var(--surface); stroke: var(--charge-positive); }

  .verdict {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-025);
  }
  .verdict.yes { fill: var(--diagram-photon); }
</style>

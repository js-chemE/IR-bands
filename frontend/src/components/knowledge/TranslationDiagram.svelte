<script lang="ts">
  /**
   * Translation, and nothing else: the whole molecule travelling.
   *
   *   t = 0  the card: CO with its three axes through the centre of mass,
   *          travelling along x, then y, then z (towards the viewer, so it
   *          grows), beside the spread of speeds a gas of CO has at 25 °C.
   *   t = 1  the opened card, two rows:
   *            the same, labelled, and beside it one step of travel drawn
   *              atom by atom: every atom moves by the same arrow;
   *            the spread of speeds, Maxwell–Boltzmann for CO at 25 °C,
   *              with its mean, about 475 m/s.
   *
   * No light here: travel leaves no band of its own.
   */
  import { onDestroy } from 'svelte';
  import MiniMolecule from './MiniMolecule.svelte';
  import Axes3D from './Axes3D.svelte';
  import { project, UNIT, type Axis, type V3 } from './view3d';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 324 };

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

  /* ── CO, travelling along each axis in turn ── */
  const CO_3D: { el: string; p: V3; r: number }[] = [
    { el: 'C', p: [-14.86, 0, 0], r: 5.4 },
    { el: 'O', p: [11.14, 0, 0], r: 5.2 },
  ];
  const CO_BOND: [number, number][] = [[0, 1]];
  const ORDER: Axis[] = ['x', 'y', 'z'];
  const PH = 1.8;
  $: phase = running ? Math.floor(time / PH) % 3 : -1;
  $: axis = phase >= 0 ? ORDER[phase] : null;
  $: step = running ? 12 * Math.sin(2 * Math.PI * ((time % PH) / PH)) : 0;
  $: shift = (axis ? UNIT[axis].map(c => c * step) : [0, 0, 0]) as V3;
  $: coAtoms = CO_3D.map(a => {
    const pr = project([a.p[0] + shift[0], a.p[1] + shift[1], a.p[2] + shift[2]]);
    return { x: pr.x, y: pr.y, z: pr.z, r: a.r * pr.f, el: a.el };
  }).sort((a, b) => a.z - b.z);
  $: com = project(shift);
  $: co = { x: lerp(58, 90, t), y: lerp(50, 92, t) };

  /* ── One step, atom by atom (opened) ── */
  const STEP = { x: 300, y: 96, dx: 58, dy: -34 };
  const STEP_ATOMS = [
    { x: -13, y: 0, r: 5.4, el: 'C' },
    { x: 13, y: 0, r: 5.2, el: 'O' },
  ];
  const arrowHead = (x: number, y: number, dx: number, dy: number, sz = 4) => {
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    return `M${x - ux * sz - uy * sz * 0.6},${y - uy * sz + ux * sz * 0.6} L${x},${y} L${x - ux * sz + uy * sz * 0.6},${y - uy * sz - ux * sz * 0.6}`;
  };

  /* ── The spread of speeds: Maxwell–Boltzmann, CO at 25 °C ── */
  // Most probable speed √(2kT/m) ≈ 421 m/s; mean √(8kT/πm) ≈ 475 m/s.
  const VP = 421;
  const MEAN = 475;
  const VMAX = 1500;
  const maxwell = (v: number) => (v / VP) ** 2 * Math.exp(-((v / VP) ** 2));
  const PEAK = maxwell(VP);
  $: curve = {
    x0: lerp(118, 60, t),
    x1: lerp(210, 440, t),
    base: lerp(86, 284, t),
    h: lerp(44, 74, t),
  };
  $: vx = (v: number) => curve.x0 + (v / VMAX) * (curve.x1 - curve.x0);
  $: vy = (v: number) => curve.base - (curve.h * maxwell(v)) / PEAK;
  $: curvePath = 'M' + Array.from({ length: 76 }, (_, i) => (i / 75) * VMAX)
    .map(v => `${vx(v).toFixed(1)},${vy(v).toFixed(1)}`)
    .join(' L');

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="CO travels as a whole along x, y and z, every atom moving by the same step; a gas of CO at 25 °C has a wide spread of speeds around a mean of about 475 m/s"
>
  <!-- ── Row 1: CO travelling along its axes ── -->
  <Axes3D x={co.x} y={co.y} len={lerp(30, 44, t)} active={axis} labels={t > 0.5} />
  <MiniMolecule atoms={coAtoms} bonds={CO_BOND} x={co.x} y={co.y} />
  <circle class="com" cx={co.x + com.x} cy={co.y + com.y} r="1.4" />

  <g style="opacity:{fullOpacity}">
    <!-- The same step for every atom: from the faint copy to the full one. -->
    <MiniMolecule atoms={STEP_ATOMS} bonds={CO_BOND} x={STEP.x} y={STEP.y} opacity={0.3} />
    <MiniMolecule atoms={STEP_ATOMS} bonds={CO_BOND} x={STEP.x + STEP.dx} y={STEP.y + STEP.dy} />
    {#each STEP_ATOMS as a}
      <line class="step" x1={STEP.x + a.x} y1={STEP.y + a.y + 9} x2={STEP.x + a.x + STEP.dx} y2={STEP.y + a.y + STEP.dy + 9} />
      <path class="step-head" d={arrowHead(STEP.x + a.x + STEP.dx, STEP.y + a.y + STEP.dy + 9, STEP.dx, STEP.dy)} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Free: Travel along x, y and z</text>
    <text class="lbl faint" x="14" y="160">three directions, every molecule</text>
    <text class="lbl" x="262" y="134">every atom, the same step:</text>
    <text class="lbl" x="262" y="150">shape and charge unchanged</text>
  </g>

  <!-- ── Row 2 (on the card, the small curve): the spread of speeds ── -->
  <line class="axis" x1={curve.x0} x2={curve.x1} y1={curve.base} y2={curve.base} />
  <path class="curve" d={curvePath} />
  <line class="mean" x1={vx(MEAN)} x2={vx(MEAN)} y1={curve.base} y2={vy(MEAN) - 4} />
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="188">How Fast: CO at 25 °C</text>
    <text class="lbl mean-lbl" x={vx(MEAN) + 6} y={vy(MEAN) - 8}>mean ≈ 475 m/s</text>
    {#each [0, 500, 1000, 1500] as v}
      <line class="axis" x1={vx(v)} x2={vx(v)} y1={curve.base} y2={curve.base + 4} />
      <text class="lbl faint" x={vx(v)} y={curve.base + 18} text-anchor="middle">{v}</text>
    {/each}
    <text class="lbl faint" x={curve.x1} y={curve.base + 34} text-anchor="end">speed / m s⁻¹</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .com { fill: var(--ink-slate-500); }
  .step, .step-head { fill: none; stroke: var(--accent-green-fg); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .curve { fill: none; stroke: var(--brand-700); stroke-width: 1.4; stroke-linejoin: round; }
  .mean { stroke: var(--accent-green-fg); stroke-width: 1.2; stroke-dasharray: 3 2; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.mean-lbl { fill: var(--accent-green-fg); }
</style>

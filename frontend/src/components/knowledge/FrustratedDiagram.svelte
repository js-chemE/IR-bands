<script lang="ts">
  /**
   * Frustrated motion: what a surface does to travelling and turning.
   *
   *   t = 0  the card: three CO molecules held on one surface, each doing
   *          one of the motions that were free in the gas: bouncing against
   *          the metal (the metal–carbon stretch, once travel along the
   *          normal), tilting (the frustrated rotation) and sliding (the
   *          frustrated translation).
   *   t = 1  the opened card, two rows:
   *            the three, labelled with what they were and where the atlas
   *              puts them, and whether IR in reflection off a metal sees
   *              them (only the one along the normal);
   *            the count for CO: free, 3 travel + 2 turn + 1 vibration;
   *              held, all 6 are vibrations.
   *
   * The wavenumbers are the atlas's own (data/vibrations.jsonc, CO on a
   * linear site).
   */
  import { onDestroy } from 'svelte';
  import MiniMolecule from './MiniMolecule.svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 344 };

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
  // The soft modes swing slowly; the slide, softest of all, slowest.
  $: bounce = running ? 3 * Math.sin(2 * Math.PI * 1.0 * time) : 0;
  $: tilt = running ? 24 * Math.sin(2 * Math.PI * 0.8 * time) : 14;
  $: slide = running ? 7 * Math.sin(2 * Math.PI * 0.5 * time) : 0;

  const HELD_CO = [
    { x: 0, y: 0, r: 5.4, el: 'C' },
    { x: 0, y: -26, r: 5.2, el: 'O' },
  ];
  const CO_BOND: [number, number][] = [[0, 1]];

  const MOTIONS = [
    { key: 'bounce', name: 'metal–carbon stretch', was: 'was: vertical travel', wn: '400–480 cm⁻¹', ir: true },
    { key: 'tilt', name: 'frustrated rotation', was: 'was: turning', wn: '400–600 cm⁻¹', ir: false },
    { key: 'slide', name: 'frustrated translation', was: 'was: travel, sideways', wn: '40–80 cm⁻¹', ir: false },
  ];
  $: surfY = lerp(84, 124, t);
  $: xs = [lerp(46, 80, t), lerp(110, 228, t), lerp(174, 388, t)];
  // The carbon sits a bond's length above the surface.
  $: cY = surfY - 9;

  const ROCK = (24 * Math.PI) / 180;
  const arc = (cx: number, cy: number) =>
    `M ${cx - 26 * Math.sin(ROCK)} ${cy - 26 * Math.cos(ROCK)} A 26 26 0 0 1 ${cx + 26 * Math.sin(ROCK)} ${cy - 26 * Math.cos(ROCK)}`;

  /* ── The count for CO ── */
  type Kind = 'T' | 'R' | 'V' | 'F';
  const FREE: Kind[] = ['T', 'T', 'T', 'R', 'R', 'V'];
  const HELD: Kind[] = ['F', 'F', 'F', 'F', 'F', 'V'];
  const BX = 150;
  // Pattern ids must be unique in the document; every instance gets its own.
  const uid = `fru${Math.random().toString(36).slice(2, 8)}`;
  const blockX = (i: number) => BX + i * 22 + (i >= 3 ? 8 : 0) + (i >= 5 ? 8 : 0);

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="CO held on a metal: its free travel and turning become the metal–carbon stretch, a frustrated rotation and a frustrated translation, vibrations of their own; only the one along the surface normal absorbs IR in reflection"
>
  <defs>
    <!-- Frustrated: hatched, so green stays for what is moving right now. -->
    <pattern id="{uid}-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect class="hatch-bg" width="4" height="4" />
      <line class="hatch" x1="0" y1="0" x2="0" y2="4" />
    </pattern>
  </defs>

  <!-- ── The surface ── -->
  <line class="surface" x1={lerp(14, 20, t)} x2={lerp(206, 460, t)} y1={surfY} y2={surfY} style="opacity:{1 - fullOpacity}" />
  <rect class="metal" x="20" y={surfY} width="440" height="14" style="opacity:{fullOpacity}" />

  <!-- Bounce: the whole molecule against the metal. -->
  <line class="anchor" x1={xs[0]} x2={xs[0]} y1={cY + 5 - bounce} y2={surfY} />
  <MiniMolecule atoms={HELD_CO} bonds={CO_BOND} x={xs[0]} y={cY - bounce} />
  <path class="hint" d="M {xs[0] + 12} {cY - 22} v 12 M {xs[0] + 9.5} {cY - 19} l 2.5 -3 l 2.5 3 M {xs[0] + 9.5} {cY - 13} l 2.5 3 l 2.5 -3" />

  <!-- Tilt: the axis rocking about the carbon. -->
  <path class="path" d={arc(xs[1], cY)} />
  <line class="anchor" x1={xs[1]} x2={xs[1]} y1={cY + 5} y2={surfY} />
  <MiniMolecule atoms={HELD_CO} bonds={CO_BOND} x={xs[1]} y={cY} rotate={tilt} />

  <!-- Slide: the whole molecule across the surface. -->
  <line class="anchor" x1={xs[2] + slide} x2={xs[2]} y1={cY + 5} y2={surfY} />
  <MiniMolecule atoms={HELD_CO} bonds={CO_BOND} x={xs[2] + slide} y={cY} />
  <path class="hint" d="M {xs[2] - 9} {cY - 36} h 18 M {xs[2] - 6} {cY - 38.5} l -3 2.5 l 3 2.5 M {xs[2] + 6} {cY - 38.5} l 3 2.5 l -3 2.5" />

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Held by One Bond: Three Motions That Were Free</text>
    {#each MOTIONS as m, i (m.key)}
      <text class="lbl strong" x={xs[i]} y={surfY + 32} text-anchor="middle">{m.name}</text>
      <text class="lbl faint" x={xs[i]} y={surfY + 48} text-anchor="middle">{m.was}</text>
      <text class="lbl" x={xs[i]} y={surfY + 64} text-anchor="middle">{m.wn}</text>
      <text class="verdict" class:yes={m.ir} x={xs[i]} y={surfY + 84} text-anchor="middle">
        {m.ir ? 'IR ✓ along the normal' : 'IR ✗ along the surface'}
      </text>
    {/each}
    <text class="lbl faint" x="14" y={surfY + 104}>verdicts for reflection off a metal (surface selection rule)</text>
  </g>

  <!-- ── Row 2: the count for CO ── -->
  <g style="opacity:{fullOpacity}">
    {#each FREE as k, i}
      <rect class="block {k}" x={blockX(i)} y="266" width="16" height="16" rx="2.9" />
    {/each}
    {#each HELD as k, i}
      <rect class="block {k}" x={blockX(i)} y="300" width="16" height="16" rx="2.9" fill={k === 'F' ? `url(#${uid}-hatch)` : null} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="250">Counting CO: 3N = 6</text>
    <text class="lbl" x="14" y="279">free gas</text>
    <text class="lbl" x="14" y="313">held on a metal</text>
    <text class="lbl strong" x="336" y="279">3N − 5 = 1 vibration</text>
    <text class="lbl strong" x="336" y="313">3N = 6 vibrations</text>
    <text class="lbl faint" x="14" y="338">open: travel or turn · filled: vibration · hatched: frustrated</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .surface { stroke: var(--line-slate-strong); stroke-width: 1.4; }
  .metal { fill: var(--line-slate); stroke: var(--line-slate-strong); stroke-width: 1; }
  .anchor { stroke: var(--ink-slate-400); stroke-width: 1.2; stroke-dasharray: 2 1.5; }
  .path { fill: none; stroke: var(--ink-slate-400); stroke-width: 1; stroke-dasharray: 3 2; stroke-opacity: 0.7; }
  .hint { fill: none; stroke: var(--ink-slate-400); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }

  /* The same blocks as the Normal Modes card; the frustrated ones hatched
     (the fill comes from the pattern), since green means "moving now". */
  .block { stroke-width: 1; }
  .block.T, .block.R { fill: var(--surface); stroke: var(--line-slate-strong); }
  .block.V { fill: var(--line-slate); stroke: var(--ink-025); }
  .block.F { stroke: var(--ink-025); }
  .hatch-bg { fill: var(--line-slate); }
  .hatch { stroke: var(--ink-slate-400); stroke-width: 1.2; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }

  .verdict {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-025);
  }
  .verdict.yes { fill: var(--diagram-photon); }
</style>

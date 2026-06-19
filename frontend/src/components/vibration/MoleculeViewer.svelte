<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { MoleculeGeometry, ModeVector } from '../../lib/moleculeGeometry';
  import { colorForElement, textColorForElement } from '../../lib/elementColors';

  export let geometry: MoleculeGeometry;
  export let activeVectors: ModeVector[] | null = null;

  // Bonds need their real endpoint positions recomputed every frame — a pure
  // CSS transform on a <line> can only translate/scale/rotate it as a rigid
  // whole, it can't make one end move differently from the other, so a bond
  // between two independently-moving atoms would stay parallel to its rest
  // orientation instead of tilting. Driving plain x/y attributes via rAF
  // sidesteps that entirely: each frame we just place the dot where the
  // vibration says it is, and the bond is drawn between wherever its two
  // atoms actually are right now.
  const PERIOD_MS = 1200;
  const AMPLITUDE = 6; // px of displacement at the oscillation's peak

  let phase = 0; // oscillates -1..1
  let rafId: number | null = null;
  let startTime = 0;

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tick(now: number) {
    if (!startTime) startTime = now;
    const t = (now - startTime) % PERIOD_MS;
    phase = Math.sin((2 * Math.PI * t) / PERIOD_MS);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId !== null || reduceMotion) return;
    startTime = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    phase = 0;
  }

  $: activeVectors ? start() : stop();

  onDestroy(stop);

  const BASE_R = 9;

  // x/y are the atom's real position — bonds always connect here, never to
  // a separate "anchor" point, so a bond can never drift off an atom's
  // center regardless of which mode (in-plane or out-of-plane) is active.
  $: positions = geometry.atoms.map((atom, i) => {
    const v = activeVectors?.[i] ?? { dx: 0, dy: 0 };
    const scale = v.scale ?? 0;
    return {
      element: atom.element,
      x: atom.x + v.dx * AMPLITUDE * phase,
      y: atom.y + v.dy * AMPLITUDE * phase,
      r: BASE_R * (1 + scale * phase),
    };
  });
</script>

<svg
  class="molecule-viewer"
  viewBox="-50 -40 100 80"
  role="img"
  aria-label="Molecule diagram{activeVectors ? ', vibrating' : ''}"
>
  {#each geometry.bonds as [a, b]}
    <line
      x1={positions[a].x} y1={positions[a].y}
      x2={positions[b].x} y2={positions[b].y}
      class="bond"
    />
  {/each}
  {#each positions as p}
    <circle cx={p.x} cy={p.y} r={p.r} fill={colorForElement(p.element)} class="atom" />
    <text
      x={p.x} y={p.y}
      class="atom-label"
      style="font-size: {7 * (p.r / BASE_R)}px"
      fill={textColorForElement(p.element)}
    >{p.element}</text>
  {/each}
</svg>

<style>
  .molecule-viewer {
    width: 180px;
    height: 144px;
    flex: 0 0 auto;
  }

  .bond {
    stroke: #999;
    stroke-width: 2;
  }

  .atom {
    stroke: rgba(0, 0, 0, 0.25);
    stroke-width: 1;
  }

  .atom-label {
    font-size: 7px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
</style>

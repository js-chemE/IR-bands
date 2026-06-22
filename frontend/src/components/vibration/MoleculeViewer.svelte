<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { MoleculeGeometry, ModeVector } from '../../lib/moleculeGeometry';
  import { colorForElement, textColorForElement, radiusForElement } from '../../lib/elementColors';

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

  // Reference: carbon's covalent radius (70pm) renders at 9px, so existing
  // diagrams don't change scale — other elements size relative to that, by
  // their own real covalent radius (e.g. O at 60pm comes out a bit smaller).
  const PX_PER_PM = 9 / 70;

  // x/y are the atom's real position — bonds always connect here, never to
  // a separate "anchor" point, so a bond can never drift off an atom's
  // center regardless of which mode (in-plane or out-of-plane) is active.
  $: positions = geometry.atoms.map((atom, i) => {
    const v = activeVectors?.[i] ?? { dx: 0, dy: 0 };
    const scale = v.scale ?? 0;
    const restR = radiusForElement(atom.element) * PX_PER_PM;
    let x: number, y: number;
    if (v.rotateDeg) {
      // Genuine rotation about `pivot` (defaulting to the origin) —
      // preserves distance from the pivot exactly (bond length), unlike a
      // dx/dy translation.
      const px = v.pivot?.x ?? 0, py = v.pivot?.y ?? 0;
      const theta = (v.rotateDeg * Math.PI / 180) * phase;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const rx = atom.x - px, ry = atom.y - py;
      x = px + rx * cos - ry * sin;
      y = py + rx * sin + ry * cos;
    } else {
      x = atom.x + v.dx * AMPLITUDE * phase;
      y = atom.y + v.dy * AMPLITUDE * phase;
    }
    return { element: atom.element, x, y, r: restR * (1 + scale * phase), restR };
  });
</script>

<svg
  class="molecule-viewer"
  viewBox="-50 -52 100 104"
  role="img"
  aria-label="Molecule diagram{activeVectors ? ', vibrating' : ''}"
>
  {#if geometry.surface}
    <line x1={-44} y1={geometry.surface.y} x2={44} y2={geometry.surface.y} class="surface-line" />
    {#each geometry.surface.boundAtoms as anchor}
      {#each anchor.offsets as offset}
        <line
          x1={positions[anchor.atomIndex].x} y1={positions[anchor.atomIndex].y}
          x2={geometry.atoms[anchor.atomIndex].x + offset} y2={geometry.surface.y}
          class="surface-bond"
        />
      {/each}
    {/each}
  {/if}
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
      style="font-size: {7 * (p.r / p.restR)}px"
      fill={textColorForElement(p.element)}
    >{p.element}</text>
  {/each}
</svg>

<style>
  .molecule-viewer {
    width: 180px;
    height: 187px;
    flex: 0 0 auto;
  }

  .bond {
    stroke: #999;
    stroke-width: 2;
  }

  .surface-line {
    stroke: #aaa;
    stroke-width: 1.5;
  }

  .surface-bond {
    stroke: #aaa;
    stroke-width: 1;
    stroke-dasharray: 2.5, 2.5;
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

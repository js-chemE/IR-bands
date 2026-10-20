<script lang="ts">
  // A real 3D molecule (lib/molecule3d.ts) vibrating along its CCCBDB normal
  // mode. Same footprint, viewBox and timing as the hand-drawn
  // MoleculeViewer; geometry and motion are computed, not authored, and
  // atoms and bonds take phd_ui's look (see lib/molecule3d.ts).
  // With `interactive`, dragging turns the molecule and a double-click puts
  // it back to its default view.
  import { onDestroy } from 'svelte';
  import {
    frame, IDENTITY, mul, tip, turn, viewRotation, atomStyle, ATOM_EDGE_WIDTH, BOND_COLOR,
    SURFACE_BOND, SLAB, PT,
    type Mat3, type Model3D,
  } from '../../lib/molecule3d';

  export let model: Model3D;
  /** The mode to animate, or null to stand still. */
  export let modeId: string | null = null;
  export let size = 180;
  export let depthCue = 0.2;
  export let interactive = false;

  // Timing and amplitude as in MoleculeViewer.
  const PERIOD_MS = 1200;
  const AMPLITUDE = 6;            // viewBox units of travel for the most-moving atom
  // One scale for positions and balls, as in phd_ui; molecules that would not
  // fit (I2) are shrunk as a whole.
  const PX_PER_PM = 0.32;
  const HALF_BOX = 46;

  let phase = 0;
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
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    phase = 0;
  }
  $: active = !!(modeId && model.modes[modeId]);
  $: active ? start() : stop();
  onDestroy(stop);

  // --- drag to turn -------------------------------------------------------
  // Gas molecules turn freely; an adsorbate only about the surface normal.
  let rotation: Mat3 = IDENTITY;
  let userTurn = 0;
  let lastModel: Model3D | null = null;
  $: if (model !== lastModel) { lastModel = model; rotation = IDENTITY; userTurn = 0; }

  let dragging = false;
  let lastX = 0, lastY = 0;
  const DEG_PER_PX = 0.6;
  function down(e: PointerEvent) {
    if (!interactive) return;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    // Drag right: the front swings right. Drag down: the top comes forward.
    if (model.surface) userTurn -= dx * DEG_PER_PX;
    else rotation = mul(tip(dy * DEG_PER_PX), mul(turn(-dx * DEG_PER_PX), rotation));
  }
  function up() { dragging = false; }
  function reset() { if (interactive) { rotation = IDENTITY; userTurn = 0; } }

  $: items = frame(model, {
    rotation: viewRotation(model, rotation, userTurn),
    modeId: active ? modeId : null,
    phase,
    depthCue,
    maxPxPerPm: PX_PER_PM,
    amplitudePx: AMPLITUDE,
    halfBox: HALF_BOX,
  });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<svg
  class="molecule-viewer"
  class:interactive
  class:dragging
  viewBox="-50 -52 100 104"
  style="width:{size}px; height:{size * 1.04}px;"
  role="img"
  aria-label="Molecule diagram{active ? ', vibrating' : ''}{interactive ? ', drag to turn' : ''}"
  on:pointerdown={down}
  on:pointermove={move}
  on:pointerup={up}
  on:pointercancel={up}
  on:dblclick={reset}
>
  {#if interactive}<title>Drag to turn, double-click to reset</title>{/if}
  {#each items as it}
    {#if it.kind === 'plane'}
      <polygon points={it.points} fill={SLAB.fill} />
      <line x1={it.front.x1} y1={it.front.y1} x2={it.front.x2} y2={it.front.y2} stroke={SLAB.edge} stroke-width={1.5} />
    {:else if it.kind === 'surface-bond'}
      <line
        x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2}
        stroke={SURFACE_BOND.color}
        stroke-width={SURFACE_BOND.widthPt * PT}
        stroke-dasharray={SURFACE_BOND.dash.map(d => d * SURFACE_BOND.widthPt * PT).join(' ')}
      />
    {:else if it.kind === 'bond'}
      {#each it.lines as l}
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} class="bond" stroke={BOND_COLOR} stroke-width={it.width} />
      {/each}
    {:else}
      <circle
        cx={it.x} cy={it.y} r={it.r}
        fill={atomStyle(it.element).fill}
        stroke={atomStyle(it.element).edge}
        stroke-width={ATOM_EDGE_WIDTH}
      />
      <text
        x={it.x} y={it.y}
        class="atom-label"
        style="font-size: {7 * (it.r / it.rRest)}px"
        fill={atomStyle(it.element).text}
      >{it.element}</text>
    {/if}
  {/each}
</svg>

<style>
  .molecule-viewer {
    flex: 0 0 auto;
  }
  .molecule-viewer.interactive {
    cursor: grab;
    touch-action: none;
  }
  .molecule-viewer.dragging {
    cursor: grabbing;
  }

  /* Colours and widths come from lib/molecule3d.ts (phd_ui's look). */
  .bond {
    stroke-linecap: butt;
  }

  .atom-label {
    font-size: 8px;
    font-weight: 700;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
    user-select: none;
  }
</style>

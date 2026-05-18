<script lang="ts">
  import { onMount } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap } from '../lib/types';
  import { buildChart } from '../lib/chart';
  import { axisRange, valueToWn } from '../lib/units';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let enabledGroups: ReadonlySet<string>;
  export let hiddenCats: ReadonlySet<string>;
  export let colorDim: ColorDim;
  export let axisProperty: AxisProperty;
  export let axisUnit: string;

  let container: HTMLDivElement;
  let containerWidth = 1100;

  // Zoom stored canonically in wavenumber [lo, hi] cm⁻¹ (lo < hi).
  // Converting to the current axis on render means zoom persists across axis switches.
  let wnOverride: [number, number] | null = null;

  // Convert wnOverride to the current axis domain for rendering / interaction
  $: xDomainForChart = wnOverride
    ? (axisRange(wnOverride[0], wnOverride[1], axisProperty, axisUnit) as [number, number])
    : undefined;

  $: if (container) {
    const chart = buildChart(
      bands, groups, enabledGroups, hiddenCats,
      colorDim, axisProperty, axisUnit, refs,
      containerWidth,
      xDomainForChart,
    );
    container.replaceChildren(chart);
  }

  onMount(() => {
    containerWidth = container.clientWidth || 1100;
    const observer = new ResizeObserver(entries => {
      containerWidth = Math.floor(entries[0].contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  // ---------------------------------------------------------------------------
  // Zoom / pan — stored in wavenumber, reset only on explicit user action
  // ---------------------------------------------------------------------------

  const MARGIN_LEFT = 200;
  const MARGIN_RIGHT = 20;

  function currentDomain(): [number, number] {
    return xDomainForChart ?? (axisRange(450, 4050, axisProperty, axisUnit) as [number, number]);
  }

  function domainToWnRange(d0: number, d1: number): [number, number] {
    const a = valueToWn(d0, axisProperty, axisUnit);
    const b = valueToWn(d1, axisProperty, axisUnit);
    return [Math.min(a, b), Math.max(a, b)];
  }

  const MIN_WN_SPAN = 50;
  const MAX_WN = 12000;

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const domain = currentDomain();
    const plotWidth = containerWidth - MARGIN_LEFT - MARGIN_RIGHT;
    const rect = container.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left - MARGIN_LEFT) / plotWidth));

    const pivot = domain[0] + t * (domain[1] - domain[0]);
    // Clamp deltaY — prevents one large scroll event from jumping across the spectrum
    const factor = Math.pow(1.002, Math.max(-200, Math.min(200, e.deltaY)));
    const d0 = pivot + (domain[0] - pivot) * factor;
    const d1 = pivot + (domain[1] - pivot) * factor;

    const wn0 = valueToWn(d0, axisProperty, axisUnit);
    const wn1 = valueToWn(d1, axisProperty, axisUnit);
    const lo = Math.max(1, Math.min(wn0, wn1));
    const hi = Math.min(MAX_WN, Math.max(wn0, wn1));
    if (hi - lo < MIN_WN_SPAN) return; // at minimum zoom — ignore
    wnOverride = [lo, hi];
  }

  // Middle-mouse-button drag to pan — keeps left-click free for Observable Plot's tip
  let isPanning = false;
  let panStartClientX = 0;
  let panStartDomain: [number, number] = [0, 0];

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 1) return; // middle button only
    e.preventDefault(); // stop browser auto-scroll cursor
    isPanning = true;
    panStartClientX = e.clientX;
    panStartDomain = currentDomain();
    container.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning) return;
    const plotWidth = containerWidth - MARGIN_LEFT - MARGIN_RIGHT;
    const dx = (e.clientX - panStartClientX) / plotWidth;
    const span = panStartDomain[1] - panStartDomain[0];
    wnOverride = domainToWnRange(
      panStartDomain[0] - dx * span,
      panStartDomain[1] - dx * span,
    );
  }

  function onPointerUp() { isPanning = false; }

  function resetZoom() { wnOverride = null; }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="wrap">
  {#if wnOverride}
    <button class="reset-btn" on:click={resetZoom} title="Reset zoom (or double-click chart)">
      ↩ Reset zoom
    </button>
  {/if}

  <div
    bind:this={container}
    class="chart"
    class:panning={isPanning}
    on:wheel|nonpassive={onWheel}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:dblclick={resetZoom}
  ></div>
</div>

<style>
  .wrap { position: relative; width: 100%; }

  .reset-btn {
    position: absolute;
    top: 8px;
    right: 28px;
    z-index: 10;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 12px;
    cursor: pointer;
    color: #444;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .reset-btn:hover { background: #f5f5f5; }

  .chart {
    width: 100%;
    cursor: crosshair;
    user-select: none;
  }
  .chart.panning { cursor: grabbing; }
  .chart :global(svg) { max-width: 100%; overflow: visible; }
</style>

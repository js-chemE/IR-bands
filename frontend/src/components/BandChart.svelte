<script lang="ts">
  import { onMount } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap } from '../lib/types';
  import { buildChart } from '../lib/chart';
  import type { TipData } from '../lib/chart';
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
  let wnOverride: [number, number] | null = null;

  $: xDomainForChart = wnOverride
    ? (axisRange(wnOverride[0], wnOverride[1], axisProperty, axisUnit) as [number, number])
    : undefined;

  // ---------------------------------------------------------------------------
  // Tooltip state
  // ---------------------------------------------------------------------------
  let hovered: { tipData: TipData; color: string } | null = null;
  let mouseX = 0;
  let mouseY = 0;
  let tipH = 0;

  const TIP_W = 300;
  $: flipLeft = mouseX + 18 + TIP_W > (typeof window !== 'undefined' ? window.innerWidth : 1200);
  $: tipX = flipLeft ? mouseX - 16 : mouseX + 18;
  $: tipTransform = flipLeft ? 'translateX(-100%)' : 'none';
  // Shift tooltip up so its bottom stays within the viewport; the cursor anchor
  // point slides down the left border naturally as the tooltip moves up.
  $: tipY = Math.max(10, Math.min(mouseY - 8, (typeof window !== 'undefined' ? window.innerHeight - tipH - 10 : 800)));

  // ---------------------------------------------------------------------------
  // Chart build
  // ---------------------------------------------------------------------------
  $: if (container) {
    hovered = null;
    const chart = buildChart(
      bands, groups, enabledGroups, hiddenCats,
      colorDim, axisProperty, axisUnit, refs,
      containerWidth,
      xDomainForChart,
    );
    container.replaceChildren(chart);

    // Observable Plot fires 'input' on the SVG when the pointer selection changes
    chart.addEventListener('input', () => {
      const val = (chart as any).value as { tipData: TipData; color: string } | undefined;
      hovered = val ?? null;
    });
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
  // Zoom / pan
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
    const factor = Math.pow(1.002, Math.max(-200, Math.min(200, e.deltaY)));
    const d0 = pivot + (domain[0] - pivot) * factor;
    const d1 = pivot + (domain[1] - pivot) * factor;

    const wn0 = valueToWn(d0, axisProperty, axisUnit);
    const wn1 = valueToWn(d1, axisProperty, axisUnit);
    const lo = Math.max(1, Math.min(wn0, wn1));
    const hi = Math.min(MAX_WN, Math.max(wn0, wn1));
    if (hi - lo < MIN_WN_SPAN) return;
    wnOverride = [lo, hi];
  }

  let isPanning = false;
  let panStartClientX = 0;
  let panStartDomain: [number, number] = [0, 0];

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 1) return;
    e.preventDefault();
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
    on:mousemove={e => { mouseX = e.clientX; mouseY = e.clientY; }}
    on:mouseleave={() => { hovered = null; }}
  ></div>

  {#if hovered}
    {@const td = hovered.tipData}
    <div
      class="band-tooltip"
      bind:clientHeight={tipH}
      style="left:{tipX}px; top:{tipY}px; transform:{tipTransform}; border-top-color:{hovered.color};"
    >
      <!-- Header -->
      <div class="tip-header" style="border-left-color:{hovered.color}">
        <div class="tip-name">{td.name}</div>
        <div class="tip-vib">{td.vib}</div>
        <div class="tip-wn">{td.wnRange}</div>
        <div class="tip-group" style="color:{hovered.color}">{td.group}</div>
      </div>

      <!-- Quality tags -->
      {#if td.noteLines.length}
        <div class="tip-tags">
          {#each td.noteLines as tag}<span class="tip-tag">{tag}</span>{/each}
        </div>
      {/if}

      <!-- General description -->
      {#if td.description}
        <div class="tip-desc">{td.description}</div>
      {/if}

      <!-- Per-reference boxes -->
      {#if td.refs.length}
        <div class="tip-refs-section">
          <div class="tip-refs-header">References</div>
          {#each td.refs as ref}
            <div class="tip-ref-box">
              <div class="tip-ref-title">{ref.short}</div>
              {#if ref.wn != null || ref.site}
                <div class="tip-ref-badges">
                  {#if ref.wn != null}
                    <span class="badge-wn">{ref.wn} cm⁻¹</span>
                  {/if}
                  {#if ref.site}
                    {#if Array.isArray(ref.site)}
                      {#each ref.site as s}
                        <span class="badge-site">{s}</span>
                      {/each}
                    {:else}
                      <span class="badge-site">{ref.site}</span>
                    {/if}
                  {/if}
                </div>
              {/if}
              {#if ref.note}
                <div class="tip-ref-note">{ref.note}</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
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

  /* ── HTML tooltip ── */
  .band-tooltip {
    position: fixed;
    z-index: 200;
    pointer-events: none;
    background: #fff;
    border: 1px solid #ddd;
    border-top: 3px solid #888; /* overridden inline with band color */
    border-radius: 6px;
    padding: 8px 10px;
    width: 300px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 12px;
    line-height: 1.4;
    box-shadow: 0 4px 16px rgba(0,0,0,0.13);
  }

  .tip-header {
    border-left: 3px solid #888; /* overridden inline */
    padding-left: 7px;
    margin-bottom: 6px;
  }
  .tip-name {
    font-size: 13px;
    font-weight: 700;
    color: #111;
    line-height: 1.2;
  }
  .tip-vib {
    font-size: 10.5px;
    color: #777;
    margin-top: 1px;
  }
  .tip-wn {
    font-size: 11px;
    color: #333;
    font-family: 'Courier New', monospace;
    margin-top: 1px;
  }
  .tip-group {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 3px;
  }

  .tip-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 5px;
  }
  .tip-tag {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 10px;
    color: #555;
  }

  .tip-desc {
    font-size: 11px;
    color: #555;
    line-height: 1.4;
    margin-bottom: 6px;
    padding-bottom: 5px;
    border-bottom: 1px solid #eee;
  }

  .tip-refs-section { margin-top: 2px; }

  .tip-refs-header {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #999;
    margin-bottom: 4px;
  }

  .tip-ref-box {
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 5px 7px;
    margin-top: 4px;
  }

  .tip-ref-title {
    font-size: 11px;
    font-weight: 600;
    color: #222;
  }

  .tip-ref-badges {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .badge-wn {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }

  .badge-site {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #78350f;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10.5px;
    white-space: nowrap;
  }

  .tip-ref-note {
    font-size: 10.5px;
    color: #6b7280;
    font-style: italic;
    margin-top: 4px;
    line-height: 1.35;
  }
</style>

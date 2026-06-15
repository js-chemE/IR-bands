<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap } from '../lib/types';
  import { buildChart, TAG_STYLES } from '../lib/chart';
  import type { TipData, PlotBandHit } from '../lib/chart';
  import { axisRange, valueToWn } from '../lib/units';
  import { getCat } from '../lib/colors';

  const dispatch = createEventDispatcher<{ navigateRef: { key: string } }>();

  function goToRef(key: string) {
    selected = null;
    selectedId = null;
    dispatch('navigateRef', { key });
  }

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let enabledGroups: ReadonlySet<string>;
  export let hiddenCats: ReadonlySet<string>;
  export let hiddenTags: ReadonlySet<string>;
  export let colorDim: ColorDim;
  export let axisProperty: AxisProperty;
  export let axisUnit: string;
  export let hoveredCat: string | null = null;
  export let hoveredTag: string | null = null;

  const HIT_PAD = 3; // must match chart.ts

  $: highlightedHits = hoveredCat
    ? hitBands.filter(h => {
        const b = bands.find(b => b.id === h.tipData.id);
        return b ? getCat(b, colorDim) === hoveredCat : false;
      })
    : hoveredTag
      ? hitBands.filter(h => h.tipData.tags.includes(hoveredTag!))
      : [];

  let container: HTMLDivElement;
  let containerWidth = 1100;

  // Zoom stored canonically in wavenumber [lo, hi] cm⁻¹ (lo < hi).
  let wnOverride: [number, number] | null = null;

  $: xDomainForChart = wnOverride
    ? (axisRange(wnOverride[0], wnOverride[1], axisProperty, axisUnit) as [number, number])
    : undefined;

  // ---------------------------------------------------------------------------
  // Chart build — returns svg + pixel hit rects
  // ---------------------------------------------------------------------------
  let hitBands: PlotBandHit[] = [];
  let chartSvgHeight = 0;

  $: if (container) {
    hovered = null;
    const result = buildChart(
      bands, groups, enabledGroups, hiddenCats, hiddenTags,
      colorDim, axisProperty, axisUnit, refs,
      containerWidth,
      xDomainForChart,
    );
    container.replaceChildren(result.svg);
    hitBands = result.hitBands;
    chartSvgHeight = result.chartHeight;
    // Re-anchor selected band to the freshly-built hit rects (survives zoom/pan)
    if (selectedId) {
      selected = hitBands.find(h => h.tipData.id === selectedId) ?? null;
      if (!selected) selectedId = null;
    }
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
  // Tooltip / hover / select state
  // ---------------------------------------------------------------------------
  let hovered: PlotBandHit | null = null;
  let selected: PlotBandHit | null = null;
  let selectedId: string | null = null;  // band.id — survives chart rebuilds

  let mouseX = 0;
  let mouseY = 0;
  let selectedTipX = 0;  // viewport coords captured at click time
  let selectedTipY = 0;
  let tipH = 0;

  $: shown = selected ?? hovered;

  // Selected tooltip stays at click position; hover tooltip follows the mouse.
  const TIP_W = 300;
  $: _anchorX = selected ? selectedTipX : mouseX;
  $: _anchorY = selected ? selectedTipY : mouseY;
  $: flipLeft = _anchorX + 18 + TIP_W > (typeof window !== 'undefined' ? window.innerWidth : 1200);
  $: tipX = flipLeft ? _anchorX - 16 : _anchorX + 18;
  $: tipTransform = flipLeft ? 'translateX(-100%)' : 'none';
  $: tipY = Math.max(10, Math.min(_anchorY - 8, (typeof window !== 'undefined' ? window.innerHeight - tipH - 10 : 800)));

  // ---------------------------------------------------------------------------
  // Chart layout constants (must match chart.ts)
  // ---------------------------------------------------------------------------
  const ML = 200, MR = 20, MT = 30, MB = 50;

  // ---------------------------------------------------------------------------
  // Interaction state
  // ---------------------------------------------------------------------------
  type Zone = 'none' | 'band' | 'axis' | 'plot';
  let zone: Zone = 'none';
  let isPanning = false;
  let isScaling = false;

  $: activeCursor = isPanning   ? 'grabbing'
                  : isScaling  ? 'ew-resize'
                  : zone === 'band' ? 'pointer'
                  : zone === 'axis' ? 'ew-resize'
                  : 'default';

  // Pan
  let panStartClientX = 0;
  let panStartDomain: [number, number] = [0, 0];

  // Scale (drag on x-axis)
  let scaleStartClientX = 0;
  let scaleStartDomain: [number, number] = [0, 0];
  let scalePivot = 0;

  // Click vs drag detection
  let downPos: { x: number; y: number } | null = null;
  const CLICK_THRESH = 5;

  const MIN_WN_SPAN = 50;
  const MAX_WN = 12000;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getSvgPos(e: PointerEvent | MouseEvent) {
    const rect = container.getBoundingClientRect();
    return { svgX: e.clientX - rect.left, svgY: e.clientY - rect.top };
  }

  function hitTest(svgX: number, svgY: number): PlotBandHit | null {
    for (let i = hitBands.length - 1; i >= 0; i--) {
      const b = hitBands[i];
      if (svgX >= b.px1 && svgX <= b.px2 && svgY >= b.py1 && svgY <= b.py2) return b;
    }
    return null;
  }

  function detectZone(svgX: number, svgY: number): Zone {
    const innerW = containerWidth - ML - MR;
    const inXBand = svgX >= ML && svgX <= ML + innerW;
    if (inXBand && svgY >= chartSvgHeight - MB - 8) return 'axis';
    if (inXBand && svgY >= MT && svgY < chartSvgHeight - MB) {
      return hitTest(svgX, svgY) ? 'band' : 'plot';
    }
    return 'none';
  }

  function currentDomain(): [number, number] {
    return xDomainForChart ?? (axisRange(450, 4050, axisProperty, axisUnit) as [number, number]);
  }

  function domainToWnRange(d0: number, d1: number): [number, number] {
    const a = valueToWn(d0, axisProperty, axisUnit);
    const b = valueToWn(d1, axisProperty, axisUnit);
    return [Math.min(a, b), Math.max(a, b)];
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onPointerMove(e: PointerEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (isPanning) {
      const plotWidth = containerWidth - ML - MR;
      const dx = (e.clientX - panStartClientX) / plotWidth;
      const span = panStartDomain[1] - panStartDomain[0];
      const [lo, hi] = domainToWnRange(
        panStartDomain[0] - dx * span,
        panStartDomain[1] - dx * span,
      );
      wnOverride = [Math.max(1, lo), Math.min(MAX_WN, hi)];
      return;
    }

    if (isScaling) {
      const dx = e.clientX - scaleStartClientX;
      const factor = Math.exp(-dx * 0.006);
      const d0 = scalePivot + (scaleStartDomain[0] - scalePivot) * factor;
      const d1 = scalePivot + (scaleStartDomain[1] - scalePivot) * factor;
      const [lo, hi] = domainToWnRange(d0, d1);
      const loC = Math.max(1, lo), hiC = Math.min(MAX_WN, hi);
      if (hiC - loC >= MIN_WN_SPAN) wnOverride = [loC, hiC];
      return;
    }

    const { svgX, svgY } = getSvgPos(e);
    zone = detectZone(svgX, svgY);
    hovered = zone === 'band' ? hitTest(svgX, svgY) : null;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    const { svgX, svgY } = getSvgPos(e);
    const z = detectZone(svgX, svgY);
    if (z === 'none') return;

    downPos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    container.setPointerCapture(e.pointerId);

    if (e.button === 0) {
      if (z === 'axis') {
        const domain = currentDomain();
        const t = Math.max(0, Math.min(1, (svgX - ML) / (containerWidth - ML - MR)));
        scalePivot = domain[0] + t * (domain[1] - domain[0]);
        scaleStartClientX = e.clientX;
        scaleStartDomain = domain;
        isScaling = true;
      } else if (z === 'plot') {
        isPanning = true;
        panStartClientX = e.clientX;
        panStartDomain = currentDomain();
      }
      // z === 'band': wait for pointerup to register as click
    } else if (e.button === 1) {
      isPanning = true;
      panStartClientX = e.clientX;
      panStartDomain = currentDomain();
    }
  }

  function onPointerUp(e: PointerEvent) {
    const wasClick = downPos
      && Math.abs(e.clientX - downPos.x) < CLICK_THRESH
      && Math.abs(e.clientY - downPos.y) < CLICK_THRESH;

    if (wasClick && e.button === 0) {
      const { svgX, svgY } = getSvgPos(e);
      const hit = hitTest(svgX, svgY);
      if (hit) {
        selected = hit;
        selectedId = hit.tipData.id;
        selectedTipX = e.clientX;
        selectedTipY = e.clientY;
      } else {
        selected = null;
        selectedId = null;
      }
    }

    isPanning = false;
    isScaling = false;
    downPos = null;
  }

  function onPointerLeave() {
    if (!isPanning && !isScaling) {
      hovered = null;
      zone = 'none';
    }
  }

  function resetZoom() { wnOverride = null; }

  function onDblClick(e: MouseEvent) {
    const { svgX, svgY } = getSvgPos(e);
    if (!hitTest(svgX, svgY)) resetZoom();
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="wrap">
  {#if wnOverride}
    <button class="reset-btn" on:click={resetZoom} title="Reset zoom (or double-click empty area)">
      ↩ Reset zoom
    </button>
  {/if}

  <div
    bind:this={container}
    class="chart"
    style="cursor: {activeCursor}"
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointerleave={onPointerLeave}
    on:dblclick={onDblClick}
  ></div>

  <!-- highlight overlay: glowing rects for hovered legend category -->
  {#if highlightedHits.length > 0}
    <svg class="highlight-overlay"
         width={containerWidth}
         height={chartSvgHeight}
         style="pointer-events:none;">
      <defs>
        <!-- dark outer shadow -->
        <filter id="shadow-blur" x="-120%" y="-300%" width="340%" height="700%">
          <feGaussianBlur stdDeviation="9"/>
        </filter>
        <!-- soft coloured inner glow -->
        <filter id="glow-blur" x="-80%" y="-200%" width="260%" height="500%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      {#each highlightedHits as hit}
        {@const x = hit.px1}
        {@const y = hit.py1 + HIT_PAD}
        {@const w = Math.max(1, hit.px2 - hit.px1)}
        {@const h = Math.max(1, hit.py2 - hit.py1 - HIT_PAD * 2)}
        <!-- dark shadow ring (outermost) -->
        <rect {x} {y} width={w} height={h}
              fill="rgba(0,0,0,0.32)"
              filter="url(#shadow-blur)"/>
        <!-- coloured glow halo -->
        <rect {x} {y} width={w} height={h}
              fill={hit.color} opacity="0.75"
              filter="url(#glow-blur)"/>
        <!-- solid band on top with white rim -->
        <rect {x} {y} width={w} height={h}
              fill={hit.color} opacity="1"
              stroke="white" stroke-width="1.5" rx="0.5"/>
      {/each}
    </svg>
  {/if}

  {#if shown}
    {@const td = shown.tipData}
    <div
      class="band-tooltip"
      class:is-selected={!!selected}
      bind:clientHeight={tipH}
      style="left:{tipX}px; top:{tipY}px; transform:{tipTransform}; border-top-color:{shown.color}; pointer-events:{selected ? 'auto' : 'none'};"
    >
      <!-- Header -->
      <div class="tip-header" style="border-left-color:{shown.color}">
        <div class="tip-name">{td.name}</div>
        <div class="tip-vib">{td.vib}</div>
        <div class="tip-wn">{td.wnRange}</div>
        <div class="tip-group" style="color:{shown.color}">{td.group}</div>
      </div>

      <!-- Quality tags -->
      {#if td.noteLines.length || td.tags.length}
        <div class="tip-tags">
          {#each td.noteLines as tag}<span class="tip-tag">{tag}</span>{/each}
          {#each td.tags as tag}
            {@const style = TAG_STYLES[tag]}
            <span
              class="tip-tag tip-tag-extra"
              style={style ? `background:${style.background};border-color:${style.border};color:${style.color}` : ''}
            >{tag}</span>
          {/each}
        </div>
      {/if}

      <!-- General description -->
      {#if td.description}
        <div class="tip-desc">{td.description}</div>
      {/if}

      <!-- Per-reference boxes -->
      {#if td.refs.length}
        <div class="tip-refs-section">
          <div class="tip-refs-header">
            References
            {#if !selected && td.refs.length > 3}
              <span class="tip-refs-overflow">+{td.refs.length - 3} more · click band</span>
            {/if}
          </div>

          {#if selected}
            <!-- Frozen: all refs, scrollable, each clickable to jump to ref page -->
            <div class="tip-refs-scroll">
              {#each td.refs as ref}
                <button class="tip-ref-box tip-ref-btn" on:click={() => goToRef(ref.key)} title="Open in References page">
                  <div class="tip-ref-title">{ref.short} <span class="tip-ref-arrow">↗</span></div>
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
                </button>
              {/each}
            </div>
          {:else}
            <!-- Hover: first 3 refs only, not clickable -->
            {#each td.refs.slice(0, 3) as ref}
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
          {/if}
        </div>
      {/if}

      {#if selected}
        <div class="tip-lock-hint">click ref ↗ to open · click band to switch · click empty to dismiss</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; width: 100%; }

  .highlight-overlay {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    z-index: 5;
  }

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
    user-select: none;
  }
  .chart :global(svg) { max-width: 100%; overflow: visible; }

  /* ── HTML tooltip ── */
  .band-tooltip {
    position: fixed;
    z-index: 200;
    pointer-events: none; /* overridden to auto when selected — see inline style */
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
  .band-tooltip.is-selected {
    box-shadow: 0 4px 20px rgba(0,0,0,0.22);
    border-color: #bbb;
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
  .tip-tag-extra {
    background: #f9fafb;
    border-color: #eaecef;
    color: #8a8f98;
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
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .tip-refs-overflow {
    font-size: 9px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #bbb;
  }

  .tip-refs-scroll {
    max-height: 240px;
    overflow-y: auto;
    overflow-x: hidden;
    border-radius: 3px;
  }
  .tip-refs-scroll::-webkit-scrollbar { width: 4px; }
  .tip-refs-scroll::-webkit-scrollbar-thumb { background: #d0c9bc; border-radius: 2px; }

  .tip-ref-box {
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 5px 7px;
    margin-top: 4px;
  }

  /* Clickable ref box (selected mode) */
  .tip-ref-btn {
    display: block;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: background 0.1s, border-left-color 0.1s;
  }
  .tip-ref-btn:hover {
    background: #f0ece4;
    border-left-color: #a08050;
  }
  .tip-ref-btn:hover .tip-ref-arrow { opacity: 1; }

  .tip-ref-arrow {
    font-size: 9px;
    color: #a08050;
    opacity: 0;
    transition: opacity 0.1s;
    margin-left: 3px;
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

  .tip-lock-hint {
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px solid #eee;
    font-size: 9.5px;
    color: #aaa;
    text-align: center;
  }
</style>

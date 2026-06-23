<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap } from '../lib/types';
  import { buildChart } from '../lib/chart';
  import type { TipData, PlotBandHit } from '../lib/chart';
  import { axisRange, valueToWn } from '../lib/units';
  import { getCat, TAG_STYLES, DEFAULT_TAG_STYLE } from '../lib/colors';

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
  // Set by a parent that wants to jump straight to one band (e.g. clicking
  // a band card on the Vibration Modes page) — `nonce` forces re-application
  // even if the same band is focused twice in a row, since plain reactivity
  // wouldn't notice an unchanged id.
  export let focusBand: { id: string; nonce: number } | null = null;

  const HIT_PAD = 3; // must match chart.ts

  $: highlightedHits = hoveredCat
    ? hitBands.filter(h => {
        const b = bands.find(b => b.id === h.tipData.id);
        return b ? getCat(b, colorDim) === hoveredCat : false;
      })
    : hoveredTag
      ? hitBands.filter(h => h.tipData.tags.includes(hoveredTag!))
      : [];

  // The "active" band for partner highlighting: a frozen selection takes
  // precedence over a live hover — same precedence the tooltip itself uses
  // (see `shown` below) — so the glow/connectors stay put once you click,
  // even after the mouse moves off the band.
  $: active = selected ?? hovered;

  // Resolve a band id to a hit, even if it's not currently drawn (hidden by
  // a category/tag filter, or panned/zoomed out of view) — falls back to
  // chart.ts's allPositions so a connector can still reach it "as it would
  // be". Synthetic hits are zero-size and carry only what connectors need
  // (position + branchGroup); they're never glow-highlighted (see glowHits).
  function findHitOrSynthetic(id: string): { hit: PlotBandHit; real: boolean } | null {
    const real = hitBands.find(h => h.tipData.id === id);
    if (real) return { hit: real, real: true };
    const pos = allPositions[id];
    if (!pos) return null;
    const band = bands.find(b => b.id === id);
    if (!band) return null;
    const synthetic: PlotBandHit = {
      px1: pos.px, px2: pos.px, py1: pos.py, py2: pos.py,
      color: '#999',
      tipData: {
        id: band.id, name: '', vib: '', wnRange: '', group: '', color: '#999',
        noteLines: [], tags: [], description: '', refs: [], partners: [],
        branchGroup: band.branch_group ?? null,
      },
    };
    return { hit: synthetic, real: false };
  }

  // Every member of one band's branch_group (real or synthetic), or just the
  // band itself if it isn't part of one. Lets fermi/based_on connectors
  // anchor on a single "center" point per vibration instead of fanning out
  // to every individual rotational branch.
  function groupHits(hit: PlotBandHit): PlotBandHit[] {
    const bg = hit.tipData.branchGroup;
    if (!bg) return [hit];
    const memberIds = bands.filter(b => b.branch_group === bg).map(b => b.id);
    const resolved = memberIds
      .map(id => findHitOrSynthetic(id)?.hit)
      .filter((h): h is PlotBandHit => !!h);
    return resolved.length ? resolved : [hit];
  }
  function groupCenter(hits: PlotBandHit[]) {
    const x = hits.reduce((s, h) => s + (h.px1 + h.px2) / 2, 0) / hits.length;
    const y = hits.reduce((s, h) => s + (h.py1 + h.py2) / 2, 0) / hits.length;
    return { x, y };
  }

  // Branch partners resolve one-to-one and connect directly — there's no
  // "other side" to collapse to a center, since all siblings are mutually
  // each other's branch partner.
  $: directLinks = active
    ? active.tipData.partners
        .filter((p): p is { id: string; kind: 'branch' } => p.kind === 'branch')
        .map(p => {
          const found = findHitOrSynthetic(p.id);
          return found ? { hit: found.hit, kind: p.kind } : null;
        })
        .filter((l): l is { hit: PlotBandHit; kind: 'branch' } => !!l)
    : [];

  // Fermi and based_on targets, grouped by branch_group so a multi-branch
  // partner vibration (on either side) collapses to one connector endpoint
  // instead of one per branch. Deduplicated so the same group isn't drawn
  // twice (e.g. two siblings both citing the same partner group).
  function resolveTargetGroups(activeHit: PlotBandHit, kind: 'fermi' | 'based_on'): PlotBandHit[][] {
    const ids = activeHit.tipData.partners.filter(p => p.kind === kind).map(p => p.id);
    const seen = new Set<string>();
    const groups: PlotBandHit[][] = [];
    for (const id of ids) {
      const found = findHitOrSynthetic(id);
      if (!found) continue;
      const key = found.hit.tipData.branchGroup ?? `__single__${found.hit.tipData.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push(groupHits(found.hit));
    }
    return groups;
  }
  $: fermiGroups = active ? resolveTargetGroups(active, 'fermi') : [];
  $: basedOnGroups = active ? resolveTargetGroups(active, 'based_on') : [];

  // The active band's own group (its branch siblings, or just itself) — the
  // shared source anchor for every fermi/based_on connector, so hovering any
  // one sibling draws the exact same connectors.
  $: activeGroup = active ? groupHits(active) : [];

  // Legend hover (category/tag) takes priority; otherwise glow the active
  // band plus any partners — full group membership for fermi/based_on
  // links, not just the center point used to anchor the connector. Synthetic
  // (currently-hidden) hits are filtered out here — only real, drawn bands
  // get the glow treatment; hidden partners only anchor a connector.
  $: glowHits = (hoveredCat || hoveredTag)
    ? highlightedHits
    : active
      ? [active, ...directLinks.map(l => l.hit), ...activeGroup, ...fermiGroups.flat(), ...basedOnGroups.flat()]
          .filter(h => hitBands.includes(h))
      : [];

  // Connector geometry differs by kind:
  //  - branch: a plain line straight through the vertical center of both
  //    bars — branches of one transition are close enough that a flat line
  //    through them is all the relationship needs.
  //  - fermi: a "staple" bridging up from each side's group-center to a
  //    height 80% of the way to mid-lane, clearing any other band sitting
  //    between the partners — Fermi partners aren't guaranteed to be
  //    lane-adjacent the way branches are.
  //  - based_on: a shallow arc from the active band's group-center to each
  //    parent group-center, bowing upward all the way to mid-lane (100%) —
  //    distinct from fermi since it's a parent/child relationship, not a
  //    peer one. Parents only: hovering a fundamental does not show every
  //    combination built from it.
  // Fermi and based_on share the same anchor (group center, expanding any
  // multi-branch side to its center) but no longer the same peak height;
  // the visual difference is shape (staple vs arc), line style, and height.
  const FERMI_LIFT_FRAC = 0.8;
  const BASED_ON_LIFT_FRAC = 1.8;
  function midLaneLift(frac: number) {
    return frac * (laneHeightPx / 2);
  }

  type Connector =
    | { kind: 'branch'; xA: number; xB: number; y: number }
    | { kind: 'fermi'; xA: number; xB: number; yA: number; yB: number; bridgeY: number }
    | { kind: 'based_on'; xA: number; yA: number; xB: number; yB: number; midX: number; controlY: number };

  function connectorBetween(a: PlotBandHit, b: PlotBandHit): Connector {
    const xA = (a.px1 + a.px2) / 2;
    const xB = (b.px1 + b.px2) / 2;
    const y = ((a.py1 + a.py2) / 2 + (b.py1 + b.py2) / 2) / 2;
    return { kind: 'branch', xA, xB, y };
  }

  function groupConnector(
    srcHits: PlotBandHit[],
    dstHits: PlotBandHit[],
    kind: 'fermi' | 'based_on',
    liftOverride?: number,
  ): Connector {
    const src = groupCenter(srcHits);
    const dst = groupCenter(dstHits);
    const lift = liftOverride ?? midLaneLift(kind === 'fermi' ? FERMI_LIFT_FRAC : BASED_ON_LIFT_FRAC);
    const peakY = Math.min(src.y, dst.y) - lift;
    if (kind === 'fermi') {
      return { kind, xA: src.x, xB: dst.x, yA: src.y, yB: dst.y, bridgeY: peakY };
    }
    const midX = (src.x + dst.x) / 2;
    return { kind, xA: src.x, yA: src.y, xB: dst.x, yB: dst.y, midX, controlY: peakY };
  }

  // Multiple based_on arcs from the same child would otherwise all peak at
  // the same height and cross each other partway through. Scaling each
  // arc's height by how far it travels (farthest target = full height,
  // nearer ones nested progressively lower) avoids that: for two quadratic
  // Béziers sharing a start point, with the control point at the exact
  // horizontal midpoint and peak height proportional to span, the shorter
  // curve is provably never above the longer one in their overlapping
  // range — they only ever touch at the shared origin.
  $: scaledBasedOnConnectors = basedOnGroups.length === 0
    ? []
    : (() => {
        const srcX = groupCenter(activeGroup).x;
        const spans = basedOnGroups.map(g => Math.abs(groupCenter(g).x - srcX));
        const maxSpan = Math.max(...spans);
        const maxLift = midLaneLift(BASED_ON_LIFT_FRAC);
        return basedOnGroups.map((g, i) =>
          groupConnector(activeGroup, g, 'based_on', maxSpan > 0 ? maxLift * (spans[i] / maxSpan) : maxLift),
        );
      })();

  $: connectors = active
    ? [
        ...directLinks.map(l => connectorBetween(active!, l.hit)),
        ...fermiGroups.map(g => groupConnector(activeGroup, g, 'fermi')),
        ...scaledBasedOnConnectors,
      ]
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
  let laneHeightPx = 0;
  let allPositions: Record<string, { px: number; py: number }> = {};

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
    laneHeightPx = result.laneHeightPx;
    allPositions = result.allPositions;
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

  // External focus request (e.g. clicking a band card on the Vibration
  // Modes page) — select that one band exactly as a real click would,
  // just without a PointerEvent to read tip coordinates from, and make
  // sure it's actually scrolled into view first.
  let appliedFocusNonce = -1;
  $: if (focusBand && focusBand.nonce !== appliedFocusNonce && container && hitBands.length) {
    appliedFocusNonce = focusBand.nonce;
    focusOnBand(focusBand.id);
  }

  function focusOnBand(id: string) {
    const found = findHitOrSynthetic(id);
    if (!found) return;
    selected = found.real ? found.hit : null;
    selectedId = id;
    requestAnimationFrame(() => {
      const x = (found.hit.px1 + found.hit.px2) / 2;
      const y = (found.hit.py1 + found.hit.py2) / 2;
      const place = () => {
        const rect = container.getBoundingClientRect();
        selectedTipX = rect.left + x;
        selectedTipY = rect.top + y;
      };
      const scrollParent = container.closest('.main-area') as HTMLElement | null;
      if (scrollParent) {
        const containerRect = container.getBoundingClientRect();
        const parentRect = scrollParent.getBoundingClientRect();
        const bandAbsX = containerRect.left + x;
        const bandAbsY = containerRect.top + y;
        const needsScroll =
          bandAbsY < parentRect.top + 60 || bandAbsY > parentRect.bottom - 60 ||
          bandAbsX < parentRect.left + 60 || bandAbsX > parentRect.right - 60;
        if (needsScroll) {
          scrollParent.scrollTo({
            top: Math.max(0, scrollParent.scrollTop + (bandAbsY - parentRect.top) - parentRect.height / 2),
            left: Math.max(0, scrollParent.scrollLeft + (bandAbsX - parentRect.left) - parentRect.width / 2),
            behavior: 'smooth',
          });
          setTimeout(place, 350);
          return;
        }
      }
      place();
    });
  }

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

  <!-- highlight overlay: glowing rects for hovered/selected band, legend category, or partner links -->
  {#if glowHits.length > 0}
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
      {#each connectors as c}
        {#if c.kind === 'branch'}
          <line x1={c.xA} y1={c.y} x2={c.xB} y2={c.y}
                stroke="#555" stroke-width="1.25" stroke-linecap="round" opacity="0.8"/>
        {:else if c.kind === 'fermi'}
          <path d="M {c.xA} {c.yA} V {c.bridgeY} H {c.xB} V {c.yB}"
                fill="none" stroke="#555" stroke-width="1.5"
                stroke-dasharray="5,3" stroke-linecap="round" opacity="0.8"/>
          <text x={(c.xA + c.xB) / 2} y={c.bridgeY - 4}
                text-anchor="middle" font-style="italic" font-size="10"
                fill="#777" opacity="0.85">fermi</text>
        {:else}
          <path d="M {c.xA} {c.yA} Q {c.midX} {c.controlY} {c.xB} {c.yB}"
                fill="none" stroke="#555" stroke-width="1.25" stroke-linecap="round" opacity="0.8"/>
        {/if}
      {/each}
      {#each glowHits as hit}
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
                  {#if ref.tags.length}
                    <div class="tip-ref-tags">
                      {#each ref.tags as tag}
                        {@const style = TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}
                        <span class="tip-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                      {/each}
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
                {#if ref.tags.length}
                  <div class="tip-ref-tags">
                    {#each ref.tags as tag}
                      {@const style = TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}
                      <span class="tip-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                    {/each}
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

  .tip-ref-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .tip-ref-tag {
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 10px;
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

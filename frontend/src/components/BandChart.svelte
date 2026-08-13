<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap, Vibrations, VibrationMode } from '../lib/types';
  import { buildChart, buildAxisStrip } from '../lib/chart';
  import type { TipData, PlotBandHit } from '../lib/chart';
  import { axisRange, valueToWn } from '../lib/units';
  import { getCat, TAG_STYLES, DEFAULT_TAG_STYLE } from '../lib/colors';
  import { geometryFor, type MoleculeGeometry } from '../lib/moleculeGeometry';
  import VibrationMiniCard from './vibration/VibrationMiniCard.svelte';

  const dispatch = createEventDispatcher<{
    navigateRef: { key: string };
    navigateMode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  function goToRef(key: string) {
    selected = null;
    selectedId = null;
    dispatch('navigateRef', { key });
  }

  function wnList(wn: number | number[] | null): number[] {
    if (wn == null) return [];
    return Array.isArray(wn) ? wn : [wn];
  }

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let enabledGroups: ReadonlySet<string>;
  export let hiddenCats: ReadonlySet<string>;
  export let hiddenTags: ReadonlySet<string>;
  export let tagIsolate: string | null = null;
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
        vibrationModeIds: [],
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

  // Fermi, based_on and isotopologue targets, grouped by branch_group so a
  // multi-branch partner vibration (on either side) collapses to one
  // connector endpoint instead of one per branch. Deduplicated so the same
  // group isn't drawn twice (e.g. two siblings both citing the same group).
  function resolveTargetGroups(
    activeHit: PlotBandHit,
    kind: 'fermi' | 'based_on' | 'isotopologue',
  ): PlotBandHit[][] {
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
  $: isotopologueGroups = active ? resolveTargetGroups(active, 'isotopologue') : [];

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
      ? [active, ...directLinks.map(l => l.hit), ...activeGroup,
         ...fermiGroups.flat(), ...basedOnGroups.flat(), ...isotopologueGroups.flat()]
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
  //  - isotopologue: the same staple as fermi, dotted and lifted less, from
  //    the substituted band back to its natural-abundance parent. Child ->
  //    parent only, like based_on: hovering ν(C-H) doesn't fan out to every
  //    isotopologue someone happened to measure.
  // Fermi, based_on and isotopologue share the same anchor (group center,
  // expanding any multi-branch side to its center) but not the same peak
  // height; the visual difference is shape (staple vs arc), line style, and
  // height.
  const FERMI_LIFT_FRAC = 0.8;
  const BASED_ON_LIFT_FRAC = 1.8;
  const ISOTOPOLOGUE_LIFT_FRAC = 0.5;
  function midLaneLift(frac: number) {
    return frac * (laneHeightPx / 2);
  }

  type Connector =
    | { kind: 'branch'; xA: number; xB: number; y: number }
    | { kind: 'fermi'; xA: number; xB: number; yA: number; yB: number; bridgeY: number }
    | { kind: 'isotopologue'; xA: number; xB: number; yA: number; yB: number; bridgeY: number }
    | { kind: 'based_on'; xA: number; yA: number; xB: number; yB: number; midX: number; controlY: number };

  function connectorBetween(a: PlotBandHit, b: PlotBandHit): Connector {
    const xA = (a.px1 + a.px2) / 2;
    const xB = (b.px1 + b.px2) / 2;
    const y = ((a.py1 + a.py2) / 2 + (b.py1 + b.py2) / 2) / 2;
    return { kind: 'branch', xA, xB, y };
  }

  const LIFT_FRAC: Record<'fermi' | 'based_on' | 'isotopologue', number> = {
    fermi: FERMI_LIFT_FRAC,
    based_on: BASED_ON_LIFT_FRAC,
    isotopologue: ISOTOPOLOGUE_LIFT_FRAC,
  };

  function groupConnector(
    srcHits: PlotBandHit[],
    dstHits: PlotBandHit[],
    kind: 'fermi' | 'based_on' | 'isotopologue',
    liftOverride?: number,
  ): Connector {
    const src = groupCenter(srcHits);
    const dst = groupCenter(dstHits);
    const lift = liftOverride ?? midLaneLift(LIFT_FRAC[kind]);
    const peakY = Math.min(src.y, dst.y) - lift;
    if (kind === 'fermi' || kind === 'isotopologue') {
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
        ...isotopologueGroups.map(g => groupConnector(activeGroup, g, 'isotopologue')),
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

  // Sticky axis strip — mirrors the main chart's own x-axis so it stays
  // visible while the (potentially much taller than the viewport) lane
  // stack scrolls underneath it. See buildAxisStrip's own docstring.
  let axisContainer: HTMLDivElement;
  $: if (axisContainer) {
    axisContainer.replaceChildren(buildAxisStrip(axisProperty, axisUnit, containerWidth, xDomainForChart));
  }

  $: if (container) {
    hovered = null;
    const result = buildChart(
      bands, groups, enabledGroups, hiddenCats, hiddenTags,
      colorDim, axisProperty, axisUnit, refs,
      containerWidth,
      xDomainForChart,
      tagIsolate,
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
    playNonce++;
    requestAnimationFrame(() => {
      const x = (found.hit.px1 + found.hit.px2) / 2;
      const y = (found.hit.py1 + found.hit.py2) / 2;
      const place = () => {
        const rect = container.getBoundingClientRect();
        selectedTipX = rect.left + x;
        selectedTipY = rect.top + y;
      };
      // Vertical scroll now happens inside .chart-scroll (so the sticky
      // axis-strip/legend stay put — see App.svelte), while horizontal
      // scroll still happens on .main-area — two different ancestors now,
      // scrolled independently.
      const vScrollParent = container.closest('.chart-scroll') as HTMLElement | null;
      const hScrollParent = container.closest('.main-area') as HTMLElement | null;
      if (vScrollParent || hScrollParent) {
        const containerRect = container.getBoundingClientRect();
        const bandAbsX = containerRect.left + x;
        const bandAbsY = containerRect.top + y;
        const vRect = vScrollParent?.getBoundingClientRect();
        const hRect = hScrollParent?.getBoundingClientRect();
        const needsVScroll = !!vRect && (bandAbsY < vRect.top + 60 || bandAbsY > vRect.bottom - 60);
        const needsHScroll = !!hRect && (bandAbsX < hRect.left + 60 || bandAbsX > hRect.right - 60);
        if (needsVScroll || needsHScroll) {
          if (needsVScroll && vScrollParent && vRect) {
            vScrollParent.scrollTo({
              top: Math.max(0, vScrollParent.scrollTop + (bandAbsY - vRect.top) - vRect.height / 2),
              behavior: 'smooth',
            });
          }
          if (needsHScroll && hScrollParent && hRect) {
            hScrollParent.scrollTo({
              left: Math.max(0, hScrollParent.scrollLeft + (bandAbsX - hRect.left) - hRect.width / 2),
              behavior: 'smooth',
            });
          }
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

  // Per-reference expand/collapse, scoped to whichever band's tooltip is
  // currently shown (collapsed-by-default whenever a band cites more than
  // one reference — see the references-section markup below). Keyed by
  // index rather than ref.key since one band can cite the same paper twice.
  let expandedRefs = new Set<number>();
  let expandedForBandId: string | null = null;
  $: shownBandId = shown?.tipData.id ?? null;
  $: if (shownBandId !== expandedForBandId) {
    expandedRefs = new Set();
    expandedForBandId = shownBandId;
  }
  function toggleRefExpand(i: number) {
    const next = new Set(expandedRefs);
    if (next.has(i)) next.delete(i); else next.add(i);
    expandedRefs = next;
  }

  // ---------------------------------------------------------------------------
  // Linked vibration mini-cards — resolves each of the shown band's own
  // vibration_modes ids to its full VibrationMode plus the matching animated
  // diagram geometry (mode.topology if the mode is topology-specific,
  // otherwise the molecule's first/only topology). Computed before the
  // tooltip's own position below, since whether there's a linked-vibrations
  // panel at all changes how much horizontal room the flip check needs.
  // ---------------------------------------------------------------------------
  interface LinkedMode {
    mode: VibrationMode;
    geometry: MoleculeGeometry | null;
    moleculeId: string;
    topologyId: string;
  }

  function resolveMode(modeId: string): LinkedMode | null {
    for (const molecule of vibrations.molecules) {
      const mode = molecule.modes.find(m => m.id === modeId);
      if (mode) {
        const topologyId = mode.topology ?? molecule.topologies[0]?.id ?? '';
        return {
          mode,
          geometry: topologyId ? geometryFor(molecule.id, topologyId) : null,
          moleculeId: molecule.id,
          topologyId,
        };
      }
    }
    return null;
  }

  $: linkedModes = shown
    ? shown.tipData.vibrationModeIds
        .map(resolveMode)
        .filter((m): m is LinkedMode => m !== null)
    : [];

  // Selected tooltip stays at click position; hover tooltip follows the mouse.
  const TIP_W = 300;
  // .band-tooltip's CSS `width` is its content box only — its actual
  // rendered (and translateX(-100%)-shifted) box is wider by its own
  // padding (8px 10px) + border (1px, except the 3px overridden top) on
  // left/right: 2×10 + 2×1 = 22px. Using bare TIP_W for the flip/placement
  // math would be 22px short of the tooltip's real edge.
  const TIP_OUTER_W = TIP_W + 22;
  // Linked-vibrations panel: a narrow column to the OUTER side of the main
  // tooltip (same side it flipped to, so the two never overlap), top-aligned
  // with it rather than stacked below.
  const VIB_W = Math.round(TIP_W * 0.55); // a bit over half the tooltip's own width
  const VIB_GAP = 6; // small, purely aesthetic separation from the tooltip
  const VIB_OUTER_W = VIB_W + 14; // padding (6px×2) + border (1px×2)

  $: _anchorX = selected ? selectedTipX : mouseX;
  $: _anchorY = selected ? selectedTipY : mouseY;
  // Reserve room for the vibrations panel too whenever one will actually be
  // shown — otherwise the flip threshold only knows about the tooltip's own
  // width, and a panel attached further out can clip off the right edge of
  // the screen even though the tooltip itself still fit fine.
  $: roomNeeded = TIP_OUTER_W + (linkedModes.length ? VIB_GAP + VIB_OUTER_W : 0);
  $: flipLeft = _anchorX + 18 + roomNeeded > (typeof window !== 'undefined' ? window.innerWidth : 1200);
  $: tipX = flipLeft ? _anchorX - 16 : _anchorX + 18;
  $: tipTransform = flipLeft ? 'translateX(-100%)' : 'none';
  $: tipY = Math.max(10, Math.min(_anchorY - 8, (typeof window !== 'undefined' ? window.innerHeight - tipH - 10 : 800)));

  $: vibX = flipLeft ? tipX - TIP_OUTER_W - VIB_GAP : tipX + TIP_OUTER_W + VIB_GAP;
  $: vibTransform = flipLeft ? 'translateX(-100%)' : 'none';
  // Leaves the panel free to grow until it would run off the bottom of the
  // viewport, then scrolls internally instead — same idea as the tooltip's
  // own refs section, just sized against whatever room is actually left
  // below its (shared) top edge rather than a fixed pixel cap.
  $: vibPanelMaxH = Math.max(80, (typeof window !== 'undefined' ? window.innerHeight : 800) - tipY - 10);

  // Bumped to retrigger every linked mini-card's 3-second auto-play: once
  // whenever a *new* band starts being hovered, and once per real click
  // (the click branch in onPointerUp increments it directly, since clicking
  // the same already-hovered band wouldn't otherwise look like a "change").
  let playNonce = 0;
  let lastHoveredId: string | null = null;
  $: {
    const hid = hovered?.tipData.id ?? null;
    if (hid && hid !== lastHoveredId) playNonce++;
    lastHoveredId = hid;
  }

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
    // No 'axis' branch here — the chart's own axis is hidden (drawn instead
    // by the always-visible buildAxisStrip()), so dragging-to-zoom now
    // starts from that separate strip; see onAxisPointerDown below.
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
        playNonce++;
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

  // ---------------------------------------------------------------------------
  // Axis-strip interaction — the strip (.axis-strip below) is a separate,
  // always-visible element rendered via buildAxisStrip(), but shares
  // container's ML/MR margins, so its horizontal pixel math reuses
  // container's own bounding rect. Pointer
  // capture is taken on `container` (not the strip) so the drag is then
  // driven by the same onPointerMove/onPointerUp already bound there.
  // ---------------------------------------------------------------------------
  function axisSvgX(e: PointerEvent): number {
    return e.clientX - container.getBoundingClientRect().left;
  }

  function onAxisPointerMove(e: PointerEvent) {
    if (isPanning || isScaling) return; // drag in progress; container's own handler is driving
    const svgX = axisSvgX(e);
    const innerW = containerWidth - ML - MR;
    zone = (svgX >= ML && svgX <= ML + innerW) ? 'axis' : 'none';
  }

  function onAxisPointerLeave() {
    if (!isPanning && !isScaling) zone = 'none';
  }

  function onAxisPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    const svgX = axisSvgX(e);
    const innerW = containerWidth - ML - MR;
    if (svgX < ML || svgX > ML + innerW) return;

    downPos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    container.setPointerCapture(e.pointerId);

    if (e.button === 0) {
      const domain = currentDomain();
      const t = Math.max(0, Math.min(1, (svgX - ML) / innerW));
      scalePivot = domain[0] + t * (domain[1] - domain[0]);
      scaleStartClientX = e.clientX;
      scaleStartDomain = domain;
      isScaling = true;
    } else {
      isPanning = true;
      panStartClientX = e.clientX;
      panStartDomain = currentDomain();
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
  <div class="chart-area">
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
          {:else if c.kind === 'isotopologue'}
            <path d="M {c.xA} {c.yA} V {c.bridgeY} H {c.xB} V {c.yB}"
                  fill="none" stroke="#3D5A70" stroke-width="1.5"
                  stroke-dasharray="1,3" stroke-linecap="round" opacity="0.85"/>
            <text x={(c.xA + c.xB) / 2} y={c.bridgeY - 4}
                  text-anchor="middle" font-style="italic" font-size="10"
                  fill="#3D5A70" opacity="0.85">isotopologue</text>
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
  </div>

  <div
    bind:this={axisContainer}
    class="axis-strip"
    style="cursor: {activeCursor}"
    on:pointerdown={onAxisPointerDown}
    on:pointermove={onAxisPointerMove}
    on:pointerleave={onAxisPointerLeave}
  ></div>

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
        {@const isCollapsible = td.refs.length > 1}
        {@const useScroll = selected && td.refs.length > 3}
        {@const refsToShow = selected ? td.refs : td.refs.slice(0, 3)}
        <div class="tip-refs-section">
          <div class="tip-refs-header">
            References
            {#if !selected && td.refs.length > 3}
              <span class="tip-refs-overflow">+{td.refs.length - 3} more · click band</span>
            {/if}
          </div>

          <div class:tip-refs-scroll={useScroll}>
            {#each refsToShow as ref, i}
              {@const expanded = !isCollapsible || expandedRefs.has(i)}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div
                class="tip-ref-box"
                class:tip-ref-btn={isCollapsible}
                on:click={isCollapsible ? () => toggleRefExpand(i) : null}
                title={isCollapsible ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
              >
                <button
                  class="tip-ref-goto-btn"
                  on:click|stopPropagation={() => goToRef(ref.key)}
                  title="Open in References page"
                >↗</button>
                <div class="tip-ref-title">
                  {ref.short}
                  {#if isCollapsible}
                    <span class="tip-ref-chevron" class:open={expanded}>▸</span>
                  {/if}
                </div>
                {#if ref.wn != null || ref.site}
                  <div class="tip-ref-badges">
                    {#each wnList(ref.wn) as w}
                      <span class="badge-wn">{w} cm⁻¹</span>
                    {/each}
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
                {#if expanded && ref.note}
                  <div class="tip-ref-note">{ref.note}</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if selected}
        <div class="tip-lock-hint">click ref to expand · ↗ for ref page · click band to switch · click empty to dismiss</div>
      {/if}
    </div>

    {#if linkedModes.length}
      <div
        class="vib-panel"
        style="left:{vibX}px; top:{tipY}px; transform:{vibTransform}; max-height:{vibPanelMaxH}px; pointer-events:{selected ? 'auto' : 'none'};"
      >
        {#each linkedModes as lm (lm.mode.id)}
          <VibrationMiniCard
            mode={lm.mode}
            geometry={lm.geometry}
            triggerNonce={playNonce}
            interactive={!!selected}
            on:navigate={() => dispatch('navigateMode', { moleculeId: lm.moleculeId, topologyId: lm.topologyId, modeId: lm.mode.id })}
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap { position: relative; width: 100%; }

  /* Pinned x-axis — sticks to the bottom of the chart's scroll container
     (App.svelte's .chart-scroll) so it stays readable regardless of how
     far down the lane stack the user has scrolled; the lane stack scrolls
     underneath it. The main chart's own axis is disabled (see buildChart's
     x.axis: null) so this is the only one ever drawn. */
  .axis-strip {
    position: sticky;
    bottom: 0;
    z-index: 6;
    background: white;
    border-top: 1px solid #e5e7eb;
  }
  .axis-strip :global(svg) { display: block; max-width: 100%; overflow: visible; }

  .chart-area { position: relative; }

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
    font-size: 13px;
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
    font-size: 13px;
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
    font-size: 14px;
    font-weight: 700;
    color: #111;
    line-height: 1.2;
  }
  .tip-vib {
    font-size: 11.5px;
    color: #777;
    margin-top: 1px;
  }
  .tip-wn {
    font-size: 12px;
    color: #333;
    font-family: 'Courier New', monospace;
    margin-top: 1px;
  }
  .tip-group {
    font-size: 11px;
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
    font-size: 11px;
    color: #555;
  }
  .tip-tag-extra {
    background: #f9fafb;
    border-color: #eaecef;
    color: #8a8f98;
  }

  .tip-desc {
    font-size: 12px;
    color: #555;
    line-height: 1.4;
    margin-bottom: 6px;
    padding-bottom: 5px;
    border-bottom: 1px solid #eee;
  }

  .tip-refs-section { margin-top: 2px; }

  .tip-refs-header {
    font-size: 10.5px;
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
    font-size: 10px;
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
    position: relative;
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 5px 26px 5px 7px; /* right padding clears .tip-ref-goto-btn */
    margin-top: 4px;
  }

  /* Clickable ref box — toggles its own note/badges open or closed
     (2+ references only; a band with a single reference always shows it
     fully, never collapsed — see isCollapsible in the markup above).
     The jump-to-reference-page button below is a separate nested control
     (stopPropagation'd) so it doesn't also trigger this toggle. */
  .tip-ref-btn {
    cursor: pointer;
    transition: background 0.1s, border-left-color 0.1s;
  }
  .tip-ref-btn:hover {
    background: #f0ece4;
    border-left-color: #a08050;
  }

  .tip-ref-chevron {
    display: inline-block;
    font-size: 9px;
    color: #a08050;
    margin-left: 4px;
    transition: transform 0.15s;
  }
  .tip-ref-chevron.open { transform: rotate(90deg); }

  .tip-ref-title {
    font-size: 12px;
    font-weight: 600;
    color: #222;
  }

  /* Per-reference corner button — jumps straight to this one citation on
     the References page; separate from the box's own expand/collapse click. */
  .tip-ref-goto-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 1px solid #e2d9c9;
    border-radius: 4px;
    color: #a08050;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .tip-ref-goto-btn:hover {
    background: #f0ece4;
    border-color: #a08050;
    color: #8a6d00;
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
    font-size: 11.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }

  .badge-site {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #78350f;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
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
    font-size: 11px;
  }

  .tip-ref-note {
    font-size: 11.5px;
    color: #6b7280;
    font-style: italic;
    margin-top: 4px;
    line-height: 1.35;
  }

  .tip-lock-hint {
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px solid #eee;
    font-size: 10.5px;
    color: #aaa;
    text-align: center;
  }

  /* ── Linked vibrations panel — a separate, narrow box attached to the
     outer side of the band tooltip (top-aligned with it), one mini-card per
     linked mode stacked vertically when there's more than one. ── */
  .vib-panel {
    position: fixed;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 165px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.13);
  }
  .vib-panel::-webkit-scrollbar { width: 4px; }
  .vib-panel::-webkit-scrollbar-thumb { background: #d0c9bc; border-radius: 2px; }
</style>

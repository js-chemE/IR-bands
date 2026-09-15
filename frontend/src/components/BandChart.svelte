<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Band, GroupMap, ColorDim, AxisProperty, RefMap, Vibrations, VibrationMode, Spectroscopy } from '../lib/types';
  import { buildChart, buildAxisStrip, getBandTags, HATCH, HOLLOW_STROKE, fadedFill, fadedEdge, WN_LO, WN_HI, type BandLooks } from '../lib/chart';
  import { cssZoom } from '../lib/zoom';
  import type { TipData, PlotBandHit } from '../lib/chart';
  import { axisRange, valueToWn, wnToValue } from '../lib/units';
  import { getCat, TAG_STYLES, tagStyle } from '../lib/colors';
  import { C, CHART_LAYOUT, ISOTOPE_STYLE, PRESENTATION } from '../lib/tokens';
  import { SURFACE_LEVEL_TITLE } from '../lib/labels';

  // Connector strokes drawn as SVG presentation attributes, which cannot read
  // a CSS custom property, so they take their colour from the token module
  // directly. ISO_STROKE deliberately reuses the isotope tag colour so
  // the connector and the pill always match.
  const CONN_STROKE = C['ink-500'];
  const CONN_LABEL = C['ink-300'];
  const ISO_STROKE = ISOTOPE_STYLE.color;
  import { geometryFor, type MoleculeGeometry } from '../lib/moleculeGeometry';
  import VibrationMiniCard from './vibration/VibrationMiniCard.svelte';
  import BandCard from './BandCard.svelte';
  import { linkedModesFor, type LinkedMode } from '../lib/vibrationLinks';

  // Everything the chart draws comes from this list, not from `bands`.
  $: shownBands = showIsotopes ? bands : bands.filter(b => !b.isotopologue_of);

  const dispatch = createEventDispatcher<{
    navigateRef: { key: string };
    navigateMode: { moleculeId: string; topologyId: string; modeId: string };
    /* Which band is selected, out to whoever draws the sidebar. The chart
       still owns the selection, because it owns the highlight and the arcs
       that go with it; this only reports it. */
    select: { hit: PlotBandHit | null };
  }>();

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let enabledGroups: ReadonlySet<string>;
  export let hiddenCats: ReadonlySet<string>;
  export let hiddenTags: ReadonlySet<string>;
  /** Isotopologue bands leave the dataset entirely when this is off, so the
   *  lanes and the sub-lane stagger are recomputed without them. */
  export let showIsotopes = true;
  export let tagIsolate: string | null = null;
  export let colorDim: ColorDim;
  export let axisProperty: AxisProperty;
  export let axisUnit: string;
  /** With a zero (absolute wavenumber, cm⁻¹, e.g. a laser) the axis is a shift from it; null for none. */
  export let shiftZero: number | null = null;
  /** Large values on the left. */
  export let reversed = false;
  /** IR or Raman: whose inactive bands are drawn hollow. */
  export let spectroscopy: Spectroscopy = 'ir';
  /** Whether inactive bands are drawn hollow and unreferenced ones faded. */
  export let looks: BandLooks = { inactive: true, unreferenced: true, calculated: true };
  export let hoveredCat: string | null = null;
  export let hoveredTag: string | null = null;
  // Set by a parent that wants to jump straight to one band (e.g. clicking
  // a band card on the Vibration Modes page) — `nonce` forces re-application
  // even if the same band is focused twice in a row, since plain reactivity
  // wouldn't notice an unchanged id.
  export let focusBand: { id: string; nonce: number } | null = null;

  const HIT_PAD = 3; // must match chart.ts

  /* Band by id, so the two legend-hover lookups below do not scan the whole
     dataset once per drawn band. */
  $: bandById = new Map(bands.map(b => [b.id, b]));

  $: highlightedHits = hoveredCat
    ? hitBands.filter(h => {
        const b = bandById.get(h.tipData.id);
        return b ? getCat(b, colorDim) === hoveredCat : false;
      })
    : hoveredTag
      /* Matched against the band's FULL tag list, not the chips it wears.
         An umbrella (infrared, raman, isotope) is a legend switch that is
         deliberately not drawn on the band, so matching on `tipData.tags`
         would highlight nothing for exactly the chips whose whole purpose
         is to select a family at once. */
      ? hitBands.filter(h => {
          const b = bandById.get(h.tipData.id);
          return b ? getBandTags(b, spectroscopy).includes(hoveredTag!) : false;
        })
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
      color: C['ink-100'],
      // Only ever an anchor for a connector, never drawn, so the hatch is moot.
      isotopologue: false,
      inactive: false,
      unreferenced: false,
      tipData: {
        id: band.id, name: '', vib: '', wnRange: '', group: '', color: C['ink-100'],
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

  /*
   * Isotopologue links anchor on the band, not on the family, wherever the
   * data is that precise.
   *
   * CD₄'s δₛ O branch names CH₄'s δₛ O branch, P names P, and so on: the link
   * is between two single lines. Collapsing the parent to its branch group,
   * the way a fermi or based_on target is collapsed, threw that away and
   * landed the arc on the family's midpoint, a position no band occupies and
   * four fifths of the time not even the right sibling.
   *
   * The test is whether the CHILD carries a branch. If it does it is one line
   * talking to one line, and both ends anchor on themselves. If it does not
   * (CD₄'s ν₃, whose parent happens to be the Q of a family) then the child is
   * the whole transition, it has no one sibling to mean, and the family centre
   * is the honest anchor.
   */
  interface LinkPair { src: PlotBandHit[]; dst: PlotBandHit[]; }

  function isotopologuePairsFor(activeHit: PlotBandHit): LinkPair[] {
    const branchResolved = !!bandById.get(activeHit.tipData.id)?.vibration?.branch;
    const ids = activeHit.tipData.partners.filter(p => p.kind === 'isotopologue').map(p => p.id);
    const seen = new Set<string>();
    const pairs: LinkPair[] = [];
    for (const id of ids) {
      const found = findHitOrSynthetic(id);
      if (!found) continue;
      if (branchResolved) {
        if (seen.has(found.hit.tipData.id)) continue;
        seen.add(found.hit.tipData.id);
        pairs.push({ src: [activeHit], dst: [found.hit] });
      } else {
        const key = found.hit.tipData.branchGroup ?? `__single__${found.hit.tipData.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ src: activeGroup, dst: groupHits(found.hit) });
      }
    }
    return pairs;
  }
  $: isotopologuePairs = active ? isotopologuePairsFor(active) : [];

  // The active band's own group (its branch siblings, or just itself) — the
  // shared source anchor for every fermi/based_on connector, so hovering any
  // one sibling draws the exact same connectors.
  $: activeGroup = active ? groupHits(active) : [];

  // Legend hover (category/tag) takes priority; otherwise glow the active
  // band plus any partners — full group membership for fermi/based_on
  // links, not just the center point used to anchor the connector. Synthetic
  // (currently-hidden) hits are filtered out here — only real, drawn bands
  // get the glow treatment; hidden partners only anchor a connector.
  /* With a band selected and open in the sidebar, the pointer still has to
     say where it is: the hovered band glows too, on top of the selection's
     own highlight and its arcs.

     Only the glow, though, and never a second set of connectors. The arcs say
     what the band being READ is built from, and a second set chasing the
     pointer would turn the one readable statement on the chart into two
     competing ones. */
  $: hoverAlso = selected && hovered && hovered !== selected ? [hovered] : [];

  /* Painted in this order, and SVG paints later on top, so the list ends with
     whatever the reader is pointing at.

     It used to start with it. A band shares its lane with its branch siblings
     and is staggered into a sub-lane that overlaps them, so hovering the one
     underneath glowed it and then painted every sibling over the top of it:
     the band you asked about was the one you could not see. Partners first,
     then the active band, then the hovered one where a selection means those
     are two different bands. */
  $: glowHits = (hoveredCat || hoveredTag)
    ? highlightedHits
    : active
      ? (() => {
          const top = [active, ...hoverAlso].filter(h => hitBands.includes(h));
          const under = [
            ...directLinks.map(l => l.hit), ...activeGroup,
            ...fermiGroups.flat(), ...basedOnGroups.flat(),
            ...isotopologuePairs.flatMap(pr => pr.dst),
          ].filter(h => hitBands.includes(h) && !top.includes(h));
          return [...new Set([...under, ...top])];
        })()
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
  //    isotopologue someone happened to measure. Unlike the other two it
  //    anchors band to band where the child names one branch — see
  //    isotopologuePairsFor.
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

  /**
   * The top of the lane(s) two hits sit in: the highest sub-lane any band
   * there occupies.
   *
   * An isotopologue staple used to bridge off whichever of its two bands sat
   * higher, so stepping through the branches of one family made the
   * horizontal hop up and down with the sub-lane stagger, as if the links
   * differed. They do not: every branch of CD₄'s δₛ points at the matching
   * branch of CH₄'s, and the line saying so should sit at one height and only
   * move when the lane does.
   */
  function laneTopY(hits: PlotBandHit[]): number {
    const lanes = new Set(
      hits.map(h => bandById.get(h.tipData.id)?.lane).filter(l => l !== undefined),
    );
    let top = Math.min(...hits.map(h => h.py1));
    for (const h of hitBands) {
      const ln = bandById.get(h.tipData.id)?.lane;
      if (ln !== undefined && lanes.has(ln)) top = Math.min(top, h.py1);
    }
    return top;
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
    // Isotopologue staples measure from the lane, not from the two bands, so
    // the whole family of them shares one height. See laneTopY.
    const base = kind === 'isotopologue'
      ? laneTopY([...srcHits, ...dstHits])
      : Math.min(src.y, dst.y);
    const peakY = base - lift;
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
        ...isotopologuePairs.map(pr => groupConnector(pr.src, pr.dst, 'isotopologue')),
        ...scaledBasedOnConnectors,
      ]
    : [];

  let container: HTMLDivElement;
  let containerWidth = 1100;

  // Zoom stored canonically in wavenumber [lo, hi] cm⁻¹ (lo < hi).
  let wnOverride: [number, number] | null = null;

  // When the limits change under a zoomed window (shift switched off while
  // it sat in the negative, a new zero), the window is shown slid back
  // inside at its own width, against the edge it crossed, rather than cut or
  // reset. A reactive value rather than a write back to wnOverride, so the
  // chart below is sure to be drawn from it in the same update; the next pan
  // or zoom starts from what is shown and stores it.
  $: wnShown = fitInside(wnOverride, wnFloor, wnCeil);
  function fitInside(w: [number, number] | null, floor: number, ceil: number): [number, number] | null {
    if (!w || (w[0] >= floor && w[1] <= ceil)) return w;
    const span = Math.min(w[1] - w[0], ceil - floor);
    return w[0] < floor ? [floor, floor + span] : [ceil - span, ceil];
  }

  $: xDomainForChart = wnShown
    ? (axisRange(wnShown[0], wnShown[1], axisProperty, axisUnit, shiftZero, reversed) as [number, number])
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
    axisContainer.replaceChildren(buildAxisStrip(axisProperty, axisUnit, containerWidth, xDomainForChart, shiftZero, reversed));
  }

  $: if (container) {
    hovered = null;
    const result = buildChart(
      shownBands, groups, enabledGroups, hiddenCats, hiddenTags,
      colorDim, axisProperty, axisUnit, refs,
      containerWidth,
      xDomainForChart,
      tagIsolate,
      shiftZero,
      reversed,
      spectroscopy,
      looks,
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
    zoomF = cssZoom(container);
    const observer = new ResizeObserver(entries => {
      zoomF = cssZoom(container);
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
      // Vertical scroll now happens inside .chart-scroll (so the sticky
      // axis-strip/legend stay put — see App.svelte), while horizontal
      // scroll still happens on .main-area — two different ancestors now,
      // scrolled independently.
      const vScrollParent = container.closest('.chart-scroll') as HTMLElement | null;
      const hScrollParent = container.closest('.main-area') as HTMLElement | null;
      if (vScrollParent || hScrollParent) {
        const containerRect = shellRect(container);
        const bandAbsX = containerRect.left + x;
        const bandAbsY = containerRect.top + y;
        const vRect = vScrollParent ? shellRect(vScrollParent) : undefined;
        const hRect = hScrollParent ? shellRect(hScrollParent) : undefined;
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
          return;
        }
      }
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
  let tipH = 0;

  /* What the chart itself is about: the selection if there is one, otherwise
     whatever the pointer is over. The highlight, the arcs to a band's
     partners and the mode resolution all follow this. */
  /* Closing the sidebar clears the selection through this, because a band
     that stayed selected with nothing showing it could not be selected again:
     clicking it a second time is not a change, so nothing would reopen. */
  export let clearNonce = 0;
  let appliedClearNonce = clearNonce;
  $: if (clearNonce !== appliedClearNonce) {
    appliedClearNonce = clearNonce;
    selected = null;
    selectedId = null;
  }

  $: shown = selected ?? hovered;
  $: dispatch('select', { hit: selected });

  /* What the floating card shows, which is not the same thing. A selected
     band is read in the sidebar, so pinning a second copy of it to the
     pointer would be the same card twice; the float is for the band under
     the pointer and nothing else. */
  $: floating = hovered && hovered.tipData.id !== selectedId ? hovered : null;

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
  $: linkedModes = shown ? linkedModesFor(vibrations, shown.tipData.vibrationModeIds) : [];
  $: floatModes = floating ? linkedModesFor(vibrations, floating.tipData.vibrationModeIds) : [];

  // Selected tooltip stays at click position; hover tooltip follows the mouse.
  const TIP_W = CHART_LAYOUT.tooltipWidth;
  // .band-tooltip's CSS `width` is its content box only — its actual
  // rendered (and translateX(-100%)-shifted) box is wider by its own
  // padding (8px 10px) + border (1px, except the 3px overridden top) on
  // left/right: 2×10 + 2×1 = 22px. Using bare TIP_W for the flip/placement
  // math would be 22px short of the tooltip's real edge.
  const TIP_OUTER_W = TIP_W + 22;
  // Linked-vibrations panel: a narrow column to the OUTER side of the main
  // tooltip (same side it flipped to, so the two never overlap), top-aligned
  // with it rather than stacked below.
  const VIB_W = Math.round(TIP_W * CHART_LAYOUT.vibPanelFrac); // a bit over half the tooltip's own width
  const VIB_GAP = CHART_LAYOUT.vibPanelGap; // small, purely aesthetic separation from the tooltip
  const VIB_OUTER_W = VIB_W + 14; // padding (6px×2) + border (1px×2)

  /* The pointer, and nothing else. The anchor used to freeze at the click
     position while a band was selected, because back then the card WAS the
     selection, pinned where it had been clicked. The sidebar holds the
     selection now and this card only ever shows the band under the pointer,
     so a frozen anchor drew it at the last place something was clicked. */
  $: _anchorX = mouseX;
  $: _anchorY = mouseY;
  // Reserve room for the vibrations panel too whenever one will actually be
  // shown — otherwise the flip threshold only knows about the tooltip's own
  // width, and a panel attached further out can clip off the right edge of
  // the screen even though the tooltip itself still fit fine.
  $: roomNeeded = TIP_OUTER_W + (linkedModes.length ? VIB_GAP + VIB_OUTER_W : 0);
  $: flipLeft = _anchorX + 18 + roomNeeded > (typeof window !== 'undefined' ? window.innerWidth / zoomF : 1200);
  $: tipX = flipLeft ? _anchorX - 16 : _anchorX + 18;
  $: tipTransform = flipLeft ? 'translateX(-100%)' : 'none';
  $: tipY = Math.max(10, Math.min(_anchorY - 8, (typeof window !== 'undefined' ? window.innerHeight / zoomF - tipH - 10 : 800)));

  $: vibX = flipLeft ? tipX - TIP_OUTER_W - VIB_GAP : tipX + TIP_OUTER_W + VIB_GAP;
  $: vibTransform = flipLeft ? 'translateX(-100%)' : 'none';
  // Leaves the panel free to grow until it would run off the bottom of the
  // viewport, then scrolls internally instead — same idea as the tooltip's
  // own refs section, just sized against whatever room is actually left
  // below its (shared) top edge rather than a fixed pixel cap.
  $: vibPanelMaxH = Math.max(80, (typeof window !== 'undefined' ? window.innerHeight / zoomF : 800) - tipY - 10);

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
  /* The plot's margins, for hit-testing and for the axis strip's own maths.
     Left and right come from CHART_LAYOUT, because buildChart draws with those
     and a second copy of the number here would silently move every hit zone
     the day one of them changed. Top and bottom are this file's own: they are
     the dead band the pointer ignores, not the margins Plot is given. */
  const ML = CHART_LAYOUT.marginLeft, MR = CHART_LAYOUT.marginRight, MT = 30, MB = 50;

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
  // A shift can be negative (anti-Stokes, below the zero), so its axis pans
  // and zooms past 0; it cannot reach the zero's own energy, where the
  // scattered light would have none left.
  $: wnFloor = shiftZero !== null ? -MAX_WN : 1;
  $: wnCeil = shiftZero !== null ? Math.min(MAX_WN, shiftZero - 100) : MAX_WN;
  // The same limits on the axis as drawn. Panning and zooming are clamped
  // here, in display units, rather than in wavenumber: clamping one end of a
  // wavenumber range while the other kept moving squeezed the window shut
  // near 0, and past 0 a wavelength or energy turned negative.
  $: valueLimits = [
    wnToValue(wnFloor, axisProperty, axisUnit, shiftZero),
    wnToValue(wnCeil, axisProperty, axisUnit, shiftZero),
  ].sort((a, b) => a - b) as [number, number];


  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  /* Presentation mode puts a CSS zoom on the shell, and everything the
     browser hands us (clientX, a bounding rect, window.innerHeight) is then in
     a different space from the chart's own pixels by exactly that factor. Both
     converters below take a viewport length into the chart's space; at zoom 1
     they are the identity, which is why the arithmetic that follows reads the
     same as it did before. See lib/zoom.ts. */
  /* A hovered tooltip is read in a second or two from the back of a room, so
     presentation mode shows one reference rather than three. Everything else
     about the tooltip is the same; the full list is still one click away. */
  export let presenting = false;


  $: refsPreview = presenting
    ? PRESENTATION.chart.refsPreviewCount
    : CHART_LAYOUT.refsPreviewCount;

  let zoomF = 1;
  const toShell = (px: number) => px / zoomF;
  /** A bounding rect with every edge in the chart's own pixels. */
  function shellRect(el: Element): DOMRect {
    const r = el.getBoundingClientRect();
    if (zoomF === 1) return r;
    return new DOMRect(r.left / zoomF, r.top / zoomF, r.width / zoomF, r.height / zoomF);
  }

  function getSvgPos(e: PointerEvent | MouseEvent) {
    const rect = shellRect(container);
    return { svgX: toShell(e.clientX) - rect.left, svgY: toShell(e.clientY) - rect.top };
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
    return xDomainForChart ?? (axisRange(WN_LO, WN_HI, axisProperty, axisUnit, shiftZero, reversed) as [number, number]);
  }

  function domainToWnRange(d0: number, d1: number): [number, number] {
    const a = valueToWn(d0, axisProperty, axisUnit, shiftZero);
    const b = valueToWn(d1, axisProperty, axisUnit, shiftZero);
    return [Math.min(a, b), Math.max(a, b)];
  }

  /** Slide a window, its width kept, back inside the axis limits. */
  function slideInside(d0: number, d1: number): [number, number] {
    const [vMin, vMax] = valueLimits;
    const lo = Math.min(d0, d1), hi = Math.max(d0, d1);
    if (hi - lo >= vMax - vMin) return d0 <= d1 ? [vMin, vMax] : [vMax, vMin];
    const by = lo < vMin ? vMin - lo : hi > vMax ? vMax - hi : 0;
    return [d0 + by, d1 + by];
  }
  const clampValue = (v: number) => Math.min(valueLimits[1], Math.max(valueLimits[0], v));

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  function onPointerMove(e: PointerEvent) {
    mouseX = toShell(e.clientX);
    mouseY = toShell(e.clientY);

    if (isPanning) {
      const plotWidth = containerWidth - ML - MR;
      const dx = toShell(e.clientX - panStartClientX) / plotWidth;
      const span = panStartDomain[1] - panStartDomain[0];
      const [d0, d1] = slideInside(panStartDomain[0] - dx * span, panStartDomain[1] - dx * span);
      wnOverride = domainToWnRange(d0, d1);
      return;
    }

    if (isScaling) {
      const dx = toShell(e.clientX - scaleStartClientX);
      const factor = Math.exp(-dx * 0.006);
      const d0 = clampValue(scalePivot + (scaleStartDomain[0] - scalePivot) * factor);
      const d1 = clampValue(scalePivot + (scaleStartDomain[1] - scalePivot) * factor);
      const [lo, hi] = domainToWnRange(d0, d1);
      if (hi - lo >= MIN_WN_SPAN) wnOverride = [lo, hi];
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
    return toShell(e.clientX) - shellRect(container).left;
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
          <!-- The highlight paints a solid rect over the band, which would
               wipe the hatch off exactly the bands whose hatch is the point.
               Same pattern as the chart's own, redrawn here. -->
          <!-- The plot proper: everything left of ML is the lane labels' column
               and everything right of the last tick is margin. A connector that
               leaves that box is a line drawn over the labels, so the arcs are
               clipped to it rather than shortened, which would move endpoints
               that mean something. -->
          <clipPath id="plot-clip">
            <rect x={ML} y="0" width={Math.max(0, containerWidth - ML - MR)} height={chartSvgHeight} />
          </clipPath>
          <pattern id="glow-hatch" width={HATCH.size} height={HATCH.size}
                   patternUnits="userSpaceOnUse" patternTransform="rotate({HATCH.angle})">
            <line x1="0" y1="0" x2="0" y2={HATCH.size}
                  stroke={HATCH.stroke} stroke-opacity={HATCH.strokeOpacity}
                  stroke-width={HATCH.strokeWidth}/>
          </pattern>
        </defs>
        <g clip-path="url(#plot-clip)">
        {#each connectors as c}
          {#if c.kind === 'branch'}
            <line x1={c.xA} y1={c.y} x2={c.xB} y2={c.y}
                  stroke={CONN_STROKE} stroke-width="1.25" stroke-linecap="round" opacity="0.8"/>
          {:else if c.kind === 'fermi'}
            <path d="M {c.xA} {c.yA} V {c.bridgeY} H {c.xB} V {c.yB}"
                  fill="none" stroke={CONN_STROKE} stroke-width="1.5"
                  stroke-dasharray="5,3" stroke-linecap="round" opacity="0.8"/>
            <text x={(c.xA + c.xB) / 2} y={c.bridgeY - 4}
                  text-anchor="middle" font-style="italic" font-size="10"
                  fill={CONN_LABEL} opacity="0.85">fermi</text>
          {:else if c.kind === 'isotopologue'}
            <path d="M {c.xA} {c.yA} V {c.bridgeY} H {c.xB} V {c.yB}"
                  fill="none" stroke={ISO_STROKE} stroke-width="1.5"
                  stroke-dasharray="1,3" stroke-linecap="round" opacity="0.85"/>
            <text x={(c.xA + c.xB) / 2} y={c.bridgeY - 4}
                  text-anchor="middle" font-style="italic" font-size="10"
                  fill={ISO_STROKE} opacity="0.85">isotopologue</text>
          {:else}
            <path d="M {c.xA} {c.yA} Q {c.midX} {c.controlY} {c.xB} {c.yB}"
                  fill="none" stroke={CONN_STROKE} stroke-width="1.25" stroke-linecap="round" opacity="0.8"/>
          {/if}
        {/each}
        </g>
        {#each glowHits as hit, gi}
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
          {#if hit.inactive || hit.unreferenced}
            <!-- The band in its own look, hollow or faded, over a white
                 base that hides the halo behind it: the highlight lifts the
                 band without turning it solid. -->
            {@const edge = hit.unreferenced ? fadedEdge(hit.color) : hit.color}
            <rect {x} {y} width={w} height={h} fill={C['surface']} stroke="white" stroke-width="1.5" rx="0.5"/>
            <rect {x} {y} width={w} height={h}
                  fill={hit.inactive ? C['surface'] : fadedFill(hit.color)}
                  stroke={edge}
                  stroke-width={hit.inactive ? HOLLOW_STROKE : 0.5}/>
            {#if hit.isotopologue}
              <!-- Its hatch in the band's own colour, as in the chart. -->
              <pattern id="glow-hatch-{gi}" width={HATCH.size} height={HATCH.size}
                       patternUnits="userSpaceOnUse" patternTransform="rotate({HATCH.angle})">
                <line x1="0" y1="0" x2="0" y2={HATCH.size} stroke={edge} stroke-width={HATCH.strokeWidth}/>
              </pattern>
              <rect {x} {y} width={w} height={h} fill="url(#glow-hatch-{gi})" stroke="none"/>
            {/if}
          {:else}
            <!-- solid band on top with white rim -->
            <rect {x} {y} width={w} height={h}
                  fill={hit.color} opacity="1"
                  stroke="white" stroke-width="1.5" rx="0.5"/>
            {#if hit.isotopologue}
              <rect {x} {y} width={w} height={h}
                    fill="url(#glow-hatch)" opacity={HATCH.fillOpacity}
                    stroke="none"/>
            {/if}
          {/if}
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

  {#if floating}
    {@const shown = floating}
    <div
      class="band-tooltip"
      class:is-selected={!!selected}
      bind:clientHeight={tipH}
      style="left:{tipX}px; top:{tipY}px; transform:{tipTransform}; border-top-color:{shown.color};"
    >
      <BandCard
        td={shown.tipData}
        color={shown.color}
        full={false}
        {spectroscopy}
        refsPreview={refsPreview}
        linkedModes={[]}
        {playNonce}
        on:navigateRef
        on:navigateMode
      />
    </div>

    {#if floatModes.length}
      <div
        class="vib-panel"
        style="left:{vibX}px; top:{tipY}px; transform:{vibTransform}; max-height:{vibPanelMaxH}px;"
      >
        {#each floatModes as lm (lm.mode.id)}
          <VibrationMiniCard
            mode={lm.mode}
            geometry={lm.geometry}
            triggerNonce={playNonce}
            interactive={false}
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
    border-top: 1px solid var(--line-panel);
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
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 13px;
    cursor: pointer;
    color: var(--ink-600);
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .reset-btn:hover { background: var(--surface-hover); }

  .chart {
    width: 100%;
    user-select: none;
  }
  .chart :global(svg) { max-width: 100%; overflow: visible; }

  /* ── HTML tooltip ── */
  .band-tooltip {
    position: fixed;
    z-index: 200;
    /* The float never takes the pointer. It used to, back when a click pinned
       it and its references had to be clickable; the sidebar is that card now,
       so all this one does is swallow hovers over whatever it happens to be
       covering, which is always the bands next to the one being read. */
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--line);
    border-top: 3px solid var(--ink-200); /* overridden inline with band color */
    border-radius: var(--radius-md);
    padding: 8px var(--space-3);
    width: var(--tip-width);
    font-family: var(--font-sans);
    font-size: 13px;
    line-height: 1.4;
    box-shadow: var(--shadow-md);
  }
  .band-tooltip.is-selected {
    box-shadow: var(--shadow-lg);
    border-color: var(--ink-025);
  }

  /* ── Linked vibrations panel — a separate, narrow box attached to the
     outer side of the band tooltip (top-aligned with it), one mini-card per
     linked mode stacked vertically when there's more than one. ── */
  .vib-panel {
    pointer-events: none; /* same reason as the tooltip above */
    position: fixed;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 165px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.13);
  }
  .vib-panel::-webkit-scrollbar { width: 4px; }
  .vib-panel::-webkit-scrollbar-thumb { background: var(--ref-scroll-thumb); border-radius: 2px; }
</style>

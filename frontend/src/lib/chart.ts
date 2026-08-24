import * as Plot from '@observablehq/plot';
import type { Band, GroupMap, ColorDim, AxisProperty, LegendCategory, RefMap } from './types';
import { getCat, getCatLabel, getCatColor, getColor, TAG_STYLES, DEFAULT_TAG_STYLE } from './colors';
import { wnToValue, axisRange, axisLabel } from './units';
import { C, FONTS, CHART_LAYOUT } from './tokens';

// Geometry lives in tokens.ts with the rest of the design system; these are
// re-exported so existing importers of './chart' keep working.
export const LANE_HEIGHT = CHART_LAYOUT.laneHeight;
export const BAR_FRACTION = CHART_LAYOUT.barFraction;
export const SUB_LANE_OFFSET_FRAC = CHART_LAYOUT.subLaneOffsetFrac;

const WN_LO = 450;
const WN_HI = 4050;

// ---------------------------------------------------------------------------
// Lane metrics (used by App.svelte via getLegendCategories and by buildChart)
// ---------------------------------------------------------------------------

export interface LaneMetrics {
  newLaneIdx: Map<number, number>;
  newNLanes: number;
}

export function computeLaneMetrics(bands: Band[], enabledGroups: ReadonlySet<string>): LaneMetrics {
  const laneEnabled = new Set<number>();
  for (const b of bands) {
    if (enabledGroups.has(b.group)) laneEnabled.add(b.lane);
  }
  const allLanes = [...new Set(bands.map(b => b.lane))].sort((a, b) => a - b);
  const newLaneIdx = new Map<number, number>();
  let next = 0;
  for (const lane of allLanes) {
    if (laneEnabled.has(lane)) newLaneIdx.set(lane, next++);
  }
  return { newLaneIdx, newNLanes: next };
}

// Sub-lane stagger (0 / +1 / -1) is computed at build time in Python over
// ALL bands in a lane (src/ir_bands/layout.py's assign_sub_lanes), so a band
// hidden by a disabled group can still hold a sub-lane slot hostage — e.g.
// two bands that visually look unrelated once a third, group-hidden one is
// toggled off. Recomputing it here, over only the currently-enabled bands,
// re-centers/re-compacts the stagger to match what's actually on screen —
// the exact same algorithm, just re-run client-side on a filtered set
// instead of once over the full dataset.
const SUB_LANE_PRIORITY = [0, 1, -1] as const;

function computeSubLanes(bands: Band[], enabledGroups: ReadonlySet<string>): Map<string, number> {
  const byLane = new Map<number, Band[]>();
  for (const b of bands) {
    if (!enabledGroups.has(b.group)) continue;
    if (!byLane.has(b.lane)) byLane.set(b.lane, []);
    byLane.get(b.lane)!.push(b);
  }

  const subLane = new Map<string, number>();
  for (const laneBands of byLane.values()) {
    // Two-step sort: group first (so one group's bands consistently claim
    // the same sub-lane priority before a second group sharing this lane is
    // considered), then by wavenumber within that group — matches
    // layout.py's own assign_sub_lanes() ordering.
    const sorted = [...laneBands].sort((a, b) =>
      a.group !== b.group ? a.group.localeCompare(b.group) : a.wn_min - b.wn_min
    );
    const subLaneEnds = new Map<number, number>(SUB_LANE_PRIORITY.map(sl => [sl, -Infinity]));
    for (const b of sorted) {
      for (const sl of SUB_LANE_PRIORITY) {
        if (subLaneEnds.get(sl)! < b.wn_min) {
          subLane.set(b.id, sl);
          subLaneEnds.set(sl, b.wn_max);
          break;
        }
      }
      // Bands that don't fit any of the 3 sub-lanes (4-way+ overlap) are
      // left unset — the caller falls back to 0, same as the dataclass
      // default for a band layout.py itself couldn't place.
    }
  }
  return subLane;
}

// ---------------------------------------------------------------------------
// Legend category list (consumed by ColorLegend via App.svelte)
// ---------------------------------------------------------------------------

const ATOMS_ORDER: Record<string, number> = {
  // C–O family (reds/oranges)
  'O=C=O': 0, 'O-C-O': 1, 'C-O': 2, 'C-O-H': 3,
  // O–H family (teals), each deuterated twin right after its parent
  'O-H': 4, 'O-D': 5, 'H-O-H': 6,
  // C–H family (greens), same convention
  'C-H': 7, 'C-D': 8, 'H-C-H': 9, 'D-C-D': 10, 'O-C-H': 11,
  // Metal (greys/golds)
  'M-H': 12, 'M-O': 13,
  // Diverse always last
  'diverse': 99,
};

const VIBRATION_ORDER: Record<string, number> = {
  'stretch': 0, 'stretch.symmetric': 1, 'stretch.asymmetric': 2,
  'bend': 3, 'bend.symmetric': 4, 'bend.asymmetric': 5,
  'bend.scissoring': 6, 'bend.rocking': 7, 'bend.wagging': 8, 'bend.twisting': 9,
  'combination': 10, 'lattice': 11,
};

export function getLegendCategories(
  bands: Band[],
  groups: GroupMap,
  enabledGroups: ReadonlySet<string>,
  colorDim: ColorDim,
): LegendCategory[] {
  const cats = new Map<string, { label: string; color: string; count: number }>();
  for (const b of bands) {
    if (!enabledGroups.has(b.group)) continue;
    const cat = getCat(b, colorDim);
    if (!cats.has(cat)) {
      cats.set(cat, { label: getCatLabel(cat, colorDim, groups), color: getCatColor(cat, colorDim, groups), count: 0 });
    }
    cats.get(cat)!.count++;
  }
  // For group/references: order by first lane appearance. For atoms/vibration: explicit order.
  const laneOrder = new Map<string, number>();
  if (colorDim === 'group' || colorDim === 'references') {
    for (const b of bands) {
      if (!enabledGroups.has(b.group)) continue;
      const cat = getCat(b, colorDim);
      const cur = laneOrder.get(cat) ?? Infinity;
      if (b.lane < cur) laneOrder.set(cat, b.lane);
    }
  }
  return [...cats.entries()]
    .sort(([a], [b]) => {
      if (colorDim === 'atoms')     return (ATOMS_ORDER[a] ?? 50) - (ATOMS_ORDER[b] ?? 50);
      if (colorDim === 'vibration') return (VIBRATION_ORDER[a] ?? 50) - (VIBRATION_ORDER[b] ?? 50);
      return (laneOrder.get(a) ?? Infinity) - (laneOrder.get(b) ?? Infinity);
    })
    .map(([key, v]) => ({ key, ...v }));
}

// ---------------------------------------------------------------------------
// Structured tooltip data — consumed by BandChart.svelte's HTML overlay
// ---------------------------------------------------------------------------

export interface TipRef {
  key: string;
  short: string;       // "Fehr & Krossing, 2020"
  wn: number | number[] | null;
  site: string | string[] | null;
  note: string | null;
  tags: string[];
}

export function getBandTags(b: Band): string[] {
  const explicit = b.tags ?? [];
  const auto: string[] = [];
  if (b.vibration.category === 'combination') auto.push('combination');
  if (b.based_on?.some(bo => bo.multiplier > 1)) auto.push('overtone');
  // Mirrors loader.py's tag_isotopologues() — the child of an
  // isotopologue_of link, never its natural-abundance parent.
  if (b.isotopologue_of) auto.push('isotopic-shift');
  // auto-tags first, then explicit tags (deduped)
  return [...auto, ...explicit.filter(t => !auto.includes(t))];
}

export const UNTAGGED_KEY = '__untagged__';

export interface LegendTag {
  key: string;
  label: string;
  count: number;
  background: string;
  border: string;
  color: string;
}

export function getLegendTags(
  bands: Band[],
  enabledGroups: ReadonlySet<string>,
): LegendTag[] {
  const counts = new Map<string, number>();
  let untaggedCount = 0;
  for (const b of bands) {
    if (!enabledGroups.has(b.group)) continue;
    const tags = getBandTags(b);
    if (tags.length === 0) {
      untaggedCount++;
    } else {
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const result: LegendTag[] = [...counts.entries()].map(([key, count]) => {
    const style = TAG_STYLES[key] ?? DEFAULT_TAG_STYLE;
    return { key, label: key, count, ...style };
  });
  if (untaggedCount > 0) {
    result.push({
      key: UNTAGGED_KEY,
      label: 'others',
      count: untaggedCount,
      background: C['pill-muted-bg'],
      border: C['pill-muted-border'],
      color: C['ink-050'],
    });
  }
  return result;
}

// A connection kind drives only the connector's visual style (BandChart.svelte);
// the highlight/connector mechanism itself doesn't care which kind it is.
export type PartnerKind = 'fermi' | 'branch' | 'based_on' | 'isotopologue';

export interface TipPartner {
  id: string;
  kind: PartnerKind;
}

export interface TipData {
  id: string;
  name: string;
  vib: string;
  wnRange: string;
  group: string;
  color: string;
  noteLines: string[];
  tags: string[];
  description: string;
  refs: TipRef[];
  // Other bands to highlight/connect when this one is hovered or selected.
  // General over connection kind — Fermi resonance, rotational branches, and
  // based_on (parent/child) links; a future kind just appends more entries.
  partners: TipPartner[];
  // This band's own branch_group, if any — lets BandChart.svelte collapse a
  // whole group of branch siblings to one "center" anchor point when drawing
  // based_on arcs, rather than fanning out to every individual branch.
  branchGroup: string | null;
  // VibrationMode ids this band documents (Band.vibration_modes, verbatim) —
  // lets BandChart.svelte look up and render each linked mode's own mini
  // animated diagram alongside the tooltip.
  vibrationModeIds: string[];
}

export interface PlotBandHit {
  px1: number; px2: number;
  py1: number; py2: number;
  tipData: TipData;
  color: string;
}

export interface ChartResult {
  svg: SVGElement;
  hitBands: PlotBandHit[];
  chartHeight: number;
  // One lane's pixel height at the current zoom/lane-count — lets
  // BandChart.svelte size the based_on arc's bow relative to lane spacing.
  laneHeightPx: number;
  // Pixel center for every band whose group is enabled and has a lane, even
  // if the band itself is currently hidden by a category/tag filter or
  // panned/zoomed out of the visible domain — lets connectors still reach
  // a partner that isn't actually drawn right now.
  allPositions: Record<string, { px: number; py: number }>;
}


function formatShortRef(ref: Record<string, string | undefined>, key: string): string {
  const author = ref['author'] ?? '';
  const year = (ref['year'] ?? ref['date'] ?? '').slice(0, 4);
  if (!author) return year ? `${key}, ${year}` : key;
  const parts = author.split(/\s+and\s+/i);
  const first = parts[0].trim();
  const lastName = first.includes(',') ? first.split(',')[0].trim() : (first.split(' ').pop() ?? first);
  const suffix = parts.length > 2 ? ' et al.' : parts.length === 2 ? ` & ${parts[1].split(',')[0].trim()}` : '';
  return year ? `${lastName}${suffix}, ${year}` : `${lastName}${suffix}`;
}

// ---------------------------------------------------------------------------
// HTML sub/sup → Unicode conversion (short/description fields use <sub> tags)
// ---------------------------------------------------------------------------

const SUB_CHARS: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','h':'ₕ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ',
  'p':'ₚ','s':'ₛ','t':'ₜ','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};
const SUP_CHARS: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ',
};

function htmlToUnicode(text: string): string {
  if (!text) return text;
  return text
    .replace(/<sub>([^<]*)<\/sub>/gi, (_, inner: string) =>
      [...inner].map(c => SUB_CHARS[c] ?? c).join(''))
    .replace(/<sup>([^<]*)<\/sup>/gi, (_, inner: string) =>
      [...inner].map(c => SUP_CHARS[c] ?? c).join(''))
    .replace(/<[^>]+>/g, ''); // strip any remaining tags
}

function bandName(b: Band): string {
  if (b.short) return htmlToUnicode(b.short);
  const sub = b.vibration.subtype ? ` ${b.vibration.subtype}` : '';
  return `${b.species}${sub} ${b.vibration.category}`;
}

// ---------------------------------------------------------------------------
// Chart builder — the only function BandChart.svelte calls
// ---------------------------------------------------------------------------

interface PlotBand {
  x1: number; x2: number;
  y0: number; y1: number;
  cx: number; cy: number;
  color: string;
  irInactive: boolean;
  isotopologue: boolean;
  tipData: TipData;
}

// Isotopologue bands get a diagonal hatch laid over their normal coloured
// fill, so they read at a glance as "same mode, heavier molecule" without
// spending a colour on it. One neutral white-line pattern works over every
// group colour, which is why it's an overlay rect rather than a per-colour
// patterned fill.
const HATCH_ID = 'iso-hatch';

function appendHatchPattern(svg: SVGElement): void {
  const ns = 'http://www.w3.org/2000/svg';
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(ns, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  const pattern = document.createElementNS(ns, 'pattern');
  pattern.setAttribute('id', HATCH_ID);
  pattern.setAttribute('width', '5');
  pattern.setAttribute('height', '5');
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('patternTransform', 'rotate(45)');
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('y1', '0');
  line.setAttribute('x2', '0');
  line.setAttribute('y2', '5');
  line.setAttribute('stroke', 'rgba(255,255,255,0.9)');
  line.setAttribute('stroke-width', '2');
  pattern.appendChild(line);
  defs.appendChild(pattern);
}


// A small, mark-free plot containing only the x-axis — kept visually pinned
// (via sticky CSS in BandChart.svelte) above the scrolling lane stack, since
// the main chart's own axis sits at the bottom of a potentially very tall
// SVG and would otherwise scroll out of view while inspecting earlier lanes.
// Must share width/marginLeft/marginRight with buildChart's own Plot.plot
// call below so its ticks line up with the real chart underneath it.
export function buildAxisStrip(
  axisProperty: AxisProperty,
  axisUnit: string,
  width = CHART_LAYOUT.width,
  xDomainOverride?: [number, number],
): SVGElement {
  const xDomain = (xDomainOverride ?? axisRange(WN_LO, WN_HI, axisProperty, axisUnit)) as [number, number];
  return Plot.plot({
    width,
    height: 50,
    marginLeft: CHART_LAYOUT.marginLeft,
    marginRight: CHART_LAYOUT.marginRight,
    marginTop: 4,
    marginBottom: 34,
    style: {
      background: C['surface'],
      overflow: 'visible',
      fontFamily: FONTS.sans,
      fontSize: '13px',
    },
    x: {
      domain: xDomain,
      label: axisLabel(axisProperty, axisUnit),
      labelArrow: 'none',
    },
    y: { domain: [0, 1], axis: null },
    marks: [],
  }) as unknown as SVGElement;
}

export function buildChart(
  bands: Band[],
  groups: GroupMap,
  enabledGroups: ReadonlySet<string>,
  hiddenCats: ReadonlySet<string>,
  hiddenTags: ReadonlySet<string>,
  colorDim: ColorDim,
  axisProperty: AxisProperty,
  axisUnit: string,
  refs: RefMap,
  width = CHART_LAYOUT.width,
  xDomainOverride?: [number, number],
  // Tag "isolate" (double-click): show ONLY bands carrying this one tag,
  // bypassing hiddenTags entirely. A real, separate filter rather than
  // "hide every other tag" — unlike the category legend, a band can carry
  // several tags at once, so "hide every tag except T" combined with the
  // hide-if-ANY-hidden-tag rule below would also hide T's own bands
  // whenever they carry a second tag too (in practice, often ALL of them).
  tagIsolate: string | null = null,
): ChartResult {
  const { newLaneIdx, newNLanes } = computeLaneMetrics(bands, enabledGroups);
  const dynamicSubLane = computeSubLanes(bands, enabledGroups);

  const xDomain = (xDomainOverride ?? axisRange(WN_LO, WN_HI, axisProperty, axisUnit)) as [number, number];
  const xMin = Math.min(xDomain[0], xDomain[1]);
  const xMax = Math.max(xDomain[0], xDomain[1]);

  // branch_group -> sibling ids, for the rotational-branches partner kind.
  const branchGroupMembers = new Map<string, string[]>();
  for (const b of bands) {
    if (!b.branch_group) continue;
    if (!branchGroupMembers.has(b.branch_group)) branchGroupMembers.set(b.branch_group, []);
    branchGroupMembers.get(b.branch_group)!.push(b.id);
  }

  // based_on -> resolved parent band ids (a branch_group reference expands
  // to all of that vibration's branches, not just one arbitrarily-cited one).
  // Forward only: hovering a combination shows its parents, not the reverse
  // (hovering a fundamental does not show every combination built from it).
  function resolveBasedOnParents(b: Band): string[] {
    const parents: string[] = [];
    for (const bo of b.based_on) {
      if (bo.band_id) parents.push(bo.band_id);
      else if (bo.branch_group) parents.push(...(branchGroupMembers.get(bo.branch_group) ?? []));
      // both null (label-only, e.g. IR-inactive external mode) -> nothing to link to
    }
    return parents;
  }

  function getPartners(b: Band): TipPartner[] {
    const partners: TipPartner[] = [];
    if (b.fermi_partner) partners.push({ id: b.fermi_partner, kind: 'fermi' });
    if (b.fermi_partner_group) {
      for (const id of branchGroupMembers.get(b.fermi_partner_group) ?? []) {
        partners.push({ id, kind: 'fermi' });
      }
    }
    if (b.branch_group) {
      for (const siblingId of branchGroupMembers.get(b.branch_group) ?? []) {
        if (siblingId !== b.id) partners.push({ id: siblingId, kind: 'branch' });
      }
    }
    for (const parentId of resolveBasedOnParents(b)) {
      if (parentId !== b.id) partners.push({ id: parentId, kind: 'based_on' });
    }
    // Child -> parent only, matching the one-directional link itself:
    // hovering ν(C-D) points back at ν(C-H), not the reverse.
    if (b.isotopologue_of && b.isotopologue_of !== b.id) {
      partners.push({ id: b.isotopologue_of, kind: 'isotopologue' });
    }
    return partners;
  }

  const plotBands: PlotBand[] = [];
  const allPositionsData = new Map<string, { x: number; y: number }>();
  for (const b of bands) {
    if (!enabledGroups.has(b.group)) continue;
    const compactLane = newLaneIdx.get(b.lane);
    if (compactLane === undefined) continue;

    const xa = wnToValue(b.wn_min, axisProperty, axisUnit);
    const xb = wnToValue(b.wn_max, axisProperty, axisUnit);
    const x1 = Math.min(xa, xb), x2 = Math.max(xa, xb);

    const laneY = (newNLanes - 1 - compactLane) * LANE_HEIGHT;
    const subLane = dynamicSubLane.get(b.id) ?? 0;
    const y0 = laneY + subLane * (LANE_HEIGHT * SUB_LANE_OFFSET_FRAC * BAR_FRACTION);
    const y1 = y0 + LANE_HEIGHT * BAR_FRACTION;
    // Recorded for every enabled-group band before the display-only filters
    // below, so a hidden/off-screen partner can still anchor a connector.
    allPositionsData.set(b.id, { x: (x1 + x2) / 2, y: (y0 + y1) / 2 });

    if (hiddenCats.has(getCat(b, colorDim))) continue;
    if (tagIsolate) {
      const bt = getBandTags(b);
      if (bt.length === 0 ? tagIsolate !== UNTAGGED_KEY : !bt.includes(tagIsolate)) continue;
    } else if (hiddenTags.size > 0) {
      const bt = getBandTags(b);
      if (bt.length === 0 ? hiddenTags.has(UNTAGGED_KEY) : bt.some(t => hiddenTags.has(t))) continue;
    }

    const vib = b.vibration.subtype
      ? `${b.vibration.category} (${b.vibration.subtype})`
      : b.vibration.category;
    const branch = b.vibration.branch ? ` ${b.vibration.branch}` : '';

    const color = getColor(b, groups, colorDim);

    const tipRefs: TipRef[] = b.references.length > 0 && refs
      ? b.references.map(ref => {
          const r = refs[ref.key];
          const short = r ? formatShortRef(r as Record<string, string>, ref.key) : ref.key;
          return { key: ref.key, short, wn: ref.wn, site: ref.site, note: ref.note, tags: ref.tags };
        })
      : [];

    if (x2 < xMin || x1 > xMax) continue; // outside visible domain

    const bandTags = getBandTags(b);

    plotBands.push({
      x1, x2,
      y0, y1,
      cx: (x1 + x2) / 2,
      cy: (y0 + y1) / 2,
      color,
      irInactive: bandTags.includes('ir-inactive'),
      isotopologue: !!b.isotopologue_of,
      tipData: {
        id:        b.id,
        name:      bandName(b),
        vib:       `${vib}${branch} | ${b.atoms}`,
        wnRange:   `${b.wn_min}–${b.wn_max} cm⁻¹`,
        group:     groups[b.group]?.label ?? b.group,
        color,
        noteLines: [
          b.intensity  && `intensity: ${b.intensity}`,
          b.confidence && `confidence: ${b.confidence}`,
          b.width      && `width: ${b.width}`,
        ].filter(Boolean) as string[],
        tags: bandTags,
        description: b.description ? htmlToUnicode(b.description) : '',
        refs: tipRefs,
        partners: getPartners(b),
        branchGroup: b.branch_group ?? null,
        vibrationModeIds: b.vibration_modes,
      },
    });
  }

  // One label per lane — multiple groups are joined "A / B" each in its own color
  const laneGroupMap = new Map<number, string[]>();
  for (const b of bands) {
    if (!laneGroupMap.has(b.lane)) laneGroupMap.set(b.lane, []);
    const lg = laneGroupMap.get(b.lane)!;
    if (!lg.includes(b.group)) lg.push(b.group);
  }
  interface LaneLabelSegment { text: string; color: string; }
  interface LaneLabel { yCenter: number; segments: LaneLabelSegment[]; }
  const laneLabels: LaneLabel[] = [];
  for (const [origLane, groupKeys] of laneGroupMap) {
    const compactLane = newLaneIdx.get(origLane);
    if (compactLane === undefined) continue;
    const activeKeys = groupKeys.filter(k => enabledGroups.has(k));
    if (activeKeys.length === 0) continue;
    const laneY = (newNLanes - 1 - compactLane) * LANE_HEIGHT;
    const yCenter = laneY + LANE_HEIGHT * BAR_FRACTION / 2;
    const segments: LaneLabelSegment[] = [];
    activeKeys.forEach((k, i) => {
      if (i > 0) segments.push({ text: ' / ', color: C['ink-100'] });
      segments.push({ text: groups[k]?.label ?? k, color: groups[k]?.color ?? C['ink-600'] });
    });
    laneLabels.push({ yCenter, segments });
  }

  const yMax = (newNLanes > 0 ? newNLanes : 1) * LANE_HEIGHT;
  const yPadBottom = LANE_HEIGHT / 2;
  const height = Math.max(300, Math.round((newNLanes * LANE_HEIGHT + yPadBottom) * 55)) + 60;

  const svg = Plot.plot({
    width,
    height,
    marginLeft: CHART_LAYOUT.marginLeft,
    marginRight: CHART_LAYOUT.marginRight,
    marginTop: CHART_LAYOUT.marginTop,
    marginBottom: CHART_LAYOUT.marginBottom,
    style: {
      background: C['surface'],
      overflow: 'visible',
      fontFamily: FONTS.sans,
      fontSize: '13px',
    },
    x: {
      domain: xDomain,
      // Axis itself is drawn by the separate, always-visible buildAxisStrip()
      // instead (pinned via sticky CSS in BandChart.svelte) — rendering it
      // here too would just duplicate it once both are on screen at once.
      axis: null,
    },
    y: {
      domain: [-yPadBottom, yMax],
      axis: null,
    },
    marks: [
      Plot.gridX({ stroke: C['ink-025'], strokeWidth: 0.75, strokeDasharray: '1,3', strokeOpacity: 0.8 }),
      // Normal bands and IR-inactive ones (very transparent, dashed outline —
      // these represent modes never actually observed in IR) need different
      // constant stroke-dasharray values, which Plot only accepts as a
      // per-mark constant, not a per-row channel — hence two separate marks.
      Plot.rect(plotBands.filter(d => !d.irInactive), {
        x1: 'x1', x2: 'x2',
        y1: 'y0', y2: 'y1',
        fill: (d: PlotBand) => d.color,
        stroke: 'rgba(0,0,0,0.35)',
        strokeWidth: 0.5,
        opacity: 0.85,
        clip: true,
      }),
      Plot.rect(plotBands.filter(d => d.irInactive), {
        x1: 'x1', x2: 'x2',
        y1: 'y0', y2: 'y1',
        fill: (d: PlotBand) => d.color,
        stroke: (d: PlotBand) => d.color,
        strokeWidth: 1,
        opacity: 0.2,
        clip: true,
      }),
      // Hatch overlay for isotopologue bands, drawn on top of whichever of
      // the two marks above already painted them. Plot has no way to emit a
      // paint-server fill, so this goes out with a marker opacity that the
      // post-processing step below swaps for the pattern reference — the
      // same trick the IR-inactive dash pattern uses.
      Plot.rect(plotBands.filter(d => d.isotopologue), {
        x1: 'x1', x2: 'x2',
        y1: 'y0', y2: 'y1',
        fill: '#000',
        stroke: 'none',
        opacity: 0.999,
        clip: true,
      }),
    ],
  }) as unknown as SVGElement;

  // Plot's rect mark doesn't pass strokeDasharray through as a DOM attribute
  // (unlike gridX/ruleX, where it works fine), so apply it by hand to the
  // IR-inactive rects — identifiable by the opacity value just set above.
  svg.querySelectorAll('rect[opacity="0.2"]').forEach(el => {
    el.setAttribute('stroke-dasharray', '3,2');
  });

  // Same idea for the isotopologue hatch: swap the marker opacity for the
  // pattern fill. Only add the <pattern> when something actually uses it.
  const hatchRects = svg.querySelectorAll('rect[opacity="0.999"]');
  if (hatchRects.length > 0) {
    appendHatchPattern(svg);
    hatchRects.forEach(el => {
      el.setAttribute('fill', `url(#${HATCH_ID})`);
      el.setAttribute('opacity', '0.85');
    });
  }

  // Observable Plot's text mark only supports a single fill per element.
  // Append lane labels manually as <text>/<tspan> so each group segment gets its own color.
  const MARGIN_LEFT  = 200;
  const MARGIN_RIGHT = 20;
  const MARGIN_TOP   = 30;
  const MARGIN_BOT   = 50;
  const innerW = width - MARGIN_LEFT - MARGIN_RIGHT;
  const innerH = height - MARGIN_TOP - MARGIN_BOT;
  const yDataSpan = yMax + yPadBottom; // domain spans from -yPadBottom to yMax
  const xRange = xDomain[1] - xDomain[0];
  const ns = 'http://www.w3.org/2000/svg';
  for (const d of laneLabels) {
    const yPx = MARGIN_TOP + innerH * (1 - (d.yCenter + yPadBottom) / yDataSpan);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('text-anchor', 'end');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('x', String(MARGIN_LEFT - 8));
    text.setAttribute('y', String(yPx));
    text.setAttribute('font-size', '19');
    text.setAttribute('font-family', 'system-ui,-apple-system,"Segoe UI",sans-serif');
    for (const seg of d.segments) {
      const tspan = document.createElementNS(ns, 'tspan');
      tspan.setAttribute('fill', seg.color);
      tspan.textContent = seg.text;
      text.appendChild(tspan);
    }
    svg.appendChild(text);
  }

  // Pixel-space hit rectangles for each visible band (used by BandChart.svelte for hover/select)
  const tX = (v: number) => MARGIN_LEFT + (v - xDomain[0]) / xRange * innerW;
  const tY = (v: number) => MARGIN_TOP + innerH * (1 - (v + yPadBottom) / yDataSpan);
  const clampX = (v: number) => Math.max(MARGIN_LEFT, Math.min(MARGIN_LEFT + innerW, v));
  const HIT_PAD = 3; // extra px top/bottom so thin bands are easier to hover
  const hitBands: PlotBandHit[] = plotBands.map(b => ({
    px1: clampX(Math.min(tX(b.x1), tX(b.x2))),
    px2: clampX(Math.max(tX(b.x1), tX(b.x2))),
    py1: Math.min(tY(b.y1), tY(b.y0)) - HIT_PAD,
    py2: Math.max(tY(b.y1), tY(b.y0)) + HIT_PAD,
    tipData: b.tipData,
    color: b.color,
  }));

  const laneHeightPx = innerH * (LANE_HEIGHT / yDataSpan);

  // Unclamped, unconditional pixel position for every enabled-group band —
  // deliberately not run through clampX/HIT_PAD, so a connector can reach a
  // partner that's currently hidden by a filter or panned out of view.
  const allPositions: Record<string, { px: number; py: number }> = {};
  for (const [id, pos] of allPositionsData) {
    allPositions[id] = { px: tX(pos.x), py: tY(pos.y) };
  }

  return { svg, hitBands, chartHeight: height, laneHeightPx, allPositions };
}

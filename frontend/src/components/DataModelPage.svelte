<script context="module" lang="ts">
  export interface DmSection {
    id: string;
    label: string;
    /** True for the three top-level parts, which head the sidebar table of contents. */
    part?: boolean;
  }

  export type DmView = 'structure' | 'contents';

  /**
   * Two tables of contents, consumed by the sidebar in App.svelte. The page
   * holds two different things and they are read for different reasons: the
   * shape of the data, and what is actually in it. Every id exists as a
   * `data-dm-section` anchor below and the scroll spy keys off the list for
   * whichever view is showing.
   */
  export const STRUCTURE_SECTIONS: DmSection[] = [
    { id: 'model',      label: '1 · The model', part: true },
    { id: 'map',        label: 'Entity map' },
    { id: 'entities',   label: 'Entities' },
    { id: 'relations',  label: 'Relations' },
    { id: 'selflinks',  label: 'Band-to-band links' },
    { id: 'state',      label: '2 · State of the model', part: true },
    { id: 'checks',     label: 'What nothing checks yet' },
    { id: 'open',       label: 'What is still open' },
  ];

  export const CONTENTS_SECTIONS: DmSection[] = [
    { id: 'modes',      label: 'Normal modes' },
    { id: 'species',    label: 'Species' },
    { id: 'surfaces',   label: 'Surfaces' },
    { id: 'technique',  label: 'Technique' },
    { id: 'tags',       label: 'Tags and their roles' },
    { id: 'sources',    label: 'References and authors' },
  ];

  export function sectionsFor(view: DmView): DmSection[] {
    return view === 'structure' ? STRUCTURE_SECTIONS : CONTENTS_SECTIONS;
  }
</script>

<script lang="ts">
  /**
   * Data model. What the atlas's small databases are, how they link up, and
   * which links the build actually enforces.
   *
   * The specification half is read live out of lib/dataModel.ts, the same way
   * the Style guide reads lib/tokens.ts, so the page cannot drift from the
   * model it documents. The inventory half is computed from the shipped JSON
   * at render time: every count, every site, every contradiction on this page
   * is the real current state of the data, not a snapshot somebody has to
   * remember to update.
   *
   * Layout follows the Style guide's spread convention: explanation left, the
   * artefact being explained right, and a spread never crosses a part
   * boundary.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Dataset, RefMap, SurfaceLevel, Vibrations } from '../lib/types';
  import VibrationModesPage from './VibrationModesPage.svelte';
  import { tagStyle } from '../lib/colors';
  import { generatedTagTip } from '../lib/dataModel';
  import {
    ENTITIES,
    ENTITY_BY_KEY,
    RELATIONS,
    SELF_LINKS,
    TAG_TARGETS,
    STATUS_LABEL,
    STATUS_NOTE,
    STATUS_ORDER,
    SITE_KIND_LABEL,
    SITE_KIND_NOTE,
    SURFACE_LEVELS,
    LEVEL_LABEL,
    LEVEL_NOTE,
    TAG_ROLE_LABEL,
    TAG_ROLE_NOTE,
    TAG_ROLE_ORDER,
    tagRoleRank,
    TECHNIQUES,
    analyse,
    type EntityStatus,
    type SiteKind,
    type TagRole,
    type ValueRow,
  } from '../lib/dataModel';

  export let dataset: Dataset;
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let tagTips: Record<string, { tip: string }> = {};
  /** Which half of the page is showing. */
  export let view: DmView = 'structure';
  export let sortedGroupKeys: string[] = [];
  export let focusMode: { moleculeId: string; topologyId: string; modeId: string; nonce: number } | null = null;

  const dispatch = createEventDispatcher<{
    active: { id: string };
    navigateRef: { key: string };
    navigateBand: { id: string };
  }>();

  $: stats = analyse(dataset, refs, vibrations, tagTips);

  /* ── Entity map ──
     Hand-laid out, and it holds every entity in the model: nothing is
     explained in prose that the map does not draw. The spine runs along row
     three (reference → assignment → band → mode); what each spine entity owns
     hangs below it, what classifies it sits above. */
  const W = 150;
  const H = 54;

  // Columns every 230px, rows every 120px. The one deliberate exception is
  // Species, parked half a row up so it sits in the middle of the square its
  // four neighbours make (Group, Molecule, Band, VibrationMode), which is
  // where all three of its links are shortest.
  const POS: Record<string, { x: number; y: number }> = {
    // Views over Group, one either side of it.
    set:        { x: 250, y:  20 },
    lane:       { x: 480, y:  20 },
    // Classifiers.
    author:     { x:  20, y: 140 },
    group:      { x: 480, y: 140 },
    molecule:   { x: 940, y: 140 },
    species:    { x: 710, y: 200 },
    // The spine.
    reference:  { x:  20, y: 260 },
    assignment: { x: 250, y: 260 },
    band:       { x: 480, y: 260 },
    mode:       { x: 940, y: 260 },
    // What the spine entities own or point at.
    technique:  { x:  20, y: 380 },
    surface:    { x: 250, y: 380 },
    vibration:  { x: 480, y: 380 },
    atoms:      { x: 710, y: 380 },
    topology:   { x: 940, y: 380 },
    region:     { x: 710, y: 500 },
  };

  /**
   * Tag is not a box. It attaches to three entities at once, and drawing that
   * meant three routes across the whole diagram to say something simpler: these
   * are the things you can tag. So it is a pill on those three boxes instead,
   * and the entity itself is in the list below.
   */
  const TAGGABLE = new Set(TAG_TARGETS);

  const boxes = Object.entries(POS).map(([key, p]) => ({
    key,
    ...p,
    spec: ENTITY_BY_KEY[key],
  }));

  interface Edge {
    card: string;
    /** Straight segment, or a path when the route has to bend around a box. */
    x1?: number; y1?: number; x2?: number; y2?: number;
    d?: string;
    lx: number;
    ly: number;
    anchor?: 'start' | 'middle' | 'end';
    /** Second, smaller line under the cardinality. Only the self-loop needs it. */
    sub?: string;
    /** Holds only because two strings match. */
    weak?: boolean;
    /** Nobody authors it; it falls out of records that already exist. */
    derived?: boolean;
  }

  const EDGES: Edge[] = [
    // Views over Group: the lane stack straight above it, the saved filter
    // alongside.
    { card: '1:N',  x1: 555, y1:  74, x2: 555, y2: 140, lx: 562, ly: 111, anchor: 'start' },
    { card: 'N:M',  x1: 400, y1:  47, x2: 496, y2: 140, lx: 436, ly:  99, anchor: 'end' },
    // Reference side.
    { card: 'N:M',  x1:  95, y1: 194, x2:  95, y2: 260, lx: 102, ly: 231, anchor: 'start', weak: true },
    { card: '1:N',  x1: 170, y1: 287, x2: 250, y2: 287, lx: 210, ly: 279, anchor: 'middle' },
    { card: 'N:1',  x1: 170, y1: 407, x2: 262, y2: 314, lx: 198, ly: 372, anchor: 'middle' },
    // The spine, straight along one row.
    { card: 'N:1',  x1: 400, y1: 287, x2: 480, y2: 287, lx: 440, ly: 279, anchor: 'middle' },
    { card: 'N:M',  x1: 630, y1: 287, x2: 940, y2: 287, lx: 785, ly: 279, anchor: 'middle' },
    { card: 'N:1',  x1: 555, y1: 260, x2: 555, y2: 194, lx: 562, ly: 231, anchor: 'start' },
    { card: 'N:M',  x1: 630, y1: 167, x2: 940, y2: 167, lx: 785, ly: 159, anchor: 'middle' },
    { card: '1:N',  x1: 1015, y1: 194, x2: 1015, y2: 260, lx: 1022, ly: 231, anchor: 'start' },
    { card: '0..1', x1: 1015, y1: 314, x2: 1015, y2: 380, lx: 1022, ly: 351, anchor: 'start' },
    // Where a claim was measured: straight down the same column. One edge
    // now, because site and sample are one field at two levels.
    { card: 'N:M',  x1: 325, y1: 314, x2: 325, y2: 380, lx: 332, ly: 351, anchor: 'start' },
    // Containment: a sample holds its phases and sites, a phase its sites, a
    // composite site the simpler ones it is built from.
    { card: 'N:M',  d: 'M 250,392 C 214,392 214,420 250,420', lx: 245, ly: 455, anchor: 'end',
      sub: 'parts' },
    // What a band is.
    { card: 'N:1',  x1: 555, y1: 314, x2: 555, y2: 380, lx: 562, ly: 351, anchor: 'start' },
    { card: 'N:1',  x1: 620, y1: 314, x2: 740, y2: 380, lx: 694, ly: 342, anchor: 'start', weak: true },
    { card: 'N:1',  x1: 630, y1: 310, x2: 960, y2: 380, lx: 872, ly: 341, anchor: 'end' },
    { card: 'N:1',  d: 'M 600,314 C 668,378 668,458 706,524', lx: 678, ly: 474, anchor: 'start', derived: true },
    // Species sits between its four neighbours, so all three links are short.
    { card: 'N:1',  x1: 630, y1: 275, x2: 710, y2: 240, lx: 670, ly: 272, anchor: 'middle' },
    { card: '1:1',  x1: 860, y1: 222, x2: 940, y2: 180, lx: 900, ly: 216, anchor: 'middle' },
    { card: 'N:M',  x1: 710, y1: 222, x2: 630, y2: 180, lx: 670, ly: 216, anchor: 'middle', derived: true },
  ];

  let selected: string | null = null;

  function focusEntity(key: string) {
    selected = key;
    document.getElementById(`dm-entity-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Inventory controls ── */
  let levelFilter: SurfaceLevel | null = null;
  let siteKindFilter: SiteKind | null = null;
  let openChecks: Record<string, boolean> = {};

  const HITS_PREVIEW = 8;

  $: levelCounts = SURFACE_LEVELS.map(
    lv => [lv, stats.surfaces.filter(s => s.level === lv).length] as const,
  ).filter(([, n]) => n > 0);

  $: siteKinds = (() => {
    const counts = new Map<SiteKind, number>();
    for (const s of stats.surfaces) {
      if (!s.kind) continue;
      counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  })();

  // A kind only subdivides sites, so picking one implies the site level.
  $: shownSurfaces = stats.surfaces.filter(
    s => (!levelFilter || s.level === levelFilter) && (!siteKindFilter || s.kind === siteKindFilter),
  );

  function pickLevel(lv: SurfaceLevel | null) {
    levelFilter = lv;
    if (lv !== 'site') siteKindFilter = null;
  }

  function pickKind(kind: SiteKind) {
    siteKindFilter = siteKindFilter === kind ? null : kind;
    if (siteKindFilter) levelFilter = 'site';
  }

  // `parts` is authored as bare keys, but a key is not what a reader recognises
  // and it hides the one thing that matters about a part: its level. Resolve
  // each through the same table the rows come from, so a part is drawn as the
  // badge that entry gets everywhere else — filled for a site, hollow above it.
  $: surfaceByKey = new Map(stats.surfaces.map(s => [s.value, s]));
  const surfaceLabel = (key: string) => surfaceByKey.get(key)?.label ?? key;
  const surfaceLevel = (key: string) => surfaceByKey.get(key)?.level;
  function partTitle(key: string) {
    const lv = surfaceLevel(key);
    return lv ? `${key} — ${LEVEL_LABEL[lv].toLowerCase()}` : key;
  }

  $: tagsByRole = (() => {
    const groups = new Map<TagRole, ValueRow[]>();
    for (const t of stats.tags) {
      const role = t.role ?? 'other';
      if (!groups.has(role)) groups.set(role, []);
      groups.get(role)!.push(t);
    }
    // TAG_ROLE_ORDER decides the sequence here exactly as it does in the
    // chart legend, so the two never disagree about what comes first.
    return [...groups.entries()].sort((a, b) => tagRoleRank(a[0]) - tagRoleRank(b[0]));
  })();

  $: linkedSpecies = stats.species.filter(s => s.molecule).length;
  $: viaContainerTotal = stats.surfaces.reduce((n, s) => n + (s.viaContainer ?? 0), 0);
  $: derivedTagCount = stats.tags.filter(t => t.derivedFrom).length;

  const statusClass = (s: EntityStatus) => `st-${s}`;

  /* ── Scroll spy ──
     The page scrolls inside App.svelte's .main-area, not the window, so the
     listener attaches to that ancestor and measures against its own top edge.
     Same mechanism as the Style guide. */
  let root: HTMLElement;
  let scroller: HTMLElement | null = null;
  let activeId = STRUCTURE_SECTIONS[0].id;
  let frame = 0;

  $: viewSections = sectionsFor(view);

  function measure() {
    frame = 0;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let current = viewSections[0].id;
    for (const s of viewSections) {
      const el = root?.querySelector<HTMLElement>(`[data-dm-section="${s.id}"]`);
      if (!el) continue;
      if (el.getBoundingClientRect().top - top <= 90) current = s.id;
    }
    if (current !== activeId) {
      activeId = current;
      dispatch('active', { id: current });
    }
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(measure);
  }

  onMount(() => {
    scroller = root.closest('.main-area');
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    measure();
  });

  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
    scroller?.removeEventListener('scroll', onScroll);
  });
</script>

<main class="content" bind:this={root}>
  <h1 class="page-title">Dataset</h1>
  {#if view === 'structure'}
    <p class="lead">
      The shape of the data: a handful of small databases that point at each other, what
      each of them holds, how they link up, and which links the build actually enforces.
      Every count is read out of the shipped JSON, so it shows the data as it stands
      rather than as it was once described.
    </p>
  {:else}
    <p class="lead">
      What is actually in it: the molecules and their normal modes, the species, the sites
      and samples they were measured on, how the spectra were taken, and the literature
      behind all of it. Every table is built from the shipped JSON at render time.
    </p>
  {/if}

  <!-- ══════════ Part 1 ══════════ -->
{#if view === 'structure'}
  <h2 class="part" id="model" data-dm-section="model">1 &middot; The model</h2>

  <section class="section" id="map" data-dm-section="map">
    <h3>Entity map</h3>

    <div class="map-frame">
      <svg viewBox="0 0 1110 580" class="map" role="img" aria-label="Entity relationship map">
        {#each EDGES as e}
          {#if e.d}
            <path class="edge" class:weak={e.weak} class:derived={e.derived} d={e.d} />
          {:else}
            <line class="edge" class:weak={e.weak} class:derived={e.derived}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
          {/if}
          <text class="edge-card" x={e.lx} y={e.ly} text-anchor={e.anchor ?? 'middle'}>{e.card}</text>
          {#if e.sub}
            <text class="edge-sub" x={e.lx} y={e.ly + 13} text-anchor={e.anchor ?? 'middle'}>{e.sub}</text>
          {/if}
        {/each}

        {#each boxes as b}
          <g
            class="box {statusClass(b.spec.status)}"
            class:selected={selected === b.key}
            role="button"
            tabindex="0"
            on:click={() => focusEntity(b.key)}
            on:keydown={ev => (ev.key === 'Enter' || ev.key === ' ') && focusEntity(b.key)}
          >
            <rect class="box-body" x={b.x} y={b.y} width={W} height={H} rx="6" />
            <text class="box-label" x={b.x + 12} y={b.y + 21}>{b.spec.label}</text>
            <text class="box-count" x={b.x + 12} y={b.y + 40}>{stats.counts[b.key] ?? 0}</text>
            <text class="box-status" x={b.x + W - 12} y={b.y + 40} text-anchor="end"
              >{STATUS_LABEL[b.spec.status]}</text>
            {#if TAGGABLE.has(b.key)}
              <rect class="tag-pill" x={b.x + W - 26} y={b.y - 8} width="34" height="17" rx="4" />
              <text class="tag-pill-text" x={b.x + W - 9} y={b.y + 4} text-anchor="middle">tag</text>
            {/if}
          </g>
        {/each}
      </svg>
    </div>

    <div class="map-below">
      <div class="map-prose">
        <p>
          The spine runs left to right: a <strong>reference</strong> makes an
          <strong>assignment</strong> about a <strong>band</strong>, which documents a
          <strong>mode</strong>. Everything else hangs off one of those four.
        </p>
        <p>
          <strong>Surface</strong> is one table at three levels, not a site table and a
          material table: an assignment names whatever the paper stated, a site, a phase,
          a sample, or several at once. The loop on the box is <code>parts</code>, which
          points down that scale, and it is what lets a query for Cu⁺ reach the
          {viaContainerTotal} claims whose paper named only the catalyst.
        </p>
        <p>
          Everything in the model is drawn, including the parts that are not chemistry:
          <code>Set</code> is a saved filter and <code>Lane</code> is the chart's row
          order, both views over <code>Group</code>. The one exception is
          <code>Tag</code>, which attaches to three entities at once and says so with a
          pill on each rather than three routes across the diagram. No two edges cross:
          where the diagram forced a crossing, the entity was in the wrong place.
        </p>
        <p class="hint">Click a box to jump to its entry.</p>

      </div>

      <div class="map-legend">
        {#each STATUS_ORDER as st}
          <div class="legend-row">
            <span class="legend-chip {statusClass(st)}"></span>
            <span class="legend-name">{STATUS_LABEL[st]}</span>
            <span class="legend-note">{STATUS_NOTE[st]}</span>
          </div>
        {/each}
        <div class="legend-row">
          <span class="legend-chip legend-line"></span>
          <span class="legend-name">Solid edge</span>
          <span class="legend-note">A validated key. The build fails if it dangles.</span>
        </div>
        <div class="legend-row">
          <span class="legend-chip legend-line dashed"></span>
          <span class="legend-name">Dashed edge</span>
          <span class="legend-note">A link that holds only because two strings match: authors parsed out of BibTeX, and the unvalidated atoms string.</span>
        </div>
        <div class="legend-row">
          <span class="legend-chip legend-pill">tag</span>
          <span class="legend-name">Tag pill</span>
          <span class="legend-note">This entity can carry tags. {stats.counts.tag} tags are in use, {derivedTagCount} of them derived from a field rather than authored.</span>
        </div>
        <div class="legend-row">
          <span class="legend-chip legend-line dotted"></span>
          <span class="legend-name">Dotted edge</span>
          <span class="legend-note">Derived: nobody authors it, so it cannot drift. A band's region follows from its centre, and species/group falls out of the bands that carry both.</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="entities" data-dm-section="entities">
    <h3>Entities</h3>
    <p class="section-lead">
      Thirteen of them, plus the tag table. Everything that carries attributes of its own
      is a record with a key the build checks.
    </p>

    <div class="entity-list">
      {#each ENTITIES as e}
        <article
          class="entity"
          id="dm-entity-{e.key}"
          class:selected={selected === e.key}
        >
          <header class="entity-head">
            <span class="entity-name">{e.label}</span>
            <span class="status-pill {statusClass(e.status)}">{STATUS_LABEL[e.status]}</span>
            <span class="entity-count">{stats.counts[e.key] ?? 0}</span>
          </header>
          <div class="entity-meta">
            <span class="meta-label">Source</span><code>{e.source}</code>
          </div>
          <div class="entity-meta">
            <span class="meta-label">Identity</span><span class="meta-value">{e.id}</span>
          </div>
          <p class="entity-blurb">{e.blurb}</p>

          <div class="fields">
            {#each e.fields as f}
              <div class="field">
                <div class="field-head">
                  <code class="f-name">{f.name}</code>
                  <span class="f-type">{f.type}</span>
                  <span class="req req-{f.req}">{f.req}</span>
                </div>
                <div class="f-note">{f.note}</div>
              </div>
            {/each}
          </div>

          {#if e.open}
            <div class="promote">
              <span class="promote-label">Still open</span>
              <span>{e.open}</span>
            </div>
          {/if}
        </article>
      {/each}
    </div>
  </section>

  <section class="section" id="relations" data-dm-section="relations">
    <h3>Relations</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Read the cardinality from left to right: <code>1:N</code> on
          Reference&nbsp;→&nbsp;Assignment means one reference has many assignments.
        </p>
        <p>
          One row is marked <em>weak</em>, meaning nothing enforces it. It used to be six.
          The rest are keys the build resolves, and it fails rather than shipping a
          dangling one.
        </p>
      </div>
      <div class="spread-visual">
        <table class="rel-table">
          <thead>
            <tr><th>From</th><th>To</th><th>Card.</th><th>Via</th></tr>
          </thead>
          <tbody>
            {#each RELATIONS as r}
              <tr class:weak-row={r.weak}>
                <td>{ENTITY_BY_KEY[r.from].label}</td>
                <td>{ENTITY_BY_KEY[r.to].label}</td>
                <td class="card">{r.card}</td>
                <td><code>{r.via}</code></td>
              </tr>
              <tr class="rel-note-row" class:weak-row={r.weak}>
                <td colspan="4" class="rel-note">
                  {#if r.weak}<span class="weak-flag">weak</span>{/if}
                  {#if r.derived}<span class="derived-flag">derived</span>{/if}{r.note}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="selflinks" data-dm-section="selflinks">
    <h3>Band-to-band links</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Five link types live inside <code>bands.jsonc</code> alone, and each has its own
          reciprocity rule. They are documented in <code>schema.py</code> docstrings, which
          nobody reading the atlas ever opens.
        </p>
        <p>
          The distinction that catches people out is the fourth: a band that
          <em>is</em> an isotopologue versus a paper that <em>used</em> isotopes to prove an
          ordinary assignment. Different claims, different fields, similar names.
        </p>
      </div>
      <div class="spread-visual">
        {#each SELF_LINKS as l}
          <article class="link-card">
            <header>
              <span class="link-name">{l.label}</span>
              <span class="link-shape">{l.shape}</span>
            </header>
            <code class="link-field">{l.field}</code>
            <p>{l.note}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <!-- ══════════ Part 2 ══════════ -->
  <h2 class="part" id="state" data-dm-section="state">2 &middot; State of the model</h2>

  <section class="section" id="checks" data-dm-section="checks">
    <h3>What nothing checks yet</h3>
    <p class="section-lead">
      Computed live from the shipped JSON. The build already fails on an unresolved
      species, surface or topology key; these are the things it reports or ignores
      rather than refuses.
    </p>
    <div class="check-list">
      {#each stats.checks as c}
        <article class="check" class:empty={c.hits.length === 0}>
          <header>
            <span class="check-name">{c.label}</span>
            <span class="check-count">{c.hits.length}</span>
          </header>
          <p>{c.detail}</p>
          {#if c.hits.length}
            <div class="hits">
              {#each (openChecks[c.label] ? c.hits : c.hits.slice(0, HITS_PREVIEW)) as h}
                <code class="hit">{h}</code>
              {/each}
            </div>
            {#if c.hits.length > HITS_PREVIEW}
              <button
                class="more"
                on:click={() => openChecks = { ...openChecks, [c.label]: !openChecks[c.label] }}
              >{openChecks[c.label] ? 'show fewer' : `show all ${c.hits.length}`}</button>
            {/if}
          {/if}
        </article>
      {/each}
    </div>
  </section>

  <section class="section" id="open" data-dm-section="open">
    <h3>What is still open</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Each of these is useful on its own and none of them requires the next, so the
          model can stop here for as long as it needs to.
        </p>
      </div>
      <div class="spread-visual">
        <ol class="steps">
          <li>
            <span class="step-title">Move intensity, width and confidence onto the claim</span>
            <span class="step-body">
              All three describe an observation but are authored once per band. The band
              would keep a rollup for the chart; the claim would keep what its own paper
              reported.
            </span>
          </li>
          <li>
            <span class="step-title">Give methoxy its bidentate topology</span>
            <span class="step-body">
              A band already claims that geometry, but the molecule in
              <code>vibrations.jsonc</code> declares only monodentate, so the
              vibration-modes page cannot draw it. The build warns on every run.
            </span>
          </li>
          <li>
            <span class="step-title">Structure the reaction conditions</span>
            <span class="step-body">
              Temperature, pressure, feed and pretreatment are still prose inside
              <code>note</code>. Worth doing at several times the current number of claims,
              not before.
            </span>
          </li>
        </ol>
      </div>
    </div>
  </section>
{:else}
  <section class="section" id="modes" data-dm-section="modes">
    <h3>Normal modes</h3>
    <p class="section-lead">
      The molecules in <code>data/vibrations.jsonc</code>, their binding geometries and
      their normal modes, with the bands each mode is linked to. This is the same view
      that used to be its own page; it belongs here, because a mode is one of the things
      the dataset holds.
    </p>
    <div class="modes-frame">
      <VibrationModesPage
        bands={dataset.bands}
        {refs}
        {vibrations}
        {sortedGroupKeys}
        {focusMode}
        on:navigateRef
        on:navigateBand
      />
    </div>
  </section>


  <section class="section" id="species" data-dm-section="species">
    <h3>Species</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          {stats.species.length} species records across {stats.counts.band} bands, of which
          {linkedSpecies} carry a molecule on the vibration-modes page.
        </p>
        <p>
          This used to be 33 free-text labels for the same set of molecules, because the
          label also carried the phase (<code>Methanol</code> vs
          <code>Methanol (gas)</code> vs <code>Methanol adsorbed (CH₃OH*)</code>), the
          binding geometry (<code>Monodentate carbonate*</code>, <code>CO bridge (μ₂)</code>),
          the isotopologue and occasionally even the site. Each of those has its own field
          now, so the identity is spelled one way everywhere and can be checked.
        </p>
      </div>
      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Key</th><th>Label</th><th>Formula</th><th>Molecule</th><th class="num">Bands</th></tr>
          </thead>
          <tbody>
            {#each stats.species as s}
              <tr>
                <td><code>{s.value}</code></td>
                <td class="v-value">{s.label}</td>
                <td class="v-els">{s.detail}</td>
                <td>
                  {#if s.molecule}<code>{s.molecule}</code>{:else}<span class="dash">none yet</span>{/if}
                </td>
                <td class="num">{s.uses}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="surfaces" data-dm-section="surfaces">
    <h3>Surfaces</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          {stats.surfaces.length} entries, out of what used to be 32 strings in one
          <code>site</code> field. They were never one kind of thing: <code>Cu⁺</code> is
          an atom-scale spot, <code>Cu/ZnO</code> is a whole catalyst, and
          <code>TiO₂</code> is either, depending on the paper. So there is one table with
          a <code>level</code> rather than two tables and an argument about which one
          titania belongs in.
        </p>
        <p>
          The badge carries the level everywhere it is drawn: a site is
          <span class="badge-site">filled</span>, a phase or a sample is
          <span class="badge-site badge-coarse">hollow</span>. That way a claim about
          Cu⁺ never reads like a claim about Cu/ZnO, on this page or in the chart.
        </p>
        <p>
          The <em>via container</em> column is the point of <code>parts</code>: those
          claims name only the coarser surface and reach this one through it. Without
          that link they would be invisible to any site query.
        </p>
        <div class="kind-chips">
          <button class="chip" class:on={levelFilter === null && siteKindFilter === null}
                  on:click={() => { pickLevel(null); siteKindFilter = null; }}>
            all <span class="chip-n">{stats.surfaces.length}</span>
          </button>
          {#each levelCounts as [lv, n]}
            <button
              class="chip"
              class:on={levelFilter === lv}
              title={LEVEL_NOTE[lv]}
              on:click={() => pickLevel(levelFilter === lv ? null : lv)}
            >{LEVEL_LABEL[lv]} <span class="chip-n">{n}</span></button>
          {/each}
        </div>
        <div class="kind-chips">
          {#each siteKinds as [kind, n]}
            <button
              class="chip chip-sub"
              class:on={siteKindFilter === kind}
              title={SITE_KIND_NOTE[kind]}
              on:click={() => pickKind(kind)}
            >{SITE_KIND_LABEL[kind]} <span class="chip-n">{n}</span></button>
          {/each}
        </div>
      </div>

      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Key</th><th>Surface</th><th>Level</th><th>Kind</th><th>Formula</th><th>Parts</th><th class="num">Claims</th><th class="num">Via container</th></tr>
          </thead>
          <tbody>
            {#each shownSurfaces as s}
              <tr>
                <td><code>{s.value}</code></td>
                <td class="v-value">
                  <span
                    class="badge-site"
                    class:badge-coarse={s.level !== 'site'}
                    title={s.level ? LEVEL_NOTE[s.level] : ''}
                  >{s.label}</span>
                </td>
                <td>
                  {#if s.level}
                    <span class="level-tag lv-{s.level}" title={LEVEL_NOTE[s.level]}
                    >{LEVEL_LABEL[s.level]}</span>
                  {/if}
                </td>
                <td>
                  {#if s.kind}<span class="kind-tag">{SITE_KIND_LABEL[s.kind]}</span>{/if}
                </td>
                <td class="v-els">{s.detail || ''}</td>
                <td>
                  {#if (s.parts ?? []).length}
                    <span class="part-list">
                      {#each s.parts ?? [] as p}
                        <span
                          class="badge-site badge-part"
                          class:badge-coarse={surfaceLevel(p) !== 'site'}
                          title={partTitle(p)}
                        >{surfaceLabel(p)}</span>
                      {/each}
                    </span>
                  {/if}
                </td>
                <td class="num">{s.uses}</td>
                <td class="num">{s.viaContainer ?? ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="technique" data-dm-section="technique">
    <h3>Technique</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Three tags used to carry this, and they did not describe the same axis. DRIFTS
          and ATR are sampling geometries; FTIR is the interferometer, which nearly every
          one of these measurements uses whatever the geometry; and a calculated frequency
          is not a measurement at all.
        </p>
        <p>
          It is a field on the assignment now, with a closed vocabulary, and the tag chips
          the chart legend filters on are derived from it. <code>ftir</code> is the honest
          placeholder for a source that says only "FTIR": resolve each one to transmission
          or ATR as the paper is checked.
        </p>
        <p>
          One field, two chips. Alongside its own name a claim gets the family it belongs
          to, <code>infrared</code>, <code>raman</code> or <code>computational</code>, so
          the legend can ask "seen in the infrared at all" without ticking seven boxes,
          and it puts a gap at each change of family. The umbrella and the placeholder are
          different statements: <code>infrared</code> says the claim was an infrared
          measurement whatever its geometry, <code>ftir</code> says the geometry was never
          stated. Raman is both at once, being the family and the value a paper that says
          only "Raman" earns; <code>srs</code> is the one named kind under it, spontaneous
          Raman scattering, which is not the stimulated sort the initials usually mean.
        </p>
      </div>
      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Value</th><th>Tag</th><th class="num">Claims</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            {#each TECHNIQUES as t}
              <tr>
                <td><code>{t.key}</code></td>
                <td><code>{t.tag}</code></td>
                <td class="num">{stats.techniques.find(r => r.value === t.key)?.uses || ''}</td>
                <td class="t-note">{t.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="tags" data-dm-section="tags">
    <h3>Tags and their roles</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          One flat namespace, {stats.tags.length} tags in use, making {TAG_ROLE_ORDER.length}
          different kinds of statement. {derivedTagCount} of them are derived from a field
          by the build rather than authored, which is what a tag should become once the
          fact behind it has a proper home.
        </p>
        <p>
          Each tag is drawn the way it is drawn everywhere else, so this list and the
          chart legend show the same object. The markers beside it say where it is
          written: on a band, on a single citation, or on a vibration mode, and
          <span class="scope sc-derived">derived</span> means the build writes it from a
          field rather than anyone authoring it. The number is how many times it is used.
        </p>
        <p>
          The roles run in the order the model declares, the same order the chart legend
          sorts by, and it falls in two halves. First what the band is whoever measured
          it: the kind of transition, whether it is a labelled twin, the selection rule,
          and the caveat, which comes last for the same reason a caveat comes last in a
          sentence. Then how it was measured: the state the sample was in, the technique,
          the laser that technique used, and what the claim rests on. The legend draws
          those two halves as its two rows.
        </p>
      </div>
      <div class="spread-visual">
        {#each tagsByRole as [role, rows]}
          <div class="role-block">
            <div class="role-head">
              <span class="role-name">{TAG_ROLE_LABEL[role]}</span>
              <span class="role-n">{rows.length}</span>
              <span class="role-note">{TAG_ROLE_NOTE[role]}</span>
            </div>
            <div class="tag-rows">
              {#each rows as t}
                {@const style = tagStyle(t.value)}
                <div
                  class="tag-row"
                  title={t.derivedFrom ? `Derived from ${t.derivedFrom}` : (tagTips[t.value]?.tip ?? generatedTagTip(t.value) ?? 'No tooltip in tags.jsonc')}
                >
                  <span
                    class="tag-pill-live"
                    style="background:{style.background};border-color:{style.border};color:{style.color}"
                  >{t.value}</span>
                  {#if t.derivedFrom}<span class="scope sc-derived">derived</span>{/if}
                  {#each t.scopes ?? [] as sc}<span class="scope sc-{sc}">{sc}</span>{/each}
                  <span class="tag-count">{t.uses}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="section" id="sources" data-dm-section="sources">
    <h3>References and authors</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          {stats.counts.reference} references carry {stats.counts.assignment} assignments
          across {stats.counts.band} bands. Authors are parsed out of the BibTeX
          <code>author</code> field at render time and thrown away again; nothing stores
          them, and nothing needs to yet.
        </p>
        <p>
          They are the last bare string in the model: {stats.authors.length} distinct people
          are already in the data whether or not anything models them.
        </p>
      </div>
      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Author</th><th class="num">References</th></tr>
          </thead>
          <tbody>
            {#each stats.authors.slice(0, 20) as a}
              <tr>
                <td class="v-value">{a.label}</td>
                <td class="num">{a.refs.length}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if stats.authors.length > 20}
          <p class="table-foot">{stats.authors.length - 20} more, one reference each.</p>
        {/if}
      </div>
    </div>
  </section>

  <!-- ══════════ Part 3 ══════════ -->
{/if}
</main>

<style>
  /* Type roles and colours come from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: 28px 48px 64px;
    max-width: 1180px;
    margin: 0 auto;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--ink-700);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 0 0 14px;
  }

  .lead {
    max-width: 760px;
    color: var(--ink-slate-700);
    margin: 0 0 var(--space-6);
  }

  .part {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 56px 0 4px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--line-slate);
  }

  .section {
    margin: var(--space-6) 0 48px;
  }

  .section h3 {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-heading);
  }

  .section-lead {
    max-width: 760px;
    color: var(--ink-500);
    margin: 0 0 var(--space-4);
  }

  /* ── Spread: explanation left, artefact right ── */
  .spread {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  .spread-text p {
    margin: 0 0 10px;
    color: var(--ink-500);
  }

  .spread-visual { min-width: 0; }

  .hint {
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  .micro-label {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin: var(--space-4) 0 6px;
  }

  code {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  /* ── Entity map ── */
  .map-frame {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    overflow-x: auto;
  }

  .map { width: 100%; min-width: 1000px; display: block; }

  .edge {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .edge.weak { stroke-dasharray: 4 3; stroke: var(--ink-050); }
  /* Derived is the opposite of weak: nobody authors it, so it cannot drift. */
  .edge.derived { stroke-dasharray: 1 3; stroke: var(--badge-wn-border); }

  .edge-card {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-200);
  }

  /* What a self-loop means, since a cardinality alone reads as a puzzle. */
  .edge-sub {
    font-size: var(--t-micro-label-size);
    font-style: italic;
    fill: var(--ink-100);
  }

  .box { cursor: pointer; }
  .box .box-body {
    fill: var(--surface);
    stroke: var(--line-strong);
    stroke-width: 1.4;
    transition: filter 0.12s ease;
  }
  .box:hover .box-body { filter: brightness(0.97); }
  .box.selected .box-body { stroke-width: 2.6; }

  .box.st-record .box-body  { stroke: var(--brand-700); }
  .box.st-lookup .box-body  { stroke: var(--ink-300); }
  .box.st-inline .box-body  { stroke: var(--ink-300); fill: var(--surface-sunken); }
  .box.st-enum .box-body    { stroke: var(--pill-border); fill: var(--pill-bg); }
  .box.st-string .box-body  { stroke: var(--badge-site-border); fill: var(--badge-site-bg); }
  .box.st-derived .box-body { stroke: var(--badge-wn-border); fill: var(--badge-wn-bg); }

  .box-label {
    font-size: var(--t-label-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-800);
  }
  .box-count {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-400);
  }
  /* "This entity can carry tags", rather than a Tag box with three routes
     across the diagram to say the same thing. */
  /* Teal is the one accent this diagram does not already spend on a status:
     amber marks a bare string, blue marks derived. */
  .tag-pill {
    fill: var(--accent-teal-bg);
    stroke: var(--accent-teal-fg);
    stroke-width: 1;
  }
  .tag-pill-text {
    font-size: var(--t-code-size);
    font-weight: var(--t-micro-label-weight);
    fill: var(--accent-teal-fg);
  }

  .box-status {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    fill: var(--ink-100);
  }

  .map-below {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 32px;
    margin-top: var(--space-4);
    align-items: start;
  }

  .map-prose p { margin: 0 0 10px; color: var(--ink-500); }
  .map-prose strong { color: var(--ink-700); }

  .map-legend {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .legend-row {
    display: grid;
    grid-template-columns: 34px 92px 1fr;
    gap: 8px;
    /* start, not baseline: a note can run to several lines, and the symbol
       belongs beside the first one rather than floating in the middle. */
    align-items: start;
    font-size: var(--t-code-size);
  }

  .legend-chip {
    width: 14px;
    height: 11px;
    margin-top: 2px;
    justify-self: start;
    border-radius: 2px;
    border: 1.4px solid var(--line-strong);
    background: var(--surface);
    display: inline-block;
  }
  .legend-chip.st-record  { border-color: var(--brand-700); }
  .legend-chip.st-lookup  { border-color: var(--ink-300); }
  .legend-chip.st-inline  { border-color: var(--ink-300); background: var(--surface-sunken); }
  .legend-chip.st-enum    { border-color: var(--pill-border); background: var(--pill-bg); }
  .legend-chip.st-string  { border-color: var(--badge-site-border); background: var(--badge-site-bg); }
  .legend-chip.st-derived { border-color: var(--badge-wn-border); background: var(--badge-wn-bg); }
  .legend-line {
    height: 0;
    border: 0;
    border-top: 1.6px solid var(--line-strong);
    margin-top: 7px;
  }
  .legend-line.dashed { border-top-style: dashed; border-color: var(--ink-050); }
  .legend-line.dotted { border-top-style: dotted; border-color: var(--badge-wn-border); }
  .legend-pill {
    width: auto;
    height: auto;
    margin-top: 0;
    padding: 0 5px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--accent-teal-fg);
    background: var(--accent-teal-bg);
    color: var(--accent-teal-fg);
    font-size: var(--t-micro-label-size);
    line-height: 1.4;
    text-align: center;
  }

  .legend-name { font-weight: 600; color: var(--ink-600); }
  .legend-note { color: var(--ink-400); }


  /* ── Entity cards ── */
  .entity-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));
    gap: var(--space-4);
  }

  .entity {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-md);
    padding: 14px var(--space-4) var(--space-4);
    scroll-margin-top: 20px;
    transition: box-shadow 0.25s ease;
  }
  .entity.selected { box-shadow: 0 0 0 2px var(--brand-tint-line); }

  .entity-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .entity-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink-slate-900);
  }

  .entity-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-300);
  }

  .status-pill {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-border);
    background: var(--pill-bg);
    color: var(--pill-fg);
  }
  .status-pill.st-record {
    border-color: var(--brand-tint-line);
    background: var(--brand-tint);
    color: var(--brand-accent);
  }
  .status-pill.st-string {
    border-color: var(--badge-site-border);
    background: var(--badge-site-bg);
    color: var(--badge-site-fg);
  }
  .status-pill.st-derived {
    border-color: var(--badge-wn-border);
    background: var(--badge-wn-bg);
    color: var(--badge-wn-fg);
  }

  .entity-meta {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: var(--t-code-size);
    margin-bottom: 3px;
  }
  .meta-label {
    flex: 0 0 58px;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
  }
  .meta-value { color: var(--ink-400); }

  .entity-blurb {
    margin: 10px 0 12px;
    color: var(--ink-500);
    font-size: 13.5px;
    line-height: 1.5;
  }

  .fields { font-size: var(--t-code-size); }

  .field {
    padding: 6px 0;
    border-top: 1px solid var(--line-faint);
  }

  .field-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
  }
  .f-name { background: var(--ref-code-bg); }
  .f-type { color: var(--ink-300); font-family: var(--t-code-ff); }
  .f-note { color: var(--ink-400); line-height: 1.45; margin-top: 2px; }

  .req {
    font-size: var(--t-micro-label-size);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    padding: 0 4px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-muted-border);
    background: var(--pill-muted-bg);
    color: var(--pill-muted-fg);
  }
  .req-req { border-color: var(--pill-border); background: var(--pill-bg); color: var(--pill-fg); }
  .req-calc { border-color: var(--badge-wn-border); background: var(--badge-wn-bg); color: var(--badge-wn-fg); }

  .promote {
    margin-top: 12px;
    padding: 8px 10px;
    background: var(--badge-site-bg);
    border: 1px solid var(--badge-site-border);
    border-radius: var(--radius);
    font-size: var(--t-code-size);
    color: var(--badge-site-fg);
    line-height: 1.45;
  }
  .promote-label {
    display: block;
    font-weight: 700;
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin-bottom: 2px;
  }

  /* ── Tables ── */
  .rel-table, .inv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
  }

  .rel-table th, .inv-table th {
    text-align: left;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    padding: 8px 10px;
    border-bottom: 1px solid var(--line-soft);
    white-space: nowrap;
  }

  .rel-table td, .inv-table td {
    padding: 6px 10px;
    color: var(--ink-600);
    vertical-align: top;
  }

  .inv-table tbody tr { border-top: 1px solid var(--line-faint); }
  .inv-table tbody tr:hover { background: var(--surface-hover); }

  .rel-table tbody tr:not(.rel-note-row) { border-top: 1px solid var(--line-faint); }
  .rel-table .card { font-family: var(--t-code-ff); color: var(--ink-400); }
  .rel-note {
    padding-top: 0;
    color: var(--ink-400);
    font-size: var(--t-code-size);
    line-height: 1.45;
  }
  /* Derived is the opposite of weak: nobody authors it, so it cannot drift. */
  .derived-flag {
    display: inline-block;
    font-size: var(--t-micro-label-size);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    padding: 0 5px;
    margin-right: 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--badge-wn-border);
    background: var(--badge-wn-bg);
    color: var(--badge-wn-fg);
    white-space: nowrap;
  }

  .weak-flag {
    display: inline-block;
    font-size: var(--t-micro-label-size);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    padding: 0 5px;
    margin-right: 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--warn-border);
    background: var(--warn-bg);
    color: var(--warn-fg);
    white-space: nowrap;
  }
  .weak-row td { background: var(--surface-sunken); }

  .num { text-align: right; font-family: var(--t-code-ff); color: var(--ink-400); }
  .v-value { color: var(--ink-800); }
  .v-els { color: var(--ink-300); font-size: var(--t-code-size); }
  .t-note { color: var(--ink-400); font-size: var(--t-code-size); line-height: 1.45; }
  .dash { color: var(--ink-050); }
  .table-foot { font-size: var(--t-code-size); color: var(--ink-200); margin: 6px 0 0; }

  .kind-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
  .chip {
    font-family: inherit;
    font-size: var(--t-code-size);
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-border);
    background: var(--pill-bg);
    color: var(--pill-fg);
    cursor: pointer;
  }
  .chip:hover { background: var(--surface-hover); }
  .chip.on {
    border-color: var(--brand-tint-line);
    background: var(--brand-tint);
    color: var(--brand-accent);
  }
  .chip-n { color: var(--ink-200); }

  /* The kind chips subdivide the site level only, so they read as a second
     rank under the level chips rather than a competing filter. */
  .chip-sub {
    font-size: var(--t-micro-label-size);
    margin-top: 4px;
  }

  /* Same badge as the chart tooltip and the References page, so the level of
     a claim looks the same wherever it is drawn: a site filled, anything
     coarser hollow. */
  .badge-site {
    background: var(--badge-site-bg);
    border: 1px solid var(--badge-site-border);
    color: var(--badge-site-fg);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-code-size);
    white-space: nowrap;
  }
  .badge-coarse { background: var(--badge-site-bg-soft); }

  .kind-tag {
    font-size: var(--t-micro-label-size);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-border);
    background: var(--pill-bg);
    color: var(--pill-fg);
    white-space: nowrap;
  }

  /* The level in words, next to the badge that encodes it as filled/hollow.
     Filled against hollow separates a site from everything above it, which is
     the distinction that must never be missed; it cannot say which of phase or
     sample, so the word does that. */
  .level-tag {
    font-size: var(--t-micro-label-size);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-border);
    background: var(--pill-bg);
    color: var(--pill-fg);
    white-space: nowrap;
    text-transform: lowercase;
  }
  .level-tag.lv-site {
    border-color: var(--badge-site-border);
    background: var(--badge-site-bg);
    color: var(--badge-site-fg);
  }
  .level-tag.lv-phase { background: var(--badge-site-bg-soft); }

  .part-list { display: flex; flex-wrap: wrap; gap: 3px; }
  .badge-part { font-size: var(--t-micro-label-size); }

  /* ── Band-to-band link cards ── */
  .link-card {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-left: 3px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 10px var(--space-4);
    margin-bottom: 10px;
  }
  .link-card header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }
  .link-name { font-weight: 700; color: var(--ink-slate-900); }
  .link-shape {
    font-size: var(--t-micro-label-size);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--ink-200);
  }
  .link-field { display: inline-block; margin-bottom: 6px; }
  .link-card p { margin: 0; color: var(--ink-500); font-size: 13px; line-height: 1.5; }

  /* ── Tag roles ── */
  .role-block { margin-bottom: var(--space-4); }
  .role-head { margin-bottom: 5px; }
  .role-name {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin-right: 8px;
  }
  .role-note { font-size: var(--t-code-size); color: var(--ink-300); }

  .tag-rows { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 7px 2px 3px;
    border: 1px solid var(--line-faint);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  /* The tag as the chart and the tooltip draw it, colours inline from
     TAG_STYLES so this list cannot drift from them. */
  .tag-pill-live {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-tip-tag-size);
    white-space: nowrap;
  }
  .tag-count { font-family: var(--t-code-ff); font-size: var(--t-code-size); color: var(--ink-200); }
  /* How many tags carry this role, next to the role's name. */
  .role-n {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-200);
    margin-right: 8px;
  }

  .scope {
    font-size: var(--t-micro-label-size);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    padding: 0 4px;
    margin-left: 2px;
    border-radius: var(--radius-sm);
    background: var(--pill-bg);
    color: var(--pill-fg);
  }
  .scope.sc-assignment { background: var(--badge-site-bg); color: var(--badge-site-fg); }
  .scope.sc-mode { background: var(--badge-wn-bg); color: var(--badge-wn-fg); }
  .scope.sc-derived { background: var(--brand-tint); color: var(--brand-accent); }

  /* ── Checks ── */
  .check-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));
    gap: var(--space-4);
  }
  .check {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-left: 3px solid var(--warn-border);
    border-radius: var(--radius);
    padding: 10px var(--space-4);
  }
  .check.empty { border-left-color: var(--line-soft); opacity: 0.65; }
  .check header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }
  .check-name { font-weight: 700; color: var(--ink-slate-900); font-size: 13.5px; }
  .check-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-300);
  }
  .check p { margin: 0 0 8px; color: var(--ink-500); font-size: 13px; line-height: 1.5; }
  .hits { display: flex; flex-wrap: wrap; gap: 4px; }
  .hit { color: var(--ink-500); }
  .more {
    margin-top: 6px;
    font-family: inherit;
    font-size: var(--t-code-size);
    background: none;
    border: 0;
    padding: 0;
    color: var(--brand-700);
    cursor: pointer;
    text-decoration: underline;
  }

  /* ── Open items ── */
  .steps {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .steps li { color: var(--ink-500); }
  .step-title {
    display: block;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 2px;
  }
  .step-body { font-size: 13.5px; line-height: 1.55; }

  /* VibrationModesPage is a whole page in its own right, so it keeps its own
     padding; this just stops it doubling up on the section's. */
  .modes-frame {
    margin: 0 -48px;
  }
  /* It is a whole page in its own right, so it opens with its own title and
     status badge. Inside this section those are said already. */
  .modes-frame :global(.wip-badge),
  .modes-frame :global(h1) {
    display: none;
  }

  @media (max-width: 1000px) {
    .spread, .map-below { grid-template-columns: 1fr; gap: var(--space-4); }
  }
</style>

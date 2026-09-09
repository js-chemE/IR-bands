<script context="module" lang="ts">
  export interface DmSection {
    id: string;
    label: string;
    /** True for the three top-level parts, which head the sidebar table of contents. */
    part?: boolean;
  }

  /**
   * Table of contents, consumed by the sidebar in App.svelte. Same contract as
   * the Style guide's: every id exists as a `data-dm-section` anchor below and
   * the scroll spy keys off this list.
   */
  export const SECTIONS: DmSection[] = [
    { id: 'model',      label: '1 · The model', part: true },
    { id: 'map',        label: 'Entity map' },
    { id: 'entities',   label: 'Entities' },
    { id: 'relations',  label: 'Relations' },
    { id: 'selflinks',  label: 'Band-to-band links' },
    { id: 'contents',   label: '2 · What is in the data', part: true },
    { id: 'sites',      label: 'Sites and materials' },
    { id: 'species',    label: 'Species' },
    { id: 'tags',       label: 'Tags and their roles' },
    { id: 'sources',    label: 'References and authors' },
    { id: 'formalise',  label: '3 · Formalising', part: true },
    { id: 'technique',  label: 'Measurement technique' },
    { id: 'checks',     label: 'What nothing checks yet' },
    { id: 'order',      label: 'Migration order' },
  ];
</script>

<script lang="ts">
  /**
   * Data model. What the atlas's six little databases are, how they link up,
   * and which of them are not really databases yet but repeated strings.
   *
   * The specification half is read live out of lib/dataModel.ts, the same way
   * the Style guide reads lib/tokens.ts, so the page cannot drift from the
   * model it documents. The inventory half is computed from the shipped JSON
   * at render time: every count, every distinct site, every unmatched species
   * on this page is the real current state of the data, not a snapshot
   * somebody has to remember to update.
   *
   * Layout follows the Style guide's spread convention: explanation left, the
   * artefact being explained right, and a spread never crosses a part
   * boundary.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Dataset, RefMap, Vibrations } from '../lib/types';
  import {
    ENTITIES,
    ENTITY_BY_KEY,
    RELATIONS,
    SELF_LINKS,
    TAG_TARGETS,
    STATUS_LABEL,
    STATUS_NOTE,
    SITE_KIND_LABEL,
    SITE_KIND_NOTE,
    TAG_ROLE_LABEL,
    TAG_ROLE_NOTE,
    PROPOSED_TECHNIQUES,
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

  const dispatch = createEventDispatcher<{ active: { id: string } }>();

  $: stats = analyse(dataset, refs, vibrations, tagTips);

  /* ── Entity map ──
     Hand-laid out: fourteen boxes on a fixed grid, so the reading order runs
     left to right along the spine (reference → assignment → band → mode) with
     everything each one hangs off placed above or below it. */
  const W = 150;
  const H = 54;

  const POS: Record<string, { x: number; y: number }> = {
    author:     { x:  20, y:  30 },
    reference:  { x:  20, y: 140 },
    technique:  { x:  20, y: 260 },
    assignment: { x: 250, y: 140 },
    site:       { x: 250, y: 260 },
    material:   { x: 250, y: 350 },
    group:      { x: 480, y:  30 },
    band:       { x: 480, y: 140 },
    region:     { x: 410, y: 260 },
    species:    { x: 610, y: 260 },
    molecule:   { x: 790, y:  30 },
    mode:       { x: 790, y: 140 },
    topology:   { x: 790, y: 260 },
  };

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
    weak?: boolean;
  }

  const EDGES: Edge[] = [
    { card: 'N:M',  x1:  95, y1:  84, x2:  95, y2: 140, lx: 102, ly: 116, anchor: 'start', weak: true },
    { card: '1:N',  x1: 170, y1: 167, x2: 250, y2: 167, lx: 210, ly: 159, anchor: 'middle' },
    { card: 'N:1',  x1: 400, y1: 167, x2: 480, y2: 167, lx: 440, ly: 159, anchor: 'middle' },
    { card: 'N:M',  x1: 325, y1: 194, x2: 325, y2: 260, lx: 332, ly: 231, anchor: 'start', weak: true },
    { card: 'N:1',  x1: 325, y1: 314, x2: 325, y2: 350, lx: 332, ly: 336, anchor: 'start', weak: true },
    { card: 'N:1',  x1: 170, y1: 283, x2: 262, y2: 194, lx: 200, ly: 250, anchor: 'middle', weak: true },
    { card: 'N:1',  x1: 555, y1: 140, x2: 555, y2:  84, lx: 562, ly: 116, anchor: 'start' },
    { card: 'N:1',  x1: 515, y1: 194, x2: 487, y2: 260, lx: 494, ly: 231, anchor: 'end' },
    { card: 'N:1',  x1: 600, y1: 194, x2: 660, y2: 260, lx: 646, ly: 231, anchor: 'start', weak: true },
    { card: 'N:M',  x1: 630, y1: 167, x2: 790, y2: 167, lx: 710, ly: 159, anchor: 'middle' },
    { card: 'N:M',  x1: 630, y1:  57, x2: 790, y2:  57, lx: 710, ly:  49, anchor: 'middle' },
    { card: '1:N',  x1: 865, y1:  84, x2: 865, y2: 140, lx: 872, ly: 116, anchor: 'start' },
    { card: '0..1', x1: 865, y1: 194, x2: 865, y2: 260, lx: 872, ly: 231, anchor: 'start' },
    // Species to molecule: routed up the empty corridor between the species
    // and mode boxes, since a straight line would cut through both.
    { card: 'N:1',  d: 'M 760,282 C 792,272 774,150 798,88', lx: 784, ly: 112, anchor: 'end', weak: true },
  ];

  let selected: string | null = null;

  function focusEntity(key: string) {
    selected = key;
    document.getElementById(`dm-entity-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Inventory controls ── */
  let siteKindFilter: SiteKind | null = null;
  let openChecks: Record<string, boolean> = {};

  const HITS_PREVIEW = 8;

  $: siteKinds = (() => {
    const counts = new Map<SiteKind, number>();
    for (const s of stats.sites) counts.set(s.kind!, (counts.get(s.kind!) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  })();

  $: shownSites = siteKindFilter
    ? stats.sites.filter(s => s.kind === siteKindFilter)
    : stats.sites;

  $: tagsByRole = (() => {
    const groups = new Map<TagRole, ValueRow[]>();
    for (const t of stats.tags) {
      const role = t.role ?? 'other';
      if (!groups.has(role)) groups.set(role, []);
      groups.get(role)!.push(t);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  })();

  $: linkedSpecies = stats.species.filter(s => s.molecule).length;

  /** Gas, adsorbed or unmarked, read off the way the string is written. */
  function phaseOf(value: string): string {
    if (/\(g(as)?\)/i.test(value)) return 'gas';
    if (/\*/.test(value)) return 'adsorbed';
    return '—';
  }

  const statusClass = (s: EntityStatus) => `st-${s}`;

  /** Legend order: most formal first, so the amber "bare string" row reads as the outlier. */
  const STATUS_ORDER: EntityStatus[] = ['record', 'lookup', 'inline', 'string', 'derived'];

  /* ── Scroll spy ──
     The page scrolls inside App.svelte's .main-area, not the window, so the
     listener attaches to that ancestor and measures against its own top edge.
     Same mechanism as the Style guide. */
  let root: HTMLElement;
  let scroller: HTMLElement | null = null;
  let activeId = SECTIONS[0].id;
  let frame = 0;

  function measure() {
    frame = 0;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let current = SECTIONS[0].id;
    for (const s of SECTIONS) {
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
  <h1 class="page-title">Data model</h1>
  <p class="lead">
    The atlas is six small databases that point at each other: bands, vibrations,
    references, tags, and the group and region lookups. Some of what they hold is a
    proper record with an id. The rest is a bare string repeated in many places, and a
    string cannot be filtered on, cannot carry attributes, and cannot be told apart from
    a different spelling of itself. This page says which is which, and reads every count
    below straight out of the shipped JSON.
  </p>

  <!-- ══════════ Part 1 ══════════ -->
  <h2 class="part" id="model" data-dm-section="model">1 &middot; The model</h2>

  <section class="section" id="map" data-dm-section="map">
    <h3>Entity map</h3>

    <div class="map-frame">
      <svg viewBox="0 0 960 420" class="map" role="img" aria-label="Entity relationship map">
        {#each EDGES as e}
          {#if e.d}
            <path class="edge" class:weak={e.weak} d={e.d} />
          {:else}
            <line class="edge" class:weak={e.weak} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
          {/if}
          <text class="edge-card" x={e.lx} y={e.ly} text-anchor={e.anchor ?? 'middle'}>{e.card}</text>
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
            <rect x={b.x} y={b.y} width={W} height={H} rx="6" />
            <text class="box-label" x={b.x + 12} y={b.y + 21}>{b.spec.label}</text>
            <text class="box-count" x={b.x + 12} y={b.y + 40}>{stats.counts[b.key] ?? 0}</text>
            <text class="box-status" x={b.x + W - 12} y={b.y + 40} text-anchor="end"
              >{STATUS_LABEL[b.spec.status]}</text>
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
          Amber boxes are the ones that only exist as strings. They are where the model is
          thinnest, and three of the four sit on the same edge: an assignment names its
          site, its material and its technique in free text.
        </p>
        <p class="hint">Click a box to jump to its entry.</p>

        <div class="tag-card">
          <div class="tag-card-head">Tag &middot; {stats.counts.tag} in use</div>
          <p>
            Left off the map on purpose: a tag attaches to three different entities, so its
            edges would cross everything. N:M with
            {#each TAG_TARGETS as t, i}<code>{ENTITY_BY_KEY[t].label}</code>{i < TAG_TARGETS.length - 1 ? ', ' : '.'}{/each}
          </p>
        </div>
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
          <span class="legend-note">A validated foreign key. The build fails if it dangles.</span>
        </div>
        <div class="legend-row">
          <span class="legend-chip legend-line dashed"></span>
          <span class="legend-name">Dashed edge</span>
          <span class="legend-note">A link that holds only because two strings match, or that does not exist yet.</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="entities" data-dm-section="entities">
    <h3>Entities</h3>
    <p class="section-lead">
      Fourteen of them. Five are real records; the other nine are values that behave like
      entities without being modelled as one.
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

          {#if e.promote}
            <div class="promote">
              <span class="promote-label">If it became a record</span>
              <span>{e.promote}</span>
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
          The rows marked <em>weak</em> are the ones nothing enforces. Six of the fifteen
          links in the model are weak, and every one of them is a string comparison
          standing in for a foreign key.
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
                  {#if r.weak}<span class="weak-flag">weak</span>{/if}{r.note}
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
          The distinction that catches people out is the last one: a band that
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
  <h2 class="part" id="contents" data-dm-section="contents">2 &middot; What is in the data</h2>

  <section class="section" id="sites" data-dm-section="sites">
    <h3>Sites and materials</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          {stats.sites.length} distinct strings are in the <code>site</code> field, and they
          are not one kind of thing. <code>Cu⁺</code> is a cation, <code>TiO₂</code> is an
          oxide surface, <code>Fe₃O₄(001)</code> is a facet, and <code>Cu/ZnO</code> is a
          whole catalyst that <em>contains</em> Cu⁰ and Cu⁺ sites without saying so.
        </p>
        <p>
          The kind column below is a proposal, worked out from how each string is written:
          an explicit charge means a cation, a slash or a dash means a sample, one metal
          plus oxygen means an oxide. Rows marked <span class="guess-flag">guess</span> are
          where the rule did not fire cleanly and a human has to decide.
        </p>
        <p class="hint">Filter by proposed kind:</p>
        <div class="kind-chips">
          <button class="chip" class:on={siteKindFilter === null} on:click={() => siteKindFilter = null}>
            all <span class="chip-n">{stats.sites.length}</span>
          </button>
          {#each siteKinds as [kind, n]}
            <button
              class="chip"
              class:on={siteKindFilter === kind}
              title={SITE_KIND_NOTE[kind]}
              on:click={() => siteKindFilter = siteKindFilter === kind ? null : kind}
            >{SITE_KIND_LABEL[kind]} <span class="chip-n">{n}</span></button>
          {/each}
        </div>
      </div>

      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Site string</th><th>Proposed kind</th><th>Elements</th><th class="num">Claims</th><th class="num">Bands</th><th class="num">Refs</th></tr>
          </thead>
          <tbody>
            {#each shownSites as s}
              <tr>
                <td class="v-value">{s.value}</td>
                <td>
                  <span class="kind-tag k-{s.kind}">{SITE_KIND_LABEL[s.kind ?? 'material']}</span>
                  {#if !s.sure}<span class="guess-flag">guess</span>{/if}
                </td>
                <td class="v-els">{(s.elements ?? []).join(' · ') || '—'}</td>
                <td class="num">{s.uses}</td>
                <td class="num">{s.bands.length}</td>
                <td class="num">{s.refs.length}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="species" data-dm-section="species">
    <h3>Species</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          {stats.species.length} distinct species strings across {stats.counts.band} bands, of
          which {linkedSpecies} match a molecule on the vibration-modes page by spelling.
          The rest do not, because the two files write the same species differently:
          <code>Methoxy (CH₃O*)</code> in one, <code>CH₃O*</code> in the other.
        </p>
        <p>
          Nothing validates either side, so the mismatch is invisible. What actually holds
          the two pages together is the explicit <code>band.vibration_modes</code> link,
          not this string.
        </p>
      </div>
      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Species string</th><th>Phase</th><th>Molecule</th><th class="num">Bands</th></tr>
          </thead>
          <tbody>
            {#each stats.species as s}
              <tr>
                <td class="v-value">{s.value}</td>
                <td class="v-phase">{phaseOf(s.value)}</td>
                <td>
                  {#if s.molecule}<code>{s.molecule}</code>{:else}<span class="dash">no match</span>{/if}
                </td>
                <td class="num">{s.uses}</td>
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
          One flat namespace, {stats.tags.length} tags in use, making five different kinds
          of statement. <code>drifts</code> says how the spectrum was taken,
          <code>overtone</code> says what the band is, <code>gas-phase</code> says what the
          species is doing, and <code>misassignment-warning</code> is a warning about the
          claim.
        </p>
        <p>
          Grouping them costs nothing and is the groundwork for lifting the ones that are
          really fields out of the pile. The scope markers say where each tag is written:
          on a band, on a single citation, or on a vibration mode.
        </p>
      </div>
      <div class="spread-visual">
        {#each tagsByRole as [role, rows]}
          <div class="role-block">
            <div class="role-head">
              <span class="role-name">{TAG_ROLE_LABEL[role]}</span>
              <span class="role-note">{TAG_ROLE_NOTE[role]}</span>
            </div>
            <div class="tag-rows">
              {#each rows as t}
                <div class="tag-row" title={tagTips[t.value]?.tip ?? 'No tooltip in tags.jsonc'}>
                  <code class="tag-name">{t.value}</code>
                  <span class="tag-scopes">
                    {#each t.scopes ?? [] as sc}<span class="scope sc-{sc}">{sc}</span>{/each}
                  </span>
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
          Listed here mostly to make the point that the entity exists whether or not it is
          modelled: {stats.authors.length} distinct people are already in the data.
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
                <td class="v-value">{a.value}</td>
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
  <h2 class="part" id="formalise" data-dm-section="formalise">3 &middot; Formalising</h2>

  <section class="section" id="technique" data-dm-section="technique">
    <h3>Measurement technique</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Three tags carry this today, and they do not describe the same axis. DRIFTS and
          ATR are sampling geometries; FTIR is the interferometer, which nearly every one
          of these measurements uses whatever the geometry; and a calculated frequency is
          not a measurement at all.
        </p>
        <p>
          A <code>technique</code> field on the assignment separates the two questions a
          reader actually asks: how was the sample presented to the beam, and was this
          measured or computed. The vocabulary below is a proposal; the marked rows are
          the ones already standing in as tags.
        </p>
      </div>
      <div class="spread-visual">
        <table class="inv-table">
          <thead>
            <tr><th>Value</th><th>In the data</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            {#each PROPOSED_TECHNIQUES as t}
              <tr>
                <td class="v-value">{t.label}</td>
                <td>
                  {#if t.currentTag}
                    <code>{t.currentTag}</code>
                  {:else}
                    <span class="dash">not yet</span>
                  {/if}
                </td>
                <td class="t-note">{t.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section" id="checks" data-dm-section="checks">
    <h3>What nothing checks yet</h3>
    <p class="section-lead">
      Computed live from the shipped JSON. None of these is an error today, because nothing
      in the build looks for them. Each one is a validation rule waiting for the entity it
      would validate against.
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

  <section class="section" id="order" data-dm-section="order">
    <h3>Migration order</h3>
    <div class="spread">
      <div class="spread-text">
        <p>
          Each step is useful on its own and none of them requires the next one, so they can
          stop at any point. The order is chosen so that no step has to be redone by a later
          one.
        </p>
      </div>
      <div class="spread-visual">
        <ol class="steps">
          <li>
            <span class="step-title">Split Site from Material</span>
            <span class="step-body">
              A <code>sites.jsonc</code> with id, label, kind, element and oxidation state,
              plus a <code>materials.jsonc</code> naming which sites each sample exposes.
              Validate that every <code>site</code> string resolves. The table above is the
              worklist.
            </span>
          </li>
          <li>
            <span class="step-title">Give the assignment an id</span>
            <span class="step-body">
              Once a claim is addressable, it can carry its own confidence and technique, and
              the <code>wn</code>/<code>site</code> arrays split into one row per claim
              instead of two parallel lists nothing pairs up.
            </span>
          </li>
          <li>
            <span class="step-title">Add the technique field</span>
            <span class="step-body">
              Closed vocabulary on the assignment, and retire the three technique tags. This
              is cheap after step 2 and awkward before it.
            </span>
          </li>
          <li>
            <span class="step-title">Make species a record</span>
            <span class="step-body">
              Formula, display label and phase in one place, and the band ↔ molecule link
              becomes a real foreign key rather than two strings that happen to match.
            </span>
          </li>
          <li>
            <span class="step-title">Move intensity, width and confidence onto the claim</span>
            <span class="step-body">
              All three are observation-dependent but authored on the band. The band keeps a
              rollup for the chart; the claim keeps what its paper actually reported.
            </span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</main>

<style>
  /* Type roles and colours come from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: 28px 48px 64px;
    max-width: 1180px;
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

  .spread-text strong { color: var(--ink-700); }

  .spread-visual { min-width: 0; }

  .hint {
    font-size: var(--t-code-size);
    color: var(--ink-200);
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

  .map { width: 100%; min-width: 860px; display: block; }

  .edge {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .edge.weak { stroke-dasharray: 4 3; stroke: var(--ink-050); }

  .edge-card {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-200);
  }

  .box { cursor: pointer; }
  .box rect {
    fill: var(--surface);
    stroke: var(--line-strong);
    stroke-width: 1.4;
    transition: filter 0.12s ease;
  }
  .box:hover rect { filter: brightness(0.97); }
  .box.selected rect { stroke-width: 2.6; }

  .box.st-record rect  { stroke: var(--brand-700); }
  .box.st-lookup rect  { stroke: var(--ink-300); }
  .box.st-inline rect  { stroke: var(--ink-300); fill: var(--surface-sunken); }
  .box.st-string rect  { stroke: var(--badge-site-border); fill: var(--badge-site-bg); }
  .box.st-derived rect { stroke: var(--badge-wn-border); fill: var(--badge-wn-bg); }

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
    grid-template-columns: 16px 92px 1fr;
    gap: 8px;
    align-items: baseline;
    font-size: var(--t-code-size);
  }

  .legend-chip {
    width: 14px;
    height: 11px;
    border-radius: 2px;
    border: 1.4px solid var(--line-strong);
    background: var(--surface);
    display: inline-block;
  }
  .legend-chip.st-record  { border-color: var(--brand-700); }
  .legend-chip.st-lookup  { border-color: var(--ink-300); }
  .legend-chip.st-inline  { border-color: var(--ink-300); background: var(--surface-sunken); }
  .legend-chip.st-string  { border-color: var(--badge-site-border); background: var(--badge-site-bg); }
  .legend-chip.st-derived { border-color: var(--badge-wn-border); background: var(--badge-wn-bg); }
  .legend-line {
    height: 0;
    border: 0;
    border-top: 1.6px solid var(--line-strong);
    align-self: center;
  }
  .legend-line.dashed { border-top-style: dashed; border-color: var(--ink-050); }

  .legend-name { font-weight: 600; color: var(--ink-600); }
  .legend-note { color: var(--ink-400); }

  .tag-card {
    margin-top: var(--space-4);
    background: var(--surface-sunken);
    border: 1px solid var(--line-soft);
    border-left: 3px solid var(--pill-border);
    border-radius: var(--radius);
    padding: 10px var(--space-4);
  }
  .tag-card-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin-bottom: 4px;
  }
  .tag-card p { margin: 0; color: var(--ink-500); font-size: var(--t-code-size); }

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
  .weak-flag, .guess-flag {
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
  .v-els, .v-phase { color: var(--ink-300); font-size: var(--t-code-size); }
  .t-note { color: var(--ink-400); font-size: var(--t-code-size); line-height: 1.45; }
  .dash { color: var(--ink-050); }
  .table-foot { font-size: var(--t-code-size); color: var(--ink-200); margin: 6px 0 0; }

  .kind-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
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

  .kind-tag {
    font-size: var(--t-micro-label-size);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--pill-border);
    background: var(--pill-bg);
    color: var(--pill-fg);
    white-space: nowrap;
  }
  .kind-tag.k-material {
    border-color: var(--badge-site-border);
    background: var(--badge-site-bg);
    color: var(--badge-site-fg);
  }

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
  .tag-name { background: none; padding: 0; color: var(--ink-600); }
  .tag-count { font-family: var(--t-code-ff); font-size: var(--t-code-size); color: var(--ink-200); }
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

  /* ── Migration steps ── */
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

  @media (max-width: 1000px) {
    .spread, .map-below { grid-template-columns: 1fr; gap: var(--space-4); }
  }
</style>

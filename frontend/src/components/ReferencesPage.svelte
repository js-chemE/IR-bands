<script lang="ts" context="module">
  /**
   * What the sidebar reports back: how much of each kind is on screen, and of
   * how many there are. The shown half moves with the filters, the total half
   * is what the atlas holds.
   */
  export interface RefCounts {
    papersShown: number; papersTotal: number;
    claimsShown: number; claimsTotal: number;
    modesShown: number; modesTotal: number;
    knowledgeShown: number; knowledgeTotal: number;
    /** Claims on screen per technique value, for the filter's own counts. */
    byTechnique: Record<string, number>;
  }
</script>

<script lang="ts">
  import { C } from '../lib/tokens';
  import type { Band, BandReference, GroupMap, RefMap, Vibrations, Molecule, VibrationMode } from '../lib/types';
  import { tagStyle } from '../lib/colors';
  import { esc, ieeeHtml, refSortKey, shortCite } from '../lib/citations';
  import { htmlToUnicode } from '../lib/notation';
  import { branchSuffix, speciesLabel, sortedMeasuredOnBadges, SURFACE_LEVEL_TITLE } from '../lib/labels';
  import { createEventDispatcher, onMount } from 'svelte';
  import { buildSections, countShown, type BandRef, type GroupDim } from '../lib/refGrouping';
  import { knowledgeLinks } from '../lib/fundamentals';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let sortedGroupKeys: string[];
  // Which two dimensions the page groups by, outer then inner.
  export let groupBy: GroupDim = 'reference';
  export let thenBy: GroupDim = 'group';
  // What else, besides bands, may list the papers it cites (sidebar switches).
  export let includeBands = true;
  export let includeModes = false;
  export let includeKnowledge = true;
  /** Which techniques a claim may name to show, or null for every one. */
  export let techniques: ReadonlySet<string> | null = null;

  const dispatch = createEventDispatcher<{
    navigateKnowledge: { key: string };
    counts: RefCounts;
  }>();
  const KNOWLEDGE = knowledgeLinks();

  // Neither dimension names the paper, so every claim row has to carry it
  // itself; when a reference IS one of the dimensions the heading already
  // says it, and repeating it on every row would be noise.
  $: showRowCite = groupBy !== 'reference' && thenBy !== 'reference';

  let open = new Set<string>();

  function toggleOpen(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    open = next;
  }

  // ---- Formatting helpers ----

  function bandNameHtml(b: Band): string {
    // The branch comes from vibration.branch in both paths now, rather than
    // being baked into `short` in one and appended in the other.
    const branch = esc(branchSuffix(b));
    if (b.short) return b.short + branch;
    const sub = b.vibration.subtype ? ` ${esc(b.vibration.subtype)}` : '';
    return `${esc(speciesLabel(b.species))}${sub} ${esc(b.vibration.category)}${branch}`;
  }

  // Label plus level, resolved from the surface keys the data carries. Most
  // specific first, so a claim naming both reads "Cu⁺  Cu/ZnO".
  const surfaceList = sortedMeasuredOnBadges;

  function wnList(ref: BandReference): number[] {
    if (ref.wn == null) return [];
    return Array.isArray(ref.wn) ? ref.wn : [ref.wn];
  }

  function qualityTags(b: Band): string[] {
    return [
      b.intensity  && b.intensity,
      b.confidence && b.confidence,
      b.width      && b.width,
    ].filter(Boolean) as string[];
  }

  // A mode's own characteristic wavenumber — same convention as
  // ModeList.svelte/ModeDetailPanel.svelte: a single value (with a "~"
  // prefix) or a range, independent of any band's own position.
  function modeWnLabel(m: VibrationMode): string | null {
    if (m.wn_start == null) return null;
    if (m.wn_end == null) return `~${m.wn_start} cm⁻¹`;
    return `${m.wn_start}–${m.wn_end} cm⁻¹`;
  }

  function topologyLabel(molecule: Molecule, mode: VibrationMode): string | null {
    if (!mode.topology) return null;
    return molecule.topologies.find(t => t.id === mode.topology)?.long ?? mode.topology;
  }

  // Both levels of grouping are data now: see lib/refGrouping.ts for the
  // dimensions and why mode-only citations only appear where a reference is
  // one of them.
  $: sections = buildSections(groupBy, thenBy, {
    bands,
    refs,
    groups,
    sortedGroupKeys,
    vibrations,
    includeBands,
    includeModes,
    knowledge: includeKnowledge ? KNOWLEDGE : null,
    techniques,
  });

  /** Stable per-row key, so expanding one row survives a regroup. */
  function rowId(sectionKey: string, bucketKey: string, e: BandRef): string {
    return `${sectionKey}|${bucketKey}|${e.band.id}|${e.ref.uid}`;
  }

  // The totals are what exists, not what is selected, so they are counted
  // here rather than inside countShown: two of them are unreachable from a
  // context whose own switches have already emptied them.
  $: shown = countShown(sections, groupBy, thenBy);
  $: counts = {
    papersShown: shown.papers,
    papersTotal: Object.keys(refs ?? {}).length,
    claimsShown: shown.claims,
    claimsTotal: bands.reduce((n, b) => n + b.references.length, 0),
    modesShown: shown.modes,
    modesTotal: (vibrations?.molecules ?? []).reduce(
      (n, m) => n + m.modes.filter(x => x.reference.length > 0).length, 0),
    knowledgeShown: shown.knowledge,
    knowledgeTotal: [...KNOWLEDGE.values()].reduce((n, l) => n + l.length, 0),
    byTechnique: shown.byTechnique,
  };
  // A reactive dispatch during initialisation runs before the parent has
  // attached its listener, so the first set of counts is lost and the sidebar
  // shows nothing until something else changes. Repeat it once on mount.
  $: dispatch('counts', counts);
  onMount(() => dispatch('counts', counts));

</script>

<main class="content">
  <!-- How much of the bibliography the current filters leave on screen. It
       sits here rather than in the sidebar because it reads rather than
       switches: everything in the sidebar is a control, and a number among
       the controls invites being clicked. -->
  <div class="source-count">
    <span class="sc-n">{counts.papersShown} / {counts.papersTotal}</span>
    <span class="sc-label">sources shown</span>
  </div>

  {#each sections as section (section.key)}
    <!-- The outer heading carries the group colour when it is a group, the
         citation when it is a reference, and a plain label otherwise. -->
    <!-- A reference section is a citation card; every other dimension gets
         the neutral group card, tinted when it has a colour of its own. -->
    <div
      class={section.html ? 'ref-card' : 'group-card'}
      id={groupBy === 'reference' ? `refcard-${section.key}` : undefined}
      style={section.color ? `--group-color:${section.color}; border-left-color:${section.color}` : ''}
    >
      {#if section.html}
        <div class="ref-card-citation">{@html section.html}</div>
      {:else}
        <div
          class="group-card-header"
          class:as-typed={groupBy !== 'group'}
          style={section.color ? `color:${section.color}; border-bottom-color:${section.color}22` : ''}
        >
          {section.label}
          {#if section.sub}<span class="header-sub">{section.sub}</span>{/if}
        </div>
      {/if}

      {#each section.buckets as bucket (bucket.key)}
        <!-- A reference bucket keeps its own nested citation card; the rest
             are a light labelled divider, as the by-reference view always was. -->
        <div
          class={bucket.html ? 'ref-sub-card' : 'group-section'}
          id={thenBy === 'reference' ? `refcard-${bucket.key}` : undefined}
        >
          {#if bucket.html}
            <div class="ref-sub-citation">{@html bucket.html}</div>
          {:else}
            <div
              class="group-label"
              class:as-typed={thenBy !== 'group'}
              style={bucket.color ? `color:${bucket.color}` : ''}
            >
              {bucket.label}
              {#if bucket.sub}<span class="header-sub">{bucket.sub}</span>{/if}
            </div>
          {/if}

          {#each bucket.entries as e (rowId(section.key, bucket.key, e))}
            {@const id = rowId(section.key, bucket.key, e)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
              <div class="band-row-line">
                <span class="band-name">{@html bandNameHtml(e.band)}</span>
                {#if e.ref.wn != null}
                  {#each wnList(e.ref) as w}
                    <span class="badge-wn">{w} cm⁻¹</span>
                  {/each}
                {:else}
                  <span class="badge-wn">{e.band.wn_min}–{e.band.wn_max} cm⁻¹</span>
                {/if}
                {#each surfaceList(e.ref) as s}
                  <span
                    class="badge-site"
                    class:badge-coarse={s.level !== 'site'}
                    title={SURFACE_LEVEL_TITLE[s.level]}
                  >{s.label}</span>
                {/each}
                {#each qualityTags(e.band) as tag}
                  <span class="badge-quality">{tag}</span>
                {/each}
                {#each e.ref.tags as tag}
                  {@const style = tagStyle(tag)}
                  <span class="badge-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                {/each}
                {#if showRowCite}
                  <span class="row-cite" title={htmlToUnicode(ieeeHtml(refs?.[e.ref.key] ?? {}, e.ref.key))}>
                    {shortCite(refs?.[e.ref.key] ?? {}, e.ref.key)}
                  </span>
                {/if}
                <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
              </div>
              {#if open.has(id)}
                <div class="band-expand">
                  {#if e.band.description}
                    <div class="expand-desc">{@html e.band.description}</div>
                  {/if}
                  {#if e.ref.wn != null}
                    <div class="expand-note">range: {e.band.wn_min}–{e.band.wn_max} cm⁻¹</div>
                  {/if}
                  {#if e.ref.note}
                    <div class="expand-note">{e.ref.note}</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}

          {#each bucket.moleculeModes as mm (mm.molecule.id)}
          <div class="group-section">
            <div class="group-label mode-group-label">{mm.molecule.label} — vibration modes</div>
            {#each mm.modes as mode (mode.id)}
              {@const id = `${section.key}-${bucket.key}-${mode.id}`}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                <div class="band-row-line">
                  <span class="band-name">{mode.label}</span>
                  {#if mode.herzberg_notation}
                    <span class="badge-quality">{mode.herzberg_notation}</span>
                  {/if}
                  {#if topologyLabel(mm.molecule, mode)}
                    <span class="badge-site">{topologyLabel(mm.molecule, mode)}</span>
                  {/if}
                  {#if modeWnLabel(mode)}
                    <span class="badge-wn">{modeWnLabel(mode)}</span>
                  {/if}
                  <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                </div>
                {#if open.has(id) && mode.note}
                  <div class="band-expand">
                    <div class="expand-desc">{mode.note}</div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          {/each}
        </div>
      {/each}

      <!-- The Knowledge cards that cite this paper, each one a way back to it. -->
      {#if section.knowledge.length}
        <div class="group-section">
          <div class="group-label knowledge-label">Knowledge</div>
          {#each section.knowledge as k (k.key)}
            <button class="band-row knowledge-row" on:click={() => dispatch('navigateKnowledge', { key: k.key })}>
              <span class="band-row-line">
                <span class="band-name">{k.label}</span>
                {#each k.where as w}<span class="badge-quality">{w}</span>{/each}
                <span class="knowledge-go">open →</span>
              </span>
            </button>
          {/each}
        </div>
      {/if}

      {#each section.moleculeModes as mm (mm.molecule.id)}
          <div class="group-section">
            <div class="group-label mode-group-label">{mm.molecule.label} — vibration modes</div>
            {#each mm.modes as mode (mode.id)}
              {@const id = `${section.key}-${mode.id}`}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                <div class="band-row-line">
                  <span class="band-name">{mode.label}</span>
                  {#if mode.herzberg_notation}
                    <span class="badge-quality">{mode.herzberg_notation}</span>
                  {/if}
                  {#if topologyLabel(mm.molecule, mode)}
                    <span class="badge-site">{topologyLabel(mm.molecule, mode)}</span>
                  {/if}
                  {#if modeWnLabel(mode)}
                    <span class="badge-wn">{modeWnLabel(mode)}</span>
                  {/if}
                  <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                </div>
                {#if open.has(id) && mode.note}
                  <div class="band-expand">
                    <div class="expand-desc">{mode.note}</div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
      {/each}
    </div>
  {/each}

  {#if sections.length === 0}
    <p class="empty">Nothing to show for this grouping.</p>
  {/if}
</main>

<style>
  .content {
    padding: 24px 40px;
    max-width: 900px;
    margin: 0 auto;
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.55;
  }

  /* The bibliography count, top left of the page itself rather than in the
     sidebar: everything in the sidebar is a control, and a number sitting
     among switches invites being clicked. Here it reads as a caption. */
  .source-count {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 14px;
  }
  .sc-n {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-slate-900);
  }
  .sc-label {
    font-size: var(--t-diagram-note-size);
    color: var(--ink-050);
  }

  /* ── Shared badge styles (mirror tooltip) ── */
  .badge-wn {
    background: var(--badge-wn-bg);
    border: 1px solid var(--badge-wn-border);
    color: var(--badge-wn-fg);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .badge-site {
    background: var(--badge-site-bg);
    border: 1px solid var(--badge-site-border);
    color: var(--badge-site-fg);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Hollow variant of the site badge: a phase or a sample, coarser than the
     atom-scale spot, so the scale of the claim reads at a glance. */
  .badge-coarse {
    background: var(--badge-site-bg-soft);
  }

  .badge-quality {
    background: var(--pill-bg);
    border: 1px solid var(--line-panel);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    color: var(--ink-500);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .badge-ref-tag {
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Band row (shared) ── */
  .band-row {
    cursor: pointer;
    border-radius: 3px;
    margin: 1px 0;
  }
  .band-row:hover { background: rgba(0,0,0,0.04); }

  .band-row-line {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    padding: 3px 4px;
  }

  .band-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-800);
    margin-right: 2px;
  }
  .band-name :global(sub), .band-name :global(sup) { font-size: 0.75em; }

  /* Pushed to the right edge of the row: it identifies the row rather than
     describing the band, so it reads as an attribution, not another badge.
     The full citation is on the tooltip. */
  .row-cite {
    margin-left: auto;
    padding-left: 10px;
    font-size: 11.5px;
    color: var(--ink-200);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expand-arrow {
    font-size: 10px;
    color: var(--ink-050);
    margin-left: auto;
    flex-shrink: 0;
    padding-left: 4px;
  }
  /* Only one of the two claims the free space. */
  .row-cite + .expand-arrow { margin-left: 0; }

  .band-expand {
    padding: 2px 4px 6px 8px;
    border-left: 2px solid var(--line-panel);
    margin: 0 4px 3px 4px;
  }

  .expand-desc {
    font-size: 12.5px;
    color: var(--ink-500);
    line-height: 1.4;
  }
  .expand-desc :global(sub), .expand-desc :global(sup) { font-size: 0.75em; }

  .expand-note {
    font-size: 12px;
    color: var(--ref-meta);
    font-style: italic;
    margin-top: 2px;
    line-height: 1.35;
  }

  /* ── By-reference view ── */
  .ref-card {
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: 6px;
    padding: 14px 16px 10px;
    margin-bottom: 14px;
    scroll-margin-top: 16px;
  }

  .ref-card-citation {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-800);
    line-height: 1.55;
    margin-bottom: 8px;
  }
  .ref-card-citation :global(em) { font-style: italic; }
  .ref-card-citation :global(a.ext) { color: var(--ref-accent-strong); text-decoration: none; font-size: 12px; }
  .ref-card-citation :global(a.ext:hover) { color: var(--ref-link-hover); }

  .group-section { margin-top: 7px; }

  .group-label {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
    opacity: 0.9;
  }

  /* Vibration-mode citations get their own neutral color (not tied to any
     chart group, since a mode isn't a band) rather than reusing g.color. */
  .mode-group-label { color: var(--accent-violet); }

  /* Knowledge carries its section colour, as on the home page and the header. */
  .knowledge-label { color: var(--accent-green-fg); }
  .knowledge-row {
    display: block;
    width: 100%;
    border: none;
    background: none;
    font: inherit;
    text-align: left;
    color: inherit;
  }
  .knowledge-go {
    margin-left: auto;
    font-size: var(--t-code-size);
    color: var(--accent-green-fg);
  }


  /* Only a group name is upper-cased, as it always was. A site, a sample or
     an element is written the way chemistry writes it: upper-casing "Cu⁺"
     gives "CU⁺", and "Co" gives carbon monoxide instead of cobalt. */
  .group-card-header.as-typed,
  .group-label.as-typed { text-transform: none; }

  /* Composition, kind, elements: the detail under a heading that is not a
     citation and not a coloured group. */
  .header-sub {
    display: block;
    margin-top: 3px;
    font-size: var(--t-code-size);
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
    color: var(--ink-300);
  }

  .empty {
    color: var(--ink-300);
    font-size: 13.5px;
  }

  .group-card-header {
    font-size: 21px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--line-faint);
  }

  .ref-sub-card {
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: 4px;
    padding: 10px 12px 7px;
    margin-bottom: 10px;
  }

  .ref-sub-citation {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-800);
    line-height: 1.5;
    margin-bottom: 6px;
  }
  .ref-sub-citation :global(em) { font-style: italic; }
  .ref-sub-citation :global(a.ext) { color: var(--ref-accent-strong); text-decoration: none; font-size: 12px; }
  .ref-sub-citation :global(a.ext:hover) { color: var(--ref-link-hover); }
</style>

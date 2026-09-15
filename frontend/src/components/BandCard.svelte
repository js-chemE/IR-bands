<!--
  A band's detail card: the one rendering of what a band is, in both places it
  is read.

  The chart floats it beside the pointer on hover (`full` false: the name, the
  range, the tags, the bare citations, and nothing that takes a paragraph),
  and docks it in the sidebar beside the chart on a click (`full` true: the
  mode diagrams in the header, the band's own description, every reference
  with its note).

  It is one component on purpose. The card is the densest thing in the atlas
  and the two readings differ only in how much of it is shown, so two
  implementations would drift within a month. What differs between the hosts
  is the box around it, which is the host's business: the chart gives it a
  fixed, pointer-following shell, the sidebar a column.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { TAG_STYLES } from '../lib/tokens';
  import { tagStyle } from '../lib/colors';
  import { SURFACE_LEVEL_TITLE } from '../lib/labels';
  import VibrationMiniCard from './vibration/VibrationMiniCard.svelte';
  import type { TipData } from '../lib/chart';
  import type { Spectroscopy } from '../lib/types';
  import type { LinkedMode } from '../lib/vibrationLinks';

  export let td: TipData;
  /** The band's own colour, for the header rule and the group line. */
  export let color = '';
  /** Docked: show the diagrams, the description and every reference note. */
  export let full = false;
  /** Which selection rule the chart draws, for the "off" claim wording. */
  export let spectroscopy: Spectroscopy = 'ir';
  /** How many references a folded (hover) card lists before it says "+N more". */
  export let refsPreview = 3;
  /** The band's vibration modes, already resolved by the host. */
  export let linkedModes: LinkedMode[] = [];
  /** Bumped by the host to replay every mode diagram at once. */
  export let playNonce = 0;
  /**
   * Take the host's full height, and give the leftover to the reference list.
   *
   * The sidebar wants this and the floating tooltip does not: the tooltip is
   * as tall as it needs to be and no taller, while the sidebar is a column of
   * fixed height whose bottom half should be the papers. Either way the list
   * is the only thing that scrolls, so the identity, the tags and the
   * description stay on screen, and the hint under it sits directly after the
   * last reference rather than pinned to the floor.
   */
  export let fill = false;

  const dispatch = createEventDispatcher<{
    navigateRef: { key: string };
    navigateMode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  function wnList(wn: number | number[] | null): number[] {
    if (wn == null) return [];
    return Array.isArray(wn) ? wn : [wn];
  }

  /* Which references are open, reset whenever the card changes band. More
     than one claim and they all start folded: a band with nine papers behind
     it is a list to scan, not nine paragraphs to wade through. */
  let expandedRefs = new Set<number>();
  /* The molecule section, closed until asked for and closed again on the next
     band: a reader who opened it for one band has not asked to see every
     diagram from then on. */
  let molOpen = false;
  let expandedForBandId: string | null = null;
  $: if (td.id !== expandedForBandId) {
    expandedRefs = new Set();
    molOpen = false;
    expandedForBandId = td.id;
  }
  function toggleRefExpand(i: number) {
    const next = new Set(expandedRefs);
    if (next.has(i)) next.delete(i); else next.add(i);
    expandedRefs = next;
  }
</script>

<div class="band-card" class:fill>
      <!-- Header -->
      <div class="tip-header" style="border-left-color:{color}">
        <div class="tip-name">{td.name}</div>
        <div class="tip-vib">{td.vib}</div>
        <div class="tip-wn">{td.wnRange}</div>
        <div class="tip-group" style="color:{color}">{td.group}</div>
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

      <!-- General description. Not on a quiet hover: it is a paragraph, and a
           paragraph is not read off a chart in passing. -->
      {#if td.description && full}
        <div class="tip-desc">{td.description}</div>
      {/if}

      <!-- The molecule, folded away. The diagrams are the best thing on the
           card and the most expensive: at the size they need to read they
           push the references off the bottom of the column, so they open
           when they are asked for. Two to a row, and a third wraps. -->
      {#if full && linkedModes.length}
        <div class="mol-section">
          <button class="mol-toggle" on:click={() => (molOpen = !molOpen)} aria-expanded={molOpen}>
            <span class="mol-caret" class:open={molOpen}>▸</span>
            Molecule
            <span class="mol-count">{linkedModes.length}</span>
          </button>
          {#if molOpen}
            <div class="mol-grid">
              {#each linkedModes as lm (lm.mode.id)}
                <VibrationMiniCard
                  mode={lm.mode}
                  geometry={lm.geometry}
                  triggerNonce={playNonce}
                  interactive={true}
                  diagramSize={104}
                  on:navigate={() => dispatch('navigateMode', { moleculeId: lm.moleculeId, topologyId: lm.topologyId, modeId: lm.mode.id })}
                />
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Per-reference boxes -->
      {#if td.refs.length}
        {@const isCollapsible = td.refs.length > 1}
        {@const useScroll = full && (fill || td.refs.length > refsPreview)}
        {@const refsToShow = full ? td.refs : td.refs.slice(0, refsPreview)}
        <!-- Filling a column, the list is always the scrolling part: it is
             what the column has left after the identity and the prose, and
             three references or thirty, the rule is the same. Floating, it
             only scrolls once there are more than the card would show. -->
        <div class="tip-refs-section">
          <div class="tip-refs-header">
            References
            {#if !full && td.refs.length > refsPreview}
              <span class="tip-refs-overflow">+{td.refs.length - refsPreview} more · click band</span>
            {/if}
          </div>

          <div class:tip-refs-scroll={useScroll}>
            {#each refsToShow as ref, i}
              <!-- A claim from the other spectroscopy, or one with no
                   technique recorded, folds even when it is the only one,
                   and is greyed out. -->
              {@const foldable = isCollapsible || ref.off}
              {@const expanded = !foldable || expandedRefs.has(i)}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div
                class="tip-ref-box"
                class:tip-ref-btn={foldable}
                class:tip-ref-off={ref.off}
                on:click={foldable ? () => toggleRefExpand(i) : null}
                title={ref.off === 'other'
                  ? `Measured by ${spectroscopy === 'raman' ? 'infrared' : 'Raman'}, not the spectroscopy the chart shows. Click to ${expanded ? 'collapse' : 'expand'}`
                  : ref.off === 'unknown'
                    ? `No technique recorded for this claim, so it is neither IR nor Raman yet. Click to ${expanded ? 'collapse' : 'expand'}`
                    : ref.off === 'calculated'
                      ? `A calculation, not a measurement. Dimmed because the Color by computational pill is asking for measured evidence; click that pill to draw it like any other claim. Click here to ${expanded ? 'collapse' : 'expand'}`
                      : foldable ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
              >
                <button
                  class="tip-ref-goto-btn"
                  on:click|stopPropagation={() => dispatch('navigateRef', { key: ref.key })}
                  title="Open in References page"
                >↗</button>
                <div class="tip-ref-title">
                  {ref.short}
                  {#if foldable}
                    <span class="tip-ref-chevron" class:open={expanded}>▸</span>
                  {/if}
                </div>
                {#if ref.wn != null || ref.surfaces.length}
                  <div class="tip-ref-badges">
                    {#each wnList(ref.wn) as w}
                      <span class="badge-wn">{w} cm⁻¹</span>
                    {/each}
                    {#each ref.surfaces as s}
                      <span
                        class="badge-site"
                        class:badge-coarse={s.level !== 'site'}
                        title={SURFACE_LEVEL_TITLE[s.level]}
                      >{s.label}</span>
                    {/each}
                  </div>
                {/if}
                {#if ref.tags.length}
                  <div class="tip-ref-tags">
                    {#each ref.tags as tag}
                      {@const style = tagStyle(tag)}
                      <span class="tip-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                    {/each}
                  </div>
                {/if}
                {#if expanded && ref.note && full}
                  <div class="tip-ref-note">{ref.note}</div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if full}
        <div class="tip-lock-hint">click ref to expand · ↗ for ref page · click band to switch · click empty to clear</div>
      {/if}
</div>

<style>
  .tip-header {
    border-left: 3px solid var(--ink-200); /* overridden inline */
    padding-left: 7px;
    margin-bottom: 6px;
  }
  /* Every text role below is defined once in lib/tokens.ts and shown on the
     Style guide page; edit the value there, never here. */
  .tip-name {
    font-size: var(--t-tip-name-size);
    font-weight: var(--t-tip-name-weight);
    color: var(--t-tip-name-color);
    line-height: var(--t-tip-name-lh);
  }
  .tip-vib {
    font-size: var(--t-tip-vib-size);
    font-weight: var(--t-tip-vib-weight);
    color: var(--t-tip-vib-color);
    margin-top: 1px;
  }
  .tip-wn {
    font-size: var(--t-tip-wn-size);
    font-weight: var(--t-tip-wn-weight);
    color: var(--t-tip-wn-color);
    font-family: var(--t-tip-wn-ff);
    margin-top: 1px;
  }
  .tip-group {
    font-size: var(--t-tip-group-size);
    font-weight: var(--t-tip-group-weight);
    text-transform: var(--t-tip-group-tt);
    letter-spacing: var(--t-tip-group-ls);
    margin-top: 3px;
  }

  .tip-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 5px;
  }
  .tip-tag {
    background: var(--pill-bg);
    border: 1px solid var(--pill-border);
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    font-size: var(--t-tip-tag-size);
    color: var(--t-tip-tag-color);
  }
  .tip-tag-extra {
    background: var(--pill-muted-bg);
    border-color: var(--pill-muted-border);
    color: var(--pill-muted-fg);
  }

  .tip-desc {
    font-size: var(--t-tip-desc-size);
    color: var(--t-tip-desc-color);
    line-height: var(--t-tip-desc-lh);
    margin-bottom: 6px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--line-faint);
  }

  .tip-refs-section { margin-top: 2px; }

  .tip-refs-header {
    font-size: var(--t-tip-refs-head-size);
    font-weight: var(--t-tip-refs-head-weight);
    text-transform: var(--t-tip-refs-head-tt);
    letter-spacing: var(--t-tip-refs-head-ls);
    color: var(--t-tip-refs-head-color);
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
    color: var(--ink-025);
  }

  .tip-refs-scroll {
    max-height: var(--tip-refs-max-h);
    overflow-y: auto;
    overflow-x: hidden;
    border-radius: 3px;
  }
  .tip-refs-scroll::-webkit-scrollbar { width: 4px; }
  .tip-refs-scroll::-webkit-scrollbar-thumb { background: var(--ref-scroll-thumb); border-radius: 2px; }

  .tip-ref-box {
    position: relative;
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: var(--radius);
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
    background: var(--ref-surface-hover);
    border-left-color: var(--ref-accent-strong);
  }

  .tip-ref-chevron {
    display: inline-block;
    font-size: 9px;
    color: var(--ref-accent-strong);
    margin-left: 4px;
    transition: transform 0.15s;
  }
  .tip-ref-chevron.open { transform: rotate(90deg); }

  /* A claim from the other spectroscopy, or with no technique: greyed out,
     folded until clicked. */
  .tip-ref-off {
    filter: grayscale(1);
    opacity: 0.55;
  }
  .tip-ref-off:hover { opacity: 0.8; }

  .tip-ref-title {
    font-size: var(--t-tip-ref-title-size);
    font-weight: var(--t-tip-ref-title-weight);
    color: var(--t-tip-ref-title-color);
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
    background: var(--surface);
    border: 1px solid var(--ref-border);
    border-radius: 4px;
    color: var(--ref-accent-strong);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .tip-ref-goto-btn:hover {
    background: var(--ref-surface-hover);
    border-color: var(--ref-accent-strong);
    color: var(--ref-accent-deep);
  }

  .tip-ref-badges {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .badge-wn {
    background: var(--badge-wn-bg);
    border: 1px solid var(--badge-wn-border);
    color: var(--badge-wn-fg);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-tip-badge-size);
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .badge-site {
    background: var(--badge-site-bg);
    border: 1px solid var(--badge-site-border);
    color: var(--badge-site-fg);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-tip-badge-size);
    white-space: nowrap;
  }

  /* A phase or a sample is coarser than a site: same amber pair, hollow
     instead of filled, so the scale of the claim reads at a glance. A variant
     of the site badge, not a second pill style. */
  .badge-coarse {
    background: var(--badge-site-bg-soft);
  }

  .tip-ref-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .tip-ref-tag {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    font-size: var(--t-tip-tag-size);
  }

  .tip-ref-note {
    font-size: var(--t-tip-ref-note-size);
    color: var(--t-tip-ref-note-color);
    font-style: var(--t-tip-ref-note-fs);
    margin-top: 4px;
    line-height: var(--t-tip-ref-note-lh);
  }

  .tip-lock-hint {
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px solid var(--line-faint);
    font-size: var(--t-tip-hint-size);
    color: var(--t-tip-hint-color);
    text-align: center;
  }

  /* Filling, the card is a column and the reference list is the one part
     that gives: everything above it stays put and it takes what is left.
     `min-height: 0` twice over, because a flex child will not shrink below
     its content without it and the list would push the hint off the bottom. */
  .band-card.fill {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .band-card.fill .tip-refs-section {
    display: flex;
    flex-direction: column;
    flex: 0 1 auto;
    min-height: 0;
  }
  .band-card.fill .tip-refs-scroll {
    flex: 0 1 auto;
    min-height: 0;
    max-height: none;
  }

  /* ── The molecule section ── */
  .mol-section {
    flex: 0 0 auto;
    margin-top: 8px;
  }

  .mol-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 0;
    background: none;
    border: none;
    font-family: inherit;
    font-size: var(--t-tip-section-size, 11px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-slate-400);
    cursor: pointer;
    text-align: left;
  }
  .mol-toggle:hover { color: var(--ink-600); }

  .mol-caret {
    display: inline-block;
    transition: transform 0.15s ease;
    font-size: 10px;
  }
  .mol-caret.open { transform: rotate(90deg); }

  .mol-count {
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-200);
  }

  /* Two to a row, and a third wraps onto the next. `minmax(0, 1fr)` so a wide
     molecule shrinks to its column instead of stretching the grid. */
  .mol-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mol-caret { transition: none; }
  }
</style>

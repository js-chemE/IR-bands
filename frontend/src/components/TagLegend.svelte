<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LegendTag } from '../lib/chart';

  export let tags: LegendTag[];
  export let hiddenTags: ReadonlySet<string>;
  // Double-click "isolate": which one tag (if any) is the sole active
  // filter right now. Drives visibility on its own, independent of
  // hiddenTags — see App.svelte's handleTagDblClick for why isolating a
  // multi-valued tag can't just be "hide every other tag".
  export let tagIsolate: string | null = null;
  // Tag -> short tooltip text, loaded from data/tags.jsonc. Optional: tags
  // without an entry just render without a tooltip (see that file's preamble).
  export let tagTips: Record<string, { tip: string }> = {};

  const dispatch = createEventDispatcher<{
    tagToggle:   { tag: string; visible: boolean };
    tagDblClick: { tag: string };
    tagHover:    { tag: string | null };
  }>();

  // A native <button> fires click, click, THEN dblclick for one double-click
  // gesture — so the single-click handler below would otherwise always run
  // twice (toggling on, then off again) before the dblclick handler ever
  // sees it, and a *second* double-click on an already-isolated item would
  // have its first click already mutate state out from under the dblclick
  // handler's own logic. Debouncing the single click — deferring it just
  // long enough to cancel if a second click (dblclick) follows — makes
  // single- and double-click mutually exclusive at the source, the way a
  // user actually intends them.
  const DBLCLICK_WINDOW_MS = 280;
  let pendingClick: ReturnType<typeof setTimeout> | null = null;

  function onClick(tag: string, visible: boolean) {
    if (pendingClick) clearTimeout(pendingClick);
    pendingClick = setTimeout(() => {
      pendingClick = null;
      dispatch('tagToggle', { tag, visible: !visible });
    }, DBLCLICK_WINDOW_MS);
  }

  function onDblClick(tag: string) {
    if (pendingClick) { clearTimeout(pendingClick); pendingClick = null; }
    dispatch('tagDblClick', { tag });
  }
</script>

{#if tags.length > 0}
  <div class="legend">
    {#each tags as t, i (t.key)}
      {@const active = tagIsolate ? t.key === tagIsolate : !hiddenTags.has(t.key)}
      {@const visible = active && t.visibleCount > 0}
      {@const tip = tagTips[t.key]?.tip}
      {@const counted = t.visibleCount === t.count
        ? `${t.count} band${t.count !== 1 ? 's' : ''}`
        : `${t.visibleCount} of ${t.count} bands shown`}
      <button
        class="item"
        class:role-start={i > 0 && tags[i - 1].role !== t.role}
        class:dimmed={!visible}
        class:isolated={t.key === tagIsolate}
        style={visible
          ? `background:${t.background}; border-color:${t.border}; color:${t.color}`
          : ''}
        title="{t.roleLabel} · {counted}{tip ? ' — ' + tip : ''}"
        on:click={() => onClick(t.key, visible)}
        on:dblclick={() => onDblClick(t.key)}
        on:mouseenter={() => dispatch('tagHover', { tag: t.key })}
        on:mouseleave={() => dispatch('tagHover', { tag: null })}
      >
        {t.label}
      </button>
    {/each}
  </div>
{/if}

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 2px 4px;
    padding: 5px 12px 7px;
    font-size: 13px;
    color: var(--ink-500);
  }

  /* The legend entry IS the tag pill, styled exactly as the band tooltip
     renders it, so the legend and the chart show the same object rather than
     a swatch standing in for one. Colours arrive inline from TAG_STYLES; the
     rule below is both the fallback for an untyped tag and the toggled-off
     state. */
  .item {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border: 1px solid var(--pill-muted-border);
    border-radius: var(--radius-sm);
    background: var(--pill-muted-bg);
    color: var(--pill-muted-fg);
    font: inherit;
    font-size: var(--t-tip-tag-size);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: filter 0.12s ease;
  }

  /* Inline colours would win over a background change, so hover shades. */
  .item:hover { filter: brightness(0.95); }

  /* The legend is sorted by role (chart.ts). A little extra space at each
     change of role is enough to show the grouping; labelling the roles here
     would cost more room than the grouping is worth, and the tooltip names
     the role anyway. */
  .role-start { margin-left: 14px; }

  /* Toggled off: the same pill, greyed. Same size and position, so the row
     does not reflow when a tag is switched on and off. */
  .dimmed {
    background: var(--pill-muted-bg);
    border-color: var(--pill-muted-border);
    color: var(--ink-025);
    /* Most tags already render as a muted grey pill, so recolouring alone is
       not a visible enough "off". Fading the whole pill reads as off whatever
       colour the tag carries. */
    opacity: 0.5;
  }

  /* Isolated: ring it rather than repaint it, so the tag keeps its own
     colour while still reading as the one active filter. */
  .isolated { box-shadow: 0 0 0 2px var(--accent-blue-soft-line); }
</style>

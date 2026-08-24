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
    {#each tags as t (t.key)}
      {@const visible = tagIsolate ? t.key === tagIsolate : !hiddenTags.has(t.key)}
      {@const tip = tagTips[t.key]?.tip}
      <button
        class="item"
        class:dimmed={!visible}
        class:isolated={t.key === tagIsolate}
        title="{t.count} band{t.count !== 1 ? 's' : ''}{tip ? ' — ' + tip : ''}"
        on:click={() => onClick(t.key, visible)}
        on:dblclick={() => onDblClick(t.key)}
        on:mouseenter={() => dispatch('tagHover', { tag: t.key })}
        on:mouseleave={() => dispatch('tagHover', { tag: null })}
      >
        <span class="swatch" style="background:{t.background};border-color:{t.border}"></span>
        <span class="label" style="color:{visible ? t.color : undefined}">{t.label}</span>
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

  .item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
  }

  .item:hover { background: var(--surface-hover); }

  /* pill swatch — wider, more rounded, visually distinct from the square in ColorLegend */
  .swatch {
    width: 18px;
    height: 9px;
    border-radius: 6px;
    border: 1px solid var(--pill-muted-border);
    flex: 0 0 auto;
  }

  .label { flex: 0 0 auto; }

  .dimmed .label { color: var(--ink-025) !important; text-decoration: line-through; }
  .dimmed .swatch { opacity: 0.3; }

  .isolated { background: var(--accent-blue-soft-bg); }
  .isolated:hover { background: var(--accent-blue-soft-bg-alt); }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LegendCategory } from '../lib/types';

  export let categories: LegendCategory[];
  export let hiddenCats: ReadonlySet<string>;

  const dispatch = createEventDispatcher<{
    catToggle:   { cat: string; visible: boolean };
    catDblClick: { cat: string };
    catHover:    { cat: string | null };
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

  function onClick(cat: string, visible: boolean) {
    if (pendingClick) clearTimeout(pendingClick);
    pendingClick = setTimeout(() => {
      pendingClick = null;
      dispatch('catToggle', { cat, visible: !visible });
    }, DBLCLICK_WINDOW_MS);
  }

  function onDblClick(cat: string) {
    if (pendingClick) { clearTimeout(pendingClick); pendingClick = null; }
    dispatch('catDblClick', { cat });
  }
</script>

{#if categories.length > 0}
  <div class="legend">
    {#each categories as c (c.key)}
      {@const visible = !hiddenCats.has(c.key)}
      <button
        class="item"
        class:dimmed={!visible}
        title="{c.count} band{c.count !== 1 ? 's' : ''}"
        on:click={() => onClick(c.key, visible)}
        on:dblclick={() => onDblClick(c.key)}
        on:mouseenter={() => dispatch('catHover', { cat: c.key })}
        on:mouseleave={() => dispatch('catHover', { cat: null })}
      >
        <span class="swatch" style="background:{c.color}"></span>
        <span class="label">{c.label}</span>
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
    padding: 6px 12px 8px;
    font-size: 13px;
    color: var(--ink-700);
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

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.2);
    flex: 0 0 auto;
  }

  .label { flex: 0 0 auto; }

  .dimmed .label { color: var(--ink-025); text-decoration: line-through; }
  .dimmed .swatch { opacity: 0.3; }
</style>

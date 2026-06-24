<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LegendCategory } from '../lib/types';

  export let categories: LegendCategory[];
  export let hiddenCats: ReadonlySet<string>;

  const dispatch = createEventDispatcher<{
    catToggle:   { cat: string; visible: boolean };
    catDblClick: { cat: string; visible: boolean };
    catHover:    { cat: string | null };
  }>();
</script>

{#if categories.length > 0}
  <div class="legend">
    {#each categories as c (c.key)}
      {@const visible = !hiddenCats.has(c.key)}
      <button
        class="item"
        class:dimmed={!visible}
        title="{c.count} band{c.count !== 1 ? 's' : ''}"
        on:click={() => dispatch('catToggle',   { cat: c.key, visible: !visible })}
        on:dblclick={() => dispatch('catDblClick', { cat: c.key, visible })}
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
    color: #333;
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

  .item:hover { background: #F0F0F0; }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.2);
    flex: 0 0 auto;
  }

  .label { flex: 0 0 auto; }

  .dimmed .label { color: #B0B0B0; text-decoration: line-through; }
  .dimmed .swatch { opacity: 0.3; }
</style>

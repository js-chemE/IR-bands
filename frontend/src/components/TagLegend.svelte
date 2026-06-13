<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LegendTag } from '../lib/chart';

  export let tags: LegendTag[];
  export let hiddenTags: ReadonlySet<string>;

  const dispatch = createEventDispatcher<{
    tagToggle:   { tag: string; visible: boolean };
    tagDblClick: { tag: string; visible: boolean };
    tagHover:    { tag: string | null };
  }>();
</script>

{#if tags.length > 0}
  <div class="legend">
    {#each tags as t (t.key)}
      {@const visible = !hiddenTags.has(t.key)}
      <button
        class="item"
        class:dimmed={!visible}
        title="{t.count} band{t.count !== 1 ? 's' : ''}"
        on:click={() => dispatch('tagToggle',   { tag: t.key, visible: !visible })}
        on:dblclick={() => dispatch('tagDblClick', { tag: t.key, visible })}
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
    font-size: 12px;
    color: #555;
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

  /* pill swatch — wider, more rounded, visually distinct from the square in ColorLegend */
  .swatch {
    width: 18px;
    height: 9px;
    border-radius: 6px;
    border: 1px solid #eaecef;
    flex: 0 0 auto;
  }

  .label { flex: 0 0 auto; }

  .dimmed .label { color: #C0C0C0 !important; text-decoration: line-through; }
  .dimmed .swatch { opacity: 0.3; }
</style>

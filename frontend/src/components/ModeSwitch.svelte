<script lang="ts">
  /**
   * A three-way (or n-way) choice as a segmented control, the look the band
   * chart's Band States use. `look` marks the option drawn in the look it
   * stands for (faint), as Band States draws its "faded".
   */
  import { createEventDispatcher } from 'svelte';

  export let value: string;
  export let options: { value: string; label: string; title?: string; look?: 'faded' | 'hollow' }[] = [];
  export let label = '';

  const dispatch = createEventDispatcher<{ change: { value: string } }>();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button
      role="radio"
      aria-checked={value === o.value}
      class:on={value === o.value}
      class:look-faded={o.look === 'faded'}
      class:look-hollow={o.look === 'hollow'}
      title={o.title}
      on:click={() => value !== o.value && dispatch('change', { value: o.value })}
    >{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-sunken);
  }
  .seg button {
    min-height: 24px;
    padding: 0 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-tip-tag-size);
    color: var(--ink-300);
    cursor: pointer;
  }
  .seg button:hover:not(.on) { color: var(--ink-900); }
  .seg button.on {
    background: var(--surface);
    border-color: var(--line-strong);
    color: var(--ink-900);
  }
  .seg button.look-hollow.on { border-width: 1.5px; border-color: var(--ink-400); }
  .seg button.look-faded.on {
    background: var(--surface-hover);
    border-color: var(--line);
    color: var(--ink-200);
  }
  .seg button:focus-visible { outline: 2px solid var(--brand-tint-line); outline-offset: -2px; }
</style>

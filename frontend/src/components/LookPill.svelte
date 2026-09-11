<script lang="ts">
  /**
   * A small on/off pill that looks like the bands it is about: hollow for the
   * inactive bands, faded for the unreferenced ones. Off, it is greyed and
   * struck through, the same idiom as a switched-off group row. Used twice in
   * the sidebar: under Color by, where it only decides the look, and under
   * Enable & Disable, where it takes the bands out of the chart.
   */
  import { createEventDispatcher } from 'svelte';

  export let on: boolean;
  export let look: 'hollow' | 'faded';
  export let title = '';

  const dispatch = createEventDispatcher<{ toggle: { on: boolean } }>();
</script>

<button
  class="look-pill {look}"
  class:off={!on}
  {title}
  aria-pressed={on}
  on:click={() => dispatch('toggle', { on: !on })}
><slot /></button>

<style>
  .look-pill {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 1px 7px;
    font: inherit;
    font-size: var(--t-tip-tag-size);
    cursor: pointer;
    user-select: none;
  }
  .look-pill:hover { filter: brightness(0.95); }
  .hollow {
    background: var(--surface);
    border-width: 1.5px;
    border-color: var(--ink-400);
    color: var(--ink-500);
  }
  .faded {
    background: var(--surface-hover);
    border-color: var(--line);
    color: var(--ink-200);
  }
  .off {
    background: var(--pill-muted-bg);
    border-color: var(--pill-muted-border);
    color: var(--ink-025);
    text-decoration: line-through;
  }
</style>

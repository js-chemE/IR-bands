<script lang="ts">
  /**
   * A small on/off pill that looks like what it switches. Off, it is greyed
   * and struck through, the same idiom as a switched-off group row. Today
   * only `region` is in use, the Appearance switch for the electromagnetic
   * regions; `hollow` and `faded` are kept for the inactive and unreferenced
   * looks, which the sidebar's Band States now draws as three-way choices.
   */
  import { createEventDispatcher } from 'svelte';

  export let on: boolean;
  export let look: 'hollow' | 'faded' | 'region';
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
  /* The spectral regions: the pill is a cell of the strip above the plot,
     its tint fading from a dashed border on the left. */
  .region {
    background: linear-gradient(to right, color-mix(in srgb, var(--em-mid-ir) 22%, transparent), transparent 70%) var(--surface);
    border-color: var(--line);
    border-left: 1px dashed var(--ink-050);
    color: var(--ink-slate-500);
  }
  .off {
    background: var(--pill-muted-bg);
    border-color: var(--pill-muted-border);
    color: var(--ink-025);
    text-decoration: line-through;
  }
</style>

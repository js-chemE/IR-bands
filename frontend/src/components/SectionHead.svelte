<script lang="ts">
  /**
   * A sidebar section's heading that is also its disclosure. No arrow: the
   * heading reads in full ink while the section is open and steps back to a
   * lighter one when it is closed, and a short summary of the current setting
   * sits at the right ("Color by group", "wavenumber · cm⁻¹", "11 / 11"), so a
   * closed section still says what it is set to. The whole row is the target.
   */
  import { createEventDispatcher } from 'svelte';

  export let title: string;
  export let open = true;
  export let summary = '';
  /** What the section describes and what it changes, shown on hover. */
  export let hint = '';

  const dispatch = createEventDispatcher<{ toggle: { open: boolean } }>();

  function toggle() {
    open = !open;
    dispatch('toggle', { open });
  }
</script>

<h3 class="section-head" class:closed={!open}>
  <button
    class="head"
    class:closed={!open}
    aria-expanded={open}
    title={`${hint ? hint + '\n\n' : ''}${open ? 'Click to hide' : 'Click to show'}`}
    on:click={toggle}
  >
    <span class="name">{title}</span>
    {#if summary}<span class="summary">{summary}</span>{/if}
  </button>
</h3>

<style>
  .section-head { margin-bottom: 8px; }
  .section-head.closed { margin-bottom: 0; }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-height: 24px;
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .head:hover .name { color: var(--ink-800); }
  .name { flex: 0 0 auto; }
  /* Closed: the same heading, a step lighter, and no space below it. */
  .head.closed .name { color: var(--ink-200); }
  .summary {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--ink-200);
  }
  .head:focus-visible { outline: 2px solid var(--brand-tint-line); outline-offset: 2px; border-radius: var(--radius-sm); }
</style>

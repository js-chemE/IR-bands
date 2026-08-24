<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Molecule } from '../../lib/types';

  export let molecules: Molecule[];
  export let selectedId: string;

  const dispatch = createEventDispatcher<{ select: { id: string } }>();
</script>

<div class="molecule-selector">
  {#each molecules as m (m.id)}
    <button
      class="molecule-btn"
      class:active={m.id === selectedId}
      on:click={() => dispatch('select', { id: m.id })}
    >{m.label}</button>
  {/each}
</div>

<style>
  .molecule-selector {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
  }

  .molecule-btn {
    padding: 6px 16px;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 16px;
    font-size: 14px;
    cursor: pointer;
    color: var(--ink-600);
  }

  .molecule-btn:hover { background: var(--surface-hover); }

  .molecule-btn.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }
</style>

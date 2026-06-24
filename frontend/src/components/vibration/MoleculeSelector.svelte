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
    border: 1px solid #D0D0D0;
    border-radius: 16px;
    font-size: 14px;
    cursor: pointer;
    color: #444;
  }

  .molecule-btn:hover { background: #F0F0F0; }

  .molecule-btn.active {
    background: #E8F0FE;
    border-color: #A0B4E0;
    color: #1a3a8f;
    font-weight: 600;
  }
</style>

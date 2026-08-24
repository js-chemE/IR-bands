<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Topology } from '../../lib/types';

  export let topologies: Topology[];
  export let selectedId: string;

  const dispatch = createEventDispatcher<{ select: { id: string } }>();
</script>

<!-- Always rendered, even for a single-topology molecule (gas-phase CO2/CO
     just shows one "free-gas" pill, formate just shows one "bidentate"
     pill) — it's a small, factual label of what's being shown, not just a
     picker. Shows the long form (not the short abbreviation) since it now
     picks between genuinely separate VibrationMode entries — which modes
     are even listed, not just the animation — so it needs to read clearly
     on its own, not just as a tooltip-backed abbreviation. -->
<div class="topology-selector">
  {#each topologies as t (t.id)}
    <button
      class="topo-btn"
      class:active={t.id === selectedId}
      on:click={() => dispatch('select', { id: t.id })}
    >{t.long}</button>
  {/each}
</div>

<style>
  .topology-selector {
    display: flex;
    gap: 3px;
    margin: 6px 0 16px;
  }

  .topo-btn {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: 9px;
    padding: 0 9px;
    font-size: 12px;
    line-height: 18px;
    color: var(--ink-100);
    cursor: pointer;
  }

  .topo-btn:hover { background: var(--surface-hover); }

  .topo-btn.active {
    background: var(--brand-tint-soft);
    border-color: var(--accent-blue-soft-line);
    color: var(--accent-blue-soft);
  }
</style>

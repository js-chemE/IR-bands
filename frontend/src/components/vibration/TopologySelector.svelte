<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Topology } from '../../lib/types';

  export let topologies: Topology[];
  export let selectedId: string;

  const dispatch = createEventDispatcher<{ select: { id: string } }>();
</script>

<!-- Always rendered, even for a single-topology molecule (gas-phase CO2/CO
     just shows one "gas" pill, formate just shows one "b" pill) — it's a
     small, factual label of what's being shown, not just a picker.
     Deliberately understated (tiny, low-contrast) since it only changes the
     animation, not the mode list — the detail panel still covers every
     topology's bands at once. -->
<div class="topology-selector">
  {#each topologies as t (t.id)}
    <button
      class="topo-btn"
      class:active={t.id === selectedId}
      title={t.long}
      on:click={() => dispatch('select', { id: t.id })}
    >{t.short}</button>
  {/each}
</div>

<style>
  .topology-selector {
    display: flex;
    gap: 3px;
    margin-bottom: 6px;
  }

  .topo-btn {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 9px;
    padding: 0 7px;
    font-size: 10px;
    line-height: 16px;
    color: #999;
    cursor: pointer;
  }

  .topo-btn:hover { background: #f3f3f3; }

  .topo-btn.active {
    background: #EEF3FF;
    border-color: #C8D6F0;
    color: #5878b0;
  }
</style>

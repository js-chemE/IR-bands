<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GroupMap } from '../lib/types';

  export let groups: GroupMap;
  export let sortedKeys: string[];
  export let enabledGroups: ReadonlySet<string>;

  const dispatch = createEventDispatcher<{
    groupToggle: { key: string; enabled: boolean };
    allGroups: { all: boolean };
  }>();

  function toggle(key: string, checked: boolean) {
    dispatch('groupToggle', { key, enabled: checked });
  }
</script>

<section>
  <h3>Filter groups</h3>
  <div class="actions">
    <button on:click={() => dispatch('allGroups', { all: true })}>Select all</button>
    <button on:click={() => dispatch('allGroups', { all: false })}>Clear all</button>
  </div>

  {#each sortedKeys as key (key)}
    {@const g = groups[key]}
    {@const on = enabledGroups.has(key)}
    <label class="row" class:off={!on}>
      <input
        type="checkbox"
        checked={on}
        on:change={e => toggle(key, e.currentTarget.checked)}
      />
      <span class="swatch" style="background:{g.color}"></span>
      <span class="glabel">{g.label}</span>
    </label>
  {/each}
</section>

<style>
  h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-500);
  }

  .actions {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }

  .actions button {
    flex: 1;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    cursor: pointer;
    color: var(--ink-700);
  }

  .actions button:hover { background: var(--surface-hover); }

  .row {
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    line-height: 1.3;
  }

  .row:hover { background: var(--surface-hover); }

  .row input { margin: 0 8px 0 0; flex: 0 0 auto; }

  .swatch {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.2);
    margin-right: 8px;
  }

  .glabel { flex: 1; }

  .off .glabel {
    color: var(--ink-025);
    text-decoration: line-through;
  }
</style>

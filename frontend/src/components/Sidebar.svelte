<script lang="ts">
  /**
   * The band chart's filter: a set on top, the individual groups underneath.
   *
   * A set is a named selection of groups, authored in bands.jsonc (see the
   * Set entity on the Data model page). Picking one is the ordinary way to
   * filter; the per-group list stays collapsed, because it is the escape
   * hatch rather than the everyday control. Toggling a group by hand leaves
   * the selection matching no set, which the selector shows as "Custom"
   * rather than pretending a set is still active.
   */
  import { createEventDispatcher } from 'svelte';
  import type { GroupMap, GroupSet } from '../lib/types';

  export let groups: GroupMap;
  export let sortedKeys: string[];
  export let enabledGroups: ReadonlySet<string>;
  export let sets: Record<string, GroupSet> = {};

  /** Built in rather than authored: "everything" is not an editorial choice. */
  export const ALL_SET = 'all';
  const CUSTOM = 'custom';

  const dispatch = createEventDispatcher<{
    groupToggle: { key: string; enabled: boolean };
    setSelect: { key: string };
  }>();

  let showGroups = false;

  $: setList = Object.values(sets);

  /** Which set the current selection is, or 'custom' when it is none of them. */
  $: activeSet = (() => {
    if (enabledGroups.size === sortedKeys.length) return ALL_SET;
    for (const s of setList) {
      const wanted = new Set(s.groups);
      if (wanted.size === enabledGroups.size && [...wanted].every(k => enabledGroups.has(k))) {
        return s.key;
      }
    }
    return CUSTOM;
  })();

  $: activeNote = sets[activeSet]?.note ?? '';
</script>

<section>
  <h3>Filter</h3>

  <select
    value={activeSet}
    on:change={e => dispatch('setSelect', { key: e.currentTarget.value })}
  >
    <option value={ALL_SET}>All groups</option>
    {#each setList as s (s.key)}
      <option value={s.key}>{s.label}</option>
    {/each}
    {#if activeSet === CUSTOM}
      <!-- Only offered once the selection has drifted off every set, so the
           dropdown never invites you to pick "custom" out of nowhere. -->
      <option value={CUSTOM}>Custom</option>
    {/if}
  </select>

  {#if activeNote}
    <p class="set-note">{activeNote}</p>
  {/if}

  <button class="disclosure" on:click={() => showGroups = !showGroups} aria-expanded={showGroups}>
    <span class="caret">{showGroups ? '▾' : '▸'}</span>
    Groups
    <span class="count">{enabledGroups.size} / {sortedKeys.length}</span>
  </button>

  {#if showGroups}
    <div class="group-list">
      {#each sortedKeys as key (key)}
        {@const g = groups[key]}
        {@const on = enabledGroups.has(key)}
        <button
          class="row"
          class:off={!on}
          on:click={() => dispatch('groupToggle', { key, enabled: !on })}
          aria-pressed={on}
        >
          <span class="swatch" style="background:{g.color}"></span>
          <span class="glabel">{g.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  h3 {
    margin: 0 0 8px 0;
    font-size: var(--t-sidebar-head-size);
    font-weight: var(--t-sidebar-head-weight);
    text-transform: var(--t-sidebar-head-tt);
    letter-spacing: var(--t-sidebar-head-ls);
    color: var(--t-sidebar-head-color);
  }

  .set-note {
    margin: 6px 0 0;
    font-size: var(--t-code-size);
    line-height: 1.4;
    color: var(--ink-300);
  }

  /* ── Disclosure for the per-group list ── */
  .disclosure {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-top: 10px;
    padding: 4px 2px;
    background: none;
    border: none;
    border-top: 1px solid var(--line-soft);
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--ink-500);
    cursor: pointer;
    text-align: left;
  }
  .disclosure:hover { color: var(--ink-700); }

  .caret { color: var(--ink-200); }
  .count { margin-left: auto; font-family: var(--font-mono); color: var(--ink-200); }

  .group-list {
    display: flex;
    flex-direction: column;
    margin-top: 2px;
  }

  /* No checkbox: the state is the styling, the same as the chart legends. */
  .row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 4px;
    border: none;
    border-radius: var(--radius);
    background: none;
    font: inherit;
    color: inherit;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
    user-select: none;
  }

  .row:hover { background: var(--surface-hover); }

  .swatch {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    margin-right: 8px;
  }

  .glabel { flex: 1; }

  /* Switched off: greyed and struck through, swatch included, so the whole
     row reads as off at a glance. */
  .off .glabel {
    color: var(--ink-025);
    text-decoration: line-through;
  }
  .off .swatch {
    opacity: 0.25;
    filter: grayscale(1);
  }
</style>

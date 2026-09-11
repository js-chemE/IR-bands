<script lang="ts">
  import Dropdown from './Dropdown.svelte';
  import LookPill from './LookPill.svelte';
  import { ISOTOPE_STYLE } from '../lib/tokens';
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
  import type { GroupMap, GroupSet, Spectroscopy } from '../lib/types';

  export let groups: GroupMap;
  export let sortedKeys: string[];
  export let enabledGroups: ReadonlySet<string>;
  export let sets: Record<string, GroupSet> = {};
  /** Whether the isotopologue bands are part of the chart at all. */
  export let showIsotopes = false;
  /** Whether the bands the chosen spectroscopy cannot see are in the chart. */
  export let showInactive = true;
  /** Whether the bands with no claim standing in the chosen spectroscopy are in the chart. */
  export let showUnreferenced = true;
  /** IR or Raman: whose inactive bands the inactive pill means. */
  export let spectroscopy: Spectroscopy = 'ir';

  /** Built in rather than authored: "everything" is not an editorial choice. */
  export const ALL_SET = 'all';
  const CUSTOM = 'custom';

  const dispatch = createEventDispatcher<{
    groupToggle: { key: string; enabled: boolean };
    setSelect: { key: string };
    isotopeToggle: { enabled: boolean };
    inactiveToggle: { enabled: boolean };
    unreferencedToggle: { enabled: boolean };
  }>();

  $: technique = spectroscopy === 'raman' ? 'Raman' : 'IR';

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
  <h3>Enable &amp; Disable</h3>
  <!-- Its own section, ahead of the group filter, because it is a different
       kind of cut: the groups choose which chemistry is on screen, this chooses
       whether the labelled twins of those bands exist at all. Off, they leave
       the layout entirely rather than being hidden where they stand. -->
  <div class="iso-filter">
    <button
      class="iso-pill"
      class:off={!showIsotopes}
      style="background:{ISOTOPE_STYLE.background}; border-color:{ISOTOPE_STYLE.border}; color:{ISOTOPE_STYLE.color}"
      title={showIsotopes
        ? 'Hide the isotopologue bands and re-lay out the lanes without them'
        : 'Bring the isotopologue bands back'}
      aria-pressed={showIsotopes}
      on:click={() => dispatch('isotopeToggle', { enabled: !showIsotopes })}
    >isotope</button>
    <!-- The same two pills as under Color by, but here a filter: off, the
         bands leave the chart and the lanes re-lay out without them. -->
    <LookPill
      look="hollow"
      on={showInactive}
      title={showInactive
        ? `Hide the ${technique}-inactive bands and re-lay out the lanes without them`
        : `Bring the ${technique}-inactive bands back`}
      on:toggle={e => dispatch('inactiveToggle', { enabled: e.detail.on })}
    >{technique}-inactive</LookPill>
    <LookPill
      look="faded"
      on={showUnreferenced}
      title={showUnreferenced
        ? `Hide the bands with no ${technique} reference (none of their claims stands in ${technique}), and re-lay out the lanes without them`
        : `Bring the bands with no ${technique} reference back`}
      on:toggle={e => dispatch('unreferencedToggle', { enabled: e.detail.on })}
    >unreferenced</LookPill>
  </div>
</section>

<section>
  <h3>Group Filter</h3>

  <!-- "Custom" is only offered once the selection has drifted off every set,
       so the dropdown never invites you to pick it out of nowhere. -->
  <Dropdown
    value={activeSet}
    options={[
      { value: ALL_SET, label: 'All groups' },
      ...setList.map(s => ({ value: s.key, label: s.label })),
      ...(activeSet === CUSTOM ? [{ value: CUSTOM, label: 'Custom' }] : []),
    ]}
    label="Group filter"
    on:change={e => dispatch('setSelect', { key: e.detail.value })}
  />

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
  /* Two sections now: the isotope and inactive switches, then the group filter. They are
     different kinds of cut, so they get real air between them rather than a
     rule. */
  section + section { margin-top: 22px; }

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
    margin-top: 8px;
    padding: 4px 2px;
    background: none;
    border: none;
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

  /* The isotope switch: the tag as the chart draws it, greyed and struck when
     off, the same idiom as a switched-off group row. */
  .iso-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .iso-pill {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 1px 7px;
    font: inherit;
    font-size: var(--t-tip-tag-size);
    cursor: pointer;
    user-select: none;
  }
  .iso-pill:hover { filter: brightness(0.95); }
  .iso-pill.off {
    background: var(--pill-muted-bg) !important;
    border-color: var(--pill-muted-border) !important;
    color: var(--ink-025) !important;
    text-decoration: line-through;
  }

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

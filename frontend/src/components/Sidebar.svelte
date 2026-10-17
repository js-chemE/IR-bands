<script lang="ts">
  import Dropdown from './Dropdown.svelte';
  import SectionHead from './SectionHead.svelte';
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
  import type { BandStateMode } from '../lib/chart';

  export let groups: GroupMap;
  export let sortedKeys: string[];
  export let enabledGroups: ReadonlySet<string>;
  export let sets: Record<string, GroupSet> = {};
  /** Whether the isotopologue bands are part of the chart at all. */
  export let showIsotopes = false;
  /** The bands the chosen spectroscopy cannot see: hollow, plain or out. */
  export let inactiveMode: BandStateMode = 'look';
  /** The bands none of whose claims counts: faded, plain or out. */
  export let unreferencedMode: BandStateMode = 'look';
  /** Whether each section is open; its heading is the toggle. */
  export let bandStatesOpen = true;
  export let groupFilterOpen = true;
  /** IR or Raman: whose inactive bands the inactive pill means. */
  export let spectroscopy: Spectroscopy = 'ir';

  /** Built in rather than authored: "everything" is not an editorial choice. */
  export const ALL_SET = 'all';
  const CUSTOM = 'custom';

  const dispatch = createEventDispatcher<{
    groupToggle: { key: string; enabled: boolean };
    setSelect: { key: string };
    isotopeToggle: { enabled: boolean };
    inactiveMode: { mode: BandStateMode };
    unreferencedMode: { mode: BandStateMode };
  }>();

  $: technique = spectroscopy === 'raman' ? 'Raman' : 'IR';

  /* The two conditions a band can be in, each with one three-way answer.
     The first answer is named after the look itself, and drawn in it, so the
     row says what the chart will do rather than naming an abstraction. */
  $: stateRows = [
    {
      event: 'inactiveMode' as const,
      label: `${technique}-inactive`,
      look: 'hollow',
      mode: inactiveMode,
      about: `bands ${technique} cannot see by its selection rule`,
    },
    {
      event: 'unreferencedMode' as const,
      label: 'unreferenced',
      look: 'faded',
      mode: unreferencedMode,
      about: 'bands none of whose claims counts (from the other spectroscopy, with no technique recorded, or made with a technique switched off under Techniques)',
    },
  ];
  const MODES: BandStateMode[] = ['look', 'plain', 'hidden'];
  function modeTitle(mode: BandStateMode, look: string, about: string): string {
    if (mode === 'look') return `Draw the ${about} ${look}`;
    if (mode === 'plain') return `Draw the ${about} like any other band`;
    return `Take the ${about} out of the chart and re-lay out the lanes without them`;
  }

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

  /* What each closed heading says. Band States names only what differs
     from its defaults (hollow, faded, no isotopologues), since the full
     state does not fit beside the heading and the defaults go without
     saying. */
  $: bandStatesSummary = [
    inactiveMode !== 'look' ? `${technique}-inactive ${inactiveMode}` : null,
    unreferencedMode !== 'look' ? `unref. ${unreferencedMode}` : null,
    showIsotopes ? 'isotopes' : null,
  ].filter(Boolean).join(' · ');
  $: groupFilterSummary = `${enabledGroups.size} / ${sortedKeys.length}`;
</script>

<section>
  <SectionHead title="Band States" bind:open={bandStatesOpen} summary={bandStatesSummary} />
  {#if bandStatesOpen}
  <!-- What a band in each condition does, as one choice: its own look, drawn
       like any other, or out of the chart. This replaced a look pill under
       Appearance and a filter pill here for each condition, which said one
       thing twice and could contradict itself (hidden here, faded there).
       Whether a band is unreferenced is decided above it, under Techniques,
       which says which claims count. -->
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
  </div>
  {#each stateRows as row (row.event)}
    <div class="state-row">
      <span class="state-name">{row.label}</span>
      <div class="seg" role="radiogroup" aria-label={row.label}>
        {#each MODES as m (m)}
          <button
            role="radio"
            aria-checked={row.mode === m}
            class:on={row.mode === m}
            class:look-hollow={m === 'look' && row.look === 'hollow'}
            class:look-faded={m === 'look' && row.look === 'faded'}
            title={modeTitle(m, row.look, row.about)}
            on:click={() => row.mode !== m && dispatch(row.event, { mode: m })}
          >{m === 'look' ? row.look : m}</button>
        {/each}
      </div>
    </div>
  {/each}
  {/if}
</section>

<section>
  <SectionHead title="Group Filter" bind:open={groupFilterOpen} summary={groupFilterSummary} />
  {#if groupFilterOpen}

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
  {/if}
</section>

<style>
  /* Two sections: the band states, then the group filter. They are
     different kinds of cut, so they get real air between them rather than a
     rule. */
  section + section { margin-top: 22px; }

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

  /* A band state: the condition, then its three answers under it as a
     small segmented control the width of the sidebar. The chosen answer is raised in white
     rather than blue, since blue in the sidebar means "you are here". */
  .state-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 10px;
  }
  .state-name {
    font-size: var(--t-tip-tag-size);
    color: var(--ink-500);
  }
  .seg {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    padding: 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface-sunken);
  }
  .seg button {
    min-height: 24px;
    padding: 0 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-tip-tag-size);
    color: var(--ink-300);
    cursor: pointer;
  }
  .seg button:hover:not(.on) { color: var(--ink-900); }
  .seg button.on {
    background: var(--surface);
    border-color: var(--line-strong);
    color: var(--ink-900);
  }
  /* The look option drawn in its look, as LookPill draws it. */
  .seg button.look-hollow.on { border-width: 1.5px; border-color: var(--ink-400); }
  .seg button.look-faded.on {
    background: var(--surface-hover);
    border-color: var(--line);
    color: var(--ink-200);
  }
  .seg button:focus-visible { outline: 2px solid var(--brand-tint-line); outline-offset: -2px; }

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

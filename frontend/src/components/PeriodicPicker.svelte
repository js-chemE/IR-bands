<script lang="ts">
  /**
   * The periodic table as a picker, in two sizes: `compact` for the rail's
   * flyout in presentation mode, the full one for the sidebar and the Dataset
   * page. Laid out from elements.jsonc (group and period place a cell, the
   * f-block sits in two rows underneath, counted from La and Ac).
   *
   * The picker holds no selection of its own: the host says which cells are
   * on (`isOn`) and which are pinned (`isPinned`, drawn bold), and hears
   * `toggle` and `only` with the elements concerned. A click toggles, a
   * double-click asks for only that; the faint numbers left of each row and
   * above each column do the same for a whole period or group. A click is held
   * back 280 ms so a double-click can cancel it, as everywhere in the sidebar.
   * An element no surface contains is drawn barely visible and does nothing.
   */
  import { createEventDispatcher } from 'svelte';
  import type { ElementInfo } from '../lib/types';

  export let elements: Record<string, ElementInfo> = {};
  /** The elements that occur at all: the live cells. */
  export let present: ReadonlySet<string> = new Set();
  export let isOn: (el: string) => boolean = () => false;
  export let isPinned: (el: string) => boolean = () => false;
  export let compact = false;

  const dispatch = createEventDispatcher<{ toggle: { els: string[] }; only: { els: string[] } }>();

  interface Cell { el: string; row: number; col: number; name: string }
  $: cells = Object.entries(elements).map(([el, e]): Cell => {
    if (e.group == null) {
      const f = e.period === 6 ? { row: 10, z0: 57 } : { row: 11, z0: 89 };
      return { el, row: f.row, col: 3 + (e.z - f.z0) + 1, name: e.name };
    }
    return { el, row: e.period + 1, col: e.group + 1, name: e.name };
  });
  const PERIODS = [1, 2, 3, 4, 5, 6, 7];
  const GROUPS = Array.from({ length: 18 }, (_, i) => i + 1);
  const live = (els: string[]) => els.filter(e => present.has(e));
  const periodEls = (p: number) => live(Object.entries(elements).filter(([, e]) => e.period === p).map(([el]) => el));
  const groupEls = (g: number) => live(Object.entries(elements).filter(([, e]) => e.group === g).map(([el]) => el));

  let hoverPeriod: number | null = null;
  let hoverGroup: number | null = null;
  const lit = (el: string, hp: number | null, hg: number | null) => {
    const e = elements[el];
    return !!e && ((hp != null && e.period === hp) || (hg != null && e.group === hg));
  };

  let pending: ReturnType<typeof setTimeout> | null = null;
  function click(els: string[]) {
    if (!els.length) return;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => { pending = null; dispatch('toggle', { els }); }, 280);
  }
  function dbl(els: string[]) {
    if (!els.length) return;
    if (pending) { clearTimeout(pending); pending = null; }
    dispatch('only', { els });
  }
  // Re-read whenever the host passes new answers (its isOn changes with its state).
  $: onMap = new Map(cells.map(c => [c.el, isOn(c.el)]));
  $: pinMap = new Map(cells.map(c => [c.el, isPinned(c.el)]));
</script>

<div class="pse" class:compact role="group" aria-label="Periodic table"
  on:mouseleave={() => { hoverPeriod = null; hoverGroup = null; }}>
  {#each GROUPS as g (g)}
    <button class="handle" style="grid-row: 1; grid-column: {g + 1}" class:hot={hoverGroup === g}
      title="Group {g}: click to switch, double-click for only this group"
      on:mouseenter={() => { hoverGroup = g; hoverPeriod = null; }}
      on:click={() => click(groupEls(g))} on:dblclick={() => dbl(groupEls(g))}>{g}</button>
  {/each}
  {#each PERIODS as per (per)}
    <button class="handle" style="grid-row: {per + 1}; grid-column: 1" class:hot={hoverPeriod === per}
      title="Period {per}: click to switch, double-click for only this period"
      on:mouseenter={() => { hoverPeriod = per; hoverGroup = null; }}
      on:click={() => click(periodEls(per))} on:dblclick={() => dbl(periodEls(per))}>{per}</button>
  {/each}
  {#each cells as c (c.el)}
    {#if present.has(c.el)}
      <button class="cell" style="grid-row: {c.row}; grid-column: {c.col}"
        class:on={onMap.get(c.el)} class:pinned={pinMap.get(c.el)} class:lit={lit(c.el, hoverPeriod, hoverGroup)}
        title={c.name}
        on:mouseenter={() => { hoverPeriod = null; hoverGroup = null; }}
        on:click={() => click([c.el])} on:dblclick={() => dbl([c.el])}>{c.el}</button>
    {:else}
      <span class="cell absent" style="grid-row: {c.row}; grid-column: {c.col}"
        class:lit={lit(c.el, hoverPeriod, hoverGroup)} title="{c.name}: in no surface">{c.el}</span>
    {/if}
  {/each}
</div>

<style>
  .pse {
    display: grid;
    grid-template-columns: 14px repeat(18, minmax(0, 1fr));
    grid-template-rows: 14px repeat(7, auto) 5px auto auto;
    gap: 2px;
    width: 100%;
  }
  .pse.compact {
    grid-template-columns: 10px repeat(18, 13px);
    grid-template-rows: 10px repeat(7, 13px) 3px 13px 13px;
    gap: 1px;
    width: auto;
  }
  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    min-width: 0;
    padding: 0;
    border: 1px solid var(--pill-border);
    border-radius: var(--radius-sm);
    background: var(--pill-bg);
    color: var(--ink-200);
    font-family: var(--font-mono);
    font-size: var(--t-micro-label-size);
    line-height: 1;
    cursor: pointer;
    overflow: hidden;
  }
  .compact .cell { font-size: 7px; border-radius: 2px; }
  .cell:hover { background: var(--surface-hover); }
  .cell.on {
    border-color: var(--brand-tint-line);
    background: var(--brand-tint);
    color: var(--brand-accent);
  }
  .cell.pinned { font-weight: var(--t-label-weight); box-shadow: inset 0 0 0 1px var(--brand-accent); }
  .cell.absent {
    border-color: transparent;
    background: none;
    color: var(--ink-025);
    opacity: 0.4;
    cursor: default;
  }
  .cell.lit { box-shadow: 0 0 0 1px var(--brand-tint-line); }
  .cell.absent.lit { box-shadow: none; opacity: 0.7; }
  .handle {
    padding: 0;
    border: none;
    background: none;
    font-family: var(--font-mono);
    font-size: 8px;
    line-height: 1;
    color: var(--ink-025);
    opacity: 0.5;
    cursor: pointer;
  }
  .compact .handle { font-size: 6px; }
  .handle:hover, .handle.hot { color: var(--brand-accent); opacity: 1; }
</style>

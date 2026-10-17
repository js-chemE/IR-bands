<script lang="ts">
  /**
   * The selection one page hands to the other, and what it holds.
   *
   * One button carries the whole selection across (filters, the bands and
   * claims switched off by hand, the wavenumber range, the band scope) and
   * switches page: "Collect references" on the band chart, "Show bands" on
   * the References page. Under it, everything that narrows the selection
   * beyond the filters is listed, and each item can be put back on its own.
   */
  import { createEventDispatcher } from 'svelte';
  import SectionHead from './SectionHead.svelte';
  import Icon from './Icon.svelte';

  /** The button's words and its hover text. */
  export let action: string;
  /** The page the button goes to, drawn as that page's own symbol. */
  export let to: 'references' | 'chart' = 'references';
  export let actionTitle = '';
  export let hiddenBands: ReadonlySet<string> = new Set();
  export let hiddenClaims: ReadonlySet<number> = new Set();
  /** A wavenumber range, low to high, or null. */
  export let range: [number, number] | null = null;
  /** The bands carried over from the other page, or null for no scope. */
  export let scope: ReadonlySet<string> | null = null;
  export let scopeFrom = '';
  export let bandLabel: (id: string) => string = id => id;
  export let claimLabel: (id: number) => string = id => `#${id}`;
  export let open = false;
  /** What this page shows right now, kept live: "42 bands · 180 claims". */
  export let live = '';

  const dispatch = createEventDispatcher<{
    transfer: void;
    restoreBand: { id: string };
    restoreClaim: { id: number };
    restoreAll: void;
    clearRange: void;
    clearScope: void;
  }>();

  $: nHidden = hiddenBands.size + hiddenClaims.size;
  $: narrowing = !!scope || !!range || nHidden > 0;
</script>

<section>
  <SectionHead title="Selection" bind:open summary={live} />
  {#if open}
    <!-- Not an ordinary control: it carries the whole selection to the other
         page and goes there, so it looks like a passage, filled in the brand
         colour with the destination's own symbol, not like a switch. -->
    <button class="transfer" title={actionTitle} on:click={() => dispatch('transfer')}>
      <Icon name={to} size={15} width={1.9} />
      <span class="transfer-label">{action}</span>
      <span class="arrow" aria-hidden="true">⇄</span>
    </button>
    {#if !narrowing}
      <p class="sel-empty">Nothing narrowed beyond the filters: no band scope, no range, nothing hidden by hand.</p>
    {/if}
    <div class="sel">
      {#if true}
        {#if scope}
          <div class="sel-row">
            <span class="sel-label">{scope.size} bands from {scopeFrom}</span>
            <button class="sel-x" title="Drop the band scope: every band again" on:click={() => dispatch('clearScope')}>✕</button>
          </div>
        {/if}
        {#if range}
          <div class="sel-row">
            <Icon name="range" size={13} width={1.8} />
            <span class="sel-label">{Math.round(range[0])}–{Math.round(range[1])} cm⁻¹</span>
            <button class="sel-x" title="Clear the range" on:click={() => dispatch('clearRange')}>✕</button>
          </div>
        {/if}
        {#if nHidden}
          <div class="sel-head">
            <span>Hidden by hand</span>
            <button class="sel-all" on:click={() => dispatch('restoreAll')}>restore all</button>
          </div>
          {#each [...hiddenBands] as id (id)}
            <div class="sel-row">
              <span class="sel-kind">band</span>
              <span class="sel-label">{bandLabel(id)}</span>
              <button class="sel-x" title="Show this band again" on:click={() => dispatch('restoreBand', { id })}>↺</button>
            </div>
          {/each}
          {#each [...hiddenClaims] as id (id)}
            <div class="sel-row">
              <span class="sel-kind">claim</span>
              <span class="sel-label">{claimLabel(id)}</span>
              <button class="sel-x" title="Count this claim again" on:click={() => dispatch('restoreClaim', { id })}>↺</button>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .transfer {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: 34px;
    padding: 0 10px;
    white-space: nowrap;
    border: none;
    border-radius: var(--radius);
    background: linear-gradient(90deg, var(--brand-700), var(--brand-500));
    color: var(--brand-on-dark);
    font: inherit;
    font-size: var(--t-nav-size);
    font-weight: var(--t-label-weight);
    letter-spacing: 0.01em;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .transfer:hover { filter: brightness(1.08); }
  .transfer:active { transform: translateY(1px); }
  /* One line, one height on both pages: the two buttons are one control
     seen from either side, so they must match exactly. */
  .transfer-label { flex: 1; min-width: 0; text-align: left; overflow: hidden; text-overflow: ellipsis; }
  .arrow { font-family: var(--font-mono); font-size: 15px; }
  .sel { margin-top: 8px; }
  .sel-empty {
    margin: 8px 0 0;
    font-size: var(--t-code-size);
    color: var(--ink-050);
  }
  .sel-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 6px 0 2px;
    font-size: var(--t-code-size);
    color: var(--ink-500);
  }
  .sel-all {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: var(--t-code-size);
    color: var(--brand-accent);
    cursor: pointer;
  }
  .sel-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
    font-size: var(--t-nav-size);
    color: var(--ink-700);
  }
  .sel-kind {
    flex-shrink: 0;
    width: 3.2em;
    font-size: var(--t-micro-label-size);
    color: var(--ink-200);
  }
  .sel-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sel-x {
    flex-shrink: 0;
    min-width: 24px;
    min-height: 24px;
    background: none;
    border: none;
    color: var(--ink-200);
    cursor: pointer;
    font: inherit;
  }
  .sel-x:hover { color: var(--ink-700); }
</style>

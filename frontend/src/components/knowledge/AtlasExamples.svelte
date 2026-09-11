<script lang="ts">
  /**
   * "In the atlas": the bands that show a phenomenon, resolved live from the
   * link fields (lib/phenomena.ts), with the papers behind them. A box of its
   * own under an opened card's text, so the explanation reads first and the
   * evidence second.
   *
   * A band row opens that band in the chart; a reference chip opens the
   * paper on the References page.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Band, GroupMap, RefMap } from '../../lib/types';
  import type { Example } from '../../lib/phenomena';
  import { citekeysFor } from '../../lib/phenomena';
  import { speciesLabel } from '../../lib/labels';
  import { ieeeHtml, shortCite } from '../../lib/citations';
  import { htmlToUnicode } from '../../lib/notation';

  export let title = 'In the atlas';
  export let examples: Example[];
  export let groups: GroupMap;
  export let refs: RefMap;

  const dispatch = createEventDispatcher<{ band: { id: string }; ref: { key: string } }>();

  const bandName = (b: Band) => b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;
  const groupColor = (b: Band) => groups[b.group]?.color ?? 'var(--ink-400)';
</script>

<section class="atlas">
  <h4 class="atlas-head">{title}</h4>
  {#if examples.length === 0}
    <p class="empty">No band in the atlas currently shows this.</p>
  {:else}
    {#each examples as ex (ex.label)}
      <article class="example">
        <header>
          <span class="ex-label">{ex.label}</span>
          <span class="ex-count">{ex.bands.length} band{ex.bands.length === 1 ? '' : 's'}</span>
        </header>
        {#if ex.note}<p class="ex-note">{ex.note}</p>{/if}

        <div class="band-rows">
          {#each ex.bands as b (b.id)}
            <button class="band-row" on:click|stopPropagation={() => dispatch('band', { id: b.id })}>
              <span class="dot" style="background:{groupColor(b)}"></span>
              <span class="band-name">{bandName(b)}</span>
              <span class="band-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
            </button>
          {/each}
        </div>

        {#if refs}
          {@const keys = citekeysFor(ex.bands)}
          {#if keys.length}
            <div class="ex-refs">
              {#each keys as key (key)}
                <button
                  class="ref-chip"
                  title={htmlToUnicode(ieeeHtml(refs[key] ?? {}, key))}
                  on:click|stopPropagation={() => dispatch('ref', { key })}
                >{shortCite(refs[key] ?? {}, key, { journal: false })}</button>
              {/each}
            </div>
          {/if}
        {/if}
      </article>
    {/each}
  {/if}
</section>

<style>
  /* The box: set apart from the prose above it, in the Knowledge green. */
  .atlas {
    margin: 18px 0 0;
    padding: 12px 14px 4px;
    background: var(--surface-slate);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
  }

  .atlas-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--accent-green-fg);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 0 0 8px;
  }

  .empty { color: var(--ink-300); font-size: var(--t-code-size); margin: 0 0 10px; }

  /* ── One occurrence ── */
  .example {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-left: 3px solid var(--accent-green-fg);
    border-radius: var(--radius);
    padding: 10px var(--space-4);
    margin-bottom: 10px;
  }

  .example header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }

  .ex-label {
    font-weight: var(--t-label-weight);
    color: var(--ink-slate-900);
    font-size: var(--t-nav-size);
  }

  .ex-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  .ex-note { margin: 0 0 6px; color: var(--ink-400); font-size: var(--t-nav-size); line-height: 1.45; }

  .band-rows { display: flex; flex-direction: column; gap: 2px; }

  .band-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 3px 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-nav-size);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .band-row:hover { background: var(--surface-hover); }

  .dot {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .band-name { color: var(--ink-700); }

  .band-wn {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-300);
    white-space: nowrap;
  }

  .ex-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid var(--line-faint);
  }

  .ref-chip {
    font: inherit;
    font-size: var(--t-code-size);
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ref-border);
    background: var(--ref-surface);
    color: var(--ref-meta);
    cursor: pointer;
  }
  .ref-chip:hover { background: var(--ref-surface-hover); color: var(--ref-accent-deep); }
</style>

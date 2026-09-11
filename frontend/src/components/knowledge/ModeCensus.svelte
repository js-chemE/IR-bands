<script lang="ts">
  /**
   * The Normal modes card's way into the atlas: every molecule the Vibration
   * modes view draws, with its atom count and the 3N − 6 (or 3N − 5) count
   * that follows. A row opens that molecule there (Dataset → Contents).
   *
   * The count is the free molecule's. Held on a surface, translations and
   * rotations become vibrations too; the modes view counts each binding
   * geometry on its own, with the symmetry species, so this list does not
   * repeat that bookkeeping.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Molecule, Vibrations } from '../../lib/types';
  import { geometryFor } from '../../lib/moleculeGeometry';

  export let vibrations: Vibrations;

  const dispatch = createEventDispatcher<{
    mode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  /** The molecule's own atoms: a metal drawn in the surface is not one of them. */
  function atomCount(m: Molecule): number {
    const topo = m.topologies.find(t => t.id === 'gas') ?? m.topologies[0];
    const g = topo ? geometryFor(m.id, topo.id) : null;
    if (!g) return 0;
    const buried = new Set(g.surface?.buriedAtoms ?? []);
    return g.atoms.filter((a, i) => a.element !== 'M' && !buried.has(i)).length;
  }

  $: rows = vibrations.molecules
    .map(m => {
      const n = atomCount(m);
      const linear = m.shape === 'linear';
      return {
        m,
        n,
        linear,
        count: n ? 3 * n - (linear ? 5 : 6) : null,
        where: m.topologies.map(t => t.long).join(', '),
      };
    })
    .sort((a, b) => a.n - b.n || a.m.label.localeCompare(b.m.label));
</script>

<section class="census">
  <h4 class="census-head">The molecules on the Vibration modes view</h4>
  <div class="rows">
    {#each rows as r (r.m.id)}
      <button
        class="row"
        title="Open {r.m.label} on the Vibration modes view"
        on:click|stopPropagation={() =>
          dispatch('mode', { moleculeId: r.m.id, topologyId: r.m.topologies[0]?.id ?? '', modeId: '' })}
      >
        <span class="name">{r.m.label}</span>
        <span class="count">
          {#if r.count !== null}
            N = {r.n}, {r.linear ? 'linear' : 'non-linear'}: {r.count} mode{r.count === 1 ? '' : 's'}
          {/if}
        </span>
        <span class="where">{r.where}</span>
        <span class="go" aria-hidden="true">→</span>
      </button>
    {/each}
  </div>
  <p class="foot">
    The count is the free molecule’s. Held on a surface, translations and rotations
    become vibrations too; the modes view counts each binding geometry on its own.
  </p>
</section>

<style>
  /* The same box as the "in the atlas" examples. */
  .census {
    margin: 18px 0 0;
    padding: 12px 14px 8px;
    background: var(--surface-slate);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
  }

  .census-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--accent-green-fg);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 0 0 8px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    padding: 4px;
  }

  .row {
    display: grid;
    grid-template-columns: 7.5em auto 1fr 1.2em;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 4px 6px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-nav-size);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: var(--surface-hover); }
  .row:hover .go { color: var(--accent-green-fg); }

  .name { color: var(--ink-slate-900); font-weight: var(--t-label-weight); }

  .count {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-700);
    white-space: nowrap;
  }

  .where {
    font-size: var(--t-code-size);
    color: var(--ink-300);
    text-align: right;
  }

  .go { color: var(--ink-200); text-align: right; }

  .foot {
    margin: 8px 2px 4px;
    font-size: var(--t-code-size);
    color: var(--ink-400);
    line-height: 1.45;
  }
</style>

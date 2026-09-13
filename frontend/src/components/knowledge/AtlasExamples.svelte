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
  import type { Band, RefMap } from '../../lib/types';
  import type { Example } from '../../lib/phenomena';
  import { citekeysFor } from '../../lib/phenomena';
  import { branchSuffix, speciesLabel } from '../../lib/labels';
  import { ieeeHtml, shortCite } from '../../lib/citations';
  import { htmlToUnicode } from '../../lib/notation';

  export let title = 'In the Atlas';
  /** Which field records the phenomenon. Shown only while the box is open:
      it is a note about the data model, not part of the explanation. */
  export let field = '';
  /**
   * The tag this card is about, drawn in the Knowledge green so it stands out
   * from the others. Only on its own card: `overtone` is the subject on the
   * Overtone card and merely a fact about the band on the Combination one,
   * and colouring it in both places would say they were equally the point.
   */
  export let ownTag = '';
  export let examples: Example[];
  export let refs: RefMap;

  const dispatch = createEventDispatcher<{ band: { id: string }; ref: { key: string } }>();

  const bandName = (b: Band) =>
    (b.short || `${speciesLabel(b.species)} ${b.vibration.category}`) + branchSuffix(b);
  /** The vibration alone, for a row that stands for a whole branch group. */
  const vibName = (b: Band) => b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;

  /**
   * What the band IS, beside its name: the structure tags, never how it was
   * measured. In a list that mixes a fundamental with the overtones and
   * combinations built on it, this is the column that says which is which.
   *
   * `fundamental` and `overtone` are real derived tags in the data;
   * `combination` is derived from the category instead, the same rule
   * `getBandTags()` in lib/chart.ts uses, because the build does not write
   * that one into `tags`.
   */
  const structureTags = (b: Band) => {
    const out: string[] = [];
    if (b.tags.includes('fundamental')) out.push('fundamental');
    if (b.tags.includes('overtone')) out.push('overtone');
    if (b.vibration.category === 'combination') out.push('combination');
    return out;
  };

  /**
   * The bands of one example, with a branch group folded into a single row.
   * The P, Q and R lines of one transition are one band as far as this list
   * is concerned: listing all three says nothing the first does not, and on
   * a card like Fermi resonance, where a partner is itself branched, it
   * buries the pair the card is about. The row opens to the lines.
   */
  interface Row { key: string; lead: Band; members: Band[]; branches: string }
  function rowsOf(bands: Band[]): Row[] {
    const out: Row[] = [];
    const seen = new Map<string, Row>();
    for (const b of bands) {
      if (!b.branch_group) {
        out.push({ key: b.id, lead: b, members: [b], branches: '' });
        continue;
      }
      const row = seen.get(b.branch_group);
      if (row) {
        row.members.push(b);
        continue;
      }
      const fresh: Row = { key: b.branch_group, lead: b, members: [b], branches: '' };
      seen.set(b.branch_group, fresh);
      out.push(fresh);
    }
    for (const r of out) {
      if (r.members.length < 2) continue;
      r.branches = r.members.map(m => m.vibration.branch ?? '?').join(', ');
    }
    return out;
  }
  /** A branched row is named for the vibration, not for one of its lines. */
  const rowName = (r: Row) => (r.members.length > 1 ? vibName(r.lead) : bandName(r.lead));
  const span = (r: Row) => ({
    lo: Math.min(...r.members.map(m => m.wn_min)),
    hi: Math.max(...r.members.map(m => m.wn_max)),
  });

  /** A long list starts folded: the explanation is the point, not the tally. */
  const MANY = 3;
  let open = examples.length <= MANY;
  $: total = examples.reduce((n, ex) => n + ex.bands.length, 0);
  /** Which branched rows the reader has opened out. */
  let shown: Record<string, boolean> = {};
</script>

<section class="atlas">
  <button class="atlas-head" aria-expanded={open} on:click|stopPropagation={() => (open = !open)}>
    <span class="chev" class:open>▸</span>
    <span>{title}</span>
    <span class="atlas-count">
      {examples.length} {examples.length === 1 ? 'example' : 'examples'} · {total} bands
    </span>
  </button>
  {#if open && field}
    <p class="field-note">Recorded as <code>{field}</code></p>
  {/if}
  {#if examples.length === 0}
    {#if open}<p class="empty">No band in the atlas currently shows this.</p>{/if}
  {:else if open}
    <!-- Keyed by the bands: two examples can share a heading. -->
    {#each examples as ex (ex.bands.map(b => b.id).join('|'))}
      <article class="example">
        <header>
          <span class="ex-label">{ex.label}</span>
          <span class="ex-count">{ex.bands.length} band{ex.bands.length === 1 ? '' : 's'}</span>
        </header>
        {#if ex.note}<p class="ex-note">{ex.note}</p>{/if}

        <div class="band-rows">
          {#each rowsOf(ex.bands) as r (r.key)}
            <button
              class="band-row"
              on:click|stopPropagation={() =>
                r.members.length > 1
                  ? (shown[r.key] = !shown[r.key])
                  : dispatch('band', { id: r.lead.id })}
            >
              <span class="band-name">{rowName(r)}</span>
              {#each structureTags(r.lead) as tg (tg)}
                <span class="band-tag" class:own={tg === ownTag}>{tg}</span>
              {/each}
              {#if r.members.length > 1}
                <span class="band-branches">{r.branches}</span>
              {/if}
              <span class="band-wn">{span(r).lo}–{span(r).hi} cm⁻¹</span>
            </button>
            {#if r.members.length > 1 && shown[r.key]}
              {#each r.members as b (b.id)}
                <button class="band-row sub" on:click|stopPropagation={() => dispatch('band', { id: b.id })}>
                  <span class="band-name">{bandName(b)}</span>
                  {#each structureTags(b) as tg (tg)}
                    <span class="band-tag" class:own={tg === ownTag}>{tg}</span>
                  {/each}
                  <span class="band-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
                </button>
              {/each}
            {/if}
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

  /* The heading is the control: the whole box folds away behind it. */
  .atlas-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--accent-green-fg);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 0 0 8px;
    cursor: pointer;
    text-align: left;
  }
  .chev { transition: transform 0.18s ease; display: inline-block; }
  .chev.open { transform: rotate(90deg); }
  .atlas-count {
    margin-left: auto;
    color: var(--ink-050);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
  /* The lines of one branched transition, once the row is opened out. */
  .band-row.sub {
    padding-left: 26px;
    color: var(--ink-050);
  }
  .band-branches {
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    color: var(--ink-050);
  }

  .empty { color: var(--ink-300); font-size: var(--t-code-size); margin: 0 0 10px; }

  /* What records this phenomenon: a note about the data, so it sits with the
     evidence rather than above it, and folds away with the rest. */
  .field-note { font-size: var(--t-code-size); color: var(--ink-200); margin: 0 0 10px; }
  code {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

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

  .band-name { color: var(--ink-700); }

  /* Which rows are the first step, so a fundamental reads as one beside the
     overtones and combinations built on it. Derived, never authored. */
  .band-tag {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    color: var(--ink-200);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 0 5px;
    white-space: nowrap;
  }
  /* The one this card is about, in the Knowledge green. */
  .band-tag.own {
    color: var(--accent-green-fg);
    border-color: var(--accent-green-fg);
  }

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

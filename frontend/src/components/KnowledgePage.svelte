<script context="module" lang="ts">
  import { PHENOMENA } from '../lib/phenomena';

  export interface KnSection {
    id: string;
    label: string;
    part?: boolean;
  }

  /** Table of contents for the sidebar, one entry per phenomenon. */
  export const SECTIONS: KnSection[] = [
    { id: 'phenomena', label: 'Phenomena', part: true },
    ...PHENOMENA.map(p => ({ id: p.key, label: p.label })),
  ];
</script>

<script lang="ts">
  /**
   * Knowledge: what the spectra mean, as opposed to what the atlas holds.
   *
   * Each section is one phenomenon, and each carries its own back-relation:
   * the bands in this dataset that actually show it, resolved live from the
   * link fields, with the papers that reported them. So the explanation can
   * be read forwards (what is a Fermi resonance?) and backwards (which of my
   * bands are one, and who says so?).
   *
   * The prose lives in lib/phenomena.ts and is not written yet. A section
   * with no text says so plainly rather than looking finished; the examples
   * underneath it are real either way.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { Band, GroupMap, RefMap } from '../lib/types';
  import { citekeysFor } from '../lib/phenomena';
  import { speciesLabel } from '../lib/labels';
  import { ieeeHtml, shortCite } from '../lib/citations';
  import { htmlToUnicode } from '../lib/notation';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;

  const dispatch = createEventDispatcher<{
    active: { id: string };
    navigateBand: { id: string };
    navigateRef: { key: string };
  }>();

  $: sections = PHENOMENA.map(p => ({ spec: p, examples: p.find(bands) }));

  function bandName(b: Band): string {
    return b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;
  }

  function groupColor(b: Band): string {
    return groups[b.group]?.color ?? 'var(--ink-400)';
  }

  /* ── Scroll spy, same mechanism as the other long-form pages ── */
  let root: HTMLElement;
  let scroller: HTMLElement | null = null;
  let activeId = SECTIONS[0].id;
  let frame = 0;

  function measure() {
    frame = 0;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let current = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const el = root?.querySelector<HTMLElement>(`[data-kn-section="${s.id}"]`);
      if (!el) continue;
      if (el.getBoundingClientRect().top - top <= 90) current = s.id;
    }
    if (current !== activeId) {
      activeId = current;
      dispatch('active', { id: current });
    }
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(measure);
  }

  onMount(() => {
    scroller = root.closest('.main-area');
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    measure();
  });

  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
    scroller?.removeEventListener('scroll', onScroll);
  });
</script>

<main class="content" bind:this={root}>
  <h1 class="page-title">Knowledge</h1>
  <p class="lead">
    Why the bands behave the way they do. Each phenomenon below lists the bands in this
    atlas that show it, resolved from the data rather than written down twice, and the
    papers that reported them. The explanations themselves are still to be written.
  </p>

  <h2 class="part" id="phenomena" data-kn-section="phenomena">Phenomena</h2>

  {#each sections as { spec, examples } (spec.key)}
    <section class="section" id={spec.key} data-kn-section={spec.key}>
      <h3>{spec.label}</h3>

      <div class="spread">
        <div class="spread-text">
          {#if spec.what || spec.spotting}
            {#if spec.what}<p>{spec.what}</p>{/if}
            {#if spec.spotting}<p>{spec.spotting}</p>{/if}
          {:else}
            <p class="unwritten">
              Not written yet. The explanation and its diagram go here; the examples
              beside it are already live.
            </p>
          {/if}
          <p class="field-note">Recorded as <code>{spec.field}</code></p>
        </div>

        <div class="spread-visual">
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
                    <button class="band-row" on:click={() => dispatch('navigateBand', { id: b.id })}>
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
                          on:click={() => dispatch('navigateRef', { key })}
                        >{shortCite(refs[key] ?? {}, key, { journal: false })}</button>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </article>
            {/each}
          {/if}
        </div>
      </div>
    </section>
  {/each}
</main>

<style>
  /* Type roles and colours come from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: 28px 48px 64px;
    max-width: 1180px;
    margin: 0 auto;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--ink-700);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 0 0 14px;
  }

  .lead {
    max-width: 760px;
    color: var(--ink-slate-700);
    margin: 0 0 var(--space-6);
  }

  .part {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 40px 0 4px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--line-slate);
  }

  .section { margin: var(--space-6) 0 48px; }

  .section h3 {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-heading);
  }

  .spread {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  .spread-text p { margin: 0 0 10px; color: var(--ink-500); }
  .spread-visual { min-width: 0; }

  /* An empty explanation says so, rather than looking finished. */
  .unwritten {
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--ink-300) !important;
    font-size: 13px;
  }

  .field-note { font-size: var(--t-code-size); color: var(--ink-200); }

  code {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  .empty { color: var(--ink-300); font-size: 13.5px; }

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

  .ex-label { font-weight: 700; color: var(--ink-slate-900); font-size: 13.5px; }

  .ex-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  .ex-note { margin: 0 0 6px; color: var(--ink-400); font-size: 13px; line-height: 1.45; }

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
    font-size: 13px;
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

  @media (max-width: 1000px) {
    .spread { grid-template-columns: 1fr; gap: var(--space-4); }
  }
</style>

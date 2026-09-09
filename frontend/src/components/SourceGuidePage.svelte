<script context="module" lang="ts">
  import { GUIDE_SECTIONS } from '../lib/sourceGuide';

  export interface SgSection {
    id: string;
    label: string;
    part?: boolean;
  }

  /**
   * Table of contents, consumed by the sidebar in App.svelte. Derived from the
   * guide itself, so a new section appears here the moment it is written.
   */
  export const SECTIONS: SgSection[] = GUIDE_SECTIONS;
</script>

<script lang="ts">
  /**
   * Source guide: how a paper becomes data in this atlas.
   *
   * The prose lives in lib/sourceGuide.ts, not in this file, for the same
   * reason the style guide reads lib/tokens.ts: the guide is the artefact, and
   * the page is one way of looking at it. Anyone working through a paper reads
   * it here; anyone editing the rules edits one module.
   *
   * Layout follows the style guide's spread convention: the explanation on the
   * left, the thing being explained on the right, and a spread never crosses a
   * part boundary.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { GUIDE } from '../lib/sourceGuide';

  const dispatch = createEventDispatcher<{ active: { id: string } }>();

  // ── Scroll spy ──
  // The page scrolls inside App.svelte's .main-area, not the window, so the
  // listener attaches to that ancestor and measures against its own top edge.
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
      const el = root?.querySelector<HTMLElement>(`[data-sg-section="${s.id}"]`);
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

  /** A section has something for the right column, or the spread collapses. */
  const hasVisual = (s: typeof GUIDE[number]) =>
    Boolean(s.table || s.example || s.checklist);

  /**
   * The guide is authored as plain text, because it is read directly out of
   * lib/sourceGuide.ts as often as it is read here. Two inline conventions are
   * worth rendering: `backticks` for a field or a key, **stars** for the word a
   * sentence turns on. Everything else stays literal, and the two HTML
   * characters that could appear are escaped first.
   */
  function inline(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
</script>

<main class="content" bind:this={root}>
  <h1 class="page-title">Source guide</h1>
  <p class="lede">
    How a paper becomes an entry in this atlas: what to take out of it, which field each fact
    belongs in, and what to check when the same paper is read again later. It is a working
    checklist rather than an essay, because that is how it is used.
  </p>
  <p class="lede">
    The rules are rules about <em>this</em> dataset, not about spectroscopy. Where one exists
    because the build enforces it, the field is named, so the guide and the validator can be
    checked against each other. The text is read live from
    <code>frontend/src/lib/sourceGuide.ts</code>.
  </p>

  {#each GUIDE as s (s.id)}
    {#if s.part}
      <h2 class="part" id={s.id} data-sg-section={s.id}>{s.title}</h2>
      {#each s.lead as p}
        <p class="part-sub">{@html inline(p)}</p>
      {/each}
    {:else}
      <section class="spread" id={s.id} data-sg-section={s.id}>
        <div class="explain">
          <h3 class="section-title">{s.title}</h3>
          {#each s.lead as p}
            <p class="para">{@html inline(p)}</p>
          {/each}

          {#if s.steps}
            <ol class="steps">
              {#each s.steps as step}<li>{@html inline(step)}</li>{/each}
            </ol>
          {/if}

          {#if s.rules}
            <ul class="rules">
              {#each s.rules as rule}<li>{@html inline(rule)}</li>{/each}
            </ul>
          {/if}

          {#if s.never}
            <div class="never">
              <div class="never-head">Never</div>
              <ul>
                {#each s.never as n}<li>{@html inline(n)}</li>{/each}
              </ul>
            </div>
          {/if}
        </div>

        <div class="visual">
          {#if hasVisual(s)}
            {#if s.table}
              <table class="guide-table">
                <thead>
                  <tr><th>{s.table.head[0]}</th><th>{s.table.head[1]}</th></tr>
                </thead>
                <tbody>
                  {#each s.table.rows as [left, right]}
                    <tr><td>{@html inline(left)}</td><td class="right-cell">{@html inline(right)}</td></tr>
                  {/each}
                </tbody>
              </table>
            {/if}

            {#if s.example}
              <figure class="example">
                <figcaption>{s.example.caption}</figcaption>
                <pre><code>{s.example.code}</code></pre>
                {#if s.example.note}<p class="example-note">{s.example.note}</p>{/if}
              </figure>
            {/if}

            {#if s.checklist}
              <ul class="checklist">
                {#each s.checklist as c}<li>{@html inline(c)}</li>{/each}
              </ul>
            {/if}
          {/if}
        </div>
      </section>
    {/if}
  {/each}
</main>

<style>
  /* Every value here comes from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: var(--space-5) 48px 96px;
    max-width: 1420px;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--t-body-color);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 0 0 14px;
  }

  .lede { margin: 0 0 10px; max-width: 760px; }

  /* Global, because most <code> on this page is injected by inline() and so
     carries no scoping class of its own. */
  .content :global(code) {
    font-family: var(--font-mono);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  .part {
    font-size: 20px;
    font-weight: 800;
    color: var(--brand-900);
    margin: var(--space-6) 0 2px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--line-slate);
    scroll-margin-top: 12px;
  }
  .part-sub {
    color: var(--ink-500);
    margin: 0 0 var(--space-5);
    max-width: 760px;
  }

  /* ── Spread: the rule on the left, what it looks like on the right ── */
  .spread {
    display: grid;
    grid-template-columns: minmax(0, 720px) minmax(300px, 560px);
    justify-content: start;
    gap: 48px;
    align-items: start;
    margin-bottom: var(--space-6);
    scroll-margin-top: 12px;
  }
  .explain { min-width: 0; }
  .visual { min-width: 0; }

  @media (max-width: 1180px) {
    .spread { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
  }

  .section-title {
    font-size: var(--t-section-title-size);
    font-weight: var(--t-section-title-weight);
    color: var(--t-section-title-color);
    margin: 0 0 8px;
  }

  .para { margin: 0 0 10px; }

  /* ── The three list kinds, deliberately different shapes ── */
  /* Numbered where the order is the instruction. */
  .steps {
    margin: 10px 0 0;
    padding-left: 20px;
  }
  .steps li { margin-bottom: 7px; }

  /* Unnumbered where every rule holds at once. */
  .rules {
    margin: 12px 0 0;
    padding-left: 18px;
    list-style: none;
  }
  .rules li {
    position: relative;
    margin-bottom: 7px;
  }
  .rules li::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 8px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--line-strong);
  }

  /* The mistakes. Same red the caveat tags use, for the same reason. */
  .never {
    margin: 14px 0 0;
    border-left: 3px solid var(--accent-red-fg);
    background: var(--accent-red-bg);
    border-radius: 0 var(--radius) var(--radius) 0;
    padding: 8px var(--space-4) 10px;
  }
  .never-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--accent-red-fg);
    margin-bottom: 4px;
  }
  .never ul { margin: 0; padding-left: 18px; }
  .never li { margin-bottom: 5px; }
  .never li:last-child { margin-bottom: 0; }

  /* ── Right column ── */
  .guide-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: var(--space-4);
  }
  .guide-table th {
    text-align: left;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    padding: 7px var(--space-4);
    border-bottom: 1px solid var(--line-soft);
    background: var(--pill-bg);
  }
  .guide-table td {
    padding: 7px var(--space-4);
    border-bottom: 1px solid var(--line-faint);
    vertical-align: top;
    font-size: 13px;
  }
  .guide-table tr:last-child td { border-bottom: none; }
  /* The right-hand column is always the field or the value, so it is code. */
  .right-cell {
    font-family: var(--font-mono);
    font-size: var(--t-code-size);
    color: var(--brand-900);
  }

  .example {
    margin: 0 0 var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .example figcaption {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    padding: 7px var(--space-4);
    border-bottom: 1px solid var(--line-soft);
    background: var(--pill-bg);
  }
  .example pre {
    margin: 0;
    padding: 10px var(--space-4);
    overflow-x: auto;
  }
  .example code {
    background: none;
    padding: 0;
    font-size: var(--t-code-size);
    line-height: 1.55;
    color: var(--ink-700);
    white-space: pre;
  }
  .guide-table :global(code),
  .checklist :global(code) {
    background: none;
    padding: 0;
    color: var(--brand-900);
  }

  .example-note {
    margin: 0;
    padding: 8px var(--space-4) 10px;
    border-top: 1px solid var(--line-faint);
    font-size: 12.5px;
    color: var(--ink-300);
  }

  .checklist {
    margin: 0;
    padding: 0;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
  }
  .checklist li {
    position: relative;
    padding: 8px var(--space-4) 8px 34px;
    border-bottom: 1px solid var(--line-faint);
    font-size: 13px;
  }
  .checklist li:last-child { border-bottom: none; }
  /* An empty box: this is a list to work through, not a list of done things. */
  .checklist li::before {
    content: '';
    position: absolute;
    left: var(--space-4);
    top: 11px;
    width: 10px;
    height: 10px;
    border: 1px solid var(--line-strong);
    border-radius: 2px;
  }
</style>

<script lang="ts">
  import { C } from '../../lib/tokens';
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode, Band, RefMap } from '../../lib/types';
  import { ieeeHtml } from '../../lib/citations';
  import { getBandTags } from '../../lib/chart';
  import { VIBRATION_PALETTE, TAG_STYLES, DEFAULT_TAG_STYLE } from '../../lib/colors';

  export let mode: VibrationMode;
  export let bands: Band[];
  export let refs: RefMap;

  const GREY = C['data-grey'];

  const dispatch = createEventDispatcher<{
    close: void;
    navigateRef: { key: string };
    navigateBand: { id: string };
  }>();

  $: vibKey = mode.subtype ? `${mode.category}.${mode.subtype}` : mode.category;
  $: color = VIBRATION_PALETTE[vibKey] ?? GREY;
  $: subtitle = `${mode.category}${mode.subtype ? ` (${mode.subtype})` : ''} | ${mode.atoms}`;

  // This mode's own characteristic wavenumber — a single value (with a "~"
  // prefix, since by definition it's not one precise observed line) or a
  // range — independent of whichever real bands it's linked to below.
  function wnLabel(m: VibrationMode): string | null {
    if (m.wn_start == null) return null;
    if (m.wn_end == null) return `~${m.wn_start} cm⁻¹`;
    return `${m.wn_start}–${m.wn_end} cm⁻¹`;
  }

  // Spelled out as a sentence rather than bare tags, so it reads clearly as
  // "this is the Herzberg index" / "this is the Mulliken symmetry label"
  // rather than two unlabeled fragments — composed to degrade gracefully
  // when only some of the three pieces are filled in (true for every mode
  // right now except a handful).
  $: herzbergLine = (() => {
    const parts: string[] = [];
    if (mode.herzberg_notation) parts.push(`Herzberg's ${mode.herzberg_notation}`);
    if (mode.symmetry) parts.push(`Mulliken symmetry ${mode.symmetry}`);
    let sentence = parts.join(', ');
    const wn = wnLabel(mode);
    if (wn) {
      sentence = sentence ? `${sentence} — characteristic wavenumber ${wn}.` : `Characteristic wavenumber ${wn}.`;
    } else if (sentence) {
      sentence += '.';
    }
    return sentence || null;
  })();

  // ir-active/raman-active already get their own colored badge below — drop
  // them from the generic tag list so they don't show up twice.
  $: modeTags = mode.tags.filter(t => t !== 'ir-active' && t !== 'raman-active');

  // One citation list aggregated across the mode's own reference list (e.g.
  // a paper whose figure the note's physical description is grounded in,
  // not tied to any one band) plus every real band this mode points to,
  // deduped by key — same citations a user would find by opening each band
  // individually, just collected in one place.
  $: citationKeys = [...new Set([...mode.reference, ...bands.flatMap(b => b.references.map(r => r.key))])];

  // Per-band expand/collapse, same convention as the band chart tooltip's
  // own reference list (BandChart.svelte): collapsed by default whenever a
  // mode links to more than one band, always fully expanded when there's
  // only one. Reset whenever the mode itself changes, since this panel's
  // component instance persists across different open modes.
  let expandedBands = new Set<number>();
  let expandedForModeId: string | null = null;
  $: if (mode.id !== expandedForModeId) {
    expandedBands = new Set();
    expandedForModeId = mode.id;
  }
  function toggleBandExpand(i: number) {
    const next = new Set(expandedBands);
    if (next.has(i)) next.delete(i); else next.add(i);
    expandedBands = next;
  }
  $: bandsCollapsible = bands.length > 1;
</script>

<div class="detail-panel">
  <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">×</button>

  <div class="panel-header" style="border-left-color:{color}">
    <div class="panel-title" style="color:{color}">{mode.label}</div>
    <div class="panel-subtitle">{subtitle}</div>
  </div>

  {#if herzbergLine}
    <p class="panel-herzberg">{@html herzbergLine}</p>
  {/if}

  {#if mode.note}
    <p class="panel-note">{mode.note}</p>
  {/if}

  <div class="tag-section">
    {#if mode.ir_active !== null}
      {@const style = mode.ir_active ? TAG_STYLES['ir-active'] : DEFAULT_TAG_STYLE}
      <span class="pill" style="background:{style.background};border-color:{style.border};color:{style.color}">
        {mode.ir_active ? 'IR-active' : 'IR-inactive'}
      </span>
    {/if}
    {#if mode.raman_active !== null}
      {@const style = mode.raman_active ? TAG_STYLES['raman-active'] : DEFAULT_TAG_STYLE}
      <span class="pill" style="background:{style.background};border-color:{style.border};color:{style.color}">
        {mode.raman_active ? 'Raman-active' : 'Raman-inactive'}
      </span>
    {/if}
  </div>

  {#if modeTags.length}
    <div class="tag-section">
      <span class="tag-section-label">Mode</span>
      {#each modeTags as t (t)}<span class="pill">{t}</span>{/each}
    </div>
  {/if}

  <div class="bands-section">
    <div class="section-header">Bands</div>
    {#each bands as b, i (b.id)}
      {@const bTags = getBandTags(b)}
      {@const cTags = [...new Set(b.references.flatMap(r => r.tags))]}
      {@const expanded = !bandsCollapsible || expandedBands.has(i)}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="band-box"
        class:band-box-btn={bandsCollapsible}
        on:click={bandsCollapsible ? () => toggleBandExpand(i) : null}
        title={bandsCollapsible ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
      >
        <button
          class="band-goto-btn"
          on:click|stopPropagation={() => dispatch('navigateBand', { id: b.id })}
          title="View in band chart"
        >↗</button>
        <div class="band-box-line">
          <span class="band-name">
            {b.short || b.id}
            {#if bandsCollapsible}
              <span class="band-box-chevron" class:open={expanded}>▸</span>
            {/if}
          </span>
          <span class="badge-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
        </div>
        {#if bTags.length}
          <div class="band-box-tags">
            {#each bTags as t (t)}<span class="pill">{t}</span>{/each}
          </div>
        {/if}
        {#if expanded}
          {#if b.description}
            <div class="band-desc">{@html b.description}</div>
          {/if}
          <div class="citation-line">
            {b.references.length} citation{b.references.length !== 1 ? 's' : ''} backing this band
          </div>
          {#if cTags.length}
            <div class="band-box-tags">
              {#each cTags as t (t)}<span class="pill">{t}</span>{/each}
            </div>
          {/if}
        {/if}
      </div>
    {/each}
    {#if bands.length === 0}
      <p class="no-bands">No separately observed band — see the note above.</p>
    {/if}
  </div>

  {#if citationKeys.length > 0 && refs}
    <div class="refs-section">
      <div class="section-header">References</div>
      <ul class="refs">
        {#each citationKeys as key (key)}
          <li>
            <button class="ref-btn" on:click={() => dispatch('navigateRef', { key })}>
              {@html ieeeHtml(refs[key] ?? {}, key)}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .detail-panel {
    position: relative;
    flex: 1 1 auto;
    min-width: 380px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 18px 22px;
    align-self: stretch;
  }

  .close-btn {
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: none;
    font-size: 21px;
    line-height: 1;
    color: var(--ink-050);
    cursor: pointer;
    padding: 2px 6px;
  }

  .close-btn:hover { color: var(--ink-500); }

  .panel-header {
    border-left: 3px solid var(--ink-200);
    padding-left: 12px;
    margin-bottom: 8px;
  }

  .panel-title {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
  }

  .panel-subtitle {
    font-size: 13px;
    color: var(--ink-300);
    margin-top: 2px;
  }

  .panel-herzberg {
    font-size: 12.5px;
    font-style: italic;
    color: var(--ink-200);
    margin: 6px 0 0;
  }
  .panel-herzberg :global(sub) { font-size: 0.75em; }

  .panel-note {
    font-size: 13.5px;
    color: var(--ink-500);
    line-height: 1.5;
    margin: 0 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line-faint);
  }

  .tag-section {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }

  .tag-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-100);
    margin-right: 2px;
  }

  /* Same pill metrics as the band chart's tooltip tags / references list
     badges — only the fill color varies by source. */
  .pill {
    background: var(--pill-bg);
    border: 1px solid var(--line-panel);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11px;
    color: var(--ink-500);
    white-space: nowrap;
  }

  .section-header {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-100);
    margin-bottom: 6px;
  }

  .bands-section { margin-bottom: 14px; }

  .band-box {
    position: relative;
    display: block;
    width: 100%;
    box-sizing: border-box; /* otherwise the right-padding for .band-goto-btn pushes this past the panel's own edge */
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: 4px;
    padding: 7px 26px 7px 9px;
    margin-top: 6px;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  /* Collapsible (2+ bands) — toggles its own description/citations open or
     closed, same convention as the band chart tooltip's own reference list
     (BandChart.svelte's .tip-ref-btn). A single linked band always shows
     fully expanded instead, with no click affordance at all. */
  .band-box-btn { cursor: pointer; transition: background 0.1s, border-left-color 0.1s; }
  .band-box-btn:hover {
    background: var(--ref-surface-hover);
    border-left-color: var(--ref-accent-strong);
  }

  .band-box-chevron {
    display: inline-block;
    font-size: 9px;
    color: var(--ref-accent-strong);
    margin-left: 4px;
    transition: transform 0.15s;
  }
  .band-box-chevron.open { transform: rotate(90deg); }

  /* Corner button — jumps to this band on the band chart; separate from
     the box's own expand/collapse click, same split as the band chart
     tooltip's .tip-ref-goto-btn. */
  .band-goto-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 1px solid var(--ref-border);
    border-radius: 4px;
    color: var(--ref-accent-strong);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
  }
  .band-goto-btn:hover {
    background: var(--ref-surface-hover);
    border-color: var(--ref-accent-strong);
    color: var(--ref-accent-deep);
  }

  .band-box-line {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .band-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink-800);
  }


  .badge-wn {
    background: var(--badge-wn-bg);
    border: 1px solid var(--badge-wn-border);
    color: var(--badge-wn-fg);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }

  .band-desc {
    font-size: 12.5px;
    color: var(--ink-500);
    line-height: 1.45;
    margin-top: 5px;
  }
  .band-desc :global(sub), .band-desc :global(sup) { font-size: 0.75em; }

  .band-box-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 5px;
  }

  .citation-line {
    font-size: 12px;
    color: var(--ref-meta);
    margin-top: 5px;
  }

  .no-bands {
    font-size: 13px;
    color: var(--ink-200);
    font-style: italic;
  }

  .refs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ref-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    color: var(--ink-500);
    cursor: pointer;
    text-align: left;
    line-height: 1.45;
  }

  .ref-btn:hover { color: var(--brand-accent); text-decoration: underline; }
</style>

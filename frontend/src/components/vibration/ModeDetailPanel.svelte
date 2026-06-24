<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode, Band, RefMap } from '../../lib/types';
  import { ieeeHtml } from '../../lib/citations';
  import { getBandTags } from '../../lib/chart';
  import { VIBRATION_PALETTE, TAG_STYLES, DEFAULT_TAG_STYLE } from '../../lib/colors';

  export let mode: VibrationMode;
  export let bands: Band[];
  export let refs: RefMap;

  const GREY = '#7F7F7F';

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
    {#each bands as b (b.id)}
      {@const bTags = getBandTags(b)}
      {@const cTags = [...new Set(b.references.flatMap(r => r.tags))]}
      <button class="band-box" on:click={() => dispatch('navigateBand', { id: b.id })} title="View in band chart">
        <div class="band-box-line">
          <span class="band-name">{b.short || b.id} <span class="band-box-arrow">↗</span></span>
          <span class="badge-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
        </div>
        {#if b.description}
          <div class="band-desc">{@html b.description}</div>
        {/if}
        {#if bTags.length}
          <div class="band-box-tags">
            {#each bTags as t (t)}<span class="pill">{t}</span>{/each}
          </div>
        {/if}
        <div class="citation-line">
          {b.references.length} citation{b.references.length !== 1 ? 's' : ''} backing this band
        </div>
        {#if cTags.length}
          <div class="band-box-tags">
            {#each cTags as t (t)}<span class="pill">{t}</span>{/each}
          </div>
        {/if}
      </button>
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
    background: #fff;
    border: 1px solid #ddd;
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
    color: #aaa;
    cursor: pointer;
    padding: 2px 6px;
  }

  .close-btn:hover { color: #555; }

  .panel-header {
    border-left: 3px solid #888;
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
    color: #777;
    margin-top: 2px;
  }

  .panel-herzberg {
    font-size: 12.5px;
    font-style: italic;
    color: #888;
    margin: 6px 0 0;
  }
  .panel-herzberg :global(sub) { font-size: 0.75em; }

  .panel-note {
    font-size: 13.5px;
    color: #555;
    line-height: 1.5;
    margin: 0 0 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
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
    color: #999;
    margin-right: 2px;
  }

  /* Same pill metrics as the band chart's tooltip tags / references list
     badges — only the fill color varies by source. */
  .pill {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11px;
    color: #555;
    white-space: nowrap;
  }

  .section-header {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #999;
    margin-bottom: 6px;
  }

  .bands-section { margin-bottom: 14px; }

  .band-box {
    display: block;
    width: 100%;
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 7px 9px;
    margin-top: 6px;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s, border-left-color 0.1s;
  }

  .band-box:hover {
    background: #f0ece4;
    border-left-color: #a08050;
  }
  .band-box:hover .band-box-arrow { opacity: 1; }

  .band-box-line {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .band-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #222;
  }

  .band-box-arrow {
    font-size: 11px;
    color: #a08050;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .badge-wn {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }

  .band-desc {
    font-size: 12.5px;
    color: #555;
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
    color: #8a7a4a;
    margin-top: 5px;
  }

  .no-bands {
    font-size: 13px;
    color: #888;
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
    color: #555;
    cursor: pointer;
    text-align: left;
    line-height: 1.45;
  }

  .ref-btn:hover { color: #1a3a8f; text-decoration: underline; }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode, Band, RefMap } from '../../lib/types';
  import { ieeeHtml } from '../../lib/citations';
  import { getBandTags } from '../../lib/chart';
  import { VIBRATION_PALETTE } from '../../lib/colors';

  export let mode: VibrationMode;
  export let bands: Band[];
  export let refs: RefMap;

  const GREY = '#7F7F7F';

  const dispatch = createEventDispatcher<{
    close: void;
    navigateRef: { key: string };
    navigateMode: { category: string; subtype: string | null };
  }>();

  $: vibKey = mode.subtype ? `${mode.category}.${mode.subtype}` : mode.category;
  $: color = VIBRATION_PALETTE[vibKey] ?? GREY;
  $: subtitle = `${mode.category}${mode.subtype ? ` (${mode.subtype})` : ''} | ${mode.atoms}`;

  // One citation list aggregated across every real band this mode points
  // to, deduped by key — same citations a user would find by opening each
  // band individually, just collected in one place.
  $: citationKeys = [...new Set(bands.flatMap(b => b.references.map(r => r.key)))];
</script>

<div class="detail-panel">
  <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">×</button>

  <div class="panel-header" style="border-left-color:{color}">
    <div class="panel-title" style="color:{color}">{mode.label}</div>
    <div class="panel-subtitle">{subtitle}</div>
  </div>

  {#if mode.note}
    <p class="panel-note">{mode.note}</p>
  {/if}

  <div class="tag-section">
    {#if mode.ir_active !== null}
      <span class="pill">{mode.ir_active ? 'IR-active' : 'IR-inactive'}</span>
    {/if}
    {#if mode.raman_active !== null}
      <span class="pill">{mode.raman_active ? 'Raman-active' : 'Raman-inactive'}</span>
    {/if}
  </div>

  {#if mode.tags.length}
    <div class="tag-section">
      <span class="tag-section-label">Mode</span>
      {#each mode.tags as t (t)}<span class="pill">{t}</span>{/each}
    </div>
  {/if}

  <button
    class="band-link"
    disabled={bands.length === 0}
    on:click={() => dispatch('navigateMode', { category: mode.category, subtype: mode.subtype })}
  >View {bands.length} band{bands.length !== 1 ? 's' : ''} in chart →</button>

  <div class="bands-section">
    <div class="section-header">Bands</div>
    {#each bands as b (b.id)}
      {@const bTags = getBandTags(b)}
      {@const cTags = [...new Set(b.references.flatMap(r => r.tags))]}
      <div class="band-box">
        <div class="band-box-line">
          <span class="band-name">{b.short || b.id}</span>
          <span class="badge-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
        </div>
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
    font-size: 20px;
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
    font-size: 19px;
    font-weight: 700;
    line-height: 1.2;
  }

  .panel-subtitle {
    font-size: 12px;
    color: #777;
    margin-top: 2px;
  }

  .panel-note {
    font-size: 12.5px;
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
    font-size: 10px;
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
    font-size: 10px;
    color: #555;
    white-space: nowrap;
  }

  .band-link {
    display: block;
    margin: 4px 0 14px;
    background: none;
    border: none;
    padding: 0;
    font-size: 12.5px;
    color: #1a3a8f;
    cursor: pointer;
    text-align: left;
  }

  .band-link:hover { text-decoration: underline; }
  .band-link:disabled { color: #B0B0B0; cursor: default; text-decoration: none; }

  .section-header {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #999;
    margin-bottom: 6px;
  }

  .bands-section { margin-bottom: 14px; }

  .band-box {
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 7px 9px;
    margin-top: 6px;
  }

  .band-box-line {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }

  .band-name {
    font-size: 12.5px;
    font-weight: 600;
    color: #222;
  }

  .badge-wn {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
  }

  .band-box-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 5px;
  }

  .citation-line {
    font-size: 11px;
    color: #8a7a4a;
    margin-top: 5px;
  }

  .no-bands {
    font-size: 12px;
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
    font-size: 12px;
    color: #555;
    cursor: pointer;
    text-align: left;
    line-height: 1.45;
  }

  .ref-btn:hover { color: #1a3a8f; text-decoration: underline; }
</style>

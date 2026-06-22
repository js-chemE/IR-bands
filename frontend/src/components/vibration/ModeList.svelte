<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode } from '../../lib/types';
  import { VIBRATION_PALETTE, ATOMS_PALETTE, TAG_STYLES, DEFAULT_TAG_STYLE } from '../../lib/colors';

  export let modes: VibrationMode[];
  export let openModeId: string | null;

  const GREY = '#7F7F7F';

  // Allowlist of every mode tag worth surfacing as its own pill in the
  // collapsed card, alongside the atoms badge — everything in a mode's tags
  // not listed here stays hidden until the mode is opened (the full tag
  // list is always shown there; an "inactive" ir/raman state in particular
  // isn't a notable-enough fact for a badge at a glance). Add to this list
  // to show more.
  const SHOWN_TAGS = ['ir-active', 'raman-active', 'degenerated'];

  const dispatch = createEventDispatcher<{
    preview: { id: string | null };
    open: { id: string };
  }>();

  function vibKey(m: VibrationMode): string {
    return m.subtype ? `${m.category}.${m.subtype}` : m.category;
  }

  function vibLabel(m: VibrationMode): string {
    return m.subtype ? `${m.category} (${m.subtype})` : m.category;
  }

  // Stacking towards the atoms badge (rightmost, anchored): tags with their
  // own custom TAG_STYLES color sit closest to it, plain/uncolored tags
  // (DEFAULT_TAG_STYLE) stack further left of those — not a fixed per-tag
  // order, just colored-before-uncolored among whichever of SHOWN_TAGS this
  // mode actually has.
  function shownTags(m: VibrationMode): string[] {
    const present = SHOWN_TAGS.filter(t => m.tags.includes(t));
    const uncolored = present.filter(t => !TAG_STYLES[t]);
    const colored = present.filter(t => TAG_STYLES[t]);
    return [...uncolored, ...colored];
  }

  // Herzberg's classic normal-mode index + Mulliken symmetry label, combined
  // into one small tag to the left of the mode's name — only when at least
  // one of the two is actually filled in.
  function herzbergTag(m: VibrationMode): string | null {
    if (m.herzberg_notation && m.symmetry) return `${m.herzberg_notation} (${m.symmetry})`;
    return m.herzberg_notation || m.symmetry || null;
  }

  // This mode's own characteristic wavenumber — a single value (rendered
  // with a "~" prefix, since by definition it's not one precise observed
  // line) or a range — independent of whichever real bands it's linked to.
  function wnLabel(m: VibrationMode): string | null {
    if (m.wn_start == null) return null;
    if (m.wn_end == null) return `~${m.wn_start} cm⁻¹`;
    return `${m.wn_start}–${m.wn_end} cm⁻¹`;
  }
</script>

<div class="mode-list">
  {#each modes as m (m.id)}
    {@const color = VIBRATION_PALETTE[vibKey(m)] ?? GREY}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div
      class="mode-box"
      class:active={m.id === openModeId}
      style="border-left-color:{color}"
      on:click={() => dispatch('open', { id: m.id })}
      on:mouseenter={() => dispatch('preview', { id: m.id })}
      on:mouseleave={() => dispatch('preview', { id: null })}
      aria-expanded={m.id === openModeId}
    >
      <div class="mode-box-top">
        <span class="mode-name" style="color:{color}">{m.label}</span>
        {#if herzbergTag(m)}
          <span class="tag-pill herzberg-pill">{@html herzbergTag(m)}</span>
        {/if}
        <span class="right-pills">
          {#if wnLabel(m)}
            <span class="badge-wn">{wnLabel(m)}</span>
          {/if}
          {#each shownTags(m) as t (t)}
            {@const style = TAG_STYLES[t] ?? DEFAULT_TAG_STYLE}
            <span class="tag-pill" style="background:{style.background};border-color:{style.border};color:{style.color}">{t}</span>
          {/each}
          {#if m.atoms}
            <span class="pill" style="background:{ATOMS_PALETTE[m.atoms] ?? GREY}">{m.atoms}</span>
          {/if}
        </span>
      </div>
      <div class="mode-subtitle">{vibLabel(m)}</div>
    </div>
  {/each}
</div>

<style>
  .mode-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 auto;
    min-width: 280px;
  }

  .mode-box {
    cursor: pointer;
    border-left: 3px solid #888;
    border-radius: 0 4px 4px 0;
    background: #fff;
    padding: 6px 10px;
  }

  .mode-box:hover { background: rgba(0, 0, 0, 0.03); }

  .mode-box.active {
    background: #F5F7FB;
  }

  .mode-box-top {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .mode-name {
    font-size: 13px;
    font-weight: 700;
  }

  .right-pills {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .mode-subtitle {
    font-size: 11px;
    color: #888;
    margin-top: 1px;
  }

  /* Same pill metrics used everywhere on the site (chart tooltip, references
     list) — only the fill color changes per tag source. */
  .pill {
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10px;
    color: #fff;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Same metrics as .pill, but light-fill/colored-text (TAG_STYLES
     convention) instead of solid-fill/white-text — atoms/vibration are
     primary classifications, ir-active/raman-active are auxiliary tags. */
  .tag-pill {
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Unstyled (no TAG_STYLES entry) until real herzberg_notation/symmetry
     values exist — plain default tag-pill colors. */
  .herzberg-pill {
    background: #f9fafb;
    border-color: #eaecef;
    color: #8a8f98;
  }
  .herzberg-pill :global(sub) { font-size: 0.75em; }

  /* Same blue badge used for wavenumbers everywhere else on the site (band
     chart tooltip, references list, mode detail panel). */
  .badge-wn {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 10px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }
</style>

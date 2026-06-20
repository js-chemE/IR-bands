<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode } from '../../lib/types';
  import { VIBRATION_PALETTE, ATOMS_PALETTE, TAG_STYLES } from '../../lib/colors';

  export let modes: VibrationMode[];
  export let openModeId: string | null;

  const GREY = '#7F7F7F';
  const ACTIVITY_TAGS = ['ir-active', 'raman-active'];

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

  // Only the active case is shown here — an "inactive" tag isn't a notable
  // fact worth a badge at a glance; the full active/inactive state for both
  // is always visible once the mode is opened.
  function activityTags(m: VibrationMode): string[] {
    return ACTIVITY_TAGS.filter(t => m.tags.includes(t));
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
        <span class="right-pills">
          {#each activityTags(m) as t (t)}
            {@const style = TAG_STYLES[t]}
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
</style>

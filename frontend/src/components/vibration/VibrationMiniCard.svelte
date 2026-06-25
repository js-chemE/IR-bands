<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import type { VibrationMode } from '../../lib/types';
  import type { MoleculeGeometry } from '../../lib/moleculeGeometry';
  import { VIBRATION_PALETTE, ATOMS_PALETTE } from '../../lib/colors';
  import MoleculeViewer from './MoleculeViewer.svelte';

  const dispatch = createEventDispatcher<{ navigate: void }>();

  export let mode: VibrationMode;
  export let geometry: MoleculeGeometry | null;
  // Bumped by the parent every time a *new* hover or click should kick off
  // the 3-second auto-play below — a plain prop change, not an event, so
  // re-triggering on the exact same value still works (the parent always
  // increments, never just sets truthy).
  export let triggerNonce: number;
  // Whether this card can actually respond to mouseenter/leave on its own
  // diagram. Mirrors the band tooltip's own pointer-events split (none while
  // merely hovering the band, auto once the tooltip is clicked/locked) —
  // see BandChart.svelte. Without this, moving the mouse off the band and
  // onto this card during a live hover would itself clear the band hover
  // and make the whole thing disappear before the mouseenter ever lands.
  export let interactive: boolean;

  const GREY = '#7F7F7F';
  $: vibKey = mode.subtype ? `${mode.category}.${mode.subtype}` : mode.category;
  $: color = VIBRATION_PALETTE[vibKey] ?? GREY;

  $: herzbergTag = mode.herzberg_notation && mode.symmetry
    ? `${mode.herzberg_notation} (${mode.symmetry})`
    : mode.herzberg_notation || mode.symmetry || null;

  $: vectors = geometry?.modes[mode.id] ?? null;

  // Auto-play: every fresh trigger from the parent plays for 3s, unless the
  // user is actively hovering the diagram themselves (see `hovered` below),
  // in which case it just keeps going instead of cutting off mid-hover.
  let autoPlaying = false;
  let hovered = false;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;

  function playFor3s() {
    autoPlaying = true;
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { autoPlaying = false; }, 3000);
  }

  let lastNonce = -1;
  $: if (triggerNonce !== lastNonce) {
    lastNonce = triggerNonce;
    playFor3s();
  }

  $: activeVectors = (autoPlaying || hovered) && vectors ? vectors : null;

  onDestroy(() => { if (stopTimer) clearTimeout(stopTimer); });
</script>

<div class="mini-card" style="border-left-color:{color}">
  <div class="mini-top">
    <button
      class="mini-name"
      style="color:{color}"
      on:click={() => dispatch('navigate')}
      title="Open this mode on the Vibration modes page"
    >{mode.label}</button>
    {#if herzbergTag}
      <span class="mini-herzberg">{@html herzbergTag}</span>
    {/if}
    {#if mode.atoms}
      <span class="mini-atoms" style="background:{ATOMS_PALETTE[mode.atoms] ?? GREY}">{mode.atoms}</span>
    {/if}
  </div>
  {#if geometry}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="mini-diagram"
      class:interactive
      on:mouseenter={() => { if (interactive) hovered = true; }}
      on:mouseleave={() => { hovered = false; }}
    >
      <MoleculeViewer {geometry} {activeVectors} size={132} />
    </div>
  {/if}
</div>

<style>
  .mini-card {
    border-left: 3px solid #888;
    border-radius: 0 4px 4px 0;
    background: #fff;
    padding: 4px 7px 2px;
  }

  .mini-top {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
  }

  /* Clickable — same quiet hover darkening as the references page's own
     expandable band rows, rather than looking like a normal button. */
  .mini-name {
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    border: none;
    background: none;
    border-radius: 3px;
    padding: 0 3px;
    margin: 0 -3px;
    cursor: pointer;
  }
  .mini-name:hover { background: rgba(0, 0, 0, 0.04); }

  .mini-herzberg {
    font-size: 10.5px;
    color: #8a8f98;
    background: #f9fafb;
    border: 1px solid #eaecef;
    border-radius: 3px;
    padding: 0 4px;
  }
  .mini-herzberg :global(sub) { font-size: 0.75em; }

  /* Same pill metrics as .mini-herzberg right next to it — same row, same
     size — just with the atoms palette's own color instead of the
     herzberg pill's neutral fill. Purely decorative; the name button above
     is the actual link to the Vibration modes page. */
  .mini-atoms {
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 3px;
    padding: 0 4px;
    font-size: 10.5px;
    color: #fff;
    white-space: nowrap;
  }

  .mini-diagram {
    display: flex;
    justify-content: center;
    margin: -6px 0 -8px;
  }
  .mini-diagram.interactive { cursor: default; }
</style>

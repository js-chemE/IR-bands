<!--
  The band chart's stand-in on a shell too narrow to draw it.

  This used to be a site-wide notice: an overlay that told every phone visitor
  to come back on a computer. The rest of the atlas reads perfectly well in a
  single column, so the block has narrowed to the one view that genuinely
  needs the width. The chart's canvas is 1100px before the 200px lane-label
  margin, and its zoom, pan and hover tooltips all assume a mouse, so below
  the `wide` step it is withheld rather than shown broken.

  Withheld, not forbidden: "Show it anyway" hands over the real chart inside a
  horizontal scroller, because a reader who knows what they are asking for
  should get it. The parent owns that flag, so the decision survives leaving
  the page and coming back.

  Everything about the threshold lives in WIDTH_CLASSES (lib/tokens.ts); this
  component only reports which step it is on.
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { CHART_LAYOUT, WIDTH_CLASSES, type WidthClass } from '../lib/tokens';

  /** Which step the shell is on, from App.svelte. */
  export let wClass: WidthClass = 'compact';

  const dispatch = createEventDispatcher<{ show: void }>();

  const WIDE_FROM = (WIDTH_CLASSES.find(w => w.key === 'mid')?.max ?? 1180) + 1;
</script>

<div class="wrap">
  <div class="panel">
    <div class="icon" aria-hidden="true">📊</div>
    <h2>The Band Chart Needs a Wider Window</h2>
    <p>
      The chart draws every band in the atlas on one wavenumber axis: a
      {CHART_LAYOUT.width}&nbsp;px canvas with another {CHART_LAYOUT.marginLeft}&nbsp;px
      of lane labels beside it. Zoom, pan and the band tooltips assume a mouse
      as well, so on a narrow or touch screen it would be a map you cannot read
      rather than a smaller one.
    </p>
    <p class="secondary">
      {#if wClass === 'compact'}
        Open the atlas on a computer, or turn a tablet landscape, to see it.
      {:else}
        Widen this window to at least {WIDE_FROM}&nbsp;px, or open the atlas on a
        larger screen, to see it.
      {/if}
      Everything else here works at this size: the Knowledge cards, the
      references and the whole dataset.
    </p>
    <button class="anyway" on:click={() => dispatch('show')}>Show it anyway</button>
    <p class="caveat">It will scroll sideways, and the tooltips may misbehave.</p>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 18px;
    box-sizing: border-box;
  }

  .panel {
    max-width: 460px;
    width: 100%;
    box-sizing: border-box;
    background: var(--surface-sunken);
    border: 1px solid var(--line-panel);
    border-radius: var(--radius-lg);
    padding: 26px 22px 20px;
    text-align: center;
  }

  .icon { font-size: 34px; line-height: 1; }

  h2 {
    margin: 12px 0 10px;
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    line-height: var(--t-page-title-lh);
  }

  p {
    margin: 0 0 12px;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--t-body-color);
  }

  p.secondary { color: var(--ink-400); }

  .anyway {
    margin-top: 4px;
    padding: 9px 18px;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: var(--t-body-size);
    font-weight: 600;
    color: var(--brand-700);
    cursor: pointer;
    /* WCAG 2.2 target size, and a comfortable thumb target on a phone. */
    min-height: 44px;
  }
  .anyway:hover { background: var(--surface-hover); }

  .caveat {
    margin: 10px 0 0;
    font-size: var(--t-code-size);
    color: var(--ink-300);
  }
</style>

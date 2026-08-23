<!--
  Mobile / narrow-viewport notice.

  Two tiers, both driven by live matchMedia / resize listeners so rotating a
  tablet or resizing a desktop window re-evaluates without a reload:

    'block' — very narrow, or a small touch device. Shown as a modal overlay
              with a "Continue anyway" button; dismissing it downgrades to
              the strip so the warning stays visible but out of the way.
    'warn'  — merely narrow, or any coarse-pointer device. Full-width strip
              directly under the page header (amber, dismissible).

  Set USE_OVERLAY = false to drop the modal entirely and always use the
  strip (the strip's wording still hardens on the 'block' tier).

  Dismissals live in sessionStorage, so a reader is not nagged again while
  navigating the site, but a fresh visit warns again.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  const USE_OVERLAY = true;

  const OVERLAY_KEY = 'bandatlas.mobileNotice.overlayDismissed';
  const STRIP_KEY   = 'bandatlas.mobileNotice.stripDismissed';

  // Below this the layout genuinely breaks: the plot area alone has a
  // 1100px min-width (see .plot-area in App.svelte).
  const BLOCK_WIDTH = 820;
  const WARN_WIDTH  = 1180;
  // Touch devices get a stricter block threshold: even a landscape tablet
  // has no hover, so tooltips and the legend hover-highlight never fire.
  const COARSE_BLOCK_WIDTH = 1000;

  let width = typeof window !== 'undefined' ? window.innerWidth : 1920;
  let coarse = false;
  let overlayDismissed = false;
  let stripDismissed = false;
  let mounted = false;

  let coarseQuery: MediaQueryList | null = null;

  function readWidth() { width = window.innerWidth; }
  function readCoarse() { coarse = coarseQuery ? coarseQuery.matches : false; }

  function readFlag(key: string): boolean {
    try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
  }
  function writeFlag(key: string) {
    try { sessionStorage.setItem(key, '1'); } catch { /* private mode — ignore */ }
  }

  onMount(() => {
    coarseQuery = window.matchMedia('(pointer: coarse)');
    readWidth();
    readCoarse();
    overlayDismissed = readFlag(OVERLAY_KEY);
    stripDismissed = readFlag(STRIP_KEY);
    window.addEventListener('resize', readWidth);
    window.addEventListener('orientationchange', readWidth);
    coarseQuery.addEventListener?.('change', readCoarse);
    mounted = true;
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('resize', readWidth);
    window.removeEventListener('orientationchange', readWidth);
    coarseQuery?.removeEventListener?.('change', readCoarse);
  });

  $: tier = !mounted
    ? 'none'
    : width < BLOCK_WIDTH || (coarse && width < COARSE_BLOCK_WIDTH)
      ? 'block'
      : (width < WARN_WIDTH || coarse)
        ? 'warn'
        : 'none';

  $: showOverlay = USE_OVERLAY && tier === 'block' && !overlayDismissed;
  $: showStrip   = tier !== 'none' && !showOverlay && !stripDismissed;

  function continueAnyway() {
    overlayDismissed = true;
    writeFlag(OVERLAY_KEY);
  }

  function dismissStrip() {
    stripDismissed = true;
    writeFlag(STRIP_KEY);
  }
</script>

{#if showOverlay}
  <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="mn-title">
    <div class="card">
      <div class="card-icon" aria-hidden="true">🖥️</div>
      <h2 id="mn-title">Please use a computer</h2>
      <p>
        This site is not optimised for mobile devices. The band chart and the
        interactive parts (zoom, pan, tooltips, the legend and the vibration
        viewer) may not work at all on a narrow or touch screen.
      </p>
      <p class="secondary">
        Open it on a desktop or laptop with a window at least
        {BLOCK_WIDTH}&nbsp;px wide. A mobile-friendly version will follow later.
      </p>
      <button class="continue" on:click={continueAnyway}>Continue anyway</button>
    </div>
  </div>
{/if}

{#if showStrip}
  <div class="notice" class:block={tier === 'block'} role="status">
    <span class="icon" aria-hidden="true">{tier === 'block' ? '🖥️' : '⚠️'}</span>
    <span class="text">
      {#if tier === 'block'}
        <strong>Please use a computer.</strong>
        This site is not optimised for mobile devices. The band chart and the
        interactive parts may not work at all on a narrow or touch screen.
        A mobile-friendly version will follow later.
      {:else}
        <strong>Narrow screen detected.</strong>
        This site is built for desktop; the band chart and the interactive
        parts may not work properly at this width. A mobile-friendly version
        will follow later.
      {/if}
    </span>
    <button class="close" on:click={dismissStrip} aria-label="Dismiss notice">✕</button>
  </div>
{/if}

<style>
  /* ── Modal overlay (very narrow / small touch devices) ── */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    background: linear-gradient(160deg, #2c4a6e 0%, #3d6a9a 100%);
    overflow-y: auto;
  }

  .card {
    max-width: 420px;
    width: 100%;
    background: white;
    border-radius: 10px;
    box-shadow: 0 10px 34px rgba(0, 0, 0, 0.32);
    padding: 26px 22px 22px;
    text-align: center;
    box-sizing: border-box;
  }

  .card-icon { font-size: 40px; line-height: 1; }

  .card h2 {
    margin: 12px 0 10px;
    font-size: 21px;
    font-weight: 800;
    color: #2c4a6e;
  }

  .card p {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.5;
    color: #3A3A3A;
  }

  .card p.secondary {
    font-size: 13.5px;
    color: #666;
  }

  .continue {
    margin-top: 6px;
    padding: 9px 18px;
    background: #FFF8E1;
    border: 1px solid #F0DDA0;
    border-radius: 5px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #8a6d00;
    cursor: pointer;
  }
  .continue:hover { background: #FBEFC4; }

  /* ── Full-width strip under the header ── */
  .notice {
    flex: 0 0 auto;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 9px 18px;
    background: #FFF8E1;
    border-bottom: 1px solid #F0DDA0;
    color: #6b5200;
    font-size: 14px;
    line-height: 1.45;
  }

  .notice.block {
    background: #FDECEA;
    border-bottom-color: #F3C0B8;
    color: #7a2118;
  }

  .icon { flex: 0 0 auto; font-size: 16px; }
  .text { flex: 1 1 auto; }

  .close {
    flex: 0 0 auto;
    background: none;
    border: none;
    padding: 0 2px;
    font-size: 15px;
    color: inherit;
    cursor: pointer;
    line-height: 1.3;
    opacity: 0.65;
  }
  .close:hover { opacity: 1; }
</style>

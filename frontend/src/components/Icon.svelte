<!--
  The atlas's symbols, in one place.

  The four destinations are drawn on the home page as big cards and in the
  collapsed sidebar as 16px glyphs, and they have to be the same drawing in
  both: the rail is only legible because the reader has already met the symbol
  on a card. So the paths live here and both callers ask for them by name.

  Everything is a 24-unit box, stroked in `currentColor` and never filled, so
  colour comes from whatever renders it and the weight holds at either size.
-->
<script lang="ts">
  export let name:
    | 'home' | 'knowledge' | 'chart' | 'references' | 'dataset' | 'impressum'
    | 'styleguide' | 'sourceguide'
    | 'color' | 'filter' | 'toggles' | 'technique' | 'phase' | 'element' | 'eye' | 'eye-off' | 'range'
    | 'link' = 'home';
  export let size = 24;
  /** Thinner at card size, a touch heavier where the glyph is 16px. */
  export let width = 1.8;
</script>

<svg
  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={width}
  stroke-linecap="round" stroke-linejoin="round" {...{ width: size, height: size }}
  aria-hidden="true" focusable="false"
>
  {#if name === 'home'}
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M9.75 20v-5.5h4.5V20" />
  {:else if name === 'knowledge'}
    <!-- A brain: two lobes over a stem, with the fold down the middle. -->
    <path d="M12 5.5a3 3 0 0 0-5.6-1.4A2.7 2.7 0 0 0 3.6 8a3 3 0 0 0 .5 4.6A2.9 2.9 0 0 0 6 17.4a3 3 0 0 0 6 .6z" />
    <path d="M12 5.5a3 3 0 0 1 5.6-1.4A2.7 2.7 0 0 1 20.4 8a3 3 0 0 1-.5 4.6A2.9 2.9 0 0 1 18 17.4a3 3 0 0 1-6 .6z" />
    <path d="M12 5.5V21" />
  {:else if name === 'chart'}
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  {:else if name === 'references'}
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="12" y2="15" />
  {:else if name === 'dataset'}
    <!-- Stacked records, the usual shorthand for a dataset. -->
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  {:else if name === 'impressum'}
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.6h.01" />
  {:else if name === 'styleguide'}
    <!-- A palette: the thumb hole and three wells. -->
    <path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.8.7-1.4 1.6-1.4H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3z" />
    <circle cx="8" cy="11" r="1" />
    <circle cx="11" cy="7.5" r="1" />
    <circle cx="15.5" cy="9" r="1" />
  {:else if name === 'sourceguide'}
    <!-- A paper, and the arrow that turns it into an entry. -->
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <polyline points="14 3 14 8 19 8" />
    <path d="M8.5 15.5h6" />
    <polyline points="12.2 13.2 14.5 15.5 12.2 17.8" />
  {:else if name === 'color'}
    <!-- A drop of ink. Not a half-filled disc, which at 16px is the brain
         above it in the same rail. -->
    <path d="M12 3.2s6 6.3 6 10.1a6 6 0 0 1-12 0c0-3.8 6-10.1 6-10.1z" />
    <path d="M12 3.2s6 6.3 6 10.1a6 6 0 0 1-6 6z" fill="currentColor" stroke="none" opacity="0.35" />
  {:else if name === 'filter'}
    <polygon points="3.5 4.5 20.5 4.5 14 12.4 14 19.5 10 17.3 10 12.4" />
  {:else if name === 'eye'}
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === 'eye-off'}
    <path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4" />
    <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  {:else if name === 'range'}
    <!-- Two limits and the stretch between them: the chart's range selection. -->
    <path d="M5 4v16" />
    <path d="M19 4v16" />
    <path d="M8 12h8" stroke-dasharray="2 2" />
  {:else if name === 'technique'}
    <!-- A beam coming in, bouncing off a sample and going out: how the spectrum was taken. -->
    <path d="M3 4l9 11 9-11" />
    <path d="M3 19h18" />
    <path d="M18.5 6.5 21 4l-.6 3.4" />
  {:else if name === 'phase'}
    <!-- A drop resting on a surface: where the molecule sat and what surrounded it. -->
    <path d="M12 3.5c3 3.6 4.5 6.3 4.5 8.4a4.5 4.5 0 0 1-9 0c0-2.1 1.5-4.8 4.5-8.4z" />
    <path d="M3 20h18" />
  {:else if name === 'element'}
    <!-- One cell of the periodic table: the number in the corner, the symbol below. -->
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M7.5 7.5h2" />
    <path d="M15 11.5a3 3 0 1 0 0 4" />
  {:else if name === 'toggles'}
    <line x1="3.5" y1="8" x2="20.5" y2="8" />
    <line x1="3.5" y1="16" x2="20.5" y2="16" />
    <circle cx="9" cy="8" r="2.4" />
    <circle cx="15" cy="16" r="2.4" />
  {:else if name === 'link'}
    <!-- Two chain links: a URL, the way out of the atlas to the paper. -->
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  {/if}
</svg>

<style>
  svg { display: block; flex: 0 0 auto; }
</style>

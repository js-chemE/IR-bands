<svelte:options namespace="svg" />

<script lang="ts">
  /**
   * Subbed for inside an SVG <text>: the bracketed letter subscripts
   * (lib/notation.ts) lowered as tspans, since <sub> is HTML and does not
   * render in SVG. Each lowered run is followed by a raise, so the text
   * after it returns to the baseline.
   */
  import { splitSubscripts } from '../../lib/notation';

  export let text: string;
  export let drop = 3;

  $: parts = splitSubscripts(text).map((p, i, all) => ({
    ...p,
    dy: p.sub ? drop : i > 0 && all[i - 1].sub ? -drop : 0,
  }));
</script>

{#each parts as p}<tspan class:sub={p.sub} dy={p.dy || null}>{p.text}</tspan>{/each}

<style>
  .sub { font-size: 0.75em; }
</style>

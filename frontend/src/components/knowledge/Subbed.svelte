<script lang="ts">
  /** Plain text with its bracketed letter subscripts set lowered (lib/notation.ts). */
  import { splitSubscripts } from '../../lib/notation';

  export let text: string;
</script>

{#each splitSubscripts(text) as p}{#if p.sub}<sub>{p.text}</sub>{:else}{p.text}{/if}{/each}

<style>
  sub {
    font-size: 0.72em;
    line-height: 0;
  }
</style>

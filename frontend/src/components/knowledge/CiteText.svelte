<script lang="ts">
  /**
   * Text with its citations as superscript numbers (lib/cite.ts). The number
   * points at the list under the card; hovering it names the source and the
   * page. Two citations in a row are separated by a comma, as in print.
   */
  import type { Segment } from '../../lib/cite';
  import type { RefMap } from '../../lib/types';
  import { shortCite } from '../../lib/citations';
  import Subbed from './Subbed.svelte';

  export let segs: Segment[];
  export let refs: RefMap;

  function title(s: Extract<Segment, { cite: unknown }>): string {
    const who = shortCite(refs?.[s.cite.key] ?? {}, s.cite.key, { journal: false });
    return [who, s.cite.chapter, s.locator].filter(Boolean).join(', ');
  }
</script>

{#each segs as s, i}{#if 'text' in s}<Subbed text={s.text} />{:else}<sup class="cite" title={title(s)}>{#if i > 0 && !('text' in segs[i - 1])},{/if}{s.cite.n}</sup>{/if}{/each}

<style>
  .cite {
    font-size: 0.72em;
    line-height: 0;
    color: var(--ref-accent-deep);
    cursor: help;
    padding-left: 1px;
  }
</style>

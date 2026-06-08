<script lang="ts">
  import type { Band, BandReference, GroupMap, RefMap } from '../lib/types';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let sortedGroupKeys: string[];
  export let viewMode: 'by-ref' | 'by-group';

  let open = new Set<string>();

  function toggleOpen(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    open = next;
  }

  // ---- Formatting helpers ----

  function strip(s: string | undefined): string {
    return (s ?? '').replace(/\{([^}]*)\}/g, '$1');
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function authorsIEEE(raw: string): string {
    const authors = raw.split(/\s+and\s+/i).map(a => a.trim());
    const fmt = authors.map(a => {
      let last: string, first: string;
      if (a.includes(',')) {
        [last, first] = a.split(',', 2).map(s => s.trim());
      } else {
        const words = a.split(/\s+/);
        last = words.pop() ?? '';
        first = words.join(' ');
      }
      const initials = first.split(/\s+/).filter(Boolean).map(n => n[0] + '.').join(' ');
      return initials ? `${initials} ${last}` : last;
    });
    if (fmt.length === 1) return fmt[0];
    if (fmt.length === 2) return `${fmt[0]} and ${fmt[1]}`;
    return fmt.slice(0, -1).join(', ') + ', and ' + fmt[fmt.length - 1];
  }

  function ieeeHtml(ref: Record<string, string | undefined>, key: string): string {
    const author  = strip(ref['author']);
    const title   = strip(ref['title']);
    const journal = strip(ref['journaltitle'] ?? ref['journal'] ?? ref['booktitle']);
    const volume  = strip(ref['volume']);
    const number  = strip(ref['number']);
    const pages   = strip(ref['pages']).replace(/--/g, '–');
    const year    = strip(ref['date'] ?? ref['year']).slice(0, 4);
    const doi     = strip(ref['doi']);
    const url     = strip(ref['url']);

    const parts: string[] = [];
    if (author)  parts.push(esc(authorsIEEE(author)));
    if (title)   parts.push(`&ldquo;${esc(title)}&rdquo;`);
    if (journal) parts.push(`<em>${esc(journal)}</em>`);
    const detail = [
      volume && `vol.&nbsp;${esc(volume)}`,
      number && `no.&nbsp;${esc(number)}`,
      pages  && `pp.&nbsp;${esc(pages)}`,
    ].filter(Boolean) as string[];
    if (detail.length) parts.push(detail.join(', '));
    if (year) parts.push(esc(year));

    let s = parts.join(', ') + (parts.length ? '.' : esc(key));
    const href = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : url;
    if (href) s += ` <a class="ext" href="${href}" target="_blank" rel="noopener noreferrer">↗</a>`;
    return s;
  }

  function refSortKey(ref: Record<string, string | undefined>): string {
    const a = strip(ref['author']);
    const y = strip(ref['date'] ?? ref['year']).slice(0, 4);
    const first = a.split(/\s+and\s+/i)[0].trim();
    const last = first.includes(',')
      ? first.split(',')[0].trim()
      : (first.split(/\s+/).pop() ?? '');
    return (last + y).toLowerCase();
  }

  function bandNameHtml(b: Band): string {
    if (b.short) return b.short; // already has <sub>/<sup> HTML
    const sub    = b.vibration.subtype  ? ` ${esc(b.vibration.subtype)}`  : '';
    const branch = b.vibration.branch   ? ` ${esc(b.vibration.branch)}`   : '';
    return `${esc(b.species)}${sub} ${esc(b.vibration.category)}${branch}`;
  }

  function bandDetail(b: Band): string {
    const parts = [`${b.wn_min}–${b.wn_max} cm⁻¹`];
    if (b.intensity)  parts.push(`intensity: ${b.intensity}`);
    if (b.confidence) parts.push(`confidence: ${b.confidence}`);
    if (b.width)      parts.push(`width: ${b.width}`);
    if (b.description) parts.push(b.description.replace(/<[^>]+>/g, ''));
    return parts.join(' · ');
  }

  // What *this particular* source claims about the band, when it differs
  // from (or adds detail to) the band's general description above.
  function refNoteText(ref: BandReference): string | null {
    const parts: string[] = [];
    if (ref.wn != null) parts.push(`${ref.wn} cm⁻¹`);
    if (ref.site)       parts.push(`site: ${ref.site}`);
    if (ref.note)       parts.push(ref.note);
    return parts.length ? parts.join(' · ') : null;
  }

  // ---- By-reference view data ----
  interface BandRef    { band: Band; ref: BandReference; }
  interface GroupBands { key: string; label: string; color: string; entries: BandRef[]; }
  interface ByRefItem  { refKey: string; html: string; groupBands: GroupBands[]; }

  $: byRefItems = (() => {
    if (!refs) return [] as ByRefItem[];
    const refEntries = new Map<string, BandRef[]>();
    for (const b of bands) {
      for (const ref of b.references) {
        if (!refEntries.has(ref.key)) refEntries.set(ref.key, []);
        refEntries.get(ref.key)!.push({ band: b, ref });
      }
    }
    return [...refEntries.keys()]
      .sort((a, b) => refSortKey(refs![a] ?? {}).localeCompare(refSortKey(refs![b] ?? {})))
      .map(rk => {
        const byGroup = new Map<string, BandRef[]>();
        for (const e of refEntries.get(rk)!) {
          if (!byGroup.has(e.band.group)) byGroup.set(e.band.group, []);
          byGroup.get(e.band.group)!.push(e);
        }
        const groupBands: GroupBands[] = sortedGroupKeys
          .filter(gk => byGroup.has(gk))
          .map(gk => ({
            key:   gk,
            label: groups[gk]?.label ?? gk,
            color: groups[gk]?.color ?? '#444',
            entries: byGroup.get(gk)!.sort((a, b) => b.band.wn_max - a.band.wn_max),
          }));
        return { refKey: rk, html: ieeeHtml(refs![rk] ?? {}, rk), groupBands };
      });
  })();

  // ---- By-group view data ----
  interface ByRefEntry  { refKey: string; html: string; entries: BandRef[]; }
  interface ByGroupItem { key: string; label: string; color: string; refs: ByRefEntry[]; }

  $: byGroupItems = (() => {
    if (!refs) return [] as ByGroupItem[];
    return sortedGroupKeys
      .map(gk => {
        const gb = bands.filter(b => b.group === gk && b.references.length > 0);
        if (!gb.length) return null;
        const refMap = new Map<string, BandRef[]>();
        for (const b of gb) {
          for (const ref of b.references) {
            if (!refMap.has(ref.key)) refMap.set(ref.key, []);
            refMap.get(ref.key)!.push({ band: b, ref });
          }
        }
        const refEntries: ByRefEntry[] = [...refMap.keys()]
          .sort((a, b) => refSortKey(refs![a] ?? {}).localeCompare(refSortKey(refs![b] ?? {})))
          .map(rk => ({
            refKey: rk,
            html:   ieeeHtml(refs![rk] ?? {}, rk),
            entries: refMap.get(rk)!.sort((a, b) => b.band.wn_max - a.band.wn_max),
          }));
        return {
          key:   gk,
          label: groups[gk]?.label ?? gk,
          color: groups[gk]?.color ?? '#444',
          refs:  refEntries,
        };
      })
      .filter((x): x is ByGroupItem => x !== null);
  })();
</script>

<main class="content">

    {#if viewMode === 'by-ref'}
      <!-- ── Alphabetical by reference ── -->
      {#each byRefItems as item (item.refKey)}
        <div class="ref-block">
          <p class="citation">{@html item.html}</p>
          {#each item.groupBands as g (g.key)}
            <div class="group-section">
              <span class="group-label" style="color:{g.color}">{g.label}</span>
              <ul class="band-list">
                {#each g.entries as e (e.band.id)}
                  {@const id = `r-${item.refKey}-${e.band.id}`}
                  <li>
                    <button class="arrow" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                      {open.has(id) ? '▾' : '▸'}
                    </button>
                    <span class="band-name">{@html bandNameHtml(e.band)}</span>
                    {#if open.has(id)}
                      <div class="band-detail">{bandDetail(e.band)}</div>
                      {#if refNoteText(e.ref)}
                        <div class="band-detail ref-note">per this reference: {refNoteText(e.ref)}</div>
                      {/if}
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/each}

    {:else}
      <!-- ── By group ── -->
      {#each byGroupItems as g (g.key)}
        <div class="group-block">
          <h2 class="group-header" style="color:{g.color}">{g.label}</h2>
          {#each g.refs as r (r.refKey)}
            <div class="ref-section">
              <p class="citation">{@html r.html}</p>
              <ul class="band-list">
                {#each r.entries as e (e.band.id)}
                  {@const id = `g-${g.key}-${r.refKey}-${e.band.id}`}
                  <li>
                    <button class="arrow" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                      {open.has(id) ? '▾' : '▸'}
                    </button>
                    <span class="band-name">{@html bandNameHtml(e.band)}</span>
                    {#if open.has(id)}
                      <div class="band-detail">{bandDetail(e.band)}</div>
                      {#if refNoteText(e.ref)}
                        <div class="band-detail ref-note">per this reference: {refNoteText(e.ref)}</div>
                      {/if}
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/each}
    {/if}

</main>

<style>
  .content {
    padding: 24px 40px;
    max-width: 900px;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.55;
  }

  /* By-reference view */
  .ref-block {
    margin-bottom: 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid #EBEBEB;
  }
  .ref-block:last-child { border-bottom: none; }

  .citation {
    margin: 0 0 8px 0;
    color: #222;
    line-height: 1.6;
  }
  .citation :global(em) { font-style: italic; }
  .citation :global(a.ext) { color: #888; text-decoration: none; font-size: 11px; }
  .citation :global(a.ext:hover) { color: #333; }

  .group-section { margin: 4px 0 4px 14px; }

  .group-label {
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* By-group view */
  .group-block { margin-bottom: 36px; }

  .group-header {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 14px 0;
    padding-bottom: 5px;
    border-bottom: 2px solid currentColor;
    display: inline-block;
  }

  .ref-section {
    margin-bottom: 18px;
    padding-left: 14px;
    border-left: 3px solid #E5E5E5;
  }

  /* Band list (shared) */
  .band-list {
    list-style: none;
    margin: 4px 0 0 0;
    padding: 0 0 0 2px;
  }

  .band-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 3px;
    padding: 1px 0;
  }

  .arrow {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 9px;
    color: #999;
    padding: 0 1px;
    line-height: 1;
    flex: 0 0 auto;
  }
  .arrow:hover { color: #444; }

  .band-name { color: #333; font-size: 13px; }

  .band-detail {
    width: 100%;
    padding: 1px 0 2px 18px;
    font-size: 11.5px;
    color: #777;
    line-height: 1.4;
  }

  .band-detail.ref-note {
    font-style: italic;
    color: #8a7a4a;
  }
</style>

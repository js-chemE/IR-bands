<script lang="ts">
  /**
   * "In the atlas": the bands that show a phenomenon, resolved live from the
   * link fields (lib/phenomena.ts), with the papers behind them. A box of its
   * own under an opened card's text, so the explanation reads first and the
   * evidence second.
   *
   * A band row opens that band in the chart; a reference chip opens the
   * paper on the References page.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Band, RefMap } from '../../lib/types';
  import type { Example } from '../../lib/phenomena';
  import { citekeysFor } from '../../lib/phenomena';
  import { branchSuffix, speciesLabel, groupLabel, groupColor, groupRank } from '../../lib/labels';
  import { ieeeHtml, shortCite } from '../../lib/citations';
  import { htmlToUnicode } from '../../lib/notation';
  import { ISOTOPE_STYLE, MODEL_LIMIT_STYLE, CAVEAT_STYLE } from '../../lib/tokens';
  import { TAG_ROLES, tagRole, tagRoleRank, isUmbrellaTag } from '../../lib/dataModel';
  import type { TagRole } from '../../lib/dataModel';

  export let title = 'In the Atlas';
  /** Which field records the phenomenon. Shown only while the box is open:
      it is a note about the data model, not part of the explanation. */
  export let field = '';
  /**
   * The tag this card is about, drawn in the Knowledge green so it stands out
   * from the others. Only on its own card: `overtone` is the subject on the
   * Overtone card and merely a fact about the band on the Combination one,
   * and colouring it in both places would say they were equally the point.
   */
  export let ownTag = '';
  export let examples: Example[];
  export let refs: RefMap;

  const dispatch = createEventDispatcher<{ band: { id: string }; ref: { key: string } }>();

  /** The per-band note for a row, from whichever member carries one. */
  const rowNoteOf = (ex: Example, r: { members: Band[] }) =>
    r.members.map(m => ex.bandNotes?.[m.id]).find(Boolean);

  const bandName = (b: Band) =>
    (b.short || `${speciesLabel(b.species)} ${b.vibration.category}`) + branchSuffix(b);
  /** The vibration alone, for a row that stands for a whole branch group. */
  const vibName = (b: Band) => b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;

  /**
   * What the band IS, beside its name: the structure tags, never how it was
   * measured. In a list that mixes a fundamental with the overtones and
   * combinations built on it, this is the column that says which is which.
   *
   * `fundamental` and `overtone` are real derived tags in the data;
   * `combination` is derived from the category instead, the same rule
   * `getBandTags()` in lib/chart.ts uses, because the build does not write
   * that one into `tags`.
   */
  /**
   * What a row says the band IS, taken from the band's own tags by role
   * rather than named one at a time. TAG_ROLE_ORDER already splits the
   * vocabulary in two: the first four roles are what the band is, the rest
   * are how it was measured, and only the first four belong in a list whose
   * subject is a phenomenon. Naming the tags individually meant every new
   * one was invisible here until somebody remembered this file, which is how
   * hydrogen's pure rotation came to show `ir-inactive` and nothing else
   * while carrying a perfectly good `rotational` tag.
   *
   * An umbrella is dropped, as everywhere else: `isotope` beside `deuterium`
   * says the same thing more vaguely.
   */
  const IDENTITY_ROLES: TagRole[] = ['structure', 'isotope', 'activity', 'caveat'];
  /* The one fact of this kind that is not a tag: `combination` is read off
     vibration.category, since nothing writes it to the band. */
  const structureTags = (b: Band) => {
    const out = b.tags.filter(t => {
      const role = tagRole(t);
      return IDENTITY_ROLES.includes(role) && !isUmbrellaTag(t, role);
    });
    if (b.vibration.category === 'combination' && !out.includes('combination')) {
      out.push('combination');
    }
    return out.sort((a, c) => tagRoleRank(tagRole(a)) - tagRoleRank(tagRole(c)));
  };

  /**
   * Which one tag a list is about, marked as its subject in every row.
   *
   * Two things had to be settled. A phenomenon's key and the tag that records
   * it are not always spelled the same, and where they differ the list marked
   * nothing at all: `fermi` against `fermi-resonance`, `degeneracy` against
   * `degenerated`. The aliases below are the whole of that difference.
   *
   * And a subject is one tag, not one role. Selection Rules is genuinely
   * about both silences and the isotope card about all three substitutions,
   * so those two roles expand; `structure` never does, because it is a
   * grab-bag holding `fundamental`, `overtone`, `degenerated` and
   * `rotational-branches` at once, and expanding it would mark four tags that
   * have nothing to do with the card the reader is on.
   */
  const KEY_TAG: Record<string, string> = {
    fermi: 'fermi-resonance',
    branches: 'rotational-branches',
    degeneracy: 'degenerated',
    'site-sensitivity': 'site-sensitive',
    // Stands for its whole role, which is the next rule.
    isotopologue: 'deuterium',
  };
  /** The roles that are one subject between them, and so expand. */
  const ROLE_IS_ONE_SUBJECT: TagRole[] = ['isotope', 'activity'];

  $: subjectTag = KEY_TAG[ownTag] ?? ownTag;
  $: subjectRole = TAG_ROLES[subjectTag];
  $: isOwnTag = (t: string) =>
    t === subjectTag ||
    (!!subjectRole && ROLE_IS_ONE_SUBJECT.includes(subjectRole) && tagRole(t) === subjectRole);

  /** Red where the estimate would mislead, rose where it is only out of scope. */
  const caveatStyle = (tone?: 'alert' | 'limit') =>
    tone === 'alert' ? CAVEAT_STYLE : MODEL_LIMIT_STYLE;

  /**
   * The bands of one example, with a branch group folded into a single row.
   * The P, Q and R lines of one transition are one band as far as this list
   * is concerned: listing all three says nothing the first does not, and on
   * a card like Fermi resonance, where a partner is itself branched, it
   * buries the pair the card is about. The row opens to the lines.
   */
  interface Row { key: string; lead: Band; members: Band[]; branches: string }
  function rowsOf(bands: Band[]): Row[] {
    const out: Row[] = [];
    const seen = new Map<string, Row>();
    for (const b of bands) {
      if (!b.branch_group) {
        out.push({ key: b.id, lead: b, members: [b], branches: '' });
        continue;
      }
      const row = seen.get(b.branch_group);
      if (row) {
        row.members.push(b);
        continue;
      }
      const fresh: Row = { key: b.branch_group, lead: b, members: [b], branches: '' };
      seen.set(b.branch_group, fresh);
      out.push(fresh);
    }
    for (const r of out) {
      if (r.members.length < 2) continue;
      /* In ΔJ order, and counted rather than repeated: hydrogen's pure
         rotational band is ten resolved S lines, and "S, S, S, S, S, S, S,
         S, S, S" says nothing that "S ×10" does not. */
      const ORDER = ['O', 'P', 'Q', 'R', 'S'];
      const n = new Map<string, number>();
      for (const m of r.members) {
        const k = m.vibration.branch ?? '?';
        n.set(k, (n.get(k) ?? 0) + 1);
      }
      r.branches = [...n.entries()]
        .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
        .map(([k, c]) => (c > 1 ? `${k} ×${c}` : k))
        .join(', ');
    }
    return out;
  }
  /** A branched row is named for the vibration, not for one of its lines. */
  const rowName = (r: Row) => (r.members.length > 1 ? vibName(r.lead) : bandName(r.lead));
  const span = (r: Row) => ({
    lo: Math.min(...r.members.map(m => m.wn_min)),
    hi: Math.max(...r.members.map(m => m.wn_max)),
  });

  /**
   * On top of whatever the phenomenon groups by, the chart's own grouping.
   * A list of thirty entries reads as thirty entries until the families are
   * named: with them it reads as CO₂, then the carbonates, then methanol,
   * in the order the chart draws its rows, and the colour down the side of
   * each block is the colour those bands are drawn in.
   *
   * An example sits in whichever family most of its bands do. They almost
   * always agree, an isotopologue being in its parent's family, and where
   * they do not the majority is the honest answer.
   */
  const groupOf = (ex: Example): string => {
    const n = new Map<string, number>();
    for (const b of ex.bands) n.set(b.group, (n.get(b.group) ?? 0) + 1);
    let best = ex.bands[0]?.group ?? '';
    let bestN = 0;
    for (const [k, c] of n) if (c > bestN) { best = k; bestN = c; }
    return best;
  };

  interface Section { key: string; label: string; color: string; items: Example[] }
  $: sections = (() => {
    const by = new Map<string, Example[]>();
    for (const ex of examples) {
      const g = groupOf(ex);
      const list = by.get(g);
      if (list) list.push(ex);
      else by.set(g, [ex]);
    }
    return [...by.entries()]
      .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
      .map(([key, items]) => ({ key, label: groupLabel(key), color: groupColor(key), items }));
  })();
  /* One family is not a grouping: the heading would say the same thing over
     every entry, so a single-family list is left as the flat list it was. */
  $: grouped = sections.length > 1;

  /** A long list starts folded: the explanation is the point, not the tally. */
  const MANY = 3;
  let open = examples.length <= MANY;
  $: total = examples.reduce((n, ex) => n + ex.bands.length, 0);
  /** Which branched rows the reader has opened out. */
  let shown: Record<string, boolean> = {};
</script>

<section class="atlas">
  <button class="atlas-head" aria-expanded={open} on:click|stopPropagation={() => (open = !open)}>
    <span class="chev" class:open>▸</span>
    <span class="atlas-title">{title}</span>
    <span class="atlas-count">
      {examples.length} {examples.length === 1 ? 'example' : 'examples'} · {total} bands
    </span>
  </button>
  {#if open && field}
    <p class="field-note">Recorded as <code>{field}</code></p>
  {/if}
  {#if examples.length === 0}
    {#if open}<p class="empty">No band in the atlas currently shows this.</p>{/if}
  {:else if open}
    <!-- The families, in the chart's row order. Keyed by the bands, and by
         position after them: two examples can legitimately hold the same
         bands (one transition reached from two labelled lines), and a
         duplicate key does not drop a row, it throws and leaves the box open
         and empty. The index costs nothing here, since the list is rebuilt
         whole rather than reordered. -->
    {#each sections as sec (sec.key)}
    <div class="group" class:headed={grouped} style={sec.color ? `--group-color:${sec.color}` : ''}>
      {#if grouped}
        <h4 class="group-head">
          <span>{sec.label}</span>
          <span class="group-count">
            {sec.items.length} {sec.items.length === 1 ? 'entry' : 'entries'}
          </span>
        </h4>
      {/if}
    {#each sec.items as ex, i (sec.key + '#' + i + '#' + ex.bands.map(b => b.id).join('|'))}
      <article class="example">
        <header>
          <span class="ex-label">{ex.label}</span>
          <span class="ex-count">{ex.bands.length} band{ex.bands.length === 1 ? '' : 's'}</span>
        </header>
        {#if ex.note}<p class="ex-note">{ex.note}</p>{/if}

        <div class="band-rows">
          {#each rowsOf(ex.bands) as r (r.key)}
            <button
              class="band-row"
              on:click|stopPropagation={() =>
                r.members.length > 1
                  ? (shown[r.key] = !shown[r.key])
                  : dispatch('band', { id: r.lead.id })}
            >
              <span class="band-name">{rowName(r)}</span>
              {#each structureTags(r.lead) as tg (tg)}
                <span class="band-tag" class:own={isOwnTag(tg)}>{tg}</span>
              {/each}
              {#if r.members.length > 1}
                <span class="band-branches">{r.branches}</span>
              {/if}
              <!-- A row that stands for a whole branch family carries the
                   note of whichever member has one: the comparison is about
                   the transition, not about one of its branches.

                   A pill rather than the sentence: what most readers want
                   from this list is the band and where it sits. The pill
                   holds the estimate itself, so the column can be read down
                   against the positions beside it, and the size of the miss
                   is on hover. -->
              {#if rowNoteOf(ex, r)?.caveat}
                <!-- Named, not merely flagged: the word is the phenomenon,
                     so the reader who scans the column learns why the number
                     beside it is arithmetic rather than a prediction. Its
                     own colour rather than the caveat red, because nothing
                     here is wrong: the model just does not reach it. -->
                <span
                  class="est"
                  style="background:{caveatStyle(rowNoteOf(ex, r)?.caveatTone).background};border-color:{caveatStyle(rowNoteOf(ex, r)?.caveatTone).border};color:{caveatStyle(rowNoteOf(ex, r)?.caveatTone).color}"
                  title={rowNoteOf(ex, r)?.caveatDetail}
                >{rowNoteOf(ex, r)?.caveat}</span>
              {/if}
              {#if rowNoteOf(ex, r)?.pill}
                <span
                  class="est"
                  style="background:{ISOTOPE_STYLE.background};border-color:{ISOTOPE_STYLE.border};color:{ISOTOPE_STYLE.color}"
                  title={rowNoteOf(ex, r)?.detail}
                >{rowNoteOf(ex, r)?.pill}</span>
              {/if}
              <span class="band-wn">{span(r).lo}–{span(r).hi} cm⁻¹</span>
            </button>
            {#if r.members.length > 1 && shown[r.key]}
              {#each r.members as b (b.id)}
                <button class="band-row sub" on:click|stopPropagation={() => dispatch('band', { id: b.id })}>
                  <span class="band-name">{bandName(b)}</span>
                  {#each structureTags(b) as tg (tg)}
                    <span class="band-tag" class:own={isOwnTag(tg)}>{tg}</span>
                  {/each}
                  {#if ex.bandNotes?.[b.id]?.caveat}
                    <span
                      class="est"
                      style="background:{caveatStyle(ex.bandNotes[b.id].caveatTone).background};border-color:{caveatStyle(ex.bandNotes[b.id].caveatTone).border};color:{caveatStyle(ex.bandNotes[b.id].caveatTone).color}"
                      title={ex.bandNotes[b.id].caveatDetail}
                    >{ex.bandNotes[b.id].caveat}</span>
                  {/if}
                  {#if ex.bandNotes?.[b.id]?.pill}
                    <span
                      class="est"
                      style="background:{ISOTOPE_STYLE.background};border-color:{ISOTOPE_STYLE.border};color:{ISOTOPE_STYLE.color}"
                      title={ex.bandNotes[b.id].detail}
                    >{ex.bandNotes[b.id].pill}</span>
                  {/if}
                  <span class="band-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
                </button>
              {/each}
            {/if}
          {/each}
        </div>

        {#if refs}
          {@const keys = citekeysFor(ex.bands)}
          {#if keys.length}
            <div class="ex-refs">
              {#each keys as key (key)}
                <button
                  class="ref-chip"
                  title={htmlToUnicode(ieeeHtml(refs[key] ?? {}, key))}
                  on:click|stopPropagation={() => dispatch('ref', { key })}
                >{shortCite(refs[key] ?? {}, key, { journal: false })}</button>
              {/each}
            </div>
          {/if}
        {/if}
      </article>
    {/each}
    </div>
    {/each}
  {/if}
</section>

<style>
  /* The box: set apart from the prose above it, in the Knowledge green. */
  .atlas {
    margin: 18px 0 0;
    padding: 12px 14px 4px;
    background: var(--surface-slate);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
  }

  /* The heading is the control: the whole box folds away behind it. So it
     has to be hittable. The line of type is 15px tall, and a click a few
     pixels off it lands on the card, where nothing happens: the box reads as
     refusing to open rather than as having been missed. The padding takes it
     past the 24px minimum (WCAG 2.2 SC 2.5.8) without moving the type, and
     the hover underline says where the target is. */
  .atlas-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 0;
    border: none;
    background: none;
    font-family: inherit;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--accent-green-fg);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 0 0 8px;
    cursor: pointer;
    text-align: left;
  }
  .atlas-head:hover .atlas-title,
  .atlas-head:focus-visible .atlas-title { text-decoration: underline; }
  .chev { transition: transform 0.18s ease; display: inline-block; }
  .chev.open { transform: rotate(90deg); }
  .atlas-count {
    margin-left: auto;
    color: var(--ink-050);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
  /* The lines of one branched transition, once the row is opened out. */
  .band-row.sub {
    padding-left: 26px;
    color: var(--ink-050);
  }
  .band-branches {
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    color: var(--ink-050);
  }

  .empty { color: var(--ink-300); font-size: var(--t-code-size); margin: 0 0 10px; }

  /* What records this phenomenon: a note about the data, so it sits with the
     evidence rather than above it, and folds away with the rest. */
  .field-note { font-size: var(--t-code-size); color: var(--ink-200); margin: 0 0 10px; }
  code {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  /* ── One family of bands, in the chart's row order ── */
  .group.headed { margin-bottom: 14px; }
  .group-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    /* The family named in the colour it is drawn in: the heading is the one
       place in the list where the colour is the subject rather than a mark
       down the edge. */
    color: var(--group-color, var(--ink-slate-900));
  }
  .group-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-050);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  /* ── One occurrence ── */
  .example {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    /* The band's own colour, so a block is found in a list the way it is
       found on the chart. Green where the dataset gives the group none. */
    border-left: 3px solid var(--group-color, var(--accent-green-fg));
    border-radius: var(--radius);
    padding: 10px var(--space-4);
    margin-bottom: 10px;
  }

  .example header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }

  .ex-label {
    font-weight: var(--t-label-weight);
    color: var(--ink-slate-900);
    font-size: var(--t-nav-size);
  }

  .ex-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  .ex-note { margin: 0 0 6px; color: var(--ink-400); font-size: var(--t-nav-size); line-height: 1.45; }

  .band-rows { display: flex; flex-direction: column; gap: 2px; }

  .band-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 3px 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-nav-size);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .band-row:hover { background: var(--surface-hover); }

  .band-name { color: var(--ink-700); }

  /* Which rows are the first step, so a fundamental reads as one beside the
     overtones and combinations built on it. Derived, never authored. */
  .band-tag {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    color: var(--ink-200);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    padding: 0 5px;
    white-space: nowrap;
  }
  /* The one this card is about, in the Knowledge green. */
  .band-tag.own {
    color: var(--accent-green-fg);
    border-color: var(--accent-green-fg);
  }

  /* "There is a number behind this": the harmonic estimate against the
     recorded position, on hover. A pill in the isotope colours, because that
     is the only list that has one and the colour says which. */
  .est {
    margin-left: auto;
    padding: 0 5px;
    border: 1px solid;
    border-radius: var(--radius-sm);
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    cursor: help;
    white-space: nowrap;
  }

  /* The position, in the same blue the tooltip's wavenumber badge uses, and
     always the last thing on the row: every list is read down this column. */
  .band-wn {
    margin-left: auto;
    padding: 1px 6px;
    background: var(--badge-wn-bg);
    border: 1px solid var(--badge-wn-border);
    border-radius: var(--radius-sm);
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--badge-wn-fg);
    white-space: nowrap;
  }
  /* Two things cannot both claim the leftover space: with a pill present it
     takes the gap and the range follows it. */
  .est + .band-wn { margin-left: 6px; }

  .ex-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid var(--line-faint);
  }

  .ref-chip {
    font: inherit;
    font-size: var(--t-code-size);
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ref-border);
    background: var(--ref-surface);
    color: var(--ref-meta);
    cursor: pointer;
  }
  .ref-chip:hover { background: var(--ref-surface-hover); color: var(--ref-accent-deep); }
</style>

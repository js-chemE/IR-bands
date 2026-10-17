<script lang="ts">
  /**
   * Which claims count, as three sidebar sections: Techniques, Phases and
   * Elements. One component for the band chart and the References page, so
   * the two filters look and behave the same; each page keeps its own filter
   * state and binds it here.
   *
   * Every row behaves alike. A click switches it (held back 280 ms so a
   * double-click can cancel it, as the tag legend does), a double-click counts
   * only that row, and a second double-click counts everything again. A group
   * row (IR, Raman, a Form or Medium part, an element category) has its own
   * caret to open it; the rest of the row is the switch for the whole group.
   * No checkboxes: a row is on when it reads normally and off when its label
   * is struck through.
   */
  import SectionHead from './SectionHead.svelte';
  import { allElements, allSurfaces, surfaceLabel } from '../lib/labels';
  import PeriodicPicker from './PeriodicPicker.svelte';
  import {
    TECHNIQUE_FAMILIES, TECHNIQUE_LABEL, TECHNIQUE_TIP, TECHNIQUE_PARENT, ALL_TECHNIQUES,
    PHASE_PARTS, PHASE_ROW_COUNT, ELEMENT_SCOPES, UNRECORDED,
    techniqueWithRefinements, countOn, toggleTechniques, onlyTechniques,
    phaseExcluded, togglePhase, onlyPhase, elementOn, toggleElements, onlyElements,
    materialOn, toggleMaterials, onlyMaterials,
    type ClaimFilter, type FilterCounts, type ElementScope,
  } from '../lib/claimFilter';

  export let filter: ClaimFilter;
  /** How many of everything carry each value, with no selection: the total. */
  export let counts: FilterCounts;
  /** The same count over what is shown now, counted claims only: the first number. */
  export let shown: FilterCounts | null = null;
  /** Every element symbol any claim names, in either scope. */
  export let elements: string[] = [];
  /** What a count counts, for the row titles: "bands" or "claims". */
  export let unit = 'bands';
  export let showTechniques = false;
  export let showPhases = false;
  export let showElements = false;
  export let openGroups: ReadonlySet<string> = new Set();

  function toggleOpen(key: string) {
    const next = new Set(openGroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    openGroups = next;
  }

  let pending: ReturnType<typeof setTimeout> | null = null;
  function click(fn: () => ClaimFilter) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => { pending = null; filter = fn(); }, 280);
  }
  function dbl(fn: () => ClaimFilter) {
    if (pending) { clearTimeout(pending); pending = null; }
    filter = fn();
  }

  /* "shown / total": the first number follows the whole selection (the
     other sections, hidden items, the range), the second is what exists.
     Reactive on purpose: the template calls these with only the key as an
     argument, so a plain function would never re-run when `shown` changes. */
  $: sh = (rec: keyof FilterCounts, key: string) => (shown ? (shown[rec][key] ?? 0) : null);
  $: tot = (rec: keyof FilterCounts, key: string) => counts[rec][key] ?? 0;
  /** The hover on a count, in words: what the two numbers are. */
  $: countTip = (rec: keyof FilterCounts, key: string, what: string): string => {
    const t = tot(rec, key);
    if (!shown) return `${t} ${unit} with ${what}`;
    return `${sh(rec, key)} of the ${unit} shown now have a counted claim ${what}; ${t} ${unit} have one at all.`;
  };

  /* ── Techniques ── */
  $: countedTechniques = countOn(ALL_TECHNIQUES, filter.techniques);
  /** A family's rows: the techniques that refine nothing, each with its refinements under it. */
  const topLevel = (members: readonly string[]) => members.filter(t => !TECHNIQUE_PARENT[t]);

  /* ── Surfaces: elements (the periodic table) and materials (the records) ── */
  let surfaceTab: 'elements' | 'materials' = 'elements';
  $: presentEls = new Set(elements);
  $: elementsOnCount = elements.filter(el => elementOn(filter, el)).length;
  $: elementSummary = filter.onlyElements.size
    ? `only ${[...filter.onlyElements].filter(e => e !== UNRECORDED).slice(0, 3).join(', ')}${filter.onlyElements.size > 3 ? '…' : ''}`
    : `${elementsOnCount} / ${elements.length}`;
  $: materialSummary = filter.onlySurfaces.size
    ? `only ${[...filter.onlySurfaces].slice(0, 2).map(surfaceLabel).join(', ')}${filter.onlySurfaces.size > 2 ? '…' : ''}`
    : filter.surfaces.size ? `${filter.surfaces.size} off` : '';
  $: surfacesSummary = [elementSummary, materialSummary].filter(Boolean).join(' · ');
  function setScope(scope: ElementScope) {
    filter = { ...filter, elementScope: scope };
  }
  $: noneLabel = filter.elementScope === 'site' ? 'No site named' : 'No surface named';
  function resetSurfaces() {
    filter = { ...filter, elements: new Set(), onlyElements: new Set(), surfaces: new Set(), onlySurfaces: new Set() };
  }

  /* The materials a claim can reach, each block as a tree: a refinement sits
     under the record it refines, so γ-Al₂O₃ reads as a kind of Al₂O₃. Only
     records some claim reaches are listed; the search narrows by name. The
     materials split by what they are made of, composites (catalysts,
     electrodes) above single compounds, so the scale still runs downwards. */
  let materialQuery = '';
  const LEVELS = [['composite', 'Composites'], ['compound', 'Compounds'], ['site', 'Sites']] as const;
  const blockOf = (r: { level: string; compound?: boolean }) =>
    r.level === 'site' ? 'site' : r.compound ? 'compound' : 'composite';
  $: materialRows = (() => {
    const table = allSurfaces();
    const q = materialQuery.trim().toLowerCase();
    const out: { level: string; key: string; label: string; depth: number; n: number }[] = [];
    for (const [level] of LEVELS) {
      const recs = Object.values(table).filter(r => blockOf(r) === level && (counts.material[r.key] ?? 0) > 0);
      const root = (r: typeof recs[number]) => (r.lineage?.length ? r.lineage[r.lineage.length - 1] : r.key);
      recs.sort((x, y) => surfaceLabel(root(x)).localeCompare(surfaceLabel(root(y)))
        || (x.lineage?.length ?? 0) - (y.lineage?.length ?? 0) || x.label.localeCompare(y.label));
      for (const r of recs) {
        if (q && !r.label.toLowerCase().includes(q) && !r.key.includes(q)) continue;
        out.push({ level, key: r.key, label: r.label, depth: r.lineage?.length ?? 0, n: counts.material[r.key] ?? 0 });
      }
    }
    return out;
  })();
</script>

<section>
  <!-- The header is the disclosure, with how much is counted beside it;
       opening it goes straight to the families, and each family opens on
       its own. -->
  <SectionHead title="Techniques" bind:open={showTechniques} summary={`${countedTechniques} / ${ALL_TECHNIQUES.length}`}
    hint="How each claim’s spectrum was measured: DRIFTS, transmission, ATR, Raman, a calculation. Switch a technique off and the claims measured with it stop counting. Numbers: {unit} shown / all {unit} with one." />
  {#if showTechniques}
    <div class="filter-list">
      {#each TECHNIQUE_FAMILIES as fam (fam.key)}
        {@const on = countOn(fam.members, filter.techniques)}
        <div class="fam-row">
          <button class="fam-caret" aria-label="Show the {fam.label} techniques" aria-expanded={openGroups.has(fam.key)}
            on:click={() => toggleOpen(fam.key)}>{openGroups.has(fam.key) ? '▾' : '▸'}</button>
          <button
            class="include-row tech-row"
            class:off={on === 0}
            aria-pressed={on > 0}
            title={fam.title}
            on:click={() => click(() => toggleTechniques(filter, fam.members))}
            on:dblclick={() => dbl(() => onlyTechniques(filter, fam.members))}
          >
            <span class="inc-label">{fam.label}</span>
            <span class="count" title="{countTip('family', fam.key, `measured by ${fam.label}`)} {on} of {fam.members.length} techniques in this family are switched on.">{#if shown}<b>{sh('family', fam.key)}</b> / {/if}{tot('family', fam.key)}</span>
          </button>
        </div>
        {#if openGroups.has(fam.key)}
          <div class="tech-filter">
            {#each topLevel(fam.members) as t (t)}
              {@const group = techniqueWithRefinements(t)}
              <!-- A technique with refinements switches them with it: ATR
                   takes ATR-SEIRAS along, which can still be picked alone. -->
              <button
                class="include-row tech-row"
                class:off={countOn(group, filter.techniques) === 0}
                aria-pressed={countOn(group, filter.techniques) > 0}
                title={TECHNIQUE_TIP[t] ?? TECHNIQUE_LABEL[t]}
                on:click={() => click(() => toggleTechniques(filter, group))}
                on:dblclick={() => dbl(() => onlyTechniques(filter, group))}
              ><span class="inc-label">{TECHNIQUE_LABEL[t]}</span>
                <span class="count" title="{countTip('technique', t, `measured by ${TECHNIQUE_LABEL[t]}`)}{group.length > 1 ? ' Refinements included.' : ''}">{#if shown}<b>{sh('technique', t)}</b> / {/if}{tot('technique', t)}</span>
              </button>
              {#each group.slice(1) as c (c)}
                <button
                  class="include-row tech-row refinement"
                  class:off={filter.techniques.has(c)}
                  aria-pressed={!filter.techniques.has(c)}
                  title={TECHNIQUE_TIP[c] ?? TECHNIQUE_LABEL[c]}
                  on:click={() => click(() => toggleTechniques(filter, [c]))}
                  on:dblclick={() => dbl(() => onlyTechniques(filter, [c]))}
                ><span class="inc-label">{TECHNIQUE_LABEL[c]}</span>
                  <span class="count" title={countTip('technique', c, `measured by ${TECHNIQUE_LABEL[c]}`)}>{#if shown}<b>{sh('technique', c)}</b> / {/if}{tot('technique', c)}</span>
                </button>
              {/each}
            {/each}
          </div>
        {/if}
      {/each}
      <div class="fam-row">
        <span class="fam-caret" aria-hidden="true"></span>
        <button
          class="include-row tech-row"
          class:off={filter.techniques.has('computational')}
          aria-pressed={!filter.techniques.has('computational')}
          title={TECHNIQUE_TIP.computational}
          on:click={() => click(() => toggleTechniques(filter, ['computational']))}
          on:dblclick={() => dbl(() => onlyTechniques(filter, ['computational']))}
        ><span class="inc-label">{TECHNIQUE_LABEL.computational}</span>
          <span class="count" title={countTip('technique', 'computational', 'from a calculation')}>{#if shown}<b>{sh('technique', 'computational')}</b> / {/if}{tot('technique', 'computational')}</span>
        </button>
      </div>
    </div>
  {/if}
</section>

<hr class="divider" />

<section>
  <!-- How the sample was held for each claim, as two lists that combine.
       Form is where the species was, medium what surrounded it. -->
  <SectionHead title="Species State" bind:open={showPhases}
    hint="About the molecule that vibrates, not the solid: where it sat in each claim’s experiment (free, dissolved, adsorbed, a surface group, the lattice) and what surrounded it (vacuum, gas, liquid, supercritical, matrix). Switch one off and those claims stop counting."
    summary={`${PHASE_PARTS.reduce((n, p) => n + countOn(p.rows.map(r => r.key), phaseExcluded(filter, p.key)), 0)} / ${PHASE_ROW_COUNT}`} />
  {#if showPhases}
    <div class="filter-list">
      {#each PHASE_PARTS as part (part.key)}
        {@const excluded = phaseExcluded(filter, part.key)}
        <!-- Form and Medium combine rather than nest, so the part row only
             opens and closes; it is not a switch. -->
        <div class="fam-row">
          <button class="fam-caret" aria-label="Show the {part.label.toLowerCase()} rows" aria-expanded={openGroups.has(part.key)}
            on:click={() => toggleOpen(part.key)}>{openGroups.has(part.key) ? '▾' : '▸'}</button>
          <button class="include-row tech-row part-row" aria-expanded={openGroups.has(part.key)}
            on:click={() => toggleOpen(part.key)}>
            <span class="inc-label">{part.label}</span>
            <span class="count" title="{countOn(part.rows.map(r => r.key), excluded)} of the {part.rows.length} {part.label.toLowerCase()} values are switched on">{countOn(part.rows.map(r => r.key), excluded)} / {part.rows.length}</span>
          </button>
        </div>
        {#if openGroups.has(part.key)}
          <div class="tech-filter">
            {#each part.rows as ph (ph.key)}
              <button
                class="include-row tech-row"
                class:off={excluded.has(ph.key)}
                aria-pressed={!excluded.has(ph.key)}
                title={ph.title}
                on:click={() => click(() => togglePhase(filter, part.key, ph.key))}
                on:dblclick={() => dbl(() => onlyPhase(filter, part.key, [ph.key]))}
              ><span class="inc-label">{ph.label}</span>
                <span class="count" title={countTip(part.key, ph.key, `with the ${part.label.toLowerCase()} “${ph.label.toLowerCase()}”`)}>{#if shown}<b>{sh(part.key, ph.key)}</b> / {/if}{tot(part.key, ph.key)}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<hr class="divider" />

<section>
  <!-- What the surfaces a claim names contain. Read off the site (where the
       molecule could be bonded) or off the whole specimen; the diluent counts
       in neither. A claim names several elements, so a click drops every
       claim containing that element, and a double-click keeps only the
       claims that contain it. -->
  <SectionHead title="Specimen" bind:open={showElements} summary={surfacesSummary}
    hint="About the solid the claim was measured on, not the molecule: pick elements on the periodic table, or a material such as one oxide or support. Claims on a specimen that is switched off stop counting; a free molecule has no specimen." />
  {#if showElements}
    <div class="scope" role="group" aria-label="Pick by">
      <button class="scope-btn" class:active={surfaceTab === 'elements'} on:click={() => (surfaceTab = 'elements')}
        title="Pick by element, on the periodic table">Elements</button>
      <button class="scope-btn" class:active={surfaceTab === 'materials'} on:click={() => (surfaceTab = 'materials')}
        title="Pick a specimen, a component or a site, such as one oxide">Materials</button>
    </div>
    {#if surfaceTab === 'elements'}
      <div class="scope scope-sub" role="group" aria-label="Read the elements off">
        {#each ELEMENT_SCOPES as sc (sc.key)}
          <button class="scope-btn" class:active={filter.elementScope === sc.key} aria-pressed={filter.elementScope === sc.key}
            title={sc.title} on:click={() => setScope(sc.key)}>{sc.label}</button>
        {/each}
      </div>
      <PeriodicPicker
        elements={allElements()}
        present={presentEls}
        isOn={el => elementOn(filter, el)}
        isPinned={el => filter.onlyElements.has(el)}
        on:toggle={e => (filter = toggleElements(filter, e.detail.els))}
        on:only={e => (filter = onlyElements(filter, e.detail.els))}
      />
      <div class="filter-list after-pse">
        <button
          class="include-row tech-row"
          class:off={!elementOn(filter, UNRECORDED)}
          aria-pressed={elementOn(filter, UNRECORDED)}
          title="Claims that name no {filter.elementScope === 'site' ? 'site or component' : 'surface'}, such as a free gas"
          on:click={() => click(() => toggleElements(filter, [UNRECORDED]))}
          on:dblclick={() => dbl(() => onlyElements(filter, [UNRECORDED]))}
        ><span class="inc-label">{noneLabel}</span>
          <span class="count" title={countTip('element', UNRECORDED, 'that names no surface')}>{#if shown}<b>{sh('element', UNRECORDED)}</b> / {/if}{tot('element', UNRECORDED)}</span>
        </button>
      </div>
    {:else}
      <input class="mat-search" type="search" placeholder="Search, e.g. Al₂O₃ or Cu" bind:value={materialQuery}
        aria-label="Search the materials" />
      <div class="filter-list mat-list">
        {#each LEVELS as [level, title] (level)}
          {@const rows = materialRows.filter(r => r.level === level)}
          {#if rows.length}
            <div class="mat-head">{title}</div>
            {#each rows as r (r.key)}
              <button
                class="include-row tech-row"
                class:off={!materialOn(filter, r.key)}
                class:only={filter.onlySurfaces.has(r.key)}
                aria-pressed={materialOn(filter, r.key)}
                style="padding-left: {4 + r.depth * 12}px"
                title="{r.label}: click to switch, double-click for only this. A record includes what refines it."
                on:click={() => click(() => toggleMaterials(filter, [r.key]))}
                on:dblclick={() => dbl(() => onlyMaterials(filter, [r.key]))}
              ><span class="inc-label">{#if r.depth}<span class="tree" aria-hidden="true">└</span>{/if}{r.label}</span>
                <span class="count" title={countTip('material', r.key, `that reaches ${r.label}`)}>{#if shown}<b>{sh('material', r.key)}</b> / {/if}{r.n}</span>
              </button>
            {/each}
          {/if}
        {/each}
      </div>
    {/if}
    {#if filter.elements.size || filter.onlyElements.size || filter.surfaces.size || filter.onlySurfaces.size}
      <button class="reset" on:click={resetSurfaces}>Reset surfaces</button>
    {/if}
  {/if}
</section>

<style>
  .divider {
    border: none;
    border-top: 1px solid var(--line-soft);
    margin: 12px 0;
  }
  .filter-list { display: flex; flex-direction: column; }
  .include-row {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 2px 4px;
    background: none;
    border: none;
    border-radius: var(--radius);
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    text-align: left;
    cursor: pointer;
    user-select: none;
  }
  .include-row:hover { background: var(--surface-hover); }
  /* Only the label is struck, never the count beside it. */
  .include-row.off .inc-label {
    color: var(--ink-025);
    text-decoration: line-through;
  }
  .fam-row { display: flex; align-items: center; }
  .fam-caret {
    flex: 0 0 14px;
    width: 14px;
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    font-size: 11px;
    color: var(--ink-200);
    cursor: pointer;
    text-align: left;
  }
  .fam-caret:hover { color: var(--ink-700); }
  .fam-row .include-row { flex: 1; min-width: 0; }
  .part-row .inc-label { color: var(--ink-500); }
  .tech-filter {
    margin: 2px 0 2px 7px;
    padding-left: 9px;
    border-left: 1px solid var(--line);
  }
  .tech-row { padding: 1px 4px; }
  /* A refinement (ATR-SEIRAS under ATR) sits one step further in. */
  .refinement { padding-left: 16px; }
  .count {
    margin-left: auto;
    padding-left: 6px;
    font-family: var(--font-mono);
    color: var(--ink-200);
    white-space: nowrap;
  }
  .inc-label { min-width: 0; }
  .scope {
    display: flex;
    gap: 2px;
    margin: 0 0 6px;
    padding: 2px;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
  }
  .scope-btn {
    flex: 1;
    padding: 2px 6px;
    background: none;
    border: none;
    border-radius: var(--radius);
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--ink-500);
    cursor: pointer;
    min-height: 24px;
  }
  .scope-btn:hover { background: var(--surface-hover); }
  .scope-btn.active {
    background: var(--surface-hover);
    color: var(--ink-900);
  }
  .scope-sub { margin-top: -2px; }
  .after-pse { margin-top: 6px; }
  .mat-search {
    width: 100%;
    margin: 0 0 6px;
    padding: 3px 6px;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    font: inherit;
    font-size: var(--t-nav-size);
  }
  .mat-list { max-height: 320px; overflow-y: auto; }
  .mat-head {
    margin: 6px 0 2px;
    font-size: var(--t-micro-label-size);
    color: var(--ink-200);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .tree { margin-right: 4px; color: var(--ink-025); font-family: var(--font-mono); }
  .include-row.only .inc-label { font-weight: var(--t-label-weight); }
  .reset {
    margin-top: 6px;
    padding: 2px 6px;
    background: none;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    font: inherit;
    font-size: var(--t-code-size);
    color: var(--ink-500);
    cursor: pointer;
  }
  .reset:hover { background: var(--surface-hover); }
  .count b { font-weight: var(--t-label-weight); color: var(--ink-500); }
</style>

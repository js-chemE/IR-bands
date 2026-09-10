<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dataset, ColorDim, AxisProperty, RefMap, Vibrations } from './lib/types';
  import { AXES } from './lib/units';
  import { getLegendCategories, getLegendTags } from './lib/chart';
  import { installLookups } from './lib/labels';
  import { GROUP_DIMS, type GroupDim } from './lib/refGrouping';
  import BandChart from './components/BandChart.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ColorLegend from './components/ColorLegend.svelte';
  import TagLegend from './components/TagLegend.svelte';
  import AxisSelect from './components/AxisSelect.svelte';
  import ReferencesPage from './components/ReferencesPage.svelte';
  import HomePage from './components/HomePage.svelte';
  import ImpressumPage from './components/ImpressumPage.svelte';
  import StyleGuidePage, { SECTIONS as SG_SECTIONS } from './components/StyleGuidePage.svelte';
  import SourceGuidePage, { SECTIONS as SRC_SECTIONS } from './components/SourceGuidePage.svelte';
  import DataModelPage, { sectionsFor, type DmView } from './components/DataModelPage.svelte';
  import KnowledgePage, { SECTIONS as KN_SECTIONS } from './components/KnowledgePage.svelte';
  import MobileNotice from './components/MobileNotice.svelte';

  let dataset: Dataset | null = null;
  let refs: RefMap = null;
  let vibrations: Vibrations = { molecules: [] };
  let tagTips: Record<string, { tip: string }> = {};
  let loading = true;
  let error: string | null = null;
  // Four destinations plus the meta pages. There is no 'vibration' page any
  // more: a molecule's modes are part of what the dataset holds, so that view
  // lives inside the Dataset page's Contents half, and the band chart's
  // tooltip jumps there instead.
  // 'styleguide' and 'sourceguide' have no nav entry of their own; both are
  // reached from the Impressum, where the project's own documentation lives.
  type Page = 'home' | 'knowledge' | 'chart' | 'references' | 'datamodel'
            | 'impressum' | 'styleguide' | 'sourceguide';
  let page: Page = 'home';
  // References page: the two grouping dimensions, outer then inner. Every
  // pair is legal except the same dimension twice, which the guard below
  // resolves by moving the inner one along.
  let refGroupBy: GroupDim = 'reference';
  // What lists its citations on the References page: bands, modes, Knowledge.
  let refIncludeBands = true;
  let refIncludeModes = false;
  let refIncludeKnowledge = true;
  // A Knowledge card to open when arriving from a References-page link.
  let knOpen: string | null = null;
  $: if (page !== 'knowledge') knOpen = null;
  let refThenBy: GroupDim = 'group';
  $: if (refThenBy === refGroupBy) {
    refThenBy = GROUP_DIMS.find(d => d.key !== refGroupBy)!.key;
  }
  // Style guide table of contents: which section the reader is currently in,
  // reported by the page's own scroll spy.
  let sgActive = SG_SECTIONS[0].id;
  let srcActive = SRC_SECTIONS[0].id;
  // Same contract for the two long-form pages that own a table of contents.
  let dmView: DmView = 'structure';
  let dmActive = sectionsFor('structure')[0].id;
  let knActive = KN_SECTIONS[0].id;
  $: dmSections = sectionsFor(dmView);

  // Shared by the long-form pages that own a sidebar table of contents.
  function scrollToSection(id: string, which: 'sg' | 'dm' | 'kn' | 'src' = 'sg') {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (which === 'dm') dmActive = id;
    else if (which === 'kn') knActive = id;
    else if (which === 'src') srcActive = id;
    else sgActive = id;
  }

  function handleDmViewChange(e: Event) {
    setDmView((e.currentTarget as HTMLSelectElement).value as DmView);
  }

  function setDmView(next: DmView) {
    dmView = next;
    dmActive = sectionsFor(next)[0].id;
    mainArea?.scrollTo({ top: 0 });
  }
  // Every page shares one scroll container, so opening a long page from
  // halfway down another one would start halfway down it. Reset on switch.
  let mainArea: HTMLElement | null = null;
  $: if (page) mainArea?.scrollTo({ top: 0 });

  let sidebarOpen = true;
  let showColorMenu = false;
  let colorMenuTimer: ReturnType<typeof setTimeout> | null = null;

  function openColorMenu()  {
    if (colorMenuTimer) { clearTimeout(colorMenuTimer); colorMenuTimer = null; }
    showColorMenu = true;
  }
  function closeColorMenu() {
    colorMenuTimer = setTimeout(() => { showColorMenu = false; }, 180);
  }

  // Which set the chart opens on. A set is authored in bands.jsonc; this
  // names the one that answers the question the atlas is about.
  const DEFAULT_SET = 'co2_hydrogenation';

  let enabledGroups: ReadonlySet<string> = new Set();
  let colorDim: ColorDim = 'group';
  let hiddenCats: ReadonlySet<string> = new Set();
  let hiddenTags: ReadonlySet<string> = new Set();
  let tagIsolate: string | null = null;
  let legendHoveredCat: string | null = null;
  let legendHoveredTag: string | null = null;
  let axisProperty: AxisProperty = 'wavenumber';
  let axisUnit = AXES.wavenumber.defaultUnit;

  onMount(async () => {
    try {
      const [bRes, rRes, vRes, tRes] = await Promise.all([
        fetch('data/bands.json'),
        fetch('data/references.json'),
        fetch('data/vibrations.json'),
        fetch('data/tags.json'),
      ]);
      if (!bRes.ok) throw new Error(`bands.json: ${bRes.status}`);
      if (!rRes.ok) throw new Error(`references.json: ${rRes.status}`);
      dataset = (await bRes.json()) as Dataset;
      // Species and surface keys resolve to labels through this; install it
      // before any component renders one.
      installLookups(dataset);
      refs = (await rRes.json()) as RefMap;
      // Vibrations/tag-tooltip content is supplementary — don't fail the
      // whole app if either is missing (e.g. build.py predates the feature).
      vibrations = vRes.ok ? ((await vRes.json()) as Vibrations) : { molecules: [] };
      tagTips = tRes.ok ? ((await tRes.json()) as Record<string, { tip: string }>) : {};
      const startSet = dataset.sets?.[DEFAULT_SET];
      enabledGroups = new Set(startSet ? startSet.groups : Object.keys(dataset.groups));
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });

  function handleGroupToggle(e: CustomEvent<{ key: string; enabled: boolean }>) {
    const next = new Set(enabledGroups);
    if (e.detail.enabled) next.add(e.detail.key); else next.delete(e.detail.key);
    enabledGroups = next;
  }

  function handleSetSelect(e: CustomEvent<{ key: string }>) {
    if (!dataset) return;
    // "custom" is only ever shown, never chosen: it means the selection
    // matches no set, so picking it should leave things alone.
    if (e.detail.key === 'custom') return;
    const chosen = dataset.sets?.[e.detail.key];
    enabledGroups = new Set(chosen ? chosen.groups : Object.keys(dataset.groups));
  }

  function setColorDim(dim: ColorDim) {
    colorDim = dim;
    hiddenCats = new Set();
  }

  function handleColorDimChange(e: Event) {
    setColorDim((e.currentTarget as HTMLSelectElement).value as ColorDim);
  }

  function handleCatToggle(e: CustomEvent<{ cat: string; visible: boolean }>) {
    const next = new Set(hiddenCats);
    if (!e.detail.visible) next.add(e.detail.cat); else next.delete(e.detail.cat);
    hiddenCats = next;
  }

  function handleCatDblClick(e: CustomEvent<{ cat: string }>) {
    // Checked directly against current hiddenCats rather than trusting a
    // "was it visible" flag carried on the event — same fix as the tag
    // legend's debounce, just inspecting live state instead since
    // categories are single-valued and don't need a separate isolate var.
    const allKeys = legendCats.map(c => c.key);
    const isolatedToThis = hiddenCats.size === allKeys.length - 1 && !hiddenCats.has(e.detail.cat);
    hiddenCats = isolatedToThis ? new Set() : new Set(allKeys.filter(k => k !== e.detail.cat));
  }

  function handleCatHover(e: CustomEvent<{ cat: string | null }>) {
    legendHoveredCat = e.detail.cat;
  }

  function handleTagToggle(e: CustomEvent<{ tag: string; visible: boolean }>) {
    // A single click always exits isolate mode first and applies the
    // toggle from a clean (all-visible) slate, rather than against
    // whatever hiddenTags isolate left behind — guarantees the individual
    // toggle is never left stuck in an inconsistent state.
    if (tagIsolate) {
      tagIsolate = null;
      hiddenTags = new Set([e.detail.tag]);
      return;
    }
    const next = new Set(hiddenTags);
    if (!e.detail.visible) next.add(e.detail.tag); else next.delete(e.detail.tag);
    hiddenTags = next;
  }

  // Isolate: show ONLY bands carrying this one tag. Unlike the category
  // legend (handleCatDblClick), a band can carry several tags at once, so
  // "hide every tag except this one" doesn't work here — combined with the
  // hide-if-ANY-hidden-tag rule the chart otherwise uses, that would also
  // hide this tag's own bands whenever they carry a second tag too (often
  // all of them). tagIsolate is a separate filter the chart applies
  // instead of hiddenTags entirely while it's set — see chart.ts.
  function handleTagDblClick(e: CustomEvent<{ tag: string }>) {
    tagIsolate = tagIsolate === e.detail.tag ? null : e.detail.tag;
    hiddenTags = new Set();
  }

  function handleTagHover(e: CustomEvent<{ tag: string | null }>) {
    legendHoveredTag = e.detail.tag;
  }

  function handleAxisChange(e: CustomEvent<{ property: AxisProperty; unit: string }>) {
    axisProperty = e.detail.property;
    axisUnit = e.detail.unit;
  }

  function handleHomeNavigate(e: CustomEvent<{ page: string }>) {
    page = e.detail.page as Page;
  }

  function handleNavigateKnowledge(e: CustomEvent<{ key: string }>) {
    knOpen = e.detail.key;
    page = 'knowledge';
  }

  function handleNavigateRef(e: CustomEvent<{ key: string }>) {
    const key = e.detail.key;
    // A paper no band cites (a textbook the Knowledge page draws on) only has
    // a card of its own while Knowledge citations are shown.
    if (!dataset?.bands.some(b => b.references.some(r => r.key === key))) refIncludeKnowledge = true;
    // The jump target only exists while a reference is one of the dimensions.
    if (refGroupBy !== 'reference' && refThenBy !== 'reference') refGroupBy = 'reference';
    page = 'references';
    // Wait for the page to mount before scrolling
    setTimeout(() => {
      const el = document.getElementById(`refcard-${key}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.style.transition = 'box-shadow 0.25s ease-out, background-color 0.25s ease-out';
      el.style.boxShadow = '0 0 0 3px var(--ref-focus-ring)';
      el.style.backgroundColor = 'var(--ref-highlight)';
      setTimeout(() => {
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
        setTimeout(() => { el.style.transition = ''; }, 300);
      }, 1600);
    }, 80);
  }

  let focusBand: { id: string; nonce: number } | null = null;
  let focusNonce = 0;

  function handleNavigateBand(e: CustomEvent<{ id: string }>) {
    if (!dataset) return;
    const band = dataset.bands.find(b => b.id === e.detail.id);
    if (!band) return;
    setColorDim('vibration');
    // Make sure the band's own group is actually enabled — otherwise it
    // would be selected but invisible if the user had toggled that group
    // off via the sidebar at some point.
    enabledGroups = new Set(enabledGroups).add(band.group);
    page = 'chart';
    focusNonce += 1;
    focusBand = { id: band.id, nonce: focusNonce };
  }

  // Reverse direction: clicking a linked vibration's atoms tag in the band
  // chart's own tooltip jumps to the Vibration modes page with that exact
  // molecule/topology/mode selected and its detail panel already open.
  let focusMode: { moleculeId: string; topologyId: string; modeId: string; nonce: number } | null = null;
  let focusModeNonce = 0;

  function handleNavigateMode(e: CustomEvent<{ moleculeId: string; topologyId: string; modeId: string }>) {
    // The modes live in the Dataset page's Contents half now.
    page = 'datamodel';
    dmView = 'contents';
    dmActive = 'modes';
    focusModeNonce += 1;
    focusMode = { ...e.detail, nonce: focusModeNonce };
  }

  const COLOR_DIM_OPTIONS: { dim: ColorDim; label: string }[] = [
    { dim: 'group',      label: 'Group' },
    { dim: 'vibration',  label: 'Vibration' },
    { dim: 'atoms',      label: 'Atoms' },
    { dim: 'references', label: 'References' },
  ];

  $: legendCats = dataset
    ? getLegendCategories(chartBands, dataset.groups, enabledGroups, colorDim)
    : [];

  // Isotopologue bands are in or out of the chart entirely, rather than
  // hidden where they stand: with them out, the lanes and the sub-lane
  // stagger are recomputed without them. That is the difference from the
  // legend's own isotope chip, which only hides the bars.
  //
  // Off by default. A labelled twin is a control experiment rather than a
  // band anyone is trying to identify, and switching them all on doubles the
  // crowding in whichever region a deuteration study covered.
  let showIsotopes = false;

  $: chartBands = dataset
    ? (showIsotopes ? dataset.bands : dataset.bands.filter(b => !b.isotopologue_of))
    : [];

  // Passed the live filters so a tag whose bands are all hidden by another
  // filter greys out too, rather than looking available when it is not.
  $: legendTags = dataset
    ? getLegendTags(chartBands, enabledGroups, { hiddenCats, colorDim, hiddenTags, tagIsolate })
    : [];

  $: sortedGroupKeys = (() => {
    if (!dataset) return [];
    const minLane = new Map<string, number>();
    for (const b of dataset.bands) {
      const cur = minLane.get(b.group) ?? Infinity;
      if (b.lane < cur) minLane.set(b.group, b.lane);
    }
    return Object.keys(dataset.groups).sort(
      (a, b) => (minLane.get(a) ?? Infinity) - (minLane.get(b) ?? Infinity),
    );
  })();
</script>

<div class="app-root">
<!-- ── Page header ── -->
<header class="app-header">
  <div class="header-left">
    <button class="header-title-btn" on:click={() => page = 'home'}>Spectral Band Atlas</button>
    <!-- The framing, not the scope: what the atlas currently covers is stated
         on the home page, where it can be widened without touching the chrome. -->
    <span class="header-subtitle">Vibrational spectroscopy</span>
  </div>
  <div class="header-right">
    <div class="header-authors">Julius Sommer<sup>1</sup>, Evgeny Pidko<sup>1</sup>, Atsushi Urakawa<sup>1</sup></div>
    <div class="header-affil"><sup>1</sup>Delft University of Technology</div>
  </div>
</header>

<!-- ── Narrow / mobile viewport notice (full width, under the header) ── -->
<MobileNotice />

<div class="page-body">
{#if loading}
  <div class="state-msg">Loading band data…</div>
{:else if error}
  <div class="state-msg error">Failed to load data: {error}</div>
{:else if dataset}
    <!-- ── Sidebar (collapsible) ── -->
    <aside class="sidebar" class:collapsed={!sidebarOpen}>
      <button
        class="sidebar-toggle"
        on:click={() => sidebarOpen = !sidebarOpen}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >{sidebarOpen ? '◀' : '▶'}</button>

      {#if !sidebarOpen}
        <!-- collapsed: mini page indicator buttons -->
        <div class="collapsed-page-nav">
          <button class="page-mini-btn" class:active={page === 'home'}
            on:click={() => page = 'home'} title="Home">H</button>
          <button class="page-mini-btn" class:active={page === 'knowledge'}
            on:click={() => page = 'knowledge'} title="Knowledge">K</button>
          <!-- B button: click = go to chart; hover = color quick-switch -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="mini-btn-wrap"
            on:mouseenter={openColorMenu}
            on:mouseleave={closeColorMenu}
          >
            <button class="page-mini-btn" class:active={page === 'chart'}
              on:click={() => page = 'chart'} title="Band chart">B</button>
            {#if showColorMenu}
              <div class="color-quick-menu">
                {#each COLOR_DIM_OPTIONS as o}
                  <button
                    class="cq-item"
                    class:cq-active={colorDim === o.dim}
                    on:click={() => { setColorDim(o.dim); page = 'chart'; showColorMenu = false; }}
                  >{o.label}</button>
                {/each}
              </div>
            {/if}
          </div>
          <button class="page-mini-btn" class:active={page === 'references'}
            on:click={() => page = 'references'} title="References">R</button>
          <button class="page-mini-btn" class:active={page === 'datamodel'}
            on:click={() => page = 'datamodel'} title="Dataset">D</button>
          <button class="page-mini-btn" class:active={page === 'impressum'}
            on:click={() => page = 'impressum'} title="Impressum">I</button>
          {#if page === 'styleguide'}
            <button class="page-mini-btn active"
              on:click={() => page = 'styleguide'} title="Style guide">S</button>
          {/if}
          {#if page === 'sourceguide'}
            <button class="page-mini-btn active"
              on:click={() => page = 'sourceguide'} title="Source guide">G</button>
          {/if}
        </div>
      {/if}

      {#if sidebarOpen}
      <div class="sidebar-open-content">
        <!-- Page selector -->
        <nav class="page-nav">
          <button class:active={page === 'home'}       on:click={() => page = 'home'}>Home</button>
          <button class:active={page === 'knowledge'}  on:click={() => page = 'knowledge'}>Knowledge</button>
          <button class:active={page === 'chart'}      on:click={() => page = 'chart'}>Band chart</button>
          <button class:active={page === 'references'} on:click={() => page = 'references'}>References</button>
          <button class:active={page === 'datamodel'}  on:click={() => page = 'datamodel'}>Dataset</button>
          <button class:active={page === 'impressum'}  on:click={() => page = 'impressum'}>Impressum</button>
          {#if page === 'styleguide'}
            <button class="active" on:click={() => page = 'styleguide'}>Style guide</button>
          {/if}
          {#if page === 'sourceguide'}
            <button class="active" on:click={() => page = 'sourceguide'}>Source guide</button>
          {/if}
        </nav>

        <hr class="divider" />

        <!-- Page-specific sidebar controls -->
        {#if page === 'chart'}
          <section>
            <h3>Color by</h3>
            <select value={colorDim} on:change={handleColorDimChange}>
              <option value="group">Group</option>
              <option value="vibration">Vibration</option>
              <option value="atoms">Atoms</option>
              <option value="references">References</option>
            </select>
          </section>

          <AxisSelect
            {axisProperty}
            {axisUnit}
            on:axisChange={handleAxisChange}
          />

          <hr class="divider" />

          <Sidebar
            groups={dataset.groups}
            sets={dataset.sets}
            sortedKeys={sortedGroupKeys}
            {enabledGroups}
            {showIsotopes}
            on:groupToggle={handleGroupToggle}
            on:setSelect={handleSetSelect}
            on:isotopeToggle={e => showIsotopes = e.detail.enabled}
          />

        {:else if page === 'styleguide'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each SG_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={sgActive === s.id}
                on:click={() => scrollToSection(s.id)}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'sourceguide'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each SRC_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={srcActive === s.id}
                on:click={() => scrollToSection(s.id, 'src')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'datamodel'}
          <section>
            <h3>View</h3>
            <select value={dmView} on:change={handleDmViewChange}>
              <option value="structure">Structure</option>
              <option value="contents">Contents</option>
            </select>
          </section>

          <h3 class="toc-head">Contents</h3>
          <nav class="sg-toc">
            {#each dmSections as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={dmActive === s.id}
                on:click={() => scrollToSection(s.id, 'dm')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'knowledge'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each KN_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={knActive === s.id}
                on:click={() => scrollToSection(s.id, 'kn')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'references'}
          <section>
            <h3>Group by</h3>
            <select bind:value={refGroupBy}>
              {#each GROUP_DIMS as d}
                <option value={d.key} title={d.hint}>{d.label}</option>
              {/each}
            </select>
          </section>

          <section>
            <h3>Then by</h3>
            <select bind:value={refThenBy}>
              {#each GROUP_DIMS.filter(d => d.key !== refGroupBy) as d}
                <option value={d.key} title={d.hint}>{d.label}</option>
              {/each}
            </select>
          </section>

          <!-- What lists its papers here: the bands, the modes, the Knowledge cards. -->
          <section>
            <h3>Include</h3>
            <label class="include-row" title="Every band that cites the paper, with its wavenumber and surface">
              <input type="checkbox" bind:checked={refIncludeBands} />
              Band assignments
            </label>
            <label class="include-row" title="Vibration modes that cite a paper without a band attached">
              <input type="checkbox" bind:checked={refIncludeModes} />
              Vibration modes
            </label>
            <label class="include-row" title="Knowledge cards that cite a paper, with the chapter and page">
              <input type="checkbox" bind:checked={refIncludeKnowledge} />
              Knowledge
            </label>
            <p class="include-hint">Modes and Knowledge show under each reference when grouping by reference first.</p>
          </section>
        {/if}

      </div>
      {/if}
    </aside>

    <!-- ── Main content ── -->
    <div class="main-area" class:plot-area={page === 'chart'} bind:this={mainArea}>
      {#if page === 'home'}
        <HomePage
          bandCount={dataset.bands.length}
          referenceCount={refs ? Object.keys(refs).length : 0}
          on:navigate={handleHomeNavigate}
        />
      {:else if page === 'chart'}
        <div class="chart-scroll">
          <BandChart
            bands={chartBands}
            groups={dataset.groups}
            {refs}
            {vibrations}
            {enabledGroups}
            {colorDim}
            {hiddenCats}
            {hiddenTags}
            {tagIsolate}
            {axisProperty}
            {axisUnit}
            hoveredCat={legendHoveredCat}
            hoveredTag={legendHoveredTag}
            {focusBand}
            on:navigateRef={handleNavigateRef}
            on:navigateMode={handleNavigateMode}
          />
        </div>
        <div class="legend-box">
          <ColorLegend
            categories={legendCats}
            {hiddenCats}
            on:catToggle={handleCatToggle}
            on:catDblClick={handleCatDblClick}
            on:catHover={handleCatHover}
          />
          {#if legendTags.length > 0}
            <hr class="legend-divider" />
            <TagLegend
              tags={legendTags}
              {hiddenTags}
              {tagIsolate}
              {tagTips}
              on:tagToggle={handleTagToggle}
              on:tagDblClick={handleTagDblClick}
              on:tagHover={handleTagHover}
            />
          {/if}
        </div>
      {:else if page === 'references'}
        <ReferencesPage
          bands={dataset.bands}
          groups={dataset.groups}
          {refs}
          {vibrations}
          {sortedGroupKeys}
          groupBy={refGroupBy}
          thenBy={refThenBy}
          includeBands={refIncludeBands}
          includeModes={refIncludeModes}
          includeKnowledge={refIncludeKnowledge}
          on:navigateKnowledge={handleNavigateKnowledge}
        />
      {:else if page === 'knowledge'}
        <KnowledgePage
          openOnMount={knOpen}
          bands={dataset.bands}
          groups={dataset.groups}
          {refs}
          on:active={e => knActive = e.detail.id}
          on:navigateBand={handleNavigateBand}
          on:navigateRef={handleNavigateRef}
        />
      {:else if page === 'impressum'}
        <ImpressumPage on:navigate={handleHomeNavigate} />
      {:else if page === 'styleguide'}
        <StyleGuidePage on:active={e => sgActive = e.detail.id} />
      {:else if page === 'sourceguide'}
        <SourceGuidePage on:active={e => srcActive = e.detail.id} />
      {:else if page === 'datamodel'}
        <DataModelPage
          {dataset}
          {refs}
          {vibrations}
          {tagTips}
          {sortedGroupKeys}
          {focusMode}
          view={dmView}
          on:active={e => dmActive = e.detail.id}
          on:navigateRef={handleNavigateRef}
          on:navigateBand={handleNavigateBand}
        />
      {/if}
    </div>
{/if}
</div><!-- page-body -->

<!-- ── Hint banner (footer) ── -->
<div class="hint-banner">
  <strong>Tip:</strong> hard-refresh if stale:
  <kbd>Ctrl+Shift+R</kbd> (Win/Linux) or <kbd>⌘+Shift+R</kbd> (macOS).
  &ensp;<strong>Filter</strong> = pick a set, or open Groups to toggle one (collapses/expands lanes).
  &ensp;<strong>Legend</strong> = show/hide color categories.
  &ensp;<strong>Work in progress</strong> — especially the assignment of references is incomplete.
  &ensp;Found an error, have a tip, or know an interesting paper to reference?
  Please contact <a class="contact" href="mailto:j.sommer@tudelft.nl">j.sommer@tudelft.nl</a>.
</div>
</div><!-- app-root -->

<style>
  :global(html, body) {
    margin: 0; padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: var(--font-sans);
    color: var(--ink-700);
    box-sizing: border-box;
  }

  .app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .page-body {
    flex: 1 1 0;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }

  /* ── Page header ── */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 28px;
    background: var(--grad-header);
    color: var(--brand-on-dark);
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }

  .header-title-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 29px;
    font-weight: 800;
    font-style: italic;
    letter-spacing: -0.01em;
    color: var(--brand-on-dark);
  }
  .header-title-btn:hover { color: rgba(255,255,255,0.82); }

  .header-subtitle {
    font-size: 15px;
    color: rgba(255,255,255,0.55);
    font-style: italic;
  }

  .header-right { text-align: right; }

  .header-authors {
    font-size: 14.5px;
    color: rgba(255,255,255,0.88);
    line-height: 1.4;
  }
  .header-authors :global(sup) { font-size: 10px; vertical-align: super; }

  .header-affil {
    font-size: 12.5px;
    color: rgba(255,255,255,0.55);
    font-style: italic;
    margin-top: 1px;
  }
  .header-affil :global(sup) { font-size: 9px; vertical-align: super; }

  /* ── Hint banner (footer) — always visible as the last flex item ── */
  .hint-banner {
    flex: 0 0 auto;
    background: var(--notice-bg);
    border-top: 1px solid var(--notice-border);
    color: var(--notice-fg);
    font-size: 14px;
    padding: 6px 18px;
  }

  .hint-banner .contact {
    color: var(--ref-accent-deep);
    font-weight: 600;
    text-decoration: underline;
  }
  .hint-banner .contact:hover { color: var(--notice-link); }

  kbd {
    background: var(--surface-hover);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 13px;
    font-family: var(--font-mono);
  }

  /* ── Sidebar ── */
  .sidebar {
    flex: 0 0 220px;
    width: 220px;
    height: 100%;
    box-sizing: border-box;
    /* The horizontal padding is small because the reserved scrollbar gutters
       below supply most of it; together they come to the same 14px-ish inset,
       and the content column keeps its width either way. */
    padding: 10px 7px;
    border-right: 1px solid var(--line-soft);
    background: var(--surface-sunken);
    overflow-y: auto;
    overflow-x: hidden;
    /* Reserve the scrollbar's width whether or not it is showing, so
       expanding the group list does not reflow anything. `both-edges` puts
       the same reservation on the left, so the spare room reads as even
       padding rather than an empty column down one side, and the content
       never moves when the scrollbar appears. */
    scrollbar-gutter: stable both-edges;
    font-size: 14px;
    transition: width 0.18s ease, flex-basis 0.18s ease, padding 0.18s ease;
  }

  .sidebar.collapsed {
    flex-basis: 36px;
    width: 36px;
    padding: 10px 6px;
    overflow: visible;
  }

  /* ── Collapsed sidebar: mini page indicator ── */
  .collapsed-page-nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
    align-items: center;
  }

  .page-mini-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-200);
    cursor: pointer;
    text-align: center;
    line-height: 22px;
  }
  .page-mini-btn:hover { background: var(--surface-hover); color: var(--ink-700); }
  .page-mini-btn.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
  }

  .mini-btn-wrap {
    position: relative;
    width: 24px;
  }

  .color-quick-menu {
    position: absolute;
    left: 26px;
    top: 0;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.12);
    z-index: 200;
    overflow: hidden;
    min-width: 100px;
  }

  .cq-item {
    display: block;
    width: 100%;
    padding: 5px 10px;
    background: none;
    border: none;
    font-size: 12.5px;
    color: var(--ink-600);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }
  .cq-item:hover { background: var(--surface-hover); }
  .cq-item.cq-active { color: var(--brand-accent); font-weight: 600; background: var(--brand-tint-soft); }

  /* ── Sidebar flex wrapper (open state) ── */
  .sidebar-open-content {
    display: flex;
    flex-direction: column;
    min-height: calc(100% - 38px); /* leaves room for toggle button */
  }

  .sidebar-toggle {
    display: block;
    width: 100%;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 5px 0;
    font-size: 10px;
    color: var(--ink-300);
    cursor: pointer;
    margin-bottom: 10px;
    text-align: center;
    white-space: nowrap;
  }
  .sidebar-toggle:hover { background: var(--surface-hover); color: var(--ink-700); }

  .sidebar :global(h3) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-500);
  }

  .sidebar :global(select) {
    width: 100%;
    padding: 4px 6px;
    font-size: 13px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: white;
    cursor: pointer;
    box-sizing: border-box;
    margin-bottom: 4px;
  }

  .divider {
    border: none;
    border-top: 1px solid var(--line-soft);
    margin: 12px 0;
  }

  /* ── Main content ── */
  .main-area {
    flex: 1 1 auto;
    height: 100%;
    overflow-y: auto;
    overflow-x: auto;
  }

  .plot-area {
    min-width: 1100px;
    display: flex;
    flex-direction: column;
    padding: 0 40px;
    overflow-y: hidden; /* vertical scroll happens inside .chart-scroll instead */
  }

  /* Chart itself scrolls internally so the legend below stays pinned in
     view regardless of how tall the lane stack gets. flex-grow:0 keeps it
     sized to its own content (no leftover blank space above the legend
     when there are few enough lanes to fit); flex-shrink:1 still lets it
     shrink down to the available space (enabling internal scroll) once the
     lane stack grows past that. */
  .chart-scroll {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .legend-box {
    flex: 0 0 auto;
    border: 1px solid var(--line-panel);
    border-radius: 6px;
    margin: 4px 0 8px;
    background: white;
  }

  .legend-divider {
    border: none;
    border-top: 1px solid var(--surface-hover);
    margin: 0;
  }

  .state-msg {
    padding: 40px;
    font-size: 15px;
    color: var(--ink-400);
  }
  .state-msg.error { color: var(--danger); }

  /* ── Style guide table of contents ── */
  .toc-head { margin-top: 14px; }

  .sg-toc {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  /* References page: what else lists its citations. */
  .include-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 2px 0;
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    cursor: pointer;
  }
  .include-hint {
    margin: 6px 0 0;
    font-size: var(--t-code-size);
    line-height: 1.4;
    color: var(--ink-050);
  }

  .sg-toc-item {
    display: block;
    width: 100%;
    padding: 4px 8px 4px 18px;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 3px;
    font-family: inherit;
    font-size: 12.5px;
    color: var(--ink-500);
    text-align: left;
    cursor: pointer;
    line-height: 1.35;
  }
  .sg-toc-item:hover { background: var(--surface-hover); color: var(--ink-700); }

  /* Part headings sit flush left and anchor the list; subsections indent. */
  .sg-toc-item.sg-part {
    padding-left: 8px;
    margin-top: 8px;
    font-weight: 700;
    color: var(--brand-900);
  }
  .sg-toc-item.sg-part:first-child { margin-top: 0; }

  .sg-toc-item.active {
    background: var(--brand-tint);
    border-left-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }

  /* ── Page navigation ── */
  .page-nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .page-nav button {
    display: block;
    width: 100%;
    padding: 5px 10px;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    color: var(--ink-600);
    text-align: left;
  }

  .page-nav button:hover { background: var(--surface-hover); }

  .page-nav button.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }
</style>

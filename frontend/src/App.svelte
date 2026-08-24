<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dataset, ColorDim, AxisProperty, RefMap, Vibrations } from './lib/types';
  import { AXES } from './lib/units';
  import { getLegendCategories, getLegendTags } from './lib/chart';
  import BandChart from './components/BandChart.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ColorLegend from './components/ColorLegend.svelte';
  import TagLegend from './components/TagLegend.svelte';
  import AxisSelect from './components/AxisSelect.svelte';
  import ReferencesPage from './components/ReferencesPage.svelte';
  import VibrationModesPage from './components/VibrationModesPage.svelte';
  import HomePage from './components/HomePage.svelte';
  import ImpressumPage from './components/ImpressumPage.svelte';
  import StyleGuidePage, { SECTIONS as SG_SECTIONS } from './components/StyleGuidePage.svelte';
  import MobileNotice from './components/MobileNotice.svelte';

  let dataset: Dataset | null = null;
  let refs: RefMap = null;
  let vibrations: Vibrations = { molecules: [] };
  let tagTips: Record<string, { tip: string }> = {};
  let loading = true;
  let error: string | null = null;
  // 'styleguide' has no sidebar entry of its own: it is reached from the
  // Impressum page, which is where the project's meta pages live.
  type Page = 'home' | 'chart' | 'references' | 'vibration' | 'impressum' | 'styleguide';
  let page: Page = 'home';
  let refViewMode: 'by-ref' | 'by-group' = 'by-ref';
  // Style guide table of contents: which section the reader is currently in,
  // reported by the page's own scroll spy.
  let sgActive = SG_SECTIONS[0].id;

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sgActive = id;
  }
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

  const DEFAULT_OFF = new Set(['support', "support_oh", "h2", "carbonyl", "hydroxyl"]);

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
      refs = (await rRes.json()) as RefMap;
      // Vibrations/tag-tooltip content is supplementary — don't fail the
      // whole app if either is missing (e.g. build.py predates the feature).
      vibrations = vRes.ok ? ((await vRes.json()) as Vibrations) : { molecules: [] };
      tagTips = tRes.ok ? ((await tRes.json()) as Record<string, { tip: string }>) : {};
      enabledGroups = new Set(
        Object.keys(dataset.groups).filter(k => !DEFAULT_OFF.has(k))
      );
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

  function handleAllGroups(e: CustomEvent<{ all: boolean }>) {
    if (!dataset) return;
    enabledGroups = e.detail.all ? new Set(Object.keys(dataset.groups)) : new Set();
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

  function handleNavigateRef(e: CustomEvent<{ key: string }>) {
    const key = e.detail.key;
    refViewMode = 'by-ref';
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
    page = 'vibration';
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
    ? getLegendCategories(dataset.bands, dataset.groups, enabledGroups, colorDim)
    : [];

  $: legendTags = dataset
    ? getLegendTags(dataset.bands, enabledGroups)
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
    <span class="header-subtitle">CO₂ hydrogenation</span>
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
          <button class="page-mini-btn" class:active={page === 'vibration'}
            on:click={() => page = 'vibration'} title="Vibration modes">V</button>
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
          <button class="page-mini-btn" class:active={page === 'impressum'}
            on:click={() => page = 'impressum'} title="Impressum">I</button>
          {#if page === 'styleguide'}
            <button class="page-mini-btn active"
              on:click={() => page = 'styleguide'} title="Style guide">S</button>
          {/if}
        </div>
      {/if}

      {#if sidebarOpen}
      <div class="sidebar-open-content">
        <!-- Page selector -->
        <nav class="page-nav">
          <button class:active={page === 'home'}       on:click={() => page = 'home'}>Home</button>
          <button class:active={page === 'vibration'}  on:click={() => page = 'vibration'}>Vibration modes</button>
          <button class:active={page === 'chart'}      on:click={() => page = 'chart'}>Band chart</button>
          <button class:active={page === 'references'} on:click={() => page = 'references'}>References</button>
          <button class:active={page === 'impressum'}  on:click={() => page = 'impressum'}>Impressum</button>
          {#if page === 'styleguide'}
            <button class="active" on:click={() => page = 'styleguide'}>Style guide</button>
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
            sortedKeys={sortedGroupKeys}
            {enabledGroups}
            on:groupToggle={handleGroupToggle}
            on:allGroups={handleAllGroups}
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

        {:else if page === 'references'}
          <h3>View</h3>
          <div class="sub-nav">
            <button class:active={refViewMode === 'by-ref'}   on:click={() => refViewMode = 'by-ref'}>By reference</button>
            <button class:active={refViewMode === 'by-group'} on:click={() => refViewMode = 'by-group'}>By group</button>
          </div>
        {/if}

      </div>
      {/if}
    </aside>

    <!-- ── Main content ── -->
    <div class="main-area" class:plot-area={page === 'chart'}>
      {#if page === 'home'}
        <HomePage on:navigate={handleHomeNavigate} />
      {:else if page === 'chart'}
        <div class="chart-scroll">
          <BandChart
            bands={dataset.bands}
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
          viewMode={refViewMode}
        />
      {:else if page === 'vibration'}
        <VibrationModesPage
          bands={dataset.bands}
          {refs}
          {vibrations}
          {sortedGroupKeys}
          {focusMode}
          on:navigateRef={handleNavigateRef}
          on:navigateBand={handleNavigateBand}
        />
      {:else if page === 'impressum'}
        <ImpressumPage on:navigate={handleHomeNavigate} />
      {:else if page === 'styleguide'}
        <StyleGuidePage on:active={e => sgActive = e.detail.id} />
      {/if}
    </div>
{/if}
</div><!-- page-body -->

<!-- ── Hint banner (footer) ── -->
<div class="hint-banner">
  <strong>Tip:</strong> hard-refresh if stale:
  <kbd>Ctrl+Shift+R</kbd> (Win/Linux) or <kbd>⌘+Shift+R</kbd> (macOS).
  &ensp;<strong>Sidebar</strong> = toggle groups (collapses/expands lanes).
  &ensp;<strong>Legend</strong> = show/hide color categories.
  &ensp;<strong>Work in progress</strong> — especially the assignment of references is incomplete.
  &ensp;Found an error, have a tip, or know an interesting paper to reference?
  Please contact <a class="contact" href="mailto:j.sommer@tudellft.nl">j.sommer@tudellft.nl</a>.
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
    padding: 10px 14px;
    border-right: 1px solid var(--line-soft);
    background: var(--surface-sunken);
    overflow-y: auto;
    overflow-x: hidden;
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
  .sg-toc {
    display: flex;
    flex-direction: column;
    gap: 1px;
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
  .page-nav, .sub-nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .page-nav button, .sub-nav button {
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

  .page-nav button:hover, .sub-nav button:hover { background: var(--surface-hover); }

  .page-nav button.active, .sub-nav button.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dataset, ColorDim, AxisProperty, RefMap } from './lib/types';
  import { AXES } from './lib/units';
  import { getLegendCategories } from './lib/chart';
  import BandChart from './components/BandChart.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ColorLegend from './components/ColorLegend.svelte';
  import AxisSelect from './components/AxisSelect.svelte';
  import ReferencesPage from './components/ReferencesPage.svelte';
  import VibrationModesPage from './components/VibrationModesPage.svelte';

  let dataset: Dataset | null = null;
  let refs: RefMap = null;
  let loading = true;
  let error: string | null = null;
  type Page = 'chart' | 'references' | 'vibration';
  let page: Page = 'chart';
  let refViewMode: 'by-ref' | 'by-group' = 'by-ref';

  const DEFAULT_OFF = new Set(['hydride', 'support', "support_oh", "h2"]);

  let enabledGroups: ReadonlySet<string> = new Set();
  let colorDim: ColorDim = 'group';
  let hiddenCats: ReadonlySet<string> = new Set();
  let axisProperty: AxisProperty = 'wavenumber';
  let axisUnit = AXES.wavenumber.defaultUnit;

  onMount(async () => {
    try {
      const [bRes, rRes] = await Promise.all([
        fetch('data/bands.json'),
        fetch('data/references.json'),
      ]);
      if (!bRes.ok) throw new Error(`bands.json: ${bRes.status}`);
      if (!rRes.ok) throw new Error(`references.json: ${rRes.status}`);
      dataset = (await bRes.json()) as Dataset;
      refs = (await rRes.json()) as RefMap;
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

  function handleColorDimChange(e: Event) {
    const dim = (e.currentTarget as HTMLSelectElement).value as ColorDim;
    colorDim = dim;
    hiddenCats = new Set(); // reset legend state when switching dimension
  }

  function handleCatToggle(e: CustomEvent<{ cat: string; visible: boolean }>) {
    const next = new Set(hiddenCats);
    if (!e.detail.visible) next.add(e.detail.cat); else next.delete(e.detail.cat);
    hiddenCats = next;
  }

  function handleAxisChange(e: CustomEvent<{ property: AxisProperty; unit: string }>) {
    axisProperty = e.detail.property;
    axisUnit = e.detail.unit;
  }

  $: legendCats = dataset
    ? getLegendCategories(dataset.bands, dataset.groups, enabledGroups, colorDim)
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

<div class="hint-banner">
  <strong>Tip:</strong> hard-refresh if stale:
  <kbd>Ctrl+Shift+R</kbd> (Win/Linux) or <kbd>⌘+Shift+R</kbd> (macOS).
  &ensp;<strong>Sidebar</strong> = toggle groups (collapses/expands lanes).
  &ensp;<strong>Legend</strong> = show/hide color categories.
  &ensp;<strong>Work in progress</strong> — especially the assignment of references is incomplete.
  &ensp;Found an error, have a tip, or know an interesting paper to reference?
  Please contact <a class="contact" href="mailto:j.sommer@tudellft.nl">j.sommer@tudellft.nl</a>.
</div>

{#if loading}
  <div class="state-msg">Loading band data…</div>
{:else if error}
  <div class="state-msg error">Failed to load data: {error}</div>
{:else if dataset}
  <div class="layout">
    <!-- ── Sidebar (always visible) ── -->
    <aside class="sidebar">
      <!-- Page selector -->
      <nav class="page-nav">
        <button class:active={page === 'chart'}      on:click={() => page = 'chart'}>Band chart</button>
        <button class:active={page === 'references'} on:click={() => page = 'references'}>References</button>
        <button class:active={page === 'vibration'}  on:click={() => page = 'vibration'}>Vibration modes</button>
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

      {:else if page === 'references'}
        <h3>View</h3>
        <div class="sub-nav">
          <button class:active={refViewMode === 'by-ref'}   on:click={() => refViewMode = 'by-ref'}>By reference</button>
          <button class:active={refViewMode === 'by-group'} on:click={() => refViewMode = 'by-group'}>By group</button>
        </div>
      {/if}
    </aside>

    <!-- ── Main content ── -->
    <div class="main-area" class:plot-area={page === 'chart'}>
      {#if page === 'chart'}
        <BandChart
          bands={dataset.bands}
          groups={dataset.groups}
          {refs}
          {enabledGroups}
          {colorDim}
          {hiddenCats}
          {axisProperty}
          {axisUnit}
        />
        <ColorLegend
          categories={legendCats}
          {hiddenCats}
          on:catToggle={handleCatToggle}
        />
      {:else if page === 'references'}
        <ReferencesPage
          bands={dataset.bands}
          groups={dataset.groups}
          {refs}
          {sortedGroupKeys}
          viewMode={refViewMode}
        />
      {:else if page === 'vibration'}
        <VibrationModesPage />
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(html, body) {
    margin: 0; padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #2A2A2A;
    box-sizing: border-box;
  }

  .hint-banner {
    background: #FFF8E1;
    border-bottom: 1px solid #F0DDA0;
    color: #3A3A3A;
    font-size: 13px;
    padding: 6px 18px;
  }

  .hint-banner .contact {
    color: #8a6d00;
    font-weight: 600;
    text-decoration: underline;
  }

  .hint-banner .contact:hover { color: #5c4a00; }

  kbd {
    background: #F4F4F4;
    border: 1px solid #D0D0D0;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
  }

  .layout {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
  }

  .sidebar {
    flex: 0 0 220px;
    width: 220px;
    box-sizing: border-box;
    padding: 16px 14px;
    border-right: 1px solid #E5E5E5;
    background: #FAFAFA;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
    font-size: 13px;
  }

  .sidebar :global(h3) {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
  }

  .sidebar :global(select) {
    width: 100%;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    box-sizing: border-box;
    margin-bottom: 4px;
  }

  .divider {
    border: none;
    border-top: 1px solid #E5E5E5;
    margin: 12px 0;
  }

  .main-area {
    flex: 1 1 auto;
    overflow-x: auto;
  }

  .plot-area {
    min-width: 1100px;
    display: flex;
    flex-direction: column;
  }

  .state-msg {
    padding: 40px;
    font-size: 14px;
    color: #666;
  }

  .state-msg.error { color: #c00; }

  /* Page navigation */
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
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    color: #444;
    text-align: left;
  }

  .page-nav button:hover, .sub-nav button:hover { background: #F0F0F0; }

  .page-nav button.active, .sub-nav button.active {
    background: #E8F0FE;
    border-color: #A0B4E0;
    color: #1a3a8f;
    font-weight: 600;
  }
</style>

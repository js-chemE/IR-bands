<script lang="ts">
  import type { Band, RefMap, Vibrations, VibrationMode } from '../lib/types';
  import { geometryFor, fundamentalModeCount } from '../lib/moleculeGeometry';
  import MoleculeSelector from './vibration/MoleculeSelector.svelte';
  import MoleculeViewer from './vibration/MoleculeViewer.svelte';
  import ModeList from './vibration/ModeList.svelte';
  import ModeDetailPanel from './vibration/ModeDetailPanel.svelte';

  export let bands: Band[];
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let sortedGroupKeys: string[];

  // Same group order the band chart and references page use (by first lane
  // appearance), so a molecule lines up with where its species sits there —
  // props are stable for the component's lifetime, so this can be plain JS.
  const orderedMolecules = [...vibrations.molecules].sort((a, b) => {
    const ia = sortedGroupKeys.indexOf(a.band_groups[0] ?? '');
    const ib = sortedGroupKeys.indexOf(b.band_groups[0] ?? '');
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  });

  let selectedMoleculeId = orderedMolecules[0]?.id ?? '';
  let previewModeId: string | null = null;
  let openModeId: string | null = null;
  let notationOpen = false;

  $: molecule = orderedMolecules.find(m => m.id === selectedMoleculeId) ?? null;
  $: geometry = molecule ? geometryFor(molecule.id) : null;
  // Static at rest — only animate while a mode is actually hovered/focused.
  $: activeMode = previewModeId ? molecule?.modes.find(m => m.id === previewModeId) ?? null : null;
  $: activeVectors = (geometry && activeMode) ? geometry.modes[activeMode.id] ?? null : null;

  // Explicit, validated linking: a mode's band_reference entries are band
  // ids or branch_group keys, already checked against bands.jsonc at build
  // time — no need to re-derive the match via species/category/subtype.
  function bandsForMode(mode: VibrationMode): Band[] {
    const wanted = new Set(mode.band_reference);
    return bands.filter(b => wanted.has(b.id) || (b.branch_group !== null && wanted.has(b.branch_group)));
  }

  $: bandsByMode = molecule
    ? Object.fromEntries(molecule.modes.map(m => [m.id, bandsForMode(m)]))
    : {};

  $: openMode = molecule?.modes.find(m => m.id === openModeId) ?? null;

  $: modeCount = (molecule && geometry) ? fundamentalModeCount(molecule.shape, geometry.atoms.length) : null;
  $: modeCountStatus = (() => {
    if (!molecule || !modeCount) return '';
    const diff = modeCount.max - molecule.modes.length;
    if (diff === 0) return 'all fundamental modes complete';
    if (diff > 0) return `${diff} fundamental mode${diff !== 1 ? 's' : ''} missing`;
    return `${-diff} extra mode${-diff !== 1 ? 's' : ''} listed beyond the fundamental count`;
  })();

  function selectMolecule(id: string) {
    selectedMoleculeId = id;
    previewModeId = null;
    openModeId = null;
  }

  function handleOpen(e: CustomEvent<{ id: string }>) {
    openModeId = openModeId === e.detail.id ? null : e.detail.id;
  }
</script>

<div class="modes-page">
  <div class="wip-badge">Work in progress</div>
  <h1>Vibration modes</h1>
  <p class="intro">
    Pick a molecule, then hover or focus a mode below to see how its atoms move.
  </p>

  <div class="notation-box">
    <button class="notation-toggle" on:click={() => (notationOpen = !notationOpen)}>
      <span class="chevron" class:open={notationOpen}>▶</span> Notation used on this page
    </button>
    {#if notationOpen}
      <div class="notation-list">
        <div class="notation-header">The localized notation</div>

        <div class="notation-subheader">ν — stretch — bond length changes</div>
        <hr class="notation-thin-divider" />
        <div class="notation-table stretch-table">
          <div class="t-row"><span class="t-col1">ν</span><span class="t-col2">two atoms, no symmetry to distinguish</span></div>
          <div class="t-row"><span class="t-col1">νₛ symmetric</span><span class="t-col2">bonds stretch together</span></div>
          <div class="t-row"><span class="t-col1">νₐₛ asymmetric</span><span class="t-col2">one bond lengthens as the other shortens</span></div>
        </div>

        <hr class="notation-main-divider" />

        <div class="notation-subheader">δ — bend / deformation — bond angle changes (also used generically for any of the below)</div>
        <hr class="notation-thin-divider" />
        <div class="notation-table bend-table">
          <div class="t-row"><span class="t-col1">δ scissoring</span><span class="t-col2">in-plane</span><span class="t-col3">both atoms swing toward/apart</span></div>
          <div class="t-row"><span class="t-col1">ρ rocking</span><span class="t-col2">in-plane</span><span class="t-col3">both atoms swing the same way</span></div>
          <div class="t-row"><span class="t-col1">ω wagging</span><span class="t-col2">out-of-plane</span><span class="t-col3">both atoms move the same way</span></div>
          <div class="t-row"><span class="t-col1">τ twisting / torsion</span><span class="t-col2">out-of-plane</span><span class="t-col3">atoms move opposite ways</span></div>
          <div class="t-row"><span class="t-col1">γ (generic)</span><span class="t-col2">out-of-plane</span><span class="t-col3">used when ω/τ aren't distinguished</span></div>
          <div class="t-row"><span class="t-col1">δₛ symmetric</span><span class="t-col2">umbrella-like</span><span class="t-col3">all bonds bend together, breathing in/out, CH₄ / R-CH₃</span></div>
          <div class="t-row"><span class="t-col1">δₐₛ asymmetric</span><span class="t-col2"></span><span class="t-col3">bonds bend out of phase with each other, degnerated, CH₄ / R-CH₃</span></div>
        </div>

        <hr class="notation-main-divider" />

        <div class="notation-table rest-table">
          <div class="t-row"><span class="t-col1">2δ, 2ν…</span><span class="t-col2">first overtone of that mode</span></div>
          <div class="t-row"><span class="t-col1">δ + ν</span><span class="t-col2">combination band (sum of two modes)</span></div>
          <div class="t-row"><span class="t-col1">R / Q / P</span><span class="t-col2">rotational branches (ΔJ = +1, 0, −1)</span></div>
        </div>
      </div>
      <p class="notation-note">
        Two notation families coexist in the literature: this localized,
        group-frequency form above, and normal-mode numbering (ν₁, ν₂, ν₃…)
        more common for small, highly symmetric gas molecules. This page
        always uses the localized form — even for gas-phase CO₂ — for
        consistency with the rest of the dataset. Many papers also just call
        every non-stretching mode δ without distinguishing ρ/ω/τ/γ; we try
        to keep them separate where the data supports it.
      </p>
    {/if}
  </div>

  {#if orderedMolecules.length === 0}
    <p class="empty">No vibrations content yet.</p>
  {:else}
    <MoleculeSelector
      molecules={orderedMolecules}
      selectedId={selectedMoleculeId}
      on:select={(e) => selectMolecule(e.detail.id)}
    />

    {#if molecule && geometry}
      <div class="content-row">
        <div class="main-col">
          <div class="viewer-row">
            {#if modeCount}
              <div class="mode-count-line">
                {molecule.shape === 'linear' ? 'Linear' : 'Non-linear'}: {modeCount.formulaLabel} → {modeCountStatus}
              </div>
            {/if}
            <div class="viewer-inner">
              <MoleculeViewer {geometry} {activeVectors} />
              <ModeList
                modes={molecule.modes}
                {openModeId}
                on:preview={(e) => (previewModeId = e.detail.id)}
                on:open={handleOpen}
              />
            </div>
          </div>
        </div>

        {#if openMode}
          <ModeDetailPanel
            mode={openMode}
            bands={bandsByMode[openMode.id] ?? []}
            {refs}
            on:close={() => (openModeId = null)}
            on:navigateRef
            on:navigateMode
          />
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .modes-page {
    padding: 40px 48px;
  }

  .wip-badge {
    display: inline-block;
    background: #FFF3CD;
    border: 1px solid #E6C86A;
    color: #7A5A00;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 10px;
    border-radius: 12px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 22px;
    font-weight: 700;
    color: #222;
    margin: 0 0 8px 0;
  }

  .intro {
    margin: 0 0 16px 0;
    font-size: 13.5px;
    color: #666;
    line-height: 1.6;
    max-width: 760px;
  }

  .notation-box {
    margin-bottom: 24px;
    max-width: 760px;
  }

  .notation-toggle {
    background: none;
    border: 1px solid #D0D0D0;
    border-radius: 5px;
    padding: 5px 12px;
    font-size: 12.5px;
    color: #444;
    cursor: pointer;
  }

  .notation-toggle:hover { background: #F0F0F0; }

  .chevron {
    display: inline-block;
    font-size: 9px;
    transition: transform 0.15s ease;
  }

  .chevron.open { transform: rotate(90deg); }

  .notation-list {
    margin: 8px 0 0;
    padding: 14px 18px;
    background: #FAFAFA;
    border: 1px solid #E5E5E5;
    border-radius: 6px;
    font-size: 12.5px;
  }

  .notation-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    margin-bottom: 8px;
  }

  .notation-subheader {
    font-weight: 700;
    font-size: 13px;
    color: #333;
    margin: 4px 0;
  }

  .notation-thin-divider {
    border: none;
    border-top: 1px solid #ECECEC;
    margin: 5px 0 8px;
  }

  .notation-main-divider {
    border: none;
    border-top: 2px solid #D8D8D8;
    margin: 16px 0;
  }

  /* Column-aligned, but never a real <table> — display:contents lets each
     row's spans drop straight into the grid's column tracks. */
  .notation-table {
    display: grid;
    gap: 3px 16px;
    font-size: 12.5px;
  }

  .stretch-table, .rest-table { grid-template-columns: max-content 1fr; }
  .bend-table { grid-template-columns: max-content max-content 1fr; }

  .t-row { display: contents; }

  .t-col1 {
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }

  .t-col2 {
    color: #888;
  }

  .bend-table .t-col3 {
    color: #666;
  }

  .rest-table .t-col2, .stretch-table .t-col2 {
    color: #666;
  }

  .notation-note {
    margin: 10px 0 0;
    padding: 0 18px;
    font-size: 11.5px;
    color: #777;
    line-height: 1.55;
    max-width: 760px;
  }

  .empty {
    font-size: 14px;
    color: #888;
  }

  .content-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
  }

  .main-col {
    flex: 0 0 760px;
    width: 760px;
  }

  .viewer-row {
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
    background: #FAFAFA;
    border: 1px solid #E5E5E5;
    border-radius: 8px;
    padding: 20px;
  }

  .mode-count-line {
    font-size: 12px;
    color: #777;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #E5E5E5;
  }

  .viewer-inner {
    display: flex;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
  }
</style>

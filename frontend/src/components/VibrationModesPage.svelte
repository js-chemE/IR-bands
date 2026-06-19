<script lang="ts">
  import type { Band, RefMap, Vibrations, VibrationMode } from '../lib/types';
  import { geometryFor } from '../lib/moleculeGeometry';
  import MoleculeSelector from './vibration/MoleculeSelector.svelte';
  import MoleculeViewer from './vibration/MoleculeViewer.svelte';
  import ModeList from './vibration/ModeList.svelte';

  export let bands: Band[];
  export let refs: RefMap;
  export let vibrations: Vibrations;

  let selectedMoleculeId = vibrations.molecules[0]?.id ?? '';
  let selectedModeId = vibrations.molecules[0]?.modes[0]?.id ?? '';
  let previewModeId: string | null = null;
  let notationOpen = false;

  $: molecule = vibrations.molecules.find(m => m.id === selectedMoleculeId) ?? null;
  $: geometry = molecule ? geometryFor(molecule.id) : null;
  // Static at rest — only animate while a mode is actually hovered/focused,
  // not just "selected" (selection alone shouldn't force perpetual motion).
  $: activeMode = previewModeId ? molecule?.modes.find(m => m.id === previewModeId) ?? null : null;
  $: activeVectors = (geometry && activeMode) ? geometry.modes[activeMode.id] ?? null : null;

  // Explicit, validated linking: a mode's band_reference entries are band
  // ids or branch_group keys, already checked against bands.jsonc at build
  // time — no need to re-derive the match via species/category/subtype.
  function bandsForMode(mode: VibrationMode): Band[] {
    const wanted = new Set(mode.band_reference);
    return bands.filter(b => wanted.has(b.id) || (b.branch_group !== null && wanted.has(b.branch_group)));
  }

  $: bandCounts = molecule
    ? Object.fromEntries(molecule.modes.map(m => [m.id, bandsForMode(m).length]))
    : {};

  function selectMolecule(id: string) {
    selectedMoleculeId = id;
    selectedModeId = vibrations.molecules.find(m => m.id === id)?.modes[0]?.id ?? '';
    previewModeId = null;
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
      <dl class="notation-list">
        <dt>ν</dt><dd>stretch</dd>
        <dt>δ</dt><dd>bend</dd>
        <dt>subscript s / as</dt><dd>symmetric / asymmetric</dd>
        <dt>2δ, 2ν…</dt><dd>first overtone of that mode</dd>
        <dt>R / Q / P</dt><dd>rotational branches (ΔJ = +1, 0, −1)</dd>
        <dt>IR-active / IR-inactive</dt><dd>whether the mode absorbs infrared light at all</dd>
        <dt>Raman-active / Raman-inactive</dt><dd>same, for Raman scattering — a mode forbidden in one is often allowed in the other (mutual exclusion rule, for centrosymmetric molecules like CO₂)</dd>
        <dt>colored chip (e.g. O=C=O)</dt><dd>the atoms involved, colored the same way as the "Atoms" dimension in the band chart</dd>
        <dt>grey chips</dt><dd>tags, same vocabulary as the band chart's tag legend</dd>
      </dl>
    {/if}
  </div>

  {#if vibrations.molecules.length === 0}
    <p class="empty">No vibrations content yet.</p>
  {:else}
    <MoleculeSelector
      molecules={vibrations.molecules}
      selectedId={selectedMoleculeId}
      on:select={(e) => selectMolecule(e.detail.id)}
    />

    {#if molecule && geometry}
      <div class="viewer-row">
        <MoleculeViewer {geometry} {activeVectors} />
        <ModeList
          modes={molecule.modes}
          {selectedModeId}
          {refs}
          {bandCounts}
          on:select={(e) => (selectedModeId = e.detail.id)}
          on:preview={(e) => (previewModeId = e.detail.id)}
          on:navigateRef
          on:navigateMode
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .modes-page {
    padding: 40px 48px;
    max-width: 760px;
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
  }

  .notation-box {
    margin-bottom: 24px;
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
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 14px;
    font-size: 12.5px;
  }

  .notation-list dt {
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }

  .notation-list dd {
    margin: 0;
    color: #666;
  }

  .empty {
    font-size: 14px;
    color: #888;
  }

  .viewer-row {
    display: flex;
    gap: 28px;
    align-items: flex-start;
    background: #FAFAFA;
    border: 1px solid #E5E5E5;
    border-radius: 8px;
    padding: 20px;
  }
</style>

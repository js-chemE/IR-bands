<script lang="ts">
  import type { Band, RefMap, Vibrations, VibrationMode } from '../lib/types';
  import { geometryFor, VIBRATIONAL_SYMMETRY, mullikenDegeneracy, vibrationalModeTotal } from '../lib/moleculeGeometry';
  import MoleculeSelector from './vibration/MoleculeSelector.svelte';
  import TopologySelector from './vibration/TopologySelector.svelte';
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
  let selectedTopologyId = orderedMolecules[0]?.topologies[0]?.id ?? '';
  let previewModeId: string | null = null;
  let openModeId: string | null = null;
  let notationOpen = false;

  $: molecule = orderedMolecules.find(m => m.id === selectedMoleculeId) ?? null;
  $: selectedTopology = molecule?.topologies.find(t => t.id === selectedTopologyId) ?? null;
  $: geometry = molecule ? geometryFor(molecule.id, selectedTopologyId) : null;

  // A molecule's full modes[] may hold several topology-specific entries for
  // "the same" conceptual vibration (see VibrationMode.topology) — keep only
  // the ones that apply to whichever topology is currently selected, then
  // sort by Herzberg index (ν₁, ν₂, ν₃…; modes with none sort last, stable
  // otherwise) — sorting explicitly rather than relying on authoring order,
  // since interleaving topology-specific entries makes "just author them in
  // the right order" unreliable once a molecule has more than one topology.
  const SUB_DIGITS: Record<string, string> = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
  function herzbergNumber(m: VibrationMode): number {
    if (!m.herzberg_notation) return Infinity;
    const digits = [...m.herzberg_notation].map(c => SUB_DIGITS[c] ?? '').join('');
    return digits ? parseInt(digits, 10) : Infinity;
  }
  $: filteredModes = molecule
    ? molecule.modes
        .filter(m => m.topology === null || m.topology === selectedTopologyId)
        .slice()
        .sort((a, b) => herzbergNumber(a) - herzbergNumber(b))
    : [];

  // Static at rest — only animate while a mode is actually hovered/focused.
  $: activeMode = previewModeId ? filteredModes.find(m => m.id === previewModeId) ?? null : null;
  $: activeVectors = (geometry && activeMode) ? geometry.modes[activeMode.id] ?? null : null;

  // mode.bands is a flat, fully-resolved list of band ids — already computed
  // by loader.py from each band's own vibration_modes link (plus a based_on
  // chase for combinations/overtones), so no branch_group indirection is
  // needed here at all.
  function bandsForMode(mode: VibrationMode): Band[] {
    const wanted = new Set(mode.bands);
    return bands.filter(b => wanted.has(b.id));
  }

  $: bandsByMode = Object.fromEntries(filteredModes.map(m => [m.id, bandsForMode(m)]));

  $: openMode = filteredModes.find(m => m.id === openModeId) ?? null;

  // Hand-derived Γvib for whichever topology is selected — see
  // moleculeGeometry.ts for why this isn't just the generic 3N-5/3N-6
  // atom-counting formula. Absent entirely for topologies no one has
  // worked through the character table for yet.
  $: symmetryAnalysis = molecule ? VIBRATIONAL_SYMMETRY[molecule.id]?.[selectedTopologyId] ?? null : null;

  // Γvib written out as a sum, e.g. "A₁ + E + 2T₂".
  $: symmetryFormula = symmetryAnalysis
    ? symmetryAnalysis.terms.map(t => `${t.count > 1 ? t.count : ''}${t.symbol}`).join(' + ')
    : '';

  // The same sum, but with each term's degeneracy multiplier spelled out
  // arithmetically (E always ×2, T/F always ×3, ...) rather than left
  // implicit in the symbol — e.g. "1×A₁ + 1×E(×2) + 2×T₂(×3) = 1+2+6 = 9".
  $: symmetryArithmetic = (() => {
    if (!symmetryAnalysis) return '';
    const pieces = symmetryAnalysis.terms.map(t => {
      const deg = mullikenDegeneracy(t.symbol);
      return deg > 1 ? `${t.count}×${t.symbol}(×${deg})` : `${t.count}×${t.symbol}`;
    });
    const products = symmetryAnalysis.terms.map(t => t.count * mullikenDegeneracy(t.symbol));
    const total = vibrationalModeTotal(symmetryAnalysis);
    return `${pieces.join(' + ')} = ${products.join('+')} = ${total} fundamental mode${total !== 1 ? 's' : ''}`;
  })();

  // Tally the dataset's own authored modes (for the selected topology) by
  // their symmetry label, and compare each against how many Γvib actually
  // calls for — a plain-text "is everything here" check, species by
  // species, rather than a single pass/fail count.
  interface SymmetryCoverage { symbol: string; expected: number; actual: number; ok: boolean; }
  $: symmetryCoverage = ((): SymmetryCoverage[] => {
    if (!symmetryAnalysis) return [];
    const actualCounts = new Map<string, number>();
    for (const m of filteredModes) {
      if (!m.symmetry) continue;
      actualCounts.set(m.symmetry, (actualCounts.get(m.symmetry) ?? 0) + 1);
    }
    return symmetryAnalysis.terms.map(t => {
      const actual = actualCounts.get(t.symbol) ?? 0;
      // A degenerate species can legitimately be authored either as one
      // entry per representation (e.g. CH4's E/T₂ modes) or as one entry
      // per individual degenerate component (e.g. CO2's Πᵤ bend, split
      // into in-plane + out-of-plane entries so each gets its own drawn
      // animation) — both count as "fully listed", just two different
      // authoring conventions for the same physical content.
      const deg = mullikenDegeneracy(t.symbol);
      const ok = actual === t.count || actual === t.count * deg;
      return { symbol: t.symbol, expected: t.count, actual, ok };
    });
  })();

  function selectMolecule(id: string) {
    selectedMoleculeId = id;
    selectedTopologyId = orderedMolecules.find(m => m.id === id)?.topologies[0]?.id ?? '';
    previewModeId = null;
    openModeId = null;
  }

  // Switching topology can make the currently-open mode (a topology-specific
  // entry) no longer applicable — close the panel rather than keep showing
  // a mode that doesn't belong to what's now selected.
  function selectTopology(id: string) {
    if (openMode && openMode.topology !== null && openMode.topology !== id) {
      openModeId = null;
    }
    selectedTopologyId = id;
    previewModeId = null;
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
      <p class="notation-note">
        Where a mode's Herzberg index (ν₁, ν₂, ν₃…) is shown alongside its
        localized label, this page always assigns it by the standard
        convention: normal modes of a given molecule are numbered
        consecutively, by <em>decreasing</em> frequency within each symmetry
        species, starting from the totally symmetric species and moving to
        the non-totally-symmetric ones last. Real papers don't always follow
        this strictly — Solis et al.'s own published figure for monodentate
        carbonate, the physical source for that topology's modes below,
        numbers them in a different order (their own ν₁ is actually its
        lowest-frequency mode, not its highest) — but this page re-assigns
        the index to the standard convention rather than reproducing a
        source's own non-standard numbering, so the index here can differ
        from what a cited figure itself prints.
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

    {#if molecule}
      <TopologySelector
        topologies={molecule.topologies}
        selectedId={selectedTopologyId}
        on:select={(e) => selectTopology(e.detail.id)}
      />
    {/if}

    {#if molecule && geometry}
      <div class="content-row">
        <div class="main-col">
          <div class="viewer-row">
            <h2 class="molecule-title">{molecule.label}</h2>
            {#if symmetryAnalysis}
              <div class="symmetry-block">
                <p class="symmetry-line">
                  {symmetryAnalysis.pointCloud}
                  {#if selectedTopology?.point_group}
                    <span class="point-group">Point group {@html selectedTopology.point_group}.</span>
                  {/if}
                </p>
                <p class="symmetry-line">
                  Γ<sub>vib</sub> = {@html symmetryFormula} → {@html symmetryArithmetic}.
                </p>
                <p class="symmetry-line symmetry-coverage">
                  {#each symmetryCoverage as c, i}
                    {@html c.symbol} {c.ok ? '✓' : '✗'} ({c.actual}/{c.expected} listed){i < symmetryCoverage.length - 1 ? ', ' : ''}
                  {/each}
                  {#if symmetryCoverage.every(c => c.ok)}
                    — every Mulliken species accounted for.
                  {:else}
                    — not yet fully accounted for.
                  {/if}
                </p>
              </div>
            {:else if selectedTopology?.point_group}
              <p class="symmetry-line">
                <span class="point-group">Point group {@html selectedTopology.point_group}.</span>
              </p>
            {/if}
            <div class="viewer-inner">
              <div class="diagram-col">
                <MoleculeViewer {geometry} {activeVectors} />
              </div>
              <ModeList
                modes={filteredModes}
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
            on:navigateBand
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
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 10px;
    border-radius: 12px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 23px;
    font-weight: 700;
    color: #222;
    margin: 0 0 8px 0;
  }

  .intro {
    margin: 0 0 16px 0;
    font-size: 14.5px;
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
    font-size: 13.5px;
    color: #444;
    cursor: pointer;
  }

  .notation-toggle:hover { background: #F0F0F0; }

  .chevron {
    display: inline-block;
    font-size: 10px;
    transition: transform 0.15s ease;
  }

  .chevron.open { transform: rotate(90deg); }

  .notation-list {
    margin: 8px 0 0;
    padding: 14px 18px;
    background: #FAFAFA;
    border: 1px solid #E5E5E5;
    border-radius: 6px;
    font-size: 13.5px;
  }

  .notation-header {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    margin-bottom: 8px;
  }

  .notation-subheader {
    font-weight: 700;
    font-size: 14px;
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
    font-size: 13.5px;
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
    font-size: 12.5px;
    color: #777;
    line-height: 1.55;
    max-width: 760px;
  }

  .empty {
    font-size: 15px;
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

  .molecule-title {
    font-size: 19px;
    font-weight: 700;
    color: #222;
    margin: 0 0 6px;
  }

  .symmetry-block {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #E5E5E5;
  }

  .symmetry-line {
    font-size: 13px;
    color: #777;
    line-height: 1.5;
    margin: 0 0 4px;
  }
  .symmetry-line:last-child { margin-bottom: 0; }
  .symmetry-line :global(sub) { font-size: 0.75em; }

  .symmetry-coverage {
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .point-group {
    color: #999;
    margin-left: 4px;
  }
  .point-group :global(sub) { font-size: 0.75em; }

  .viewer-inner {
    display: flex;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
  }

  .diagram-col {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
  }
</style>

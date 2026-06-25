<script lang="ts">
  import type { Band, BandReference, GroupMap, RefMap, Vibrations, Molecule, VibrationMode } from '../lib/types';
  import { TAG_STYLES, DEFAULT_TAG_STYLE } from '../lib/colors';
  import { esc, ieeeHtml, refSortKey } from '../lib/citations';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  export let vibrations: Vibrations;
  export let sortedGroupKeys: string[];
  export let viewMode: 'by-ref' | 'by-group';

  let open = new Set<string>();

  function toggleOpen(id: string) {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    open = next;
  }

  // ---- Formatting helpers ----

  function bandNameHtml(b: Band): string {
    if (b.short) return b.short;
    const sub    = b.vibration.subtype  ? ` ${esc(b.vibration.subtype)}`  : '';
    const branch = b.vibration.branch   ? ` ${esc(b.vibration.branch)}`   : '';
    return `${esc(b.species)}${sub} ${esc(b.vibration.category)}${branch}`;
  }

  function siteList(ref: BandReference): string[] {
    if (!ref.site) return [];
    return Array.isArray(ref.site) ? ref.site : [ref.site];
  }

  function wnList(ref: BandReference): number[] {
    if (ref.wn == null) return [];
    return Array.isArray(ref.wn) ? ref.wn : [ref.wn];
  }

  function qualityTags(b: Band): string[] {
    return [
      b.intensity  && b.intensity,
      b.confidence && b.confidence,
      b.width      && b.width,
    ].filter(Boolean) as string[];
  }

  // A mode's own characteristic wavenumber — same convention as
  // ModeList.svelte/ModeDetailPanel.svelte: a single value (with a "~"
  // prefix) or a range, independent of any band's own position.
  function modeWnLabel(m: VibrationMode): string | null {
    if (m.wn_start == null) return null;
    if (m.wn_end == null) return `~${m.wn_start} cm⁻¹`;
    return `${m.wn_start}–${m.wn_end} cm⁻¹`;
  }

  function topologyLabel(molecule: Molecule, mode: VibrationMode): string | null {
    if (!mode.topology) return null;
    return molecule.topologies.find(t => t.id === mode.topology)?.long ?? mode.topology;
  }

  // Every (molecule, mode) pair that cites at least one reference — built
  // once and reused by both views below, the same way `bands` already
  // carries its own references regardless of which view is showing.
  interface ModeRef { molecule: Molecule; mode: VibrationMode; }
  $: modeRefEntries = (() => {
    const map = new Map<string, ModeRef[]>();
    for (const molecule of vibrations?.molecules ?? []) {
      for (const mode of molecule.modes) {
        for (const key of mode.reference) {
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({ molecule, mode });
        }
      }
    }
    return map;
  })();

  // Group a refKey's citing modes by molecule, in vibrations.json's own
  // molecule order — mirrors how groupBands below groups citing bands by
  // chart group.
  function moleculeModesFor(refKey: string): { molecule: Molecule; modes: VibrationMode[] }[] {
    const entries = modeRefEntries.get(refKey) ?? [];
    const byMolecule = new Map<string, { molecule: Molecule; modes: VibrationMode[] }>();
    for (const e of entries) {
      if (!byMolecule.has(e.molecule.id)) byMolecule.set(e.molecule.id, { molecule: e.molecule, modes: [] });
      byMolecule.get(e.molecule.id)!.modes.push(e.mode);
    }
    return [...byMolecule.values()];
  }

  // ---- By-reference view data ----
  interface BandRef    { band: Band; ref: BandReference; }
  interface GroupBands { key: string; label: string; color: string; entries: BandRef[]; }
  interface MoleculeModes { molecule: Molecule; modes: VibrationMode[]; }
  interface ByRefItem  { refKey: string; html: string; groupBands: GroupBands[]; moleculeModes: MoleculeModes[]; }

  $: byRefItems = (() => {
    if (!refs) return [] as ByRefItem[];
    const refEntries = new Map<string, BandRef[]>();
    for (const b of bands) {
      for (const ref of b.references) {
        if (!refEntries.has(ref.key)) refEntries.set(ref.key, []);
        refEntries.get(ref.key)!.push({ band: b, ref });
      }
    }
    // Union of every key cited by a band OR by a mode — a mode-only
    // citation (no band links to it at all) still needs its own card.
    const allKeys = new Set([...refEntries.keys(), ...modeRefEntries.keys()]);
    return [...allKeys]
      .sort((a, b) => refSortKey(refs![a] ?? {}).localeCompare(refSortKey(refs![b] ?? {})))
      .map(rk => {
        const byGroup = new Map<string, BandRef[]>();
        for (const e of (refEntries.get(rk) ?? [])) {
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
        return { refKey: rk, html: ieeeHtml(refs![rk] ?? {}, rk), groupBands, moleculeModes: moleculeModesFor(rk) };
      });
  })();

  // ---- By-group view data ----
  interface ByRefEntry  { refKey: string; html: string; entries: BandRef[]; moleculeModes: MoleculeModes[]; }
  interface ByGroupItem { key: string; label: string; color: string; refs: ByRefEntry[]; }

  $: byGroupItems = (() => {
    if (!refs) return [] as ByGroupItem[];
    return sortedGroupKeys
      .map(gk => {
        const gb = bands.filter(b => b.group === gk && b.references.length > 0);
        // Modes whose owning molecule is itself filed under this chart
        // group, even if the molecule has no real band linked at all (e.g.
        // a mode-only citation) — same band_groups field the vibration-
        // modes page itself uses to order molecules against this list.
        const groupModeKeys = new Set<string>();
        for (const molecule of vibrations?.molecules ?? []) {
          if (!molecule.band_groups.includes(gk)) continue;
          for (const mode of molecule.modes) for (const key of mode.reference) groupModeKeys.add(key);
        }
        if (!gb.length && !groupModeKeys.size) return null;
        const refMap = new Map<string, BandRef[]>();
        for (const b of gb) {
          for (const ref of b.references) {
            if (!refMap.has(ref.key)) refMap.set(ref.key, []);
            refMap.get(ref.key)!.push({ band: b, ref });
          }
        }
        const allKeys = new Set([...refMap.keys(), ...groupModeKeys]);
        const refEntries: ByRefEntry[] = [...allKeys]
          .sort((a, b) => refSortKey(refs![a] ?? {}).localeCompare(refSortKey(refs![b] ?? {})))
          .map(rk => ({
            refKey: rk,
            html:   ieeeHtml(refs![rk] ?? {}, rk),
            entries: (refMap.get(rk) ?? []).sort((a, b) => b.band.wn_max - a.band.wn_max),
            moleculeModes: moleculeModesFor(rk).filter(mm => mm.molecule.band_groups.includes(gk)),
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
      <div class="ref-card" id="refcard-{item.refKey}">
        <div class="ref-card-citation">{@html item.html}</div>
        {#each item.groupBands as g (g.key)}
          <div class="group-section">
            <div class="group-label" style="color:{g.color}">{g.label}</div>
            {#each g.entries as e (`${e.band.id}|${wnList(e.ref).join(',')}|${Array.isArray(e.ref.site) ? e.ref.site[0] : (e.ref.site ?? '')}`)}
              {@const id = `r-${item.refKey}-${e.band.id}-${wnList(e.ref).join(',')}`}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                <div class="band-row-line">
                  <span class="band-name">{@html bandNameHtml(e.band)}</span>
                  {#if e.ref.wn != null}
                    {#each wnList(e.ref) as w}
                      <span class="badge-wn">{w} cm⁻¹</span>
                    {/each}
                  {:else}
                    <span class="badge-wn">{e.band.wn_min}–{e.band.wn_max} cm⁻¹</span>
                  {/if}
                  {#each siteList(e.ref) as s}
                    <span class="badge-site">{s}</span>
                  {/each}
                  {#each qualityTags(e.band) as tag}
                    <span class="badge-quality">{tag}</span>
                  {/each}
                  {#each e.ref.tags as tag}
                    {@const style = TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}
                    <span class="badge-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                  {/each}
                  <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                </div>
                {#if open.has(id)}
                  <div class="band-expand">
                    {#if e.band.description}
                      <div class="expand-desc">{@html e.band.description}</div>
                    {/if}
                    {#if e.ref.wn != null}
                      <div class="expand-note">range: {e.band.wn_min}–{e.band.wn_max} cm⁻¹</div>
                    {/if}
                    {#if e.ref.note}
                      <div class="expand-note">{e.ref.note}</div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
        {#each item.moleculeModes as mm (mm.molecule.id)}
          <div class="group-section">
            <div class="group-label mode-group-label">{mm.molecule.label} — vibration modes</div>
            {#each mm.modes as mode (mode.id)}
              {@const id = `rm-${item.refKey}-${mode.id}`}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                <div class="band-row-line">
                  <span class="band-name">{mode.label}</span>
                  {#if mode.herzberg_notation}
                    <span class="badge-quality">{mode.herzberg_notation}</span>
                  {/if}
                  {#if topologyLabel(mm.molecule, mode)}
                    <span class="badge-site">{topologyLabel(mm.molecule, mode)}</span>
                  {/if}
                  {#if modeWnLabel(mode)}
                    <span class="badge-wn">{modeWnLabel(mode)}</span>
                  {/if}
                  <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                </div>
                {#if open.has(id) && mode.note}
                  <div class="band-expand">
                    <div class="expand-desc">{mode.note}</div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {/each}

  {:else}
    <!-- ── By group ── -->
    {#each byGroupItems as g (g.key)}
      <div class="group-card" style="--group-color:{g.color}; border-left-color:{g.color}">
        <div class="group-card-header" style="color:{g.color}; border-bottom-color:{g.color}22">{g.label}</div>
        {#each g.refs as r (r.refKey)}
          <div class="ref-sub-card">
            <div class="ref-sub-citation">{@html r.html}</div>
            {#each r.entries as e (`${e.band.id}|${wnList(e.ref).join(',')}|${Array.isArray(e.ref.site) ? e.ref.site[0] : (e.ref.site ?? '')}`)}
              {@const id = `g-${g.key}-${r.refKey}-${e.band.id}-${wnList(e.ref).join(',')}`}
              <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
              <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                <div class="band-row-line">
                  <span class="band-name">{@html bandNameHtml(e.band)}</span>
                  {#if e.ref.wn != null}
                    {#each wnList(e.ref) as w}
                      <span class="badge-wn">{w} cm⁻¹</span>
                    {/each}
                  {:else}
                    <span class="badge-wn">{e.band.wn_min}–{e.band.wn_max} cm⁻¹</span>
                  {/if}
                  {#each siteList(e.ref) as s}
                    <span class="badge-site">{s}</span>
                  {/each}
                  {#each qualityTags(e.band) as tag}
                    <span class="badge-quality">{tag}</span>
                  {/each}
                  {#each e.ref.tags as tag}
                    {@const style = TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}
                    <span class="badge-ref-tag" style="background:{style.background};border-color:{style.border};color:{style.color}">{tag}</span>
                  {/each}
                  <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                </div>
                {#if open.has(id)}
                  <div class="band-expand">
                    {#if e.band.description}
                      <div class="expand-desc">{@html e.band.description}</div>
                    {/if}
                    {#if e.ref.wn != null}
                      <div class="expand-note">range: {e.band.wn_min}–{e.band.wn_max} cm⁻¹</div>
                    {/if}
                    {#if e.ref.note}
                      <div class="expand-note">{e.ref.note}</div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
            {#each r.moleculeModes as mm (mm.molecule.id)}
              <div class="mode-subgroup">
                <div class="group-label mode-group-label">{mm.molecule.label} — vibration modes</div>
                {#each mm.modes as mode (mode.id)}
                  {@const id = `gm-${g.key}-${r.refKey}-${mode.id}`}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
                  <div class="band-row" on:click={() => toggleOpen(id)} aria-expanded={open.has(id)}>
                    <div class="band-row-line">
                      <span class="band-name">{mode.label}</span>
                      {#if mode.herzberg_notation}
                        <span class="badge-quality">{mode.herzberg_notation}</span>
                      {/if}
                      {#if topologyLabel(mm.molecule, mode)}
                        <span class="badge-site">{topologyLabel(mm.molecule, mode)}</span>
                      {/if}
                      {#if modeWnLabel(mode)}
                        <span class="badge-wn">{modeWnLabel(mode)}</span>
                      {/if}
                      <span class="expand-arrow">{open.has(id) ? '▾' : '▸'}</span>
                    </div>
                    {#if open.has(id) && mode.note}
                      <div class="band-expand">
                        <div class="expand-desc">{mode.note}</div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
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
    font-size: 14px;
    line-height: 1.55;
  }

  /* ── Shared badge styles (mirror tooltip) ── */
  .badge-wn {
    background: #dbeafe;
    border: 1px solid #93c5fd;
    color: #1d4ed8;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    font-family: 'Courier New', monospace;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .badge-site {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    color: #78350f;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 11.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .badge-quality {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    color: #555;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .badge-ref-tag {
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Band row (shared) ── */
  .band-row {
    cursor: pointer;
    border-radius: 3px;
    margin: 1px 0;
  }
  .band-row:hover { background: rgba(0,0,0,0.04); }

  .band-row-line {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
    padding: 3px 4px;
  }

  .band-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #222;
    margin-right: 2px;
  }
  .band-name :global(sub), .band-name :global(sup) { font-size: 0.75em; }

  .expand-arrow {
    font-size: 10px;
    color: #aaa;
    margin-left: auto;
    flex-shrink: 0;
    padding-left: 4px;
  }

  .band-expand {
    padding: 2px 4px 6px 8px;
    border-left: 2px solid #e5e7eb;
    margin: 0 4px 3px 4px;
  }

  .expand-desc {
    font-size: 12.5px;
    color: #555;
    line-height: 1.4;
  }
  .expand-desc :global(sub), .expand-desc :global(sup) { font-size: 0.75em; }

  .expand-note {
    font-size: 12px;
    color: #8a7a4a;
    font-style: italic;
    margin-top: 2px;
    line-height: 1.35;
  }

  /* ── By-reference view ── */
  .ref-card {
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 6px;
    padding: 14px 16px 10px;
    margin-bottom: 14px;
    scroll-margin-top: 16px;
  }

  .ref-card-citation {
    font-size: 13.5px;
    font-weight: 600;
    color: #222;
    line-height: 1.55;
    margin-bottom: 8px;
  }
  .ref-card-citation :global(em) { font-style: italic; }
  .ref-card-citation :global(a.ext) { color: #a08050; text-decoration: none; font-size: 12px; }
  .ref-card-citation :global(a.ext:hover) { color: #5a3e1b; }

  .group-section { margin-top: 7px; }

  .group-label {
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
    opacity: 0.9;
  }

  /* Vibration-mode citations get their own neutral color (not tied to any
     chart group, since a mode isn't a band) rather than reusing g.color. */
  .mode-group-label { color: #6b5b95; }

  .mode-subgroup { margin-top: 7px; }

  /* ── By-group view ── */
  .group-card {
    border: 1px solid #e5e5e5;
    border-left: 4px solid #888;
    border-radius: 6px;
    padding: 14px 16px 10px;
    margin-bottom: 20px;
    background: #fff;
  }

  .group-card-header {
    font-size: 21px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
    padding-bottom: 7px;
    border-bottom: 1px solid #eee;
  }

  .ref-sub-card {
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 4px;
    padding: 10px 12px 7px;
    margin-bottom: 10px;
  }

  .ref-sub-citation {
    font-size: 13px;
    font-weight: 600;
    color: #222;
    line-height: 1.5;
    margin-bottom: 6px;
  }
  .ref-sub-citation :global(em) { font-style: italic; }
  .ref-sub-citation :global(a.ext) { color: #a08050; text-decoration: none; font-size: 12px; }
  .ref-sub-citation :global(a.ext:hover) { color: #5a3e1b; }
</style>

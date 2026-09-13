<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  /** Live scope line: what the atlas currently covers, and how much of it. */
  export let bandCount = 0;
  export let referenceCount = 0;
  /**
   * Claims, not bands: one row per (band, source), so a band four papers
   * disagree about counts four times. It is the honest measure of how much
   * reading is actually in here, and it is always the largest of the three.
   */
  export let assignmentCount = 0;

  const dispatch = createEventDispatcher<{ navigate: { page: string } }>();
</script>

<main class="home">
  <div class="hero">
    <h1 class="hero-title">Spectral Band Atlas</h1>
    <p class="hero-tagline">Vibrational spectroscopy &middot; infrared and Raman</p>
    <p class="hero-desc">
      On a working catalyst or in a bulk fluid, every band overlaps something else. This
      atlas tells them apart: what each one is, what it was measured on, and who
      reported it.
    </p>
    <p class="hero-what">
      It covers the CO₂-to-methanol and RWGS/methanation story: the gases that go in
      and come out, the formate, carbonate, bicarbonate and methoxy that appear on the
      way, CO on metals and on cations, the support hydroxyls, and the water. Both
      infrared and Raman, gas-phase and adsorbed.
    </p>
    <p class="hero-scope">
      {#if bandCount}{bandCount} bands &middot; {assignmentCount} assignments &middot; {referenceCount} sources{/if}
    </p>
  </div>

  <div class="cards">
    <!-- Knowledge -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'knowledge' })}>
      <div class="card-icon" style="background:var(--accent-green-bg); color:var(--accent-green-fg)">
        <!-- A brain: two lobes over a stem, with the fold down the middle. -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
          <path d="M12 5.5a3 3 0 0 0-5.6-1.4A2.7 2.7 0 0 0 3.6 8a3 3 0 0 0 .5 4.6A2.9 2.9 0 0 0 6 17.4a3 3 0 0 0 6 .6z"/>
          <path d="M12 5.5a3 3 0 0 1 5.6-1.4A2.7 2.7 0 0 1 20.4 8a3 3 0 0 1-.5 4.6A2.9 2.9 0 0 1 18 17.4a3 3 0 0 1-6 .6z"/>
          <path d="M12 5.5V21"/>
        </svg>
      </div>
      <h2 class="card-title">Knowledge</h2>
      <p class="card-desc">
        What the spectra mean: Fermi resonance, isotopic shifts, rotational branches and
        the rest, each pointing back at the bands in this atlas that show it.
      </p>
      <span class="card-cta" style="color:var(--accent-green-fg)">Open knowledge →</span>
    </button>

    <!-- Band Chart -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'chart' })}>
      <div class="card-icon" style="background:var(--accent-blue-bg); color:var(--accent-blue-fg)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
      <h2 class="card-title">Band Chart</h2>
      <p class="card-desc">
        Interactive spectral map with zoom, pan, group filtering, and per-band
        reference tooltips. Color by group, vibration type, atoms, or citation count.
      </p>
      <span class="card-cta" style="color:var(--accent-blue-fg)">Open chart →</span>
    </button>

    <!-- References -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'references' })}>
      <div class="card-icon" style="background:var(--accent-amber-bg); color:var(--accent-amber-fg)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="8" y1="7" x2="16" y2="7"/>
          <line x1="8" y1="11" x2="16" y2="11"/>
          <line x1="8" y1="15" x2="12" y2="15"/>
        </svg>
      </div>
      <h2 class="card-title">References</h2>
      <p class="card-desc">
        Every source behind the assignments. Group by source, group, site, sample,
        element or technique, narrow to one kind of measurement, and read what each
        one actually reported.
      </p>
      <span class="card-cta" style="color:var(--accent-amber-fg)">Open references →</span>
    </button>

    <!-- Dataset -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'datamodel' })}>
      <div class="card-icon" style="background:var(--accent-red-bg); color:var(--accent-red-fg)">
        <!-- Stacked records, the usual shorthand for a dataset. -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
          <ellipse cx="12" cy="5" rx="8" ry="3"/>
          <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/>
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>
        </svg>
      </div>
      <h2 class="card-title">Dataset</h2>
      <p class="card-desc">
        Browse what is in the atlas: molecules and their modes, species, sites and
        samples, techniques and tags. Plus the structure holding it together.
      </p>
      <span class="card-cta" style="color:var(--accent-red-fg)">Open dataset →</span>
    </button>
  </div>
</main>

<style>
  .home {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 52px 48px 60px;
    box-sizing: border-box;
    background: var(--surface-slate);
  }

  .hero {
    text-align: center;
    margin-bottom: 48px;
    max-width: 580px;
  }

  .hero-title {
    font-size: 37px;
    font-weight: 800;
    font-style: italic;
    color: var(--brand-900);
    letter-spacing: -0.015em;
    margin: 0 0 8px;
  }

  .hero-tagline {
    font-size: 15px;
    color: var(--ink-slate-300);
    font-style: italic;
    margin: 0 0 16px;
    letter-spacing: 0.01em;
  }

  .hero-desc {
    font-size: 14.5px;
    color: var(--ink-slate-700);
    line-height: 1.65;
    margin: 0;
  }

  /* What is actually in scope, under the framing and above the counts. Reads
     as prose rather than as a list, because the list would go stale the first
     time a family is added. */
  .hero-what {
    font-size: 13.5px;
    color: var(--ink-slate-300);
    line-height: 1.6;
    margin: 14px 0 0;
  }

  /* Deliberately quiet: the scope will widen, the framing above it will not. */
  .hero-scope {
    margin: 14px 0 0;
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  /* Four destinations in one row where there is room for it, so the whole
     atlas is one glance. It steps down to 2x2 and then to a stack rather than
     letting a flex row wrap unevenly. Column width lands near the 265px the
     cards were designed at. */
  .cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 22px;
    justify-content: center;
    max-width: 1120px;
    width: 100%;
  }

  @media (max-width: 1240px) {
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 760px; }
  }

  @media (max-width: 720px) {
    .cards { grid-template-columns: 1fr; max-width: 340px; }
  }

  .card {
    /* Grid cells now, so the card fills its column instead of sizing itself. */
    max-width: none;
    min-height: var(--card-h);
    box-sizing: border-box;
    background: var(--surface);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-xl);
    padding: 28px 22px 22px;
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 13px;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    outline: none;
    transition: box-shadow 0.18s ease, transform 0.15s ease, border-color 0.18s ease;
  }

  .card:hover {
    box-shadow: var(--shadow-card);
    transform: translateY(-3px);
    border-color: var(--line-slate-strong);
  }

  .card:focus-visible {
    outline: 2px solid var(--brand-500);
    outline-offset: 3px;
  }

  .card-icon {
    width: 54px;
    height: 54px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-title {
    font-size: var(--t-card-title-size);
    font-weight: var(--t-card-title-weight);
    color: var(--t-card-title-color);
    margin: 0;
  }

  .card-desc {
    font-size: var(--t-card-desc-size);
    color: var(--t-card-desc-color);
    line-height: var(--t-card-desc-lh);
    margin: 0;
    flex: 1;
  }

  .card-cta {
    font-size: var(--t-card-cta-size);
    font-weight: var(--t-card-cta-weight);
  }
</style>

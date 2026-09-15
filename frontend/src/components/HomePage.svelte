<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  // The same drawings the collapsed sidebar uses, so a reader who learns a
  // symbol here recognises it in the rail.
  import Icon from './Icon.svelte';

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
  </div>

  {#if bandCount}
    <!-- How much is in here, before anything is clicked. Claims are the
         largest of the three and the one worth reading twice: a band four
         papers disagree about is counted four times. -->
    <div class="scope">
      <div class="stat">
        <span class="stat-n">{bandCount}</span>
        <span class="stat-l">bands</span>
      </div>
      <div class="stat">
        <span class="stat-n">{assignmentCount}</span>
        <span class="stat-l">assignments</span>
      </div>
      <div class="stat">
        <span class="stat-n">{referenceCount}</span>
        <span class="stat-l">sources</span>
      </div>
    </div>
  {/if}

  <div class="cards">
    <!-- Knowledge -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'knowledge' })}>
      <div class="card-icon" style="background:var(--accent-green-bg); color:var(--accent-green-fg)">
        <Icon name="knowledge" size={30} width={1.7} />
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
        <Icon name="chart" size={30} width={2} />
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
        <Icon name="references" size={30} width={2} />
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
        <Icon name="dataset" size={30} width={1.8} />
      </div>
      <h2 class="card-title">Dataset</h2>
      <p class="card-desc">
        Browse what is in the atlas: molecules and their modes, species, sites and
        samples, techniques and tags. Plus the structure holding it together.
      </p>
      <span class="card-cta" style="color:var(--accent-red-fg)">Open dataset →</span>
    </button>
  </div>

  <p class="hero-what">
    It covers the CO₂-to-methanol and RWGS/methanation story: the gases that go in
    and come out, the formate, carbonate, bicarbonate and methoxy that appear on the
    way, CO on metals and on cations, the support hydroxyls, and the water. Both
    infrared and Raman, gas-phase and adsorbed.
  </p>
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
    margin-bottom: 30px;
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

  /* What is actually in scope. It sits under the cards because it is a note
     on what is covered rather than something to get past on the way to them,
     and it reads as prose rather than as a list, because the list would go
     stale the first time a family is added. */
  .hero-what {
    max-width: 700px;
    text-align: center;
    font-size: 13.5px;
    color: var(--ink-slate-300);
    line-height: 1.6;
    margin: 34px 0 0;
  }

  /* How much is in here. Three numbers, large, above the cards: the size of
     the thing is the second fact about it after what it is. */
  .scope {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 56px;
    margin-bottom: 42px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-n {
    font-size: var(--t-stat-size);
    font-weight: var(--t-stat-weight);
    color: var(--t-stat-color);
    letter-spacing: var(--t-stat-ls);
    line-height: var(--t-stat-lh);
    font-variant-numeric: tabular-nums;
  }

  .stat-l {
    font-size: var(--t-stat-label-size);
    font-weight: var(--t-stat-label-weight);
    color: var(--t-stat-label-color);
    text-transform: var(--t-stat-label-tt);
    letter-spacing: var(--t-stat-label-ls);
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

  @container content (max-width: 1000px) {
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 760px; }
  }

  @container content (max-width: 500px) {
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

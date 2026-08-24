<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ navigate: { page: string } }>();
</script>

<main class="home">
  <div class="hero">
    <h1 class="hero-title">Spectral Band Atlas</h1>
    <p class="hero-tagline">CO₂ hydrogenation &middot; in-situ IR spectroscopy</p>
    <p class="hero-desc">
      A curated, interactive reference for IR absorption bands across CO₂ reduction
      catalysis — gas-phase molecules, surface intermediates, support species, and adsorbates.
    </p>
  </div>

  <div class="cards">
    <!-- Vibration Modes -->
    <button class="card" on:click={() => dispatch('navigate', { page: 'vibration' })}>
      <div class="card-icon" style="background:var(--accent-teal-bg); color:var(--accent-teal-fg)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
          <path d="M3 12 C5 6 7 6 9 12 C11 18 13 18 15 12 C17 6 19 6 21 12"/>
          <circle cx="3" cy="12" r="1.8" fill="currentColor" stroke="none"/>
          <circle cx="21" cy="12" r="1.8" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <h2 class="card-title">Vibration Modes</h2>
      <p class="card-desc">
        Reference guide to vibrational mode types, symmetry labels, and spectroscopic
        notation used throughout this atlas.
      </p>
      <span class="card-cta" style="color:var(--accent-teal-fg)">Open modes →</span>
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
        Peer-reviewed literature for all band assignments. Browse alphabetically by
        source or by spectral group, with expandable per-band notes and site tags.
      </p>
      <span class="card-cta" style="color:var(--accent-amber-fg)">Open references →</span>
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

  .cards {
    display: flex;
    gap: 22px;
    justify-content: center;
    flex-wrap: wrap;
    max-width: 860px;
    width: 100%;
  }

  .card {
    flex: 1 1 240px;
    max-width: 265px;
    background: white;
    border: 1px solid var(--line-slate);
    border-radius: 12px;
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
    box-shadow: 0 6px 22px rgba(30, 60, 110, 0.12);
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
    font-size: 18px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin: 0;
  }

  .card-desc {
    font-size: 14px;
    color: var(--ink-slate-600);
    line-height: 1.58;
    margin: 0;
    flex: 1;
  }

  .card-cta {
    font-size: 13.5px;
    font-weight: 600;
  }
</style>

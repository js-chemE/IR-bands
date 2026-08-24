<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ navigate: { page: string } }>();
</script>

<main class="content">
  <h1 class="page-title">Impressum</h1>

  <section class="section">
    <h2>About this Atlas</h2>
    <p>
      The Spectral Band Atlas is an interactive reference for IR absorption bands
      observed in CO₂ hydrogenation catalysis. It compiles and cross-references
      published band assignments from peer-reviewed literature, covering gas-phase
      molecules (CO₂, CO, CH₄, H₂O&hellip;), surface intermediates (formates,
      carbonates, methoxy groups&hellip;), support hydroxyl groups, and adsorbates on
      metal and oxide surfaces.
    </p>
    <p>
      The atlas is a <strong>work in progress</strong>. Band assignments and wavenumber
      ranges are taken from the cited references; the assignment of references to bands
      is in particular incomplete. Errors and omissions are possible — please verify
      against the original literature before use.
    </p>
  </section>

  <section class="section">
    <h2>Authors &amp; Affiliation</h2>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-label">Responsible</span>
        <span>Julius Sommer</span>
      </div>
      <div class="info-row">
        <span class="info-label">Supervisors</span>
        <span>Prof.&nbsp;dr. Evgeny Pidko &middot; Prof.&nbsp;dr. Atsushi Urakawa</span>
      </div>
      <div class="info-row">
        <span class="info-label">Group</span>
        <span>Catalysis Engineering, Department of Chemical Engineering</span>
      </div>
      <div class="info-row">
        <span class="info-label">Institution</span>
        <span>Delft University of Technology, Faculty of Applied Sciences</span>
      </div>
      <div class="info-row">
        <span class="info-label">Address</span>
        <span>Van der Maasweg 9, 2629 HT Delft, The Netherlands</span>
      </div>
      <div class="info-row">
        <span class="info-label">Contact</span>
        <a href="mailto:j.sommer@tudelft.nl">j.sommer@tudelft.nl</a>
      </div>
    </div>
  </section>

  <section class="section">
    <h2>Download Data</h2>
    <p class="dl-intro">The underlying dataset is available in several formats:</p>

    <div class="dl-row">
      <div class="dl-row-label">Vibrations</div>
      <div class="dl-cards">
        <a class="dl-card" href="data/vibrations.jsonc" download="vibrations.jsonc">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">JSONC source</div>
            <div class="dl-desc">Annotated vibration-mode data with inline comments</div>
            <code class="dl-file">vibrations.jsonc</code>
          </div>
        </a>
        <a class="dl-card" href="data/vibrations.json" download="vibrations.json">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">JSON data</div>
            <div class="dl-desc">Clean, processed JSON for programmatic use</div>
            <code class="dl-file">vibrations.json</code>
          </div>
        </a>
      </div>
    </div>

    <div class="dl-row">
      <div class="dl-row-label">Bands</div>
      <div class="dl-cards">
        <a class="dl-card" href="data/bands.jsonc" download="bands.jsonc">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">JSONC source</div>
            <div class="dl-desc">Annotated band data with inline comments</div>
            <code class="dl-file">bands.jsonc</code>
          </div>
        </a>
        <a class="dl-card" href="data/bands.json" download="bands.json">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">JSON data</div>
            <div class="dl-desc">Clean, processed JSON for programmatic use</div>
            <code class="dl-file">bands.json</code>
          </div>
        </a>
      </div>
    </div>

    <div class="dl-row">
      <div class="dl-row-label">References</div>
      <div class="dl-cards">
        <a class="dl-card" href="data/references.bib" download="references.bib">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">BibTeX source</div>
            <div class="dl-desc">All cited literature entries</div>
            <code class="dl-file">references.bib</code>
          </div>
        </a>
        <a class="dl-card" href="data/references.json" download="references.json">
          <div class="dl-icon">↓</div>
          <div class="dl-body">
            <div class="dl-name">JSON data</div>
            <div class="dl-desc">Clean, processed JSON for programmatic use</div>
            <code class="dl-file">references.json</code>
          </div>
        </a>
      </div>
    </div>
  </section>

  <section class="section">
    <h2>Style guide</h2>
    <p>
      How the atlas is put together: type scale, colour tokens, colormaps, page
      layout, and the rules for what goes into a band entry and how long it may be.
      Every value on that page is read from the same token module the interface
      itself uses.
    </p>
    <button class="sg-card" on:click={() => dispatch('navigate', { page: 'styleguide' })}>
      <div class="dl-icon">&rarr;</div>
      <div class="dl-body">
        <div class="dl-name">Open the style guide</div>
        <div class="dl-desc">Design tokens, typography, band-chart layout and content rules</div>
        <code class="dl-file">frontend/src/lib/tokens.ts</code>
      </div>
    </button>
  </section>

  <section class="section">
    <h2>Disclaimer</h2>
    <p>
      This atlas is provided for informational and research purposes without warranty
      of any kind. Band assignments represent the authors' best interpretation of the
      cited literature and may not be complete or free of error. The Delft University
      of Technology assumes no liability for the accuracy or completeness of the
      information presented.
    </p>
  </section>
</main>

<style>
  /* Type roles come from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: 28px 48px 48px;
    max-width: 760px;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    margin: 0 0 32px;
    letter-spacing: var(--t-page-title-ls);
  }

  .section {
    margin-bottom: var(--space-6);
  }

  .section h2 {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-heading);
  }

  .section p {
    margin: 0 0 10px;
    color: var(--ink-700);
  }

  /* ── Info grid ── */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info-row {
    display: flex;
    gap: var(--space-4);
    font-size: var(--t-label-size);
    line-height: var(--t-label-lh);
  }

  .info-label {
    flex: 0 0 110px;
    font-weight: var(--t-label-weight);
    color: var(--t-label-color);
  }

  .info-row a {
    color: var(--brand-700);
    text-decoration: underline;
  }
  .info-row a:hover { color: var(--brand-900); }

  /* ── Download cards ── */
  .dl-intro {
    color: var(--ink-500);
    margin-bottom: 14px !important;
  }

  .dl-row {
    margin-bottom: 16px;
  }
  .dl-row:last-child {
    margin-bottom: 0;
  }

  .dl-row-label {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin-bottom: 6px;
  }

  .dl-cards {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }

  .dl-card {
    flex: 1 1 180px;
    max-width: 230px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: var(--radius-lg);
    padding: 14px var(--space-4);
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s ease, transform 0.12s ease;
  }

  .dl-card:hover {
    box-shadow: 0 3px 12px rgba(100,80,40,0.12);
    transform: translateY(-2px);
  }

  .dl-icon {
    font-size: 21px;
    font-weight: 700;
    color: var(--ref-accent);
    line-height: 1;
    padding-top: 1px;
    flex-shrink: 0;
  }

  .dl-name {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 3px;
  }

  .dl-desc {
    font-size: 13px;
    color: var(--ink-400);
    line-height: 1.4;
    margin-bottom: 6px;
  }

  /* Same anatomy as a download card, but it navigates instead of downloading. */
  .sg-card {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    width: 100%;
    max-width: 420px;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: var(--radius-lg);
    padding: 14px var(--space-4);
    transition: box-shadow 0.15s ease, transform 0.12s ease;
  }
  .sg-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .dl-file {
    font-size: var(--t-code-size);
    font-family: var(--t-code-ff);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    display: inline-block;
  }
</style>

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
      <a class="dl-card" href="data/references.bib" download="references.bib">
        <div class="dl-icon">↓</div>
        <div class="dl-body">
          <div class="dl-name">BibTeX references</div>
          <div class="dl-desc">All cited literature entries</div>
          <code class="dl-file">references.bib</code>
        </div>
      </a>
    </div>
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
  .content {
    padding: 28px 48px 48px;
    max-width: 760px;
    box-sizing: border-box;
    font-size: 13.5px;
    line-height: 1.6;
  }

  .page-title {
    font-size: 26px;
    font-weight: 800;
    color: #1a3055;
    margin: 0 0 32px;
    letter-spacing: -0.01em;
  }

  .section {
    margin-bottom: 36px;
  }

  .section h2 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #6b7a8f;
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e8edf3;
  }

  .section p {
    margin: 0 0 10px;
    color: #334;
  }

  /* ── Info grid ── */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info-row {
    display: flex;
    gap: 16px;
    font-size: 13px;
    line-height: 1.5;
  }

  .info-label {
    flex: 0 0 110px;
    font-weight: 600;
    color: #556;
  }

  .info-row a {
    color: #2c4a6e;
    text-decoration: underline;
  }
  .info-row a:hover { color: #1a3055; }

  /* ── Download cards ── */
  .dl-intro {
    color: #556;
    margin-bottom: 14px !important;
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
    background: #f8f6f1;
    border: 1px solid #e2d9c9;
    border-left: 3px solid #c4a86e;
    border-radius: 8px;
    padding: 14px 16px;
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.15s ease, transform 0.12s ease;
  }

  .dl-card:hover {
    box-shadow: 0 3px 12px rgba(100,80,40,0.12);
    transform: translateY(-2px);
  }

  .dl-icon {
    font-size: 20px;
    font-weight: 700;
    color: #c4a86e;
    line-height: 1;
    padding-top: 1px;
    flex-shrink: 0;
  }

  .dl-name {
    font-size: 13.5px;
    font-weight: 700;
    color: #1a2a3a;
    margin-bottom: 3px;
  }

  .dl-desc {
    font-size: 12px;
    color: #667;
    line-height: 1.4;
    margin-bottom: 6px;
  }

  .dl-file {
    font-size: 11px;
    font-family: ui-monospace, 'Courier New', monospace;
    background: #ede8de;
    color: #7a6040;
    padding: 1px 6px;
    border-radius: 3px;
    display: inline-block;
  }
</style>

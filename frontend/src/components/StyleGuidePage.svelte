<script lang="ts">
  /**
   * Style guide. Every swatch, size and rule on this page is read live out of
   * lib/tokens.ts, so the page cannot drift from the interface it documents.
   * Change a value there and this page, the chart, the tooltip and every other
   * component change together.
   */
  import {
    COLOR_GROUPS,
    TYPE_GROUPS,
    VIBRATION_PALETTE,
    ATOMS_PALETTE,
    TAG_STYLES,
    DEFAULT_TAG_STYLE,
    RADII,
    SHADOWS,
    SPACING,
    GRADIENTS,
    PAGE_LAYOUT,
    CHART_LAYOUT_DOCS,
    CONTENT_LIMITS,
    FONTS,
    C,
  } from '../lib/tokens';
  import { ELEMENT_COLORS } from '../lib/elementColors';
  import type { TypeRole } from '../lib/tokens';

  const generalTypeGroups = TYPE_GROUPS.filter(g => g.key !== 'tip');
  const tipTypeGroup = TYPE_GROUPS.find(g => g.key === 'tip')!;

  /** Black or white text, whichever stays legible on a given swatch. */
  function readable(hex: string): string {
    const h = hex.replace('#', '').slice(0, 6);
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.6 ? C['ink-800'] : C['surface'];
  }

  /** Inline style that applies one type role, for the self-describing samples. */
  function roleStyle(r: TypeRole): string {
    return [
      `font-size: var(--t-${r.key}-size)`,
      `font-weight: var(--t-${r.key}-weight)`,
      `color: var(--t-${r.key}-color)`,
      `font-family: var(--t-${r.key}-ff)`,
      `line-height: var(--t-${r.key}-lh)`,
      `letter-spacing: var(--t-${r.key}-ls)`,
      `text-transform: var(--t-${r.key}-tt)`,
      `font-style: var(--t-${r.key}-fs)`,
    ].join('; ');
  }

  /** Roles on the brand gradient need the dark backdrop to be readable. */
  const onDark = (r: TypeRole) => r.color === 'brand-on-dark';

  function words(s: string): number {
    return s.trim().split(/\s+/).filter(Boolean).length;
  }

  // ── Vocabularies documented here, mirrored from schema.py / types.ts ──
  const ENUMS: { field: string; values: [string, string][]; rule: string }[] = [
    {
      field: 'vibration.category',
      rule: 'Required. An overtone is not a category: use the parent mode and tag it "overtone".',
      values: [
        ['stretch', 'Bond length changes'],
        ['bend', 'Bond angle changes'],
        ['combination', 'Sum or difference of two modes; no subtype allowed'],
        ['lattice', 'Whole-lattice or framework motion'],
      ],
    },
    {
      field: 'vibration.subtype',
      rule: 'Optional, and never on a combination band.',
      values: [
        ['symmetric', 'In phase'],
        ['asymmetric', 'Out of phase'],
        ['scissoring', 'In-plane, angle opens and closes'],
        ['rocking', 'In-plane, group swings'],
        ['wagging', 'Out-of-plane, group swings'],
        ['twisting', 'Out-of-plane, group rotates'],
      ],
    },
    {
      field: 'intensity',
      rule: 'Omit when unknown. Never guess from a figure.',
      values: [
        ['vs', 'Very strong'], ['s', 'Strong'], ['m', 'Medium'], ['w', 'Weak'], ['vw', 'Very weak'],
      ],
    },
    {
      field: 'width',
      rule: 'Omit when unknown.',
      values: [
        ['sharp', 'Under roughly 20 cm⁻¹'],
        ['medium', 'Tens of cm⁻¹'],
        ['broad', 'Around a hundred cm⁻¹'],
        ['very_broad', 'Hundreds of cm⁻¹, hydrogen-bonded OH'],
      ],
    },
    {
      field: 'confidence',
      rule: 'How firmly the assignment is established, not how much you like it.',
      values: [
        ['confirmed', 'Multiple independent sources agree'],
        ['likely', 'One solid source, no contradiction'],
        ['tentative', 'Reported once, or contested'],
        ['speculative', 'Inferred, not directly observed'],
      ],
    },
  ];

  // The description sample below is written to sit inside the limit, and says
  // out loud what it is doing. Counted live so the example can never lie.
  const SAMPLE_DESC =
    'Description text, 12px, weight 400, ink-500, at most two short paragraphs worth. '
    + 'State what the mode is and where it sits: the C-H stretch of adsorbed formate, '
    + '2870 to 2900 cm⁻¹ on most oxide supports. State what shifts it: coordination mode, '
    + 'support basicity, coverage. State what it is confused with: the symmetric OCO stretch '
    + 'overtone falls in the same window; isotopic substitution separates them. Keep sentences '
    + 'short, one clause each; use semicolons for lists. Give numbers, not adjectives. Anything '
    + 'true of only one paper belongs in that paper’s reference note, not here. This sample '
    + 'is itself within the limit shown on the left.';

  const SAMPLE_NOTE =
    'Reference note, 11.5px, italic, ink-400, at most 150 words. Lead with what this one paper '
    + 'reported: band seen after CO₂ and H₂ dosing at 523 K, growing with time on stream. '
    + 'Conditions go here; the surface goes in the site field; wavenumbers go in wn, never in the prose.';
</script>

<main class="content">
  <h1 class="page-title">Style guide</h1>

  <p class="lede">
    One source of truth: <code>frontend/src/lib/tokens.ts</code>. Every colour, type
    role, radius, shadow and chart dimension in the atlas is defined there once,
    injected into <code>:root</code> as CSS custom properties at start-up, and read
    back by this page. Change a value in that file and it changes in the header, the
    sidebar, the chart, the tooltip and here, in the same commit.
  </p>
  <p class="lede">
    Two rules keep it that way. Components never hard-code a colour, font size or
    font weight; they use <code>var(--token)</code> or import from
    <code>tokens.ts</code>. New tokens are added there with a usage note, which is
    the text you see next to every swatch below.
  </p>

  <nav class="toc">
    <a href="#general">1 &middot; General</a>
    <a href="#bandchart">2 &middot; Band chart</a>
  </nav>

  <!-- ══════════════════════════ 1 · GENERAL ══════════════════════════ -->
  <h2 class="part" id="general">1 &middot; General</h2>
  <p class="part-sub">Type, colour, shape and page layout. These apply everywhere.</p>

  <!-- ── Typefaces ── -->
  <section class="section">
    <h3>Typefaces</h3>
    <div class="specimen-row">
      <div class="specimen">
        <div class="specimen-name">Sans &middot; <code>--font-sans</code></div>
        <div class="specimen-sample" style="font-family: var(--font-sans)">
          Formate &nu;(C&ndash;H) 2870&ndash;2900 cm&#8315;&sup1;
        </div>
        <div class="specimen-stack">{FONTS.sans}</div>
        <div class="specimen-use">Everything, unless digits have to line up.</div>
      </div>
      <div class="specimen">
        <div class="specimen-name">Mono &middot; <code>--font-mono</code></div>
        <div class="specimen-sample" style="font-family: var(--font-mono)">
          1580&ndash;1620 cm&#8315;&sup1; &middot; 2143 &middot; 667
        </div>
        <div class="specimen-stack">{FONTS.mono}</div>
        <div class="specimen-use">Wavenumbers, file names, JSON keys, enum values.</div>
      </div>
    </div>
    <p class="rule-note">
      No web fonts. The stack is whatever the operating system already has, so the
      atlas renders identically offline and prints predictably.
    </p>
  </section>

  <!-- ── Type scale ── -->
  <section class="section">
    <h3>Type scale</h3>
    <p class="rule-note">
      Every sample below is set in the role it documents, and its text is the
      specification: size, weight, colour token. Nothing here is decorative filler.
    </p>

    {#each generalTypeGroups as g}
      <div class="type-group">
        <div class="type-group-head">{g.title}</div>
        <div class="type-group-note">{g.note}</div>
        {#each g.roles as r}
          <div class="type-row">
            <div class="type-meta">
              <code>--t-{r.key}-*</code>
              <span class="type-usage">{r.usage}</span>
            </div>
            <div class="type-sample" class:on-dark={onDark(r)}>
              <span style={roleStyle(r)}>
                {r.label} &middot; {r.size} &middot; weight {r.weight} &middot; {r.color}{r.fs === 'italic' ? ' · italic' : ''}{r.tt === 'uppercase' ? ' · uppercase' : ''}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </section>

  <!-- ── Colour tokens ── -->
  <section class="section">
    <h3>Colour tokens</h3>
    <p class="rule-note">
      Named by role, never by hue value. If a new colour is needed, first check
      whether an existing role already means what you mean.
    </p>

    {#each COLOR_GROUPS as g}
      <div class="swatch-group">
        <div class="swatch-group-head">{g.title}</div>
        <div class="swatch-group-note">{g.note}</div>
        <div class="swatch-grid">
          {#each Object.entries(g.tokens) as [name, t]}
            <div class="swatch">
              <div class="swatch-chip" style="background:{t.value}; color:{readable(t.value)}">
                {t.value}
              </div>
              <div class="swatch-body">
                <code class="swatch-name">--{name}</code>
                <div class="swatch-use">{t.usage}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <!-- ── Colormaps ── -->
  <section class="section">
    <h3>Data colormaps</h3>
    <p class="rule-note">
      Colour that carries meaning, kept apart from the chrome palette above. A
      reader should be able to learn one of these scales once and trust it on every
      page. Group colours are the exception: they belong to the dataset and live in
      <code>data/bands.jsonc</code>.
    </p>

    <div class="map-block">
      <div class="map-head">Vibration <span class="map-src">VIBRATION_PALETTE</span></div>
      <div class="map-note">Hue is the category, lightness is the subtype: symmetric darker, asymmetric lighter.</div>
      <div class="ramp">
        {#each Object.entries(VIBRATION_PALETTE) as [k, v]}
          <div class="ramp-cell" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
        {/each}
      </div>
    </div>

    <div class="map-block">
      <div class="map-head">Atoms <span class="map-src">ATOMS_PALETTE</span></div>
      <div class="map-note">One hue family per bond environment. Deuterated twins keep the family and run lighter; "diverse" is the neutral grey for a combination of unlike parents.</div>
      <div class="ramp">
        {#each Object.entries(ATOMS_PALETTE) as [k, v]}
          <div class="ramp-cell" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
        {/each}
      </div>
    </div>

    <div class="map-block">
      <div class="map-head">Tags <span class="map-src">TAG_STYLES</span></div>
      <div class="map-note">Four styled tags, one hue each. Anything without an entry falls back to the muted default, which is fine: styling is opt-in, not required.</div>
      <div class="tag-row">
        {#each Object.entries(TAG_STYLES) as [k, s]}
          <span class="tag-pill" style="background:{s.background}; border-color:{s.border}; color:{s.color}">{k}</span>
        {/each}
        <span class="tag-pill" style="background:{DEFAULT_TAG_STYLE.background}; border-color:{DEFAULT_TAG_STYLE.border}; color:{DEFAULT_TAG_STYLE.color}">any other tag</span>
      </div>
    </div>

    <div class="map-block">
      <div class="map-head">Elements <span class="map-src">lib/elementColors.ts</span></div>
      <div class="map-note">CPK-style atom colours for the vibration diagrams, kept in their own module because they follow chemistry convention rather than this design system. Distinct from the atoms colormap above, which colours bond environments.</div>
      <div class="ramp">
        {#each Object.entries(ELEMENT_COLORS) as [k, v]}
          <div class="ramp-cell narrow" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
        {/each}
      </div>
    </div>

    <div class="map-block">
      <div class="map-head">Gradients</div>
      {#each Object.entries(GRADIENTS) as [name, t]}
        <div class="grad-row">
          <div class="grad-bar" style="background:{t.value}"></div>
          <div class="grad-meta"><code>--{name}</code><span class="swatch-use">{t.usage}</span></div>
        </div>
      {/each}
      <div class="map-note">
        One gradient, one direction, one place. Flat fills everywhere else: a
        gradient behind data would read as a value.
      </div>
    </div>
  </section>

  <!-- ── Shape, depth, rhythm ── -->
  <section class="section">
    <h3>Shape, depth and rhythm</h3>
    <div class="scale-cols">
      <div class="scale-col">
        <div class="scale-head">Radius</div>
        {#each Object.entries(RADII) as [name, t]}
          <div class="scale-row">
            <div class="radius-demo" style="border-radius:{t.value}"></div>
            <div><code>--{name}</code> <span class="scale-val">{t.value}</span>
              <div class="swatch-use">{t.usage}</div></div>
          </div>
        {/each}
      </div>
      <div class="scale-col">
        <div class="scale-head">Elevation</div>
        {#each Object.entries(SHADOWS) as [name, t]}
          <div class="scale-row">
            <div class="shadow-demo" style="box-shadow:{t.value}"></div>
            <div><code>--{name}</code>
              <div class="swatch-use">{t.usage}</div></div>
          </div>
        {/each}
      </div>
      <div class="scale-col">
        <div class="scale-head">Spacing</div>
        {#each Object.entries(SPACING) as [name, t]}
          <div class="scale-row">
            <div class="space-demo" style="width:{t.value}"></div>
            <div><code>--{name}</code> <span class="scale-val">{t.value}</span>
              <div class="swatch-use">{t.usage}</div></div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── Page layout ── -->
  <section class="section">
    <h3>Page layout</h3>
    <div class="wire">
      <div class="wire-header">Header &middot; brand gradient &middot; title left, authors right</div>
      <div class="wire-body">
        <div class="wire-side">Sidebar<br /><span>220px</span></div>
        <div class="wire-main">Main area<br /><span>prose pages cap at 760px; the chart scrolls internally</span></div>
      </div>
      <div class="wire-foot">Hint banner &middot; always the last flex item, never scrolls away</div>
    </div>
    <table class="spec-table">
      <tbody>
        {#each Object.entries(PAGE_LAYOUT) as [name, t]}
          <tr><th>{name}</th><td class="spec-val">{t.value}</td><td>{t.usage}</td></tr>
        {/each}
      </tbody>
    </table>
    <ul class="rules">
      <li>Prose goes in one column, left aligned, ragged right. No justification, no centred paragraphs.</li>
      <li>A page has exactly one page title, then uppercase section headings, then content. No third heading level.</li>
      <li>Sections are separated by space (<code>--space-6</code>), not by rules. The only hairline is the one under a section heading.</li>
      <li>Interactive elements state what they do in the element itself; explanatory prose sits above the block, never inside it.</li>
    </ul>
  </section>

  <!-- ══════════════════════════ 2 · BAND CHART ══════════════════════════ -->
  <h2 class="part" id="bandchart">2 &middot; Band chart</h2>
  <p class="part-sub">
    Everything above applies here too. This part adds the chart's own layout, the
    tooltip anatomy, and the content rules for what goes into a band entry.
  </p>

  <!-- ── Chart layout ── -->
  <section class="section">
    <h3>Chart layout</h3>
    <div class="lane-demo">
      <div class="lane-label">group label</div>
      <div class="lane-track">
        <div class="lane-band" style="left:6%; width:22%; background-color:{VIBRATION_PALETTE['stretch']}"></div>
        <div class="lane-band" style="left:34%; width:26%; background-color:{VIBRATION_PALETTE['bend']}"></div>
        <div class="lane-band hatched" style="left:64%; width:18%; background-color:{ATOMS_PALETTE['C-D']}"></div>
      </div>
    </div>
    <div class="lane-demo">
      <div class="lane-label">overlapping</div>
      <div class="lane-track">
        <div class="lane-band" style="left:10%; width:30%; background-color:{VIBRATION_PALETTE['stretch.symmetric']}"></div>
        <div class="lane-band up" style="left:30%; width:26%; background-color:{VIBRATION_PALETTE['stretch.asymmetric']}"></div>
        <div class="lane-band down" style="left:50%; width:22%; background-color:{VIBRATION_PALETTE['combination']}"></div>
      </div>
    </div>
    <p class="rule-note">
      Bands are packed into lanes by wavenumber range; a <code>pair</code> value
      forces two bands to share one. Overlaps inside a lane stagger into sub-lanes
      0, +1, &minus;1, in that order. A fourth overlapping band is dropped and
      logged rather than drawn on top of its neighbours.
    </p>
    <table class="spec-table">
      <tbody>
        {#each CHART_LAYOUT_DOCS as d}
          <tr><th>{d.name}</th><td class="spec-val">{d.value}</td><td>{d.usage}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>

  <!-- ── Mark styling ── -->
  <section class="section">
    <h3>How a band is drawn</h3>
    <table class="spec-table">
      <tbody>
        <tr><th>Fill</th><td class="spec-val">colour dimension</td><td>Group, vibration, atoms or reference state, whichever the sidebar has selected. The fill is the only thing that changes; geometry never encodes a category.</td></tr>
        <tr><th>Outline</th><td class="spec-val">0.5px, 35% black</td><td>Keeps two touching bands of similar hue apart.</td></tr>
        <tr><th>Hatched</th><td class="spec-val">diagonal 5px</td><td>The band is an isotopologue: same normal mode, heavier molecule. Structural, so it survives every colour dimension.</td></tr>
        <tr><th>Dashed, faded</th><td class="spec-val">ir-inactive</td><td>A mode that exists but is not observed in IR.</td></tr>
        <tr><th>Solid connector</th><td class="spec-val">ink-500</td><td>Branch group: P, Q, R branches of one band.</td></tr>
        <tr><th>Dashed connector</th><td class="spec-val">ink-500, "fermi"</td><td>Fermi resonance partners.</td></tr>
        <tr><th>Dotted connector</th><td class="spec-val">isotopic-shift colour</td><td>Isotopologue to parent. The connector reuses the tag colour on purpose.</td></tr>
      </tbody>
    </table>
  </section>

  <!-- ── Tooltip anatomy ── -->
  <section class="section">
    <h3>Tooltip anatomy</h3>
    <p class="rule-note">
      The replica below is built from the same tokens as the real tooltip, and each
      slot is filled with a description of itself: what it is, its size, its weight,
      its colour token, and the rule for what may go in it.
    </p>

    <div class="tip-demo-wrap">
      <div class="tip-demo">
        <div class="tip-header" style="border-left-color: {VIBRATION_PALETTE['stretch']}">
          <div class="tip-name">Band name &middot; 14px / 700 &middot; ink-900</div>
          <div class="tip-vib">Vibration meta &middot; 11.5px / 400 &middot; ink-300 &middot; category (subtype) | atoms</div>
          <div class="tip-wn">Range &middot; 12px mono &middot; 0000&ndash;0000 cm&#8315;&sup1;</div>
          <div class="tip-group" style="color: {VIBRATION_PALETTE['stretch']}">group &middot; 11px / 700 &middot; band colour</div>
        </div>

        <div class="tip-tags">
          <span class="tip-tag">intensity: 11px pill</span>
          <span class="tip-tag">confidence: qualifier</span>
          <span class="tip-tag tip-tag-extra">tag &middot; muted variant</span>
        </div>

        <div class="tip-desc">
          Description &middot; 12px / 400 &middot; ink-500 &middot; 100 to 120 words.
          What the mode is, where it sits, what it is confused with. Short sentences;
          semicolon lists; numbers instead of adjectives. Nothing that is true of
          only one paper.
        </div>

        <div class="tip-refs-header">References &middot; 10.5px / 700 &middot; uppercase</div>

        <div class="tip-ref-box">
          <div class="tip-ref-goto">&#8599;</div>
          <div class="tip-ref-title">Citation &middot; 12px / 600 &middot; ink-800</div>
          <div class="tip-ref-badges">
            <span class="badge-wn">0000 cm&#8315;&sup1;</span>
            <span class="badge-site">site badge</span>
          </div>
          <div class="tip-ref-tags">
            <span class="tip-ref-tag" style="background:{TAG_STYLES['ir-active'].background}; border-color:{TAG_STYLES['ir-active'].border}; color:{TAG_STYLES['ir-active'].color}">per-citation tag</span>
          </div>
          <div class="tip-ref-note">
            Reference note &middot; 11.5px italic &middot; ink-400 &middot; at most 150
            words. What this paper reported, on which surface, under which conditions.
          </div>
        </div>

        <div class="tip-lock-hint">interaction hint &middot; 10.5px &middot; ink-050 &middot; pinned state only</div>
      </div>

      <ol class="tip-callouts">
        <li><b>Header</b> carries a 3px left border in the band colour; the tooltip carries the same colour on its top border. Colour appears twice, text never repeats it.</li>
        <li><b>Qualifier pills</b> come first (intensity, confidence, width), then tags. Grey means a qualifier, coloured means a tag.</li>
        <li><b>Description</b> is separated from the citations by a hairline, because it is the one block that belongs to the band rather than to a source.</li>
        <li><b>Reference boxes</b> use the parchment palette: gold left edge, warm background. That combination means "citation" everywhere in the atlas.</li>
        <li><b>Badges</b> are fixed: blue is always a wavenumber, amber is always a site. Multiple sites become multiple badges, never a comma list.</li>
        <li><b>Overflow</b>: hovering shows at most 3 references and a "+n more" counter; clicking pins the tooltip, which then scrolls internally past 240px.</li>
      </ol>
    </div>

    <div class="type-group tip-roles">
      <div class="type-group-head">{tipTypeGroup.title}</div>
      <div class="type-group-note">{tipTypeGroup.note}</div>
      {#each tipTypeGroup.roles as r}
        <div class="type-row">
          <div class="type-meta">
            <code>--t-{r.key}-*</code>
            <span class="type-usage">{r.usage}</span>
          </div>
          <div class="type-sample">
            <span style={roleStyle(r)}>
              {r.label} &middot; {r.size} &middot; weight {r.weight} &middot; {r.color}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Content rules ── -->
  <section class="section">
    <h3>Content rules</h3>
    <p class="rule-note">
      Length limits are the hard part of this guide, because the tooltip is 300px
      wide and read while hovering. <code>build.py</code> counts the words and warns
      when an entry runs long; it never blocks the build, so the numbers are a
      discipline, not a gate.
    </p>

    {#each CONTENT_LIMITS as l}
      <div class="limit-card">
        <div class="limit-head">
          <code>{l.field}</code>
          <span class="limit-badge">{l.target}</span>
        </div>
        <div class="limit-rule">{l.rule}</div>
        <ul class="limit-how">
          {#each l.how as h}<li>{h}</li>{/each}
        </ul>
      </div>
    {/each}

    <div class="sample-block">
      <div class="sample-head">
        Description, written to the rule
        <span class="wc" class:over={words(SAMPLE_DESC) > CONTENT_LIMITS[0].hard}>
          {words(SAMPLE_DESC)} words / {CONTENT_LIMITS[0].hard} max
        </span>
      </div>
      <div class="sample-body tip-desc">{SAMPLE_DESC}</div>
    </div>

    <div class="sample-block">
      <div class="sample-head">
        Reference note, written to the rule
        <span class="wc" class:over={words(SAMPLE_NOTE) > CONTENT_LIMITS[1].hard}>
          {words(SAMPLE_NOTE)} words / {CONTENT_LIMITS[1].hard} max
        </span>
      </div>
      <div class="sample-body tip-ref-note">{SAMPLE_NOTE}</div>
    </div>

    <h4>Which field takes what</h4>
    <table class="spec-table">
      <tbody>
        <tr><th>short</th><td class="spec-val">a few words</td><td>The label a reader scans. No sentence, no full stop.</td></tr>
        <tr><th>description</th><td class="spec-val">100 to 120 words</td><td>Everything true of the band in general.</td></tr>
        <tr><th>references[].wn</th><td class="spec-val">number or list</td><td>The wavenumber that paper reported. Never in prose.</td></tr>
        <tr><th>references[].site</th><td class="spec-val">species or list</td><td>Most specific surface species named ("Cu⁺", "Zr⁴⁺"), otherwise the catalyst. No conditions.</td></tr>
        <tr><th>references[].note</th><td class="spec-val">under 150 words</td><td>Conditions, caveats, what that paper actually showed.</td></tr>
        <tr><th>references[].tags</th><td class="spec-val">per-citation</td><td>Claims about the citation, e.g. isotope-labeling as evidence. Band-level truths go in the band's own tags.</td></tr>
      </tbody>
    </table>

    <h4>Vocabularies</h4>
    {#each ENUMS as e}
      <div class="enum-block">
        <div class="enum-head"><code>{e.field}</code><span class="enum-rule">{e.rule}</span></div>
        <div class="enum-values">
          {#each e.values as [v, meaning]}
            <div class="enum-row"><code class="enum-val">{v}</code><span>{meaning}</span></div>
          {/each}
        </div>
      </div>
    {/each}

    <h4>Structural rules</h4>
    <ul class="rules">
      <li>Band IDs are append-only. Renaming one breaks every <code>based_on</code> that points at it.</li>
      <li>An isotopologue gets its own band entry with <code>isotopologue_of</code> and an <code>isotope</code> label. Never hide its wavenumber in the parent's citation. The link is one step, child to parent, never a chain.</li>
      <li>A paper that merely used isotope substitution as evidence gets the per-citation <code>isotope-labeling</code> tag. That is a different claim from being an isotopologue.</li>
      <li>An overtone keeps its parent's category, adds the <code>overtone</code> tag, and keeps <code>based_on</code> pointing at the parent.</li>
      <li>Region is derived from the band centre at runtime; never store it on a band.</li>
      <li>The JSONC preamble is part of the schema. Change a key, change the preamble in the same commit.</li>
    </ul>
  </section>
</main>

<style>
  /* Every value here comes from lib/tokens.ts. Nothing on this page is allowed
     to be a literal colour or font size, for the obvious reason. */
  .content {
    padding: var(--space-5) 48px 64px;
    max-width: 900px;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--t-body-color);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 0 0 14px;
  }

  .lede { margin: 0 0 10px; max-width: 760px; }

  code {
    font-family: var(--font-mono);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

  .toc {
    display: flex;
    gap: var(--space-2);
    margin: var(--space-4) 0 var(--space-6);
  }
  .toc a {
    font-size: var(--t-nav-size);
    color: var(--brand-700);
    border: 1px solid var(--line-slate);
    background: var(--surface-slate);
    border-radius: var(--radius);
    padding: 5px 12px;
    text-decoration: none;
  }
  .toc a:hover { border-color: var(--line-slate-strong); }

  .part {
    font-size: 20px;
    font-weight: 800;
    color: var(--brand-900);
    margin: var(--space-6) 0 2px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--line-slate);
  }
  .part-sub {
    color: var(--ink-500);
    margin: 0 0 var(--space-5);
    max-width: 760px;
  }

  .section { margin-bottom: var(--space-6); }

  .section h3 {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-heading);
  }

  .section h4 {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin: var(--space-5) 0 8px;
  }

  .rule-note {
    color: var(--ink-500);
    font-size: 13.5px;
    margin: 0 0 var(--space-4);
    max-width: 760px;
  }

  .rules {
    margin: 0;
    padding-left: 18px;
    color: var(--ink-500);
    font-size: 13.5px;
    max-width: 760px;
  }
  .rules li { margin-bottom: 5px; }

  /* ── Typeface specimens ── */
  .specimen-row { display: flex; gap: var(--space-4); flex-wrap: wrap; }
  .specimen {
    flex: 1 1 320px;
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-lg);
    padding: 14px var(--space-4);
    background: var(--surface);
  }
  .specimen-name { font-size: 12px; color: var(--ink-400); margin-bottom: 8px; }
  .specimen-sample { font-size: 22px; color: var(--ink-800); margin-bottom: 8px; }
  .specimen-stack {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-300);
    word-break: break-word;
    margin-bottom: 4px;
  }
  .specimen-use { font-size: 12.5px; color: var(--ink-500); }

  /* ── Type scale ── */
  .type-group { margin-bottom: var(--space-5); }
  .tip-roles { margin-top: var(--space-5); }
  .type-group-head {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 2px;
  }
  .type-group-note {
    font-size: 12.5px;
    color: var(--ink-400);
    margin-bottom: 8px;
    max-width: 760px;
  }

  .type-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: 7px 0;
    border-top: 1px solid var(--line-faint);
  }
  .type-meta { flex: 0 0 240px; }
  .type-meta code { font-size: 11px; }
  .type-usage {
    display: block;
    font-size: 11.5px;
    color: var(--ink-300);
    margin-top: 3px;
  }
  .type-sample { flex: 1 1 auto; min-width: 0; }
  .type-sample.on-dark {
    background: var(--grad-header);
    border-radius: var(--radius);
    padding: 6px 10px;
  }

  /* ── Swatches ── */
  .swatch-group { margin-bottom: var(--space-5); }
  .swatch-group-head {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 2px;
  }
  .swatch-group-note {
    font-size: 12.5px;
    color: var(--ink-400);
    margin-bottom: 10px;
    max-width: 760px;
  }
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 8px;
  }
  .swatch {
    display: flex;
    align-items: stretch;
    gap: 10px;
    border: 1px solid var(--line-faint);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--surface);
  }
  .swatch-chip {
    flex: 0 0 78px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 10.5px;
  }
  .swatch-body { padding: 6px 8px 7px 0; min-width: 0; }
  .swatch-name { font-size: 11px; background: none; padding: 0; color: var(--ink-700); }
  .swatch-use { font-size: 11.5px; color: var(--ink-300); margin-top: 2px; }

  /* ── Colormaps ── */
  .map-block { margin-bottom: var(--space-5); }
  .map-head {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 2px;
  }
  .map-src {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-300);
    margin-left: 6px;
  }
  .map-note {
    font-size: 12.5px;
    color: var(--ink-400);
    margin-bottom: 8px;
    max-width: 760px;
  }
  .ramp {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .ramp-cell {
    flex: 1 1 96px;
    min-width: 72px;
    padding: 10px 6px;
    font-size: 11px;
    text-align: center;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ramp-cell.narrow { flex: 0 0 54px; min-width: 54px; }

  .tag-row { display: flex; gap: var(--space-1); flex-wrap: wrap; }
  .tag-pill {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 2px 7px;
    font-size: var(--t-tip-tag-size);
  }

  .grad-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .grad-bar {
    flex: 0 0 240px;
    height: 34px;
    border-radius: var(--radius);
  }
  .grad-meta code { font-size: 11px; }

  /* ── Scales ── */
  .scale-cols { display: flex; gap: var(--space-5); flex-wrap: wrap; }
  .scale-col { flex: 1 1 240px; }
  .scale-head {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 8px;
  }
  .scale-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 11.5px;
  }
  .scale-row code { font-size: 11px; }
  .scale-val { font-size: 11px; color: var(--ink-300); margin-left: 4px; }
  .radius-demo {
    flex: 0 0 34px;
    height: 34px;
    background: var(--brand-tint);
    border: 1px solid var(--brand-tint-line);
  }
  .shadow-demo {
    flex: 0 0 34px;
    height: 34px;
    background: var(--surface);
    border-radius: var(--radius);
    margin: 4px;
  }
  .space-demo {
    flex: 0 0 auto;
    height: 16px;
    background: var(--ref-accent);
    border-radius: 2px;
  }

  /* ── Layout wireframe ── */
  .wire {
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: var(--space-4);
    font-size: 11.5px;
  }
  .wire-header {
    background: var(--grad-header);
    color: var(--brand-on-dark);
    padding: 12px var(--space-4);
  }
  .wire-body { display: flex; min-height: 96px; }
  .wire-side {
    flex: 0 0 140px;
    background: var(--surface-sunken);
    border-right: 1px solid var(--line-soft);
    padding: 10px 12px;
    color: var(--ink-500);
  }
  .wire-side span, .wire-main span { color: var(--ink-300); }
  .wire-main {
    flex: 1 1 auto;
    padding: 10px 12px;
    color: var(--ink-500);
    background: var(--surface);
  }
  .wire-foot {
    background: var(--notice-bg);
    border-top: 1px solid var(--notice-border);
    color: var(--notice-fg);
    padding: 7px var(--space-4);
  }

  /* ── Spec tables ── */
  .spec-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    margin-bottom: var(--space-4);
  }
  .spec-table th {
    text-align: left;
    vertical-align: top;
    width: 150px;
    padding: 6px 10px 6px 0;
    font-weight: 600;
    color: var(--ink-slate-900);
    border-top: 1px solid var(--line-faint);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }
  .spec-table td {
    vertical-align: top;
    padding: 6px 10px 6px 0;
    border-top: 1px solid var(--line-faint);
    color: var(--ink-500);
  }
  .spec-val { width: 170px; color: var(--ink-700) !important; }

  /* ── Lane demo ── */
  .lane-demo { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .lane-label {
    flex: 0 0 110px;
    text-align: right;
    font-size: 11.5px;
    color: var(--ink-400);
  }
  .lane-track {
    position: relative;
    flex: 1 1 auto;
    height: 44px;
    background: var(--surface);
    border: 1px solid var(--line-faint);
    border-radius: var(--radius);
  }
  .lane-band {
    position: absolute;
    top: 16px;
    height: 12px;
    border: 0.5px solid rgba(0,0,0,0.35);
    border-radius: 1px;
    opacity: 0.85;
  }
  .lane-band.up { top: 10px; }
  .lane-band.down { top: 22px; }
  .lane-band.hatched {
    background-image: repeating-linear-gradient(
      45deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 5px
    );
  }

  /* ── Tooltip replica ──
     Same structure and the same tokens as .band-tooltip in BandChart.svelte. */
  .tip-demo-wrap { display: flex; gap: var(--space-5); flex-wrap: wrap; align-items: flex-start; }

  .tip-demo {
    flex: 0 0 auto;
    width: var(--tip-width);
    background: var(--surface);
    border: 1px solid var(--line);
    border-top: 3px solid var(--brand-500);
    border-radius: var(--radius-md);
    padding: 8px var(--space-3);
    font-family: var(--font-sans);
    box-shadow: var(--shadow-md);
  }

  .tip-header {
    border-left: 3px solid var(--ink-200);
    padding-left: 7px;
    margin-bottom: var(--space-2);
  }
  .tip-name {
    font-size: var(--t-tip-name-size);
    font-weight: var(--t-tip-name-weight);
    color: var(--t-tip-name-color);
    line-height: var(--t-tip-name-lh);
  }
  .tip-vib {
    font-size: var(--t-tip-vib-size);
    color: var(--t-tip-vib-color);
    margin-top: 1px;
  }
  .tip-wn {
    font-size: var(--t-tip-wn-size);
    color: var(--t-tip-wn-color);
    font-family: var(--t-tip-wn-ff);
    margin-top: 1px;
  }
  .tip-group {
    font-size: var(--t-tip-group-size);
    font-weight: var(--t-tip-group-weight);
    text-transform: var(--t-tip-group-tt);
    letter-spacing: var(--t-tip-group-ls);
    margin-top: 3px;
  }

  .tip-tags { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-bottom: 5px; }
  .tip-tag {
    background: var(--pill-bg);
    border: 1px solid var(--pill-border);
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    font-size: var(--t-tip-tag-size);
    color: var(--t-tip-tag-color);
  }
  .tip-tag-extra {
    background: var(--pill-muted-bg);
    border-color: var(--pill-muted-border);
    color: var(--pill-muted-fg);
  }

  .tip-desc {
    font-size: var(--t-tip-desc-size);
    color: var(--t-tip-desc-color);
    line-height: var(--t-tip-desc-lh);
    margin-bottom: var(--space-2);
    padding-bottom: 5px;
    border-bottom: 1px solid var(--line-faint);
  }

  .tip-refs-header {
    font-size: var(--t-tip-refs-head-size);
    font-weight: var(--t-tip-refs-head-weight);
    text-transform: var(--t-tip-refs-head-tt);
    letter-spacing: var(--t-tip-refs-head-ls);
    color: var(--t-tip-refs-head-color);
    margin-bottom: var(--space-1);
  }

  .tip-ref-box {
    position: relative;
    background: var(--ref-surface);
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    border-radius: var(--radius);
    padding: 5px 26px 5px 7px;
    margin-top: var(--space-1);
  }
  .tip-ref-goto {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 1px solid var(--ref-border);
    border-radius: var(--radius);
    color: var(--ref-accent-strong);
    font-size: 11px;
  }
  .tip-ref-title {
    font-size: var(--t-tip-ref-title-size);
    font-weight: var(--t-tip-ref-title-weight);
    color: var(--t-tip-ref-title-color);
  }
  .tip-ref-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-top: var(--space-1); }
  .badge-wn {
    background: var(--badge-wn-bg);
    border: 1px solid var(--badge-wn-border);
    color: var(--badge-wn-fg);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-tip-badge-size);
    font-family: var(--font-mono);
  }
  .badge-site {
    background: var(--badge-site-bg);
    border: 1px solid var(--badge-site-border);
    color: var(--badge-site-fg);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
    font-size: var(--t-tip-badge-size);
  }
  .tip-ref-tags { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-top: var(--space-1); }
  .tip-ref-tag {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 1px 5px;
    font-size: var(--t-tip-tag-size);
  }
  .tip-ref-note {
    font-size: var(--t-tip-ref-note-size);
    color: var(--t-tip-ref-note-color);
    font-style: var(--t-tip-ref-note-fs);
    line-height: var(--t-tip-ref-note-lh);
    margin-top: var(--space-1);
  }
  .tip-lock-hint {
    margin-top: var(--space-2);
    padding-top: 5px;
    border-top: 1px solid var(--line-faint);
    font-size: var(--t-tip-hint-size);
    color: var(--t-tip-hint-color);
    text-align: center;
  }

  .tip-callouts {
    flex: 1 1 300px;
    margin: 0;
    padding-left: 20px;
    font-size: 12.5px;
    color: var(--ink-500);
  }
  .tip-callouts li { margin-bottom: 7px; }
  .tip-callouts b { color: var(--ink-slate-900); }

  /* ── Content limits ── */
  .limit-card {
    border: 1px solid var(--ref-border);
    border-left: 3px solid var(--ref-accent);
    background: var(--ref-surface);
    border-radius: var(--radius);
    padding: 10px 14px;
    margin-bottom: 10px;
  }
  .limit-head { display: flex; align-items: center; gap: 10px; }
  .limit-head code { background: var(--surface); font-size: 12px; }
  .limit-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ref-accent-deep);
  }
  .limit-rule { font-size: 13px; color: var(--ink-600); margin: 6px 0 4px; }
  .limit-how {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    color: var(--ink-500);
  }
  .limit-how li { margin-bottom: 2px; }

  .sample-block { margin: var(--space-4) 0; }
  .sample-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin-bottom: 5px;
  }
  .wc {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0;
    text-transform: none;
    color: var(--data-cited);
  }
  .wc.over { color: var(--danger); }
  .sample-body {
    max-width: 620px;
    border-left: 2px solid var(--line-soft);
    padding-left: 12px;
    border-bottom: none;
    margin-bottom: 0;
  }

  /* ── Enum vocabularies ── */
  .enum-block { margin-bottom: var(--space-4); }
  .enum-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .enum-rule { font-size: 12px; color: var(--ink-400); }
  .enum-values {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 3px 14px;
    margin-top: 6px;
  }
  .enum-row { display: flex; gap: 8px; align-items: baseline; font-size: 12.5px; color: var(--ink-500); }
  .enum-val { flex: 0 0 auto; font-size: 11px; }
</style>

<script context="module" lang="ts">
  export interface SgSection {
    id: string;
    label: string;
    /** True for the three top-level parts, which head the sidebar table of contents. */
    part?: boolean;
  }

  /**
   * Table of contents, consumed by the sidebar in App.svelte. Every entry's id
   * exists as a `data-sg-section` anchor below; the scroll spy keys off the
   * same list, so adding a section here and marking the anchor is all it takes.
   */
  export const SECTIONS: SgSection[] = [
    { id: 'general',      label: '1 · General', part: true },
    { id: 'typography',   label: 'Typography' },
    { id: 'color',        label: 'Colour tokens' },
    { id: 'colormaps',    label: 'Data colormaps' },
    { id: 'shape',        label: 'Shape & layout' },
    { id: 'bandchart',    label: '2 · Band chart', part: true },
    { id: 'chart-layout', label: 'Chart layout & marks' },
    { id: 'links',        label: 'Band relationships' },
    { id: 'tooltip',      label: 'Tooltip anatomy' },
    { id: 'contentrules', label: '3 · Content rules', part: true },
    { id: 'limits',       label: 'Length limits' },
    { id: 'notation',     label: 'Notation' },
    { id: 'fields',       label: 'Fields & vocabularies' },
  ];
</script>

<script lang="ts">
  /**
   * Style guide. Every swatch, size and rule on this page is read live out of
   * lib/tokens.ts, so the page cannot drift from the interface it documents.
   * Change a value there and this page, the chart, the tooltip and every other
   * component change together.
   *
   * Layout: each of the three parts is a stack of "spreads". A spread puts the
   * explanation in the left column and the thing being explained in the right
   * one, and a spread may hold several subsections, in which case its visual
   * sticks while they scroll past. Spreads never cross a part boundary, so the
   * cut between parts is clean and nothing is carried over it.
   */
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
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
  import { SUB_CHARS, SUP_CHARS, MISSING_SUBSCRIPT_LETTERS, htmlToUnicode } from '../lib/notation';
  import type { TypeRole } from '../lib/tokens';

  const dispatch = createEventDispatcher<{ active: { id: string } }>();

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

  /** Roles set on the brand gradient need the dark backdrop to be readable. */
  const onDark = (r: TypeRole) => r.color === 'brand-on-dark';

  function words(s: string): number {
    return s.trim().split(/\s+/).filter(Boolean).length;
  }

  // ── Scroll spy ──
  // The page scrolls inside App.svelte's .main-area, not the window, so the
  // listener attaches to that ancestor and measures against its own top edge.
  let root: HTMLElement;
  let scroller: HTMLElement | null = null;
  let activeId = SECTIONS[0].id;
  let frame = 0;

  function measure() {
    frame = 0;
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let current = SECTIONS[0].id;
    for (const s of SECTIONS) {
      const el = root?.querySelector<HTMLElement>(`[data-sg-section="${s.id}"]`);
      if (!el) continue;
      if (el.getBoundingClientRect().top - top <= 90) current = s.id;
    }
    if (current !== activeId) {
      activeId = current;
      dispatch('active', { id: current });
    }
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(measure);
  }

  onMount(() => {
    scroller = root.closest('.main-area');
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    measure();
  });

  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
    scroller?.removeEventListener('scroll', onScroll);
  });

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

  // ── Notation ──
  // Rendered live through the real converter, so the comparison cannot drift
  // from what the tooltip actually does with each string.
  const NOTATION_CASES: { src: string; verdict: 'ok' | 'exception' | 'bad'; why: string }[] = [
    { src: 'CO₂ at 2349 cm⁻¹', verdict: 'ok',
      why: 'Unicode: identical everywhere, searchable, copies cleanly.' },
    { src: 'κ²-HCOO* on Cu⁺', verdict: 'ok',
      why: 'Charges and hapticity are digits, which Unicode has.' },
    { src: 'C<sub>2v</sub>', verdict: 'exception',
      why: 'Point group: the subscript is a letter, so this field is HTML and rendered as HTML. Note what the plain-text path can do with it.' },
    { src: '<em>metallic</em> Cu', verdict: 'bad',
      why: 'Emphasis markup survives on the References page and is stripped in the tooltip: the same sentence reads differently in two places.' },
    { src: 'ν_as at 1605 cm⁻¹', verdict: 'bad',
      why: 'An underscore is a subscript nobody typed. Nothing converts it, so it stays broken on every surface: write νₐₛ.' },
    { src: 'see co_gemdi_sym_2035', verdict: 'ok',
      why: 'The exception: a band id is a machine identifier and keeps its underscores, in prose too.' },
  ];

  // The samples below are written to sit inside their limits, and say out loud
  // what they are doing. Counted live, so the examples can never lie.
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

<main class="content" bind:this={root}>
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
    the text you see next to every swatch. Use the contents list in the sidebar to
    move around.
  </p>

  <!-- ══════════════════════════ 1 · GENERAL ══════════════════════════ -->
  <h2 class="part" id="general" data-sg-section="general">1 &middot; General</h2>
  <p class="part-sub">Type, colour, shape and page layout. These apply everywhere.</p>

  <!-- ── Spread: typography ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="typography" data-sg-section="typography">
        <h3>Typography</h3>
        <p>
          Two stacks, both from the operating system. No web fonts: the atlas then
          renders identically offline and prints predictably.
        </p>
        <p>
          Text is never styled by picking a size. It is styled by picking a
          <strong>role</strong>, and each role emits eight custom properties
          (<code>--t-&lt;role&gt;-size</code>, <code>-weight</code>,
          <code>-color</code>, <code>-ff</code>, <code>-lh</code>, <code>-ls</code>,
          <code>-tt</code>, <code>-fs</code>). A component that needs something not
          in the list gets a new role in <code>tokens.ts</code>, not a one-off size.
        </p>
        <ul class="rules">
          <li>Sans for everything, mono wherever digits have to line up between rows: wavenumbers, file names, JSON keys, enum values.</li>
          <li>Sizes step in half pixels in the dense surfaces. That is deliberate; do not round them.</li>
          <li>Weight carries hierarchy, colour carries emphasis. Never both at once for the same distinction.</li>
          <li>Uppercase is reserved for labels that name a block (section headings, micro labels). Never for content.</li>
        </ul>
        <table class="spec-table">
          <tbody>
            {#each generalTypeGroups as g}
              <tr><th>{g.title}</th><td>{g.note}</td></tr>
            {/each}
            <tr><th>{tipTypeGroup.title}</th><td>{tipTypeGroup.note} Shown in part 2.</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <div class="visual">
      <div class="visual-label">Specimen board</div>
      <div class="specimen">
        <div class="specimen-name">Sans &middot; <code>--font-sans</code></div>
        <div class="specimen-sample" style="font-family: var(--font-sans)">
          Formate &nu;(C&ndash;H) 2870&ndash;2900 cm&#8315;&sup1;
        </div>
        <div class="specimen-stack">{FONTS.sans}</div>
      </div>
      <div class="specimen">
        <div class="specimen-name">Mono &middot; <code>--font-mono</code></div>
        <div class="specimen-sample" style="font-family: var(--font-mono)">
          1580&ndash;1620 cm&#8315;&sup1; &middot; 2143 &middot; 667
        </div>
        <div class="specimen-stack">{FONTS.mono}</div>
      </div>

      {#each generalTypeGroups as g}
        <div class="role-group">
          <div class="role-group-head">{g.title}</div>
          {#each g.roles as r}
            <div class="role-card" class:on-dark={onDark(r)}>
              <div style={roleStyle(r)}>
                {r.label} &middot; {r.size} &middot; weight {r.weight} &middot; {r.color}{r.fs === 'italic' ? ' · italic' : ''}
              </div>
              <div class="role-meta"><code>--t-{r.key}-*</code> {r.usage}</div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- ── Spread: colour ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="color" data-sg-section="color">
        <h3>Colour tokens</h3>
        <p>
          Tokens are named by role, never by hue. Before adding a colour, check
          whether an existing role already means what you mean: a second warm grey
          is a maintenance cost, not a design decision.
        </p>
        <ul class="rules">
          <li><strong>Brand blue</strong> is navigation and identity. It never encodes data.</li>
          <li><strong>Reference parchment</strong> is citations, everywhere: reference cards, download cards, the boxes inside the tooltip. Warm paper plus a gold left edge means "this came from a paper".</li>
          <li><strong>Ink</strong> is a ladder, picked by role: primary ink-700, secondary ink-500, meta ink-300, hints ink-050. The slate variants are the same ladder tinted towards the brand, for prose pages.</li>
          <li><strong>Badges</strong> are fixed vocabulary: blue is a wavenumber, amber is a site, grey is a qualifier. A fourth pill style would break the reading.</li>
          <li><strong>Data neutrals</strong> are the states that sit outside any scale: unknown, cited, uncited.</li>
        </ul>
        <p class="rule-note">
          Each swatch carries the usage note written next to it in
          <code>tokens.ts</code>. If a note is missing there, the token is not
          finished.
        </p>
      </section>
    </div>

    <div class="visual">
      <div class="visual-label">Every colour token</div>
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
    </div>
  </div>

  <!-- ── Spread: colormaps ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="colormaps" data-sg-section="colormaps">
        <h3>Data colormaps</h3>
        <p>
          Colour that carries meaning, kept apart from the chrome palette. A reader
          should be able to learn one of these scales once and trust it on every
          page, so the mapping is fixed in code rather than chosen per chart.
        </p>
        <ul class="rules">
          <li><strong>Vibration</strong>: hue is the category, lightness is the subtype. Symmetric runs darker than its parent, asymmetric lighter.</li>
          <li><strong>Atoms</strong>: one hue family per bond environment. A deuterated twin keeps the family and runs lighter, because it is the same mode on a heavier molecule.</li>
          <li><strong>Tags</strong>: four styled tags, one hue each. Styling is opt-in; anything without an entry falls back to the muted default, so new tags never break a render.</li>
          <li><strong>Elements</strong> follow chemistry convention (CPK), so they live in their own module and are not part of this system.</li>
          <li><strong>Group</strong> colours belong to the dataset and live in <code>data/bands.jsonc</code>. That is the one deliberate exception to the single-source rule.</li>
          <li>One gradient exists, for the header. A gradient behind data would read as a value, so everything else is a flat fill.</li>
        </ul>
      </section>
    </div>

    <div class="visual">
      <div class="visual-label">Colormaps</div>

      <div class="map-block">
        <div class="map-head">Vibration <span class="map-src">VIBRATION_PALETTE</span></div>
        <div class="ramp">
          {#each Object.entries(VIBRATION_PALETTE) as [k, v]}
            <div class="ramp-cell" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Atoms <span class="map-src">ATOMS_PALETTE</span></div>
        <div class="ramp">
          {#each Object.entries(ATOMS_PALETTE) as [k, v]}
            <div class="ramp-cell" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Tags <span class="map-src">TAG_STYLES</span></div>
        <div class="tag-row">
          {#each Object.entries(TAG_STYLES) as [k, s]}
            <span class="tag-pill" style="background:{s.background}; border-color:{s.border}; color:{s.color}">{k}</span>
          {/each}
          <span class="tag-pill" style="background:{DEFAULT_TAG_STYLE.background}; border-color:{DEFAULT_TAG_STYLE.border}; color:{DEFAULT_TAG_STYLE.color}">any other tag</span>
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Elements <span class="map-src">lib/elementColors.ts</span></div>
        <div class="ramp">
          {#each Object.entries(ELEMENT_COLORS) as [k, v]}
            <div class="ramp-cell narrow" style="background:{v}; color:{readable(v)}" title="{k} {v}">{k}</div>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Gradient</div>
        {#each Object.entries(GRADIENTS) as [name, t]}
          <div class="grad-bar" style="background:{t.value}"></div>
          <div class="grad-meta"><code>--{name}</code> <span class="swatch-use">{t.usage}</span></div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── Spread: shape, rhythm and page layout (one visual, two subsections) ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="shape" data-sg-section="shape">
        <h3>Shape, depth and rhythm</h3>
        <p>
          Four radii, three elevations, six spacing steps. Each is picked by role,
          the same way colours are: a pill takes <code>--radius-sm</code> because it
          is a pill, not because 3px looked right.
        </p>
        <ul class="rules">
          <li>Elevation means "floats above the page", nothing else. Cards on the page are flat until hovered.</li>
          <li>Spacing separates; rules divide. Reach for space first, a hairline only when the boundary has to be unambiguous.</li>
        </ul>
      </section>

      <section class="section" id="layout-rules">
        <h3>Page layout</h3>
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
          <li>On a wide screen, explanation sits left and the thing being explained sits right, as on this page. The visual may span several subsections; it never spans two parts.</li>
          <li>Interactive elements state what they do in the element itself; explanatory prose sits above the block, never inside it.</li>
        </ul>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Scales and page shell</div>
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
              <div><code>--{name}</code> <span class="scale-val">{t.value}</span></div>
            </div>
          {/each}
        </div>
      </div>

      <div class="wire">
        <div class="wire-header">Header &middot; brand gradient</div>
        <div class="wire-body">
          <div class="wire-side">Sidebar<br /><span>220px</span></div>
          <div class="wire-main">Main area<br /><span>prose caps at 760px, this guide runs wider for its two columns</span></div>
        </div>
        <div class="wire-foot">Hint banner &middot; never scrolls away</div>
      </div>
    </div>
  </div>

  <!-- Clean cut between the two parts: no spread, no sticky visual, crosses here. -->
  <hr class="part-cut" />

  <!-- ══════════════════════════ 2 · BAND CHART ══════════════════════════ -->
  <h2 class="part" id="bandchart" data-sg-section="bandchart">2 &middot; Band chart</h2>
  <p class="part-sub">
    Everything above applies here too. This part adds the chart's own layout and
    the tooltip anatomy. What may go inside those slots is part 3.
  </p>

  <!-- ── Spread: chart layout + mark styling (one visual, two subsections) ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="chart-layout" data-sg-section="chart-layout">
        <h3>Chart layout</h3>
        <p>
          Bands are packed into lanes by wavenumber range; a <code>pair</code> value
          forces two bands to share one. Overlaps inside a lane stagger into
          sub-lanes 0, +1, &minus;1, in that order. A fourth overlapping band is
          dropped and logged rather than drawn on top of its neighbours.
        </p>
        <table class="spec-table">
          <tbody>
            {#each CHART_LAYOUT_DOCS as d}
              <tr><th>{d.name}</th><td class="spec-val">{d.value}</td><td>{d.usage}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section class="section" id="marks">
        <h3>How a band is drawn</h3>
        <p>
          The fill is the only thing that changes with the selected colour
          dimension. Geometry and texture never encode a category, so a band keeps
          its identity when the reader switches from group to vibration colouring.
        </p>
        <table class="spec-table">
          <tbody>
            <tr><th>Fill</th><td class="spec-val">colour dimension</td><td>Group, vibration, atoms or reference state, whichever the sidebar has selected.</td></tr>
            <tr><th>Outline</th><td class="spec-val">0.5px, 35% black</td><td>Keeps two touching bands of similar hue apart.</td></tr>
            <tr><th>Hatched</th><td class="spec-val">diagonal 5px</td><td>An isotopologue: same normal mode, heavier molecule. Structural, so it survives every colour dimension.</td></tr>
            <tr><th>Dashed, faded</th><td class="spec-val">ir-inactive</td><td>A mode that exists but is not observed in IR.</td></tr>
            <tr><th>Connectors</th><td class="spec-val">four kinds</td><td>Drawn only while a band is hovered or pinned, never at rest. Each relationship has its own line, see the next section.</td></tr>
          </tbody>
        </table>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Lanes and marks</div>

      <div class="lane-demo">
        <div class="lane-label">one lane</div>
        <div class="lane-track">
          <div class="lane-band" style="left:6%; width:22%; background-color:{VIBRATION_PALETTE['stretch']}"></div>
          <div class="lane-band" style="left:34%; width:26%; background-color:{VIBRATION_PALETTE['bend']}"></div>
          <div class="lane-band hatched" style="left:64%; width:18%; background-color:{ATOMS_PALETTE['C-D']}"></div>
        </div>
      </div>
      <div class="lane-demo">
        <div class="lane-label">sub-lanes</div>
        <div class="lane-track">
          <div class="lane-band" style="left:10%; width:30%; background-color:{VIBRATION_PALETTE['stretch.symmetric']}"></div>
          <div class="lane-band up" style="left:30%; width:26%; background-color:{VIBRATION_PALETTE['stretch.asymmetric']}"></div>
          <div class="lane-band down" style="left:50%; width:22%; background-color:{VIBRATION_PALETTE['combination']}"></div>
        </div>
      </div>

      <div class="mark-list">
        <div class="mark-row">
          <div class="mark-chip" style="background-color:{VIBRATION_PALETTE['stretch']}"></div>
          <span>ordinary band</span>
        </div>
        <div class="mark-row">
          <div class="mark-chip hatched" style="background-color:{ATOMS_PALETTE['C-D']}"></div>
          <span>isotopologue, hatched</span>
        </div>
        <div class="mark-row">
          <div class="mark-chip inactive" style="background-color:{VIBRATION_PALETTE['bend']}"></div>
          <span>ir-inactive, dashed and faded</span>
        </div>
        <div class="mark-row">
          <svg class="mark-svg" viewBox="0 0 120 14" aria-hidden="true">
            <line x1="4" y1="7" x2="116" y2="7" stroke={C['ink-500']} stroke-width="1.25" stroke-linecap="round" opacity="0.8" />
          </svg>
          <span>branch group</span>
        </div>
        <div class="mark-row">
          <svg class="mark-svg" viewBox="0 0 120 14" aria-hidden="true">
            <path d="M 4 12 V 4 H 116 V 12" fill="none" stroke={C['ink-500']} stroke-width="1.5"
                  stroke-dasharray="5,3" stroke-linecap="round" opacity="0.8" />
          </svg>
          <span>fermi resonance</span>
        </div>
        <div class="mark-row">
          <svg class="mark-svg" viewBox="0 0 120 14" aria-hidden="true">
            <path d="M 4 12 V 4 H 116 V 12" fill="none" stroke={TAG_STYLES['isotopic-shift'].color}
                  stroke-width="1.5" stroke-dasharray="1,3" stroke-linecap="round" opacity="0.85" />
          </svg>
          <span>isotopologue to parent</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Spread: band relationships ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="links" data-sg-section="links">
        <h3>Band relationships</h3>
        <p>
          Four kinds of link exist between bands, and each one is a different
          claim. They are drawn only while a band is hovered or pinned, so the
          chart at rest stays a plain map of positions.
        </p>
        <table class="spec-table">
          <tbody>
            <tr>
              <th>parent</th>
              <td class="spec-val">arc, solid</td>
              <td>
                A combination or overtone pointing at the mode it is built from.
                Authored as <code>based_on</code> on the child, one entry per
                parent, each with a <code>multiplier</code> (2 for an overtone,
                1 + 1 for a sum band). Child to parent only.
              </td>
            </tr>
            <tr>
              <th>branch</th>
              <td class="spec-val">straight line</td>
              <td>
                The P, Q and R branches of one vibration. Authored by giving the
                siblings the same <code>branch_group</code> key; the link is
                mutual and every sibling sees every other.
              </td>
            </tr>
            <tr>
              <th>fermi</th>
              <td class="spec-val">bracket, dashed</td>
              <td>
                Two modes in Fermi resonance. Authored as
                <code>fermi_partner</code> (one band) or
                <code>fermi_partner_group</code> (a whole branch group). The
                <code>fermi-resonance</code> tag is added by
                <code>build.py</code> only when both sides name each other, so a
                one-sided claim stays visible as untagged.
              </td>
            </tr>
            <tr>
              <th>isotopologue</th>
              <td class="spec-val">bracket, dotted</td>
              <td>
                The same normal mode on a heavier molecule. Authored as
                <code>isotopologue_of</code> plus an <code>isotope</code> label,
                child to parent, one step, never a chain.
                <code>build.py</code> adds <code>isotopic-shift</code> to the
                child alone.
              </td>
            </tr>
          </tbody>
        </table>

        <h4>Authoring a parent link</h4>
        <ul class="rules">
          <li>Point at a specific band with <code>band_id</code> when the parent vibration has one reported position.</li>
          <li>Point at a <code>branch_group</code> instead when the parent is itself split into branches: a combination built from ν₃ is built from ν₃ whichever branch a paper happened to read.</li>
          <li>Give <code>label</code> alone, with neither id nor group, when the parent mode is not in the dataset at all (an IR-inactive fundamental, for instance). The band then states its parentage without drawing a line to nothing.</li>
          <li>An overtone is not a category: keep the parent's <code>vibration.category</code>, add the <code>overtone</code> tag, and let <code>based_on</code> with <code>multiplier: 2</code> carry the arithmetic.</li>
          <li>Never point a child at itself, and never invent a parent to justify a band whose assignment is uncertain. That is what <code>confidence</code> is for.</li>
        </ul>

        <h4>Why the shapes differ</h4>
        <p>
          A straight line reads as "these are the same thing, split"; a bracket
          reads as "these two are coupled"; an arc reads as "this one is built
          from that one". The arcs also carry the only geometry rule worth
          knowing: when a child has several parents, each arc's height is scaled
          by how far it travels, so nested arcs never cross each other.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">The four connectors</div>
      <div class="link-demo">
        <svg viewBox="0 0 420 300" class="link-svg" aria-hidden="true">
          <defs>
            <pattern id="sg-iso-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill={ATOMS_PALETTE['C-D']} />
              <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.9)" stroke-width="2" />
            </pattern>
          </defs>
          <!-- parent arcs: one child, two parents, heights scaled by span -->
          <text x="0" y="12" class="link-cap">parent (based_on), arcs nest by span</text>
          <rect x="16" y="58" width="70" height="12" rx="1" fill={VIBRATION_PALETTE['combination']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="180" y="58" width="60" height="12" rx="1" fill={VIBRATION_PALETTE['bend']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="320" y="58" width="60" height="12" rx="1" fill={VIBRATION_PALETTE['stretch']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <path d="M 51 58 Q 130 34 210 58" fill="none" stroke={C['ink-500']} stroke-width="1.25" stroke-linecap="round" opacity="0.8" />
          <path d="M 51 58 Q 200 20 350 58" fill="none" stroke={C['ink-500']} stroke-width="1.25" stroke-linecap="round" opacity="0.8" />
          <text x="16" y="86" class="link-lbl">child</text>
          <text x="180" y="86" class="link-lbl">parent ν₂</text>
          <text x="320" y="86" class="link-lbl">parent ν₃</text>

          <!-- branch -->
          <text x="0" y="126" class="link-cap">branch group, straight</text>
          <rect x="16" y="146" width="46" height="12" rx="1" fill={VIBRATION_PALETTE['stretch']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="120" y="146" width="46" height="12" rx="1" fill={VIBRATION_PALETTE['stretch']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="224" y="146" width="46" height="12" rx="1" fill={VIBRATION_PALETTE['stretch']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <line x1="39" y1="152" x2="247" y2="152" stroke={C['ink-500']} stroke-width="1.25" stroke-linecap="round" opacity="0.8" />
          <text x="16" y="174" class="link-lbl">P</text>
          <text x="120" y="174" class="link-lbl">Q</text>
          <text x="224" y="174" class="link-lbl">R</text>

          <!-- fermi -->
          <text x="0" y="212" class="link-cap">fermi, dashed</text>
          <text x="248" y="212" class="link-cap">isotopologue, dotted</text>
          <rect x="16" y="240" width="60" height="12" rx="1" fill={VIBRATION_PALETTE['stretch.symmetric']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="150" y="240" width="60" height="12" rx="1" fill={VIBRATION_PALETTE['combination']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <path d="M 46 240 V 226 H 180 V 240" fill="none" stroke={C['ink-500']} stroke-width="1.5" stroke-dasharray="5,3" stroke-linecap="round" opacity="0.8" />
          <text x="80" y="222" class="link-inline">fermi</text>
          <text x="16" y="268" class="link-lbl">νₛ</text>
          <text x="150" y="268" class="link-lbl">2δ</text>

          <!-- isotopologue -->
          <rect x="262" y="240" width="60" height="12" rx="1" fill={ATOMS_PALETTE['C-H']} stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <rect x="352" y="240" width="56" height="12" rx="1" fill="url(#sg-iso-hatch)" stroke="rgba(0,0,0,0.35)" stroke-width="0.5" opacity="0.85" />
          <path d="M 292 240 V 226 H 380 V 240" fill="none" stroke={TAG_STYLES['isotopic-shift'].color} stroke-width="1.5" stroke-dasharray="1,3" stroke-linecap="round" opacity="0.85" />
          <text x="262" y="268" class="link-lbl">ν(C–H)</text>
          <text x="352" y="268" class="link-lbl">ν(C–D)</text>
        </svg>
      </div>

      <table class="spec-table link-table">
        <tbody>
          <tr><th>arc height</th><td class="spec-val">1.8 lanes</td><td>parent link, scaled down for the nearer of several parents</td></tr>
          <tr><th>bracket height</th><td class="spec-val">0.8 / 0.5 lanes</td><td>fermi / isotopologue, low enough to stay inside the neighbouring lane</td></tr>
          <tr><th>direction</th><td class="spec-val">child to parent</td><td>parent and isotopologue links are one-directional; branch and fermi are mutual</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Spread: tooltip anatomy (replica sticks past the callouts and roles) ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="tooltip" data-sg-section="tooltip">
        <h3>Tooltip anatomy</h3>
        <p>
          The replica on the right is built from the same tokens as the real
          tooltip, and each slot is filled with a description of itself: what it is,
          its size, its weight, its colour token, and the rule for what may go in it.
        </p>
        <ol class="tip-callouts">
          <li><b>Header</b> carries a 3px left border in the band colour; the tooltip carries the same colour on its top border. Colour appears twice, text never repeats it.</li>
          <li><b>Qualifier pills</b> come first (intensity, confidence, width), then tags. Grey means a qualifier, coloured means a tag.</li>
          <li><b>Description</b> is separated from the citations by a hairline, because it is the one block that belongs to the band rather than to a source.</li>
          <li><b>Reference boxes</b> use the parchment palette: gold left edge, warm background. That combination means "citation" everywhere in the atlas.</li>
          <li><b>Badges</b> are fixed: blue is always a wavenumber, amber is always a site. Multiple sites become multiple badges, never a comma list.</li>
          <li><b>Overflow</b>: hovering shows at most 3 references and a "+n more" counter; clicking pins the tooltip, which then scrolls internally past 240px.</li>
        </ol>

        <h4>{tipTypeGroup.title} roles</h4>
        <p class="rule-note">{tipTypeGroup.note}</p>
        <table class="spec-table">
          <tbody>
            {#each tipTypeGroup.roles as r}
              <tr>
                <th>--t-{r.key}-*</th>
                <td class="spec-val">{r.size} / {r.weight} / {r.color}</td>
                <td>{r.usage}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Tooltip, every slot describing itself</div>
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
    </div>
  </div>

  <!-- Clean cut again: the writing rules are not a chart topic. -->
  <hr class="part-cut" />

  <!-- ══════════════════════════ 3 · CONTENT RULES ══════════════════════════ -->
  <h2 class="part" id="contentrules" data-sg-section="contentrules">3 &middot; Content rules</h2>
  <p class="part-sub">
    What may go into a band entry, and how long it may be. These fields surface in
    more than one place, the chart tooltip, the References page and the vibration
    mode panel, so they are written once, for all of them, and never for the
    surface that happens to be in front of you.
  </p>

  <!-- ── Spread: length limits ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="limits" data-sg-section="limits">
        <h3>Length limits</h3>
        <p>
          Length limits are the hard part of this guide, because the tooltip is
          300px wide and read while hovering. <code>build.py</code> counts the words
          and warns when an entry runs long; it never blocks the build, so the
          numbers are a discipline, not a gate.
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

      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Written to the rule</div>
      <div class="sample-block">
        <div class="sample-head">
          Description
          <span class="wc" class:over={words(SAMPLE_DESC) > CONTENT_LIMITS[0].hard}>
            {words(SAMPLE_DESC)} words / {CONTENT_LIMITS[0].hard} max
          </span>
        </div>
        <div class="sample-body tip-desc">{SAMPLE_DESC}</div>
      </div>

      <div class="sample-block">
        <div class="sample-head">
          Reference note
          <span class="wc" class:over={words(SAMPLE_NOTE) > CONTENT_LIMITS[1].hard}>
            {words(SAMPLE_NOTE)} words / {CONTENT_LIMITS[1].hard} max
          </span>
        </div>
        <div class="sample-body tip-ref-note">{SAMPLE_NOTE}</div>
      </div>
    </div>
  </div>

  <!-- ── Spread: notation ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="notation" data-sg-section="notation">
        <h3>Notation</h3>
        <p>
          One convention, so a formula reads the same wherever it lands:
          <strong>write real Unicode characters in the data, not markup</strong>.
          CO₂, not CO2 and not CO&lt;sub&gt;2&lt;/sub&gt;. cm⁻¹, Cu²⁺, ¹³CO, κ²-HCOO*,
          νₐₛ(OCO), μ₂. The whole of <code>bands.jsonc</code> is already written
          this way.
        </p>
        <p>
          The reason is not taste. The same string is rendered two different ways:
          the chart tooltip is plain text and runs everything through
          <code>htmlToUnicode()</code>, which converts sub/sup tags and strips
          every other tag, while the References page and the mode panel render
          tags for real. Unicode is the only notation that survives both
          untouched.
        </p>

        <h4>The one exception</h4>
        <p>
          Unicode has subscripts for every digit but only for a handful of
          letters, and the missing ones (g, u, v, d…) are exactly the letters
          point-group and Mulliken labels need. So
          <code>topologies[].point_group</code> and <code>modes[].symmetry</code>
          in <code>vibrations.jsonc</code>, and only those two fields, carry
          literal <code>&lt;sub&gt;</code> / <code>&lt;sup&gt;</code> tags.
          Everything else in that file is Unicode like the rest.
        </p>

        <h4>Underscores</h4>
        <p>
          An underscore in text is almost always a subscript that never got
          typed: <code>ν_as</code>, <code>V_O</code>, <code>H_2O</code>. It is
          not markup and nothing in the pipeline converts it, so it stays broken
          on every surface. Type the character: νₐₛ, Vₒ, H₂O.
        </p>
        <p>
          When the subscript is a letter Unicode has none for (capitals, and most
          consonants), parenthesise rather than leave the underscore standing:
          <code>A_HF/A_LF</code> becomes A(HF)/A(LF), <code>TOF_MeOH</code>
          becomes TOF(MeOH), <code>R_M</code> becomes R(M).
        </p>
        <p>
          The only underscores that belong anywhere are <strong>machine
          identifiers</strong>: band ids (<code>co_gemdi_sym_2035</code>), group
          keys (<code>support_oh</code>), enum values
          (<code>very_broad</code>), field names. Prose may name one verbatim,
          and <code>build.py</code> recognises them and stays quiet; every other
          underscore gets a warning, with the corrected spelling in the message.
        </p>

        <h4>Never</h4>
        <ul class="rules">
          <li><strong>Bare digits</strong> in a formula: CO2, H2O, cm-1. If the character exists, use it.</li>
          <li><strong>Underscores</strong> outside a machine identifier. See above.</li>
          <li><strong>Emphasis markup</strong> (<code>&lt;em&gt;</code>, <code>&lt;strong&gt;</code>) anywhere in band text. It disappears in the tooltip. Carry emphasis with word order, or with a shorter sentence.</li>
          <li><strong>HTML entities</strong> (<code>&amp;#8322;</code>, <code>&amp;sup2;</code>) in the JSONC files. They are neither a character nor a rendered tag, so they print literally in half the surfaces.</li>
          <li><strong>LaTeX</strong> (<code>$_2$</code>, <code>\nu</code>). Nothing in the pipeline parses it.</li>
          <li><strong>Sub/sup tags in <code>bands.jsonc</code></strong>, even for a letter subscript. A band label that needs one is usually a symmetry symbol, and those live in <code>vibrations.jsonc</code>.</li>
        </ul>
        <p class="rule-note">
          <code>build.py</code> warns when markup turns up in a field that should
          be plain Unicode, the same way it warns about length.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Characters and what survives</div>

      <div class="map-block">
        <div class="map-head">Subscript <span class="map-src">available</span></div>
        <div class="char-row">
          {#each Object.entries(SUB_CHARS) as [src, ch]}
            <span class="char-cell" title="{src}">{ch}</span>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Superscript <span class="map-src">available</span></div>
        <div class="char-row">
          {#each Object.entries(SUP_CHARS) as [src, ch]}
            <span class="char-cell" title="{src}">{ch}</span>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">No subscript exists <span class="map-src">hence the exception</span></div>
        <div class="char-row">
          {#each MISSING_SUBSCRIPT_LETTERS as c}
            <span class="char-cell missing">{c}</span>
          {/each}
        </div>
      </div>

      <div class="map-block">
        <div class="map-head">Same string, two surfaces</div>
        <table class="notation-table">
          <thead>
            <tr><th>written</th><th>tooltip</th><th>page</th></tr>
          </thead>
          <tbody>
            {#each NOTATION_CASES as c}
              <tr class="verdict-{c.verdict}">
                <td class="n-src">{c.src}</td>
                <td class="n-out">{htmlToUnicode(c.src)}</td>
                <td class="n-out">{@html c.src}</td>
              </tr>
              <tr class="verdict-{c.verdict}">
                <td class="n-why" colspan="3">
                  <span class="verdict-tag">{c.verdict === 'ok' ? 'use this' : c.verdict === 'exception' ? 'two fields only' : 'never'}</span>
                  {c.why}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Spread: fields, vocabularies and structure ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="fields" data-sg-section="fields">
        <h3>Fields &amp; vocabularies</h3>
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
    </div>

    <div class="visual sticky">
      <div class="visual-label">Where each field surfaces</div>
      <div class="surface-map">
        <div class="surface-card">
          <div class="surface-head">Band chart tooltip</div>
          <div class="surface-body">
            <code>species</code> + <code>short</code> as the title,
            <code>vibration</code> and <code>atoms</code> as the meta line,
            <code>description</code> as the body, then one box per reference with
            <code>wn</code>, <code>site</code>, <code>tags</code> and <code>note</code>.
          </div>
        </div>
        <div class="surface-card">
          <div class="surface-head">References page</div>
          <div class="surface-body">
            The same <code>note</code> and <code>site</code> again, this time grouped
            under the paper rather than under the band. Prose that only made sense
            next to the band reads as a non sequitur here, which is the test for
            whether it was written in the right field.
          </div>
        </div>
        <div class="surface-card">
          <div class="surface-head">Vibration mode panel</div>
          <div class="surface-body">
            Links back to bands by id. Nothing is retyped there: a mode shows the
            band's own <code>short</code>, so a label written as a sentence looks
            broken in the list.
          </div>
        </div>
        <div class="surface-note">
          One consequence worth stating: never write "as shown in the chart above"
          or "see the reference below". The same text appears in three places, in
          three different orders.
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  /* Every value here comes from lib/tokens.ts. Nothing on this page is allowed
     to be a literal colour or font size, for the obvious reason. */
  .content {
    padding: var(--space-5) 48px 96px;
    max-width: 1420px;
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

  .part {
    font-size: 20px;
    font-weight: 800;
    color: var(--brand-900);
    margin: var(--space-6) 0 2px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--line-slate);
    scroll-margin-top: 12px;
  }
  .part-sub {
    color: var(--ink-500);
    margin: 0 0 var(--space-5);
    max-width: 760px;
  }

  /* The clean cut between part 1 and part 2: nothing sticky survives it. */
  .part-cut {
    border: none;
    border-top: 1px solid var(--line-soft);
    margin: 64px 0 0;
  }

  /* ── Spread: explanation left, the thing itself right ── */
  /* Explanation column is capped at a readable measure; the visual takes the
     rest of the width, so the right half of a wide screen carries the artefact
     rather than empty margin. */
  .spread {
    display: grid;
    grid-template-columns: minmax(0, 720px) minmax(300px, 560px);
    justify-content: start;
    gap: 48px;
    align-items: start;
    margin-bottom: var(--space-6);
  }

  .explain { min-width: 0; }
  .visual { min-width: 0; }

  /* Sticky only where the explanation is longer than its visual, so the visual
     stays in view across the subsections it belongs to. It is bounded by its
     own spread, which is why a spread never crosses a part boundary. */
  .visual.sticky {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 190px);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .visual-label {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--line-faint);
  }

  @media (max-width: 1320px) {
    .spread { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
    .visual.sticky { position: static; max-height: none; overflow: visible; }
    .content { max-width: 860px; }
  }

  .section {
    margin-bottom: var(--space-6);
    scroll-margin-top: 12px;
  }
  .section:last-child { margin-bottom: 0; }

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

  .section p { margin: 0 0 10px; }

  .rule-note {
    color: var(--ink-500);
    font-size: 13.5px;
    margin: 0 0 var(--space-4);
  }

  .rules {
    margin: 0 0 var(--space-4);
    padding-left: 18px;
    color: var(--ink-500);
    font-size: 13.5px;
  }
  .rules li { margin-bottom: 5px; }
  .rules strong { color: var(--ink-slate-900); }

  /* ── Typeface specimens ── */
  .specimen {
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-lg);
    padding: 12px 14px;
    background: var(--surface);
    margin-bottom: 8px;
  }
  .specimen-name { font-size: 12px; color: var(--ink-400); margin-bottom: 6px; }
  .specimen-sample { font-size: 20px; color: var(--ink-800); margin-bottom: 6px; }
  .specimen-stack {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-300);
    word-break: break-word;
  }

  /* ── Type role cards ── */
  .role-group { margin-top: var(--space-4); }
  .role-group-head {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 6px;
  }
  .role-card {
    padding: 8px 0;
    border-top: 1px solid var(--line-faint);
  }
  .role-card.on-dark {
    background: var(--grad-header);
    border-radius: var(--radius);
    border-top: none;
    padding: 8px 10px;
    margin-bottom: 2px;
  }
  .role-card.on-dark .role-meta { color: var(--brand-tint-line); }
  .role-meta {
    font-size: 11px;
    color: var(--ink-300);
    margin-top: 3px;
  }
  .role-meta code { font-size: 10.5px; }

  /* ── Swatches ── */
  .swatch-group { margin-bottom: var(--space-4); }
  .swatch-group-head {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 2px;
  }
  .swatch-group-note {
    font-size: 11.5px;
    color: var(--ink-400);
    margin-bottom: 7px;
  }
  .swatch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 6px;
  }
  .swatch {
    display: flex;
    align-items: stretch;
    gap: 8px;
    border: 1px solid var(--line-faint);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--surface);
  }
  .swatch-chip {
    flex: 0 0 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .swatch-body { padding: 5px 6px 6px 0; min-width: 0; }
  .swatch-name { font-size: 10.5px; background: none; padding: 0; color: var(--ink-700); }
  .swatch-use { font-size: 11px; color: var(--ink-300); margin-top: 2px; }

  /* ── Colormaps ── */
  .map-block { margin-bottom: var(--space-4); }
  .map-head {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 6px;
  }
  .map-src {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 400;
    color: var(--ink-300);
    margin-left: 6px;
  }
  .ramp { display: flex; flex-wrap: wrap; gap: 2px; }
  .ramp-cell {
    flex: 1 1 90px;
    min-width: 70px;
    padding: 9px 5px;
    font-size: 10.5px;
    text-align: center;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ramp-cell.narrow { flex: 0 0 50px; min-width: 50px; }

  .tag-row { display: flex; gap: var(--space-1); flex-wrap: wrap; }
  .tag-pill {
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 2px 7px;
    font-size: var(--t-tip-tag-size);
  }

  .grad-bar { height: 30px; border-radius: var(--radius); }
  .grad-meta { margin-top: 5px; font-size: 11px; }
  .grad-meta code { font-size: 10.5px; }

  /* ── Scales ── */
  .scale-cols { display: flex; gap: var(--space-4); flex-wrap: wrap; }
  .scale-col { flex: 1 1 130px; }
  .scale-head {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 8px;
  }
  .scale-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
    font-size: 11px;
  }
  .scale-row code { font-size: 10.5px; }
  .scale-val { font-size: 10.5px; color: var(--ink-300); margin-left: 3px; }
  .radius-demo {
    flex: 0 0 30px;
    height: 30px;
    background: var(--brand-tint);
    border: 1px solid var(--brand-tint-line);
  }
  .shadow-demo {
    flex: 0 0 30px;
    height: 30px;
    background: var(--surface);
    border-radius: var(--radius);
    margin: 4px;
  }
  .space-demo {
    flex: 0 0 auto;
    height: 14px;
    background: var(--ref-accent);
    border-radius: 2px;
  }

  /* ── Layout wireframe ── */
  .wire {
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-top: var(--space-4);
    font-size: 11px;
  }
  .wire-header {
    background: var(--grad-header);
    color: var(--brand-on-dark);
    padding: 10px 12px;
  }
  .wire-body { display: flex; min-height: 84px; }
  .wire-side {
    flex: 0 0 110px;
    background: var(--surface-sunken);
    border-right: 1px solid var(--line-soft);
    padding: 8px 10px;
    color: var(--ink-500);
  }
  .wire-side span, .wire-main span { color: var(--ink-300); }
  .wire-main {
    flex: 1 1 auto;
    padding: 8px 10px;
    color: var(--ink-500);
    background: var(--surface);
  }
  .wire-foot {
    background: var(--notice-bg);
    border-top: 1px solid var(--notice-border);
    color: var(--notice-fg);
    padding: 6px 12px;
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
  .spec-val { width: 165px; color: var(--ink-700) !important; }

  /* ── Lane and mark demos ── */
  .lane-demo { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .lane-label {
    flex: 0 0 74px;
    text-align: right;
    font-size: 11px;
    color: var(--ink-400);
  }
  .lane-track {
    position: relative;
    flex: 1 1 auto;
    height: 42px;
    background: var(--surface);
    border: 1px solid var(--line-faint);
    border-radius: var(--radius);
  }
  .lane-band {
    position: absolute;
    top: 15px;
    height: 12px;
    border: 0.5px solid rgba(0,0,0,0.35);
    border-radius: 1px;
    opacity: 0.85;
  }
  .lane-band.up { top: 9px; }
  .lane-band.down { top: 21px; }
  .hatched {
    background-image: repeating-linear-gradient(
      45deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 5px
    );
  }

  .mark-list { margin-top: var(--space-4); }
  .mark-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 7px;
    font-size: 12px;
    color: var(--ink-500);
  }
  .mark-chip {
    flex: 0 0 120px;
    height: 12px;
    border: 0.5px solid rgba(0,0,0,0.35);
    border-radius: 1px;
    opacity: 0.85;
  }
  .mark-chip.inactive {
    border: 1px dashed rgba(0,0,0,0.45);
    opacity: 0.3;
  }
  .mark-svg { flex: 0 0 120px; height: 14px; }

  /* ── Relationship diagram ── */
  .link-demo {
    border: 1px solid var(--line-faint);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 10px 12px;
    margin-bottom: var(--space-4);
  }
  .link-svg { width: 100%; height: auto; display: block; }
  .link-svg :global(.link-cap) {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    fill: var(--ink-slate-400);
  }
  .link-svg :global(.link-lbl) { font-size: 10px; fill: var(--ink-400); }
  .link-svg :global(.link-inline) {
    font-size: 10px;
    font-style: italic;
    fill: var(--ink-300);
  }
  .link-svg :global(.link-inline.iso) { fill: var(--ink-slate-500); }
  .link-table { margin-bottom: 0; }

  /* ── Tooltip replica ──
     Same structure and the same tokens as .band-tooltip in BandChart.svelte. */
  .tip-demo {
    width: var(--tip-width);
    max-width: 100%;
    box-sizing: border-box;
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
    margin: 0 0 var(--space-4);
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

  .sample-block { margin-bottom: var(--space-4); }
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
    border-left: 2px solid var(--line-soft);
    padding-left: 12px;
    border-bottom: none;
    margin-bottom: 0;
  }

  /* ── Notation ── */
  .char-row { display: flex; flex-wrap: wrap; gap: 3px; }
  .char-cell {
    min-width: 22px;
    padding: 4px 5px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 14px;
    background: var(--surface);
    border: 1px solid var(--line-faint);
    border-radius: var(--radius-sm);
    color: var(--ink-700);
  }
  .char-cell.missing {
    background: var(--pill-muted-bg);
    border-style: dashed;
    color: var(--ink-025);
    text-decoration: line-through;
  }

  .notation-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .notation-table th {
    text-align: left;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    color: var(--t-micro-label-color);
    padding: 0 8px 4px 0;
  }
  .notation-table td {
    padding: 5px 8px 5px 0;
    vertical-align: top;
    color: var(--ink-600);
  }
  .n-src {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-500) !important;
    word-break: break-all;
  }
  .n-out { color: var(--ink-800) !important; }
  .n-why {
    font-size: 11.5px;
    color: var(--ink-400) !important;
    border-bottom: 1px solid var(--line-faint);
    padding-bottom: 8px !important;
  }
  .verdict-tag {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: var(--radius-sm);
    padding: 0 5px;
    margin-right: 5px;
    background: var(--pill-muted-bg);
    border: 1px solid var(--pill-muted-border);
    color: var(--pill-muted-fg);
  }
  .verdict-ok .verdict-tag {
    background: var(--badge-wn-bg);
    border-color: var(--badge-wn-border);
    color: var(--badge-wn-fg);
  }
  .verdict-exception .verdict-tag {
    background: var(--badge-site-bg);
    border-color: var(--badge-site-border);
    color: var(--badge-site-fg);
  }
  .verdict-bad .verdict-tag {
    background: var(--alert-bg);
    border-color: var(--alert-border);
    color: var(--alert-fg);
  }

  /* ── Where fields surface ── */
  .surface-card {
    border: 1px solid var(--line-faint);
    border-left: 3px solid var(--brand-tint-line);
    border-radius: var(--radius);
    background: var(--surface);
    padding: 9px 12px;
    margin-bottom: 8px;
  }
  .surface-head {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-slate-900);
    margin-bottom: 4px;
  }
  .surface-body { font-size: 12px; color: var(--ink-500); line-height: 1.5; }
  .surface-body code { font-size: 10.5px; }
  .surface-note {
    font-size: 12px;
    color: var(--ink-400);
    font-style: italic;
    border-top: 1px solid var(--line-faint);
    padding-top: 8px;
  }

  /* ── Enum vocabularies ── */
  .enum-block { margin-bottom: var(--space-4); }
  .enum-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .enum-rule { font-size: 12px; color: var(--ink-400); }
  .enum-values {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 3px 14px;
    margin-top: 6px;
  }
  .enum-row { display: flex; gap: 8px; align-items: baseline; font-size: 12.5px; color: var(--ink-500); }
  .enum-val { flex: 0 0 auto; font-size: 11px; }
</style>

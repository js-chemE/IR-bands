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
    { id: 'display',      label: 'Screens & presenting' },
    { id: 'bandchart',    label: '2 · Band chart', part: true },
    { id: 'chart-layout', label: 'Chart layout & marks' },
    { id: 'links',        label: 'Band relationships' },
    { id: 'tooltip',      label: 'Tooltip anatomy' },
    { id: 'looks',        label: 'Looks a band takes' },
    { id: 'legend',       label: 'Legend & tag chips' },
    { id: 'contentrules', label: '3 · Content rules', part: true },
    { id: 'voice',        label: 'Voice & register' },
    { id: 'limits',       label: 'Length limits' },
    { id: 'notation',     label: 'Notation' },
    { id: 'fields',       label: 'Fields & vocabularies' },
    { id: 'pages',        label: '4 · Pages', part: true },
    { id: 'knowledgepage', label: 'Knowledge page' },
    { id: 'datasetpage',  label: 'Dataset page' },
    { id: 'drawing',      label: 'Drawing molecules' },
    { id: 'guides',       label: 'The other guides' },
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
    ISOTOPE_STYLE,
    RADII,
    SHADOWS,
    SPACING,
    GRADIENTS,
    PAGE_LAYOUT,
    WIDTH_CLASSES,
    PRESENTATION,
    CHART_LAYOUT_DOCS,
    CONTENT_LIMITS,
    CARD_LAYOUT,
    FONTS,
    C,
  } from '../lib/tokens';
  import {
    TAG_ROLE_ORDER,
    TAG_ROLE_LABEL,
    TAG_ROLE_NOTE,
    TAG_ROLE_BAND,
    TECHNIQUES,
    TECHNIQUE_FAMILY,
  } from '../lib/dataModel';
  import { ELEMENT_COLORS, ELEMENT_RADIUS_PM } from '../lib/elementColors';
  import DrawingExample from './DrawingExample.svelte';
  import { lightTint } from '../lib/lightColor';
  import { SUB_CHARS, SUP_CHARS, MISSING_SUBSCRIPT_LETTERS, htmlToUnicode } from '../lib/notation';
  import type { TypeRole } from '../lib/tokens';

  const dispatch = createEventDispatcher<{ active: { id: string } }>();

  const generalTypeGroups = TYPE_GROUPS.filter(g => g.key !== 'tip');

  /* The new sections below read these rather than restating them: the tag
     roles in their declared order, and the techniques grouped by family. */
  const tagRoles = TAG_ROLE_ORDER.map(r => ({
    key: r,
    label: TAG_ROLE_LABEL[r],
    note: TAG_ROLE_NOTE[r],
    row: TAG_ROLE_BAND[r],
  }));
  const FAMILIES = ['infrared', 'raman', 'computational'] as const;
  const techFamilies = FAMILIES.map(f => ({
    family: f,
    values: TECHNIQUES.filter(x => TECHNIQUE_FAMILY[x.key] === f),
  }));
  /** Real element colours and real relative sizes, both from the data. */
  const drawnElements = ['C', 'O', 'H', 'N', 'M'].map(el => ({
    el,
    color: ELEMENT_COLORS[el],
    pm: ELEMENT_RADIUS_PM[el],
  }));
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
      <div class="specimen">
        <div class="specimen-name">Serif &middot; <code>--font-serif</code> &middot; formulas only</div>
        <div class="specimen-sample" style="font-family: var(--font-serif)">
          (∂μ / ∂Q)₀ ≠ 0 &middot; A = ε · c · l
        </div>
        <div class="specimen-stack">{FONTS.serif}</div>
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
        <div class="map-head">Tags <span class="map-src">TAG_STYLES + lightTint</span></div>
        <div class="tag-row">
          {#each Object.entries(TAG_STYLES) as [k, s]}
            <span class="tag-pill" style="background:{s.background}; border-color:{s.border}; color:{s.color}">{k}</span>
          {/each}
          <!-- The one pill no table can hold: a Raman excitation wavelength is
               a number, so it is coloured from the light itself and washed out
               to the same shape as the entries above (lib/lightColor.ts). -->
          {#each [244, 405, 488, 532, 633, 785, 1064] as nm}
            {@const s = lightTint(nm)}
            <span class="tag-pill" style="background:{s.background}; border-color:{s.border}; color:{s.color}">{nm} nm</span>
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

  <div class="spread">
    <div class="explain">
      <section class="section" id="display" data-sg-section="display">
        <h3>Screens the atlas is read on</h3>
        <p>
          Three of them, and the difference between them is how much room the
          content was given, never how wide the window happens to be. The shell
          measures itself and writes the answer on the document element, as
          <code>data-w</code> and, for anything that is not <code>wide</code>,
          <code>data-narrow</code>.
        </p>
        <table class="spec-table">
          <tbody>
            {#each WIDTH_CLASSES as w}
              <tr>
                <th>{w.key}</th>
                <td class="spec-val">{w.max === Infinity ? 'wider' : `≤ ${w.max}px`}</td>
                <td>{w.usage}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <ul class="rules">
          <li>A responsive rule keys off <code>data-w</code>, or off the content box with <code>@container content (…)</code>. Never off <code>@media (max-width: …)</code>: a media query asks the window, and the window is not what the layout was given.</li>
          <li>The scroll model is the same at every width. The header stays put and the main area scrolls inside itself, because four pages hang their table of contents spy off that element.</li>
          <li>Below <code>wide</code> the sidebar becomes a drawer and the band chart is withheld rather than reflowed. Everything else is expected to read in one column.</li>
          <li>A touch target is at least 24px, and 44px where a thumb is the likely pointer.</li>
        </ul>
      </section>

      <section class="section" id="presenting">
        <h3>Presenting to a room</h3>
        <p>
          A lecture theatre poses a problem of angular size, not of information
          density: the projector is too small for the room and everything on it
          is read from five times the distance a desk gives. So the mode is one
          magnification, and a short list of subtractions. It is reached by
          <kbd>Shift</kbd>+<kbd>P</kbd>, by <code>?present=1</code> in the URL,
          or by the Present button that fades in when the header is hovered.
        </p>
        <p>
          The magnification is a single CSS <code>zoom</code> on the shell.
          Zoom reflows, where a transform would only paint bigger, and it
          reaches the font sizes still written as literal pixels in components.
          It also composes with the steps above for nothing: the shell measures
          itself from inside the zoom, so at 1.75× on a 1920px projector it
          reports a <code>mid</code> shell and lays out for the room it
          actually has. That is the whole reason those steps are measured.
        </p>
        <table class="spec-table">
          <tbody>
            {#each PRESENTATION.subtractions as sub}
              <tr><th>{sub.what}</th><td>{sub.why}</td></tr>
            {/each}
          </tbody>
        </table>
        <ul class="rules">
          <li>Everything taken away is listed in <code>PRESENTATION.subtractions</code> with the reason it is noise from the back of a room. Add to that list in the same change as the CSS, or this table quietly stops being true.</li>
          <li>Subtract what cannot be read at that distance or does not belong to the talk. Do not subtract something merely because the presenter is unlikely to point at it.</li>
          <li>Viewport coordinates and the shell's own coordinates differ by the scale while the mode is on. <code>lib/zoom.ts</code> converts between them; the band chart is the only thing that does arithmetic in pixels, so it is the only caller.</li>
        </ul>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">The three shells</div>
      {#each WIDTH_CLASSES as w}
        <div class="wire shell-wire">
          <div class="wire-header">
            {#if w.key !== 'wide'}<span class="wire-burger">☰</span>{/if}
            Header · {w.key}
          </div>
          <div class="wire-body">
            {#if w.key === 'wide'}
              <div class="wire-side">Sidebar<br /><span>220px, docked</span></div>
            {/if}
            <div class="wire-main">
              {#if w.key === 'wide'}
                Main area<br /><span>band chart drawn at its full canvas</span>
              {:else}
                Main area, full width<br />
                <span>sidebar is a drawer · band chart withheld</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      <div class="visual-label scale-label">Presentation scale</div>
      <div class="scale-ladder">
        {#each PRESENTATION.scales as sc}
          <div class="ladder-row" class:is-default={sc === PRESENTATION.defaultScale}>
            <span class="ladder-n">{Math.round(sc * 100)}%</span>
            <span class="ladder-bar" style="width:{sc * 34}px"></span>
            <span class="ladder-note">
              1920px reads as {Math.round(1920 / sc)}px{sc === PRESENTATION.defaultScale ? ' · entry point' : ''}
            </span>
          </div>
        {/each}
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
          Bands are packed into lanes by the <code>lanes</code> table, which names the
          groups sharing each row. Overlaps inside a lane stagger into sub-lanes
          0, +1, &minus;1, in that order. A fourth overlapping band falls back to the
          centre line and is logged by the build, which is usually the signal that one
          mode has been split into more bands than it needs: several isotopologues of
          one band belong on one band, with the positions in the assignment.
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
            <path d="M 4 12 V 4 H 116 V 12" fill="none" stroke={ISOTOPE_STYLE.color}
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
                <code>build.py</code> adds the substitution tag (<code>deuterium</code>, <code>carbon-13</code>, <code>oxygen-18</code>) to the
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
          <path d="M 292 240 V 226 H 380 V 240" fill="none" stroke={ISOTOPE_STYLE.color} stroke-width="1.5" stroke-dasharray="1,3" stroke-linecap="round" opacity="0.85" />
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
      
        <h3>Where a band's detail goes</h3>
        <p>
          Two looks, one card. A <strong>hover</strong> floats it beside the
          pointer and keeps it quiet: the name, the range, the tags, the
          mode's diagram and the bare citations. A <strong>click</strong>
          puts the same card in a sidebar to the right of the chart, with the
          mode diagrams in its header, the band's own description and every
          reference with its note, and the plot re-fits into what is left.
        </p>
        <ul class="rules">
          <li>Docked takes its room from the plot rather than covering it. A pinned card sits exactly where the reader is looking, over the neighbouring lanes, and the bands a selection draws arcs to are the ones most likely to be underneath it.</li>
          <li>Nothing prose-length on a hover. A paragraph is not read off a chart in passing, and it is one click away in the panel.</li>
          <li>The docked order is fixed: name and tags, the mode diagrams, the description, then the references, scrolling under all of it.</li>
          <li>The reference list is the only part that scrolls, so the identity and the description stay put, and the hint under it sits directly after the last reference rather than pinned to the floor.</li>
          <li>Once open the sidebar stays open. Dismissing a band leaves it standing and empty; only its ✕ closes it. A column that came and went with every click would move the chart a third of its width each time.</li>
          <li>It is one component in both looks (<code>BandCard</code>, with <code>full</code> saying how much to draw), never two. What differs is the box around it, which belongs to the host.</li>
        </ul>
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
          Description &middot; 12px / 400 &middot; ink-500 &middot; 120 words at most.
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

  <!-- ── Spread: the looks a band can take ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="looks" data-sg-section="looks">
        <h3>Looks a band takes</h3>
        <p>
          Three things change how a band is drawn without changing where it
          sits. All three are <strong>about the band or the evidence behind
          it</strong>, never about the colour dimension, so they survive every
          switch in the sidebar and can be read together.
        </p>
        <table class="spec-table">
          <tbody>
            <tr>
              <th>Hollow</th>
              <td class="spec-val">selection rule</td>
              <td>
                The mode is inactive in the spectroscopy the chart is set to.
                <code>ir-inactive</code> hollows it while the switch reads IR,
                <code>raman-inactive</code> while it reads Raman. The position
                never moves: only the fill goes.
              </td>
            </tr>
            <tr>
              <th>Faded</th>
              <td class="spec-val">nothing stands</td>
              <td>
                No claim on the band survives the current view: every one of
                them is greyed out or has no technique at all
                (<code>isReferenced</code> in <code>chart.ts</code>). A
                calculation never fades, because it was never a measurement
                that could fail to apply.
              </td>
            </tr>
            <tr>
              <th>Hatched</th>
              <td class="spec-val">isotopologue</td>
              <td>
                Diagonal 5px: the same normal mode on a heavier molecule. On a
                band that is also hollow or faded the hatch is drawn in the
                band's own colour instead of white, since white lines vanish
                on an unfilled shape.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          The two pills in the sidebar do double duty, and which one they do
          depends on the heading they are under. Under <em>Color by</em> they
          switch the look on and off; under <em>Enable &amp; Disable</em> they
          take those bands out of the chart altogether
          (<code>LookPill.svelte</code>).
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">One band, four looks</div>
      <div class="lane-demo">
        <div class="lane-label">plain</div>
        <div class="lane-track">
          <div class="lane-band" style="left:8%; width:40%; background-color:{VIBRATION_PALETTE['stretch']}"></div>
        </div>
      </div>
      <div class="lane-demo">
        <div class="lane-label">hollow</div>
        <div class="lane-track">
          <div class="lane-band hollow-demo" style="left:8%; width:40%; border-color:{VIBRATION_PALETTE['stretch']}"></div>
        </div>
      </div>
      <div class="lane-demo">
        <div class="lane-label">faded</div>
        <div class="lane-track">
          <div class="lane-band" style="left:8%; width:40%; background-color:{VIBRATION_PALETTE['stretch']}; opacity:0.32"></div>
        </div>
      </div>
      <div class="lane-demo">
        <div class="lane-label">hatched</div>
        <div class="lane-track">
          <div class="lane-band hatched" style="left:8%; width:40%; background-color:{VIBRATION_PALETTE['stretch']}"></div>
        </div>
      </div>
      <div class="surface-note">
        The looks compose. A hatched band can also be hollow and faded, which
        is exactly the case the hatch colour rule exists for.
      </div>
    </div>
  </div>

  <!-- ── Spread: the legend and its chips ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="legend" data-sg-section="legend">
        <h3>Legend &amp; tag chips</h3>
        <p>
          Every tag has a <strong>role</strong>, and the roles have one
          declared order (<code>TAG_ROLE_ORDER</code> in
          <code>dataModel.ts</code>). It runs from what the band is, through
          how it was measured, to how far to trust it, and everything that
          renders tags in sequence sorts by it, so the chart legend and the
          Dataset page cannot disagree. The legend marks a change of role with
          a small gap rather than a heading.
        </p>
        <table class="spec-table">
          <tbody>
            {#each tagRoles as r}
              <tr>
                <th>{r.label}</th>
                <td class="spec-val">{r.row === 'band' ? 'the band' : 'the measurement'}</td>
                <td>{r.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p>
          The cut between the two rows is one question: <em>would the tag still
          be true if a different group had measured the band?</em> A
          combination band stays a combination and an IR-inactive mode stays
          forbidden; the state the sample was in, the technique and the laser
          are facts about one experiment.
        </p>

        <h4>Colour, sparingly</h4>
        <p>
          Most chips are the neutral grey pill. A tag gets a colour only where
          it earns one, and the caveat role is the single exception that is
          coloured for being a role at all: red, because a warning has to read
          as a warning at a glance rather than after being looked up.
        </p>

        <h4>The chip no vocabulary can hold</h4>
        <p>
          A Raman excitation wavelength is a number, not a member of a closed
          list, so it cannot live in <code>TAG_STYLES</code>. It is matched by
          shape and coloured from the colour of that light
          (<code>lib/lightColor.ts</code>). Anything that renders a tag from
          the data therefore goes through <code>tagStyle()</code> in
          <code>lib/colors.ts</code> and never indexes the table directly.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Technique chips, by family</div>
      {#each techFamilies as f}
        <div class="map-block">
          <div class="map-head"><code>{f.family}</code></div>
          <div class="tag-row">
            {#each f.values as v}
              <span
                class="tag-pill"
                style="background:{(TAG_STYLES[v.key] ?? DEFAULT_TAG_STYLE).background};
                       border-color:{(TAG_STYLES[v.key] ?? DEFAULT_TAG_STYLE).border};
                       color:{(TAG_STYLES[v.key] ?? DEFAULT_TAG_STYLE).color}"
              >{v.key}</span>
            {/each}
          </div>
        </div>
      {/each}
      <div class="surface-note">
        The family is derived beside the value, so the legend can ask "seen in
        the infrared at all" without ticking seven chips. The gap in the row
        falls at each change of family.
      </div>

      <div class="visual-label" style="margin-top:18px">Laser lines, coloured from the light</div>
      <div class="tag-row">
        {#each [244, 325, 442, 515, 633, 785] as nm}
          {@const tint = lightTint(nm)}
          <span
            class="tag-pill"
            style="background:{tint.background}; border-color:{tint.border}; color:{tint.color}"
          >{nm} nm</span>
        {/each}
      </div>
    </div>
  </div>

  <!-- ══════════════════════════ 3 · CONTENT RULES ══════════════════════════ -->
  <h2 class="part" id="contentrules" data-sg-section="contentrules">3 &middot; Content rules</h2>
  <p class="part-sub">
    What may go into a band entry, and how long it may be. These fields surface in
    more than one place, the chart tooltip, the References page and the vibration
    mode panel, so they are written once, for all of them, and never for the
    surface that happens to be in front of you.
  </p>

  <!-- ── Spread: voice ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="voice" data-sg-section="voice">
        <h3>Voice &amp; register</h3>
        <p>
          The default is the register of the literature this atlas is built
          out of: scientific, professional, and written as though a referee
          will read it. Monai's perspectives and Urakawa's papers are the
          model. Say what is the case, attribute what is not yours, and give
          the number rather than the adjective.
        </p>
        <ul class="plain-list">
          <li><strong>Claims carry their source.</strong> A sentence that rests on a paper takes the citation; a sentence that does not is the author's own reading, and reads as such. Never the atlas's reading: an atlas does not have one.</li>
          <li><strong>Numbers, not intensifiers.</strong> &ldquo;About 10&nbsp;cm⁻¹ apart&rdquo;, not &ldquo;very close&rdquo;. Where the number is not known, say that.</li>
          <li><strong>Hedge only where the literature does.</strong> <code>tentative</code> is a field; it does not need saying twice in prose.</li>
          <li><strong>No salesmanship.</strong> Nothing here is powerful, elegant or exciting. The chemistry is interesting enough without being told it is.</li>
        </ul>

        <h4>Where it loosens, and how far</h4>
        <p>
          This is a website and not a manuscript, so the register is allowed
          to breathe. Two places in particular:
        </p>
        <ul class="plain-list">
          <li><strong>Drawings and diagrams.</strong> A label on a plate has a few characters to work in, so it may be plain and informal where a paper's caption would not be: <span class="mono-demo">two modes</span>, <span class="mono-demo">one band</span>, <span class="mono-demo">bands seen</span>. What it may never be is loose about the science. A shorthand that would mislead is not shorthand, it is an error.</li>
          <li><strong>Headings.</strong> A card title or a section heading may carry a pun or a turn of phrase, and several already do: <em>Where the Radiation Goes</em>, <em>More Bands than Modes</em>, <em>Two Modes, One Frequency</em>. The heading sets up the idea; the paragraph under it does the work and stays straight.</li>
        </ul>
        <p>
          The test either way: <strong>could the sentence be quoted back at
          you by someone who works on this?</strong> A heading that raises a
          smile passes. A sentence that overstates what a spectrum shows does
          not, however well it reads.
        </p>
        <p class="see-also">
          See also <a href="#limits">Length limits</a>
          for how much of it there may be, and
          <a href="#notation">Notation</a>
          for what the characters may be.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">The same fact, three registers</div>
      <table class="spec-table">
        <tbody>
          <tr><th>paper</th><td colspan="2">The doubly degenerate bending mode of CO₂ absorbs near 667&nbsp;cm⁻¹; both components contribute to the single observed band.</td></tr>
          <tr><th>this atlas</th><td colspan="2">Absorption at that wavenumber goes into both modes, so the band carries the intensity of the pair and not of one of them.</td></tr>
          <tr><th>on a plate</th><td colspan="2"><span class="mono-demo">two modes</span> &nbsp;<span class="mono-demo">one band</span></td></tr>
          <tr><th>never</th><td colspan="2">CO₂'s bend is a beautiful example of how symmetry works its magic on a spectrum.</td></tr>
        </tbody>
      </table>
      <div class="surface-note">
        The first three say the same thing at three lengths. The fourth says
        less than any of them and takes longer doing it.
      </div>

      <div class="visual-label" style="margin-top:18px">Headings already in the page</div>
      <table class="spec-table">
        <tbody>
          <tr><th>Where the Radiation Goes</th><td>Reflected, absorbed, transmitted.</td></tr>
          <tr><th>More Bands than Modes</th><td>Overtones, combinations, Fermi pairs.</td></tr>
          <tr><th>Two Modes, One Frequency</th><td>Degeneracy.</td></tr>
          <tr><th>One Band, Two Contributions</th><td>The spectrum half of the same plate.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

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
            <tr><th>description</th><td class="spec-val">≤ 120 words</td><td>Everything true of the band in general, and nothing else. No minimum.</td></tr>
            <tr><th>references[].wn</th><td class="spec-val">number or list</td><td>The wavenumber that paper reported. Never in prose.</td></tr>
            <tr><th>species</th><td class="spec-val">a species key</td><td>Chemical identity only, from data/species.jsonc. Phase, binding geometry and isotopologue each have their own field.</td></tr>
            <tr><th>phase</th><td class="spec-val">gas / adsorbed / surface</td><td>Omit when the band covers both the free molecule and its adsorbed form. Derives no tag: the phase chips come from the claims' own state.</td></tr>
            <tr><th>topology</th><td class="spec-val">a topology id</td><td>Binding geometry, from the species' molecule in data/vibrations.jsonc.</td></tr>
            <tr><th>references[].measured_on</th><td class="spec-val">a surface key or list</td><td>Where this source measured it, from data/surfaces.jsonc, at whatever scale the paper stated: a site ("cu_1p"), a phase ("tio2"), a sample ("cu_zno"), or several at once. No conditions.</td></tr>
            <tr><th>references[].technique</th><td class="spec-val">an enum value</td><td>How the spectrum was taken. Derives the technique tag chip, so never write drifts/ftir by hand.</td></tr>
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
  <!-- ══════════════════════════════ 4 · PAGES ══════════════════════════════ -->
  <h2 class="part" id="pages" data-sg-section="pages">4 &middot; Pages</h2>
  <p class="part-sub">
    Two pages are built out of their own specification modules rather than out
    of markup, the way this one is built out of <code>tokens.ts</code>. Their
    layouts have rules of their own, and so does the one thing they both draw:
    a molecule.
  </p>

  <!-- ── Spread: the Knowledge page ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="knowledgepage" data-sg-section="knowledgepage">
        <h3>Knowledge page</h3>
        <p>
          Rows of cards, every card the size of a home page card
          (<code>CARD_LAYOUT</code>: {CARD_LAYOUT.width}px wide, at least
          {CARD_LAYOUT.height}px tall), each with a diagram that plays on hover.
          A click grows one to the full row, morphs its diagram into a larger
          drawing and opens the text. The page states at the top which three
          works most of it rests on, so provenance is read once rather than
          reconstructed from superscripts.
        </p>

        <h4>A closed card</h4>
        <p>
          Always the same three parts, in this order, and always the same size
          so a row of them lines up: the diagram bled to the card's edges, then
          the title, the teaser, and an arrow at the foot. The teaser is two to
          five lines; a card whose teaser runs longer grows rather than
          clipping, and the row equalises to the tallest.
        </p>
        <table class="spec-table">
          <tbody>
            <tr><th>diagram</th><td class="spec-val">.card-visual</td><td>The small layout of the card's own diagram, 220 &times; 100, bled to the edges. It plays on hover; one that cannot move says so instead of promising motion.</td></tr>
            <tr><th>title</th><td class="spec-val">.card-title</td><td>The card's name, plus the <span class="wip-demo">wip</span> chip where the card is unfinished.</td></tr>
            <tr><th>teaser</th><td class="spec-val">.card-desc</td><td>Two to five lines. One claim, not a summary of the card.</td></tr>
            <tr><th>arrow</th><td class="spec-val">.card-cta</td><td>Bottom right, coloured with the section accent. The only thing that says the card opens.</td></tr>
          </tbody>
        </table>

        <h4>What an opened card must have</h4>
        <p>
          Two things, and only their place is fixed: <strong>related</strong>
          and <strong>references</strong>, in that order, at the bottom. A card
          that leads somewhere says so, and a card that cites something shows
          what. Everything above them is whatever that card needs.
        </p>
        <table class="spec-table">
          <tbody>
            <tr><th>related</th><td class="spec-val">.kn-related</td><td><strong>Required.</strong> Where the card leads, as blocks linking to other cards. Second from last.</td></tr>
            <tr><th>references</th><td class="spec-val">.card-refs</td><td><strong>Required.</strong> What the superscripts point at, behind a divider. Always last.</td></tr>
            <tr><th>anything else</th><td class="spec-val">.kn-sec</td><td>Optional, in whatever order the card reads best. A flow of prose and floats, a full-width list, a three-column comparison, a table: the shape follows the argument.</td></tr>
          </tbody>
        </table>
        <p>
          The usual opening is a two-column flow, the diagram floated left with
          the prose running past it, because most cards are one idea explained
          once. It is a habit, not a rule. Where a card wants three columns, or
          a list of everything in the atlas that shows the pattern, or a table
          before any prose at all, it takes that instead.
        </p>

        <h4>The flow, where a card uses one</h4>
        <p>
          The diagram and every callout <code>float: left; clear: left</code>
          into a column of their own and the prose runs past them, taking the
          full width the moment the floats run out. Floats rather than grid for
          two reasons a grid would cost:
        </p>
        <ul class="plain-list">
          <li><strong>No holes.</strong> A short callout beside a long paragraph closes up by itself; a grid row would hold the gap open.</li>
          <li><strong>It collapses correctly.</strong> Under 860px the floats are off and every box is back inline exactly where it was authored, which is the order a phone wants. Nothing is measured, so nothing has to be recomputed.</li>
        </ul>
        <p>
          Placement is a guideline, not a law. A float should sit
          <strong>near the text that calls it</strong>, and running a little
          ahead of its paragraph is fine, the way a figure in a paper often
          arrives before the sentence that points at it. What to avoid is a
          float stranded pages from what it illustrates.
        </p>
        <p>
          A callout goes wherever the card wants it. In the flow it takes a
          column beside the prose; <code>wide</code> spans the full width,
          which is what a callout that is really a table or whose lines are
          too long for half a card should do; and nothing stops one standing
          on its own in a section of its own, or several sharing a section
          with the prose that needs them. The shape follows the argument, the
          same as every other section.
        </p>
        <p>
          Whatever you add, keep the collapse property: it is what makes the
          card readable on a phone without anything being measured.
        </p>

        <h4>What a card's diagram looks like</h4>
        <p>
          A technical drawing rather than an illustration: thin clean lines,
          the construction geometry left visible, one small face for every
          label, and nothing shaded. The specimen beside this is a live one,
          drawn to the rules and animating the way a card's diagram does.
          The rules themselves, the ink ladder and the four label fills, are
          in <a href="#drawing">Drawing molecules &amp; atoms</a>.
        </p>

        <h4>A diagram has two layouts, not one scaled up</h4>
        <p>
          A finished card's diagram is its own component with a small viewBox
          for the card (220 &times; 100) and a much larger one for the opened
          state (about 480 &times; 300), lerped by <code>t</code>. That is what
          keeps the ratio of text to drawing right: scaling one 220-wide
          drawing to double size gives huge labels and a sparse figure, which
          is how the unfinished cards still look.
        </p>
        <p>
          Cards whose prose or drawing is not done carry a <span class="wip-demo">wip</span>
          chip. It is a note about the card, not a caveat about the chemistry,
          so it stays quiet and grey; the red pills are reserved for caveats.
          Do not take a card that carries it as a model for a new one.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">A card's diagram, live</div>
      <DrawingExample />
      <div class="surface-note">
        A specimen: a diagram about nothing, drawn and animated exactly the
        way a card's is. Every rung of the ink ladder appears on it once.
      </div>

      <div class="visual-label" style="margin-top:18px">A closed card</div>
      <div class="kn-closed">
        <div class="kn-closed-fig">diagram</div>
        <div class="kn-closed-body">
          <div class="kn-closed-title">Title<span class="wip-demo">wip</span></div>
          <div class="kn-demo-lines">
            <span></span><span></span><span class="short"></span>
          </div>
          <div class="kn-closed-cta">&rarr;</div>
        </div>
      </div>

      <div class="visual-label" style="margin-top:18px">An opened card, top to bottom</div>
      <div class="kn-demo">
        <div class="kn-demo-flow">
          <div class="kn-demo-fig">diagram</div>
          <div class="kn-demo-lines beside">
            <span></span><span></span><span></span><span class="short"></span>
          </div>
          <div class="kn-demo-call">callout</div>
          <div class="kn-demo-lines beside">
            <span></span><span class="short"></span>
          </div>
          <div class="kn-demo-lines past">
            <span></span><span></span><span class="short"></span>
          </div>
        </div>
        <div class="kn-demo-sec">anything the card needs</div>
        <div class="kn-demo-sec req">related</div>
        <div class="kn-demo-sec req refs">references</div>
      </div>
      <div class="surface-note">
        The two marked sections are the required ones, and only their place is
        fixed. Above them the prose takes the full width the moment the last
        float ends, which is the behaviour to preserve: it is why nothing here
        has to be measured.
      </div>
    </div>
  </div>

  <!-- ── Spread: the Dataset page ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="datasetpage" data-sg-section="datasetpage">
        <h3>Dataset page</h3>
        <p>
          What the atlas holds <em>and</em> how it is put together, in two
          views chosen from the sidebar. It renders itself out of
          <code>lib/dataModel.ts</code> plus an <code>analyse()</code> pass over
          the shipped JSON, so every count, every distinct site and every
          unmatched species on it is the current state rather than a snapshot
          somebody has to remember to update.
        </p>
        <table class="spec-table">
          <tbody>
            <tr><th>Structure</th><td class="spec-val">the model</td><td>Entity map, the entities and their fields, relations, band-to-band links, and what nothing checks yet.</td></tr>
            <tr><th>Contents</th><td class="spec-val">the data</td><td>Vibration modes, species, surfaces, techniques, tags and references, each read off the live JSON.</td></tr>
          </tbody>
        </table>

        <h4>Status is the spine</h4>
        <p>
          Every entity carries how real it is, and the map is coloured by it.
          The point of the scale is to make the weak links visible rather than
          to flatter the schema: two bare strings are still left in the model.
        </p>
        <table class="spec-table">
          <tbody>
            <tr><th>record</th><td class="spec-val">own file</td><td>Own object with its own key. The build fails on an unresolved key.</td></tr>
            <tr><th>lookup</th><td class="spec-val">nested</td><td>Own object with a key, in another file's header block.</td></tr>
            <tr><th>inline</th><td class="spec-val">owned</td><td>A structured object, but owned by its parent.</td></tr>
            <tr><th>enum</th><td class="spec-val">vocabulary</td><td>A closed list in <code>schema.py</code>. Validated, but carries no attributes.</td></tr>
            <tr><th>string</th><td class="spec-val">unchecked</td><td>A repeated bare string. Nothing validates it and nothing can hang off it.</td></tr>
            <tr><th>derived</th><td class="spec-val">computed</td><td>Never authored, so it cannot drift.</td></tr>
          </tbody>
        </table>
        <p>
          A relation is <code>weak</code> when nothing enforces it and
          <code>derived</code> when nobody authors it. Band/Region and
          Species/Group are derived; do not add an authored copy of either.
        </p>
        <p>
          The obligation that keeps the page honest: <strong>change a field in
          <code>schema.py</code> or <code>types.ts</code> and change it in
          <code>dataModel.ts</code> in the same commit</strong>, the same rule
          the JSONC preambles carry. A stale entity spec is worse than none.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Where each page gets its truth</div>
      <div class="surface-card">
        <div class="surface-head">This page &rarr; tokens.ts</div>
        <div class="surface-body">Every swatch, size, radius and limit. Change a value there and the guide, the chart and the tooltip move together.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">Dataset page &rarr; dataModel.ts</div>
        <div class="surface-body">Entities, relations, tag roles and techniques, plus live counts from the shipped JSON.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">Source guide &rarr; sourceGuide.ts</div>
        <div class="surface-body">How a paper becomes an entry: one claim per paper, which field takes what, and the second-pass list.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">Knowledge page &rarr; fundamentals.ts + phenomena.ts</div>
        <div class="surface-body">The prose, its citations, and the resolvers that find the bands each card is about.</div>
      </div>
      <div class="surface-note">
        None of the four is documentation beside the thing. Each one <em>is</em>
        the thing, rendered.
      </div>
    </div>
  </div>

  <!-- ── Spread: drawing molecules ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="drawing" data-sg-section="drawing">
        <h3>Drawing molecules &amp; atoms</h3>
        <p>
          Molecules are drawn in three places, the Knowledge diagrams, the
          Vibration Modes viewer and the mode panel, and they all read from one
          source: <code>lib/moleculeGeometry.ts</code> for the atoms and their
          displacement vectors, <code>lib/elementColors.ts</code> for the
          colours and sizes. Nothing redraws a molecule by hand.
        </p>

        <h4>Colour and size</h4>
        <p>
          CPK colours, and radii that are the real single-bond covalent radii
          in picometres rather than arbitrary circles, so a hydrogen is
          genuinely small beside an oxygen. <code>M</code> is the generic metal
          centre, for a diagram whose mode is deliberately metal-agnostic.
          These are distinct from the band chart's <code>ATOMS_PALETTE</code>,
          which colours whole bond environments and is a different concern.
        </p>

        <h4>Displacement</h4>
        <p>
          A mode is a list of vectors, one per atom, and every atom that moves
          in it has one. The two conventions worth knowing before drawing a new
          mode:
        </p>
        <ul class="plain-list">
          <li><strong>Every atom moves, and the central one usually moves least.</strong> CO₂'s bend is the oxygens swinging together with the carbon recoiling the other way at 0.6 of their amplitude, which is what keeps the centre of mass still.</li>
          <li><strong>Out of the page is a size pulse.</strong> A flat drawing cannot show a displacement towards the reader, so those vectors carry a <code>scale</code> instead and the atoms grow and shrink. CO₂'s second bend component is the worked case.</li>
        </ul>

        <h4>A still molecule still says what it does</h4>
        <p>
          A molecule that is not moving carries faint grey arrows along its own
          displacement vectors, and loses them as soon as it starts moving, so
          nothing is labelled twice. The Normal Modes and Vibration Modes cards
          both do this. A mode with no in-plane displacement to draw keeps no
          arrows and lets its caption say the motion leaves the page.
        </p>

        <h4>The drawing style: a technical drawing, not an illustration</h4>
        <p>
          The reference is an old architectural plate on parchment: thin clean
          lines, construction geometry left visible, and everything labelled
          in one small face. Nothing is filled in for decoration, nothing is
          shaded, and no line is thick enough to be the first thing seen.
        </p>
        <p>
          <strong>Hierarchy is carried by saturation, and only secondarily by
          weight.</strong> All the strokes live in one narrow band, about
          0.6&ndash;2px, so the plate reads as one drawing; what separates a
          guideline from a bond is how strongly it is inked, not how fat it
          is. The ladder runs from construction geometry, which should be
          almost invisible until looked for, up to the one thing the card is
          about, which is the only saturated colour on the plate. Two lines
          at the same saturation claim to be the same kind of thing, so
          before adding a stroke, decide which rung it is on.
        </p>
        <p>
          Weight then separates within a rung, and the steps are small: a bond
          is 2px against an axis's 1px because a bond is the content and the
          axis is the frame, not because 2px is twice as important. Reach for
          a lighter colour before a thinner line, and never for a thicker one.
        </p>

        <h4>Labels: one face, one size, four inks</h4>
        <p>
          Every label in every diagram is set in the code face
          (<code>--t-code-ff</code>) at <code>--t-code-size</code>, never
          below <code>--t-diagram-note-size</code>, and the four fills are the
          top four rungs of the same ladder: faint for a construction note,
          plain for the usual annotation, strong for a value being read off,
          and strong plus <code>--t-label-weight</code> where the label names
          the subject. One family, one size, four inks: a diagram that needs a
          bigger label needs fewer labels.
        </p>

        <h4>Perspective and construction geometry</h4>
        <p>
          Where a diagram needs depth it goes through
          <code>components/knowledge/view3d.ts</code>: turn a point, then
          project it in perspective, with <code>Axes3D</code> for the x, y and
          z axes and one of them lit. Around it, the plate's furniture is the
          same everywhere: a dashed outline for a plane, a dashed line for an
          axis a motion runs along, a capped dimension line for an extent, and
          a hairline rule under a small table of counts.
        </p>

        <h4>The cards to copy</h4>
        <p>
          These are drawn and revised, and a new diagram should look as though
          it came from the same hand. Match them rather than inventing a
          treatment, and do not take a
          <span class="wip-demo">wip</span> card as a model.
        </p>
        <ul class="plain-list">
          <li><strong>Molecular Motion, all of it:</strong> Normal Modes (the expanded state especially), Vibration Modes, Rotation Modes, Translation Modes, Frustrated Motion.</li>
          <li><strong>Light&ndash;Matter Interaction, except the Lambert&ndash;Beer Law:</strong> Where the Radiation Goes, Vibrational Excitation, Dipole Moment, Induced Dipole, Polarizability.</li>
          <li><strong>Spectroscopy, through Selection Rules:</strong> IR Spectroscopy, Raman Spectroscopy, Spectral Units, Spectral Representations, Selection Rules.</li>
        </ul>
        <p>
          One more convention they all keep: <strong>a spectrum is drawn as an
          absorption.</strong> The baseline sits near the top of its box and
          the band hangs down from it, so a trace never has to be read twice.
        </p>
        <p class="see-also">
          See also <a href="#notation">Notation</a>
          for what may be written in a label: real Unicode characters, never
          markup, with point-group and Mulliken symbols the one exception.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Elements, at their real relative sizes</div>
      <div class="atom-row">
        {#each drawnElements as a}
          <div class="atom-cell">
            <span
              class="atom-sw"
              style="width:{a.pm / 3}px; height:{a.pm / 3}px; background:{a.color}"
            ></span>
            <span class="atom-el">{a.el}</span>
            <span class="atom-pm">{a.pm} pm</span>
          </div>
        {/each}
      </div>
      <div class="surface-note">
        <code>M</code> is drawn large because a metal centre is, and because a
        mode pivoting on it has to read as pivoting on something solid.
      </div>

      <div class="visual-label" style="margin-top:18px">A worked plate, live</div>
      <DrawingExample />
      <div class="surface-note">
        A diagram about nothing, drawn the way the cards are: every rung of
        the ladder once, every stroke between 0.6 and 2px, and the only
        saturated thing on it is the band. What separates the plane from the
        bond is ink, not width.
      </div>

      <div class="visual-label" style="margin-top:18px">Saturation, faintest first</div>
      <table class="spec-table">
        <tbody>
          <tr><th>construction</th><td class="spec-val">--ink-025</td><td>1px dashed. A plane, a guideline, an axis a motion is measured along. Should be findable, not noticeable.</td></tr>
          <tr><th>rule</th><td class="spec-val">--line-faint</td><td>1px. The hairline under a small table of counts inside a diagram.</td></tr>
          <tr><th>dimension</th><td class="spec-val">--ink-050</td><td>1px with end caps, and the same ink as a faint label, because a dimension line is an annotation.</td></tr>
          <tr><th>structure</th><td class="spec-val">--line-slate-strong</td><td>1px. A drawn axis, a baseline, a box the subject sits in.</td></tr>
          <tr><th>content</th><td class="spec-val">--ink-slate-400</td><td>2px for a bond, 0.6px for an atom outline. The thing being drawn, before anything is said about it.</td></tr>
          <tr><th>subject</th><td class="spec-val">--brand-700</td><td>1.3&ndash;2px. The one thing the card is about: a trace, a photon (<code>--diagram-photon</code>), a mode being excited (<code>--accent-green-fg</code>). At most one per plate.</td></tr>
        </tbody>
      </table>

      <div class="visual-label" style="margin-top:18px">Label inks</div>
      <table class="spec-table">
        <tbody>
          <tr><th>faint</th><td class="spec-val">--ink-050</td><td>A construction note, next to the line it explains.</td></tr>
          <tr><th>plain</th><td class="spec-val">--ink-slate-500</td><td>The default, and most labels.</td></tr>
          <tr><th>strong</th><td class="spec-val">--ink-slate-900</td><td>A number or a value being read off the drawing.</td></tr>
          <tr><th>name</th><td class="spec-val">--ink-slate-900 + --t-label-weight</td><td>The label that names the subject. One or two per plate.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ── Spread: the other guides ── -->
  <div class="spread">
    <div class="explain">
      <section class="section" id="guides" data-sg-section="guides">
        <h3>The other guides</h3>
        <p>
          This guide covers what the interface looks like. Two others cover the
          rest, and all three are modules the pages render themselves out of,
          so none of them can go stale quietly.
        </p>
        <table class="spec-table">
          <tbody>
            <tr>
              <th>Source guide</th>
              <td class="spec-val">sourceGuide.ts</td>
              <td>
                How to get from a PDF to a correct entry. Read it before
                extracting a paper and before going over one again: one row per
                (band, paper) claim and never an average, which field each fact
                belongs in, how to choose the surface level from the sentence
                that makes the assignment, what a note carries and in what
                order, and the fork between an isotopologue band and the
                <code>isotope-labeling</code> tag.
              </td>
            </tr>
            <tr>
              <th>Data model</th>
              <td class="spec-val">dataModel.ts</td>
              <td>
                Every entity, how they link and with what cardinality, which
                links are enforced and which only hold because two strings
                match. Rendered by the Dataset page.
              </td>
            </tr>
            <tr>
              <th>Notation</th>
              <td class="spec-val">this guide</td>
              <td>
                Real Unicode in the data, never markup; the point-group and
                Mulliken exception; underscores; and how a mode is named. See
                <a href="#notation">Notation</a>
                above.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          One rule ties them together: <strong>change a rule in the same commit
          as the code or schema change that caused it</strong>. A guide that
          describes last month's schema is worse than no guide, because it is
          believed.
        </p>
      </section>
    </div>

    <div class="visual sticky">
      <div class="visual-label">Where a rule lives</div>
      <div class="surface-card">
        <div class="surface-head">A colour, a size, a limit</div>
        <div class="surface-body"><code>lib/tokens.ts</code>, with a <code>usage</code> note. That note is the text beside the swatch here.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">A field, a link, a vocabulary</div>
        <div class="surface-body"><code>schema.py</code> and <code>types.ts</code>, then <code>lib/dataModel.ts</code> in the same change.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">How to read a paper</div>
        <div class="surface-body"><code>lib/sourceGuide.ts</code>, in the same commit as whatever made the rule necessary.</div>
      </div>
      <div class="surface-card">
        <div class="surface-head">What a key means in the data</div>
        <div class="surface-body">The commented preamble of the JSONC file itself. A stale preamble is actively misleading.</div>
      </div>
    </div>
  </div>
</main>

<style>
  /* ── Part 4 and the two new band-chart sections ── */

  /* An unfilled band: the selection rule says the mode is silent here. */
  .hollow-demo { background: none !important; border: 1.5px solid; }

  /* The chip an unfinished Knowledge card carries, shown inline in prose. */
  .wip-demo {
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-200);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-sm);
    padding: 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .plain-list { margin: 0 0 var(--space-3); padding-left: 18px; }
  .plain-list li { margin-bottom: 6px; }
  .see-also { color: var(--ink-500); }

  /* An opened Knowledge card, in miniature: the float column on the left and
     the prose running past it, then the three sections under it. */
  .kn-demo {
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
    padding: 10px;
    background: var(--surface);
  }
  .kn-demo-flow::after { content: ''; display: block; clear: both; }
  .kn-demo-fig,
  .kn-demo-call {
    float: left;
    clear: left;
    width: 96px;
    margin: 0 10px 8px 0;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-200);
    text-align: center;
  }
  .kn-demo-fig { height: 58px; line-height: 58px; }
  .kn-demo-call { height: 34px; line-height: 34px; }
  .kn-demo-lines span {
    display: block;
    height: 5px;
    margin-bottom: 5px;
    border-radius: 2px;
    background: var(--line-soft);
  }
  .kn-demo-lines span.short { width: 62%; }
  /* Beside a float the lines are indented past it; once the floats have run
     out they take the full width, which is the behaviour being illustrated. */
  .kn-demo-lines.beside { margin-left: 106px; }
  .kn-demo-lines.past { clear: left; padding-top: 6px; }
  .kn-demo-sec {
    clear: both;
    margin-top: 8px;
    padding: 5px 7px;
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-200);
  }
  .kn-demo-sec.refs { border-top: 1px solid var(--line-soft); }

  /* A diagram label quoted in running text: the code face at the size the
     plates use, so the example looks like the thing it is quoting. */
  .mono-demo {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-slate-500);
  }



  /* The closed card: diagram bled to the edges, then title, teaser, arrow. */
  .kn-closed {
    width: 160px;
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
    background: var(--surface);
    overflow: hidden;
  }
  .kn-closed-fig {
    height: 52px;
    line-height: 52px;
    text-align: center;
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--line-soft);
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-200);
  }
  .kn-closed-body { padding: 8px 9px 6px; }
  .kn-closed-title {
    font-size: var(--t-card-title-size);
    font-weight: var(--t-card-title-weight);
    color: var(--t-card-title-color);
    margin-bottom: 6px;
  }
  .kn-closed-cta { text-align: right; color: var(--accent-green-fg); margin-top: 6px; }
  /* The two sections a card cannot leave out. */
  .kn-demo-sec.req { color: var(--ink-500); border-left: 2px solid var(--brand-700); }

  /* Elements at their real relative radii. */
  .atom-row { display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap; }
  .atom-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .atom-sw { border-radius: 50%; border: 1px solid var(--ink-slate-400); display: block; }
  .atom-el { font-family: var(--t-code-ff); font-size: var(--t-code-size); color: var(--ink-800); }
  .atom-pm { font-family: var(--t-code-ff); font-size: var(--t-diagram-note-size); color: var(--ink-200); }

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

  @container content (max-width: 1080px) {
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

  .shell-wire { margin-top: var(--space-2); }
  .shell-wire:first-of-type { margin-top: 0; }
  .wire-burger {
    display: inline-block;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 3px;
    padding: 0 4px;
    margin-right: 6px;
  }

  .scale-label { margin-top: var(--space-4); }

  .scale-ladder { display: flex; flex-direction: column; gap: 4px; }
  .ladder-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; }
  .ladder-n {
    flex: 0 0 38px;
    text-align: right;
    font-family: var(--font-mono);
    color: var(--ink-500);
    font-variant-numeric: tabular-nums;
  }
  .ladder-bar {
    flex: 0 0 auto;
    height: 10px;
    border-radius: 2px;
    background: var(--brand-tint-line);
  }
  .is-default .ladder-bar { background: var(--brand-500); }
  .ladder-note { color: var(--ink-300); }
  .is-default .ladder-note { color: var(--ink-500); }

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

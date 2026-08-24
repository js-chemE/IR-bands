/**
 * Design tokens: the single source of truth for every colour, typeface, size,
 * radius, shadow and layout constant used anywhere in the atlas.
 *
 * Rules of the road:
 *   1. No component hard-codes a colour, font size or font weight. Import a
 *      token from here, or use the CSS custom property it emits.
 *   2. Change a value here and it changes everywhere at once: the CSS
 *      variables below are injected into `:root` at start-up (see
 *      `installTokens()`, called from main.ts), and the Style guide page
 *      renders itself straight out of these same objects, so it cannot drift.
 *   3. Adding a token means adding it here with a `usage` note. That note is
 *      what the Style guide shows, so write it for a reader.
 *
 * CSS variable naming:
 *   colours     --<token-name>        e.g. var(--ref-accent)
 *   typography  --t-<role>-<prop>     e.g. var(--t-tip-name-size)
 *               props: size | weight | color | ff | lh | ls | tt | fs
 *   layout      --radius-* --shadow-* --space-* --grad-*
 */

/* ---------------------------------------------------------------------------
   Colours
   --------------------------------------------------------------------------- */

export interface ColorToken {
  value: string;
  usage: string;
}

export interface ColorGroup {
  key: string;
  title: string;
  note: string;
  tokens: Record<string, ColorToken>;
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    key: 'brand',
    title: 'Brand blue',
    note: 'Header, page titles, links, and the "you are here" state. Never used to encode data.',
    tokens: {
      'brand-900':       { value: '#1a3055', usage: 'Page titles, deepest navy' },
      'brand-700':       { value: '#2c4a6e', usage: 'Header gradient start, body links' },
      'brand-500':       { value: '#3d6a9a', usage: 'Header gradient end' },
      'brand-accent':    { value: '#1a3a8f', usage: 'Text of an active nav item' },
      'brand-tint':      { value: '#e8f0fe', usage: 'Background of an active nav item' },
      'brand-tint-soft': { value: '#eef3ff', usage: 'Background of an active menu row' },
      'brand-tint-line': { value: '#a0b4e0', usage: 'Border of an active nav item' },
      'brand-on-dark':   { value: '#ffffff', usage: 'Text on the brand gradient' },
    },
  },
  {
    key: 'ref',
    title: 'Reference parchment',
    note: 'Reserved for citation surfaces: reference cards, download cards, the per-reference boxes inside the band tooltip. Warm paper plus gold, so a citation is recognisable at a glance anywhere in the atlas.',
    tokens: {
      'ref-surface':       { value: '#f8f6f1', usage: 'Reference / download card background' },
      'ref-surface-hover': { value: '#f0ece4', usage: 'Same card, hovered' },
      'ref-border':        { value: '#e2d9c9', usage: 'Card border' },
      'ref-accent':        { value: '#c4a86e', usage: 'Gold left edge, 3px' },
      'ref-accent-strong': { value: '#a08050', usage: 'Hovered left edge, chevrons, jump button' },
      'ref-accent-deep':   { value: '#8a6d00', usage: 'Gold text on a light background (links)' },
      'ref-scroll-thumb':  { value: '#d0c9bc', usage: 'Scrollbar thumb inside a reference list' },
      'ref-code-bg':       { value: '#ede8de', usage: 'Inline file-name chip background' },
      'ref-code-fg':       { value: '#7a6040', usage: 'Inline file-name chip text' },
      'ref-highlight':     { value: '#f5edd8', usage: 'Flash highlight when jumping to a reference' },
      'ref-focus-ring':    { value: '#c4a86e88', usage: 'Focus ring on that same flash (gold at 53% alpha)' },
      'ref-meta':          { value: '#8a7a4a', usage: 'Citation meta line (journal, volume, year)' },
      'ref-link-hover':    { value: '#5a3e1b', usage: 'External citation link, hovered' },
    },
  },
  {
    key: 'ink',
    title: 'Ink',
    note: 'Text greys, darkest to lightest. Pick by role, not by taste: primary text ink-700, secondary ink-500, meta ink-300, hints ink-050.',
    tokens: {
      'ink-900': { value: '#111111', usage: 'Tooltip title' },
      'ink-800': { value: '#222222', usage: 'Card and citation titles' },
      'ink-700': { value: '#333333', usage: 'Primary body text' },
      'ink-600': { value: '#444444', usage: 'Controls, menu items' },
      'ink-500': { value: '#555555', usage: 'Secondary text, descriptions' },
      'ink-400': { value: '#666666', usage: 'Tertiary text, status messages' },
      'ink-300': { value: '#777777', usage: 'Meta lines (the vibration subtitle)' },
      'ink-200': { value: '#888888', usage: 'Icons, inactive glyphs' },
      'ink-100': { value: '#999999', usage: 'Eyebrow labels inside dense UI' },
      'ink-050': { value: '#aaaaaa', usage: 'Hints, keyboard help' },
      'ink-025': { value: '#bbbbbb', usage: 'Overflow counters, faintest legible text' },
      // Blue-tinted ink, used on the prose pages so headings sit in the same
      // family as the brand blue instead of reading as flat grey.
      'ink-slate-900': { value: '#1a2a3a', usage: 'Card titles on prose pages' },
      'ink-slate-700': { value: '#445566', usage: 'Lead paragraph on the home page' },
      'ink-slate-600': { value: '#556677', usage: 'Home page footnote text' },
      'ink-slate-500': { value: '#6b7a8f', usage: 'Section headings on prose pages' },
      'ink-slate-400': { value: '#8a93a3', usage: 'Micro labels above a card row' },
      'ink-slate-300': { value: '#7a8a9f', usage: 'Home page eyebrow' },
    },
  },
  {
    key: 'surface',
    title: 'Surfaces and lines',
    note: 'Neutral chrome: three surfaces, five line weights, nothing else.',
    tokens: {
      'surface':        { value: '#ffffff', usage: 'Cards, tooltip, chart background' },
      'surface-sunken': { value: '#fafafa', usage: 'Sidebar' },
      'surface-hover':  { value: '#f0f0f0', usage: 'Hovered button or row' },
      'line-strong':    { value: '#d0d0d0', usage: 'Control borders (buttons, selects)' },
      'line':           { value: '#dddddd', usage: 'Tooltip border' },
      'line-soft':      { value: '#e5e5e5', usage: 'Dividers, sidebar edge' },
      'line-faint':     { value: '#eeeeee', usage: 'Inner rules inside a card' },
      'line-panel':     { value: '#e5e7eb', usage: 'Legend box, qualifier pill border' },
      'line-heading':   { value: '#e8edf3', usage: 'Hairline under a section heading' },
      'surface-slate':      { value: '#f3f6fa', usage: 'Home page canvas' },
      'surface-slate-soft': { value: '#f5f7fb', usage: 'Selected row in the mode list' },
      'line-slate':         { value: '#dce5f0', usage: 'Home page card border' },
      'line-slate-strong':  { value: '#b0c4da', usage: 'Home page card border, hovered' },
    },
  },
  {
    key: 'status',
    title: 'Notice and status',
    note: 'The footer hint banner and error text. Amber says "read me", red says "something failed".',
    tokens: {
      'notice-bg':     { value: '#fff8e1', usage: 'Hint banner background' },
      'notice-border': { value: '#f0dda0', usage: 'Hint banner top edge' },
      'notice-fg':     { value: '#3a3a3a', usage: 'Hint banner text' },
      'notice-link':   { value: '#5c4a00', usage: 'Hint banner link, hovered' },
      'danger':        { value: '#cc0000', usage: 'Load and validation error text' },
      'warn-bg':       { value: '#fff3cd', usage: 'Warning callout background' },
      'warn-bg-hover': { value: '#fbefc4', usage: 'Warning callout button, hovered' },
      'warn-border':   { value: '#e6c86a', usage: 'Warning callout border' },
      'warn-fg':       { value: '#6b5200', usage: 'Warning callout text' },
      'alert-bg':      { value: '#fdecea', usage: 'Blocking notice background (too-narrow viewport)' },
      'alert-border':  { value: '#f3c0b8', usage: 'Blocking notice border' },
      'alert-fg':      { value: '#7a2118', usage: 'Blocking notice text' },
    },
  },
  {
    key: 'badge',
    title: 'Badges and pills',
    note: 'Three fixed pill styles. Blue is always a wavenumber, amber is always a surface site, grey is always a qualifier (intensity, width, confidence). Do not invent a fourth.',
    tokens: {
      'badge-wn-bg':       { value: '#dbeafe', usage: 'Wavenumber badge background' },
      'badge-wn-border':   { value: '#93c5fd', usage: 'Wavenumber badge border' },
      'badge-wn-fg':       { value: '#1d4ed8', usage: 'Wavenumber badge text' },
      'badge-site-bg':     { value: '#fef3c7', usage: 'Site badge background' },
      'badge-site-border': { value: '#fcd34d', usage: 'Site badge border' },
      'badge-site-fg':     { value: '#78350f', usage: 'Site badge text' },
      'pill-bg':           { value: '#f3f4f6', usage: 'Qualifier pill background' },
      'pill-border':       { value: '#e5e7eb', usage: 'Qualifier pill border' },
      'pill-fg':           { value: '#555555', usage: 'Qualifier pill text' },
      'pill-muted-bg':     { value: '#f9fafb', usage: 'Untyped tag pill background' },
      'pill-muted-border': { value: '#eaecef', usage: 'Untyped tag pill border' },
      'pill-muted-fg':     { value: '#8a8f98', usage: 'Untyped tag pill text' },
    },
  },
  {
    key: 'accent',
    title: 'Section accents',
    note: 'One tinted pair per destination card on the home page, plus the two accents the vibration pages own. A pair is background plus text; they are always used together.',
    tokens: {
      'accent-teal-bg':          { value: '#d8f2ec', usage: 'Vibration-modes card icon background' },
      'accent-teal-fg':          { value: '#27745e', usage: 'Vibration-modes card icon and call to action' },
      'accent-blue-bg':          { value: '#dbe9fd', usage: 'Band-chart card icon background' },
      'accent-blue-fg':          { value: '#2c4a6e', usage: 'Band-chart card icon and call to action' },
      'accent-amber-bg':         { value: '#fef3dd', usage: 'References card icon background' },
      'accent-amber-fg':         { value: '#996a20', usage: 'References card icon and call to action' },
      'accent-violet':           { value: '#6b5b95', usage: 'Vibration-mode group label' },
      'accent-blue-soft':        { value: '#5878b0', usage: 'Active topology button text' },
      'accent-blue-soft-line':   { value: '#c8d6f0', usage: 'Active topology button border' },
      'accent-blue-soft-bg':     { value: '#eaf1fc', usage: 'Isolated tag in the legend' },
      'accent-blue-soft-bg-alt': { value: '#deeafb', usage: 'Isolated tag in the legend, hovered' },
    },
  },
  {
    key: 'data',
    title: 'Data neutrals',
    note: 'Colours that encode data rather than chrome. The full colormaps follow below; these are the states that sit outside any scale.',
    tokens: {
      'data-grey':    { value: '#7f7f7f', usage: 'Unknown or mixed category (atoms "diverse")' },
      'data-cited':   { value: '#2c8a3e', usage: 'Band backed by at least one reference' },
      'data-uncited': { value: '#bfbfbf', usage: 'Band with no reference yet' },
    },
  },
];

/** Flat token-name to value map. Use in TypeScript; use `cvar()` in markup. */
export const C: Record<string, string> = Object.fromEntries(
  COLOR_GROUPS.flatMap(g => Object.entries(g.tokens).map(([k, t]) => [k, t.value])),
);

/** `cvar('ref-accent')` returns `'var(--ref-accent)'`. */
export function cvar(name: string): string {
  return `var(--${name})`;
}

/* ---------------------------------------------------------------------------
   Data colormaps

   These encode meaning, so they are ordered and named, never picked ad hoc.
   Group colours are the one exception: they live in data/bands.jsonc because
   they belong to the dataset, not to the design system.
   --------------------------------------------------------------------------- */

/** Vibration category and subtype. Hue = category, lightness = subtype. */
export const VIBRATION_PALETTE: Record<string, string> = {
  'stretch':            '#3B82C4',
  'stretch.symmetric':  '#1F5FA0',
  'stretch.asymmetric': '#7FB3DC',
  'bend':               '#E89B3C',
  'bend.symmetric':     '#C77B1F',
  'bend.asymmetric':    '#F4B468',
  'bend.scissoring':    '#D9523A',
  'bend.rocking':       '#B8853D',
  'bend.wagging':       '#C99A2E',
  'bend.twisting':      '#A86B4A',
  'combination':        '#8C7A95',
  'lattice':            '#9B6B3D',
};

/** Atom group. One hue family per element pair; deuterated twins run lighter. */
export const ATOMS_PALETTE: Record<string, string> = {
  'O-H':     '#3FA7A0',
  'H-O-H':   '#2A7873',
  'C-O-H':   '#7DC9C3',
  'C-H':     '#5BA84F',
  'H-C-H':   '#3D7C36',
  'O-C-H':   '#9CCB91',
  // Deuterated counterparts of the O-H / C-H entries above: same hue family
  // (so a nu(C-D) band still reads as "a C-H-family mode"), lifted lighter
  // and softer to mark it as the heavy twin. Which band is the isotopologue
  // is carried structurally by isotopologue_of plus the hatched fill, not by
  // colour alone; this just keeps the two from colliding in the legend.
  'O-D':     '#7AC4BF',
  'C-D':     '#93C088',
  'D-C-D':   '#6FA167',
  'C-O':     '#E07856',
  'C=O':     '#E2624A',
  'O-C-O':   '#C03B36',
  'O=C=O':   '#E84940',
  'M-H':     '#D9A036',
  'M-O':     '#5C5C5C',
  'M-C':     '#4A7AB5',
  // The whole metal-oxygen-carbon chain moving as one unit (frustrated
  // rotation/translation of a surface-bound -O-C, methoxy's M-O-C wobble):
  // a steel blue-grey that sits between M-O's neutral grey and M-C's blue,
  // keeping it visually part of the same M-* metal family.
  'M-O-C':   '#6B8299',
  'diverse': C['data-grey'],
};

/**
 * Per-tag pill styles. A tag with no entry here falls back to
 * DEFAULT_TAG_STYLE, so adding a tag to the data never breaks the render.
 * Add an entry only when the tag deserves to stand out.
 */
export const TAG_STYLES: Record<string, { background: string; border: string; color: string }> = {
  // Warm orange/red, an infrared/heat association. Distinguishable from
  // raman-active's cool violet, and from the neutral grey default reserved
  // for an eventual "inactive" tag (a muted/warning treatment, not this).
  'ir-active':       { background: '#FDE9DD', border: '#F0A876', color: '#9A4A12' },
  // Cool violet, evoking the laser excitation line used in Raman scattering.
  'raman-active':    { background: '#EEE3FB', border: '#C3A0EA', color: '#5B2E91' },
  // Teal, a third hue distinct from both of the above, for the
  // translation/rotation a free adsorbate would have but cannot anymore once
  // trapped in the adsorption well (CO's and methoxy's frustrated modes).
  'frustrated-mode': { background: '#DCF3F0', border: '#7EC8BE', color: '#1F6B5C' },
  // Slate blue-grey, a fourth hue and deliberately the most neutral of the
  // four: an isotopologue is the same mode as its parent, only heavier, so it
  // should not shout louder than the activity tags above. Pairs with the
  // diagonal hatch fill these bands get in the chart.
  'isotopic-shift':  { background: '#E8EDF2', border: '#A2B5C6', color: '#3D5A70' },
};

export const DEFAULT_TAG_STYLE = {
  background: C['pill-muted-bg'],
  border: C['pill-muted-border'],
  color: C['pill-muted-fg'],
};

/* ---------------------------------------------------------------------------
   Typography
   --------------------------------------------------------------------------- */

export const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "Courier New", monospace',
};

export interface TypeRole {
  /** CSS variable stem: role `tip-name` emits `--t-tip-name-size` and friends. */
  key: string;
  label: string;
  usage: string;
  size: string;
  weight: number;
  /** Colour token name from COLOR_GROUPS. */
  color: string;
  family?: 'sans' | 'mono';
  lh?: string;
  ls?: string;
  /** text-transform */
  tt?: string;
  /** font-style */
  fs?: string;
}

export interface TypeGroup {
  key: string;
  title: string;
  note: string;
  roles: TypeRole[];
}

export const TYPE_GROUPS: TypeGroup[] = [
  {
    key: 'page',
    title: 'Page level',
    note: 'Every long-form page (Impressum, References, this one) uses these roles and nothing else.',
    roles: [
      { key: 'page-title',   label: 'Page title',       usage: 'One per page, top of the content column',   size: '27px',   weight: 800, color: 'brand-900',   ls: '-0.01em', lh: '1.2' },
      { key: 'section-head', label: 'Section heading',  usage: 'Uppercase eyebrow with a hairline under it', size: '14px',  weight: 700, color: 'ink-slate-500', tt: 'uppercase', ls: '0.07em' },
      { key: 'body',         label: 'Body',             usage: 'Prose paragraphs, 760px column',            size: '14.5px', weight: 400, color: 'ink-700',     lh: '1.6' },
      { key: 'label',        label: 'Field label',      usage: 'Left column of a key/value grid',           size: '14px',   weight: 600, color: 'ink-500',     lh: '1.5' },
      { key: 'micro-label',  label: 'Micro label',      usage: 'Tiny uppercase label above a row of cards', size: '11px',   weight: 700, color: 'ink-slate-400', tt: 'uppercase', ls: '0.06em' },
      { key: 'code',         label: 'Code / file name', usage: 'File names, JSON keys, enum values',        size: '12px',   weight: 400, color: 'ref-code-fg', family: 'mono' },
    ],
  },
  {
    key: 'chrome',
    title: 'App chrome',
    note: 'Header and sidebar. Fixed sizes: these never scale with content.',
    roles: [
      { key: 'app-title',    label: 'App title',       usage: 'Header wordmark, italic',          size: '29px', weight: 800, color: 'brand-on-dark', ls: '-0.01em', fs: 'italic' },
      { key: 'app-subtitle', label: 'App subtitle',    usage: 'Header subject line, italic',      size: '15px', weight: 400, color: 'brand-on-dark', fs: 'italic' },
      { key: 'nav',          label: 'Nav item',        usage: 'Sidebar page buttons',             size: '13px', weight: 400, color: 'ink-600' },
      { key: 'sidebar-head', label: 'Sidebar heading', usage: 'Uppercase control-group heading',  size: '14px', weight: 600, color: 'ink-500', tt: 'uppercase', ls: '0.04em' },
      { key: 'hint',         label: 'Hint banner',     usage: 'Footer tips, always one line high', size: '14px', weight: 400, color: 'notice-fg' },
    ],
  },
  {
    key: 'tip',
    title: 'Band tooltip',
    note: 'The densest surface in the atlas: eleven roles inside a 300px box. Sizes step in half-pixels on purpose, do not round them.',
    roles: [
      { key: 'tip-name',      label: 'Band name',        usage: 'Species plus mode, line 1',                     size: '14px',   weight: 700, color: 'ink-900',    lh: '1.2' },
      { key: 'tip-vib',       label: 'Vibration meta',   usage: 'category (subtype) | atoms',                    size: '11.5px', weight: 400, color: 'ink-300' },
      { key: 'tip-wn',        label: 'Wavenumber range', usage: 'Monospace so digits line up between bands',     size: '12px',   weight: 400, color: 'ink-700',    family: 'mono' },
      { key: 'tip-group',     label: 'Group',            usage: 'Uppercase, tinted with the band colour',        size: '11px',   weight: 700, color: 'ink-500',    tt: 'uppercase', ls: '0.05em' },
      { key: 'tip-tag',       label: 'Qualifier pill',   usage: 'intensity / confidence / width, then tags',     size: '11px',   weight: 400, color: 'pill-fg' },
      { key: 'tip-desc',      label: 'Description',      usage: 'The band description field, 100 to 120 words',  size: '12px',   weight: 400, color: 'ink-500',    lh: '1.4' },
      { key: 'tip-refs-head', label: 'References label', usage: 'Uppercase divider above the citation boxes',    size: '10.5px', weight: 700, color: 'ink-100',    tt: 'uppercase', ls: '0.06em' },
      { key: 'tip-ref-title', label: 'Citation',         usage: 'Author and year, IEEE short form',              size: '12px',   weight: 600, color: 'ink-800' },
      { key: 'tip-badge',     label: 'Badge',            usage: 'Wavenumber (mono) and site (sans) badges',      size: '11.5px', weight: 400, color: 'badge-wn-fg' },
      { key: 'tip-ref-note',  label: 'Reference note',   usage: 'Per-citation note, italic, at most 150 words',  size: '11.5px', weight: 400, color: 'ink-400',    lh: '1.35', fs: 'italic' },
      { key: 'tip-hint',      label: 'Interaction hint', usage: 'Bottom row, only while a band is pinned open',  size: '10.5px', weight: 400, color: 'ink-050' },
    ],
  },
];

export const TYPE_ROLES: TypeRole[] = TYPE_GROUPS.flatMap(g => g.roles);

/* ---------------------------------------------------------------------------
   Shape, depth, rhythm
   --------------------------------------------------------------------------- */

export interface ScaleToken {
  value: string;
  usage: string;
}

export const RADII: Record<string, ScaleToken> = {
  'radius-sm': { value: '3px', usage: 'Pills, badges, kbd keys' },
  'radius':    { value: '4px', usage: 'Buttons, selects, reference boxes' },
  'radius-md': { value: '6px', usage: 'Tooltip, legend box' },
  'radius-lg': { value: '8px', usage: 'Download cards, large panels' },
};

export const SHADOWS: Record<string, ScaleToken> = {
  'shadow-sm': { value: '0 3px 10px rgba(0,0,0,0.12)', usage: 'Dropdown menu' },
  'shadow-md': { value: '0 4px 16px rgba(0,0,0,0.13)', usage: 'Tooltip, hovered card' },
  'shadow-lg': { value: '0 4px 20px rgba(0,0,0,0.22)', usage: 'Tooltip while pinned open' },
};

export const SPACING: Record<string, ScaleToken> = {
  'space-1': { value: '4px',  usage: 'Pill gaps, badge rows' },
  'space-2': { value: '6px',  usage: 'Inside a reference box' },
  'space-3': { value: '10px', usage: 'Tooltip padding' },
  'space-4': { value: '16px', usage: 'Between cards' },
  'space-5': { value: '28px', usage: 'Page padding, header' },
  'space-6': { value: '36px', usage: 'Between page sections' },
};

export const GRADIENTS: Record<string, ScaleToken> = {
  'grad-header': {
    value: `linear-gradient(100deg, ${C['brand-700']} 0%, ${C['brand-500']} 100%)`,
    usage: 'App header, the only gradient in the interface',
  },
};

/* ---------------------------------------------------------------------------
   Page layout
   --------------------------------------------------------------------------- */

export const PAGE_LAYOUT: Record<string, ScaleToken> = {
  'Content column': { value: '760px max-width', usage: 'Prose pages: Impressum, this guide. Never full-bleed text.' },
  'Page padding':   { value: '28px 48px 48px',  usage: 'Top / sides / bottom of a prose page' },
  'Sidebar':        { value: '220px, 36px collapsed', usage: 'Fixed width, animates over 0.18s' },
  'Header':         { value: '14px 28px padding', usage: 'Brand gradient, title left, authors right' },
  'Section gap':    { value: '36px',            usage: 'Between two page sections' },
};

/* ---------------------------------------------------------------------------
   Band chart geometry

   Imported by chart.ts and BandChart.svelte so the numbers exist once. Values
   are in data units unless the name says px.
   --------------------------------------------------------------------------- */

export const CHART_LAYOUT = {
  /** Vertical pitch of one lane, in y data units. */
  laneHeight: 1.2,
  /** Fraction of a lane the band rectangle actually fills (the rest is air). */
  barFraction: 0.25,
  /** Vertical offset of sub-lanes +1 / -1, as a fraction of the bar height. */
  subLaneOffsetFrac: 0.52,
  /** Plot margins, shared by the chart and the sticky axis strip so ticks align. */
  marginLeft: 200,
  marginRight: 20,
  marginTop: 30,
  marginBottom: 50,
  /** Default plot width in px. */
  width: 1100,
  /** Tooltip content-box width in px. */
  tooltipWidth: 300,
  /** Linked-vibrations panel width, as a fraction of the tooltip width. */
  vibPanelFrac: 0.55,
  /** Gap between tooltip and vibrations panel, px. */
  vibPanelGap: 6,
  /** Refs list starts scrolling past this height, px. */
  refsScrollMaxHeight: 240,
  /** Unpinned tooltips show at most this many references. */
  refsPreviewCount: 3,
};

export const CHART_LAYOUT_DOCS: { name: string; value: string; usage: string }[] = [
  { name: 'laneHeight',      value: '1.2 y-units',      usage: 'One lane of the stack; lanes are packed by wavenumber range in layout.py' },
  { name: 'barFraction',     value: '0.25',             usage: 'Band rectangle fills a quarter of its lane, the rest is breathing room' },
  { name: 'subLaneOffsetFrac', value: '0.52',           usage: 'Overlapping bands stagger into sub-lanes 0, +1, -1; more than 3-way overlap is dropped and logged' },
  { name: 'margins',         value: '200 / 20 / 30 / 50 px', usage: 'left / right / top / bottom. The 200px left margin holds the lane labels' },
  { name: 'axis strip',      value: '50px, sticky',     usage: 'Drawn as a separate plot pinned above the scrolling lane stack, sharing width and margins' },
  { name: 'tooltip',         value: '300px content box', usage: 'Plus 22px of padding and border. Flips to the other side of the cursor when it would run off screen' },
  { name: 'vibration panel', value: '55% of tooltip, 6px gap', usage: 'Attaches to the outer side of the tooltip, top-aligned, never overlapping it' },
];

/* ---------------------------------------------------------------------------
   Editorial limits

   Checked (as warnings, never errors) by build.py and shown on the Style guide
   page. Keep these numbers and build.py's in step.
   --------------------------------------------------------------------------- */

export interface ContentLimit {
  field: string;
  target: string;
  hard: number;
  rule: string;
  how: string[];
}

export const CONTENT_LIMITS: ContentLimit[] = [
  {
    field: 'band.description',
    target: '100 to 120 words',
    hard: 120,
    rule: 'What the mode is, where it sits, what it gets confused with. Nothing that belongs to one single paper.',
    how: [
      'Short sentences, one clause each.',
      'Semicolon lists beat comma-spliced prose.',
      'Drop the hedging ("it is generally observed that").',
      'Numbers, not adjectives: "1580 to 1620 cm⁻¹" beats "fairly broad".',
      'Paper-specific detail belongs in that reference\'s note instead.',
    ],
  },
  {
    field: 'band.references[].note',
    target: 'at most 150 words',
    hard: 150,
    rule: 'What this one paper reported: which surface, which conditions, which caveat.',
    how: [
      'Lead with the observation, not with the authors.',
      'Conditions go here; the surface goes in the `site` field.',
      'Wavenumbers go in `wn`, not in the prose.',
      'Cite the paper, do not summarise its methods section.',
    ],
  },
];

/* ---------------------------------------------------------------------------
   CSS emission
   --------------------------------------------------------------------------- */

function typeVars(r: TypeRole): string[] {
  return [
    `  --t-${r.key}-size: ${r.size};`,
    `  --t-${r.key}-weight: ${r.weight};`,
    `  --t-${r.key}-color: var(--${r.color});`,
    `  --t-${r.key}-ff: var(--font-${r.family ?? 'sans'});`,
    `  --t-${r.key}-lh: ${r.lh ?? 'normal'};`,
    `  --t-${r.key}-ls: ${r.ls ?? 'normal'};`,
    `  --t-${r.key}-tt: ${r.tt ?? 'none'};`,
    `  --t-${r.key}-fs: ${r.fs ?? 'normal'};`,
  ];
}

/** The full `:root { ... }` block, built from the objects above. */
export function tokenCss(): string {
  const lines: string[] = [':root {'];
  lines.push(`  --font-sans: ${FONTS.sans};`);
  lines.push(`  --font-mono: ${FONTS.mono};`);
  for (const g of COLOR_GROUPS) {
    for (const [name, t] of Object.entries(g.tokens)) lines.push(`  --${name}: ${t.value};`);
  }
  for (const r of TYPE_ROLES) lines.push(...typeVars(r));
  for (const map of [RADII, SHADOWS, SPACING, GRADIENTS]) {
    for (const [name, t] of Object.entries(map)) lines.push(`  --${name}: ${t.value};`);
  }
  lines.push(`  --tip-width: ${CHART_LAYOUT.tooltipWidth}px;`);
  lines.push(`  --tip-refs-max-h: ${CHART_LAYOUT.refsScrollMaxHeight}px;`);
  lines.push('}');
  return lines.join('\n');
}

/** Inject the token block into <head>. Called once, from main.ts. */
export function installTokens(): void {
  const el = document.createElement('style');
  el.id = 'design-tokens';
  el.textContent = tokenCss();
  document.head.prepend(el);
}

<script context="module" lang="ts">
  import { PHENOMENA, PATTERN_GROUPS } from '../lib/phenomena';
  import { FUNDAMENTALS, KNOWLEDGE_SECTIONS, PLANNED } from '../lib/fundamentals';
  import type { Fundamental } from '../lib/fundamentals';

  /** Every card on the page: the fundamentals, then the band patterns. */
  export interface KnCard {
    key: string;
    label: string;
    teaser: string;
    /** The row it sits in: a fundamentals section or a pattern group. */
    section: string;
    kind: 'fundamental' | 'phenomenon';
    /** Prose or drawing unfinished: shown as a chip, and not a style model. */
    wip?: boolean;
  }

  // Within the band patterns, the simplest cause first.
  // Within "Bands That Move", the cause that is the band's own first
  // (a heavier nucleus, a different site), then the two that are the
  // neighbours': the chemical shift, then the through-space coupling.
  const PATTERN_ORDER = [
    'branches', 'overtone', 'combination', 'fermi', 'degeneracy',
    'isotopologue', 'site-sensitivity', 'coverage-shift', 'vibrational-coupling',
  ];

  export const CARDS: KnCard[] = [
    ...FUNDAMENTALS.map(f => ({
      key: f.key, label: f.label, teaser: f.teaser,
      section: f.section as string, kind: 'fundamental' as const, wip: f.wip,
    })),
    ...PHENOMENA.filter(p => p.group)
      .sort((a, b) => PATTERN_ORDER.indexOf(a.key) - PATTERN_ORDER.indexOf(b.key))
      .map(p => ({
        key: p.key, label: p.label, teaser: p.teaser,
        section: p.group as string, kind: 'phenomenon' as const, wip: p.wip,
      })),
  ];

  /** The cards of one row, in their order. */
  const cardsIn = (section: string) => CARDS.filter(c => c.section === section);


  /**
   * The rows of cards. The fundamentals sections are parts of their own; the
   * three pattern groups are sub-rows of one part, "Band patterns", which
   * sits between the parts that come before it and those marked
   * `afterPatterns` (Notation).
   */
  const partRow = (s: (typeof KNOWLEDGE_SECTIONS)[number]) =>
    ({ key: s.key as string, label: s.label, sub: false, note: s.lead, cont: s.continues });
  export const ROWS: { key: string; label: string; sub: boolean; note?: string; cont?: boolean }[] = [
    ...KNOWLEDGE_SECTIONS.filter(s => !s.afterPatterns).map(partRow),
    ...PATTERN_GROUPS.map(g => ({ key: g.key as string, label: g.label, sub: true, note: g.note })),
    ...KNOWLEDGE_SECTIONS.filter(s => s.afterPatterns).map(partRow),
  ];

  /**
   * Rows that share one container: a part and any line it continues onto.
   * They are one flex box so that, once a card opens and the rest list
   * beneath it, the cards pack up to a full row instead of leaving a
   * continuation line stranded on its own. While nothing is open the line
   * break is put back as a spacer, so Frustrated Motion keeps its own line.
   */
  export interface CardGroup {
    key: string;
    rows: typeof ROWS;
    /** Every card of the group in reading order, with where a line starts. */
    cards: { card: KnCard; breakBefore: boolean }[];
  }
  export const GROUPS: CardGroup[] = [];
  for (const row of ROWS) {
    const last = GROUPS[GROUPS.length - 1];
    if (row.cont && last) last.rows.push(row);
    else GROUPS.push({ key: row.key, rows: [row], cards: [] });
  }
  for (const g of GROUPS) {
    g.cards = g.rows.flatMap((r, ri) =>
      cardsIn(r.key).map((card, i) => ({ card, breakBefore: ri > 0 && i === 0 })),
    );
  }
  const groupKeyOf = (section: string | undefined) =>
    GROUPS.find(g => g.rows.some(r => r.key === section))?.key;

  export interface KnSection {
    id: string;
    label: string;
    part?: boolean;
  }

  /** Table of contents for the sidebar: each part, then its cards, in page order. */
  export const SECTIONS: KnSection[] = ROWS.flatMap((row, i) => [
    ...(row.cont
      ? []
      : !row.sub
      ? [{ id: row.key, label: row.label, part: true }]
      : !ROWS[i - 1]?.sub
        ? [{ id: 'patterns', label: 'Band Patterns', part: true }]
        : []),
    ...cardsIn(row.key).map(c => ({ id: c.key, label: c.label })),
  ]).concat(PLANNED.length ? [{ id: 'planned', label: 'Still to Come', part: true }] : []);
</script>

<script lang="ts">
  /**
   * Knowledge: what the spectra mean, as opposed to what the atlas holds.
   *
   * Three parts, all cards the size of a home page card with a diagram that
   * plays on hover; a click grows a card to the full row, morphs its diagram
   * into the detailed version and opens the full text.
   *
   *   Light–matter interaction and Spectroscopy (lib/fundamentals.ts): the
   *     physics, written and cited, with links to the patterns built on it.
   *   Band patterns (lib/phenomena.ts): why a spectrum does not show exactly
   *     one band per vibration, in three rows (more bands, fewer, moved).
   *     Each card carries its own back-relation: the bands in this dataset
   *     that show it, resolved live from the link fields, with the papers
   *     that reported them, in a box under the text. Their prose is not
   *     written yet, and an empty card says so rather than looking finished.
   */
  import { createEventDispatcher, onMount, onDestroy, afterUpdate } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import type { Band, RefMap, Vibrations } from '../lib/types';
  import VibrationDiagram from './knowledge/VibrationDiagram.svelte';
  import SpectrumDiagram from './knowledge/SpectrumDiagram.svelte';
  import RamanDiagram from './knowledge/RamanDiagram.svelte';
  import SelectionDiagram from './knowledge/SelectionDiagram.svelte';
  import DipoleDiagram from './knowledge/DipoleDiagram.svelte';
  import PolarizabilityDiagram from './knowledge/PolarizabilityDiagram.svelte';
  import InducedDiagram from './knowledge/InducedDiagram.svelte';
  import PhenomenonDiagram from './knowledge/PhenomenonDiagram.svelte';
  import ModesDiagram from './knowledge/ModesDiagram.svelte';
  import VibModesDiagram from './knowledge/VibModesDiagram.svelte';
  import TranslationDiagram from './knowledge/TranslationDiagram.svelte';
  import UnitsDiagram from './knowledge/UnitsDiagram.svelte';
  import RepresentationsDiagram from './knowledge/RepresentationsDiagram.svelte';
  import RotationDiagram from './knowledge/RotationDiagram.svelte';
  import FrustratedDiagram from './knowledge/FrustratedDiagram.svelte';
  import BranchesDiagram from './knowledge/BranchesDiagram.svelte';
  import NotationDiagram from './knowledge/NotationDiagram.svelte';
  import MathNotationDiagram from './knowledge/MathNotationDiagram.svelte';
  import LadderDiagram from './knowledge/LadderDiagram.svelte';
  import FermiDiagram from './knowledge/FermiDiagram.svelte';
  import DegeneracyDiagram from './knowledge/DegeneracyDiagram.svelte';
  import IsotopeDiagram from './knowledge/IsotopeDiagram.svelte';
  import LightPathDiagram from './knowledge/LightPathDiagram.svelte';
  import LambertBeerDiagram from './knowledge/LambertBeerDiagram.svelte';
  import ModeCensus from './knowledge/ModeCensus.svelte';
  import AtlasExamples from './knowledge/AtlasExamples.svelte';
  import CiteText from './knowledge/CiteText.svelte';
  import Subbed from './knowledge/Subbed.svelte';
  import FormulaLine from './knowledge/FormulaLine.svelte';
  import { citer, summarizeLocators, SOURCES, type Cited, type Segment } from '../lib/cite';
  import { isFormula } from '../lib/fundamentals';
  import type { SelectionExample } from './knowledge/SelectionDiagram.svelte';
  import type { SpectrumExample } from './knowledge/SpectrumDiagram.svelte';
  import { CARD_LAYOUT } from '../lib/tokens';
  import { branchSuffix, speciesLabel } from '../lib/labels';
  import { ieeeHtml, shortCite } from '../lib/citations';
  import { htmlToUnicode } from '../lib/notation';
  import { titleCase } from '../lib/titleCase';

  export let bands: Band[];
  export let refs: RefMap;
  /** The molecules and their modes: the Normal modes card lists them. */
  export let vibrations: Vibrations = { molecules: [] };
  /** Open this card on arrival (from a Knowledge link on the References page). */
  export let openOnMount: string | null = null;

  const dispatch = createEventDispatcher<{
    active: { id: string };
    /** Which card is open, or null: the sidebar's second mark. */
    opened: { key: string | null };
    navigateBand: { id: string };
    navigateRef: { key: string };
    navigateMode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  /**
   * The three works the page is written out of, named once at the top.
   *
   * The per-card reference lists already say which claim came from where,
   * but one citation at a time never adds up to "whose account of the
   * subject is this". These three do most of the carrying, so they are
   * stated rather than inferred. Keep it in step with SOURCES in
   * lib/cite.ts: an alias added there for a fourth pillar belongs here too,
   * and a one-off paper does not.
   */
  const PAGE_SOURCES: { key: string; forWhat: string }[] = [
    { key: SOURCES.busca.key, forWhat: 'for the infrared and the practice of measuring a catalyst' },
    { key: SOURCES.long.key, forWhat: 'for the theory of Raman scattering' },
    { key: SOURCES.davydov.key, forWhat: 'for what an adsorbed species does on an oxide' },
  ];

  // Each phenomenon's occurrences in the atlas, resolved live.
  $: examplesOf = Object.fromEntries(PHENOMENA.map(p => [p.key, p.find(bands)]));
  const phenomenon = (key: string) => PHENOMENA.find(p => p.key === key);
  /** Phenomena a fundamentals card hosts: their examples are listed there. */
  const hosted = (key: string) => PHENOMENA.filter(p => p.into === key);

  function bandName(b: Band): string {
    return (b.short || `${speciesLabel(b.species)} ${b.vibration.category}`) + branchSuffix(b);
  }

  /* ── Basics cards ──
     Opening is one continuous move, not a swap: the teaser fades, then the
     card widens to the full row while its diagram morphs from the bare
     ladder into the full well (both driven by `morph`), then the
     explanation slides in beside it. Closing runs the same steps backwards. */
  type Diagram =
    | typeof VibrationDiagram
    | typeof DipoleDiagram
    | typeof SpectrumDiagram
    | typeof InducedDiagram
    | typeof PolarizabilityDiagram
    | typeof RamanDiagram
    | typeof SelectionDiagram
    | typeof PhenomenonDiagram
    | typeof ModesDiagram
    | typeof VibModesDiagram
    | typeof TranslationDiagram
    | typeof UnitsDiagram
    | typeof RepresentationsDiagram
    | typeof RotationDiagram
    | typeof FrustratedDiagram
    | typeof BranchesDiagram
    | typeof NotationDiagram
    | typeof MathNotationDiagram
    | typeof LadderDiagram
    | typeof FermiDiagram
    | typeof DegeneracyDiagram
    | typeof LightPathDiagram
    | typeof LambertBeerDiagram;
  const DIAGRAMS: Record<string, Diagram> = {
    modes: ModesDiagram,
    vibmodes: VibModesDiagram,
    translation: TranslationDiagram,
    units: UnitsDiagram,
    representations: RepresentationsDiagram,
    rotation: RotationDiagram,
    frustrated: FrustratedDiagram,
    branches: BranchesDiagram,
    labels: NotationDiagram,
    numbering: NotationDiagram,
    mathnotation: MathNotationDiagram,
    overtone: LadderDiagram,
    combination: LadderDiagram,
    fermi: FermiDiagram,
    degeneracy: DegeneracyDiagram,
    isotopologue: IsotopeDiagram,
    lightpath: LightPathDiagram,
    lambertbeer: LambertBeerDiagram,
    vibration: VibrationDiagram,
    dipole: DipoleDiagram,
    induced: InducedDiagram,
    spectrum: SpectrumDiagram,
    polarizability: PolarizabilityDiagram,
    raman: RamanDiagram,
    selection: SelectionDiagram,
  };
  const diagramFor = (key: string): Diagram => DIAGRAMS[key] ?? PhenomenonDiagram;

  /* Each card's text, parsed once: paragraphs and formula boxes with their
     citations numbered in reading order, and the list those numbers point at. */
  type Rendered =
    | { kind: 'p'; segs: Segment[] }
    | { kind: 'f'; label: Segment[]; lines: string[]; note: Segment[]; tone?: 'ir' | 'raman'; wide?: boolean };
  // Phenomena join in once their explanation is written out as a body.
  const WRITTEN = [
    ...FUNDAMENTALS,
    ...PHENOMENA.flatMap(p => (p.body ? [{ key: p.key, body: p.body }] : [])),
  ];
  const RENDERED: Record<string, { blocks: Rendered[]; cited: Cited[] }> = Object.fromEntries(
    WRITTEN.map(f => {
      const c = citer();
      const blocks: Rendered[] = f.body.map(b =>
        isFormula(b)
          ? { kind: 'f', label: c.parse(titleCase(b.label)), lines: b.lines, note: b.note ? c.parse(b.note) : [], tone: b.tone, wide: b.wide }
          : { kind: 'p', segs: c.parse(b) },
      );
      return [f.key, { blocks, cited: c.list }];
    }),
  );

  /** The legend under an opened diagram, per card. `swatch` is a class below. */
  const CAPTIONS: Record<string, { swatch?: string; text: string }[]> = {
    vibration: [
      { swatch: 'photon', text: 'infrared photon, hν' },
      { swatch: 'fund', text: 'absorption, 0 → 1' },
      { swatch: 'heat', text: 'relaxation, as heat' },
      { swatch: 'over', text: 'overtone, 0 → 2' },
    ],
    overtone: [
      { swatch: 'photon', text: 'infrared photon, hν' },
      { swatch: 'fund', text: 'absorption' },
      { swatch: 'over', text: 'where evenly spaced levels would sit' },
      { swatch: 'trace', text: 'the absorption spectrum it leaves' },
    ],
    spectrum: [
      { swatch: 'photon', text: 'infrared photon' },
      { swatch: 'fund', text: 'absorbed where it fits a gap' },
      { swatch: 'trace', text: 'what the detector records' },
    ],
    // In the order the ladders are drawn, left to right.
    raman: [
      { swatch: 'anti', text: 'anti-Stokes, bluer' },
      { swatch: 'laser', text: 'laser, and Rayleigh light' },
      { swatch: 'stokes', text: 'Stokes, redder' },
      { swatch: 'heat', text: 'relaxation, as heat' },
      { text: 'Shown: one photon in five shifted. Real: about one in ten million.' },
    ],
    dipole: [
      { swatch: 'photon', text: 'a permanent dipole μ, and the IR light that drives it' },
      { swatch: 'laser', text: 'a field E, and the electron density it shifts' },
      { swatch: 'trace', text: 'an induced dipole μ(ind)' },
    ],
    induced: [
      { swatch: 'laser', text: 'the field E, and the electron density it shifts' },
      { swatch: 'trace', text: 'the induced dipole μ(ind)' },
      { swatch: 'photon', text: 'a permanent dipole μ' },
    ],
    polarizability: [
      { swatch: 'laser', text: 'the field E, and the electron density it shifts' },
      { swatch: 'trace', text: 'the induced dipole μ(ind)' },
    ],
    selection: [
      { swatch: 'photon', text: 'IR: the dipole μ' },
      { swatch: 'laser', text: 'Raman: the polarizability α, the cloud' },
    ],
  };

  // How much light a band takes, from its recorded intensity. Schematic:
  // the atlas stores a word, not an absorbance.
  const DEPTH: Record<string, number> = { vs: 0.72, s: 0.62, m: 0.45, w: 0.28, vw: 0.18 };

  function spectrumExamples(
    refs: Fundamental['examples'] = [],
    minWidth = 60,
  ): (SpectrumExample & SelectionExample)[] {
    return refs.flatMap(ref => {
      const r = typeof ref === 'string' ? { id: ref } : ref;
      const b = bands.find(x => x.id === r.id);
      if (!b) return [];
      return [{
        id: b.id,
        label: bandName(b),
        wn: r.wn ?? (b.wn_min + b.wn_max) / 2,
        fwhm: Math.max(minWidth, b.wn_max - b.wn_min),
        depth: r.depth ?? DEPTH[b.intensity ?? ''] ?? 0.45,
        raman: r.raman ?? false,
      }];
    });
  }

  /** What each diagram needs beyond t and playing. */
  // Each diagram takes its own extras, so the spread is typed loosely.
  $: diagramProps = (key: string): Record<string, unknown> => {
    const f = FUNDAMENTALS.find(x => x.key === key);
    if (key === 'spectrum') return { examples: spectrumExamples(f?.examples) };
    // Gas-phase branches are narrow; a smaller floor keeps P and R apart.
    if (key === 'selection') return { examples: spectrumExamples(f?.examples, 20) };
    if (key === 'labels' || key === 'numbering') return { kind: key };
    if (key === 'overtone' || key === 'combination') return { kind: key };
    // A phenomenon without a diagram of its own is one kind of PhenomenonDiagram.
    if (phenomenon(key) && !DIAGRAMS[key]) return { kind: key };
    return {};
  };

  /**
   * An opened card is a stack of sections, and the order is a convention
   * every card keeps:
   *
   *   1. the split: the diagram on the left, the opening text on the right
   *   2. the body, and any further sections, full width
   *   3. what this card relates to, as links to other cards
   *   4. the references, behind a divider
   *
   * Only the first is two columns, so everything below it has the whole
   * card to use and a narrow screen only has to collapse that one section.
   *
   * Every section is one **beat**: something on the left, the prose it
   * belongs to on the right. The diagram is the first beat and takes the
   * paragraphs before the card's first callout; each callout after that
   * opens a beat of its own and takes the paragraphs that follow it.
   *
   * The reason for beats rather than one long left column is what happens
   * when the card is squeezed to a single column: a beat collapses to
   * left-then-right, which is the order it was written in, so an equation
   * still lands immediately before the text about it. Stacking every
   * callout under the diagram would read correctly wide and wrongly
   * narrow, with the equations all ahead of the prose.
   */

  /**
   * A paragraph is worth wrapping around a float only if there is enough of
   * it to wrap. Two cases are given `clear: left` instead, so the paragraph
   * starts below the float whole:
   *
   *   a paragraph of one or two lines that a float edge would cut in half
   *   a paragraph that begins one or two lines above the edge, leaving a
   *     stub beside the box and the body of it full width
   *
   * Both fixes push down, which is why they settle: a cleared paragraph
   * cannot straddle the edge again. Growing the float to swallow a short
   * tail instead does not settle, because a taller float makes the text
   * taller and the tail moves down with it.
   */
  const MIN_LINES_BESIDE = 3;
  /** Only while the floats are on; below this the card is one column. */
  const FLOAT_MIN_WIDTH = '(min-width: 861px)';

  function tidyWrap(card: HTMLElement) {
    const text = card.querySelector<HTMLElement>('.detail-text');
    if (!text) return;
    const paras = Array.from(text.querySelectorAll<HTMLElement>(':scope > p'));
    for (const p of paras) p.style.clear = '';
    if (!window.matchMedia(FLOAT_MIN_WIDTH).matches) return;

    const boxes = [
      card.querySelector<HTMLElement>(':scope > .kn-flow > .card-visual'),
      ...Array.from(text.querySelectorAll<HTMLElement>('.formula')),
    ].filter((el): el is HTMLElement => !!el);
    // Clearing moves everything below it, so let it settle over a few
    // passes rather than assuming one is enough.
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      const edges = boxes
        .filter(b => getComputedStyle(b).float === 'left')
        .map(b => b.getBoundingClientRect().bottom);
      for (const p of paras) {
        if (p.style.clear) continue;
        const r = p.getBoundingClientRect();
        const cs = getComputedStyle(p);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
        const edge = edges.find(e => e > r.top + 1 && e < r.bottom - 1);
        if (edge === undefined) continue;
        const lines = Math.round(r.height / lh);
        const above = Math.round((edge - r.top) / lh);
        if (lines < MIN_LINES_BESIDE || (above > 0 && above < MIN_LINES_BESIDE)) {
          p.style.clear = 'left';
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  /**
   * Runs the tidy once the card is open, again when the window changes size,
   * and again whenever a float finishes growing.
   *
   * That last one matters more than it sounds. A callout's height is not
   * known on the frame the card opens: KaTeX typesets after layout and a web
   * font lands later still, so the first measurement sees a box a third of
   * its final height, finds the float edge one line into the paragraph
   * below, and clears it. The clear is sticky, so the paragraph stayed
   * pushed below a box it had room to sit beside, and every callout in the
   * card left a white hole to its right.
   *
   * Watching the floats is safe where watching the paragraphs would not be.
   * Clearing a paragraph moves a box but never resizes one, so this observer
   * cannot be woken by its own effect, and it compares heights before acting
   * in any case.
   */
  function floatTidy(node: HTMLElement, open: boolean) {
    let frame = 0;
    let ro: ResizeObserver | null = null;
    const seen = new WeakMap<Element, number>();
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => tidyWrap(node));
    };
    function watchFloats() {
      ro?.disconnect();
      ro = null;
      const boxes = [
        node.querySelector<HTMLElement>(':scope > .kn-flow > .card-visual'),
        ...Array.from(node.querySelectorAll<HTMLElement>('.formula')),
      ].filter((el): el is HTMLElement => !!el);
      if (!boxes.length) return;
      ro = new ResizeObserver(entries => {
        let grew = false;
        for (const e of entries) {
          const h = e.contentRect.height;
          if (seen.get(e.target) !== h) {
            seen.set(e.target, h);
            grew = true;
          }
        }
        if (grew) run();
      });
      for (const b of boxes) ro.observe(b);
    }
    function setup(isOpen: boolean) {
      window.removeEventListener('resize', run);
      ro?.disconnect();
      ro = null;
      if (!isOpen) return;
      run();
      watchFloats();
      // The font arrives after the first paint and resizes every box again.
      document.fonts?.ready.then(run).catch(() => {});
      window.addEventListener('resize', run);
    }
    setup(open);
    return {
      update: setup,
      destroy() {
        cancelAnimationFrame(frame);
        ro?.disconnect();
        window.removeEventListener('resize', run);
      },
    };
  }

  /** The card a link lands on: a hosted phenomenon lands on its host. */
  const cardFor = (key: string) => phenomenon(key)?.into ?? key;
  const cardLabel = (key: string) => CARDS.find(c => c.key === cardFor(key))?.label ?? key;

  type Phase = 'closed' | 'opening' | 'open' | 'closing';
  const FADE = 140;
  const morph = tweened(0, { duration: 520, easing: cubicInOut });

  let openKey: string | null = null;
  let phase: Phase = 'closed';
  let hoverCard: string | null = null;
  let hoverVisual = false;
  let rowWidth = 0;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  // Reactive so the markup re-reads them when the state they close over moves.
  $: tFor = (key: string) => (key === openKey ? $morph : 0);
  /**
   * Diagrams with nothing to play. A card whose small diagram is still
   * worth hovering can have an opened one that is not, so the two states
   * are listed separately; where there is nothing, the hint says so by
   * being struck through rather than by disappearing.
   */
  const STATIC_CARD = new Set(['mathnotation']);
  // Spectral Representations used to cut from one plot to the next when
  // opened, which was worth nothing and was flagged static. It morphs now,
  // so it plays like any other card.
  const STATIC_OPEN = new Set(['mathnotation']);

  $: playingFor = (key: string) =>
    key !== openKey
      ? hoverCard === key && !STATIC_CARD.has(key)
      : phase === 'open' && hoverVisual && !STATIC_OPEN.has(key);

  // An opened card keeps its row and pushes the rest of that row down: it
  // takes the row's first place (CSS `order`), the cards it shared the row
  // with follow it, and they wrap below as it widens. Every card that
  // changes place glides there (FLIP on the layout position, which ignores
  // transforms), so neither the swap nor the push is a jump.
  const GLIDE = 300;
  const GLIDE_EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
  $: perRow = Math.max(1, Math.floor((rowWidth + 12) / (CARD_LAYOUT.width + 12)));
  /** Where a card sits in its group, which is what the flex order counts. */
  const indexInSection = (key: string | null) => {
    const g = GROUPS.find(x => x.cards.some(e => e.card.key === key));
    return g ? g.cards.findIndex(e => e.card.key === key) : -1;
  };
  $: openIndex = indexInSection(openKey);
  $: openGroup = groupKeyOf(CARDS.find(c => c.key === openKey)?.section);
  $: orderFor = (group: string, i: number) =>
    group === openGroup && i === openIndex ? 2 * (i - (i % perRow)) - 1 : 2 * i;

  const cardEls: Record<string, HTMLElement> = {};
  const lastPos = new Map<string, { x: number; y: number }>();

  afterUpdate(() => {
    for (const f of CARDS) {
      const el = cardEls[f.key];
      if (!el) continue;
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      const prev = lastPos.get(f.key);
      lastPos.set(f.key, pos);
      if (!prev) continue;
      const dx = prev.x - pos.x;
      const dy = prev.y - pos.y;
      // A neighbour sliding along as the open card widens is not a move;
      // a swap or a wrap to the next line is.
      if (Math.abs(dy) < 1 && Math.abs(dx) < 40) continue;
      el.getAnimations().forEach(a => a.cancel());
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: GLIDE, easing: GLIDE_EASE },
      );
    }
  });

  async function openCard(key: string) {
    // Another card is open: close it first, let the row settle, then open.
    if (phase === 'open' && openKey !== key) {
      await closeCard();
      await new Promise(r => setTimeout(r, 120));
    }
    if (phase !== 'closed') return;
    hoverVisual = false;
    const i = indexInSection(key);
    openKey = key;
    phase = 'opening';
    // Wait out the swap if the card had to move to the front of its row.
    await morph.set(1, { delay: i % perRow ? GLIDE : FADE });
    // Cast: TS narrowed `phase` to 'closed' above and cannot see it change.
    if ((phase as Phase) === 'opening') phase = 'open';
  }

  async function closeCard() {
    if (phase !== 'open') return;
    phase = 'closing';
    await morph.set(0, { delay: FADE + 100 });
    if (phase !== 'closing') return;
    phase = 'closed';
    openKey = null;
  }

  /**
   * The sidebar's contents: a part scrolls to its heading, a card scrolls to
   * the card and opens it. Called by App.svelte through bind:this.
   */
  export function goTo(id: string) {
    if (CARDS.some(c => c.key === id)) goToCard(id);
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Follow a link to another card: bring it into view, then open it. */
  function goToCard(key: string) {
    const target = cardFor(key);
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => openCard(target), 350);
  }

  // A click anywhere beside the open card closes it: on the page, or in the
  // empty margins left and right of it (those belong to the scroll area, not
  // to the page). The sidebar and header are left alone.
  function onPageClick(e: MouseEvent) {
    if (phase !== 'open' || !openKey) return;
    const target = e.target as Node | null;
    const area = scroller ?? root;
    if (!target || !area?.contains(target)) return;
    if (cardEls[openKey]?.contains(target)) return;
    closeCard();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeCard();
  }

  /**
   * Which card is open, out to the sidebar. Separate from the scroll spy on
   * purpose: one says where the reader is, the other says what they have
   * opened, and the two are usually but not always the same card.
   */
  $: dispatch('opened', { key: openKey });

  /* ── Scroll spy, same mechanism as the other long-form pages ── */
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
      const el = root?.querySelector<HTMLElement>(`[data-kn-section="${s.id}"]`);
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

  /*
   * Every closed card in a ROW the same size, and rows independent of each
   * other. A row has to line up or the page looks broken; two rows do not,
   * and tying them together is what a single page-wide height did. The two
   * longest teasers on the page (Where the Radiation Goes, the Lambert-Beer
   * Law) run to about 360px, everything else to 287-309, so one number for
   * the whole page made twenty-odd cards a fifth taller than their own
   * content for the sake of two. CARD_LAYOUT.height stays the floor.
   *
   * Measured rather than counted: which cards share a row depends on how many
   * fit, which depends on the width the page has, which changes with the
   * sidebar, the window and the presentation scale. Asking the browser where
   * each card actually landed answers all three at once.
   */
  function equalizeCards() {
    // Only with everything closed: an open card is several times the height
    // of its neighbours and would drag its whole row up to its own size.
    if (phase !== 'closed') return;
    const els = CARDS.map(c => cardEls[c.key]).filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    // Back to the floor first, so what is read next is each card's own
    // content height rather than whatever the last pass imposed.
    for (const el of els) el.style.minHeight = `${CARD_LAYOUT.height}px`;

    /* Group by the line the card landed on, through `offsetTop` and never
       through a bounding rect. A card carries a hover lift and a FLIP glide,
       both transforms, and a rect reports where a card is being animated to
       rather than where the layout put it: measured that way, three cards
       sharing a row read as three different rows and each keeps its own
       height. `offsetTop` and `offsetHeight` are layout, so they ignore
       every transform in flight.

       Keyed by container as well, because each part of the page is its own
       flex box and the first row of every one of them is at offsetTop 0. */
    const byContainer = new Map<Element, Map<number, HTMLElement[]>>();
    for (const el of els) {
      const parent = el.parentElement;
      if (!parent) continue;
      let rows = byContainer.get(parent);
      if (!rows) byContainer.set(parent, (rows = new Map()));
      const top = el.offsetTop;
      const row = rows.get(top);
      if (row) row.push(el);
      else rows.set(top, [el]);
    }

    for (const rows of byContainer.values()) {
      for (const row of rows.values()) {
        const tallest = Math.max(...row.map(el => el.offsetHeight));
        for (const el of row) el.style.minHeight = `${tallest}px`;
      }
    }
  }

  /* Rows change membership whenever the width does (the sidebar opening, the
     window, the presentation scale), and a card that Svelte rebuilt on close
     has lost the height that was written on it. Both are answered by running
     it again after the layout has settled. */
  let equalizeFrame = 0;
  function queueEqualize() {
    if (equalizeFrame) cancelAnimationFrame(equalizeFrame);
    equalizeFrame = requestAnimationFrame(() => {
      equalizeFrame = 0;
      equalizeCards();
    });
  }
  /* Both conditions, not just the phase: `closed` is set one statement before
     `openKey` is cleared, and the card that was open is still drawn open at
     that moment. */
  $: if (phase === 'closed' && openKey === null) queueEqualize();

  let rowObserver: ResizeObserver | null = null;
  let lastRowWidth = 0;

  onMount(() => {
    (document.fonts?.ready ?? Promise.resolve()).then(equalizeCards);
    /* Width only. Watching the height too would be a loop: writing the row
       heights changes the page's height, which would call this again. */
    rowObserver = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      if (w === lastRowWidth) return;
      lastRowWidth = w;
      queueEqualize();
    });
    rowObserver.observe(root);
    if (openOnMount && CARDS.some(c => c.key === openOnMount)) {
      const key = openOnMount;
      requestAnimationFrame(() => {
        document.getElementById(key)?.scrollIntoView({ block: 'start' });
        openCard(key);
      });
    }
    scroller = root.closest('.main-area');
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    measure();
  });

  onDestroy(() => {
    if (frame) cancelAnimationFrame(frame);
    if (equalizeFrame) cancelAnimationFrame(equalizeFrame);
    rowObserver?.disconnect();
    scroller?.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:window on:keydown={onKey} on:click={onPageClick} />

<main class="content" bind:this={root}>
  <h1 class="page-title">Knowledge</h1>
  <p class="lead">
    Why the bands behave the way they do. First how molecules move and how light and
    matter interact, then the spectroscopy built on it, then the patterns a spectrum
    shows, and last the notation it is all written in: one card each, hover to see it
    happen, click to read it. Each pattern lists the bands in this atlas that show it,
    resolved from the data rather than written down twice, and the papers that
    reported them.
  </p>

  <!-- Which books this is written out of. The superscripts under each card
       say it one citation at a time; this says it once, up front, because
       three works carry most of the page and a reader deserves to know
       whose account of the subject they are reading. -->
  <p class="lead sources">
    Most of what follows rests on three works, cited by page throughout:
    {#each PAGE_SOURCES as src, i (src.key)}<!--
      --><button
        class="ref-chip"
        title={htmlToUnicode(ieeeHtml(refs?.[src.key] ?? {}, src.key))}
        on:click|stopPropagation={() => dispatch('navigateRef', { key: src.key })}
      >{shortCite(refs?.[src.key] ?? {}, src.key, { journal: false })}</button><!--
      --><span class="source-for"> {src.forWhat}</span>{i < PAGE_SOURCES.length - 1 ? ';' : '.'}
    {/each}
    Everything else is a single paper cited where one card needs it, and a
    sentence with no marker on it is the author's own reasoning or a
    cross-reference.
  </p>

  {#each GROUPS as grp (grp.key)}
  {@const sec = grp.rows[0]}
  {@const ri = ROWS.indexOf(sec)}
  {#if !sec.sub}
    <h2 class="part" id={sec.key} data-kn-section={sec.key}>{sec.label}</h2>
    {#if sec.note}<p class="part-lead">{sec.note}</p>{/if}
  {:else}
    {#if !ROWS[ri - 1]?.sub}
      <h2 class="part" id="patterns" data-kn-section="patterns">Band Patterns</h2>
      <p class="part-lead">
        A molecule has 3N − 6 normal modes, but a spectrum rarely shows exactly one band
        for each: there are more bands than modes, fewer, or bands that sit somewhere else.
      </p>
    {/if}
    <h3 class="row-head" id={sec.key}>{sec.label}<span class="row-note">{sec.note}</span></h3>
  {/if}

  <div class="cards" bind:clientWidth={rowWidth}>
    {#each grp.cards as entry, i (entry.card.key)}
      {@const f = entry.card}
      {@const t = tFor(f.key)}
      {@const isOpen = f.key === openKey}
      <!-- A continued line stays a line of its own until something opens;
           then the cards pack instead, and fill the row. -->
      {#if entry.breakBefore && openGroup !== grp.key}
        <div class="line-break" style="order:{2 * i - 1}"></div>
      {/if}
      <!-- Closed, the whole card is the button; open, only its × is. The role
           switches with it, which the a11y check cannot follow statically. -->
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <div
        class="card"
        class:open={isOpen}
        id={f.key}
        data-kn-section={f.key}
        role={isOpen ? 'region' : 'button'}
        tabindex={isOpen ? -1 : 0}
        aria-expanded={isOpen}
        aria-label={isOpen ? f.label : undefined}
        bind:this={cardEls[f.key]}
        use:floatTidy={isOpen && phase === 'open'}
        style="order:{orderFor(sec.key, i)}; width:{isOpen && rowWidth ? lerp(CARD_LAYOUT.width, rowWidth, t) : CARD_LAYOUT.width}px"
        on:mouseenter={() => (hoverCard = f.key)}
        on:mouseleave={() => (hoverCard = null)}
        on:click={() => openCard(f.key)}
        on:keydown={e => (e.key === 'Enter' || e.key === ' ') && !isOpen && (e.preventDefault(), openCard(f.key))}
      >
      <!-- Section 1: the diagram and the prose. Opened, the diagram and
           every callout float into a left column and the text runs on
           past them, so nothing leaves a hole. Closed, the wrapper is
           display:contents and the card stacks as before. -->
      <div class="kn-sec kn-flow" class:on={isOpen && phase === 'open'}>
        <div
          class="card-visual"
          class:ruled={t < 0.05}
          role="presentation"
          style="margin:{lerp(0, 16, t)}px; border-radius:{lerp(0, 8, t)}px"
          on:mouseenter={() => (hoverVisual = true)}
          on:mouseleave={() => (hoverVisual = false)}
        >
          <!-- The only instruction an opened diagram needs, gone while it plays.
               The closed card has none: hovering a card is what cards are for. -->
          {#if isOpen && phase === 'open'}
            <span
              class="hover-hint"
              class:gone={playingFor(f.key)}
              class:dead={STATIC_OPEN.has(f.key)}
              title={STATIC_OPEN.has(f.key) ? 'This diagram does not move' : null}
              transition:fade={{ duration: FADE }}
            >hover</span>
          {/if}

          <svelte:component
            this={diagramFor(f.key)}
            {t}
            playing={playingFor(f.key)}
            {...diagramProps(f.key)}
            on:band={e => dispatch('navigateBand', { id: e.detail.id })}
          />

          {#if isOpen && phase === 'open' && CAPTIONS[f.key]}
            <p class="detail-caption" transition:fade={{ duration: FADE }}>
              {#each CAPTIONS[f.key] as c}
                <span class="cap-item">{#if c.swatch}<span class="swatch {c.swatch}"></span>{/if}<Subbed text={c.text} /></span>
              {/each}
            </p>
          {/if}

        </div>

        {#if !isOpen || phase === 'closed'}
          <div class="card-body" transition:fade={{ duration: FADE }}>
            <h3 class="card-title">
              {f.label}{#if f.wip}<span class="wip" title="Unfinished: the prose, the drawing or both. Not a model for a new card.">wip</span>{/if}
            </h3>
            <p class="card-desc">{f.teaser}</p>
            <span class="card-cta" aria-hidden="true">→</span>
          </div>
        {:else if phase === 'open'}
          <div class="detail-text" transition:slide={{ duration: 260, axis: 'y' }}>
            <button class="detail-close" title="Close (Esc)" aria-label="Close"
              on:click|stopPropagation={closeCard}>×</button>
            <h3 class="detail-title">
              {f.label}{#if f.wip}<span class="wip" title="Unfinished: the prose, the drawing or both. Not a model for a new card.">wip</span>{/if}
            </h3>
            {#if RENDERED[f.key]}
              <!-- Authored order throughout: a callout floats to the left
                   column at the point the text reaches it, and squeezed to
                   one column it simply stays where it was written. -->
              {#each RENDERED[f.key].blocks as b, bi (bi)}
                {#if b.kind === 'p'}
                  <p><CiteText segs={b.segs} {refs} /></p>
                {:else}
                  <div
                    class="formula"
                    class:ir={b.tone === 'ir'}
                    class:raman={b.tone === 'raman'}
                    class:wide={b.wide}
                  >
                    <div class="formula-label"><CiteText segs={b.label} {refs} /></div>
                    {#each b.lines as line}<div class="formula-line"><FormulaLine {line} /></div>{/each}
                    {#if b.note.length}<div class="formula-note"><CiteText segs={b.note} {refs} /></div>{/if}
                  </div>
                {/if}
              {/each}
            {:else if f.kind === 'phenomenon'}
              {@const p = phenomenon(f.key)}
              {#if p?.what || p?.spotting}
                {#if p?.what}<p>{p.what}</p>{/if}
                {#if p?.spotting}<p>{p.spotting}</p>{/if}
              {:else}
                <p class="unwritten">
                  Not written yet. The explanation goes here; the examples below are
                  already live.
                </p>
              {/if}
            {/if}
          </div>
        {/if}
      </div>

        {#if isOpen && phase === 'open'}
          <!-- A section of its own for each list the card carries. -->
          {#if f.kind === 'phenomenon'}
            {@const p = phenomenon(f.key)}
            <div class="kn-sec kn-list" transition:fade={{ duration: FADE }}>
              <AtlasExamples
                examples={examplesOf[f.key] ?? []}
                field={p?.field ?? ''}
                ownTag={f.key}
                {refs}
                on:band={e => dispatch('navigateBand', { id: e.detail.id })}
                on:ref={e => dispatch('navigateRef', { key: e.detail.key })}
              />
            </div>
          {:else}
            <!-- The molecules the atlas draws, counted, each a way into its modes. -->
            {#if f.key === 'vibmodes'}
              <div class="kn-sec kn-list" transition:fade={{ duration: FADE }}>
                <ModeCensus {vibrations} on:mode={e => dispatch('navigateMode', e.detail)} />
              </div>
            {/if}

            <!-- A phenomenon this card is the cause of, hosted here rather than
                 on a card of its own (Selection rules: the IR-inactive modes). -->
            {#each hosted(f.key) as h (h.key)}
              <div class="kn-sec kn-list" transition:fade={{ duration: FADE }}>
                <AtlasExamples
                  title="{h.label} in the Atlas"
                  examples={examplesOf[h.key] ?? []}
                  ownTag={h.key}
                  {refs}
                  on:band={e => dispatch('navigateBand', { id: e.detail.id })}
                  on:ref={e => dispatch('navigateRef', { key: e.detail.key })}
                />
              </div>
            {/each}

          {/if}

          <!-- Section 3: where this card leads. Outside the branch above, so
               a phenomenon card carries it too: both kinds declare `related`
               in the same shape. -->
          {@const links = (
            (f.kind === 'phenomenon' ? phenomenon(f.key)?.related : FUNDAMENTALS.find(x => x.key === f.key)?.related) ?? []
          ).filter(r => cardFor(r.key) !== f.key)}
          {#if links.length}
            <div class="kn-sec kn-related" transition:fade={{ duration: FADE }}>
              <h4 class="related-head">Builds on This</h4>
              <div class="related">
                {#each links as r (r.key)}
                  <button class="related-link" on:click|stopPropagation={() => goToCard(r.key)}>
                    <span class="related-name">{cardLabel(r.key)} →</span>
                    <span class="related-why">{r.why}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Section 4, behind a divider: what the superscripts point at. -->
          {#if RENDERED[f.key]?.cited.length}
            <ol class="card-refs" transition:fade={{ duration: FADE }}>
              {#each RENDERED[f.key].cited as c (c.n)}
                <li>
                  <sup class="ref-n">{c.n}</sup>
                  <button
                    class="ref-chip"
                    title={htmlToUnicode(ieeeHtml(refs?.[c.key] ?? {}, c.key))}
                    on:click|stopPropagation={() => dispatch('navigateRef', { key: c.key })}
                  >{shortCite(refs?.[c.key] ?? {}, c.key)}</button>
                  <span class="ref-where">{[c.chapter, summarizeLocators(c.locators)].filter(Boolean).join(', ')}</span>
                </li>
              {/each}
            </ol>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  {/each}

  <!-- The plan, where the cards will go: a site note, not content. -->
  {#if PLANNED.length}
    <h2 class="part" id="planned" data-kn-section="planned">Still to Come</h2>
    <div class="planned">
      <p class="planned-lead">Cards planned but not written yet. Suggestions are welcome.</p>
      <ul>
        {#each PLANNED as p (p.label)}
          <li>
            <span class="planned-name">{p.label}</span>
            <span class="planned-part">{p.part}</span>
            <span class="planned-what">{p.what}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

</main>

<style>
  /* Type roles and colours come from lib/tokens.ts; see the Style guide page. */
  .content {
    padding: 28px 48px 64px;
    max-width: 1200px; /* four cards of --card-w and their gaps fit inside */
    margin: 0 auto;
    box-sizing: border-box;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--ink-700);
  }

  .page-title {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 0 0 14px;
  }

  /* As wide as the row of cards under it. A 760px column left the intro
     looking squeezed against four cards spanning the whole content width. */
  .lead {
    color: var(--ink-slate-700);
    margin: 0 0 var(--space-6);
  }

  /* The three works the page is written out of. A second lead paragraph
     rather than a box: it is provenance for what follows, not a sidebar.
     Same type as the lead, one step quieter in colour. */
  .sources {
    color: var(--ink-500);
    margin-top: calc(var(--space-6) * -0.6);
  }
  .sources .ref-chip { margin: 0 2px 0 4px; }
  .source-for { color: var(--ink-500); }

  .part {
    font-size: var(--t-page-title-size);
    font-weight: var(--t-page-title-weight);
    color: var(--t-page-title-color);
    letter-spacing: var(--t-page-title-ls);
    margin: 40px 0 4px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--line-slate);
  }

  /* ── Basics: cards the size of the home page ones, packed close ──
     Widths come from the script (the card grows to the row while it
     opens), so this is flex rather than a grid of fixed tracks. */
  .cards {
    position: relative; /* the cards' offsetParent, for the glide */
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 12px;
    margin: var(--space-4) 0 0;
  }

  .card {
    position: relative;
    min-height: var(--card-h);
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-content: flex-start;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-xl);
    text-align: left;
    cursor: pointer;
    outline: none;
    transition: box-shadow 0.18s ease, transform 0.15s ease, border-color 0.18s ease;
  }

  .card:not(.open):hover {
    box-shadow: var(--shadow-card);
    transform: translateY(-3px);
    border-color: var(--line-slate-strong);
  }

  .card:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 3px; }

  .card.open { cursor: default; border-color: var(--line-slate-strong); }

  /* ── An opened card: a stack of sections, each of a declared kind ────
     Every section is `.kn-sec` plus one kind. There are three, and a new
     kind is added here rather than by styling a section one-off:

       .kn-flow   the diagram and the prose. The diagram and every callout
                  float into a left column and the text runs past them,
                  taking the full width as soon as the floats end. Nothing
                  is measured and nothing is reordered: a float cannot rise
                  above the line it was written on, so a callout lands where
                  the text calls it, and turning the floats off on a narrow
                  screen puts every box back inline where it was authored.
       .kn-cols   two plain columns, side by side, no wrapping and nothing
                  automatic: what goes left goes left and stays there. For
                  a comparison, where the two halves are peers and the eye
                  is meant to read across rather than down.
       .kn-list   one thing, full width: a list, a table, a census.

     Then .kn-related and the references behind a divider. */
  .card.open {
    display: block;
  }
  .kn-sec { box-sizing: border-box; width: 100%; }

  /* Two columns that stay two columns. No float, no wrap, no measuring. */
  .kn-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 24px;
    align-items: start;
    padding: 4px 28px 8px;
    clear: both;
  }

  /* Closed, the wrapper must not exist as far as layout is concerned: the
     card is still the flex column of diagram and teaser it always was. */
  .kn-flow { display: contents; }
  .kn-flow.on {
    display: block;
    /* Contain the floats, so what follows starts on a clean line. */
    overflow: hidden;
  }

  /* The left column: the diagram, then every callout under it. */
  .kn-flow.on > .card-visual,
  .kn-flow.on .formula {
    float: left;
    clear: left;
    box-sizing: border-box;
    width: min(var(--flow-col, 512px), 48%);
  }
  .kn-flow.on .formula { margin: 0 24px 14px 0; }

  /* The prose is a plain block: its lines wrap around the floats, and it
     takes the whole width again once they end. The closed card's width cap
     would cut every line to a sliver beside the diagram, so it goes. */
  .kn-flow.on > .detail-text {
    max-width: none;
    padding-left: 16px;
  }
  /* A box that is really a table takes the width instead of a column. */
  .kn-flow.on .formula.wide {
    float: none;
    clear: both;
    width: auto;
    margin: 4px 28px 14px;
  }

  .kn-list,
  .kn-related {
    padding: 4px 28px 8px;
    clear: both;
  }
  .kn-related { padding-top: 10px; }

  /* No room for two columns: the floats go and the card reads straight
     down, in the order it was written. */
  /* Floats off, one column. Asked of the content box (see .main-area in
     App.svelte), so it is right at any sidebar state and any shell scale. */
  @container content (max-width: 640px) {
    .kn-flow.on > .card-visual,
    .kn-flow.on .formula {
      float: none;
      width: auto;
      margin-inline: 16px;
    }
    .kn-cols { grid-template-columns: 1fr; }
    .kn-list,
    .kn-cols,
    .kn-related { padding-inline: 16px; }
  }
  /* The diagram takes the place of the home card's icon, bled to the edges
     while closed; opening insets it into a rounded panel (inline styles). */
  .card-visual {
    position: relative;
    flex: 0 0 auto;
    box-sizing: border-box;
    max-width: 100%;
    padding: 10px 12px 6px;
    background: var(--surface-slate);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0);
  }
  .card-visual.ruled { box-shadow: inset 0 -1px 0 var(--line-heading); }

  .hover-hint {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    letter-spacing: var(--t-micro-label-ls);
    text-transform: var(--t-micro-label-tt);
    color: var(--ink-025);
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
  .hover-hint.gone { opacity: 0; }
  /* Nothing to play: say so, rather than inviting a hover that does nothing. */
  .hover-hint.dead {
    color: var(--ink-025);
    opacity: 0.55;
    text-decoration: line-through;
  }
  .hover-hint.dead.gone { opacity: 0.55; }

  .card-body {
    flex: 1 1 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    /* The bottom padding holds the arrow's line: it sits in the corner. */
    padding: 14px 22px 44px;
  }

  /* Says the card is not finished, to a reader and to whoever works on the
     page next. Quiet on purpose: it is a note about the card, not a caveat
     about the chemistry, which is what the red caveat pills are for. */
  .wip {
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-200);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-sm);
    padding: 0 4px;
    margin-left: 7px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 400;
  }

  .card-title {
    font-size: var(--t-card-title-size);
    font-weight: var(--t-card-title-weight);
    color: var(--t-card-title-color);
    margin: 0;
  }

  .card-desc {
    flex: 1;
    margin: 0;
    font-size: var(--t-card-desc-size);
    line-height: var(--t-card-desc-lh);
    color: var(--t-card-desc-color);
  }

  /* Pinned to the corner, so it lines up across cards of equal height. */
  .card-cta {
    position: absolute;
    right: 22px;
    bottom: 16px;
    font-size: var(--t-card-cta-size);
    font-weight: var(--t-card-cta-weight);
    color: var(--accent-green-fg);
  }

  /* ── The same card, opened: the explanation beside the diagram ── */
  .detail-close {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius);
    background: none;
    font: inherit;
    font-size: var(--t-card-title-size);
    color: var(--ink-200);
    cursor: pointer;
  }
  .detail-close:hover { background: var(--surface-hover); color: var(--ink-600); }

  .detail-caption {
    display: flex;
    flex-wrap: wrap;
    column-gap: 14px;
    max-width: 480px;
    margin: 8px 0 0;
    font-size: var(--t-code-size);
    color: var(--ink-300);
    line-height: 1.7;
  }
  .cap-item { white-space: nowrap; }

  .swatch {
    display: inline-block;
    width: 14px;
    height: 0;
    margin: 0 5px 3px 0;
    vertical-align: middle;
    border-top: 2px solid;
  }
  .swatch.photon { border-color: var(--diagram-photon); }
  .swatch.fund { border-color: var(--accent-green-fg); }
  .swatch.heat { border-top-style: dotted; border-color: var(--diagram-heat); }
  .swatch.over { border-top-style: dashed; border-color: var(--ink-025); }
  .swatch.trace { border-color: var(--brand-700); }
  .swatch.laser { border-color: var(--diagram-laser); }
  .swatch.stokes { border-color: var(--diagram-stokes); }
  .swatch.anti { border-color: var(--diagram-anti-stokes); }

  .detail-text {
    flex: 1 1 320px;
    min-width: 0;
    max-width: 680px;
    padding: 22px 48px 22px 12px;
  }

  .detail-title {
    font-size: var(--t-card-title-size);
    font-weight: var(--t-card-title-weight);
    color: var(--t-card-title-color);
    margin: 0 0 10px;
  }

  .detail-text p { margin: 0 0 10px; color: var(--ink-500); }

  /* ── Formula boxes: a rule or an equation, set apart from the prose ── */
  .formula {
    margin: 4px 0 14px;
    padding: 10px 14px 9px;
    background: var(--surface-slate);
    border: 1px solid var(--line-slate);
    border-left: 3px solid var(--ink-slate-400);
    border-radius: var(--radius-md);
  }
  .formula.ir { border-left-color: var(--diagram-photon); }
  .formula.raman { border-left-color: var(--diagram-laser); }

  .formula-label {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--t-micro-label-color);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin-bottom: 4px;
  }
  .formula.ir .formula-label { color: var(--diagram-photon); }
  .formula.raman .formula-label { color: var(--diagram-laser); }

  .formula-line {
    font-family: var(--t-formula-ff);
    font-size: var(--t-formula-size);
    line-height: var(--t-formula-lh);
    color: var(--t-formula-color);
    white-space: pre-wrap;
  }

  .formula-note {
    margin-top: 5px;
    font-size: var(--t-code-size);
    line-height: 1.5;
    color: var(--ink-300);
  }

  /* ── The card's references, under a thin rule ── */
  .card-refs {
    flex: 0 0 calc(100% - 44px);
    box-sizing: border-box;
    list-style: none;
    margin: 4px 22px 20px;
    padding: 12px 0 0;
    border-top: 1px solid var(--line-heading);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .card-refs li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: var(--t-code-size);
    color: var(--ink-300);
    line-height: 1.45;
  }
  .ref-n {
    min-width: 12px;
    font-size: var(--t-code-size);
    color: var(--ref-accent-deep);
  }
  .ref-where { color: var(--ink-300); }
  .card-refs .ref-chip { white-space: nowrap; flex-shrink: 0; }

  .related-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--t-micro-label-color);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 18px 0 8px;
  }

  .related { display: flex; flex-wrap: wrap; gap: 6px; }

  .related-link {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 10px;
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
    background: var(--surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .related-link:hover { border-color: var(--accent-green-fg); background: var(--surface-slate); }

  .related-name {
    font-size: var(--t-card-cta-size);
    font-weight: var(--t-card-cta-weight);
    color: var(--accent-green-fg);
  }
  .related-why { font-size: var(--t-code-size); color: var(--ink-300); }

  /* A part continuing on a new line: only the gap between two rows. */
  .row-break { height: 0; }

  /* The site note of planned cards: dashed, like an unwritten card's text. */
  .planned {
    max-width: 760px;
    margin: 16px 0 40px;
    padding: 12px 16px 6px;
    border: 1px dashed var(--line-slate-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
  }
  .planned-lead { margin: 0 0 8px; color: var(--ink-400); font-size: var(--t-nav-size); }
  .planned ul { list-style: none; margin: 0; padding: 0; }
  .planned li {
    display: grid;
    grid-template-columns: 13em 9em 1fr;
    gap: 10px;
    align-items: baseline;
    padding: 6px 0;
    border-top: 1px solid var(--line-faint);
    font-size: var(--t-nav-size);
  }
  .planned-name { color: var(--ink-slate-900); font-weight: var(--t-label-weight); }
  .planned-part { font-size: var(--t-code-size); color: var(--accent-green-fg); }
  .planned-what { color: var(--ink-400); }

  /* A pattern group's heading: smaller than a part, with its question. */
  .part-lead {
    max-width: 760px;
    color: var(--ink-slate-700);
    margin: 10px 0 0;
  }
  .row-head {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 26px 0 0;
  }
  .row-note {
    margin-left: 10px;
    font-size: var(--t-code-size);
    font-weight: var(--t-body-weight);
    text-transform: none;
    letter-spacing: normal;
    color: var(--ink-050);
  }

  /* An empty explanation says so, rather than looking finished. */
  .unwritten {
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--ink-300) !important;
    font-size: var(--t-nav-size);
  }

  /* `.field-note` and `code` moved to AtlasExamples with the "Recorded as"
     line itself, which now folds away with the rest of the box. */

  .ref-chip {
    font: inherit;
    font-size: var(--t-code-size);
    padding: 1px 7px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ref-border);
    background: var(--ref-surface);
    color: var(--ref-meta);
    cursor: pointer;
  }
  .ref-chip:hover { background: var(--ref-surface-hover); color: var(--ref-accent-deep); }


</style>

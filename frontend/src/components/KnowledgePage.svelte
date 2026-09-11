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
  }

  // Within the band patterns, the simplest cause first.
  const PATTERN_ORDER = ['combination', 'branches', 'fermi', 'degeneracy', 'isotopologue', 'site-sensitivity'];

  export const CARDS: KnCard[] = [
    ...FUNDAMENTALS.map(f => ({
      key: f.key, label: f.label, teaser: f.teaser, section: f.section as string, kind: 'fundamental' as const,
    })),
    ...PHENOMENA.filter(p => p.group)
      .sort((a, b) => PATTERN_ORDER.indexOf(a.key) - PATTERN_ORDER.indexOf(b.key))
      .map(p => ({ key: p.key, label: p.label, teaser: p.teaser, section: p.group as string, kind: 'phenomenon' as const })),
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
  import type { Band, GroupMap, RefMap, Vibrations } from '../lib/types';
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
  import ModeCensus from './knowledge/ModeCensus.svelte';
  import AtlasExamples from './knowledge/AtlasExamples.svelte';
  import CiteText from './knowledge/CiteText.svelte';
  import Subbed from './knowledge/Subbed.svelte';
  import FormulaLine from './knowledge/FormulaLine.svelte';
  import { citer, summarizeLocators, type Cited, type Segment } from '../lib/cite';
  import { isFormula } from '../lib/fundamentals';
  import type { SelectionExample } from './knowledge/SelectionDiagram.svelte';
  import type { SpectrumExample } from './knowledge/SpectrumDiagram.svelte';
  import { CARD_LAYOUT } from '../lib/tokens';
  import { speciesLabel } from '../lib/labels';
  import { ieeeHtml, shortCite } from '../lib/citations';
  import { htmlToUnicode } from '../lib/notation';
  import { titleCase } from '../lib/titleCase';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  /** The molecules and their modes: the Normal modes card lists them. */
  export let vibrations: Vibrations = { molecules: [] };
  /** Open this card on arrival (from a Knowledge link on the References page). */
  export let openOnMount: string | null = null;

  const dispatch = createEventDispatcher<{
    active: { id: string };
    navigateBand: { id: string };
    navigateRef: { key: string };
    navigateMode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  // Each phenomenon's occurrences in the atlas, resolved live.
  $: examplesOf = Object.fromEntries(PHENOMENA.map(p => [p.key, p.find(bands)]));
  const phenomenon = (key: string) => PHENOMENA.find(p => p.key === key);
  /** Phenomena a fundamentals card hosts: their examples are listed there. */
  const hosted = (key: string) => PHENOMENA.filter(p => p.into === key);

  function bandName(b: Band): string {
    return b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;
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
    | typeof NotationDiagram;
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
    | { kind: 'f'; label: Segment[]; lines: string[]; note: Segment[]; tone?: 'ir' | 'raman' };
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
          ? { kind: 'f', label: c.parse(titleCase(b.label)), lines: b.lines, note: b.note ? c.parse(b.note) : [], tone: b.tone }
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
    // A phenomenon without a diagram of its own is one kind of PhenomenonDiagram.
    if (phenomenon(key) && !DIAGRAMS[key]) return { kind: key };
    return {};
  };

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
  $: playingFor = (key: string) =>
    key !== openKey ? hoverCard === key : phase === 'open' && hoverVisual;

  // An opened card keeps its row and pushes the rest of that row down: it
  // takes the row's first place (CSS `order`), the cards it shared the row
  // with follow it, and they wrap below as it widens. Every card that
  // changes place glides there (FLIP on the layout position, which ignores
  // transforms), so neither the swap nor the push is a jump.
  const GLIDE = 300;
  const GLIDE_EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
  $: perRow = Math.max(1, Math.floor((rowWidth + 12) / (CARD_LAYOUT.width + 12)));
  const indexInSection = (key: string | null) => {
    const c = CARDS.find(x => x.key === key);
    return c ? cardsIn(c.section).indexOf(c) : -1;
  };
  $: openIndex = indexInSection(openKey);
  $: openSection = CARDS.find(c => c.key === openKey)?.section;
  $: orderFor = (section: string, i: number) =>
    section === openSection && i === openIndex ? 2 * (i - (i % perRow)) - 1 : 2 * i;

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
   * Every closed card the same size. The width is fixed; the height is the
   * tallest closed card's (a two-line title, a longer teaser), measured once
   * the fonts are in, so a card with less text does not sit shorter than its
   * neighbours. CARD_LAYOUT.height stays the floor.
   */
  let cardH = CARD_LAYOUT.height;
  function equalizeCards() {
    let tallest = CARD_LAYOUT.height;
    for (const c of CARDS) {
      const el = cardEls[c.key];
      if (!el || c.key === openKey) continue;
      const visual = el.querySelector<HTMLElement>('.card-visual');
      const body = el.querySelector<HTMLElement>('.card-body');
      if (!visual || !body) continue;
      // Content plus the 1px border top and bottom, at its exact (fractional)
      // height, so no card ends up a pixel taller than the rest.
      tallest = Math.max(tallest, visual.getBoundingClientRect().height + body.getBoundingClientRect().height + 2);
    }
    cardH = Math.ceil(tallest);
  }

  onMount(() => {
    (document.fonts?.ready ?? Promise.resolve()).then(equalizeCards);
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
    scroller?.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:window on:keydown={onKey} on:click={onPageClick} />

<main class="content" bind:this={root} style="--card-h:{cardH}px">
  <h1 class="page-title">Knowledge</h1>
  <p class="lead">
    Why the bands behave the way they do. First how molecules move and how light and
    matter interact, then the spectroscopy built on it, then the patterns a spectrum
    shows, and last the notation it is all written in: one card each, hover to see it
    happen, click to read it. Each pattern lists the bands in this atlas that show it,
    resolved from the data rather than written down twice, and the papers that
    reported them.
  </p>

  {#each ROWS as sec, ri (sec.key)}
  {#if sec.cont}
    <!-- The same part, on a new line: no heading, just the break. -->
    <div class="row-break" id={sec.key}></div>
  {:else if !sec.sub}
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
    {#each cardsIn(sec.key) as f, i (f.key)}
      {@const t = tFor(f.key)}
      {@const isOpen = f.key === openKey}
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
        style="order:{orderFor(sec.key, i)}; width:{isOpen && rowWidth ? lerp(CARD_LAYOUT.width, rowWidth, t) : CARD_LAYOUT.width}px"
        on:mouseenter={() => (hoverCard = f.key)}
        on:mouseleave={() => (hoverCard = null)}
        on:click={() => openCard(f.key)}
        on:keydown={e => (e.key === 'Enter' || e.key === ' ') && !isOpen && (e.preventDefault(), openCard(f.key))}
      >
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
            <span class="hover-hint" class:gone={playingFor(f.key)} transition:fade={{ duration: FADE }}>hover</span>
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
            <h3 class="card-title">{f.label}</h3>
            <p class="card-desc">{f.teaser}</p>
            <span class="card-cta" aria-hidden="true">→</span>
          </div>
        {:else if phase === 'open'}
          <div class="detail-text" transition:slide={{ duration: 260, axis: 'y' }}>
            <button class="detail-close" title="Close (Esc)" aria-label="Close"
              on:click|stopPropagation={closeCard}>×</button>
            <h3 class="detail-title">{f.label}</h3>
            {#if f.kind === 'phenomenon'}
              {@const p = phenomenon(f.key)}
              {#if RENDERED[f.key]}
                {#each RENDERED[f.key].blocks as b}
                  {#if b.kind === 'p'}
                    <p><CiteText segs={b.segs} {refs} /></p>
                  {:else}
                    <div class="formula" class:ir={b.tone === 'ir'} class:raman={b.tone === 'raman'}>
                      <div class="formula-label"><CiteText segs={b.label} {refs} /></div>
                      {#each b.lines as line}<div class="formula-line"><FormulaLine {line} /></div>{/each}
                      {#if b.note.length}<div class="formula-note"><CiteText segs={b.note} {refs} /></div>{/if}
                    </div>
                  {/if}
                {/each}
              {:else if p?.what || p?.spotting}
                {#if p?.what}<p>{p.what}</p>{/if}
                {#if p?.spotting}<p>{p.spotting}</p>{/if}
              {:else}
                <p class="unwritten">
                  Not written yet. The explanation goes here; the examples below are
                  already live.
                </p>
              {/if}
              <p class="field-note">Recorded as <code>{p?.field}</code></p>
              <AtlasExamples
                examples={examplesOf[f.key] ?? []}
                {groups}
                {refs}
                on:band={e => dispatch('navigateBand', { id: e.detail.id })}
                on:ref={e => dispatch('navigateRef', { key: e.detail.key })}
              />
            {:else}
            {#each RENDERED[f.key].blocks as b}
              {#if b.kind === 'p'}
                <p><CiteText segs={b.segs} {refs} /></p>
              {:else}
                <div class="formula" class:ir={b.tone === 'ir'} class:raman={b.tone === 'raman'}>
                  <div class="formula-label"><CiteText segs={b.label} {refs} /></div>
                  {#each b.lines as line}<div class="formula-line"><FormulaLine {line} /></div>{/each}
                  {#if b.note.length}<div class="formula-note"><CiteText segs={b.note} {refs} /></div>{/if}
                </div>
              {/if}
            {/each}

            <!-- The molecules the atlas draws, counted, each a way into its modes. -->
            {#if f.key === 'vibmodes'}
              <ModeCensus {vibrations} on:mode={e => dispatch('navigateMode', e.detail)} />
            {/if}

            <!-- A phenomenon this card is the cause of, hosted here rather than
                 on a card of its own (Selection rules: the IR-inactive modes). -->
            {#each hosted(f.key) as h (h.key)}
              <AtlasExamples
                title="{h.label} in the Atlas"
                examples={examplesOf[h.key] ?? []}
                {groups}
                {refs}
                on:band={e => dispatch('navigateBand', { id: e.detail.id })}
                on:ref={e => dispatch('navigateRef', { key: e.detail.key })}
              />
            {/each}

            {@const links = (FUNDAMENTALS.find(x => x.key === f.key)?.related ?? []).filter(r => cardFor(r.key) !== f.key)}
            {#if links.length}
              <h4 class="related-head">Builds on This</h4>
              <div class="related">
                {#each links as r (r.key)}
                  <button class="related-link" on:click|stopPropagation={() => goToCard(r.key)}>
                    <span class="related-name">{cardLabel(r.key)} →</span>
                    <span class="related-why">{r.why}</span>
                  </button>
                {/each}
              </div>
            {/if}
            {/if}

          </div>

          <!-- Under a thin rule: what the superscripts point at. -->
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

  .lead {
    max-width: 760px;
    color: var(--ink-slate-700);
    margin: 0 0 var(--space-6);
  }

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

  /* The diagram takes the place of the home card's icon, bled to the edges
     while closed; opening insets it into a rounded panel (inline styles). */
  .card-visual {
    flex: 0 0 auto;
    box-sizing: border-box;
    max-width: 100%;
    padding: 10px 12px 6px;
    background: var(--surface-slate);
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0);
  }
  .card-visual.ruled { box-shadow: inset 0 -1px 0 var(--line-heading); }

  .card-visual { position: relative; }

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

  .card-body {
    flex: 1 1 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    /* The bottom padding holds the arrow's line: it sits in the corner. */
    padding: 14px 22px 44px;
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

  .field-note { font-size: var(--t-code-size); color: var(--ink-200); }

  code {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    background: var(--ref-code-bg);
    color: var(--t-code-color);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }

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

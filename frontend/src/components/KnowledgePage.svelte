<script context="module" lang="ts">
  import { PHENOMENA } from '../lib/phenomena';
  import { FUNDAMENTALS, KNOWLEDGE_SECTIONS } from '../lib/fundamentals';
  import type { Fundamental } from '../lib/fundamentals';

  /** The cards of one section, in their authored order. */
  const cardsIn = (section: string) => FUNDAMENTALS.filter(f => f.section === section);

  export interface KnSection {
    id: string;
    label: string;
    part?: boolean;
  }

  /** Table of contents for the sidebar: each card section, then the phenomena. */
  export const SECTIONS: KnSection[] = [
    ...KNOWLEDGE_SECTIONS.flatMap(sec => [
      { id: sec.key, label: sec.label, part: true },
      ...cardsIn(sec.key).map(f => ({ id: f.key, label: f.label })),
    ]),
    { id: 'phenomena', label: 'Phenomena', part: true },
    ...PHENOMENA.map(p => ({ id: p.key, label: p.label })),
  ];
</script>

<script lang="ts">
  /**
   * Knowledge: what the spectra mean, as opposed to what the atlas holds.
   *
   * Each section is one phenomenon, and each carries its own back-relation:
   * the bands in this dataset that actually show it, resolved live from the
   * link fields, with the papers that reported them. So the explanation can
   * be read forwards (what is a Fermi resonance?) and backwards (which of my
   * bands are one, and who says so?).
   *
   * The prose lives in lib/phenomena.ts and is not written yet. A section
   * with no text says so plainly rather than looking finished; the examples
   * underneath it are real either way.
   *
   * Above the phenomena sit the basics (lib/fundamentals.ts): one card each,
   * the size of a home page card, with a diagram that plays on hover. A click
   * grows the card to the full row, morphs its diagram into the detailed
   * version and opens the full explanation, with links down to the phenomena
   * that build on it.
   */
  import { createEventDispatcher, onMount, onDestroy, afterUpdate } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { tweened } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import type { Band, GroupMap, RefMap } from '../lib/types';
  import VibrationDiagram from './knowledge/VibrationDiagram.svelte';
  import SpectrumDiagram from './knowledge/SpectrumDiagram.svelte';
  import RamanDiagram from './knowledge/RamanDiagram.svelte';
  import SelectionDiagram from './knowledge/SelectionDiagram.svelte';
  import DipoleDiagram from './knowledge/DipoleDiagram.svelte';
  import PolarizabilityDiagram from './knowledge/PolarizabilityDiagram.svelte';
  import InducedDiagram from './knowledge/InducedDiagram.svelte';
  import CiteText from './knowledge/CiteText.svelte';
  import Subbed from './knowledge/Subbed.svelte';
  import { citer, summarizeLocators, type Cited, type Segment } from '../lib/cite';
  import { isFormula } from '../lib/fundamentals';
  import type { SelectionExample } from './knowledge/SelectionDiagram.svelte';
  import type { SpectrumExample } from './knowledge/SpectrumDiagram.svelte';
  import { CARD_LAYOUT } from '../lib/tokens';
  import { citekeysFor } from '../lib/phenomena';
  import { speciesLabel } from '../lib/labels';
  import { ieeeHtml, shortCite } from '../lib/citations';
  import { htmlToUnicode } from '../lib/notation';

  export let bands: Band[];
  export let groups: GroupMap;
  export let refs: RefMap;
  /** Open this card on arrival (from a Knowledge link on the References page). */
  export let openOnMount: string | null = null;

  const dispatch = createEventDispatcher<{
    active: { id: string };
    navigateBand: { id: string };
    navigateRef: { key: string };
  }>();

  $: sections = PHENOMENA.map(p => ({ spec: p, examples: p.find(bands) }));

  function bandName(b: Band): string {
    return b.short || `${speciesLabel(b.species)} ${b.vibration.category}`;
  }

  function groupColor(b: Band): string {
    return groups[b.group]?.color ?? 'var(--ink-400)';
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
    | typeof SelectionDiagram;
  const DIAGRAMS: Record<string, Diagram> = {
    vibration: VibrationDiagram,
    dipole: DipoleDiagram,
    induced: InducedDiagram,
    spectrum: SpectrumDiagram,
    polarizability: PolarizabilityDiagram,
    raman: RamanDiagram,
    selection: SelectionDiagram,
  };

  /* Each card's text, parsed once: paragraphs and formula boxes with their
     citations numbered in reading order, and the list those numbers point at. */
  type Rendered =
    | { kind: 'p'; segs: Segment[] }
    | { kind: 'f'; label: Segment[]; lines: string[]; note: Segment[]; tone?: 'ir' | 'raman' };
  const RENDERED: Record<string, { blocks: Rendered[]; cited: Cited[] }> = Object.fromEntries(
    FUNDAMENTALS.map(f => {
      const c = citer();
      const blocks: Rendered[] = f.body.map(b =>
        isFormula(b)
          ? { kind: 'f', label: c.parse(b.label), lines: b.lines, note: b.note ? c.parse(b.note) : [], tone: b.tone }
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
  $: diagramProps = (key: string) => {
    const f = FUNDAMENTALS.find(x => x.key === key);
    if (key === 'spectrum') return { examples: spectrumExamples(f?.examples) };
    // Gas-phase branches are narrow; a smaller floor keeps P and R apart.
    if (key === 'selection') return { examples: spectrumExamples(f?.examples, 20) };
    return {};
  };

  const phenomenonLabel = (key: string) => PHENOMENA.find(p => p.key === key)?.label ?? key;

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
    const f = FUNDAMENTALS.find(x => x.key === key);
    return f ? cardsIn(f.section).indexOf(f) : -1;
  };
  $: openIndex = indexInSection(openKey);
  $: openSection = FUNDAMENTALS.find(f => f.key === openKey)?.section;
  $: orderFor = (section: string, i: number) =>
    section === openSection && i === openIndex ? 2 * (i - (i % perRow)) - 1 : 2 * i;

  const cardEls: Record<string, HTMLElement> = {};
  const lastPos = new Map<string, { x: number; y: number }>();

  afterUpdate(() => {
    for (const f of FUNDAMENTALS) {
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

  function goToPhenomenon(key: string) {
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  onMount(() => {
    if (openOnMount && FUNDAMENTALS.some(f => f.key === openOnMount)) {
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

<main class="content" bind:this={root}>
  <h1 class="page-title">Knowledge</h1>
  <p class="lead">
    Why the bands behave the way they do. The basics come first, then the spectroscopy
    built on them, one card each: hover to see it happen, click to read it. Each
    phenomenon below them lists the bands in this atlas that show it, resolved from the
    data rather than written down twice, and the papers that reported them.
  </p>

  {#each KNOWLEDGE_SECTIONS as sec (sec.key)}
  <h2 class="part" id={sec.key} data-kn-section={sec.key}>{sec.label}</h2>

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
            this={DIAGRAMS[f.key]}
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
            {#each RENDERED[f.key].blocks as b}
              {#if b.kind === 'p'}
                <p><CiteText segs={b.segs} {refs} /></p>
              {:else}
                <div class="formula" class:ir={b.tone === 'ir'} class:raman={b.tone === 'raman'}>
                  <div class="formula-label"><CiteText segs={b.label} {refs} /></div>
                  {#each b.lines as line}<div class="formula-line"><Subbed text={line} /></div>{/each}
                  {#if b.note.length}<div class="formula-note"><CiteText segs={b.note} {refs} /></div>{/if}
                </div>
              {/if}
            {/each}

            <h4 class="related-head">Builds on this</h4>
            <div class="related">
              {#each f.related as r (r.key)}
                <button class="related-link" on:click|stopPropagation={() => goToPhenomenon(r.key)}>
                  <span class="related-name">{phenomenonLabel(r.key)} ↓</span>
                  <span class="related-why">{r.why}</span>
                </button>
              {/each}
            </div>

          </div>

          <!-- Under a thin rule: what the superscripts point at. -->
          {#if RENDERED[f.key].cited.length}
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

  <h2 class="part" id="phenomena" data-kn-section="phenomena">Phenomena</h2>

  {#each sections as { spec, examples } (spec.key)}
    <section class="section" id={spec.key} data-kn-section={spec.key}>
      <h3>{spec.label}</h3>

      <div class="spread">
        <div class="spread-text">
          {#if spec.what || spec.spotting}
            {#if spec.what}<p>{spec.what}</p>{/if}
            {#if spec.spotting}<p>{spec.spotting}</p>{/if}
          {:else}
            <p class="unwritten">
              Not written yet. The explanation and its diagram go here; the examples
              beside it are already live.
            </p>
          {/if}
          <p class="field-note">Recorded as <code>{spec.field}</code></p>
        </div>

        <div class="spread-visual">
          {#if examples.length === 0}
            <p class="empty">No band in the atlas currently shows this.</p>
          {:else}
            {#each examples as ex (ex.label)}
              <article class="example">
                <header>
                  <span class="ex-label">{ex.label}</span>
                  <span class="ex-count">{ex.bands.length} band{ex.bands.length === 1 ? '' : 's'}</span>
                </header>
                {#if ex.note}<p class="ex-note">{ex.note}</p>{/if}

                <div class="band-rows">
                  {#each ex.bands as b (b.id)}
                    <button class="band-row" on:click={() => dispatch('navigateBand', { id: b.id })}>
                      <span class="dot" style="background:{groupColor(b)}"></span>
                      <span class="band-name">{bandName(b)}</span>
                      <span class="band-wn">{b.wn_min}–{b.wn_max} cm⁻¹</span>
                    </button>
                  {/each}
                </div>

                {#if refs}
                  {@const keys = citekeysFor(ex.bands)}
                  {#if keys.length}
                    <div class="ex-refs">
                      {#each keys as key (key)}
                        <button
                          class="ref-chip"
                          title={htmlToUnicode(ieeeHtml(refs[key] ?? {}, key))}
                          on:click={() => dispatch('navigateRef', { key })}
                        >{shortCite(refs[key] ?? {}, key, { journal: false })}</button>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </article>
            {/each}
          {/if}
        </div>
      </div>
    </section>
  {/each}
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
    padding: 14px 22px 18px;
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

  .card-cta {
    align-self: flex-end;
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

  .section { margin: var(--space-6) 0 48px; }

  .section h3 {
    font-size: var(--t-section-head-size);
    font-weight: var(--t-section-head-weight);
    text-transform: var(--t-section-head-tt);
    letter-spacing: var(--t-section-head-ls);
    color: var(--t-section-head-color);
    margin: 0 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line-heading);
  }

  .spread {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  .spread-text p { margin: 0 0 10px; color: var(--ink-500); }
  .spread-visual { min-width: 0; }

  /* An empty explanation says so, rather than looking finished. */
  .unwritten {
    padding: 10px 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-sunken);
    color: var(--ink-300) !important;
    font-size: 13px;
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

  .empty { color: var(--ink-300); font-size: 13.5px; }

  /* ── One occurrence ── */
  .example {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-left: 3px solid var(--accent-green-fg);
    border-radius: var(--radius);
    padding: 10px var(--space-4);
    margin-bottom: 10px;
  }

  .example header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }

  .ex-label { font-weight: 700; color: var(--ink-slate-900); font-size: 13.5px; }

  .ex-count {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-200);
  }

  .ex-note { margin: 0 0 6px; color: var(--ink-400); font-size: 13px; line-height: 1.45; }

  .band-rows { display: flex; flex-direction: column; gap: 2px; }

  .band-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 3px 4px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: 13px;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .band-row:hover { background: var(--surface-hover); }

  .dot {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .band-name { color: var(--ink-700); }

  .band-wn {
    margin-left: auto;
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-300);
    white-space: nowrap;
  }

  .ex-refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid var(--line-faint);
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

  @media (max-width: 1000px) {
    .spread { grid-template-columns: 1fr; gap: var(--space-4); }
  }
</style>

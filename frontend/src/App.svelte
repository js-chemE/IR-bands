<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dataset, ColorDim, AxisProperty, RefMap, Vibrations, Spectroscopy } from './lib/types';
  import { AXES, DEFAULT_LASER_WN } from './lib/units';
  import { getLegendCategories, getLegendTags, isCalculatedOnly, isReferenced } from './lib/chart';
  import { installLookups } from './lib/labels';
  import { widthClass, PRESENTATION, type WidthClass } from './lib/tokens';
  import {
    GROUP_DIMS,
    ALL_TECHNIQUES,
    IR_TECHNIQUES,
    RAMAN_TECHNIQUES,
    TECHNIQUE_LABEL,
    type GroupDim,
  } from './lib/refGrouping';
  import BandChart from './components/BandChart.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ColorLegend from './components/ColorLegend.svelte';
  import TagLegend from './components/TagLegend.svelte';
  import AxisSelect from './components/AxisSelect.svelte';
  import SpectroscopySwitch from './components/SpectroscopySwitch.svelte';
  import LookPill from './components/LookPill.svelte';
  import Dropdown from './components/Dropdown.svelte';
  import ReferencesPage, { type RefCounts } from './components/ReferencesPage.svelte';
  import HomePage from './components/HomePage.svelte';
  import ImpressumPage from './components/ImpressumPage.svelte';
  import StyleGuidePage, { SECTIONS as SG_SECTIONS } from './components/StyleGuidePage.svelte';
  import SourceGuidePage, { SECTIONS as SRC_SECTIONS } from './components/SourceGuidePage.svelte';
  import DataModelPage, { sectionsFor, type DmView } from './components/DataModelPage.svelte';
  import KnowledgePage, { SECTIONS as KN_SECTIONS } from './components/KnowledgePage.svelte';
  import ChartTooNarrow from './components/ChartTooNarrow.svelte';

  let dataset: Dataset | null = null;
  let refs: RefMap = null;
  let vibrations: Vibrations = { molecules: [] };
  let tagTips: Record<string, { tip: string }> = {};
  let loading = true;
  let error: string | null = null;
  // Four destinations plus the meta pages. There is no 'vibration' page any
  // more: a molecule's modes are part of what the dataset holds, so that view
  // lives inside the Dataset page's Contents half, and the band chart's
  // tooltip jumps there instead.
  // 'styleguide' and 'sourceguide' have no nav entry of their own; both are
  // reached from the Impressum, where the project's own documentation lives.
  type Page = 'home' | 'knowledge' | 'chart' | 'references' | 'datamodel'
            | 'impressum' | 'styleguide' | 'sourceguide';
  let page: Page = 'home';
  // References page: the two grouping dimensions, outer then inner. Every
  // pair is legal except the same dimension twice, which the guard below
  // resolves by moving the inner one along.
  let refGroupBy: GroupDim = 'reference';
  // What lists its citations on the References page: bands, modes, Knowledge.
  let refIncludeBands = true;
  let refIncludeModes = false;
  let refIncludeKnowledge = true;
  // Which techniques the References page shows. A Set of every value means
  // "no filter", which is what `refTechniqueFilter` below turns it into, so
  // the page never pays for a filter nobody asked for.
  let refTechniques = new Set<string>(ALL_TECHNIQUES);
  let refTechniquesOpen = false;
  // Reported by the References page whenever it rebuilds, so the sidebar can
  // say how much of each kind the current filters actually leave on screen.
  let refCounts: RefCounts | null = null;
  $: refTechniqueFilter =
    refTechniques.size === ALL_TECHNIQUES.length ? null : refTechniques;
  /** How many of the seven infrared geometries are on: all, none or some. */
  $: irOn = IR_TECHNIQUES.filter(t => refTechniques.has(t)).length;
  // Raman is a family too now that spontaneous Raman is a value of its own.
  $: ramanOn = RAMAN_TECHNIQUES.filter(t => refTechniques.has(t)).length;
  function toggleTechnique(key: string) {
    const next = new Set(refTechniques);
    if (next.has(key)) next.delete(key); else next.add(key);
    refTechniques = next;
  }
  /** The IR parent switch: all seven off if any are on, else all seven on. */
  function toggleIr() {
    const next = new Set(refTechniques);
    if (irOn > 0) for (const t of IR_TECHNIQUES) next.delete(t);
    else for (const t of IR_TECHNIQUES) next.add(t);
    refTechniques = next;
  }
  /** The Raman parent switch, the same contract as the IR one above. */
  function toggleRaman() {
    const next = new Set(refTechniques);
    if (ramanOn > 0) for (const t of RAMAN_TECHNIQUES) next.delete(t);
    else for (const t of RAMAN_TECHNIQUES) next.add(t);
    refTechniques = next;
  }
  // A Knowledge card to open when arriving from a References-page link.
  let knOpen: string | null = null;
  $: if (page !== 'knowledge') knOpen = null;
  let refThenBy: GroupDim = 'group';
  $: if (refThenBy === refGroupBy) {
    refThenBy = GROUP_DIMS.find(d => d.key !== refGroupBy)!.key;
  }
  // Style guide table of contents: which section the reader is currently in,
  // reported by the page's own scroll spy.
  let sgActive = SG_SECTIONS[0].id;
  let srcActive = SRC_SECTIONS[0].id;
  // Same contract for the two long-form pages that own a table of contents.
  let dmView: DmView = 'structure';
  let dmActive = sectionsFor('structure')[0].id;
  let knActive = KN_SECTIONS[0].id;
  /** Which Knowledge card is open, which is not the same as where the page
      is scrolled to: the sidebar marks the two separately. */
  let knOpenKey: string | null = null;
  $: dmSections = sectionsFor(dmView);

  // Shared by the long-form pages that own a sidebar table of contents.
  // The Knowledge page opens a card when its contents entry is a card.
  let knPage: KnowledgePage | null = null;

  function scrollToSection(id: string, which: 'sg' | 'dm' | 'kn' | 'src' = 'sg') {
    if (which === 'kn' && knPage) knPage.goTo(id);
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (which === 'dm') dmActive = id;
    else if (which === 'kn') knActive = id;
    else if (which === 'src') srcActive = id;
    else sgActive = id;
  }


  function setDmView(next: DmView) {
    dmView = next;
    dmActive = sectionsFor(next)[0].id;
    mainArea?.scrollTo({ top: 0 });
  }
  // Every page shares one scroll container, so opening a long page from
  // halfway down another one would start halfway down it. Reset on switch.
  let mainArea: HTMLElement | null = null;
  $: if (page) { mainArea?.scrollTo({ top: 0 }); drawerOpen = false; }

  /* ── How much room the shell has ──
     Measured off the shell itself rather than asked of the viewport, and
     stamped on <html> so every component can style off one attribute. The
     reasoning, and the thresholds, are in WIDTH_CLASSES (lib/tokens.ts).

     The scroll model does not change with the width: the header stays put and
     .main-area keeps scrolling internally at every size, because four pages
     hang their sidebar scroll spy off that element. `dvh` rather than `vh` so
     a phone's collapsing URL bar does not cut the last line off. */
  let appRoot: HTMLElement | null = null;
  let wClass: WidthClass = 'wide';
  $: narrow = wClass !== 'wide';

  onMount(() => {
    const measure = (px: number) => { wClass = widthClass(px); };
    measure(appRoot?.clientWidth || window.innerWidth);
    if (!appRoot) return;
    const ro = new ResizeObserver(e => measure(Math.floor(e[0].contentRect.width)));
    ro.observe(appRoot);
    return () => ro.disconnect();
  });

  $: if (typeof document !== 'undefined') {
    document.documentElement.dataset.w = wClass;
    // `data-narrow` is the common case (anything that is not the full desktop
    // layout), so a rule does not have to list two values of data-w.
    if (narrow) document.documentElement.dataset.narrow = '';
    else delete document.documentElement.dataset.narrow;
  }

  /* ── Presentation mode ──
     The atlas on a screen at the front of a room: one CSS zoom on the shell,
     plus the short list of subtractions in PRESENTATION (tokens.ts), which is
     also what the style guide renders. Three doors lead to the same state, so
     a lecture-hall machine can be sent straight into it and a presenter who
     has forgotten how they got there can still leave:

       · Shift+P, unless a field has the keyboard
       · ?present=1 in the URL, or ?present=1.75 to name the scale
       · the Present button in the header, which fades in on hover

     The URL and localStorage are both kept in step, so a reload lands back
     where the presenter was. */
  let presenting = false;
  let presentScale: number = PRESENTATION.defaultScale;
  const SCALE_KEY = 'bandatlas.presentation';
  /** Restored on leaving: the mode collapses the sidebar, it does not own it. */
  let sidebarBeforePresenting = true;
  let presentToast = false;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function nearestScale(v: number): number {
    return PRESENTATION.scales.reduce(
      (best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best),
      PRESENTATION.scales[0] as number,
    );
  }

  function enterPresenting(scale = presentScale) {
    if (!presenting) sidebarBeforePresenting = sidebarOpen;
    presenting = true;
    presentScale = nearestScale(scale);
    sidebarOpen = false;
    showToast();
  }

  function leavePresenting() {
    presenting = false;
    sidebarOpen = sidebarBeforePresenting;
  }

  function stepScale(dir: 1 | -1) {
    const i = (PRESENTATION.scales as readonly number[]).indexOf(presentScale);
    const next = Math.min(PRESENTATION.scales.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir));
    presentScale = PRESENTATION.scales[next];
  }

  function showToast() {
    presentToast = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (presentToast = false), 4200);
  }

  /* Reactive statements run before onMount, so the block that writes the mode
     back to the URL would wipe a ?present= before anything had read it. This
     flag holds it until the restore below has had its turn. */
  let modeReady = false;

  onMount(() => {
    // The URL wins over the remembered state: a bookmarked ?present=1 is a
    // deliberate instruction, and a stale localStorage flag should never be
    // able to surprise someone opening the atlas at a desk.
    const q = new URLSearchParams(window.location.search).get('present');
    if (q !== null) {
      const asked = parseFloat(q);
      enterPresenting(Number.isFinite(asked) && asked > 1 ? asked : PRESENTATION.defaultScale);
      modeReady = true;
      return;
    }
    try {
      const saved = localStorage.getItem(SCALE_KEY);
      if (saved) enterPresenting(parseFloat(saved));
    } catch { /* private mode: no memory, no harm */ }
    modeReady = true;
  });

  $: if (modeReady && typeof window !== 'undefined') {
    try {
      if (presenting) localStorage.setItem(SCALE_KEY, String(presentScale));
      else localStorage.removeItem(SCALE_KEY);
    } catch { /* ignore */ }
    const url = new URL(window.location.href);
    if (presenting) url.searchParams.set('present', String(presentScale));
    else url.searchParams.delete('present');
    if (url.href !== window.location.href) history.replaceState(null, '', url);
  }

  // The scale reaches CSS as one custom property. lib/zoom.ts reads the same
  // one wherever `currentCSSZoom` is missing, so the two cannot disagree.
  $: if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--display-scale', presenting ? String(presentScale) : '1');
    if (presenting) document.documentElement.dataset.presenting = '';
    else delete document.documentElement.dataset.presenting;
  }

  /* Narrow shells get the sidebar as an overlay drawer rather than a rail.
     `sidebarOpen` below stays the wide layout's collapse and the two never
     interact: leaving a narrow window does not collapse the desktop rail. */
  let drawerOpen = false;
  /* The band chart is withheld on a narrow shell (see ChartTooNarrow). A
     reader who asks for it anyway keeps it for the session.

     Presentation mode is the exception, and it has to be: magnifying the shell
     narrows it in its own pixels, so a presenter at 1.75x on a 1920px
     projector measures as `mid` and would have the chart taken away at exactly
     the moment they meant to show it. The reason for withholding it was never
     the number: it was a phone-sized touch screen a reader cannot pan a
     1100px canvas on. Someone who has deliberately turned the magnification up
     has a big screen and a mouse, and can turn it back down. */
  let chartAnyway = false;
  $: chartWithheld = narrow && !presenting && !chartAnyway;

  function onShellKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && drawerOpen) { drawerOpen = false; return; }

    // Never steal a key from something being typed into.
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.isContentEditable
      || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'P' || e.key === 'p') {
      if (!e.shiftKey) return;
      e.preventDefault();
      presenting ? leavePresenting() : enterPresenting();
    } else if (presenting && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      stepScale(1);
    } else if (presenting && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      stepScale(-1);
    } else if (presenting && e.key === 'Escape') {
      leavePresenting();
    }
  }

  let sidebarOpen = true;
  let showColorMenu = false;
  let colorMenuTimer: ReturnType<typeof setTimeout> | null = null;

  function openColorMenu()  {
    if (colorMenuTimer) { clearTimeout(colorMenuTimer); colorMenuTimer = null; }
    showColorMenu = true;
  }
  function closeColorMenu() {
    colorMenuTimer = setTimeout(() => { showColorMenu = false; }, 180);
  }

  // Which set the chart opens on. A set is authored in bands.jsonc; this
  // names the one that answers the question the atlas is about.
  const DEFAULT_SET = 'co2_hydrogenation';

  let enabledGroups: ReadonlySet<string> = new Set();
  let colorDim: ColorDim = 'group';
  /* The Color by looks, collapsed like the group list below. */
  let showLooks = false;
  let hiddenCats: ReadonlySet<string> = new Set();
  let hiddenTags: ReadonlySet<string> = new Set();
  let tagIsolate: string | null = null;
  let legendHoveredCat: string | null = null;
  let legendHoveredTag: string | null = null;
  let axisProperty: AxisProperty = 'wavenumber';
  let axisUnit = AXES.wavenumber.defaultUnit;

  onMount(async () => {
    try {
      const [bRes, rRes, vRes, tRes] = await Promise.all([
        fetch('data/bands.json'),
        fetch('data/references.json'),
        fetch('data/vibrations.json'),
        fetch('data/tags.json'),
      ]);
      if (!bRes.ok) throw new Error(`bands.json: ${bRes.status}`);
      if (!rRes.ok) throw new Error(`references.json: ${rRes.status}`);
      dataset = (await bRes.json()) as Dataset;
      // Species and surface keys resolve to labels through this; install it
      // before any component renders one.
      installLookups(dataset);
      refs = (await rRes.json()) as RefMap;
      // Vibrations/tag-tooltip content is supplementary — don't fail the
      // whole app if either is missing (e.g. build.py predates the feature).
      vibrations = vRes.ok ? ((await vRes.json()) as Vibrations) : { molecules: [] };
      tagTips = tRes.ok ? ((await tRes.json()) as Record<string, { tip: string }>) : {};
      const startSet = dataset.sets?.[DEFAULT_SET];
      enabledGroups = new Set(startSet ? startSet.groups : Object.keys(dataset.groups));
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  });

  function handleGroupToggle(e: CustomEvent<{ key: string; enabled: boolean }>) {
    const next = new Set(enabledGroups);
    if (e.detail.enabled) next.add(e.detail.key); else next.delete(e.detail.key);
    enabledGroups = next;
  }

  function handleSetSelect(e: CustomEvent<{ key: string }>) {
    if (!dataset) return;
    // "custom" is only ever shown, never chosen: it means the selection
    // matches no set, so picking it should leave things alone.
    if (e.detail.key === 'custom') return;
    const chosen = dataset.sets?.[e.detail.key];
    enabledGroups = new Set(chosen ? chosen.groups : Object.keys(dataset.groups));
  }

  function setColorDim(dim: ColorDim) {
    colorDim = dim;
    hiddenCats = new Set();
  }

  // The sidebar's dropdowns hand back plain strings; these narrow them.
  const pickColorDim = (v: string) => setColorDim(v as ColorDim);
  const pickDmView = (v: string) => setDmView(v as DmView);
  const asGroupDim = (v: string) => v as GroupDim;


  function handleCatToggle(e: CustomEvent<{ cat: string; visible: boolean }>) {
    const next = new Set(hiddenCats);
    if (!e.detail.visible) next.add(e.detail.cat); else next.delete(e.detail.cat);
    hiddenCats = next;
  }

  function handleCatDblClick(e: CustomEvent<{ cat: string }>) {
    // Checked directly against current hiddenCats rather than trusting a
    // "was it visible" flag carried on the event — same fix as the tag
    // legend's debounce, just inspecting live state instead since
    // categories are single-valued and don't need a separate isolate var.
    const allKeys = legendCats.map(c => c.key);
    const isolatedToThis = hiddenCats.size === allKeys.length - 1 && !hiddenCats.has(e.detail.cat);
    hiddenCats = isolatedToThis ? new Set() : new Set(allKeys.filter(k => k !== e.detail.cat));
  }

  function handleCatHover(e: CustomEvent<{ cat: string | null }>) {
    legendHoveredCat = e.detail.cat;
  }

  function handleTagToggle(e: CustomEvent<{ tag: string; visible: boolean }>) {
    // A single click always exits isolate mode first and applies the
    // toggle from a clean (all-visible) slate, rather than against
    // whatever hiddenTags isolate left behind — guarantees the individual
    // toggle is never left stuck in an inconsistent state.
    if (tagIsolate) {
      tagIsolate = null;
      hiddenTags = new Set([e.detail.tag]);
      return;
    }
    const next = new Set(hiddenTags);
    if (!e.detail.visible) next.add(e.detail.tag); else next.delete(e.detail.tag);
    hiddenTags = next;
  }

  // Isolate: show ONLY bands carrying this one tag. Unlike the category
  // legend (handleCatDblClick), a band can carry several tags at once, so
  // "hide every tag except this one" doesn't work here — combined with the
  // hide-if-ANY-hidden-tag rule the chart otherwise uses, that would also
  // hide this tag's own bands whenever they carry a second tag too (often
  // all of them). tagIsolate is a separate filter the chart applies
  // instead of hiddenTags entirely while it's set — see chart.ts.
  function handleTagDblClick(e: CustomEvent<{ tag: string }>) {
    tagIsolate = tagIsolate === e.detail.tag ? null : e.detail.tag;
    hiddenTags = new Set();
  }

  function handleTagHover(e: CustomEvent<{ tag: string | null }>) {
    legendHoveredTag = e.detail.tag;
  }

  function handleAxisChange(e: CustomEvent<{ property: AxisProperty; unit: string }>) {
    // A new quantity opens the way it is usually drawn: wavenumber reversed.
    if (e.detail.property !== axisProperty) axisReversed = AXES[e.detail.property].reversed;
    axisProperty = e.detail.property;
    axisUnit = e.detail.unit;
  }
  let axisReversed = AXES.wavenumber.reversed;

  // IR or Raman: which technique's silent bands the chart fades.
  let spectroscopy: Spectroscopy = 'ir';

  // The shift: any x axis read from a zero (a laser, say) instead of from
  // nothing. The zero is an absolute wavenumber in cm⁻¹, or null while none
  // is entered (then 532 nm is assumed).
  let shiftOn = false;
  let laserWn: number | null = null;
  $: shiftZero = shiftOn ? (laserWn ?? DEFAULT_LASER_WN) : null;

  function handleHomeNavigate(e: CustomEvent<{ page: string }>) {
    page = e.detail.page as Page;
  }

  function handleNavigateKnowledge(e: CustomEvent<{ key: string }>) {
    knOpen = e.detail.key;
    page = 'knowledge';
  }

  function handleNavigateRef(e: CustomEvent<{ key: string }>) {
    const key = e.detail.key;
    // A paper no band cites (a textbook the Knowledge page draws on) only has
    // a card of its own while Knowledge citations are shown.
    if (!dataset?.bands.some(b => b.references.some(r => r.key === key))) refIncludeKnowledge = true;
    // The jump target only exists while a reference is one of the dimensions.
    if (refGroupBy !== 'reference' && refThenBy !== 'reference') refGroupBy = 'reference';
    page = 'references';
    // Wait for the page to mount before scrolling
    setTimeout(() => {
      const el = document.getElementById(`refcard-${key}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.style.transition = 'box-shadow 0.25s ease-out, background-color 0.25s ease-out';
      el.style.boxShadow = '0 0 0 3px var(--ref-focus-ring)';
      el.style.backgroundColor = 'var(--ref-highlight)';
      setTimeout(() => {
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
        setTimeout(() => { el.style.transition = ''; }, 300);
      }, 1600);
    }, 80);
  }

  let focusBand: { id: string; nonce: number } | null = null;
  let focusNonce = 0;

  function handleNavigateBand(e: CustomEvent<{ id: string }>) {
    if (!dataset) return;
    const band = dataset.bands.find(b => b.id === e.detail.id);
    if (!band) return;
    setColorDim('vibration');
    // Make sure the band's own group is actually enabled — otherwise it
    // would be selected but invisible if the user had toggled that group
    // off via the sidebar at some point.
    enabledGroups = new Set(enabledGroups).add(band.group);
    page = 'chart';
    focusNonce += 1;
    focusBand = { id: band.id, nonce: focusNonce };
  }

  // Reverse direction: clicking a linked vibration's atoms tag in the band
  // chart's own tooltip jumps to the Vibration modes page with that exact
  // molecule/topology/mode selected and its detail panel already open.
  let focusMode: { moleculeId: string; topologyId: string; modeId: string; nonce: number } | null = null;
  let focusModeNonce = 0;

  function handleNavigateMode(e: CustomEvent<{ moleculeId: string; topologyId: string; modeId: string }>) {
    // The modes live in the Dataset page's Contents half now.
    page = 'datamodel';
    dmView = 'contents';
    dmActive = 'modes';
    focusModeNonce += 1;
    focusMode = { ...e.detail, nonce: focusModeNonce };
  }

  const COLOR_DIM_OPTIONS: { dim: ColorDim; label: string }[] = [
    { dim: 'group',      label: 'Group' },
    // "Mode", not "Vibration": the category now includes `rotational` and
    // `electronic`, neither of which is a vibration.
    { dim: 'vibration',  label: 'Mode' },
    { dim: 'atoms',      label: 'Atoms' },
    { dim: 'technique',  label: 'Evidence' },
  ];

  $: legendCats = dataset
    ? getLegendCategories(chartBands, dataset.groups, enabledGroups, colorDim)
    : [];

  // Isotopologue bands are in or out of the chart entirely, rather than
  // hidden where they stand: with them out, the lanes and the sub-lane
  // stagger are recomputed without them. That is the difference from the
  // legend's own isotope chip, which only hides the bars.
  //
  // Off by default. A labelled twin is a control experiment rather than a
  // band anyone is trying to identify, and switching them all on doubles the
  // crowding in whichever region a deuteration study covered.
  let showIsotopes = false;

  // The bands the chosen spectroscopy cannot see: in the chart, hollow, by
  // default; switched off they leave it the way the isotopologues do.
  let showInactive = true;
  // Bands none of whose claims stands in the chosen spectroscopy (greyed-out
  // references only): in the chart, faded, by default; off, they leave it.
  let showUnreferenced = true;
  // Whether those two kinds are drawn in their own look (hollow, faded) or
  // like any other band: the Color by pills. A look, not a filter.
  let lookInactive = true;
  let lookUnreferenced = true;
  // Bands resting on a calculation alone: faded by default too, from a
  // switch of their own, so "only hard measured proof" is askable.
  let lookCalculated = true;
  let showCalculated = true;
  $: techniqueLabel = spectroscopy === 'raman' ? 'Raman' : 'IR';
  $: inactiveTag = spectroscopy === 'raman' ? 'raman-inactive' : 'ir-inactive';
  // The other technique's tag is not shown, so an isolate on it would leave
  // an empty chart with no chip to undo it from.
  $: if (tagIsolate === (spectroscopy === 'raman' ? 'ir-inactive' : 'raman-inactive')) tagIsolate = null;

  // A set can also restrict phases (the gas-only one drops the adsorbed
  // bands of CO₂ and methanol). It applies while the selection is exactly
  // that set, the same match the filter uses to show the set as chosen.
  $: activePhases = (() => {
    if (!dataset?.sets) return null;
    for (const s of Object.values(dataset.sets)) {
      if (!s.phases?.length) continue;
      if (s.groups.length === enabledGroups.size && s.groups.every(g => enabledGroups.has(g))) return s.phases;
    }
    return null;
  })();
  $: chartBands = dataset
    ? (showIsotopes ? dataset.bands : dataset.bands.filter(b => !b.isotopologue_of))
        .filter(b => !activePhases || !b.phase || activePhases.includes(b.phase))
        .filter(b => showInactive || !b.tags.includes(inactiveTag))
        // The two switches compose. Switching computational off stops a
        // calculation counting as evidence, so a band whose only standing
        // claim was one becomes unreferenced and the switch below takes it
        // out. Without that a band could sit there with every claim greyed:
        // its infrared claims silent in the Raman view, its calculation
        // dimmed, and nothing left to justify drawing it.
        .filter(b => showUnreferenced || isReferenced(b, spectroscopy, !showCalculated))
        .filter(b => showCalculated || !isCalculatedOnly(b))
    : [];

  // Passed the live filters so a tag whose bands are all hidden by another
  // filter greys out too, rather than looking available when it is not.
  $: legendTags = dataset
    ? getLegendTags(chartBands, enabledGroups, { hiddenCats, colorDim, hiddenTags, tagIsolate, spectroscopy })
    : [];

  $: sortedGroupKeys = (() => {
    if (!dataset) return [];
    const minLane = new Map<string, number>();
    for (const b of dataset.bands) {
      const cur = minLane.get(b.group) ?? Infinity;
      if (b.lane < cur) minLane.set(b.group, b.lane);
    }
    return Object.keys(dataset.groups).sort(
      (a, b) => (minLane.get(a) ?? Infinity) - (minLane.get(b) ?? Infinity),
    );
  })();
</script>

<svelte:window on:keydown={onShellKeydown} />

<div class="app-root" bind:this={appRoot}>
<!-- ── Page header ── -->
<header class="app-header">
  <div class="header-left">
    {#if narrow}
      <button
        class="drawer-btn"
        on:click={() => (drawerOpen = !drawerOpen)}
        aria-expanded={drawerOpen}
        aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
      >{drawerOpen ? '✕' : '☰'}</button>
    {/if}
    <button class="header-title-btn" on:click={() => page = 'home'}>Spectral Band Atlas</button>
    <!-- The framing, not the scope: what the atlas currently covers is stated
         on the home page, where it can be widened without touching the chrome. -->
    <span class="header-subtitle">Vibrational spectroscopy</span>
  </div>
  <!-- Hidden until the header is hovered, and plainly visible once the mode is
       on: nobody should have to remember Shift+P to get back out of it. -->
  <div class="present-ctl" class:on={presenting}>
    {#if presenting}
      <button class="pc-btn" on:click={() => stepScale(-1)}
        disabled={presentScale === PRESENTATION.scales[0]} title="Smaller (−)">−</button>
      <span class="pc-scale">{Math.round(presentScale * 100)}%</span>
      <button class="pc-btn" on:click={() => stepScale(1)}
        disabled={presentScale === PRESENTATION.scales[PRESENTATION.scales.length - 1]}
        title="Bigger (+)">+</button>
      <button class="pc-btn pc-exit" on:click={leavePresenting} title="Leave presentation mode (Shift+P)">Exit</button>
    {:else}
      <button class="pc-btn pc-enter" on:click={() => enterPresenting()}
        title="Presentation mode (Shift+P)">Present</button>
    {/if}
  </div>

  <div class="header-right">
    <div class="header-authors">Julius Sommer<sup>1</sup>, Evgeny Pidko<sup>1</sup>, Atsushi Urakawa<sup>1</sup></div>
    <div class="header-affil"><sup>1</sup>Delft University of Technology</div>
  </div>
</header>

<div class="page-body">
{#if loading}
  <div class="state-msg">Loading band data…</div>
{:else if error}
  <div class="state-msg error">Failed to load data: {error}</div>
{:else if dataset}
    <!-- ── Sidebar (collapsible) ── -->
    {#if narrow && drawerOpen}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="drawer-backdrop" on:click={() => (drawerOpen = false)}></div>
    {/if}

    <aside
      class="sidebar"
      class:collapsed={!sidebarOpen && !narrow}
      class:drawer-open={narrow && drawerOpen}
    >
      {#if !narrow}
        <button
          class="sidebar-toggle"
          on:click={() => sidebarOpen = !sidebarOpen}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >{sidebarOpen ? '◀' : '▶'}</button>
      {/if}

      {#if !sidebarOpen && !narrow}
        <!-- collapsed: mini page indicator buttons -->
        <div class="collapsed-page-nav">
          <button class="page-mini-btn" class:active={page === 'home'}
            on:click={() => page = 'home'} title="Home">H</button>
          <button class="page-mini-btn" class:active={page === 'knowledge'}
            on:click={() => page = 'knowledge'} title="Knowledge">K</button>
          <!-- B button: click = go to chart; hover = color quick-switch -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="mini-btn-wrap"
            on:mouseenter={openColorMenu}
            on:mouseleave={closeColorMenu}
          >
            <button class="page-mini-btn" class:active={page === 'chart'}
              on:click={() => page = 'chart'} title="Band chart">B</button>
            {#if showColorMenu}
              <div class="color-quick-menu">
                {#each COLOR_DIM_OPTIONS as o}
                  <button
                    class="cq-item"
                    class:cq-active={colorDim === o.dim}
                    on:click={() => { setColorDim(o.dim); page = 'chart'; showColorMenu = false; }}
                  >{o.label}</button>
                {/each}
              </div>
            {/if}
          </div>
          <button class="page-mini-btn" class:active={page === 'references'}
            on:click={() => page = 'references'} title="References">R</button>
          <button class="page-mini-btn" class:active={page === 'datamodel'}
            on:click={() => page = 'datamodel'} title="Dataset">D</button>
          <button class="page-mini-btn" class:active={page === 'impressum'}
            on:click={() => page = 'impressum'} title="Impressum">I</button>
          {#if page === 'styleguide'}
            <button class="page-mini-btn active"
              on:click={() => page = 'styleguide'} title="Style guide">S</button>
          {/if}
          {#if page === 'sourceguide'}
            <button class="page-mini-btn active"
              on:click={() => page = 'sourceguide'} title="Source guide">G</button>
          {/if}
        </div>
      {/if}

      {#if sidebarOpen || narrow}
      <div class="sidebar-open-content">
        <!-- Page selector -->
        <nav class="page-nav">
          <button class:active={page === 'home'}       on:click={() => page = 'home'}>Home</button>
          <button class:active={page === 'knowledge'}  on:click={() => page = 'knowledge'}>Knowledge</button>
          <button class:active={page === 'chart'}      on:click={() => page = 'chart'}>Band chart</button>
          <button class:active={page === 'references'} on:click={() => page = 'references'}>References</button>
          <button class:active={page === 'datamodel'}  on:click={() => page = 'datamodel'}>Dataset</button>
          <button class:active={page === 'impressum'}  on:click={() => page = 'impressum'}>Impressum</button>
          {#if page === 'styleguide'}
            <button class="active" on:click={() => page = 'styleguide'}>Style guide</button>
          {/if}
          {#if page === 'sourceguide'}
            <button class="active" on:click={() => page = 'sourceguide'}>Source guide</button>
          {/if}
        </nav>

        <hr class="divider" />

        <!-- Page-specific sidebar controls -->
        {#if page === 'chart'}
          <SpectroscopySwitch value={spectroscopy} on:change={e => (spectroscopy = e.detail.value)} />

          <hr class="divider" />

          <section>
            <h3>Color by</h3>
            <Dropdown
              value={colorDim}
              options={COLOR_DIM_OPTIONS.map(o => ({ value: o.dim, label: o.label }))}
              label="Color by"
              on:change={e => pickColorDim(e.detail.value)}
            />
            <!-- The look of three kinds of band, whatever the colour: off,
                 they are drawn like any other. Enable & Disable below filters
                 them instead. Collapsed, and one to a line once opened: side
                 by side they read as part of the colour choice above rather
                 than as three separate looks. -->
            <button
              class="disclosure"
              on:click={() => (showLooks = !showLooks)}
              aria-expanded={showLooks}
            >
              <span class="caret">{showLooks ? '▾' : '▸'}</span>
              Options
            </button>

            {#if showLooks}
            <div class="look-pills">
              <LookPill
                look="hollow"
                on={lookInactive}
                title={lookInactive
                  ? `${techniqueLabel}-inactive bands are drawn hollow. Click to draw them like any other band`
                  : `Draw the ${techniqueLabel}-inactive bands hollow`}
                on:toggle={e => (lookInactive = e.detail.on)}
              >{techniqueLabel}-inactive</LookPill>
              <LookPill
                look="faded"
                on={lookUnreferenced}
                title={lookUnreferenced
                  ? `Bands with no ${techniqueLabel} reference are drawn faded. Click to draw them like any other band`
                  : `Draw the bands with no ${techniqueLabel} reference faded`}
                on:toggle={e => (lookUnreferenced = e.detail.on)}
              >unreferenced</LookPill>
              <LookPill
                look="faded"
                on={lookCalculated}
                title={lookCalculated
                  ? 'Bands with nothing but a calculation behind them are drawn faded, and calculated claims are dimmed in the tooltip. Click to draw them like any other band'
                  : 'Draw the bands with nothing but a calculation behind them faded, and dim the calculated claims'}
                on:toggle={e => (lookCalculated = e.detail.on)}
              >computational</LookPill>
            </div>
            {/if}
          </section>

          <hr class="divider" />

          <AxisSelect
            {axisProperty}
            {axisUnit}
            {shiftOn}
            {laserWn}
            reversed={axisReversed}
            on:axisChange={handleAxisChange}
            on:reverseToggle={e => (axisReversed = e.detail.on)}
            on:shiftToggle={e => (shiftOn = e.detail.on)}
            on:laserChange={e => (laserWn = e.detail.wn)}
          />

          <hr class="divider" />

          <Sidebar
            groups={dataset.groups}
            sets={dataset.sets}
            sortedKeys={sortedGroupKeys}
            {enabledGroups}
            {showIsotopes}
            {showInactive}
            {showUnreferenced}
            {showCalculated}
            {spectroscopy}
            on:groupToggle={handleGroupToggle}
            on:setSelect={handleSetSelect}
            on:isotopeToggle={e => showIsotopes = e.detail.enabled}
            on:inactiveToggle={e => showInactive = e.detail.enabled}
            on:unreferencedToggle={e => showUnreferenced = e.detail.enabled}
            on:calculatedToggle={e => showCalculated = e.detail.enabled}
          />

        {:else if page === 'styleguide'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each SG_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={sgActive === s.id}
                on:click={() => scrollToSection(s.id)}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'sourceguide'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each SRC_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={srcActive === s.id}
                on:click={() => scrollToSection(s.id, 'src')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'datamodel'}
          <section>
            <h3>View</h3>
            <Dropdown
              value={dmView}
              options={[{ value: 'structure', label: 'Structure' }, { value: 'contents', label: 'Contents' }]}
              label="View"
              on:change={e => pickDmView(e.detail.value)}
            />
          </section>

          <h3 class="toc-head">Contents</h3>
          <nav class="sg-toc">
            {#each dmSections as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={dmActive === s.id}
                on:click={() => scrollToSection(s.id, 'dm')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'knowledge'}
          <h3>Contents</h3>
          <nav class="sg-toc">
            {#each KN_SECTIONS as s}
              <button
                class="sg-toc-item"
                class:sg-part={s.part}
                class:active={knActive === s.id}
                class:opened={knOpenKey === s.id}
                on:click={() => scrollToSection(s.id, 'kn')}
              >{s.label}</button>
            {/each}
          </nav>

        {:else if page === 'references'}
          <section>
            <h3>Group by</h3>
            <Dropdown
              value={refGroupBy}
              options={GROUP_DIMS.map(d => ({ value: d.key, label: d.label, title: d.hint }))}
              label="Group by"
              on:change={e => (refGroupBy = asGroupDim(e.detail.value))}
            />
          </section>

          <section>
            <h3>Then by</h3>
            <Dropdown
              value={refThenBy}
              options={GROUP_DIMS.filter(d => d.key !== refGroupBy).map(d => ({ value: d.key, label: d.label, title: d.hint }))}
              label="Then by"
              on:change={e => (refThenBy = asGroupDim(e.detail.value))}
            />
          </section>

          <!-- What lists its papers here: the bands, the modes, the Knowledge cards. -->
          <section>
            <h3>Include</h3>
            <button
              class="include-row"
              class:off={!refIncludeBands}
              aria-pressed={refIncludeBands}
              title="Every band that cites the paper, with its wavenumber and surface"
              on:click={() => (refIncludeBands = !refIncludeBands)}
            >
              <span class="inc-label">Assignments</span>
              {#if refCounts}
                <span class="count">{refCounts.claimsShown} / {refCounts.claimsTotal}</span>
              {/if}
            </button>
            <!-- Which kinds of measurement those assignments may come from.
                 Nested under the assignments it filters, and collapsed by
                 default: it is a narrowing tool, not an everyday control. A
                 claim that records no technique at all is never filtered out
                 by it, so switching a technique off never hides the gaps. -->
            {#if refIncludeBands}
              <div class="tech-filter">
                <button
                  class="disclosure tech-disclosure"
                  on:click={() => (refTechniquesOpen = !refTechniquesOpen)}
                  aria-expanded={refTechniquesOpen}
                >
                  <span class="caret">{refTechniquesOpen ? '▾' : '▸'}</span>
                  Technique
                  <span class="count">{refTechniques.size} / {ALL_TECHNIQUES.length}</span>
                </button>
                {#if refTechniquesOpen}
                  <!-- The IR parent reads off only when all seven are off; a
                       partial selection stays upright and lets the count say
                       how many, which is what an indeterminate checkbox used
                       to carry. -->
                  <button
                    class="include-row tech-row"
                    class:off={irOn === 0}
                    aria-pressed={irOn > 0}
                    title="Infrared, every sampling geometry at once"
                    on:click={toggleIr}
                  >
                    <span class="inc-label">IR</span>
                    <span class="count">{irOn} / {IR_TECHNIQUES.length}</span>
                  </button>
                  {#each IR_TECHNIQUES as t (t)}
                    <button
                      class="include-row tech-row tech-child"
                      class:off={!refTechniques.has(t)}
                      aria-pressed={refTechniques.has(t)}
                      title={TECHNIQUE_LABEL[t]}
                      on:click={() => toggleTechnique(t)}
                    ><span class="inc-label">{TECHNIQUE_LABEL[t]}</span>
                      {#if refCounts}<span class="count">{refCounts.byTechnique[t] ?? 0}</span>{/if}
                    </button>
                  {/each}
                  <!-- Raman has members of its own now, so it gets the same
                       parent-and-children shape as IR: the parent switches
                       the family, the children the individual values. -->
                  <button
                    class="include-row tech-row"
                    class:off={ramanOn === 0}
                    aria-pressed={ramanOn > 0}
                    title="Raman, every kind at once"
                    on:click={toggleRaman}
                  >
                    <span class="inc-label">Raman</span>
                    <span class="count">{ramanOn} / {RAMAN_TECHNIQUES.length}</span>
                  </button>
                  {#each RAMAN_TECHNIQUES as t (t)}
                    <button
                      class="include-row tech-row tech-child"
                      class:off={!refTechniques.has(t)}
                      aria-pressed={refTechniques.has(t)}
                      title={TECHNIQUE_LABEL[t]}
                      on:click={() => toggleTechnique(t)}
                    ><span class="inc-label">{TECHNIQUE_LABEL[t]}</span>
                      {#if refCounts}<span class="count">{refCounts.byTechnique[t] ?? 0}</span>{/if}
                    </button>
                  {/each}
                  <button
                    class="include-row tech-row"
                    class:off={!refTechniques.has('computational')}
                    aria-pressed={refTechniques.has('computational')}
                    title={TECHNIQUE_LABEL.computational}
                    on:click={() => toggleTechnique('computational')}
                  ><span class="inc-label">{TECHNIQUE_LABEL.computational}</span>
                    {#if refCounts}<span class="count">{refCounts.byTechnique.computational ?? 0}</span>{/if}
                  </button>
                {/if}
              </div>
            {/if}
            <button
              class="include-row"
              class:off={!refIncludeModes}
              aria-pressed={refIncludeModes}
              title="Normal modes that cite a paper without a band attached"
              on:click={() => (refIncludeModes = !refIncludeModes)}
            >
              <span class="inc-label">Normal modes</span>
              {#if refCounts}
                <span class="count">{refCounts.modesShown} / {refCounts.modesTotal}</span>
              {/if}
            </button>
            <button
              class="include-row"
              class:off={!refIncludeKnowledge}
              aria-pressed={refIncludeKnowledge}
              title="Knowledge cards that cite a paper, with the chapter and page"
              on:click={() => (refIncludeKnowledge = !refIncludeKnowledge)}
            >
              <span class="inc-label">Knowledge</span>
              {#if refCounts}
                <span class="count">{refCounts.knowledgeShown} / {refCounts.knowledgeTotal}</span>
              {/if}
            </button>
            <p class="include-hint">Modes and Knowledge show under each reference when grouping by reference first.</p>
          </section>
        {/if}

      </div>
      {/if}
    </aside>

    <!-- ── Main content ── -->
    <div class="main-area" class:plot-area={page === 'chart' && !chartWithheld} bind:this={mainArea}>
      {#if page === 'home'}
        <HomePage
          bandCount={dataset.bands.length}
          assignmentCount={dataset.bands.reduce((n, b) => n + b.references.length, 0)}
          referenceCount={refs ? Object.keys(refs).length : 0}
          on:navigate={handleHomeNavigate}
        />
      {:else if page === 'chart' && chartWithheld}
        <ChartTooNarrow {wClass} on:show={() => (chartAnyway = true)} />
      {:else if page === 'chart'}
        <div class="chart-scroll">
          <BandChart
            {presenting}
            bands={chartBands}
            groups={dataset.groups}
            {refs}
            {vibrations}
            {enabledGroups}
            {colorDim}
            {hiddenCats}
            {hiddenTags}
            {tagIsolate}
            {axisProperty}
            {axisUnit}
            {shiftZero}
            reversed={axisReversed}
            {spectroscopy}
            looks={{ inactive: lookInactive, unreferenced: lookUnreferenced, calculated: lookCalculated }}
            hoveredCat={legendHoveredCat}
            hoveredTag={legendHoveredTag}
            {focusBand}
            on:navigateRef={handleNavigateRef}
            on:navigateMode={handleNavigateMode}
          />
        </div>
        <div class="legend-box">
          <ColorLegend
            categories={legendCats}
            {hiddenCats}
            on:catToggle={handleCatToggle}
            on:catDblClick={handleCatDblClick}
            on:catHover={handleCatHover}
          />
          {#if legendTags.length > 0}
            <hr class="legend-divider" />
            <TagLegend
              tags={legendTags}
              {hiddenTags}
              {tagIsolate}
              {tagTips}
              on:tagToggle={handleTagToggle}
              on:tagDblClick={handleTagDblClick}
              on:tagHover={handleTagHover}
            />
          {/if}
        </div>
      {:else if page === 'references'}
        <ReferencesPage
          bands={dataset.bands}
          groups={dataset.groups}
          {refs}
          {vibrations}
          {sortedGroupKeys}
          groupBy={refGroupBy}
          thenBy={refThenBy}
          includeBands={refIncludeBands}
          includeModes={refIncludeModes}
          includeKnowledge={refIncludeKnowledge}
          techniques={refTechniqueFilter}
          on:counts={e => (refCounts = e.detail)}
          on:navigateKnowledge={handleNavigateKnowledge}
        />
      {:else if page === 'knowledge'}
        <KnowledgePage
          bind:this={knPage}
          openOnMount={knOpen}
          bands={dataset.bands}
          {refs}
          {vibrations}
          on:active={e => knActive = e.detail.id}
          on:opened={e => (knOpenKey = e.detail.key)}
          on:navigateBand={handleNavigateBand}
          on:navigateRef={handleNavigateRef}
          on:navigateMode={handleNavigateMode}
        />
      {:else if page === 'impressum'}
        <ImpressumPage on:navigate={handleHomeNavigate} />
      {:else if page === 'styleguide'}
        <StyleGuidePage on:active={e => sgActive = e.detail.id} />
      {:else if page === 'sourceguide'}
        <SourceGuidePage on:active={e => srcActive = e.detail.id} />
      {:else if page === 'datamodel'}
        <DataModelPage
          {dataset}
          {refs}
          {vibrations}
          {tagTips}
          {sortedGroupKeys}
          {focusMode}
          view={dmView}
          on:active={e => dmActive = e.detail.id}
          on:navigateRef={handleNavigateRef}
          on:navigateBand={handleNavigateBand}
        />
      {/if}
    </div>
{/if}
</div><!-- page-body -->

{#if presentToast}
  <div class="present-toast" role="status">
    Presentation mode · <kbd>+</kbd> <kbd>−</kbd> to resize · <kbd>Shift</kbd>+<kbd>P</kbd> to leave
  </div>
{/if}

<!-- ── Hint banner (footer) ── -->
<div class="hint-banner">
  <strong>Tip:</strong> hard-refresh if stale:
  <kbd>Ctrl+Shift+R</kbd> (Win/Linux) or <kbd>⌘+Shift+R</kbd> (macOS).
  &ensp;Found an error, have a tip, or know an interesting paper to reference?
  Please contact <a class="contact" href="mailto:j.sommer@tudelft.nl">j.sommer@tudelft.nl</a>.
</div>
</div><!-- app-root -->

<style>
  :global(html, body) {
    margin: 0; padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: var(--font-sans);
    color: var(--ink-700);
    box-sizing: border-box;
  }

  .app-root {
    display: flex;
    flex-direction: column;
    /* Presentation mode's one magnification (PRESENTATION in tokens.ts). At 1
       this is inert, which is why nothing else in the app has to know about
       it. Viewport units are not scaled by zoom, so the shell's own height has
       to be divided back down or it would stand `scale` screens tall. */
    zoom: var(--display-scale, 1);
    height: calc(100vh / var(--display-scale, 1));
    /* A phone's URL bar eats the difference between the two; dvh is the one
       that shrinks with it, so the last line of a page is never cut off. */
    height: calc(100dvh / var(--display-scale, 1));
    overflow: hidden;
  }

  .page-body {
    flex: 1 1 0;
    overflow: hidden;
    /* The drawer and its backdrop are absolute inside this box rather than
       fixed to the viewport, so both start under the header without anyone
       measuring how tall the header is, and the ✕ that closes the drawer
       stays visible while it is open. */
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }

  /* ── Page header ── */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 28px;
    background: var(--grad-header);
    color: var(--brand-on-dark);
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 14px;
  }

  .header-title-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    font-size: 29px;
    font-weight: 800;
    font-style: italic;
    letter-spacing: -0.01em;
    color: var(--brand-on-dark);
  }
  .header-title-btn:hover { color: rgba(255,255,255,0.82); }

  .header-subtitle {
    font-size: 15px;
    color: rgba(255,255,255,0.55);
    font-style: italic;
  }

  .header-right { text-align: right; }

  .header-authors {
    font-size: 14.5px;
    color: rgba(255,255,255,0.88);
    line-height: 1.4;
  }
  .header-authors :global(sup) { font-size: 10px; vertical-align: super; }

  .header-affil {
    font-size: 12.5px;
    color: rgba(255,255,255,0.55);
    font-style: italic;
    margin-top: 1px;
  }
  .header-affil :global(sup) { font-size: 9px; vertical-align: super; }

  /* ── Hint banner (footer) — always visible as the last flex item ── */
  .hint-banner {
    flex: 0 0 auto;
    background: var(--notice-bg);
    border-top: 1px solid var(--notice-border);
    color: var(--notice-fg);
    font-size: 14px;
    padding: 6px 18px;
  }

  .hint-banner .contact {
    color: var(--ref-accent-deep);
    font-weight: 600;
    text-decoration: underline;
  }
  .hint-banner .contact:hover { color: var(--notice-link); }

  kbd {
    background: var(--surface-hover);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 13px;
    font-family: var(--font-mono);
  }

  /* ── Sidebar ── */
  .sidebar {
    flex: 0 0 220px;
    width: 220px;
    height: 100%;
    box-sizing: border-box;
    /* The horizontal padding is small because the reserved scrollbar gutters
       below supply most of it; together they come to the same 14px-ish inset,
       and the content column keeps its width either way. */
    padding: 10px 7px;
    border-right: 1px solid var(--line-soft);
    background: var(--surface-sunken);
    overflow-y: auto;
    overflow-x: hidden;
    /* Reserve the scrollbar's width whether or not it is showing, so
       expanding the group list does not reflow anything. `both-edges` puts
       the same reservation on the left, so the spare room reads as even
       padding rather than an empty column down one side, and the content
       never moves when the scrollbar appears. */
    scrollbar-gutter: stable both-edges;
    font-size: 14px;
    transition: width 0.18s ease, flex-basis 0.18s ease, padding 0.18s ease;
  }

  .sidebar.collapsed {
    flex-basis: 36px;
    width: 36px;
    padding: 10px 6px;
    overflow: visible;
  }

  /* ── Collapsed sidebar: mini page indicator ── */
  .collapsed-page-nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
    align-items: center;
  }

  .page-mini-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-200);
    cursor: pointer;
    text-align: center;
    line-height: 22px;
  }
  .page-mini-btn:hover { background: var(--surface-hover); color: var(--ink-700); }
  .page-mini-btn.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
  }

  .mini-btn-wrap {
    position: relative;
    width: 24px;
  }

  .color-quick-menu {
    position: absolute;
    left: 26px;
    top: 0;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.12);
    z-index: 200;
    overflow: hidden;
    min-width: 100px;
  }

  .cq-item {
    display: block;
    width: 100%;
    padding: 5px 10px;
    background: none;
    border: none;
    font-size: 12.5px;
    color: var(--ink-600);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }
  .cq-item:hover { background: var(--surface-hover); }
  .cq-item.cq-active { color: var(--brand-accent); font-weight: 600; background: var(--brand-tint-soft); }

  /* ── Sidebar flex wrapper (open state) ── */
  .sidebar-open-content {
    display: flex;
    flex-direction: column;
    min-height: calc(100% - 38px); /* leaves room for toggle button */
  }

  .sidebar-toggle {
    display: block;
    width: 100%;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 5px 0;
    font-size: 10px;
    color: var(--ink-300);
    cursor: pointer;
    margin-bottom: 10px;
    text-align: center;
    white-space: nowrap;
  }
  .sidebar-toggle:hover { background: var(--surface-hover); color: var(--ink-700); }

  /* One look to a line. Side by side they read as part of the colour choice
     above rather than as three separate cuts, and the pill shapes, which are
     what say what each switch does to a band, get lost in the wrap. */
  .look-pills {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    margin-top: 4px;
  }

  .sidebar :global(h3) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-500);
  }

  .sidebar :global(select) {
    width: 100%;
    padding: 4px 6px;
    font-size: 13px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: white;
    cursor: pointer;
    box-sizing: border-box;
    margin-bottom: 4px;
  }

  .divider {
    border: none;
    border-top: 1px solid var(--line-soft);
    margin: 12px 0;
  }

  /* ── Main content ── */
  .main-area {
    flex: 1 1 auto;
    height: 100%;
    overflow-y: auto;
    overflow-x: auto;
  }

  /* Every page's own layout collapse is asked of this box, not of the window:
     `@container content (max-width: …)` in the page's stylesheet. The width a
     page has is the width of this element, which is the window less the
     sidebar, less whatever the shell is scaled by, and that is the number a
     two-column spread actually needs to know. Media queries could answer none
     of those three.

     The band chart is exempt: it runs no container queries and it is the one
     place whose flex and overflow behaviour is worth not perturbing. */
  .main-area:not(.plot-area) {
    container-type: inline-size;
    container-name: content;
  }

  .plot-area {
    min-width: 1100px;
    display: flex;
    flex-direction: column;
    padding: 0 40px;
    overflow-y: hidden; /* vertical scroll happens inside .chart-scroll instead */
  }

  /* Chart itself scrolls internally so the legend below stays pinned in
     view regardless of how tall the lane stack gets. flex-grow:0 keeps it
     sized to its own content (no leftover blank space above the legend
     when there are few enough lanes to fit); flex-shrink:1 still lets it
     shrink down to the available space (enabling internal scroll) once the
     lane stack grows past that. */
  .chart-scroll {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .legend-box {
    flex: 0 0 auto;
    border: 1px solid var(--line-panel);
    border-radius: 6px;
    margin: 4px 0 8px;
    background: white;
  }

  .legend-divider {
    border: none;
    border-top: 1px solid var(--surface-hover);
    margin: 0;
  }

  .state-msg {
    padding: 40px;
    font-size: 15px;
    color: var(--ink-400);
  }
  .state-msg.error { color: var(--danger); }

  /* ── Style guide table of contents ── */
  .toc-head { margin-top: 14px; }

  .sg-toc {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  /* References page: what else lists its citations, and which techniques.
     No checkboxes anywhere: a row is on when it reads normally and off when
     it is greyed and struck through, the same idiom the chart sidebar uses
     for a switched-off group. The state IS the styling. */
  .include-row {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 2px 4px;
    background: none;
    border: none;
    border-radius: var(--radius);
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    text-align: left;
    cursor: pointer;
    user-select: none;
  }
  .include-row:hover { background: var(--surface-hover); }

  /* Only the label is struck, never the count beside it: a strike through a
     ratio reads as a deleted number rather than a switched-off row. */
  .include-row.off .inc-label {
    color: var(--ink-025);
    text-decoration: line-through;
  }
  .include-hint {
    margin: 6px 0 0;
    font-size: var(--t-code-size);
    line-height: 1.4;
    color: var(--ink-050);
  }

  /* The technique filter, nested under the assignments it narrows. Indented
     against a hairline so it reads as belonging to the row above rather than
     as a fourth Include option, and collapsed by default: it is an escape
     hatch, the same idiom as the chart sidebar's per-group list. */
  .tech-filter {
    margin: 2px 0 2px 7px;
    padding-left: 9px;
    border-left: 1px solid var(--line);
  }

  .disclosure {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 0;
    background: none;
    border: none;
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--ink-500);
    cursor: pointer;
    text-align: left;
  }
  .disclosure:hover { color: var(--ink-700); }
  .caret { color: var(--ink-200); }
  /* The counts sit hard right and never wrap: a ratio broken across two lines
     stops reading as one number, and in a sidebar this narrow that is exactly
     what "319 / 319" does if you let it. */
  .count {
    margin-left: auto;
    padding-left: 6px;
    font-family: var(--font-mono);
    color: var(--ink-200);
    white-space: nowrap;
  }
  .inc-label { min-width: 0; }

  /* A hair tighter than the Include rows above: seven of them stack up. */
  .tech-row { padding: 1px 0; }
  /* The seven infrared geometries, under their own IR parent switch. */
  .tech-child { padding-left: 16px; }

  .sg-toc-item {
    display: block;
    width: 100%;
    padding: 4px 8px 4px 18px;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 3px;
    font-family: inherit;
    font-size: 12.5px;
    color: var(--ink-500);
    text-align: left;
    cursor: pointer;
    line-height: 1.35;
  }
  .sg-toc-item:hover { background: var(--surface-hover); color: var(--ink-700); }

  /* Part headings sit flush left and anchor the list; subsections indent. */
  .sg-toc-item.sg-part {
    padding-left: 8px;
    margin-top: 8px;
    font-weight: 700;
    color: var(--brand-900);
  }
  .sg-toc-item.sg-part:first-child { margin-top: 0; }

  .sg-toc-item.active {
    background: var(--brand-tint);
    border-left-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }

  /* The card that is open. An outline rather than a fill, so it can sit on
     top of the scroll highlight without either one being hidden: where the
     reader is and what they have opened are usually the same card, and then
     the box simply frames the highlight. Drawn as an inset shadow so it
     costs no layout and the row does not shift when it appears. */
  .sg-toc-item.opened {
    box-shadow: inset 0 0 0 1px var(--brand-tint-line);
    color: var(--brand-accent);
  }

  /* ── Page navigation ── */
  .page-nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .page-nav button {
    display: block;
    width: 100%;
    padding: 5px 10px;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    color: var(--ink-600);
    text-align: left;
  }

  .page-nav button:hover { background: var(--surface-hover); }

  .page-nav button.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
    font-weight: 600;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     The narrow shell

     Everything below is keyed off `data-narrow` on the document element, set
     from the measured shell width (see WIDTH_CLASSES in tokens.ts), never off
     a media query. A media query asks the viewport; this asks how much room
     the content was actually given, which is the question a layout has and
     the only one that stays right when the shell is scaled.

     Two things deliberately do NOT change with the width. The scroll model is
     one: the header stays put and .main-area scrolls internally at every
     size, because the Knowledge, Dataset and both guide pages hang their
     sidebar scroll spy off that element. The band chart is the other: it is
     withheld rather than reflowed (ChartTooNarrow).
     ───────────────────────────────────────────────────────────────────────── */

  .drawer-btn {
    flex: 0 0 auto;
    /* WCAG 2.2 SC 2.5.8 asks 24px; a header control on a phone deserves 44. */
    width: 44px;
    height: 44px;
    margin: -8px 4px -8px -8px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius);
    color: var(--brand-on-dark);
    font-size: 17px;
    line-height: 1;
    cursor: pointer;
  }
  .drawer-btn:hover { background: rgba(255, 255, 255, 0.12); }

  .drawer-backdrop {
    position: absolute;
    inset: 0;
    z-index: 790;
    background: rgba(20, 34, 56, 0.38);
  }

  :global(html[data-narrow]) .sidebar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 800;
    flex-basis: auto;
    width: min(320px, 86vw);
    height: auto;
    padding: 10px 12px;
    box-shadow: var(--shadow-md);
    transform: translateX(-102%);
    transition: transform 0.22s ease;
  }
  :global(html[data-narrow]) .sidebar.drawer-open { transform: translateX(0); }

  /* The rail's own controls belong to the docked layout only. */
  :global(html[data-narrow]) .sidebar-open-content { min-height: 0; }

  /* With the sidebar out of flow, the content takes the whole row. */
  :global(html[data-narrow]) .main-area { width: 100%; }

  /* The authors' line is the first thing to go: on a phone it costs a third
     of the header and it is repeated on the Impressum anyway. */
  :global(html[data-w='compact']) .app-header { padding: 10px 14px; }
  :global(html[data-w='compact']) .header-right { display: none; }
  :global(html[data-w='compact']) .header-subtitle { display: none; }

  :global(html[data-w='compact']) .hint-banner { padding: 10px 14px; }

  @media (prefers-reduced-motion: reduce) {
    :global(html[data-narrow]) .sidebar { transition: none; }
  }


  /* ─────────────────────────────────────────────────────────────────────────
     Presentation mode

     One zoom on .app-root above, and the subtractions below. The list is
     PRESENTATION.subtractions in tokens.ts, which the style guide renders;
     anything added here belongs there too, with the reason it is noise from
     the back of a room.
     ───────────────────────────────────────────────────────────────────────── */

  :global(html[data-presenting]) .hint-banner { display: none; }

  .present-ctl {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
    /* Left of the authors: the top right corner belongs to the names. */
    margin-left: auto;
    margin-right: 16px;
    /* Hidden until wanted: the atlas is read at a desk far more often than it
       is presented, and a control for the rare case should not sit in the
       header shouting. Focus reveals it too, so it is reachable by keyboard,
       and while it is invisible it is also untappable: a transparent button is
       still a button, and on a touch screen there is no hover to reveal it
       before the tap lands. */
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }
  .app-header:hover .present-ctl,
  .present-ctl:focus-within,
  .present-ctl.on { opacity: 1; pointer-events: auto; }

  /* No presenting from a phone. Shift+P and ?present= still work for anyone
     who means it; the header has no room to offer it. */
  :global(html[data-w='compact']) .present-ctl { display: none; }

  .pc-btn {
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    background: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: var(--radius);
    color: var(--brand-on-dark);
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
  }
  .pc-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.22); }
  .pc-btn:disabled { opacity: 0.4; cursor: default; }
  .pc-enter { letter-spacing: 0.02em; }
  .pc-exit { margin-left: 4px; }

  .pc-scale {
    min-width: 46px;
    text-align: center;
    color: var(--brand-on-dark);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .present-toast {
    position: fixed;
    left: 50%;
    bottom: 26px;
    transform: translateX(-50%);
    z-index: 9000;
    padding: 9px 16px;
    background: var(--ink-800);
    color: white;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    font-size: 13.5px;
    white-space: nowrap;
  }
  .present-toast kbd {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .present-ctl { transition: none; }
  }

</style>

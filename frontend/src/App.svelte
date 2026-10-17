<script lang="ts">
  import { onMount } from 'svelte';
  import type { Dataset, ColorDim, AxisProperty, RefMap, Vibrations, Spectroscopy } from './lib/types';
  import { AXES, DEFAULT_LASER_WN } from './lib/units';
  import { getLegendCategories, getLegendTags, isReferenced, UNRECORDED, type BandStateMode, type ClaimFilter } from './lib/chart';
  import { installLookups } from './lib/labels';
  import { tagRole } from './lib/dataModel';
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
  import Icon from './components/Icon.svelte';
  import BandCard from './components/BandCard.svelte';
  import { linkedModesFor } from './lib/vibrationLinks';

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
  /* The selected band, reported by the chart, drawn by the sidebar. The chart
     keeps owning the selection, because the highlight and the arcs to the
     band's partners belong to it; this is the copy the sidebar reads. */
  let selectedHit: { tipData: import('./lib/chart').TipData; color: string } | null = null;
  /* Opened by the first band clicked, and closed only on purpose. Dismissing
     a band leaves the column standing and empty rather than shutting it: the
     chart would otherwise jump a third of its width wider every time somebody
     clicked past a band, which is worse than an empty column. */
  let sideOpen = false;
  let bandClearNonce = 0;
  let bandPlayNonce = 0;
  function handleBandSelect(e: CustomEvent<{ hit: { tipData: import('./lib/chart').TipData; color: string } | null }>) {
    selectedHit = e.detail.hit;
    if (selectedHit) sideOpen = true;
    bandPlayNonce++;
  }
  $: sideModes = selectedHit
    ? linkedModesFor(vibrations, selectedHit.tipData.vibrationModeIds)
    : [];
  function closeBandSide() {
    sideOpen = false;
    // Let the chart go of the band too, or clicking it again would not reopen
    // the column: the same band selected twice is not a change.
    bandClearNonce++;
  }
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

  /* The main menu, written once and rendered twice: as words while the
     sidebar is open, as the home page's own symbols while it is collapsed.
     The rail is only readable because the reader has already met those
     symbols on the cards, which is why both draw the same component. */
  const NAV: { page: Page; label: string; icon: string; accent?: string }[] = [
    { page: 'home',       label: 'Home',       icon: 'home' },
    { page: 'knowledge',  label: 'Knowledge',  icon: 'knowledge',  accent: 'green' },
    { page: 'chart',      label: 'Band chart', icon: 'chart',      accent: 'blue' },
    { page: 'references', label: 'References', icon: 'references', accent: 'amber' },
    { page: 'datamodel',  label: 'Dataset',    icon: 'dataset',    accent: 'red' },
    { page: 'impressum',  label: 'Impressum',  icon: 'impressum' },
  ];
  /* The two guides have no permanent entry; they appear while open. */
  const EXTRA_NAV: { page: Page; label: string; icon: string }[] = [
    { page: 'styleguide',  label: 'Style guide',  icon: 'styleguide' },
    { page: 'sourceguide', label: 'Source guide', icon: 'sourceguide' },
  ];

  /* One flyout at a time on the collapsed rail, keyed by whatever opened it.
     A rail button says what it is on hover (the title), and a control says
     what it is and then offers its options underneath. The small delay on
     closing is what lets the pointer travel from the button into the panel. */
  let flyOpen: string | null = null;
  let flyTimer: ReturnType<typeof setTimeout> | null = null;
  function openFly(id: string) {
    if (flyTimer) { clearTimeout(flyTimer); flyTimer = null; }
    flyOpen = id;
  }
  function closeFly() {
    flyTimer = setTimeout(() => { flyOpen = null; }, 180);
  }

  /** Which set the current selection is, or null when it matches none. */
  $: activeSetKey = (() => {
    if (!dataset) return null;
    if (enabledGroups.size === Object.keys(dataset.groups).length) return 'all';
    for (const st of Object.values(dataset.sets ?? {})) {
      if (st.groups.length === enabledGroups.size && st.groups.every(g => enabledGroups.has(g))) {
        return st.key;
      }
    }
    return null;
  })();

  function chooseSet(key: string) {
    if (!dataset) return;
    const chosen = dataset.sets?.[key];
    enabledGroups = new Set(chosen ? chosen.groups : Object.keys(dataset.groups));
  }

  // Which set the chart opens on. A set is authored in bands.jsonc; this
  // names the one that answers the question the atlas is about.
  const DEFAULT_SET = 'co2_hydrogenation';

  let enabledGroups: ReadonlySet<string> = new Set();
  let colorDim: ColorDim = 'group';
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

  /* The quantity the x axis carries, for the collapsed rail. The unit is not
     offered there: a new quantity opens in the unit it is usually drawn in,
     which is the only one most readers ever want. */
  const AXIS_OPTIONS: { property: AxisProperty; label: string }[] = [
    { property: 'wavenumber', label: 'Wavenumber' },
    { property: 'wavelength', label: 'Wavelength' },
    { property: 'energy',     label: 'Energy' },
  ];

  function pickAxisProperty(property: AxisProperty) {
    if (property !== axisProperty) axisReversed = AXES[property].reversed;
    axisProperty = property;
    axisUnit = AXES[property].defaultUnit;
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

  /* The legend's technique chips are the Techniques section by another way
     in, not a band filter. Hiding "transmission" used to take out every band
     with any transmission claim, which answered a different question from
     the sidebar's and contradicted it; now a click stops those claims
     counting, exactly as the sidebar row does. An umbrella chip switches its
     family. The one exception to "matching uses the full tag list": a hover
     still asks whether the band carries the tag, which is still true. */
  function techniqueMembers(tag: string): string[] | null {
    if (tagRole(tag) !== 'technique') return null;
    if (tag === 'infrared') return [...IR_TECHNIQUES];
    if (tag === 'raman') return [...RAMAN_TECHNIQUES];
    return [tag];
  }
  /* The phase chips the same way: a form chip (free, dissolved, adsorbed,
     surface, lattice) or a medium chip (in vacuum, in gas, in liquid, in
     matrix) is the Phases section by another way in, so a click stops those
     claims counting rather than hiding every band that has one. The other
     phase-role tags (undissociated, frustrated-mode) describe the band, not
     a claim, and stay ordinary band filters. */
  function phaseOfTag(tag: string): { part: PhasePart; key: string } | null {
    for (const part of PHASE_PARTS) {
      const row = part.rows.find(r => r.tag === tag);
      if (row) return { part: part.key, key: row.key };
    }
    return null;
  }

  function handleTagToggle(e: CustomEvent<{ tag: string; visible: boolean }>) {
    const members = techniqueMembers(e.detail.tag);
    if (members) {
      const next = new Set(excludedTechniques);
      for (const t of members) if (e.detail.visible) next.delete(t); else next.add(t);
      excludedTechniques = next;
      return;
    }
    const ph = phaseOfTag(e.detail.tag);
    if (ph) {
      const next = new Set(excludedPhase[ph.part]);
      if (e.detail.visible) next.delete(ph.key); else next.add(ph.key);
      excludedPhase = { ...excludedPhase, [ph.part]: next };
      return;
    }
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
    const members = techniqueMembers(e.detail.tag);
    if (members) {
      onlyTechniques(members);
      return;
    }
    const ph = phaseOfTag(e.detail.tag);
    if (ph) {
      onlyPhase(ph.part, [ph.key]);
      return;
    }
    tagIsolate = tagIsolate === e.detail.tag ? null : e.detail.tag;
    hiddenTags = new Set();
  }

  /* What the legend draws as off: the band filter's own hidden tags, plus
     every technique chip whose techniques are all switched off and every
     form or medium chip that is. */
  $: legendHiddenTags = (() => {
    const off = new Set(hiddenTags);
    for (const t of legendTags) {
      const members = techniqueMembers(t.key);
      if (members?.every(m => excludedTechniques.has(m))) off.add(t.key);
      const ph = phaseOfTag(t.key);
      if (ph && excludedPhase[ph.part].has(ph.key)) off.add(t.key);
    }
    return off;
  })();

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

  // Which claims count, and what happens to a band once none of its own do.
  //
  // The first is a set of techniques switched off (the sidebar's
  // Techniques): a claim made with one greys and folds in the card, and stops
  // counting as a reference. A set of the excluded rather than of the
  // accepted, so a technique the filter does not list (mioirs) is never
  // silently dropped. Empty by default, in either view: the IR | Raman switch
  // picks the selection rule, not the evidence, so a Raman claim counts for a
  // band in the infrared view until the Raman family is switched off here.
  //
  // Computational is one of them, and counted by default too. A calculation is
  // evidence, and a band whose only evidence is one is a band the atlas is
  // reporting, not a band it doubts; greying it before anybody asked reads as
  // a caveat about the chemistry rather than an answer to a question about
  // method.
  let excludedTechniques: ReadonlySet<string> = new Set();
  // The second is one three-way choice per condition (the sidebar's Band
  // States): the band's own look (hollow, faded), drawn plain, or out of the
  // chart with the lanes re-laid without it.
  let inactiveMode: BandStateMode = 'look';
  let unreferencedMode: BandStateMode = 'look';
  /* The three answers, for the rail; the open sidebar names the look itself. */
  const BAND_STATE_OPTIONS: { mode: BandStateMode; label: string }[] = [
    { mode: 'look', label: 'own look' },
    { mode: 'plain', label: 'plain' },
    { mode: 'hidden', label: 'hidden' },
  ];
  /* Both families are offered in either view, each under a switch of its
     own, and the calculations after them, in the References page's order. */
  const CHART_FAMILIES: { key: string; label: string; title: string; members: readonly string[] }[] = [
    { key: 'infrared', label: 'IR', title: 'Absorption of infrared light by vibrations that change the dipole moment.', members: IR_TECHNIQUES },
    { key: 'raman', label: 'Raman', title: 'Inelastic scattering of laser light by vibrations that change the polarizability.', members: RAMAN_TECHNIQUES },
  ];
  /* What each technique is, in one sentence: the tooltip on its row. */
  const TECHNIQUE_TIP: Record<string, string> = {
    infrared: 'An infrared measurement whose sampling geometry the source does not name.',
    drifts: 'Infrared light scattered back from a powder bed (diffuse reflectance).',
    transmission: 'Infrared light passed straight through a thin wafer or a gas cell.',
    atr: 'Infrared light totally reflected inside a crystal, probing the sample pressed against it.',
    irras: 'Infrared light reflected at grazing incidence off a flat, usually metal, surface.',
    pm_irras: 'Grazing-incidence reflection with the polarisation switched to cancel the gas background.',
    seiras: 'Infrared absorption enhanced by a thin metal-film electrode, read through an ATR prism.',
    emission: 'Infrared light emitted by the hot sample itself.',
    raman: 'Raman scattering whose kind the source does not name.',
    srs: 'Laser light scattered inelastically by the sample on its own (spontaneous Raman).',
    computational: 'A frequency calculated rather than measured.',
  };
  const familyOn = (members: readonly string[], excluded: ReadonlySet<string>) =>
    members.filter(t => !excluded.has(t)).length;
  $: countedTechniques = ALL_TECHNIQUES.filter(t => !excludedTechniques.has(t)).length;
  let showTechniques = false;

  // The second half of "which claims count": how the sample was held for
  // each claim (the Phases section), in two parts that combine. The form is
  // where the species was, the medium what surrounded it, so "adsorbed" with
  // only "liquid" left on is the electrochemistry. Sets of the excluded, like
  // the techniques, empty by default; a claim that records neither is keyed
  // under UNRECORDED so it can be switched off as a group too.
  type PhasePart = 'form' | 'medium';
  type PhaseRow = { key: string; label: string; title: string; tag: string | null };
  const PHASE_PARTS: { key: PhasePart; label: string; rows: PhaseRow[] }[] = [
    { key: 'form', label: 'Form', rows: [
      { key: 'free', tag: 'free', label: 'Free', title: 'The molecule on its own: a gas, the liquid itself, or isolated in a matrix.' },
      { key: 'dissolved', tag: 'dissolved', label: 'Dissolved', title: 'A solute in a liquid.' },
      { key: 'adsorbed', tag: 'adsorbed', label: 'Adsorbed', title: 'Held on a surface.' },
      { key: 'surface', tag: 'surface', label: 'Surface group', title: 'A group belonging to the solid, such as a hydroxyl or a hydride.' },
      { key: 'lattice', tag: 'lattice', label: 'Lattice', title: 'A vibration or a defect of the solid itself.' },
      { key: UNRECORDED, tag: null, label: 'Not recorded', title: 'No form recorded, which is true of every calculation.' },
    ] },
    { key: 'medium', label: 'Medium', rows: [
      { key: 'vacuum', tag: 'in vacuum', label: 'Vacuum', title: 'An evacuated or ultra-high-vacuum cell with no gas let in.' },
      { key: 'gas', tag: 'in gas', label: 'Gas', title: 'A gas atmosphere, from a fraction of a mbar of dosed gas to a flowing feed at pressure.' },
      { key: 'liquid', tag: 'in liquid', label: 'Liquid', title: 'A liquid or an electrolyte.' },
      { key: 'matrix', tag: 'in matrix', label: 'Matrix', title: 'A frozen noble gas the molecule is isolated in.' },
      { key: UNRECORDED, tag: null, label: 'Not recorded', title: 'No medium recorded, which is true of every calculation and of papers that do not say.' },
    ] },
  ];
  let excludedPhase: Record<PhasePart, ReadonlySet<string>> = { form: new Set(), medium: new Set() };
  let showPhases = false;
  $: countedPhases = PHASE_PARTS.reduce((n, part) => n + part.rows.filter(r => !excludedPhase[part.key].has(r.key)).length, 0);
  const PHASE_ROW_COUNT = PHASE_PARTS.reduce((n, part) => n + part.rows.length, 0);
  function togglePhase(part: PhasePart, key: string) {
    const next = new Set(excludedPhase[part]);
    if (next.has(key)) next.delete(key); else next.add(key);
    excludedPhase = { ...excludedPhase, [part]: next };
  }
  /* Double-click a row, a family or a legend chip to count only that, the
     way a double-click isolates a tag in the legend; a second double-click
     on the same thing counts everything again. */
  function isolate(all: readonly string[], keep: readonly string[], excluded: ReadonlySet<string>): ReadonlySet<string> {
    const others = all.filter(k => !keep.includes(k));
    const already = others.every(k => excluded.has(k)) && keep.every(k => !excluded.has(k));
    return already ? new Set() : new Set(others);
  }
  function onlyTechniques(keep: readonly string[]) {
    excludedTechniques = isolate(ALL_TECHNIQUES, keep, excludedTechniques);
  }
  function onlyPhase(part: PhasePart, keep: readonly string[]) {
    const all = PHASE_PARTS.find(p => p.key === part)!.rows.map(r => r.key);
    excludedPhase = { ...excludedPhase, [part]: isolate(all, keep, excludedPhase[part]) };
  }
  /* A native button fires click, click, then dblclick for one double-click,
     so the single click is held back long enough to be cancelled, as the tag
     legend does (TagLegend.svelte). */
  let pendingRowClick: ReturnType<typeof setTimeout> | null = null;
  function rowClick(fn: () => void) {
    if (pendingRowClick) clearTimeout(pendingRowClick);
    pendingRowClick = setTimeout(() => { pendingRowClick = null; fn(); }, 280);
  }
  function rowDblClick(fn: () => void) {
    if (pendingRowClick) { clearTimeout(pendingRowClick); pendingRowClick = null; }
    fn();
  }
  $: claimFilter = { techniques: excludedTechniques, forms: excludedPhase.form, media: excludedPhase.medium } as ClaimFilter;
  function toggleChartTechnique(key: string) {
    const next = new Set(excludedTechniques);
    if (next.has(key)) next.delete(key); else next.add(key);
    excludedTechniques = next;
  }
  /** A family switch: all of it off if any is on, else all of it on. */
  function toggleChartFamily(members: readonly string[]) {
    const next = new Set(excludedTechniques);
    if (familyOn(members, excludedTechniques) > 0) for (const t of members) next.add(t);
    else for (const t of members) next.delete(t);
    excludedTechniques = next;
  }
  // The electromagnetic regions marked on the chart: the strip of names above
  // the plot, the dashed borders and the tint fading from them. One switch for
  // all three, since a border with no name says nothing.
  let showRegions = true;
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
  $: baseBands = dataset
    ? (showIsotopes ? dataset.bands : dataset.bands.filter(b => !b.isotopologue_of))
        .filter(b => !activePhases || !b.phase || activePhases.includes(b.phase))
    : [];
  // The bands the chart is handed: the two Band States that say "hidden" take
  // theirs out here. Unreferenced is read against the same excluded
  // techniques the card greys its claims with, so switching off the only
  // technique a band was measured with moves it into this state like any
  // band without a claim in the chosen spectroscopy.
  $: chartBands = baseBands
    .filter(b => inactiveMode !== 'hidden' || !b.tags.includes(inactiveTag))
    .filter(b => unreferencedMode !== 'hidden' || isReferenced(b, claimFilter));
  /** How many bands in the enabled groups each technique has a claim in. */
  $: techniqueCounts = (() => {
    const counts: Record<string, number> = {};
    for (const b of baseBands) {
      if (!enabledGroups.has(b.group)) continue;
      for (const t of new Set(b.references.map(r => r.technique).filter(Boolean) as string[])) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  })();
  /** How many bands in the enabled groups have a claim in each form and medium. */
  $: phaseCounts = (() => {
    const counts: Record<PhasePart, Record<string, number>> = { form: {}, medium: {} };
    for (const b of baseBands) {
      if (!enabledGroups.has(b.group)) continue;
      for (const f of new Set(b.references.map(r => r.form || UNRECORDED))) counts.form[f] = (counts.form[f] ?? 0) + 1;
      for (const m of new Set(b.references.map(r => r.medium || UNRECORDED))) counts.medium[m] = (counts.medium[m] ?? 0) + 1;
    }
    return counts;
  })();

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
          {#each [...NAV, ...EXTRA_NAV.filter(e => page === e.page)] as n (n.page)}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mini-btn-wrap"
              on:mouseenter={() => openFly('nav:' + n.page)}
              on:mouseleave={closeFly}
            >
              <button
                class="page-mini-btn acc-{n.accent ?? 'plain'}"
                class:active={page === n.page}
                on:click={() => (page = n.page)}
                aria-label={n.label}
              ><Icon name={n.icon} size={16} width={1.9} /></button>
              {#if flyOpen === 'nav:' + n.page}
                <div class="fly"><div class="fly-title">{n.label}</div></div>
              {/if}
            </div>
          {/each}

          <!-- Where the main menu stops and the page's own controls start.
               The same cut the open sidebar makes, kept here so the rail is
               read the same way. -->
          <hr class="rail-rule" />

          {#if page === 'chart' && dataset}
            <!-- The chart's controls, at their smallest. Which selection rule
                 is drawn, what the colour means, which groups are on, and
                 which kinds of band are in at all. The axis and its unit are
                 not here: they are a reading of the same chart rather than a
                 change to what is on it, and the shift needs a number typed. -->
            <button
              class="page-mini-btn ctl-btn is-text"
              class:active={spectroscopy === 'raman'}
              on:click={() => (spectroscopy = spectroscopy === 'raman' ? 'ir' : 'raman')}
              title={spectroscopy === 'raman'
                ? 'Raman selection rules. Click for infrared'
                : 'Infrared selection rules. Click for Raman'}
            >{spectroscopy === 'raman' ? 'R' : 'IR'}</button>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mini-btn-wrap"
              on:mouseenter={() => openFly('colour')} on:mouseleave={closeFly}>
              <button class="page-mini-btn ctl-btn" aria-label="Appearance"
              ><Icon name="color" size={15} width={1.8} /></button>
              {#if flyOpen === 'colour'}
                <div class="fly">
                  <div class="fly-title">Appearance</div>
                  {#each COLOR_DIM_OPTIONS as o}
                    <button class="fly-item" class:fly-on={colorDim === o.dim}
                      on:click={() => { setColorDim(o.dim); flyOpen = null; }}
                    >Color by {o.label.toLowerCase()}</button>
                  {/each}
                  <div class="fly-rule"></div>
                  <button class="fly-item" class:fly-on={showRegions}
                    on:click={() => (showRegions = !showRegions)}
                  ><span class="fly-box" class:on={showRegions}></span>spectral regions</button>
                </div>
              {/if}
            </div>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mini-btn-wrap"
              on:mouseenter={() => openFly('axis')} on:mouseleave={closeFly}>
              <button class="page-mini-btn ctl-btn is-text" aria-label="X axis"
              >x</button>
              {#if flyOpen === 'axis'}
                <div class="fly">
                  <div class="fly-title">X axis</div>
                  {#each AXIS_OPTIONS as a}
                    <button class="fly-item" class:fly-on={axisProperty === a.property}
                      on:click={() => pickAxisProperty(a.property)}
                    >{a.label}</button>
                  {/each}
                  <!-- The two switches, kept as switches: which way the axis
                       runs, and whether it is read from a zero. The unit and
                       the zero itself stay in the open sidebar, one because
                       every quantity opens in the unit it is usually drawn
                       in, the other because it is a number to type. -->
                  <div class="fly-rule"></div>
                  <button class="fly-item" class:fly-on={axisReversed}
                    on:click={() => (axisReversed = !axisReversed)}
                  ><span class="fly-box" class:on={axisReversed}></span>inverted</button>
                  <button class="fly-item" class:fly-on={shiftOn}
                    on:click={() => (shiftOn = !shiftOn)}
                  ><span class="fly-box" class:on={shiftOn}></span>shift from a zero</button>
                </div>
              {/if}
            </div>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mini-btn-wrap"
              on:mouseenter={() => openFly('endis')} on:mouseleave={closeFly}>
              <button class="page-mini-btn ctl-btn" aria-label="Techniques and band states"
              ><Icon name="toggles" size={15} width={1.8} /></button>
              {#if flyOpen === 'endis'}
                <!-- Techniques, Phases and Band States in one flyout, in the
                     open sidebar's order: which claims count, then what a
                     band with none left does. The techniques at their smallest,
                     the two families and the calculations, not every
                     geometry. -->
                <div class="fly">
                  <div class="fly-title">Techniques</div>
                  {#each CHART_FAMILIES as fam (fam.key)}
                    {@const on = familyOn(fam.members, excludedTechniques)}
                    <button class="fly-item" class:fly-on={on > 0}
                      on:click={() => rowClick(() => toggleChartFamily(fam.members))}
                      on:dblclick={() => rowDblClick(() => onlyTechniques(fam.members))}
                    ><span class="fly-box" class:on={on > 0}></span>{fam.label} ({on} / {fam.members.length})</button>
                  {/each}
                  <button class="fly-item" class:fly-on={!excludedTechniques.has('computational')}
                    on:click={() => rowClick(() => toggleChartTechnique('computational'))}
                    on:dblclick={() => rowDblClick(() => onlyTechniques(['computational']))}
                  ><span class="fly-box" class:on={!excludedTechniques.has('computational')}></span>computational</button>
                  <div class="fly-rule"></div>
                  <div class="fly-title">Phases</div>
                  {#each PHASE_PARTS as part (part.key)}
                    <div class="fly-note">{part.label.toLowerCase()}</div>
                    {#each part.rows as ph (ph.key)}
                      <button class="fly-item" class:fly-on={!excludedPhase[part.key].has(ph.key)}
                        title={ph.title}
                        on:click={() => rowClick(() => togglePhase(part.key, ph.key))}
                        on:dblclick={() => rowDblClick(() => onlyPhase(part.key, [ph.key]))}
                      ><span class="fly-box" class:on={!excludedPhase[part.key].has(ph.key)}></span>{ph.label.toLowerCase()}</button>
                    {/each}
                  {/each}
                  <div class="fly-rule"></div>
                  <div class="fly-title">Band States</div>
                  <button class="fly-item" class:fly-on={showIsotopes}
                    on:click={() => (showIsotopes = !showIsotopes)}
                  ><span class="fly-box" class:on={showIsotopes}></span>isotope</button>
                  <div class="fly-note">{techniqueLabel}-inactive</div>
                  {#each BAND_STATE_OPTIONS as o (o.mode)}
                    <button class="fly-item" class:fly-on={inactiveMode === o.mode}
                      on:click={() => (inactiveMode = o.mode)}
                    >{o.mode === 'look' ? 'hollow' : o.label}</button>
                  {/each}
                  <div class="fly-note">unreferenced</div>
                  {#each BAND_STATE_OPTIONS as o (o.mode)}
                    <button class="fly-item" class:fly-on={unreferencedMode === o.mode}
                      on:click={() => (unreferencedMode = o.mode)}
                    >{o.mode === 'look' ? 'faded' : o.label}</button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mini-btn-wrap"
              on:mouseenter={() => openFly('groups')} on:mouseleave={closeFly}>
              <button class="page-mini-btn ctl-btn" aria-label="Group filter"
              ><Icon name="filter" size={15} width={1.8} /></button>
              {#if flyOpen === 'groups'}
                <div class="fly">
                  <div class="fly-title">Group filter</div>
                  <button class="fly-item" class:fly-on={activeSetKey === 'all'}
                    on:click={() => { chooseSet('all'); flyOpen = null; }}
                  >All groups</button>
                  {#each Object.values(dataset.sets ?? {}) as st (st.key)}
                    <button class="fly-item" class:fly-on={activeSetKey === st.key}
                      on:click={() => { chooseSet(st.key); flyOpen = null; }}
                    >{st.label}</button>
                  {/each}
                  {#if activeSetKey === null}
                    <div class="fly-note">Custom selection</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      {#if sidebarOpen || narrow}
      <div class="sidebar-open-content">
        <!-- Page selector -->
        <nav class="page-nav">
          {#each [...NAV, ...EXTRA_NAV.filter(e => page === e.page)] as n (n.page)}
            <button class:active={page === n.page} on:click={() => (page = n.page)}>{n.label}</button>
          {/each}
        </nav>

        <!-- Where the atlas stops and this page starts. Heavier than the
             dividers inside a page's own controls, because it is a different
             kind of boundary: everything above it is the same on every page. -->
        <hr class="divider strong" />

        <!-- Page-specific sidebar controls -->
        {#if page === 'chart'}
          <SpectroscopySwitch value={spectroscopy} on:change={e => (spectroscopy = e.detail.value)} />

          <hr class="divider" />

          <section>
            <!-- Appearance, not Color by: the section holds the colour
                 dimension, the looks a band takes and the marking of the
                 spectral regions, and only the first of those is a colour.
                 The dropdown says "Color by" itself now that the heading
                 no longer does. -->
            <h3>Appearance</h3>
            <Dropdown
              value={colorDim}
              options={COLOR_DIM_OPTIONS.map(o => ({ value: o.dim, label: `Color by ${o.label.toLowerCase()}` }))}
              label="Color by"
              on:change={e => pickColorDim(e.detail.value)}
            />
            <!-- The one look left here is the regions'. The looks of the
                 inactive and unreferenced bands moved to Band States, where
                 each is one three-way choice with its filter rather than a
                 pill here and a second pill there. -->
            <div class="look-pills">
              <LookPill
                look="region"
                on={showRegions}
                title={showRegions
                  ? 'The electromagnetic regions are marked: named above the plot, with a dashed line at each border. Click to take them off'
                  : 'Mark the electromagnetic regions: name them above the plot and draw a dashed line at each border'}
                on:toggle={e => (showRegions = e.detail.on)}
              >spectral regions</LookPill>
            </div>
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

          <section>
            <!-- Which claims count. The first of three steps the rest of the
                 sidebar takes in order: which claims count (here), what a
                 band with none left looks like (Band States), which chemistry
                 is on screen (Group Filter). Both families are offered in
                 either view and all of it is on to begin with. Collapsed
                 like the group list: it is a narrowing tool, not an everyday
                 control. -->
            <h3>Techniques</h3>
            <button
              class="disclosure"
              on:click={() => (showTechniques = !showTechniques)}
              aria-expanded={showTechniques}
            >
              <span class="caret">{showTechniques ? '▾' : '▸'}</span>
              Counted
              <span class="count">{countedTechniques} / {ALL_TECHNIQUES.length}</span>
            </button>
            {#if showTechniques}
              <div class="tech-filter">
                {#each CHART_FAMILIES as fam (fam.key)}
                {@const on = familyOn(fam.members, excludedTechniques)}
                <button
                  class="include-row tech-row"
                  class:off={on === 0}
                  aria-pressed={on > 0}
                  title={fam.title}
                  on:click={() => rowClick(() => toggleChartFamily(fam.members))}
                      on:dblclick={() => rowDblClick(() => onlyTechniques(fam.members))}
                >
                  <span class="inc-label">{fam.label}</span>
                  <span class="count">{on} / {fam.members.length}</span>
                </button>
                {#each fam.members as t (t)}
                  <button
                    class="include-row tech-row tech-child"
                    class:off={excludedTechniques.has(t)}
                    aria-pressed={!excludedTechniques.has(t)}
                    title={TECHNIQUE_TIP[t] ?? TECHNIQUE_LABEL[t]}
                    on:click={() => rowClick(() => toggleChartTechnique(t))}
                    on:dblclick={() => rowDblClick(() => onlyTechniques([t]))}
                  ><span class="inc-label">{TECHNIQUE_LABEL[t]}</span>
                    <span class="count">{techniqueCounts[t] ?? 0}</span>
                  </button>
                {/each}
                {/each}
                <button
                  class="include-row tech-row"
                  class:off={excludedTechniques.has('computational')}
                  aria-pressed={!excludedTechniques.has('computational')}
                  title={TECHNIQUE_TIP.computational}
                  on:click={() => rowClick(() => toggleChartTechnique('computational'))}
                    on:dblclick={() => rowDblClick(() => onlyTechniques(['computational']))}
                ><span class="inc-label">{TECHNIQUE_LABEL.computational}</span>
                  <span class="count">{techniqueCounts.computational ?? 0}</span>
                </button>
              </div>
            {/if}
          </section>

          <hr class="divider" />

          <section>
            <!-- The other half of which claims count: how the sample was
                 held for each claim, as two lists that combine. Form is where
                 the species was, medium what surrounded it, the same two
                 fields the legend's phase chips come from. Switched off, a
                 claim greys out in the card like an excluded technique's, and
                 a band left with none counts as unreferenced. -->
            <h3>Phases</h3>
            <button
              class="disclosure"
              on:click={() => (showPhases = !showPhases)}
              aria-expanded={showPhases}
            >
              <span class="caret">{showPhases ? '▾' : '▸'}</span>
              Counted
              <span class="count">{countedPhases} / {PHASE_ROW_COUNT}</span>
            </button>
            {#if showPhases}
              <div class="tech-filter">
                {#each PHASE_PARTS as part (part.key)}
                  <div class="phase-part">{part.label}</div>
                  {#each part.rows as ph (ph.key)}
                    <button
                      class="include-row tech-row tech-child"
                      class:off={excludedPhase[part.key].has(ph.key)}
                      aria-pressed={!excludedPhase[part.key].has(ph.key)}
                      title={ph.title}
                      on:click={() => rowClick(() => togglePhase(part.key, ph.key))}
                      on:dblclick={() => rowDblClick(() => onlyPhase(part.key, [ph.key]))}
                    ><span class="inc-label">{ph.label}</span>
                      <span class="count">{phaseCounts[part.key][ph.key] ?? 0}</span>
                    </button>
                  {/each}
                {/each}
              </div>
            {/if}
          </section>

          <hr class="divider" />

          <Sidebar
            groups={dataset.groups}
            sets={dataset.sets}
            sortedKeys={sortedGroupKeys}
            {enabledGroups}
            {showIsotopes}
            {inactiveMode}
            {unreferencedMode}
            {spectroscopy}
            on:groupToggle={handleGroupToggle}
            on:setSelect={handleSetSelect}
            on:isotopeToggle={e => showIsotopes = e.detail.enabled}
            on:inactiveMode={e => (inactiveMode = e.detail.mode)}
            on:unreferencedMode={e => (unreferencedMode = e.detail.mode)}
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
        <!-- A row, so the sidebar is a sibling of the plot AND the legend and
             the vertical scrollbar stays on the plot, to the sidebar's left.
             Inside the scroller it would have scrolled away with the lanes and
             pushed the scrollbar out to the window's edge. -->
        <div class="chart-row">
        <div class="chart-main">
        <div class="chart-scroll">
          <BandChart
            on:select={handleBandSelect}
            clearNonce={bandClearNonce}
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
            looks={{ inactive: inactiveMode === 'look', unreferenced: unreferencedMode === 'look' }}
            {claimFilter}
            {showRegions}
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
              hiddenTags={legendHiddenTags}
              {tagIsolate}
              {tagTips}
              on:tagToggle={handleTagToggle}
              on:tagDblClick={handleTagDblClick}
              on:tagHover={handleTagHover}
            />
          {/if}
        </div>
        </div><!-- chart-main -->

        {#if sideOpen}
          <aside class="band-side">
            {#if selectedHit}
              <BandCard
                td={selectedHit.tipData}
                color={selectedHit.color}
                full
                fill
                linkedModes={sideModes}
                playNonce={bandPlayNonce}
                on:navigateRef={handleNavigateRef}
                on:navigateMode={handleNavigateMode}
              />
            {:else}
              <p class="side-empty">
                No band selected. Click one in the chart to read it here, or
                <button class="side-empty-link" on:click={closeBandSide}>close the panel</button>.
              </p>
            {/if}
          </aside>
        {/if}
        </div><!-- chart-row -->
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
    width: 26px;
    height: 26px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-200);
    cursor: pointer;
    text-align: center;
    line-height: 1;
  }
  .page-mini-btn:hover { background: var(--surface-hover); color: var(--ink-700); }
  .page-mini-btn.active {
    background: var(--brand-tint);
    border-color: var(--brand-tint-line);
    color: var(--brand-accent);
  }
  /* The four destinations keep their own colour on the rail, the way they
     have it on the home page and in the sidebar's headings. An inactive one
     is drawn in the page's ink at rest and fills in once it is the page you
     are on, so the rail says where you are without needing a label. */
  .acc-green.active  { background: var(--accent-green-bg);  border-color: var(--accent-green-fg);  color: var(--accent-green-fg); }
  .acc-blue.active   { background: var(--accent-blue-bg);   border-color: var(--accent-blue-fg);   color: var(--accent-blue-fg); }
  .acc-amber.active  { background: var(--accent-amber-bg);  border-color: var(--accent-amber-fg);  color: var(--accent-amber-fg); }
  .acc-red.active    { background: var(--accent-red-bg);    border-color: var(--accent-red-fg);    color: var(--accent-red-fg); }
  .acc-green:hover  { color: var(--accent-green-fg); }
  .acc-blue:hover   { color: var(--accent-blue-fg); }
  .acc-amber:hover  { color: var(--accent-amber-fg); }
  .acc-red:hover    { color: var(--accent-red-fg); }

  /* A control, not a destination: no page colour, and a lighter border so the
     block below the rule does not compete with the menu above it. */
  .ctl-btn { border-color: var(--line-soft); color: var(--ink-300); }
  .ctl-btn:hover { color: var(--ink-700); }
  .ctl-btn.is-text { font-size: 10.5px; letter-spacing: 0.02em; }

  /* The cut between the menu and the page's controls, as the rail draws it.
     Same boundary as the open sidebar's heavy divider, and it stays even
     where the page has no controls, so the rail always reads in two parts. */
  .rail-rule {
    width: 26px;
    margin: 8px 0;
    border: none;
    border-top: 2px solid var(--line-boundary);
  }

  .mini-btn-wrap {
    position: relative;
    width: 26px;
  }

  /* What a rail button says when the pointer rests on it: its full name
     first, then whatever it offers. A destination has only the name; a
     control has the name and its options under it. */
  .fly {
    position: absolute;
    left: 30px;
    top: -4px;
    background: white;
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    box-shadow: var(--shadow-sm);
    z-index: 200;
    overflow: hidden;
    min-width: 132px;
    padding-bottom: 3px;
  }

  .fly-title {
    padding: 6px 10px 5px;
    border-bottom: 1px solid var(--line-soft);
    margin-bottom: 3px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-700);
    white-space: nowrap;
  }

  .fly-item {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 5px 10px;
    background: none;
    border: none;
    font-family: inherit;
    font-size: 12.5px;
    color: var(--ink-600);
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }
  .fly-item:hover { background: var(--surface-hover); }
  .fly-item.fly-on { color: var(--brand-accent); font-weight: 600; background: var(--brand-tint-soft); }

  /* On or off, said the way a checkbox says it and no other way: these four
     are switches, while the colour and the group filter are one-of-many. */
  .fly-box {
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border: 1px solid var(--line-strong);
    border-radius: 2px;
    background: white;
  }
  .fly-box.on { background: var(--brand-accent); border-color: var(--brand-accent); }

  .fly-rule {
    height: 1px;
    background: var(--line-soft);
    margin: 4px 0;
  }

  .fly-note {
    padding: 3px 10px 2px;
    font-size: 11.5px;
    font-style: italic;
    color: var(--ink-300);
    white-space: nowrap;
  }

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

  /* The one divider that separates two kinds of thing rather than two
     controls: above it the atlas, below it this page. */
  .divider.strong {
    border-top: 2px solid var(--line-boundary);
    margin: 14px 0;
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

  /* The chart page is a row: everything the chart owns on the left, the
     selected band's sidebar on the right. Both stretch, so the sidebar is a
     column the full height of the page rather than a card at the top of one. */
  .chart-row {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: stretch;
    gap: 12px;
  }

  .chart-main {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .band-side {
    flex: 0 0 var(--band-panel-w);
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 10px 12px 12px;
    background: var(--surface);
    border-left: 1px solid var(--line-panel);
    /* The page's own padding would otherwise leave the sidebar floating off
       the right edge; it runs to it instead, the way a sidebar does. */
    margin-right: -40px;
  }

  /* The empty column says what it is waiting for, in the same quiet grey the
     card's own hint line uses, and carries the only way to close the column.
     There is no ✕ over the card: a band's detail is what the column is for,
     and a close button sitting on top of it all day is chrome competing with
     content. Clearing the band (a click on empty chart) is the step before
     closing anyway, and that is where the offer belongs. */
  .side-empty {
    margin: 10px 2px 0;
    font-size: var(--t-tip-hint-size);
    color: var(--t-tip-hint-color);
    line-height: 1.6;
  }

  .side-empty-link {
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    color: var(--brand-700);
    text-decoration: underline;
    cursor: pointer;
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
  /* The two halves of the Phases list, Form and Medium: a label, not a
     switch, since the two combine rather than nest. */
  .phase-part {
    padding: 4px 0 1px;
    font-size: var(--t-nav-size);
    color: var(--ink-300);
  }

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

  /* The magnification is for the content. The header is chrome: scaling it
     only costs the room the content was meant to gain, so it is scaled back
     out of the shell's zoom and stays exactly the size it always is. Its
     width needs no help, because a percentage resolves against the parent in
     the parent's units and the header's own zoom then undoes the difference. */
  :global(html[data-presenting]) .app-header {
    zoom: calc(1 / var(--display-scale, 1));
  }

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

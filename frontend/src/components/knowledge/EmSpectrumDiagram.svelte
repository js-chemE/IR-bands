<script lang="ts">
  /**
   * The electromagnetic spectrum: one axis, cut into regions, and what a
   * photon of each region does to matter.
   *
   *   t = 0  the card: the whole spectrum as one bar, gamma rays on the left
   *          and radio waves on the right, fourteen decades on a logarithmic
   *          axis. High energy is on the left, the way an infrared spectrum
   *          is drawn. A photon rests on the infrared; playing, it moves from
   *          region to region and the caption under it names what it excites.
   *   t = 1  the opened card, three rows:
   *            one axis, seven regions: the same bar, what each region
   *              excites under it, and three scales against it (wavenumber,
   *              wavelength, photon energy);
   *            from the far-infrared to the ultraviolet: the stretch a
   *              catalyst lab works in, stretched out, with the parts of the
   *              infrared, the borders in the units they are quoted in, the
   *              band chart's own range and the Raman lasers;
   *            three kinds of level, decades apart: an electronic gap, the
   *              vibrational ladder inside one electronic level, and the
   *              rotational ladder inside one vibrational level.
   *          Playing, the photon steps through the regions and the ladder it
   *          fits is climbed.
   *
   * The regions, their borders and their names are lib/emSpectrum.ts, the
   * table the band chart draws from as well, so the card and the chart cannot
   * disagree about where the mid-infrared ends.
   */
  import { onDestroy } from 'svelte';
  import { EM_REGIONS, emRegionsAt, emLabel, type EmRegion } from '../../lib/emSpectrum';
  import { RAMAN_LASERS, toWavenumber } from '../../lib/units';
  import { lightColor } from '../../lib/lightColor';
  import { WN_LO, WN_HI } from '../../lib/chart';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 512 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  /* ── Clock ── */
  let clock = 0;
  let raf = 0;
  let started = 0;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function frame(now: number) {
    if (!started) started = now;
    clock = now - started;
    raf = requestAnimationFrame(frame);
  }
  $: running = playing && !reduced;
  $: if (running && !raf) {
    started = 0;
    raf = requestAnimationFrame(frame);
  } else if (!running && raf) {
    cancelAnimationFrame(raf);
    raf = 0;
    clock = 0;
  }
  onDestroy(() => raf && cancelAnimationFrame(raf));
  $: time = running ? clock / 1000 : 0;

  /* ── The whole spectrum: 100 m to 1 pm, high energy on the left ── */
  const LOG = { hi: 10, lo: -4 };
  $: bar = {
    x0: lerp(12, 84, t),
    x1: lerp(208, 456, t),
    y: lerp(30, 34, t),
    h: lerp(24, 22, t),
  };
  const clampLog = (wn: number) => Math.max(LOG.lo, Math.min(LOG.hi, Math.log10(Math.max(wn, 1e-30))));
  $: bx = (wn: number) => bar.x0 + ((LOG.hi - clampLog(wn)) / (LOG.hi - LOG.lo)) * (bar.x1 - bar.x0);

  /* A name fits by its length: the labels are monospace, so a character is a
     known width, and the longest spelling that fits is the one drawn. */
  const CHAR = 6.7;
  const named = (r: EmRegion, width: number) => emLabel(r, n => n.length * CHAR + 4 <= width);

  $: cells = EM_REGIONS.map(r => {
    const xa = bx(r.wnMax), xb = bx(r.wnMin);
    return { r, x: xa, w: xb - xa, label: named(r, xb - xa) };
  });

  /* ── The visible, in its own colours ── */
  const VIS = EM_REGIONS.find(r => r.key === 'visible')!;
  const VIS_NM = [380, 440, 490, 510, 580, 645, 700, 800];
  // Offsets along a logarithmic axis that runs from 380 nm (left) to 800 nm.
  const VIS_STOPS = VIS_NM.map(nm => ({ at: Math.log(nm / 380) / Math.log(800 / 380), color: lightColor(nm) }));
  // One card is drawn at a time, but the id must still be its own.
  const gradId = `em-vis-${Math.random().toString(36).slice(2, 8)}`;

  /* ── The photon, and where it stops ──────────────────────────────────
   * It rests on the infrared, where the atlas is. Playing, it steps down
   * through the low-energy regions and comes back in from the high end.
   * `ladder` is the row-3 panel the stop climbs, where there is one.
   */
  const STOPS: { wn: number; says: string; ladder?: number }[] = [
    { wn: 2143, says: 'vibrations', ladder: 1 },
    { wn: 3.9, says: 'rotations', ladder: 2 },
    { wn: toWavenumber(9.5, 'GHz'), says: 'electron spins' },
    { wn: toWavenumber(400, 'MHz'), says: 'nuclear spins' },
    { wn: toWavenumber(8, 'keV'), says: 'core electrons' },
    { wn: toWavenumber(300, 'nm'), says: 'valence electrons', ladder: 0 },
  ];
  const STOP = 1.8;    // one stop: the glide, then long enough to read
  const GLIDE = 0.6;
  $: stopIndex = running ? Math.floor(time / STOP) % STOPS.length : 0;
  // The first stop is where it already rests, so there is nothing to glide from.
  $: fromIndex = time < STOP ? 0 : (stopIndex - 1 + STOPS.length) % STOPS.length;
  $: arrive = running ? 1 - Math.pow(1 - Math.min(1, (time % STOP) / GLIDE), 3) : 1;
  $: photonX = lerp(bx(STOPS[fromIndex].wn), bx(STOPS[stopIndex].wn), arrive);
  $: stop = STOPS[stopIndex];

  /* ── Row 1: what each region excites, on two lines so neighbours clear ── */
  const region = (key: string) => EM_REGIONS.find(r => r.key === key)!;
  $: motions = [
    { text: 'nuclei', x: bar.x0, anchor: 'start', line: 1, says: [] as string[] },
    { text: 'core electrons', x: (bx(region('xray').wnMax) + bx(region('xray').wnMin)) / 2, anchor: 'middle', line: 0, says: ['core electrons'] },
    { text: 'valence electrons', x: (bx(region('uv').wnMax) + bx(VIS.wnMin)) / 2, anchor: 'middle', line: 1, says: ['valence electrons'] },
    { text: 'vibrations', x: (bx(region('ir').wnMax) + bx(region('ir').wnMin)) / 2, anchor: 'middle', line: 0, says: ['vibrations'] },
    { text: 'rotations · e⁻ spins', x: (bx(region('microwave').wnMax) + bx(region('microwave').wnMin)) / 2, anchor: 'middle', line: 1, says: ['rotations', 'electron spins'] },
    { text: 'nuclear spins', x: bar.x1, anchor: 'end', line: 0, says: ['nuclear spins'] },
  ];
  const MOTION_Y = [69, 81];

  /* Three scales against the one axis. Wavelength and energy change unit
     every three decades, so each tick carries its own. */
  const EV = toWavenumber(1, 'eV');
  const SCALES = [
    { label: 'ν̃ / cm⁻¹', y: 106, ticks: [
      { wn: 1e9, txt: '10⁹' }, { wn: 1e6, txt: '10⁶' }, { wn: 1e3, txt: '10³' }, { wn: 1, txt: '1' }, { wn: 1e-3, txt: '10⁻³' },
    ] },
    { label: 'λ', y: 132, ticks: [
      { wn: 1e10, txt: '1 pm' }, { wn: 1e7, txt: '1 nm' }, { wn: 1e4, txt: '1 µm' }, { wn: 10, txt: '1 mm' }, { wn: 0.01, txt: '1 m' },
    ] },
    { label: 'E', y: 158, ticks: [
      { wn: EV * 1e6, txt: '1 MeV' }, { wn: EV * 1e3, txt: '1 keV' }, { wn: EV, txt: '1 eV' }, { wn: EV * 1e-3, txt: '1 meV' }, { wn: EV * 1e-6, txt: '1 µeV' },
    ] },
  ];

  /* ── Row 2: 100 nm to 10 cm⁻¹, stretched out ── */
  const ZOOM = { x0: 40, x1: 440, hi: 5, lo: 1, y: 232, h: 22 };
  const zx = (wn: number) =>
    ZOOM.x0 + ((ZOOM.hi - Math.max(ZOOM.lo, Math.min(ZOOM.hi, Math.log10(wn)))) / (ZOOM.hi - ZOOM.lo)) * (ZOOM.x1 - ZOOM.x0);
  const ZOOM_TOP = 10 ** ZOOM.hi, ZOOM_BOTTOM = 10 ** ZOOM.lo;
  const zoomCells = emRegionsAt('sub')
    .filter(r => r.wnMax > ZOOM_BOTTOM && r.wnMin < ZOOM_TOP)
    .map(r => {
      const xa = zx(Math.min(r.wnMax, ZOOM_TOP)), xb = zx(Math.max(r.wnMin, ZOOM_BOTTOM));
      return { r, x: xa, w: xb - xa, label: named(r, xb - xa), border: r.wnMax < ZOOM_TOP };
    });
  // The borders, each in the unit it is quoted in; the unit is said once per run.
  const BORDERS = [
    { wn: toWavenumber(200, 'nm'), txt: '200', anchor: 'middle', dx: 0 },
    { wn: toWavenumber(380, 'nm'), txt: '380', anchor: 'middle', dx: 0 },
    { wn: toWavenumber(800, 'nm'), txt: '800 nm', anchor: 'start', dx: -10 },
    { wn: 4000, txt: '4000', anchor: 'middle', dx: 0 },
    { wn: 400, txt: '400', anchor: 'middle', dx: 0 },
    { wn: 10, txt: '10 cm⁻¹', anchor: 'end', dx: 0 },
  ];
  const LIVES = [
    { text: 'electronic', x: (zx(ZOOM_TOP) + zx(VIS.wnMin)) / 2, line: 0 },
    { text: 'overtones', x: (zx(VIS.wnMin) + zx(4000)) / 2, line: 1 },
    { text: 'fundamentals', x: (zx(4000) + zx(400)) / 2, line: 0 },
    { text: 'lattice, frustrated motion', x: (zx(400) + zx(10)) / 2, line: 1 },
  ];
  const LASERS = RAMAN_LASERS.map(l => ({ nm: l.nm, x: zx(1e7 / l.nm), color: lightColor(l.nm) }));
  const LASER_MID = (LASERS[0].x + LASERS[LASERS.length - 1].x) / 2;
  const CHART = { xa: zx(WN_HI), xb: zx(WN_LO), y: 224 };

  /* ── Row 3: three ladders, each inside one level of the one before ── */
  const BASE = 446;
  const LADDERS = [
    { name: 'electronic', x0: 40, x1: 140, levels: [BASE, 360], step: [0, 1], low: 'ground', high: 'excited', gap: '10⁴ to 10⁵ cm⁻¹', where: 'visible, ultraviolet' },
    { name: 'vibrational', x0: 190, x1: 290, levels: [BASE, 424, 403, 383, 364], step: [0, 1], low: 'v = 0', high: 'v = 4', gap: '400 to 4000 cm⁻¹', where: 'mid-infrared' },
    // A rigid rotor: E ∝ J(J + 1), so the rungs draw apart as J rises. Its
    // step starts from J = 3, not 0: at room temperature a gas is spread
    // over many rotational levels, and the lowest gap is too small to draw.
    { name: 'rotational', x0: 340, x1: 440, levels: [0, 1, 2, 3, 4, 5].map(j => BASE - (86 * j * (j + 1)) / 30), step: [3, 4], low: 'J = 0', high: 'J = 5', gap: '1 to 100 cm⁻¹', where: 'microwave, far-infrared' },
  ];
  // The finer ladder, drawn small on the level it sits in.
  const MINI = [
    { x0: 100, x1: 140, ys: [BASE - 5, BASE - 10, BASE - 15] },
    { x0: 100, x1: 140, ys: [360 - 5, 360 - 10, 360 - 15] },
    { x0: 250, x1: 290, ys: [BASE - 3, BASE - 6, BASE - 9] },
  ];
  // From the small ladder out to the large one: the same levels, magnified.
  const MAGNIFY = [
    { x1: 140, y1: BASE, x2: 190, y2: BASE },
    { x1: 140, y1: BASE - 15, x2: 190, y2: 364 },
    { x1: 290, y1: BASE, x2: 340, y2: BASE },
    { x1: 290, y1: BASE - 9, x2: 340, y2: 360 },
  ];
  /** How far the transition arrow of a ladder has climbed, 0 to 1. */
  $: climb = (i: number) => (!running ? 1 : stop.ladder === i ? arrive : 0);

  $: cardOpacity = 1 - ramp(t, 0.1, 0.5);
  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="The electromagnetic spectrum from gamma rays to radio waves on a logarithmic axis, what each region excites, the infrared to the ultraviolet stretched out with its borders, and the electronic, vibrational and rotational level spacings that put them decades apart"
>
  <defs>
    <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
      {#each VIS_STOPS as s}
        <stop offset={s.at} stop-color={s.color} />
      {/each}
    </linearGradient>
  </defs>

  <!-- ── The spectrum: one bar, seven regions ── -->
  {#each cells as c (c.r.key)}
    {#if c.r.key === 'visible'}
      <rect class="cell vis" x={c.x} y={bar.y} width={c.w} height={bar.h} fill="url(#{gradId})" />
    {:else}
      <rect class="cell" class:home={c.r.key === 'ir'} x={c.x} y={bar.y} width={c.w} height={bar.h} style="fill:var(--em-{c.r.key})" />
    {/if}
    {#if c.label}
      <text class="tick name" class:home={c.r.key === 'ir'} x={c.x + c.w / 2} y={bar.y + bar.h / 2 + 4} text-anchor="middle">{c.label}</text>
    {/if}
  {/each}
  {#each cells.filter(c => Number.isFinite(c.r.wnMax)) as c (c.r.key)}
    <line class="border" x1={c.x} x2={c.x} y1={bar.y - 3} y2={bar.y + bar.h + 3} />
  {/each}
  <rect class="frame" x={bar.x0} y={bar.y} width={bar.x1 - bar.x0} height={bar.h} />

  <!-- The photon: where on the axis it is, and on the card what it excites. -->
  <line class="photon" x1={photonX} x2={photonX} y1={bar.y - 6} y2={bar.y + bar.h + 6} />
  <g style="opacity:{cardOpacity}">
    <text class="lbl photon-says" x={Math.max(bar.x0 + 40, Math.min(bar.x1 - 40, photonX))} y={bar.y + bar.h + 22} text-anchor="middle">{stop.says}</text>
    <text class="tick" x={bar.x0} y={bar.y - 9}>high energy</text>
    <text class="tick" x={bar.x1} y={bar.y - 9} text-anchor="end">low</text>
  </g>

  <!-- ── Row 1, opened: what each region excites, and three scales ── -->
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">One Axis, Seven Regions</text>
    {#each motions as m (m.text)}
      <text class="tick" class:on={running && m.says.includes(stop.says)} x={m.x} y={MOTION_Y[m.line]} text-anchor={m.anchor}>{m.text}</text>
    {/each}
    {#each SCALES as sc (sc.label)}
      <text class="lbl strong" x="14" y={sc.y + 4}>{sc.label}</text>
      {#each sc.ticks as tk}
        <text class="tick" x={bx(tk.wn)} y={sc.y - 7} text-anchor="middle">{tk.txt}</text>
      {/each}
    {/each}
  </g>
  <g style="opacity:{fullOpacity}">
    {#each SCALES as sc (sc.label)}
      <line class="axis" x1={bar.x0} x2={bar.x1} y1={sc.y} y2={sc.y} />
      {#each sc.ticks as tk}
        <line class="axis" x1={bx(tk.wn)} x2={bx(tk.wn)} y1={sc.y} y2={sc.y - 4} />
      {/each}
    {/each}
    <!-- The stretch the next row spreads out. -->
    <path class="dim" d="M {bx(ZOOM_TOP)} {bar.y - 3} V {bar.y - 7} H {bx(ZOOM_BOTTOM)} V {bar.y - 3}" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="tick" x={bx(ZOOM_BOTTOM) + 5} y={bar.y - 5}>spread out below</text>
  </g>

  <!-- ── Row 2: from the far-infrared to the ultraviolet ── -->
  <g style="opacity:{fullOpacity}">
    {#each zoomCells as c (c.r.key)}
      {#if c.r.key === 'visible'}
        <rect class="cell vis" x={c.x} y={ZOOM.y} width={c.w} height={ZOOM.h} fill="url(#{gradId})" />
      {:else}
        <rect class="cell" class:home={c.r.key === 'mid-ir'} x={c.x} y={ZOOM.y} width={c.w} height={ZOOM.h} style="fill:var(--em-{c.r.key})" />
      {/if}
      {#if c.border}
        <line class="border" x1={c.x} x2={c.x} y1={ZOOM.y - 3} y2={ZOOM.y + ZOOM.h + 5} />
      {/if}
    {/each}
    <line class="border" x1={ZOOM.x1} x2={ZOOM.x1} y1={ZOOM.y - 3} y2={ZOOM.y + ZOOM.h + 5} />
    <rect class="frame" x={ZOOM.x0} y={ZOOM.y} width={ZOOM.x1 - ZOOM.x0} height={ZOOM.h} />
    {#each LASERS as l (l.nm)}
      <line class="laser" x1={l.x} x2={l.x} y1={ZOOM.y - 7} y2={ZOOM.y} stroke={l.color} />
    {/each}
    <path class="dim" d="M {CHART.xa} {CHART.y + 4} V {CHART.y} H {CHART.xb} V {CHART.y + 4}" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="196">From the Far-Infrared to the Ultraviolet</text>
    {#each zoomCells as c (c.r.key)}
      {#if c.label}
        <text class="tick name" class:home={c.r.key === 'mid-ir'} x={c.x + c.w / 2} y={ZOOM.y + ZOOM.h / 2 + 4} text-anchor="middle">{c.label}</text>
      {/if}
    {/each}
    {#each BORDERS as b}
      <text class="tick" x={zx(b.wn) + b.dx} y={ZOOM.y + ZOOM.h + 16} text-anchor={b.anchor}>{b.txt}</text>
    {/each}
    {#each LIVES as l (l.text)}
      <text class="tick" x={l.x} y={ZOOM.y + ZOOM.h + 31 + 12 * l.line} text-anchor="middle">{l.text}</text>
    {/each}
    <text class="tick" x={LASER_MID} y={ZOOM.y - 11} text-anchor="middle">Raman lasers</text>
    <text class="tick name" x={(CHART.xa + CHART.xb) / 2} y={CHART.y - 5} text-anchor="middle">band chart</text>
  </g>

  <!-- ── Row 3: three kinds of level, decades apart ── -->
  <g style="opacity:{fullOpacity}">
    {#each MAGNIFY as m}
      <line class="construction" x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />
    {/each}
    {#each MINI as m}
      {#each m.ys as y}
        <line class="level mini" x1={m.x0} x2={m.x1} y1={y} y2={y} />
      {/each}
    {/each}
    {#each LADDERS as l, i (l.name)}
      {#each l.levels as y}
        <line class="level" x1={l.x0} x2={l.x1} y1={y} y2={y} />
      {/each}
      <!-- One quantum up: the step a photon of that region fits. -->
      {#if climb(i) > 0}
        {@const x = l.x0 + 52}
        {@const foot = l.levels[l.step[0]]}
        {@const tip = lerp(foot, l.levels[l.step[1]], climb(i))}
        <line class="step" x1={x} x2={x} y1={foot} y2={tip} />
        {#if foot - tip > 5}
          <path class="step head" d="M {x - 3} {tip + 5} L {x} {tip} L {x + 3} {tip + 5}" />
        {/if}
      {/if}
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="326">Three Kinds of Level, Decades Apart</text>
    {#each LADDERS as l, i (l.name)}
      <!-- Under the lowest rung, not on it: the rotational rungs start too
           close together for a label to sit between them. -->
      <text class="tick" x={l.x0} y={l.levels[0] + 11}>{l.low}</text>
      <text class="tick" x={l.x0} y={l.levels[l.levels.length - 1] - 4}>{l.high}</text>
      <text class="lbl strong" class:on={running && stop.ladder === i} x={(l.x0 + l.x1) / 2} y={BASE + 28} text-anchor="middle">{l.name}</text>
      <text class="tick" x={(l.x0 + l.x1) / 2} y={BASE + 42} text-anchor="middle">{l.gap}</text>
      <text class="tick" x={(l.x0 + l.x1) / 2} y={BASE + 55} text-anchor="middle">{l.where}</text>
    {/each}
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  /* A region is a tint, never a full colour; the one the atlas lives in is
     inked a step stronger, which is all that marks it. */
  .cell { fill-opacity: 0.2; }
  .cell.home { fill-opacity: 0.42; }
  .cell.vis { fill-opacity: 0.85; }
  .frame { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  .border { stroke: var(--ink-050); stroke-width: 1; stroke-dasharray: 3 2; }
  .construction { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 3; }
  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .dim { fill: none; stroke: var(--ink-050); stroke-width: 1; }

  /* The subject: the photon, warm as on every other card. */
  .photon { stroke: var(--diagram-photon); stroke-width: 1.8; stroke-linecap: round; }
  .photon-says { fill: var(--diagram-photon); }

  .laser { stroke-width: 1.6; }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.4; }
  .level.mini { stroke: var(--line-slate-strong); stroke-width: 1; }
  .step { stroke: var(--accent-green-fg); stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.8), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
  .tick.name { fill: var(--ink-slate-500); }
  .tick.name.home { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }
  .tick.on { fill: var(--diagram-photon); }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
  .lbl.on { fill: var(--accent-green-fg); }
</style>

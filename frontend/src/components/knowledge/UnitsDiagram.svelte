<script lang="ts">
  /**
   * Spectral units: the horizontal axis of a spectrum, where a band sits.
   *
   *   t = 0  the card: a small spectrum with its horizontal axis lit in the
   *          Knowledge green (the vertical one is the Spectral
   *          Representations card's). Playing, the axis relabels itself in
   *          cm⁻¹, µm, THz and eV while the bands stay where they are.
   *   t = 1  the opened card, three rows:
   *            one band, many numbers: CO at 2143 cm⁻¹ = 4.67 µm = 64.2 THz =
   *              0.266 eV = 25.6 kJ/mol;
   *            four scales laid against one axis: wavelength bunches up at
   *              the low-wavenumber end, energy and frequency do not;
   *            from the light's energy to the Raman shift: the laser and
   *              its Stokes and anti-Stokes lines on the energy axis, carried
   *              onto the shift axis (laser minus light), which runs the
   *              other way; playing, the lines slide from one to the other;
   *            two lasers, one shift: 2143 cm⁻¹ from 532 and 785 nm.
   *   The second row lights the scale the card's axis is showing.
   *
   * The conversions are exact: ν̃ = 1/λ, ν = c ν̃, E = hc ν̃.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 574 };

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

  /* ── Conversions ── */
  const EV_PER_CM = 1.23984e-4;
  const THZ_PER_CM = 0.0299792;
  const UNITS = [
    { unit: 'cm⁻¹', name: 'wavenumber', of: (wn: number) => wn.toFixed(0) },
    { unit: 'µm', name: 'wavelength', of: (wn: number) => (10000 / wn).toFixed(1) },
    { unit: 'THz', name: 'frequency', of: (wn: number) => (wn * THZ_PER_CM).toFixed(0) },
    { unit: 'eV', name: 'energy', of: (wn: number) => (wn * EV_PER_CM).toFixed(2) },
  ];
  $: unitIndex = running ? Math.floor(time / 1.6) % UNITS.length : 0;

  /* ── The small spectrum, and row 1 once opened ── */
  $: fr = {
    x0: lerp(22, 40, t),
    x1: lerp(210, 300, t),
    top: lerp(14, 34, t),
    base: lerp(80, 134, t),
  };
  $: wx = (wn: number) => fr.x0 + ((4000 - wn) / 3600) * (fr.x1 - fr.x0);
  const BANDS = [
    { wn: 3400, h: 0.45, w: 180 },
    { wn: 2143, h: 0.9, w: 40 },
    { wn: 1600, h: 0.35, w: 60 },
    { wn: 1050, h: 0.6, w: 70 },
  ];
  $: trace = 'M' + Array.from({ length: 181 }, (_, i) => 4000 - i * 20)
    .map(wn => {
      const y = BANDS.reduce((a, b) => a + b.h * Math.exp(-(((wn - b.wn) / b.w) ** 2)), 0);
      return `${wx(wn).toFixed(1)},${(fr.base - y * (fr.base - fr.top) * 0.9).toFixed(1)}`;
    })
    .join(' L');
  const TICKS = [4000, 3000, 2000, 1000];

  const CO_LIST = [
    { v: '2143', u: 'cm⁻¹' },
    { v: '4.67', u: 'µm' },
    { v: '64.2', u: 'THz' },
    { v: '0.266', u: 'eV' },
    { v: '25.6', u: 'kJ/mol' },
  ];

  /* ── Row 2: four scales against one axis ── */
  const AX = { x0: 96, x1: 456 };
  const sx = (wn: number) => AX.x0 + ((4000 - wn) / 3600) * (AX.x1 - AX.x0);
  const SCALES = [
    { unit: 'cm⁻¹', sym: 'ν̃', y: 200, ticks: [4000, 3000, 2000, 1000, 400].map(wn => ({ wn, txt: `${wn}` })) },
    { unit: 'µm', sym: 'λ', y: 228, ticks: [2.5, 3, 4, 5, 10, 25].map(um => ({ wn: 10000 / um, txt: `${um}` })) },
    { unit: 'THz', sym: 'ν', y: 256, ticks: [100, 75, 50, 25, 12].map(f => ({ wn: f / THZ_PER_CM, txt: `${f}` })) },
    { unit: 'eV', sym: 'E', y: 284, ticks: [0.4, 0.3, 0.2, 0.1, 0.05].map(e => ({ wn: e / EV_PER_CM, txt: `${e}` })) },
  ];

  /* ── Row 3: from the energy of the light to the Raman shift ── */
  // A 532 nm laser, 18 797 cm⁻¹. On the upper axis the lines sit at the
  // energy of the scattered light, higher to the right; subtracting each from
  // the laser puts them on the shift axis below, where the laser is zero and
  // the Stokes lines, which lost energy, count up to the right. The two axes
  // run opposite ways, so the connectors cross. Playing, the lines slide down.
  const LASER = 18797;
  const EN = { x0: 96, x1: 456, lo: 15500, hi: 20500, y: 364 };
  const ex = (wn: number) => EN.x0 + ((wn - EN.lo) / (EN.hi - EN.lo)) * (EN.x1 - EN.x0);
  const SH = { x0: 96, x1: 456, lo: -1500, hi: 3500, y: 424 };
  const shx = (d: number) => SH.x0 + ((d - SH.lo) / (SH.hi - SH.lo)) * (SH.x1 - SH.x0);
  const RLINES = [
    { d: 0, h: 30, kind: 'laser' },
    { d: 1388, h: 20, kind: 'stokes' },
    { d: 2143, h: 14, kind: 'stokes' },
    { d: -1388, h: 7, kind: 'anti' },
  ];
  $: slide = running && t > 0.9 ? (1 - Math.cos((2 * Math.PI * time) / 3.2)) / 2 : 0;

  /* ── Row 4: one shift, two lasers ── */
  const NM = { x0: 96, x1: 456, lo: 500, hi: 1000 };
  const nx = (nm: number) => NM.x0 + ((nm - NM.lo) / (NM.hi - NM.lo)) * (NM.x1 - NM.x0);
  const shifted = (laserNm: number, shift: number) => 1e7 / (1e7 / laserNm - shift);
  const LASERS = [
    { nm: 532, y: 494 },
    { nm: 785, y: 522 },
  ].map(l => ({ ...l, out: shifted(l.nm, 2143) }));
  const NM_Y = 540;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="The horizontal axis of a spectrum, where a band sits: one position in wavenumber, wavelength, frequency and energy, and the Raman shift, the same from any laser"
>
  <!-- ── The spectrum: its horizontal axis lit ── -->
  <line class="axis faint" x1={fr.x0} x2={fr.x0} y1={fr.top} y2={fr.base} />
  <line class="axis lit" x1={fr.x0} x2={fr.x1 + 4} y1={fr.base} y2={fr.base} />
  <path class="axis-head lit" d="M {fr.x1} {fr.base - 3} L {fr.x1 + 5} {fr.base} L {fr.x1} {fr.base + 3}" />
  <path class="trace" d={trace} />
  {#each TICKS as wn}
    <line class="axis lit" x1={wx(wn)} x2={wx(wn)} y1={fr.base} y2={fr.base + 3} />
    <text class="tick lit" x={wx(wn)} y={fr.base + 12} text-anchor="middle">{UNITS[unitIndex].of(wn)}</text>
  {/each}
  <text class="tick lit" x={fr.x1 + 6} y={fr.top + 4} text-anchor="end">{UNITS[unitIndex].name} / {UNITS[unitIndex].unit}</text>

  <g style="opacity:{fullOpacity}">
    <line class="marker" x1={wx(2143)} x2={wx(2143)} y1={fr.top} y2={fr.base} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">One Band, Five Numbers</text>
    <text class="lbl faint" x={wx(2143) + 5} y={fr.top + 6}>CO</text>
    {#each CO_LIST as c, i}
      <text class="lbl" class:strong={i === 0} class:on={i === unitIndex} x="392" y={52 + 18 * i} text-anchor="end">{c.v}</text>
      <text class="lbl faint" class:on={i === unitIndex} x="398" y={52 + 18 * i}>{c.u}</text>
    {/each}
  </g>

  <!-- ── Row 2: four scales against one axis ── -->
  <g style="opacity:{fullOpacity}">
    {#each SCALES as sc (sc.unit)}
      <line class="axis" class:lit={sc.unit === UNITS[unitIndex].unit} x1={AX.x0} x2={AX.x1} y1={sc.y} y2={sc.y} />
      {#each sc.ticks as tk}
        <line class="axis" class:lit={sc.unit === UNITS[unitIndex].unit} x1={sx(tk.wn)} x2={sx(tk.wn)} y1={sc.y} y2={sc.y - 4} />
      {/each}
    {/each}
    <line class="marker" x1={sx(2143)} x2={sx(2143)} y1={SCALES[0].y - 10} y2={SCALES[3].y + 4} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="176">Four Scales, One Axis</text>
    {#each SCALES as sc (sc.unit)}
      <text class="lbl strong" class:on={sc.unit === UNITS[unitIndex].unit} x="14" y={sc.y + 4}>{sc.sym} / {sc.unit}</text>
      {#each sc.ticks as tk}
        <text class="tick" class:lit={sc.unit === UNITS[unitIndex].unit} x={sx(tk.wn)} y={sc.y - 7} text-anchor="middle">{tk.txt}</text>
      {/each}
    {/each}
  </g>

  <!-- ── Row 3: from the energy of the light to the shift ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis" x1={EN.x0} x2={EN.x1} y1={EN.y} y2={EN.y} />
    <line class="axis lit" x1={SH.x0} x2={SH.x1} y1={SH.y} y2={SH.y} />
    {#each [16000, 17000, 18000, 19000, 20000] as wn}
      <line class="axis" x1={ex(wn)} x2={ex(wn)} y1={EN.y} y2={EN.y + 4} />
    {/each}
    {#each [-1000, 0, 1000, 2000, 3000] as d}
      <line class="axis lit" x1={shx(d)} x2={shx(d)} y1={SH.y} y2={SH.y + 4} />
    {/each}
    {#each RLINES as l}
      <!-- Where each line starts and where it lands, joined. -->
      <line class="connector" x1={ex(LASER - l.d)} y1={EN.y} x2={shx(l.d)} y2={SH.y - l.h} />
      <line class="ghost-line" x1={shx(l.d)} x2={shx(l.d)} y1={SH.y} y2={SH.y - l.h} />
      <line
        class="rline {l.kind}"
        x1={lerp(ex(LASER - l.d), shx(l.d), slide)}
        x2={lerp(ex(LASER - l.d), shx(l.d), slide)}
        y1={lerp(EN.y, SH.y, slide)}
        y2={lerp(EN.y, SH.y, slide) - l.h}
      />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="318">Raman: From the Light’s Energy to the Shift</text>
    <text class="lbl strong" x="14" y={EN.y + 4}>light</text>
    <text class="lbl strong on" x="14" y={SH.y + 4}>shift</text>
    {#each [16000, 17000, 18000, 19000, 20000] as wn}
      <text class="tick" x={ex(wn)} y={EN.y + 14} text-anchor="middle">{wn}</text>
    {/each}
    {#each [-1000, 0, 1000, 2000, 3000] as d}
      <text class="tick lit" x={shx(d)} y={SH.y + 14} text-anchor="middle">{d}</text>
    {/each}
    <text class="tick" x={ex(LASER)} y={EN.y - 34} text-anchor="middle">laser, 532 nm</text>
    <text class="tick" x={ex(LASER - 1766)} y={EN.y - 24} text-anchor="middle">Stokes</text>
    <text class="tick" x={ex(LASER + 1388)} y={EN.y - 12} text-anchor="middle">anti-Stokes</text>
    <text class="tick" x={EN.x1} y={EN.y + 26} text-anchor="end">ν̃ of the light / cm⁻¹</text>
    <text class="tick lit" x={SH.x1} y={SH.y + 26} text-anchor="end">Raman shift / cm⁻¹</text>
  </g>

  <!-- ── Row 4: two lasers, one shift ── -->
  <g style="opacity:{fullOpacity}">
    <line class="axis" x1={NM.x0} x2={NM.x1} y1={NM_Y} y2={NM_Y} />
    {#each [500, 600, 700, 800, 900, 1000] as nm}
      <line class="axis" x1={nx(nm)} x2={nx(nm)} y1={NM_Y} y2={NM_Y + 4} />
    {/each}
    {#each LASERS as l (l.nm)}
      <line class="laser" x1={nx(l.nm)} x2={nx(l.nm)} y1={l.y - 9} y2={l.y + 5} />
      <line class="stokes" x1={nx(l.out)} x2={nx(l.out)} y1={l.y - 9} y2={l.y + 5} />
      <line class="span" x1={nx(l.nm) + 2} x2={nx(l.out) - 2} y1={l.y - 2} y2={l.y - 2} />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="470">Two Lasers, One Shift</text>
    {#each LASERS as l (l.nm)}
      <text class="lbl strong" x="14" y={l.y + 4}>{l.nm} nm</text>
      <text class="tick" x={(nx(l.nm) + nx(l.out)) / 2} y={l.y - 13} text-anchor="middle">2143 cm⁻¹</text>
      <text class="tick" x={nx(l.out) + 6} y={l.y + 4}>{l.out.toFixed(0)} nm</text>
    {/each}
    {#each [500, 600, 700, 800, 900, 1000] as nm}
      <text class="tick" x={nx(nm)} y={NM_Y + 14} text-anchor="middle">{nm}</text>
    {/each}
    <text class="tick" x={NM.x1} y={NM_Y + 26} text-anchor="end">λ of the light / nm</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .axis.faint { stroke: var(--line-slate); }
  /* The axis this card is about, in the Knowledge green. */
  .axis.lit, .axis-head.lit { stroke: var(--accent-green-fg); stroke-width: 1.4; }
  .axis-head { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.3; stroke-linejoin: round; }
  .marker { stroke: var(--diagram-photon); stroke-width: 1.1; stroke-dasharray: 3 2; }

  .laser { stroke: var(--diagram-laser); stroke-width: 2; }
  .stokes { stroke: var(--diagram-stokes); stroke-width: 2; }
  .span { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 2 2; }
  .connector { stroke: var(--ink-025); stroke-width: 0.8; stroke-dasharray: 2 2; }
  .ghost-line { stroke: var(--ink-025); stroke-width: 1.4; opacity: 0.5; }
  .rline { stroke-width: 2.2; stroke-linecap: round; }
  .rline.laser { stroke: var(--diagram-laser); }
  .rline.stokes { stroke: var(--diagram-stokes); }
  .rline.anti { stroke: var(--diagram-anti-stokes); }
  .lbl.on { fill: var(--accent-green-fg); }

  .tick {
    font-family: var(--t-code-ff);
    font-size: calc(var(--t-code-size) * 0.8);
    fill: var(--ink-050);
  }
  .tick.lit { fill: var(--accent-green-fg); }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.strong, .lbl.name { fill: var(--ink-slate-900); }
</style>

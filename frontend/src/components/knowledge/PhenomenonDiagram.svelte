<script lang="ts">
  /**
   * The Band patterns cards: one small diagram per phenomenon, chosen by
   * `kind` (the phenomenon's key in lib/phenomena.ts).
   *
   * Every diagram has the same two halves: on the left what happens to the
   * molecule or its levels, on the right what that does to a little spectrum
   * (wavenumber falling to the right, as on the IR card). At rest the still
   * already shows the effect; while `playing` it runs in and out, so the
   * spectrum can be watched changing with the cause.
   *
   * Opened, the same drawing is simply shown twice as large, with its labels.
   * The labels are sized in drawing units at half the code size, so they land
   * at the code size once scaled up.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let kind = '';
  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  const W = 220;
  const H = 100;
  $: scale = lerp(238 / 220, 2, t);

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
  /**
   * How far the effect is switched on, 0 … 1. At rest each diagram shows
   * its phenomenon (1), except degeneracy, whose point is the single band
   * before the symmetry is lowered (0). Playing, it goes out and back over
   * four seconds.
   */
  const REST: Record<string, number> = { degeneracy: 0 };
  $: rest = REST[kind] ?? 1;
  $: k = running
    ? (1 - Math.cos(2 * Math.PI * 0.25 * time + (rest ? Math.PI : 0))) / 2
    : rest;

  /* ── The little spectrum on the right ── */
  const SX0 = 110;
  const SX1 = 212;
  const BASE = 86;
  /**
   * Where a signal drawn *downward* hangs from. Chosen so that the deepest
   * dip bottoms out on BASE, the floor every other diagram's baseline sits
   * on, and the two halves of the page keep one horizon.
   */
  const HANG = 40;
  type Peak = { x: number; h: number; w: number; ghost?: boolean };
  /** `base` is the baseline; `dir` is -1 for peaks up, +1 for dips down. */
  function trace(peaks: Peak[], base = BASE, dir = -1): string {
    const pts: string[] = [];
    for (let x = SX0; x <= SX1; x += 0.5) {
      let y = 0;
      for (const p of peaks) if (!p.ghost) y += p.h * Math.exp(-(((x - p.x) / p.w) ** 2));
      pts.push(`${x.toFixed(1)},${(base + dir * y).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  function ghostPath(p: Peak, base = BASE, dir = -1): string {
    const pts: string[] = [];
    for (let x = p.x - 3 * p.w; x <= p.x + 3 * p.w; x += 0.5) {
      pts.push(`${x.toFixed(1)},${(base + dir * p.h * Math.exp(-(((x - p.x) / p.w) ** 2))).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  /* ── Per kind ── */
  $: vib = Math.sin(2 * Math.PI * 1.1 * time); // a quick stretch, for molecules that move

  // Fermi: two levels close in energy repel and share intensity.
  $: fermi = {
    upper: 42 - 9 * k,
    lower: 52 + 9 * k,
    peaks: [
      { x: 156 - 13 * k, h: 44 * (1 - 0.42 * k), w: 3 },
      { x: 170 + 13 * k, h: 44 * 0.78 * k + 1, w: 3 },
    ] as Peak[],
  };

  // Isotope: the oxygen grows heavier, the band slides to lower wavenumber.
  $: iso = {
    rO: lerp(5.4, 7, k),
    peak: { x: 150 + 24 * k, h: 44, w: 4 } as Peak,
    ghost: { x: 150, h: 44, w: 4, ghost: true } as Peak,
    stretch: 3 * vib * (1 - 0.2 * k),
  };

  // Overtone: the weak two-level step, and its weak band at a bit under twice.
  $: combo = [
    { x: 182, h: 44, w: 3 },
    { x: 126, h: 12 * k + 0.5, w: 3.5 },
  ] as Peak[];

  /**
   * Degeneracy: one ball per mode, so CO₂'s bend moves two molecules.
   *
   * They bob in step while they share a frequency. Once the surface makes
   * the in-plane and out-of-plane directions different, one runs faster and
   * the two visibly drift apart, which is the same fact the spectrum shows.
   *
   * The band is two peaks of equal height sitting on top of each other, so
   * `trace()` sums them into one peak of twice the height on its own: the
   * single band really is the two components, and the drawing says so
   * rather than asserting it.
   */
  /**
   * One excited level, drawn twice because it is two modes at one energy,
   * with an arrow up to each; and the band below it drawn as the two equal
   * contributions it is made of.
   *
   * Both pairs come apart and merge again rather than splitting for good:
   * nothing in the animation lowers the symmetry, so the point being made
   * is that the single line and the single band are each already a pair.
   * What a real loss of symmetry does is the prose's job.
   */
  $: split = 7 * Math.sin(Math.PI * k);
  $: sep = 13 * Math.sin(Math.PI * k);
  $: degen = {
    peaks: [
      { x: 160 - sep, h: 23, w: 3.4 },
      { x: 160 + sep, h: 23, w: 3.4 },
    ] as Peak[],
  };

  // Site: CO hops from a cation to a top site to a bridge; the band moves.
  // Spaced so the three one-word labels under the peaks stay clear of each other.
  const SITES = [
    { x: 76, y: 66, wn: 124, label: 'cation' },
    { x: 40, y: 64, wn: 156, label: 'top' },
    { x: 49, y: 67, wn: 192, label: 'bridge' },
  ];
  $: siteIndex = running ? Math.floor(time / 1.6) % 3 : 1;
  $: siteBlend = running ? ramp((time % 1.6) / 1.6, 0, 0.35) : 1;
  $: prevSite = SITES[(siteIndex + 2) % 3];
  $: site = SITES[siteIndex];
  $: coX = lerp(prevSite.x, site.x, siteBlend);
  $: coY = lerp(prevSite.y, site.y, siteBlend);
  $: sitePeak = { x: lerp(prevSite.wn, site.wn, siteBlend), h: 44, w: 3.5 } as Peak;

  // Coverage: the surface fills, the neighbours compete for the same
  // back-donation, the C-O bond stiffens and the band climbs. Higher
  // wavenumber is to the LEFT, so the peak slides that way.
  const METALS = [22, 40, 58, 76];
  $: cov = {
    // The three extra molecules arrive one after another, not together.
    arrived: METALS.map((_, i) => (i === 1 ? 1 : ramp(k, 0.1 * i, 0.35 + 0.22 * i))),
    peak: { x: lerp(178, 150, k), h: 44, w: 3.5 } as Peak,
    ghost: { x: 178, h: 44, w: 3.5, ghost: true } as Peak,
    stretch: 2.2 * vib,
  };

  // Coupling: two neighbours stop being independent oscillators. Their
  // phase difference closes from opposite to together as k rises, the
  // in-phase mode takes the intensity and sits above the singleton, and
  // the out-of-phase one is left dark.
  $: cpl = {
    a: 2.6 * Math.sin(2 * Math.PI * 1.1 * time),
    b: 2.6 * Math.sin(2 * Math.PI * 1.1 * time + Math.PI * (1 - k)),
    bright: { x: lerp(174, 152, k), h: lerp(44, 48, k), w: 3.2 } as Peak,
    singleton: { x: 174, h: 44, w: 3.2, ghost: true } as Peak,
    // Drawn as an outline: a real normal mode of the pair, with no dipole
    // change to make it absorb.
    dark: { x: lerp(174, 194, k), h: 11, w: 3.2, ghost: true } as Peak,
  };

  /** Degeneracy hangs its signal from HANG; everything else stands on BASE. */
  $: axisY = kind === 'degeneracy' ? HANG : BASE;

  $: labelOpacity = ramp(t, 0.75, 1);

  const up = (x: number, y: number) => `M${x - 2.6},${y + 4} L${x},${y} L${x + 2.6},${y + 4}`;

  const C_FILL = colorForElement('C');
  const O_FILL = colorForElement('O');
  const M_FILL = colorForElement('M');
</script>

<svg class="diagram" width={W * scale} height={H * scale} viewBox="0 0 {W} {H}" role="img" aria-label="{kind} diagram">
  <line class="axis" x1={SX0} x2={SX1} y1={axisY} y2={axisY} />

  {#if kind === 'fermi'}
    <!-- Levels: dashed where they would sit alone, solid where the mixing puts them. -->
    <line class="level faint" x1="18" x2="84" y1="42" y2="42" />
    <line class="level faint" x1="18" x2="84" y1="52" y2="52" />
    <line class="level" x1="18" x2="84" y1={fermi.upper} y2={fermi.upper} />
    <line class="level" x1="18" x2="84" y1={fermi.lower} y2={fermi.lower} />
    <line class="level" x1="18" x2="84" y1="88" y2="88" />
    <line class="arrow" x1="36" x2="36" y1="88" y2={fermi.upper + 1} />
    <path class="arrow-head" d={up(36, fermi.upper)} />
    <g style="opacity:{0.15 + 0.85 * k}">
      <line class="arrow" x1="62" x2="62" y1="88" y2={fermi.lower + 1} />
      <path class="arrow-head" d={up(62, fermi.lower)} />
    </g>
    <path class="trace" d={trace(fermi.peaks)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="88" y={fermi.upper + 2}>ν₁</text>
      <text class="lbl" x="88" y={fermi.lower + 3}>2ν₂</text>
      <text class="lbl faint" x="18" y="97">dashed: without mixing</text>
      <text class="lbl faint" x="161" y="30" text-anchor="middle">intensity shared</text>
    </g>
  {:else if kind === 'isotopologue'}
    <line class="bond" x1={34 - iso.stretch / 2} x2={66 + iso.stretch / 2} y1="50" y2="50" />
    <circle cx={34 - iso.stretch / 2} cy="50" r="5.8" fill={C_FILL} />
    <circle cx={66 + iso.stretch / 2} cy="50" r={iso.rO} fill={O_FILL} />
    <text class="iso" x={66 + iso.stretch / 2} y="36" text-anchor="middle">{k > 0.5 ? '¹⁸O' : '¹⁶O'}</text>
    <path class="ghost" d={ghostPath(iso.ghost)} style="opacity:{k}" />
    <path class="trace" d={trace([iso.peak])} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl faint" x="150" y="30" text-anchor="middle">¹⁶O</text>
      <text class="lbl" x="176" y="30" text-anchor="middle">¹⁸O</text>
      <text class="lbl faint" x="50" y="76" text-anchor="middle">heavier: lower wavenumber</text>
    </g>
  {:else if kind === 'combination'}
    <line class="level" x1="18" x2="70" y1="88" y2="88" />
    <line class="level" x1="18" x2="70" y1="62" y2="62" />
    <line class="level" x1="18" x2="70" y1="38" y2="38" />
    <line class="arrow" x1="32" x2="32" y1="88" y2="63" />
    <path class="arrow-head" d={up(32, 62)} />
    <g style="opacity:{0.2 + 0.8 * k}">
      <line class="arrow dashed" x1="52" x2="52" y1="88" y2="39" />
      <path class="arrow-head" d={up(52, 38)} />
    </g>
    <path class="trace" d={trace(combo)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="74" y="90">v = 0</text>
      <text class="lbl" x="74" y="64">v = 1</text>
      <text class="lbl" x="74" y="40">v = 2</text>
      <text class="lbl faint" x="182" y="36" text-anchor="middle">fundamental</text>
      <text class="lbl faint" x="114" y="68">overtone, weak</text>
    </g>
  {:else if kind === 'degeneracy'}
    <!-- One excited level, drawn twice because it is two modes, with an
         arrow up to each. The dashed line is where the pair sits while it
         is one, the way the Fermi card marks where its levels would be. -->
    <line class="level" x1="18" x2="84" y1="88" y2="88" />
    <line class="level faint" x1="18" x2="84" y1="46" y2="46" />
    <line class="level" x1="18" x2="84" y1={46 - split} y2={46 - split} />
    <line class="level" x1="18" x2="84" y1={46 + split} y2={46 + split} />
    <line class="arrow" x1="34" x2="34" y1="88" y2={46 - split + 1} />
    <path class="arrow-head" d={up(34, 46 - split)} />
    <line class="arrow" x1="62" x2="62" y1="88" y2={46 + split + 1} />
    <path class="arrow-head" d={up(62, 46 + split)} />
    <path class="trace" d={trace(degen.peaks, HANG, 1)} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl faint" x="18" y="97">two modes</text>
      <text class="lbl" x={160 - sep} y="34" text-anchor="middle">δ</text>
      <text class="lbl" x={160 + sep} y="34" text-anchor="middle" style="opacity:{Math.min(1, sep / 6)}">ω</text>
    </g>
  {:else if kind === 'site-sensitivity'}
    <line class="surface" x1="10" x2="96" y1="80" y2="80" />
    <circle cx="22" cy="80" r="6" fill={M_FILL} />
    <circle cx="40" cy="80" r="6" fill={M_FILL} />
    <circle cx="58" cy="80" r="6" fill={M_FILL} />
    <circle class="cation" cx="76" cy="80" r="6" />
    <text class="cation-lbl" x="76" y="83" text-anchor="middle">+</text>
    <line class="bond" x1={coX} x2={coX} y1={coY} y2={coY - 16} />
    <circle cx={coX} cy={coY} r="5.4" fill={C_FILL} />
    <circle cx={coX} cy={coY - 16} r="5.2" fill={O_FILL} />
    {#each SITES as s}
      <path class="ghost" d={ghostPath({ x: s.wn, h: 44, w: 3.5 })} style="opacity:{s === site ? 0 : 0.5}" />
    {/each}
    <path class="trace" d={trace([sitePeak])} />
    <g style="opacity:{labelOpacity}">
      {#each SITES as s}
        <text class="lbl" class:faint={s !== site} x={s.wn} y="96" text-anchor="middle">{s.label}</text>
      {/each}
    </g>
  {:else if kind === 'coverage-shift'}
    <!-- One CO on a bare metal, then the surface filling up around it. -->
    <line class="surface" x1="10" x2="90" y1="80" y2="80" />
    {#each METALS as mx}
      <circle cx={mx} cy="80" r="6" fill={M_FILL} />
    {/each}
    {#each METALS as mx, i}
      <g style="opacity:{cov.arrived[i]}">
        <line class="bond" x1={mx} x2={mx} y1="72" y2={56 - cov.stretch} />
        <circle cx={mx} cy="72" r="5.2" fill={C_FILL} />
        <circle cx={mx} cy={56 - cov.stretch} r="5" fill={O_FILL} />
      </g>
    {/each}
    <path class="ghost" d={ghostPath(cov.ghost)} style="opacity:{k}" />
    <path class="trace" d={trace([cov.peak])} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="150" y="28" text-anchor="middle">crowded</text>
      <text class="lbl faint" x="180" y="46" text-anchor="middle">alone</text>
      <text class="lbl faint" x="50" y="95" text-anchor="middle">filling up</text>
    </g>
  {:else if kind === 'vibrational-coupling'}
    <!-- Two neighbours: opposite while independent, together once coupled. -->
    <line class="surface" x1="14" x2="86" y1="80" y2="80" />
    <circle cx="34" cy="80" r="6" fill={M_FILL} />
    <circle cx="66" cy="80" r="6" fill={M_FILL} />
    <line class="bond" x1="34" x2="34" y1="72" y2={56 - cpl.a} />
    <circle cx="34" cy="72" r="5.2" fill={C_FILL} />
    <circle cx="34" cy={56 - cpl.a} r="5" fill={O_FILL} />
    <line class="bond" x1="66" x2="66" y1="72" y2={56 - cpl.b} />
    <circle cx="66" cy="72" r="5.2" fill={C_FILL} />
    <circle cx="66" cy={56 - cpl.b} r="5" fill={O_FILL} />
    <!-- The field of one swinging dipole, reaching the other. -->
    <path class="motion" d="M42,44 C48,38 52,38 58,44" style="opacity:{k}" />
    <path class="motion" d="M42,40 C48,32 52,32 58,40" style="opacity:{0.5 * k}" />
    <path class="ghost" d={ghostPath(cpl.singleton)} style="opacity:{k}" />
    <path class="ghost" d={ghostPath(cpl.dark)} style="opacity:{k}" />
    <path class="trace" d={trace([cpl.bright])} />
    <g style="opacity:{labelOpacity}">
      <text class="lbl" x="150" y="28" text-anchor="middle">in phase</text>
      <text class="lbl faint" x="178" y="48" text-anchor="middle">alone</text>
      <text class="lbl faint" x="198" y="68" text-anchor="middle">dark</text>
      <text class="lbl faint" x="50" y="95" text-anchor="middle">one system</text>
    </g>
  {/if}
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis { stroke: var(--line-slate-strong); stroke-width: 0.6; }
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.2; stroke-linejoin: round; }
  .ghost { fill: none; stroke: var(--ink-025); stroke-width: 0.9; stroke-dasharray: 2 2; }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.3; stroke-linecap: round; }
  .level.faint { stroke-opacity: 0.45; stroke-dasharray: 3 2; }

  .arrow { stroke: var(--diagram-photon); stroke-width: 1.4; }
  .arrow.dashed { stroke-dasharray: 3 2; }
  .arrow-head { fill: none; stroke: var(--diagram-photon); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2; }
  .surface { stroke: var(--line-slate-strong); stroke-width: 1.2; }
  .motion { fill: none; stroke: var(--ink-slate-500); stroke-width: 1; stroke-linecap: round; }
  .cation { fill: var(--surface); stroke: var(--charge-positive); stroke-width: 1.2; }
  .cation-lbl {
    font-family: var(--font-sans);
    font-size: max(calc(var(--t-code-size) * 0.75), var(--t-diagram-note-size));
    font-weight: var(--t-label-weight);
    fill: var(--charge-positive);
  }

  /* In drawing units: the opened card doubles the drawing, so half the code
     size lands at the code size. */
  .lbl {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.5), var(--t-diagram-note-size));
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .iso {
    font-family: var(--font-sans);
    font-size: max(calc(var(--t-code-size) * 0.75), var(--t-diagram-note-size));
    fill: var(--ink-slate-500);
  }
</style>

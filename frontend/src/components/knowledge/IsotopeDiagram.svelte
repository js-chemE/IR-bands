<script lang="ts">
  /**
   * Isotopic shift, on one molecule and one vibration throughout.
   *
   *   closed   CO, its ν(CO) stretch, and ¹⁶O swapped for ¹⁸O. The bond
   *            vibrates more slowly, the weight on the spring beneath grows,
   *            and the band slides to lower wavenumber, all at once.
   *   opened   bicarbonate as the atlas holds it, adsorbed and bidentate,
   *            and its ν(OH) stretch. Both substitutions are measured on it,
   *            ¹⁸O throughout the carbonate frame and the proton itself for
   *            deuterium, and they differ by a factor of eighty in how far
   *            they move the band. The loop returns to the unsubstituted
   *            molecule between the two, so each shift is read against the
   *            same starting point rather than against the last one.
   *
   *            The stretch is the case the two-mass model is for, which is
   *            why it is the one drawn: the O–H bond dominates the motion,
   *            so a reduced mass over that pair is a real prediction and
   *            both columns land within a percent or so of it.
   *
   * Every number is the atlas's own: the band centres are the recorded
   * windows of the three bands, and the ratios are computed from the masses
   * rather than quoted, so the drawing cannot drift from lib/isotopeShift.ts.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 420 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: opened = t > 0.55;

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

  /* ── Masses, and the two oscillators ─────────────────────────────── */
  const M = { C: 12.0, O: 15.99491, '18O': 17.99916, H: 1.00783, D: 2.01410 };
  const mu = (a: number, b: number) => (a * b) / (a + b);

  /** Closed: CO, ν(CO). μ over the C–O pair. */
  const CO = {
    nu: 2143,
    muFrom: mu(M.C, M.O),
    muTo: mu(M.C, M['18O']),
  };
  $: coRatio = Math.sqrt(CO.muFrom / CO.muTo);

  /**
   * Opened: bicarbonate, ν(OH). Three columns, which are also the three
   * phases of the loop, and the three bands the atlas holds for this mode:
   * bicarbonate_oh_stretch, its ¹⁸O isotopologue and its deuterated one. The
   * recorded centres are the midpoints of those windows.
   *
   * The oscillator is the O–H pair, which is what lib/isotopeShift.ts uses
   * and, for a stretch, what it takes at face value: one bond carries the
   * motion, so two masses really do give the new position from the old.
   */
  interface Col {
    key: 'none' | '18O' | 'D';
    head: string;
    /** The O–H oscillator, as substituted. */
    mA: number;
    mB: number;
    /** Centre of the recorded window, cm⁻¹. */
    recorded: number;
  }
  const COLS: Col[] = [
    { key: 'none', head: 'HCO₃⁻*', mA: M.O, mB: M.H, recorded: 3622.5 },
    { key: '18O', head: 'HC¹⁸O₃⁻*', mA: M['18O'], mB: M.H, recorded: 3611 },
    { key: 'D', head: 'DCO₃⁻*', mA: M.O, mB: M.D, recorded: 2672.5 },
  ];
  const MU0 = mu(COLS[0].mA, COLS[0].mB);
  const REF = COLS[0].recorded;
  const colMu = (c: Col) => mu(c.mA, c.mB);
  const colRatio = (c: Col) => Math.sqrt(MU0 / colMu(c));
  const colEstimate = (c: Col) => REF * colRatio(c);

  /* ── The loop: reference, ¹⁸O, reference, D, and round again ───────
   * Four beats, each a hold and a move, so every substitution is made from
   * the unsubstituted molecule rather than from the previous isotope.
   */
  const BEATS: ('none' | '18O' | 'D')[] = ['none', '18O', 'none', 'D'];
  const BEAT = 2600; // ms
  /* At rest the plate holds the deuterium beat: it is the substitution with
     something to see, a quarter of the band's position gone and the estimate
     visibly short, where ¹⁸O standing still is a band that looks unmoved. */
  $: beatIx = running ? Math.floor(clock / BEAT) % BEATS.length : 3;
  $: beatQ = running ? (clock % BEAT) / BEAT : 1;
  /** How far into the current beat's state, so the swap is a move not a cut. */
  $: swapIn = running ? ramp(beatQ, 0, 0.3) : 1;
  $: target = BEATS[beatIx];
  $: prev = BEATS[(beatIx - 1 + BEATS.length) % BEATS.length];

  $: colOf = (k: string) => COLS.find(c => c.key === k)!;
  $: from = colOf(prev);
  $: to = colOf(target);
  /** Where the band is, interpolated across the swap. */
  $: nuNow = lerp(from.recorded, to.recorded, swapIn);
  $: muNow = lerp(colMu(from), colMu(to), swapIn);
  /** Which column the table lights: the one being moved to. */
  $: active = target;

  /* Closed card: the CO swap on its own two-beat loop. */
  $: coBeat = running ? Math.floor(clock / 2600) % 2 : 1;
  $: coQ = running ? ramp((clock % 2600) / 2600, 0, 0.3) : 1;
  $: coHeavy = coBeat === 1 ? coQ : 1 - coQ;
  $: coNu = lerp(CO.nu, CO.nu * coRatio, coHeavy);
  $: coMu = lerp(CO.muFrom, CO.muTo, coHeavy);

  /* One oscillation rate for whichever picture is on screen, slowing with μ. */
  $: slow = opened ? Math.sqrt(MU0 / muNow) : Math.sqrt(CO.muFrom / coMu);
  $: swing = running ? Math.sin((clock / 1000) * 2 * Math.PI * 1.15 * slow) : 0;

  /* ── Geometry ─────────────────────────────────────────────────────── */
  $: MOL = { cx: lerp(46, 116, t), cy: lerp(30, 84, t), len: lerp(26, 48, t) };
  $: OSC = { y: lerp(64, 202, t), wall: lerp(16, 46, t), rest: lerp(74, 150, t), amp: lerp(5, 13, t) };
  $: SP = {
    x0: lerp(116, 250, t),
    x1: lerp(210, 464, t),
    base: lerp(20, 64, t),
    tall: lerp(44, 104, t),
  };

  /* The axis: wide enough to hold the deuterated band once it is on the
     plate, tight enough that the ¹⁸O step is still visible. */
  $: AX = opened ? { lo: 2500, hi: 3800, step: 400 } : { lo: 2050, hi: 2200, step: 50 };
  $: sx = (v: number) => SP.x0 + ((AX.hi - v) / (AX.hi - AX.lo)) * (SP.x1 - SP.x0);
  $: ticks = (() => {
    const out: number[] = [];
    for (let v = Math.ceil(AX.lo / AX.step) * AX.step; v <= AX.hi; v += AX.step) out.push(v);
    return out;
  })();
  $: bandNu = opened ? nuNow : coNu;
  $: traceOf = (v: number) => {
    const w = lerp(3, 4.4, t);
    const pts: string[] = [];
    for (let x = SP.x0; x <= SP.x1; x += 1) {
      const y = Math.exp(-(((x - sx(v)) / w) ** 2));
      pts.push(`${x.toFixed(1)},${(SP.base + y * SP.tall).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  };

  /**
   * The shift, drawn as a curved arrow from where the band was to where the
   * substitution put it, and kept there for as long as the substituted
   * molecule is on screen rather than only while it travels.
   *
   * The two cases are separated by a factor of eighty, and ¹⁸O's eleven
   * wavenumbers are barely two pixels of this axis. An arc proportional to
   * the span would be invisible for that one, so the lift has a floor: the
   * small shift reads as a tall narrow hairpin and the large one as a long
   * low sweep, and both read as arrows.
   */
  $: shiftArrow = (() => {
    if (!opened || active === 'none') return null;
    const a = sx(REF);
    const b = sx(nuNow);
    const y = SP.base - 12;
    const span = Math.abs(b - a);
    const lift = Math.max(30, Math.min(44, 14 + span * 0.1));
    const dir = b >= a ? 1 : -1;
    return {
      d: `M${a},${y} Q${(a + b) / 2},${y - lift} ${b},${y}`,
      head: `M${b - 5 * dir},${y - 5} L${b},${y} L${b - 5 * dir},${y + 3}`,
      lx: (a + b) / 2,
      ly: y - lift * 0.72,
      delta: nuNow - REF,
    };
  })();

  /* ── The molecules ─────────────────────────────────────────────────
   * Bicarbonate the way the atlas records it and the way the vibration
   * viewer draws an adsorbate: bidentate on the surface, bound through its
   * two non-protonated oxygens, hydroxyl pointing away from it. The two
   * bound oxygens are anchored and never displaced, which is the viewer's
   * rule as well, so the surface holds the frame still.
   *
   * ν(OH) runs along the bond: the proton moves out and back on the line
   * from its oxygen, drawn against a dashed construction line left standing
   * at the equilibrium length.
   */
  $: bic = (() => {
    const L = MOL.len;
    const c = { x: MOL.cx, y: MOL.cy };
    const surfY = c.y + L * 1.15;
    // Three oxygens at roughly 120°: two down onto the surface, one up.
    const oL = { x: c.x - L * 0.55, y: c.y + L * 0.55 };
    const oR = { x: c.x + L * 0.55, y: c.y + L * 0.55 };
    const oH = { x: c.x, y: c.y - L * 0.68 };
    /* The proton at the equilibrium C–O–H angle, about 110° off the O→C
       direction, and the same bond stretched and compressed along it. */
    const rest = { x: 0.94, y: -0.34 };
    const arm = L * 0.45;
    const d = swing * lerp(2.5, 5, t);
    const h0 = { x: oH.x + rest.x * arm, y: oH.y + rest.y * arm };
    const h = { x: h0.x + rest.x * d, y: h0.y + rest.y * d };
    return { c, oL, oR, oH, h, h0, surfY };
  })();

  $: co = (() => {
    const half = MOL.len * 0.5;
    const d = swing * lerp(2, 3.4, t);
    return {
      c: { x: MOL.cx - half - d * 0.57, y: MOL.cy },
      o: { x: MOL.cx + half + d * 0.43, y: MOL.cy },
    };
  })();

  /* ── The spring, unchanged in every phase ── */
  $: rBob = lerp(5, 9, t) * (opened ? Math.cbrt(muNow / MU0) : Math.cbrt(coMu / CO.muFrom));
  $: bobX = OSC.rest + swing * OSC.amp;
  const COILS = 6;
  $: springPath = (() => {
    const x0 = OSC.wall + 2;
    const x1 = bobX - rBob;
    const span = Math.max(8, x1 - x0);
    const h = lerp(4, 8, t);
    const lead = span * 0.14;
    const pts = [`M${x0.toFixed(1)},${OSC.y.toFixed(1)} L${(x0 + lead).toFixed(1)},${OSC.y.toFixed(1)}`];
    const coil = span - 2 * lead;
    for (let i = 0; i < COILS; i++) {
      const xa = x0 + lead + (coil * (i + 0.5)) / COILS;
      const xb = x0 + lead + (coil * (i + 1)) / COILS;
      pts.push(`L${xa.toFixed(1)},${(OSC.y + (i % 2 ? h : -h)).toFixed(1)} L${xb.toFixed(1)},${OSC.y.toFixed(1)}`);
    }
    return pts.join(' ') + ` L${x1.toFixed(1)},${OSC.y.toFixed(1)}`;
  })();
  $: wallHatch = (() => {
    const h = lerp(10, 20, t);
    const out: string[] = [];
    for (let i = -h; i <= h; i += lerp(4, 6, t)) {
      out.push(`M${OSC.wall},${OSC.y + i} L${OSC.wall - lerp(4, 6, t)},${OSC.y + i + lerp(4, 6, t)}`);
    }
    return out.join(' ');
  })();

  /* ── The table, in the Vibration Modes card's manner ── */
  const TB = { y: 272, step: 26, x: 46, w: 418 };
  $: colX = (i: number) => TB.x + 150 + i * ((TB.w - 150) / 3) + (TB.w - 150) / 6;
  const ROWS: { label: string; of: (c: Col) => string }[] = [
    { label: 'μ / u', of: c => mu(c.mA, c.mB).toFixed(3) },
    { label: '√(μ/μ′)', of: c => colRatio(c).toFixed(4) },
    { label: 'estimate / cm⁻¹', of: c => Math.round(colEstimate(c)).toLocaleString('en-US') },
    { label: 'recorded / cm⁻¹', of: c => Math.round(c.recorded).toLocaleString('en-US') },
  ];

  $: plateIn = ramp(t, 0.45, 0.9);
  $: labelIn = ramp(t, 0.7, 1);
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="One molecule and one vibration, with an isotope swapped into it. Closed, carbon monoxide: replacing oxygen-16 by oxygen-18 slows the stretch, grows the weight on the spring beneath, and moves the band to lower wavenumber. Opened, bicarbonate adsorbed bidentate on a surface and its O-H stretch: oxygen-18 through the carbonate frame moves the band by about eleven wavenumbers, while replacing the proton by deuterium moves the same band of the same molecule by about nine hundred and fifty, and the table below gives the reduced mass, the ratio, the harmonic estimate and the recorded position for each"
>
  {#if opened}
    <!-- ══ Bicarbonate on its surface, and only the proton moving ══ -->
    <line class="surface-line" x1={MOL.cx - MOL.len * 1.25} y1={bic.surfY} x2={MOL.cx + MOL.len * 1.25} y2={bic.surfY} />
    <line class="surface-bond" x1={bic.oL.x} y1={bic.oL.y} x2={bic.oL.x} y2={bic.surfY} />
    <line class="surface-bond" x1={bic.oR.x} y1={bic.oR.y} x2={bic.oR.x} y2={bic.surfY} />

    <line class="bond" x1={bic.c.x} y1={bic.c.y} x2={bic.oH.x} y2={bic.oH.y} />
    <line class="bond" x1={bic.c.x} y1={bic.c.y} x2={bic.oL.x} y2={bic.oL.y} />
    <line class="bond" x1={bic.c.x} y1={bic.c.y} x2={bic.oR.x} y2={bic.oR.y} />
    <!-- Where the bond rests, so the angle is read against something. -->
    <line class="guide" x1={bic.oH.x} y1={bic.oH.y} x2={bic.h0.x} y2={bic.h0.y} />
    <line class="bond" x1={bic.oH.x} y1={bic.oH.y} x2={bic.h.x} y2={bic.h.y} />

    {#each [bic.oL, bic.oR, bic.oH] as o}
      <circle
        class="atom"
        class:lit={active === '18O'}
        cx={o.x}
        cy={o.y}
        r={8 * (active === '18O' ? lerp(1, 1.13, swapIn) : 1)}
        fill={colorForElement('O')}
      />
    {/each}
    <circle class="atom" cx={bic.c.x} cy={bic.c.y} r="9" fill={colorForElement('C')} />
    <circle
      class="atom"
      class:lit={active === 'D'}
      cx={bic.h.x}
      cy={bic.h.y}
      r={5.5 * (active === 'D' ? lerp(1, 1.3, swapIn) : 1)}
      fill={colorForElement('H')}
    />
    <g style="opacity:{labelIn}">
      <text
        class="lbl tag"
        class:on={active === '18O'}
        style="font-size:{lerp(13, 22, t)}px"
        x={bic.oH.x - 14}
        y={bic.oH.y + 6}
        text-anchor="end">{active === '18O' ? '¹⁸O' : '¹⁶O'}</text>
      <!-- Pinned to where the proton rests, not to where it is: a label that
           swings with it is harder to read and says nothing extra. -->
      <text
        class="lbl tag"
        class:on={active === 'D'}
        style="font-size:{lerp(13, 22, t)}px"
        x={bic.h0.x - 5}
        y={bic.h0.y - 10}
        text-anchor="end">{active === 'D' ? 'D' : 'H'}</text>
      <!-- Under the surface line, where the H and ¹⁶O labels are not. -->
      <text class="lbl faint" x={MOL.cx + MOL.len * 1.25} y={bic.surfY + 13} text-anchor="end">
        surface
      </text>
      <text class="lbl name" x={MOL.cx - MOL.len * 1.25} y={bic.surfY + 30}>
        HCO₃⁻* bidentate, ν(OH)
      </text>
    </g>
  {:else}
    <!-- ══ CO, one bond, one swap ══ -->
    <line class="bond" x1={co.c.x} y1={co.c.y} x2={co.o.x} y2={co.o.y} />
    <circle class="atom" cx={co.c.x} cy={co.c.y} r="6" fill={colorForElement('C')} />
    <circle
      class="atom"
      cx={co.o.x}
      cy={co.o.y}
      r={6 * lerp(1, 1.16, coHeavy)}
      fill={colorForElement('O')}
    />
    <text
      class="lbl tag"
      class:on={coHeavy > 0.5}
      style="font-size:{lerp(13, 22, t)}px"
      x={co.o.x}
      y={co.o.y - 12}
      text-anchor="middle">{coHeavy > 0.5 ? '¹⁸O' : '¹⁶O'}</text>
  {/if}

  <!-- ══ The oscillator it reduces to ══ -->
  <path class="wall" d={wallHatch} />
  <line class="wall" x1={OSC.wall} y1={OSC.y - lerp(10, 20, t)} x2={OSC.wall} y2={OSC.y + lerp(10, 20, t)} />
  <path class="spring" d={springPath} />
  <circle class="bob" cx={bobX} cy={OSC.y} r={rBob} />
  <g style="opacity:{labelIn}">
    <text class="lbl name" x={bobX + rBob + 6} y={OSC.y + 4}>
      μ = {(opened ? muNow : coMu).toFixed(2)} u
    </text>
    <text class="lbl why" x={(OSC.wall + OSC.rest) / 2} y={OSC.y + lerp(15, 24, t)} text-anchor="middle">
      k unchanged
    </text>
  </g>

  <!-- ══ The band ══ -->
  <line class="axis-line" x1={SP.x0} y1={SP.base} x2={SP.x1} y2={SP.base} />
  <!-- Where the band sat before the substitution: dashed, and left standing
       so the shift is read against it rather than remembered. -->
  {#if (opened ? active !== 'none' : coHeavy > 0.02)}
    <path class="trace ghost" d={traceOf(opened ? REF : CO.nu)} />
  {/if}
  <path class="trace" d={traceOf(bandNu)} />

  {#if shiftArrow}
    <path class="move" d={shiftArrow.d} />
    <path class="move-head" d={shiftArrow.head} />
    <text class="lbl lit" x={shiftArrow.lx} y={shiftArrow.ly} text-anchor="middle">
      {shiftArrow.delta > 0 ? '+' : '−'}{fmt(Math.abs(shiftArrow.delta))} cm⁻¹
    </text>
  {/if}

  {#if opened}
    <g style="opacity:{plateIn}">
      {#each ticks as v (v)}
        <line class="tick" x1={sx(v)} y1={SP.base + SP.tall + 6} x2={sx(v)} y2={SP.base + SP.tall + 11} />
        <text class="lbl faint" x={sx(v)} y={SP.base + SP.tall + 22} text-anchor="middle">{fmt(v)}</text>
      {/each}
      <line class="axis-line" x1={SP.x0} y1={SP.base + SP.tall + 6} x2={SP.x1} y2={SP.base + SP.tall + 6} />
      <text class="lbl axis" x={SP.x1} y={SP.base + SP.tall + 36} text-anchor="end">
        wavenumber / cm⁻¹
      </text>
    </g>

    <!-- ══ The arithmetic, one column per substitution ══ -->
    <g style="opacity:{plateIn}">
      {#each COLS as c, i (c.key)}
        <!-- The column in play is marked by its own text, as the Normal
             Modes card marks a count: a filled block behind the numbers
             reads as a different kind of object from the table it sits in. -->
        <text
          class="lbl head"
          class:on={c.key === active}
          x={colX(i)}
          y={TB.y - 14}
          text-anchor="middle">{c.key === 'none' ? 'no isotope' : c.head}</text>
      {/each}
      {#each ROWS as r, ri (r.label)}
        <line class="rule" x1={TB.x} x2={TB.x + TB.w} y1={TB.y + ri * TB.step + 6} y2={TB.y + ri * TB.step + 6} />
        <text class="lbl faint" x={TB.x} y={TB.y + ri * TB.step + 2}>{r.label}</text>
        {#each COLS as c, i (c.key)}
          <text
            class="lbl"
            class:on={c.key === active}
            x={colX(i)}
            y={TB.y + ri * TB.step + 2}
            text-anchor="middle">{r.of(c)}</text>
        {/each}
      {/each}
      <!-- Why the deuterium column misses by eighty wavenumbers, said once
           rather than left for the reader to take as an error. -->
      <!-- What is left over once mass has been accounted for, named rather
           than left to read as an error in the data. -->
      <text class="lbl faint" x={TB.x} y={TB.y + ROWS.length * TB.step + 16}>
        the estimate is harmonic; a real O–H stretch is not,
      </text>
      <text class="lbl faint" x={TB.x} y={TB.y + ROWS.length * TB.step + 29}>
        so the deuterated band lands about 35 cm⁻¹ above it
      </text>
    </g>
  {/if}
</svg>

<style>
  .diagram { display: block; overflow: visible; }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2; }
  .atom { stroke: var(--ink-slate-400); stroke-width: 0.6; }
  /* The atom being swapped, while it is being swapped. */
  .atom.lit { stroke: var(--accent-green-fg); stroke-width: 1.6; }

  .spring {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1.3;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .wall { stroke: var(--line-slate-strong); stroke-width: 1; fill: none; }
  .bob { fill: var(--brand-700); }

  .axis-line { stroke: var(--line-slate-strong); stroke-width: 1; }
  .tick { stroke: var(--ink-050); stroke-width: 1; }
  .rule { stroke: var(--line-faint); stroke-width: 1; }

  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.5; stroke-linejoin: round; }

  /* Where the band is going, drawn only while it goes. */
  .move { fill: none; stroke: var(--accent-green-fg); stroke-width: 1.2; }
  .move-head {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* The surface the molecule is adsorbed on, drawn as MoleculeViewer draws
     it: one line for the top layer, dashed bonds down onto it. */
  .surface-line { stroke: var(--ink-050); stroke-width: 1.5; }
  .surface-bond { stroke: var(--ink-050); stroke-width: 1; stroke-dasharray: 2.5 2.5; }
  /* Construction: where the bond rests, and where the band rested. */
  .guide { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 3; }
  .trace.ghost { stroke: var(--ink-025); stroke-width: 1.2; stroke-dasharray: 3 3; }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.why { fill: var(--brand-700); }
  .lbl.lit { fill: var(--accent-green-fg); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.head { fill: var(--ink-slate-400); }
  /* The atom being named: the one place on the plate where a label is set
     above the common size, because it is the subject of the drawing. Its
     colour and weight are the table's, so only .on separates the beats. */
  .lbl.tag { font-weight: 400; }
  /* The column the loop is on: its own numbers, lit and a shade heavier.
     Nothing is drawn behind them, and it has to beat .head, so it is last. */
  .lbl.on { fill: var(--accent-green-fg); font-weight: var(--t-label-weight); }
</style>

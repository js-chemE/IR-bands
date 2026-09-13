<script lang="ts">
  /**
   * Fermi resonance: two levels that have no business being near each other
   * end up mixing, pushing apart and sharing the intensity between them.
   *
   * The two states belong to DIFFERENT modes, so they get a column each and
   * their own ground state. That is the whole reason the effect comes apart
   * under isotopic substitution: the two shift by different amounts and stop
   * being degenerate. Drawing them on one ladder, as this card used to,
   * quietly claimed they were levels of the same oscillator.
   *
   *   dashed  where each level would sit on its own, the unmixed position
   *   solid   where the mixing actually puts it, pushed apart
   *
   * Standing still the card shows the mixed state, already adjusted away
   * from the dashed ghosts, because that is what a spectrum shows. While
   * playing, the mixing switches on and off: the levels slide apart, the
   * bright fundamental hands intensity to the dark overtone, and the two
   * bands separate, one to higher wavenumber and one to lower.
   */
  export let t = 0;
  export let playing = false;

  import { onDestroy } from 'svelte';

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));

  const S = { W: 220, H: 100, px: 238 / 220 };
  /* Tall enough for the caption block under the spectrum, which runs to
     y = 328; at 300 the last lines ran out of the bottom of the frame. */
  const F = { W: 480, H: 350 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: opened = t > 0.55;

  /* ── Clock ── */
  const CYCLE = 7200; // ms: unmixed, slide apart, hold, slide back
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

  /**
   * How mixed the pair is: 0 is the unperturbed picture, 1 the real one.
   * At rest it is 1, because the still card should show what a spectrum
   * shows rather than a state that never occurs.
   */
  $: p = running ? (clock % CYCLE) / CYCLE : 1;
  $: mix = running ? ramp(p, 0.12, 0.42) * (1 - ramp(p, 0.74, 0.94)) : 1;

  /* ── The two states ──────────────────────────────────────────────────
   * Energies in arbitrary units of the fundamental. Unperturbed they are
   * nearly degenerate, which is the precondition; mixed they repel by equal
   * and opposite amounts, which is what the interaction does.
   */
  /**
   * The two zero-order states. Drawn with the fundamental ABOVE the
   * overtone, which is the CO₂ case the card's first example is: νₛ at
   * 1389 resonating with 2δ at 1285.
   *
   * Which one is higher is not a rule, though, and the atlas holds both
   * arrangements: formate's ν(CH) at 2845–2920 sits BELOW the combination
   * it mixes with. So the direction is worked out from the two energies
   * rather than assumed, and the card says so.
   */
  const E_A0 = 1.07; // the fundamental, the bright one
  const E_B0 = 1.0; // the overtone, dark on its own
  /* The push apart, drawn generously: it is the whole subject of the card,
     and at a truthful few cm⁻¹ on this scale the two levels would sit on
     top of each other and nothing would read. */
  const SHIFT = 0.23;
  /* Level repulsion: whichever starts higher goes up, whichever starts
     lower goes down. Always apart, never toward, and it has nothing to do
     with which of them carries the intensity. */
  $: eA = E_A0 + Math.sign(E_A0 - E_B0) * SHIFT * mix;
  $: eB = E_B0 + Math.sign(E_B0 - E_A0) * SHIFT * mix;
  const E_HEAD = 1.52;

  /* ── Layout: two columns left, the spectrum right ── */
  $: CJ = {
    x: lerp(8, 22, t),
    w: lerp(84, 152, t),
    top: lerp(14, 44, t),
    h: lerp(70, 196, t),
  };
  $: cyE = (e: number) => CJ.top + CJ.h - (e / E_HEAD) * CJ.h;
  /* Opened, pushed to the outer edges of the panel: "strong band" and "weak
     band" are about 75 units each, so centred under columns any closer
     together they run into one another. Closed there are no names to fit,
     and that spread left the pair straggling across the panel with the
     right-hand one almost touching the spectrum, so it draws in. */
  $: colX = (k: number) => CJ.x + CJ.w * (lerp(0.2, 0.13, t) + k * lerp(0.42, 0.74, t));
  $: colHalf = lerp(13, 19, t);

  /** The baseline sits high and the bands hang below it: an absorption plot. */
  /* The same baseline and depth as the overtone and combination cards, so
     the three spectra line up when the reader moves between them. */
  $: SP = {
    x0: lerp(100, 196, t),
    x1: lerp(212, 462, t),
    base: lerp(34, 96, t),
    tall: lerp(44, 130, t),
  };
  const SPAN_LO = 0.68;
  const SPAN_HI = 1.4;
  $: sx = (e: number) => SP.x1 - ((e - SPAN_LO) / (SPAN_HI - SPAN_LO)) * (SP.x1 - SP.x0);

  /**
   * Intensity. Unmixed, the fundamental carries all of it and the overtone
   * none: that is what "dark" means. Mixed, they share, which is why a
   * Fermi pair is two bands of comparable size where one was expected.
   */
  /* They share but never level out: the pair stays lopsided, because the
     mixing is rarely exactly fifty-fifty and drawing them equal would say
     the overtone had become as strong as the mode that lent it everything. */
  $: hA = lerp(1, 0.66, mix);
  $: hB = lerp(0.04, 0.36, mix);

  const up = (x: number, y: number, s: number) =>
    `M${x - s},${y + s * 1.5} L${x},${y} L${x + s},${y + s * 1.5}`;

  /**
   * One continuous trace across the whole axis, summing whatever bands it
   * is given: the real spectrum is a line, not a pair of separate dips.
   */
  $: traceOf = (put: { e: number; h: number }[]) => {
    const w = lerp(3.2, 5, t);
    const pts: string[] = [];
    for (let x = SP.x1; x >= SP.x0; x -= 1) {
      let y = 0;
      for (const q of put) y += q.h * Math.exp(-(((x - sx(q.e)) / w) ** 2));
      pts.push(`${x.toFixed(1)},${(SP.base + y * SP.tall).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  };
  /** What is actually measured: solid, and it moves as the mixing comes on. */
  $: traceLive = traceOf([{ e: eA, h: hA }, { e: eB, h: hB }]);
  /**
   * What the pair would have been with no mixing: one strong fundamental
   * and next to nothing where the overtone is. Dashed, and it never moves,
   * so the solid line can be seen travelling away from it.
   */
  $: traceGhost = traceOf([{ e: E_A0, h: 1 }, { e: E_B0, h: 0.04 }]);

  /** Which way each band travels as the mixing comes on, for the arrows. */
  $: moveA = sx(eA) - sx(E_A0);
  $: moveB = sx(eB) - sx(E_B0);

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: AX = { ox: CJ.x - 8, top: CJ.top - 6, oy: CJ.top + CJ.h + 8 };
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Two vibrational modes side by side, each with its own ground state: a strong fundamental in one, and in the other a weak band, an overtone or a combination, that happens to fall at nearly the same energy. Dashed lines mark where each would sit alone; the mixing pushes the lower one down and the upper one up, and in the spectrum on the right the two bands move apart from their dashed original positions, the fundamental handing part of its intensity to the weak band that would otherwise be nearly invisible"
>
  <!-- E only: the horizontal direction here is two separate modes side by
       side, not a coordinate, so there is no second axis to draw. -->
  <g style="opacity:{fullOpacity}">
    <path
      class="axis-line"
      d="M{AX.ox},{AX.oy} V{AX.top} M{AX.ox - 3},{AX.top + 5} L{AX.ox},{AX.top} L{AX.ox + 3},{AX.top + 5}"
    />
  </g>

  <!-- Both columns are named for what they do, not for what they are.
       Neither has to be a fundamental: the atlas holds a resonance between
       two combination bands (CO₂'s νₛ+νₐₛ with 2δ+νₐₛ). What the effect
       needs is near-degeneracy and matching symmetry; strong and weak is
       what makes it show, because only then is the borrowing obvious. -->
  {#each [{ k: 0, e0: E_A0, e: eA, name: 'strong band' }, { k: 1, e0: E_B0, e: eB, name: 'weak band' }] as c}
    {@const cx = colX(c.k)}
    {@const y0 = cyE(0)}
    <!-- Its own ground state: these are different modes, and the whole
         effect depends on them being different. -->
    <line class="level ground" x1={cx - colHalf} x2={cx + colHalf} y1={y0} y2={y0} />
    <!-- Where it would sit with no partner to mix with. -->
    <line class="level ghost" x1={cx - colHalf} x2={cx + colHalf} y1={cyE(c.e0)} y2={cyE(c.e0)} />
    <line class="level lit" x1={cx - colHalf} x2={cx + colHalf} y1={cyE(c.e)} y2={cyE(c.e)} />
    <!-- The shift, drawn as the move from the ghost to the real thing. -->
    {#if Math.abs(cyE(c.e) - cyE(c.e0)) > 2}
      <line class="shift" x1={cx + colHalf + 4} x2={cx + colHalf + 4} y1={cyE(c.e0)} y2={cyE(c.e)} />
      <path
        class="shift-head"
        d={cyE(c.e) < cyE(c.e0)
          ? up(cx + colHalf + 4, cyE(c.e), 2.6)
          : `M${cx + colHalf + 1.4},${cyE(c.e) - 3.9} L${cx + colHalf + 4},${cyE(c.e)} L${cx + colHalf + 6.6},${cyE(c.e) - 3.9}`}
      />
    {/if}
    <line class="arrow" x1={cx} x2={cx} y1={y0} y2={cyE(c.e) + 1} />
    <path class="arrow-head" d={up(cx, cyE(c.e), lerp(2.4, 3.2, t))} />
    <text class="lbl lit" x={cx} y={CJ.top + CJ.h + 15} text-anchor="middle" style="opacity:{labelOpacity}">{c.name}</text>
    <!-- No "fundamental"/"overtone" word under each column: the panel is
         112 units wide and those two need about 150 between them, so they
         ran together into one unreadable string whichever way they were
         anchored. The ν₁ and 2ν₂ names already say which is which, and the
         caption below names the donor. -->
  {/each}

  <!-- ── The spectrum ── -->
  <line class="axis" x1={SP.x0} x2={SP.x1} y1={SP.base} y2={SP.base} />
  <line class="baseline" x1={SP.x0} x2={SP.x1} y1={SP.base} y2={SP.base} />
  <!-- The unmixed pair, dashed and fixed, with the real spectrum solid over
       it: the gap between the two is the whole effect. -->
  <!-- On the small card too: the dashed original is the reference the solid
       line is moving away from, so it is the last thing to drop when there
       is less room, not the first. -->
  <path class="trace ghost" d={traceGhost} />
  <path class="trace" d={traceLive} />

  <!-- Which way each band is going, and which of them is paying. -->
  {#if opened}
    <g style="opacity:{labelOpacity}">
      {#if Math.abs(moveA) > 3}
        <line class="move" x1={sx(E_A0)} x2={sx(eA) - Math.sign(moveA) * 5} y1={SP.base - 20} y2={SP.base - 20} />
        <path
          class="move-head"
          d="M{sx(eA) - Math.sign(moveA) * 5.5},{SP.base - 23} L{sx(eA)},{SP.base - 20} L{sx(eA) - Math.sign(moveA) * 5.5},{SP.base - 17}"
        />
      {/if}
      {#if Math.abs(moveB) > 3}
        <line class="move" x1={sx(E_B0)} x2={sx(eB) - Math.sign(moveB) * 5} y1={SP.base - 32} y2={SP.base - 32} />
        <path
          class="move-head"
          d="M{sx(eB) - Math.sign(moveB) * 5.5},{SP.base - 35} L{sx(eB)},{SP.base - 32} L{sx(eB) - Math.sign(moveB) * 5.5},{SP.base - 29}"
        />
      {/if}
    </g>
  {/if}

  <g style="opacity:{labelOpacity}">
    <text class="tick" x={sx(eA)} y={SP.base + SP.tall * hA + 14} text-anchor="middle">strong</text>
    <text class="tick" x={sx(eB)} y={SP.base + SP.tall * hB + 14} text-anchor="middle">weak</text>
  </g>

  {#if opened}
    <g style="opacity:{labelOpacity}">
      <text class="lbl axis" x={AX.ox - 12} y={AX.top + 10}>E</text>
      <!-- Under 22 characters on the left, so they stop before the
           spectrum; under 34 on the right, so they stop before the frame. -->
      <text class="lbl why" x={CJ.x} y={CJ.top + CJ.h + 46}>two modes, two ground</text>
      <text class="lbl faint" x={CJ.x} y={CJ.top + CJ.h + 59}>states: only their</text>
      <text class="lbl faint" x={CJ.x} y={CJ.top + CJ.h + 72}>energies coincide</text>
      <!-- Up to about 38 characters here: the spectrum starts at x 196 and
           the frame ends at 480. -->
      <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 34}>dashed: where each sits alone</text>
      <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 47}>the strong band lends the weak one</text>
      <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 60}>its intensity. Either may be a</text>
      <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 73}>fundamental, an overtone, a sum</text>
      <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 89}>either can start lower; the</text>
      <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 102}>lower one is pushed down</text>
    </g>
  {/if}

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="18">Two Modes, One Accident</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.4; stroke-linecap: round; }
  .level.ground { stroke: var(--ink-slate-500); }
  /* Where the level would sit with nothing to mix with. */
  .level.ghost { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  /* Where it actually is: this card is green, like its siblings. */
  .level.lit { stroke: var(--accent-green-fg); stroke-width: 1.6; }

  /* The excitation itself is ordinary here. Every card in this part has an
     arrow from the ground state to an excited one; on this one that is the
     background against which something else happens, so it is drawn in the
     neutral ink and the accent is spent on the shift instead. */
  .arrow { stroke: var(--ink-slate-400); stroke-width: 1.6; }
  .arrow-head {
    fill: none;
    stroke: var(--ink-slate-400);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* The push, from where the level would have been to where it is: the one
     thing this card is about, so it gets the green. */
  .shift { stroke: var(--accent-green-fg); stroke-width: 1.4; }
  .shift-head {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .axis-line { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  .baseline { stroke: var(--line-slate); stroke-width: 1; }
  /* The dashed unmixed positions are the ghost trace now, not a pair of
     verticals, so there is no `.exact` rule here any more. */
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.5; stroke-linejoin: round; }
  /* Where the pair would have been with no mixing: it stays put while the
     solid line moves off it. */
  .trace.ghost { stroke: var(--ink-050); stroke-width: 1.2; stroke-dasharray: 4 3; }
  /* Which way a band travels once the two mix. */
  .move { stroke: var(--accent-green-fg); stroke-width: 1; }
  .move-head { fill: none; stroke: var(--accent-green-fg); stroke-width: 1; stroke-linecap: round; stroke-linejoin: round; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.why { fill: var(--brand-700); }
  .lbl.lit { fill: var(--accent-green-fg); }
  .lbl.axis { font-style: italic; }
  .lbl.name { fill: var(--ink-slate-900); }
</style>

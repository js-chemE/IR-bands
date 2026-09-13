<script lang="ts">
  /**
   * Rotational branches: one photon changes v and J together.
   *
   * Left, the two vibrational levels with their rotational rungs; right, the
   * band the transitions leave. Shares the baseline, the dashed reference
   * and the plot geometry of Overtone, Combination and Fermi Resonance, but
   * keeps its own colours, because here the colour carries the meaning: a
   * branch is told apart by which way J moved, and that is the whole card.
   *
   *   R  ΔJ = +1  above the origin in wavenumber, drawn in the bluer ink
   *   P  ΔJ = −1  below it, in the redder
   *   Q  ΔJ = 0   on the origin itself, green, and only where allowed
   *   S  ΔJ = +2  the Raman counterpart of R, same ink, twice as far out
   *   O  ΔJ = −2  the Raman counterpart of P
   *
   * The loop runs three cases, because neither "where the symmetry allows
   * it" nor "which technique is looking" is a footnote. A stretch along the
   * axis has no Q branch and its band shows a gap at the centre; a bend
   * across the axis has one and fills that gap with a single tall line; and
   * the same transition in Raman drops P and R for O and S, whose lines sit
   * at twice the spacing because ΔJ steps by two instead of one.
   *
   * Line heights follow the room-temperature population of the starting
   * level (the Rotation Modes card); spacings are schematic.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 320 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: opened = t > 0.55;

  /* ── Clock: one half of the cycle without a Q branch, one half with ── */
  const CYCLE = 9600;
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

  /** Three thirds of the cycle: a stretch with no Q, a bend with one, then
      the same transition seen in Raman. At rest the bend is shown, so all
      three infrared names mean something to a reader who never starts it. */
  $: phase = running ? Math.min(2, Math.floor(((clock % CYCLE) / CYCLE) * 3)) : 1;
  $: qAllowed = phase !== 0;
  $: raman = phase === 2;
  $: half = running ? ((clock % CYCLE) % (CYCLE / 3)) / (CYCLE / 3) : 0;

  /* ── The lines of the band ──────────────────────────────────────────
   * One line per starting level J, its height the population of that
   * level, its position in rotational steps from the band origin: R lands
   * above the origin in wavenumber, P below, Q on it.
   */
  const pop = (J: number) => (2 * J + 1) * Math.exp(-(J * (J + 1)) / 12);
  const POP_MAX = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(pop));
  const R_LINES = [0, 1, 2, 3, 4, 5].map(J => ({ b: 'R' as const, J, u: J + 1, h: pop(J) / POP_MAX }));
  /* P starts at J = 1: the step is ΔJ = −1 and there is no J = −1 to land
     on, so the ground rotational level has no P line at all. That missing
     line is part of why the band is left with a gap at its own centre. */
  const P_LINES = [1, 2, 3, 4, 5, 6].map(J => ({ b: 'P' as const, J, u: -J, h: pop(J) / POP_MAX }));
  /**
   * The Q branch is MANY lines, one from every populated J, not one line.
   * They nearly coincide because B is almost the same in the two
   * vibrational levels; because it shrinks a little in v = 1 they degrade
   * slowly to lower wavenumber, so they read as one narrow head rather than
   * a single sharp line. Drawn at a quarter height each so the pile sums to
   * about the height one line would have had.
   */
  const Q_LINES = [1, 2, 3, 4, 5, 6].map(J => ({
    b: 'Q' as const,
    J,
    u: -0.045 * J,
    // Each Q line is as strong as its R and P siblings from the same J.
    // They are not drawn small: it is the pile-up of full-sized lines on
    // one spot that makes a Q branch the tallest thing in a band.
    h: pop(J) / POP_MAX,
  }));
  /* Raman reaches ΔJ = ±2, so its branches step by 4B where the infrared
     ones step by 2B. In the units used here (u = 1 is one 2B step) an S line
     sits at 2J + 3 and an O line at −(2J − 1). That doubled spacing is the
     whole visible difference, and it is why hydrogen resolves into separate
     lines where nitrogen stays an unresolved tail. */
  const S_LINES = [0, 1, 2].map(J => ({ b: 'S' as const, J, u: 2 * J + 3, h: pop(J) / POP_MAX }));
  const O_LINES = [2, 3, 4].map(J => ({ b: 'O' as const, J, u: -(2 * J - 1), h: pop(J) / POP_MAX }));
  $: lines = raman
    ? [...S_LINES, ...O_LINES, ...Q_LINES]
    : qAllowed
      ? [...R_LINES, ...P_LINES, ...Q_LINES]
      : [...R_LINES, ...P_LINES];

  /**
   * The arrows are a sample, not the whole band: drawing one per line put
   * thirteen of them across a panel a hundred units wide and they became a
   * grey mesh. Three of each branch is enough to show the pattern, and they
   * are ordered by where their line falls in the spectrum, left to right,
   * so the eye can follow one to the other.
   */
  $: arrows = raman
    ? [...[2, 1, 0].map(i => S_LINES[i]), Q_LINES[0], ...[0, 1, 2].map(i => O_LINES[i])]
    : [
        ...[2, 1, 0].map(J => R_LINES[J]),
        ...(qAllowed ? [Q_LINES[0]] : []),
        ...[1, 2, 3].map(J => P_LINES[J - 1]),
      ];
  /** Lit one after another through each half of the cycle. */
  $: lit = running ? Math.min(arrows.length - 1, Math.floor(half * arrows.length * 1.15)) : -1;
  $: isLit = (i: number) => (running ? (lit === i ? 1 : 0.22) : 1);

  /* ── Layout: the levels on the left third, the spectrum on the rest ── */
  $: JAB = {
    x: lerp(10, 26, t),
    w: lerp(66, 122, t),
    v0: lerp(74, 206, t),
    v1: lerp(34, 100, t),
  };
  /** How far the rotational rungs spread; they barely show on the card. */
  $: RP = lerp(0.8, 2.6, t);
  const JS = [0, 1, 2, 3, 4];
  $: lvl = (v: number, J: number) => (v ? JAB.v1 : JAB.v0) - RP * J * (J + 1);

  /** The baseline sits high and the bands hang below it: the shared plot. */
  $: SP = {
    x0: lerp(100, 196, t),
    x1: lerp(212, 462, t),
    base: lerp(34, 96, t),
    tall: lerp(44, 130, t),
  };
  const SPAN = 7.6;
  $: sx = (u: number) => (SP.x0 + SP.x1) / 2 - (u / SPAN) * ((SP.x1 - SP.x0) / 2);

  /** What a spectrometer of a few cm⁻¹ resolution makes of the lines. */
  $: envD = (() => {
    /* Smoothed over several line spacings, not one: an envelope as sharp as
       the lines it covers just traces them back as a saw-tooth, and the
       whole point of it is the two lobes and the gap between them that a
       real instrument actually delivers. */
    const w = lerp(6, 13, t);
    const ys: number[] = [];
    for (let x = SP.x1; x >= SP.x0; x -= 1) {
      let y = 0;
      for (const l of lines) y += l.h * Math.exp(-(((x - sx(l.u)) / w) ** 2));
      ys.push(y);
    }
    /* Normalised to the plot rather than scaled by a constant: with the Q
       branch present, six full-sized lines land on one spot and the sum
       runs off the bottom of the panel otherwise. */
    const peak = Math.max(...ys, 0.001);
    const pts = ys.map((y, i) => {
      const x = SP.x1 - i;
      return `${x.toFixed(1)},${(SP.base + (y / peak) * 0.9 * SP.tall).toFixed(1)}`;
    });
    return 'M' + pts.join(' L');
  })();

  const up = (x: number, y: number, s: number) =>
    `M${x - s},${y + s * 1.5} L${x},${y} L${x + s},${y + s * 1.5}`;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  $: AX = { ox: JAB.x - 8, top: JAB.v1 - RP * 20 - 12, oy: JAB.v0 + 14 };
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Two vibrational levels on the left, each carrying its own rotational levels, and the band they make on the right. One photon changes v and J at the same time: J up by one gives the R branch above the band origin, J down by one gives the P branch below it, and J unchanged gives a Q branch on the origin itself, which appears only where the symmetry allows. Seen in Raman instead, the same transition gives O and S branches, two rotational steps out on either side rather than one. The dashed vertical marks the origin, where the line would sit if the molecule did not turn"
>
  <g style="opacity:{fullOpacity}">
    <path
      class="axis-line"
      d="M{AX.ox},{AX.oy} V{AX.top} M{AX.ox - 3},{AX.top + 5} L{AX.ox},{AX.top} L{AX.ox + 3},{AX.top + 5}"
    />
  </g>

  <!-- ── The two vibrational levels, each with its rotational rungs ── -->
  {#each [0, 1] as v}
    {#each JS as J}
      <line
        class="level"
        class:ground={J === 0}
        x1={JAB.x}
        x2={JAB.x + JAB.w}
        y1={lvl(v, J)}
        y2={lvl(v, J)}
      />
    {/each}
  {/each}

  <!-- Ordered by where their line falls in the spectrum, left to right. -->
  {#each arrows as a, i}
    {@const x = JAB.x + 14 + ((JAB.w - 28) * i) / Math.max(arrows.length - 1, 1)}
    {@const to = a.b === 'R' ? a.J + 1
      : a.b === 'P' ? a.J - 1
      : a.b === 'S' ? a.J + 2
      : a.b === 'O' ? a.J - 2
      : a.J}
    <g class="tr {a.b}" style="opacity:{isLit(i)}">
      <line x1={x} x2={x} y1={lvl(0, a.J)} y2={lvl(1, to) + 1} />
      <path d={up(x, lvl(1, to), lerp(2, 2.8, t))} />
    </g>
  {/each}

  <!-- ── The band: its lines, and the envelope a real instrument sees ── -->
  <line class="axis" x1={SP.x0} x2={SP.x1} y1={SP.base} y2={SP.base} />
  <line class="origin" x1={sx(0)} x2={sx(0)} y1={SP.base - 6} y2={SP.base + SP.tall + 6} />
  {#each lines as l}
    {@const k = arrows.findIndex(a => a.b === l.b && a.J === l.J)}
    <line
      class="stick {l.b}"
      style="opacity:{k >= 0 ? isLit(k) : running ? 0.22 : 1}"
      x1={sx(l.u)}
      x2={sx(l.u)}
      y1={SP.base}
      y2={SP.base + l.h * SP.tall * 0.74}
    />
  {/each}
  <path class="env" d={envD} />

  <g style="opacity:{labelOpacity}">
    <text class="lbl faint" x={JAB.x + JAB.w + 6} y={JAB.v0 + 4}>v = 0</text>
    <text class="lbl faint" x={JAB.x + JAB.w + 6} y={JAB.v1 + 4}>v = 1</text>
    <!-- Named where the branch actually sits, in the branch's own colour. -->
    {#if raman}
      <text class="tick S" x={sx(5)} y={SP.base - 8} text-anchor="middle">S: ΔJ = +2</text>
      <text class="tick O" x={sx(-5)} y={SP.base - 8} text-anchor="middle">O: ΔJ = −2</text>
    {:else}
      <text class="tick R" x={sx(3.6)} y={SP.base - 8} text-anchor="middle">R: ΔJ = +1</text>
      <text class="tick P" x={sx(-3.6)} y={SP.base - 8} text-anchor="middle">P: ΔJ = −1</text>
    {/if}
    {#if qAllowed}
      <text class="tick Q" x={sx(0)} y={SP.base - 22} text-anchor="middle">Q: ΔJ = 0</text>
    {/if}
  </g>

  {#if opened}
    <g style="opacity:{labelOpacity}">
      <text class="lbl axis" x={AX.ox - 12} y={AX.top + 10}>E</text>
      <text class="lbl why" x={JAB.x} y={JAB.v0 + 36}>one photon, two</text>
      <text class="lbl faint" x={JAB.x} y={JAB.v0 + 49}>changes: v and J</text>
      <text class="lbl faint" x={JAB.x} y={JAB.v0 + 62}>at the same time</text>
      <!-- The case being shown, which is half the point of the card. -->
      {#if raman}
        <text class="lbl S" x={SP.x0} y={SP.base + SP.tall + 34}>the same mode in Raman: the polarizability</text>
        <text class="lbl S" x={SP.x0} y={SP.base + SP.tall + 47}>is a rank-two tensor, so ΔJ reaches ±2.</text>
        <text class="lbl S" x={SP.x0} y={SP.base + SP.tall + 60}>O and S, and twice the line spacing</text>
      {:else if qAllowed}
        <text class="lbl Q" x={SP.x0} y={SP.base + SP.tall + 34}>a bend, swinging across the axis:</text>
        <text class="lbl Q" x={SP.x0} y={SP.base + SP.tall + 47}>ΔJ = 0 is allowed. One Q line per J,</text>
        <text class="lbl Q" x={SP.x0} y={SP.base + SP.tall + 60}>almost on top of each other</text>
      {:else}
        <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 34}>a stretch, along the axis: no Q, and</text>
        <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 47}>the band is left with a gap at its</text>
        <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 60}>own centre</text>
      {/if}
      <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 76}>sticks: the lines themselves. dashed:</text>
      <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 89}>the envelope a real instrument sees</text>
    </g>
  {/if}

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="18">One Photon Changes v and J</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .level { stroke: var(--ink-slate-400); stroke-width: 1; stroke-opacity: 0.8; stroke-linecap: round; }
  .level.ground { stroke: var(--ink-slate-500); stroke-width: 1.4; stroke-opacity: 1; }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .axis-line { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  /* The band origin: where the line would sit if the molecule did not turn. */
  .origin { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  /* What a few cm⁻¹ of resolution makes of the lines: the two lobes, and
     the gap between them when there is no Q branch to fill it. */
  .env { fill: none; stroke: var(--ink-slate-500); stroke-width: 1.2; stroke-dasharray: 4 3; }

  /* Colour is the meaning here: which way J moved. R is the bluer branch
     (the photon paid for a rotational step as well), P the redder (the
     molecule gave one back), Q the green of the other cards, since it is
     the one that only appears when the symmetry permits. */
  .tr line, .tr path {
    fill: none;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: opacity 0.25s;
  }
  /* S and O take the same two inks as R and P: the colour says which way J
     moved, and that does not change because the photon count did. */
  .tr.R line, .tr.R path, .tr.S line, .tr.S path { stroke: var(--diagram-anti-stokes); }
  .tr.P line, .tr.P path, .tr.O line, .tr.O path { stroke: var(--diagram-stokes); }
  .tr.Q line, .tr.Q path { stroke: var(--accent-green-fg); }

  .stick { stroke-width: 1.8; stroke-linecap: round; transition: opacity 0.25s; }
  .stick.R, .stick.S { stroke: var(--diagram-anti-stokes); }
  .stick.P, .stick.O { stroke: var(--diagram-stokes); }
  .stick.Q { stroke: var(--accent-green-fg); stroke-width: 2.4; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.85), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
  .tick.R, .tick.S { fill: var(--diagram-anti-stokes); }
  .tick.P, .tick.O { fill: var(--diagram-stokes); }
  .tick.Q { fill: var(--accent-green-fg); }
  .lbl.S { fill: var(--diagram-anti-stokes); }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.why { fill: var(--brand-700); }
  .lbl.Q { fill: var(--accent-green-fg); }
  .lbl.axis { font-style: italic; }
  .lbl.name { fill: var(--ink-slate-900); }
</style>

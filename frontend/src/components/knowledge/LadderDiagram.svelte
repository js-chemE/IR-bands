<script lang="ts">
  /**
   * Two ways one photon can do more than one energy level's worth of work.
   *
   *   kind = 'overtone'
   *     t = 0  the card: a bare Jablonski diagram on the left third, levels
   *            as plain lines, the fundamental and the first overtone; the
   *            spectrum beside it, with an infrared photon sweeping it from
   *            right to left, the way the wavenumber axis runs.
   *     t = 1  the opened card: the same levels, now inside the well they
   *            belong to, with the second overtone added.
   *
   *   kind = 'combination'  the same structure, but two wells stacked on the
   *     left instead of one, ν₁ above ν₂. The photon sweeps the same axis and
   *     meets three bands: ν₂ alone, where the lower well fires; ν₁ alone,
   *     where the upper fires; and the combination, where BOTH fire at once.
   *     That simultaneity is the whole point, so it is also drawn standing
   *     still: a brace spans the two wells and is labelled with the sum, so a
   *     reader who never sees the animation still gets the claim.
   *
   * The spectrum is drawn as an absorption measurement: a flat baseline near
   * the top and bands going down from it, so the photon can travel just above
   * the baseline instead of being pushed clear of a row of upright peaks.
   *
   * The clock, the sweep, the wave packet, the one-arrow-at-a-time reveal and
   * the dot that climbs and falls back are all the IR Spectroscopy card's
   * (`SpectrumDiagram.svelte`); this card is the same experiment seen from the
   * molecule's side, so it should move at the same rate and in the same way.
   *
   * Why an overtone falls short is shown rather than asserted: the levels
   * crowd together as v rises, while dashed verticals mark the exact
   * multiples of the fundamental, so the gap between a band and its own
   * dashed line is the anharmonicity. Why it is weak is the curved
   * annotation between the first two bands. The combination card borrows the
   * same device: a dashed line at the exact sum, with the band a little under
   * it, for the same reason.
   */
  export let t = 0;
  export let playing = false;
  export let kind: 'overtone' | 'combination' = 'overtone';

  import { onDestroy } from 'svelte';

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));

  /* ── The well, shared with the Vibrational Excitation card ── */
  const A = 1.6;
  const RE = 1;
  const LAMBDA = 6;
  const R_MIN = 0.545;
  const R_MAX = 3.2;
  /* The well is plotted over the span its levels use, not out to the
     plateau: past this the curve is flat and says nothing. It has to reach
     past v = 3's outer turning point (r = 2.50) all the same, or the top
     level line runs out beyond the wall it is supposed to end on. */
  const R_PLOT_MAX = 2.62;
  const level = (v: number) => (2 * LAMBDA * (v + 0.5) - (v + 0.5) ** 2) / LAMBDA ** 2;
  const morse = (r: number) => (1 - Math.exp(-A * (r - RE))) ** 2;
  const inner = (e: number) => RE - Math.log(1 + Math.sqrt(e)) / A;
  const outer = (e: number) => RE - Math.log(1 - Math.sqrt(e)) / A;
  /** A step up from the ground state, in units of the fundamental. */
  const gap = (v: number) => (level(v) - level(0)) / (level(1) - level(0));

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 300 };
  /* The frame ends where the drawing ends. Holding the overtone card open to
     the combination card's height left a band of empty svg between the
     diagram and its legend. */
  $: fullH = kind === 'overtone' ? 268 : 330;

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, fullH, t);
  $: scale = lerp(S.px, 1, t);
  /** The second overtone joins only once there is room to explain it. */
  $: opened = t > 0.55;

  /* ── Clock: the IR Spectroscopy card's, so the two cards keep time ──
     The combination card has four bands to the overtone card's three and a
     step in two wells to follow at each one, so it is given longer. */
  $: CYCLE = kind === 'combination' ? 10000 : 4600;
  const SWEEP = 0.8; // fraction of the cycle spent moving
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

  /* ── The transitions and the bands they leave ──────────────────────
   * Heights fall by about two orders of magnitude a step. Drawn at a
   * gentler ratio, since a truthful second overtone would be invisible;
   * the annotation says so rather than the picture lying quietly.
   */
  const ALL = [
    { v: 1, label: 'ν', h: 1 },
    { v: 2, label: '2ν', h: 0.13 },
    { v: 3, label: '3ν', h: 0.03 },
  ];
  /* Small, the overtone is drawn taller than the truth simply to exist at
     220 px; opened, it drops to the ratio the annotation then explains. */
  $: steps = (opened ? ALL : ALL.slice(0, 2)).map(st => ({
    ...st,
    h: opened ? st.h : Math.max(st.h, st.v === 1 ? 1 : 0.3),
  }));
  $: maxV = opened ? 3 : 2;

  /* ── Combination: two modes, and the four bands they leave ──────────
   * Generic on purpose. ν₂ is the softer mode, so it sits lower on the
   * axis and the photon meets it first; the sum lands a little under
   * ν₁ + ν₂ for the same anharmonicity that makes an overtone fall short.
   *
   * `moves` is which wells the photon drives, and which way. A sum takes a
   * step UP in both. A difference takes a step up in one and a step DOWN in
   * the other, which is why it needs a molecule that is already vibrating
   * and why it fades as the sample cools. It is the same kind of band
   * either way, and carries the same tag: a difference is a combination
   * with a minus sign, not a separate species of thing.
   */
  const U1 = 1.0;
  const U2 = 0.62;
  const U_EXACT = U1 + U2;
  const U_SUM = 1.55; // a little under U_EXACT
  const U_DIFF = U1 - U2;
  /* The sum and the difference are the shallow ones, as they should be, but
     not so shallow that the card's own subject is the faintest mark on it:
     drawn at a third rather than the hundredth a truthful ratio would give,
     the same compromise the overtone card makes and captions.
     `from`/`to` are states of the two-mode system, written (v₁, v₂): the
     third column stacks them on one axis, so a band is simply the step
     between two of its levels and its length IS the photon energy. */
  const COMBO = [
    { u: U_DIFF, h: 0.22, label: 'ν₁−ν₂', from: [0, 1], to: [1, 0] },
    { u: U2, h: 0.78, label: 'ν₂', from: [0, 0], to: [0, 1] },
    { u: U1, h: 1, label: 'ν₁', from: [0, 0], to: [1, 0] },
    { u: U_SUM, h: 0.34, label: 'ν₁+ν₂', from: [0, 0], to: [1, 1] },
  ];
  /** The band the brace is about, so it lights for the sum and not the rest. */
  const SUM_I = COMBO.findIndex(b => b.label === 'ν₁+ν₂');

  /* ── One event at a time, not a sweep ──────────────────────────────
   * The combination card runs the Vibrational Excitation card's loop
   * instead: a photon arrives, the step is taken, it is held, it relaxes,
   * and the next band follows. The spectrum fills in one dip per event, so
   * the trace is built by the excitations rather than uncovered by a
   * travelling photon.
   */
  /* The photon sweeps the axis here too, as on the overtone card, just
     slowly: flying it diagonally into the columns meant it crossed the whole
     card on every band. It stays over its own spectrum and the columns
     answer as it passes each dip. */

  /** One list of spectral features, whichever card this is. */
  $: bands = kind === 'overtone'
    ? steps.map(st => ({ u: gap(st.v), h: st.h, label: st.label }))
    : COMBO;

  /* ── The sweep: right to left, the way the wavenumber axis runs ── */
  /* Just past the last band drawn: the closed overtone card shows two, so it
     should not hold a third of its axis open for a band it omits. */
  $: SPAN = kind === 'combination' ? 1.95 : opened ? 3.5 : 2.3;
  $: p = running ? (clock % CYCLE) / CYCLE : 1;
  $: scanU = running ? Math.min(1, p / SWEEP) * SPAN : SPAN;
  $: sweeping = running && p < SWEEP;
  /** A band is there once the photon has gone past its position. */
  $: reached = (u: number) => (running ? ramp(scanU, u - 0.05, u + 0.05) : 1);
  /** And its step lights while the photon is on it. Wide enough that the
      climb and the fall back are readable rather than a flicker. */
  $: onNow = (u: number) => (sweeping ? Math.exp(-(((scanU - u) / 0.3) ** 2)) : 0);
  $: hot = bands.map(b => onNow(b.u));
  $: hotMax = hot.length ? Math.max(...hot) : 0;
  /** The band where the second mode steps back down: the difference. */
  $: isDiff = (i: number) =>
    kind === 'combination' && COMBO[i].to[MODES[1].si] < COMBO[i].from[MODES[1].si];
  /**
   * How much of band i's dip has been drawn into the spectrum.
   *
   * The difference band is held back until the sweep actually reaches it:
   * standing still the card shows the combination alone, because a fourth
   * dip sitting there unexplained reads as another species rather than as
   * the same two modes with a minus sign.
   */
  $: drawn = (i: number, u: number) => (!running && isDiff(i) ? 0 : reached(u));

  /* ── Layout: the levels on the left third, the spectrum on the rest ── */
  /* Narrower opened than it looks like it could be: the level lines have to
     end early enough to leave room for their own `v = n` names before the
     spectrum starts, the way the Vibrational Excitation card names them. */
  $: JAB = {
    x: lerp(10, 26, t),
    w: lerp(86, 118, t),
    top: lerp(16, 52, t),
    h: lerp(62, 150, t),
  };
  /** The baseline sits high and the bands hang below it: an absorption plot. */
  $: SP = {
    x0: lerp(100, 196, t),
    x1: lerp(212, 462, t),
    base: lerp(34, 96, t),
    tall: lerp(44, 130, t),
  };

  /**
   * Where level v sits. Bare, the levels are drawn as the equal steps a
   * harmonic oscillator would have; opening the card lets them fall into
   * the crowded places a real well puts them, so the crowding is not
   * asserted, it happens in front of the reader.
   */
  const eEqual = (v: number) => (level(1) - level(0)) * v;
  const eReal = (v: number) => level(v) - level(0);
  $: eAt = (v: number) => lerp(eEqual(v), eReal(v), t);

  /**
   * Energy above the ground state → a y in the panel.
   *
   * The panel is scaled to the well, not to the levels: the floor sits a
   * zero-point energy below the ground state and the walls climb half as
   * far again above the top level. Scaling to the levels instead put the
   * curve and its own levels in different bands of the panel.
   */
  const E_FLOOR = -level(0);
  const E_SPAN = eReal(3) * 1.35 - E_FLOOR;
  // `e` always arrives measured from the ground state, so the floor is
  // folded into the span and never subtracted again here: doing both is
  // what kept the curve and its own levels in different bands.
  $: yAt = (e: number) => JAB.top + JAB.h - ((e - E_FLOOR) / E_SPAN) * JAB.h;
  $: yLevel = (v: number) => yAt(eAt(v));
  /** Where an equally spaced ladder would have put it: the comparison. */
  $: yEqual = (v: number) => yAt(eEqual(v));

  const xOf = (r: number) => JAB.x + ((r - R_MIN) / (R_PLOT_MAX - R_MIN)) * JAB.w;
  /** A level line: the full width bare, the well's turning points once open. */
  $: lineOf = (v: number) => {
    const e = eReal(v) + level(0);
    return {
      x1: lerp(JAB.x + 6, xOf(inner(e)), t),
      // Clamped to the plotted span: v = 3 turns round past the point the
      // well is drawn to, and a level line reaching beyond its own well
      // reads as a mistake.
      x2: lerp(JAB.x + JAB.w - 6, xOf(Math.min(outer(e), R_PLOT_MAX)), t),
    };
  };

  /**
   * The well. It is measured from the same origin as the levels: the bottom
   * of the well, with the ground state sitting a zero-point energy above it.
   * Mapping it from a different origin drew it floating clear of its own
   * levels.
   */
  function curve(f: (r: number) => number, mapY: (e: number) => number) {
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const r = R_MIN + ((R_PLOT_MAX - R_MIN) * i) / 120;
      const e = f(r) - level(0);
      if (e > E_FLOOR + E_SPAN) continue;
      pts.push(`${xOf(r).toFixed(1)},${mapY(e).toFixed(1)}`);
    }
    return pts.length > 1 ? 'M' + pts.join(' L') : '';
  }
  /* Built here, not in the markup, and taking the y mapping as an argument.
     `curve` and `morse` are both consts, so `d={curve(morse)}` gave Svelte
     nothing to watch: the path stayed frozen at its t = 0 shape while the
     levels drawn over it moved into place. `yAt` moves with the panel, so
     passing it in is both the dependency and the thing that was missing. */
  $: wellD = curve(morse, yAt);

  const up = (x: number, y: number, s: number) =>
    `M${x - s},${y + s * 1.5} L${x},${y} L${x + s},${y + s * 1.5}`;
  const down = (x: number, y: number, s: number) =>
    `M${x - s},${y - s * 1.5} L${x},${y} L${x + s},${y - s * 1.5}`;

  /* ── Which step the photon is on, if any ──────────────────────────────
   * One mode, so one dot rather than the IR Spectroscopy card's one per
   * ladder: it climbs to whichever level the photon is currently reaching
   * and falls back once the photon has gone past.
   */
  $: hotV = hot.length && kind === 'overtone' ? steps[hot.indexOf(hotMax)].v : 1;
  /* The arrows and the dot all have to stand on the ground level, which is
     the shortest line in the well, so they are spaced to fit between its
     turning points rather than to look evenly placed on their own. */
  $: dotX = lerp(JAB.x + JAB.w - 34, xOf(RE) + 15, t);
  $: dotY = lerp(yLevel(0), yLevel(hotV), hotMax);
  $: arrowX = (i: number) => lerp(JAB.x + 26 + i * 13, xOf(RE) - 4 + i * 7, t);

  /* ── Combination geometry: two wells, one above the other ────────────
   * Same Morse curve twice, but each panel shows a different slice of
   * energy, so ν₂'s step is visibly the smaller one without having to draw
   * a differently shaped well for it.
   */
  /**
   * Three columns on ONE energy axis: mode ν₂ by itself, mode ν₁ by itself,
   * and the two-mode system where their steps stack.
   *
   * The shared axis is the whole point. On it a combination is simply the
   * step from (0,0) to (1,1), and its arrow is exactly as tall as the ν₁ and
   * ν₂ arrows laid end to end; a difference is the step from (0,1) to (1,0),
   * which is shorter by construction and has to START from an excited level,
   * so the picture says why it needs a warm sample without a caption.
   *
   * The states are written (v₁, v₂) rather than by height, because the level
   * at ν₂'s energy is ν₂ excited with ν₁ AT REST, not some part-way
   * excitation of ν₁: two different modes, two different rest states.
   */
  /* Narrow enough that the (v₁, v₂) names on the right of the third column
     still finish before the spectrum starts at x = 196. */
  $: CJ = {
    x: lerp(6, 24, t),
    w: lerp(92, 120, t),
    top: lerp(14, 44, t),
    h: lerp(70, 200, t),
  };
  const E_OF = (s: number[]) => s[0] * U1 + s[1] * U2;
  const E_HEAD = U_EXACT * 1.16; // headroom above the topmost state
  $: cyE = (e: number) => CJ.top + CJ.h - (e / E_HEAD) * CJ.h;
  /** Column centres: ν₂, ν₁, then the system the two of them make. */
  $: colX = (k: number) => CJ.x + CJ.w * (0.13 + k * 0.37);
  $: colHalf = lerp(11, 15, t);
  /* The two single-mode columns, ν₁ first. `si` indexes into the (v₁, v₂)
     state pair. The order is what lets the big sign between them read
     straight: ν₁ + ν₂ and ν₁ − ν₂. With ν₂ on the left the minus would be
     claiming ν₂ − ν₁, which is the other band entirely. */
  const MODES = [
    { name: 'ν₁', e: U1, col: 0, si: 0 },
    { name: 'ν₂', e: U2, col: 1, si: 1 },
  ];
  /** The levels the composite column carries, low to high. */
  const STATES = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];

  /**
   * Which band the columns are answering. It sticks to the last one the
   * sweep actually reached rather than falling back between dips, or the
   * combined column would blink in and out as the photon crossed the gaps.
   * At rest it is the sum: the band the card is named for, and the one
   * where the long arrow is plainly the two steps added.
   */
  let lastBandI = 0;
  $: if (kind === 'combination' && running && hotMax > 0.15) lastBandI = hot.indexOf(hotMax);
  $: if (!running) lastBandI = SUM_I;
  $: shownBand = kind === 'combination' ? COMBO[lastBandI] ?? COMBO[SUM_I] : null;

  /* ── The spectrum: one continuous trace, bands hanging down ── */
  $: sx = (u: number) => SP.x1 - (u / SPAN) * (SP.x1 - SP.x0);
  /** How far down from the baseline the trace has fallen at a band's centre. */
  $: yDip = (h: number) => SP.base + h * SP.tall;
  /**
   * Which bands are a plain fundamental: one mode, one step. On the
   * combination card these are drawn dashed, because they are the parents
   * rather than the subject; the sum and the difference stay solid.
   */
  $: isSolo = (i: number) =>
    kind === 'combination' &&
    MODES.filter(m => COMBO[i].to[m.si] !== COMBO[i].from[m.si]).length === 1;

  $: traceD = (() => {
    const w = lerp(3.4, 5.2, t);
    const pts: string[] = [];
    // Overtone: right to left, and only as far as the photon has gone, so
    // the spectrum appears behind it. Combination: the whole axis is there
    // from the start and each dip arrives when its own excitation happens.
    const edge = kind === 'combination' ? SP.x0 : running ? Math.max(SP.x0, sx(scanU)) : SP.x0;
    for (let x = SP.x1; x >= edge; x -= 1) {
      let y = 0;
      for (let i = 0; i < bands.length; i++) {
        // The dashed ones are drawn separately, so they are left out here
        // or they would show through solid underneath their own dash.
        if (isSolo(i)) continue;
        const b = bands[i];
        y += b.h * drawn(i, b.u) * Math.exp(-(((x - sx(b.u)) / w) ** 2));
      }
      pts.push(`${x.toFixed(1)},${(SP.base + y * SP.tall).toFixed(1)}`);
    }
    return pts.length > 1 ? 'M' + pts.join(' L') : '';
  })();

  /**
   * A path of its own for each dashed fundamental, over a window just wide
   * enough to hold its dip, so it meets the main trace flat at both ends.
   * The dash gap closes to nothing while its own event runs: the line is
   * drawn onto it when it is that band's turn, and goes back to dashed.
   */
  $: soloPaths = bands
    .map((b, i) => ({ b, i }))
    .filter(({ i }) => isSolo(i))
    .map(({ b, i }) => {
      const w = lerp(3.4, 5.2, t);
      const cx = sx(b.u);
      /* Only as wide as the dip itself. Solved from where the curve is
         still about a pixel below the baseline: past that it is flat, and a
         dashed flat line reads as a dashed baseline rather than as a
         dashed peak, which is what it looked like. */
      const half = w * Math.sqrt(Math.log(Math.max(b.h * SP.tall, 2.8)));
      const x0 = Math.max(SP.x0, cx - half);
      const x1 = Math.min(SP.x1, cx + half);
      const pts: string[] = [];
      for (let x = x1; x >= x0; x -= 1) {
        const y = b.h * drawn(i, b.u) * Math.exp(-(((x - cx) / w) ** 2));
        pts.push(`${x.toFixed(1)},${(SP.base + y * SP.tall).toFixed(1)}`);
      }
      const on = hot[i] ?? 0;
      return {
        d: pts.length > 1 ? 'M' + pts.join(' L') : '',
        dash: `${lerp(3.5, 5, t)} ${(lerp(3, 4, t) * (1 - on)).toFixed(2)}`,
      };
    });

  /**
   * The photon, a wave packet, exactly as on the IR Spectroscopy card: a
   * Gaussian envelope so it is narrow at both ends and bulges in the middle,
   * a phase that runs with the clock so it wiggles as it travels, a
   * wavelength that tightens as it climbs the axis, and a fade as it is
   * swallowed. At rest it waits at the end the sweep starts from; during the
   * pause at the end of a sweep it is gone.
   */
  /** One wave packet, built the same way wherever it is going. */
  function packet(cx: number, cy: number, span: number, period: number, phase: number, amp: number) {
    const pts: string[] = [];
    for (let dx = -span; dx <= span; dx += 0.75) {
      const env = Math.exp(-((dx / (span * 0.55)) ** 2));
      pts.push(`${(cx + dx).toFixed(1)},${(cy + amp * env * Math.sin((dx / period) * 2 * Math.PI - phase)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }

  $: photon = (() => {
    /* On the combination card the photon does not sweep an axis: it flies
       in at the height of the step it is about to drive and is swallowed,
       the way it does on the Vibrational Excitation card. Its height alone
       says which band this is, before any arrow is drawn. */
    if (running && !sweeping) return null;
    const span = lerp(16, 24, t);
    const restX = SP.x1 - span * 0.8;
    const cx = sweeping ? Math.min(restX, sx(scanU)) : restX;
    // Clear of the band names, which sit just above the baseline.
    const cy = SP.base - lerp(12, 30, t);
    const period = lerp(6, 9, t) * (1 - 0.35 * (sweeping ? scanU / SPAN : 0));
    const fade = 1 - 0.85 * hotMax;
    const amp = lerp(2.6, 3.4, t) * fade;
    const phase = sweeping ? (clock / 90) * 2 * Math.PI : 0;
    return { d: packet(cx, cy, span, period, phase, amp), cx, cy, amp: lerp(2.6, 3.4, t), fade };
  })();

  /**
   * The curved annotation between the first two bands. It is the one place
   * the intensity drop is stated, since the bands themselves are drawn at a
   * gentler ratio than the truth so that the overtone exists on the page.
   */
  $: annotation = (() => {
    if (kind !== 'overtone' || !opened || steps.length < 2) return null;
    const [a, b] = steps;
    const ax = sx(gap(a.v)) - 6;
    const ay = yDip(a.h) - 6;
    const bx = sx(gap(b.v)) + 5;
    const by = yDip(b.h) + 9;
    const kx = lerp(ax, bx, 0.45);
    const ky = ay + 10;
    // A head on the far end, along the curve's own tangent there.
    const tx = bx - kx;
    const ty = by - ky;
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    const head = (rot: number) => {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      return `M${(bx - 7 * (ux * c - uy * s)).toFixed(1)},${(by - 7 * (ux * s + uy * c)).toFixed(1)} L${bx.toFixed(1)},${by.toFixed(1)}`;
    };
    return {
      d: `M${ax.toFixed(1)},${ay.toFixed(1)} Q${kx.toFixed(1)},${ky.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`,
      head: head(0.42) + ' ' + head(-0.42),
      // The caption row at the foot of the card, level with the notes under
      // the well, rather than floating in among the bands. Indented past
      // where those notes end, not merely past where the spectrum starts.
      lx: SP.x0 + 40,
      ly: JAB.top + JAB.h + 40,
      // It is about the overtone, so it arrives with the overtone.
      show: reached(gap(b.v)),
    };
  })();

  /* E and r, built the way the Vibrational Excitation card builds them: the
     same origin offset, the same 5-long arrowheads, the same label offsets,
     so the two wells read as the same picture twice. On the combination card
     one E axis spans both panels, since they share the scale. */
  /* The combination card gets the E axis but no r: its horizontal direction
     is three separate systems side by side, not a bond length, and an axis
     drawn along it would be claiming a quantity that is not there. */
  $: AX = kind === 'combination'
    ? { ox: CJ.x - 8, oy: CJ.top + CJ.h + 8, top: CJ.top - 6, right: CJ.x + CJ.w + 6, hasR: false }
    : { ox: JAB.x - 8, oy: JAB.top + JAB.h + 8, top: JAB.top - 6, right: JAB.x + JAB.w + 6, hasR: true };

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  /** The well only means anything once there is room for it. */
  $: wellOpacity = ramp(t, 0.3, 0.8);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label={kind === 'overtone'
    ? 'Energy levels on the left and an absorption spectrum on the right. An infrared photon sweeps from high to low wavenumber; where it matches it lifts the vibration one level, then two, then three, leaving a deep fundamental band and much shallower overtones. Dashed verticals mark the exact multiples of the fundamental, and each overtone falls short of its own line because the levels crowd together as the well flattens'
    : 'Three columns on one energy axis: the mode ν₂ alone, the mode ν₁ alone, and the system the two of them make, whose levels are labelled by which modes are excited. A photon arrives and one long arrow spans the step it drives, exactly as tall as the ν₁ and ν₂ steps added together for a combination band, and shorter and starting from an already excited level for a difference band. Each excitation leaves its own dip in the absorption spectrum on the right'}
>
  <!-- E and r, as on the Vibrational Excitation card: the same well seen
       again, so it carries the same axes. -->
  <g style="opacity:{fullOpacity}">
    <path
      class="axis-line"
      d="M{AX.ox},{AX.oy} V{AX.top} M{AX.ox - 3},{AX.top + 5} L{AX.ox},{AX.top} L{AX.ox + 3},{AX.top + 5}"
    />
    {#if AX.hasR}
      <path
        class="axis-line"
        d="M{AX.ox},{AX.oy} H{AX.right} M{AX.right - 5},{AX.oy - 3} L{AX.right},{AX.oy} L{AX.right - 5},{AX.oy + 3}"
      />
    {/if}
  </g>

  {#if kind === 'overtone'}
    <!-- ── The levels, bare at first, in their well once opened ── -->
    <path class="well" d={wellD} style="opacity:{wellOpacity}" />

    {#each [0, 1, 2, 3].filter(v => v <= maxV) as v}
      <!-- Where an equally spaced ladder would have put the level: drawn
           over the right-hand end of the real one, beside its name, so the
           sag reads as the gap between two lines rather than as a claim. It
           is invisible on the closed card, where the levels are still drawn
           equally spaced and the two would lie on top of each other. -->
      {#if v > 1}
        <line
          class="equal-level"
          style="opacity:{wellOpacity}"
          x1={Math.max(lineOf(v).x1, lineOf(v).x2 - 45)}
          x2={lineOf(v).x2 + 4}
          y1={yEqual(v)}
          y2={yEqual(v)}
        />
      {/if}
      <line class="level" class:ground={v === 0} class:hot={hotMax > 0.35 && hotV === v} x1={lineOf(v).x1} x2={lineOf(v).x2} y1={yLevel(v)} y2={yLevel(v)} />
      <!-- Named on the right, as on the Vibrational Excitation card. -->
      <text class="lbl" x={lineOf(v).x2 + 6} y={yLevel(v) + 4} style="opacity:{labelOpacity}">v = {v}</text>
    {/each}

    <!-- At rest every arrow is drawn; while sweeping, one at a time, as the
         photon reaches each step and then drops away again. -->
    {#each steps as st, i}
      {@const x = arrowX(i)}
      <g style="opacity:{running ? hot[i] : 1}">
        <line class="arrow" x1={x} x2={x} y1={yLevel(0)} y2={yLevel(st.v) + 1} />
        <path class="arrow-head" d={up(x, yLevel(st.v), lerp(2.4, 3.2, t))} />
        <!-- The same name the band carries in the spectrum, so the step and
             the band it leaves read as one thing. Set to the LEFT of its own
             arrow, and further left the higher it goes: the arrows stand 7 px
             apart and these names are twice that wide, so centring them on
             the arrows piles them into each other. -->
        <text
          class="lbl trans"
          x={x - lerp(5, 6, t) - i * lerp(5, 7, t)}
          y={yLevel(st.v) - 5}
          text-anchor="end"
          style="opacity:{labelOpacity}"
        >{st.label}</text>
      </g>
    {/each}

    <!-- Hollow in the ground state, filled while excited, as on the IR
         Spectroscopy card: it climbs a step and falls back between bands. -->
    <circle class="dot" class:filled={hotMax > 0.3} cx={dotX} cy={dotY} r={lerp(2.8, 3.8, t)} />
  {:else}
    <!-- ── Three columns on one axis: ν₂, ν₁, and the two of them together ── -->
    {@const b = shownBand}
    {@const lit = running ? Math.max(hotMax, 0.28) : 1}
    <!-- A fundamental moves one mode and has nothing to do with the combined
         system, so none of that column is drawn while one is showing: no
         levels, no state names, no leaders, no long arrow. Showing it would
         be claiming a second mode is involved when it is not. -->
    {@const twoMode = !!b && MODES.filter(m => b.to[m.si] !== b.from[m.si]).length === 2}
    {#each MODES as m}
      {@const cx = colX(m.col)}
      {@const y0 = cyE(0)}
      {@const y1 = cyE(m.e)}
      {@const dir = b ? b.to[m.si] - b.from[m.si] : 0}
      <!-- Each mode keeps its own rest state. The v = 0 line here is THIS
           mode unexcited; it is not the same thing as the other mode's
           excited level, even though the shared axis puts them on one scale. -->
      <line class="level ground" x1={cx - colHalf} x2={cx + colHalf} y1={y0} y2={y0} />
      <line
        class="level"
        class:hot={running && dir !== 0 && hotMax > 0.35}
        x1={cx - colHalf}
        x2={cx + colHalf}
        y1={y1}
        y2={y1}
      />
      <!-- Dashed across to where this mode's quantum lands in the combined
           system: the stacking, made visible rather than asserted. -->
      {#if twoMode}
        <line class="leader" style="opacity:{fullOpacity * 0.9}" x1={cx + colHalf} x2={colX(2) - colHalf} y1={y1} y2={y1} />
      {/if}
      {#if dir !== 0}
        <g style="opacity:{lit}">
          {#if dir > 0}
            <line class="arrow" x1={cx} x2={cx} y1={y0} y2={y1 + 1} />
            <path class="arrow-head" d={up(cx, y1, lerp(2.4, 3.2, t))} />
          {:else}
            <line class="arrow" x1={cx} x2={cx} y1={y1} y2={y0 - 1} />
            <path class="arrow-head" d={down(cx, y0, lerp(2.4, 3.2, t))} />
          {/if}
        </g>
      {/if}
      <!-- Standing still the mode is in its ground state, so the ball sits
           on the v = 0 line and is hollow; it only rides up while the sweep
           is actually driving that mode. -->
      {@const travel = running ? hotMax : 0}
      <circle
        class="dot"
        class:filled={running && dir > 0 && hotMax > 0.3}
        cx={cx + colHalf * 0.55}
        cy={dir > 0 ? lerp(y0, y1, travel) : dir < 0 ? lerp(y1, y0, travel) : y0}
        r={lerp(2.4, 3.2, t)}
      />
      <text class="lbl trans" x={cx} y={CJ.top + CJ.h + 14} text-anchor="middle" style="opacity:{labelOpacity}">{m.name}</text>
    {/each}

    <!-- The operator, large, between the two modes it acts on: plus where
         both step up, minus where the second one steps back down. Only for
         the bands that move both modes; a fundamental is not an operation
         on anything. -->
    {#if twoMode}
      <text
        class="sign"
        x={(colX(0) + colX(1)) / 2}
        y={cyE(0) - lerp(12, 34, t)}
        text-anchor="middle"
      >{b.to[MODES[1].si] > b.from[MODES[1].si] ? '+' : '−'}</text>
    {/if}

    <!-- The two modes as one system: every state of the pair on the same
         axis, named (v₁, v₂) so a level is a pair of rest-or-excited, never
         a half-step of one mode. -->
    {#if twoMode}
      {#each STATES as s}
        {@const y = cyE(E_OF(s))}
        {@const on = !!b && (E_OF(s) === E_OF(b.from) || E_OF(s) === E_OF(b.to))}
        <line
          class="level"
          class:ground={s[0] === 0 && s[1] === 0}
          class:hot={running && on && hotMax > 0.35}
          x1={colX(2) - colHalf}
          x2={colX(2) + colHalf}
          y1={y}
          y2={y}
        />
        <text class="lbl faint" x={colX(2) + colHalf + 5} y={y + 4} style="opacity:{labelOpacity}">({s[0]},{s[1]})</text>
      {/each}
    {/if}

    <!-- ONE long arrow: the photon's whole energy, from the state it starts
         in to the state it ends in. For the sum it is exactly as tall as the
         ν₁ and ν₂ arrows laid end to end, which is the claim the card makes;
         for the difference it is shorter AND starts from an excited level,
         which is why that band needs an already vibrating molecule. -->
    {#if twoMode && b}
      {@const ya = cyE(E_OF(b.from))}
      {@const yb = cyE(E_OF(b.to))}
      <g style="opacity:{lit}">
        <line class="arrow long" x1={colX(2)} x2={colX(2)} y1={ya} y2={yb + (yb < ya ? 1 : -1)} />
        <path class="arrow-head" d={yb < ya ? up(colX(2), yb, lerp(2.6, 3.4, t)) : down(colX(2), yb, lerp(2.6, 3.4, t))} />
      </g>
      <text class="lbl trans" x={colX(2)} y={CJ.top - 6} text-anchor="middle" style="opacity:{labelOpacity}">{b.label}</text>
    {/if}
  {/if}

  <!-- ── The spectrum: one trace, swept right to left, bands hanging down ── -->
  <line class="axis" x1={SP.x0} x2={SP.x1} y1={SP.base} y2={SP.base} />
  {#if kind === 'overtone'}
    {#each steps as st}
      <!-- Where an exact multiple of the fundamental falls. On ν it is the
           fundamental's own position; on the overtones the band sits short
           of it, and that offset is the anharmonicity. -->
      <line class="exact" style="opacity:{fullOpacity}" x1={sx(st.v)} x2={sx(st.v)} y1={SP.base - 6} y2={SP.base + SP.tall * 0.45} />
    {/each}
  {:else}
    <!-- Where the exact sum would fall; the band sits a little under it. -->
    <line class="exact" style="opacity:{fullOpacity}" x1={sx(U_EXACT)} x2={sx(U_EXACT)} y1={SP.base - 6} y2={SP.base + SP.tall * 0.45} />
  {/if}
  <path class="trace" d={traceD} />
  <!-- The fundamentals, dashed: parents of the bands this card is about,
       and the dash fills in to solid while each one is being excited. -->
  {#each soloPaths as sp, i (i)}
    {#if sp.d}<path class="trace" d={sp.d} style="stroke-dasharray:{sp.dash}" />{/if}
  {/each}

  {#if annotation}
    <g style="opacity:{labelOpacity * annotation.show}">
      <path class="ann" d={annotation.d} />
      <path class="ann" d={annotation.head} />
      <text class="lbl why" x={annotation.lx} y={annotation.ly}>10–100× weaker</text>
      <text class="lbl faint" x={annotation.lx} y={annotation.ly + 13}>(not to scale)</text>
    </g>
  {/if}

  {#if photon}
    <path class="photon" d={photon.d} />
    <!-- Named, as on the IR Spectroscopy card; it dims as it is swallowed. -->
    <text class="lbl photon-lbl" x={photon.cx} y={photon.cy - photon.amp - 7} text-anchor="middle" style="opacity:{photon.fade}">hν</text>
  {/if}

  <g style="opacity:{labelOpacity}">
    {#each bands as b, i}
      <!-- The difference band's name goes with its dip, so it is not left
           standing over an empty stretch of baseline. -->
      <text class="tick" x={sx(b.u)} y={SP.base - 8} text-anchor="middle" style="opacity:{!running && isDiff(i) ? 0 : 1}">{b.label}</text>
    {/each}
  </g>

  {#if opened}
    <g style="opacity:{labelOpacity}">
      <text class="lbl axis" x={AX.ox - 12} y={AX.top + 10}>E</text>
      {#if AX.hasR}
        <text class="lbl axis" x={AX.right + 6} y={AX.oy + 4}>r</text>
      {/if}
      {#if kind === 'overtone'}
        <!-- Kept inside the well's own third: past about 23 characters
             these run under the spectrum. -->
        <text class="lbl why" x={JAB.x} y={JAB.top + JAB.h + 40}>high up the levels sag</text>
        <text class="lbl faint" x={JAB.x} y={JAB.top + JAB.h + 53}>so the band falls short</text>
      {:else}
        <!-- Kept under 22 characters: past that they run into the spectrum. -->
        <text class="lbl why" x={CJ.x} y={CJ.top + CJ.h + 36}>one photon, one arrow</text>
        <text class="lbl faint" x={CJ.x} y={CJ.top + CJ.h + 49}>as tall as both steps</text>
        <text class="lbl faint" x={CJ.x} y={CJ.top + CJ.h + 62}>added end to end</text>
        <!-- The same admission the overtone card makes. Both cards draw the
             weak band far stronger than it is, so that the thing the card is
             about exists on the page at all; saying so is the price. -->
        <text class="lbl why" x={SP.x0} y={SP.base + SP.tall + 34}>the sum and the difference are weak</text>
        <text class="lbl faint" x={SP.x0} y={SP.base + SP.tall + 47}>(not to scale)</text>
      {/if}
    </g>
  {/if}

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="18">
      {kind === 'overtone' ? 'One Mode, More Than One Level' : 'Two Modes, One Photon'}
    </text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .well { fill: none; stroke: var(--line-slate-strong); stroke-width: 1.2; }

  .level { stroke: var(--ink-slate-400); stroke-width: 1.4; stroke-linecap: round; }
  .level.ground { stroke: var(--ink-slate-500); }
  .level.hot { stroke: var(--accent-green-fg); }
  /* Where an equally spaced ladder would have put the level. */
  .equal-level { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }

  .arrow { stroke: var(--accent-green-fg); stroke-width: 1.6; }
  .arrow-head {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* The photon's whole energy, so it carries a little more weight than the
     two steps it is spent on. */
  .arrow.long { stroke-width: 2.1; }
  /* The plus or minus between the two modes, big enough to be read as the
     operation rather than as another label. */
  .sign {
    font-family: var(--t-code-ff);
    font-size: calc(var(--t-code-size) * 2.1);
    fill: var(--accent-green-fg);
  }
  /* Carries a mode's own excited level across to the combined system, which
     is where the two steps are seen stacking. */
  .leader {
    stroke: var(--ink-025);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  /* Hollow in the ground state, filled while excited: as on the IR
     Spectroscopy and Vibrational Excitation cards. */
  .dot {
    fill: var(--surface);
    stroke: var(--brand-700);
    stroke-width: 1.4;
  }
  .dot.filled { fill: var(--brand-700); }

  .axis { stroke: var(--line-slate-strong); stroke-width: 1; }
  .axis-line { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  /* Where an exact multiple, or an exact sum, would fall. */
  .exact { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 2; }
  /* One spectrum, not a row of separate bands. */
  .trace { fill: none; stroke: var(--brand-700); stroke-width: 1.5; stroke-linejoin: round; }
  .ann {
    fill: none;
    stroke: var(--brand-700);
    stroke-width: 1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .photon { fill: none; stroke: var(--diagram-photon); stroke-width: 1.5; stroke-linecap: round; }

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
  .lbl.axis { font-style: italic; }
  /* Named in the colour of the arrow it belongs to. */
  .lbl.trans { fill: var(--accent-green-fg); }
  .lbl.photon-lbl { fill: var(--diagram-photon); }
  .lbl.name { fill: var(--ink-slate-900); }
</style>

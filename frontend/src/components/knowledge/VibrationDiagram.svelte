<script lang="ts">
  /**
   * The vibrational ladder, in two forms that morph into each other.
   *
   *   t = 0  a bare Jablonski diagram: four levels as equal lines, the photon,
   *          the 0 → 1 arrow, the ground state as a hollow circle. The card.
   *   t = 1  the same levels inside their Morse well, cut off at the walls,
   *          with axes, labels, the dissociation limit and the 0 → 2
   *          overtone. The opened card.
   *
   * Every coordinate is a blend of the two, so as `t` runs from 0 to 1 the
   * level lines actually slide and stretch to their turning points, and the
   * well grows out of the ends of the lines (it starts as the box they span).
   *
   * At rest the picture already shows the event. While `playing` it runs as a
   * loop, one absorption per cycle: the photon comes in, the state climbs to
   * v = 1 and swings wider there, then drops back as heat (the wavy arrow)
   * and is ready for the next photon.
   */
  export let t = 0;
  export let playing = false;

  /* Morse potential in units of the well depth: V(r) = (1 − e^(−a(r − rₑ)))².
     With λ = 6 the bound levels sit at E(v) = (2λ(v+½) − (v+½)²)/λ², which
     crowds them visibly towards the top without needing a caption. */
  const A = 1.6;
  const RE = 1;
  const LAMBDA = 6;
  const R_MIN = 0.545; // where the inner wall leaves the top of the frame
  const R_MAX = 3.2;
  const E_TOP = 1.15;
  const LEVELS = [0, 1, 2, 3];

  const level = (v: number) => (2 * LAMBDA * (v + 0.5) - (v + 0.5) ** 2) / LAMBDA ** 2;
  const morse = (r: number) => (1 - Math.exp(-A * (r - RE))) ** 2;
  const inner = (e: number) => RE - Math.log(1 + Math.sqrt(e)) / A;
  const outer = (e: number) => RE - Math.log(1 - Math.sqrt(e)) / A;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  /** 0 until `from`, 1 from `to` on: for parts that should arrive late. */
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  /* ── The two frames ─────────────────────────────────────────────────── */

  // Simple: 220 × 100 user units, the levels an evenly cut stack.
  const S = { W: 220, H: 100, x1: 30, x2: 122, xArrow: 58, px: 238 / 220 };
  const yS = (e: number) => 92 - e * 80;

  // Full: 420 × 230, drawn at 1 unit = 1px so labels use the type tokens.
  const F = { W: 420, H: 230, padL: 26, padB: 22, padT: 16, wellW: 240 };
  const xF = (r: number) => F.padL + ((r - R_MIN) / (R_MAX - R_MIN)) * F.wellW;
  const yF = (e: number) => F.H - F.padB - (e / E_TOP) * (F.H - F.padB - F.padT);

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: y = (e: number) => lerp(yS(e), yF(e), t);

  $: levels = LEVELS.map(v => {
    const e = level(v);
    return {
      v,
      x1: lerp(S.x1, xF(inner(e)), t),
      x2: lerp(S.x2, xF(outer(e)), t),
      y: y(e),
    };
  });

  $: y0 = levels[0].y;
  $: y1 = levels[1].y;
  $: y2 = levels[2].y;

  /* The well: each point of the Morse curve paired with where it sits on
     the box the level lines span, so it grows out of their ends. */
  $: wellPath = (() => {
    const pts: string[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const r = lerp(R_MIN, RE, i / n);
      const e = Math.min(morse(r), E_TOP);
      pts.push(`${lerp(S.x1, xF(r), t).toFixed(1)},${lerp(yS(Math.min(e, 1)), yF(e), t).toFixed(1)}`);
    }
    for (let i = 0; i <= n; i++) {
      const r = lerp(RE, R_MAX, i / n);
      const e = morse(r);
      pts.push(`${lerp(S.x2, xF(r), t).toFixed(1)},${lerp(yS(e), yF(e), t).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();

  /* ── Arrows and the photon ──────────────────────────────────────────── */

  $: xT = xF(RE);
  $: xUp = lerp(S.xArrow, xT + 8, t);
  $: xDown = xUp + lerp(13, 16, t);
  $: xOver = xT - 10;

  // Once on v = 1 the state swings between that level's ends, short of them.
  $: swingL = (levels[1].x1 - xUp) * 0.7;
  $: swingR = (levels[1].x2 - xUp) * 0.7;

  function wave(x0: number, y0_: number, x1: number, y1_: number, amp: number, period: number) {
    const len = Math.hypot(x1 - x0, y1_ - y0_);
    const ux = (x1 - x0) / len;
    const uy = (y1_ - y0_) / len;
    const pts: [number, number][] = [];
    for (let s = 0; s <= len; s += 1) {
      const off = amp * Math.sin((s / period) * 2 * Math.PI);
      pts.push([x0 + ux * s - uy * off, y0_ + uy * s + ux * off]);
    }
    let drawn = 0;
    for (let i = 1; i < pts.length; i++) {
      drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return {
      d: pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' '),
      // Summed here rather than left to pathLength="1", which Chromium does
      // not scale the dash by reliably on a long polyline.
      len: Math.ceil(drawn) + 2,
    };
  }

  // In from the right, halfway between v = 0 and v = 1.
  $: photon = wave(
    lerp(S.W - 8, F.W - 40, t),
    (y0 + y1) / 2,
    lerp(S.x2 + 8, xF(outer((level(0) + level(1)) / 2)) + 34, t),
    (y0 + y1) / 2,
    lerp(3.5, 5, t),
    lerp(11, 16, t),
  );

  // Relaxation: wavy, the Jablonski sign for energy leaving as heat.
  $: relax = wave(xDown, y1 + 1, xDown, y0 - 4, lerp(2.2, 3, t), lerp(7, 9, t));

  const up = (xa: number, ya: number, s: number) =>
    `M${xa - s},${ya + s * 1.5} L${xa},${ya} L${xa + s},${ya + s * 1.5}`;
  const down = (xa: number, ya: number, s: number) =>
    `M${xa - s},${ya - s * 1.5} L${xa},${ya} L${xa + s},${ya - s * 1.5}`;

  // What only the full view has arrives in two waves: the well and axes
  // first, the words once everything has stopped moving.
  $: wellOpacity = ramp(t, 0.05, 0.6);
  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);

  $: ox = F.padL - 10;
  $: oy = lerp(H - 4, F.H - F.padB + 6, t);
</script>

<svg
  class="diagram"
  class:playing
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Vibrational energy levels; an infrared photon lifts the vibration from v = 0 to v = 1, and it relaxes back as heat"
  style="--jump:{y1 - y0}px; --swing-l:{swingL}px; --swing-r:{swingR}px; --photon-len:{photon.len}; --arrow-len:{Math.ceil(y0 - y1) + 2}; --relax-len:{relax.len}"
>
  <!-- Axes, grown from the origin. -->
  <g style="opacity:{fullOpacity}">
    <path class="axis-line" d="M{ox},{oy} V{lerp(oy, F.padT, t)} M{ox - 3},{F.padT + 5} L{ox},{F.padT} L{ox + 3},{F.padT + 5}" />
    <path class="axis-line" d="M{ox},{oy} H{lerp(ox, xF(R_MAX), t)} M{xF(R_MAX) - 5},{oy - 3} L{xF(R_MAX)},{oy} L{xF(R_MAX) - 5},{oy + 3}" />
    <line class="limit" x1={xF(R_MIN)} x2={F.W - 96} y1={yF(1)} y2={yF(1)} />
  </g>

  <path class="well" d={wellPath} style="opacity:{wellOpacity}" />

  {#each levels as l (l.v)}
    <line class="level" class:target={l.v === 1} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} />
  {/each}

  <g style="opacity:{fullOpacity}">
    <!-- The overtone, faint: two levels at once, allowed only by anharmonicity. -->
    <line class="overtone" x1={xOver} x2={xOver} y1={y0} y2={y2 + 1} />
    <path class="overtone-head" d={up(xOver, y2, 3)} />
  </g>

  <g style="opacity:{labelOpacity}">
    {#each levels as l (l.v)}
      <text class="lbl" x={l.x2 + 6} y={l.y + 4}>v = {l.v}</text>
    {/each}
    <text class="lbl axis" x={ox - 12} y={F.padT + 10}>E</text>
    <text class="lbl axis" x={xF(R_MAX) + 6} y={oy + 4}>r</text>
    <text class="lbl faint" x={F.W - 90} y={yF(1) + 4}>dissociation</text>
    <text class="lbl faint" x={xOver} y={y2 - 7} text-anchor="middle">0 → 2</text>
    <text class="lbl fund-lbl" x={xUp + 6} y={y1 - 8}>0 → 1</text>
  </g>

  <path class="photon" d={photon.d} />
  <!-- Names the photon in both forms: above its tail on the card, after it
       once opened. It leaves with the photon when the photon is absorbed. -->
  <text
    class="lbl photon-lbl"
    x={lerp(S.W - 22, F.W - 34, t)}
    y={lerp((y0 + y1) / 2 - 7, (y0 + y1) / 2 + 4, t)}
  >hν</text>

  <line class="arrow" x1={xUp} x2={xUp} y1={y0} y2={y1 + 1} />
  <path class="arrow-head" d={up(xUp, y1, lerp(3, 4, t))} />

  <path class="relax" d={relax.d} />
  <path class="relax-head" d={down(xDown, y0 - 3, lerp(2.6, 3.4, t))} />

  <g class="pop">
    <circle class="dot" cx={xUp} cy={y0} r={lerp(3.4, 4.6, t)} />
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .well {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1.3;
  }

  .limit {
    stroke: var(--line-slate);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .axis-line {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1;
  }

  .level {
    stroke: var(--ink-slate-400);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.axis { font-style: italic; }
  .photon-lbl { fill: var(--diagram-photon); }
  .fund-lbl { fill: var(--accent-green-fg); }

  .overtone {
    stroke: var(--ink-025);
    stroke-width: 1.3;
    stroke-dasharray: 3 3;
  }
  .overtone-head {
    fill: none;
    stroke: var(--ink-025);
    stroke-width: 1.3;
  }

  /* ── Rest: the event, drawn as a still ─────────────────────────────── */

  .photon {
    fill: none;
    stroke: var(--diagram-photon);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-dasharray: var(--photon-len);
    stroke-dashoffset: 0;
  }

  .arrow {
    stroke: var(--accent-green-fg);
    stroke-width: 1.8;
    stroke-dasharray: var(--arrow-len);
    stroke-dashoffset: 0;
  }

  .arrow-head {
    fill: none;
    stroke: var(--accent-green-fg);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .relax,
  .relax-head {
    fill: none;
    stroke: var(--diagram-heat);
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0;
  }
  .relax {
    stroke-dasharray: var(--relax-len);
    stroke-dashoffset: var(--relax-len);
  }

  /* The ground state, hollow: nothing has happened to it yet. */
  .dot {
    fill: var(--surface);
    stroke: var(--brand-700);
    stroke-width: 1.5;
  }

  /* ── Playing: one absorption per cycle, on a loop ───────────────────
     All parts share one 3.4s clock, so the percentages below line up:
       0–22   the photon runs in
      22–32   it is gone; the arrow draws, the state climbs, filled now
      34–64   v = 1: the wider swing
      64–80   relaxation, wavy, back down to v = 0, hollow again
      80–100  quiet, then the next photon */

  .playing .photon     { animation: photon 3.4s linear infinite; }
  .playing .photon-lbl { animation: photon-lbl 3.4s linear infinite; }
  .playing .arrow      { animation: arrow 3.4s linear infinite; }
  .playing .arrow-head { animation: arrow-head 3.4s linear infinite; }
  .playing .pop        { animation: pop 3.4s linear infinite; }
  .playing .dot        { animation: dot 3.4s linear infinite; }
  .playing .relax      { animation: relax 3.4s linear infinite; }
  .playing .relax-head { animation: relax-head 3.4s linear infinite; }
  .playing .level.target { animation: target 3.4s linear infinite; }

  @keyframes photon-lbl {
    0%, 22%   { opacity: 1; }
    28%, 100% { opacity: 0; }
  }

  @keyframes photon {
    0%   { stroke-dashoffset: var(--photon-len); opacity: 1; animation-timing-function: ease-out; }
    22%  { stroke-dashoffset: 0; opacity: 1; }
    28%  { stroke-dashoffset: 0; opacity: 0; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }

  @keyframes arrow {
    0%, 22% { stroke-dashoffset: var(--arrow-len); opacity: 1; animation-timing-function: ease-out; }
    30%  { stroke-dashoffset: 0; opacity: 1; }
    66%  { stroke-dashoffset: 0; opacity: 1; }
    76%  { stroke-dashoffset: 0; opacity: 0; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }

  @keyframes arrow-head {
    0%, 29% { opacity: 0; }
    30%, 66% { opacity: 1; }
    76%, 100% { opacity: 0; }
  }

  @keyframes pop {
    0%, 27% { transform: translateY(0); animation-timing-function: cubic-bezier(0.3, 1.4, 0.6, 1); }
    33%, 65% { transform: translateY(var(--jump)); animation-timing-function: ease-in-out; }
    79%, 100% { transform: translateY(0); }
  }

  /* Slow at the ends of the level, fast through the middle, like a real
     oscillator; then back to the centre before it drops. */
  @keyframes dot {
    0%, 29%  { fill: var(--surface); transform: translateX(0); }
    31%      { fill: var(--brand-700); transform: translateX(0); }
    34%      { transform: translateX(0); animation-timing-function: ease-out; }
    38%      { transform: translateX(var(--swing-r)); animation-timing-function: ease-in-out; }
    45%      { transform: translateX(var(--swing-l)); animation-timing-function: ease-in-out; }
    52%      { transform: translateX(var(--swing-r)); animation-timing-function: ease-in-out; }
    59%      { transform: translateX(var(--swing-l)); animation-timing-function: ease-in; }
    64%      { fill: var(--brand-700); transform: translateX(0); }
    78%      { fill: var(--brand-700); }
    81%, 100% { fill: var(--surface); transform: translateX(0); }
  }

  @keyframes relax {
    0%, 64% { stroke-dashoffset: var(--relax-len); opacity: 1; }
    78%  { stroke-dashoffset: 0; opacity: 1; }
    88%  { stroke-dashoffset: 0; opacity: 0; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }

  @keyframes relax-head {
    0%, 76% { opacity: 0; }
    78%, 82% { opacity: 1; }
    88%, 100% { opacity: 0; }
  }

  @keyframes target {
    0%, 30% { stroke: var(--ink-slate-400); }
    32%, 64% { stroke: var(--accent-green-fg); }
    70%, 100% { stroke: var(--ink-slate-400); }
  }

  @media (prefers-reduced-motion: reduce) {
    .playing * { animation: none !important; }
  }
</style>

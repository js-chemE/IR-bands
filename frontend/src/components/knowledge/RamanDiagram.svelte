<script lang="ts">
  /**
   * Raman: scattered, not absorbed, and short by exactly one vibrational gap.
   *
   *   t = 0  the card: one ladder (v = 0, v = 1, and a dashed virtual level
   *          far above them). A laser photon runs in, the up-arrow carries the
   *          state to the virtual level, a redder photon leaves as the arrow
   *          comes down to v = 1, and the vibration relaxes as heat.
   *   t = 1  the opened card, in three layers:
   *            the experiment: a laser into the sample, photons scattering
   *              out in every direction, most the laser's colour, the odd one
   *              redder (Stokes) or bluer (anti-Stokes);
   *            the three ladders those photons come from: anti-Stokes,
   *              Rayleigh, Stokes;
   *            the spectrum on a Raman-shift axis, built up by counting them.
   *
   * The card's ladder is the opened card's Stokes ladder; the other two grow
   * out of it as the card opens.
   *
   * The mode is 300 cm⁻¹ because there the anti-Stokes line is honestly about
   * a quarter of the Stokes one at room temperature (Boltzmann factor times
   * the ν⁴ term), so the ratio drawn is the real one. The rate of shifted
   * photons is not: one in five here, about one in ten million in life. The
   * caption says so.
   *
   * Arrows up to the virtual level are not to scale either (a 532 nm photon
   * is some 60 times this gap), hence the break marks on them.
   */
  import { onDestroy } from 'svelte';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));
  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

  type Kind = 'A' | 'R' | 'S';
  const KINDS: Kind[] = ['A', 'R', 'S'];
  const SHIFT = 300;

  /* ── The two frames ─────────────────────────────────────────────────── */

  // Card: 220 × 100 units, one ladder.
  const S = { W: 220, H: 100, px: 238 / 220, cx: 110, half: 38, v0: 88, v1: 74, virt: 16 };
  // Opened: 480 × 356 at 1 unit = 1px. Strip on top, ladders, then spectrum.
  const F = {
    W: 480, H: 356, half: 38, v0: 222, v1: 204, virt: 128,
    x0: 50, x1: 450, range: 450, plotTop: 244, axis: 322,
    sx: 250, sy: 54, rx: 150, ry: 40,
  };
  const XF = (shift: number) => F.x0 + ((shift + F.range) / (2 * F.range)) * (F.x1 - F.x0);
  const FULL_CX: Record<Kind, number> = { A: XF(-SHIFT), R: XF(0), S: XF(SHIFT) };
  const LABEL: Record<Kind, string> = { A: 'anti-Stokes', R: 'Rayleigh', S: 'Stokes' };
  /** Where each process starts and ends on the ladder. */
  const FROM: Record<Kind, 'v0' | 'v1'> = { A: 'v1', R: 'v0', S: 'v0' };
  const TO: Record<Kind, 'v0' | 'v1'> = { A: 'v0', R: 'v0', S: 'v1' };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  $: geo = KINDS.reduce(
    (acc, k) => {
      acc[k] = {
        cx: lerp(S.cx, FULL_CX[k], t),
        half: lerp(S.half, F.half, t),
        v0: lerp(S.v0, F.v0, t),
        v1: lerp(S.v1, F.v1, t),
        virt: lerp(S.virt, F.virt, t),
        // The card shows only the Stokes ladder; the others grow out of it.
        opacity: k === 'S' ? 1 : ramp(t, 0.25, 0.7),
      };
      return acc;
    },
    {} as Record<Kind, { cx: number; half: number; v0: number; v1: number; virt: number; opacity: number }>,
  );

  /* ── Clock ──────────────────────────────────────────────────────────── */

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

  $: openMode = t > 0.5;

  /* Card loop: one Stokes event, 5 s. */
  const CARD_MS = 5000;
  $: uc = running && !openMode ? (clock % CARD_MS) / CARD_MS : null;

  /* Opened loop: 48 scattering events 175 ms apart, then a pause. One in six
     is Stokes, one in twenty-four anti-Stokes: the 4 : 1 ratio of the lines. */
  const EVENT_MS = 175;
  const EVENTS = 48;
  const OPEN_MS = EVENTS * EVENT_MS + 1000;
  const SEQ: Kind[] = Array.from({ length: EVENTS }, (_, n) =>
    n % 6 === 3 ? 'S' : n === 19 || n === 43 ? 'A' : 'R',
  );
  const LADDER_MS = 1300;
  const FLIGHT_MS = 1300;

  $: oc = running && openMode ? clock % OPEN_MS : null;
  $: nNow = oc === null ? EVENTS - 1 : Math.min(EVENTS - 1, Math.floor(oc / EVENT_MS));

  /** Progress through one ladder's own story, or null for the drawn-out still. */
  function ladderU(k: Kind, ucv: number | null, ocv: number | null): number | null {
    if (ucv !== null) return k === 'S' ? ramp(ucv, 0.14, 0.9) : 0;
    if (ocv === null) return null;
    // The Rayleigh ladder shows every sixth of its events, or it would
    // never finish one before the next began.
    for (let n = Math.min(EVENTS - 1, Math.floor(ocv / EVENT_MS)); n >= 0; n--) {
      const hit = k === 'R' ? n % 6 === 0 : SEQ[n] === k;
      if (!hit) continue;
      const u = (ocv - n * EVENT_MS) / LADDER_MS;
      return u >= 1 ? 0 : u;
    }
    return 0;
  }

  /** The ladder at progress u: up, pause on the virtual level, down, (relax). */
  function ladder(k: Kind, u: number | null, g: (typeof geo)[Kind]) {
    const fromY = g[FROM[k]];
    const toY = g[TO[k]];
    if (u === null) {
      return { up: 1, down: 1, relax: 0, fade: 1, dotY: fromY, filled: FROM[k] === 'v1', virtual: false };
    }
    const up = ramp(u, 0, 0.3);
    const down = ramp(u, 0.4, 0.6);
    let dotY = fromY;
    let virtual = false;
    if (u < 0.3) {
      dotY = lerp(fromY, g.virt, ease(up));
      virtual = u > 0.22;
    } else if (u < 0.4) {
      dotY = g.virt;
      virtual = true;
    } else {
      dotY = lerp(g.virt, toY, ease(down));
      virtual = u < 0.46;
    }
    let relax = 0;
    if (k === 'S' && u >= 0.66) {
      relax = ramp(u, 0.66, 0.86);
      dotY = lerp(g.v1, g.v0, ease(ramp(u, 0.7, 0.86)));
    }
    const filled = (k === 'A' && u < 0.3) || (k === 'S' && u >= 0.55 && u < 0.8);
    return { up, down, relax, fade: 1 - ramp(u, 0.86, 1), dotY, filled, virtual };
  }

  $: states = KINDS.map(k => {
    const g = geo[k];
    const st = ladder(k, ladderU(k, uc, oc), g);
    const upX = g.cx - g.half * 0.32;
    const downX = g.cx + g.half * 0.32;
    const fromY = g[FROM[k]];
    const toY = g[TO[k]];
    const upLen = Math.abs(fromY - g.virt);
    const downLen = Math.abs(toY - g.virt);
    const relaxWave = wave(g.cx + g.half * 0.64, g.v1 + 1, g.cx + g.half * 0.64, g.v0 - 4, lerp(2, 2.6, t), lerp(6, 8, t), 0);
    return { k, g, st, upX, downX, fromY, toY, upLen, downLen, relaxWave, cut: g.virt + (g.v1 - g.virt) * 0.55 };
  });

  /* ── Waves ──────────────────────────────────────────────────────────── */

  function wave(x0: number, y0: number, x1: number, y1: number, amp: number, period: number, phase: number) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const pts: [number, number][] = [];
    for (let s = 0; s <= len; s += 0.75) {
      const off = amp * Math.sin((s / period) * 2 * Math.PI - phase);
      pts.push([x0 + ux * s - uy * off, y0 + uy * s + ux * off]);
    }
    let drawn = 0;
    for (let i = 1; i < pts.length; i++) drawn += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return {
      d: pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' '),
      len: Math.ceil(drawn) + 2,
    };
  }

  // The card's photons ride with the Stokes ladder and fade as it opens.
  $: cardFade = 1 - ramp(t, 0, 0.35);
  $: yW = (geo.S.virt + geo.S.v0) / 2;
  $: inWave = wave(states[2].upX - 84, yW, states[2].upX - 6, yW, 3.2, 5, 0);
  $: outWave = wave(states[2].downX + 6, yW, states[2].downX + 84, yW, 3.2, 7.5, 0);
  $: inReveal = uc === null ? 1 : ramp(uc, 0, 0.16);
  $: outReveal = uc === null ? 1 : ramp(uc, 0.36, 0.56);
  $: cardWaveFade = uc === null ? 1 : 1 - ramp(uc, 0.82, 0.92);

  /* ── The scattering strip ───────────────────────────────────────────── */

  const PERIOD: Record<Kind, number> = { A: 3.8, R: 5, S: 7 };
  // Directions spread by the golden angle, all but back into the laser.
  const angleOf = (n: number) => ((((n * 137.508) % 300) - 150) * Math.PI) / 180;

  function packet(n: number, kind: Kind, d: number) {
    const a = angleOf(n);
    const cx = F.sx + Math.cos(a) * F.rx * d;
    const cy = F.sy + Math.sin(a) * F.ry * d;
    const ux = Math.cos(a);
    const uy = Math.sin(a) * (F.ry / F.rx);
    const un = Math.hypot(ux, uy);
    const half = 9;
    return wave(cx - (ux / un) * half, cy - (uy / un) * half, cx + (ux / un) * half, cy + (uy / un) * half, 2.6, PERIOD[kind], 0).d;
  }

  // At rest: a still fan, mostly the laser's colour, one of each shifted.
  const STILL: { n: number; kind: Kind }[] = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
    n,
    kind: n === 3 ? 'S' : n === 7 ? 'A' : 'R',
  }));

  $: photons =
    oc === null
      ? STILL.map(p => ({ key: p.n, kind: p.kind, d: packet(p.n, p.kind, 0.8), opacity: 1 }))
      : SEQ.flatMap((kind, n) => {
          const age = oc - n * EVENT_MS;
          if (age < 0 || age > FLIGHT_MS) return [];
          const d = 0.18 + 0.82 * (age / FLIGHT_MS);
          return [{ key: n, kind, d: packet(n, kind, d), opacity: 1 - ramp(age, FLIGHT_MS * 0.65, FLIGHT_MS) }];
        });

  $: laser = wave(20, F.sy, F.sx - 13, F.sy, 3, 5, oc === null ? 0 : (clock / 100) * 2 * Math.PI);

  /* ── The spectrum, as counts ────────────────────────────────────────── */

  const PER_PHOTON = 58 / 8; // px per counted photon; 8 Stokes fill the line
  const CLIP = F.axis - F.plotTop;

  function countOf(kind: Kind, upTo: number) {
    let c = 0;
    for (let n = 0; n <= upTo; n++) if (SEQ[n] === kind) c++;
    return c;
  }

  $: counts = {
    A: countOf('A', nNow),
    R: countOf('R', nNow),
    S: countOf('S', nNow),
  };
  // Rayleigh would be millions of times taller; it hits the top at once.
  $: heights = {
    A: counts.A * PER_PHOTON,
    R: Math.min(CLIP * 1.4, counts.R * PER_PHOTON * 3),
    S: counts.S * PER_PHOTON,
  };

  $: spectrumPath = (() => {
    const pts: string[] = [];
    for (let x = F.x0; x <= F.x1; x += 1) {
      let h = 0;
      for (const k of KINDS) h += heights[k] / (1 + ((x - FULL_CX[k]) / 4) ** 2);
      pts.push(`${x},${Math.max(F.plotTop, F.axis - h).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();
  $: topOf = (k: Kind) => Math.max(F.plotTop, F.axis - heights[k]);

  const upHead = (x: number, y: number, s: number) => `M${x - s},${y + s * 1.5} L${x},${y} L${x + s},${y + s * 1.5}`;
  const downHead = (x: number, y: number, s: number) => `M${x - s},${y - s * 1.5} L${x},${y} L${x + s},${y - s * 1.5}`;
  /** Two slashes across a vertical line: "not to scale". */
  const slashes = (x: number, y: number) => `M${x - 4},${y + 1} L${x + 4},${y - 3} M${x - 4},${y + 4} L${x + 4},${y}`;

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  const COLOR: Record<Kind, string> = { A: 'anti', R: 'laser', S: 'stokes' };
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Raman scattering: a laser photon lifts the molecule to a virtual level and a photon leaves with less energy (Stokes), the same (Rayleigh) or more (anti-Stokes)"
>
  <!-- ── The experiment: laser in, light out in every direction ── -->
  <g style="opacity:{fullOpacity}">
    <path class="w laser" d={laser.d} />
    {#each photons as ph (ph.key)}
      <path class="w {COLOR[ph.kind]}" d={ph.d} style="opacity:{ph.opacity}" />
    {/each}
    <circle class="sample" cx={F.sx} cy={F.sy} r="10" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl laser-lbl" x="20" y={F.sy - 11}>laser, hν₀</text>
  </g>

  <!-- ── The ladders ── -->
  {#each states as s (s.k)}
    <g style="opacity:{s.g.opacity}">
      <line class="virt" x1={s.g.cx - s.g.half} x2={s.g.cx + s.g.half} y1={s.g.virt} y2={s.g.virt} />
      <line class="level" x1={s.g.cx - s.g.half} x2={s.g.cx + s.g.half} y1={s.g.v1} y2={s.g.v1} />
      <line class="level" x1={s.g.cx - s.g.half} x2={s.g.cx + s.g.half} y1={s.g.v0} y2={s.g.v0} />

      <!-- Up: always the laser photon. -->
      <g style="opacity:{s.st.fade}">
        <line
          class="arrow laser"
          x1={s.upX} x2={s.upX} y1={s.fromY} y2={s.g.virt + 1}
          style="stroke-dasharray:{s.upLen}; stroke-dashoffset:{s.upLen * (1 - s.st.up)}"
        />
        <path class="head laser" d={upHead(s.upX, s.g.virt, lerp(2.6, 3.2, t))} style="opacity:{s.st.up > 0.97 ? 1 : 0}" />
        <line class="cut" x1={s.upX} x2={s.upX} y1={s.cut - 3} y2={s.cut + 4} style="opacity:{s.st.up > 0.6 ? 1 : 0}" />
        <path class="slash" d={slashes(s.upX, s.cut + 1)} style="opacity:{s.st.up > 0.6 ? 1 : 0}" />

        <!-- Down: the scattered photon, whichever colour it came out. -->
        <line
          class="arrow {COLOR[s.k]}"
          x1={s.downX} x2={s.downX} y1={s.g.virt} y2={s.toY - 1}
          style="stroke-dasharray:{s.downLen}; stroke-dashoffset:{s.downLen * (1 - s.st.down)}"
        />
        <path class="head {COLOR[s.k]}" d={downHead(s.downX, s.toY, lerp(2.6, 3.2, t))} style="opacity:{s.st.down > 0.97 ? 1 : 0}" />
        <line class="cut" x1={s.downX} x2={s.downX} y1={s.cut - 3} y2={s.cut + 4} style="opacity:{s.st.down > 0.4 ? 1 : 0}" />
        <path class="slash" d={slashes(s.downX, s.cut + 1)} style="opacity:{s.st.down > 0.4 ? 1 : 0}" />
      </g>

      {#if s.k === 'S'}
        <path
          class="relax"
          d={s.relaxWave.d}
          style="stroke-dasharray:{s.relaxWave.len}; stroke-dashoffset:{s.relaxWave.len * (1 - s.st.relax)}; opacity:{s.st.relax > 0 ? s.st.fade : 0}"
        />
      {/if}

      <circle
        class="dot"
        class:filled={s.st.filled}
        class:virtual={s.st.virtual}
        cx={s.g.cx}
        cy={s.st.dotY}
        r={lerp(3.2, 3.8, t)}
      />
    </g>

    <g style="opacity:{labelOpacity}">
      <text class="lbl name" x={FULL_CX[s.k]} y={F.virt - 10} text-anchor="middle">{LABEL[s.k]}</text>
      <line class="link" x1={FULL_CX[s.k]} x2={FULL_CX[s.k]} y1={F.v0 + 4} y2={topOf(s.k) - 3} />
    </g>
  {/each}

  <g style="opacity:{labelOpacity}">
    <text class="lbl faint" x={FULL_CX.S + F.half + 5} y={F.virt + 4}>virtual</text>
    <text class="lbl" x={FULL_CX.S + F.half + 5} y={F.v1 + 1}>v = 1</text>
    <text class="lbl" x={FULL_CX.S + F.half + 5} y={F.v0 + 7}>v = 0</text>
  </g>

  <!-- The card's own photons: in from the left, out to the right, redder. -->
  <g style="opacity:{cardFade * cardWaveFade}">
    <path
      class="w laser"
      d={inWave.d}
      style="stroke-dasharray:{inWave.len}; stroke-dashoffset:{inWave.len * (1 - inReveal)}"
    />
    <path
      class="w stokes"
      d={outWave.d}
      style="stroke-dasharray:{outWave.len}; stroke-dashoffset:{outWave.len * (1 - outReveal)}"
    />
    <text class="lbl laser-lbl" x={states[2].upX - 84} y={yW - 8} style="opacity:{inReveal > 0.3 ? 1 : 0}">hν₀</text>
    <text class="lbl stokes-lbl" x={states[2].downX + 84} y={yW - 8} text-anchor="end" style="opacity:{outReveal > 0.6 ? 1 : 0}">hνₛ</text>
  </g>

  <!-- ── The spectrum: every scattered photon, counted by its shift ── -->
  <g style="opacity:{fullOpacity}">
    <path class="axis-line" d="M{F.x0 - 6},{F.plotTop - 4} V{F.axis} H{F.x1}" />
    {#each [-SHIFT, 0, SHIFT] as sh}
      <line class="axis-line" x1={XF(sh)} x2={XF(sh)} y1={F.axis} y2={F.axis + 4} />
    {/each}
    <path class="trace" d={spectrumPath} />
    {#if heights.R > CLIP}
      <line class="cut wide" x1={FULL_CX.R} x2={FULL_CX.R} y1={F.plotTop + 5} y2={F.plotTop + 12} />
      <path class="slash" d={slashes(FULL_CX.R, F.plotTop + 9)} />
    {/if}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl ax-title" transform="translate({F.x0 - 24} {(F.plotTop + F.axis) / 2}) rotate(-90)" text-anchor="middle">counts</text>
    <text class="lbl" x={XF(-SHIFT)} y={F.axis + 16} text-anchor="middle">−{SHIFT}</text>
    <text class="lbl" x={XF(0)} y={F.axis + 16} text-anchor="middle">0</text>
    <text class="lbl" x={XF(SHIFT)} y={F.axis + 16} text-anchor="middle">{SHIFT}</text>
    <!-- Left of zero the light came out with more energy than it went in with. -->
    <text class="lbl faint" x={F.x0} y={F.axis + 32}>← higher energy</text>
    <text class="lbl faint" x={F.x1} y={F.axis + 32} text-anchor="end">Raman shift (cm⁻¹)</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .level {
    stroke: var(--ink-slate-400);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  /* Not a state the molecule can stay in: dashed, and lighter. */
  .virt {
    stroke: var(--ink-slate-400);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
    opacity: 0.8;
  }

  .arrow { stroke-width: 1.7; }
  .head { fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

  .w { fill: none; stroke-width: 1.4; stroke-linecap: round; }

  .laser { stroke: var(--diagram-laser); }
  .stokes { stroke: var(--diagram-stokes); }
  .anti { stroke: var(--diagram-anti-stokes); }

  /* The break in a long arrow: the ground colour cuts it, two slashes mark it. */
  .cut { stroke: var(--surface-slate); stroke-width: 4; }
  .cut.wide { stroke-width: 12; }
  .slash { fill: none; stroke: var(--ink-slate-400); stroke-width: 1; }

  .relax {
    fill: none;
    stroke: var(--diagram-heat);
    stroke-width: 1.3;
    stroke-linecap: round;
  }

  .dot {
    fill: var(--surface);
    stroke: var(--brand-700);
    stroke-width: 1.4;
  }
  .dot.filled { fill: var(--brand-700); }
  /* Passing through the virtual level: there, but not really. */
  .dot.virtual { fill: var(--surface); stroke-dasharray: 2 2; opacity: 0.7; }

  .sample {
    fill: var(--line-slate);
    stroke: var(--line-slate-strong);
    stroke-width: 1;
  }

  .axis-line {
    fill: none;
    stroke: var(--line-slate-strong);
    stroke-width: 1;
  }

  .trace {
    fill: none;
    stroke: var(--brand-700);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .link {
    stroke: var(--line-slate-strong);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.ax-title { font-family: var(--font-sans); }
  .laser-lbl { fill: var(--diagram-laser); }
  .stokes-lbl { fill: var(--diagram-stokes); }
</style>

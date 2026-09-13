<script lang="ts">
  /**
   * Where the radiation goes: one beam, one sample, three ways out.
   *
   *   t = 0  the card: the sample with the beam arriving and the three
   *          fractions leaving it.
   *   t = 1  the opened card: the same scene, larger, over a bar that
   *          splits I₀ into R, T and A. One scene and one sample, not a
   *          row per material: what changes is the sample itself.
   *
   * Playing, the beam is shot at the sample once, and once it has landed
   * the three ways out appear and the beam stays on. From then on only the
   * sample changes: it holds, turns quickly and smoothly into the next
   * one, and holds again. Step-wise to read, with nothing jumping.
   *
   * One colour does the explaining. The process that dominates this sample
   * is drawn in the photon orange and the other two fade to grey; during a
   * transition the colour crosses over with the numbers, so the eye is led
   * by what is winning rather than by three competing hues. How much of
   * each is never shown by the width of an arrow.
   *
   * Absorption has no arrow, since nothing leaves: it is a glow closing in
   * on the sample, inward only, slow and grey while the sample absorbs
   * little and quickening into orange when absorption takes over.
   */
  import { onDestroy } from 'svelte';
  import { C } from '../../lib/tokens';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  const ramp = (k: number, from: number, to: number) => clamp01((k - from) / (to - from));
  /** Smooth in and out, so nothing changes with a jolt. */
  const ease = (k: number) => k * k * (3 - 2 * k);

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 440 };

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);

  /* ── Clock ── */
  let clock = 0;
  let ringPhase = 0;
  let raf = 0;
  let started = 0;
  let last = 0;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function frame(now: number) {
    if (!started) {
      started = now;
      last = now;
    }
    clock = now - started;
    // The glow's own phase, so its speed can change without it jumping.
    ringPhase = (ringPhase + ((now - last) / 1000) * ringRate) % 1;
    last = now;
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

  /* ── The cycle ─────────────────────────────────────────────────────
   * One leg per material: the beam is shot and lands, the ways out
   * appear, the sample holds, then it turns into the next one.
   */
  const SHOOT = 0.55;   // the beam travelling in, once
  const OPEN = 0.45;    // the ways out appearing, once
  const INTRO = SHOOT + OPEN;
  const MORPH = 0.6;    // turning into the next sample: quick, but smooth

  /**
   * `dif`: how much of the reflection is scattered rather than mirrored.
   * `hold`: how long this sample stays, before it turns into the next.
   * The two reflecting samples hold much longer than the others, because
   * the row underneath runs an animation of its own while they are up and
   * a reader needs to see it finish, and then to take it in.
   */
  interface Mix { r: number; tr: number; a: number; dif: number; hold: number; name: string }
  const REST: Mix = { r: 0.25, tr: 0.5, a: 0.25, dif: 0, hold: 0, name: 'a sample' };
  const LOOP: Mix[] = [
    { r: 0.08, tr: 0.86, a: 0.06, dif: 0, hold: 2.6, name: 'mostly transmitting' },
    { r: 0.10, tr: 0.05, a: 0.85, dif: 0, hold: 3.2, name: 'mostly absorbing' },
    { r: 0.80, tr: 0.06, a: 0.14, dif: 0, hold: 5.4, name: 'reflecting: a smooth surface' },
    { r: 0.74, tr: 0.04, a: 0.22, dif: 1, hold: 6.4, name: 'reflecting: a powder' },
  ];
  const LEGS = LOOP.map(m => m.hold + MORPH);
  const ROUND = LEGS.reduce((a, b) => a + b, 0);

  /** Which sample is up, and how far into its leg the cycle has got. */
  function legAt(c: number) {
    let x = c % ROUND;
    for (let i = 0; i < LEGS.length; i++) {
      if (x < LEGS[i]) return { i, within: x };
      x -= LEGS[i];
    }
    return { i: 0, within: 0 };
  }

  // The shot happens once, on absolute time; the sample cycle follows it.
  $: arrive = running ? ramp(time, 0, SHOOT) : 1;
  $: leave = running ? ramp(time, SHOOT, INTRO) : 1;
  $: cycle = running ? Math.max(0, time - INTRO) : 0;

  $: mix = ((): Mix => {
    if (!running) return REST;
    const { i, within } = legAt(cycle);
    const from = LOOP[i];
    const to = LOOP[(i + 1) % LOOP.length];
    // Flat through the hold, then eased quickly into the next sample.
    const k = ease(ramp(within, from.hold, LEGS[i]));
    return {
      r: lerp(from.r, to.r, k),
      tr: lerp(from.tr, to.tr, k),
      a: lerp(from.a, to.a, k),
      dif: lerp(from.dif, to.dif, k),
      hold: from.hold,
      name: (k < 0.5 ? from : to).name,
    };
  })();

  /* ── One colour, given to whatever dominates ──────────────────────
   * How far a fraction is ahead of the best of the other two, over a
   * band wide enough that the hand-over is a fade and not a switch.
   */
  const LEAD = 0.22;
  const dominance = (v: number, others: number[]) =>
    ease(clamp01((v - Math.max(...others)) / LEAD));
  $: dT = dominance(mix.tr, [mix.r, mix.a]);
  $: dR = dominance(mix.r, [mix.tr, mix.a]);
  $: dA = dominance(mix.a, [mix.tr, mix.r]);

  const HOT = C['diagram-photon'] ?? '#c0572f';
  const COLD = C['ink-slate-400'] ?? '#8a93a3';
  /** Grey when it is one of the also-rans, orange when it is the story. */
  function mixHex(a: string, b: string, k: number) {
    const to = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = to(a);
    const [r2, g2, b2] = to(b);
    const ch = (x: number, y: number) => Math.round(lerp(x, y, k)).toString(16).padStart(2, '0');
    return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
  }
  $: colT = mixHex(COLD, HOT, dT);
  $: colR = mixHex(COLD, HOT, dR);
  $: colA = mixHex(COLD, HOT, dA);
  /**
   * A hair of extra weight on the one that dominates. It guides the eye
   * and nothing more: the range is small on purpose, so that width is
   * never read as how much of the beam went that way.
   */
  const widthFor = (d: number) => (1.35 + 0.35 * d).toFixed(2);

  const SLAB = C['line-slate'] ?? '#dce5f0';
  const SLAB_EDGE = C['line-slate-strong'] ?? '#b0c4da';
  /** The sample itself warms, outline and all, as absorption takes over. */
  $: slabFill = mixHex(SLAB, HOT, 0.45 * dA);
  $: slabEdge = mixHex(SLAB_EDGE, HOT, 0.8 * dA);

  /** Slow while absorption is a bystander, quicker once it takes over. */
  $: ringRate = running ? lerp(0.28, 0.85, dA) : 0;

  /* ── The scene ─────────────────────────────────────────────────────
   * The beam arrives at an angle, because the angle is not free: a
   * specular reflection leaves at the same angle to the surface normal
   * as it arrived, on the other side of it. Drawing the beam straight in
   * and the reflection off at a slant would say something untrue. What
   * passes through carries straight on (the bend on entering a denser
   * medium is another card's business), and the diffuse reflection of a
   * powder, which goes every way at once, is the Spectral
   * Representations card's.
   */
  const TILT = (12 * Math.PI) / 180;
  const DIR = { x: Math.cos(TILT), y: Math.sin(TILT) };

  $: SC = t < 0.5
    ? { x: 104, y: 34, w: 22, h: 40, hit: 16, len: 74, out: 66 }
    : { x: 212, y: 66, w: 34, h: 84, hit: 28, len: 126, out: 160 };

  /** Where the beam meets the front face, and where it leaves the back. */
  $: P = { x: SC.x, y: SC.y + SC.hit };
  $: Q = { x: SC.x + SC.w, y: P.y + SC.w * Math.tan(TILT) };
  /** In, reflected and transmitted, as line ends. */
  $: rayIn = { x: P.x - DIR.x * SC.len, y: P.y - DIR.y * SC.len };
  $: rayR = { x: P.x - DIR.x * SC.len, y: P.y + DIR.y * SC.len };
  $: rayT = { x: Q.x + DIR.x * SC.out, y: Q.y + DIR.y * SC.out };

  /**
   * Scattered reflection: a fan about the normal, since a rough surface
   * sends the beam every way at once. It fades in as `dif` rises and the
   * single mirrored ray fades out, so the two are never both asserted.
   */
  const FAN = [-52, -34, -17, 0, 17, 34, 52];
  $: fan = FAN.map(deg => {
    const a = Math.PI + (deg * Math.PI) / 180;
    const len = SC.len * 0.52;
    return { x: P.x + Math.cos(a) * len, y: P.y + Math.sin(a) * len };
  });

  /** A short arc about the incidence point, from one ray to the normal. */
  function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
    const n = 12;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    });
    return 'M' + pts.join(' L');
  }
  // Measured from the normal, which points out of the front face.
  const A_NORM = Math.PI;
  $: A_IN = Math.PI + TILT;    // back along the incoming ray
  $: A_REF = Math.PI - TILT;   // along the reflected ray

  const arrow = (x1: number, y1: number, x2: number, y2: number, head = 5) => {
    // Nothing at all until there is a shaft to put a head on.
    if (Math.hypot(x2 - x1, y2 - y1) < head * 0.9) return '';
    const a = Math.atan2(y2 - y1, x2 - x1);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
      `M ${(x2 - head * Math.cos(a - 0.42)).toFixed(1)} ${(y2 - head * Math.sin(a - 0.42)).toFixed(1)} ` +
      `L ${x2.toFixed(1)} ${y2.toFixed(1)} ` +
      `L ${(x2 - head * Math.cos(a + 0.42)).toFixed(1)} ${(y2 - head * Math.sin(a + 0.42)).toFixed(1)}`;
  };

  /** Rings that start clear of the sample and close in on it. */
  const RINGS = [0, 1, 2];
  $: glow = RINGS.map(k => {
    const p = running ? (ringPhase + k / RINGS.length) % 1 : (k / RINGS.length) * 0.8;
    const out = (1 - p) * (t < 0.5 ? 10 : 20);
    return {
      x: SC.x - out,
      y: SC.y - out,
      w: SC.w + out * 2,
      h: SC.h + out * 2,
      // Faint on the way in, brightest as it lands; and only as strong as
      // the sample absorbs.
      o: (0.2 + 0.8 * mix.a) * (0.12 + 0.88 * p) * leave,
    };
  });

  /* ── The row that tells the two reflections apart ───────────────────
   * Which one a surface gives decides what an instrument can collect: a
   * smooth surface sends the beam one way, so it can be caught with a
   * mirror, and a powder sends it every way, which is what a
   * diffuse-reflectance cell is built to gather.
   */
  /**
   * The row below stays grey and still: it is a reference, not a reading.
   * Only the surface the sample currently is lights up, and only that one
   * runs its beam, so the row never competes with the scene above.
   */
  $: hotSmooth = dR * (1 - mix.dif);
  $: hotPowder = dR * mix.dif;
  const MINI_CYCLE = 2.1;
  $: miniU = running ? (time % MINI_CYCLE) / MINI_CYCLE : 1;
  $: miniIn = running ? ramp(miniU, 0, 0.38) : 1;
  /** The short passage through the grains, before anything comes back out. */
  $: miniThru = running ? ramp(miniU, 0.38, 0.56) : 1;
  $: miniOut = running ? ramp(miniU, 0.56, 0.94) : 1;
  /** Nothing to travel through: the specular ray leaves as it arrives. */
  $: miniSpec = running ? ramp(miniU, 0.38, 0.76) : 1;

  /** The first `k` of a polyline, so a path can be drawn as it is walked. */
  function partial(points: { x: number; y: number }[], k: number) {
    if (k <= 0) return '';
    const segs = points.slice(1).map((q, i) => Math.hypot(q.x - points[i].x, q.y - points[i].y));
    const total = segs.reduce((a, b) => a + b, 0);
    let left = total * Math.min(1, k);
    const out = [`${points[0].x},${points[0].y}`];
    for (let i = 0; i < segs.length && left > 0; i++) {
      const f = Math.min(1, left / segs[i]);
      const a = points[i];
      const b = points[i + 1];
      out.push(`${lerp(a.x, b.x, f).toFixed(1)},${lerp(a.y, b.y, f).toFixed(1)}`);
      left -= segs[i];
    }
    return 'M' + out.join(' L');
  }
  /** Lit surfaces run the beam; the other is simply drawn. */
  const beat = (hot: number, k: number) => (hot > 0.5 ? k : 1);

  const MINI_Y = 360;
  const ray = (from: { x: number; y: number }, deg: number, len: number) => ({
    x: from.x + Math.cos((deg * Math.PI) / 180) * len,
    y: from.y - Math.sin((deg * Math.PI) / 180) * len,
  });
  const SMOOTH = 132;
  const POWDER = 348;
  /** Where each beam meets the surface, and the angle it arrives at. */
  const IN_DEG = 128; // up and to the left of the point it strikes
  const hitS = { x: SMOOTH - 8, y: MINI_Y };
  const sIn = ray(hitS, IN_DEG, 52);
  const sOut = ray(hitS, 180 - IN_DEG, 52);
  /** The normal here is vertical, and the two angles about it are equal. */
  const N_DEG = 90;
  function arcDeg(c: { x: number; y: number }, r: number, d0: number, d1: number) {
    const n = 12;
    return 'M' + Array.from({ length: n + 1 }, (_, i) => {
      const p = ray(c, d0 + ((d1 - d0) * i) / n, r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' L');
  }

  /**
   * A bed of grains, after Armaroli's Figure 1. A beam is many rays, not
   * one: several arrive side by side, one glances off the top as the
   * specular component, and each of the others goes its own way through
   * the grains and comes back out on its own path. Drawing one ray in and
   * a fan out would say that a single ray splits, which it does not.
   */
  const GRAINS = [
    [-44, 9, 7], [-28, 15, 5], [-14, 8, 6], [0, 14, 8], [14, 9, 5],
    [28, 15, 7], [42, 8, 6], [-36, 24, 4], [-6, 25, 5], [20, 24, 6], [38, 25, 4],
  ].map(([dx, dy, r]) => ({ cx: POWDER + dx, cy: MINI_Y + dy, r }));

  /** The rays of one beam, arriving side by side. */
  const HITS = [-30, -18, -6, 6].map(dx => ({ x: POWDER + dx, y: MINI_Y }));
  const P_IN = HITS.map(h => ({ from: ray(h, IN_DEG, 46), to: h }));
  /** The first glances off the top: it never met a grain. */
  const P_SPEC = { from: HITS[0], to: ray(HITS[0], 180 - IN_DEG, 40) };
  /**
   * The rest go in. Each has its own way through the grains and leaves at
   * its own point and angle, which is what "diffuse" means.
   */
  const P_PATHS = [
    { path: [HITS[1], { x: POWDER - 10, y: MINI_Y + 16 }, { x: POWDER - 2, y: MINI_Y + 24 }], exit: { x: POWDER + 2, y: MINI_Y }, deg: 104 },
    { path: [HITS[2], { x: POWDER + 4, y: MINI_Y + 13 }, { x: POWDER + 14, y: MINI_Y + 20 }], exit: { x: POWDER + 18, y: MINI_Y }, deg: 72 },
    { path: [HITS[3], { x: POWDER + 16, y: MINI_Y + 17 }, { x: POWDER + 28, y: MINI_Y + 12 }], exit: { x: POWDER + 34, y: MINI_Y }, deg: 46 },
  ].map(r => ({
    inside: [...r.path, r.exit],
    exit: r.exit,
    out: ray(r.exit, r.deg, 40),
  }));

  /* ── The bar, under the scene when the card is open ── */
  const BAR = { x: 80, w: 320, h: 14, y: 208 };
  const seg = (v: number) => v * BAR.w;
  const pct = (v: number) => Math.round(v * 100);

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="A beam is shot at one sample and leaves it three ways: reflected, transmitted, or absorbed. As the sample changes, the three fractions change with it, always adding up to one, and whichever dominates is the one drawn in colour"
>
  <!-- ── The scene: shot, landed, then the three ways out ── -->
  <g>
    <!-- Absorbed: a glow closing in on the sample, inward only. -->
    {#each glow as g}
      <rect class="glow" x={g.x} y={g.y} width={g.w} height={g.h} rx="4" stroke={colA} style="opacity:{g.o}" />
    {/each}

    <!-- The sample itself warms as it takes more of the beam. -->
    <rect class="slab" style="fill:{slabFill};stroke:{slabEdge}" x={SC.x} y={SC.y} width={SC.w} height={SC.h} rx="3" />

    <!-- The surface normal, and the two equal angles about it. -->
    {#if t > 0.6 && mix.dif < 0.99}
      <g style="opacity:{labelOpacity * 0.9 * (1 - mix.dif)}">
        <line class="normal" x1={P.x} y1={P.y} x2={P.x - 46} y2={P.y} />
        <path class="ang" d={arc(P.x, P.y, 22, A_NORM, A_IN)} />
        <path class="ang" d={arc(P.x, P.y, 22, A_REF, A_NORM)} />
        <text class="tick faint" x={P.x - 27} y={P.y - 10} text-anchor="middle">θ</text>
        <text class="tick faint" x={P.x - 27} y={P.y + 18} text-anchor="middle">θ</text>
      </g>
    {/if}

    <!-- In: drawn first, and always at full strength. -->
    <path
      class="beam"
      stroke={HOT}
      d={arrow(rayIn.x, rayIn.y, rayIn.x + (P.x - rayIn.x) * arrive, rayIn.y + (P.y - rayIn.y) * arrive)}
    />
    <!-- Through the sample: the part that is on its way out. -->
    <path class="inside" stroke={colT} style="opacity:{leave * 0.8}" d="M {P.x} {P.y} L {Q.x} {Q.y}" />

    <!-- Out: only once the beam has landed, each in its own standing. -->
    <path
      class="beam"
      stroke={colT}
      stroke-width={widthFor(dT)}
      style="opacity:{leave}"
      d={arrow(Q.x, Q.y, Q.x + (rayT.x - Q.x) * leave, Q.y + (rayT.y - Q.y) * leave)}
    />
    <!-- Mirrored off a smooth surface … -->
    <path
      class="beam"
      stroke={colR}
      stroke-width={widthFor(dR)}
      style="opacity:{leave * (1 - mix.dif)}"
      d={arrow(P.x, P.y, P.x + (rayR.x - P.x) * leave, P.y + (rayR.y - P.y) * leave)}
    />
    <!-- … or scattered every way at once off a powder. -->
    <!-- Held well back unless reflection is the story: a fan of arrows is
         loud, and it should not shout over a sample that is absorbing. -->
    {#if mix.dif > 0.01}
      <g style="opacity:{leave * mix.dif * (0.22 + 0.78 * dR)}">
        {#each fan as f}
          <path class="beam thin" stroke={colR} d={arrow(P.x, P.y, P.x + (f.x - P.x) * leave, P.y + (f.y - P.y) * leave, 4)} />
        {/each}
      </g>
    {/if}
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="18">One Beam, Three Ways Out</text>

    <!-- Each way out named for the intensity it carries, in its own standing. -->
    <text class="lbl sym" x={rayIn.x} y={rayIn.y - 7} text-anchor="middle">I<tspan class="sub">0</tspan></text>
    <text class="lbl sym" style="fill:{colR}" x={rayR.x} y={rayR.y + 15} text-anchor="middle">I<tspan class="sub">R</tspan></text>
    <text class="lbl sym" style="fill:{colT}" x={rayT.x} y={rayT.y + 15} text-anchor="middle">I<tspan class="sub">T</tspan></text>
    <text class="lbl sym" style="fill:{colA}" x={SC.x + SC.w / 2} y={SC.y - 24} text-anchor="middle">I<tspan class="sub">A</tspan></text>

    <text class="lbl kind" x={SC.x + SC.w / 2} y={SC.y + SC.h + 40} text-anchor="middle">{mix.name}</text>
  </g>

  <!-- ── The bar: the three fractions, always filling it ── -->
  <g style="opacity:{fullOpacity}">
    <rect class="bar-bg" x={BAR.x} y={BAR.y} width={BAR.w} height={BAR.h} rx="2" />
    <rect class="seg" fill={colR} x={BAR.x} y={BAR.y} width={seg(mix.r)} height={BAR.h} />
    <rect class="seg" fill={colT} x={BAR.x + seg(mix.r)} y={BAR.y} width={seg(mix.tr)} height={BAR.h} />
    <rect class="seg" fill={colA} x={BAR.x + seg(mix.r + mix.tr)} y={BAR.y} width={seg(mix.a)} height={BAR.h} />
    <!-- Hairlines, so three greys are still three. -->
    <line class="cut" x1={BAR.x + seg(mix.r)} x2={BAR.x + seg(mix.r)} y1={BAR.y} y2={BAR.y + BAR.h} />
    <line class="cut" x1={BAR.x + seg(mix.r + mix.tr)} x2={BAR.x + seg(mix.r + mix.tr)} y1={BAR.y} y2={BAR.y + BAR.h} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl faint" x={BAR.x - 8} y={BAR.y + 11} text-anchor="end">I₀</text>
    <text class="tick" style="fill:{colR}" x={BAR.x + seg(mix.r) / 2} y={BAR.y + BAR.h + 13} text-anchor="middle">{pct(mix.r)}</text>
    <text class="tick" style="fill:{colT}" x={BAR.x + seg(mix.r) + seg(mix.tr) / 2} y={BAR.y + BAR.h + 13} text-anchor="middle">{pct(mix.tr)}</text>
    <text class="tick" style="fill:{colA}" x={BAR.x + seg(mix.r + mix.tr) + seg(mix.a) / 2} y={BAR.y + BAR.h + 13} text-anchor="middle">{pct(mix.a)}</text>

    <text class="lbl" x={BAR.x} y={BAR.y + BAR.h + 38}>
      <tspan fill={colR}>reflected</tspan><tspan class="sep">&#160;+&#160;</tspan><tspan
        fill={colT}>transmitted</tspan><tspan class="sep">&#160;+&#160;</tspan><tspan
        fill={colA}>absorbed</tspan><tspan class="sep">&#160;=&#160;1</tspan>
    </text>
  </g>

  <!-- ── Two ways to reflect, which decide what a technique can collect ── -->
  <g style="opacity:{fullOpacity}">
    <!-- A smooth surface: in at an angle, out at the same one on the other
         side of the normal, and the two are the same ray, so they are drawn
         with the same weight. -->
    <line class="surface" x1={SMOOTH - 58} x2={SMOOTH + 58} y1={MINI_Y} y2={MINI_Y} />
    <rect class="body" x={SMOOTH - 58} y={MINI_Y} width="116" height="30" />
    <line class="normal" x1={hitS.x} y1={hitS.y} x2={hitS.x} y2={hitS.y - 46} />
    <path class="ang" d={arcDeg(hitS, 20, N_DEG, IN_DEG)} />
    <path class="ang" d={arcDeg(hitS, 20, 180 - IN_DEG, N_DEG)} />
    <path
      class="beam"
      style="stroke:{mixHex(COLD, HOT, hotSmooth)}"
      d={arrow(sIn.x, sIn.y, lerp(sIn.x, hitS.x - 1, beat(hotSmooth, miniIn)), lerp(sIn.y, hitS.y - 1, beat(hotSmooth, miniIn)))}
    />
    <path
      class="beam"
      style="stroke:{mixHex(COLD, HOT, hotSmooth)}"
      d={arrow(hitS.x, hitS.y - 1, lerp(hitS.x, sOut.x, beat(hotSmooth, miniSpec)), lerp(hitS.y - 1, sOut.y, beat(hotSmooth, miniSpec)))}
    />

    <!-- A powder: a beam of rays side by side. One glances off the top,
         the rest each take their own way through the grains. -->
    <line class="surface" x1={POWDER - 58} x2={POWDER + 58} y1={MINI_Y} y2={MINI_Y} />
    {#each GRAINS as g}
      <circle class="grain" cx={g.cx} cy={g.cy} r={g.r} />
    {/each}
    {#each P_IN as r}
      <path
        class="beam thin"
        style="stroke:{mixHex(COLD, HOT, hotPowder)}"
        d={arrow(r.from.x, r.from.y, lerp(r.from.x, r.to.x - 1, beat(hotPowder, miniIn)), lerp(r.from.y, r.to.y - 1, beat(hotPowder, miniIn)), 4)}
      />
    {/each}
    <!-- Straight back off the top: it never met a grain, so it carries
         nothing about the chemistry and stays grey throughout. -->
    <path
      class="beam thin"
      style="stroke:{COLD}"
      d={arrow(P_SPEC.from.x, P_SPEC.from.y - 1, lerp(P_SPEC.from.x, P_SPEC.to.x, beat(hotPowder, miniSpec)), lerp(P_SPEC.from.y - 1, P_SPEC.to.y, beat(hotPowder, miniSpec)), 4)}
    />
    {#each P_PATHS as r}
      <path
        class="inside"
        style="stroke:{mixHex(COLD, HOT, hotPowder)};opacity:0.6"
        d={partial(r.inside, beat(hotPowder, miniThru))}
      />
      <path
        class="beam thin"
        style="stroke:{mixHex(COLD, HOT, hotPowder)}"
        d={arrow(r.exit.x, r.exit.y - 1, lerp(r.exit.x, r.out.x, beat(hotPowder, miniOut)), lerp(r.exit.y - 1, r.out.y, beat(hotPowder, miniOut)), 4)}
      />
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={MINI_Y - 70}>Two Ways to Come Back Out</text>
    <text class="lbl kind" x={SMOOTH} y={MINI_Y + 50} text-anchor="middle">a smooth surface</text>
    <text class="tick" x={SMOOTH} y={MINI_Y + 64} text-anchor="middle">out at the angle it came in</text>
    <text class="lbl kind" x={POWDER} y={MINI_Y + 50} text-anchor="middle">a powder</text>
    <text class="tick" x={POWDER} y={MINI_Y + 64} text-anchor="middle">through the grains, out any way</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  /* Fill and stroke come from the script (they warm with absorption), so
     they are set inline: a rule here would win over them. */
  .slab { stroke-width: 1.2; }
  /* The part crossing the sample: thinner, so it reads as inside. */
  .inside { fill: none; stroke-width: 1.2; stroke-dasharray: 2 2; }
  /* The surface normal, and the equal angles measured from it. */
  .normal { stroke: var(--ink-025); stroke-width: 1; stroke-dasharray: 3 3; }
  .ang { fill: none; stroke: var(--ink-025); stroke-width: 1; }
  /* The absorbed part: not an arrow, since nothing leaves. */
  .glow {
    fill: none;
    stroke-width: 2;
  }

  .beam {
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* A scattered ray: many of them, so each is drawn lighter. */
  .beam.thin { stroke-width: 1.1; }
  .surface { stroke: var(--line-slate-strong); stroke-width: 1.2; }
  .body { fill: var(--line-slate); }
  .grain { fill: var(--surface); stroke: var(--line-slate-strong); stroke-width: 0.9; }

  .bar-bg { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  .cut { stroke: var(--surface); stroke-width: 1; }

  .tick {
    font-family: var(--t-code-ff);
    font-size: max(calc(var(--t-code-size) * 0.8), var(--t-diagram-note-size));
    fill: var(--ink-050);
  }
  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.kind { fill: var(--ink-slate-500); }
  .lbl.sym { font-family: var(--font-sans); font-style: italic; fill: var(--ink-slate-900); }
  .sub { font-size: 0.72em; baseline-shift: -0.28em; font-style: normal; }
  .tick.faint { fill: var(--ink-025); }
  .sep { fill: var(--ink-050); }
</style>

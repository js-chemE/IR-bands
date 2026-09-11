<script context="module" lang="ts">
  /** One CO₂ band as this diagram draws it; built from a real atlas band. */
  export interface SelectionExample {
    id: string;
    wn: number;
    fwhm: number;
    /** 0–1, relative height within its own spectrum. */
    depth: number;
    /** Drawn in the Raman spectrum rather than the IR one. */
    raman: boolean;
  }
</script>

<script lang="ts">
  /**
   * Selection rules, on CO₂: which vibrations IR sees and which Raman sees.
   *
   *   t = 0  the card: the two stretches as a little table, IR and Raman as
   *          its columns. At rest each is frozen at the end of its swing, so
   *          the still already shows the point: the symmetric stretch with its
   *          electron cloud swollen and no dipole, the asymmetric one with a
   *          dipole and an unchanged cloud.
   *   t = 1  the opened card: all three modes in columns, each set above its
   *          own position on the wavenumber axis, with the dipole μ and the
   *          polarizability α traced through the swing and the verdict under
   *          them; below, the IR and the Raman spectrum of CO₂, drawn from
   *          the atlas's own bands. Nothing appears in both: mutual exclusion.
   *          Last, every mode frozen at +Q and −Q: the symmetric stretch gives
   *          two different shapes (α differs, μ stays zero), the asymmetric
   *          stretch and the bend give mirror images (μ flips, α does not).
   *
   * The two traces carry the argument. In the symmetric stretch μ stays at
   * zero while α follows the motion. In the asymmetric stretch and the bend
   * μ follows the motion while α changes only at twice the frequency, the
   * same on either side of rest, so dα/dQ at rest is zero: IR, not Raman.
   *
   * Colour language: orange is IR (the IR card's photon), green is Raman (the
   * Raman card's laser). Atoms use the CPK colours of the vibration pages.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  // Gradient ids must be unique in the document; every instance gets its own.
  const uid = `sel${Math.random().toString(36).slice(2, 8)}`;

  export let t = 0;
  export let playing = false;
  export let examples: SelectionExample[] = [];

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  type Mode = 'asym' | 'sym' | 'bend';
  const MODES: Mode[] = ['asym', 'sym', 'bend'];

  const WN_HI = 2600;
  const WN_LO = 300;
  // Where each mode's column stands: over its own band (ν₁ over the middle of
  // its Fermi pair).
  const MODE_WN: Record<Mode, number> = { asym: 2349, sym: 1337, bend: 675 };
  const NAME: Record<Mode, string> = { asym: 'νₐₛ(OCO)', sym: 'νₛ(OCO)', bend: 'δ(OCO)' };
  const ACTIVE: Record<Mode, { ir: boolean; raman: boolean }> = {
    asym: { ir: true, raman: false },
    sym: { ir: false, raman: true },
    bend: { ir: true, raman: false },
  };

  /* ── The two frames ─────────────────────────────────────────────────── */

  const S = { W: 220, H: 100, px: 238 / 220, bond: 14, rO: 4.2, rC: 4.4, rx: 27, ry: 10, colIR: 122, colRaman: 150 };
  const SMALL_AT: Record<Mode, { x: number; y: number }> = {
    sym: { x: 62, y: 30 },
    asym: { x: 62, y: 72 },
    bend: { x: 62, y: 72 }, // the bend grows out of the other IR-active mode
  };
  const F = {
    W: 480, H: 526, x0: 52, x1: 466, bond: 18, rO: 6, rC: 6.3, rx: 36, ry: 13,
    my: 42, muY: 82, alY: 102, verdictY: 128,
    irTop: 146, irBase: 204, raTop: 220, raBase: 278,
  };
  const X = (wn: number) => F.x0 + ((WN_HI - wn) / (WN_HI - WN_LO)) * (F.x1 - F.x0);

  $: W = lerp(S.W, F.W, t);
  $: H = lerp(S.H, F.H, t);
  $: scale = lerp(S.px, 1, t);
  $: bond = lerp(S.bond, F.bond, t);
  $: rO = lerp(S.rO, F.rO, t);
  $: rC = lerp(S.rC, F.rC, t);

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

  // The same unhurried pace as the Dipole and Polarizability cards.
  const HZ = 0.5;
  // At rest, frozen at the end of the swing, where the difference shows.
  $: phi = running ? Math.PI / 2 + (clock / 1000) * HZ * 2 * Math.PI : Math.PI / 2;

  /* ── What each mode does to μ and α, as functions of the phase ──────── */

  const mu = (m: Mode, p: number) => (m === 'sym' ? 0 : Math.sin(p));
  // α follows the motion in the symmetric stretch; elsewhere it changes only
  // at twice the frequency, the same on both sides of rest.
  const alpha = (m: Mode, p: number) => (m === 'sym' ? Math.sin(p) : 0.4 * Math.sin(p) ** 2);

  // Carbon is lighter: to keep the centre of mass still it moves 2·16/12 as far.
  const C_RATIO = (2 * 16) / 12;

  $: molecules = MODES.map(m => {
    const cx = lerp(SMALL_AT[m].x, X(MODE_WN[m]), t);
    const cy = lerp(SMALL_AT[m].y, F.my, t);
    const s = Math.sin(phi);
    let oL = { x: cx - bond, y: cy };
    let oR = { x: cx + bond, y: cy };
    let c = { x: cx, y: cy };
    if (m === 'sym') {
      const a = lerp(2.4, 3.5, t) * s;
      oL = { x: cx - bond - a, y: cy };
      oR = { x: cx + bond + a, y: cy };
    } else if (m === 'asym') {
      const a = lerp(1.2, 1.6, t) * s;
      oL = { x: cx - bond + a, y: cy };
      oR = { x: cx + bond + a, y: cy };
      c = { x: cx - C_RATIO * a, y: cy };
    } else {
      const a = 1.6 * s;
      oL = { x: cx - bond, y: cy - a };
      oR = { x: cx + bond, y: cy - a };
      c = { x: cx, y: cy + C_RATIO * a };
    }
    const al = alpha(m, phi);
    const grow = m === 'sym' ? al * 0.13 : al * 0.1;
    return {
      m,
      cx,
      cy,
      oL,
      oR,
      c,
      rx: lerp(S.rx, F.rx, t) * (1 + grow),
      ry: lerp(S.ry, F.ry, t) * (1 + grow * 0.5),
      mu: mu(m, phi),
      opacity: m === 'bend' ? ramp(t, 0.3, 0.75) : 1,
    };
  });

  /* ── Traces: two periods of μ and α, with a cursor at the present ───── */

  const TRACE_W = 80;
  const TRACE_AMP = 6;
  function tracePath(f: (p: number) => number, x0: number, y0: number): string {
    const pts: string[] = [];
    for (let i = 0; i <= TRACE_W; i += 1) {
      const p = (i / TRACE_W) * 4 * Math.PI;
      pts.push(`${(x0 + i).toFixed(1)},${(y0 - f(p) * TRACE_AMP).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  $: cursor = ((phi % (4 * Math.PI)) / (4 * Math.PI)) * TRACE_W;

  /* ── Spectra ────────────────────────────────────────────────────────── */

  function spectrum(bands: SelectionExample[], top: number, base: number): string {
    const pts: string[] = [];
    for (let x = F.x0; x <= F.x1; x += 1) {
      const wn = WN_HI - ((x - F.x0) / (F.x1 - F.x0)) * (WN_HI - WN_LO);
      let h = 0;
      for (const b of bands) {
        const s = b.fwhm / 2.355;
        h += b.depth * Math.exp(-((wn - b.wn) ** 2) / (2 * s * s));
      }
      pts.push(`${x},${(base - Math.min(1, h) * (base - top - 4)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  }
  $: irPath = spectrum(examples.filter(b => !b.raman), F.irTop, F.irBase);
  $: ramanPath = spectrum(examples.filter(b => b.raman), F.raTop, F.raBase);

  const ROWS: { m: Mode; y: number }[] = [
    { m: 'sym', y: 34 },
    { m: 'asym', y: 76 },
  ];

  $: cardFade = 1 - ramp(t, 0, 0.35);
  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
  const TICKS = [2500, 2000, 1500, 1000, 500];

  /* ── Frozen at the two extremes ─────────────────────────────────────── */

  // One line per mode: +Q on the left, −Q on the right, and between them
  // either "≠" (two different shapes) or a mirror line. No field here: the
  // shapes carry the argument, and μ is drawn where the motion creates one.
  const FZ = { title: 346, head: 370, xa: 132, xb: 236, verdictX: 304 };
  type Atom = { el: 'C' | 'O'; x: number; y: number };
  type Blob = { x: number; y: number; rx: number; ry: number; kind: string };
  type Snap = { atoms: Atom[]; clouds: Blob[]; mu?: { x1: number; y1: number; x2: number; y2: number } };
  type Frozen = { m: Mode; y: number; mirror: boolean; snaps: Snap[]; lines: [string, string] };

  function symSnap(cx: number, y: number, long: boolean): Snap {
    const half = long ? 21 : 13;
    return {
      atoms: [
        { el: 'O', x: cx - half, y },
        { el: 'C', x: cx, y },
        { el: 'O', x: cx + half, y },
      ],
      clouds: [{ x: cx, y, rx: long ? 34 : 23, ry: long ? 13 : 9, kind: long ? 'spread' : 'compact' }],
    };
  }
  // +Q: carbon shifted left, so the left C=O is short and the right one long.
  function asymSnap(cx: number, y: number, dir: 1 | -1): Snap {
    const c = cx - dir * 5;
    const oL = cx - 19;
    const oR = cx + 19;
    const lobe = (a: number, b: number): Blob => {
      const len = b - a;
      return { x: (a + b) / 2, y, rx: len / 2 + 7, ry: 5 + (len - 14) * 0.55, kind: len > 19 ? 'spread' : 'compact' };
    };
    return {
      atoms: [
        { el: 'O', x: oL, y },
        { el: 'C', x: c, y },
        { el: 'O', x: oR, y },
      ],
      clouds: [lobe(oL, c), lobe(c, oR)],
      // From − to +: the way the δ+ carbon sits off the oxygens' centre.
      mu: { x1: cx + 10 * dir, y1: y + 17, x2: cx - 10 * dir, y2: y + 17 },
    };
  }
  // +Q: oxygens up, carbon down, so the positive centre sits low.
  function bendSnap(cx: number, y: number, dir: 1 | -1): Snap {
    return {
      atoms: [
        { el: 'O', x: cx - 18, y: y - 4 * dir },
        { el: 'C', x: cx, y: y + 5 * dir },
        { el: 'O', x: cx + 18, y: y - 4 * dir },
      ],
      clouds: [{ x: cx, y, rx: 30, ry: 13, kind: '' }],
      mu: { x1: cx + 32, y1: y - 9 * dir, x2: cx + 32, y2: y + 9 * dir },
    };
  }
  const FY = 398;
  const FROZEN: Frozen[] = [
    { m: 'sym', y: FY, mirror: false, snaps: [symSnap(FZ.xa, FY, true), symSnap(FZ.xb, FY, false)], lines: ['μ = 0 both: IR ✗', 'α differs: Raman ✓'] },
    { m: 'asym', y: FY + 50, mirror: true, snaps: [asymSnap(FZ.xa, FY + 50, 1), asymSnap(FZ.xb, FY + 50, -1)], lines: ['μ flips: IR ✓', 'α same: Raman ✗'] },
    { m: 'bend', y: FY + 100, mirror: true, snaps: [bendSnap(FZ.xa, FY + 100, 1), bendSnap(FZ.xb, FY + 100, -1)], lines: ['μ flips: IR ✓', 'α same: Raman ✗'] },
  ];
  const muHead = (mu: { x1: number; y1: number; x2: number; y2: number }) => {
    const dx = mu.x2 - mu.x1;
    const dy = mu.y2 - mu.y1;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n;
    const uy = dy / n;
    return `M${mu.x2 - ux * 4 - uy * 3},${mu.y2 - uy * 4 + ux * 3} L${mu.x2},${mu.y2} L${mu.x2 - ux * 4 + uy * 3},${mu.y2 - uy * 4 - ux * 3}`;
  };

  const O_FILL = colorForElement('O');
  const C_FILL = colorForElement('C');
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="CO₂: the symmetric stretch changes the polarizability but not the dipole and shows only in Raman; the asymmetric stretch and the bend change the dipole and show only in IR"
>
  <!-- One density per molecule: its densest point follows the oxygens,
       where the electrons are. -->
  <defs>
    {#each molecules as mol (mol.m)}
      <radialGradient
        id="{uid}-{mol.m}"
        cx="0.5" cy="0.5" r="0.62"
        fx={mol.m === 'asym' ? 0.5 + 0.28 * mol.mu : 0.5}
        fy={mol.m === 'bend' ? 0.5 - 0.34 * mol.mu : 0.5}
      >
        <stop offset="0" class="dense" class:strong={mol.m === 'sym'} />
        <stop offset="0.5" class="mid" />
        <stop offset="1" class="thin" />
      </radialGradient>
    {/each}
    <!-- The frozen clouds: spread thin around a long bond, packed around a short one. -->
    {#each ['', 'spread', 'compact'] as kind}
      <radialGradient id="{uid}-frozen{kind}" cx="0.5" cy="0.5" r="0.62">
        <stop offset="0" class="dense {kind}" />
        <stop offset="0.5" class="mid {kind}" />
        <stop offset="1" class="thin" />
      </radialGradient>
    {/each}
  </defs>

  <!-- ── The molecules ── -->
  {#each molecules as mol (mol.m)}
    <g style="opacity:{mol.opacity}">
      <!-- The electron cloud: its size is the polarizability, its lopsidedness the dipole. -->
      <ellipse class="cloud" cx={mol.cx} cy={mol.cy} rx={mol.rx} ry={mol.ry} fill="url(#{uid}-{mol.m})" />
      <line class="bond" x1={mol.oL.x} y1={mol.oL.y} x2={mol.c.x} y2={mol.c.y} />
      <line class="bond" x1={mol.c.x} y1={mol.c.y} x2={mol.oR.x} y2={mol.oR.y} />
      <circle cx={mol.oL.x} cy={mol.oL.y} r={rO} fill={O_FILL} />
      <circle cx={mol.oR.x} cy={mol.oR.y} r={rO} fill={O_FILL} />
      <circle cx={mol.c.x} cy={mol.c.y} r={rC} fill={C_FILL} />

      <!-- Carbon carries δ+, the oxygens δ−, as on the Dipole card. -->
      <g style="opacity:{labelOpacity}">
        <text class="delta pos" x={mol.c.x} y={mol.c.y - 11} text-anchor="middle">δ+</text>
        <text class="delta neg" x={mol.oL.x - 4} y={mol.oL.y - 10} text-anchor="middle">δ−</text>
        <text class="delta neg" x={mol.oR.x + 4} y={mol.oR.y - 10} text-anchor="middle">δ−</text>
      </g>

      <!-- The dipole, from − to +: the way carbon moves off the oxygens' centre. -->
      {#if mol.m === 'asym' && Math.abs(mol.mu) > 0.08}
        {@const y = mol.cy + lerp(13, 20, t)}
        {@const L = -lerp(11, 16, t) * mol.mu}
        <line class="dipole" x1={mol.cx - L} x2={mol.cx + L} y1={y} y2={y} />
        <path class="dipole-head" d="M{mol.cx + L - Math.sign(L) * 4},{y - 3} L{mol.cx + L},{y} L{mol.cx + L - Math.sign(L) * 4},{y + 3}" />
      {/if}
      {#if mol.m === 'bend' && Math.abs(mol.mu) > 0.08}
        {@const x = mol.cx + 46}
        {@const L = -11 * mol.mu}
        <line class="dipole" x1={x} x2={x} y1={mol.cy + L} y2={mol.cy - L} />
        <path class="dipole-head" d="M{x - 3},{mol.cy - L + Math.sign(L) * 4} L{x},{mol.cy - L} L{x + 3},{mol.cy - L + Math.sign(L) * 4}" />
      {/if}
      {#if mol.m !== 'sym'}
        <text
          class="sym mu-lbl"
          x={mol.m === 'asym' ? mol.cx : mol.cx + 56}
          y={mol.m === 'asym' ? mol.cy + lerp(25, 33, t) : mol.cy + 4}
          text-anchor={mol.m === 'asym' ? 'middle' : 'start'}
          style="opacity:{Math.min(1, Math.abs(mol.mu) * 2)}"
        >μ</text>
      {/if}
    </g>
  {/each}

  <!-- ── The card's table: IR and Raman as columns ── -->
  <g style="opacity:{cardFade}">
    <text class="lbl head-ir" x={S.colIR} y="12" text-anchor="middle">IR</text>
    <text class="lbl head-raman" x={S.colRaman + 14} y="12" text-anchor="middle">Raman</text>
    {#each ROWS as row}
      {@const a = ACTIVE[row.m]}
      <text class="mark" class:yes-ir={a.ir} x={S.colIR} y={row.y} text-anchor="middle">{a.ir ? '✓' : '✗'}</text>
      <text class="mark" class:yes-raman={a.raman} x={S.colRaman + 14} y={row.y} text-anchor="middle">{a.raman ? '✓' : '✗'}</text>
    {/each}
  </g>

  <!-- ── Opened: per mode, the name, the two traces and the verdict ── -->
  <g style="opacity:{labelOpacity}">
    {#each MODES as m}
      {@const cx = X(MODE_WN[m])}
      {@const tx = cx - 34}
      <text class="lbl name" x={cx} y="14" text-anchor="middle">{NAME[m]}</text>

      <text class="sym" x={tx - 10} y={F.muY + 4} text-anchor="middle">μ</text>
      <line class="zero" x1={tx} x2={tx + TRACE_W} y1={F.muY} y2={F.muY} />
      <path class="trace ir" d={tracePath(p => mu(m, p), tx, F.muY)} />
      <circle class="cursor ir" cx={tx + cursor} cy={F.muY - mu(m, phi) * TRACE_AMP} r="2.2" />

      <text class="sym" x={tx - 10} y={F.alY + 4} text-anchor="middle">α</text>
      <line class="zero" x1={tx} x2={tx + TRACE_W} y1={F.alY} y2={F.alY} />
      <path class="trace raman" d={tracePath(p => alpha(m, p), tx, F.alY)} />
      <circle class="cursor raman" cx={tx + cursor} cy={F.alY - alpha(m, phi) * TRACE_AMP} r="2.2" />

      <text class="verdict" class:yes-ir={ACTIVE[m].ir} x={cx - 6} y={F.verdictY} text-anchor="end">IR {ACTIVE[m].ir ? '✓' : '✗'}</text>
      <text class="verdict" class:yes-raman={ACTIVE[m].raman} x={cx + 6} y={F.verdictY}>Raman {ACTIVE[m].raman ? '✓' : '✗'}</text>

      <!-- Down to the spectrum it shows in: through the IR plot for ν₁, to prove the gap. -->
      <line class="link" x1={cx} x2={cx} y1={F.verdictY + 6} y2={ACTIVE[m].ir ? F.irTop : F.raTop} />
    {/each}
  </g>

  <!-- ── Opened: the two spectra ── -->
  <g style="opacity:{fullOpacity}">
    <path class="axis-line" d="M{F.x0 - 6},{F.irTop} V{F.irBase} H{F.x1}" />
    <path class="axis-line" d="M{F.x0 - 6},{F.raTop} V{F.raBase} H{F.x1}" />
    {#each TICKS as wn}
      <line class="axis-line" x1={X(wn)} x2={X(wn)} y1={F.irBase} y2={F.irBase + 3} />
      <line class="axis-line" x1={X(wn)} x2={X(wn)} y1={F.raBase} y2={F.raBase + 4} />
    {/each}
    <path class="spec ir" d={irPath} />
    <path class="spec raman" d={ramanPath} />
  </g>

  <g style="opacity:{labelOpacity}">
    <text class="lbl ax-title" transform="translate({F.x0 - 24} {(F.irTop + F.irBase) / 2}) rotate(-90)" text-anchor="middle">IR</text>
    <text class="lbl ax-title" transform="translate({F.x0 - 24} {(F.raTop + F.raBase) / 2}) rotate(-90)" text-anchor="middle">Raman</text>

    <!-- Where one spectrum has the mode, the other is silent. -->
    <text class="lbl faint" x={X(MODE_WN.sym) + 6} y={F.irBase - 6}>silent</text>
    <text class="lbl faint" x={X(MODE_WN.asym)} y={F.raBase - 6} text-anchor="middle">silent</text>
    <text class="lbl faint" x={X(MODE_WN.bend)} y={F.raBase - 6} text-anchor="middle">silent</text>
    <text class="lbl faint" x={X(1285) + 10} y={F.raTop + 14}>Fermi pair</text>

    {#each TICKS as wn}
      <text class="lbl" x={X(wn)} y={F.raBase + 16} text-anchor="middle">{wn}</text>
    {/each}
    <text class="lbl faint" x={F.x0} y={F.raBase + 32}>← higher energy</text>
    <text class="lbl faint" x={F.x1} y={F.raBase + 32} text-anchor="end">wavenumber (cm⁻¹)</text>
  </g>

  <!-- ── Opened: every mode frozen at +Q and −Q ── -->
  <g style="opacity:{fullOpacity}">
    {#each FROZEN as row (row.m)}
      {#each row.snaps as snap}
        {#each snap.clouds as c}
          <ellipse class="cloud" cx={c.x} cy={c.y} rx={c.rx} ry={c.ry} fill="url(#{uid}-frozen{c.kind})" />
        {/each}
        <line class="bond" x1={snap.atoms[0].x} y1={snap.atoms[0].y} x2={snap.atoms[1].x} y2={snap.atoms[1].y} />
        <line class="bond" x1={snap.atoms[1].x} y1={snap.atoms[1].y} x2={snap.atoms[2].x} y2={snap.atoms[2].y} />
        {#each snap.atoms as a}
          <circle cx={a.x} cy={a.y} r={a.el === 'C' ? 5.3 : 5} fill={a.el === 'C' ? C_FILL : O_FILL} />
        {/each}
        {#if snap.mu}
          <line class="dipole" x1={snap.mu.x1} y1={snap.mu.y1} x2={snap.mu.x2} y2={snap.mu.y2} />
          <path class="dipole-head" d={muHead(snap.mu)} />
        {/if}
      {/each}
      {#if row.mirror}
        <line class="mirror" x1={(FZ.xa + FZ.xb) / 2} x2={(FZ.xa + FZ.xb) / 2} y1={row.y - 20} y2={row.y + 20} />
      {/if}
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={FZ.title}>Frozen at the Two Extremes</text>
    <text class="lbl faint" x="212" y={FZ.title}>the mirror flips μ, not α</text>
    <text class="lbl" x={FZ.xa} y={FZ.head} text-anchor="middle">+Q</text>
    <text class="lbl" x={FZ.xb} y={FZ.head} text-anchor="middle">−Q</text>
    {#each FROZEN as row (row.m)}
      <text class="lbl name" x="14" y={row.y + 4}>{NAME[row.m]}</text>
      {#if !row.mirror}
        <text class="lbl strong" x={(FZ.xa + FZ.xb) / 2} y={row.y + 5} text-anchor="middle">≠</text>
      {/if}
      <text class="verdict" class:yes-ir={ACTIVE[row.m].ir} x={FZ.verdictX} y={row.y - 3}>{row.lines[0]}</text>
      <text class="verdict" class:yes-raman={ACTIVE[row.m].raman} x={FZ.verdictX} y={row.y + 13}>{row.lines[1]}</text>
    {/each}
    <text class="lbl faint" x={(FZ.xa + FZ.xb) / 2} y={FROZEN[2].y + 32} text-anchor="middle">mirror</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .cloud {
    stroke: var(--diagram-laser);
    stroke-opacity: 0.45;
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }
  /* The electron density, as on the Polarizability card. */
  .dense { stop-color: var(--diagram-laser); stop-opacity: 0.55; }
  .dense.strong { stop-opacity: 0.7; }
  .mid { stop-color: var(--diagram-laser); stop-opacity: 0.22; }
  .thin { stop-color: var(--diagram-laser); stop-opacity: 0.02; }
  /* Frozen clouds: spread thin around a long bond, packed around a short one. */
  .dense.spread { stop-opacity: 0.45; }
  .mid.spread { stop-opacity: 0.14; }
  .dense.compact { stop-opacity: 0.9; }
  .mid.compact { stop-opacity: 0.5; }

  .mirror { stroke: var(--ink-slate-400); stroke-width: 1; stroke-dasharray: 4 3; }
  .lbl.strong { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }

  .delta {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
  }
  .neg { fill: var(--charge-negative); }
  .pos { fill: var(--charge-positive); }
  .sym.mu-lbl { fill: var(--diagram-photon); }

  .bond { stroke: var(--ink-slate-400); stroke-width: 2.2; }

  .dipole { stroke: var(--diagram-photon); stroke-width: 1.6; }
  .dipole-head {
    fill: none;
    stroke: var(--diagram-photon);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zero { stroke: var(--line-slate); stroke-width: 1; }
  .trace { fill: none; stroke-width: 1.4; }
  .trace.ir, .spec.ir { stroke: var(--diagram-photon); }
  .trace.raman, .spec.raman { stroke: var(--diagram-laser); }
  .cursor.ir { fill: var(--diagram-photon); }
  .cursor.raman { fill: var(--diagram-laser); }

  .spec { fill: none; stroke-width: 1.5; stroke-linejoin: round; }

  .axis-line { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }

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
  .head-ir { fill: var(--diagram-photon); }
  .head-raman { fill: var(--diagram-laser); }

  .sym {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-style: italic;
    fill: var(--ink-slate-500);
  }

  /* ✓ in the technique's colour, ✗ faint. */
  .mark,
  .verdict {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-025);
  }
  .yes-ir { fill: var(--diagram-photon); }
  .yes-raman { fill: var(--diagram-laser); }
</style>

<script lang="ts">
  /**
   * Polarizability: how easily a field pulls an electron cloud off-centre,
   * and whether a vibration changes that. The Raman card takes it from there.
   *
   * The cloud is drawn as a density, not as a ball that moves: in a field it
   * stays where it is, but grows denser (darker) on the side the electrons
   * are pushed to and thinner on the other, while the nuclei shift slightly
   * the opposite way. The two sides are marked δ− and δ+, and the induced
   * dipole μ(ind) runs from − to +. A cloud that slid bodily would read as a
   * vibration, which is exactly what this is not.
   *
   *   t = 0  the card: a light wave runs slowly across N₂. Its field,
   *          perpendicular to the way it travels, polarizes the cloud up and
   *          down, and μ(ind) follows it.
   *   t = 1  the opened card builds α up in three rows, one field for all:
   *            what α is: a tight cloud and a loose one in the same field; the
   *              loose one polarizes more, and its induced dipole is larger;
   *            it depends on direction: N₂'s cloud gives more along the bond
   *              than across it (the ellipsoid);
   *            it can change as the molecule vibrates: N₂'s stretch (α(Q) has
   *              a slope, Raman ✓), where the card's N₂ lands; CO₂'s
   *              asymmetric stretch (bottom of a parabola, Raman ✗).
   *
   * μ(ind) rather than the Raman chapter's P: it is a dipole moment like the
   * Dipole card's μ, only induced by the field instead of carried.
   */
  import { onDestroy } from 'svelte';
  import { colorForElement } from '../../lib/elementColors';

  export let t = 0;
  export let playing = false;

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const ramp = (k: number, from: number, to: number) =>
    Math.max(0, Math.min(1, (k - from) / (to - from)));

  // Gradient ids must be unique in the document; every instance gets its own.
  const uid = `pol${Math.random().toString(36).slice(2, 8)}`;

  // The card's N₂ becomes the opened card's third row.
  const S = { W: 220, H: 100, px: 238 / 220, mx: 110, my: 52, bond: 20, rN: 4.8, rx: 30, ry: 16, waveX0: 8, waveX1: 212, amp: 15, lambda: 80 };
  const F = { W: 480, H: 438, mx: 100, my: 306, bond: 26, rN: 6, rx: 38, ry: 18, waveX0: 14, waveX1: 186, amp: 18, lambda: 96 };

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

  // Slow enough to watch the charge move: one swing of the field in two
  // seconds, one vibration in eight.
  const NU_L = 0.5;
  const NU_V = 0.125;
  $: time = running ? clock / 1000 : 0;
  // The card shows the light alone; the vibration arrives as the card opens.
  $: vibOn = ramp(t, 0.3, 0.9);

  /* ── The light wave, and the field it puts at the molecule ── */
  $: cx = lerp(S.mx, F.mx, t);
  $: cy = lerp(S.my, F.my, t);
  $: amp = lerp(S.amp, F.amp, t);
  $: lambda = lerp(S.lambda, F.lambda, t);
  $: wx0 = lerp(S.waveX0, F.waveX0, t);
  $: wx1 = lerp(S.waveX1, F.waveX1, t);
  // A wave travelling to the right, phased so that at rest the field at the
  // molecule is at its peak.
  const field = (x: number, lam: number, mx: number, tt: number) =>
    Math.cos(2 * Math.PI * ((x - mx) / lam - NU_L * tt));
  $: wavePath = (() => {
    const pts: string[] = [];
    for (let x = wx0; x <= wx1; x += 1) {
      pts.push(`${x.toFixed(1)},${(cy - amp * field(x, lambda, cx, time)).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();
  // One field for the whole opened card, so every row polarizes in step.
  // Positive: pointing up (or, in the along-the-bond case, to the right).
  $: e = field(cx, lambda, cx, time);

  /**
   * Where the densest point of a cloud sits, as a fraction of its box: the
   * electrons gather against the field, so an upward field moves it down.
   */
  const focus = (pol: number) => 0.5 + 0.44 * Math.max(-1, Math.min(1, pol));

  const vHead = (x: number, y: number, dir: number, sz = 4) =>
    `M${x - sz * 0.75},${y + dir * sz} L${x},${y} L${x + sz * 0.75},${y + dir * sz}`;
  const hHead = (x: number, y: number, dir: number, sz = 4) =>
    `M${x - dir * sz},${y - sz * 0.75} L${x},${y} L${x - dir * sz},${y + sz * 0.75}`;

  /* ── Row 3 (and the card): N₂ in its cloud, vibrating ── */
  $: q = Math.sin(2 * Math.PI * NU_V * time) * vibOn; // the stretch, −1 … 1
  // The cloud grows with the bond, so α follows Q.
  $: alphaN2 = 1 + 0.25 * q;
  $: polN2 = 0.9 * alphaN2 * e;
  $: bond = lerp(S.bond, F.bond, t) * (1 + 0.14 * q);
  $: nShift = -lerp(1.6, 2, t) * polN2; // nuclei go with the field: up is −y
  $: rx = lerp(S.rx, F.rx, t) * (1 + 0.3 * (alphaN2 - 1));
  $: ry = lerp(S.ry, F.ry, t) * (1 + 0.3 * (alphaN2 - 1));
  $: arrowX = cx + rx + lerp(14, 16, t);

  /* ── Row 1: same field, two clouds ── */
  const R1 = {
    y: 60,
    fieldX: 36,
    tight: { key: 't', x: 116, r: 12, pol: 0.3, nuc: 0.8 },
    loose: { key: 'l', x: 226, r: 22, pol: 1, nuc: 2.4 },
  };

  /* ── Row 2: along the bond, across it ── */
  const R2 = { y: 190, along: 110, across: 250, bond: 24, rx: 32, ry: 14, polAlong: 1, polAcross: 0.4 };

  /* ── Row 3b: CO₂, asymmetric stretch ── */
  const CO2 = { x: 100, y: 390, bond: 22 };
  const C_RATIO = (2 * 16) / 12;
  $: aCO2 = 2 * Math.sin(2 * Math.PI * NU_V * time);
  // α changes with Q² only: bigger at both ends, the same either way.
  $: alphaCO2 = 1 + 0.1 * (aCO2 / 2) ** 2;

  /* ── α(Q) lines ── */
  const PX0 = 250;
  const PX1 = 350;
  const qToX = (v: number) => PX0 + ((v + 1) / 2) * (PX1 - PX0);
  const parabola = (() => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const v = -1 + (2 * i) / 40;
      pts.push(`${qToX(v).toFixed(1)},${(CO2.y + 10 - 20 * v * v).toFixed(1)}`);
    }
    return 'M' + pts.join(' L');
  })();

  /** δ+ where the field pulls the cloud away from, δ− where it piles up. */
  const sign = (pol: number, side: 'field' | 'against') =>
    (pol > 0) === (side === 'field') ? 'δ+' : 'δ−';
  const signOpacity = (pol: number) => Math.min(1, Math.abs(pol) * 1.6);
  const signClass = (pol: number, side: 'field' | 'against') =>
    sign(pol, side) === 'δ+' ? 'pos' : 'neg';

  const N_FILL = colorForElement('N');
  const O_FILL = colorForElement('O');
  const C_FILL = colorForElement('C');

  $: fullOpacity = ramp(t, 0.35, 0.85);
  $: labelOpacity = ramp(t, 0.75, 1);
</script>

<svg
  class="diagram"
  width={W * scale}
  height={H * scale}
  viewBox="0 0 {W} {H}"
  role="img"
  aria-label="Polarizability: a field makes an electron cloud denser on one side and thinner on the other, a dipole with δ− and δ+ ends; a loose cloud polarizes more than a tight one, and N₂'s cloud more along its bond than across it; N₂'s cloud changes as it stretches, CO₂'s asymmetric stretch the same way on both sides"
>
  <!-- One gradient per cloud: its densest point follows the polarization. -->
  <defs>
    {#each [
      { id: 'r1t', fx: 0.5, fy: focus(R1.tight.pol * e) },
      { id: 'r1l', fx: 0.5, fy: focus(R1.loose.pol * e) },
      { id: 'r2a', fx: focus(-R2.polAlong * e), fy: 0.5 },
      { id: 'r2c', fx: 0.5, fy: focus(R2.polAcross * e) },
      { id: 'n2', fx: 0.5, fy: focus(polN2) },
    ] as g (g.id)}
      <radialGradient id="{uid}-{g.id}" cx="0.5" cy="0.5" r="0.62" fx={g.fx} fy={g.fy}>
        <stop offset="0" class="dense" />
        <stop offset="0.45" class="mid" />
        <stop offset="1" class="thin" />
      </radialGradient>
    {/each}
    <radialGradient id="{uid}-co2" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0" class="dense soft" />
      <stop offset="1" class="thin" />
    </radialGradient>
  </defs>

  <!-- ── Row 1: what α is. Same field, two clouds. ── -->
  <g style="opacity:{fullOpacity}">
    {#if Math.abs(e) > 0.08}
      <line class="field" x1={R1.fieldX} x2={R1.fieldX} y1={R1.y + 16 * e} y2={R1.y - 16 * e} />
      <path class="field-head" d={vHead(R1.fieldX, R1.y - 16 * e, Math.sign(e))} />
    {/if}
    {#each [R1.tight, R1.loose] as a (a.key)}
      {@const pol = a.pol * e}
      <circle class="cloud" cx={a.x} cy={R1.y} r={a.r} fill="url(#{uid}-r1{a.key})" />
      <circle class="nucleus" cx={a.x} cy={R1.y - a.nuc * e} r="3" />
      <text class="charge {signClass(pol, 'field')}" x={a.x} y={R1.y - a.r - 4} text-anchor="middle" style="opacity:{signOpacity(pol)}">{sign(pol, 'field')}</text>
      <text class="charge {signClass(pol, 'against')}" x={a.x} y={R1.y + a.r + 12} text-anchor="middle" style="opacity:{signOpacity(pol)}">{sign(pol, 'against')}</text>
      {#if Math.abs(pol) > 0.06}
        {@const L = 12 * pol}
        <line class="induced" x1={a.x + a.r + 12} x2={a.x + a.r + 12} y1={R1.y + L} y2={R1.y - L} />
        <path class="induced-head" d={vHead(a.x + a.r + 12, R1.y - L, Math.sign(L), 3.5)} />
      {/if}
    {/each}
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Same field, two clouds</text>
    <text class="sym field-lbl" x={R1.fieldX - 8} y={R1.y + 4} text-anchor="end">E</text>
    <text class="lbl faint" x={R1.tight.x} y={R1.y + 44} text-anchor="middle">tight: small α</text>
    <text class="lbl faint" x={R1.loose.x} y={R1.y + 44} text-anchor="middle">loose: large α</text>
    <text class="lbl strong" x="336" y={R1.y - 4}>α = μ<tspan class="sub" dy="4">ind</tspan><tspan dy="-4"> / E</tspan></text>
    <text class="lbl faint" x="336" y={R1.y + 14}>how far a field</text>
    <text class="lbl faint" x="336" y={R1.y + 28}>polarizes the cloud</text>
  </g>

  <!-- ── Row 2: it depends on direction. ── -->
  <g style="opacity:{fullOpacity}">
    <!-- Field along the bond: the cloud gives a lot. -->
    {#if Math.abs(e) > 0.08}
      <line class="field" x1={R2.along - 16 * e} x2={R2.along + 16 * e} y1={R2.y - 28} y2={R2.y - 28} />
      <path class="field-head" d={hHead(R2.along + 16 * e, R2.y - 28, Math.sign(e))} />
    {/if}
    <ellipse class="cloud" cx={R2.along} cy={R2.y} rx={R2.rx} ry={R2.ry} fill="url(#{uid}-r2a)" />
    {#each [-2.2, 0, 2.2] as off}
      <line class="bond" x1={R2.along - R2.bond / 2 + 2 * e} x2={R2.along + R2.bond / 2 + 2 * e} y1={R2.y + off} y2={R2.y + off} />
    {/each}
    <circle cx={R2.along - R2.bond / 2 + 2 * e} cy={R2.y} r="5.6" fill={N_FILL} />
    <circle cx={R2.along + R2.bond / 2 + 2 * e} cy={R2.y} r="5.6" fill={N_FILL} />
    <text class="charge {signClass(R2.polAlong * e, 'field')}" x={R2.along + R2.rx + 5} y={R2.y + 4} style="opacity:{signOpacity(R2.polAlong * e)}">{sign(R2.polAlong * e, 'field')}</text>
    <text class="charge {signClass(R2.polAlong * e, 'against')}" x={R2.along - R2.rx - 5} y={R2.y + 4} text-anchor="end" style="opacity:{signOpacity(R2.polAlong * e)}">{sign(R2.polAlong * e, 'against')}</text>

    <!-- Field across the bond: the cloud gives less. -->
    {#if Math.abs(e) > 0.08}
      <line class="field" x1={R2.across - R2.rx - 14} x2={R2.across - R2.rx - 14} y1={R2.y + 16 * e} y2={R2.y - 16 * e} />
      <path class="field-head" d={vHead(R2.across - R2.rx - 14, R2.y - 16 * e, Math.sign(e))} />
    {/if}
    <ellipse class="cloud" cx={R2.across} cy={R2.y} rx={R2.rx} ry={R2.ry} fill="url(#{uid}-r2c)" />
    {#each [-2.2, 0, 2.2] as off}
      <line class="bond" x1={R2.across - R2.bond / 2} x2={R2.across + R2.bond / 2} y1={R2.y + off - 0.8 * e} y2={R2.y + off - 0.8 * e} />
    {/each}
    <circle cx={R2.across - R2.bond / 2} cy={R2.y - 0.8 * e} r="5.6" fill={N_FILL} />
    <circle cx={R2.across + R2.bond / 2} cy={R2.y - 0.8 * e} r="5.6" fill={N_FILL} />
    <text class="charge {signClass(R2.polAcross * e, 'field')}" x={R2.across} y={R2.y - R2.ry - 4} text-anchor="middle" style="opacity:{signOpacity(R2.polAcross * e)}">{sign(R2.polAcross * e, 'field')}</text>
    <text class="charge {signClass(R2.polAcross * e, 'against')}" x={R2.across} y={R2.y + R2.ry + 12} text-anchor="middle" style="opacity:{signOpacity(R2.polAcross * e)}">{sign(R2.polAcross * e, 'against')}</text>
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={R2.y - 46}>Along the bond, or across it</text>
    <text class="lbl faint" x={R2.along} y={R2.y + 34} text-anchor="middle">along: gives more</text>
    <text class="lbl faint" x={R2.across} y={R2.y + 34} text-anchor="middle">across: gives less</text>
    <text class="lbl strong" x="336" y={R2.y - 4}>α∥ > α⊥</text>
    <text class="lbl faint" x="336" y={R2.y + 14}>∥ along, ⊥ across:</text>
    <text class="lbl faint" x="336" y={R2.y + 28}>an ellipsoid</text>
  </g>

  <!-- ── Row 3: as the molecule vibrates. The card's N₂ lands here. ── -->
  <path class="wave" d={wavePath} />
  <ellipse class="cloud" cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#{uid}-n2)" />
  {#each [-lerp(1.8, 2.2, t), 0, lerp(1.8, 2.2, t)] as off}
    <line class="bond" x1={cx - bond / 2} x2={cx + bond / 2} y1={cy + off + nShift} y2={cy + off + nShift} />
  {/each}
  <circle cx={cx - bond / 2} cy={cy + nShift} r={lerp(S.rN, F.rN, t)} fill={N_FILL} />
  <circle cx={cx + bond / 2} cy={cy + nShift} r={lerp(S.rN, F.rN, t)} fill={N_FILL} />
  <text class="charge {signClass(polN2, 'field')}" x={cx} y={cy - ry - 4} text-anchor="middle" style="opacity:{signOpacity(polN2)}">{sign(polN2, 'field')}</text>
  <text class="charge {signClass(polN2, 'against')}" x={cx} y={cy + ry + 12} text-anchor="middle" style="opacity:{signOpacity(polN2)}">{sign(polN2, 'against')}</text>
  {#if Math.abs(e) > 0.08}
    {@const L = lerp(14, 15, t) * e}
    {@const x = cx - rx - lerp(12, 14, t)}
    <line class="field" x1={x} x2={x} y1={cy + L} y2={cy - L} />
    <path class="field-head" d={vHead(x, cy - L, Math.sign(L))} />
  {/if}
  {#if Math.abs(polN2) > 0.06}
    {@const L = 15 * polN2}
    <line class="induced" x1={arrowX} x2={arrowX} y1={cy + L} y2={cy - L} />
    <path class="induced-head" d={vHead(arrowX, cy - L, Math.sign(L))} />
  {/if}
  <text class="sym field-lbl" x={cx - rx - lerp(20, 22, t)} y={cy + 4} text-anchor="end">E</text>
  <text class="sym" x={arrowX + 7} y={cy + 4}>μ<tspan class="sub" dy="4">ind</tspan></text>

  <g style="opacity:{fullOpacity}">
    <line class="axis-line" x1={PX0} x2={PX1} y1={F.my} y2={F.my} />
    <line class="axis-line" x1={qToX(0)} x2={qToX(0)} y1={F.my - 16} y2={F.my + 16} />
    <line class="a-line" x1={PX0} x2={PX1} y1={F.my + 12} y2={F.my - 12} />
    <circle class="cursor" cx={qToX(q)} cy={F.my - 12 * q} r="2.6" />

    <ellipse class="cloud" cx={CO2.x} cy={CO2.y} rx={40 * alphaCO2} ry={15 * alphaCO2} fill="url(#{uid}-co2)" />
    <line class="bond thick" x1={CO2.x - CO2.bond + aCO2} x2={CO2.x - C_RATIO * aCO2} y1={CO2.y} y2={CO2.y} />
    <line class="bond thick" x1={CO2.x - C_RATIO * aCO2} x2={CO2.x + CO2.bond + aCO2} y1={CO2.y} y2={CO2.y} />
    <circle cx={CO2.x - CO2.bond + aCO2} cy={CO2.y} r="5.6" fill={O_FILL} />
    <circle cx={CO2.x + CO2.bond + aCO2} cy={CO2.y} r="5.6" fill={O_FILL} />
    <circle cx={CO2.x - C_RATIO * aCO2} cy={CO2.y} r="5.9" fill={C_FILL} />

    <line class="axis-line" x1={PX0} x2={PX1} y1={CO2.y + 10} y2={CO2.y + 10} />
    <line class="axis-line" x1={qToX(0)} x2={qToX(0)} y1={CO2.y - 14} y2={CO2.y + 16} />
    <path class="a-line flat" d={parabola} />
    <circle class="cursor flat" cx={qToX(aCO2 / 2)} cy={CO2.y + 10 - 20 * (aCO2 / 2) ** 2} r="2.6" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={F.my - 46}>As the molecule vibrates</text>
    <text class="sym" x={PX0 - 4} y={F.my - 10} text-anchor="end">Δα</text>
    <text class="sym" x={PX1 + 4} y={F.my + 4}>Q</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={F.my + 30} text-anchor="middle">N₂ stretch: slope ≠ 0</text>
    <text class="verdict yes" x="378" y={F.my + 4}>Raman ✓</text>

    <text class="sym" x={PX0 - 4} y={CO2.y - 8} text-anchor="end">Δα</text>
    <text class="sym" x={PX1 + 4} y={CO2.y + 14}>Q</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={CO2.y + 32} text-anchor="middle">CO₂ asym.: slope = 0 at rest</text>
    <text class="lbl faint" x="14" y={CO2.y + 32}>+Q and −Q: mirror images</text>
    <text class="verdict" x="378" y={CO2.y + 14}>Raman ✗</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  .wave {
    fill: none;
    stroke: var(--diagram-laser);
    stroke-width: 1.2;
    stroke-opacity: 0.35;
  }

  /* The electron density: dense where the electrons gather, thin elsewhere. */
  .dense { stop-color: var(--diagram-laser); stop-opacity: 0.85; }
  .dense.soft { stop-opacity: 0.35; }
  .mid { stop-color: var(--diagram-laser); stop-opacity: 0.3; }
  .thin { stop-color: var(--diagram-laser); stop-opacity: 0.02; }

  .cloud {
    stroke: var(--diagram-laser);
    stroke-opacity: 0.45;
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }
  .nucleus { fill: var(--ink-slate-500); }
  .bond { stroke: var(--ink-slate-400); stroke-width: 1.1; }
  .bond.thick { stroke-width: 2.2; }

  .field, .field-head { stroke: var(--diagram-laser); stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .induced, .induced-head { stroke: var(--brand-700); stroke-width: 1.6; fill: none; stroke-linecap: round; stroke-linejoin: round; }

  /* The Dipole card's δ labels: same face and weight, red negative, blue positive. */
  .charge {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
  }
  .charge.neg { fill: var(--charge-negative); }
  .charge.pos { fill: var(--charge-positive); }

  .axis-line { fill: none; stroke: var(--line-slate-strong); stroke-width: 1; }
  .a-line { fill: none; stroke: var(--diagram-laser); stroke-width: 1.6; }
  .a-line.flat { stroke: var(--ink-025); }
  .cursor { fill: var(--diagram-laser); }
  .cursor.flat { fill: var(--ink-050); }

  .lbl {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    fill: var(--ink-slate-500);
  }
  .lbl.faint { fill: var(--ink-050); }
  .lbl.name { fill: var(--ink-slate-900); }
  .lbl.strong { fill: var(--ink-slate-900); font-weight: var(--t-label-weight); }

  .sym {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-style: italic;
    fill: var(--ink-slate-500);
  }
  .sym.field-lbl { fill: var(--diagram-laser); }
  .sub { font-size: 0.75em; font-style: normal; }

  .verdict {
    font-family: var(--font-sans);
    font-size: var(--t-code-size);
    font-weight: var(--t-label-weight);
    fill: var(--ink-025);
  }
  .verdict.yes { fill: var(--diagram-laser); }
</style>

<script lang="ts">
  /**
   * Polarizability: how easily a field pulls an electron cloud off-centre,
   * and whether a vibration changes that. The Induced dipole card shows the
   * pulling itself; the Raman card what a changing α does to light.
   *
   * Clouds are drawn as a density, as on the Induced dipole card: denser on
   * the side the electrons are pushed to, δ− there and δ+ opposite.
   *
   *   t = 0  the card: a tight cloud and a loose one in the same slowly
   *          swinging field. The loose one polarizes more, and its induced
   *          dipole is larger: that difference is α.
   *   t = 1  the opened card, three rows, one field for all:
   *            same field, two clouds: the card's pair, grown;
   *            along the bond or across it: N₂'s cloud gives more along the
   *              bond (the ellipsoid);
   *            as the molecule vibrates, in a field along the bond: N₂'s cloud
   *              breathes with the bond and polarizes more when it is long,
   *              Δα(Q) has a slope (Raman ✓); CO₂'s asymmetric stretch sits at
   *              the bottom of a bowl, because +Q and −Q are mirror images
   *              (Raman ✗).
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

  const S = { W: 220, H: 100, px: 238 / 220 };
  const F = { W: 480, H: 640 };

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

  // Two clocks: the light's field swings four times per vibration (in life
  // about eight for N₂ in visible light), so the cloud plainly follows the
  // field, and the vibration only sets how far each swing goes.
  const NU_L = 1;
  const NU_V = 0.25;
  $: time = running ? clock / 1000 : 0;
  // At rest the field points up at full strength.
  $: e = Math.cos(2 * Math.PI * NU_L * time); // positive: pointing up (or right)

  /** Densest point of a cloud, as a fraction of its box: against the field. */
  const focus = (pol: number) => 0.5 + 0.44 * Math.max(-1, Math.min(1, pol));
  const sign = (pol: number, side: 'field' | 'against') =>
    (pol > 0) === (side === 'field') ? 'δ+' : 'δ−';
  const signCls = (pol: number, side: 'field' | 'against') =>
    sign(pol, side) === 'δ+' ? 'pos' : 'neg';
  const signOpacity = (pol: number) => Math.min(1, Math.abs(pol) * 1.6);

  const vHead = (x: number, y: number, dir: number, sz = 4) =>
    `M${x - sz * 0.75},${y + dir * sz} L${x},${y} L${x + sz * 0.75},${y + dir * sz}`;
  const hHead = (x: number, y: number, dir: number, sz = 4) =>
    `M${x - dir * sz},${y - sz * 0.75} L${x},${y} L${x - dir * sz},${y + sz * 0.75}`;

  /* ── Row 1 (and the card): same field, two clouds ── */
  // Card positions morph into the opened ones.
  $: r1y = lerp(54, 60, t);
  $: fieldX = lerp(26, 36, t);
  $: clouds = [
    { key: 't', x: lerp(88, 116, t), r: 12, pol: 0.3, nuc: 0.8 },
    { key: 'l', x: lerp(160, 226, t), r: 22, pol: 1, nuc: 2.4 },
  ];

  /* ── Row 2: along the bond, across it ── */
  const R2 = { y: 184, along: 110, across: 250, bond: 24, rx: 32, ry: 14, polAlong: 1, polAcross: 0.4 };

  /* ── Row 3: as the molecule vibrates ── */
  const N2 = { x: 100, y: 296, bond: 26, rx: 36, ry: 16 };
  const CO2 = { x: 100, y: 372, bond: 22 };
  const C_RATIO = (2 * 16) / 12;
  $: q = Math.sin(2 * Math.PI * NU_V * time); // the stretch, −1 … 1
  $: n2Bond = N2.bond * (1 + 0.14 * q);
  // N₂: the cloud grows with the bond, so α follows Q, and the same field
  // polarizes it more when the bond is long.
  $: n2Alpha = 1 + 0.4 * q;
  $: n2Pol = 0.75 * n2Alpha * e;
  $: aCO2 = 2 * Math.sin(2 * Math.PI * NU_V * time);
  // CO₂: α changes with Q² only, the same either way, so its polarization
  // hardly changes over the swing.
  $: alphaCO2 = 1 + 0.1 * (aCO2 / 2) ** 2;
  $: co2Pol = 0.75 * alphaCO2 * e;

  /* ── Δα(Q) lines ── */
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

  /* ── Row 4: both molecules frozen at +Q and −Q ── */
  // N₂: long bond, big loose cloud; short bond, small tight one. Two
  // different shapes, so two different α.
  const R4N = { y: 494, a: 112, b: 252 };
  // Frozen in a field pointing right, so α shows as it does everywhere else:
  // how far the density shifts and how long μ(ind) is.
  const n2Snaps = [
    // Long: electrons spread out and loosely held, so the field shifts them a
    // lot. Short: compact and tightly held, so they move only a little.
    { key: 'n2long', x: R4N.a, bond: 34, rx: 33, ry: 17, pol: 1, label: '+Q: long' },
    { key: 'n2short', x: R4N.b, bond: 20, rx: 21, ry: 10, pol: 0.3, label: '−Q: short' },
  ];
  const CO2_FROZEN_POL = 0.7;
  // CO₂: the mirror between them.
  // Oxygens fixed, carbon shifted: one C=O short, the other long. Each bond
  // gets its own lobe of cloud, looser (bigger) the longer the bond.
  const R4 = { y: 584, a: 112, b: 252, half: 28, shift: 7 };
  const lobes = (cx: number, dir: 1 | -1) => {
    const c = cx - dir * R4.shift; // +Q: carbon to the left
    const oL = cx - R4.half;
    const oR = cx + R4.half;
    return {
      c,
      oL,
      oR,
      parts: [
        { x: (oL + c) / 2, len: c - oL },
        { x: (c + oR) / 2, len: oR - c },
      ].map(b => ({ x: b.x, rx: b.len / 2 + 8, ry: 7 + (b.len - 21) * 0.55 })),
    };
  };
  const snapA = lobes(R4.a, 1);
  const snapB = lobes(R4.b, -1);

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
  aria-label="Polarizability: in the same field a loose electron cloud polarizes more than a tight one, and N₂'s cloud more along its bond than across it; N₂'s cloud changes as it stretches, CO₂'s asymmetric stretch the same way on both sides"
>
  <defs>
    {#each [
      { id: 'r1t', fx: 0.5, fy: focus(0.3 * e) },
      { id: 'r1l', fx: 0.5, fy: focus(e) },
      { id: 'r2a', fx: focus(-R2.polAlong * e), fy: 0.5 },
      { id: 'r2c', fx: 0.5, fy: focus(R2.polAcross * e) },
      { id: 'n2long', fx: focus(-1), fy: 0.5, kind: 'spread' },
      { id: 'n2short', fx: focus(-0.3), fy: 0.5, kind: 'compact' },
      { id: 'co2f', fx: focus(-CO2_FROZEN_POL), fy: 0.5 },
      { id: 'n2v', fx: focus(-n2Pol), fy: 0.5 },
      { id: 'co2v', fx: focus(-co2Pol), fy: 0.5 },
    ] as g (g.id)}
      <radialGradient id="{uid}-{g.id}" cx="0.5" cy="0.5" r="0.62" fx={g.fx} fy={g.fy}>
        <stop offset="0" class="dense {g.kind ?? ''}" />
        <stop offset="0.45" class="mid {g.kind ?? ''}" />
        <stop offset="1" class="thin" />
      </radialGradient>
    {/each}
  </defs>

  <!-- ── Row 1 (and the card): what α is. Same field, two clouds. ── -->
  {#if Math.abs(e) > 0.08}
    <line class="field" x1={fieldX} x2={fieldX} y1={r1y + 16 * e} y2={r1y - 16 * e} />
    <path class="field-head" d={vHead(fieldX, r1y - 16 * e, Math.sign(e))} />
  {/if}
  <text class="sym field-lbl" x={fieldX - 8} y={r1y + 4} text-anchor="end">E</text>
  {#each clouds as a (a.key)}
    {@const pol = a.pol * e}
    <circle class="cloud" cx={a.x} cy={r1y} r={a.r} fill="url(#{uid}-r1{a.key})" />
    <circle class="nucleus" cx={a.x} cy={r1y - a.nuc * e} r="3" />
    <text class="charge {signCls(pol, 'field')}" x={a.x} y={r1y - a.r - 4} text-anchor="middle" style="opacity:{signOpacity(pol)}">{sign(pol, 'field')}</text>
    <text class="charge {signCls(pol, 'against')}" x={a.x} y={r1y + a.r + 12} text-anchor="middle" style="opacity:{signOpacity(pol)}">{sign(pol, 'against')}</text>
    {#if Math.abs(pol) > 0.06}
      {@const L = 12 * pol}
      <line class="induced" x1={a.x + a.r + 12} x2={a.x + a.r + 12} y1={r1y + L} y2={r1y - L} />
      <path class="induced-head" d={vHead(a.x + a.r + 12, r1y - L, Math.sign(L), 3.5)} />
    {/if}
  {/each}
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y="16">Same Field, Two Clouds</text>
    <text class="lbl faint" x={clouds[0].x} y={r1y + 44} text-anchor="middle">tight: small α</text>
    <text class="lbl faint" x={clouds[1].x} y={r1y + 44} text-anchor="middle">loose: large α</text>
    <text class="lbl strong" x="336" y={r1y - 4}>α = μ<tspan class="sub" dy="4">ind</tspan><tspan dy="-4"> / E</tspan></text>
    <text class="lbl faint" x="336" y={r1y + 14}>how far a field</text>
    <text class="lbl faint" x="336" y={r1y + 28}>polarizes the cloud</text>
  </g>

  <!-- ── Row 2 (opened): it depends on direction. ── -->
  <g style="opacity:{fullOpacity}">
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
    <text class="charge {signCls(R2.polAlong * e, 'field')}" x={R2.along + R2.rx + 5} y={R2.y + 4} style="opacity:{signOpacity(R2.polAlong * e)}">{sign(R2.polAlong * e, 'field')}</text>
    <text class="charge {signCls(R2.polAlong * e, 'against')}" x={R2.along - R2.rx - 5} y={R2.y + 4} text-anchor="end" style="opacity:{signOpacity(R2.polAlong * e)}">{sign(R2.polAlong * e, 'against')}</text>

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
    <text class="charge {signCls(R2.polAcross * e, 'field')}" x={R2.across} y={R2.y - R2.ry - 4} text-anchor="middle" style="opacity:{signOpacity(R2.polAcross * e)}">{sign(R2.polAcross * e, 'field')}</text>
    <text class="charge {signCls(R2.polAcross * e, 'against')}" x={R2.across} y={R2.y + R2.ry + 12} text-anchor="middle" style="opacity:{signOpacity(R2.polAcross * e)}">{sign(R2.polAcross * e, 'against')}</text>
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={R2.y - 46}>Along the Bond, or Across It</text>
    <text class="lbl faint" x={R2.along} y={R2.y + 34} text-anchor="middle">along: gives more</text>
    <text class="lbl faint" x={R2.across} y={R2.y + 34} text-anchor="middle">across: gives less</text>
    <text class="lbl strong" x="336" y={R2.y - 4}>α∥ > α⊥</text>
    <text class="lbl faint" x="336" y={R2.y + 14}>∥ along, ⊥ across:</text>
    <text class="lbl faint" x="336" y={R2.y + 28}>an ellipsoid</text>
  </g>

  <!-- ── Row 3 (opened): as the molecule vibrates, in a field along the bond,
       so the induced shift runs along the molecule like the motion. α is
       seen through what the field does: how far it shifts the density, and
       how long the induced dipole grows. ── -->
  <g style="opacity:{fullOpacity}">
    {#each [{ x: N2.x, y: N2.y }, { x: CO2.x, y: CO2.y }] as m}
      {#if Math.abs(e) > 0.08}
        <line class="field" x1={m.x - 16 * e} x2={m.x + 16 * e} y1={m.y - 28} y2={m.y - 28} />
        <path class="field-head" d={hHead(m.x + 16 * e, m.y - 28, Math.sign(e))} />
      {/if}
    {/each}
    <ellipse class="cloud" cx={N2.x} cy={N2.y} rx={N2.rx * (1 + 0.3 * (n2Alpha - 1))} ry={N2.ry * (1 + 0.3 * (n2Alpha - 1))} fill="url(#{uid}-n2v)" />
    {#each [-2.2, 0, 2.2] as off}
      <line class="bond" x1={N2.x - n2Bond / 2} x2={N2.x + n2Bond / 2} y1={N2.y + off} y2={N2.y + off} />
    {/each}
    <circle cx={N2.x - n2Bond / 2} cy={N2.y} r="6" fill={N_FILL} />
    <circle cx={N2.x + n2Bond / 2} cy={N2.y} r="6" fill={N_FILL} />
    {#if Math.abs(n2Pol) > 0.06}
      <line class="induced" x1={N2.x - 14 * n2Pol} x2={N2.x + 14 * n2Pol} y1={N2.y + 27} y2={N2.y + 27} />
      <path class="induced-head" d={hHead(N2.x + 14 * n2Pol, N2.y + 27, Math.sign(n2Pol), 3.5)} />
    {/if}

    <line class="axis-line" x1={PX0} x2={PX1} y1={N2.y} y2={N2.y} />
    <line class="axis-line" x1={qToX(0)} x2={qToX(0)} y1={N2.y - 16} y2={N2.y + 16} />
    <line class="a-line" x1={PX0} x2={PX1} y1={N2.y + 12} y2={N2.y - 12} />
    <circle class="cursor" cx={qToX(q)} cy={N2.y - 12 * q} r="2.6" />

    <ellipse class="cloud" cx={CO2.x} cy={CO2.y} rx={40 * alphaCO2} ry={15 * alphaCO2} fill="url(#{uid}-co2v)" />
    <line class="bond thick" x1={CO2.x - CO2.bond + aCO2} x2={CO2.x - C_RATIO * aCO2} y1={CO2.y} y2={CO2.y} />
    <line class="bond thick" x1={CO2.x - C_RATIO * aCO2} x2={CO2.x + CO2.bond + aCO2} y1={CO2.y} y2={CO2.y} />
    <circle cx={CO2.x - CO2.bond + aCO2} cy={CO2.y} r="5.6" fill={O_FILL} />
    <circle cx={CO2.x + CO2.bond + aCO2} cy={CO2.y} r="5.6" fill={O_FILL} />
    <circle cx={CO2.x - C_RATIO * aCO2} cy={CO2.y} r="5.9" fill={C_FILL} />
    {#if Math.abs(co2Pol) > 0.06}
      <line class="induced" x1={CO2.x - 14 * co2Pol} x2={CO2.x + 14 * co2Pol} y1={CO2.y + 27} y2={CO2.y + 27} />
      <path class="induced-head" d={hHead(CO2.x + 14 * co2Pol, CO2.y + 27, Math.sign(co2Pol), 3.5)} />
    {/if}

    <line class="axis-line" x1={PX0} x2={PX1} y1={CO2.y + 10} y2={CO2.y + 10} />
    <line class="axis-line" x1={qToX(0)} x2={qToX(0)} y1={CO2.y - 14} y2={CO2.y + 16} />
    <path class="a-line flat" d={parabola} />
    <circle class="cursor flat" cx={qToX(aCO2 / 2)} cy={CO2.y + 10 - 20 * (aCO2 / 2) ** 2} r="2.6" />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={N2.y - 42}>As the Molecule Vibrates</text>
    <text class="lbl faint" x="206" y={N2.y - 42}>E fast (light), Q slow (vibration)</text>
    <text class="sym field-lbl" x={N2.x - 24} y={N2.y - 24} text-anchor="end">E</text>
    <text class="sym field-lbl" x={CO2.x - 24} y={CO2.y - 24} text-anchor="end">E</text>
    <text class="charge {signCls(n2Pol, 'field')}" x={N2.x + 52} y={N2.y + 4} style="opacity:{signOpacity(n2Pol)}">{sign(n2Pol, 'field')}</text>
    <text class="charge {signCls(n2Pol, 'against')}" x={N2.x - 52} y={N2.y + 4} text-anchor="end" style="opacity:{signOpacity(n2Pol)}">{sign(n2Pol, 'against')}</text>
    <text class="charge {signCls(co2Pol, 'field')}" x={CO2.x + 50} y={CO2.y + 4} style="opacity:{signOpacity(co2Pol)}">{sign(co2Pol, 'field')}</text>
    <text class="charge {signCls(co2Pol, 'against')}" x={CO2.x - 50} y={CO2.y + 4} text-anchor="end" style="opacity:{signOpacity(co2Pol)}">{sign(co2Pol, 'against')}</text>
    <text class="sym" x={PX0 - 4} y={N2.y - 10} text-anchor="end">Δα</text>
    <text class="sym" x={PX1 + 4} y={N2.y + 4}>Q</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={N2.y + 30} text-anchor="middle">N₂ stretch: slope ≠ 0</text>
    <text class="verdict yes" x="378" y={N2.y + 4}>Raman ✓</text>

    <text class="sym" x={PX0 - 4} y={CO2.y - 8} text-anchor="end">Δα</text>
    <text class="sym" x={PX1 + 4} y={CO2.y + 14}>Q</text>
    <text class="lbl faint" x={(PX0 + PX1) / 2} y={CO2.y + 32} text-anchor="middle">CO₂ asym.: slope = 0 at rest</text>
    <text class="lbl faint" x="14" y={CO2.y + 48}>+Q and −Q: mirror images</text>
    <text class="verdict" x="378" y={CO2.y + 14}>Raman ✗</text>
  </g>
  <!-- ── Row 4 (opened): frozen at the two extremes ── -->
  <g style="opacity:{fullOpacity}">
    <!-- N₂: two different shapes. -->
    {#each [R4N.y, R4.y] as fy}
      <line class="field" x1="22" x2="50" y1={fy - 26} y2={fy - 26} />
      <path class="field-head" d={hHead(50, fy - 26, 1)} />
    {/each}
    {#each n2Snaps as n (n.key)}
      <ellipse class="cloud" cx={n.x} cy={R4N.y} rx={n.rx} ry={n.ry} fill="url(#{uid}-{n.key})" />
      <line class="induced" x1={n.x - 14 * n.pol} x2={n.x + 14 * n.pol} y1={R4N.y + n.ry + 8} y2={R4N.y + n.ry + 8} />
      <path class="induced-head" d={hHead(n.x + 14 * n.pol, R4N.y + n.ry + 8, 1, 3.5)} />
      {#each [-2.2, 0, 2.2] as off}
        <line class="bond" x1={n.x - n.bond / 2} x2={n.x + n.bond / 2} y1={R4N.y + off} y2={R4N.y + off} />
      {/each}
      <circle cx={n.x - n.bond / 2} cy={R4N.y} r="5.6" fill={N_FILL} />
      <circle cx={n.x + n.bond / 2} cy={R4N.y} r="5.6" fill={N_FILL} />
    {/each}

    <!-- CO₂: the same shape, flipped. -->
    {#each [snapA, snapB] as snap}
      {#each snap.parts as lobe}
        <ellipse class="cloud" cx={lobe.x} cy={R4.y} rx={lobe.rx} ry={lobe.ry} fill="url(#{uid}-co2f)" />
      {/each}
      <line class="induced" x1={(snap.oL + snap.oR) / 2 - 14 * CO2_FROZEN_POL} x2={(snap.oL + snap.oR) / 2 + 14 * CO2_FROZEN_POL} y1={R4.y + 20} y2={R4.y + 20} />
      <path class="induced-head" d={hHead((snap.oL + snap.oR) / 2 + 14 * CO2_FROZEN_POL, R4.y + 20, 1, 3.5)} />
      <line class="bond thick" x1={snap.oL} x2={snap.oR} y1={R4.y} y2={R4.y} />
      <circle cx={snap.oL} cy={R4.y} r="5.6" fill={O_FILL} />
      <circle cx={snap.oR} cy={R4.y} r="5.6" fill={O_FILL} />
      <circle cx={snap.c} cy={R4.y} r="5.9" fill={C_FILL} />
    {/each}
    <line class="mirror" x1={(R4.a + R4.b) / 2} x2={(R4.a + R4.b) / 2} y1={R4.y - 24} y2={R4.y + 22} />
  </g>
  <g style="opacity:{labelOpacity}">
    <text class="lbl name" x="14" y={R4N.y - 44}>Frozen at the Two Extremes, in a Field</text>
    <text class="sym field-lbl" x="56" y={R4N.y - 22}>E</text>
    <text class="sym field-lbl" x="56" y={R4.y - 22}>E</text>

    {#each n2Snaps as n (n.key)}
      <text class="charge neg" x={n.x - n.rx - 4} y={R4N.y + 4} text-anchor="end" style="opacity:{signOpacity(n.pol)}">δ−</text>
      <text class="charge pos" x={n.x + n.rx + 4} y={R4N.y + 4} style="opacity:{signOpacity(n.pol)}">δ+</text>
    {/each}
    <text class="lbl" x={R4N.a} y={R4N.y + 40} text-anchor="middle">{n2Snaps[0].label}</text>
    <text class="lbl" x={R4N.b} y={R4N.y + 40} text-anchor="middle">{n2Snaps[1].label}</text>
    <text class="lbl strong" x={(R4N.a + R4N.b) / 2 + 6} y={R4N.y + 5} text-anchor="middle">≠</text>
    <text class="lbl strong" x="330" y={R4N.y - 4}>N₂: two shapes,</text>
    <text class="lbl strong" x="330" y={R4N.y + 12}>two α: Raman ✓</text>

    <text class="lbl" x={R4.a} y={R4.y + 40} text-anchor="middle">+Q</text>
    <text class="lbl" x={R4.b} y={R4.y + 40} text-anchor="middle">−Q</text>
    <text class="lbl faint" x={(R4.a + R4.b) / 2} y={R4.y + 40} text-anchor="middle">mirror</text>
    <text class="lbl strong" x="330" y={R4.y - 4}>CO₂: mirror images,</text>
    <text class="lbl strong" x="330" y={R4.y + 12}>one α: Raman ✗</text>
    <text class="lbl faint" x="330" y={R4.y + 30}>big lobe: long bond</text>
  </g>
</svg>

<style>
  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
  }

  /* The electron density, as on the Induced dipole card. */
  .dense { stop-color: var(--diagram-laser); stop-opacity: 0.85; }
  .mid { stop-color: var(--diagram-laser); stop-opacity: 0.3; }
  /* N₂ frozen long: electrons spread thin; frozen short: packed tight. */
  .dense.spread { stop-opacity: 0.6; }
  .mid.spread { stop-opacity: 0.16; }
  .dense.compact { stop-opacity: 0.95; }
  .mid.compact { stop-opacity: 0.6; }
  .thin { stop-color: var(--diagram-laser); stop-opacity: 0.02; }

  .cloud {
    stroke: var(--diagram-laser);
    stroke-opacity: 0.45;
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }
  .nucleus { fill: var(--ink-slate-500); }
  .mirror { stroke: var(--ink-slate-400); stroke-width: 1; stroke-dasharray: 4 3; }
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

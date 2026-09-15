<script lang="ts">
  /**
   * Every isotopologue pair in the atlas, with the harmonic prediction beside
   * the recorded position.
   *
   * The point of the table is the last column. Mass alone gets a localised
   * stretch to within a percent or so, and the rows where it does not are not
   * bad data: they are the rows where the mode is not one bond, or where the
   * labelled atom is not even in the bond that moved. Ordered by how far off
   * the estimate was, so the table reads as an answer to "how well does this
   * work" from the top down.
   *
   * The arithmetic is lib/isotopeShift.ts; this only draws it.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Band } from '../../lib/types';
  import { isotopeShiftRows, shiftSummary } from '../../lib/isotopeShift';
  import { branchSuffix } from '../../lib/labels';
  import { htmlToUnicode } from '../../lib/notation';

  export let bands: Band[] = [];

  const dispatch = createEventDispatcher<{ band: { id: string } }>();

  $: rows = isotopeShiftRows(bands);
  $: summary = shiftSummary(rows);

  const name = (b: Band) => htmlToUnicode(b.short || b.id) + branchSuffix(b);
  const wn = (x: number | null) => (x === null ? '–' : Math.round(x).toLocaleString('en-US'));
  const signed = (x: number | null) =>
    x === null ? '–' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.round(Math.abs(x))}`;
  const pct = (x: number | null) => (x === null ? '–' : `${Math.abs(x).toFixed(1)}%`);
</script>

<section class="iso">
  <h4>Mass Against Measurement</h4>
  <p class="lede">
    Every labelled band in the atlas, with the harmonic estimate beside the
    position actually recorded. The estimate takes the parent band's centre and
    multiplies by √(μ/μ′) for the bond named in the middle column, so it knows
    nothing but the two masses.
  </p>

  {#if summary.applicable}
    <p class="score">
      Over the {summary.applicable} localised stretches it applies to, it is
      out by a median of <strong>{summary.medianPct?.toFixed(1)}%</strong>
      ({summary.within1} within 1%, {summary.within3} within 3%, worst
      {summary.worstPct?.toFixed(1)}%). The other {summary.total - summary.applicable}
      rows are kept below the rule, with the reason the estimate does not
      describe them.
    </p>
  {/if}

  <div class="scroller">
    <table>
      <thead>
        <tr>
          <th class="l">Band</th>
          <th class="l">Bond</th>
          <th class="n"><span class="asis">√(μ/μ′)</span></th>
          <th class="n">Parent</th>
          <th class="n">Estimate</th>
          <th class="n">Recorded</th>
          <th class="n">Off by</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r, i (r.child.id)}
          {#if i > 0 && !rows[i - 1].caveat && r.caveat}
            <tr class="cut"><td colspan="7">where one bond is not the mode</td></tr>
          {/if}
          <tr class:aside={!!r.caveat}>
            <td class="l">
              <button class="band" on:click={() => dispatch('band', { id: r.child.id })}>
                {name(r.child)}
              </button>
              <span class="iso-chip">{r.isotope}</span>
              <div class="from">from {name(r.parent)}</div>
              {#if r.caveat}<div class="why">{r.caveat}</div>{/if}
            </td>
            <td class="l mono">{r.bond ?? '–'}</td>
            <td class="n mono">{r.ratio === null ? '–' : r.ratio.toFixed(4)}</td>
            <td class="n mono">{wn(r.parentWn)}</td>
            <td class="n mono">{wn(r.predicted)}</td>
            <td class="n mono strong">{wn(r.childWn)}</td>
            <td class="n mono"
                class:near={r.residualPct !== null && Math.abs(r.residualPct) <= 1}
                class:far={r.residualPct !== null && Math.abs(r.residualPct) > 3}>
              {signed(r.residual)}<span class="pct">{pct(r.residualPct)}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="foot">
    Positions are band centres, so a wide window is a blunt number: the residual
    is worth reading as a size, not a measurement. Wavenumbers in cm⁻¹.
  </p>
</section>

<style>
  .iso { margin: 0; }

  h4 {
    margin: 0 0 6px;
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--t-micro-label-color);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
  }

  .lede, .score, .foot {
    margin: 0 0 8px;
    font-size: var(--t-body-size);
    line-height: var(--t-body-lh);
    color: var(--t-body-color);
  }
  .score strong { color: var(--ink-slate-900); }
  .foot {
    margin: 8px 0 0;
    font-size: var(--t-diagram-note-size);
    color: var(--ink-300);
  }

  /* The table is wider than a phone and narrower than the card on a desk, so
     it scrolls in its own box rather than stretching the card. */
  .scroller {
    overflow-x: auto;
    border: 1px solid var(--line-panel);
    border-radius: var(--radius-md);
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  th {
    position: sticky;
    top: 0;
    padding: 7px 10px;
    background: var(--surface-sunken);
    border-bottom: 1px solid var(--line-panel);
    font-size: var(--t-diagram-note-size);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-slate-400);
    white-space: nowrap;
  }

  td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--line-faint);
    vertical-align: top;
    color: var(--ink-600);
  }
  tbody tr:last-child td { border-bottom: none; }

  /* The header row is uppercased, and uppercasing μ gives Μ, which reads as
     a capital M. Symbols opt out. */
  .asis { text-transform: none; letter-spacing: 0; }

  .l { text-align: left; }
  .n { text-align: right; white-space: nowrap; }
  .mono { font-family: var(--t-code-ff); }
  .strong { color: var(--ink-slate-900); font-weight: 600; }

  .band {
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    font-weight: 600;
    color: var(--brand-700);
    cursor: pointer;
    text-align: left;
  }
  .band:hover { text-decoration: underline; }

  .iso-chip {
    margin-left: 5px;
    padding: 0 4px;
    border: 1px solid var(--isotope-border, var(--line-strong));
    border-radius: var(--radius-sm);
    font-family: var(--t-code-ff);
    font-size: var(--t-diagram-note-size);
    color: var(--ink-500);
  }

  .from, .why {
    margin-top: 2px;
    font-size: var(--t-diagram-note-size);
    color: var(--ink-300);
  }
  .why { font-style: italic; }

  /* Close enough that mass explains it; far enough that something else does. */
  .near { color: var(--accent-green-fg); }
  .far { color: var(--accent-red-fg); }
  .pct {
    display: inline-block;
    min-width: 44px;
    margin-left: 6px;
    color: var(--ink-300);
    font-size: var(--t-diagram-note-size);
  }

  /* One rule where the table stops being a test of the estimate and starts
     being a list of the places it does not apply. */
  .cut td {
    padding: 5px 10px;
    background: var(--surface-sunken);
    border-top: 1px solid var(--line-panel);
    font-size: var(--t-diagram-note-size);
    font-style: italic;
    color: var(--ink-300);
  }
  .aside td { background: color-mix(in srgb, var(--surface-sunken) 55%, transparent); }
</style>

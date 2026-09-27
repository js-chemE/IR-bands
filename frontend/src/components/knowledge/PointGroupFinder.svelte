<script lang="ts">
  /**
   * The Point Group Notation card's way into the atlas: the decision chart
   * beside every binding geometry the atlas draws, grouped by the point
   * group the data gives it. Hovering a molecule, or a group, lights the
   * path the chart takes to it; a row opens that molecule on the Vibration
   * Modes view, as the Normal Modes card's census does.
   *
   * Everything in the list is read from vibrations.json, so a molecule added
   * there, or a point group corrected, shows here without an edit. The
   * chart itself is lib/pointGroups.ts.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Vibrations } from '../../lib/types';
  import {
    CHART,
    OUTCOME_LABEL,
    POINT_GROUPS,
    pathTo,
    pointGroupFor,
    type OutcomeId,
    type PointGroup,
  } from '../../lib/pointGroups';
  import Subbed from './Subbed.svelte';
  import SvgSubbed from './SvgSubbed.svelte';

  export let vibrations: Vibrations;

  const dispatch = createEventDispatcher<{
    mode: { moleculeId: string; topologyId: string; modeId: string };
  }>();

  /* ── The list, from the data ── */
  interface Row {
    moleculeId: string;
    topologyId: string;
    label: string;
    where: string;
  }
  const whereLabel = (id: string, long: string) => (id === 'gas' ? 'free molecule' : long);

  $: groups = POINT_GROUPS.map(g => ({
    g,
    rows: vibrations.molecules.flatMap(m =>
      m.topologies
        .filter(tp => pointGroupFor(tp.point_group)?.key === g.key)
        .map(tp => ({ moleculeId: m.id, topologyId: tp.id, label: m.label, where: whereLabel(tp.id, tp.long) }) as Row),
    ),
  })).filter(x => x.rows.length);

  // A geometry the data gives no single point group, said as much.
  $: unassigned = vibrations.molecules.flatMap(m =>
    m.topologies.filter(tp => !tp.point_group).map(tp => `${m.label}, ${tp.long}`),
  );
  // A point group the data uses that this module has no entry for: a gap to
  // fill in lib/pointGroups.ts, shown rather than silently dropped.
  $: unknown = [
    ...new Set(
      vibrations.molecules.flatMap(m =>
        m.topologies.filter(tp => tp.point_group && !pointGroupFor(tp.point_group)).map(tp => tp.point_group!.replace(/<[^>]+>/g, '')),
      ),
    ),
  ];

  let hovered: string | null = null;
  $: active = POINT_GROUPS.find(g => g.key === (hovered ?? 'C2v')) as PointGroup;

  /* ── The chart ── */
  const ROW = 84;
  const TOP = 8;
  const SPINE = { x: 0, w: 150, h: 34 };
  const NODE = { x0: 190, dx: 120, w: 96, h: 34 };
  const OUT = { w: 70, h: 22, drop: 50 };
  const W = NODE.x0 + 3 * NODE.dx + OUT.w + 4;
  const H = TOP + (CHART.length - 1) * ROW + OUT.drop + OUT.h + 4;

  const rowY = (r: number) => TOP + r * ROW;
  const nodeX = (i: number) => NODE.x0 + i * NODE.dx;
  const lastX = (r: number) => nodeX(CHART[r].chain.length);

  $: steps = pathTo(active.outcome);
  $: lit = (row: number, at: number, answer: 'yes' | 'no') =>
    steps.some(s => s.row === row && s.at === at && s.answer === answer);
  $: visited = (row: number, at: number) => steps.some(s => s.row === row && s.at === at);
  // The last row has no question; it is on the path when the path reaches it.
  $: inRow = (row: number) => steps.some(s => s.row === row);

  const outcomeLabel = (o: OutcomeId, g: PointGroup) => (o === g.outcome ? g.label : OUTCOME_LABEL[o]);
</script>

<section class="finder">
  <h4 class="finder-head">Finding the Point Group</h4>
  <div class="split">
    <svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="A decision chart for the point group of a molecule: linear, then the regular solids, then no axis at all, then perpendicular two-fold axes, then the mirror planes">
      {#each CHART as row, r}
        {@const y = rowY(r)}
        <!-- The spine: "no" leads down to the next row. -->
        {#if r < CHART.length - 1}
          <line class="edge" class:on={lit(r, -1, 'no')} x1={SPINE.w / 2} x2={SPINE.w / 2} y1={y + SPINE.h} y2={rowY(r + 1) + (CHART[r + 1].spine ? 0 : SPINE.h / 2)} />
          <text class="ans" x={SPINE.w / 2 + 5} y={y + SPINE.h + 16}>no</text>
        {/if}
        {#if row.spine}
          <rect class="q" class:on={visited(r, -1)} x={SPINE.x} {y} width={SPINE.w} height={SPINE.h} rx="4" />
          <text class="qt" x={SPINE.w / 2} y={y + (row.hint ? 14 : 21)} text-anchor="middle"><SvgSubbed text={row.spine} /></text>
          {#if row.hint}
            <text class="hint" x={SPINE.w / 2} y={y + 27} text-anchor="middle"><SvgSubbed text={row.hint} /></text>
          {/if}
          <line class="edge" class:on={lit(r, -1, 'yes')} x1={SPINE.w} x2={NODE.x0} y1={y + SPINE.h / 2} y2={y + SPINE.h / 2} />
          <text class="ans" x={(SPINE.w + NODE.x0) / 2} y={y + SPINE.h / 2 - 4} text-anchor="middle">yes</text>
        {:else}
          <!-- No question: every molecule with an axis and no ⊥ C₂ arrives here. -->
          <line class="edge" class:on={inRow(r)} x1={SPINE.w / 2} x2={NODE.x0} y1={y + SPINE.h / 2} y2={y + SPINE.h / 2} />
          <text class="hint" x={SPINE.w / 2 + 8} y={y + SPINE.h / 2 + 14}>the C set</text>
        {/if}

        <!-- The chain: "yes" drops to the group, "no" moves right. -->
        {#each row.chain as c, i}
          {@const x = nodeX(i)}
          <rect class="q" class:on={visited(r, i)} {x} {y} width={NODE.w} height={NODE.h} rx="4" />
          <text class="qt" x={x + NODE.w / 2} y={y + 21} text-anchor="middle"><SvgSubbed text={c.q} /></text>
          <line class="edge" class:on={lit(r, i, 'yes')} x1={x + NODE.w / 2} x2={x + NODE.w / 2} y1={y + NODE.h} y2={y + OUT.drop} />
          <text class="ans" x={x + NODE.w / 2 + 5} y={y + NODE.h + 11}>yes</text>
          <rect class="out" class:on={active.outcome === c.yes} x={x + (NODE.w - OUT.w) / 2} y={y + OUT.drop} width={OUT.w} height={OUT.h} rx="11" />
          <text class="ot" class:on={active.outcome === c.yes} x={x + NODE.w / 2} y={y + OUT.drop + 15} text-anchor="middle"><SvgSubbed text={outcomeLabel(c.yes, active)} /></text>
          <line class="edge" class:on={lit(r, i, 'no')} x1={x + NODE.w} x2={nodeX(i + 1)} y1={y + NODE.h / 2} y2={y + NODE.h / 2} />
          <text class="ans" x={x + NODE.w + (NODE.dx - NODE.w) / 2} y={y + NODE.h / 2 - 4} text-anchor="middle">no</text>
        {/each}
        <rect class="out" class:on={active.outcome === row.last} x={lastX(r)} y={y + (NODE.h - OUT.h) / 2} width={OUT.w} height={OUT.h} rx="11" />
        <text class="ot" class:on={active.outcome === row.last} x={lastX(r) + OUT.w / 2} y={y + NODE.h / 2 + 4} text-anchor="middle"><SvgSubbed text={outcomeLabel(row.last, active)} /></text>
      {/each}
    </svg>

    <div class="groups" role="list" on:mouseleave={() => (hovered = null)}>
      {#each groups as { g, rows } (g.key)}
        <div class="group" class:on={active.key === g.key} role="listitem" on:mouseenter={() => (hovered = g.key)}>
          <div class="group-head">
            <span class="sym"><Subbed text={g.label} /></span>
            <span class="ops"><Subbed text={g.ops} /></span>
            <span class="meta" title="Hermann–Mauguin symbol, and the order: how many operations the group holds">{g.hm} · h = {g.order}</span>
          </div>
          {#each rows as row (row.moleculeId + row.topologyId)}
            <button
              class="row"
              title="Open {row.label} ({row.where}) on the Vibration Modes view"
              on:click|stopPropagation={() => dispatch('mode', { moleculeId: row.moleculeId, topologyId: row.topologyId, modeId: '' })}
            >
              <span class="name">{row.label}</span>
              <span class="where">{row.where}</span>
              <span class="go" aria-hidden="true">→</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <p class="foot">
    Hover a group to trace its path. The groups of adsorbed species are those of the
    adsorbate and the metal atoms it binds to, not of the whole surface.
    {#if unassigned.length}No single group: {unassigned.join('; ')}, which the atlas records
      for more than one kind of site.{/if}
    {#if unknown.length}Not yet described here: {unknown.join(', ')}.{/if}
  </p>
</section>

<style>
  /* The same box as the Normal Modes census and the "in the atlas" lists. */
  .finder {
    margin: 18px 0 0;
    padding: 12px 14px 8px;
    background: var(--surface-slate);
    border: 1px solid var(--line-slate);
    border-radius: var(--radius-md);
  }
  .finder-head {
    font-size: var(--t-micro-label-size);
    font-weight: var(--t-micro-label-weight);
    color: var(--accent-green-fg);
    text-transform: var(--t-micro-label-tt);
    letter-spacing: var(--t-micro-label-ls);
    margin: 0 0 8px;
  }

  .split {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
  }
  .chart {
    flex: 1 1 520px;
    max-width: 760px;
    height: auto;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    padding: 10px;
    box-sizing: border-box;
  }

  /* The chart is a technical drawing: structure until it is on the path. */
  .q { fill: var(--surface); stroke: var(--line-slate-strong); stroke-width: 1; transition: stroke 0.2s; }
  .q.on { stroke: var(--brand-700); stroke-width: 1.5; }
  .out { fill: var(--surface); stroke: var(--line-faint); stroke-width: 1; transition: fill 0.2s, stroke 0.2s; }
  .out.on { fill: var(--brand-tint); stroke: var(--brand-700); stroke-width: 1.5; }
  .edge { stroke: var(--line-slate-strong); stroke-width: 1; transition: stroke 0.2s; }
  .edge.on { stroke: var(--brand-700); stroke-width: 2; }

  .qt, .ot, .ans, .hint {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
  }
  .qt { fill: var(--ink-slate-900); }
  .ot { fill: var(--ink-slate-500); }
  .ot.on { fill: var(--brand-700); font-weight: var(--t-label-weight); }
  .ans { fill: var(--ink-050); }
  .hint { fill: var(--ink-050); font-size: calc(var(--t-code-size) * 0.9); }

  .groups {
    flex: 1 1 260px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .group {
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius);
    padding: 4px;
    transition: border-color 0.2s;
  }
  .group.on { border-color: var(--brand-tint-line); }
  .group-head {
    display: grid;
    grid-template-columns: 3.4em 1fr auto;
    align-items: baseline;
    gap: 8px;
    padding: 2px 6px 3px;
  }
  .sym { font-weight: var(--t-label-weight); color: var(--ink-slate-900); }
  .group.on .sym { color: var(--brand-700); }
  .ops, .meta {
    font-family: var(--t-code-ff);
    font-size: var(--t-code-size);
    color: var(--ink-400);
  }
  .meta { color: var(--ink-300); white-space: nowrap; }

  .row {
    display: grid;
    grid-template-columns: 7.5em 1fr 1.2em;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 3px 6px;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: var(--t-nav-size);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: var(--surface-hover); }
  .row:hover .go { color: var(--accent-green-fg); }
  .name { color: var(--ink-slate-900); }
  .where { font-size: var(--t-code-size); color: var(--ink-300); }
  .go { color: var(--ink-200); text-align: right; }

  .foot {
    margin: 8px 2px 4px;
    font-size: var(--t-code-size);
    color: var(--ink-400);
    line-height: 1.45;
  }
</style>

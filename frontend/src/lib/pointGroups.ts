/**
 * Point groups in Schoenflies notation: what the Point Group Notation card
 * explains, and the decision chart it draws.
 *
 * The data carries a point group per binding geometry
 * (`topologies[].point_group` in data/vibrations.jsonc, with <sub> markup).
 * This module is the vocabulary those strings are read against: each group
 * the atlas uses, its operations, its order and its Hermann–Mauguin
 * equivalent, and the path the flow chart takes to reach it.
 *
 * Symbols are written for `Subbed` (lib/notation.ts lowers the bracketed
 * letters): `C(2v)` renders as C₂ᵥ. A digit subscript is a Unicode
 * character already (`C₂`, `S₄`).
 */

export interface PointGroup {
  /** The data's spelling with the markup stripped: `C2v`, `D∞h`, `Td`. */
  key: string;
  /** For Subbed: `C(2v)`, `D(∞h)`, `T(d)`. */
  label: string;
  /** Hermann–Mauguin, the crystallographer's name for the same group. */
  hm: string;
  /** How many operations the group holds; ∞ for the linear groups. */
  order: string;
  /** The operations, in character-table order, for Subbed. */
  ops: string;
  /** Where the chart ends, and with which n. */
  outcome: OutcomeId;
  n?: number;
}

/** Highest symmetry first: the order the card lists them in. */
export const POINT_GROUPS: PointGroup[] = [
  { key: 'D∞h', label: 'D(∞h)', hm: '∞/mm', order: '∞', ops: 'E, C∞, ∞σᵥ, i, S∞, ∞C₂', outcome: 'dinfh' },
  { key: 'C∞v', label: 'C(∞v)', hm: '∞m', order: '∞', ops: 'E, C∞, ∞σᵥ', outcome: 'cinfv' },
  { key: 'Td', label: 'T(d)', hm: '4̄3m', order: '24', ops: 'E, 8C₃, 3C₂, 6S₄, 6σ(d)', outcome: 'td' },
  { key: 'C3v', label: 'C(3v)', hm: '3m', order: '6', ops: 'E, 2C₃, 3σᵥ', outcome: 'cnv', n: 3 },
  { key: 'C2v', label: 'C(2v)', hm: 'mm2', order: '4', ops: 'E, C₂, σᵥ, σᵥ′', outcome: 'cnv', n: 2 },
  { key: 'Cs', label: 'C(s)', hm: 'm', order: '2', ops: 'E, σ', outcome: 'cs' },
];

/** The data's `C<sub>2v</sub>` as a key into POINT_GROUPS. */
export const pointGroupKey = (html: string | null | undefined): string | null =>
  html ? html.replace(/<[^>]+>/g, '').trim() : null;

export const pointGroupFor = (html: string | null | undefined): PointGroup | undefined => {
  const key = pointGroupKey(html);
  return POINT_GROUPS.find(g => g.key === key);
};

/* ── The flow chart ──
   A ladder rather than a tree, so it fits a card: each row is a first
   question on the spine; "yes" leads right into that row's chain, "no" down
   to the next row. Along a chain, "yes" drops to the group under the
   question and "no" moves right, until the last group closes the row. The
   last row has no question of its own: it is where every molecule with a
   principal axis and no perpendicular C₂ axes lands. The order is the
   standard one (Pfennig's, and the LibreTexts chart): the special groups
   first, then the axis, then the perpendicular C₂ axes, then the planes. */

export type OutcomeId =
  | 'dinfh' | 'cinfv'
  | 'ih' | 'oh' | 'td'
  | 'cs' | 'ci' | 'c1'
  | 'dnh' | 'dnd' | 'dn'
  | 'cnh' | 'cnv' | 's2n' | 'cn';

export interface ChartRow {
  /** The first question; none on the last row. */
  spine?: string;
  /** Under the spine question, in small print. */
  hint?: string;
  /** Questions along the row; the outcome under each is its "yes". */
  chain: { q: string; yes: OutcomeId }[];
  /** Where the row ends when every question on it says no. */
  last: OutcomeId;
}

export const CHART: ChartRow[] = [
  { spine: 'Linear?', chain: [{ q: 'i?', yes: 'dinfh' }], last: 'cinfv' },
  { spine: 'Several Cₙ, n ≥ 3?', hint: 'a regular solid', chain: [{ q: 'C₅?', yes: 'ih' }, { q: 'C₄?', yes: 'oh' }], last: 'td' },
  { spine: 'No Cₙ at all?', chain: [{ q: 'σ?', yes: 'cs' }, { q: 'i?', yes: 'ci' }], last: 'c1' },
  { spine: 'n C₂ ⊥ Cₙ?', hint: 'Cₙ: the highest n', chain: [{ q: 'σₕ?', yes: 'dnh' }, { q: 'n σ(d)?', yes: 'dnd' }], last: 'dn' },
  { chain: [{ q: 'σₕ?', yes: 'cnh' }, { q: 'n σᵥ?', yes: 'cnv' }, { q: 'S₂ₙ?', yes: 's2n' }], last: 'cn' },
];

/** The generic symbol each outcome shows until a group names its n. */
export const OUTCOME_LABEL: Record<OutcomeId, string> = {
  dinfh: 'D(∞h)', cinfv: 'C(∞v)',
  ih: 'I(h)', oh: 'O(h)', td: 'T(d)',
  cs: 'C(s)', ci: 'C(i)', c1: 'C₁',
  dnh: 'D(nh)', dnd: 'D(nd)', dn: 'Dₙ',
  cnh: 'C(nh)', cnv: 'C(nv)', s2n: 'S₂ₙ', cn: 'Cₙ',
};

/** A step on the chart: a row, and where in it (-1 the spine). */
export interface Step {
  row: number;
  at: number;
  answer: 'yes' | 'no';
}

/**
 * The questions a molecule of this outcome is asked, in order, and what it
 * answers. Walking the ladder: down the spine on "no", along the row on
 * "yes", then along the chain on "no" until the outcome's question.
 */
export function pathTo(outcome: OutcomeId): Step[] {
  const row = CHART.findIndex(r => r.last === outcome || r.chain.some(c => c.yes === outcome));
  if (row < 0) return [];
  const steps: Step[] = [];
  for (let r = 0; r < row; r++) steps.push({ row: r, at: -1, answer: 'no' });
  if (CHART[row].spine) steps.push({ row, at: -1, answer: 'yes' });
  for (const [i, c] of CHART[row].chain.entries()) {
    const hit = c.yes === outcome;
    steps.push({ row, at: i, answer: hit ? 'yes' : 'no' });
    if (hit) break;
  }
  return steps;
}

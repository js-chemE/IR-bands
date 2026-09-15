/**
 * The phenomena behind the bands, and which bands actually show them.
 *
 * The atlas records that two bands are Fermi partners, or that one is the
 * heavy twin of another, but the *reason* those relationships matter lives
 * nowhere a reader can find it. This module is where that goes.
 *
 * It is deliberately half-written: the resolvers below already pull the real
 * occurrences out of the data, so every section on the Knowledge page points
 * at bands that exist and the citations that back them. The prose is not
 * written yet. Fill in `what` and `spotting`, or write a full `body` in the
 * fundamentals' format (paragraphs, formula boxes, citations), and the card
 * becomes a real explanation; leave them empty and the page says so rather
 * than pretending.
 *
 * Keep the resolvers in step with the link fields in schema.py: a phenomenon
 * that stops resolving to anything renders as an empty section, which is the
 * signal that the data moved on without the prose.
 *
 * `wip: true` marks a card whose prose or drawing is not finished. Four
 * carry it: Isotopic Shift, Site Sensitivity, Coverage Shift and Vibrational
 * Coupling. Do not take their figures as a style reference; the finished
 * ones are Rotational Branches, Overtone, Combination and Difference, Fermi
 * Resonance and Degeneracy, each with a component of its own under
 * components/knowledge/ and a small and a full layout rather than one
 * drawing scaled up.
 *
 * On the Knowledge page the phenomena are cards, grouped by what a reader
 * sees in a spectrum rather than by their physics: more bands than there are
 * modes, fewer, or bands that sit somewhere else (PATTERN_GROUPS). A
 * phenomenon that is really one of the basics at work says so with `into`,
 * and its examples appear inside that card instead of on a card of its own.
 */

import type { Band } from './types';
import type { Block } from './fundamentals';
import { speciesLabel } from './labels';
import { isotopeShiftRows } from './isotopeShift';
import type { ShiftRow } from './isotopeShift';

export interface Example {
  /** Short heading for this one occurrence. */
  label: string;
  /** The bands involved, in reading order. */
  bands: Band[];
  /** One line on what makes this occurrence worth showing. */
  note?: string;
  /**
   * Band id -> a note about that band in particular, shown on its row. The
   * isotope card uses it to put the harmonic prediction beside the recorded
   * position: the comparison belongs on the band it is about, not in a
   * second table saying the same names again.
   *
   * Two strings rather than one, because a row has two amounts of space for
   * it: `pill` is what the row itself shows and has to be short, and
   * `detail` is the whole comparison, on hover.
   */
  bandNotes?: Record<string, BandNote>;
}

/**
 * What a row says about one band, in the two lengths a row has room for, and
 * in the two kinds it can be: an estimate, and a reason the estimate does not
 * apply. A row can carry both, since a bend still gets a number and the
 * number is still not a prediction.
 */
export interface BandNote {
  /** The estimate, short enough to sit on the row beside the position. */
  pill?: string;
  /** The whole comparison, on hover. */
  detail?: string;
  /** Why mass alone does not settle this one. One or two words. */
  caveat?: string;
  /** The whole of that, on hover. */
  caveatDetail?: string;
  /** Red where the number would mislead, the quieter rose where it is only
      out of scope. */
  caveatTone?: 'alert' | 'limit';
}

/**
 * Why a spectrum does not show exactly one band per vibration: three answers,
 * each a row of cards under "Band patterns".
 */
export type PatternGroup = 'more' | 'fewer' | 'moved';

export const PATTERN_GROUPS: { key: PatternGroup; label: string; note: string }[] = [
  { key: 'more', label: 'More Bands than Modes', note: 'Where extra bands come from' },
  { key: 'fewer', label: 'Fewer Bands than Modes', note: 'Where bands go silent or merge' },
  { key: 'moved', label: 'Bands That Move', note: 'What shifts a band without changing the mode' },
];

export interface Phenomenon {
  key: string;
  label: string;
  /** Its row on the Knowledge page. Absent when `into` hosts it instead. */
  group?: PatternGroup;
  /** One or two sentences on the card. Keep it to about 15 words. */
  teaser: string;
  /**
   * A Basics or Spectroscopy card (lib/fundamentals.ts) that is this
   * phenomenon at work: its examples are listed there, and links to the
   * phenomenon open that card.
   */
  into?: string;
  /** What it is, physically. Not written yet. */
  what: string;
  /** How it shows up in a spectrum, and why it matters. Not written yet. */
  spotting: string;
  /**
   * The written explanation, in the fundamentals' format: paragraphs and
   * formula boxes, Unicode, `[@alias, locator]` citations (lib/cite.ts).
   * Where present it replaces `what` and `spotting`.
   */
  body?: Block[];
  /**
   * Cards this one rests on, rendered as the "Builds on This" section, the
   * same shape `Fundamental.related` uses so both kinds of card render
   * through one block.
   */
  related?: { key: string; why: string }[];
  /**
   * Not finished: the prose, the drawing, or both.
   *
   * It shows as a chip on the card, so a reader knows not to trust the
   * figure yet, and it is the answer to "which cards can I copy the style
   * of": not these. The finished ones are Rotational Branches, Overtone,
   * Combination and Difference, Fermi Resonance and Degeneracy; take the
   * layout, the type sizes and the text-to-drawing ratio from those.
   *
   * Clear the flag in the same change that finishes the card.
   */
  wip?: boolean;
  /** Which field in the data records it. Factual, not editorial. */
  field: string;
  /** Pull the real occurrences out of the dataset. */
  find: (bands: Band[]) => Example[];
}

const byWn = (a: Band, b: Band) => b.wn_max - a.wn_max;
/** Up the spectrum: a fundamental, then its overtones above it. */
const byWnUp = (a: Band, b: Band) => a.wn_min - b.wn_min;

function bandById(bands: Band[]): Map<string, Band> {
  return new Map(bands.map(b => [b.id, b]));
}

/** The members of each branch group, so a `based_on` can resolve to real bands. */
function bandsByGroup(bands: Band[]): Map<string, Band[]> {
  const out = new Map<string, Band[]>();
  for (const b of bands) {
    if (!b.branch_group) continue;
    const list = out.get(b.branch_group) ?? [];
    list.push(b);
    out.set(b.branch_group, list);
  }
  return out;
}

/**
 * A `based_on` entry as bands plus a readable name.
 *
 * A parent named by `branch_group` used to be dropped here and its raw group
 * key printed to the reader: `loader.py` and `chart.ts` both expand a group
 * to its members, and this did not, which is why a CO₂ overtone listed no
 * parent at all. A parent named only by `label` is outside the dataset on
 * purpose, so it has a name but no bands.
 */
function parentOf(
  bo: Band['based_on'][number],
  byId: Map<string, Band>,
  byGroup: Map<string, Band[]>,
): { bands: Band[]; name: string } {
  if (bo.branch_group) {
    const members = byGroup.get(bo.branch_group) ?? [];
    return { bands: members, name: members[0] ? vibrationName(members[0]) : bo.branch_group };
  }
  if (bo.band_id) {
    const parent = byId.get(bo.band_id);
    return { bands: parent ? [parent] : [], name: parent ? vibrationName(parent) : bo.band_id };
  }
  return { bands: [], name: bo.label ?? '' };
}

/** The vibration's own name, never the branch letter and never the id. */
const vibrationName = (b: Band) => b.short || b.id;

/** How a parent enters a band: "2 × δ(OCO) CO₂" when it enters twice. */
const timesName = (n: number, name: string) => (n > 1 ? `${n} × ${name}` : name);


export const PHENOMENA: Phenomenon[] = [
  {
    key: 'fermi',
    group: 'more',
    teaser: 'Two levels at nearly the same energy mix, share their intensity and push apart.',
    label: 'Fermi Resonance',
    field: 'fermi_partner / fermi_partner_group',
    what: '',
    spotting: '',
    body: [
      'Two vibrational states of the same symmetry that happen to land at nearly the same energy cannot stay independent. They mix, and the two levels that come out of the mixing are pushed apart: the lower one down, the upper one up. Neither of the bands you then see sits where either state would have been alone.',
      'What the effect needs is only that: near-degeneracy, matching symmetry, and an anharmonic term to couple them. Neither state has to be a fundamental. The usual case is a fundamental with an overtone or a combination, because that pairs something strong with something weak, but the atlas also carries a resonance between two combination bands of CO₂, and the mixing there is the same mixing.',
      'Strong and weak is what makes it show rather than what makes it happen. Mixing gives each of the two observed bands a share of both characters, so whichever state had the intensity lends some of it to the one that had little, and a band appears where nothing was expected. Where both partners were already comparable, the pair simply moves apart and the intensities barely change.',
      {
        label: 'What moves, and which way',
        lines: [
          '\\begin{array}{ll}' +
            '\\text{energy} & \\text{the lower state down, the upper up} \\\\' +
            '\\text{intensity} & \\text{the fundamental lends to the weak band}' +
            '\\end{array}',
        ],
        note: 'The repulsion is always apart, and which band moves which way follows from which state started lower, not from which one carries the intensity. The atlas holds both arrangements: CO₂’s νₛ lies above the bend overtone it mixes with, formate’s ν(CH) lies below its combination. Rotation comes after: the mixing sets the two band origins, and each of them then carries its own P, Q and R envelope.',
      },
      'Because the effect needs an accidental coincidence, it is fragile, and that is what makes it testable. Isotopic substitution shifts the stretching mode and the bending mode by different amounts, so the two states stop being degenerate and the resonance comes apart, re-separating the bands in the spectrum [@negri, p. 41]. A pair that splits apart under ¹⁵N or deuterium was a resonance; a pair that does not was two species.',
      'It can involve more than two states. In Cu-exchanged zeolites the ABC triplet of the hydrogen-bonded O-H stretch arises this way: ν(OH) of the [zeolite O-H···O water] complex resonates with the overtone of the in-plane bend to give the AB diad, and with the overtone of the out-of-plane bend to give the C band, with the second overtone of the out-of-plane bend contributing as well [@negri, p. 38].',
      'In the atlas a resonance is recorded on both bands, each naming the other in fermi_partner, and the fermi-resonance tag is derived from that link rather than written by hand. Where the partner is itself split into rotational branches, fermi_partner_group names the whole group instead.',
    ],
    /**
     * Headed by the pair, low to high like the other two cards, and named
     * for what each side is: the bright fundamental that has the intensity
     * and the dark overtone or combination it lends some to. Which is which
     * is the point of the card, so the heading says it rather than leaving
     * the reader to work it out from the tags.
     */
    find(bands) {
      const byId = bandById(bands);
      const seen = new Set<string>();
      const out: Example[] = [];
      /**
       * Which side lends. Read off the recorded intensity, not off the
       * `fundamental` tag: the partners need not be a fundamental and an
       * overtone at all, and CO₂'s two combination bands are both `m`, with
       * no donor to name. Where the intensities are equal or missing, the
       * entry says nothing about donation rather than inventing a direction.
       */
      const RANK: Record<string, number> = { vs: 5, s: 4, m: 3, w: 2, vw: 1 };
      const strength = (x: Band) => RANK[x.intensity ?? ''] ?? 0;
      const donorOf = (pair: Band[]) => {
        const [hi, lo] = [...pair].sort((x, y) => strength(y) - strength(x));
        return strength(hi) > strength(lo) ? { hi, lo } : null;
      };
      for (const b of bands) {
        if (!b.fermi_partner || seen.has(b.id)) continue;
        const partner = byId.get(b.fermi_partner);
        if (!partner) continue;
        seen.add(b.id);
        seen.add(partner.id);
        const pair = [b, partner];
        const d = donorOf(pair);
        out.push({
          label: `${vibrationName(b)} with ${vibrationName(partner)}`,
          bands: pair.sort(byWnUp),
          note: d
            ? `${vibrationName(d.hi)} is the stronger of the two and lends the other its intensity.`
            : 'Recorded at comparable intensity, so neither is the obvious donor.',
        });
      }
      // The group form: a branched vibration resonating with another one.
      const groups = new Map<string, Band[]>();
      for (const b of bands) {
        if (!b.fermi_partner_group) continue;
        const list = groups.get(b.fermi_partner_group) ?? [];
        list.push(b);
        groups.set(b.fermi_partner_group, list);
      }
      // Both sides of such a pair usually point at each other, so one resonance
      // would otherwise be listed twice; the band set identifies it.
      // The vibration alone: `short` no longer carries the branch letter.
      const vibration = (b: Band) => b.short || b.id;
      const listed = new Set<string>();
      for (const [key, members] of groups) {
        const partners = bands.filter(b => b.branch_group === key);
        if (!partners.length) continue;
        const all = [...new Map([...members, ...partners].map(b => [b.id, b])).values()].sort(byWn);
        const id = all.map(b => b.id).sort().join('|');
        if (listed.has(id)) continue;
        listed.add(id);
        const d = donorOf(all);
        out.push({
          label: `${vibration(members[0])} with ${vibration(partners[0])}`,
          bands: all.sort(byWnUp),
          note: d
            ? `${vibrationName(d.hi)} is the stronger of the two and lends the other its intensity. Both sides are split into R/P/Q: the mixing sets the band origins and the branches follow.`
            : 'Both sides are split into R/P/Q: the mixing sets the two band origins, and each then carries its own branches.',
        });
      }
      return out;
    },
  },
  {
    key: 'isotopologue',
    group: 'moved',
    teaser: 'A heavier atom slows the vibration: the same band, shifted down, the bond unchanged.',
    label: 'Isotopic Shift',
    field: 'isotopologue_of + isotope',
    what: '',
    spotting: '',
    body: [
      'Substituting an isotope changes the mass of one nucleus and nothing else. The electrons are untouched, so the bond is the same bond and its force constant is the same number; only the inertia the restoring force has to move is different. The frequency follows the mass alone, which makes this the one shift in the atlas that can be predicted before it is measured.',
      'What the shift is for, in practice, is evidence, and it is the routine way an assignment is confirmed. A surface hydroxyl is shown to be one by exchanging it with D₂ or D₂O and watching the O–H stretch move to a well-separated O–D [@busca, p. 12]; a metal-oxygen double bond is shown to be one by ¹⁶O/¹⁸O exchange, because M=¹⁶O and M=¹⁸O do not sit in the same place [@busca, p. 14]. For adsorbed hydrocarbons the size of the CH → CD shift is the main criterion for what kind of vibration a band is at all: a C–H deformation moves by 300 to 400 cm⁻¹ and a C=C stretch by 50 to 100, so the two can be told apart even where they overlap [@davydov, pp. 351–352]. A ratio does the same job for hydrides: four bands on reduced Pt/Al₂O₃ shifting by a factor of about 1.39 under deuterium are hydride species and not something else [@negri, p. 44].',
      {
        label: 'The Shift',
        lines: [
          '\\tilde\\nu = \\frac{1}{2\\pi c}\\sqrt{\\frac{k}{\\mu}}',
          '\\frac{\\tilde\\nu\'}{\\tilde\\nu} = \\sqrt{\\frac{\\mu}{\\mu\'}}, \\qquad \\mu = \\frac{m_1 m_2}{m_1 + m_2}',
        ],
        note: 'k is the force constant and μ the reduced mass of the two atoms the bond joins: a diatomic vibration reduces to one particle of mass μ on a spring [@davydov, p. 28]. Because k cancels, the ratio needs no spectroscopy at all: two masses give the new position from the old one. μ is dominated by the lighter atom, which is why hydrogen is the substitution that moves a band and a heavy atom is the one that nudges it.',
      },
      'That is the whole of it, and it rests on three assumptions. The bond is treated as harmonic, which no real X-H bond is. The mode is treated as one pair of atoms on a spring, which only a stretch localised on one bond is. And the band is assumed to sit where that mode alone would put it, which across a Fermi resonance it does not. Each assumption holds most of the time. Where one fails, it fails in a particular way, and the atlas has a case of each.',
      {
        label: 'What the Atlas Substitutes',
        wide: true,
        lines: [
          '\\begin{array}{llll}' +
            '\\text{H} \\to \\text{D} & \\text{O–H} & 0.728 & \\qty{3690}{cm^{-1}} \\to \\qty{2686}{cm^{-1}} \\\\' +
            '\\text{H} \\to \\text{D} & \\text{C–H} & 0.734 & \\qty{2930}{cm^{-1}} \\to \\qty{2151}{cm^{-1}} \\\\' +
            '^{12}\\text{C} \\to {}^{13}\\text{C} & \\text{C–O} & 0.978 & \\qty{2143}{cm^{-1}} \\to \\qty{2096}{cm^{-1}} \\\\' +
            '^{16}\\text{O} \\to {}^{18}\\text{O} & \\text{C–O} & 0.976 & \\qty{2143}{cm^{-1}} \\to \\qty{2091}{cm^{-1}}' +
            '\\end{array}',
        ],
        note: 'Deuteration is the violent one. A hydrogen carries almost all of the motion in an X–H stretch, so μ is close to the mass of the hydrogen itself and doubling it would divide the frequency by √2 = 0.707; the partner atom’s finite mass pulls the ratio back up to about 0.73. The heavy-atom substitutions move a band by two percent, which sounds like nothing and is in fact enormous: 47 cm⁻¹ on ν(CO) is many times any line width, wide enough to resolve two isotopologues side by side and narrow enough to leave the chemistry alone.',
      },
      'The table below runs the prediction against every labelled band in the atlas. Over the localised stretches it is out by about a percent. The rest miss, and not in the same way. Some get a poor estimate. Others get a number that was never a prediction at all, because the model does not describe that mode. The box says which assumption breaks where, and every row in the list carries a pill naming the one that applies to it.',
      {
        label: 'What the Estimate Assumes',
        wide: true,
        lines: [
          '\\begin{array}{lll}' +
            '\\textbf{it assumes} & \\textbf{it fails when} & \\textbf{in the atlas} \\\\[2pt]' +
            '\\text{the bond is harmonic} & \\text{always, a little} & \\text{every X-H stretch, about }1\\% \\\\' +
            '\\text{one bond carries the mode} & \\text{it is a bend} & \\ce{CD4}\\ \\delta_\\mathrm{s} \\\\' +
            '\\text{the label sits in that bond} & \\text{it does not} & \\ce{DCOO^-}\\ \\nu_\\mathrm{as}(\\text{OCO}) \\\\' +
            '\\text{the level is the mode\'s own} & \\text{a resonance moved it} & \\ce{CH3OH}\\ \\nu(\\text{CH}) \\\\' +
            '\\end{array}',
        ],
        note: 'Formate is the clearest case, because it falls on both sides. Deuterium sits in its C-H bond, so that stretch is a fair test: the estimate lands 3.4% out. It does not sit in the O-C-O bonds, and those two barely move, about 8 cm⁻¹ each. Force the C-H ratio onto them and it predicts 1162 and 989 cm⁻¹ against 1590 and 1340 recorded, wrong by a quarter. What little they do move is the C-H deformation leaking into the vibration, up to 50 cm⁻¹ for νₛ(OCO) [@davydov, p. 370]. Predicting that needs the whole force field, which is a normal-coordinate or DFT calculation and not a reduced mass.',
      },
      'A deliberately mixed isotopic feed does something different again: it separates a molecule from its neighbours rather than from another species. Adsorbing a ¹²CO/¹³CO mixture turns one pair of bands into two pairs, the second displaced by the ¹³CO shift, and that is how it is settled whether two nearby bands are two complexes or one complex whose molecules were talking to each other [@davydov, p. 247]. The same trick at high dilution leaves a decoupled singleton, which is what the mioirs technique value names and what the Vibrational Coupling card is about.',
      'A labelled band is recorded here as a band in its own right, with isotopologue_of pointing at the natural-abundance one and isotope naming the substitution. Never as a second wavenumber inside the parent’s claims: the two are different molecules with different spectra, and burying one inside the other would make the parent’s position a range covering both. A source that merely used substitution as evidence for an ordinary band gets the isotope-labeling tag on that claim instead, which is a statement about the method rather than about the molecule.',
    ],
    /**
     * One entry per labelled band, with the harmonic prediction on the band
     * itself. Mass alone is a real prediction here, so the list can be asked
     * how well it does rather than only what exists: every row carries what
     * √(μ/μ′) said, what was recorded, and the gap between them.
     */
    find(bands) {
      const groups = bandsByGroup(bands);
      /* A parent or child that is one branch of a family stands for the whole
         family here: the substitution is of the transition, not of its Q
         branch, and rowsOf() folds the members back into a single row with
         the letters beside it. */
      const family = (b: Band) => (b.branch_group ? groups.get(b.branch_group) ?? [b] : [b]);
      const off = (r: ShiftRow) =>
        r.residual === null
          ? null
          : `${r.residual > 0 ? '+' : r.residual < 0 ? '−' : ''}${Math.round(Math.abs(r.residual))} cm⁻¹ (${Math.abs(r.residualPct ?? 0).toFixed(1)}%)`;
      /* The substitution is of the transition, not of one of its lines, so
         the rows have to be folded before they are listed. CD₄'s bend is
         five branches, each the isotopologue of the matching CH₄ branch, so
         isotopeShiftRows() hands back five rows that expand to the same pair
         of families: listed raw they were five identical entries, and since
         AtlasExamples keys its list by the bands in it, five identical keys.
         A duplicate key aborts the whole {#each}, which is how this list came
         to render its header and nothing under it.

         One entry per family pair, then, but every branch keeps its own
         estimate: the notes are accumulated across the rows, so whichever
         line leads the folded row shows the number computed for that line. */
      const folded = new Map<string, {
        rep: ShiftRow;
        bands: Band[];
        notes: Record<string, BandNote>;
      }>();
      for (const r of isotopeShiftRows(bands)) {
        const members = [...family(r.parent), ...family(r.child)];
        const key = members.map(b => b.id).sort().join('|');
        let e = folded.get(key);
        if (!e) {
          e = { rep: r, bands: members, notes: {} };
          folded.set(key, e);
        } else if (r.child.vibration.branch === 'Q') {
          // The centre line speaks for the family where there is one.
          e.rep = r;
        }
        const d = off(r);
        const n: BandNote = {};
        if (r.predicted !== null && d) {
          /* The number is the point of the pill: a reader comparing theory
             with the atlas wants to see where mass alone put the band, and
             having to hover for it makes the column say only that a
             comparison exists. The size of the miss stays on hover, being
             the second question. */
          n.pill = `est. ${Math.round(r.predicted)}`;
          n.detail = `harmonic estimate ${Math.round(r.predicted)} cm⁻¹ against a recorded centre of ${Math.round(r.childWn)}: off by ${d}`;
        }
        if (r.caveat && r.caveatShort) {
          /* Marked on the row rather than left in the paragraph above it: a
             reader scanning the column has to be able to see which numbers
             are predictions and which are only arithmetic. */
          n.caveat = r.caveatShort;
          n.caveatDetail = r.caveat;
          n.caveatTone = r.caveatTone ?? 'limit';
        }
        if (n.pill || n.caveat) e.notes[r.child.id] = n;
      }
      return [...folded.values()].map(({ rep: r, bands: members, notes }) => ({
        // The label names the transition, so it drops the branch letter the
        // representative line happens to carry.
        label: `${r.isotope}: ${(r.child.short || r.child.id).replace(/\s*\([OPQRS](\(\d+\))?\)\s*$/, '')}`,
        bands: members,
        note: r.predicted === null
          ? `Mass alone cannot predict this one: ${r.caveat}.`
          : `√(μ/μ′) = ${r.ratio!.toFixed(4)} for ${r.bond}, so the harmonic estimate is ${Math.round(r.predicted)} cm⁻¹ and the recorded centre is ${Math.round(r.childWn)}: off by ${off(r)}.${r.caveat ? ` Expected, since it is ${r.caveat}.` : ''}`,
        bandNotes: Object.keys(notes).length ? notes : undefined,
      }));
    },
  },
  {
    key: 'branches',
    group: 'more',
    teaser: 'A free molecule also rotates, so its band splits into branches: P, Q and R in the infrared, O, Q and S in Raman.',
    label: 'Rotational Branches',
    field: 'branch_group',
    what: '',
    spotting: '',
    body: [
      'A free molecule turns while it vibrates, on the manifold of rotational energy levels the Rotation Modes card describes, and one photon can change both at once. A vibrational transition therefore changes J as well: by +1 or −1, and by 0 where the symmetry allows it. Each starting level J gives a line of its own, so a gas-phase band is not one line but a row of them, gathered into branches.',
      {
        label: 'Branches',
        lines: [
          '\\begin{array}{lll}' +
            '\\text{S:} & \\Delta J = +2 & \\text{Raman only} \\\\' +
            '\\text{R:} & \\Delta J = +1 & \\text{infrared} \\\\' +
            '\\text{Q:} & \\Delta J = 0 & \\text{band centre, both} \\\\' +
            '\\text{P:} & \\Delta J = -1 & \\text{infrared} \\\\' +
            '\\text{O:} & \\Delta J = -2 & \\text{Raman only}' +
            '\\end{array}',
        ],
        note: 'High to low, the way they sit on the axis. The letter is nothing but ΔJ. The infrared absorbs one photon through the dipole and reaches ΔJ = ±1; Raman scatters through the polarizability and reaches ±2. Which of the five a given band actually shows is a property of the molecule, not of the letter: P and R are not forbidden in Raman, they are simply absent for a linear molecule in a non-degenerate vibration. The diagram builds them arrow by arrow, each arrow one line of the spectrum beside it, and runs three cases in turn: a stretch with no Q, a bend with one, then the same transition in Raman.',
      },
      {
        label: 'Where the Lines Sit',
        lines: [
          '\\begin{array}{ll}' +
            '\\text{R}(J): & \\nu_0 + 2B(J + 1) \\\\' +
            '\\text{P}(J): & \\nu_0 - 2BJ \\\\' +
            '\\text{S}(J): & \\nu_0 + B(4J + 6) \\\\' +
            '\\text{O}(J): & \\nu_0 - B(4J - 2)' +
            '\\end{array}',
        ],
        note: 'ν₀: the band centre, B: the rotational constant, J: the level the line starts from. The rigid rotor, one B for both levels; in fact B shrinks a little in v = 1, so the R lines crowd together as J rises and the P lines spread apart. Note the factor: the infrared lines step by 2B, the Raman ones by 4B, because ΔJ steps by two instead of one. That is why hydrogen resolves into separate lines and nitrogen does not. Its rotational constant is about 59 cm⁻¹ against nitrogen’s 2, so its O branch lands hundreds of wavenumbers below the centre while nitrogen’s stays an unresolved tail.',
      },
      'How tall each line is follows how full its starting level is, the room-temperature population on the Rotation Modes card: the lines rise from the centre to a maximum near J ≈ 7 for CO and fade beyond. At the few cm⁻¹ resolution usual for catalyst spectra, lines 3.9 cm⁻¹ apart for CO, and closer still for heavier molecules, blur into two lobes, the P and R envelopes, with a dip between them where the band centre is.',
      'Whether a Q branch appears depends on the direction of the dipole change. In a linear molecule, a vibration that swings the dipole along the axis, such as the stretch of CO or the asymmetric stretch of CO₂, has none; one that swings it across the axis, such as the bend of CO₂, has a strong one, all its lines piled up at the centre. Gas-phase acetylene in a reflection cell shows the P and R pair: its asymmetric C–H stretch appears as two branches, at 3269 and 3309 cm⁻¹ [@trenary, p. 56].',
      'Rotation can also be excited alone, J → J + 1 with no vibration, by a photon in the microwave or far infrared, well below the mid-infrared window. That rule mirrors the IR one: the molecule must carry a permanent dipole for the field to turn it. CO has one; CO₂, N₂ and CH₄ have none. Raman sees rotation through the polarizability instead, wherever the cloud is longer than it is wide, so N₂ and CO₂ show pure rotational Raman lines close to the laser.',
      'A pure rotational Raman spectrum is an S branch and nothing else. Only ΔJ = +2 arises, because with no vibration to change, the upper level is by definition the higher one, so ΔJ = −2 cannot occur at all. The first line sits 6B from the laser and the rest follow every 4B [@long, p. 171 and p. 174]. Hydrogen is the case the atlas carries: ten lines from S(2) at 814 cm⁻¹ to S(11) at 2387, about 180 cm⁻¹ apart, each held as a band of its own because they are genuinely that far apart. It is the one spectrum here with no vibration in it, which is why those bands take the rotational category rather than a stretch or a bend.',
      'One thing decides the heights of those H₂ lines that has nothing to do with how full the level is, and it alternates. In a homonuclear molecule the two nuclei are identical, so the whole wave function has to behave properly when they are swapped, and that ties the rotational level to the nuclear spin state. For hydrogen, whose nuclei are spin-½ fermions, the odd-J levels carry a nuclear spin weight of 3 and the even-J levels a weight of 1: ortho and para hydrogen, in a fixed 3:1 ratio [@long, p. 180]. The odd lines of the atlas’s S branch, S(3), S(5), S(7), S(9) and S(11), are therefore about three times the height their populations alone would give, and the even ones S(2), S(4), S(6), S(8) and S(10) about a third. The positions are untouched; only the intensities alternate.',
      'It can go further than an alternation. The two nuclei of ¹⁶O₂ have no spin at all, which leaves the even-J levels with a weight of zero: they are not underpopulated, they do not exist, and every other line of the oxygen rotational Raman spectrum is simply absent [@long, pp. 179–180]. An alternation or a gap in a homonuclear rotational spectrum is therefore evidence about the nuclei rather than about the chemistry, and reading it as two species would be a mistake.',
      'Why Raman reaches further is a matter of what does the reaching. The infrared absorbs one photon through the dipole, an operator of rank one, and that limits it to ΔJ = 0, ±1. Raman scatters through the polarizability, a tensor of rank two, whose irreducible parts carry j = 0, 1 and 2; the triangle rule on those admits ΔJ up to ±2. The ranks map straight onto the branches: the isotropic part feeds Q alone, the antisymmetric part P, Q and R, and the anisotropic part all five [@long, pp. 158–159 and p. 276].',
      'Which of the five actually appears is a property of the molecule, not of the letter, and this is the trap. A linear molecule in a non-degenerate vibration gets ΔJ = 0, ±2 only, so N₂ and H₂ show O, Q and S and no P or R. But a symmetric top, a spherical top, or a linear molecule in a degenerate vibration all reach ΔJ = ±1 as well. Methane is the example: its triply degenerate ν₃ genuinely carries all five branches in Raman, fifteen once Coriolis splitting is counted [@long, Table 6.5, p. 167 and pp. 210–211]. So a P branch resting on Raman evidence is not by itself an error, while an O or S branch resting on infrared evidence always is, and the build checks only that second, one-directional half.',
      'The branches are the mark of a free molecule. Adsorbed, a molecule cannot turn, and it gives one band per mode where its gas gives an envelope; the envelope of a gas-phase reactant in the cell is something to subtract, not a surface species. The atlas records each branch of a gas-phase band as a band of its own, grouped with its siblings by branch_group, and the chart keeps a group on one line.',
    ],
    /**
     * Grouped by molecule, not one entry per transition.
     *
     * Every branched band is a gas-phase band of a freely turning molecule,
     * so splitting them into fourteen entries put one fact fourteen times
     * and buried which molecules actually show rotational structure. The
     * transitions are not lost: `rowsOf()` in AtlasExamples folds each
     * branch group back into a single row with its letters beside it, so a
     * molecule's entry reads as one line per branched transition.
     */
    find(bands) {
      const byMolecule = new Map<string, Band[]>();
      for (const b of bands) {
        if (!b.branch_group) continue;
        const list = byMolecule.get(b.species) ?? [];
        list.push(b);
        byMolecule.set(b.species, list);
      }
      const lowest = (bs: Band[]) => Math.min(...bs.map(x => x.wn_min));
      return [...byMolecule.entries()]
        .map(([key, members]) => {
          const n = new Set(members.map(m => m.branch_group)).size;
          return {
            label: speciesLabel(key),
            // Low to high, the way the branches sit on the axis.
            bands: members.sort(byWnUp),
            note: `${n} branched transition${n === 1 ? '' : 's'}. All gas phase: only a molecule free to turn has branches at all.`,
          };
        })
        .sort((a, b) => lowest(a.bands) - lowest(b.bands));
    },
  },
  {
    key: 'overtone',
    group: 'more',
    teaser: 'One mode, two energy levels at once, or three: weak bands a little under twice the fundamental.',
    label: 'Overtone',
    related: [
      { key: 'vibration', why: 'The energy levels an overtone skips a step on' },
      { key: 'spectrum', why: 'Where the band it leaves ends up on the axis' },
      { key: 'combination', why: 'The other way one photon does more than one step' },
    ],
    field: 'the "overtone" tag + based_on[].multiplier',
    what: '',
    spotting: '',
    body: [
      'A harmonic oscillator may only change by one energy level, Δv = ±1, so it would show nothing but fundamentals. A real bond is anharmonic: its well flattens towards dissociation, and that relaxes the rule. Transitions from the ground state to the second excited level and the third become weakly allowed, and these are the overtones [@busca, p. 4].',
      {
        label: 'Where an overtone lands',
        lines: [
          '\\begin{array}{ll}' +
            '\\text{first overtone} & 0 \\rightarrow 2, \\quad \\text{a little under } 2\\nu \\\\' +
            '\\text{second overtone} & 0 \\rightarrow 3, \\quad \\text{a little under } 3\\nu' +
            '\\end{array}',
        ],
        note: 'The name counts overtones, not levels: 0 → 1 is the fundamental, so 0 → 2 is the first overtone and the nth overtone is the transition to v = n + 1. Under, not at: the levels of a real well crowd together as v rises, so two steps cost less than twice one step. The diagram puts the exact multiple and the real position side by side.',
      },
      'They are weak. Each further level costs roughly one to two orders of magnitude in intensity, so a first overtone is a minor feature beside its fundamental and a second overtone is usually beyond reach. That weakness is what makes them useful rather than confusing: an overtone in a crowded spectrum is a small band where a small band is expected, not a species nobody can account for.',
      'Their real value is that they appear where the fundamental cannot. The metal–oxygen stretches of an oxide lie below the cutoff of a typical measurement, buried under the bulk absorption of the solid; their first overtones sit near 2000 cm⁻¹, in a clear window. Busca recommends inspecting that region for the first overtones of M=O bonds, and shows the W=O overtone shifting to 1994 cm⁻¹ when pyridine is adsorbed [@busca, p. 14]: a band that reports on a bond whose fundamental is invisible.',
      'A support gives a whole series of them. Between 2500 and 1500 cm⁻¹ an oxide shows moderately weak bands from overtones and combinations of its lattice modes, and, unlike anything on the surface, they are not disturbed by outgassing or by dosing a probe molecule [@busca, pp. 11–12]. They identify the support and stay put while the surface chemistry changes around them.',
      'In the atlas an overtone is a band of its own, with the parent named in based_on and a multiplier saying how many levels. It keeps the parent’s category, since it is the same motion, and the overtone tag is derived, never written by hand.',
    ],
    /**
     * Keyed by the fundamental, not by the overtone. The question the box
     * answers is "which modes do we have overtones of", so the heading is the
     * parent vibration and the overtones are what is listed under it. A
     * branched parent is one mode however many lines it was resolved into,
     * and its branches' papers are gathered into the one entry.
     */
    find(bands) {
      const byId = bandById(bands);
      const byGroup = bandsByGroup(bands);
      interface Row { name: string; parents: Band[]; kids: Band[] }
      const rows = new Map<string, Row>();
      const orphans: Example[] = [];

      // Low to high, so the note reads up the manifold the way the rows do.
      for (const b of bands.filter(x => x.tags.includes('overtone')).sort(byWnUp)) {
        // A parent entering twice or more is what makes this an overtone; a
        // parent entering once is the other half of a combination band.
        const steps = b.based_on.filter(bo => (bo.multiplier ?? 1) >= 2);
        if (!steps.length) {
          orphans.push({
            label: vibrationName(b),
            bands: [b],
            note: 'No parent mode recorded for this one.',
          });
          continue;
        }
        for (const bo of steps) {
          const key = bo.branch_group ?? bo.band_id ?? bo.label ?? b.id;
          const { bands: parents, name } = parentOf(bo, byId, byGroup);
          const row = rows.get(key) ?? { name, parents, kids: [] };
          if (!row.kids.some(k => k.id === b.id)) row.kids.push(b);
          rows.set(key, row);
        }
      }

      const lowest = (bs: Band[]) => Math.min(...bs.map(b => b.wn_min));
      return [
        ...[...rows.values()]
          .map(r => ({
            label: r.name,
            /* Low to high within the entry: the fundamental, then its first
               overtone near twice it, then the second near three times. The
               fundamental leads because it is lowest, not by being placed. */
            bands: [...r.parents, ...r.kids].sort(byWnUp),
            /* The rows say what was recorded, so a note repeating them adds
               nothing. The one thing they cannot say is that the fundamental
               is missing: nothing is drawn for a band that is not there. */
            note: r.parents.length ? undefined : 'The fundamental itself is not in the atlas.',
          }))
          .sort((a, b) => lowest(a.bands) - lowest(b.bands)),
        ...orphans,
      ];
    },
  },
  {
    key: 'combination',
    group: 'more',
    teaser: 'Two modes, one photon: a weak band near the sum of two fundamentals, or near their difference.',
    label: 'Combination and Difference',
    field: 'vibration.category = combination + based_on[]',
    what: '',
    spotting: '',
    body: [
      'The same anharmonicity that allows an overtone allows one photon to excite two different modes at once [@busca, p. 4]. The band lands near the sum of the two fundamentals, a little under it, and it is weak for the same reason: it is a transition the harmonic picture forbids outright.',
      {
        label: 'Sums and differences',
        lines: [
          '\\begin{array}{ll}' +
            '\\text{combination} & \\nu_1 + \\nu_2 \\\\' +
            '\\text{difference} & \\nu_1 - \\nu_2' +
            '\\end{array}',
        ],
        note: 'A difference band starts from a mode that is already excited, so it needs a level that is populated at the temperature of the experiment and fades as the sample is cooled. CO₂ gives both: νₐₛ−νₛ and νₐₛ−2δ are in the atlas.',
      },
      'The two modes need not be alike. Acetylene combines its symmetric and asymmetric bending modes, and the pair shows up in a reflection cell at 1304 and 1343 cm⁻¹ as the P and R branches of one band [@trenary, p. 57]; CO₂ combines a stretch with twice its bend, which is why the atlas carries 2δ+νₐₛ as well as νₛ+νₐₛ.',
      'Because a combination is a sum, it lands in a different part of the spectrum from either parent, and that is what makes it worth chasing. Nitrate species whose fundamentals overlap hopelessly between 1700 and 1200 cm⁻¹ separate cleanly in the overtone and combination region, which is how bidentate structures that look identical lower down can be told apart [@busca, p. 40].',
      'In the atlas a combination has its own category, and based_on names every parent it is built from, with a multiplier where a parent enters more than once. A combination may not carry a subtype: it is not one kind of motion.',
    ],
    /**
     * The other way round from overtones: here the combination is the subject
     * and its parent modes are listed under it. A branched combination is one
     * entry rather than one per line, and a parent named by `branch_group`
     * resolves to that group's bands instead of printing its key.
     */
    find(bands) {
      const byId = bandById(bands);
      const byGroup = bandsByGroup(bands);
      interface Row { name: string; members: Band[]; parents: Band[]; seen: boolean; missing: string[] }
      const rows = new Map<string, Row>();

      for (const b of bands.filter(x => x.vibration.category === 'combination').sort(byWnUp)) {
        const key = b.branch_group ?? b.id;
        const row = rows.get(key) ?? {
          name: vibrationName(b), members: [], parents: [], seen: false, missing: [],
        };
        row.members.push(b);
        // The lines of one transition share their parents; take them once.
        if (!row.seen) {
          row.seen = true;
          for (const bo of b.based_on) {
            const { bands: parents, name } = parentOf(bo, byId, byGroup);
            if (!name) continue;
            // A parent outside the dataset gets no row, so it is the one
            // thing worth saying in words.
            if (!parents.length) row.missing.push(timesName(bo.multiplier ?? 1, name));
            for (const p of parents) {
              if (!row.parents.some(x => x.id === p.id)) row.parents.push(p);
            }
          }
        }
        rows.set(key, row);
      }

      return [...rows.values()].map(r => ({
        label: r.name,
        // Up the spectrum, as on the overtone card: the parents first and the
        // sum above them, or, for a difference band, the other way round.
        // The heading still names the combination, so the subject is not lost.
        bands: [...r.members, ...r.parents].sort(byWnUp),
        note: r.missing.length ? `Not in the atlas: ${r.missing.join('; ')}.` : undefined,
      }));
    },
  },
  {
    key: 'degeneracy',
    group: 'fewer',
    teaser: 'Two modes at one frequency give one band. Lower the symmetry and it can split.',
    label: 'Degeneracy',
    field: 'the "degenerated" tag',
    what: '',
    spotting: '',
    body: [
      'Symmetry can give two normal modes the same vibrational energy. Both are counted in the 3N − 6, but a photon of that energy is absorbed into either of them, so the spectrum shows one band where the count says two. CO₂’s bend is the standard case: the in-plane bend and the out-of-plane bend are one and the same mode turned by 90°, so four modes give three frequencies. The atlas keeps the two as mode records of their own, δ(OCO) and ω(OCO), and points one band at the pair, which is why the diagram animates two molecules and not one.',
      'Absorption at that wavenumber goes into both modes, so the band carries the intensity of the pair and not of one of them. Degenerate modes are accordingly among the strongest bands their molecules have: CO₂’s bend at 667 cm⁻¹ and methane’s ν₃ near 3019 cm⁻¹ are both of them. The diagram draws the band as what it is, two contributions lying exactly on top of each other.',
      {
        label: 'How Many Modes Share One Frequency',
        lines: [
          '\\begin{array}{ll}' +
            'A,\\ B,\\ \\Sigma & \\text{one-dimensional: never degenerate} \\\\' +
            'E,\\ \\Pi & \\text{twofold: } \\ce{CO2}\\ \\delta(\\ce{OCO}),\\ \\ce{CH4}\\ \\nu_2 \\\\' +
            'T,\\ F & \\text{threefold: } \\ce{CH4}\\ \\nu_3,\\ \\nu_4' +
            '\\end{array}',
        ],
        note: 'The symmetry species a mode belongs to already says how many share its frequency, because the degeneracy is the dimension of that species. Counting the modes of each species is what predicts a spectrum before it is measured [@busca, p. 6]. The atlas carries all three kinds.',
        wide: true,
      },
      'Lower the symmetry and the coincidence has no reason to hold. Carbonate is the case this atlas is built around. The free ion is trigonal, D₃ₕ, and has one strong infrared band, ν₃, a doubly degenerate asymmetric CO stretch near 1415 cm⁻¹ in bulk metal carbonates, with two weaker deformations below it; coordinating it to a surface lowers that symmetry and ν₃ splits in two [@busca, p. 23].',
      'How far it splits then reads the structure, and that is why the atlas carries carbonate as several pairs rather than one species. The splitting runs bidentate ≈ chelating > monodentate ≈ polydentate > trigonal, while the stability runs almost the other way, polydentate > bidentate > chelating > monodentate, so the two together separate structures that either one alone would confuse [@busca, p. 23]. The symmetric deformation ν₁, Raman-active in the free ion, appears in the infrared as well once the symmetry is gone [@busca, p. 23].',
      'Two things are easy to mistake for this. A pair that splits need not have been degenerate: formate’s νₛ(OCO) and νₐₛ(OCO) are two modes of a molecule that never had the symmetry to make them equal, and the gap between them measures something else. And a coincidence need not be symmetry: methanol’s δ(CH₃) scissor and ρ(CH₂) lie about 10 cm⁻¹ apart and rarely resolve in a catalyst spectrum, but methanol is Cₛ, which has no symmetry element to enforce a coincidence. The two are close because a free methyl group would be symmetric, and the rest of the molecule separates them a little.',
      'The degenerated tag marks a band that stands for more than one mode, and it is authored rather than derived: nothing in the data counts the components for you.',
    ],
    related: [
      { key: 'modes', why: 'Where the 3N − 6 count comes from, and why it overcounts the bands' },
      { key: 'vibmodes', why: 'The modes being counted, drawn one at a time' },
      { key: 'selection', why: 'The other thing a symmetry species decides' },
      { key: 'fermi', why: 'Near-degeneracy that symmetry did not cause' },
      { key: 'site-sensitivity', why: 'The surface that lifts it also moves what is left' },
    ],
    /**
     * One entry per degenerate MODE, not per band that carries the tag.
     *
     * The tag is authored on the mode and inherited by everything built on it
     * (`spread_degeneracy` in loader.py), so listing every tagged band put
     * thirty-four rows on the card for eight facts: each branch of a family
     * separately, then every overtone and combination built on it, then each
     * of THEIR branches. What the card is about is the coincidence itself,
     * and there are eight of those.
     *
     * So a mode is a row, its branches fold into it (AtlasExamples does that
     * from branch_group), and everything built on it comes along in the same
     * row: the overtone of a degenerate bend belongs under that bend, not
     * beside it as a second discovery.
     */
    find(bands) {
      const groups = bandsByGroup(bands);
      /** The family a band belongs to: its branch group, or itself. */
      const famOf = (b: Band) => b.branch_group ?? b.id;

      /* A mode is degenerate in its own right when it is tagged and stands on
         nothing: built on no other band, and not the labelled twin of one.
         Anything tagged that IS built on something, or is somebody's
         isotopologue, got its degeneracy from there and belongs in that
         entry rather than beside it. CD₄'s bend is methane's bend with
         heavier hydrogens, not a second discovery. */
      const roots = bands.filter(
        b => b.tags.includes('degenerated') && !b.based_on?.length && !b.isotopologue_of,
      );
      const families = new Map<string, Band[]>();
      for (const r of roots) {
        const key = famOf(r);
        families.set(key, groups.get(key) ?? [r]);
      }

      /**
       * Which degenerate families a band descends from, however deep, by
       * either link: built on it, or a labelled twin of it. Both carry the
       * degeneracy down, so both lead back to the same entry.
       */
      function rootFamilies(b: Band, seen = new Set<string>()): Set<string> {
        const out = new Set<string>();
        if (seen.has(b.id)) return out;
        seen.add(b.id);
        const step = (parent: Band | undefined) => {
          if (!parent) return;
          if (families.has(famOf(parent))) out.add(famOf(parent));
          for (const up of rootFamilies(parent, seen)) out.add(up);
        };
        for (const bo of b.based_on ?? []) {
          if (bo.band_id) step(bands.find(x => x.id === bo.band_id));
          else for (const m of groups.get(bo.branch_group ?? '') ?? []) step(m);
        }
        if (b.isotopologue_of) step(bands.find(x => x.id === b.isotopologue_of));
        return out;
      }

      const built = new Map<string, Band[]>();
      const twinned = new Map<string, Band[]>();
      for (const b of bands) {
        if (!b.tags.includes('degenerated')) continue;
        const isTwin = !!b.isotopologue_of && !b.based_on?.length;
        if (!b.based_on?.length && !b.isotopologue_of) continue;
        for (const key of rootFamilies(b)) {
          const into = isTwin ? twinned : built;
          into.set(key, [...(into.get(key) ?? []), b]);
        }
      }

      return [...families.entries()]
        .map(([key, members]) => {
          const head = members.slice().sort(byWn)[0];
          const kids = (built.get(key) ?? []).sort(byWn);
          const twins = (twinned.get(key) ?? []).sort(byWn);
          /* Counted by branch family, which is one row of the list: a band
             with five branches is one band here, not five. */
          const nBuilt = new Set(kids.map(famOf)).size;
          const nTwins = new Set(twins.map(famOf)).size;
          const parts: string[] = [];
          if (nBuilt) {
            parts.push(`${nBuilt} band${nBuilt > 1 ? 's are' : ' is'} built on it`);
          }
          if (nTwins) {
            parts.push(
              `${nTwins} isotopologue${nTwins > 1 ? 's carry' : ' carries'} the same mode on heavier atoms`,
            );
          }
          return {
            label: head.short || head.id,
            /* Everything in one order, up the spectrum: the fundamental, its
               overtones and combinations and its labelled twins interleaved by
               where they actually sit, rather than grouped by how they are
               related. The relation is already in each row's tags, and low to
               high is the order a fundamental and the things built on it come
               in anyway. */
            bands: [...members, ...kids, ...twins].sort(byWnUp),
            note: parts.length
              ? `${parts.join(', and ')}. The degeneracy comes with ${nBuilt + nTwins > 1 ? 'them' : 'it'}: an overtone, a combination or an isotopologue of a degenerate mode reaches a set of levels too.`
              : undefined,
          };
        })
        .sort((a, b) => byWnUp(a.bands[0], b.bands[0]));
    },
  },
  {
    key: 'ir-inactive',
    // The selection rule at work: its examples live on the Selection rules card.
    into: 'selection',
    teaser: 'A vibration that leaves the dipole unchanged has no IR band.',
    /* The list covers both kinds of silence now, so the heading cannot name
       one of them. The card it hangs under is Selection Rules either way. */
    label: 'Modes a Technique Cannot See',
    field: 'the "ir-inactive" and "raman-inactive" tags',
    what: '',
    spotting: '',
    /**
     * One entry per molecule, not per band.
     *
     * Silence is a property of a mode in a molecule of some symmetry, so the
     * question a reader has is "which of CO₂'s modes are dark, and to what",
     * not "here are thirty bands in no order". Both kinds of silence are
     * listed: a mode can be invisible to the infrared, to Raman, or to both,
     * and a centrosymmetric molecule makes the third case the interesting one.
     * Branch families fold to a row each, as everywhere else.
     */
    find(bands) {
      const groups = bandsByGroup(bands);
      const dark = bands.filter(
        b => b.tags.includes('ir-inactive') || b.tags.includes('raman-inactive'),
      );
      const byMolecule = new Map<string, Band[]>();
      for (const b of dark) {
        const seen = byMolecule.get(b.species) ?? [];
        // The whole family, so a branched mode reads as one dark transition.
        for (const m of b.branch_group ? groups.get(b.branch_group) ?? [b] : [b]) {
          if (!seen.includes(m)) seen.push(m);
        }
        byMolecule.set(b.species, seen);
      }
      return [...byMolecule.entries()]
        .map(([species, members]) => {
          /* Mutual exclusion is a statement about the molecule, not a count
             of bands: in a centrosymmetric one no mode is active in both
             techniques, so its dark list has entries of each kind. That is
             what is worth saying here, and counting the bands that carry
             both tags said something else and said it wrongly, since a
             folded row shows the tags of its lead branch. */
          /* By MODE, not by band. CO's stretch is Raman-dark and its Q branch
             is IR-dark, which is one mode seen twice, not two modes of
             opposite kinds; testing band by band called carbon monoxide
             centrosymmetric, which it is not. A family counts as dark to a
             technique only when every branch of it is. */
          const fams = new Map<string, Band[]>();
          for (const b of members) {
            const k = b.branch_group ?? b.id;
            fams.set(k, [...(fams.get(k) ?? []), b]);
          }
          const allDark = (fs: Band[], tag: string) => fs.every(b => b.tags.includes(tag));
          const hasIr = [...fams.values()].some(f => allDark(f, 'ir-inactive'));
          const hasRaman = [...fams.values()].some(f => allDark(f, 'raman-inactive'));
          return {
            label: speciesLabel(species),
            bands: members.slice().sort(byWnUp),
            note: hasIr && hasRaman
              ? 'Dark to one technique or the other, mode by mode: this molecule has a centre of symmetry, so what the infrared sees Raman cannot and the other way round. It takes both instruments to see all of it.'
              : undefined,
          };
        })
        .sort((a, b) => byWnUp(a.bands[0], b.bands[0]));
    },
  },
  {
    key: 'coverage-shift',
    wip: true,
    group: 'moved',
    teaser: 'Fill the surface and the same CO climbs: the neighbours are competing for the same metal electrons.',
    label: 'Coverage Shift',
    field: 'nothing yet: the band window holds the spread, the claim’s note the conditions',
    what: '',
    spotting: '',
    body: [
      'One CO molecule alone on a clean metal has a frequency of its own, its singleton. Put more CO on the surface beside it and that frequency moves, before any two molecules have touched: they are drawing on the same metal, and what each one gets changes. This is a chemical change in the bond, and it is the half of the coverage effect that survives when the through-space coupling of the Vibrational Coupling card is switched off [@monai].',
      'CO binds a metal in two directions at once. It donates the lone pair on its carbon, the 5σ orbital, into empty metal orbitals; the metal gives back into CO’s empty 2π*. The 2π* is antibonding between the carbon and the oxygen, so the more the metal gives back, the weaker the C-O bond and the lower the band [@monai]. Fill the surface and there is less metal to go round, each molecule gets less back-donation, its bond stiffens, and the band climbs.',
      {
        label: 'Which Way the Bond Moves',
        lines: [
          '\\ce{CO}\\,(5\\sigma) \\longrightarrow \\text{M} \\qquad \\tilde\\nu\\ \\text{up}',
          '\\text{M} \\longrightarrow \\ce{CO}\\,(2\\pi^{*}) \\qquad \\tilde\\nu\\ \\text{down}',
        ],
        note: 'The Dewar-Chatt-Duncanson picture. Free CO sits at 2143 cm⁻¹. Where the bond is essentially σ only, as on a coordinatively unsaturated cation, ν(CO) lies above that value, and how far above follows the cation’s ratio of charge to radius; where the metal has d electrons to give back it drops below 2100, linear between 2100 and 1900, bridged below 1900, three-coordinated below 1800 [@davydov, pp. 95–96].',
        tone: 'ir',
      },
      'Which way coverage pushes is not the same on every metal, and on copper it reverses. Woodruff and co-workers read it off where the metal’s Fermi level sits: the 2π* broadens against the metal band and splits into a lower level and an upper one, and only the lower can be filled. On palladium that lower level lies above the Fermi level, so broadening it further with coverage empties it, back-donation falls and the band climbs. On copper it lies below, so broadening fills it, back-donation rises and the band falls [@monai].',
      'The two extremes are worth carrying as numbers. Atop CO on Pd(100) climbs by almost 100 cm⁻¹, from 1895 to 1997, as the coverage goes from nothing to about 0.8, and roughly 60 of those 100 are chemical. Atop CO on Cu(110) moves by 6, from 2088 to 2094 [@monai]. That 6 is not a small effect: it is a chemical redshift of about −44 cm⁻¹ cancelling a coupling blueshift of about +50 [@monai]. On platinum the chemical part is negligible and essentially the whole shift is coupling [@monai].',
      'The trap is that a fuller surface and a different site move the band the same way, and one spectrum cannot tell them apart. Heal, Leisegang and Torrington watched the CO band on Ni/SiO₂ move down as they heated and read it as CO sitting on weakly binding sites when cold and strongly binding ones when hot, which is backwards for an adsorption energy. What was falling was the coverage [@monai].',
      'The atlas has no coverage field. Each adsorbed-CO band carries a window wide enough to hold the whole spread, and where a paper states the pressure, the temperature or the coverage it worked at, that sits in the claim’s note. Two rows on one band at different numbers are more often two coverages than two species.',
    ],
    related: [
      { key: 'vibrational-coupling', why: 'The other half of the shift, and the only way to separate them' },
      { key: 'site-sensitivity', why: 'The shift that is a different site rather than a fuller one' },
      { key: 'dipole', why: 'Why a stiffer C-O bond moves the band at all' },
    ],
    /**
     * The adsorbed-CO families, because that is where the effect is
     * documented and where the atlas's windows are widened by it. No field
     * records coverage, so the window itself is the evidence: the note says
     * how wide each family's is.
     */
    find(bands) {
      const FAMILIES = [
        { group: 'co_metal', label: 'CO on a reduced metal' },
        { group: 'co_cation', label: 'CO on a cation' },
      ];
      const out: Example[] = [];
      for (const f of FAMILIES) {
        const members = bands
          .filter(b => b.species === 'co' && b.phase === 'adsorbed' && b.group === f.group)
          .sort(byWnUp);
        if (!members.length) continue;
        const lo = Math.min(...members.map(b => b.wn_min));
        const hi = Math.max(...members.map(b => b.wn_max));
        out.push({
          label: f.label,
          bands: members,
          note:
            `${hi - lo} cm⁻¹ from the bottom of the lowest window to the top of the highest. ` +
            'Coordination sets most of that spread; coverage moves each band inside it by tens of cm⁻¹, ' +
            'and nothing in the atlas records which claim was measured at what coverage.',
        });
      }
      return out;
    },
  },
  {
    key: 'vibrational-coupling',
    wip: true,
    group: 'moved',
    teaser: 'Neighbouring oscillators vibrate as one. The in-phase mode takes the intensity, and it sits high.',
    label: 'Vibrational Coupling',
    field: 'nothing: resolved from how close the adsorbed-CO bands lie to each other',
    what: '',
    spotting: '',
    body: [
      'A CO molecule on a metal carries a dipole that swings as it vibrates, and its neighbours feel the field of that swing. Molecules close enough to feel each other stop being independent oscillators: they become one system with collective normal modes, as many of them as there are molecules [@monai]. No bond has changed length and the metal has given away nothing more. Only the arrangement of neighbours is different, which is why this is the through-space half of a coverage shift and the Coverage Shift card is the other.',
      'Take two identical CO molecules standing parallel. They have two collective modes, one with the dipoles in phase and one against. The in-phase mode is the higher of the two, and it is the only one with a net dipole change, so it is the only one that absorbs; the out-of-phase mode cancels itself and is dark. For a singleton at 2100 cm⁻¹ and a realistic polarizability the two land at 2106 and 2094, and the spectrum shows one band 6 cm⁻¹ above the singleton [@monai].',
      {
        label: 'What Sets the Size of It',
        lines: ['V_{12} \\;\\propto\\; \\frac{\\alpha_v}{d^{3}}'],
        note: 'αᵥ: the vibrational polarizability, which is also what makes a molecule absorb strongly; d: the distance between neighbours, which falls as the surface fills. So a strong absorber packed close couples hard, and CO on a working catalyst is exactly that case. The effect is already significant at about 10 % coverage [@monai].',
        tone: 'ir',
      },
      'Add molecules and the same thing happens on a larger scale. N coupled oscillators have N collective modes, and almost all of the intensity goes into the one with every molecule in phase, which is the highest of them. A line of five CO with a singleton of 2077 cm⁻¹ puts its band 9 cm⁻¹ up; a three-by-three patch of nine puts it 16 cm⁻¹ up [@monai].',
      {
        label: 'What Coupling Does to a Spectrum',
        lines: [
          '\\begin{array}{ll}' +
            '\\text{blueshift} & \\text{up to about } \\qty{50}{cm^{-1}} \\text{ as the surface fills} \\\\' +
            '\\text{intensity transfer} & \\text{the highest-frequency mode takes it} \\\\' +
            '\\text{spurious bands} & \\text{more bands than there are species} \\\\' +
            '\\text{lost proportionality} & \\text{area stops tracking coverage}' +
            '\\end{array}',
        ],
        note: 'The first is the one everybody knows and the other three are the ones that break an assignment. The integrated area of an adsorbed-CO band is linear in coverage only up to about 30 %; beyond that it flattens and can even fall, because the molecules screen each other and the absorption per molecule drops [@monai].',
        wide: true,
      },
      'Intensity transfer is where this stops being a correction and starts being a wrong answer. When two kinds of CO couple, the collective modes belong to the whole system rather than to either kind, so the band that grows is not the band of the molecules that are there. A minority species holding under 5 % of the surface can carry the most intense band in the spectrum, if its singleton is the highest one in the array [@monai]. On copper, where an undercoordinated site sits above a terrace, that makes the defects look dominant and the terraces vanish: Pritchard’s polycrystalline copper foils showed no terrace band at all. On platinum the frequencies run the other way and it is the defects that go missing [@monai].',
      'So there is no one-to-one correspondence between a band and a kind of site, and that is the finding rather than a caveat attached to one. Greenler and Brandt’s own model of a 4.2 nm platinum particle puts thirteen CO molecules on four kinds of site and produces three bands, each a collective mode running across several kinds of CO at once [@monai]. Elgayyar and co-workers arrive at the same place from the other end for gold: the absence of a band above 2080 cm⁻¹ has been read more than once as the absence of gold from the surface, when restructured gold gives its bands at 2080 to 2060 [@elgayyar, p. 63].',
      'Coupling needs the neighbours to vibrate at nearly the same frequency, and it falls away once the singletons are more than about 200 cm⁻¹ apart [@monai]. That is the handle. Mix a little ¹³CO into ¹²CO and each ¹²CO finds itself surrounded by molecules some 50 cm⁻¹ away, which drops the coupling by about an order of magnitude and touches nothing else: same molecule, same bond, same site, one heavier nucleus [@monai]. ¹³C¹⁸O against ¹²C¹⁶O doubles the separation to 100 cm⁻¹ and breaks it further [@monai].',
      'Diluting at a fixed coverage is what splits a measured shift into its two halves. The coupling part is the difference between pure ¹³CO and ¹³CO at infinite dilution; the chemical part is what is left once the dilution is extrapolated down to zero coverage [@monai]. Crossley and King measured 35 cm⁻¹ of coupling in the CO/Pt(111) shift that way, and Linke and co-workers 26 cm⁻¹ for CO/Rh(111) [@monai]. It also gives back the bands that intensity transfer had hidden, since a ¹²CO on a defect surrounded by ¹³CO has nothing left to lend its intensity to [@monai].',
      'None of this is confined to metals. CO and NO on the cations of an oxide couple at high coverage in the same way, and singletons on those have been recovered by the same trick of an isotopic mixture [@davydov, p. 275].',
      'Monai’s proposal is to stop treating the dilution as a separate characterisation and run it under reaction conditions instead, feeding an operando cell a mixed ¹³CO₂/¹²CO₂ or ¹³CO/¹²CO stream and following the exhaust by mass spectrometry: Mixed Isotope Operando Infrared Spectroscopy, MIOIRS [@monai]. The atlas carries mioirs as a technique value for it. Nothing is recorded under it yet.',
      'Nothing in the data records coupling, and the atlas is in no position to correct for it. What it does do is keep the ¹³CO band as a band of its own rather than as a second number on the ¹²CO one, which is the shape a dilution experiment has to be recorded in.',
    ],
    related: [
      { key: 'coverage-shift', why: 'The chemical half of the same shift' },
      { key: 'isotopologue', why: '¹³CO is the tool here, not only a heavier twin' },
      { key: 'dipole', why: 'The oscillating dipole the neighbours feel' },
      { key: 'degeneracy', why: 'The other place where modes at one frequency give one band' },
    ],
    /**
     * Which adsorbed-CO bands are close enough to couple, read straight off
     * their positions. Nothing in the data records coupling, so the resolver
     * reads the one thing that decides it: how far apart two singletons are.
     * Monai's two thresholds are the boundaries, strong coupling below about
     * 30 cm-1 and essentially none beyond about 200.
     */
    find(bands) {
      const REACH = 200;
      const STRONG = 30;
      const centre = (b: Band) => (b.wn_min + b.wn_max) / 2;
      const co = bands
        .filter(b => b.species === 'co' && b.phase === 'adsorbed')
        .sort((x, y) => centre(x) - centre(y));
      const out: Example[] = [];
      for (let i = 0; i + 1 < co.length; i++) {
        const lo = co[i];
        const hi = co[i + 1];
        const gap = Math.round(centre(hi) - centre(lo));
        if (gap > REACH) continue;
        const twins = hi.isotopologue_of === lo.id || lo.isotopologue_of === hi.id;
        out.push({
          label: `${vibrationName(lo)} with ${vibrationName(hi)}`,
          bands: [lo, hi],
          note: twins
            ? `${gap} cm⁻¹ apart, and the same mode on two isotopes: this is the separation a dilution experiment buys, wide enough to break the coupling and narrow enough to leave the chemistry alone.`
            : gap <= STRONG
              ? `${gap} cm⁻¹ apart: close enough to couple strongly, so the pair is one system rather than two bands.`
              : `${gap} cm⁻¹ apart: within reach, though the coupling weakens as the separation grows.`,
        });
      }
      return out;
    },
  },
  {
    key: 'site-sensitivity',
    wip: true,
    group: 'moved',
    teaser: 'The same species on a different site vibrates at a different wavenumber.',
    label: 'Site Sensitivity',
    field: 'the "site-sensitive" tag',
    what: '',
    spotting: '',
    find(bands) {
      return bands
        .filter(b => b.tags.includes('site-sensitive'))
        .sort(byWn)
        .map(b => ({ label: b.short || b.id, bands: [b] }));
    },
  },
];

/** Every citekey backing a set of bands, in first-seen order. */
export function citekeysFor(bands: Band[]): string[] {
  const out: string[] = [];
  for (const b of bands) {
    for (const r of b.references) if (!out.includes(r.key)) out.push(r.key);
  }
  return out;
}

/**
 * The harmonic isotope shift, and how far the atlas departs from it.
 *
 * Substituting an atom changes the mass and not the electronic structure, so
 * the force constant is the same and only the reduced mass moves:
 *
 *     ν̃ = (1 / 2πc) √(k / μ),   so   ν̃' / ν̃ = √(μ / μ')
 *
 * For a stretch localised on one bond that is a real prediction, good to about
 * a percent. It is a prediction and never a measurement: what it leaves out is
 * the interesting part.
 *
 *   - It is harmonic. A real X-H stretch is anharmonic, and the observed shift
 *     comes out a little smaller than √(μ/μ') asks for.
 *   - It is pseudo-diatomic. A normal mode is a motion of the whole molecule,
 *     and only where one bond dominates does a two-atom μ describe it. A bend
 *     is the clearest failure: methane's δ is four hydrogens moving against a
 *     carbon that barely moves at all, and no single pair is the mode.
 *   - It assumes the level is where it would be. Across a Fermi resonance it
 *     is not: substitution detunes the resonance, both partners move, and the
 *     shift is no longer about mass. Methanol's ν(CH) multiplet is that case.
 *
 * So the table this module feeds is a comparison, and the residual column is
 * the point of it.
 */
import type { Band } from './types';

/**
 * Masses in u, of the specific nuclide rather than the element average. For
 * the light elements the two are the same number to four figures, natural
 * hydrogen being 99.98% ¹H and natural oxygen 99.76% ¹⁶O.
 *
 * The metals are the exception and are the standard atomic weight, because
 * they are not what was substituted: the sample holds natural gallium, a
 * 60/40 mix of ⁶⁹Ga and ⁷¹Ga, and the partner in the reduced mass is that
 * mixture. It hardly matters either way, a heavy partner being nearly
 * irrelevant to μ: taking ⁶⁹Ga alone moves the Ga–H/Ga–D ratio by 0.02%,
 * against the 1.3% by which the harmonic model misses this band anyway.
 */
const MASS: Record<string, number> = {
  H: 1.00783,
  D: 2.01410,
  C: 12.0,
  '13C': 13.00335,
  N: 14.00307,
  O: 15.99491,
  '18O': 17.99916,
  // Standard atomic weights: never substituted, only ever the partner.
  Zn: 65.38,
  Ga: 69.723,
};

/** `band.isotope` -> which element is substituted, and by what. */
const SUBSTITUTION: Record<string, { element: string; from: string; to: string }> = {
  D: { element: 'H', from: 'H', to: 'D' },
  '¹³C': { element: 'C', from: 'C', to: '13C' },
  '¹⁸O': { element: 'O', from: 'O', to: '18O' },
};

/** Reduced mass of a two-body oscillator, in u. */
export function reducedMass(a: number, b: number): number {
  return (a * b) / (a + b);
}

/** The atoms named in an `atoms` string, in order: "H-C-H" -> [H, C, H]. */
function atomTokens(atoms: string): string[] {
  return atoms
    .split(/[-=≡]/)
    .map(t => t.trim())
    .filter(Boolean);
}

export interface ShiftRow {
  child: Band;
  parent: Band;
  /** The label as authored: D, ¹³C, ¹⁸O. */
  isotope: string;
  /** The bond the estimate treats as the oscillator, e.g. "C–H". */
  bond: string | null;
  /** ν̃' / ν̃ = √(μ/μ'), or null where the bond could not be read. */
  ratio: number | null;
  /** Band centres, in cm⁻¹. */
  parentWn: number;
  childWn: number;
  /** Where the harmonic ratio puts the child. */
  predicted: number | null;
  /** Observed minus predicted, in cm⁻¹. Positive: the band sits high. */
  residual: number | null;
  /** The same as a percentage of the observed position. */
  residualPct: number | null;
  /**
   * Why the estimate does not apply, or null where it does. A row keeps its
   * numbers either way: a bend's residual is not an error in the data, it is
   * the size of the thing the model leaves out.
   */
  caveat: string | null;
  /**
   * The same named rather than merely flagged, for a pill on a row. Each
   * word is the actual phenomenon, so the reader learns something from the
   * list instead of only being warned off it:
   *
   *   delocalised    the mode spans more than one pair of atoms, so a
   *                  two-body reduced mass is not what is vibrating
   *   mode mixing    the normal mode is a mixture of internal coordinates,
   *                  so loading one of them drags on a mode that does not
   *                  contain the substituted atom at all. This is the
   *                  intramolecular, mechanical kind of coupling, NOT the
   *                  through-space dipole coupling between neighbouring
   *                  adsorbates that the Vibrational Coupling card covers
   *   generic metal  the partner is the M placeholder and has no mass
   *   unlabelled     no substitution was recorded on the child
   */
  caveatShort: string | null;
  /**
   * How loudly to say it. `alert` where taking the number for a prediction
   * would mislead badly: mode mixing puts formate's OCO stretches 27% out.
   * `limit` where the model is merely out of scope and the row is sound.
   */
  caveatTone: 'alert' | 'limit' | null;
}

const centre = (b: Band) => (b.wn_min + b.wn_max) / 2;

/**
 * Every isotopologue link in the dataset, with the harmonic prediction beside
 * the recorded position. Ordered by how badly they disagree, worst last: the
 * table is read to see how well mass alone does, and the tail is the answer.
 */
export function isotopeShiftRows(bands: Band[]): ShiftRow[] {
  const byId = new Map(bands.map(b => [b.id, b]));
  const rows: ShiftRow[] = [];

  for (const child of bands) {
    if (!child.isotopologue_of) continue;
    const parent = byId.get(child.isotopologue_of);
    if (!parent) continue;

    const sub = child.isotope ? SUBSTITUTION[child.isotope] : undefined;
    const tokens = atomTokens(child.atoms);

    let bond: string | null = null;
    let ratio: number | null = null;
    let caveat: string | null = null;
    let caveatShort: string | null = null;
    let caveatTone: 'alert' | 'limit' | null = null;

    if (!sub) {
      caveat = 'no substitution recorded';
      caveatShort = 'unlabelled';
      caveatTone = 'limit';
    } else {
      // The substituted atom, and whatever it is bonded to. In "H-C-H" the
      // deuterium is an H and its partner is the carbon; in "O-C-O" the
      // labelled oxygen's partner is the carbon; in "C-O" either reading
      // gives the same pair.
      const i = tokens.findIndex(t => t === sub.element);
      const partner = i === -1 ? undefined : (tokens[i + 1] ?? tokens[i - 1]);
      const partnerMass = partner ? MASS[partner] : undefined;

      if (i === -1) {
        // The labelled atom is not in the bond this band names: deuterating
        // the methyl moves methanol's C-O stretch, but not by loading the C-O
        // bond. Whatever moved, moved through the coupling between the two.
        /* No inner colon: the sentence is quoted after one already. */
        caveat = `no ${sub.to.replace('13', '¹³').replace('18', '¹⁸')} in ${child.atoms}, so nothing in this oscillator got heavier, and whatever moved the band moved through mechanical coupling to a neighbouring coordinate rather than through mass`;
        caveatShort = 'mode mixing';
        caveatTone = 'alert';
      } else if (partnerMass === undefined) {
        caveat = `${partner} is a stand-in for whichever metal, so it has no mass`;
        caveatShort = 'generic metal';
        caveatTone = 'limit';
      } else {
        /* Heavier atom first, the way the atlas names a mode: the row above
           this sentence says ν(Ga-H), so the sentence cannot say H–Ga. */
        bond = MASS[sub.from] > partnerMass
          ? `${sub.from}–${partner}`
          : `${partner}–${sub.from}`;
        const mu = reducedMass(MASS[sub.from], partnerMass);
        const muPrime = reducedMass(MASS[sub.to], partnerMass);
        ratio = Math.sqrt(mu / muPrime);
        if (child.vibration.category !== 'stretch') {
          caveat = `a ${child.vibration.category}: no single pair of atoms is the mode, so a two-body reduced mass describes something the molecule is not doing`;
          caveatShort = 'delocalised';
          caveatTone = 'limit';
        }
      }
    }

    const parentWn = centre(parent);
    const childWn = centre(child);
    const predicted = ratio === null ? null : parentWn * ratio;
    const residual = predicted === null ? null : childWn - predicted;

    rows.push({
      child,
      parent,
      isotope: child.isotope ?? '',
      bond,
      ratio,
      parentWn,
      childWn,
      predicted,
      residual,
      residualPct: residual === null ? null : (residual / childWn) * 100,
      caveat,
      caveatShort,
      caveatTone,
    });
  }

  /* The rows the estimate applies to first, best agreement at the top, then
     the ones it does not, on their own below. Sorting purely by error would
     interleave the two and the table would stop being a test of anything. */
  rows.sort((a, b) => {
    if (!a.caveat !== !b.caveat) return a.caveat ? 1 : -1;
    const aa = a.residualPct === null ? Infinity : Math.abs(a.residualPct);
    const bb = b.residualPct === null ? Infinity : Math.abs(b.residualPct);
    return aa - bb;
  });
  return rows;
}

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
 * On the Knowledge page the phenomena are cards, grouped by what a reader
 * sees in a spectrum rather than by their physics: more bands than there are
 * modes, fewer, or bands that sit somewhere else (PATTERN_GROUPS). A
 * phenomenon that is really one of the basics at work says so with `into`,
 * and its examples appear inside that card instead of on a card of its own.
 */

import type { Band } from './types';
import type { Block } from './fundamentals';
import { speciesLabel } from './labels';

export interface Example {
  /** Short heading for this one occurrence. */
  label: string;
  /** The bands involved, in reading order. */
  bands: Band[];
  /** One line on what makes this occurrence worth showing. */
  note?: string;
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
    find(bands) {
      const byId = bandById(bands);
      return bands
        .filter(b => b.isotopologue_of)
        .map(child => {
          const parent = byId.get(child.isotopologue_of!);
          return {
            label: `${child.isotope ?? 'isotope'}: ${child.short || child.id}`,
            bands: parent ? [parent, child] : [child],
            note: parent
              ? `About ${Math.round(parent.wn_min - child.wn_min)} cm⁻¹ below the natural-abundance band.`
              : undefined,
          };
        });
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
    teaser: 'Two motions at one frequency give one band. Lower the symmetry and it can split.',
    label: 'Degeneracy',
    field: 'the "degenerated" tag',
    what: '',
    spotting: '',
    find(bands) {
      return bands
        .filter(b => b.tags.includes('degenerated'))
        .sort(byWn)
        .map(b => ({ label: b.short || b.id, bands: [b] }));
    },
  },
  {
    key: 'ir-inactive',
    // The selection rule at work: its examples live on the Selection rules card.
    into: 'selection',
    teaser: 'A vibration that leaves the dipole unchanged has no IR band.',
    label: 'Infrared-Inactive Modes',
    field: 'the "ir-inactive" tag',
    what: '',
    spotting: '',
    find(bands) {
      return bands
        .filter(b => b.tags.includes('ir-inactive'))
        .sort(byWn)
        .map(b => ({ label: b.short || b.id, bands: [b] }));
    },
  },
  {
    key: 'site-sensitivity',
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

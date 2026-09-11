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
  /** Which field in the data records it. Factual, not editorial. */
  field: string;
  /** Pull the real occurrences out of the dataset. */
  find: (bands: Band[]) => Example[];
}

const byWn = (a: Band, b: Band) => b.wn_max - a.wn_max;

function bandById(bands: Band[]): Map<string, Band> {
  return new Map(bands.map(b => [b.id, b]));
}

export const PHENOMENA: Phenomenon[] = [
  {
    key: 'fermi',
    group: 'more',
    teaser: 'Two levels at nearly the same energy mix, share their intensity and push apart.',
    label: 'Fermi Resonance',
    field: 'fermi_partner / fermi_partner_group',
    what: '',
    spotting: '',
    find(bands) {
      const byId = bandById(bands);
      const seen = new Set<string>();
      const out: Example[] = [];
      for (const b of bands) {
        if (!b.fermi_partner || seen.has(b.id)) continue;
        const partner = byId.get(b.fermi_partner);
        if (!partner) continue;
        seen.add(b.id);
        seen.add(partner.id);
        out.push({
          label: `${b.short || b.id} + ${partner.short || partner.id}`,
          bands: [b, partner].sort(byWn),
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
      const vibration = (b: Band) => (b.short || b.id).replace(/\s*\([PQR]\)$/, '');
      const listed = new Set<string>();
      for (const [key, members] of groups) {
        const partners = bands.filter(b => b.branch_group === key);
        if (!partners.length) continue;
        const all = [...new Map([...members, ...partners].map(b => [b.id, b])).values()].sort(byWn);
        const id = all.map(b => b.id).sort().join('|');
        if (listed.has(id)) continue;
        listed.add(id);
        out.push({
          label: `${vibration(members[0])} + ${vibration(partners[0])}`,
          bands: all,
          note: 'Resonance with a whole branch group: the partner vibration is itself split into R/P/Q.',
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
    teaser: 'A free molecule also rotates, so its band splits into P, Q and R branches.',
    label: 'Rotational Branches',
    field: 'branch_group',
    what: '',
    spotting: '',
    body: [
      'A free molecule turns while it vibrates, on the ladder of rotational levels the Rotation Modes card describes, and one photon can change both at once. A vibrational transition therefore changes J as well: by +1 or −1, and by 0 where the symmetry allows it. Each starting level J gives a line of its own, so a gas-phase band is not one line but a row of them, gathered into branches.',
      {
        label: 'Branches',
        lines: ['R:  ΔJ = +1   higher wavenumber', 'Q:  ΔJ = 0    band centre', 'P:  ΔJ = −1   lower wavenumber'],
        note: 'The top row of the diagram builds R and P arrow by arrow: each arrow is one line of the spectrum beside it.',
      },
      {
        label: 'Where the Lines Sit',
        lines: ['R(J):  ν₀ + 2B(J + 1)', 'P(J):  ν₀ − 2BJ'],
        note: 'ν₀: the band centre, B: the rotational constant, J: the starting level. The rigid rotor, one B for both levels; in fact B shrinks a little in v = 1, so the R lines crowd together as J rises and the P lines spread apart.',
      },
      'How tall each line is follows how full its starting level is, the room-temperature population on the Rotation Modes card: the lines rise from the centre to a maximum near J ≈ 7 for CO and fade beyond. At the few cm⁻¹ resolution usual for catalyst spectra, lines 3.9 cm⁻¹ apart for CO, and closer still for heavier molecules, blur into two lobes, the P and R envelopes, with a dip between them where the band centre is.',
      'Whether a Q branch appears depends on the direction of the dipole change. In a linear molecule, a vibration that swings the dipole along the axis, such as the stretch of CO or the asymmetric stretch of CO₂, has none; one that swings it across the axis, such as the bend of CO₂, has a strong one, all its lines piled up at the centre. Gas-phase acetylene in a reflection cell shows the P and R pair: its asymmetric C–H stretch appears as two branches, at 3269 and 3309 cm⁻¹ [@trenary, p. 56].',
      'Rotation can also be excited alone, J → J + 1 with no vibration, by a photon in the microwave or far infrared, well below the mid-infrared window. That rule mirrors the IR one: the molecule must carry a permanent dipole for the field to turn it. CO has one; CO₂, N₂ and CH₄ have none. Raman sees rotation through the polarizability instead, wherever the cloud is longer than it is wide, so N₂ and CO₂ show pure rotational Raman lines close to the laser.',
      'The branches are the mark of a free molecule. Adsorbed, a molecule cannot turn, and it gives one band per mode where its gas gives an envelope; the envelope of a gas-phase reactant in the cell is something to subtract, not a surface species. The atlas records each branch of a gas-phase band as a band of its own, grouped with its siblings by branch_group, and the chart keeps a group on one line.',
    ],
    find(bands) {
      const groups = new Map<string, Band[]>();
      for (const b of bands) {
        if (!b.branch_group) continue;
        const list = groups.get(b.branch_group) ?? [];
        list.push(b);
        groups.set(b.branch_group, list);
      }
      // Headed by the vibration the branches belong to, not the group id.
      return [...groups.values()].map(members => ({
        label: (members[0].short || members[0].id).replace(/\s*\([PQR]\)$/, ''),
        bands: members.sort(byWn),
        note: `${members.length} branches: ${members
          .map(m => m.vibration.branch ?? '?')
          .join(', ')}.`,
      }));
    },
  },
  {
    key: 'combination',
    group: 'more',
    teaser: 'Two rungs at once, or two modes at once: weak bands near sums of the fundamentals.',
    label: 'Combinations and Overtones',
    field: 'based_on[] + the "overtone" tag',
    what: '',
    spotting: '',
    find(bands) {
      const byId = bandById(bands);
      return bands
        .filter(b => b.vibration.category === 'combination' || b.tags.includes('overtone'))
        .sort(byWn)
        .map(b => {
          const parents = b.based_on
            .map(bo => (bo.band_id ? byId.get(bo.band_id) : undefined))
            .filter((x): x is Band => Boolean(x));
          const named = b.based_on
            .map(bo => bo.label ?? bo.branch_group ?? '')
            .filter(Boolean);
          return {
            label: b.short || b.id,
            bands: [b, ...parents],
            note: named.length ? `Also built on: ${named.join(', ')}.` : undefined,
          };
        });
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

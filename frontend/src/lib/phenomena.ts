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
 * written yet. Fill in `what` and `spotting` (and drop a diagram in beside
 * them) and the section becomes a real explanation; leave them empty and the
 * page says so rather than pretending.
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
  { key: 'more', label: 'More bands than modes', note: 'Where extra bands come from' },
  { key: 'fewer', label: 'Fewer bands than modes', note: 'Where bands merge' },
  { key: 'moved', label: 'Bands that move', note: 'What shifts a band without changing the mode' },
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
    label: 'Fermi resonance',
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
    label: 'Isotopic shift',
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
    label: 'Rotational branches',
    field: 'branch_group',
    what: '',
    spotting: '',
    find(bands) {
      const groups = new Map<string, Band[]>();
      for (const b of bands) {
        if (!b.branch_group) continue;
        const list = groups.get(b.branch_group) ?? [];
        list.push(b);
        groups.set(b.branch_group, list);
      }
      return [...groups.entries()].map(([key, members]) => ({
        label: key,
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
    label: 'Combinations and overtones',
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
    label: 'Infrared-inactive modes',
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
    label: 'Site sensitivity',
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

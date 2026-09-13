/**
 * Citations in authored prose: `[@alias, locator]` markers turned into
 * numbered superscripts plus the list they point at.
 *
 * Used by the Knowledge cards (lib/fundamentals.ts). A marker names either an
 * alias from SOURCES, which carries the citekey and the chapter, or a citekey
 * directly. The locator is free text (`p. 4`, `Eq. (1.6)`). Numbers are given
 * in order of first appearance, one per source (a chapter counts as one), so
 * the list at the bottom of a card reads top to bottom with the text and
 * stays short; each entry collects every locator cited from it, and the
 * superscript's own locator goes in its tooltip.
 *
 * Text stays plain Unicode (see the notation rules in CLAUDE.md); the markers
 * are the only syntax, and anything that is not a marker passes through.
 */

export const WACHS = 'Wachs.SpringerHandbookAdvanced.2023';

export interface Source {
  /** Citekey in references.bib. */
  key: string;
  /** Which part of the work, when the citekey is a whole book. */
  chapter?: string;
}

/** The chapters of the handbook the Knowledge page draws on. */
export const SOURCES: Record<string, Source> = {
  busca: { key: WACHS, chapter: 'Ch. 1, G. Busca, “Infrared (IR) Spectroscopy”' },
  trenary: { key: WACHS, chapter: 'Ch. 3, R. Ranjan and M. Trenary, “Reflection Absorption Infrared Spectroscopy”' },
  negri: { key: WACHS, chapter: 'Ch. 2, C. Negri, M. Carosso, E. Vottero, E. Groppo and S. Bordiga, “Case Studies: Infrared (IR) Spectroscopy”' },
  moon: { key: WACHS, chapter: 'Ch. 4, J. Moon, M. Li, A. J. Ramirez-Cuesta and Z. Wu, “Raman Spectroscopy”' },
  stair: { key: WACHS, chapter: 'Ch. 6, P. C. Stair, “Ultraviolet (UV) Raman Spectroscopy”' },
  vogt: { key: WACHS, chapter: 'Ch. 11, C. Vogt, C. S. Wondergem and B. M. Weckhuysen, “Ultraviolet-Visible (UV-Vis) Spectroscopy”' },
  meunier: { key: 'Meunier.InadequateUnitSelection.2026' },
  armaroli: { key: 'Armaroli.DiffuseReflectionInfrared.2004' },
  li: { key: WACHS, chapter: 'Ch. 14, Q. Li, M. Anpo, J. You, T. Yan and X. Wang, “Photoluminescence (PL) Spectroscopy”' },
};

export interface Cited {
  n: number;
  key: string;
  chapter?: string;
  /** Every locator cited from this source, in order of first use. */
  locators: string[];
}

export type Segment = { text: string } | { cite: Cited; locator?: string };

const MARKER = /\[@([^\],\]]+?)(?:,\s*([^\]]+))?\]/g;

/** A numbering scope: one per card, so every card's list starts at 1. */
export function citer() {
  const list: Cited[] = [];
  const index = new Map<string, Cited>();

  function resolve(name: string, locator?: string): Cited {
    const src = SOURCES[name] ?? { key: name };
    let c = index.get(name);
    if (!c) {
      c = { n: list.length + 1, key: src.key, chapter: src.chapter, locators: [] };
      index.set(name, c);
      list.push(c);
    }
    if (locator && !c.locators.includes(locator)) c.locators.push(locator);
    return c;
  }

  function parse(text: string): Segment[] {
    const out: Segment[] = [];
    let last = 0;
    for (const m of text.matchAll(MARKER)) {
      // The space before a marker belongs to the sentence, not the superscript.
      const before = text.slice(last, m.index).replace(/\s+$/, '');
      if (before) out.push({ text: before });
      const locator = m[2]?.trim();
      out.push({ cite: resolve(m[1].trim(), locator), locator });
      last = (m.index ?? 0) + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }

  return { parse, list };
}

/** Every citekey a piece of text cites, in order, without numbering anything. */
export function citekeysIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(MARKER)) {
    const key = (SOURCES[m[1].trim()] ?? { key: m[1].trim() }).key;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Many locators folded into one line: the pages as ranges ("pp. 4–6, 22"),
 * then the equations ("Eqs. (1.5), (1.6)"), then anything else as written.
 * What a reader needs to find the passages, without the repetition.
 */
export function summarizeLocators(locs: string[]): string {
  const pages = new Set<number>();
  const eqs: string[] = [];
  const other: string[] = [];
  for (const l of locs) {
    if (/^pp?\./.test(l)) {
      const [a, b] = (l.match(/\d+/g) ?? []).map(Number);
      if (a !== undefined) {
        const end = b !== undefined && b >= a && b - a < 30 ? b : a;
        for (let p = a; p <= end; p++) pages.add(p);
      }
    } else if (/^Eqs?\./.test(l)) {
      for (const e of l.match(/\(\d+\.\d+\)/g) ?? []) if (!eqs.includes(e)) eqs.push(e);
    } else if (!other.includes(l)) {
      other.push(l);
    }
  }
  const sorted = [...pages].sort((x, y) => x - y);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  const pagePart = runs.length ? `${sorted.length > 1 ? 'pp.' : 'p.'} ${runs.join(', ')}` : '';
  // "(1.10)" after "(1.9)": chapter, then number, as integers, not decimals.
  const eqKey = (e: string) => (e.match(/\d+/g) ?? []).map(Number);
  eqs.sort((x, y) => {
    const [xa, xb] = eqKey(x);
    const [ya, yb] = eqKey(y);
    return xa - ya || xb - yb;
  });
  const eqPart = eqs.length ? `${eqs.length > 1 ? 'Eqs.' : 'Eq.'} ${eqs.join(', ')}` : '';
  return [pagePart, eqPart, ...other].filter(Boolean).join('; ');
}

/** The text with its markers removed, for places that cannot show them. */
export function stripCites(text: string): string {
  return text.replace(MARKER, '').replace(/\s+([.,;:])/g, '$1');
}

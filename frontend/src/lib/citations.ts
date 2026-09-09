export function strip(s: string | undefined): string {
  return (s ?? '').replace(/\{([^}]*)\}/g, '$1');
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function authorsIEEE(raw: string): string {
  const authors = raw.split(/\s+and\s+/i).map(a => a.trim());
  const fmt = authors.map(a => {
    let last: string, first: string;
    if (a.includes(',')) {
      [last, first] = a.split(',', 2).map(s => s.trim());
    } else {
      const words = a.split(/\s+/);
      last = words.pop() ?? '';
      first = words.join(' ');
    }
    const initials = first.split(/\s+/).filter(Boolean).map(n => n[0] + '.').join(' ');
    return initials ? `${initials} ${last}` : last;
  });
  if (fmt.length === 1) return fmt[0];
  if (fmt.length === 2) return `${fmt[0]} and ${fmt[1]}`;
  return fmt.slice(0, -1).join(', ') + ', and ' + fmt[fmt.length - 1];
}

export function ieeeHtml(ref: Record<string, string | undefined>, key: string): string {
  const author  = strip(ref['author']);
  const title   = strip(ref['title']);
  const journal = strip(ref['journaltitle'] ?? ref['journal'] ?? ref['booktitle']);
  const volume  = strip(ref['volume']);
  const number  = strip(ref['number']);
  const pages   = strip(ref['pages']).replace(/--/g, '–');
  const year    = strip(ref['date'] ?? ref['year']).slice(0, 4);
  const doi     = strip(ref['doi']);
  const url     = strip(ref['url']);

  const parts: string[] = [];
  if (author)  parts.push(esc(authorsIEEE(author)));
  if (title)   parts.push(`&ldquo;${esc(title)}&rdquo;`);
  if (journal) parts.push(`<em>${esc(journal)}</em>`);
  const detail = [
    volume && `vol.&nbsp;${esc(volume)}`,
    number && `no.&nbsp;${esc(number)}`,
    pages  && `pp.&nbsp;${esc(pages)}`,
  ].filter(Boolean) as string[];
  if (detail.length) parts.push(detail.join(', '));
  if (year) parts.push(esc(year));

  let s = parts.join(', ') + (parts.length ? '.' : esc(key));
  const href = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : url;
  if (href) s += ` <a class="ext" href="${href}" target="_blank" rel="noopener noreferrer">↗</a>`;
  return s;
}

/** Surnames only, in the order the BibTeX field lists them. */
export function citeSurnames(raw: string): string[] {
  return strip(raw)
    .split(/\s+and\s+/i)
    .map(a => a.trim())
    .filter(Boolean)
    .map(a => (a.includes(',')
      // "Vico van Berkel, Damián": everything before the comma is the surname,
      // particles included, which is why this is not a last-word split.
      ? a.split(',')[0].trim()
      : (a.split(/\s+/).pop() ?? '')));
}

/**
 * Surnames for a compact citation: one, two joined by "and", or the first
 * followed by "et al." Three names in a chip is already a paragraph.
 */
export function citeAuthors(raw: string, max = 2): string {
  const names = citeSurnames(raw);
  if (names.length === 0) return '';
  if (names.length <= max) return names.join(' and ');
  return `${names[0]} et al.`;
}

export function citeYear(ref: Record<string, string | undefined>): string {
  return strip(ref['date'] ?? ref['year']).slice(0, 4);
}

/** The abbreviation the entry carries, or the full name when it has none. */
export function citeJournal(ref: Record<string, string | undefined>): string {
  return strip(
    ref['shortjournal'] ?? ref['journaltitle'] ?? ref['journal'] ?? ref['booktitle'],
  );
}

/**
 * "Fehr and Krossing (2020), ChemCatChem" — enough to recognise a paper
 * without reading a full citation, for the places that show a row of them.
 *
 * Plain text, not HTML: it goes in a chip, not in a bibliography. Falls back
 * to the citekey when the entry has no author, so a row never renders empty.
 */
export function shortCite(
  ref: Record<string, string | undefined>,
  key: string,
  opts: { journal?: boolean } = {},
): string {
  const authors = citeAuthors(strip(ref['author'] ?? ''));
  const year = citeYear(ref);
  const journal = opts.journal === false ? '' : citeJournal(ref);
  if (!authors) return key;
  const head = year ? `${authors} (${year})` : authors;
  return journal ? `${head}, ${journal}` : head;
}

export function refSortKey(ref: Record<string, string | undefined>): string {
  const a = strip(ref['author']);
  const y = strip(ref['date'] ?? ref['year']).slice(0, 4);
  const first = a.split(/\s+and\s+/i)[0].trim();
  const last = first.includes(',')
    ? first.split(',')[0].trim()
    : (first.split(/\s+/).pop() ?? '');
  return (last + y).toLowerCase();
}

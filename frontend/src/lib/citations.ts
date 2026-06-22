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

export function refSortKey(ref: Record<string, string | undefined>): string {
  const a = strip(ref['author']);
  const y = strip(ref['date'] ?? ref['year']).slice(0, 4);
  const first = a.split(/\s+and\s+/i)[0].trim();
  const last = first.includes(',')
    ? first.split(',')[0].trim()
    : (first.split(/\s+/).pop() ?? '');
  return (last + y).toLowerCase();
}

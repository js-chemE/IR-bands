/**
 * Headers are written in Title Case: every major word capitalised, the
 * minor ones (articles, short conjunctions and prepositions) left small
 * unless they open the header or follow a colon.
 *
 * Applied where a header is rendered from text written for other purposes
 * (the formula boxes' labels); headers authored as such are simply written
 * that way. Only a word that starts with a lowercase ASCII letter is
 * touched, so formulas, Greek symbols and units pass through (CO₂, ν₁, cm⁻¹).
 */

const MINOR = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'as', 'at', 'by', 'for', 'from',
  'in', 'of', 'on', 'per', 'than', 'to', 'via', 'vs', 'with',
]);

/** A symbol that keeps its case: a variable or a unit, not a word. */
const KEEP = new Set(['kT', 'v', 'cm⁻¹', 'pH']);

const capitalise = (part: string) =>
  /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part;

export function titleCase(text: string): string {
  const words = text.split(' ');
  return words
    .map((w, i) => {
      if (KEEP.has(w)) return w;
      const opens = i === 0 || /:$/.test(words[i - 1]);
      if (!opens && i < words.length - 1 && MINOR.has(w)) return w;
      // Hyphens and en dashes join words that are each capitalised.
      return w.split(/(?<=[-–])/).map(capitalise).join('');
    })
    .join(' ');
}

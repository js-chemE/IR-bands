/**
 * Sub/superscript notation.
 *
 * House rule: text in the data files is written with real Unicode characters
 * (CO₂, cm⁻¹, Cu²⁺, ν₁), never with markup. The one exception is a label whose
 * subscript is a letter Unicode has no subscript for, which in practice means
 * point-group and Mulliken symbols (D∞h, C2v, Σg⁺); those two fields carry
 * literal <sub>/<sup> tags and are rendered with {@html}. See the Notation
 * section of the Style guide page.
 *
 * `htmlToUnicode` is the safety net for plain-text surfaces (the chart tooltip
 * is one): it turns any tags that did slip in into the equivalent characters
 * and drops everything else. It is a fallback, not a licence to write markup.
 */

export const SUB_CHARS: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','h':'ₕ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ',
  'p':'ₚ','s':'ₛ','t':'ₜ','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};

export const SUP_CHARS: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ',
};

/** Letters with no Unicode subscript. This gap is the whole reason for the exception. */
export const MISSING_SUBSCRIPT_LETTERS: string[] = 'abcdefghijklmnopqrstuvwxyz'
  .split('')
  .filter(c => !(c in SUB_CHARS));

export function htmlToUnicode(text: string): string {
  if (!text) return text;
  return text
    .replace(/<sub>([^<]*)<\/sub>/gi, (_, inner: string) =>
      [...inner].map(c => SUB_CHARS[c] ?? c).join(''))
    .replace(/<sup>([^<]*)<\/sup>/gi, (_, inner: string) =>
      [...inner].map(c => SUP_CHARS[c] ?? c).join(''))
    .replace(/<[^>]+>/g, ''); // strip any remaining tags
}

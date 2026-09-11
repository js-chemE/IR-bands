<script lang="ts" context="module">
  /**
   * One line of a formula box, with its fractions stacked.
   *
   * The source stays plain Unicode: a fraction is written with spaces round
   * the slash, "hc / λ", "(∂μ / ∂Q)₀", "I₀(new) / I₀(old)", and is set as a
   * numerator over a denominator. A slash without spaces is not a fraction:
   * units (kJ/mol) and names (log(1/R)) stay on the line. In running text the
   * same formulas stay inline; only the boxes stack.
   *
   * An operand is a run of symbol characters, a bracketed group, or a symbol
   * followed by its bracketed argument (I(Stokes), λ(laser)), with any
   * trailing super- or subscripts. Brackets that only wrap an operand are
   * dropped once it stands in a fraction; (1 − R)² keeps its own.
   */
  export type Part = { text: string } | { num: string; den: string };

  const BOUND = /[\s()=+·,≈→≠∝×|⟨⟩[\]]/;
  const POSTFIX = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₒₓₕₖₗₘₙₚₛₜ′]/;

  function matchOpen(s: string, close: number): number {
    let depth = 0;
    for (let i = close; i >= 0; i--) {
      if (s[i] === ')') depth++;
      else if (s[i] === '(' && --depth === 0) return i;
    }
    return -1;
  }
  function matchClose(s: string, open: number): number {
    let depth = 0;
    for (let i = open; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')' && --depth === 0) return i;
    }
    return -1;
  }

  /** Start of the operand that ends at index `end` (inclusive). */
  function leftStart(s: string, end: number): number {
    let k = end;
    while (k >= 0 && POSTFIX.test(s[k])) k--;
    if (s[k] === ')') {
      const open = matchOpen(s, k);
      if (open < 0) return end + 1;
      k = open - 1;
    }
    while (k >= 0 && !BOUND.test(s[k])) k--;
    return k + 1;
  }

  /** End (exclusive) of the operand that starts at index `start`. */
  function rightEnd(s: string, start: number): number {
    let e = start;
    if (s[e] !== '(') while (e < s.length && !BOUND.test(s[e])) e++;
    if (s[e] === '(') {
      const close = matchClose(s, e);
      if (close < 0) return e;
      e = close + 1;
    }
    while (e < s.length && POSTFIX.test(s[e])) e++;
    return e;
  }

  /** "(x)" → "x" when the brackets wrap the whole operand and nothing follows. */
  function unwrap(op: string): string {
    return op.startsWith('(') && matchClose(op, 0) === op.length - 1 ? op.slice(1, -1) : op;
  }

  export function splitFractions(line: string): Part[] {
    const parts: Part[] = [];
    let from = 0;
    let at = line.indexOf(' / ');
    while (at >= 0) {
      const l = leftStart(line, at - 1);
      const r = rightEnd(line, at + 3);
      if (l < from || l >= at || r <= at + 3) {
        at = line.indexOf(' / ', at + 3);
        continue;
      }
      if (l > from) parts.push({ text: line.slice(from, l) });
      parts.push({ num: unwrap(line.slice(l, at)), den: unwrap(line.slice(at + 3, r)) });
      from = r;
      at = line.indexOf(' / ', r);
    }
    if (from < line.length) parts.push({ text: line.slice(from) });
    return dropWrappers(parts);
  }

  /**
   * "(gᵢ / g₀)" stacked needs no brackets: drop a pair that holds nothing but
   * one fraction. Keep a function's own brackets, exp(…), and brackets that
   * carry an index, (∂μ / ∂Q)₀.
   */
  function dropWrappers(parts: Part[]): Part[] {
    for (let i = 1; i < parts.length - 1; i++) {
      const before = parts[i - 1];
      const after = parts[i + 1];
      if ('text' in parts[i] || !('text' in before) || !('text' in after)) continue;
      const opens = /(^|[^\p{L}\p{N}₀-₉ₐ-ₜ])\($/u.test(before.text);
      const closes = after.text.startsWith(')') && !POSTFIX.test(after.text[1] ?? '');
      if (opens && closes) {
        before.text = before.text.slice(0, -1);
        after.text = after.text.slice(1);
      }
    }
    return parts.filter(p => !('text' in p) || p.text !== '');
  }
</script>

<script lang="ts">
  import Subbed from './Subbed.svelte';

  export let line: string;
  $: parts = splitFractions(line);
</script>

{#each parts as p}{#if 'text' in p}<Subbed text={p.text} />{:else}<span class="frac"><span class="num"><Subbed text={p.num} /></span><span class="den"><Subbed text={p.den} /></span></span>{/if}{/each}

<style>
  /* A stacked fraction on the formula's baseline: numerator over a rule over
     the denominator, a little smaller than the line. */
  .frac {
    display: inline-flex;
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    vertical-align: middle;
    margin: 0 0.15em;
    font-size: 0.86em;
    line-height: 1.15;
  }
  .num {
    padding: 0 0.2em 0.08em;
  }
  .den {
    padding: 0.08em 0.2em 0;
    border-top: 1px solid currentColor;
  }
</style>

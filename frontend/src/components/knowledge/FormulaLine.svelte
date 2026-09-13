<script lang="ts">
  /**
   * One line of a formula box, typeset by KaTeX.
   *
   * Formula lines are the one place in the project written in LaTeX rather
   * than Unicode: a radical has to span its argument and a fraction has to
   * stack, and neither survives as characters. Everything else, prose and
   * the data files included, stays plain Unicode (see CLAUDE.md).
   *
   * What is upright and what is slanted carries meaning, so the rule is
   * fixed (the Mathematical Notation card states it):
   *
   *   quantity symbol      italic, the default:  E, \nu, \alpha
   *   running index        italic:               m_i, E(J)
   *   descriptive index    upright, \mathrm:     \mu_\mathrm{ind}
   *   unit                 upright, \unit:       \unit{cm^{-1}}
   *   value with a unit    \qty:                 \qty{2349}{cm^{-1}}
   *   chemical formula     upright, \ce:         \ce{CO2}
   *   named operator       its own command:      \log, \exp, \ln, \cos
   *   a word or a phrase   \text:                \text{per molecule}
   *
   * \ce comes from mhchem, loaded below. \unit and \qty are defined here
   * because KaTeX has no siunitx: they borrow siunitx's names but take the
   * unit written out, \qty{2349}{cm^{-1}} rather than siunitx's
   * \qty{2349}{\per\centi\metre}, since nothing here expands that language.
   * The box's own label and note are prose, not LaTeX.
   */
  import katex from 'katex';
  // Registers \ce with KaTeX; imported for the side effect only.
  import 'katex/contrib/mhchem';

  export let line: string;

  $: html = katex.renderToString(line, {
    displayMode: true,
    throwOnError: false,
    strict: 'ignore',
    macros: {
      // The wavenumber, written often enough to be worth a name.
      '\\wn': '\\tilde{\\nu}',
      // KaTeX has no siunitx, so its two entry points are defined here:
      // \unit{cm^{-1}} for a unit on its own, \qty{2349}{cm^{-1}} for a
      // number with one. Both set the unit upright and put the thin space
      // between value and unit that siunitx would.
      '\\unit': '\\mathrm{#1}',
      '\\qty': '#1\\,\\mathrm{#2}',
    },
  });
</script>

<span class="formula-katex">{@html html}</span>

<style>
  /* KaTeX sets its own fonts; the box supplies the size and the colour. */
  .formula-katex :global(.katex-display) {
    margin: 0.15em 0;
    text-align: left;
  }
  .formula-katex :global(.katex-display > .katex) {
    text-align: left;
  }
  .formula-katex :global(.katex) {
    font-size: 1.05em;
    color: inherit;
  }
  /* A long line scrolls rather than pushing the card wide. */
  .formula-katex :global(.katex-display) {
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 1px;
  }
</style>

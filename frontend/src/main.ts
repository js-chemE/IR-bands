import App from './App.svelte';
import { installTokens } from './lib/tokens';
// The Knowledge page's formula boxes are typeset by KaTeX, which needs its
// own stylesheet and fonts (components/knowledge/FormulaLine).
import 'katex/dist/katex.min.css';

// Design tokens become CSS custom properties on :root before anything
// renders, so every component can style itself with var(--...).
installTokens();

const app = new App({ target: document.getElementById('app')! });

export default app;

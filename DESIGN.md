# Design: IR-bands

The locked system. This project already has a design system; every Hallmark run reads this file first and works inside it. Change it on purpose; the file is the rule.

## System
- Genre: custom, the house system of this app. Not a landing page: a data atlas (band chart, Knowledge cards, guides).
- Theme: none. Do not deal a theme, pick fonts or propose a direction.
- Shape: the existing app shell in `frontend/src/App.svelte` (sidebar plus content). A new page follows the existing pages, not a macrostructure.

## Tokens
`frontend/src/lib/tokens.ts` is the single source of truth for every colour, type role, radius, shadow, chart dimension and editorial limit. `installTokens()` writes them into `:root`; `StyleGuidePage.svelte` renders the guide from the same objects.
- CSS uses `var(--token)`; JavaScript and SVG import `C`, `TAG_STYLES` or `CHART_LAYOUT` from `tokens.ts`.
- Text goes through type roles (`--t-<role>-*`). A new style is a new role in `TYPE_GROUPS` with a `usage` note.
- Fonts are `FONTS` in `tokens.ts`. A typography change is decided by Julius, never made as part of a build.
- Exceptions that stay where they are: group colours in `data/bands.jsonc`, element (CPK) colours in `lib/elementColors.ts`, copied from phd_ui.

## Writing
- Headers in Title Case through `lib/titleCase.ts`; formula, symbol and unit case untouched (`CO₂`, `ν₁`, `kT`).
- Axis labels `quantity / unit`, units in power notation, no em dashes.
- Full rules: `CLAUDE.md`, section Design system.

## Hallmark in this repo
- Tokens stay in `tokens.ts`. No `tokens.css`, no second `:root` block, no parallel token file.
- No Hallmark stamp or critique line in any CSS, no `.hallmark/` folder in the repository.
- Existing pages change only as asked, in this system. `redesign` and `audit` only when Julius names them; an audit reports and changes nothing.
- Where a Hallmark gate and this system disagree, this system wins; waive the gate on the record as "house system".

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An IR spectroscopy band map for CO₂ hydrogenation. It reads a JSONC data file and a BibTeX references file, validates them, then emits clean JSON consumed by a Svelte/Observable Plot frontend.

## Commands

```sh
# Install Python dependencies (uses uv)
uv sync

# Build JSON data files
python build.py

# Build the frontend (outputs docs/index.html + docs/assets/)
cd frontend && npm run build

# Outputs:
#   docs/data/bands.json      — clean JSON for the frontend
#   docs/data/references.json — parsed BibTeX as JSON
#   docs/index.html           — frontend entry point (built by Vite)
```

There are no tests and no linter configured.

## Architecture

```
data/bands.jsonc          ← source of truth for all band data (JSONC with comments)
data/species.jsonc        ← chemical identities; band.species points here
data/surfaces.jsonc       ← sites, phases and samples in one table;
                            references[].measured_on points here
data/vibrations.jsonc     ← source of truth for the vibration-modes page (JSONC with comments)
data/references.bib       ← BibTeX references
build.py                  ← data build: validates, assigns lanes, emits JSON
src/ir_bands/
  schema.py               ← dataclasses: Band, Vibration, BasedOn, Region, Group, Dataset,
                              Species, Surface, Molecule, VibrationMode, Vibrations
  loader.py               ← JSONC comment stripping, dataset/vibrations loading + validation,
                              BibTeX parsing
  layout.py               ← lane assignment (assign_lanes) and sub-lane staggering (assign_sub_lanes)
frontend/src/
  App.svelte              ← root component; owns color/axis/group state and page routing
                            Four destinations: Knowledge, Band chart, References, Dataset
  components/
    BandChart.svelte         ← Observable Plot chart with zoom/pan
    Sidebar.svelte           ← the chart's filter: a set, then the groups
    ColorLegend.svelte       ← legend swatches for the active color dimension
    AxisSelect.svelte        ← x-axis property and unit selectors, reverse and shift switches
    SpectroscopySwitch.svelte← IR | Raman: which selection rule the chart draws. Bands tagged
                              `ir-inactive` or `raman-inactive` (authored, like any tag) are
                              drawn hollow for the chosen technique; positions never change
    Dropdown.svelte / ZeroField.svelte ← the sidebar's selects and the shift's zero input
    LookPill.svelte          ← the hollow (inactive) and faded (unreferenced) pills: under
                              Color by they switch the look, under Enable & Disable they
                              filter the bands out
    KnowledgePage.svelte     ← cards in rows: Molecular motion, Light–matter interaction,
                              Spectroscopy (fundamentals.ts), then Band patterns
                              (phenomena.ts) in three rows (more bands than modes, fewer,
                              bands that move), then Notation
    knowledge/               ← one diagram per card (PhenomenonDiagram draws the Band
                              patterns ones without a diagram of their own,
                              NotationDiagram both notation cards),
                              MiniMolecule (a moleculeGeometry.ts molecule posed along
                              a mode), Group3D (a CH₂/CH₃ group as a perspective 3D
                              model, for the group-frequency motions), view3d.ts +
                              Axes3D (the x, y, z axes and turn arrows of the
                              Translation and Rotation Modes cards), AtlasExamples (the "in the atlas" box), ModeCensus
                              (Normal modes → the Vibration modes view), CiteText, Subbed
    ReferencesPage.svelte    ← cited bands, grouped by any two of
                              reference / group / site / sample / element
    StyleGuidePage.svelte    ← style guide, rendered live from lib/tokens.ts (linked from Impressum)
    DrawingExample.svelte    ← the style guide's specimen plate: a diagram about nothing,
                              drawn and animated the way the Knowledge cards are, with
                              every rung of the line/ink ladder on it exactly once
    SourceGuidePage.svelte   ← source guide, rendered live from lib/sourceGuide.ts
                              (linked from Impressum): how a paper becomes data
    DataModelPage.svelte     ← the Dataset page, in two views: Structure (entity map,
                              relations, checks) and Contents (vibration modes, species,
                              surfaces, techniques, tags, references)
    VibrationModesPage.svelte← molecule selector + mode list/detail panel; no longer a
                              page of its own, embedded in Dataset → Contents
    vibration/               ← MoleculeViewer, MoleculeSelector, ModeList, ModeDetailPanel
  lib/
    tokens.ts             ← DESIGN TOKENS: every color, type role, radius, shadow,
                              chart dimension and editorial limit, in one place
    dataModel.ts          ← DATA MODEL: entities, relations, band-to-band links, tag
                              roles, plus analyse() which counts the live JSON
    labels.ts             ← species/surface key → label resolution (installed once)
    sourceGuide.ts        ← SOURCE GUIDE: what to extract from a paper, which field
                              each fact belongs in, and what to re-check on a second pass
    refGrouping.ts        ← the References page's two-level grouping dimensions
    phenomena.ts          ← the Knowledge page's phenomena: prose slots (empty for now,
                              or a written `body` in the fundamentals' format, as for
                              Rotational branches, Coverage Shift and Vibrational
                              Coupling) plus resolvers that find the bands
                              showing each one. `group`
                              puts one in a Band patterns row; `into` hosts it inside a
                              fundamentals card instead (IR-inactive → Selection rules)
    fundamentals.ts       ← the Knowledge page's fundamentals cards: teaser, full text (paragraphs
                              and formula boxes), links to the phenomena; diagrams in
                              components/knowledge/. Most of the text rests on three works,
                              named at the top of the page itself: the Springer Handbook of
                              Advanced Catalyst Characterization (cited per chapter) for the
                              infrared, Long's The Raman Effect for the theory of Raman
                              scattering, and Davydov's Molecular Spectroscopy of Oxide
                              Catalyst Surfaces for adsorbates on oxides
    cite.ts               ← `[@alias, locator]` citation markers → numbered superscripts and
                              the reference list under each card; SOURCES maps aliases to
                              citekeys and chapters
    notation.ts           ← sub/superscript character maps + htmlToUnicode(); splitSubscripts()
                              lowers the bracketed letter subscripts (μ(ind), Σ(g)⁺, C(2v))
                              on the Knowledge page
    chart.ts              ← buildChart() and lane metric helpers
    colors.ts             ← color-dimension helpers; palettes re-exported from tokens.ts
    citations.ts           ← shared IEEE-style citation formatting (chart tooltip + both pages)
    moleculeGeometry.ts    ← pixel atom geometry/displacement vectors for the vibration diagrams
    units.ts              ← wavenumber ↔ wavelength ↔ energy conversions, and the
                              band chart's shift switch: any axis read from a zero (a
                              laser), negative below it, the zero typed in a unit of its own.
                              Only a wavelength shift depends on the zero
    types.ts              ← shared TypeScript types
docs/
  index.html              ← generated by Vite; do not edit by hand
  assets/                 ← generated by Vite
  data/bands.json         ← generated by build.py
  data/vibrations.json    ← generated by build.py
  data/references.json    ← generated by build.py
```

**Species and surfaces:** `band.species` is a key into `data/species.jsonc`,
and `references[].measured_on` holds one or more keys into
`data/surfaces.jsonc`. Neither is display text any more: labels are resolved
through `frontend/src/lib/labels.ts`, which App.svelte installs once from the
dataset. Both tables ride along in `bands.json`, so the frontend still fetches
one file.

**Surfaces: one table, three levels.** "Where was this measured" has a scale,
not a single answer, so every entry carries a `level`:

- `site` — the atom-scale spot the molecule is bonded to (`cu_1p`, `zn_ovac_hf`)
- `phase` — a compound named by its formula, whether it is a constituent of a
  sample or the only thing in the cell (`tio2`, `zno`, `fe3o4_001`)
- `sample` — a made thing that was in the cell (`cu_zno`, `cuga_sio2`)

The same entry plays several roles without changing: TiO₂ is the sample when a
paper measures bare titania and a phase when that titania supports Pt. That
ambiguity is in the chemistry, so the schema records the entry once and lets
the claim say which keys it names. `"measured_on": ["zr_4p", "cugazrox"]` is
how "Zr⁴⁺ on CuGaZrOx" is recorded; a paper that named only the catalyst gets
one key, and that is a complete record of what it said. A facet is a **phase**,
never a site or a sample: `Fe₃O₄(001)` is magnetite, named by `formula` like
any other bare oxide, with `(001)` in `facet`. The cut is not part of the
chemistry, so `Fe₃O₄(001)` and `Fe₃O₄(111)` are the same compound and differ
only in the plane they expose.

`parts` is the single containment link and points **down** the scale: a sample
lists its phases and sites, a phase the sites within it, a composite site the
simpler sites it is built from. `build.py` rejects a part at a coarser level,
with one exception: an interface site (`kind: interface`) may name a phase,
because the Pt⁰-CeO₂ perimeter is the metal against the oxide rather than the
metal against one cation.

Two things widen a query. `parts` reaches the claims whose paper named only the
catalyst, and `elements` lists what an entry contains, which answers "every
band measured on a Cu-containing sample" even when the band itself was assigned
to Zr. `elements` is authored, not parsed: the composition strings are written
the way the literature writes them (`Ru/"Na₂O"/Al₂O₃`), and parsing them back is
the fragile step surfaces.jsonc exists to remove. `build.py` emits a computed
`all_elements` alongside it, the union over the whole `parts` tree, which is
what the frontend's Element view runs against.

**The level is visible, not just stored.** Every badge that renders a surface
(the chart tooltip, the References page, the Dataset page) draws a site
**filled** and a phase or sample **hollow**, so a claim about Cu⁺ never reads
like a claim about Cu/ZnO. Keep that distinction in any new place a surface is
drawn.

What the old free-text `species` label used to carry alongside the identity now
has its own field: `phase` (gas | adsorbed | surface, omitted when the band
covers both), `topology` (a Topology id from the species' molecule), and the
`isotope` / `isotopologue_of` pair that already existed.

**Fields first, tags derived.** `build.py` writes the phase chips (`gas`,
`matrix`, `adsorbed`, …) from `references[].state` and
the technique chip from `references[].technique`, the way it already wrote
`fermi-resonance`, `rotational-branches` and the substitution tag (`deuterium`, `carbon-13`, `oxygen-18`, from `band.isotope`) from the link
fields. Never author a derived tag by hand; the list is in `DERIVED_TAGS` in
`frontend/src/lib/dataModel.ts`.

**Every tag has a role**, in `TAG_ROLES`, and the roles have one declared
order, `TAG_ROLE_ORDER`: structure, phase, activity, technique, evidence,
caveat. It runs from what the band is, through how it was measured, to how far
to trust it. Everything that renders tags in sequence sorts by it, so the chart
legend and the Dataset page agree; the legend puts a small gap at each change
of role rather than a heading. A new tag gets an entry in `TAG_ROLES` and a tip
in `data/tags.jsonc` in the same change.

Tag pills are coloured per tag in `TAG_STYLES`, sparingly, and only where the
tag deserves to stand out; anything without an entry falls back to the neutral
grey pill. The one exception is the caveat role, which is red for being a
caveat rather than for what the individual tag means: a warning has to read as
one at a glance.

**Data flow:** `bands.jsonc` → `build.py` → `docs/data/bands.json` → loaded by frontend at runtime → Observable Plot chart. `vibrations.jsonc` follows the same path to `docs/data/vibrations.json`, validated against the *already-loaded* `bands.jsonc` dataset (see `validate_vibrations` in `loader.py`) so the two never drift apart silently.

## Editing the JSONC data files

`data/bands.jsonc` and `data/vibrations.jsonc` both open with a commented schema preamble documenting every key. **Keep it in sync**: whenever a key is added, removed, renamed, or its meaning changes — in `schema.py`, `loader.py`, or the JSONC file itself — update that file's preamble in the same change. A stale preamble is actively misleading, worse than no preamble at all.

## Design system

`frontend/src/lib/tokens.ts` is the single source of truth for every color, font
size, font weight, radius, shadow, chart dimension and editorial limit.
`installTokens()` (called from `main.ts`) injects them into `:root` as CSS
custom properties before anything renders, and `StyleGuidePage.svelte` renders
itself out of the same objects, so the guide cannot drift from the app.

Rules when touching the frontend:

- **Never hard-code a color, font size or font weight in a component.** Use
  `var(--token)` in CSS, or import `C` / `TAG_STYLES` / `CHART_LAYOUT` from
  `tokens.ts` where a value has to reach JavaScript (SVG presentation
  attributes cannot read CSS variables).
- **Headers are written in Title Case**: card titles, part and row headings,
  box headings and the titles inside diagrams capitalise every major word
  and keep articles and short prepositions small (`Band Patterns`,
  `More Bands than Modes`, `Where the Lines Sit`). Formula, symbol and unit
  case is never touched (`CO₂`, `ν₁`, `kT`). `lib/titleCase.ts` applies the
  rule where a header is rendered from text written for another purpose.
- **Fractions**: in a Knowledge formula box, a slash with spaces round it
  (`hc / λ`) is set as a stacked fraction by `FormulaLine.svelte`; a slash
  without spaces (`kJ/mol`, `log(1/R)`) stays on the line. Running text keeps
  the one-line form.
- **Axis labels** in charts and diagrams read `quantity / unit`
  (`wavenumber / cm⁻¹`, `speed / m s⁻¹`, `absorbance / –` for a dimensionless
  one); running text says "in cm⁻¹" instead.
- Text styling goes through **type roles**: `--t-<role>-size`, `-weight`,
  `-color`, `-ff`, `-lh`, `-ls`, `-tt`, `-fs`. Add a role to `TYPE_GROUPS`
  rather than inventing a one-off size.
- New tokens are added in `tokens.ts` **with a `usage` note**; that note is the
  text shown next to the swatch on the style guide page.
- Group colors are the deliberate exception: they belong to the dataset and
  stay in `data/bands.jsonc`. Element (CPK) colors stay in `elementColors.ts`,
  since they follow chemistry convention.
- The style guide is reachable from the Impressum page (`page = 'styleguide'`);
  it has no permanent sidebar entry. While it is open, the sidebar shows its
  table of contents, built from the `SECTIONS` array the page exports from its
  `<script context="module">` block; the page's own scroll spy reports the
  active section back to `App.svelte`. Adding a section means adding an entry
  there plus a matching `data-sg-section` anchor.
- The guide is laid out in three parts (general, band chart, content rules),
  each a stack of "spreads": explanation left, the artefact being explained
  right, the visual sticky where one spans several subsections. A spread never
  crosses a part boundary, so the cut between parts stays clean.

### Editorial limits

- `description` on a band: **at most 120 words**, and shorter is better. There is no minimum: say what is general about the band and stop.
- `note` on a band reference: **at most 150 words**.

`build.py` counts words (HTML stripped) and prints a warning per over-long
entry; it never fails the build. The numbers live in `DESCRIPTION_MAX_WORDS` /
`REFERENCE_NOTE_MAX_WORDS` in `schema.py` and in `CONTENT_LIMITS` in
`tokens.ts`. Change one, change the other.

### Notation: Unicode, not markup

Text in the data files is written with **real Unicode characters**: `CO₂`,
`cm⁻¹`, `Cu²⁺`, `¹³CO`, `κ²-HCOO*`, `νₐₛ(OCO)`, `μ₂`. Never `<sub>`/`<sup>`,
never `<em>`/`<strong>`, never HTML entities, never LaTeX, never bare `CO2`.

The reason is that the same string is rendered two ways: the chart tooltip is
plain text and runs fields through `htmlToUnicode()` (in
`frontend/src/lib/notation.ts`), which converts sub/sup tags and **strips
everything else**, while `ReferencesPage.svelte` and `ModeDetailPanel.svelte`
render the same fields with `{@html}`. Markup therefore reads differently in
two places; Unicode survives both.

**The exception in the data**: `topologies[].point_group` and
`modes[].symmetry` in `data/vibrations.jsonc` carry literal `<sub>`/`<sup>`
tags, because point-group and Mulliken labels need letter subscripts (g, u, v,
d) that Unicode has no characters for. Those two fields, and nothing else in
the data. They are listed in `MARKUP_EXEMPT_VIBRATION_FIELDS` in `schema.py`.

**The exception in the frontend**: the `lines` of a Knowledge formula box
(`Formula` in `lib/fundamentals.ts`, also used by `lib/phenomena.ts`) are
**LaTeX**, typeset by KaTeX in `components/knowledge/FormulaLine.svelte`,
because a radical has to span its argument and a fraction has to stack.
Nothing else in the frontend is: a box's `label` and `note` are prose, and so
is every paragraph. The slant carries meaning and the rule is fixed, stated
for readers by the **Mathematical Notation** card:

- a quantity symbol and a running index stay italic: `E`, `\nu`, `m_i`, `E(J)`
- an index that names a thing is upright: `\mu_\mathrm{ind}`, `R_\mathrm{catalyst}`
- a unit is upright, through `\unit{cm^{-1}}` or `\qty{2349}{cm^{-1}}`
- a chemical formula goes through mhchem: `\ce{CO2}`
- a named operator uses its own command: `\log`, `\exp`, `\ln`
- a word or a phrase goes in `\text{…}`

`\unit` and `\qty` are defined in `FormulaLine` under siunitx's names, since
KaTeX has no siunitx; they take the unit written out, not `\per\centi\metre`.

**Naming a mode**: a band's `short` names the motion, never a rank or a
database code. `ν` stretch, `δ` bend, `ρ` rock, `γ` out of plane, `τ` torsion,
`θ` pure rotation (nothing vibrates; the molecule only turns faster). That last
one is the atlas's own choice, not a convention: the standard set is entirely
vibrational and every obvious candidate is taken, ρ by rocking, ω by wagging,
τ by twisting, so `θ` was picked as the angle a rigid rotor turns through, and
it collides with none of the branch letters O/P/Q/R/S. The literature writes
this `rot-H₂` instead (Kojima and Nguyen do), which is worth knowing when
reading a source,
with `ₛ` / `ₐₛ`; then the moving atoms in brackets, then the species with a
trailing `*` when adsorbed, then the rotational branch: `νₐₛ(OCO) HCOO*`,
`ν(CO) MeOH (Q)`, `νₛ+δ(OCO) CO₂ (P)`. Where the binding geometry is what
distinguishes the band, it replaces the species: `ν(CO) linear (μ₁)`. Where a
molecule has two modes of one kind, name what separates them: methanol's two
symmetric-species methyl stretches are `ν(CH) in-plane MeOH` and
`νₛ(CH₃) MeOH`, because one rides on the hydrogen in the C-O-H plane and the
other on the out-of-plane pair. Borrow the spectroscopist index only where the
two motions genuinely share a description, and never an invented letter. One
notation per species, and
`11101←00001` or `q₁₂` belongs in the note, not the label. The full rule is the
Naming a band section of `lib/sourceGuide.ts`.

**Underscores**: an underscore in text is a subscript nobody typed. Write the
character (`ν_as` → `νₐₛ`, `V_O` → `Vₒ`, `H_2O` → `H₂O`); where the subscript is
a letter Unicode has none for, parenthesise instead (`A_HF/A_LF` → `A(HF)/A(LF)`,
`TOF_MeOH` → `TOF(MeOH)`). The only underscores that belong in text are machine
identifiers: band ids, group keys, enum values, field names. Prose may name one
verbatim.

`build.py` warns when markup turns up in a band's `short`, `description`,
`species` or a reference `note`, and when an underscored word in any of those
(or in a reference `site`) is not a known identifier. The underscore warning
carries the corrected spelling.

## Pages

Four destinations, plus the Impressum and the two guides behind it (style
guide, source guide):

- **Knowledge** (green): what the spectra mean, as cards that open in place.
  Three parts of fundamentals (Molecular Motion: Normal Modes as the
  collection, then Vibration, Rotation and Translation Modes, and Frustrated
  Motion on a line of its own via `continues`; Light–Matter Interaction;
  Spectroscopy, whose Spectral Units and Spectral Representations cards are
  the two axes of a spectrum, each diagram lighting its own axis), then Band patterns, one card per phenomenon (Selection rules
  sits in the "fewer" row, as a fundamentals card with `section: 'fewer'`),
  and the "moved" row ends with the two halves of a coverage effect:
  **Coverage Shift**, the chemical change in the bond as neighbouring sites
  compete for back-donation, and **Vibrational Coupling**, the through-space
  coupling of neighbouring transition dipoles that moves the observed band
  without moving the underlying frequency. The two link to each other, and
  isotope dilution, which separates them, is what the `mioirs` technique
  value is for. The page states at the top which three works most of it
  rests on (`PAGE_SOURCES` in `KnowledgePage.svelte`, kept in step with
  `SOURCES` in `lib/cite.ts`),
  then Notation, one card per notation the atlas uses. Cards planned but not
  written are listed at the end ("Still to come") from `PLANNED` in
  `lib/fundamentals.ts`; move an entry out of it when its card is written. The phenomenon explanations in
  `lib/phenomena.ts` are **deliberately empty for now** (Rotational branches is
  the first written out, as a `body`), while the "in the
  atlas" box under each is resolved live from the link fields, so every card
  already points at real bands and the papers behind them. Fill in `what` and
  `spotting` to finish a card. In the sidebar a part heading scrolls to the
  part; a card name scrolls to that card and opens it. The sidebar marks two
  different things and marks them differently: the filled highlight follows
  the scroll spy (`active`, where the reader is), while an unfilled box marks
  the card that is open (`opened`, from the page's `opened` event). They are
  usually the same card, and then the box simply frames the highlight.

  **A closed card is always the same three parts**, in this order and at one
  size (`CARD_LAYOUT`), so a row of them lines up: the diagram bled to the
  card's edges (`.card-visual`, the diagram's small 220 × 100 layout, playing
  on hover), then `.card-title` with the `wip` chip where the card is
  unfinished, `.card-desc` as a two- to five-line teaser, and `.card-cta`, the
  arrow at the foot. A longer teaser grows the card rather than clipping, and
  the row equalises to the tallest.

  **An opened card has two required sections and is otherwise free**
  (`KnowledgePage.svelte`, the `.kn-sec` classes). Only these two, and only
  their place is fixed:

  - `.kn-related` — where the card leads, as blocks linking to other cards.
    Second from last.
  - `.card-refs` — the references, behind a divider. Always last.

  Everything above them is whatever the card needs, in whatever order reads
  best: a flow of prose and floats, a full-width list, a three-column
  comparison, a table before any prose. The usual opening is a two-column
  flow (`.kn-flow`: the diagram floated left, the prose running past it, and
  closed, the wrapper is `display: contents` so the card stacks as it always
  did), but that is a habit rather than a rule.

  **Where a card uses the flow, it is a flow and not a grid.** The diagram
  and every callout `float: left; clear: left` into a column of their own,
  and the prose runs past them and takes the full width the moment the floats
  run out. That is deliberate, and it is why floats rather than grid or
  columns:

  - **No holes.** A short callout beside a long paragraph, or a long tail of
    prose after the last callout, both close up by themselves. A grid row
    would hold the gap open.
  - **It collapses correctly.** Under 860px the floats are turned off and
    every box is back inline exactly where it was authored, which is the
    order a phone wants. Nothing is measured, so there is nothing to
    recompute.

  Placement is a guideline rather than a law: a float should sit **near the
  text that calls it**, and running a little ahead of its paragraph is fine,
  the way a figure in a paper often arrives before the sentence pointing at
  it. What to avoid is a float stranded far from what it illustrates.

  **A callout goes wherever the card wants it**: a column beside the prose in
  the flow, the full width with `wide` on its `Formula` (which is what a
  callout that is really a table, or whose lines are too long for half a
  card, should do), a section of its own, or several sharing a section with
  the prose that needs them. **Keep the collapse property when adding
  anything.**

  **Where a citation marker goes** (stated in full at the top of
  `lib/fundamentals.ts`): on the sentence it supports while the source or
  the locator keeps changing; once, at the end of the paragraph, where the
  whole paragraph rests on one source at one locator; never on the first
  sentence alone with the rest of that source's material left bare. An
  unmarked sentence is the author's own reasoning or a cross-reference.

  **The diagrams are technical drawings, and the hierarchy is saturation
  before weight.** Every stroke sits in one narrow band (about 0.6-2px), so
  what separates a guideline from a bond is how strongly it is inked. The
  ladder, faintest first: construction (`--ink-025`, 1px dashed: a plane, a
  guideline, an axis) → rule (`--line-faint`) → dimension (`--ink-050`, 1px
  capped) → structure (`--line-slate-strong`, 1px: a drawn axis or baseline)
  → content (`--ink-slate-400`, 2px bond, 0.6px atom outline) → subject
  (`--brand-700`, `--diagram-photon`, `--accent-green-fg`, 1.3-2px), of which
  there is at most one per plate. Reach for a lighter colour before a thinner
  line and never for a thicker one. Labels are one family at one size
  (`--t-code-ff` at `--t-code-size`, never below `--t-diagram-note-size`) with
  four fills: `--ink-050` faint, `--ink-slate-500` plain, `--ink-slate-900`
  strong, and strong plus `--t-label-weight` where the label names the
  subject. A spectrum is drawn as an absorption: baseline near the top, band
  hanging down. The drawn and revised cards to match are all of Molecular
  Motion, Light-Matter Interaction except the Lambert-Beer Law, and
  Spectroscopy through Selection Rules; a `wip` card is not a model. The full
  version is the **Drawing molecules & atoms** section of the style guide.

  A diagram that does not animate is listed in `STATIC_CARD` / `STATIC_OPEN`
  in `KnowledgePage.svelte`, which stops the hover and strikes the "hover"
  hint through, rather than promising motion the diagram does not have.

  A part and the lines it continues onto (`continues`) share **one** flex
  container, `GROUPS` in the module script: while nothing is open a spacer
  puts the line break back, and once a card opens the spacer goes and the
  remaining cards pack up to a full row instead of leaving a continuation
  line stranded alone underneath.
- **Band chart** (blue) — the spectral map.
- **References** (amber) — the literature.
- **Dataset** (red) — everything the atlas holds *and* how it is put together,
  in two views chosen from the sidebar: **Structure** (entity map, entities,
  relations, band-to-band links, what nothing checks yet) and **Contents**
  (vibration modes, species, surfaces, technique, tags, references).
  Vibration modes used to be a top-level page; a molecule's modes are one of the
  things the dataset holds, so that view is embedded there now, and the chart
  tooltip's jump-to-mode opens Dataset → Contents.

## Data model page

`frontend/src/lib/dataModel.ts` is to the data what `tokens.ts` is to the
design: a written-down specification of every entity (Band, Assignment,
Reference, Site, Species, Tag, Molecule, VibrationMode, …), how they link and
with what cardinality, which links are enforced and which only hold because
two strings match. `DataModelPage.svelte` renders itself out of it, plus an
`analyse()` pass over the shipped JSON, so every count, every distinct site and
every unmatched species on the page is the real current state rather than a
snapshot somebody has to remember to update.

Rules:

- **Change a field in `schema.py` or `types.ts`, change it in `dataModel.ts`
  too**, the same obligation as the JSONC preambles. A stale entity spec is
  worse than none.
- Entity `status` is the page's spine: `record` (own file, key validated),
  `lookup`, `inline`, `enum`, `string` (nothing validates it), `derived`. Two
  bare strings are left in the model: Author and Atoms.
- A relation can be `weak` (nothing enforces it) or `derived` (nobody authors
  it, so it cannot drift). Band/Region and Species/Group are derived; do not
  add an authored copy of either.
- The page is reached from the Impressum (`page = 'datamodel'`), like the style
  guide, and shows its own table of contents in the sidebar from the `SECTIONS`
  array it exports.
- The inventories read the real tables rather than guessing: a site's kind
  comes from its record, and the "via sample" column counts the claims that
  reach a surface only through a coarser one's `parts` list.

## Key design decisions

**Schema (`schema.py`):** `Band` objects are the single source of truth. The loader always returns `Band` instances; nothing downstream touches raw dicts. `Band.lane` and `Band.sub_lane` are computed fields set in-place by the layout step.

**Lanes and sets (`bands.jsonc`):** `lanes` is the chart's row order, each entry
naming the groups that share a row; it replaced a per-band `pair` integer that
said the same thing 92 times and left the order falling out of the numbering.

**Sets (`bands.jsonc` → `sets`):** a named selection of groups, e.g.
`co2_hydrogenation` (everything except the generic carbonyl and hydroxyl
families). Which families belong to one question is an editorial judgement
about the dataset, the same kind of statement as a group's colour, so it lives
in the data. Nothing points at a set: it is a view over the groups that drives
the chart's filter. "All groups" is built into the filter rather than authored,
and a hand-picked selection that matches no set shows as "Custom". The chart
opens on `DEFAULT_SET` in `App.svelte`. A set may also carry `phases`: while it
is the active selection, only bands of those phases show (a band with no phase
applies to both forms and stays). `fluids` (Gases + Fluids) uses it to
drop the adsorbed bands that share a group with the free molecule.

**Lane layout (`layout.py`):** Two-level layout. `assign_lanes()` is a lookup, not a packing problem: it reads the `lanes` table in `bands.jsonc` (the chart's rows, in order, each naming the groups that share it) and gives every band the index of its group's row. Every group must sit in exactly one lane; `build.py` fails otherwise. `assign_sub_lanes()` then staggers overlapping bands within a lane into five sub-lanes (0, +1, −1, +2, −2), placing each `branch_group` as one unit so the branches of a transition share a sub-lane. The one exception is a family whose ΔJ = ±1 and ±2 branches actually run over each other, as methane's Raman bands do: only then is it split, and only on that boundary. Units that still do not fit fall back to the centre line and are logged. Treat that log line as a signal about the data rather than about the layout: it usually means one mode has been split into more bands than it needs.

**Frontend rendering (`chart.ts`):** `buildChart()` builds a fresh Observable Plot SVG on every reactive update. Color dimension, axis property/unit, enabled groups, and hidden legend categories are all passed in as props; the chart is fully recomputed rather than mutated.

**The sub-lane stagger exists twice.** `layout.py` runs it once over the whole
dataset and stores `sub_lane` in the JSON; `computeSubLanes()` in `chart.ts`
re-runs the same algorithm over only the currently-visible bands, because a
band hidden by a disabled group must not keep holding a slot. The chart renders
from the TypeScript one, so **a change to `layout.py` alone has no visible
effect** and the two must be edited together.

**JSONC (`loader.py`):** Comments are stripped with a hand-rolled regex that correctly skips string literals (so URLs inside strings survive). `bibtexparser` is used for BibTeX if installed; otherwise a minimal hand-rolled parser handles the common cases.

## Reading a paper into the atlas

**`frontend/src/lib/sourceGuide.ts` is the procedure. Read it before extracting a
paper and before going over one again.** It is the third specification module,
alongside `tokens.ts` (what the interface looks like) and `dataModel.ts` (what
the entities are): this one covers how to get from a PDF to a correct entry, and
`SourceGuidePage.svelte` renders it for human readers, reachable from the
Impressum.

The parts it settles, which are the ones that go wrong otherwise: one row per
(band, paper) claim and never an average; which field each fact belongs in;
choosing the surface level from the sentence that makes the assignment; what a
`note` carries and in what order (source, sample state, conditions, argument,
caveat); the fork between an isotopologue band and the `isotope-labeling` tag;
and the second-pass list. Change a rule there in the same commit as the code or
schema change that caused it.

## Adding bands

Edit `data/bands.jsonc`. Required fields per band: `id`, `species` (a key in `data/species.jsonc`), `group`, `vibration` (object with `category`, optionally `subtype`/`branch`), `atoms`, `wn_start`, `wn_end`. Optional but usually wanted: `phase`, `topology`. Run `python build.py` — validation errors are printed before any files are written, and an unresolved species, surface or topology key is an error rather than a warning.

The `region` a band belongs to is derived at runtime via `Band.region_for(dataset.regions)` — it finds the `Region` whose `wn_min`/`wn_max` range contains the band's center. Do not add `region` back to individual band entries.

Valid enum values:
- `vibration.category`: `stretch | bend | combination | lattice | electronic | rotational`.
  `rotational` is the second one that is not a normal mode: the molecule turns and does
  not vibrate at all, so there is no stretch or bend to name. Raman sees pure rotation
  directly through the polarizability, as a spectrum of its own. Such a band still takes
  a `branch`, since the letter is only ΔJ and means the same thing; for pure rotation only
  ΔJ = +2 arises, so the branch is always `S`. It takes no `vibration_modes`, there being
  no normal mode involved. H₂'s rotational S branch is the worked example: ten lines about
  180 cm⁻¹ apart, carried individually because hydrogen resolves them.
  `electronic` is not a normal mode: it is a defect or charge-transfer transition that
  absorbs across the infrared (the Vo+ photoionization band of reduced ZnO). It takes
  `atoms: "diverse"`, since nothing moves
- `vibration.subtype`: `symmetric | asymmetric | scissoring | rocking | wagging | twisting`
- `vibration.branch`: `O | P | Q | R | S`, the rotational branch as ΔJ counted from the band centre: O = −2, P = −1, Q = 0, R = +1, S = +2. Q is the centre in both, where symmetry allows it. The rule is **one-directional**. The infrared absorbs through the dipole, a rank-one operator, so it reaches ΔJ = 0, ±1 and no further: an O or S band resting only on infrared claims is a contradiction, and `check_branches` in `loader.py` warns about it. Raman scatters through the polarizability, a rank-two tensor, so it reaches ΔJ up to ±2, but **which** of the five it shows depends on the rotor: O, Q, S only for a linear molecule in a non-degenerate vibration (N₂, H₂), and all five for a symmetric top, a spherical top, or a linear molecule in a degenerate vibration. So P and R on a Raman-only band are **not** an error in general, which is why nothing checks them: methane's triply degenerate F₂ band genuinely carries them
- `vibration.j`: optional non-negative integer, the rotational level the transition starts from. Set it only where a source resolves one line instead of a branch envelope; the band is then labelled `S(3)` rather than `(S)`. Worth doing where the lines are genuinely apart, as for H₂ whose rotational constant is about 59 cm⁻¹, and not where they blur into a tail, as for N₂ at about 2 cm⁻¹. Requires `branch`
- `intensity`: `vs | s | m | w | vw` (very strong → very weak; omit if unknown)
- `width`: `sharp | medium | broad | very_broad` (omit if unknown)
- `confidence`: `confirmed | likely | tentative | speculative` (omit if unknown)
- `phase`: `gas | adsorbed | surface` (omit when the band covers both the free molecule and its adsorbed form). Matrix isolation counts as `gas`: a molecule in solid neon is the free molecule with its rotation quenched, not an adsorbed one
- `topology`: a Topology id from the species' molecule in `vibrations.jsonc` (`monodentate | bidentate`, or CO's `linear | bridged | hollow | geminal | isocarbonyl`)
- `technique` in a reference object: `drifts | transmission | atr | irras | pm_irras | emission | mioirs | ftir | raman | srs | computational`. `mioirs` is Mixed Isotope Operando Infrared Spectroscopy, the odd value of the infrared family: it names what was fed to the cell rather than how the beam reached the sample. A deliberately mixed isotopic stream (a little ¹³CO in ¹²CO) stops neighbouring adsorbates sharing a frequency and detunes the dipole coupling between them, so the spectrum is of a decoupled adlayer whichever geometry recorded it, which is why it is a value and not a tag. Monai proposed it in 2024 and nothing in the atlas carries it yet. `srs` is spontaneous Raman scattering named as such by the source, the specific value under `raman` the way the geometries sit under the infrared: one laser in, scattering out by itself, as against the coherent techniques (CARS, stimulated Raman) where a second beam drives it. Use it only where the paper says spontaneous; `raman` stays the value for one that does not. The build derives **two** tags from this one field, the way the isotope role works: the value itself, and its family (`infrared` for any of the sampling geometries, `raman` for the scattering ones, `computational` for a calculation). The family is what lets the legend ask "seen in the infrared at all" without ticking seven chips, and the legend puts a gap at each change of family. Never author either tag by hand `raman` is a Raman shift whatever the geometry; while the chart is set to Raman, the infrared claims in a tooltip are greyed out and folded (and `raman` ones while it is set to IR), from `TECHNIQUES[].spectroscopy` in `dataModel.ts`. A claim with no technique is greyed out and folded in both views; `computational` never is. A band none of whose claims stands (`isReferenced` in `chart.ts`) is drawn faded, and the sidebar's unreferenced pill takes such bands out. An isotopologue that is hollow or faded gets its hatch in the band's own colour, since the usual white lines vanish there. `ftir` is the placeholder for a source that names the interferometer but not the sampling geometry; leave the field out only when the paper says nothing at all. The reflection geometries are separate values because on a flat conducting sample the surface selection rule makes IRRAS a different experiment: only dipole components along the surface normal absorb, so a missing band can mean a mode lying flat rather than an absent species. The list lives twice, in `Technique` and `VALID_TECHNIQUES` in `schema.py`; the two drifted apart once, so change both. build.py derives a tag of the same name, so never write one by hand
- `state` in a reference object: what was in the beam for that one claim, one of `gas | liquid | matrix | solid | adsorbed`. **Every claim should carry one**; `build.py` prints a single count of the ones that do not. It is not the band's own `phase`: that says what the band *is* wherever it appears, while this says how the sample was held for this measurement, and it moves the number. Methanol's O-H stretch is 3687 cm⁻¹ as a vapour, near 3300 hydrogen-bonded in the liquid and 3690 isolated in solid neon; without the field those three rows read as a disagreement instead of three different experiments. `matrix` is a solid, but the molecule in it is isolated and not rotating, so it stays separate from `solid`, which means the bulk substance. Derives a tag of the same name, so never write one by hand
- `laser_nm` in a reference object: the Raman excitation wavelength in nm, as a plain number (`"laser_nm": 515`). Only meaningful where `technique` is `raman`; `build.py` warns otherwise, since an infrared measurement has no excitation line. It derives a per-claim tag chip of its own (`515 nm`) which is coloured from the colour of that light (`frontend/src/lib/lightColor.ts`) rather than from `TAG_STYLES`, because a wavelength is a number and no fixed tag vocabulary can hold one. That is why anything rendering a tag from the data must go through `tagStyle()` in `lib/colors.ts` rather than indexing `TAG_STYLES` directly. Record it only where the paper names the line: "argon ion laser" with no wavelength is not a wavelength
- `measured_on` in a reference object: one or more keys from `data/surfaces.jsonc`, naming where that source measured the band at whatever scale it stated (`"cu_1p"`, `"tio2"`, `"cu_zno"`). Write both keys when the paper names both the site and the catalyst, one when it names one. No reaction conditions — put those in `note`. Use a JSON array for several surfaces: `["zr_4p", "cugazrox"]`
- Combinations may not have a `subtype`
- Overtone bands are **not** a separate category — use the parent's category (e.g. `stretch`) and add `"overtone"` to `tags`; keep `based_on` pointing to the parent mode
- Isotopologues (ν(C–D) of DCOO*, ν(¹³CO), ν(OD) of CH₃OD, …) get their **own band entry** with `isotopologue_of` pointing at the natural-abundance band plus an `isotope` label (`"D"`, `"¹³C"`). Never bury an isotopologue's wavenumber in the parent band's `references[].wn`. The link is one-directional (child → parent, no chains); `build.py` auto-adds the substitution tag to the child only (`deuterium`, `carbon-13` or `oxygen-18`, named after `isotope`, whose vocabulary is closed in `VALID_ISOTOPES`), and the frontend draws those bands hatched. A source that merely *used* isotope substitution as evidence for an ordinary band gets the per-citation `isotope-labeling` tag instead — the two are different claims

Atoms value `"diverse"` is used for combination bands whose two parent modes involve different atom groups; it renders in neutral grey.

**Band IDs never contain a wavenumber.** The position is data and it gets
refined; an id that encodes it forces a rename every time the number moves. An
id is built from what the band is: species, mode, then whatever qualifier
separates it from its siblings (`co2_asym_r`, `methoxy_bend_sym`,
`carbonate_bidentate_asym_overtone`). Where two siblings would otherwise
collide, name the difference rather than the position.

Treat IDs as append-only anyway: renaming one means chasing every `based_on`,
`fermi_partner` and `isotopologue_of` reference plus any description that names
it verbatim. `build.py` fails on a dangling reference, so a rename is
survivable, just not free.

Writing rules (the full version is on the style guide page):

- `description` covers what is true of the band in general: what the mode is,
  where it sits, what moves it, what it is confused with. At most 120 words and
  as few as the general part needs, short sentences, numbers rather than
  adjectives. Nothing that is true of only one paper, one catalyst or one
  experiment: that belongs in that reference's note.
- Anything true of only one paper goes in that reference's `note` instead
  (max 150 words). Wavenumbers go in `wn`, the surface goes in `site`,
  conditions go in `note`.
- `short` is a label, not a sentence: a few words, no full stop.

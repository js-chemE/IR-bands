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
    AxisSelect.svelte        ← x-axis property and unit selectors
    KnowledgePage.svelte     ← the phenomena (Fermi, isotopic shift, branches …),
                              each resolving to the bands that show it
    ReferencesPage.svelte    ← cited bands, grouped by any two of
                              reference / group / site / sample / element
    StyleGuidePage.svelte    ← style guide, rendered live from lib/tokens.ts (linked from Impressum)
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
    phenomena.ts          ← the Knowledge page's phenomena: prose slots (empty for now)
                              plus resolvers that find the bands showing each one
    fundamentals.ts       ← the Knowledge page's Basics cards: teaser, full text (paragraphs
                              and formula boxes), links to the phenomena; diagrams in
                              components/knowledge/. The text follows the Springer Handbook
                              of Advanced Catalyst Characterization, cited per chapter
    cite.ts               ← `[@alias, locator]` citation markers → numbered superscripts and
                              the reference list under each card; SOURCES maps aliases to
                              citekeys and chapters
    notation.ts           ← sub/superscript character maps + htmlToUnicode()
    chart.ts              ← buildChart() and lane metric helpers
    colors.ts             ← color-dimension helpers; palettes re-exported from tokens.ts
    citations.ts           ← shared IEEE-style citation formatting (chart tooltip + both pages)
    moleculeGeometry.ts    ← pixel atom geometry/displacement vectors for the vibration diagrams
    units.ts              ← wavenumber ↔ wavelength ↔ energy conversions
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

**Fields first, tags derived.** `build.py` writes `gas-phase` from `phase` and
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

**The one exception**: `topologies[].point_group` and `modes[].symmetry` in
`data/vibrations.jsonc` carry literal `<sub>`/`<sup>` tags, because point-group
and Mulliken labels need letter subscripts (g, u, v, d) that Unicode has no
characters for. Those two fields, and nothing else in the project. They are
listed in `MARKUP_EXEMPT_VIBRATION_FIELDS` in `schema.py`.

**Naming a mode**: a band's `short` names the motion, never a rank or a
database code. `ν` stretch, `δ` bend, `ρ` rock, `γ` out of plane, `τ` torsion,
with `ₛ` / `ₐₛ`; then the moving atoms in brackets, then the species with a
trailing `*` when adsorbed, then the rotational branch: `νₐₛ(OCO) HCOO*`,
`ν(CO) MeOH (Q)`, `νₛ+δ(OCO) CO₂ (P)`. Where the binding geometry is what
distinguishes the band, it replaces the species: `ν(CO) linear (μ₁)`. Where a
molecule has two modes of one kind, disambiguate with the spectroscopist index
(`νₛ(CH₃) ν₂ MeOH`), never an invented letter. One notation per species, and
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

- **Knowledge** (green) — what the spectra mean. One section per phenomenon; the
  explanations are authored in `lib/phenomena.ts` and are **deliberately empty
  for now**, while the examples under each are resolved live from the link
  fields, so every section already points at real bands and the papers behind
  them. Fill in `what` and `spotting` (and add a diagram) to finish a section.
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
opens on `DEFAULT_SET` in `App.svelte`.

**Lane layout (`layout.py`):** Two-level layout. `assign_lanes()` is a lookup, not a packing problem: it reads the `lanes` table in `bands.jsonc` (the chart's rows, in order, each naming the groups that share it) and gives every band the index of its group's row. Every group must sit in exactly one lane; `build.py` fails otherwise. `assign_sub_lanes()` then staggers overlapping bands within a lane into three sub-lanes (0, +1, −1), placing each `branch_group` as one unit so the R/P/Q branches of a transition always share a sub-lane, whether or not the packing needs them to. Units with more than 3-way overlap fall back to the centre line and are logged. Treat that log line as a signal about the data rather than about the layout: it usually means one mode has been split into more bands than it needs.

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
- `vibration.category`: `stretch | bend | combination | lattice | electronic`.
  `electronic` is not a normal mode: it is a defect or charge-transfer transition that
  absorbs across the infrared (the Vo+ photoionization band of reduced ZnO). It takes
  `atoms: "diverse"`, since nothing moves
- `vibration.subtype`: `symmetric | asymmetric | scissoring | rocking | wagging | twisting`
- `vibration.branch`: `R | P | Q`
- `intensity`: `vs | s | m | w | vw` (very strong → very weak; omit if unknown)
- `width`: `sharp | medium | broad | very_broad` (omit if unknown)
- `confidence`: `confirmed | likely | tentative | speculative` (omit if unknown)
- `phase`: `gas | adsorbed | surface` (omit when the band covers both the free molecule and its adsorbed form). Matrix isolation counts as `gas`: a molecule in solid neon is the free molecule with its rotation quenched, not an adsorbed one
- `topology`: a Topology id from the species' molecule in `vibrations.jsonc` (`monodentate | bidentate`, or CO's `linear | bridged | hollow | geminal | isocarbonyl`)
- `technique` in a reference object: `drifts | transmission | atr | irras | pm_irras | emission | ftir | computational`. `ftir` is the placeholder for a source that names the interferometer but not the sampling geometry; leave the field out only when the paper says nothing at all. The reflection geometries are separate values because on a flat conducting sample the surface selection rule makes IRRAS a different experiment: only dipole components along the surface normal absorb, so a missing band can mean a mode lying flat rather than an absent species. The list lives twice, in `Technique` and `VALID_TECHNIQUES` in `schema.py`; the two drifted apart once, so change both. build.py derives a tag of the same name, so never write one by hand
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

# IR-bands

Interactive vibrational spectroscopy band atlas for CO₂ hydrogenation, published as a static site on GitHub Pages.

## Live site

[https://js-cheme.github.io/IR-bands/](https://js-cheme.github.io/IR-bands/)

## What it does

Reads the annotated data files under `data/`, validates them against each other, and emits an interactive site. The band map is the centre of it, but the atlas also carries the theory behind the bands and a written specification of its own data model.

On the **Band chart** you can:

- Filter by a named set of chemical groups, or toggle groups one at a time; empty lanes collapse automatically
- Switch the colour dimension (group, vibration type, atom family, evidence tier)
- Switch between **IR** and **Raman**: bands that are inactive in the chosen technique are drawn hollow, and claims made with the other technique fold away in the tooltip. Positions never move
- Switch the x-axis between wavenumber (cm⁻¹), wavelength (μm / nm) and energy (meV / eV / kJ mol⁻¹ / kcal mol⁻¹)
- Read any axis from a zero of your choosing (a Raman laser line), so the axis becomes a shift
- Hover a band for its assignment, its description, and every paper that claims it, with the sample, the technique and the conditions

The other three destinations:

- **Knowledge**: what the spectra mean, as cards that open in place. Molecular motion, light and matter, spectroscopy, then one card per band pattern (overtones, Fermi resonance, rotational branches, selection rules) and one per notation the atlas uses
- **References**: every cited paper, grouped by any two of reference, group, site, sample or element, and filterable by technique. Includes papers cited only by a vibration mode or a knowledge card
- **Dataset**: everything the atlas holds and how it is put together, in two views. **Structure** is the entity map, the relations and what nothing checks yet; **Contents** is the inventory, including the vibration-mode explorer where you pick a molecule, see an animated diagram of each normal mode, and check its point-group symmetry analysis against the modes actually documented

The Impressum links to two further pages rendered live from their own source modules: a **style guide** (every colour, type role and editorial limit) and a **source guide** (how a paper becomes data).

## Stack

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python · `uv` |
| Frontend | Svelte 4 · TypeScript · Vite |
| Charting | Observable Plot (`@observablehq/plot`) |
| Formulae | KaTeX |
| Hosting | GitHub Pages (served from `docs/`) |

## Prerequisites

- **Python ≥ 3.11** with [uv](https://github.com/astral-sh/uv)
- **Node.js ≥ 18** with npm

## Setup

```sh
# Python dependencies
uv sync

# Node dependencies (first time only)
cd frontend && npm install
```

## Build

```sh
# Step 1: validate data and emit clean JSON
python build.py

# Step 2: compile the Svelte frontend into docs/
cd frontend && npm run build
```

`docs/index.html` is what GitHub Pages serves. Both steps must run after any data or source change.

Validation errors are printed before any file is written, so a failed build never leaves a half-written dataset. Warnings (a wavenumber outside its band's window, a claim with no sample state, an over-long description) are printed but do not fail the build.

## Development

```sh
# Make sure docs/data/ exists first
python build.py

# Start the Vite dev server with HMR at http://localhost:5173
cd frontend && npm run dev
```

The dev server reads the generated JSON in `docs/data/` directly, so the Python step only needs to re-run when data changes.

## Data files

Everything the atlas knows lives in `data/`, as JSONC (JSON with comments). Each of the two large files opens with a commented schema preamble documenting every key; keep it in sync when a field changes.

| File | Holds |
|------|-------|
| `bands.jsonc` | band assignments, plus the group, lane, set and region tables |
| `species.jsonc` | chemical identities; `band.species` points here |
| `surfaces.jsonc` | sites, phases and samples in one table; `references[].measured_on` points here |
| `vibrations.jsonc` | molecules, topologies and normal modes, cross-validated against the bands |
| `tags.jsonc` | the tooltip text for each tag |
| `references.bib` | BibTeX references |

Two principles run through all of it:

- **Fields first, tags derived.** The phase, technique and isotope chips are written by `build.py` out of the fields that imply them. Never author a derived tag by hand; the list is in `DERIVED_TAGS` in `frontend/src/lib/dataModel.ts`
- **Unicode, not markup.** Text is written with real characters (`CO₂`, `cm⁻¹`, `νₐₛ(OCO)`), never `<sub>`, entities or LaTeX, because the same string is rendered both as plain text and as HTML

## Adding bands

Edit `data/bands.jsonc`. Required per band: `id`, `species`, `group`, `vibration` (an object with `category`, optionally `subtype` / `branch`), `atoms`, `wn_start`, `wn_end`. Usually wanted: `phase`, `topology`, `intensity`, `width`, `confidence`.

One row per (band, paper) claim, never an average. A claim carries its own `wn`, `technique`, `state` (what was in the beam), `measured_on` (one or more surface keys) and a `note` for anything true of that paper alone. `laser_nm` records a Raman excitation line where the paper names one.

```sh
python build.py && cd frontend && npm run build
```

Band IDs are effectively append-only: renaming one means chasing every `based_on`, `fermi_partner` and `isotopologue_of` that points at it. A band ID never contains a wavenumber, because the position gets refined.

The region a band belongs to is derived from its centre at runtime, not stored on the band.

**Read `frontend/src/lib/sourceGuide.ts` before extracting a paper.** It is the written procedure: which field each fact belongs in, how to choose the surface level, what a note carries and in what order, and the second-pass checklist.

## Adding vibration modes

Edit `data/vibrations.jsonc`. Each molecule declares `band_groups` (which `bands.jsonc` groups it covers) and a list of `modes`; a band points up at the mode(s) it belongs to via `vibration_modes`. The loader validates this file against the already-loaded band data, so the two cannot silently drift apart.

## Three specification modules

The frontend keeps its own rules in source rather than in comments, and renders them as pages:

| Module | Is the source of truth for | Rendered as |
|--------|---------------------------|-------------|
| `lib/tokens.ts` | every colour, type role, radius, shadow, chart dimension, editorial limit | style guide |
| `lib/dataModel.ts` | every entity, field, relation and cardinality | Dataset → Structure |
| `lib/sourceGuide.ts` | how a paper becomes data | source guide |

Change a field in `schema.py` or `types.ts` and you must change it in `dataModel.ts` too. Never hard-code a colour or a font size in a component: use a token.

## Project layout

```
data/                    ← source of truth (see the table above)
build.py                 ← validate, assign lanes, emit docs/data/*.json

src/ir_bands/
  schema.py              ← dataclasses: Band, Vibration, Region, Group, Dataset,
                            Species, Surface, Molecule, VibrationMode
  loader.py              ← JSONC parsing, validation, BibTeX parsing
  layout.py              ← lane assignment (a lookup into the authored lane
                            table) and sub-lane staggering across five slots

frontend/src/
  App.svelte             ← root component; owns colour/axis/group state and routing
  lib/
    tokens.ts            ← design tokens
    dataModel.ts         ← data model specification + analyse()
    sourceGuide.ts       ← how a paper becomes data
    fundamentals.ts      ← the Knowledge page's theory cards
    phenomena.ts         ← the Knowledge page's band patterns
    chart.ts             ← buildChart() and the lane/sub-lane metrics
    colors.ts            ← the colour dimensions, including evidence tiers
    units.ts             ← wavenumber ↔ wavelength ↔ energy, and the shift axis
    labels.ts            ← species/surface key → label resolution
    cite.ts              ← citation markers → numbered superscripts
    notation.ts          ← sub/superscript maps, htmlToUnicode()
    lightColor.ts        ← the colour of a laser line, from its wavelength
    elementColors.ts     ← per-element colour/radius for the molecule diagrams
    moleculeGeometry.ts  ← atom geometry and displacement vectors
  components/
    BandChart.svelte     ← the Observable Plot chart, with zoom and pan
    Sidebar.svelte       ← the set and group filter
    AxisSelect.svelte    ← axis property, unit, reverse and shift
    SpectroscopySwitch.svelte ← IR | Raman
    KnowledgePage.svelte ← the theory cards
    knowledge/           ← one diagram per card
    ReferencesPage.svelte
    DataModelPage.svelte ← the Dataset page (Structure | Contents)
    VibrationModesPage.svelte + vibration/ ← the mode explorer
    StyleGuidePage.svelte / SourceGuidePage.svelte

docs/                    ← what GitHub Pages serves
  index.html             ← generated by Vite; do not edit by hand
  assets/                ← generated by Vite
  data/                  ← generated by build.py
```

## Conventions

- **No em-dashes** in any authored text
- Headers are Title Case; formula and unit case is never touched
- Axis labels read `quantity / unit` (`wavenumber / cm⁻¹`); running text says "in cm⁻¹"
- A band's `description` is at most 120 words and covers what is true of the band in general; a reference `note` is at most 150 words and covers what is true of that paper alone

# IR-bands

Interactive IR spectroscopy band map for CO₂ hydrogenation, published as a static site on GitHub Pages.

## Live site

[https://js-cheme.github.io/IR-bands/](https://js-cheme.github.io/IR-bands/) 

## What it does

Reads `data/bands.jsonc` (annotated band assignments), `data/vibrations.jsonc` (vibration-mode theory, cross-validated against the bands), and `data/references.bib` (BibTeX), validates all three together, and emits an interactive site where you can:

- Filter chemical groups on/off — empty lanes collapse automatically
- Switch the colour dimension (group / vibration type / atom family / reference coverage)
- Toggle individual legend categories
- Switch the x-axis between wavenumber (cm⁻¹), wavelength (μm / nm), and energy (meV / eV / kJ mol⁻¹ / kcal mol⁻¹)
- Browse all references, including ones cited only by a vibration mode (References page)
- Pick a molecule and adsorption topology, see an animated 2D diagram of each vibrational mode, and check its point-group symmetry analysis against the modes actually documented (Vibration Modes page)

## Stack

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python · `uv` |
| Frontend | Svelte 4 · TypeScript · Vite |
| Charting | Observable Plot (`@observablehq/plot`) |
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
# Step 1 — validate data and emit clean JSON
python build.py

# Step 2 — compile the Svelte frontend → docs/
cd frontend && npm run build
```

`docs/index.html` is what GitHub Pages serves. Both steps must run after any data or source change.

## Development

```sh
# Make sure docs/data/ exists first
python build.py

# Start Vite dev server with HMR at http://localhost:5173
cd frontend && npm run dev
```

The dev server reads `docs/data/bands.json`, `docs/data/vibrations.json`, and `docs/data/references.json` directly, so the Python step only needs to re-run when data changes.

## Adding bands

Edit `data/bands.jsonc`. Required fields per band: `id`, `species`, `group`, `vibration` (object with `category`, optionally `subtype`/`branch`), `atoms`, `wn_start`, `wn_end`. Then rebuild:

```sh
python build.py && cd frontend && npm run build
```

Validation errors are printed before any files are written. Band IDs are append-only — renaming breaks `based_on` cross-references.

## Adding vibration modes

Edit `data/vibrations.jsonc`. Each molecule declares `band_groups` (which `bands.jsonc` groups it covers) and a list of `modes`; a band points up at the mode(s) it belongs to via `Band.vibration_modes`, and the loader cross-validates the two files at build time so they can't silently drift apart. Both `bands.jsonc` and `vibrations.jsonc` open with a commented schema preamble — keep it in sync whenever a field changes.

## Project layout

```
data/
  bands.jsonc          ← source of truth for band assignments (JSONC with comments)
  vibrations.jsonc      ← source of truth for the vibration-modes page (JSONC with comments)
  references.bib       ← BibTeX references

build.py               ← Python entry point: validate → emit docs/data/*.json

src/ir_bands/
  schema.py            ← dataclasses: Band, Vibration, Group, Region, Dataset,
                          Molecule, VibrationMode, Vibrations
  loader.py            ← JSONC parsing, dataset/vibrations loading + validation,
                          BibTeX parsing
  layout.py            ← lane assignment (greedy packing + sub-lane staggering)

frontend/
  src/
    App.svelte          ← root component; owns all UI state and page routing
    lib/
      types.ts          ← TypeScript interfaces (mirrors Python schema)
      colors.ts         ← colour maps for four coloring dimensions
      units.ts          ← wavenumber ↔ wavelength ↔ energy conversions
      chart.ts          ← buildChart() and lane metric helpers (Observable Plot)
      citations.ts       ← shared IEEE-style citation formatting
      moleculeGeometry.ts← pixel atom geometry, displacement vectors, and hand-derived
                            point-group symmetry analysis for the vibration diagrams
      elementColors.ts   ← per-element colour/radius lookup for the molecule diagrams
    components/
      BandChart.svelte     ← Observable Plot chart with zoom/pan
      Sidebar.svelte       ← group filter checkboxes
      ColorLegend.svelte   ← legend swatches for the active colour dimension
      AxisSelect.svelte    ← x-axis property and unit selectors
      ReferencesPage.svelte    ← references list, including bands and vibration modes
      VibrationModesPage.svelte← molecule/topology selector + mode list/detail panel
      vibration/               ← MoleculeViewer, MoleculeSelector, TopologySelector,
                                  ModeList, ModeDetailPanel
  vite.config.ts
  package.json

docs/
  index.html           ← generated by Vite; do not edit by hand
  assets/              ← generated by Vite
  data/
    bands.json         ← generated by Python (includes lane layout)
    vibrations.json    ← generated by Python
    references.json    ← generated by Python
```

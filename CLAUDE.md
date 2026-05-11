# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An IR spectroscopy band map for CO₂ hydrogenation. It reads a JSONC data file and a BibTeX references file, validates them, then emits an interactive Plotly HTML page and clean JSON for a JS frontend.

## Commands

```sh
# Install dependencies (uses uv)
uv sync

# Build all outputs (the only build command)
python build.py

# Outputs:
#   docs/index.html           — interactive Plotly band map
#   docs/data/bands.json      — clean JSON for JS frontend
#   docs/data/references.json — parsed BibTeX as JSON
```

There are no tests and no linter configured.

## Architecture

```
data/bands.jsonc          ← source of truth for all band data (JSONC with comments)
data/references.bib       ← BibTeX references
build.py                  ← build entry point (orchestrates everything)
src/
  schema.py               ← dataclasses: Band, Vibration, BasedOn, Region, Group, Dataset
  loader.py               ← JSONC comment stripping, dataset loading/validation, BibTeX parsing
  layout.py               ← lane assignment (assign_lanes) and sub-lane staggering (assign_sub_lanes)
  plot.py                 ← Plotly figure construction (build_figure)
  colors.py               ← color maps for four coloring dimensions
  units.py                ← wavenumber ↔ wavelength ↔ energy conversions
docs/
  index.html              ← generated; do not edit by hand
  data/bands.json         ← generated
  data/references.json    ← generated
```

**Data flow:** `bands.jsonc` → `loader.load_dataset()` → `Dataset[Band]` → `layout.assign_lanes()` → `plot.build_figure()` → `docs/index.html`

## Key design decisions

**Schema (`schema.py`):** `Band` objects are the single source of truth. The loader always returns `Band` instances; nothing downstream touches raw dicts. `Band.lane` and `Band.sub_lane` are computed fields set in-place by the layout step.

**Lane layout (`layout.py`):** Two-level layout. `assign_lanes()` groups bands by `pair` value first; unpaired bands are greedy-packed into shared lanes by wn range. `assign_sub_lanes()` staggers overlapping bands within a lane into three sub-lanes (0, +1, −1). Bands with more than 3-way overlap are skipped and logged.

**Plot (`plot.py`):** Each band becomes a filled polygon (Scatter `toself`). Color, legendgroup, and showlegend are all overridden simultaneously via Plotly `restyle` buttons so the legend stays in sync when the coloring dimension changes. Side-channel data (band lanes, groups, layout constants) is stashed in `fig.layout.meta` so the JS sidebar can operate without re-fetching.

**JS sidebar vs. legend (`build.py`):** Two independent interaction layers. The sidebar owns structural visibility (which lanes collapse); the legend owns cosmetic visibility. A `sidebarHidden[]` shadow array tracks which bands the sidebar hid so restoring a group only un-hides sidebar-hidden bands, leaving legend-hidden ones untouched.

**JSONC (`loader.py`):** Comments are stripped with a hand-rolled regex that correctly skips string literals (so URLs inside strings survive). `bibtexparser` is used for BibTeX if installed; otherwise a minimal hand-rolled parser handles the common cases.

## Adding bands

Edit `data/bands.jsonc`. Required fields per band: `id`, `species`, `group`, `vibration` (object with `category`, optionally `subtype`/`branch`), `atoms`, `wn_start`, `wn_end`. Run `python build.py` — validation errors are printed before any files are written.

The `region` a band belongs to is derived at runtime via `Band.region_for(dataset.regions)` — it finds the `Region` whose `wn_min`/`wn_max` range contains the band's center. Do not add `region` back to individual band entries.

Valid enum values:
- `vibration.category`: `stretch | bend | combination | lattice`
- `vibration.subtype`: `symmetric | asymmetric | scissoring | rocking | wagging | twisting`
- `vibration.branch`: `R | P | Q`
- Combinations may not have a `subtype`
- Overtone bands are **not** a separate category — use the parent's category (e.g. `stretch`) and add `"overtone"` to `tags`; keep `based_on` pointing to the parent mode

Atoms value `"diverse"` is used for combination bands whose two parent modes involve different atom groups; it renders in neutral grey.

Band IDs are append-only: renaming an ID breaks `based_on` cross-references elsewhere in the file.

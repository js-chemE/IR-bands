"""Build entry point: load data, validate, emit clean JSON, render Plotly HTML.

Run from repo root:
    python build.py

Outputs:
    docs/index.html         — Plotly band map (with lane-collapsing legend)
    docs/data/bands.json    — clean JSON for the JS frontend
    docs/data/references.json — parsed BibTeX as JSON
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

import plotly.io as pio

from src.layout import assign_lanes
from src.loader import load_dataset, load_references, validate_dataset
from src.plot import build_figure


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
DOCS_DATA = DOCS_DIR / "data"

BANDS_SRC = DATA_DIR / "bands.jsonc"
REFS_SRC = DATA_DIR / "references.bib"

BANDS_OUT = DOCS_DATA / "bands.json"
REFS_OUT = DOCS_DATA / "references.json"
HTML_OUT = DOCS_DIR / "index.html"


MIN_WIDTH_PX = 1300


# ---------------------------------------------------------------------------
# JavaScript: legend-toggle handler that collapses empty lanes
# ---------------------------------------------------------------------------
# Reads the side-channel data we stashed in layout.meta, listens to
# plotly_restyle (which fires on legend toggles), recomputes which lanes
# still have at least one visible band, and reflows y-coordinates.
# ---------------------------------------------------------------------------
LANE_COLLAPSE_JS = r"""
<script>
(function () {
  const PLOT_DIV_ID = "drifts-plot";

  // Wait for Plotly to finish initial render
  function ready(fn) {
    const div = document.getElementById(PLOT_DIV_ID);
    if (div && div.data && div.layout) { fn(div); return; }
    setTimeout(() => ready(fn), 50);
  }

  ready(function (gd) {
    const meta = gd.layout.meta || {};
    if (!meta.n_lanes) {
      console.warn("[lane-collapse] no meta.n_lanes; skipping");
      return;
    }

    const ORIG = {
      n_lanes: meta.n_lanes,
      lane_height: meta.lane_height,
      bar_fraction: meta.bar_fraction,
      sub_offset_frac: meta.sub_lane_offset_frac,
      n_bar: meta.n_bar_traces,
      band_lanes: meta.band_lanes,           // length n_bar
      band_sub_lanes: meta.band_sub_lanes,   // length n_bar
      band_groups: meta.band_groups,         // length n_bar
    };

    // Original y for each band (before any collapsing)
    function originalLaneYTop(laneIdx, nLanes) {
      return (nLanes - 1 - laneIdx) * ORIG.lane_height;
    }

    function applyCollapse() {
      // Determine which bar traces are currently visible.
      // Plotly sets trace.visible to true | false | "legendonly".
      const data = gd.data;
      const visibleByBand = [];
      for (let i = 0; i < ORIG.n_bar; i++) {
        const t = data[i];
        const v = (t && t.visible);
        // visible === undefined or true means shown; "legendonly" or false means hidden
        visibleByBand.push(v !== false && v !== "legendonly");
      }

      // Which lanes still have at least one visible band?
      const laneHasVisible = new Array(ORIG.n_lanes).fill(false);
      for (let i = 0; i < ORIG.n_bar; i++) {
        if (visibleByBand[i]) {
          laneHasVisible[ORIG.band_lanes[i]] = true;
        }
      }

      // Build mapping: original lane idx -> new compact lane idx (or -1 if collapsed)
      const newLaneIdx = new Array(ORIG.n_lanes).fill(-1);
      let next = 0;
      // Lanes are visually drawn top-to-bottom by ORIGINAL lane order;
      // preserve that order in the compacted layout.
      for (let lane = 0; lane < ORIG.n_lanes; lane++) {
        if (laneHasVisible[lane]) {
          newLaneIdx[lane] = next++;
        }
      }
      const newNLanes = next;

      // Recompute y for every visible band trace.
      // We need to update y arrays in-place via Plotly.restyle.
      const newYs = [];
      const traceIndices = [];
      for (let i = 0; i < ORIG.n_bar; i++) {
        const origLane = ORIG.band_lanes[i];
        const compactLane = newLaneIdx[origLane];
        if (compactLane < 0) {
          // band is in a fully-collapsed lane; it'll be hidden anyway
          continue;
        }
        const subLane = ORIG.band_sub_lanes[i];
        const laneY = (newNLanes > 0)
          ? (newNLanes - 1 - compactLane) * ORIG.lane_height
          : 0;
        const y0 = laneY
          + subLane * (ORIG.lane_height * ORIG.sub_offset_frac * ORIG.bar_fraction);
        const y1 = y0 + ORIG.lane_height * ORIG.bar_fraction;

        // Bar shape is a closed pentagon: [y0, y0, y1, y1, y0]
        newYs.push([y0, y0, y1, y1, y0]);
        traceIndices.push(i);
      }

      // Apply y updates. Plotly.restyle accepts an array of values (one per
      // listed trace) when you pass a property like {y: [...]}.
      if (traceIndices.length > 0) {
        Plotly.restyle(gd, { y: newYs }, traceIndices);
      }

      // Recompute lane-label annotation positions.
      const annotations = (gd.layout.annotations || []).map(function (a) {
        const m = a && a.name && a.name.match(/^lane_label_(\d+)$/);
        if (!m) return a;
        const origLane = parseInt(m[1], 10);
        const compactLane = newLaneIdx[origLane];
        if (compactLane < 0) {
          // hide labels for collapsed lanes
          return Object.assign({}, a, { visible: false });
        }
        const laneY = (newNLanes > 0)
          ? (newNLanes - 1 - compactLane) * ORIG.lane_height
          : 0;
        const yCenter = laneY + ORIG.lane_height * ORIG.bar_fraction / 2;
        return Object.assign({}, a, { y: yCenter, visible: true });
      });

      // Recompute y-axis range and overall plot height.
      const yMax = (newNLanes > 0 ? newNLanes : 1) * ORIG.lane_height;
      const newHeight = Math.max(550, Math.round(newNLanes * ORIG.lane_height * 55)) + 80;

      Plotly.relayout(gd, {
        annotations: annotations,
        "yaxis.range": [-0.3, yMax + 0.3],
        height: newHeight,
      });
    }

    // Hook the restyle event (fires on legend clicks).
    let busy = false;
    gd.on("plotly_restyle", function () {
      if (busy) return;          // avoid recursion (our restyle would refire)
      busy = true;
      setTimeout(function () {
        try { applyCollapse(); } finally { busy = false; }
      }, 0);
    });
  });
})();
</script>
"""


HEADER_HINT_HTML = """
<div id="hint-banner" style="
  background: #FFF8E1;
  border-bottom: 1px solid #F0DDA0;
  color: #3A3A3A;
  font-size: 13px;
  padding: 6px 18px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
">
  <strong>Tip:</strong> if the page looks stale after an update, do a hard
  refresh:
  <kbd style="font-family: ui-monospace, monospace;">Ctrl + Shift + R</kbd>
  (Windows / Linux) or
  <kbd style="font-family: ui-monospace, monospace;">⌘ + Shift + R</kbd> (macOS).
  Click bottom-legend items to hide groups; empty lanes will collapse.
</div>
"""


def _band_to_dict(b) -> dict:
    d = asdict(b)
    d.pop("lane", None)
    d.pop("sub_lane", None)
    return d


def main() -> int:
    DOCS_DATA.mkdir(parents=True, exist_ok=True)

    print(f"→ Loading references from {REFS_SRC.relative_to(ROOT)}")
    references = load_references(REFS_SRC)
    print(f"  {len(references)} reference entries")

    print(f"→ Loading bands from {BANDS_SRC.relative_to(ROOT)}")
    dataset = load_dataset(BANDS_SRC)
    print(f"  {len(dataset.bands)} bands, {len(dataset.groups)} groups, "
          f"{len(dataset.regions)} regions")

    validate_dataset(dataset, references=references)

    assign_lanes(dataset.bands)
    print(f"  {dataset.n_lanes()} lanes")

    bands_payload = {
        "metadata": dataset.metadata,
        "regions": {k: asdict(v) for k, v in dataset.regions.items()},
        "groups": {k: asdict(v) for k, v in dataset.groups.items()},
        "bands": [_band_to_dict(b) for b in dataset.bands],
    }
    BANDS_OUT.write_text(
        json.dumps(bands_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"✓ Wrote {BANDS_OUT.relative_to(ROOT)} ({BANDS_OUT.stat().st_size:,} bytes)")

    REFS_OUT.write_text(
        json.dumps(references, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"✓ Wrote {REFS_OUT.relative_to(ROOT)} ({REFS_OUT.stat().st_size:,} bytes)")

    fig = build_figure(dataset, references=references)
    fig_div = pio.to_html(
        fig,
        include_plotlyjs=True,
        full_html=False,
        div_id="drifts-plot",
        config={"responsive": True},
    )

    title = dataset.metadata.get("title", "DRIFTS band map")
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
    html, body {{
        margin: 0; padding: 0; width: 100%;
        overflow-x: auto;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }}
    #plot-container {{
        width: 100%; min-width: {MIN_WIDTH_PX}px; box-sizing: border-box;
    }}
    kbd {{
        background: #F4F4F4;
        border: 1px solid #D0D0D0;
        border-radius: 3px;
        padding: 1px 5px;
        font-size: 12px;
    }}
    </style>
</head>
<body>
    {HEADER_HINT_HTML}
    <div id="plot-container">
        {fig_div}
    </div>
    {LANE_COLLAPSE_JS}
</body>
</html>
"""
    HTML_OUT.write_text(html, encoding="utf-8")
    print(f"✓ Wrote {HTML_OUT.relative_to(ROOT)} ({HTML_OUT.stat().st_size:,} bytes)")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as e:
        print(f"\n✗ Build failed: {e}", file=sys.stderr)
        sys.exit(1)
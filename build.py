"""Build entry point: load data, validate, emit clean JSON, render Plotly HTML.

Run from repo root:
    python build.py

Outputs:
    docs/index.html         — Plotly band map with sidebar group filter
    docs/data/bands.json    — clean JSON for the JS frontend
    docs/data/references.json — parsed BibTeX as JSON
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

import plotly.io as pio

from ir_bands.layout import assign_lanes
from ir_bands.loader import load_dataset, load_references, validate_dataset
from ir_bands.plot import build_figure

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


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


SIDEBAR_WIDTH_PX = 220
MIN_PLOT_WIDTH_PX = 1100   # plot itself, not counting sidebar


# ---------------------------------------------------------------------------
# CSS for the page layout
# ---------------------------------------------------------------------------
PAGE_CSS = f"""
html, body {{
    margin: 0; padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #2A2A2A;
}}

#hint-banner {{
    background: #FFF8E1;
    border-bottom: 1px solid #F0DDA0;
    color: #3A3A3A;
    font-size: 13px;
    padding: 6px 18px;
}}

#layout {{
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    width: 100%;
    box-sizing: border-box;
}}

#sidebar {{
    flex: 0 0 {SIDEBAR_WIDTH_PX}px;
    width: {SIDEBAR_WIDTH_PX}px;
    box-sizing: border-box;
    padding: 16px 14px;
    border-right: 1px solid #E5E5E5;
    background: #FAFAFA;
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
    font-size: 13px;
}}

#sidebar h3 {{
    margin: 0 0 10px 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
}}

#sidebar .actions {{
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
}}

#sidebar .actions button {{
    flex: 1;
    background: white;
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    color: #333;
}}

#sidebar .actions button:hover {{
    background: #F0F0F0;
}}

#sidebar label.group-row {{
    display: flex;
    align-items: center;
    padding: 4px 4px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    line-height: 1.3;
}}

#sidebar label.group-row:hover {{
    background: #F0F0F0;
}}

#sidebar label.group-row input {{
    margin: 0 8px 0 0;
    flex: 0 0 auto;
}}

#sidebar label.group-row .swatch {{
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    margin-right: 8px;
}}

#sidebar label.group-row .glabel {{
    flex: 1 1 auto;
}}

#sidebar label.group-row .gcount {{
    flex: 0 0 auto;
    color: #888;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    margin-left: 6px;
}}

#sidebar label.group-row.off .glabel,
#sidebar label.group-row.off .gcount {{
    color: #B0B0B0;
    text-decoration: line-through;
}}

#plot-container {{
    flex: 1 1 auto;
    min-width: {MIN_PLOT_WIDTH_PX}px;
    box-sizing: border-box;
    overflow-x: auto;
}}

kbd {{
    background: #F4F4F4;
    border: 1px solid #D0D0D0;
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
}}

#sidebar select {{
    width: 100%;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    background: white;
    color: #333;
    cursor: pointer;
    margin-bottom: 6px;
    box-sizing: border-box;
}}

#sidebar select:hover {{
    border-color: #A0A0A0;
}}

.axis-row {{
    display: flex;
    gap: 6px;
}}

.axis-row select {{
    flex: 1;
}}

.sidebar-divider {{
    border: none;
    border-top: 1px solid #E5E5E5;
    margin: 12px 0;
}}
"""


HEADER_HINT_HTML = """
<div id="hint-banner">
  <strong>Tip:</strong> if the page looks stale after an update, hard-refresh:
  <kbd>Ctrl + Shift + R</kbd> (Windows / Linux) or
  <kbd>⌘ + Shift + R</kbd> (macOS).
  <br>
  <strong>Sidebar</strong> = which groups exist (toggling collapses lanes).
  <strong>Legend</strong> = highlight/hide bands within the visible groups
  (no lane collapse).
</div>
"""


# ---------------------------------------------------------------------------
# JavaScript: clean separation of two interaction layers.
#
# Sidebar (structural):
#   - Owns enabledGroups[g] : boolean per group
#   - Toggling a group hides/shows its bands AND collapses empty lanes
#   - Source of truth for which lanes are visible
#
# Legend (cosmetic):
#   - Plotly's built-in toggle behavior, untouched
#   - Hides individual color-categories for visual focus
#   - Does NOT trigger lane collapse
#
# To keep these independent, we track sidebar-hidden bands in our own shadow
# state (sidebarHidden[i]). When the sidebar re-enables a group, we only
# restore bands that *we* hid; bands the legend hid stay hidden.
# ---------------------------------------------------------------------------
SIDEBAR_AND_COLLAPSE_JS = r"""
<script>
(function () {
  const PLOT_DIV_ID = "drifts-plot";
  const SIDEBAR_ID = "sidebar-groups";

  // These groups start toggled off in the sidebar.
  const DEFAULT_OFF_GROUPS = new Set(["hydride", "support"]);

  function ready(fn) {
    const div = document.getElementById(PLOT_DIV_ID);
    if (div && div.data && div.layout) { fn(div); return; }
    setTimeout(() => ready(fn), 50);
  }

  ready(function (gd) {
    const meta = gd.layout.meta || {};
    if (!meta.n_lanes || !meta.groups_for_sidebar) {
      console.warn("[sidebar] missing layout.meta data; skipping");
      return;
    }

    const ORIG = {
      n_lanes: meta.n_lanes,
      lane_height: meta.lane_height,
      bar_fraction: meta.bar_fraction,
      sub_offset_frac: meta.sub_lane_offset_frac,
      n_bar: meta.n_bar_traces,
      band_lanes: meta.band_lanes,
      band_sub_lanes: meta.band_sub_lanes,
      band_groups: meta.band_groups,
      groups: meta.groups_for_sidebar,  // [{key,label,color,count}, ...]
      legend_trace_info: meta.legend_trace_info || [],   // [{dim, cat}, ...]
      legend_trace_groups: meta.legend_trace_groups || [], // [[groupKey,...], ...]
    };

    // Sidebar state: which groups are currently enabled (true = shown).
    const enabledGroups = {};
    ORIG.groups.forEach(function (g) {
      enabledGroups[g.key] = !DEFAULT_OFF_GROUPS.has(g.key);
    });

    // Shadow state: bands the sidebar has hidden (so legend clicks can't restore them).
    const sidebarHidden = new Array(ORIG.n_bar).fill(false);

    // ----- Build the sidebar UI -----
    const sidebar = document.getElementById(SIDEBAR_ID);
    if (!sidebar) {
      console.warn("[sidebar] container #" + SIDEBAR_ID + " not found");
      return;
    }

    const heading = document.createElement("h3");
    heading.textContent = "Filter groups";
    sidebar.appendChild(heading);

    const actions = document.createElement("div");
    actions.className = "actions";
    const btnAll = document.createElement("button");
    btnAll.textContent = "Select all";
    const btnNone = document.createElement("button");
    btnNone.textContent = "Clear all";
    actions.appendChild(btnAll);
    actions.appendChild(btnNone);
    sidebar.appendChild(actions);

    const rowsByKey = {};
    ORIG.groups.forEach(function (g) {
      const row = document.createElement("label");
      row.className = "group-row";
      row.setAttribute("data-group", g.key);

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = enabledGroups[g.key];

      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = g.color;

      const lbl = document.createElement("span");
      lbl.className = "glabel";
      lbl.textContent = g.label;

      const cnt = document.createElement("span");
      cnt.className = "gcount";
      cnt.textContent = g.count;

      row.appendChild(cb);
      row.appendChild(sw);
      row.appendChild(lbl);
      row.appendChild(cnt);
      if (!enabledGroups[g.key]) row.classList.add("off");
      sidebar.appendChild(row);
      rowsByKey[g.key] = { row: row, checkbox: cb };

      cb.addEventListener("change", function () {
        enabledGroups[g.key] = cb.checked;
        row.classList.toggle("off", !cb.checked);
        applySidebarChange();
      });
    });

    btnAll.addEventListener("click", function () {
      ORIG.groups.forEach(function (g) {
        enabledGroups[g.key] = true;
        rowsByKey[g.key].checkbox.checked = true;
        rowsByKey[g.key].row.classList.remove("off");
      });
      applySidebarChange();
    });
    btnNone.addEventListener("click", function () {
      ORIG.groups.forEach(function (g) {
        enabledGroups[g.key] = false;
        rowsByKey[g.key].checkbox.checked = false;
        rowsByKey[g.key].row.classList.add("off");
      });
      applySidebarChange();
    });

    // ----- Legend entry visibility: hide entries whose groups are all disabled -----
    // Called after any sidebar toggle or color-dim change.
    function applyLegendVisibility() {
      var currentDim = colorDimSel ? colorDimSel.value : "group";
      var showVals = [];
      var traceIdxs = [];
      for (var i = 0; i < ORIG.legend_trace_info.length; i++) {
        var info = ORIG.legend_trace_info[i];
        var grps = ORIG.legend_trace_groups[i];
        var dimMatch = info.dim === currentDim;
        var anyEnabled = grps.some(function (g) { return enabledGroups[g]; });
        showVals.push(dimMatch && anyEnabled);
        traceIdxs.push(ORIG.n_bar + i);
      }
      if (traceIdxs.length > 0) {
        return Plotly.restyle(gd, { showlegend: showVals }, traceIdxs);
      }
      return Promise.resolve();
    }

    // ----- Sidebar-driven visibility + lane collapse -----
    let busy = false;

    function applySidebarChange() {
      if (busy) return;
      busy = true;

      const indices = [];
      const values = [];
      const data = gd.data;

      for (let i = 0; i < ORIG.n_bar; i++) {
        const g = ORIG.band_groups[i];
        const groupOn = enabledGroups[g];
        const wasSidebarHidden = sidebarHidden[i];

        if (!groupOn) {
          if (data[i].visible !== "legendonly" && data[i].visible !== false) {
            indices.push(i);
            values.push("legendonly");
          }
          sidebarHidden[i] = true;
        } else if (groupOn && wasSidebarHidden) {
          indices.push(i);
          values.push(true);
          sidebarHidden[i] = false;
        }
      }

      const restylePromise = (indices.length > 0)
        ? Plotly.restyle(gd, { visible: values }, indices)
        : Promise.resolve();

      restylePromise.then(function () {
        applyCollapse();
        applyLegendVisibility();
        busy = false;
      });
    }

    // Lane-collapse based on SIDEBAR state only — legend state is ignored.
    function applyCollapse() {
      const laneEnabled = new Array(ORIG.n_lanes).fill(false);
      for (let i = 0; i < ORIG.n_bar; i++) {
        if (enabledGroups[ORIG.band_groups[i]]) {
          laneEnabled[ORIG.band_lanes[i]] = true;
        }
      }

      const newLaneIdx = new Array(ORIG.n_lanes).fill(-1);
      let next = 0;
      for (let lane = 0; lane < ORIG.n_lanes; lane++) {
        if (laneEnabled[lane]) newLaneIdx[lane] = next++;
      }
      const newNLanes = next;

      // Update y-coordinates for ALL bar traces in still-enabled lanes.
      // Includes legend-hidden traces so unhiding them via legend gives correct position.
      const newYs = [];
      const traceIndices = [];
      for (let i = 0; i < ORIG.n_bar; i++) {
        const origLane = ORIG.band_lanes[i];
        const compactLane = newLaneIdx[origLane];
        if (compactLane < 0) continue;
        const subLane = ORIG.band_sub_lanes[i];
        const laneY = (newNLanes > 0)
          ? (newNLanes - 1 - compactLane) * ORIG.lane_height
          : 0;
        const y0 = laneY + subLane * (ORIG.lane_height * ORIG.sub_offset_frac * ORIG.bar_fraction);
        const y1 = y0 + ORIG.lane_height * ORIG.bar_fraction;
        newYs.push([y0, y0, y1, y1, y0]);
        traceIndices.push(i);
      }

      const annotations = (gd.layout.annotations || []).map(function (a) {
        const m = a && a.name && a.name.match(/^lane_label_(\d+)$/);
        if (!m) return a;
        const origLane = parseInt(m[1], 10);
        const compactLane = newLaneIdx[origLane];
        if (compactLane < 0) {
          return Object.assign({}, a, { visible: false });
        }
        const laneY = (newNLanes > 0)
          ? (newNLanes - 1 - compactLane) * ORIG.lane_height : 0;
        const yCenter = laneY + ORIG.lane_height * ORIG.bar_fraction / 2;
        return Object.assign({}, a, { y: yCenter, visible: true });
      });

      const yMax = (newNLanes > 0 ? newNLanes : 1) * ORIG.lane_height;
      const newHeight = Math.max(550, Math.round(newNLanes * ORIG.lane_height * 55)) + 80;

      if (traceIndices.length > 0) {
        Plotly.restyle(gd, { y: newYs }, traceIndices);
      }
      Plotly.relayout(gd, {
        annotations: annotations,
        "yaxis.range": [-0.3, yMax + 0.3],
        height: newHeight,
      });
    }

    // ----- Guard legend clicks against restoring sidebar-hidden bands -----
    // When a legendgroup contains both sidebar-hidden and user-visible bands,
    // clicking the legend entry would normally toggle ALL of them — including
    // sidebar-hidden ones, which would snap to incorrect (collapsed) positions.
    // Instead we manually toggle only the non-sidebar-hidden bands.
    gd.on("plotly_legendclick", function (data) {
      var clickedIdx = data.curveNumber;
      var lgName = gd.data[clickedIdx].legendgroup;

      // Collect band traces in this legendgroup, split by sidebar state.
      var freeIndices = [];   // not sidebar-hidden → user may toggle
      var hasSbHidden = false;
      for (var i = 0; i < ORIG.n_bar; i++) {
        if (gd.data[i].legendgroup !== lgName) continue;
        if (sidebarHidden[i]) { hasSbHidden = true; }
        else { freeIndices.push(i); }
      }

      if (!hasSbHidden) return; // no conflict — let Plotly handle it normally

      // Manual toggle: only the free bands + the legend marker trace itself.
      var allHidden = freeIndices.every(function (i) {
        var v = gd.data[i].visible;
        return v === "legendonly" || v === false;
      });
      var newVis = allHidden ? true : "legendonly";
      var toUpdate = freeIndices.concat([clickedIdx]);
      Plotly.restyle(gd, { visible: newVis }, toUpdate);
      return false; // prevent Plotly's default toggle
    });

    // Disable double-click "toggleothers" when sidebar has hidden bands,
    // since it would restore sidebar-hidden traces via a Plotly internal path.
    gd.on("plotly_legenddoubleclick", function () {
      if (sidebarHidden.some(function (h) { return h; })) return false;
    });

    // ----- Color dimension selector -----
    const colorDimSel = document.getElementById("color-dim-select");
    if (colorDimSel && meta.color_dim_data) {
      colorDimSel.addEventListener("change", function () {
        const d = meta.color_dim_data[colorDimSel.value];
        Plotly.restyle(gd, {
          fillcolor: d.fillcolors,
          legendgroup: d.legendgroups,
        }).then(function () {
          applyLegendVisibility();
        });
      });
    }

    // ----- Axis property + unit selectors -----
    const axisPropSel = document.getElementById("axis-property-select");
    const axisUnitSel = document.getElementById("axis-unit-select");
    if (axisPropSel && axisUnitSel && meta.axis_data) {
      function populateUnits(property) {
        const propData = meta.axis_data[property];
        axisUnitSel.innerHTML = "";
        Object.keys(propData.units).forEach(function (unit) {
          const opt = document.createElement("option");
          opt.value = unit;
          opt.textContent = unit;
          if (unit === propData.default_unit) opt.selected = true;
          axisUnitSel.appendChild(opt);
        });
      }

      function applyAxisChange() {
        const d = meta.axis_data[axisPropSel.value].units[axisUnitSel.value];
        Plotly.update(gd,
          { x: d.xs },
          { "xaxis.range": d.range, "xaxis.title.text": d.title }
        );
      }

      populateUnits(axisPropSel.value);
      axisPropSel.addEventListener("change", function () {
        populateUnits(axisPropSel.value);
        applyAxisChange();
      });
      axisUnitSel.addEventListener("change", applyAxisChange);
    }

    // Apply initial defaults: hide DEFAULT_OFF_GROUPS and sync legend entries.
    applySidebarChange();
  });
})();
</script>
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
    <style>{PAGE_CSS}</style>
</head>
<body>
    {HEADER_HINT_HTML}
    <div id="layout">
        <aside id="sidebar">
            <div id="sidebar-color-dim">
                <h3>Color by</h3>
                <select id="color-dim-select">
                    <option value="group" selected>Group</option>
                    <option value="vibration">Vibration</option>
                    <option value="atoms">Atoms</option>
                    <option value="references">References</option>
                </select>
            </div>
            <hr class="sidebar-divider">
            <div id="sidebar-axis">
                <h3>X axis</h3>
                <div class="axis-row">
                    <select id="axis-property-select">
                        <option value="wavenumber" selected>wavenumber</option>
                        <option value="wavelength">wavelength</option>
                        <option value="energy">energy</option>
                    </select>
                    <select id="axis-unit-select"></select>
                </div>
            </div>
            <hr class="sidebar-divider">
            <div id="sidebar-groups"></div>
        </aside>
        <div id="plot-container">
            {fig_div}
        </div>
    </div>
    {SIDEBAR_AND_COLLAPSE_JS}
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
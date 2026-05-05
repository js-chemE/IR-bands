import plotly.graph_objects as go
import plotly.io as pio
from pathlib import Path

from collections import defaultdict
from ploty_helper import wrap_for_hover

from bands import (
    load_bands,
    total_lanes,
    color_map_by_group,
    color_map_by_vibration,
    color_map_by_atoms,
)

FILE_DIR = Path(__file__).parent
DATA_DIR = FILE_DIR / "data"
FILE_BANDS = DATA_DIR / "drifts_bands.json"
SITE_DIR = FILE_DIR.parent / "site"
HTML_NAME = "index.html"

meta, regions, groups, bands = load_bands(FILE_BANDS)
n_lanes = total_lanes(bands)

# Three color schemes — used by the dropdown in the plot
COLORS_BY_GROUP     = color_map_by_group(bands, groups)
COLORS_BY_VIBRATION = color_map_by_vibration(bands)
COLORS_BY_ATOMS     = color_map_by_atoms(bands)

WN_LIMITS = (4050, 450)


LANE_HEIGHT = 1.2
BAR_FRACTION = 0.25
SUB_LANE_OFFSET_FRAC = 0.52   # fraction of lane height for one offset step

def lane_y_top(lane_idx: int) -> float:
    return (n_lanes - 1 - lane_idx) * LANE_HEIGHT

y_min = 0
y_max = n_lanes * LANE_HEIGHT

# ----- Pre-compute per-band attributes for each filter dimension -----
DIMENSIONS = {
    "group":     {"label": "Filter by group",     "key": lambda b: b.group,
                  "display": lambda v: groups[v]["label"] if v in groups else v},
    "species":   {"label": "Filter by species",   "key": lambda b: b.species,
                  "display": lambda v: v},
    "vibration": {"label": "Filter by vibration", "key": lambda b: b.vibration,
                  "display": lambda v: v},
    "atoms":     {"label": "Filter by atoms",     "key": lambda b: b.atoms,
                  "display": lambda v: v},
}

band_categories = {
    dim_key: [dim["key"](b) for b in bands]
    for dim_key, dim in DIMENSIONS.items()
}

# Color arrays — separate ones for bar (fillcolor) and text (color) traces
colors_group_bar     = [COLORS_BY_GROUP[b.species]       for b in bands]
colors_vibration_bar = [COLORS_BY_VIBRATION[b.vibration] for b in bands]
colors_atoms_bar     = [COLORS_BY_ATOMS[b.atoms]         for b in bands]

fig = go.Figure()

# ----- Within-lane sub-lane staggering for overlapping bands -----
def assign_sub_lanes(bands: list, gap: int = 0) -> set:
    """
    Per lane, walk bands left-to-right and assign sub-lane offsets.
    
    Algorithm: greedy interval-graph 3-coloring across (sub_lane = 0, +1, -1).
    For each band, pick the first sub-lane (in priority order: 0, +1, -1) 
    where no band currently on that sub-lane is still "active" 
    (i.e., its wn_max is past the new band's wn_min).
    
    Skip a band only when all three sub-lanes have an active band at its
    starting wavenumber — i.e., 4+ bands genuinely stacked at one position.
    
    Returns set of band ids() to skip; sets `.sub_lane` on remaining bands.
    """
    skipped: set = set()
    by_lane: dict[int, list] = defaultdict(list)
    for b in bands:
        by_lane[b.lane].append(b)

    SUB_LANE_PRIORITY = [0, +1, -1]   # try centered first, then up, then down

    for lane_idx, lane_bands in by_lane.items():
        lane_sorted = sorted(lane_bands, key=lambda b: b.wn_min)
        
        # Track the rightmost wn_max currently placed on each sub-lane.
        # A sub-lane is "free" for a new band if its tracked end is
        # strictly less than the new band's wn_min (i.e., no overlap).
        sub_lane_ends = {sl: float("-inf") for sl in SUB_LANE_PRIORITY}

        for b in lane_sorted:
            placed = False
            for sl in SUB_LANE_PRIORITY:
                if sub_lane_ends[sl] + gap < b.wn_min:
                    # Sub-lane is free — place this band here
                    b.sub_lane = sl
                    sub_lane_ends[sl] = b.wn_max
                    placed = True
                    break
            
            if not placed:
                # All three sub-lanes have active bands at this wavenumber → 4-way conflict
                print(
                    f"⚠ Skipping band: lane {lane_idx}, "
                    f"species={b.species!r}, "
                    f"wn={b.wn_min}-{b.wn_max} cm⁻¹, "
                    f"vibration={b.vibration!r} — "
                    f"4+ bands overlap at this position."
                )
                skipped.add(id(b))

    return skipped


skipped_band_ids = assign_sub_lanes(bands)
n_skipped = len(skipped_band_ids)
if n_skipped:
    print(f"\nTotal bands skipped due to 3+ way overlap: {n_skipped}")


# ----- Bar traces (one per band) -----
for b in bands:
    if id(b) in skipped_band_ids:
        # Optional: add empty placeholder trace to preserve indices
        fig.add_trace(go.Scatter(
            x=[None], y=[None], mode="lines",
            showlegend=False, hoverinfo="skip",
            visible=True,
        ))
        continue

    lane_y = lane_y_top(b.lane)
    bar_y0 = lane_y
    bar_y1 = lane_y + LANE_HEIGHT * BAR_FRACTION

    sub_offset = getattr(b, "sub_lane", 0) * (LANE_HEIGHT * SUB_LANE_OFFSET_FRAC * BAR_FRACTION)
    bar_y0 += sub_offset
    bar_y1 += sub_offset

    # Rich hover with the formatted short label as headline
    hover = (
        f"<b>{b.label}</b><br>"
        f"<i>{b.vibration} of {b.atoms}</i><br>"
        f"Species: {b.species}<br>"
        f"Range: {b.wn_min}–{b.wn_max} cm⁻¹<br>"
        f"Group: {groups[b.group]['label']}<br>"
        f"Region: {regions[b.region]['label']}"
        + (f"<br><br>{wrap_for_hover(b.description, width=50)}" if b.description else "")
    )

    # Overtones get a dotted border + reduced opacity
    is_over = getattr(b, "is_overtone", False)
    line_dash = "dot" if is_over else "solid"
    fill_opacity = 0.55 if is_over else 0.85

    fig.add_trace(go.Scatter(
        x=[b.wn_min, b.wn_max, b.wn_max, b.wn_min, b.wn_min],
        y=[bar_y0, bar_y0, bar_y1, bar_y1, bar_y0],
        fill="toself", fillcolor=COLORS_BY_GROUP[b.species],
        line=dict(color="black", width=0.5, dash=line_dash),
        mode="lines", opacity=fill_opacity,
        hoveron="fills", text=hover, hoverinfo="text",
        showlegend=False,
        legendgroup=b.group,
        name=b.species,
    ))
n_bar_traces = len(bands)

# ----- Legend marker traces, one per (dimension, category) -----
legend_trace_info: list[dict] = []
for dim_key, dim in DIMENSIONS.items():
    cats_seen: dict[str, int] = {}
    for b in bands:
        c = dim["key"](b)
        cats_seen[c] = max(cats_seen.get(c, 0), b.wn_max)
    cat_order = sorted(cats_seen, key=lambda c: -cats_seen[c])

    for cat in cat_order:
        if dim_key == "group":
            color = groups[cat]["color"]
        elif dim_key == "vibration":
            color = COLORS_BY_VIBRATION[cat]
        elif dim_key == "atoms":
            color = COLORS_BY_ATOMS[cat]
        else:
            color = COLORS_BY_GROUP[cat]

        trace_idx = len(fig.data)
        fig.add_trace(go.Scatter(
            x=[None], y=[None], mode="markers",
            marker=dict(size=12, color=color, line=dict(color="black", width=0.5)),
            name=dim["display"](cat),
            legendgroup=cat,
            showlegend=(dim_key == "group"),
        ))
        legend_trace_info.append(dict(dim=dim_key, cat=cat, trace_idx=trace_idx))

# Total trace count breakdown for restyle indexing
n_total = len(fig.data)
bar_indices   = list(range(0, n_bar_traces))
label_indices = list(range(n_bar_traces, n_bar_traces))

band_indices  = bar_indices
# band_indices  = bar_indices + label_indices  # both follow the band's legendgroup

# ----- Combined dimension dropdown -----
# Each button switches both the color scheme AND the legend grouping
# to the same dimension. Three options: group, vibration, atoms.

DIMENSION_COLORS = {
    "group":     colors_group_bar,
    "vibration": colors_vibration_bar,
    "atoms":     colors_atoms_bar,
}

dimension_buttons = []
for dim_key, dim in DIMENSIONS.items():
    if dim_key == "species":
        # Species dimension is too granular for color/legend (too many categories)
        continue

    band_lg = band_categories[dim_key]

    # Build legend visibility: only show legend traces matching this dimension
    showlegend_array = [False] * n_bar_traces
    for info in legend_trace_info:
        showlegend_array.append(info["dim"] == dim_key)

    # Build legend grouping: bars get the new dimension category
    legendgroup_array = list(band_lg)
    for info in legend_trace_info:
        legendgroup_array.append(info["cat"])

    # Bar colors: only set fillcolor for actual bar traces
    fillcolor_array = list(DIMENSION_COLORS[dim_key]) + [None] * (n_total - n_bar_traces)

    dimension_buttons.append(dict(
        label=f"By {dim_key}",
        method="restyle",
        args=[{
            "fillcolor":   fillcolor_array,
            "legendgroup": legendgroup_array,
            "showlegend":  showlegend_array,
        }],
    ))


# ----- Per-lane group labels in the left margin -----
lane_groups: dict[int, list[str]] = defaultdict(list)
for b in bands:
    if b.group not in lane_groups[b.lane]:
        lane_groups[b.lane].append(b.group)

lane_label_annotations = []
for lane_idx, grp_keys in lane_groups.items():
    lane_y = lane_y_top(lane_idx)
    bar_y_center = lane_y + LANE_HEIGHT * BAR_FRACTION / 2

    if len(grp_keys) == 1:
        grp = grp_keys[0]
        text = f'<span style="color:{groups[grp]["color"]}">{groups[grp]["label"]}</span>'
    else:
        text = " / ".join(
            f'<span style="color:{groups[g]["color"]}">{groups[g]["label"]}</span>'
            for g in grp_keys
        )

    lane_label_annotations.append(dict(
        x=0,
        xref="paper",
        y=bar_y_center,
        text=text,
        showarrow=False,
        xanchor="right",
        yanchor="middle",
        xshift=-8,
        font=dict(size=10),
        align="right",
    ))

# ----- Layout -----
fig.update_layout(
    title=meta["title"],
    xaxis=dict(
        title="Wavenumber (cm⁻¹)", range=list(WN_LIMITS),
        showgrid=True, gridcolor="lightgray", griddash="dot",
    ),
    yaxis=dict(visible=False, range=[y_min - 0.3, y_max + 0.3]),
    height=max(550, int(n_lanes * LANE_HEIGHT * 55)) + 80,
    autosize=True,
    plot_bgcolor="white",
    margin=dict(l=220, r=40, t=120, b=140),
    annotations=lane_label_annotations,
    legend=dict(
        orientation="h",
        yanchor="top", y=-0.10,
        xanchor="center", x=0.5,
        itemclick="toggle",
        itemdoubleclick="toggleothers",
    ),
    updatemenus=[
        dict(
            type="dropdown",
            buttons=dimension_buttons,
            direction="down",
            showactive=True,
            x=1.0, xanchor="right",
            y=1.12, yanchor="top",
            pad=dict(t=4, r=4),
        ),
    ],
)

fig_div = pio.to_html(
    fig,
    include_plotlyjs=True,
    full_html=False,
    div_id="drifts-plot",
    config={"responsive": True},
)

MIN_WIDTH_PX = 1300

html_template = f"""<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>{meta['title']}</title>
        <style>
        html, body {{
            margin: 0;
            padding: 0;
            width: 100%;
            overflow-x: auto;
        }}
        #plot-container {{
            width: 100%;
            min-width: {MIN_WIDTH_PX}px;
            box-sizing: border-box;
        }}
        </style>
    </head>
    <body>
        <div id="plot-container">
            {fig_div}
        </div>
    </body>
    </html>
    """

(SITE_DIR / HTML_NAME).write_text(
    html_template, encoding="utf-8"
)
"""Plotly figure construction.

Inputs: a Dataset (validated, with lanes assigned) and a references map.
Output: a plotly.graph_objects.Figure ready for to_html().

Side-channel data via fig.layout.meta so JS can:
  - build a sidebar with one checkbox per group (groups_for_sidebar)
  - collapse empty lanes when groups are toggled (band_lanes etc.)
"""
from __future__ import annotations

from collections import defaultdict

import plotly.graph_objects as go

from colors import (
    color_map_by_atoms,
    color_map_by_group,
    color_map_by_references,
    color_map_by_vibration,
    references_key,
    references_label,
    vibration_key,
    vibration_label,
)
from layout import assign_sub_lanes
from schema import Band, Dataset
from units import AXES, axis_label, axis_range, wn_to_value, wrap_for_hover


# Layout constants
LANE_HEIGHT = 1.2
BAR_FRACTION = 0.25
SUB_LANE_OFFSET_FRAC = 0.52

# Default x-axis range (cm⁻¹)
WN_LIMITS = (4050, 450)


# ---------------------------------------------------------------------------
# Hover text
# ---------------------------------------------------------------------------

def _hover_text(b: Band, dataset: Dataset, references: dict | None = None) -> str:
    group_label = dataset.groups[b.group].label
    region_label = dataset.regions[b.region].label

    sub = f" {b.vibration.subtype}" if b.vibration.subtype else ""
    branch = f" ({b.vibration.branch})" if b.vibration.branch else ""
    vib_str = f"{b.vibration.category}{sub}{branch}"

    parts = [
        f"<b>{b.label}</b>",
        f"<i>{vib_str} of {b.atoms}</i>",
        f"Species: {b.species}",
        f"Range: {b.wn_min}–{b.wn_max} cm⁻¹",
        f"Group: {group_label}",
        f"Region: {region_label}",
    ]

    if b.based_on:
        parent_strs = []
        for bo in b.based_on:
            mult = "" if bo.multiplier == 1 else f"{bo.multiplier}× "
            if bo.band_id and any(x.id == bo.band_id for x in dataset.bands):
                parent = dataset.band_by_id(bo.band_id)
                parent_strs.append(f"{mult}{parent.short or parent.id}")
            else:
                parent_strs.append(f"{mult}{bo.label or '?'}")
        parts.append(f"Built from: {' + '.join(parent_strs)}")

    if b.references and references is not None:
        cite_strs = []
        for key in b.references:
            ref = references.get(key)
            if ref:
                author = ref.get("author", "").split(",")[0].split(" and ")[0].strip()
                year = ref.get("year", "")
                cite_strs.append(f"{author} {year}".strip() or key)
            else:
                cite_strs.append(key)
        parts.append(f"Refs: [{'; '.join(cite_strs)}]")
    elif not b.references:
        parts.append("<i>(no reference yet)</i>")

    if b.description:
        parts.append("")
        parts.append(wrap_for_hover(b.description, width=50))

    return "<br>".join(parts)


def _lane_y_top(lane_idx: int, n_lanes: int) -> float:
    return (n_lanes - 1 - lane_idx) * LANE_HEIGHT


# ---------------------------------------------------------------------------
# Main figure builder
# ---------------------------------------------------------------------------

def build_figure(dataset: Dataset, references: dict | None = None) -> go.Figure:
    bands = dataset.bands
    groups = dataset.groups
    n_lanes = dataset.n_lanes()

    skipped_ids = assign_sub_lanes(bands)
    if skipped_ids:
        import sys
        print(f"⚠ {len(skipped_ids)} bands skipped due to >3-way overlap:", file=sys.stderr)
        for b in bands:
            if b.id in skipped_ids:
                print(f"    {b.id} (lane {b.lane}, {b.wn_min}–{b.wn_max} cm⁻¹)",
                      file=sys.stderr)

    # ----- Color maps for each dimension -----
    colors_group = color_map_by_group(bands, groups)
    colors_vib = color_map_by_vibration(bands)
    colors_atoms = color_map_by_atoms(bands)
    colors_refs = color_map_by_references(bands)

    bar_color_arrays: dict[str, list[str]] = {
        "group":      [colors_group[b.species] for b in bands],
        "vibration":  [colors_vib[vibration_key(b)] for b in bands],
        "atoms":      [colors_atoms[b.atoms] for b in bands],
        "references": [colors_refs[references_key(b)] for b in bands],
    }

    fig = go.Figure()

    # ----- Bar traces -----
    for b in bands:
        if b.id in skipped_ids:
            fig.add_trace(go.Scatter(
                x=[None], y=[None], mode="lines",
                showlegend=False, hoverinfo="skip", visible=True,
            ))
            continue

        lane_y = _lane_y_top(b.lane, n_lanes)
        bar_y0 = lane_y
        bar_y1 = lane_y + LANE_HEIGHT * BAR_FRACTION
        sub_offset = b.sub_lane * (LANE_HEIGHT * SUB_LANE_OFFSET_FRAC * BAR_FRACTION)
        bar_y0 += sub_offset
        bar_y1 += sub_offset

        is_derived = b.is_derived
        line_dash = "dot" if is_derived else "solid"
        opacity = 0.55 if is_derived else 0.85

        fig.add_trace(go.Scatter(
            x=[b.wn_min, b.wn_max, b.wn_max, b.wn_min, b.wn_min],
            y=[bar_y0, bar_y0, bar_y1, bar_y1, bar_y0],
            fill="toself",
            fillcolor=colors_group[b.species],
            line=dict(color="black", width=0.5, dash=line_dash),
            mode="lines",
            opacity=opacity,
            hoveron="fills",
            text=_hover_text(b, dataset, references),
            hoverinfo="text",
            showlegend=False,
            legendgroup=b.group,
            name=b.species,
            customdata=[b.id],
        ))
    n_bar_traces = len(bands)

    # ----- Dimension definitions (drives the color/legend dropdown) -----
    DIMENSIONS = {
        "group":      {"key": lambda b: b.group,       "display": lambda v: groups[v].label},
        "vibration":  {"key": vibration_key,           "display": vibration_label},
        "atoms":      {"key": lambda b: b.atoms,       "display": lambda v: v},
        "references": {"key": references_key,          "display": references_label},
    }

    # ----- Legend marker traces -----
    legend_trace_info: list[dict] = []
    for dim_key, dim in DIMENSIONS.items():
        cats_seen: dict[str, int] = {}
        for b in bands:
            c = dim["key"](b)
            cats_seen[c] = max(cats_seen.get(c, 0), b.wn_max)
        cat_order = sorted(cats_seen, key=lambda c: -cats_seen[c])

        for cat in cat_order:
            if dim_key == "group":
                color = groups[cat].color
            elif dim_key == "vibration":
                color = colors_vib[cat]
            elif dim_key == "atoms":
                color = colors_atoms[cat]
            else:
                color = colors_refs[cat]

            fig.add_trace(go.Scatter(
                x=[None], y=[None], mode="markers",
                marker=dict(size=12, color=color, line=dict(color="black", width=0.5)),
                name=dim["display"](cat),
                legendgroup=cat,
                showlegend=(dim_key == "group"),
            ))
            legend_trace_info.append(dict(dim=dim_key, cat=cat))

    n_total = len(fig.data)

    # ----- Dimension dropdown -----
    band_categories = {
        dim_key: [dim["key"](b) for b in bands]
        for dim_key, dim in DIMENSIONS.items()
    }

    dimension_buttons = []
    for dim_key in DIMENSIONS:
        showlegend_array = [False] * n_bar_traces
        for info in legend_trace_info:
            showlegend_array.append(info["dim"] == dim_key)

        legendgroup_array = list(band_categories[dim_key])
        for info in legend_trace_info:
            legendgroup_array.append(info["cat"])

        fillcolor_array = list(bar_color_arrays[dim_key]) + [None] * (n_total - n_bar_traces)

        dimension_buttons.append(dict(
            label=f"By {dim_key}",
            method="restyle",
            args=[{
                "fillcolor":   fillcolor_array,
                "legendgroup": legendgroup_array,
                "showlegend":  showlegend_array,
            }],
        ))

    # ----- Axis-switch buttons -----
    def _converted_band_xs(axis_name: str, unit: str):
        out = []
        for b in bands:
            if b.id in skipped_ids:
                out.append([None] * 5)
                continue
            x0 = wn_to_value(b.wn_min, axis_name, unit)
            x1 = wn_to_value(b.wn_max, axis_name, unit)
            lo, hi = min(x0, x1), max(x0, x1)
            out.append([lo, hi, hi, lo, lo])
        return out

    axis_buttons = []
    for axis_name, spec in AXES.items():
        for unit in spec.units:
            new_xs = _converted_band_xs(axis_name, unit)
            new_range = axis_range(WN_LIMITS[1], WN_LIMITS[0], axis_name, unit)
            new_title = axis_label(axis_name, unit)
            axis_buttons.append(dict(
                label=f"{axis_name}: {unit}",
                method="update",
                args=[
                    {"x": new_xs + [[None]] * (n_total - n_bar_traces)},
                    {"xaxis.range": new_range, "xaxis.title.text": new_title},
                ],
            ))

    # ----- Per-lane group labels (left margin) -----
    # Kept lightweight; the sidebar is the primary group-control surface.
    lane_groups: dict[int, list[str]] = defaultdict(list)
    for b in bands:
        if b.group not in lane_groups[b.lane]:
            lane_groups[b.lane].append(b.group)

    lane_label_annotations = []
    for lane_idx, grp_keys in lane_groups.items():
        lane_y = _lane_y_top(lane_idx, n_lanes)
        bar_y_center = lane_y + LANE_HEIGHT * BAR_FRACTION / 2
        if len(grp_keys) == 1:
            grp = grp_keys[0]
            text = f'<span style="color:{groups[grp].color}">{groups[grp].label}</span>'
        else:
            text = " / ".join(
                f'<span style="color:{groups[g].color}">{groups[g].label}</span>'
                for g in grp_keys
            )
        lane_label_annotations.append(dict(
            x=0, xref="paper",
            y=bar_y_center, text=text,
            showarrow=False,
            xanchor="right", yanchor="middle",
            xshift=-8, font=dict(size=10), align="right",
            name=f"lane_label_{lane_idx}",
        ))

    # ----- Group metadata for the sidebar -----
    # One entry per group key that has at least one band; ordered by the order
    # groups first appear in `bands` so the sidebar follows the visual top-to-
    # bottom order of the lanes.
    group_counts: dict[str, int] = defaultdict(int)
    group_first_lane: dict[str, int] = {}
    for b in bands:
        group_counts[b.group] += 1
        if b.group not in group_first_lane:
            group_first_lane[b.group] = b.lane

    groups_for_sidebar = []
    for g_key in sorted(group_counts, key=lambda k: group_first_lane[k]):
        g = groups[g_key]
        groups_for_sidebar.append({
            "key": g_key,
            "label": g.label,
            "color": g.color,
            "count": group_counts[g_key],
        })

    # ----- Side-channel data for the JS handlers -----
    lane_data_for_js = {
        "n_lanes": n_lanes,
        "lane_height": LANE_HEIGHT,
        "bar_fraction": BAR_FRACTION,
        "sub_lane_offset_frac": SUB_LANE_OFFSET_FRAC,
        "n_bar_traces": n_bar_traces,
        "band_lanes": [b.lane for b in bands],
        "band_sub_lanes": [b.sub_lane for b in bands],
        "band_groups": [b.group for b in bands],
        "groups_for_sidebar": groups_for_sidebar,
    }

    # ----- Final layout -----
    y_max = n_lanes * LANE_HEIGHT
    fig.update_layout(
        title=dataset.metadata.get("title", "DRIFTS band map"),
        xaxis=dict(
            title=axis_label("wavenumber", "cm⁻¹"),
            range=axis_range(WN_LIMITS[1], WN_LIMITS[0], "wavenumber", "cm⁻¹"),
            showgrid=True, gridcolor="lightgray", griddash="dot",
        ),
        yaxis=dict(visible=False, range=[-0.3, y_max + 0.3]),
        height=max(550, int(n_lanes * LANE_HEIGHT * 55)) + 80,
        autosize=True,
        plot_bgcolor="white",
        margin=dict(l=180, r=40, t=120, b=140),
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
                type="dropdown", buttons=dimension_buttons, direction="down",
                showactive=True,
                x=1.0, xanchor="right", y=1.12, yanchor="top",
                pad=dict(t=4, r=4),
            ),
            dict(
                type="dropdown", buttons=axis_buttons, direction="down",
                showactive=True,
                x=0.55, xanchor="right", y=1.12, yanchor="top",
                pad=dict(t=4, r=4),
            ),
        ],
        meta=lane_data_for_js,
    )

    return fig
"""Lane assignment for the band map.

Lanes are horizontal rows in the plot. Two kinds of grouping happen:

1. assign_lanes(): puts each band into the lane its group belongs to,
   as listed in bands.jsonc's `lanes` table.

2. assign_sub_lanes(): within a lane, staggers overlapping bands by
   shifting them up or down a fraction of the lane height. The R/P/Q
   branches of one transition move as a single unit, so they never end up
   on different sub-lanes. Returns the set of bands that couldn't be
   placed (4-way overlap).
"""
from __future__ import annotations

from collections import defaultdict

from ir_bands.schema import Band


def assign_lanes(bands: list[Band], lanes: list[list[str]]) -> None:
    """Set b.lane on every band in-place, from the authored lane table.

    A lane is a row of the chart naming the groups that share it, so this is a
    lookup rather than a packing problem: which row is my group in. It used to
    infer the rows from a per-band `pair` integer and greedily pack whatever
    was left, which meant the row order fell out of the numbering and adding a
    band could silently repack the chart.

    validate_dataset() has already checked that every group sits in exactly
    one lane, so a missing group here would be a bug rather than bad data.
    """
    lane_of_group = {
        group_key: index for index, lane in enumerate(lanes) for group_key in lane
    }
    for b in bands:
        b.lane = lane_of_group.get(b.group, 0)


SUB_LANE_PRIORITY = (0, +1, -1)  # try centered first, then up, then down


def _placement_units(lane_bands: list[Band]) -> list[list[Band]]:
    """Group a lane's bands into the units that get staggered as one.

    The R/P/Q branches of one vibrational transition are three views of the
    same feature and read as one band with satellites, so they belong on the
    same sub-lane whether or not the packing needs them there: splitting them
    makes one vibration look like unrelated neighbours. A branch_group is
    therefore placed as a unit spanning all its members, and everything else
    is a unit of one.

    Branch siblings share a `pair` in practice, so a group does not span
    lanes; if one ever did, each lane's members would form their own unit and
    only agree within a lane, which is the most this step can promise.
    """
    units: dict[tuple[str, str], list[Band]] = {}
    order: list[tuple[str, str]] = []
    for b in lane_bands:
        key = ("branch", b.branch_group) if b.branch_group else ("band", b.id)
        if key not in units:
            units[key] = []
            order.append(key)
        units[key].append(b)
    return [units[k] for k in order]


def assign_sub_lanes(bands: list[Band], gap: int = 0) -> set[str]:
    """Within each lane, stagger overlapping bands to sub-lanes 0, +1, -1.

    Sets b.sub_lane in-place. Returns the set of band IDs that couldn't be
    placed (more than 3 units overlap at one wavenumber). A branch group that
    does not fit is skipped whole rather than split, since keeping its members
    together is the point of treating it as a unit.
    """
    skipped: set[str] = set()
    by_lane: dict[int, list[Band]] = defaultdict(list)
    for b in bands:
        by_lane[b.lane].append(b)

    for lane_idx, lane_bands in by_lane.items():
        # Two-step sort: group first (so one group's bands consistently claim
        # the same sub-lane priority before a second group sharing this lane
        # gets considered), then by wavenumber within that group — rather
        # than a single wn-only sort, which can interleave two groups'
        # bands and place them in a visually inconsistent sub-lane pattern.
        units = sorted(
            _placement_units(lane_bands),
            key=lambda u: (min(b.group for b in u), min(b.wn_min for b in u)),
        )
        # Track the rightmost wn_max currently placed on each sub-lane;
        # a sub-lane is "free" for a new unit if its tracked end is
        # strictly less than the unit's own wn_min (i.e., no overlap).
        sub_lane_ends = {sl: float("-inf") for sl in SUB_LANE_PRIORITY}

        for unit in units:
            unit_min = min(b.wn_min for b in unit)
            unit_max = max(b.wn_max for b in unit)
            placed = False
            for sl in SUB_LANE_PRIORITY:
                if sub_lane_ends[sl] + gap < unit_min:
                    for b in unit:
                        b.sub_lane = sl
                    sub_lane_ends[sl] = unit_max
                    placed = True
                    break

            if not placed:
                # Could log this; for now just accumulate
                skipped.update(b.id for b in unit)

    return skipped

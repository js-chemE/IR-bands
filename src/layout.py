"""Lane assignment for the band map.

Lanes are horizontal rows in the plot. Two kinds of grouping happen:

1. assign_lanes(): puts each band into a lane. Bands with the same `pair`
   group land in the same lane; singletons get packed into shared lanes
   only if they don't overlap.

2. assign_sub_lanes(): within a lane, staggers overlapping bands by
   shifting them up or down a fraction of the lane height. Returns the
   set of bands that couldn't be placed (4-way overlap).
"""
from __future__ import annotations

from collections import defaultdict

from schema import Band


def assign_lanes(bands: list[Band], gap: int = 5) -> None:
    """Set b.lane on every band in-place.

    Bands sharing a `pair` value are grouped into the same lane. Remaining
    singleton bands are packed greedily: a singleton joins an existing
    singleton lane only if it doesn't overlap any band already there.
    """
    paired: dict[int, list[Band]] = {}
    singletons: list[Band] = []
    for b in bands:
        if b.pair is not None:
            paired.setdefault(b.pair, []).append(b)
        else:
            singletons.append(b)

    pair_lanes = [paired[k] for k in sorted(paired)]

    singleton_lanes: list[list[Band]] = []
    for b in sorted(singletons, key=lambda x: x.wn_min):
        placed = False
        for lane in singleton_lanes:
            if all(
                b.wn_max + gap < other.wn_min or b.wn_min > other.wn_max + gap
                for other in lane
            ):
                lane.append(b)
                placed = True
                break
        if not placed:
            singleton_lanes.append([b])

    lanes = pair_lanes + singleton_lanes

    for lane_idx, lane in enumerate(lanes):
        for b in lane:
            b.lane = lane_idx


SUB_LANE_PRIORITY = (0, +1, -1)  # try centered first, then up, then down


def assign_sub_lanes(bands: list[Band], gap: int = 0) -> set[str]:
    """Within each lane, stagger overlapping bands to sub-lanes 0, +1, -1.

    Sets b.sub_lane in-place. Returns the set of band IDs that couldn't be
    placed (more than 3 bands overlap at one wavenumber).
    """
    skipped: set[str] = set()
    by_lane: dict[int, list[Band]] = defaultdict(list)
    for b in bands:
        by_lane[b.lane].append(b)

    for lane_idx, lane_bands in by_lane.items():
        lane_sorted = sorted(lane_bands, key=lambda b: b.wn_min)
        # Track the rightmost wn_max currently placed on each sub-lane;
        # a sub-lane is "free" for a new band if its tracked end is
        # strictly less than the new band's wn_min (i.e., no overlap).
        sub_lane_ends = {sl: float("-inf") for sl in SUB_LANE_PRIORITY}

        for b in lane_sorted:
            placed = False
            for sl in SUB_LANE_PRIORITY:
                if sub_lane_ends[sl] + gap < b.wn_min:
                    b.sub_lane = sl
                    sub_lane_ends[sl] = b.wn_max
                    placed = True
                    break

            if not placed:
                # Could log this; for now just accumulate
                skipped.add(b.id)

    return skipped
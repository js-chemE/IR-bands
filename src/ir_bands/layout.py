"""Lane assignment for the band map.

Lanes are horizontal rows in the plot. Two kinds of grouping happen:

1. assign_lanes(): puts each band into the lane its group belongs to,
   as listed in bands.jsonc's `lanes` table.

2. assign_sub_lanes(): within a lane, staggers overlapping bands by
   shifting them up or down a fraction of the lane height. The branches of
   one transition move as a single unit, so they share a sub-lane unless
   the family's dJ = +/-1 and +/-2 branches actually run over each other.
   Returns the set of bands that couldn't be placed at all.
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


# Centred first, then up, then down, then further up, then further down. The
# outer two slots exist because real overlaps needed them: four carbonyl C=O
# stretches genuinely share 1700-1750 cm-1 (acyl, formic acid, formyl and
# formaldehyde), the Cu carbonyl window is just as crowded, and methanol's C-D
# umbrella lands on its C-O branches. Dropping a band to the centre line hides
# it under another; another slot shows it. Mirrored in chart.ts, which is what
# the chart renders from.
SUB_LANE_PRIORITY = (0, +1, -1, +2, -2)


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
    families: dict[str, list[Band]] = {}
    order: list[str] = []
    out: list[list[Band]] = []
    for b in lane_bands:
        if not b.branch_group:
            out.append([b])
            continue
        if b.branch_group not in families:
            families[b.branch_group] = []
            order.append(b.branch_group)
        families[b.branch_group].append(b)

    for key in order:
        members = families[key]
        # A branch family is one unit, so its members share a sub-lane and the
        # transition reads as one feature. The exception is a family whose
        # dJ = +/-1 and +/-2 branches actually run over each other: a
        # spherical top can carry all five of O, P, Q, R and S, and there the
        # two sets overlap in wavenumber and would draw on top of one another.
        # Only then is the family split, and only on that boundary.
        #
        # Testing the real overlap rather than splitting on principle matters:
        # H2's O lines sit far below its centre and its S lines far above, so
        # a blind split would bundle them into one unit spanning everything
        # and push the Q branch off its own sub-lane for no reason. Mirrored
        # in placementUnits() in chart.ts, which the chart renders from.
        far = [b for b in members if b.vibration.branch in ("O", "S")]
        near = [b for b in members if b.vibration.branch not in ("O", "S")]
        if far and near:
            # Band against band, not envelope against envelope. H2's O lines
            # sit far below its centre and its S lines far above, so the two
            # sets straddle the Q branch and their envelopes appear to overlap
            # while no actual band touches another. N2's O branch ends 3 cm-1
            # inside its Q branch, which is a rounding of the window rather
            # than a collision, so a brush under 10 cm-1 is ignored too.
            collides = any(
                min(f.wn_max, n.wn_max) - max(f.wn_min, n.wn_min) > 10
                for f in far
                for n in near
            )
            if collides:
                out.append(near)
                out.append(far)
                continue
        out.append(members)
    return out


def assign_sub_lanes(bands: list[Band], gap: int = 0) -> set[str]:
    """Within each lane, stagger overlapping bands across SUB_LANE_PRIORITY.

    Sets b.sub_lane in-place. Returns the set of band IDs that couldn't be
    placed (more units overlap at one wavenumber than there are slots). A
    branch group that does not fit is skipped whole rather than split, since
    keeping its members together is the point of treating it as a unit.
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

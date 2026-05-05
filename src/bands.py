"""Shared utilities for DRIFTS band map generation."""
import json
import re
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class Band:
    species: str
    group: str
    vibration: str
    atoms: str
    wn_start: int
    wn_end: int
    region: str
    short: str = ""
    description: str = ""
    pair: Optional[int] = None
    is_overtone: bool = False    # NEW
    lane: int = 0  # Assigned later by assign_lanes, default to 0 for singletons

    @property
    def wn_min(self) -> int:
        return min(self.wn_start, self.wn_end)

    @property
    def wn_max(self) -> int:
        return max(self.wn_start, self.wn_end)

    @property
    def label(self) -> str:
        return self.short if self.short else f"{self.species} {self.vibration}"


def assign_lanes(bands: list[Band], gap: int = 5) -> None:
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
            if all(b.wn_max + gap < other.wn_min or b.wn_min > other.wn_max + gap
                   for other in lane):
                lane.append(b)
                placed = True
                break
        if not placed:
            singleton_lanes.append([b])

    lanes = pair_lanes + singleton_lanes

    for lane_idx, lane in enumerate(lanes):
        for b in lane:
            b.lane = lane_idx


def load_bands(path: str | Path):
    """Load JSON, return (metadata, regions, groups, list[Band] with lanes)."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    bands = [Band(**b) for b in data["bands"]]
    assign_lanes(bands)
    return data["metadata"], data["regions"], data["groups"], bands


def total_lanes(bands: list[Band]) -> int:
    return max((b.lane for b in bands), default=0) + 1


# ---------- Color palettes for the three coloring modes ----------

# A reusable categorical palette (Tab10-ish, distinct hues)
_PALETTE = [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD",
    "#8C564B", "#E377C2", "#7F7F7F", "#BCBD22", "#17BECF",
    "#7FB8E0", "#FFB78C", "#98DF8A", "#FF9896", "#C5B0D5",
]


def _categorical_color_map(values: list[str]) -> dict[str, str]:
    """Stable color assignment for a sorted list of unique categorical values."""
    uniques = sorted(set(values))
    return {v: _PALETTE[i % len(_PALETTE)] for i, v in enumerate(uniques)}


def color_map_by_group(bands: list[Band], groups: dict) -> dict[str, str]:
    """Per-band color from groups[band.group]['color']. Returns species -> color."""
    return {b.species: groups[b.group]["color"] for b in bands}


def color_map_by_vibration(bands: list[Band]) -> dict[str, str]:
    """Hand-curated palette: stretch family in blues, bending/lattice in warm
    earth tones, combination muted as supporting evidence."""
    palette = {
        "stretch":       "#3B82C4",  # medium blue — anchor of stretch family
        "sym stretch":   "#1F5FA0",  # darker blue — symmetric variant
        "asym stretch":  "#7FB3DC",  # lighter blue — antisymmetric variant
        "bending":       "#E89B3C",  # warm orange — distinct family
        "lattice":       "#9B6B3D",  # earth brown — related to bending
        "combination":   "#8C7A95",  # muted purple-grey — supporting/secondary
    }
    # Fall back to grey for any unmapped vibration type
    return {b.vibration: palette.get(b.vibration, "#7F7F7F") for b in bands}


def color_map_by_atoms(bands: list[Band]) -> dict[str, str]:
    """Hand-curated palette grouped by chemistry:
    teal = O-H family, green = C-H family, coral = single C-O,
    red = OCO/CO2 family, gold = M-H, grey = M-O lattice."""
    palette = {
        # O-H family (teal)
        "O-H":   "#3FA7A0",
        "H-O-H": "#2A7873",
        "C-O-H": "#7DC9C3",
        # C-H family (green)
        "C-H":   "#5BA84F",
        "H-C-H":  "#3D7C36",
        "O-C-H": "#9CCB91",
        # C-O family (coral)
        "C-O":   "#E07856",
        # OCO family (red)
        "O-C-O":   "#C03B36",
        "O=C=O": "#E84940",
        # M-H family (gold)
        "M-H":   "#D9A036",
        # M-O family (grey)
        "M-O":   "#5C5C5C",
    }
    return {b.atoms: palette.get(b.atoms, "#7F7F7F") for b in bands}

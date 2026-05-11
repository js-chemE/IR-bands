"""Dataclasses for the band-map schema (v3).

These types are the single source of truth for what a "band" looks like.
Everything else in the codebase consumes Band objects, never raw dicts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Literal


# Allowed enum values — keep in sync with the JSONC schema header
VibCategory = Literal["stretch", "bend", "combination", "lattice"]
VibSubtype = Literal["symmetric", "asymmetric", "scissoring", "rocking", "wagging", "twisting"]
Branch = Literal["R", "P", "Q"]

VALID_CATEGORIES = {"stretch", "bend", "combination", "lattice"}
VALID_SUBTYPES = {"symmetric", "asymmetric", "scissoring", "rocking", "wagging", "twisting"}
VALID_BRANCHES = {"R", "P", "Q"}


@dataclass
class Vibration:
    """The structured vibration descriptor.

    category is required; subtype and branch are optional.
    Combinations must have subtype=None (they aren't themselves sym/asym).
    Overtone bands use their parent's category with an "overtone" tag.
    """
    category: VibCategory
    subtype: Optional[VibSubtype] = None
    branch: Optional[Branch] = None

    def __post_init__(self):
        if self.category not in VALID_CATEGORIES:
            raise ValueError(f"vibration.category={self.category!r} not in {VALID_CATEGORIES}")
        if self.subtype is not None and self.subtype not in VALID_SUBTYPES:
            raise ValueError(f"vibration.subtype={self.subtype!r} not in {VALID_SUBTYPES}")
        if self.branch is not None and self.branch not in VALID_BRANCHES:
            raise ValueError(f"vibration.branch={self.branch!r} not in {VALID_BRANCHES}")
        if self.category == "combination" and self.subtype is not None:
            raise ValueError(
                f"vibration.category=combination cannot have subtype={self.subtype!r}; "
                "combinations aren't themselves symmetric/asymmetric."
            )


@dataclass
class BasedOn:
    """A reference from a derived band (combination/overtone) to a parent mode.

    band_id is None when the parent isn't in the dataset (e.g. IR-inactive ν₁
    of CO₂); in that case label provides a human-readable description.
    """
    band_id: Optional[str]
    multiplier: int
    label: Optional[str] = None  # only used when band_id is None

    def __post_init__(self):
        if self.band_id is None and not self.label:
            raise ValueError("based_on entry has band_id=None but no label")
        if self.multiplier < 1:
            raise ValueError(f"based_on.multiplier={self.multiplier} must be >= 1")


@dataclass
class Band:
    id: str
    species: str
    group: str
    vibration: Vibration
    atoms: str
    wn_start: int
    wn_end: int
    short: str = ""
    description: str = ""
    based_on: list[BasedOn] = field(default_factory=list)
    references: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)

    # Legacy field kept until the loader is rewritten to use group-based lanes.
    # Used by layout.assign_lanes() for now.
    pair: Optional[int] = None

    # Computed at load time
    lane: int = 0
    sub_lane: int = 0  # set by sub-lane staggering; 0 / +1 / -1

    @property
    def wn_min(self) -> int:
        return min(self.wn_start, self.wn_end)

    @property
    def wn_max(self) -> int:
        return max(self.wn_start, self.wn_end)

    @property
    def wn_center(self) -> float:
        return (self.wn_start + self.wn_end) / 2

    @property
    def label(self) -> str:
        """Display label, falling back to species + vibration if no short."""
        if self.short:
            return self.short
        sub = f" {self.vibration.subtype}" if self.vibration.subtype else ""
        return f"{self.species}{sub} {self.vibration.category}"

    @property
    def is_derived(self) -> bool:
        """True if this band is a combination of others."""
        return self.vibration.category == "combination"

    def region_for(self, regions: "dict[str, Region]") -> "Optional[Region]":
        """Return the Region whose wn range contains this band's center, or None."""
        for r in regions.values():
            if r.wn_min <= self.wn_center <= r.wn_max:
                return r
        return None


@dataclass
class Region:
    key: str
    label: str
    wn_min: int
    wn_max: int


@dataclass
class Group:
    key: str
    label: str
    color: str


@dataclass
class Dataset:
    """Everything loaded from the JSONC: metadata + lookups + bands."""
    metadata: dict
    regions: dict[str, Region]
    groups: dict[str, Group]
    bands: list[Band]

    def band_by_id(self, band_id: str) -> Band:
        for b in self.bands:
            if b.id == band_id:
                return b
        raise KeyError(f"No band with id={band_id!r}")

    def n_lanes(self) -> int:
        return max((b.lane for b in self.bands), default=0) + 1
"""Color schemes for the band coloring dimensions.

Each map returns dict[key -> hex color]; the plot looks up a per-band key to
find the color. The dimensions are coordinated so a band can be recolored by
switching which map's value is used.

Dimensions exposed:
  - group       (uses dataset.groups[band.group].color)
  - vibration   (category.subtype, e.g. "stretch.symmetric")
  - atoms       (chemistry-family palette)
  - references  (binary: has refs / no refs) — color "layer", not granular
"""
from __future__ import annotations

from schema import Band, Group


# Fallback for unmapped keys
_GREY = "#7F7F7F"


# ---------------------------------------------------------------------------
# Vibration: category + subtype combined
# ---------------------------------------------------------------------------

def vibration_key(b: Band) -> str:
    """Compound key: 'stretch.symmetric', 'stretch.asymmetric', 'stretch',
    'bend.scissoring', 'bend', 'combination', 'overtone', 'lattice'.

    Subtype is appended only if present; bare category covers the rest.
    """
    cat = b.vibration.category
    sub = b.vibration.subtype
    return f"{cat}.{sub}" if sub else cat


def vibration_label(key: str) -> str:
    """Human-readable label for a vibration key (used in legend)."""
    if "." not in key:
        return key
    cat, sub = key.split(".", 1)
    return f"{cat} ({sub})"


# Palette: hue per category, lightness per subtype.
# Stretches blue family, bends orange family, derived purples, lattice brown.
_VIBRATION_PALETTE: dict[str, str] = {
    # stretch family — blues
    "stretch":              "#3B82C4",  # generic stretch (no subtype)
    "stretch.symmetric":    "#1F5FA0",  # darker
    "stretch.asymmetric":   "#7FB3DC",  # lighter

    # bend family — oranges/reds
    "bend":                 "#E89B3C",  # generic bend
    "bend.symmetric":       "#C77B1F",  # darker
    "bend.asymmetric":      "#F4B468",  # lighter
    "bend.scissoring":      "#D9523A",  # red-orange
    "bend.rocking":         "#B8853D",
    "bend.wagging":         "#C99A2E",
    "bend.twisting":        "#A86B4A",

    # combination/overtone — muted purples (supporting evidence)
    "combination":          "#8C7A95",
    "overtone":             "#A98FAF",

    # lattice — earth brown
    "lattice":              "#9B6B3D",
}


def color_map_by_vibration(bands: list[Band]) -> dict[str, str]:
    """Build a key→color map for whichever vibration keys actually appear."""
    return {vibration_key(b): _VIBRATION_PALETTE.get(vibration_key(b), _GREY) for b in bands}


# ---------------------------------------------------------------------------
# Group, atoms — unchanged
# ---------------------------------------------------------------------------

def color_map_by_group(bands: list[Band], groups: dict[str, Group]) -> dict[str, str]:
    """species → color, sourced from groups[band.group].color."""
    return {b.species: groups[b.group].color for b in bands}


def color_map_by_atoms(bands: list[Band]) -> dict[str, str]:
    """atoms-string → color, grouped by chemistry family."""
    palette = {
        # O-H family (teal)
        "O-H":   "#3FA7A0",
        "H-O-H": "#2A7873",
        "C-O-H": "#7DC9C3",
        # C-H family (green)
        "C-H":   "#5BA84F",
        "H-C-H": "#3D7C36",
        "O-C-H": "#9CCB91",
        # C-O family (coral)
        "C-O":   "#E07856",
        # OCO family (red)
        "O-C-O": "#C03B36",
        "O=C=O": "#E84940",
        # M-H family (gold)
        "M-H":   "#D9A036",
        # M-O family (grey)
        "M-O":   "#5C5C5C",
    }
    return {b.atoms: palette.get(b.atoms, _GREY) for b in bands}


# ---------------------------------------------------------------------------
# References "layer" — binary
# ---------------------------------------------------------------------------

REFERENCES_PRESENT = "#2C8A3E"  # green: has at least one citation
REFERENCES_ABSENT = "#BFBFBF"   # neutral grey: empty references list


def references_key(b: Band) -> str:
    """Returns 'cited' or 'uncited'. Used as the per-band lookup key."""
    return "cited" if b.references else "uncited"


def references_label(key: str) -> str:
    return "Backed by references" if key == "cited" else "No reference yet"


def color_map_by_references(bands: list[Band]) -> dict[str, str]:
    return {
        "cited": REFERENCES_PRESENT,
        "uncited": REFERENCES_ABSENT,
    }
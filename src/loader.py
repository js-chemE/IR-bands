"""Loaders for JSONC band data and BibTeX references.

Both produce plain-Python structures; the JSONC loader populates Band objects
(via schema.py), the BibTeX loader produces a dict[citekey -> reference].

Comment-stripping is handled in pure Python so we don't take a dependency on
json5 or jsonc-parser. The regex correctly skips strings.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from schema import Band, BasedOn, Dataset, Group, Region, Vibration


# ---------------------------------------------------------------------------
# JSONC support
# ---------------------------------------------------------------------------

# Match either a JSON string (which we keep verbatim) OR a comment to strip.
# This pattern matters: the string branch comes first so comment-like text
# inside a string ("URL: http://example.com") is preserved.
_JSONC_PATTERN = re.compile(
    r'"(?:\\.|[^"\\])*"'   # JSON string (non-greedy via char class)
    r'|//[^\n]*'           # // line comment
    r'|/\*.*?\*/',         # /* block comment */
    re.DOTALL,
)


def strip_jsonc_comments(text: str) -> str:
    """Remove // and /* */ comments from JSONC text, preserving strings."""
    def _replace(m: re.Match) -> str:
        s = m.group(0)
        return s if s.startswith('"') else ""
    return _JSONC_PATTERN.sub(_replace, text)


def load_jsonc(path: str | Path) -> dict:
    """Load and parse a .jsonc file."""
    text = Path(path).read_text(encoding="utf-8")
    cleaned = strip_jsonc_comments(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Show context around the error to make debugging painless.
        lines = cleaned.splitlines()
        line_no = e.lineno - 1
        start = max(0, line_no - 2)
        end = min(len(lines), line_no + 3)
        context = "\n".join(
            f"{i + 1:4d} {'>' if i == line_no else ' '} {lines[i]}"
            for i in range(start, end)
        )
        raise ValueError(
            f"JSONC parse error in {path} at line {e.lineno}, col {e.colno}: {e.msg}\n"
            f"Context (after comment stripping):\n{context}"
        ) from e


# ---------------------------------------------------------------------------
# Dataset loader
# ---------------------------------------------------------------------------

def _parse_band(raw: dict) -> Band:
    """Convert a raw dict (from JSON) into a validated Band object."""
    # The vibration field may be a dict (new schema) or a string (legacy);
    # we only support the new schema in this codebase.
    if not isinstance(raw.get("vibration"), dict):
        raise ValueError(
            f"Band {raw.get('id', '?')!r} has legacy vibration field; "
            "expected an object with category/subtype/branch."
        )
    vib = Vibration(**raw["vibration"])

    based_on = [BasedOn(**bo) for bo in raw.get("based_on", [])]

    # Build Band with only the fields it knows about; this is more forgiving
    # than dataclass(**raw) if the JSON has extra keys we want to ignore.
    return Band(
        id=raw["id"],
        species=raw["species"],
        group=raw["group"],
        vibration=vib,
        atoms=raw["atoms"],
        wn_start=raw["wn_start"],
        wn_end=raw["wn_end"],
        region=raw["region"],
        short=raw.get("short", ""),
        description=raw.get("description", ""),
        based_on=based_on,
        references=list(raw.get("references", [])),
        tags=list(raw.get("tags", [])),
        pair=raw.get("pair"),
    )


def load_dataset(path: str | Path) -> Dataset:
    """Load and validate the band dataset from a JSONC file."""
    raw = load_jsonc(path)

    metadata = raw.get("metadata", {})
    regions = {k: Region(key=k, **v) for k, v in raw.get("regions", {}).items()}
    groups = {k: Group(key=k, **v) for k, v in raw.get("groups", {}).items()}
    bands = [_parse_band(b) for b in raw.get("bands", [])]

    dataset = Dataset(metadata=metadata, regions=regions, groups=groups, bands=bands)
    validate_dataset(dataset)
    return dataset


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_dataset(dataset: Dataset, references: dict | None = None) -> None:
    """Raise ValueError on any structural problem.

    If `references` is given, also checks that every band's reference keys
    resolve. Without it, reference-key validation is skipped (used during
    early development before references.bib exists).
    """
    errors: list[str] = []

    # 1. Unique band IDs
    seen: dict[str, int] = {}
    for i, b in enumerate(dataset.bands):
        if b.id in seen:
            errors.append(f"Duplicate band id {b.id!r} (positions {seen[b.id]} and {i})")
        else:
            seen[b.id] = i

    id_set = set(seen)

    # 2. Group / region keys exist
    for b in dataset.bands:
        if b.group not in dataset.groups:
            errors.append(f"Band {b.id}: group {b.group!r} not in groups table")
        if b.region not in dataset.regions:
            errors.append(f"Band {b.id}: region {b.region!r} not in regions table")

    # 3. based_on cross-references resolve
    for b in dataset.bands:
        for bo in b.based_on:
            if bo.band_id is not None and bo.band_id not in id_set:
                errors.append(
                    f"Band {b.id}: based_on references unknown band id {bo.band_id!r}"
                )

    # 4. Combinations/overtones SHOULD have non-empty based_on (warning only)
    warnings: list[str] = []
    for b in dataset.bands:
        if b.is_derived and not b.based_on:
            warnings.append(f"Band {b.id}: {b.vibration.category} has no based_on entries")

    # 5. wn_start/wn_end sanity
    for b in dataset.bands:
        if b.wn_min <= 0:
            errors.append(f"Band {b.id}: non-positive wavenumber {b.wn_min}")
        if b.wn_max < b.wn_min:
            errors.append(f"Band {b.id}: wn_max < wn_min")

    # 6. Reference keys resolve (if a references map is provided)
    if references is not None:
        for b in dataset.bands:
            for ref_key in b.references:
                if ref_key not in references:
                    errors.append(
                        f"Band {b.id}: reference key {ref_key!r} not found in references.bib"
                    )

    # 7. Soft check: overtone wavenumber consistent with parent (warning only)
    for b in dataset.bands:
        if b.vibration.category != "overtone":
            continue
        if len(b.based_on) != 1:
            continue  # not a simple n×fundamental overtone
        bo = b.based_on[0]
        if bo.band_id is None:
            continue
        try:
            parent = dataset.band_by_id(bo.band_id)
        except KeyError:
            continue  # already reported as an error above
        expected = parent.wn_center * bo.multiplier
        # 15% tolerance — anharmonicity makes overtones somewhat lower than n×ν
        if not (0.85 * expected <= b.wn_center <= 1.05 * expected):
            warnings.append(
                f"Band {b.id}: overtone center {b.wn_center:.0f} cm⁻¹ inconsistent "
                f"with {bo.multiplier}× parent {parent.id} ({parent.wn_center:.0f} → "
                f"expected ~{expected:.0f})"
            )

    if errors:
        msg = "Dataset validation failed:\n  " + "\n  ".join(errors)
        if warnings:
            msg += "\n\nWarnings:\n  " + "\n  ".join(warnings)
        raise ValueError(msg)

    if warnings:
        # Don't fail, but make them visible
        import sys
        print("Validation warnings:", file=sys.stderr)
        for w in warnings:
            print(f"  ⚠ {w}", file=sys.stderr)


# ---------------------------------------------------------------------------
# BibTeX loader
# ---------------------------------------------------------------------------

def load_references(path: str | Path) -> dict[str, dict]:
    """Parse a BibTeX file into a dict {citekey: {field: value, ...}}.

    Uses bibtexparser if available, otherwise a minimal hand-rolled parser
    that handles the common cases (entries with @type{key, field=value, ...}).

    Returns empty dict if the file doesn't exist (so the build can run before
    references.bib has been created).
    """
    path = Path(path)
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8")

    try:
        import bibtexparser  # type: ignore
        # bibtexparser v2 API
        try:
            library = bibtexparser.parse_string(text)
            return {
                e.key: {**e.fields_dict, "_type": e.entry_type}
                for e in library.entries
            }
        except AttributeError:
            # Fall back to v1 API
            db = bibtexparser.loads(text)
            return {e["ID"]: {k: v for k, v in e.items() if k != "ID"} for e in db.entries}
    except ImportError:
        return _parse_bibtex_minimal(text)


_BIB_ENTRY_RE = re.compile(r"@(\w+)\s*\{\s*([^,\s]+)\s*,(.*?)\n\}", re.DOTALL)
_BIB_FIELD_RE = re.compile(
    r"(\w+)\s*=\s*"
    r"(?:\{((?:[^{}]|\{[^{}]*\})*)\}|\"([^\"]*)\"|([^,\n]+))",
    re.DOTALL,
)


def _parse_bibtex_minimal(text: str) -> dict[str, dict]:
    """Bare-minimum BibTeX parser: handles {value} and "value" field syntax,
    and balanced single-level braces inside values. Doesn't expand strings,
    crossrefs, or @string definitions. Adequate for hand-written .bib files.
    """
    refs: dict[str, dict] = {}
    for m in _BIB_ENTRY_RE.finditer(text):
        entry_type, key, body = m.group(1).lower(), m.group(2).strip(), m.group(3)
        fields = {"_type": entry_type}
        for fm in _BIB_FIELD_RE.finditer(body):
            name = fm.group(1).lower()
            value = fm.group(2) or fm.group(3) or fm.group(4) or ""
            fields[name] = value.strip()
        refs[key] = fields
    return refs
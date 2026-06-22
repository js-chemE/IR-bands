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

from ir_bands.schema import (
    Band, BasedOn, Dataset, Group, Molecule, Reference, Region, Topology,
    Vibration, VibrationMode, Vibrations,
    VALID_INTENSITIES, VALID_WIDTHS, VALID_CONFIDENCES,
)


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

def _parse_reference(raw) -> Reference | None:
    """Normalize one references[] entry into a Reference.

    Accepts either a bare BibTeX key string (shorthand for {key}) or an
    object {key, wn, site, note, tags}. key is the only required part;
    entries without one are disregarded.
    """
    if isinstance(raw, str):
        return Reference(key=raw) if raw else None
    if isinstance(raw, dict):
        key = raw.get("key")
        if not key:
            return None
        return Reference(
            key=key,
            wn=raw.get("wn"),
            site=raw.get("site"),
            note=raw.get("note"),
            tags=list(raw.get("tags", [])),
        )
    return None


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
        short=raw.get("short", ""),
        description=raw.get("description", ""),
        based_on=based_on,
        references=[r for r in (_parse_reference(rk) for rk in raw.get("references", [])) if r is not None],
        tags=list(raw.get("tags", [])),
        intensity=raw.get("intensity"),
        width=raw.get("width"),
        confidence=raw.get("confidence"),
        pair=raw.get("pair"),
        fermi_partner=raw.get("fermi_partner"),
        fermi_partner_group=raw.get("fermi_partner_group"),
        branch_group=raw.get("branch_group"),
        vibration_modes=list(raw.get("vibration_modes", [])),
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

    # 2. Group keys exist
    for b in dataset.bands:
        if b.group not in dataset.groups:
            errors.append(f"Band {b.id}: group {b.group!r} not in groups table")

    # 3. based_on cross-references resolve (band_id or branch_group)
    branch_group_set = {b.branch_group for b in dataset.bands if b.branch_group}
    for b in dataset.bands:
        for bo in b.based_on:
            if bo.band_id is not None and bo.band_id not in id_set:
                errors.append(
                    f"Band {b.id}: based_on references unknown band id {bo.band_id!r}"
                )
            if bo.branch_group is not None and bo.branch_group not in branch_group_set:
                errors.append(
                    f"Band {b.id}: based_on references unknown branch_group {bo.branch_group!r}"
                )

    # 4. Combinations SHOULD have non-empty based_on (warning only)
    warnings: list[str] = []
    for b in dataset.bands:
        if b.is_derived and not b.based_on:
            warnings.append(f"Band {b.id}: combination has no based_on entries")

    # 5. Categorical field values
    for b in dataset.bands:
        if b.intensity is not None and b.intensity not in VALID_INTENSITIES:
            errors.append(f"Band {b.id}: intensity={b.intensity!r} not in {VALID_INTENSITIES}")
        if b.width is not None and b.width not in VALID_WIDTHS:
            errors.append(f"Band {b.id}: width={b.width!r} not in {VALID_WIDTHS}")
        if b.confidence is not None and b.confidence not in VALID_CONFIDENCES:
            errors.append(f"Band {b.id}: confidence={b.confidence!r} not in {VALID_CONFIDENCES}")

    # 6. fermi_partner / fermi_partner_group cross-references resolve, aren't
    #    self-referential, and aren't both set on the same band
    for b in dataset.bands:
        if b.fermi_partner is not None and b.fermi_partner_group is not None:
            errors.append(f"Band {b.id}: cannot set both fermi_partner and fermi_partner_group")
        if b.fermi_partner is not None:
            if b.fermi_partner == b.id:
                errors.append(f"Band {b.id}: fermi_partner cannot reference itself")
            elif b.fermi_partner not in id_set:
                errors.append(
                    f"Band {b.id}: fermi_partner references unknown band id {b.fermi_partner!r}"
                )
        if b.fermi_partner_group is not None:
            if b.fermi_partner_group == b.branch_group:
                errors.append(f"Band {b.id}: fermi_partner_group cannot reference its own branch_group")
            elif b.fermi_partner_group not in branch_group_set:
                errors.append(
                    f"Band {b.id}: fermi_partner_group references unknown branch_group {b.fermi_partner_group!r}"
                )

    # 7. wn_start/wn_end sanity
    for b in dataset.bands:
        if b.wn_min <= 0:
            errors.append(f"Band {b.id}: non-positive wavenumber {b.wn_min}")
        if b.wn_max < b.wn_min:
            errors.append(f"Band {b.id}: wn_max < wn_min")

    # 8. Reference keys resolve (if a references map is provided)
    if references is not None:
        for b in dataset.bands:
            for ref in b.references:
                if ref.key not in references:
                    errors.append(
                        f"Band {b.id}: reference key {ref.key!r} not found in references.bib"
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


def tag_fermi_pairs(dataset: Dataset) -> list[str]:
    """Auto-assign the "fermi-resonance" tag to bands whose Fermi link is
    reciprocated, handling both kinds of link and any mix of them:
      - fermi_partner: one band <-> one specific band.
      - fermi_partner_group: one band <-> an entire branch_group, used when
        the resonance partner vibration is itself split into branches (e.g.
        two multi-branch combination bands resonating with each other).

    Must run after validate_dataset(), which guarantees any set fermi_partner
    resolves to a real band id, fermi_partner_group resolves to a real
    branch_group, and a band never sets both. One-sided links are left
    untagged and reported as warnings — returned here rather than printed,
    so the caller controls how build output looks.
    """
    branch_group_members: dict[str, list[str]] = {}
    for b in dataset.bands:
        if b.branch_group:
            branch_group_members.setdefault(b.branch_group, []).append(b.id)

    def fermi_targets(b) -> set[str]:
        if b.fermi_partner:
            return {b.fermi_partner}
        if b.fermi_partner_group:
            return set(branch_group_members.get(b.fermi_partner_group, []))
        return set()

    warnings: list[str] = []
    for b in dataset.bands:
        targets = fermi_targets(b)
        if not targets:
            continue
        # My own "identity" for reciprocity purposes: my whole branch_group
        # if I'm in one (any sibling pointing back counts), else just me.
        my_set = set(branch_group_members.get(b.branch_group, [])) if b.branch_group else {b.id}
        reciprocated = any(my_set & fermi_targets(dataset.band_by_id(t)) for t in targets)
        if reciprocated:
            if "fermi-resonance" not in b.tags:
                b.tags.append("fermi-resonance")
        else:
            target_desc = b.fermi_partner or b.fermi_partner_group
            warnings.append(
                f"Band {b.id}: fermi link to {target_desc!r} is not reciprocated"
            )
    return warnings


def tag_branch_groups(dataset: Dataset) -> list[str]:
    """Auto-assign the "rotational-branches" tag to every band that shares a
    non-null branch_group with at least one other band (the R/P/Q siblings
    of one vibrational transition).

    Unlike fermi_partner this is a shared group key rather than a pairwise
    link, since a transition can have 2 (R/P) or 3 (R/P/Q) branches. A key
    used by only one band is most likely a typo or a forgotten sibling —
    reported as a warning rather than tagged.
    """
    groups: dict[str, list[Band]] = {}
    for b in dataset.bands:
        if b.branch_group:
            groups.setdefault(b.branch_group, []).append(b)

    warnings: list[str] = []
    for key, members in groups.items():
        if len(members) < 2:
            warnings.append(
                f"Band {members[0].id}: branch_group={key!r} has only one member "
                "(expected >= 2 for R/P/Q siblings)"
            )
            continue
        for b in members:
            if "rotational-branches" not in b.tags:
                b.tags.append("rotational-branches")
    return warnings


# ---------------------------------------------------------------------------
# Vibrations loader (data/vibrations.jsonc)
# ---------------------------------------------------------------------------

def _parse_mode(raw: dict) -> VibrationMode:
    ir_active = raw.get("ir_active")
    raman_active = raw.get("raman_active")

    # Auto-tag the active case only — an "inactive" mode isn't itself a
    # notable fact worth flagging as a tag, just the absence of one.
    tags = list(raw.get("tags", []))
    if ir_active is True and "ir-active" not in tags:
        tags.append("ir-active")
    if raman_active is True and "raman-active" not in tags:
        tags.append("raman-active")

    return VibrationMode(
        id=raw["id"],
        label=raw.get("label", ""),
        note=raw.get("note", ""),
        ir_active=ir_active,
        raman_active=raman_active,
        tags=tags,
        reference=list(raw.get("reference", [])),
        # Manual fallback only — see VibrationMode's docstring.
        # _link_modes_to_bands() overwrites these once a band links here.
        category=raw.get("category"),
        subtype=raw.get("subtype"),
        atoms=raw.get("atoms"),
    )


def _parse_topology(raw: dict) -> Topology:
    return Topology(id=raw["id"], short=raw["short"], long=raw["long"])


def _parse_molecule(raw: dict) -> Molecule:
    return Molecule(
        id=raw["id"],
        label=raw["label"],
        species=raw["species"],
        shape=raw["shape"],
        band_groups=list(raw.get("band_groups", [])),
        topologies=[_parse_topology(t) for t in raw.get("topologies", [])],
        modes=[_parse_mode(m) for m in raw.get("modes", [])],
    )


def load_vibrations(path: str | Path) -> Vibrations:
    """Load the vibrations content (molecules + their named modes)."""
    raw = load_jsonc(path)
    return Vibrations(molecules=[_parse_molecule(m) for m in raw.get("molecules", [])])


def _link_modes_to_bands(vib: Vibrations, dataset: Dataset) -> list[str]:
    """Resolve Band.vibration_modes (bands.jsonc) into each mode's computed
    `bands` list, and derive category/subtype/atoms from the linked bands.

    Two kinds of link, combined:
      - direct: a band whose own vibration_modes list names this mode.
      - derived: a band with NO vibration_modes of its own, whose based_on
        entries resolve (one level — band_id or branch_group) to a band that
        directly links to this mode. This is how an overtone/combination
        band automatically shows up under its parent fundamental's mode
        without needing its own link.

    category/atoms are always overwritten from the direct bands (erroring if
    they disagree with each other) — both are real properties of the band
    itself, so they can never legitimately differ from what a linked band
    says. subtype is only overwritten when every direct band links to ONLY
    this one mode; a band shared by more than one mode (a real degenerate
    pair) keeps each mode's manually-authored subtype, since the band itself
    can't supply a single correct answer for both. derived bands never
    contribute to category/subtype/atoms (a combination's own category is
    legitimately different from its parent's).

    Returns a list of error strings (doesn't raise) so the caller can fold
    them into one combined validation error alongside its own checks.
    """
    errors: list[str] = []

    all_mode_ids = {m.id for mol in vib.molecules for m in mol.modes}
    band_ids = {b.id for b in dataset.bands}
    branch_group_members: dict[str, list[Band]] = {}
    for b in dataset.bands:
        if b.branch_group:
            branch_group_members.setdefault(b.branch_group, []).append(b)

    for b in dataset.bands:
        for mid in b.vibration_modes:
            if mid not in all_mode_ids:
                errors.append(f"Band {b.id}: vibration_modes entry {mid!r} is not a known mode id")

    def based_on_parents(b: Band) -> list[Band]:
        parents: list[Band] = []
        for bo in b.based_on:
            if bo.band_id is not None and bo.band_id in band_ids:
                parents.append(dataset.band_by_id(bo.band_id))
            elif bo.branch_group is not None:
                parents.extend(branch_group_members.get(bo.branch_group, []))
        return parents

    direct_members: dict[str, list[Band]] = {mid: [] for mid in all_mode_ids}
    for b in dataset.bands:
        for mid in b.vibration_modes:
            if mid in direct_members:
                direct_members[mid].append(b)

    derived_members: dict[str, list[Band]] = {mid: [] for mid in all_mode_ids}
    for b in dataset.bands:
        if b.vibration_modes:
            continue
        parent_modes = {mid for parent in based_on_parents(b) for mid in parent.vibration_modes}
        for mid in parent_modes:
            if mid in derived_members:
                derived_members[mid].append(b)

    for mol in vib.molecules:
        for mode in mol.modes:
            direct = direct_members.get(mode.id, [])
            derived = derived_members.get(mode.id, [])
            mode.bands = [b.id for b in direct] + [b.id for b in derived]

            if direct:
                categories = {b.vibration.category for b in direct}
                if len(categories) > 1:
                    errors.append(f"Mode {mode.id}: linked bands disagree on category: {sorted(categories)}")
                else:
                    mode.category = next(iter(categories))

                atoms_vals = {b.atoms for b in direct}
                if len(atoms_vals) > 1:
                    errors.append(f"Mode {mode.id}: linked bands disagree on atoms: {sorted(atoms_vals)}")
                else:
                    mode.atoms = next(iter(atoms_vals))

                # Only safe to auto-derive subtype when none of the direct
                # bands are shared with a sibling mode (see docstring).
                if all(len(b.vibration_modes) == 1 for b in direct):
                    subtypes = {b.vibration.subtype for b in direct}
                    if len(subtypes) > 1:
                        errors.append(f"Mode {mode.id}: linked bands disagree on subtype: {sorted(subtypes)}")
                    else:
                        mode.subtype = next(iter(subtypes))

            if mode.category is None:
                errors.append(f"Mode {mode.id}: no linked bands and no manual category given")
            if not mode.atoms:
                errors.append(f"Mode {mode.id}: no linked bands and no manual atoms given")

    return errors


def validate_vibrations(
    vib: Vibrations,
    dataset: Dataset,
    references: dict | None = None,
) -> None:
    """Raise ValueError on any structural problem in the vibrations data.

    Tightly coupled to the real band dataset via _link_modes_to_bands() (see
    its docstring) — every band_groups entry must also be a real Group key,
    every topology id must be unique per molecule, and every mode.reference
    citekey resolves against references.bib if given.
    """
    errors = _link_modes_to_bands(vib, dataset)

    seen_molecules: dict[str, int] = {}
    seen_modes: dict[str, str] = {}  # mode id -> molecule id

    for mi, mol in enumerate(vib.molecules):
        if mol.id in seen_molecules:
            errors.append(f"Duplicate molecule id {mol.id!r}")
        else:
            seen_molecules[mol.id] = mi

        for g in mol.band_groups:
            if g not in dataset.groups:
                errors.append(f"Molecule {mol.id}: band_groups entry {g!r} not in groups table")

        seen_topologies: set[str] = set()
        for topo in mol.topologies:
            if topo.id in seen_topologies:
                errors.append(f"Molecule {mol.id}: duplicate topology id {topo.id!r}")
            else:
                seen_topologies.add(topo.id)

        for mode in mol.modes:
            if mode.id in seen_modes:
                errors.append(f"Duplicate mode id {mode.id!r}")
            else:
                seen_modes[mode.id] = mol.id

            if references is not None:
                for key in mode.reference:
                    if key not in references:
                        errors.append(
                            f"Molecule {mol.id}, mode {mode.id}: reference key "
                            f"{key!r} not found in references.bib"
                        )

    if errors:
        raise ValueError("Vibrations validation failed:\n  " + "\n  ".join(errors))


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

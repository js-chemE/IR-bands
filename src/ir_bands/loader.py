"""Loaders for JSONC band data and BibTeX references.

Both produce plain-Python structures; the JSONC loader populates Band objects
(via schema.py), the BibTeX loader produces a dict[citekey -> reference].

Comment-stripping is handled in pure Python so we don't take a dependency on
json5 or jsonc-parser. The regex correctly skips strings.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import fields
from pathlib import Path

from ir_bands.schema import (
    Band, BasedOn, Dataset, Group, GroupSet, Molecule, Reference,
    Region, Species, Surface, Topology, Vibration, VibrationMode, Vibrations,
    VALID_INTENSITIES, VALID_WIDTHS, VALID_CONFIDENCES, VALID_PHASES, VALID_ISOTOPES,
    VALID_TECHNIQUES,
    DESCRIPTION_MAX_WORDS, ISOTOPE_TAGS, REFERENCE_NOTE_MAX_WORDS,
    MARKUP_EXEMPT_VIBRATION_FIELDS, SUBSCRIPT_CHARS,
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
    object {key, wn, measured_on, technique, laser_nm, note, tags}. key is the
    only required part; entries without one are disregarded.
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
            measured_on=raw.get("measured_on"),
            technique=raw.get("technique"),
            laser_nm=raw.get("laser_nm"),
            state=raw.get("state"),
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
        fermi_partner=raw.get("fermi_partner"),
        fermi_partner_group=raw.get("fermi_partner_group"),
        branch_group=raw.get("branch_group"),
        isotopologue_of=raw.get("isotopologue_of"),
        isotope=raw.get("isotope"),
        phase=raw.get("phase"),
        topology=raw.get("topology"),
        vibration_modes=list(raw.get("vibration_modes", [])),
    )


def load_dataset(path: str | Path, validate: bool = True) -> Dataset:
    """Load the band dataset from a JSONC file.

    `validate=False` skips the validation pass, for the caller that attaches
    the species and surfaces tables first and validates once afterwards with
    every cross-file key in scope (build.py). Left on by default so loading a
    dataset on its own still checks what it can.
    """
    raw = load_jsonc(path)

    metadata = raw.get("metadata", {})
    regions = {k: Region(key=k, **v) for k, v in raw.get("regions", {}).items()}
    groups = {k: Group(key=k, **v) for k, v in raw.get("groups", {}).items()}
    sets = {
        k: GroupSet(
            key=k,
            label=v["label"],
            groups=list(v.get("groups", [])),
            note=v.get("note", ""),
            phases=list(v.get("phases", [])),
        )
        for k, v in raw.get("sets", {}).items()
    }
    lanes = [list(lane) for lane in raw.get("lanes", [])]
    bands = [_parse_band(b) for b in raw.get("bands", [])]

    dataset = Dataset(
        metadata=metadata, regions=regions, groups=groups, sets=sets,
        lanes=lanes, bands=bands,
    )
    if validate:
        validate_dataset(dataset)
    return dataset


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_TAG_RE = re.compile(r"<[^>]+>")
# Markup that has no business in a field written with Unicode characters: any
# tag, any HTML entity, any LaTeX math span. See MARKUP_EXEMPT_VIBRATION_FIELDS
# in schema.py for the one exception.
_MARKUP_RE = re.compile(r"<[^>]+>|&[A-Za-z]+;|&#\d+;|\$[^$]+\$")


def _markup_in(text: str | None) -> list[str]:
    """Markup fragments found in text that should be plain Unicode."""
    return [] if not text else _MARKUP_RE.findall(text)


# Words are split on whitespace and sentence punctuation, but NOT on "_" or "/":
# a band id has to survive as one token so it can be recognised, and ids are
# often written as "a/b" when two are named together.
_WORD_RE = re.compile(r"[^\s,;:()\[\]\"']+")


def _subscript_suggestion(token: str) -> str:
    """`nu_as` -> `nuₐₛ` when every character has a real subscript, else ''."""
    head, _, tail = token.partition("_")
    if not tail or "_" in tail:
        return ""
    sub = "".join(SUBSCRIPT_CHARS.get(c, "") for c in tail)
    return f"{head}{sub}" if len(sub) == len(tail) else ""


def _underscores_in(text: str | None, identifiers: set[str]) -> list[tuple[str, str]]:
    """Underscored words that are not machine identifiers, with a suggestion.

    An underscore in a text field is a subscript someone did not type. Band ids,
    group keys, enum values and schema field names are the exception: those are
    identifiers, and prose does name them.
    """
    found: list[tuple[str, str]] = []
    for word in _WORD_RE.findall(text or ""):
        for token in word.split("/"):
            token = token.strip(".,;:()[]\"'")
            if "_" not in token or token in identifiers:
                continue
            found.append((token, _subscript_suggestion(token)))
    return found


def _word_count(text: str | None) -> int:
    """Words in a description or note, ignoring any inline HTML markup."""
    if not text:
        return 0
    return len(_TAG_RE.sub(" ", text).split())


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

    # 2a. Every group sits in exactly one lane. Without this the chart would
    #     silently drop a group's bands, or draw them twice.
    if dataset.lanes:
        seen_in_lane: dict[str, int] = {}
        for i, lane in enumerate(dataset.lanes):
            if not lane:
                errors.append(f"Lane {i}: names no groups")
            for gk in lane:
                if gk not in dataset.groups:
                    errors.append(f"Lane {i}: group {gk!r} not in groups table")
                elif gk in seen_in_lane:
                    errors.append(
                        f"Group {gk!r} is in two lanes ({seen_in_lane[gk]} and {i})"
                    )
                else:
                    seen_in_lane[gk] = i
        for gk in dataset.groups:
            if gk not in seen_in_lane:
                errors.append(f"Group {gk!r} is in no lane; add it to the lanes table")

    # 2b. Every set names real groups, and says something (an empty set would
    #     render as a filter that hides everything).
    for gs in dataset.sets.values():
        for gk in gs.groups:
            if gk not in dataset.groups:
                errors.append(f"Set {gs.key}: group {gk!r} not in groups table")
        if not gs.groups:
            errors.append(f"Set {gs.key}: names no groups")
        for ph in gs.phases:
            if ph not in VALID_PHASES:
                errors.append(f"Set {gs.key}: phase {ph!r} is not one of {sorted(VALID_PHASES)}")

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
        # Closed, because each value derives a tag of its own.
        if b.isotope is not None and b.isotope not in VALID_ISOTOPES:
            errors.append(f"Band {b.id}: isotope={b.isotope!r} not in {sorted(VALID_ISOTOPES)}")

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

    # 6b. isotopologue_of resolves, isn't self-referential, and travels
    #     together with `isotope` (one without the other is always a typo:
    #     an unlabeled link says nothing about WHICH substitution, and a
    #     lone label has no parent to be shifted from).
    for b in dataset.bands:
        if b.isotopologue_of is not None:
            if b.isotopologue_of == b.id:
                errors.append(f"Band {b.id}: isotopologue_of cannot reference itself")
            elif b.isotopologue_of not in id_set:
                errors.append(
                    f"Band {b.id}: isotopologue_of references unknown band id {b.isotopologue_of!r}"
                )
            if not b.isotope:
                errors.append(f"Band {b.id}: isotopologue_of is set but isotope is missing")
            # No chains: the parent must be the natural-abundance band, so
            # the vibration_modes chase below only ever has to walk one hop.
            if b.isotopologue_of in id_set and dataset.band_by_id(b.isotopologue_of).isotopologue_of:
                errors.append(
                    f"Band {b.id}: isotopologue_of points at {b.isotopologue_of!r}, which is "
                    "itself an isotopologue — link to the natural-abundance band instead"
                )
        elif b.isotope:
            errors.append(f"Band {b.id}: isotope={b.isotope!r} is set but isotopologue_of is missing")

    # 6c. An isotopologue is the same mode with a heavier nucleus. It therefore
    #     belongs to the same species, moves the same atoms and is the same kind
    #     of vibration; only the position changes. `branch` is left out of the
    #     check on purpose: a shifted band is sometimes drawn as the whole
    #     R-to-P envelope where the parent is resolved into branches.
    for b_ in dataset.bands:
        if b_.isotopologue_of is None or b_.isotopologue_of not in id_set:
            continue
        parent = dataset.band_by_id(b_.isotopologue_of)
        for field, mine, theirs in (
            ("species", b_.species, parent.species),
            ("atoms", b_.atoms, parent.atoms),
            ("vibration.category", b_.vibration.category, parent.vibration.category),
            ("vibration.subtype", b_.vibration.subtype, parent.vibration.subtype),
        ):
            if mine != theirs:
                errors.append(
                    f"Band {b_.id}: {field}={mine!r} but its parent {parent.id} has "
                    f"{theirs!r}; an isotopologue is the same mode, so these must match"
                )

    # 7. wn_start/wn_end sanity
    for b in dataset.bands:
        if b.wn_min <= 0:
            errors.append(f"Band {b.id}: non-positive wavenumber {b.wn_min}")
        if b.wn_max < b.wn_min:
            errors.append(f"Band {b.id}: wn_max < wn_min")

    # 8. Editorial length limits (warning only). Prose that overflows the
    #    tooltip is a content problem, not a structural one, so it never fails
    #    the build. See the Style guide page for the writing rules themselves.
    for b in dataset.bands:
        n = _word_count(b.description)
        if n > DESCRIPTION_MAX_WORDS:
            warnings.append(
                f"Band {b.id}: description is {n} words "
                f"(limit {DESCRIPTION_MAX_WORDS}); move paper-specific detail "
                f"into the relevant reference note"
            )
        for ref in b.references:
            n = _word_count(ref.note)
            if n > REFERENCE_NOTE_MAX_WORDS:
                warnings.append(
                    f"Band {b.id}, reference {ref.key}: note is {n} words "
                    f"(limit {REFERENCE_NOTE_MAX_WORDS})"
                )

    # 9. Notation (warning only): Unicode characters, not markup. The chart
    #    tooltip strips tags while the References page renders them, so markup
    #    makes the same sentence read differently in two places.
    for b in dataset.bands:
        for field, text in (
            ("short", b.short),
            ("description", b.description),
        ):
            for frag in _markup_in(text):
                warnings.append(
                    f"Band {b.id}: {field} contains markup {frag!r}; "
                    f"write the Unicode character instead"
                )
        for ref in b.references:
            for frag in _markup_in(ref.note):
                warnings.append(
                    f"Band {b.id}, reference {ref.key}: note contains markup "
                    f"{frag!r}; write the Unicode character instead"
                )

    # 10. Underscores (warning only). Machine identifiers keep theirs; prose
    #     does not, because an underscore in prose is a subscript that never
    #     got typed.
    identifiers = set(id_set) | set(dataset.groups) | VALID_WIDTHS | VALID_INTENSITIES
    identifiers |= VALID_CONFIDENCES | branch_group_set
    identifiers |= {f.name for f in fields(Band)}
    identifiers |= set(dataset.species) | set(dataset.surfaces)
    identifiers |= VALID_PHASES | VALID_TECHNIQUES
    # Only prose is checked. `species` and the surface fields used to be display
    # text and were read here; they are keys into their own tables now, checked
    # by resolution instead, and an underscore in a key is exactly right.
    for b in dataset.bands:
        checks = [
            ("short", b.short),
            ("description", b.description),
        ]
        for ref in b.references:
            checks.append((f"reference {ref.key} note", ref.note))
        for field, text in checks:
            for token, suggestion in _underscores_in(text, identifiers):
                fix = (
                    f"write {suggestion!r}"
                    if suggestion
                    else "no Unicode subscript exists for those letters, so "
                         "parenthesise instead, e.g. A(HF)"
                )
                warnings.append(
                    f"Band {b.id}: {field} contains {token!r}; an underscore in "
                    f"text is a subscript that was never typed: {fix}"
                )

    # 11. Cross-file keys resolve: species and surfaces.
    #     Skipped when the table is empty, the same way reference-key
    #     validation is skipped without a references map, so the loader still
    #     works on a dataset loaded on its own.
    if dataset.species:
        for b in dataset.bands:
            if b.species not in dataset.species:
                errors.append(
                    f"Band {b.id}: species {b.species!r} not in species.jsonc"
                )
    for b in dataset.bands:
        if b.phase is not None and b.phase not in VALID_PHASES:
            errors.append(f"Band {b.id}: phase={b.phase!r} not in {sorted(VALID_PHASES)}")
        if b.phase == "gas" and b.topology is not None:
            errors.append(
                f"Band {b.id}: phase=gas cannot have topology={b.topology!r}; "
                "a free molecule has no binding geometry"
            )

    if dataset.surfaces:
        for b in dataset.bands:
            for ref in b.references:
                for key in _as_list(ref.measured_on):
                    if key not in dataset.surfaces:
                        errors.append(
                            f"Band {b.id}, reference {ref.key}: measured_on {key!r} "
                            "not in surfaces.jsonc"
                        )

    # 11c. A claim's wavenumber falls inside the band's own window. A band's
    #      window is the envelope of credible positions for that mode, so a
    #      claim outside it means one of two things, both worth looking at:
    #      the window is too narrow, or the claim belongs on a different band.
    #      A warning rather than an error, since the honest fix is sometimes to
    #      leave it and say so in the note.
    for b_ in dataset.bands:
        for ref in b_.references:
            for w in _as_list(ref.wn):
                if not (b_.wn_start <= w <= b_.wn_end):
                    warnings.append(
                        f"Band {b_.id}, reference {ref.key}: wn={w} is outside the band's "
                        f"window {b_.wn_start}-{b_.wn_end} cm-1"
                    )

    # 12. A gas-phase band sits on nothing, at any level. The molecule is in
    #     the cell, not on the catalyst, and the same gas band appears over
    #     whatever happens to be in the beam, so a surface here answers no
    #     query and quietly credits the sample with a band it did not cause.
    #     Which cell it was seen in belongs in the note.
    for b_ in dataset.bands:
        if b_.phase != "gas":
            continue
        for ref in b_.references:
            for key in _as_list(ref.measured_on):
                surf = dataset.surfaces.get(key)
                level = f"{surf.level} " if surf is not None else ""
                warnings.append(
                    f"Band {b_.id}, reference {ref.key}: phase=gas but the claim "
                    f"names {level}{key!r}; a free molecule sits on nothing"
                )

    # 13. Rotational branches are one transition of one species, so siblings
    #     that disagree about what they are looking at are a real error in the
    #     data rather than a stylistic slip. Reported as a warning because
    #     resolving it needs a judgement about the chemistry.
    for key, members in branch_group_members_for(dataset).items():
        species_seen = {b.species for b in members}
        phases_seen = {b.phase for b in members if b.phase is not None}
        if len(species_seen) > 1:
            warnings.append(
                f"branch_group {key!r}: members disagree on species "
                f"({', '.join(sorted(species_seen))}); branch siblings are one "
                "transition of one species"
            )
        if len(phases_seen) > 1:
            warnings.append(
                f"branch_group {key!r}: members disagree on phase "
                f"({', '.join(sorted(phases_seen))}); rotational branches only "
                "exist for a freely rotating gas-phase molecule"
            )

    # 14. An isotopologue is the same species as its parent, just heavier.
    by_id = {b.id: b for b in dataset.bands}
    for b in dataset.bands:
        parent = by_id.get(b.isotopologue_of) if b.isotopologue_of else None
        if parent is not None and parent.species != b.species:
            errors.append(
                f"Band {b.id}: isotopologue_of points at {parent.id}, which is "
                f"species {parent.species!r} rather than {b.species!r}"
            )

    # 15. Reference keys resolve (if a references map is provided)
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
    non-null branch_group with at least one other band (the branch siblings
    of one vibrational transition).

    Unlike fermi_partner this is a shared group key rather than a pairwise
    link, since a transition can have 2 or 3 branches, and which letters
    depends on the technique: P/R or P/Q/R in the infrared, where one photon
    turns the molecule by dJ = +/-1, and O/S or O/Q/S in Raman, where two
    photons turn it by dJ = +/-2. A key used by only one band is most likely
    a typo or a forgotten sibling, reported as a warning rather than tagged.
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
                "(expected >= 2 branch siblings: P/Q/R in the infrared, "
                "O/Q/S in Raman)"
            )
            continue
        for b in members:
            # Which word is honest depends on what the siblings are. For a
            # vibrational band they are different BRANCHES of one transition,
            # P against R against Q. A pure rotational spectrum has only ever
            # one branch, S, so its siblings are the individual LINES of that
            # branch, one per starting level. Calling those "branches" would
            # promise a P and an R that cannot exist.
            tag = ("rotational" if b.vibration.category == "rotational"
                   else "rotational-branches")
            if tag not in b.tags:
                b.tags.append(tag)
    return warnings


def share_branch_modes(dataset: Dataset) -> list[str]:
    """Give every branch of one transition the same `vibration_modes`.

    The branches are one vibration seen from different rotational levels: the
    letter is only how far J moved, so O, P, Q, R and S of a branch_group all
    document the same normal mode. Authoring the link five times invites four
    of them to be forgotten, which is exactly what happened to methane: its
    Raman O and S branches carried no mode and so drew no diagram while the
    P, Q and R of the same transition did.

    Derived rather than authored, then, and for the usual reason: nobody
    writes it, so it cannot drift. A branch that names a mode of its own keeps
    it; the rest are filled from whichever sibling has one. Two siblings
    naming DIFFERENT modes is a real authoring error and is reported, since it
    means one of the two is in the wrong branch_group.
    """
    groups: dict[str, list[Band]] = {}
    for b in dataset.bands:
        if b.branch_group:
            groups.setdefault(b.branch_group, []).append(b)

    warnings: list[str] = []
    for key, members in groups.items():
        named = [b for b in members if b.vibration_modes]
        if not named:
            continue
        distinct = {tuple(b.vibration_modes) for b in named}
        if len(distinct) > 1:
            listed = "; ".join(
                f"{b.id}={list(b.vibration_modes)}" for b in named
            )
            warnings.append(
                f"branch_group={key!r}: siblings name different vibration_modes "
                f"({listed}). The branches of one transition are one mode, so "
                f"one of these is in the wrong group"
            )
            continue
        modes = list(named[0].vibration_modes)
        for b in members:
            if not b.vibration_modes:
                b.vibration_modes = list(modes)
    return warnings


def spread_degeneracy(dataset: Dataset) -> list[str]:
    """A band built on a degenerate mode is degenerate too.

    Degeneracy is a fact about the mode: CO2's bend is doubly degenerate
    because the molecule can bend in two equivalent planes, and methane's
    triply degenerate stretch for the same kind of reason. An overtone or a
    combination built on such a mode inherits it, because the level it reaches
    is still built out of those equivalent components: 2v2 of CO2 is not one
    level but a set, and that is exactly why its Fermi resonance with v1
    works at all.

    So the tag is authored once, on the mode itself, and carried down every
    based_on link from there rather than repeated on each descendant, where it
    would be forgotten on some. Transitive, because a combination built on a
    combination is no less degenerate, and a fixed point rather than one pass
    for the same reason.
    """
    TAG = "degenerated"
    by_id = {b.id: b for b in dataset.bands}
    by_group: dict[str, list[Band]] = {}
    for b in dataset.bands:
        if b.branch_group:
            by_group.setdefault(b.branch_group, []).append(b)

    changed = True
    while changed:
        changed = False
        for b in dataset.bands:
            if TAG in b.tags:
                continue
            for bo in b.based_on:
                parents: list[Band] = []
                if bo.band_id and bo.band_id in by_id:
                    parents.append(by_id[bo.band_id])
                if bo.branch_group:
                    parents.extend(by_group.get(bo.branch_group, []))
                if any(TAG in p.tags for p in parents):
                    b.tags.append(TAG)
                    changed = True
                    break
    return []


def tag_fundamentals(dataset: Dataset) -> None:
    """Auto-assign the "fundamental" tag: v = 0 -> 1 of a normal mode.

    Derived rather than authored, like every other tag here, because the
    fields already say it. A band is a fundamental unless it is one of the
    things a fundamental is not:

      - a combination, which is two modes at once (its own category);
      - an overtone, which is more than one step of one mode (the tag);
      - built on anything at all, which is the general form of both;
      - electronic, which is not a normal mode and so has no fundamental;
      - rotational, for the same reason: nothing vibrates, so there is no
        v = 0 -> 1 step to be the first of.

    A branch of a VIBRATIONAL band is a fundamental: P, Q, R, O and S are the
    same v = 0 -> 1 transition seen from different rotational levels, which is
    why the branch letter alone never disqualifies a band. A pure rotational
    band is the case where that reasoning stops, because v does not change at
    all: H2's rotational S(3) sits at 1035 cm-1, nowhere near its 4160 cm-1
    fundamental, precisely because it is not one. An IR-inactive mode is a
    fundamental too: being forbidden does not stop it being the first step.
    """
    for b in dataset.bands:
        if b.vibration.category in ("combination", "electronic", "rotational"):
            continue
        if "overtone" in b.tags or b.based_on:
            continue
        if "fundamental" not in b.tags:
            b.tags.append("fundamental")


def tag_calculated_only(dataset: Dataset) -> None:
    """Auto-assign "computational": every claim on this band is a calculation.

    The same word the per-claim technique tag uses, and deliberately so: on a
    claim it says that claim is a calculation, on a band that every claim
    behind it is. They never meet in the chart legend, which counts band tags
    only.

    Not the same thing as having no references. A band with no claim at all
    is one nobody has written down; this one has a source, it is just not a
    measurement. The chart keeps the two apart for that reason: both can be
    faded, but from separate switches, so "show me only what somebody put a
    spectrometer in front of" is a question the reader can actually ask.

    Spectroscopy does not enter into it. A calculation has no sampling
    geometry, so it is neither an infrared nor a Raman claim, and a band
    resting on one alone is unmeasured in both views equally.
    """
    for b in dataset.bands:
        if not b.references:
            continue
        if all(r.technique == "computational" for r in b.references):
            if "computational" not in b.tags:
                b.tags.append("computational")


def tag_isotopologues(dataset: Dataset) -> list[str]:
    """Auto-assign the substitution tag to every band that declares an
    isotopologue_of link — and only to those.

    The tag names the substitution ("deuterium", "carbon-13", "oxygen-18")
    rather than the fact of being one, so a deuteration experiment can be
    filtered apart from an 18-O one. ISOTOPE_TAGS in schema.py is the mapping,
    and the isotope field is validated against its keys.

    Unlike tag_fermi_pairs/tag_branch_groups this link is deliberately
    one-directional (see Band.isotopologue_of): the natural-abundance parent
    is NOT tagged, so the tag reads unambiguously as "this band is the
    isotope-substituted twin of another one". Evidence-by-substitution on an
    ordinary band is a different claim entirely and lives as the per-citation
    "isotope-labeling" reference tag instead.

    Must run after validate_dataset(), which guarantees isotopologue_of
    resolves and never chains. Always returns an empty warning list — there
    is no reciprocity or group cardinality left to check by this point — but
    keeps the same signature as the other two taggers so build.py can treat
    all three identically.
    """
    for b in dataset.bands:
        if not b.isotopologue_of or not b.isotope:
            continue
        # The umbrella first, then the substitution: one answers "is this a
        # labelled band at all", the other "which label".
        for tag in ("isotope", ISOTOPE_TAGS[b.isotope]):
            if tag not in b.tags:
                b.tags.append(tag)
    return []


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
        topology=raw.get("topology"),
        herzberg_notation=raw.get("herzberg_notation"),
        symmetry=raw.get("symmetry"),
        wn_start=raw.get("wn_start"),
        wn_end=raw.get("wn_end"),
    )


def _parse_topology(raw: dict) -> Topology:
    return Topology(id=raw["id"], short=raw["short"], long=raw["long"], point_group=raw.get("point_group"))


def _parse_molecule(raw: dict) -> Molecule:
    # `species` is deliberately not read here: the molecule/species link is
    # authored once, in species.jsonc, and back-filled onto the Molecule by
    # validate_vibrations(). Same one-place rule as Band.vibration_modes.
    return Molecule(
        id=raw["id"],
        label=raw["label"],
        shape=raw["shape"],
        band_groups=list(raw.get("band_groups", [])),
        topologies=[_parse_topology(t) for t in raw.get("topologies", [])],
        modes=[_parse_mode(m) for m in raw.get("modes", [])],
    )


def load_vibrations(path: str | Path) -> Vibrations:
    """Load the vibrations content (molecules + their named modes)."""
    raw = load_jsonc(path)
    return Vibrations(molecules=[_parse_molecule(m) for m in raw.get("molecules", [])])


def _as_list(value) -> list:
    """Normalize the scalar-or-array fields (measured_on, wn) to a list."""
    if value is None:
        return []
    return list(value) if isinstance(value, list) else [value]


def branch_group_members_for(dataset: Dataset) -> dict[str, list[Band]]:
    """Bands grouped by their branch_group key, skipping the unbranched ones."""
    groups: dict[str, list[Band]] = {}
    for b in dataset.bands:
        if b.branch_group:
            groups.setdefault(b.branch_group, []).append(b)
    return groups


def check_phase(dataset: Dataset) -> list[str]:
    """Warn where Band.phase contradicts the states of its own claims.

    The phase is not tagged on the band any more. A band has no sample of its
    own: every phase the atlas knows about was the state of some measurement,
    so the chips come from the claims (tag_states) and bubble up to the band
    in the frontend. That leaves Band.phase as an editorial statement about
    what the species is, which the sets filter on, and it can fall out of step
    with the measurements underneath it.

    It already had: five deuterated methanol bands said "gas" while every
    claim on them was a neon matrix, and the silica overtone said "surface"
    where its claims say "solid". This prints those rather than silently
    keeping two answers to one question.
    """
    warnings: list[str] = []
    for b in dataset.bands:
        states = {
            ref.state
            for ref in b.references
            if ref.technique != "computational" and ref.state
        }
        if b.phase and states and b.phase not in states:
            warnings.append(
                f"band {b.id!r} has phase {b.phase!r} but every claim on it "
                f"was measured {'/'.join(sorted(states))}"
            )
    return warnings


#: Which spectroscopy each technique belongs to. Mirrors TECHNIQUES[].
#: spectroscopy in frontend/src/lib/dataModel.ts; keep the two in step.
RAMAN_TECHNIQUES = {"raman", "srs"}

#: Technique -> the umbrella tag derived alongside it. Mirrors
#: TECHNIQUE_FAMILY in frontend/src/lib/dataModel.ts; keep the two in step.
#: "raman" maps to itself: a paper that says only "Raman" has named the
#: family and nothing finer, so the family tag and the value are one chip.
TECHNIQUE_FAMILY = {
    "drifts": "infrared",
    "transmission": "infrared",
    "atr": "infrared",
    "ftir": "infrared",
    "irras": "infrared",
    "pm_irras": "infrared",
    "emission": "infrared",
    "mioirs": "infrared",
    "raman": "raman",
    "srs": "raman",
    "computational": "computational",
}

#: Branch letters that only Raman can produce. The infrared absorbs one
#: photon through a rank-one operator, the dipole, so it reaches dJ = 0, +/-1
#: and no further: P, Q and R. Raman scatters through the polarizability,
#: a rank-two tensor, and the triangle rule on its irreducible components
#: (j = 0, 1, 2) admits dJ up to +/-2, which is where O and S come from
#: (Long, The Raman Effect, pp. 158-159 and p. 276).
#:
#: The converse does NOT hold, which is why only these two letters are
#: listed. P and R are not infrared-only: Raman reaches dJ = +/-1 too
#: whenever the rotor allows it. dJ = 0, +/-2 is the rule for a LINEAR
#: molecule in a non-degenerate vibration; a symmetric top, a spherical top
#: and a linear molecule in a degenerate vibration all allow dJ = 0, +/-1,
#: +/-2 (Long, Table 6.5, p. 167). Methane's triply degenerate F2 mode is
#: exactly that case, so its Raman band genuinely carries P and R branches.
#: Checking those would need the rotor type and the mode's degeneracy, which
#: live in vibrations.jsonc and are not loaded at this point.
RAMAN_ONLY_BRANCHES = {"O", "S"}


def check_branches(dataset: Dataset) -> list[str]:
    """Warn where an O or S branch rests only on infrared claims.

    O and S are dJ = +/-2 steps. One photon through the dipole cannot drive
    them, so no infrared measurement can have seen one, and a band carrying
    an O or S branch whose every claim is infrared is asserting a line those
    claims could not have produced.

    Only this direction is checked. The mirror image, a P or R branch resting
    only on Raman claims, is not an error in general: see RAMAN_ONLY_BRANCHES
    above for why, and for the rotor-dependent rule that decides it.

    Computational claims are ignored: a calculation has no technique in the
    sense that matters here and would otherwise excuse a band from the check.
    """
    warnings: list[str] = []
    for b in dataset.bands:
        branch = b.vibration.branch or ""
        if branch not in RAMAN_ONLY_BRANCHES:
            continue
        seen = {
            "Raman" if ref.technique in RAMAN_TECHNIQUES else "infrared"
            for ref in b.references
            if ref.technique and ref.technique != "computational"
        }
        if seen and "Raman" not in seen:
            warnings.append(
                f"band {b.id!r} is branch {branch} (a dJ = +/-2 step, which "
                f"only Raman reaches) but every claim on it is infrared"
            )
    return warnings


def tag_techniques(dataset: Dataset) -> list[str]:
    """Derive each citation's technique tag from Reference.technique.

    The technique is a field now, but the tag chips in the chart legend and on
    the references page keep working because the tag is regenerated here. The
    tag is simply the technique's own name.

    One tag, not two. A claim used to get its family alongside the value,
    "infrared" beside "transmission", so the legend could ask "seen in the
    infrared at all" with one chip. In practice it doubled the technique
    chips on every claim and every band for a question the chart already
    answers better: the IR | Raman switch greys out and folds the claims of
    the other spectroscopy, which is that question asked of the whole chart
    at once rather than of one band.

    The family itself is not gone, only the tag: TECHNIQUE_FAMILY still
    orders the legend and still decides which claims the spectroscopy switch
    folds. "raman" and "computational" still appear as chips because they are
    technique values in their own right, not because they are families.
    """
    for b in dataset.bands:
        for ref in b.references:
            if not ref.technique:
                continue
            if ref.technique not in ref.tags:
                ref.tags.append(ref.technique)
    return []


def tag_states(dataset: Dataset) -> list[str]:
    """Derive each claim's sample-state tag from Reference.state.

    The state is what was in the beam, and it moves the number more than most
    things do: methanol's O-H stretch is 3687 cm-1 as a vapour, near 3300 as a
    hydrogen-bonded liquid and 3690 isolated in solid neon. Without the field
    those three rows read as a disagreement rather than as three experiments,
    and the only place it was ever written was prose the chart cannot see.

    Returns one summary warning rather than one per claim, because every claim
    should carry a state and the ones that do not are a backlog, not a fault
    worth printing five hundred times.
    """
    missing = 0
    total = 0
    for b in dataset.bands:
        for ref in b.references:
            # A calculation has no sample in a beam, so it has no state to
            # record and is not counted as a gap. Everything measured is.
            if ref.technique == "computational":
                continue
            total += 1
            if ref.state is None:
                missing += 1
                continue
            if ref.state not in ref.tags:
                ref.tags.append(ref.state)
    if missing:
        return [
            f"{missing} of {total} claims record no sample state "
            f"(state: gas | liquid | matrix | solid | adsorbed)"
        ]
    return []


def tag_lasers(dataset: Dataset) -> list[str]:
    """Derive each Raman claim's excitation-wavelength tag from laser_nm.

    The tag is the wavelength written the way a paper writes it, "515 nm",
    and the frontend colours that one chip with the colour of the light
    (lib/lightColor.ts) rather than from a fixed table: the wavelength is a
    number, not a member of a vocabulary, so no static tag map could hold it.

    Warns where the field is set on a claim that is not Raman. A wavelength
    means the excitation line, and an infrared claim has no such thing.
    """
    warnings: list[str] = []
    for b in dataset.bands:
        for ref in b.references:
            if ref.laser_nm is None:
                continue
            if ref.technique not in RAMAN_TECHNIQUES:
                warnings.append(
                    f"Band {b.id}, reference {ref.key}: laser_nm is set but "
                    f"technique={ref.technique!r}; a wavelength is the Raman "
                    f"excitation line and means nothing on an infrared claim"
                )
            # Rounded to the nearest nanometre: the chip is a label, not the
            # measurement. laser_nm keeps the exact figure the paper printed,
            # so 514.5 stays 514.5 in the data and reads "515 nm" on screen.
            # Not round(), whose half-to-even rule turns 514.5 into 514.
            tag = f"{math.floor(float(ref.laser_nm) + 0.5)} nm"
            if tag not in ref.tags:
                ref.tags.append(tag)
    return warnings


def assign_reference_uids(dataset: Dataset) -> list[str]:
    """Give every citation a stable handle: "<band id>::<citekey>".

    A citation is a claim about one band by one paper, and it is the row a
    site or technique query actually returns, so it needs to be addressable.
    Derived rather than authored: nothing in the data file has to change, and
    an ordinal is appended only where one paper makes several claims about the
    same band (which happens three times today, all of them a second site or
    a second reported position).
    """
    for b in dataset.bands:
        seen: dict[str, int] = {}
        for ref in b.references:
            n = seen.get(ref.key, 0) + 1
            seen[ref.key] = n
            ref.uid = f"{b.id}::{ref.key}" + (f"::{n}" if n > 1 else "")
    return []


def load_surfaces(path: str | Path) -> dict[str, Surface]:
    """Load the surfaces table from data/surfaces.jsonc.

    One table at three levels; see the Surface docstring for why they are not
    separated. `parts` points down the scale and must resolve, and a part may
    not sit at a coarser level than its container, which is what stops the
    containment chain from looping back on itself.
    """
    raw = load_jsonc(path)
    surfaces = {
        key: Surface(
            key=key,
            label=value["label"],
            level=value["level"],
            kind=value.get("kind"),
            element=value.get("element"),
            oxidation_state=value.get("oxidation_state"),
            formula=value.get("formula"),
            composition=value.get("composition"),
            elements=list(value.get("elements", [])),
            facet=value.get("facet"),
            parts=list(value.get("parts", [])),
            note=value.get("note", ""),
        )
        for key, value in raw.get("surfaces", {}).items()
    }

    rank = {"sample": 2, "phase": 1, "site": 0}
    errors: list[str] = []
    for surf in surfaces.values():
        for part in surf.parts:
            if part not in surfaces:
                errors.append(f"Surface {surf.key}: part {part!r} is not a surface key")
                continue
            child = surfaces[part]
            # An interface is the one site defined by what it touches, and one
            # of those is usually a whole phase: the Pt-CeO2 perimeter is not
            # the Pt atom plus a Ce cation, it is the metal against the oxide.
            # Every other container lists parts strictly below it.
            interface = surf.level == "site" and surf.kind == "interface"
            if rank[child.level] > rank[surf.level] and not interface:
                errors.append(
                    f"Surface {surf.key} ({surf.level}) lists {part!r} ({child.level}) "
                    "as a part; parts go down the scale, never up "
                    "(only an interface site may name a phase)"
                )
            # A container cannot present something made of an element it does
            # not contain; that check is what an element query relies on.
            own = set(surf.all_elements)
            child_elements = set(child.all_elements)
            if own and child_elements and not child_elements <= own:
                missing = sorted(child_elements - own)
                errors.append(
                    f"Surface {surf.key}: part {part!r} contains {missing} which "
                    f"{surf.key} does not list among its elements"
                )
    if errors:
        raise ValueError("surfaces.jsonc validation failed:\n  " + "\n  ".join(errors))
    return surfaces


def load_species(path: str | Path) -> dict[str, Species]:
    """Load the species table from data/species.jsonc.

    `molecule` is validated against vibrations.jsonc later, in
    validate_vibrations(), which is where both files are in scope.
    """
    raw = load_jsonc(path)
    return {
        key: Species(
            key=key,
            label=value["label"],
            formula=value["formula"],
            molecule=value.get("molecule"),
            note=value.get("note", ""),
        )
        for key, value in raw.get("species", {}).items()
    }


def load_tags(path: str | Path) -> dict:
    """Load the tag-tooltip lookup table: {tag: {"tip": str}}.

    Free-form by design (see tags.jsonc's own preamble) — this isn't
    validated against the tags actually used in bands.jsonc/vibrations.jsonc,
    just checked for basic shape so a typo'd entry fails loudly at build time
    rather than silently rendering no tooltip.
    """
    raw = load_jsonc(path)
    tags = raw.get("tags", {})
    for key, value in tags.items():
        if not isinstance(value, dict) or not value.get("tip"):
            raise ValueError(f"tags.jsonc: tag {key!r} is missing a non-empty 'tip'")
    return tags


def _link_modes_to_bands(vib: Vibrations, dataset: Dataset) -> list[str]:
    """Resolve Band.vibration_modes (bands.jsonc) into each mode's computed
    `bands` list, and derive category/subtype/atoms from the linked bands.

    Two kinds of link, combined:
      - direct: a band whose own vibration_modes list names this mode.
      - derived: a band with NO vibration_modes of its own, whose based_on
        entries (band_id or branch_group) or isotopologue_of link resolve —
        one level — to a band that directly links to this mode. This is how
        an overtone/combination band, or an isotope-substituted twin,
        automatically shows up under its parent fundamental's mode without
        needing its own link. As a side effect, this function also
        back-fills that band's own Band.vibration_modes in place with the
        resolved parent mode id(s) — so the band's *own* field reflects the
        inherited link too, not just the mode's computed `bands` list.

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

    def parent_bands(b: Band) -> list[Band]:
        parents: list[Band] = []
        for bo in b.based_on:
            if bo.band_id is not None and bo.band_id in band_ids:
                parents.append(dataset.band_by_id(bo.band_id))
            elif bo.branch_group is not None:
                parents.extend(branch_group_members.get(bo.branch_group, []))
        # An isotopologue is literally the same normal mode on a heavier
        # molecule, so it inherits its parent's vibration_modes the same way
        # a combination inherits its fundamentals' — see Band.isotopologue_of.
        if b.isotopologue_of is not None and b.isotopologue_of in band_ids:
            parents.append(dataset.band_by_id(b.isotopologue_of))
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
        parent_modes = {mid for parent in parent_bands(b) for mid in parent.vibration_modes}
        if parent_modes:
            # Inherit in place: a combination/overtone band never authors its
            # own vibration_modes (see Band.vibration_modes' docstring), but
            # the frontend's band-chart tooltip reads this field directly, so
            # it needs the real, resolved list here rather than staying empty
            # — sorted for a deterministic emitted order.
            b.vibration_modes = sorted(parent_modes)
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
) -> list[str]:
    """Raise ValueError on any structural problem in the vibrations data.

    Tightly coupled to the real band dataset via _link_modes_to_bands() (see
    its docstring) — every band_groups entry must also be a real Group key,
    every topology id must be unique per molecule, and every mode.reference
    citekey resolves against references.bib if given.

    Also resolves the two links that cross into species.jsonc and bands.jsonc:
    Molecule.species is back-filled from Species.molecule, and Band.topology is
    checked against the topologies that species' molecule declares. Returns the
    warnings that are not errors.
    """
    errors = _link_modes_to_bands(vib, dataset)
    warnings: list[str] = []

    molecule_ids = {m.id for m in vib.molecules}
    topologies_by_molecule = {m.id: {t.id for t in m.topologies} for m in vib.molecules}
    all_topologies: set[str] = set()
    for ids in topologies_by_molecule.values():
        all_topologies |= ids

    # Species -> Molecule is authored in species.jsonc; the reverse field on
    # Molecule is computed from it, so the two files cannot drift apart.
    species_for_molecule: dict[str, str] = {}
    for sp in dataset.species.values():
        if sp.molecule is None:
            continue
        if sp.molecule not in molecule_ids:
            errors.append(
                f"Species {sp.key}: molecule {sp.molecule!r} not in vibrations.jsonc"
            )
            continue
        if sp.molecule in species_for_molecule:
            errors.append(
                f"Molecule {sp.molecule}: claimed by two species "
                f"({species_for_molecule[sp.molecule]} and {sp.key})"
            )
            continue
        species_for_molecule[sp.molecule] = sp.key
    for mol in vib.molecules:
        mol.species = species_for_molecule.get(mol.id, "")
        if not mol.species and dataset.species:
            warnings.append(
                f"Molecule {mol.id}: no species in species.jsonc points at it, "
                "so its bands cannot be reached from the species side"
            )

    # Band.topology names a binding geometry; the molecule that draws it has to
    # know about it, or the vibration-modes page silently cannot show it.
    for b in dataset.bands:
        if b.topology is None:
            continue
        sp = dataset.species.get(b.species)
        mol_id = sp.molecule if sp else None
        declared = topologies_by_molecule.get(mol_id, set()) if mol_id else set()
        if b.topology in declared:
            continue
        if b.topology in all_topologies:
            warnings.append(
                f"Band {b.id}: topology={b.topology!r} is not declared by molecule "
                f"{mol_id!r}; the vibration-modes page cannot show it until that "
                "topology is added there"
            )
        else:
            errors.append(
                f"Band {b.id}: topology={b.topology!r} is not a topology id in "
                "vibrations.jsonc"
            )

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

            if mode.topology is not None and mode.topology not in seen_topologies:
                errors.append(
                    f"Molecule {mol.id}, mode {mode.id}: topology={mode.topology!r} "
                    f"is not one of this molecule's topologies {sorted(seen_topologies)}"
                )

            if references is not None:
                for key in mode.reference:
                    if key not in references:
                        errors.append(
                            f"Molecule {mol.id}, mode {mode.id}: reference key "
                            f"{key!r} not found in references.bib"
                        )

    if errors:
        raise ValueError("Vibrations validation failed:\n  " + "\n  ".join(errors))
    return warnings


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
            refs = {
                e.key: {**e.fields_dict, "_type": e.entry_type}
                for e in library.entries
            }
        except AttributeError:
            # Fall back to v1 API
            db = bibtexparser.loads(text)
            refs = {e["ID"]: {k: v for k, v in e.items() if k != "ID"} for e in db.entries}
    except ImportError:
        refs = _parse_bibtex_minimal(text)

    return {key: _clean_bibtex_fields(fields) for key, fields in refs.items()}


# BibTeX escapes what it has to; the frontend should never see any of it.
_BIB_ESCAPES = {r"\&": "&", r"\%": "%", r"\_": "_", r"\$": "$", r"\#": "#"}
# Zotero brace-protects words to keep their case: {DRIFTS}, {IFP}.
_BIB_PROTECTED = re.compile(r"\{([^{}]*)\}")


def _clean_bibtex_value(value: str) -> str:
    """One field, as a reader should see it: escapes undone, the braces that
    only protect capitals removed, and a page range as an en dash."""
    for old, new in _BIB_ESCAPES.items():
        value = value.replace(old, new)
    value = _BIB_PROTECTED.sub(r"\1", value)
    return value.replace("--", "–")


def _clean_bibtex_fields(fields: dict) -> dict:
    return {
        k: _clean_bibtex_value(v) if isinstance(v, str) and not k.startswith("_") else v
        for k, v in fields.items()
    }


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

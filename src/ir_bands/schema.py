"""Dataclasses for the band-map schema (v3).

These types are the single source of truth for what a "band" looks like.
Everything else in the codebase consumes Band objects, never raw dicts.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Literal, Union


# Allowed enum values — keep in sync with the JSONC schema header
VibCategory = Literal["stretch", "bend", "combination", "lattice", "electronic", "rotational"]
VibSubtype = Literal["symmetric", "asymmetric", "scissoring", "rocking", "wagging", "twisting"]
Branch = Literal["O", "P", "Q", "R", "S"]
BandIntensity = Literal["vs", "s", "m", "w", "vw"]
BandWidth = Literal["sharp", "medium", "broad", "very_broad"]
BandConfidence = Literal["confirmed", "likely", "tentative", "speculative"]

# "rotational" is the second category that is not a normal mode, alongside
# "electronic": the molecule turns and does not vibrate at all, so there is no
# stretch or bend to name. It exists because Raman sees pure rotation directly
# through the polarizability, as a spectrum of its own near the laser line.
# Such a band still takes a branch, since the branch letter is only dJ and
# means the same thing here; for pure rotation only dJ = +2 arises, so the
# branch is always S (Long, The Raman Effect, p. 171 and p. 174).
VALID_CATEGORIES = {"stretch", "bend", "combination", "lattice", "electronic", "rotational"}
VALID_SUBTYPES = {"symmetric", "asymmetric", "scissoring", "rocking", "wagging", "twisting"}
VALID_BRANCHES = {"O", "P", "Q", "R", "S"}
VALID_INTENSITIES = {"vs", "s", "m", "w", "vw"}
VALID_WIDTHS = {"sharp", "medium", "broad", "very_broad"}
VALID_CONFIDENCES = {"confirmed", "likely", "tentative", "speculative"}

# Phase of the species this band belongs to. Optional on a band: omit it when
# the band applies to both the free molecule and its adsorbed form, which is
# genuinely the case for several methanol fundamentals. "surface" means a group
# belonging to the solid itself (a support hydroxyl, a metal hydride) rather
# than an adsorbate sitting on it.
Phase = Literal["gas", "adsorbed", "surface"]
VALID_PHASES = {"gas", "adsorbed", "surface"}

# How the spectrum was taken, per citation. DRIFTS, ATR and the rest are
# sampling geometries; "computational" is not a geometry at all, it marks a
# calculated frequency. Every value names a real way of taking the spectrum:
# "ftir" is the one placeholder: it says the source named the interferometer
# and not the geometry, which is worth recording as an open question rather
# than guessing. Reflection geometries are separate values because the surface
# selection rule makes them a different experiment: on a flat conducting
# sample IRRAS sees only dipoles with a component along the surface normal.
Technique = Literal[
    "drifts", "transmission", "atr", "irras", "pm_irras", "emission",
    "ftir", "raman", "srs", "computational",
]
# Which substitution an isotopologue band carries. Closed, because each value
# derives a tag of its own and a stray spelling would quietly create a fourth
# chip in the chart legend. The key is written the way a spectroscopist writes
# it; the value is the ASCII tag the build derives from it.
ISOTOPE_TAGS = {"D": "deuterium", "¹³C": "carbon-13", "¹⁸O": "oxygen-18"}
VALID_ISOTOPES = set(ISOTOPE_TAGS)

# Kept in step with Technique above by hand: the two drifted apart once
# already, the Literal gaining reflection geometries the validator then
# rejected, so a claim could not say IRRAS even though the type said it could.
VALID_TECHNIQUES = {
    "drifts", "transmission", "atr", "irras", "pm_irras", "emission",
    "ftir", "raman", "srs", "computational",
}

# What was actually in the beam for one claim. Distinct from Band.phase above,
# which says what the band IS (a free molecule, an adsorbate, the surface
# itself) and is a property of the mode wherever it appears. This says how the
# sample was held for this one measurement, and it moves the number: the same
# O-H stretch is 3687 cm-1 as a vapour, ~3300 as a hydrogen-bonded liquid and
# 3690 isolated in solid neon. Recording it is what stops three such rows
# looking like a disagreement when they are three different experiments.
#
# "matrix" is a solid, but the molecule in it is isolated and unrotating, so it
# is kept apart from "solid", which means the bulk substance itself.
SampleState = Literal["gas", "liquid", "matrix", "solid", "adsorbed"]
VALID_STATES = {"gas", "liquid", "matrix", "solid", "adsorbed"}

# How specific a surface is. "Where was this measured" has a scale rather than
# a single answer: the same titania is the sample when it is measured bare and
# the phase when it is the support in Pt/TiO2, so the level lives on the record
# and a claim just names whichever the paper actually said.
SurfaceLevel = Literal["site", "phase", "sample"]
VALID_SURFACE_LEVELS = {"site", "phase", "sample"}

# Only a site has a kind; a phase and a sample are described by composition.
SiteKind = Literal["metal", "cation", "defect", "interface", "bronsted"]
VALID_SITE_KINDS = {"metal", "cation", "defect", "interface", "bronsted"}

# Element symbols, for validating Surface.element and Surface.elements. Not a
# periodic table: just enough to catch a typo in a field that is meant to be
# queried on ("every band on a Cu-containing sample" only works if every
# sample spells Cu the same way).
ELEMENT_SYMBOLS = {
    "H", "Li", "Be", "B", "C", "N", "O", "F", "Na", "Mg", "Al", "Si", "P", "S", "Cl",
    "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge",
    "As", "Se", "Br", "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Ru", "Rh", "Pd", "Ag", "Cd",
    "In", "Sn", "Sb", "Te", "I", "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Sm", "Eu", "Gd",
    "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Th", "U",
}

# Editorial length limits, checked as warnings by validate_dataset(). The band
# tooltip is 300px wide and read while hovering, so long prose simply does not
# get read. Keep these in step with CONTENT_LIMITS in
# frontend/src/lib/tokens.ts, which is what the Style guide page displays.
DESCRIPTION_MAX_WORDS = 120
REFERENCE_NOTE_MAX_WORDS = 150

# Notation policy: text is written with real Unicode sub/superscript characters
# (CO₂, cm⁻¹, Cu²⁺, ν₁), never with markup. The single exception is a label whose
# subscript is a letter Unicode has none for, which in practice means point-group
# and Mulliken symbols; those live in vibrations.jsonc's `point_group` and
# `symmetry` fields and are the only places <sub>/<sup> may appear. See the
# Notation section of the Style guide page.
MARKUP_EXEMPT_VIBRATION_FIELDS = ("point_group", "symmetry")

# An underscore in prose is nearly always a subscript that never got typed
# ("nu_as", "V_O"). Text fields carry the real character instead. This map
# mirrors SUB_CHARS in frontend/src/lib/notation.ts; keep the two in step.
SUBSCRIPT_CHARS = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "a": "ₐ", "e": "ₑ", "o": "ₒ", "x": "ₓ", "h": "ₕ", "k": "ₖ", "l": "ₗ",
    "m": "ₘ", "n": "ₙ", "p": "ₚ", "s": "ₛ", "t": "ₜ",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
}


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
    # The rotational level the transition starts from, set only where a source
    # resolves one line instead of a branch envelope. Long writes such a line
    # S(3), with J the LOWER state ("The quantum numbers J and K refer to the
    # lower state from which the transitions originate", The Raman Effect,
    # p. 195). Whether resolving them is possible is a property of the
    # molecule: hydrogen's rotational constant is about 59 cm-1 and its lines
    # stand hundreds of wavenumbers apart, while nitrogen's is about 2 cm-1
    # and they blur into a tail.
    j: Optional[int] = None

    def __post_init__(self):
        if self.category not in VALID_CATEGORIES:
            raise ValueError(f"vibration.category={self.category!r} not in {VALID_CATEGORIES}")
        if self.subtype is not None and self.subtype not in VALID_SUBTYPES:
            raise ValueError(f"vibration.subtype={self.subtype!r} not in {VALID_SUBTYPES}")
        if self.branch is not None and self.branch not in VALID_BRANCHES:
            raise ValueError(f"vibration.branch={self.branch!r} not in {VALID_BRANCHES}")
        if self.j is not None:
            if not isinstance(self.j, int) or isinstance(self.j, bool) or self.j < 0:
                raise ValueError(
                    f"vibration.j={self.j!r} must be a non-negative integer "
                    "(the rotational level the line starts from)"
                )
            if self.branch is None:
                raise ValueError(
                    "vibration.j is set without a branch: a rotational level "
                    "only means something as one line of a named branch"
                )
        if self.category == "combination" and self.subtype is not None:
            raise ValueError(
                f"vibration.category=combination cannot have subtype={self.subtype!r}; "
                "combinations aren't themselves symmetric/asymmetric."
            )


@dataclass
class BasedOn:
    """A reference from a derived band (combination/overtone) to a parent mode.

    Exactly one of band_id or branch_group is normally set:
      - band_id points at one specific observed band — the common case, for
        vibrations with only one reported branch (no resolved R/P/Q).
      - branch_group points at the *vibration* via its branch_group key
        instead of any one specific band, used when the parent vibration is
        itself split into branches and the combination doesn't depend on
        which branch was observed (e.g. a combination built from ν₃ is built
        from ν₃ regardless of whether you cite its R- or P-branch peak).
    Both are None only when label is given, for parent modes outside the
    dataset entirely (e.g. IR-inactive ν₁ of CO₂).
    """
    band_id: Optional[str] = None
    branch_group: Optional[str] = None
    multiplier: int = 1
    label: Optional[str] = None  # only used when band_id and branch_group are both None

    def __post_init__(self):
        if self.band_id is not None and self.branch_group is not None:
            raise ValueError("based_on entry cannot set both band_id and branch_group")
        if self.band_id is None and self.branch_group is None and not self.label:
            raise ValueError("based_on entry has no band_id/branch_group and no label")
        if self.multiplier < 1:
            raise ValueError(f"based_on.multiplier={self.multiplier} must be >= 1")


@dataclass
class Surface:
    """Where a band was measured, at whatever scale the paper stated.

    One table rather than separate sites and materials, because the same entry
    genuinely plays both roles: TiO2 is the sample when a paper measures bare
    titania and the phase when that titania supports Pt. Forcing it into one
    table or the other means choosing on the reader's behalf, and choosing
    wrong half the time. `level` records how specific the entry is instead:

      site    the atom-scale spot a molecule is bonded to
      phase   a constituent of a sample, named by composition
      sample  what was in the cell

    `parts` is the single containment link and points down the scale: a sample
    lists its phases and the sites it presents, a phase lists the sites within
    it, a composite site lists the simpler sites it is built from. It is what
    lets a query for Cu+ reach the bands whose paper named only Cu/ZnO. The
    exception is an interface site, which may name a phase: the perimeter is
    the metal against the oxide, not the metal against one cation.
    """
    key: str
    label: str
    level: SurfaceLevel
    kind: Optional[SiteKind] = None
    element: Optional[str] = None
    oxidation_state: Optional[int] = None
    formula: Optional[str] = None
    composition: Optional[str] = None
    # Every element this surface contains, authored rather than parsed: the
    # composition strings are written the way the literature writes them and
    # parsing them back is the fragile step surfaces.jsonc exists to remove.
    elements: list[str] = field(default_factory=list)
    facet: Optional[str] = None
    parts: list[str] = field(default_factory=list)
    note: str = ""

    def __post_init__(self):
        if self.level not in VALID_SURFACE_LEVELS:
            raise ValueError(
                f"surface {self.key}: level={self.level!r} not in {VALID_SURFACE_LEVELS}"
            )
        if self.kind is not None and self.kind not in VALID_SITE_KINDS:
            raise ValueError(f"surface {self.key}: kind={self.kind!r} not in {VALID_SITE_KINDS}")
        if self.kind is not None and self.level != "site":
            raise ValueError(f"surface {self.key}: only a site has a kind")
        for e in [self.element, *self.elements]:
            if e is not None and e not in ELEMENT_SYMBOLS:
                raise ValueError(f"surface {self.key}: unknown element symbol {e!r}")

    @property
    def all_elements(self) -> list[str]:
        """Elements this surface contains, however they were recorded."""
        return self.elements or ([self.element] if self.element else [])


@dataclass
class Species:
    """One chemical identity, from data/species.jsonc.

    `band.species` used to be a display label carrying five facts at once
    (identity, phase, binding geometry, isotopologue, sometimes even the
    site). Each of those now has its own field; this record holds the identity
    alone. `molecule` is the link into vibrations.jsonc, authored here and
    only here: Molecule.species is computed back from it, the same way a
    VibrationMode's `bands` list is computed from Band.vibration_modes.
    """
    key: str
    label: str
    formula: str
    molecule: Optional[str] = None
    note: str = ""


@dataclass
class Reference:
    """A citation attached to a band, with optional source-specific specifics.

    key is the only required field (must resolve to an entry in
    references.bib). wn/site/note record how *this particular* source
    describes the band — e.g. a different exact wavenumber or assumed surface
    site — for cases where sources disagree and collapsing to one
    interpretation (or the band's general description) would lose information.
    wn is a single value normally, or a list when this one source reports
    multiple distinct resolved components under the same band (e.g. separate
    p-/s-polarized peaks) — same array-or-scalar convention as site.
    tags are free-form, scoped to this one citation rather than the whole
    band (e.g. one source's claim is a "misassignment-warning" while another
    source's isn't) — styled the same as band-level tags in the frontend.
    """
    key: str
    wn: Optional[Union[int, list[int]]] = None
    # One or more keys into surfaces.jsonc, at whatever level the paper stated.
    measured_on: Optional[Union[str, list[str]]] = None
    technique: Optional[Technique] = None
    # Excitation wavelength in nm, for a Raman claim. The tag chip ("514.5 nm",
    # in the colour of that light) is derived from it by tag_lasers().
    laser_nm: Optional[float] = None
    # What was in the beam: gas | liquid | matrix | solid | adsorbed. Derives a
    # tag of the same name. See SampleState above for why this is not Band.phase.
    state: Optional[SampleState] = None
    note: Optional[str] = None
    tags: list[str] = field(default_factory=list)

    # Computed: a stable handle for this one claim, "<band id>::<citekey>"
    # with an ordinal appended when a paper makes several claims about the
    # same band. Set by assign_reference_uids() in loader.py, not authored.
    uid: str = field(default="", init=False)

    def __post_init__(self):
        if self.technique is not None and self.technique not in VALID_TECHNIQUES:
            raise ValueError(
                f"reference {self.key}: technique={self.technique!r} not in {VALID_TECHNIQUES}"
            )
        if self.state is not None and self.state not in VALID_STATES:
            raise ValueError(
                f"reference {self.key}: state={self.state!r} not in {VALID_STATES}"
            )
        if self.laser_nm is not None and not (0 < float(self.laser_nm) < 100000):
            raise ValueError(
                f"reference {self.key}: laser_nm={self.laser_nm!r} is not a wavelength in nm"
            )


@dataclass
class VibrationMode:
    """One named vibrational mode of a Molecule, for the vibration-modes page.

    category/subtype/atoms are written here as a *manual fallback* only.
    Bands point UP at modes (Band.vibration_modes, in bands.jsonc) rather
    than modes listing bands — see that field's docstring — so whenever a
    mode has at least one linked band, _link_modes_to_bands() in loader.py
    overwrites category/atoms with whatever the linked band(s) themselves
    say (and errors if multiple linked bands disagree). subtype is the one
    exception: it's only auto-derived when every linked band points at just
    this one mode. A band shared by more than one mode (the degenerate-pair
    case — e.g. CO2's ν₂ scissoring and wagging components are frequency-
    coincident and share one observed band) can't supply a single correct
    subtype for both, so subtype must stay manually authored for those modes.
    The common case (one band <-> one mode) still gets every field derived
    for free.

    bands is computed by the same function: every band id whose
    vibration_modes list contains this mode's id directly, PLUS every band
    with no vibration_modes of its own whose based_on entries resolve (one
    level) to a band that itself directly links to this mode — so an
    overtone/combination band built from a fundamental automatically shows up
    under that fundamental's mode page without needing its own link. Not
    part of the authored JSONC — set in place after loading, same as Band's
    own lane/sub_lane.

    reference entries are citekeys, validated against references.bib.

    topology is which Topology.id (on the owning Molecule) this specific
    mode entry represents, or None if it applies regardless of binding
    geometry. Binding geometry can genuinely change a mode's point group —
    and therefore its Mulliken symmetry label, its characteristic frequency,
    even its category/subtype in extreme cases — so when a "conceptually
    similar" vibration actually differs meaningfully between, say,
    monodentate and bidentate coordination, author TWO separate
    VibrationMode entries (one per topology, e.g.
    "carbonate_scissoring_bidentate" / "..._monodentate") rather than one
    shared entry trying to hold both stories — there's no requirement that
    every topology get its own entry if the physical picture genuinely is
    the same throughout (most molecules only have one topology anyway, so
    this rarely comes up). The frontend filters a molecule's mode list to
    whichever entries have topology=None or topology=<selected> before
    displaying it.

    herzberg_notation is the textbook normal-mode index (e.g. "ν₁") under
    Herzberg's classic labeling convention; symmetry is this specific mode's
    Mulliken symmetry label (the irreducible representation it transforms
    as under the molecule's point group, e.g. "Σg⁺", "A1'") — both distinct
    from category/subtype above (this page's own, deliberately non-numbered
    ν/δ/ρ/ω/τ/γ notation). Mostly unset right now (only a few modes have
    values filled in); the frontend only ever shows them when present, so
    leaving them empty is always safe. symmetry is written with literal
    <sub>/<sup> HTML tags where it needs a letter subscript (e.g.
    "Σ<sub>g</sub>⁺") — same convention as Topology.point_group;
    herzberg_notation doesn't need this since its subscripts are always
    digits, which already have real Unicode subscript characters (ν₁, ν₂...).

    wn_start/wn_end are this mode's own characteristic wavenumber — a single
    representative value (wn_end omitted) or a range (both set) — completely
    independent of whatever the linked bands' own positions are. Deliberately
    NOT derived/validated against `bands` the way category/atoms are: real
    DRIFTS-observed positions are support/condition-dependent and shift
    around, while this is meant to be a more canonical reference value, so
    the two are allowed to disagree.
    """
    id: str
    label: str = ""
    note: str = ""
    ir_active: Optional[bool] = None
    raman_active: Optional[bool] = None
    tags: list[str] = field(default_factory=list)
    reference: list[str] = field(default_factory=list)
    category: Optional[VibCategory] = None
    subtype: Optional[VibSubtype] = None
    atoms: Optional[str] = None
    topology: Optional[str] = None
    herzberg_notation: Optional[str] = None
    symmetry: Optional[str] = None
    wn_start: Optional[float] = None
    wn_end: Optional[float] = None
    bands: list[str] = field(default_factory=list, init=False)

    def __post_init__(self):
        if self.category is not None and self.category not in VALID_CATEGORIES:
            raise ValueError(f"mode {self.id}: category={self.category!r} not in {VALID_CATEGORIES}")
        if self.subtype is not None and self.subtype not in VALID_SUBTYPES:
            raise ValueError(f"mode {self.id}: subtype={self.subtype!r} not in {VALID_SUBTYPES}")
        if self.wn_end is not None and self.wn_start is None:
            raise ValueError(f"mode {self.id}: wn_end set without wn_start")
        if self.wn_start is not None and self.wn_end is not None and self.wn_end < self.wn_start:
            raise ValueError(f"mode {self.id}: wn_end < wn_start")
        if self.category == "combination" and self.subtype is not None:
            raise ValueError(f"mode {self.id}: category=combination cannot have subtype")


VALID_SHAPES = {"linear", "nonlinear"}


@dataclass
class Topology:
    """One binding-geometry option for a surface-bound molecule (or just
    "gas phase" for a gas molecule with no real topology choice).

    short/long are both display text — short for the (often-hidden, single-
    option) selector pill, long for its tooltip. id is what the frontend's
    moleculeGeometry.ts keys its per-topology pixel geometry by, alongside
    the molecule's own id.

    point_group is this topology's own symmetry point group (e.g.
    "D<sub>∞h</sub>", "C<sub>s</sub>", "C<sub>2v</sub>") — binding geometry
    genuinely changes the point group (that's the entire reason
    ModeTopologyInfo.symmetry is topology-keyed rather than living flat on
    VibrationMode — see its docstring), so this lives on the Topology that
    actually has one, not on the Molecule as a whole. Optional; mostly unset
    for now. Written with literal <sub>/<sup> HTML tags, same convention as
    Band.short/description in bands.jsonc — the frontend renders it with
    {@html}, so the order/reflection-type letter actually renders subscript
    instead of sitting on the baseline like a typo.
    """
    id: str
    short: str
    long: str
    point_group: Optional[str] = None


@dataclass
class Molecule:
    """A molecule on the vibration-modes page, with its real vibrational modes.

    species matches Band.species; band_groups matches Band.group — both
    validated against the real dataset in validate_vibrations. Pixel
    geometry/displacement vectors for rendering live in the frontend, not
    here — this is editorial content only.

    shape (linear/nonlinear) is the textbook classification used by the
    3N-5 / 3N-6 normal-mode-count formula; the frontend combines it with the
    atom count from its own geometry table to show how many of a molecule's
    fundamental modes are actually listed below.

    topologies lists every binding geometry this molecule's diagram can show
    (e.g. mono-/bidentate for a surface species, or just one "gas phase"
    entry for a gas molecule) — every molecule needs at least one. The
    animated diagram is keyed per-(molecule, topology) in the frontend's own
    geometry table; the mode list is filtered to whichever of `modes` have
    topology=None or topology=<selected> — see VibrationMode.topology.
    """
    id: str
    label: str
    shape: str
    # Computed, never authored here: back-filled by validate_vibrations() from
    # the `molecule` field in species.jsonc, so the molecule/species link is
    # written down in exactly one place. Same pattern as VibrationMode.bands.
    species: str = field(default="", init=False)
    band_groups: list[str] = field(default_factory=list)
    topologies: list[Topology] = field(default_factory=list)
    modes: list[VibrationMode] = field(default_factory=list)

    def __post_init__(self):
        if self.shape not in VALID_SHAPES:
            raise ValueError(f"molecule {self.id}: shape={self.shape!r} not in {VALID_SHAPES}")
        if not self.topologies:
            raise ValueError(f"molecule {self.id}: must have at least one topology")


@dataclass
class Vibrations:
    molecules: list[Molecule]


@dataclass
class Band:
    id: str
    # Key into data/species.jsonc. The chemical identity only: phase, binding
    # geometry and isotopologue each have their own field below.
    species: str
    group: str
    vibration: Vibration
    atoms: str
    wn_start: int
    wn_end: int
    short: str = ""
    description: str = ""
    based_on: list[BasedOn] = field(default_factory=list)
    references: list[Reference] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)

    # gas | adsorbed | surface, or None when the band applies to both the free
    # molecule and its adsorbed form. No tag is derived from it: a band has no
    # sample of its own, so the phase chips come from each claim's own state
    # (tag_states) and the band shows the union of them. This field is the
    # editorial statement of what the species is, which the sets filter on;
    # check_phase() warns where it contradicts the claims underneath it.
    phase: Optional[Phase] = None

    # Binding geometry, as a Topology id declared by this species' molecule in
    # vibrations.jsonc (monodentate/bidentate, or CO's linear/bridged/hollow/
    # geminal/isocarbonyl). None for a gas-phase band, and for a band whose
    # source does not resolve the geometry.
    topology: Optional[str] = None

    # Fermi resonance: id of the other band in the doublet, if any. Reciprocal
    # when complete (A.fermi_partner == B.id and B.fermi_partner == A.id); the
    # "fermi-resonance" tag is then auto-assigned to both by tag_fermi_pairs().
    fermi_partner: Optional[str] = None

    # Fermi resonance with an entire branch group instead of one band, used
    # when the resonance partner vibration is itself split into R/P/Q
    # branches (e.g. two multi-branch combination bands resonating with each
    # other). Mutually exclusive with fermi_partner. Reciprocity (and the
    # "fermi-resonance" tag) is resolved the same way, just expanded across
    # both groups' members by tag_fermi_pairs().
    fermi_partner_group: Optional[str] = None

    # Rotational branches (R/P/Q) of one vibrational transition: all bands
    # sharing the same non-null branch_group are mutual siblings (2-way for
    # R/P-only modes, 3-way when Q is also IR-allowed). The "rotational-
    # branches" tag is auto-assigned to every member by tag_branch_groups().
    branch_group: Optional[str] = None

    # Isotopologue link: this band is the SAME vibrational mode as another
    # band in this file, observed on an isotope-substituted molecule (e.g.
    # ν(C-D) of κ²-DCOO* vs ν(C-H) of κ²-HCOO*). One-directional, child ->
    # parent: only the substituted band carries the link, the natural-
    # abundance parent stays unmarked. Both fields are set together or
    # neither; tag_isotopologues() then auto-assigns the "isotope"
    # tag to the child alone — that tag means "this band IS an
    # isotopologue", never "this assignment was checked with isotopes"
    # (which is a per-citation "isotope-labeling" reference tag instead).
    # Deliberately NOT reciprocal, unlike fermi_partner: the parent's
    # position is a property of the ordinary molecule and shouldn't be
    # relabeled just because someone measured its heavy twin.
    isotopologue_of: Optional[str] = None

    # Which substitution this band represents: one of VALID_ISOTOPES, which
    # is also what the derived tag is named after. Required exactly when
    # isotopologue_of is set.
    isotope: Optional[str] = None

    intensity: Optional[BandIntensity] = None   # vs | s | m | w | vw
    width: Optional[BandWidth] = None           # sharp | medium | broad | very_broad
    confidence: Optional[BandConfidence] = None # confirmed | likely | tentative | speculative

    # Optional, manually-authored link(s) to VibrationMode.id in
    # vibrations.jsonc — this band documents that mode on the vibration-modes
    # page. Almost always 0 or 1 entries; 2 only for the rare case of a band
    # frequency-coincident with another mode (a real degenerate pair, e.g.
    # CO2's ν₂ scissoring + wagging components share one observed band).
    # Bands point at modes rather than the reverse (modes no longer list
    # their bands) so there's exactly one place this fact gets authored;
    # loader.py's _link_modes_to_bands() resolves it into each mode's
    # computed `bands` list and derives category/subtype/atoms from it. Left
    # empty on a combination/overtone band (which points `based_on` at its
    # parent instead) — _link_modes_to_bands() back-fills this field itself,
    # in place, with the union of that parent's own vibration_modes, so this
    # may legitimately differ between the authored JSONC and what actually
    # ends up in the emitted bands.json.
    vibration_modes: list[str] = field(default_factory=list)

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

    def label_for(self, species: "dict[str, Species] | None" = None) -> str:
        """Display label, falling back to species + vibration if no short.

        `species` is the lookup from species.jsonc: Band.species is a key now,
        so the readable name has to be resolved rather than printed directly.
        """
        if self.short:
            return self.short
        name = self.species
        if species and self.species in species:
            name = species[self.species].label
        sub = f" {self.vibration.subtype}" if self.vibration.subtype else ""
        return f"{name}{sub} {self.vibration.category}"

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
class GroupSet:
    """A named selection of groups, for the band chart's filter.

    Which families belong to one question is an editorial judgement about the
    dataset, the same kind of statement as a group's colour, so it lives in
    bands.jsonc rather than in the frontend. Nothing points at a set: it is a
    view over the groups, not a property of a band. The filter offers "All
    groups" on top of whatever is defined here; that one is built in.
    """
    key: str
    label: str
    groups: list[str] = field(default_factory=list)
    note: str = ""
    # Optional: keep only bands of these phases. A band with no phase applies
    # to both forms and always stays. For groups holding both the free
    # molecule and its adsorbed form (co2, methanol_product).
    phases: list[str] = field(default_factory=list)


@dataclass
class Dataset:
    """Everything loaded from the JSONC: metadata + lookups + bands.

    regions/groups/sets/lanes come from bands.jsonc's own header; surfaces
    come from surfaces.jsonc and species from species.jsonc, attached by
    build.py before validation so every cross-file key is checked in one
    pass.
    """
    metadata: dict
    regions: dict[str, Region]
    groups: dict[str, Group]
    sets: dict[str, GroupSet]
    # The chart's rows, top to bottom; each names the groups sharing that row.
    lanes: list[list[str]]
    bands: list[Band]
    surfaces: dict[str, Surface] = field(default_factory=dict)
    species: dict[str, Species] = field(default_factory=dict)

    def species_label(self, key: str) -> str:
        """Readable name for a species key, falling back to the key itself."""
        sp = self.species.get(key)
        return sp.label if sp else key

    def band_by_id(self, band_id: str) -> Band:
        for b in self.bands:
            if b.id == band_id:
                return b
        raise KeyError(f"No band with id={band_id!r}")

    def n_lanes(self) -> int:
        return max((b.lane for b in self.bands), default=0) + 1

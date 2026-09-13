/**
 * How a paper becomes data in this atlas.
 *
 * The other two specification modules describe the artefact: `tokens.ts` says
 * what the interface looks like, `dataModel.ts` says what the entities are.
 * This one says how to get from a PDF to a correct entry, which is the part
 * that is normally carried in somebody's head and lost when they stop.
 *
 * It is written as a checklist rather than an essay because that is how it is
 * used: open the paper, work down the list, run the build. `SourceGuidePage`
 * renders it, and nothing else reads it, so adding a section here is all it
 * takes to publish one.
 *
 * Every rule below is a rule about *this* dataset, not about spectroscopy in
 * general. Where a rule exists because the schema enforces it, the field is
 * named, so the guide and the validator can be checked against each other.
 */

export interface GuideExample {
  caption: string;
  /** JSONC, shown verbatim in a code block. */
  code: string;
  /** One line under the block, for the part the code cannot say. */
  note?: string;
}

export interface GuideTable {
  head: [string, string];
  rows: [string, string][];
}

export interface GuideSection {
  id: string;
  /** Sidebar label. */
  label: string;
  /** True for a part heading, which carries `lead` and nothing else. */
  part?: boolean;
  title: string;
  /** One or more paragraphs of prose. */
  lead: string[];
  /** An ordered procedure, where order matters. */
  steps?: string[];
  /** Unordered rules that all hold at once. */
  rules?: string[];
  /** The mistakes this section exists to prevent. */
  never?: string[];
  table?: GuideTable;
  example?: GuideExample;
  checklist?: string[];
}

export const GUIDE: GuideSection[] = [
  /* =======================================================================
     Part 1
     ======================================================================= */
  {
    id: 'what',
    label: '1 · What is recorded',
    part: true,
    title: '1 · What is recorded',
    lead: [
      'This atlas is a map of what the literature says an infrared band is. It is not a table of ' +
      'measurements and not a review: it keeps every source’s own statement, including the ones that ' +
      'disagree, and leaves the reader to weigh them.',
    ],
  },
  {
    id: 'claim',
    label: 'One paper, one claim',
    title: 'One paper, one claim',
    lead: [
      'A band here is a mode, not a number. The numbers belong to the papers, and the papers disagree, ' +
      'so every source that reports a band gets its own row on it: the position it reports, the surface ' +
      'it saw it on, how it measured, and what it said. Nothing is averaged and nothing is merged.',
      'That split decides where every fact goes. If something is true of the mode wherever it appears, ' +
      'it belongs to the band. If it is true only because one group ran one experiment, it belongs to ' +
      'that group’s claim and nowhere else.',
    ],
    table: {
      head: ['The paper gives you', 'It goes in'],
      rows: [
        ['A peak position', 'references[].wn'],
        ['The surface the band was assigned to', 'references[].measured_on'],
        ['How the spectrum was taken', 'references[].technique'],
        ['What state the sample was in', 'references[].state'],
        ['Temperature, pressure, feed, pretreatment', 'references[].note'],
        ['What the mode is, and what it is confused with', 'band.description'],
        ['How strong, how broad, how certain', 'band.intensity / width / confidence'],
        ['Evidence the assignment rests on', 'references[].tags'],
      ],
    },
    never: [
      'Never average two papers into one number, and never replace one paper’s value with a newer one. ' +
      'Two rows that disagree are the point.',
      'Never write a fact into prose when it has a field. A wavenumber in a note is invisible to the chart.',
    ],
  },
  {
    id: 'before',
    label: 'Before adding anything',
    title: 'Before adding anything, find what is already there',
    lead: [
      'Search the atlas by species and mode, never by wavenumber. Two unrelated modes land on the same ' +
      'number all the time, and one mode moves by tens of cm⁻¹ between surfaces, so the number is the ' +
      'worst possible key to search on.',
    ],
    steps: [
      'Work out what the paper is actually claiming: which species, which mode, on what. Note whether ' +
      'the paper argues for the assignment or inherits it from a citation, because that decides the ' +
      'confidence later.',
      'Look for an existing band with that species and that vibration. If one exists, you are adding a ' +
      'claim to it, not creating a band.',
      'Create a new band only when the species, the mode, the binding topology or the phase genuinely ' +
      'differs from every existing one.',
      'If the paper’s number falls outside the band’s wn_start/wn_end, widen the window only if you ' +
      'believe the number. The window is the envelope of credible positions, not of every printed value.',
      'If the paper contradicts the atlas’s assignment rather than extending it, still record the claim. ' +
      'Say what it argues in the note, and consider a caveat tag on the band.',
    ],
    never: [
      'Never create a second band because one paper reports a different position for the same mode. ' +
      'That is a second claim on the same band.',
    ],
  },

  {
    id: 'si',
    label: 'Read the supporting information',
    title: 'Read the supporting information',
    lead: [
      'The SI is not an appendix to skim once the interesting part is done. In an operando ' +
      'paper it carries three things the main text almost never has: which sample each figure ' +
      'was actually measured on, reference spectra of the same species on the single ' +
      'components, and the figure and table numbers that make a note checkable.',
      'Read it before writing any claim. It routinely changes the surface key, and it often ' +
      'adds claims the main text does not contain at all.',
    ],
    rules: [
      'Find the sample table first. A main text that says "the CuGaZrOₓ catalysts" usually has an ' +
      'SI table naming five or six distinct samples with different loadings, and each figure used ' +
      'one of them. Reading that table is what turns a family name into a real answer; how fine ' +
      'the key should then be is the grain question in Site, phase or sample above.',
      'Reference spectra on single components are their own claims, at phase level. When a ' +
      'paper doses CO or methanol onto the bare oxide to justify an assignment, that is a ' +
      'different surface, a different number and a different experiment: record it as a row of ' +
      'its own rather than folding it into the catalyst’s note.',
      'Take pretreatment and conditions from the SI methods, not from the figure caption. ' +
      'Reduction temperature, ramp rate and dosing sequence live there, and they decide which ' +
      'sites exist at all.',
      'Cite the SI figure or table in the note the same way you would cite a main-text figure: ' +
      '"Fig. S4a", "Table S1". A number nobody can find again is a number nobody can check.',
      'Isotope experiments are often only in the SI, or only in one figure of the main text. ' +
      'Look before concluding that a substitution was qualitative.',
      'When there is no SI to hand, say so in the note that wanted it. A main-text sentence ' +
      'that quotes an SI result (“the band lies near 1000 cm⁻¹ on ZnO, Figure S22”) is a ' +
      'main-text claim and can be recorded as one, with a clause saying the figure itself was ' +
      'not read. Half a record, marked as half, beats a confident one that nobody checked.',
    ],
    never: [
      'Never assume the SI repeats the main text. Most of the numbers appear in exactly one of them.',
      'Never cite an SI figure or table number you have not opened. Copying “Fig. S4” out of ' +
      'the main text makes a note look checked when it is not, and it is the one kind of error ' +
      'a reader cannot detect.',
      'Never take a number off an SI figure that neither text assigns, however suggestive the ' +
      'peak looks. An axis label is not an assignment.',
    ],
    example: {
      caption: 'One family name, six samples (Table S1 of a real paper)',
      code: `Cu-ZrOₓ         24 wt% Cu,  0 wt% Ga, 47 wt% Zr
Cu-GaZrOₓ-48    19 wt% Cu,  9 wt% Ga, 36 wt% Zr
Cu-GaZrOₓ-24    23 wt% Cu, 22 wt% Ga, 20 wt% Zr
Cu-GaOₓ         22 wt% Cu, 45 wt% Ga,  0 wt% Zr
GaZrOₓ           0 wt% Cu, 48 wt% Ga, 25 wt% Zr`,
      note: 'The main text calls all of them "CuGaZrOₓ". The Ga-H band is strong on the Cu-free ' +
        'sample and a trace on the Cu-containing one, so those two need separate keys; the loading ' +
        'series behind the Cu-containing ones does not, until a claim depends on it.',
    },
  },

  /* =======================================================================
     Part 2
     ======================================================================= */
  {
    id: 'reading',
    label: '2 · Reading one claim',
    part: true,
    title: '2 · Reading one claim out of the paper',
    lead: [
      'A claim is one object in `band.references[]`. Five fields, and each of them has exactly one kind ' +
      'of content. Most mistakes in this dataset are a fact written into the wrong one.',
    ],
  },
  {
    id: 'number',
    label: 'The number',
    title: 'The number',
    lead: [
      '`wn` is the position this source reports, as printed. It is not the band’s position: the band ' +
      'carries a window, and the claim carries the paper’s point inside it.',
    ],
    rules: [
      'Take the value from the paper’s own table or text. A shoulder is a position too.',
      'If you read a number off a figure because the paper does not tabulate it, say so in the note.',
      'Use an array only when one source resolves several components of the same band: a multiplet, a ' +
      'set of maxima across a temperature series. A range in the prose ("1580 to 1600") is not an ' +
      'array: take the value the paper assigns and put the spread in the note.',
      'Leave `wn` out when the paper names the band without giving a number. The row still carries the ' +
      'surface, the technique and the note, and that is a real citation.',
    ],
    never: [
      'Never put an isotopologue’s number here. See Isotopes.',
      'Never nudge a number to fit the band’s window, and never round the paper’s value.',
    ],
    example: {
      caption: 'One source resolving five maxima of one band (formate_cd_stretch)',
      code: `{
  "key": "Phongprueksathat.KeyDriversActivity.2026",
  "wn": [2167, 2173, 2161, 2176, 2169],
  "measured_on": "cu_0",
  "technique": "drifts",
  "note": "Fig. 5b (MCR-resolved, Cu–Zn/SiO₂ SSITKA, 230 °C, 10 bar):
    κ²-DCOO*(Cu) at 2167 cm⁻¹. Per catalyst in the SI: 2161 (Cu/SiO₂),
    2176 (Cu–Ga) …"
}`,
      note: 'Five numbers for one band, from one paper. Two papers reporting one number each are two rows, not an array.',
    },
  },
  {
    id: 'surface',
    label: 'Site, phase or sample',
    title: 'Where it was measured: site, phase or sample',
    lead: [
      '`measured_on` takes one or more keys from `data/surfaces.jsonc`, and every entry there carries a ' +
      '`level`: a **site** is the atom-scale spot the molecule is bonded to, a **phase** is a constituent ' +
      'named by composition, a **sample** is what was in the cell.',
      'The level is not a judgement about the paper’s quality. It records how specific the paper chose ' +
      'to be, and a paper that names only the catalyst has given a complete answer at its own level.',
    ],
    steps: [
      'Copy the paper’s own phrase before deciding anything: "on Cu⁺ sites of the Cu/ZnO catalyst", ' +
      '"over bare TiO₂", "at the metal-support perimeter". Use the sentence that makes the assignment, ' +
      'not the methods section.',
      'Ask what that sentence names: an atom-scale spot, a compound, a whole catalyst, or several of them.',
      'Write one key per thing it names. Both, when it names both.',
      'If it names only the catalyst, that is the whole answer. A site key asserts that the paper said ' +
      'so, so promoting a guess to a site puts words in its mouth.',
      'A compound is a phase when it is a constituent and a sample when it is the whole thing. The same ' +
      'key covers both roles, so there is nothing to decide: use `tio2` alone for bare titania, and ' +
      '["tio2", "<the sample>"] when titania is the support the band was assigned to.',
      'A gas-phase band takes no surface at all, at any level. The molecule is in the cell rather than ' +
      'on the catalyst, and the same gas band shows up over whatever is in the beam, so a key here ' +
      'answers no query and credits the sample with a band it did not cause. Name the cell and the ' +
      'catalyst in the note instead; the build warns on any `measured_on` for a gas-phase band.',
      'Check the key exists in surfaces.jsonc. If it does not, add it rather than bending the claim to ' +
      'a key that nearly fits.',
    ],
    rules: [
      'How fine a sample key should be is decided by what the claims turn on, not by how much ' +
      'detail the paper prints. Two samples get two keys when a band appears on one and not the ' +
      'other, or sits at a different position on each: a Cu-free counterpart of the same oxide, ' +
      'a different facet of the same crystal, a support that changes the assignment. Members of a ' +
      'loading series are one key until a claim depends on which member, and the note names the ' +
      'member either way.',
      'That judgement is about which distinction the spectra carry. What is never right is a ' +
      'family key chosen because nobody opened the sample table.',
      'Splitting later is cheap and merging later is cheap; recording a claim against a sample it ' +
      'was not measured on is not. When in doubt, name the specific sample and let the note say ' +
      'what it belongs to.',
    ],
    table: {
      head: ['The paper says', 'measured_on'],
      rows: [
        ['"ν(CO) on Cu⁺ of the Cu/ZnO catalyst"', '["cu_1p", "cu_zno"]'],
        ['"over the Cu-GaZrOₓ catalyst"', '"cu_gazrox"'],
        ['"formate on the alumina support" (of Ru/Al₂O₃)', '["al2o3", "ru_al2o3"]'],
        ['"on bare TiO₂"', '"tio2"'],
        ['"at the Pt-ceria interface"', '["pt0_ceo2_interface"]'],
        ['"at oxygen vacancies"', '["o_vac", "<the sample>"]'],
        ['"gas-phase CO₂ in the cell"', 'nothing — leave measured_on out'],
        ['"on oxidised copper" (no state given)', 'the sample, and the paper’s wording in the note'],
      ],
    },
    never: [
      'Never invent an oxidation state the paper does not give. "Oxidised copper" is not cu_1p.',
      'Never drop the sample because you have the site. Both keys cost nothing and answer different questions.',
    ],
    example: {
      caption: 'A site and a sample in one claim (gah_stretch)',
      code: `{
  "key": "AlAbdulghani.UncoveringPressureDependentMechanism.2025",
  "wn": 1976,
  "measured_on": ["ga", "gazrox"],
  "technique": "drifts",
  "note": "Fig. 4b to 4d … ν(Ga-H) at 1976 cm⁻¹ …"
}`,
      note: 'The site is the Ga centre the paper names by writing Ga-H; the sample is what was in the cell. A query for either one finds this row. Note the key is `ga` and not `ga_3p`: the paper states no charge, so the record states none.',
    },
  },
  {
    id: 'new-surface',
    label: 'Adding a surface',
    title: 'Adding a surface entry',
    lead: [
      'A new key is cheap and a wrong key is expensive, so add one whenever the paper names something ' +
      'the table does not have.',
    ],
    steps: [
      'Pick the level first. It decides which fields the entry carries and how the badge is drawn.',
      'Key: ASCII, lower case, charge spelled out (`cu_1p`, `zr_4p`, `o_vac`). Element-symbol keys always ' +
      'mean the element, so `co_0` is cobalt metal and never carbon monoxide.',
      'Label: Unicode, exactly as a reader would write it (`Cu⁺`, `Fe₃O₄(001)`).',
      'A site gets `kind` and, where it applies, `element` and `oxidation_state`. A phase gets `formula` ' +
      'and `elements`, plus `facet` where it is a single crystal cut on a named plane. A sample gets ' +
      '`composition` and `elements`. A facet is a phase and never a sample, and it stays out of the ' +
      'formula: a cut oxide is the same compound as the uncut one, so Fe₃O₄(001) and Fe₃O₄(111) both ' +
      'read formula Fe₃O₄ and differ only in `facet`.',
      'Add the new key to the `parts` of whatever contains it, and to nothing else. `parts` points down ' +
      'the scale only: a sample lists its phases and sites, a phase lists its sites.',
      'Run `python build.py`. It fails if a part sits at a coarser level than its container, or if a ' +
      'container does not list the elements of something it contains.',
    ],
    rules: [
      '`elements` is authored, never parsed out of the composition string. The strings are written the ' +
      'way the literature writes them (Ru/"Na₂O"/Al₂O₃) and parsing them back is exactly the fragile ' +
      'step this table exists to remove.',
      'An interface site is the one entry allowed to name a phase in its `parts`, because a perimeter ' +
      'is the metal against the oxide rather than the metal against one cation.',
    ],
  },
  {
    id: 'technique',
    label: 'Technique',
    title: 'How it was measured',
    lead: [
      'One value per claim, from a closed list, and `build.py` derives the tag chip from it. The field ' +
      'is the sampling geometry, not the instrument: nearly every measurement here is an interferometer ' +
      'measurement, so "FTIR" on its own says nothing and is only the placeholder for a paper that '
      + 'states no geometry.',
      'The reflection geometries are values of their own rather than one lumped entry, because on a '
      + 'flat conducting sample the surface selection rule makes IRRAS a different experiment: only '
      + 'dipole components along the surface normal absorb, so a band missing from the spectrum can '
      + 'mean a mode lying flat rather than a species that is not there. On such a sample, read an '
      + 'absence as geometry before reading it as chemistry.',
    ],
    table: {
      head: ['Value', 'What it means'],
      rows: [
        ['drifts', 'Diffuse reflectance off a powder bed'],
        ['transmission', 'Beam straight through a self-supporting wafer'],
        ['atr', 'Attenuated total reflectance against an internal-reflection crystal'],
        ['irras', 'Grazing-incidence reflection off a flat single crystal, in vacuum'],
        ['pm_irras', 'IRRAS with the polarisation modulated, which cancels the gas background'],
        ['emission', 'The hot sample is the source; no beam passes through it'],
        ['ftir', 'Placeholder: the paper names the interferometer, not the geometry'],
        ['raman', 'A Raman shift, whatever the geometry: scattering, not absorption'],
        ['computational', 'Not a measurement: a calculated frequency'],
      ],
    },
    rules: [
      'Every claim also gets a `state`: what was actually in the beam, one of `gas`, `liquid`, ' +
      '`matrix`, `solid` or `adsorbed`. This is not the band’s own `phase`, which says what the ' +
      'band is wherever it appears; this says how this one sample was held, and it moves the ' +
      'number. Methanol’s O-H stretch is 3687 cm⁻¹ as a vapour, near 3300 hydrogen-bonded in the ' +
      'liquid and 3690 isolated in solid neon. Without the field those three rows read as a ' +
      'disagreement instead of three different experiments.',
      '`matrix` is a solid, but the molecule in it is isolated and not rotating, so it stays apart ' +
      'from `solid`, which means the bulk substance itself. A matrix value is close to the free ' +
      'molecule and still host-dependent: neon and argon disagree with each other by up to 20 cm⁻¹.',
      'Where a paper reports several states for the same mode, each is its own claim with its own ' +
      'state, never one row carrying the lowest number. Where one measurement genuinely spans ' +
      'states, as a supercritical sweep does, leave the field out and say so in the note rather ' +
      'than picking whichever state it was in longest.',
      'A Raman claim also gets `laser_nm`, the excitation wavelength the paper states, as a plain ' +
      'number in nm: `"laser_nm": 514.5`. The build turns it into a chip of its own, coloured with ' +
      'the colour of that light, because the line decides what the measurement could see. A ' +
      'near-infrared 785 nm laser reaches further into a bulk oxide than a 244 nm one and avoids ' +
      'fluorescence a green line would provoke, so two Raman rows that disagree may simply have ' +
      'been looking at different depths.',
      'Write it only where the paper names the line. "Argon ion laser" without a wavelength is not ' +
      'a wavelength: argon has several lines, and 514.5 is a guess however likely. Leave the field ' +
      'out and say what the paper said in the note.',
    ],
    never: [
      'Never guess the geometry from the catalyst. Write `ftir` when the paper names only the ' +
      'instrument, and leave the field out when it says nothing at all: the Dataset page counts ' +
      'both, and either is honest where a guess is not.',
      'Never author the matching tag by hand. The build writes it, both the technique chip and ' +
      'the wavelength one.',
      'Never put `laser_nm` on a claim that is not Raman. An infrared measurement has no ' +
      'excitation line, and the build warns about it.',
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions and the note',
    title: 'Conditions, and the rest of the note',
    lead: [
      'The note is everything true of this paper and this claim alone, at most 150 words. It is prose ' +
      'on purpose: conditions are not comparable enough between papers to be worth a schema yet, and a ' +
      'half-filled set of condition fields would be worse than a sentence.',
      'Write it so a reader can tell whether the number applies to their own experiment. That is the ' +
      'whole test.',
    ],
    steps: [
      'Where the number came from, when the paper has many: "Table 3, band J", "Fig. 4b".',
      'What the sample was and what was done to it, because that decides which sites exist at all: ' +
      '"reduced in H₂ at 573 K for 1 h", "calcined, not reduced".',
      'The conditions themselves, in one compact clause: "473 K, 20 bar, CO₂/H₂ = 1:3, 30 mL min⁻¹".',
      'What this paper observed or argued that a reader needs: transient behaviour, co-adsorbates, the ' +
      'comparison it drew, the band it distinguished this one from.',
      'The caveat, last: an overlapping band, a difference spectrum and against which background, a ' +
      'saturated detector, a number read off a figure.',
    ],
    rules: [
      'Keep the paper’s own units and numbers. If it says 200 °C, write 200 °C; converting silently ' +
      'loses the fact that the paper chose that unit, and invites a rounding error for nothing.',
      'Unicode throughout: cm⁻¹, °C, mL min⁻¹, CO₂/H₂, ¹³CO. No markup, no LaTeX, no bare CO2.',
      'Name the other band when the paper distinguishes this one from it. That is the most useful ' +
      'sentence a note can carry.',
    ],
    never: [
      'The wavenumber (that is `wn`), the surface (`measured_on`), the technique (`technique`).',
      'Anything true of the band in general. That is `description`, on the band, 120 words at most and as short as the general part allows.',
      'Conclusions the paper does not draw. If you are inferring, either leave it out or say who is inferring.',
    ],
    example: {
      caption: 'A note that passes the test',
      code: `"note": "Table 3, band J: very strong, narrow Q branch, ν₁+ν₂ …
  Particularly pronounced in their long-path-length Praying Mantis
  HTRC cell; intensity amplified at elevated CO₂ pressures."`,
      note: 'Where it came from, then what was special about this measurement, then the caveat.',
    },
  },
  {
    id: 'naming',
    label: 'Naming a band',
    title: 'Naming a band',
    lead: [
      'A source may name one mode in four ways: by what it does (νₛ(CH₃)), by an index into a list ' +
      'of normal modes (ν₂, or q₁₁ in a computational paper), by an irreducible representation ' +
      '(ν₃(A′)), or by a transition code from a line database (11101←00001). Only the first of ' +
      'those says anything to somebody reading a chart, and it is what `short` uses.',
    ],
    rules: [
      'Name the motion, not its rank: `ν` stretch, `δ` bend or scissor, `ρ` rock, `γ` out of plane, ' +
      '`τ` torsion or twist, with `ₛ` and `ₐₛ` for symmetric and antisymmetric. Then the atoms that ' +
      'move, in brackets: `νₐₛ(OCO)`, `δ(COH)`, `ν(C-OH)`.',
      'Then the species as a reader writes it, with a trailing asterisk when it is adsorbed: ' +
      '`νₐₛ(OCO) HCOO*`, `ν(CO) MeOH`. Where the binding geometry rather than the species is what ' +
      'distinguishes the band, that goes in instead: `ν(CO) linear (μ₁)`.',
      'A rotational branch goes last, in brackets: `(R)`, `(Q)`, `(P)`. A combination or difference ' +
      'band is written as the arithmetic on the fundamentals it is built from: `νₛ+δ(OCO) CO₂`, ' +
      '`νₐₛ−νₛ(OCO) upper CO₂`.',
      'Where a molecule has two modes of the same kind, name what separates them. Methanol has ' +
      'two symmetric-species methyl stretches: one rides on the hydrogen lying in the C-O-H ' +
      'plane and the other on the out-of-plane pair, so they are `ν(CH) in-plane MeOH` and ' +
      '`νₛ(CH₃) MeOH`. Borrow the spectroscopist index only where the two motions genuinely ' +
      'share a description; an invented "(a)" tells the reader nothing either way.',
      'One notation per species. Mixing νₛ and ν₁ across the bands of one molecule makes two ' +
      'labels look like two different modes.',
    ],
    never: [
      'Never put a database transition code in a label. `11101←00001` is how HITRAN names a ' +
      'transition and it belongs in the note, where somebody checking the source needs it.',
      'Never put a wavenumber in a `short`, for the same reason band ids do not carry one: the ' +
      'position is data and it gets refined.',
      'Never carry a source’s own numbering into the label because the source used it. Papers ' +
      'renumber the same modes differently, and one of them will disagree with the atlas.',
    ],
    example: {
      caption: 'The same mode, four ways a source might name it',
      code: `HITRAN            11101←00001
computational     ω₇(A′)
spectroscopist    ν₅(A′)
chemist           δₛCH₃ umbrella

short             δₛ(CH₃) umbrella MeOH`,
      note: 'The first four all appear in one paper on methanol. The last is the only one that ' +
        'reads without a key beside it.',
    },
  },
  {
    id: 'isotopes',
    label: 'Isotopes',
    title: 'Isotopes',
    lead: [
      'Two different things get confused here and they are recorded in completely different places. One ' +
      'question separates them: **is the band itself a different molecule?**',
    ],
    table: {
      head: ['The paper', 'Record it as'],
      rows: [
        [
          'Measured the substituted molecule and reports its band: ν(C–D) of DCOO*, ν(¹³CO), ν(OD) of CH₃OD',
          'A band of its own, with `isotopologue_of` pointing at the natural-abundance band and `isotope` ' +
          'naming the substitution ("D", "¹³C")',
        ],
        [
          'Used substitution as evidence that an ordinary band is what it says (the band shifts on ' +
          'deuteration, so it must involve H)',
          'The ordinary band, unchanged. The claim gets the `isotope-labeling` tag',
        ],
      ],
    },
    rules: [
      '`isotope` says which substitution, from a closed list (D, ¹³C, ¹⁸O), and the build derives the matching tag from it, so the chart can filter a deuteration experiment apart from an ¹⁸O one.',
      'The child band keeps the ordinary species key: `formate`, not a deuterated species. The ' +
      'substitution lives in `isotope` and nowhere else.',
      '`atoms` keeps the ordinary symbols too: a C–D stretch is `C-H`. A heavier nucleus is not a ' +
      'different bond, and that field drives the colormap for which bond moves.',
      '`short` is where the isotopologue is spelled out for the reader: `ν(CD) DCOO*`, `ν(¹³CO) linear (μ₁)`.',
      'The link is one-directional, child to parent, and never chained. `build.py` adds the `isotope` ' +
      'tag to the child; the parent is not relabelled because someone measured its heavy twin.',
      'Both bands then collect their own claims, each with its own window.',
      'One band per mode per label, never one per isotopologue. A study that resolves the fully ' +
      '¹⁸O-labelled species and two partly labelled ones reports three positions for the same mode, ' +
      'a few cm⁻¹ apart: that is one band and one assignment carrying all three, with the note ' +
      'saying which labelling gives which. Splitting them into a band each spends a dozen rows ' +
      'saying one thing.',
      'The build tells you when a mode has been split too finely: bands that no longer fit the ' +
      'three sub-lanes of their row get logged. Read that as a signal about the data rather than ' +
      'about the layout.',
      'If the paper substitutes and reports no position for the substituted band, there is no ' +
      'isotopologue band to add. Tag the claim `isotope-labeling`, and let the note say what was ' +
      'seen: usually the ordinary band weakening or vanishing. Do not compute the expected ' +
      'shifted position and record it as data.',
    ],
    never: [
      'Never record the substituted position as a second `wn` on the parent’s claim. It is the commonest ' +
      'way this dataset goes wrong: the parent’s window silently widens to cover a band that is not it.',
      'Never write that a shift was observed when what the paper shows is a band **disappearing**. ' +
      'A band that vanishes under D₂ and a band that moves to a stated position are different ' +
      'evidence, and only the second one can become an isotopologue band. Say which it was.',
      'Never author the substitution tag. `deuterium`, `carbon-13` and `oxygen-18` are derived from the `isotope` field, whose vocabulary is closed: a new substitution needs a value and a tag name adding together.',
    ],
    example: {
      caption: 'The deuterated formate C–H stretch',
      code: `"formate_cd_stretch": {
  "species": "formate",
  "isotopologue_of": "formate_ch_stretch",
  "isotope": "D",
  "atoms": "C-H",
  "short": "ν(CD) DCOO*",
  "wn_start": 2155, "wn_end": 2192
}`,
      note: 'Ordinary species, ordinary atoms, the substitution in one field, and its own window.',
    },
  },
  {
    id: 'judgement',
    label: 'Intensity, width, confidence',
    title: 'Intensity, width, confidence',
    lead: [
      'These three are the reader’s shortcut to how much weight a band carries, so they have to come ' +
      'from the paper rather than from an impression of the figure.',
    ],
    rules: [
      '`intensity` (vs, s, m, w, vw) and `width` (sharp, medium, broad, very_broad): take the paper’s ' +
      'own adjective and map it. Omit both rather than estimating from a plot.',
      '`confidence` reads the paper’s hedging, and never upgrades it: **confirmed** when the paper ' +
      'demonstrates the assignment (substitution, dosing, a calculation that matches); **likely** for a ' +
      'standard assignment consistent with the literature; **tentative** when the paper hedges; ' +
      '**speculative** when it offers the assignment as one option among several.',
      'All three sit on the band, not the claim, which is a known compromise: they describe an ' +
      'observation but are authored once. When two papers disagree strongly, the disagreement belongs ' +
      'in the notes.',
      'A source sometimes reports an absorption that is not a normal mode at all: a defect or ' +
      'charge-transfer transition, broad, structureless, and often the largest feature in the ' +
      'spectrum. It is still a band a reader sees, so it is recorded as one, with ' +
      '`vibration.category: "electronic"` and `atoms: "diverse"`. Say in the first sentence of ' +
      'the description that nothing is vibrating, or the entry reads as a mode nobody can find.',
    ],
  },
  {
    id: 'tags',
    label: 'Tags',
    title: 'Tags',
    lead: [
      'Tags are a flat namespace with a role behind each one, and roughly half of them are written by ' +
      'the build from a field. Authoring a derived tag is an error, not a shortcut.',
    ],
    table: {
      head: ['Do not author', 'It is derived from'],
      rows: [
        ['gas-phase', 'band.phase'],
        ['drifts, transmission, computational', 'references[].technique'],
        ['fermi-resonance', 'band.fermi_partner'],
        ['rotational-branches', 'band.branch_group'],
        ['isotope', 'band.isotopologue_of'],
        ['ir-active, raman-active', 'the mode’s own booleans'],
        ['514.5 nm, 785 nm, …', 'references[].laser_nm'],
        ['computational (on a band)', 'every claim on it having that technique'],
      ],
    },
    rules: [
      'Author the evidence tags on the claim, where they belong: `direct-dosing`, `isotope-labeling`.',
      '`direct-dosing` says the species was put on the surface rather than made there: formate from ' +
      'formic acid, methoxy from methanol, instead of either growing out of CO₂ and H₂. It is a ' +
      'statement about provenance and it is independent of the technique, so it sits on a ' +
      'transmission claim and a DRIFTS one alike. It only means anything for a surface species: a ' +
      'gas-phase band in a cell was dosed by definition and the tag would say nothing.',
      'The tag is not a criticism. Dosing is how a reference spectrum gets made, and it is often ' +
      'the cleanest assignment in the atlas. It matters because a dosed species is evidence that ' +
      'the band belongs to that species, and not evidence that the species forms under reaction.',
      'Author the caveat tags on the **band**, not on the claim: `misassignment-warning` when the ' +
      'position is a known trap, `site-sensitive` when the position moves with the surface so a ' +
      'shift is not by itself a different species. Both describe where the band sits, which is true ' +
      'whoever measured it. Caveats are the one role with a colour of its own.',
      'A new tag needs an entry in `TAG_ROLES` and a tip in `data/tags.jsonc` in the same change.',
    ],
  },

  /* =======================================================================
     Part 3
     ======================================================================= */
  {
    id: 'again',
    label: '3 · Going over it again',
    part: true,
    title: '3 · Going over a paper again',
    lead: [
      'A second pass is not a sign the first was careless. The first pass is done against an incomplete ' +
      'atlas: keys, bands and conventions arrive later, and a row that was as specific as the data ' +
      'allowed in March can be sharpened in September.',
    ],
  },
  {
    id: 'second-pass',
    label: 'What to look for',
    title: 'What to look for the second time',
    lead: [
      'Open the References page grouped by Reference, read the paper’s own table of assignments beside ' +
      'it, and work down this list. Most of it is upgrading, not correcting.',
    ],
    steps: [
      'Missing claims. Compare the rows against every assignment the paper actually makes. Bands the ' +
      'atlas did not have on the first pass are the commonest gap.',
      'Surfaces that can be sharpened. Did the paper name a site where the row records only a sample? ' +
      'Re-read the sentence that makes the assignment, not the methods. This is the most valuable ' +
      'single upgrade, because it is what a site query runs on.',
      'Claims with no technique. The Dataset page lists them.',
      'Notes carrying a wavenumber, a surface or a technique in prose. Move each into its field.',
      'Notes over 150 words and descriptions over 120. The build warns; the fix is usually that ' +
      'paper-specific detail drifted into the description.',
      'Isotope work recorded as an extra number on the parent band instead of its own band.',
      'Caveats the paper states that the atlas does not. A paper warning about an overlap is exactly ' +
      'what `misassignment-warning` is for.',
      'Disagreements. If the paper assigns a band differently from the atlas, that is content: record ' +
      'the claim and say what it argues.',
    ],
    never: [
      'Never silently change an earlier claim’s number to the one you now read. Either the old number ' +
      'was an error, and you correct it and say so, or it was a different feature, and it is a second row.',
      'Never delete a claim because a newer paper disagrees.',
    ],
  },
  {
    id: 'checklist',
    label: 'Before the build',
    title: 'Before you run the build',
    lead: [
      'Then run `python build.py`, and read the warnings, not only the errors. Errors are broken ' +
      'references; warnings are the things nobody will notice for a year.',
    ],
    checklist: [
      'Every claim’s `key` resolves to an entry in references.bib.',
      'Every `measured_on` key exists in surfaces.jsonc, at the level the paper chose.',
      'No derived tag has been authored by hand.',
      'Every isotopologue is its own band, linked with `isotopologue_of`.',
      'Notes carry conditions and caveats, not wavenumbers or surfaces.',
      'Unicode everywhere, no markup, no underscores outside machine identifiers.',
      'New surfaces are listed in the `parts` of whatever contains them.',
      '`python build.py` passes, and its warning list is no longer than it was before.',
    ],
  },
];

/** Sidebar table of contents, derived so it cannot drift from the guide. */
export const GUIDE_SECTIONS = GUIDE.map(s => ({ id: s.id, label: s.label, part: s.part }));

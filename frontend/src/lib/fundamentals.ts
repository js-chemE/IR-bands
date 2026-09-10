/**
 * The basics: what has to be understood before any phenomenon makes sense.
 *
 * Where lib/phenomena.ts explains the special cases (a Fermi pair, a heavy
 * twin, a branch), this module explains the ground they stand on. Each entry
 * is one card on the Knowledge page: a teaser and a small animated diagram on
 * the card itself, the full explanation once it is opened, and links down to
 * the phenomena that build on it.
 *
 * The explanations follow the Springer Handbook of Advanced Catalyst
 * Characterization (Wachs and Bañares, 2023), cited chapter by chapter with
 * `[@alias, locator]` markers; the aliases and chapters are in lib/cite.ts.
 * A sentence without a marker is either the atlas's own data or general
 * reasoning the handbook does not spell out.
 *
 * The diagram is chosen by `key` in KnowledgePage.svelte, so a new entry
 * needs a matching diagram component there.
 */

import { citer, summarizeLocators } from './cite';

/** A highlighted box for a formula or a rule, between paragraphs. */
export interface Formula {
  /** What the box states, as a heading. */
  label: string;
  /** One formula per line. Unicode, no markup. */
  lines: string[];
  /** Symbols, conditions, the source. May carry citation markers. */
  note?: string;
  /** Tints the box: orange for IR, green for Raman, neutral otherwise. */
  tone?: 'ir' | 'raman';
}

export type Block = string | Formula;

/**
 * Where a card sits on the Knowledge page: the physics every spectrum rests
 * on, or a kind of spectroscopy built on it. Each is its own heading and row of cards.
 */
export type KnowledgeSection = 'basics' | 'spectroscopy';

export const KNOWLEDGE_SECTIONS: { key: KnowledgeSection; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'spectroscopy', label: 'Spectroscopy' },
];

export interface Fundamental {
  key: string;
  label: string;
  section: KnowledgeSection;
  /** One or two sentences on the card. Keep it to about 25 words. */
  teaser: string;
  /**
   * The full explanation: a string per paragraph, or a formula box. Unicode,
   * no markup; `[@alias, locator]` cites a source (lib/cite.ts).
   */
  body: Block[];
  /** Phenomenon keys (lib/phenomena.ts) that build on this, each with why. */
  related: { key: string; why: string }[];
  /**
   * Band ids the diagram draws, resolved live from the dataset so their
   * positions, widths and labels are the atlas's own. An id that stops
   * resolving is simply left out. `{ id, wn }` pins the position where the
   * centre of the band's range is not the number to show; `depth` sets a
   * height where the atlas has no intensity for the band; `raman` puts it
   * in a Raman spectrum rather than an IR one.
   */
  examples?: (string | { id: string; wn?: number; depth?: number; raman?: boolean })[];
}

export const isFormula = (b: Block): b is Formula => typeof b !== 'string';

export const FUNDAMENTALS: Fundamental[] = [
  {
    key: 'vibration',
    section: 'basics',
    label: 'Vibrational excitation',
    teaser:
      'A bond vibrates on a ladder of fixed energies. An infrared photon that fits one rung lifts it: v = 0 → 1.',
    body: [
      'At any temperature every atom vibrates about its equilibrium position, and the vibration can only hold certain energies: the levels v = 0, 1, 2 … of its well [@busca, p. 4]. At absolute zero everything sits in v = 0. At room temperature the first excited level is still almost empty, because the gaps are far larger than the thermal energy kT [@busca, p. 4].',
      {
        label: 'How full a level is (Boltzmann)',
        lines: ['Nᵢ / N₀ = (gᵢ / g₀) · exp(−ΔE / kT)'],
        note: 'N: population, g: multiplicity, ΔE: the gap. For a 2000 cm⁻¹ gap at 25 °C this is about 6 × 10⁻⁵ [@busca, Eq. (1.7)].',
      },
      'The simplest way to climb is to absorb a quantum of light of exactly the right energy [@busca, p. 4]. The gaps fall in the infrared: the mid-infrared, 4000 to 400 cm⁻¹, spans 0.496 to 0.0496 eV [@busca, p. 4]. Absorption also needs the vibration to change the dipole moment; the Dipole moment card shows why.',
      {
        label: 'Which steps are allowed',
        lines: ['Δv = ±1'],
        note: 'For a harmonic oscillator only neighbouring levels connect, so a spectrum is mostly fundamentals, v = 0 → 1 [@busca, Eq. (1.5)].',
      },
      'The circle in the diagram is not an electron. It is the state of the whole vibration: the atoms move already in v = 0, and one quantum more makes the same motion swing wider.',
      'The excited vibration rarely gives the photon back. In a solid, or at a surface, the energy is handed on without light, to the lattice or to surrounding gas molecules: radiationless decay, or vibrational relaxation [@li, p. 298]. What reaches the detector is the beam minus the absorbed photons, and that deficit is the band. Under the beam the cycle repeats, absorb and relax, so v = 1 never fills up.',
      'Where a band sits depends on the masses of the atoms that move and on the strength of the bond between them [@busca, p. 5]. A heavier isotope therefore shifts the band without changing the bond, which is how isotope labelling confirms an assignment [@busca, p. 5].',
      'The well is not a parabola. It flattens towards dissociation, so the levels crowd together as v rises. That anharmonicity relaxes Δv = ±1, and overtones and combinations appear, usually weak [@busca, p. 4].',
    ],
    related: [
      { key: 'combination', why: 'Steps of more than one rung, or two modes at once' },
      { key: 'isotopologue', why: 'Heavier atoms, larger μ, lower wavenumber' },
      { key: 'ir-inactive', why: 'No dipole change, no absorption' },
      { key: 'branches', why: 'Rotational rungs on every vibrational level' },
      { key: 'fermi', why: 'Two levels at nearly the same energy mix' },
    ],
  },
  {
    key: 'dipole',
    section: 'basics',
    label: 'Dipole moment',
    teaser:
      'Charge pulled apart makes a dipole: a positive end and a negative end, a distance apart.',
    body: [
      'A dipole moment measures how far a molecule’s positive and negative charge sit apart. Two charges +q and −q a distance d apart give μ = q·d, pointing from the negative charge to the positive one. A bond between two different atoms shares its electrons unevenly and carries a dipole; a bond between two identical atoms carries none.',
      {
        label: 'Dipole moment',
        lines: ['μ = q · d', 'μ = Σ qᵢ rᵢ   (any set of charges)'],
        note: 'Unit: the debye, 1 D = 3.336 × 10⁻³⁰ C·m.',
      },
      'The dipole so far is permanent: CO carries it with no field around. A field can also make one where there was none, by pulling a molecule’s electron cloud off-centre: an induced dipole, which lasts only while the field acts. The second row of the diagram shows the two side by side; the Induced dipole card shows how it happens.',
      'For infrared light the dipole itself is not what counts: its change is. The light’s oscillating electric field can only drive a motion that makes the dipole swing, so a mode absorbs when the dipole differs between the extremes of the motion, a polar mode [@busca, p. 4].',
      {
        label: 'IR selection rule',
        lines: ['(∂μ / ∂Q)₀ ≠ 0'],
        note: 'Q: the normal coordinate of the vibration; the derivative is taken at rest [@busca, Eq. (1.6)].',
        tone: 'ir',
      },
      'Stretching C–O pulls the charges further apart, so the dipole grows and shrinks with the motion: IR-active, and one of the strongest bands there is. (CO is a special case at rest: its permanent dipole is tiny, about 0.1 D, and even points the other way; what the IR sees is how strongly it changes, and that is large.) Stretching N≡N changes nothing, because there is no dipole to change at any bond length; homonuclear diatomics such as H₂, N₂ and O₂ are IR-inactive [@busca, p. 5]. A permanent dipole is not needed either: CO₂ has none at rest, yet its asymmetric stretch and bend create one as they move.',
      'On a metal the rule tightens. Reflected p-polarized light has an enhanced field along the surface normal and almost none along the surface, so reflection-absorption IR sees only vibrations whose dynamic dipole has a component along the normal [@trenary, p. 54]. A molecule standing up shows its stretch; the same molecule lying flat can disappear.',
      {
        label: 'Surface dipole selection rule (metals)',
        lines: ['seen:  ∂μ⊥ / ∂Q ≠ 0', 'not seen:  a dipole change parallel to the surface'],
        note: '“Quite rigorous”, and best applied through the point-group symmetry of the adsorbate [@trenary, p. 54].',
        tone: 'ir',
      },
      'The same rule removes whole bands. Ethylidyne on Pt(111) shows no asymmetric CH₃ deformation and no asymmetric C–H stretch, though both appear on Pt/Al₂O₃, where the particles are not a flat mirror [@trenary, pp. 56–57].',
    ],
    related: [
      { key: 'ir-inactive', why: 'No dipole change, no band' },
      { key: 'degeneracy', why: 'Two motions, one frequency, one dipole change each' },
    ],
  },
  {
    key: 'induced',
    section: 'basics',
    label: 'Induced dipole',
    teaser:
      'A field pulls the electron cloud off-centre and makes a dipole, even where there was none.',
    body: [
      'Every molecule is a set of nuclei inside a cloud of electrons. Put it in an electric field and the field pushes the two kinds of charge apart: the electrons against the field, the nuclei with it. The cloud stays where it is but grows denser on one side and thinner on the other, and the nuclei shift a little towards the thin side. The side with extra electrons is δ−; the side where the nuclei are left less covered is δ+. The field has induced a dipole moment [@moon, p. 77]. The attraction between the nuclei and their electrons pulls back and keeps the shift small.',
      {
        label: 'Induced dipole',
        lines: ['μ(ind) = α · E'],
        note: 'Proportional to the field, and gone when the field is. α, the polarizability, says how easily it happens: the next card. The Raman chapter writes μ(ind) as P [@moon, p. 77].',
      },
      'Any molecule gets one, with or without a dipole of its own. N₂ has none, yet it polarizes like any other. A permanent dipole is carried; an induced one is lent by the field and lasts only while the field acts.',
      'The field can come from anything. Light is one. An ion is another, or a charged site on a surface: a cation polarizes a molecule adsorbed on it this way. So is the permanent dipole of a neighbour, and even the fleeting dipole of a neighbour’s own fluctuating cloud, which is what holds non-polar molecules together (the dispersion force). The bottom row of the diagram shows an ion and a neighbour’s dipole at work.',
      'Light is an electric field that swings back and forth, across the direction it travels. As it passes, the induced dipole swings with it at the light’s frequency, and an oscillating dipole radiates: the molecule sends light out in every direction. That is scattering, and it grows steeply with the frequency, with its fourth power [@stair, p. 132].',
      {
        label: 'Scattered intensity',
        lines: ['I ∝ ν⁴ · |μ(ind)|² = ν⁴ · α² · E₀²'],
        note: 'ν: frequency of the light, so I ∝ (1/λ)⁴. Against a 785 nm laser, 532 nm scatters about 4.7 times as much and 244 nm over 100 times [@stair, p. 132].',
      },
      'Almost all of that scattered light keeps the frequency of the light that made it. When a vibration changes how easily the cloud is pushed, a little of it does not: that is the Raman effect, and the subject of the Polarizability and Raman spectroscopy cards.',
    ],
    related: [
      { key: 'ir-inactive', why: 'No dipole of its own, yet one can be induced' },
    ],
  },
  {
    key: 'polarizability',
    section: 'basics',
    label: 'Polarizability',
    teaser:
      'How easily the cloud is pulled off-centre. When a vibration changes that, Raman appears.',
    body: [
      'The polarizability α says how easily a field induces a dipole: how far it pulls the electron cloud off-centre [@moon, p. 77]. A large, loosely held cloud gives a lot and has a large α; a small, tightly held one hardly moves. The top row of the diagram shows the two side by side, in the same field.',
      {
        label: 'Polarizability',
        lines: ['α = μ(ind) / E'],
        note: 'The induced dipole per unit of field. The Induced dipole card shows the dipole itself [@moon, p. 77].',
      },
      'The cloud of a linear molecule such as N₂ or CO₂ is not a sphere but elongated, with a circular cross-section: an ellipsoid [@moon, p. 77]. It gives more easily along the bond than across it, so α depends on the direction of the field, which makes it in full a tensor rather than a single number [@stair, p. 132]. That is the middle row.',
      'Now let the molecule vibrate. If the size, shape or orientation of the ellipsoid changes with the motion, α changes with it [@moon, p. 77]. Stretching N≡N makes the cloud larger when the bond is long and smaller when it is short, so α follows the motion. N₂ has no dipole for the IR to drive, yet its polarizability changes, and that is the condition for Raman activity. That is the bottom row. Two clocks run there: the light’s field swings the cloud far faster than the nuclei move (for N₂ in visible light about eight times), so the cloud follows the light, and the vibration only sets how far each swing goes.',
      {
        label: 'Raman condition',
        lines: ['α = α₀ + (∂α / ∂Q)₀ · Q + …', '(∂α / ∂Q)₀ ≠ 0'],
        note: 'α₀: the polarizability at rest; Q: the normal coordinate. Without the term linear in Q the vibration leaves no mark on the scattered light [@moon, p. 77].',
        tone: 'raman',
      },
      'The asymmetric stretch of CO₂ is the opposite case, and not because CO₂ is hard to polarize: it is more polarizable than N₂. One C=O bond lengthens while the other shortens, so what the cloud gains on one side it loses on the other, and to first order α does not change at all. Symmetry makes it exact: the molecule pushed one way is the mirror image of the molecule pushed the other way, and mirror images have the same α. So α can only rise equally on both sides of rest, like the bottom of a bowl, never tilt; its slope at rest is zero and the mode is silent in Raman [@moon, p. 77]. In the symmetric stretch, both bonds long and both bonds short are two different molecules, their α differs, and the slope is there.',
      'The plots in the diagram show the change in α, Δα, not its size. The bottom row freezes both molecules at the two ends of their motion: N₂ long and N₂ short are two different shapes, while CO₂ at +Q and at −Q is one shape seen in a mirror. What a changing α does to the scattered light, the Stokes and anti-Stokes lines, is on the Raman spectroscopy card.',
    ],
    related: [
      { key: 'ir-inactive', why: 'Silent in the IR, visible through α' },
      { key: 'fermi', why: 'Two Raman lines where one mode was expected' },
    ],
  },
  {
    key: 'spectrum',
    section: 'spectroscopy',
    label: 'IR spectroscopy',
    teaser:
      'Each vibration absorbs only its own photon energy, so each leaves a dip at its own place on the axis.',
    body: [
      'Light of intensity I₀ falling on a sample is partly reflected, partly transmitted and partly absorbed [@busca, p. 4]. A spectrum records which photon energies go missing: where a photon matches the gap of an IR-active vibration it is absorbed, everywhere else it passes [@busca, p. 4]. Each vibration leaves its own dip, and where the dip sits is the size of its gap.',
      {
        label: 'Photon energy',
        lines: ['E = hν = hc / λ'],
        note: 'The wavenumber is 1/λ, in cm⁻¹, so it is proportional to E [@busca, Eq. (1.4)].',
      },
      'The mid-infrared, 4000 to 400 cm⁻¹, spans 0.496 to 0.0496 eV [@busca, p. 4], so a band twice as far up the axis belongs to a gap twice as large. By convention the axis runs from high to low: stretches of bonds to hydrogen on the left, stretches between heavier atoms in the middle, bends, lattice and metal–oxygen modes on the right.',
      'The same measurement plots two ways. The detector signal I is compared with I₀, and its bands point down; absorbance turns them into peaks that grow with the amount of absorber [@busca, pp. 4–5]. In a transmission measurement I/I₀ is the transmittance. Transmission and diffuse reflectance give fundamentally the same spectra on modern instruments [@busca, p. 5].',
      {
        label: 'Absorbance and the Lambert–Beer law',
        lines: ['A = −log₁₀(I / I₀)', 'A = ε · c · l'],
        note: 'ε: molar absorption coefficient, c: concentration, l: path length. Rigorously valid only in non-scattering media, which a catalyst powder is not [@busca, Eqs. (1.3), (1.8)].',
        tone: 'ir',
      },
      'Each band has its own absorption coefficient ε [@busca, p. 5], so a strong band does not mean an abundant species. Compare one band across spectra, never one band with another.',
      'No band is a line. The symmetric CH₃ deformation of ethylidyne is 2.1 cm⁻¹ wide on a Pt(111) single crystal and 5.7 cm⁻¹ on Pt/Al₂O₃, broader because the supported metal offers more varied sites [@trenary, pp. 56–57]. Hydrogen bonding shifts an OH stretch down and broadens it [@busca, p. 22]. That is why the atlas records a range rather than a single number.',
    ],
    related: [
      { key: 'site-sensitivity', why: 'One species, several sites, several dips' },
      { key: 'isotopologue', why: 'A heavier isotope moves a dip to the right' },
      { key: 'fermi', why: 'Two nearby levels share one dip between them' },
      { key: 'branches', why: 'A free molecule’s dip splits into P, Q and R' },
      { key: 'ir-inactive', why: 'No dipole change, no dip at all' },
    ],
    // CH₄'s νₐₛ range is 2980–3060; 3016 is the position named on the card.
    examples: [{ id: 'ch4g_asym', wn: 3016 }, 'co_linear_mu1', 'methoxy_co_stretch_bi'],
  },
  {
    key: 'raman',
    section: 'spectroscopy',
    label: 'Raman spectroscopy',
    teaser:
      'Scattered, not absorbed: a rare photon comes back out short by exactly one vibrational gap.',
    body: [
      'Raman spectroscopy lights the sample with a monochromatic laser, visible or near-infrared, and collects the scattered light, usually at right angles to the beam [@moon, p. 76]. What it measures is the shift in frequency between the laser and the scattered light, and that shift is the vibration [@moon, p. 76].',
      'Most of the scattered light keeps the laser’s energy: Rayleigh scattering, by far the strongest. Where energy is exchanged with a vibration, the photon comes out shifted down (Stokes) or up (anti-Stokes), and identical lines sit on both sides of the Rayleigh line [@moon, pp. 76–77]. On an energy diagram the molecule passes through a virtual state, not a level it can stay in [@stair, p. 133].',
      {
        label: 'Raman shift',
        lines: ['shift = 1/λ(laser) − 1/λ(scattered)'],
        note: 'In cm⁻¹; positive for Stokes, negative for anti-Stokes, and the same whichever laser is used [@moon, p. 77].',
        tone: 'raman',
      },
      'Classically, the three lines come from the polarizability. The laser drives the electron cloud at ν₀, and a vibration that changes α modulates the induced dipole at νᵥ; the product of the two oscillations contains three frequencies [@moon, p. 77].',
      {
        label: 'Why the scattered light carries the vibration',
        lines: [
          'μ(ind) = α · E,   α = α₀ + (∂α / ∂r)₀ · rₘ cos 2πνᵥt',
          'μ(ind) = α₀E₀ cos 2πν₀t',
          '    + ½ (∂α / ∂r)₀ rₘE₀ [cos 2π(ν₀ − νᵥ)t + cos 2π(ν₀ + νᵥ)t]',
        ],
        note: 'First term: Rayleigh, at ν₀. Second: Stokes at ν₀ − νᵥ and anti-Stokes at ν₀ + νᵥ, equally strong in this classical picture [@moon, p. 77].',
        tone: 'raman',
      },
      'Because the shift does not depend on the laser, a Raman line sits at the same number as the vibration, and any source gives the same pattern [@moon, p. 77].',
      'Stokes lines are the ones usually measured, because they are stronger [@moon, p. 77]. Anti-Stokes needs molecules already in v = 1, which the Boltzmann factor keeps rare [@busca, p. 4]; for the 300 cm⁻¹ mode drawn here the ratio is about a quarter at room temperature. Measuring both at once gives the temperature of the spot under the laser [@stair, p. 136].',
      {
        label: 'Anti-Stokes against Stokes',
        lines: ['I(anti-Stokes) / I(Stokes) ≈ exp(−ΔE / kT)'],
        note: 'ΔE: the vibrational quantum. The ω⁴ term of the intensity adds a few per cent for anti-Stokes. From the Boltzmann populations [@busca, Eq. (1.7)].',
        tone: 'raman',
      },
      {
        label: 'Raman intensity',
        lines: ['I ∝ ω⁴ · N · |∂α / ∂Q|²'],
        note: 'ω: frequency of the scattered light, N: number of scatterers; a sum over the tensor components of α in full [@stair, Eq. (6.1)].',
        tone: 'raman',
      },
      'Only about one photon in ten million is Raman-scattered even by a strong vibration, so a laser is essential: 1 mW is about 10¹⁵ photons per second and yields 10⁶ to 10⁸ counts per second at the detector [@stair, p. 132].',
      'Anything else the laser sets off can bury that signal. Fluorescence, with a cross-section up to 10⁶ times larger, can hide the spectrum completely, even from a trace impurity or from coke [@stair, p. 132]. Anti-Stokes lines escape it [@moon, p. 77], and an ultraviolet laser moves the Raman lines away from it [@stair, p. 132]. The laser can also heat or change the catalyst it probes, so its power is kept low [@moon, p. 78].',
      'Water and gases scatter very weakly, so Raman can watch a catalyst being made in water, or working under flowing gas, where IR would see mostly the medium [@moon, p. 78].',
    ],
    related: [
      { key: 'ir-inactive', why: 'Silent in the IR, often strong in Raman' },
      { key: 'fermi', why: 'CO₂’s Raman lines come as a Fermi pair' },
      { key: 'isotopologue', why: 'Same rule as IR: heavier isotope, smaller shift' },
    ],
  },
  {
    key: 'selection',
    section: 'spectroscopy',
    label: 'Selection rules',
    teaser:
      'IR needs the dipole to change, Raman the electron cloud. In CO₂ no vibration does both.',
    body: [
      'Whether a vibration shows up at all depends on what it does to the charge, and IR and Raman ask two different questions [@busca, pp. 4–6].',
      {
        label: 'IR absorption',
        lines: ['Δv = ±1', '(∂μ / ∂Q)₀ ≠ 0'],
        note: 'The dipole moment μ must change as the atoms move along the normal coordinate Q [@busca, Eqs. (1.5), (1.6)].',
        tone: 'ir',
      },
      {
        label: 'Raman scattering',
        lines: ['Δv = ±1', '(∂α / ∂Q)₀ ≠ 0'],
        note: 'The polarizability α must change as the atoms move [@busca, p. 5] [@moon, p. 77].',
        tone: 'raman',
      },
      'Δv = ±1 holds for a harmonic oscillator in both and is relaxed by anharmonicity [@busca, pp. 4–5]. The second rule is where the two part: a mode that changes the dipole absorbs in the IR; one that changes only the polarizability is Raman-active and IR-inactive [@busca, p. 6].',
      'CO₂ shows both at work. In the symmetric stretch both C=O bonds lengthen together: the dipole stays zero while the cloud swells and shrinks, so the mode is Raman-active and silent in the IR. In the asymmetric stretch and the bend the dipole swings back and forth, so both absorb, at 2349 and 667 cm⁻¹. The cloud changes size in the asymmetric stretch too, but identically on either side of rest, so (∂α/∂Q)₀ is zero and it is silent in Raman [@moon, p. 77].',
      {
        label: 'Mutual exclusion rule (centre of symmetry)',
        lines: ['Raman-active ⇒ IR-inactive', 'IR-active ⇒ Raman-inactive'],
        note: 'A mode can still be neither. Without a centre of symmetry a mode can be both [@busca, p. 5].',
      },
      'That is the mutual exclusion rule. Group theory shows that for a species with a centre of symmetry, Raman-active modes are IR-inactive and the reverse [@busca, p. 5]. Some modes are active in neither, and without a centre of symmetry a mode can be active in both [@busca, pp. 5–6], so a band at the same wavenumber in both spectra rules a centre of symmetry out. In most cases the two techniques are therefore complementary [@busca, p. 5].',
      'The symmetric stretch appears in Raman not as one line but as two, at 1388 and 1285 cm⁻¹. It sits so close to the first overtone of the bend that the two mix and share the intensity: a Fermi resonance, recorded in the atlas as a partner pair.',
      'On a surface the rules shift. An adsorbed, bent CO₂ has lost its centre of symmetry, so the symmetric stretch can turn up weakly in the IR near 1380 cm⁻¹, which is one reason that band carries a misassignment warning in the atlas. On a metal the surface dipole selection rule applies on top [@trenary, p. 54].',
    ],
    related: [
      { key: 'ir-inactive', why: 'Silent in the IR, by symmetry' },
      { key: 'fermi', why: 'Why ν₁ of CO₂ is two Raman lines' },
      { key: 'degeneracy', why: 'The bend is two motions at one frequency' },
      { key: 'branches', why: 'The P and R lobes of the IR bands' },
    ],
    // IR: ν₃ as its P and R branches, ν₂ with its Q. Raman: the Fermi pair,
    // with the heights the atlas does not record (the upper line is stronger).
    examples: [
      'co2_asym_p',
      'co2_asym_r',
      'co2_bend_p',
      'co2_bend_q',
      'co2_bend_r',
      { id: 'co2_sym', raman: true, depth: 1 },
      { id: 'co2_bend_overtone', raman: true, depth: 0.62 },
    ],
  },
];

/** One Knowledge card citing one reference, for the References page. */
export interface KnowledgeLink {
  /** The card's key: the Knowledge page opens it. */
  key: string;
  label: string;
  /** Where in the reference, e.g. "Ch. 1: p. 4; Eq. (1.7)". */
  where: string[];
}

/** Every citekey the Knowledge cards cite, with the cards that cite it. */
export function knowledgeLinks(): Map<string, KnowledgeLink[]> {
  const out = new Map<string, KnowledgeLink[]>();
  for (const f of FUNDAMENTALS) {
    const c = citer();
    for (const b of f.body) {
      if (isFormula(b)) {
        c.parse(b.label);
        if (b.note) c.parse(b.note);
      } else c.parse(b);
    }
    const byKey = new Map<string, string[]>();
    for (const cited of c.list) {
      // "Ch. 1, G. Busca, …" is shortened to its chapter number here.
      const chapter = cited.chapter?.split(',')[0];
      const where = [chapter, summarizeLocators(cited.locators)].filter(Boolean).join(': ');
      byKey.set(cited.key, [...(byKey.get(cited.key) ?? []), where].filter(Boolean));
    }
    for (const [key, where] of byKey) {
      out.set(key, [...(out.get(key) ?? []), { key: f.key, label: f.label, where }]);
    }
  }
  return out;
}

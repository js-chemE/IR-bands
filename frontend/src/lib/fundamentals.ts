/**
 * The fundamentals: what has to be understood before any phenomenon makes
 * sense, and the notation it is written in.
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
import type { PatternGroup } from './phenomena';

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
 * Where a card sits on the Knowledge page: how molecules move, the physics
 * every spectrum rests on, a kind of spectroscopy built on it, or the
 * notation the atlas writes it all in. Each is its own heading and row of
 * cards; `afterPatterns` puts a part below the Band patterns rather than
 * above them.
 */
export type KnowledgeSection = 'motion' | 'basics' | 'spectroscopy' | 'notation';

export const KNOWLEDGE_SECTIONS: {
  key: KnowledgeSection;
  label: string;
  lead?: string;
  afterPatterns?: boolean;
}[] = [
  {
    key: 'motion',
    label: 'Molecular motion',
    lead: 'What a molecule can do before any light arrives: travel, turn and vibrate, and how many ways it has of each.',
  },
  { key: 'basics', label: 'Light–matter interaction' },
  { key: 'spectroscopy', label: 'Spectroscopy' },
  {
    key: 'notation',
    label: 'Notation',
    lead: 'Two notations for one mode: by what moves, which names every band in the atlas, and by which mode it is, which numbers the modes on the Vibration modes view.',
    afterPatterns: true,
  },
];

export interface Fundamental {
  key: string;
  label: string;
  /**
   * A part of its own, or one of the Band patterns rows when the card
   * explains a pattern (Selection rules: why bands go missing).
   */
  section: KnowledgeSection | PatternGroup;
  /** One or two sentences on the card. Keep it to about 25 words. */
  teaser: string;
  /**
   * The full explanation: a string per paragraph, or a formula box. Unicode,
   * no markup; `[@alias, locator]` cites a source (lib/cite.ts).
   */
  body: Block[];
  /**
   * Cards that build on this, each with why: a phenomenon key
   * (lib/phenomena.ts) or another fundamentals card.
   */
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
    key: 'modes',
    section: 'motion',
    label: 'Normal modes',
    teaser:
      'N atoms can move 3N ways. Take away travelling and turning as a whole, and 3N − 6 vibrations are left.',
    body: [
      'Each atom can move in three directions, so a molecule of N atoms has 3N ways to move: its degrees of freedom. Three of them carry the whole molecule along without changing its shape, the translations. Three more turn it as a whole, the rotations; a linear molecule has only two, because turning it about its own axis moves no nucleus. Everything left changes the distances and angles between the atoms. Those are the vibrations.',
      {
        label: 'How many vibrations',
        lines: ['3N − 6   (non-linear)', '3N − 5   (linear)'],
        note: 'N: the number of atoms. CO has 1, H₂O 3, CO₂ 4, CH₄ 9, methanol 12.',
      },
      'The vibrations are not the motions of single bonds. Each is a normal mode: a pattern in which every atom moves at the same frequency and in step, all passing through rest at once, while the centre of mass stays put. How far the molecule has moved along one such pattern is its normal coordinate Q, the Q of the selection rules [@busca, p. 4]. The diagram draws the three modes of H₂O and the four of CO₂.',
      'Normal modes are independent: exciting one leaves the others as they were. Each has its own ladder of levels and its own fundamental, v = 0 → 1, and a spectrum is mostly made of these fundamentals [@busca, p. 4]. The count is therefore the number of bands to expect, and the Band patterns part starts from it: why a spectrum shows more bands than that, or fewer, or bands in unexpected places.',
      'CO₂ shows how the count plays out. Three atoms in a line give 3 · 3 − 5 = 4 modes: the symmetric stretch, the asymmetric stretch, and the bend twice, once in the plane of the page and once out of it. The two bends are the same motion turned by 90°, so they share one frequency: four modes, three frequencies. Only two of those absorb in the IR, at 2349 and 667 cm⁻¹; the symmetric stretch is seen only in Raman.',
      'Symmetry sorts the modes before any spectrum is taken. Each mode belongs to a symmetry species of the molecule’s point group, and counting the modes of each species tells in advance how many can be IR-active and how many Raman-active [@busca, p. 6]. The species also give the modes their second set of names, ν₁, ν₂ … with a Mulliken label: the Herzberg numbering card.',
      'On a surface the count changes. A molecule held by its bond can no longer travel or turn freely, so its translations and rotations become vibrations too: soft ones, against the surface, called frustrated translations and rotations. A CO standing on one metal atom therefore has six modes, not one: the C–O stretch, the metal–carbon stretch, and a degenerate pair each of frustrated rotations and frustrated translations, all but the C–O stretch below 500 cm⁻¹. The Rotation card shows the frustrated rotation.',
      'The atlas draws the modes of every molecule it holds, animated, with the bands that document each one, in Dataset → Contents → Vibration modes. The list below counts them and opens each molecule there.',
    ],
    related: [
      { key: 'degeneracy', why: 'Two modes, one frequency' },
      { key: 'ir-inactive', why: 'A mode that leaves the dipole alone leaves no band' },
      { key: 'combination', why: 'Two modes excited by one photon' },
      { key: 'rotation', why: 'The degrees of freedom that are not vibrations' },
      { key: 'numbering', why: 'The modes counted off as ν₁, ν₂, ν₃ …' },
    ],
  },
  {
    key: 'rotation',
    section: 'motion',
    label: 'Rotation',
    teaser:
      'A free molecule also turns, on a ladder far finer than the vibrational one. Held on a surface, it can only rock.',
    body: [
      'Besides vibrating, a free molecule turns, and rotation is quantized too: a ladder of levels numbered J = 0, 1, 2 … The rungs are close together. For CO the first gap is 3.9 cm⁻¹, against 2143 cm⁻¹ for its vibration, so at room temperature, where kT is about 200 cm⁻¹, dozens of rotational levels are filled at once while almost every molecule is still in v = 0 [@busca, p. 4].',
      {
        label: 'Rotational levels of a linear molecule',
        lines: ['E(J) = B · J(J + 1)', 'gap J → J + 1:  2B(J + 1)'],
        note: 'B: the rotational constant in cm⁻¹, small for a heavy or long molecule: CO 1.93, CO₂ 0.39. The rigid rotor; a real molecule stretches a little as it spins faster.',
      },
      'Rotation alone, J → J + 1 with no vibration, takes a photon in the microwave or far infrared, well below the mid-infrared window. Its rule mirrors the IR one: the molecule must carry a permanent dipole for the field to turn it. CO has one and rotates in the microwave; CO₂, N₂ and CH₄ have none. Raman sees rotation through the polarizability instead, wherever the cloud is longer than it is wide, so N₂ and CO₂ show pure rotational Raman lines close to the laser.',
      'In the mid-infrared, rotation rides on the vibration. A vibrational transition changes J at the same time: by +1 or −1, and by 0 where the symmetry allows it. The +1 lines form the R branch, at higher wavenumber, the −1 lines the P branch, at lower, and the 0 lines a Q branch at the centre. CO has no Q branch; the CO₂ bend has one. The middle row of the diagram builds the pattern: a gas band is two lobes, or three, not one line.',
      {
        label: 'Branches',
        lines: ['R:  ΔJ = +1   higher wavenumber', 'Q:  ΔJ = 0    band centre', 'P:  ΔJ = −1   lower wavenumber'],
        note: 'A line of the R branch sits 2B(J + 1) above the band centre, a line of the P branch 2BJ below it. How tall each line is follows how full its starting level is.',
      },
      'Gas-phase acetylene in a reflection cell shows it: its asymmetric C–H stretch appears as a P and an R branch at 3269 and 3309 cm⁻¹ [@trenary, p. 56].',
      'On a surface the ladder is gone. A molecule held by its bond cannot turn freely; it can only rock about its anchor. That rocking is a vibration, the frustrated rotation, with a band of its own at low wavenumber and no branches. In solids generally, rotation and translation are hindered in the same way, and vibration is what remains [@li, p. 297].',
      'So the branches are the mark of a free molecule. An adsorbed species gives one band per mode where its gas gives an envelope, and the envelope of a gas-phase reactant in the cell is something to subtract, not a surface species. The atlas records each branch of a gas-phase band as a band of its own, grouped with its siblings.',
    ],
    related: [
      { key: 'branches', why: 'P, Q and R, band by band' },
      { key: 'modes', why: 'Rotations are three of the 3N' },
    ],
  },
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
    // The most common reason a spectrum shows fewer bands than modes.
    section: 'fewer',
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
      'That is the mutual exclusion rule. Group theory shows that for a species with a centre of symmetry, Raman-active modes are IR-inactive and the reverse [@busca, p. 5]. Some modes are active in neither, and without a centre of symmetry a mode can be active in both [@busca, pp. 5–6], so a band at the same wavenumber in both spectra rules a centre of symmetry out. In most cases the two techniques are therefore complementary [@busca, p. 5]. The bottom row of the diagram freezes each mode at its two extremes: the symmetric stretch gives two different shapes, both still symmetric, so α differs while μ stays zero; the asymmetric stretch and the bend give mirror images, so the dipole arrow flips while α cannot change.',
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
  {
    key: 'labels',
    section: 'notation',
    label: 'Group-frequency labels',
    teaser:
      'νₐₛ(OCO) HCOO*: the kind of motion, the atoms that move, the species. Every band in the atlas is named this way.',    body: [
      'Every band in the atlas is named by what moves: a Greek letter for the kind of motion, the moving atoms in brackets, then the species, as in νₐₛ(OCO) HCOO*. The name describes a local motion, one group of atoms doing one thing, and that is what makes it portable: an OCO group stretching asymmetrically absorbs near the same place in formate on copper and in formate on zinc oxide, so one label serves every paper. A band that belongs to a group rather than a molecule is a group frequency.',
      {
        label: 'The motion',
        lines: [
          'ν   stretch: a bond length changes',
          'δ   bend or deformation: an angle changes',
          'ρ   rock: the group swings within its plane',
          'ω   wag: the group swings out of its plane',
          'τ   twist or torsion: the group turns about a bond',
          'γ   out of plane, where ω and τ are not told apart',
          'δₛ   umbrella: a CH₃ group folds its hydrogens in and out together',
          'δₐₛ   asymmetric deformation: the H–C–H angles change unevenly',
        ],
        note: 'δ on its own is the scissoring bend. Many papers call every motion that is not a stretch δ; the atlas keeps them apart where the source does.',
      },
      {
        label: 'The modifiers',
        lines: [
          'νₛ   symmetric: equal bonds move in step',
          'νₐₛ   asymmetric: one lengthens as the other shortens',
          '2δ   first overtone',
          'νₛ+δ   combination of two modes',
          '(R) (Q) (P)   rotational branch, gas phase',
          'HCOO*   adsorbed: the star marks a surface species',
        ],
      },
      'A CH₃ group bends in two ways a CH₂ group cannot. In the symmetric deformation, δₛ(CH₃), the three hydrogens fold towards the axis of the bond that holds the group and back out, all together, like an umbrella opening and closing, with that bond as the handle: the umbrella mode of methoxy and methanol. In the asymmetric deformation, δₐₛ(CH₃), the H–C–H angles change unevenly, one opening while another closes; with three equal hydrogens there are two such patterns at one frequency, a degenerate pair. The atlas adds the word umbrella to a label where a paper names it, as in δₛ(CH₃) umbrella MeOH. The third row of the diagram shows both.',
      'CH₄ keeps the same symbols, δₛ(HCH) and δₐₛ(HCH), for motions of another kind. With four equal hydrogens and no bond to the rest of a molecule there is no handle and so no umbrella: its bends are patterns in which the H–C–H angles open and close against each other. The label says which kind of bend, not which motion; the motion itself is drawn on the Vibration modes view.',
      'Where the binding geometry is what tells two bands apart, it replaces the species: ν(CO) linear (μ₁) and ν(CO) bridged (μ₂), for CO on one metal atom or bridging two. Where one molecule has two modes of the same kind, the label borrows the number from the other notation rather than inventing a letter: νₛ(CH₃) ν₂ MeOH.',
      'The label is a description, not a derivation. In a real molecule a mode rarely moves one group alone; two groups vibrating at similar frequencies share the motion, and the label names the part that dominates. For small, symmetric molecules the other notation is exact where this one is approximate. The diagram shows the six motions of a CH₂ group and the two of a CH₃ group; its bottom row takes one label apart.',
      'The atlas holds itself to one notation per species, and the source guide (behind the Impressum) sets the rule out in full. Spectroscopic codes such as 11101←00001 belong in a reference note, never in a label.',
    ],
    related: [
      { key: 'numbering', why: 'The other notation: which mode, not what moves' },
      { key: 'combination', why: 'What 2δ and νₛ+δ stand for' },
      { key: 'branches', why: 'What (R), (Q) and (P) stand for' },
    ],
  },
  {
    key: 'numbering',
    section: 'notation',
    label: 'Herzberg numbering',
    teaser:
      'ν₁, ν₂, ν₃: a molecule’s modes counted off by symmetry, then by falling wavenumber. Which mode, not what moves.',
    body: [
      'The second notation numbers a molecule’s normal modes: ν₁, ν₂, ν₃ … It names which mode, not what moves, and it means something only within one molecule. ν₃ of H₂O is its asymmetric O–H stretch; methanol has twelve modes, and its ν₈ is the C–O stretch. For small symmetric molecules, where each mode moves every atom, the number is the exact name and a group-frequency label only an approximation.',
      {
        label: 'How the modes are numbered',
        lines: ['1. by symmetry species, the totally symmetric first', '2. within a species, by falling wavenumber'],
        note: 'Herzberg’s convention, which the Vibration modes view follows even where a cited paper numbers its figure differently.',
      },
      'H₂O shows the rule at work. Its two A₁ modes come first: the symmetric stretch at 3657 cm⁻¹ is ν₁, the bend at 1595 cm⁻¹ is ν₂. The B₂ asymmetric stretch comes last as ν₃, although at 3756 cm⁻¹ it is the highest of the three. The number follows the symmetry, not the position; the top row of the diagram sorts them.',
      'CO₂ keeps an older, traditional numbering. Its modes are ν₁, the symmetric stretch; ν₂, the bend, twice; and ν₃, the asymmetric stretch. By the rule above the asymmetric stretch would be ν₂ and the bend ν₃, but in the literature the bend of a linear molecule like CO₂ is always ν₂.',
      {
        label: 'CO₂ in both notations',
        lines: ['ν₁   Σ(g)⁺   νₛ(OCO)    Raman only', 'ν₂   Π(u)    δ(OCO)     667 cm⁻¹, twice', 'ν₃   Σ(u)⁺   νₐₛ(OCO)   2349 cm⁻¹'],
        note: 'A Mulliken label needs letter subscripts Unicode does not have, so the atlas stores these labels with markup, in exactly two fields of its data.',
      },
      'Each number comes with its symmetry species, written as a Mulliken label. A and B mark a mode of its own, E a doubly degenerate pair, T a triple; linear molecules use Σ for a mode along the axis and Π for a degenerate pair across it. The subscripts say how the mode behaves under the molecule’s symmetry operations. Two of them carry the mutual exclusion rule, which group theory proves for any molecule with a centre of symmetry [@busca, p. 5]: g, even under inversion, and u, odd. Only u modes can absorb in the IR, only g modes can scatter in Raman.',
      'Papers mix the two notations freely, often in one sentence. Ranjan and Trenary assign gas-phase ethylene’s band at 949 cm⁻¹ to its ρw(CH₂) mode, of B(1u) symmetry in D(2h), and the one at 2988 cm⁻¹ to its B(3u) C–H stretch [@trenary, p. 56]: a local label and a symmetry species for bands of one molecule.',
      'In the atlas the numbers stand beside each mode’s label on the Vibration modes view, with its Mulliken label, and appear in a band name only to tell two modes of one kind apart. The band names themselves use the group-frequency form throughout, gas-phase CO₂ included, so one notation runs through the whole chart.',
    ],
    related: [
      { key: 'labels', why: 'The other notation: what moves' },
      { key: 'modes', why: 'What is being numbered' },
      { key: 'selection', why: 'What the symmetry species decide' },
    ],
  },
];

/**
 * Cards not written yet, shown as a note at the end of the Knowledge page so
 * the plan is visible where the cards will go. Move an entry into
 * FUNDAMENTALS (or PHENOMENA) when its card is written, and delete it here.
 */
export const PLANNED: { label: string; part: string; what: string }[] = [
  {
    label: 'Band position',
    part: 'Molecular motion',
    what: 'ν̃ = (1/2πc)·√(k/μ): why stretches of bonds to hydrogen sit high, how bond order moves a band, back-donation on metals.',
  },
  {
    label: 'Molecules',
    part: 'a part of its own',
    what: 'The Vibration modes view as cards, one per molecule: its modes cycling on hover, opened into the viewer and a mode list that folds out into each mode’s bands.',
  },
  {
    label: 'Hydrogen bonding',
    part: 'Bands that move',
    what: 'Why an OH stretch shifts down and broadens when the H is shared.',
  },
  {
    label: 'Coverage and dipole coupling',
    part: 'Bands that move',
    what: 'Why a CO band climbs as the surface fills.',
  },
  {
    label: 'TO/LO splitting',
    part: 'Band patterns',
    what: 'Why the lattice bands of a solid support split into two components.',
  },
  {
    label: 'Wavenumbers and units',
    part: 'Notation',
    what: 'cm⁻¹, µm and eV, and why spectroscopists count waves per centimetre.',
  },
  {
    label: 'Techniques',
    part: 'Spectroscopy',
    what: 'Transmission, DRIFTS, ATR and RAIRS: how the light reaches the sample, and what each geometry changes in the spectrum.',
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

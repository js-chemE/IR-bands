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
import { PHENOMENA, type PatternGroup } from './phenomena';

/** A highlighted box for a formula or a rule, between paragraphs. */
export interface Formula {
  /** What the box states, as a heading. */
  label: string;
  /**
   * One formula per line. Unicode, no markup. A slash with spaces round it,
   * "hc / λ", is a fraction and is set stacked; a slash without spaces, a
   * unit such as kJ/mol, stays on the line (components/knowledge/FormulaLine).
   */
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
 * cards; `afterPatterns` puts a part below the Band Patterns rather than
 * above them, and `continues` makes a row a new line of the part above.
 */
export type KnowledgeSection = 'motion' | 'surface' | 'basics' | 'spectroscopy' | 'notation';

export const KNOWLEDGE_SECTIONS: {
  key: KnowledgeSection;
  label: string;
  lead?: string;
  afterPatterns?: boolean;
  /** A second row of the part above: no heading of its own, just a new line. */
  continues?: boolean;
}[] = [
  {
    key: 'motion',
    label: 'Molecular Motion',
    lead: 'What a molecule can do before any light arrives: travel, turn and vibrate, and how many ways it has of each.',
  },
  // Frustrated Motion: the same part, on a line of its own after the free motions.
  { key: 'surface', label: 'Molecular Motion', continues: true },
  { key: 'basics', label: 'Light–Matter Interaction' },
  { key: 'spectroscopy', label: 'Spectroscopy' },
  {
    key: 'notation',
    label: 'Notation',
    lead: 'Two notations for one mode: by what moves, which names every band in the atlas, and by which mode it is, which numbers the modes on the Vibration Modes view.',
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
    label: 'Normal Modes',
    teaser:
      'Every motion of N atoms splits into 3N independent patterns: three to travel, three to turn, 3N − 6 to vibrate.',
    body: [
      'Each atom can move in three directions, so a molecule of N atoms has 3N ways to move, its degrees of freedom. Any motion at all, however tangled, can be taken apart into 3N independent patterns, the normal modes, in each of which every atom moves in step. They come in three kinds, one card each: the Translation Modes carry the molecule along, the Rotation Modes turn it, and the Vibration Modes change its shape.',
      {
        label: 'Counting the Degrees of Freedom',
        lines: ['3N = 3 + 3 + (3N − 6)   (non-linear)', '3N = 3 + 2 + (3N − 5)   (linear)'],
        note: 'Translation + rotation + vibration. A linear molecule has one rotation fewer, because turning it about its own axis moves no nucleus. H₂O: 9 = 3 + 3 + 3. CO₂: 9 = 3 + 2 + 4.',
      },
      'In a normal-mode calculation all 3N come out together, and the translations and rotations are the modes of zero frequency: nothing pulls a molecule back when it travels or turns. Only the vibrations meet a restoring force, the bonds, and so only they swing at a frequency of their own.',
      'The three kinds differ most in the size of their energy steps. Travel is effectively continuous; rotational levels are a few cm⁻¹ apart; vibrational ones hundreds to thousands. At room temperature, with kT about 207 cm⁻¹, every molecule travels and a gas spreads over many rotational levels, while almost every molecule sits in its lowest vibrational level [@busca, p. 4]. The bottom row of the diagram sets the three side by side.',
      'Spectra see the three differently. Travel leaves no band. Rotation alone absorbs in the microwave and, riding on a vibration, splits a gas-phase band into branches. The vibrations are what an IR or Raman spectrum is made of, and most of this page is about them.',
      'On a surface the split changes: a molecule held there can no longer travel or turn, and all 3N become vibrations, the Frustrated Motion card.',
    ],
    related: [
      { key: 'vibmodes', why: 'The 3N − 6 that change the shape' },
      { key: 'rotation', why: 'The three (or two) that turn it' },
      { key: 'translation', why: 'The three that carry it along' },
      { key: 'frustrated', why: 'What becomes of travel and turning on a surface' },
      { key: 'branches', why: 'Rotation and vibration in one band' },
    ],
  },
  {
    key: 'vibmodes',
    section: 'motion',
    label: 'Vibration Modes',
    teaser:
      'The atoms move against each other while the centre stays put: 3N − 6 patterns, each at its own frequency.',
    body: [
      'A vibration changes the shape of a molecule, its bond lengths and angles, while the centre of mass stays where it is and the molecule neither travels nor turns. Of the 3N degrees of freedom, 3N − 6 are vibrations, or 3N − 5 for a linear molecule.',
      {
        label: 'How Many Vibrations',
        lines: ['3N − 6   (non-linear)', '3N − 5   (linear)'],
        note: 'N: the number of atoms. CO has 1, H₂O 3, CO₂ 4, CH₄ 9, methanol 12.',
      },
      'The vibrations are not the motions of single bonds. Each is a normal mode: a pattern in which every atom moves at the same frequency and in step, all passing through rest at once. How far the molecule has moved along one such pattern is its normal coordinate Q, the Q of the selection rules [@busca, p. 4]. The diagram draws the three modes of H₂O and the four of CO₂.',
      'Each is mostly a stretch, where bond lengths change, or mostly a bend, where angles change; the Group-Frequency Labels card gives the names, ν for a stretch and δ, ρ, ω or τ for the kinds of bend.',
      'Normal modes are independent: exciting one leaves the others as they were. Each has its own ladder of levels and its own fundamental, v = 0 → 1, and a spectrum is mostly made of these fundamentals [@busca, p. 4]. The count is therefore the number of bands to expect, and the Band Patterns part starts from it: why a spectrum shows more bands than that, or fewer, or bands in unexpected places.',
      'CO₂ shows how the count plays out. Three atoms in a line give 3 · 3 − 5 = 4 modes: the symmetric stretch, the asymmetric stretch, and the bend twice, once in the plane of the page and once out of it. The two bends are the same motion turned by 90°, so they share one frequency: four modes, three frequencies. Only two of those absorb in the IR, at 2349 and 667 cm⁻¹; the symmetric stretch is seen only in Raman.',
      'Symmetry sorts the modes before any spectrum is taken. Each mode belongs to a symmetry species of the molecule’s point group, and counting the modes of each species tells in advance how many can be IR-active and how many Raman-active [@busca, p. 6]. The species also give the modes their second set of names, ν₁, ν₂ … with a Mulliken label: the Herzberg Numbering card.',
      'The atlas draws the modes of every molecule it holds, animated, with the bands that document each one, in Dataset → Contents → Vibration Modes. The list below counts them and opens each molecule there.',
    ],
    related: [
      { key: 'vibration', why: 'How light lifts one mode a rung' },
      { key: 'degeneracy', why: 'Two modes, one frequency' },
      { key: 'ir-inactive', why: 'A mode that leaves the dipole alone leaves no band' },
      { key: 'combination', why: 'Two modes excited by one photon' },
      { key: 'labels', why: 'ν, δ, ρ, ω, τ: naming what moves' },
      { key: 'numbering', why: 'The modes counted off as ν₁, ν₂, ν₃ …' },
    ],
  },
  {
    key: 'rotation',
    section: 'motion',
    label: 'Rotation Modes',
    teaser:
      'A free molecule turns about its centre of mass, on a ladder of levels far finer than the vibrational one.',
    body: [
      'A free molecule turns as a whole, about axes through its centre of mass: three of them, or two for a linear molecule, whose turn about its own axis moves no nucleus. These are the rotational degrees of freedom of the Normal Modes card. Nothing in the molecule changes shape; only its orientation in space does. The top row of the diagram draws the three axes and turns CO about each in turn: about the bond axis, nothing moves.',
      {
        label: 'How Hard It Is to Turn',
        lines: ['I = Σ mᵢ rᵢ²', 'B = h / (8π² c I)'],
        note: 'I: the moment of inertia, from each atom’s mass mᵢ and its distance rᵢ from the axis. B: the rotational constant in cm⁻¹; a heavy or long molecule has a large I and a small B.',
      },
      'Rotation is quantized like everything else in a molecule: a ladder of levels numbered J = 0, 1, 2 …, each holding 2J + 1 states, the ways the same turn can be oriented in space.',
      {
        label: 'Rotational Levels of a Linear Molecule',
        lines: ['E(J) = B · J(J + 1)', 'N(J) ∝ (2J + 1) · exp(−E(J) / kT)'],
        note: 'CO: B = 1.93 cm⁻¹, so the first gap, J = 0 to 1, is 3.9 cm⁻¹. CO₂: 0.39 cm⁻¹. The rigid rotor; a real molecule stretches a little as it spins faster.',
      },
      'The rungs are close together. At room temperature kT is about 207 cm⁻¹, dozens of times the first gap, so a gas is spread over many levels at once: for CO the most filled is J ≈ 7, and levels up to J ≈ 20 still hold a noticeable share. The bars in the diagram show that population, which sets how tall each line of a rotational branch is.',
      'How a molecule turns depends on its shape. A linear molecule such as CO or CO₂ has one moment of inertia and one B. CH₄, a spherical top, turns alike about every axis, again with one B, 5.24 cm⁻¹. H₂O has three different moments and three constants, about 27.9, 14.5 and 9.3 cm⁻¹, and its levels no longer follow one simple formula. The bottom row of the diagram turns all three.',
      'A molecule held on a surface cannot turn at all: its rotations become rocking vibrations, the subject of the Frustrated Motion card.',
    ],
    related: [
      { key: 'branches', why: 'What rotation does to a gas-phase band' },
      { key: 'frustrated', why: 'The turn a surface takes away' },
      { key: 'translation', why: 'The other motion that leaves the shape alone' },
      { key: 'modes', why: 'Rotations are three of the 3N' },
    ],
  },
  {
    key: 'translation',
    section: 'motion',
    label: 'Translation Modes',
    teaser:
      'The whole molecule travels, its shape unchanged: three directions, x, y and z, for every molecule.',
    body: [
      'Translation is the molecule moving as a whole: every atom shifted by the same step, so nothing inside it changes, only where its centre of mass is. Space has three directions, x, y and z, and any travel is a mix of the three, so every molecule, from a single atom to methanol, has exactly three translational degrees of freedom. The diagram draws the three axes through the centre of mass and moves CO along each in turn.',
      {
        label: 'Energy of Travel',
        lines: ['E = ½ m v²', '⟨E⟩ = 3 / 2 · kT   per molecule'],
        note: 'm: the molecule’s mass, v: its speed. ½ kT for each of the three directions; at 25 °C about 310 cm⁻¹ in all.',
      },
      'Translation is quantized too, but only by the walls of the container, and for a gas in a cell the steps are so small that the energy is continuous in practice: a molecule can travel at any speed. At 25 °C CO averages about 475 m/s, and the speeds spread widely around that; the bottom row of the diagram shows the spread.',
      {
        label: 'Mean Speed',
        lines: ['⟨v⟩ = √(8kT / πm)'],
        note: 'CO at 25 °C: about 475 m/s. A lighter molecule moves faster: H₂ at the same temperature averages about 1780 m/s.',
      },
      'Travelling changes neither the shape of a molecule nor where its charge sits, so translation leaves no band of its own.',
      'On a surface a molecule can no longer travel freely: along the normal it bounces against the surface, across it it slides and returns, the frustrated translations of the Frustrated Motion card. In a solid, translation is hindered altogether [@li, p. 297].',
    ],
    related: [
      { key: 'rotation', why: 'The other motion that leaves the shape alone' },
      { key: 'modes', why: 'Translations are three of the 3N' },
      { key: 'frustrated', why: 'The travel a surface takes away' },
    ],
  },
  {
    key: 'frustrated',
    section: 'surface',
    label: 'Frustrated Motion',
    teaser:
      'Held by its bond, an adsorbed molecule can no longer travel or turn. It slides and rocks instead: vibrations of their own.',
    body: [
      'A free molecule spends three of its 3N degrees of freedom travelling and three turning, two if it is linear. Bond it to a surface and neither is free any more: a slide sideways stretches the bond, a tilt bends it, and the bond pulls back. With a restoring force the motion swings to and fro instead of carrying on. Travel becomes a frustrated translation, turning a frustrated rotation, and both are vibrations with frequencies of their own. In solids generally, rotation and translation are hindered in the same way, and vibration is what remains [@li, p. 297].',
      {
        label: 'Counting Modes on a Surface',
        lines: ['free:   3N − 6   (3N − 5 if linear)', 'held by the surface:   3N'],
        note: 'The adsorbate’s own atoms, the surface taken as fixed. CO on one metal atom: 6 modes instead of 1. Methoxy: 15 instead of 9.',
      },
      'CO standing on one metal atom shows the full set. Besides the C–O stretch it has the metal–carbon stretch, the whole molecule bouncing against the metal, which was a translation along the surface normal; a frustrated rotation, the C–O axis tilting off the normal and back; and a frustrated translation, the whole molecule sliding sideways. Tilting and sliding can go either way across the surface, so each is a degenerate pair. The atlas places the metal–carbon stretch at 400–480 cm⁻¹, the frustrated rotation at 400–600 cm⁻¹ and the frustrated translation at 40–80 cm⁻¹.',
      'They are soft because what holds them is the bond to the surface, weaker and far more easily bent than the bonds inside the molecule, and because the whole molecule moves, not one light atom. That puts them at or below the lower edge of the mid-infrared, 400 cm⁻¹ [@busca, p. 4], and often out of the spectrometer’s reach altogether.',
      'On a metal the surface selection rule decides which of them can be seen at all [@trenary, p. 54]. The metal–carbon stretch moves charge along the surface normal and can absorb. Tilting and sliding move it along the surface, where the field of reflected light is almost zero, so both are IR-inactive in reflection although they are real vibrations; the top row of the diagram marks which is which. Techniques that do not rely on the light’s field, such as inelastic neutron scattering, can still find them.',
      'The atlas tags these modes frustrated-mode. CO’s and methoxy’s are drawn and animated on the Vibration Modes view, where a held molecule’s symmetry analysis counts all 3N of its coordinates.',
    ],
    related: [
      { key: 'rotation', why: 'The free turn this replaces' },
      { key: 'translation', why: 'The free travel this replaces' },
      { key: 'modes', why: '3N − 6 becomes 3N' },
      { key: 'dipole', why: 'The surface selection rule that hides them' },
      { key: 'site-sensitivity', why: 'The bond that holds a molecule also moves its bands' },
    ],
  },
  {
    key: 'vibration',
    section: 'basics',
    label: 'Vibrational Excitation',
    teaser:
      'A bond vibrates on a ladder of fixed energies. An infrared photon that fits one rung lifts it: v = 0 → 1.',
    body: [
      'At any temperature every atom vibrates about its equilibrium position, and the vibration can only hold certain energies: the levels v = 0, 1, 2 … of its well [@busca, p. 4]. At absolute zero everything sits in v = 0. At room temperature the first excited level is still almost empty, because the gaps are far larger than the thermal energy kT [@busca, p. 4].',
      {
        label: 'How full a level is (Boltzmann)',
        lines: ['Nᵢ / N₀ = (gᵢ / g₀) · exp(−ΔE / kT)'],
        note: 'N: population, g: multiplicity, ΔE: the gap. For a 2000 cm⁻¹ gap at 25 °C this is about 6 × 10⁻⁵ [@busca, Eq. (1.7)].',
      },
      'The simplest way to climb is to absorb a quantum of light of exactly the right energy [@busca, p. 4]. The gaps fall in the infrared: the mid-infrared, 4000 to 400 cm⁻¹, spans 0.496 to 0.0496 eV [@busca, p. 4]. Absorption also needs the vibration to change the dipole moment; the Dipole Moment card shows why.',
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
    label: 'Dipole Moment',
    teaser:
      'Charge pulled apart makes a dipole: a positive end and a negative end, a distance apart.',
    body: [
      'A dipole moment measures how far a molecule’s positive and negative charge sit apart. Two charges +q and −q a distance d apart give μ = q·d, pointing from the negative charge to the positive one. A bond between two different atoms shares its electrons unevenly and carries a dipole; a bond between two identical atoms carries none.',
      {
        label: 'Dipole Moment',
        lines: ['μ = q · d', 'μ = Σ qᵢ rᵢ   (any set of charges)'],
        note: 'Unit: the debye, 1 D = 3.336 × 10⁻³⁰ C·m.',
      },
      'The dipole so far is permanent: CO carries it with no field around. A field can also make one where there was none, by pulling a molecule’s electron cloud off-centre: an induced dipole, which lasts only while the field acts. The second row of the diagram shows the two side by side; the Induced Dipole card shows how it happens.',
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
    label: 'Induced Dipole',
    teaser:
      'A field pulls the electron cloud off-centre and makes a dipole, even where there was none.',
    body: [
      'Every molecule is a set of nuclei inside a cloud of electrons. Put it in an electric field and the field pushes the two kinds of charge apart: the electrons against the field, the nuclei with it. The cloud stays where it is but grows denser on one side and thinner on the other, and the nuclei shift a little towards the thin side. The side with extra electrons is δ−; the side where the nuclei are left less covered is δ+. The field has induced a dipole moment [@moon, p. 77]. The attraction between the nuclei and their electrons pulls back and keeps the shift small.',
      {
        label: 'Induced Dipole',
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
      'Almost all of that scattered light keeps the frequency of the light that made it. When a vibration changes how easily the cloud is pushed, a little of it does not: that is the Raman effect, and the subject of the Polarizability and Raman Spectroscopy cards.',
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
        note: 'The induced dipole per unit of field. The Induced Dipole card shows the dipole itself [@moon, p. 77].',
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
      'The plots in the diagram show the change in α, Δα, not its size. The bottom row freezes both molecules at the two ends of their motion: N₂ long and N₂ short are two different shapes, while CO₂ at +Q and at −Q is one shape seen in a mirror. What a changing α does to the scattered light, the Stokes and anti-Stokes lines, is on the Raman Spectroscopy card.',
    ],
    related: [
      { key: 'ir-inactive', why: 'Silent in the IR, visible through α' },
      { key: 'fermi', why: 'Two Raman lines where one mode was expected' },
    ],
  },
  {
    key: 'spectrum',
    section: 'spectroscopy',
    label: 'IR Spectroscopy',
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
    label: 'Raman Spectroscopy',
    teaser:
      'Scattered, not absorbed: a rare photon comes back out short by exactly one vibrational gap.',
    body: [
      'Raman spectroscopy lights the sample with a monochromatic laser, visible or near-infrared, and collects the scattered light, usually at right angles to the beam [@moon, p. 76]. What it measures is the shift in frequency between the laser and the scattered light, and that shift is the vibration [@moon, p. 76].',
      'Most of the scattered light keeps the laser’s energy: Rayleigh scattering, by far the strongest. Where energy is exchanged with a vibration, the photon comes out shifted down (Stokes) or up (anti-Stokes), and identical lines sit on both sides of the Rayleigh line [@moon, pp. 76–77]. On an energy diagram the molecule passes through a virtual state, not a level it can stay in [@stair, p. 133].',
      {
        label: 'Raman shift',
        lines: ['shift = 1 / λ(laser) − 1 / λ(scattered)'],
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
    key: 'units',
    section: 'spectroscopy',
    label: 'Spectral Units',
    teaser:
      'Where a band sits: its wavenumber, in cm⁻¹. Wavelength, frequency, energy and the Raman shift give the same position in other units.',
    body: [
      'The horizontal axis of a spectrum says where a band sits: which photon energy the vibration takes. That one quantity goes by several names and units, and they convert into one another exactly [@busca, Eq. (1.4)]. The diagram lights this axis; its companion, the Spectral Representations card, lights the other one.',
      {
        label: 'One Position, Four Units',
        lines: ['E = hν = hc / λ = hc ν̃', 'ν̃ = 1 / λ   (in cm⁻¹)'],
        note: 'E: photon energy, ν: frequency, λ: wavelength, ν̃: wavenumber; h: Planck’s constant, c: the speed of light [@busca, Eq. (1.4)].',
      },
      'Infrared spectroscopists count waves per centimetre, the wavenumber, because it is proportional to energy: a band twice as far up the axis takes a photon of twice the energy. Wavelength runs the other way and bunches up: the mid-infrared, 4000 to 400 cm⁻¹, is 2.5 to 25 µm, and more than half of that wavelength range lies between 800 and 400 cm⁻¹. The middle row of the diagram sets the scales side by side.',
      {
        label: 'Converting',
        lines: ['1 cm⁻¹ = 0.124 meV = 0.01196 kJ/mol = 29.98 GHz', 'λ (in µm) = 10⁴ / ν̃ (in cm⁻¹)'],
        note: 'CO at 2143 cm⁻¹: 4.67 µm, 64.2 THz, 0.266 eV, 25.6 kJ/mol. The mid-infrared, 4000 to 400 cm⁻¹, spans 0.496 to 0.0496 eV [@busca, p. 4].',
      },
      'By convention the axis runs from high wavenumber on the left to low on the right, as on the band chart; a paper plotted the other way, or in wavelength, shows the same bands mirrored or squeezed.',
      'A Raman spectrum uses the same axis differently: its position is the Raman shift, the difference between the laser’s wavenumber and the scattered light’s [@moon, p. 77]. The scattered light moves with the laser, green with a 532 nm laser and near-infrared with a 785 nm one, but the shift is the vibration and stays put, so a Raman line and an IR band of the same vibration carry the same number [@moon, p. 77].',
      {
        label: 'Raman Shift',
        lines: ['Δν̃ = ν̃(laser) − ν̃(scattered)'],
        note: 'Positive for Stokes lines, negative for anti-Stokes. The CO stretch, 2143 cm⁻¹, lands at 600 nm with a 532 nm laser and at 944 nm with a 785 nm one: two wavelengths, one shift. The bottom row of the diagram shows both.',
        tone: 'raman',
      },
      'The atlas stores every position in cm⁻¹, as a range, and the band chart can redraw its axis in other units.',
    ],
    related: [
      { key: 'representations', why: 'The other axis: how strong a band is' },
      { key: 'spectrum', why: 'What a position on this axis means' },
      { key: 'raman', why: 'Where the shift comes from' },
      { key: 'isotopologue', why: 'A shift along this axis, and nothing else' },
    ],
  },
  {
    key: 'representations',
    section: 'spectroscopy',
    label: 'Spectral Representations',
    teaser:
      'One measurement, many plots: signal, transmittance, absorbance, reflectance, Kubelka–Munk. The choice decides what a band’s height means.',
    body: [
      'The vertical axis of a spectrum says how much light a band takes, and one measurement can be plotted many ways. Light falling on a sample is reflected, transmitted or absorbed, and the three fractions add up to one [@busca, Eqs. (1.1), (1.2)]. The diagram lights this axis; its companion, the Spectral Units card, lights the other one.',
      {
        label: 'Where the Light Goes',
        lines: ['I₀ = I(R) + I(T) + I(A)', 'R + T + A = 1'],
        note: 'R, T and A: the reflected, transmitted and absorbed fractions. This A is the absorptance, not the absorbance [@busca, Eqs. (1.1), (1.2)].',
      },
      'What the spectrometer records is the single-beam spectrum: the light that reaches the detector at each wavenumber. It carries the lamp, the optics, the windows and the gas in the path as much as the sample, so it is divided by a background, I₀, recorded without the sample or on a clean one. From that one ratio two families of plots follow, and which family depends on how the light reached the detector: through the sample, or scattered back from it.',
      {
        label: 'Transmission and Reflection, Side by Side',
        lines: [
          'through the sample:   T = I / I₀   →   A = −log₁₀ T',
          'back from a powder:   R = I / I₀   →   log₁₀(1 / R)  or  F(R)',
        ],
        note: 'The same ratio to a background, then a different quantity. The two families do not convert into each other: a reflectance is not a transmittance, and log(1/R) is not an absorbance, though it is written like one. The diagram draws the two in parallel rows.',
        tone: 'ir',
      },
      'Through a wafer, the transmittance T is the fraction that passes, and its absorbance A grows in proportion to the amount of absorber: the Lambert–Beer law, A = ε · c · l, rigorously valid only in a medium that does not scatter [@busca, Eqs. (1.3), (1.8)].',
      'From a powder in a diffuse-reflectance cell (DRIFTS), the light comes back scattered from many grains, and the reflectance R, against a background that absorbs nothing, takes the place of T; on modern instruments the two techniques give fundamentally the same spectra [@busca, p. 5]. Two conversions are common. log(1/R), the pseudo-absorbance, is written like an absorbance. The Kubelka–Munk function comes from a model of light in a scattering layer and is roughly proportional to the absorption coefficient, and so to concentration [@vogt, p. 243]; for the weak bands of adsorbates, as the next paragraphs show, that promise fails.',
      {
        label: 'Kubelka–Munk',
        lines: ['F(R) = (1 − R)² / 2R = k / s', 'R = 1 + F − √(F (F + 2))'],
        note: 'k: the absorption coefficient, s: the scattering coefficient, R: the reflectance of a layer thick enough that no light comes through. F(R) is zero for a sample that absorbs nothing, where R = 1 [@vogt, Eqs. (11.5), (11.6)]. The second line turns it back into R. Strictly R is the absolute reflectance, which needs an integrating sphere; a DRIFTS cell collects only a fraction of it [@meunier, p. 8542].',
        tone: 'ir',
      },
      'Which one to trust depends on the question. Through a wafer, absorbance scales with the amount present, within the limits of Lambert–Beer. For adsorbates on a powder, log(1/R) is the better choice: it follows surface coverage in proportion, while Kubelka–Munk under-represents weak bands [@meunier, p. 8542]. The reason lies in the small signal. In an adsorbate experiment the reflectance is taken against the catalyst itself, R₀ = R / R(catalyst), and stays close to 1; there log(1/R₀) grows in step with the light absorbed, while F(R₀) grows with its square and starts out flat [@meunier, p. 8543].',
      {
        label: 'Weak Bands on a Powder',
        lines: ['R₀ = R / R(catalyst)   close to 1', 'log(1/R₀) ≈ (1 − R₀) / ln(10)', 'F(R₀) ≈ (1 − R₀)² / 2'],
        note: 'Near R₀ = 1 the pseudo-absorbance is linear in the light absorbed and Kubelka–Munk quadratic, so a band ten times weaker comes out a hundred times smaller in Kubelka–Munk units. What is truly proportional to coverage is the Matyshak–Krylov function, (R∞ − R)(1/R − R∞)/R∞, and log(1/R₀) follows it almost linearly, Kubelka–Munk with a flat start [@meunier, pp. 8542–8543].',
        tone: 'ir',
      },
      'The difference is not cosmetic. A band with R₀ above 90 % can vanish in Kubelka–Munk units and stand out in log(1/R₀): Meunier shows it for CO on metallic Pd particles at 1907 cm⁻¹ on Pd/CeO₂, invisible in the Kubelka–Munk spectrum [@meunier, p. 8543]. Metallic particles can be far more active than single atoms, so a band erased this way risks the activity being assigned to the wrong sites [@meunier, p. 8544]. His recommendation is to report DRIFTS spectra of adsorbates as log(1/R₀) [@meunier, p. 8544]. The reflection row of the diagram shows the weak band fading out in F(R). Whatever the choice, it changes band heights and ratios, never positions.',
      'The background matters as much as the formula, because it decides what zero means. Whatever it shares with the sample cancels: the lamp, the windows, gas in the path, the catalyst itself when the background is the catalyst before the gas goes in. Whatever differs stays. Against the fresh catalyst, a band that appears points up and one that is used up points down, so the spectrum is the change, not the surface; the bottom rows of the diagram show both. A background taken long before the sample can drift out of step with it, and the mismatch is a major source of spurious bands [@trenary, p. 54].',
      {
        label: 'Changing the Background',
        lines: ['T, R:   × I₀(old) / I₀(new)', 'A, log(1/R):   + log₁₀(I₀(new) / I₀(old))', 'F(R):   recomputed from the new R'],
        note: 'The ratios scale, the logarithms shift by a constant, and Kubelka–Munk changes shape, so no offset undoes it. The background also has to match the family: a transmission background for T and A, a reflectance reference for R and what follows from it.',
      },
      'Software can blur the families. OMNIC saves a diffuse-reflectance spectrum under the label absorbance, although what it holds is −log₁₀ R, that is log(1/R); read that way, it converts back to R and on to Kubelka–Munk.',
      'In reflection off a metal (RAIRS) the spectrum is the change in reflectivity, ΔR/R₀, positive where the adsorbate absorbs. For small changes it tracks absorbance, though Beer’s law has no firm footing for a submonolayer on a surface [@trenary, p. 54].',
      'A Raman spectrum is plotted differently on both axes. Up the side go counts, the number of scattered photons the detector registers, often per second; along the bottom goes the Raman shift, measured from the laser line rather than from zero [@moon, p. 76]. Counts depend on the laser power, the collection optics and the detector as much as on the sample, so Raman intensities are compared within one spectrum, or against an internal standard, not in absolute terms. Fluorescence adds a broad background under the lines [@stair, p. 132], and the laser line itself is cut out by a filter.',
      {
        label: 'A Raman Spectrum',
        lines: ['up:   counts (per second)', 'along:   Δν̃ = ν̃(laser) − ν̃(scattered)'],
        note: 'The shift is positive on the Stokes side, where Raman spectra are usually shown, and grows to the right, the opposite of an IR axis. The last row of the diagram draws one.',
        tone: 'raman',
      },
      'A shift, in general, is a position read from a reference rather than from zero. The Raman shift is read from the laser line. A band shift, Δν̃, is read from where the same band sits in a reference state: the free molecule, the lighter isotope, the lower coverage. It carries a sign, and a red shift, to lower wavenumber, is the usual mark of a weakened bond.',
      'The atlas stores no intensities, only a word for each band, very strong to very weak, as the sources report it; the diagrams on this page draw schematic heights from it.',
    ],
    related: [
      { key: 'units', why: 'The other axis: where a band sits' },
      { key: 'spectrum', why: 'Absorption, and the Lambert–Beer law' },
      { key: 'raman', why: 'Why Raman counts are relative' },
      { key: 'isotopologue', why: 'A band shift, read from the lighter isotope' },
      { key: 'dipole', why: 'RAIRS and the surface selection rule' },
    ],
  },
  {
    key: 'selection',
    // The most common reason a spectrum shows fewer bands than modes.
    section: 'fewer',
    label: 'Selection Rules',
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
    label: 'Group-Frequency Labels',
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
      'CH₄ keeps the same symbols, δₛ(HCH) and δₐₛ(HCH), for motions of another kind. With four equal hydrogens and no bond to the rest of a molecule there is no handle and so no umbrella: its bends are patterns in which the H–C–H angles open and close against each other. The label says which kind of bend, not which motion; the motion itself is drawn on the Vibration Modes view.',
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
    label: 'Herzberg Numbering',
    teaser:
      'ν₁, ν₂, ν₃: a molecule’s modes counted off by symmetry, then by falling wavenumber. Which mode, not what moves.',
    body: [
      'The second notation numbers a molecule’s normal modes: ν₁, ν₂, ν₃ … It names which mode, not what moves, and it means something only within one molecule. ν₃ of H₂O is its asymmetric O–H stretch; methanol has twelve modes, and its ν₈ is the C–O stretch. For small symmetric molecules, where each mode moves every atom, the number is the exact name and a group-frequency label only an approximation.',
      {
        label: 'How the modes are numbered',
        lines: ['1. by symmetry species, the totally symmetric first', '2. within a species, by falling wavenumber'],
        note: 'Herzberg’s convention, which the Vibration Modes view follows even where a cited paper numbers its figure differently.',
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
      'In the atlas the numbers stand beside each mode’s label on the Vibration Modes view, with its Mulliken label, and appear in a band name only to tell two modes of one kind apart. The band names themselves use the group-frequency form throughout, gas-phase CO₂ included, so one notation runs through the whole chart.',
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
    label: 'Band Position',
    part: 'Molecular Motion',
    what: 'ν̃ = (1/2πc)·√(k/μ): why stretches of bonds to hydrogen sit high, how bond order moves a band, back-donation on metals.',
  },
  {
    label: 'Molecules',
    part: 'A Part of Its Own',
    what: 'The Vibration Modes view as cards, one per molecule: its modes cycling on hover, opened into the viewer and a mode list that folds out into each mode’s bands.',
  },
  {
    label: 'Hydrogen Bonding',
    part: 'Bands That Move',
    what: 'Why an OH stretch shifts down and broadens when the H is shared.',
  },
  {
    label: 'Coverage and Dipole Coupling',
    part: 'Bands That Move',
    what: 'Why a CO band climbs as the surface fills.',
  },
  {
    label: 'TO/LO Splitting',
    part: 'Band Patterns',
    what: 'Why the lattice bands of a solid support split into two components.',
  },
  {
    label: 'Point Cloud',
    part: 'Spectroscopy',
    what: 'Every position the literature reports for a band, drawn as a cloud of points: how far the sources scatter, and what the window a band spans in the atlas stands for.',
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
  // Every card with written, cited text: the fundamentals, and the
  // phenomena whose explanation is written out as a body.
  const cards = [
    ...FUNDAMENTALS,
    ...PHENOMENA.flatMap(p => (p.body ? [{ key: p.key, label: p.label, body: p.body }] : [])),
  ];
  for (const f of cards) {
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

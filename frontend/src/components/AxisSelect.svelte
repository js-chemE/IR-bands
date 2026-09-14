<script lang="ts">
  /**
   * The band chart's x axis: a quantity and its unit, and two switches:
   * reverse (large values on the left, on by default for wavenumber only)
   * and shift.
   * With shift on, the axis is read from a zero, typed in a unit of its own
   * (ZeroField), in the same two-column split as the quantity and its unit.
   * The zero shows whenever shift is on, though only a wavelength shift
   * depends on it: in wavenumber and energy units the shift is the band
   * itself, whatever the zero.
   */
  import { createEventDispatcher } from 'svelte';
  import type { AxisProperty } from '../lib/types';
  import { AXES, ZERO_UNITS, ZERO_UNIT_BREAKS } from '../lib/units';
  import Dropdown from './Dropdown.svelte';
  import ZeroField from './ZeroField.svelte';

  export let axisProperty: AxisProperty;
  export let axisUnit: string;
  /** Read the axis as a shift from a zero (a laser, say). */
  export let shiftOn = false;
  /** The zero: an absolute wavenumber in cm⁻¹, or null for the default. */
  export let laserWn: number | null = null;
  /** Large values on the left. */
  export let reversed = false;

  const dispatch = createEventDispatcher<{
    axisChange: { property: AxisProperty; unit: string };
    shiftToggle: { on: boolean };
    reverseToggle: { on: boolean };
    laserChange: { wn: number | null };
  }>();

  const PROPERTIES = [
    { value: 'wavenumber', label: 'wavenumber' },
    { value: 'wavelength', label: 'wavelength' },
    { value: 'energy', label: 'energy' },
  ];

  function onPropertyChange(value: string) {
    const prop = value as AxisProperty;
    dispatch('axisChange', { property: prop, unit: AXES[prop].defaultUnit });
  }

  $: spec = AXES[axisProperty];
  $: unitOptions = spec.units.map(u => ({ value: u, label: u, sep: spec.breaks?.includes(u) }));
  // Every unit either column can show, so both keep one width throughout.
  const ALL_UNITS = [...Object.values(AXES).flatMap(a => a.units), ...ZERO_UNITS];
  const zeroUnitOptions = ZERO_UNITS.map(u => ({ value: u, label: u, sep: ZERO_UNIT_BREAKS.includes(u) }));

  // The unit the zero is typed in: a laser is usually named in nm.
  let zeroUnit = 'nm';
</script>

<section>
  <h3>X axis</h3>

  <!-- Two two-sided switches, the Spectroscopy switch's shape at the size the
       pills were: each names both of its states, because "reverse off" and
       "shift off" are directions and data in their own right rather than the
       absence of something. -->
  <div class="axis-switches">
    <div class="switch" role="radiogroup" aria-label="Axis direction">
      <span class="thumb" class:right={reversed} aria-hidden="true"></span>
      <button
        role="radio"
        aria-checked={!reversed}
        class:on={!reversed}
        title="Normal: low values on the left, the way a number line runs"
        on:click={() => reversed && dispatch('reverseToggle', { on: false })}
      >normal</button>
      <button
        role="radio"
        aria-checked={reversed}
        class:on={reversed}
        title="Inverted: high values on the left, the way an infrared spectrum is printed"
        on:click={() => !reversed && dispatch('reverseToggle', { on: true })}
      >inverted</button>
    </div>

    <!-- Any axis, read from a zero rather than from nothing. -->
    <div class="switch" role="radiogroup" aria-label="Axis datum">
      <span class="thumb" class:right={shiftOn} aria-hidden="true"></span>
      <button
        role="radio"
        aria-checked={!shiftOn}
        class:on={!shiftOn}
        title="No zero: read the axis as an absolute position"
        on:click={() => shiftOn && dispatch('shiftToggle', { on: false })}
      >absolute</button>
      <button
        role="radio"
        aria-checked={shiftOn}
        class:on={shiftOn}
        title="Read the axis as a shift from a zero, e.g. a laser line"
        on:click={() => !shiftOn && dispatch('shiftToggle', { on: true })}
      >shift</button>
    </div>
  </div>

  <div class="row">
    <div class="wide">
      <Dropdown value={axisProperty} options={PROPERTIES} label="X axis quantity" on:change={e => onPropertyChange(e.detail.value)} />
    </div>
    <div class="narrow">
      <Dropdown
        value={axisUnit}
        options={unitOptions}
        sizeTo={ALL_UNITS}
        label="X axis unit"
        on:change={e => dispatch('axisChange', { property: axisProperty, unit: e.detail.value })}
      />
    </div>
  </div>

  {#if shiftOn}
    <!-- The same split as the row above: the number where the quantity sits,
         its unit where the axis unit sits. -->
    <div class="row zero-row">
      <div class="wide">
        <ZeroField {laserWn} unit={zeroUnit} on:laserChange />
        <span class="zero-hint">zero</span>
      </div>
      <div class="narrow">
        <Dropdown
          value={zeroUnit}
          options={zeroUnitOptions}
          sizeTo={ALL_UNITS}
          label="Unit of the zero"
          on:change={e => (zeroUnit = e.detail.value)}
        />
      </div>
    </div>
  {/if}
</section>

<style>
  /* The quantity and its unit on one line, and when the shift is on, the zero
     and its own unit beneath in the same split, so the number lines up under
     the quantity it is a zero for. */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 6px;
  }
  .zero-row { margin-top: 6px; }
  .wide, .narrow { min-width: 0; }
  .zero-hint {
    display: block;
    margin: 2px 0 0 2px;
    font-size: var(--t-code-size);
    color: var(--ink-050);
  }

  /* Two switches on one row, at the size the pills were. Same track and
     sliding thumb as SpectroscopySwitch, tighter padding and the code face,
     so the row sits under the heading without competing with it. */
  .axis-switches {
    display: grid;
    gap: 4px;
    margin: 6px 0 8px;
  }
  .switch {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 2px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
  }
  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc(50% - 2px);
    border-radius: var(--radius-sm);
    background: var(--brand-700);
    transition: transform 0.2s ease;
  }
  .thumb.right { transform: translateX(100%); }
  .switch button {
    position: relative;
    padding: 2px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: var(--t-code-size);
    font-family: var(--t-code-ff);
    color: var(--ink-400);
    cursor: pointer;
    transition: color 0.2s;
    white-space: nowrap;
  }
  .switch button:hover:not(.on) { color: var(--ink-900); }
  .switch button.on { color: var(--surface); }
  .switch button:focus-visible {
    outline: 2px solid var(--brand-tint-line);
    outline-offset: -2px;
    border-radius: var(--radius-sm);
  }
</style>

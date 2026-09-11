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
  <div class="head">
    <h3>X axis</h3>
    <div class="toggles">
    <button
      class="axis-toggle"
      class:on={reversed}
      aria-pressed={reversed}
      title="Reverse the axis: large values on the left"
      on:click={() => dispatch('reverseToggle', { on: !reversed })}
    >reverse</button>
    <!-- Any axis, read from a zero rather than from nothing. -->
    <button
      class="axis-toggle shift-toggle"
      class:on={shiftOn}
      aria-pressed={shiftOn}
      title="Read the axis as a shift from a zero, e.g. a laser line"
      on:click={() => dispatch('shiftToggle', { on: !shiftOn })}
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
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-500);
  }

  /* The unit column as wide as its longest unit, the quantity the rest. */
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

  .toggles { display: flex; gap: 4px; }

  /* The reverse and shift switches: small pills, filled while on. */
  .axis-toggle {
    padding: 1px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font: inherit;
    font-size: var(--t-code-size);
    color: var(--ink-400);
    cursor: pointer;
  }
  .axis-toggle:hover { border-color: var(--ink-050); }
  .axis-toggle.on {
    background: var(--brand-700);
    border-color: var(--brand-700);
    color: var(--surface);
  }
</style>

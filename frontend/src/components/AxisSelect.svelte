<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AxisProperty } from '../lib/types';
  import { AXES } from '../lib/units';

  export let axisProperty: AxisProperty;
  export let axisUnit: string;

  const dispatch = createEventDispatcher<{
    axisChange: { property: AxisProperty; unit: string };
  }>();

  function onPropertyChange(e: Event) {
    const prop = (e.currentTarget as HTMLSelectElement).value as AxisProperty;
    const defaultUnit = AXES[prop].defaultUnit;
    dispatch('axisChange', { property: prop, unit: defaultUnit });
  }

  function onUnitChange(e: Event) {
    const unit = (e.currentTarget as HTMLSelectElement).value;
    dispatch('axisChange', { property: axisProperty, unit });
  }

  $: units = AXES[axisProperty].units;
</script>

<section>
  <h3>X axis</h3>
  <div class="row">
    <select value={axisProperty} on:change={onPropertyChange}>
      <option value="wavenumber">wavenumber</option>
      <option value="wavelength">wavelength</option>
      <option value="energy">energy</option>
    </select>
    <select value={axisUnit} on:change={onUnitChange}>
      {#each units as u (u)}
        <option value={u}>{u}</option>
      {/each}
    </select>
  </div>
</section>

<style>
  h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
  }

  .row {
    display: flex;
    gap: 6px;
  }

  select {
    flex: 1;
    padding: 4px 6px;
    font-size: 12px;
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    box-sizing: border-box;
  }

  select:hover { border-color: #A0A0A0; }
</style>

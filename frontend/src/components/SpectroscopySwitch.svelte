<script lang="ts">
  /**
   * The band chart's spectroscopy: IR or Raman, as one wide two-sided switch.
   * It decides which selection rule the chart draws: the bands the chosen
   * technique cannot see (the `ir-inactive` or `raman-inactive` tag) are
   * drawn hollow, the rest solid. Positions do not change, a
   * Raman shift being the same vibrational energy as the IR wavenumber.
   */
  import { createEventDispatcher } from 'svelte';
  import type { Spectroscopy } from '../lib/types';

  export let value: Spectroscopy = 'ir';

  const dispatch = createEventDispatcher<{ change: { value: Spectroscopy } }>();

  const SIDES: { value: Spectroscopy; label: string; title: string }[] = [
    { value: 'ir', label: 'IR', title: 'Infrared: bands need a changing dipole' },
    { value: 'raman', label: 'Raman', title: 'Raman: bands need a changing polarizability' },
  ];
</script>

<section>
  <h3>Spectroscopy</h3>
  <div class="switch" role="radiogroup" aria-label="Spectroscopy">
    <span class="thumb" class:right={value === 'raman'} aria-hidden="true"></span>
    {#each SIDES as s (s.value)}
      <button
        role="radio"
        aria-checked={value === s.value}
        class:on={value === s.value}
        title={s.title}
        on:click={() => value !== s.value && dispatch('change', { value: s.value })}
      >{s.label}</button>
    {/each}
  </div>
</section>

<style>
  /* A track with a sliding thumb under the chosen side. */
  .switch {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 3px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface-sunken);
  }
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc(50% - 3px);
    border-radius: var(--radius-sm);
    background: var(--brand-700);
    box-shadow: var(--shadow-md);
    transition: transform 0.2s ease;
  }
  .thumb.right { transform: translateX(100%); }

  .switch button {
    position: relative;
    padding: 6px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: var(--t-nav-size);
    font-weight: var(--t-label-weight);
    color: var(--ink-400);
    cursor: pointer;
    transition: color 0.2s;
  }
  .switch button:hover:not(.on) { color: var(--ink-900); }
  .switch button.on { color: var(--surface); }
  .switch button:focus-visible { outline: 2px solid var(--brand-tint-line); outline-offset: -2px; border-radius: var(--radius-sm); }
</style>

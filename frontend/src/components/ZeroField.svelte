<script lang="ts">
  /**
   * The shift's zero: a number in a unit of its own, usually a laser line.
   *
   * It behaves like the sidebar's dropdowns. Hovering shows the chevron that
   * says it opens; a click (or focus) opens a panel of common Raman lasers
   * joined to the field, each on the colour of its own light, ultraviolet and
   * infrared included (lib/lightColor.ts). Typing any other number works too.
   * Once a zero is set, the field itself takes on the colour of that light.
   *
   * The zero is kept as an absolute wavenumber (cm⁻¹), so a change of unit
   * rewrites the number rather than reinterpreting it. While typing, the
   * typed text wins; on leaving, the stored zero shows again, rounded.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { RAMAN_LASERS, DEFAULT_LASER_WN, formatLaser, unitToLaser } from '../lib/units';
  import { lightTint } from '../lib/lightColor';
  import { floatAt, type Float } from '../lib/floating';

  /** The zero, an absolute wavenumber in cm⁻¹, or null for none. */
  export let laserWn: number | null = null;
  /** The unit the number is typed in. */
  export let unit = 'nm';

  const dispatch = createEventDispatcher<{ laserChange: { wn: number | null } }>();

  let draft: string | null = null;
  let open = false;
  let wrap: HTMLDivElement;
  let menu: HTMLUListElement | null = null;
  let place: Float = { above: false, style: '' };

  $: shown = draft ?? (laserWn === null ? '' : formatLaser(laserWn, unit));
  $: placeholder = formatLaser(DEFAULT_LASER_WN, unit);
  $: color = laserWn === null ? null : lightTint(1e7 / laserWn);
  const isPicked = (nm: number) => laserWn !== null && Math.abs(1e7 / laserWn - nm) < 0.05;

  function show() {
    if (open) return;
    place = floatAt(wrap, RAMAN_LASERS.length * 32 + 8, 180);
    open = true;
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
  }
  function close() {
    open = false;
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
  }
  function onScroll(e: Event) {
    if (!menu?.contains(e.target as Node)) close();
  }

  function onInput(e: Event) {
    draft = (e.currentTarget as HTMLInputElement).value;
    const v = Number(draft);
    if (draft.trim() === '') dispatch('laserChange', { wn: null });
    else if (Number.isFinite(v) && v > 0) dispatch('laserChange', { wn: unitToLaser(v, unit) });
  }
  function pick(nm: number) {
    draft = null;
    dispatch('laserChange', { wn: 1e7 / nm });
    close();
  }
  function clear() {
    draft = null;
    dispatch('laserChange', { wn: null });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') show();
  }

  onDestroy(close);
</script>

<div
  class="zf"
  class:open
  class:above={open && place.above}
  class:lit={color !== null}
  style={color ? `--zero-bg:${color.background}; --zero-line:${color.border}; --zero-fg:${color.color}` : ''}
  bind:this={wrap}
>
  <input
    class="zf-input"
    type="number"
    step="any"
    min="0"
    aria-label="Zero of the shift, in {unit}"
    aria-haspopup="listbox"
    aria-expanded={open}
    {placeholder}
    value={shown}
    on:input={onInput}
    on:focus={show}
    on:click={show}
    on:keydown={onKey}
    on:blur={() => { close(); draft = null; }}
  />
  <!-- Over the end of the number, on a short fade of the field's colour, as
       in the dropdowns: the chevron while empty, the clear mark once set. -->
  <span class="zf-hint">
    {#if laserWn !== null}
      <button class="zf-clear" title="Clear the zero" aria-label="Clear the zero" on:mousedown|preventDefault={clear}>×</button>
    {:else}
      <svg class="zf-chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1 L5 5 L9 1" /></svg>
    {/if}
  </span>
</div>

{#if open}
  <ul class="zf-menu" class:above={place.above} role="listbox" aria-label="Common Raman lasers" style={place.style} bind:this={menu}>
    {#each RAMAN_LASERS as l (l.nm)}
      {@const c = lightTint(l.nm)}
      <!-- mousedown, so the pick lands before the field's blur closes the list. -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <li
        role="option"
        aria-selected={isPicked(l.nm)}
        class:sel={isPicked(l.nm)}
        style="background:{c.background}; border-color:{c.border}; color:{c.color}"
        on:mousedown|preventDefault={() => pick(l.nm)}
      >
        <span class="zf-val">{formatLaser(1e7 / l.nm, unit)} {unit}</span>
        <span class="zf-name">{unit === 'nm' ? '' : `${l.nm} nm, `}{l.name}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* The field: the same box as the dropdowns, the number left-aligned and
     without the browser's spin arrows. */
  .zf { position: relative; }

  .zf-input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 5px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--zero-bg, var(--surface));
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    text-align: left;
    appearance: textfield;
    -moz-appearance: textfield;
    transition: background 0.2s;
  }
  .zf-input::-webkit-outer-spin-button,
  .zf-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .zf-input::placeholder { color: var(--ink-200); }
  .zf:not(.lit) .zf-input:hover { background: var(--surface-hover); }
  .zf-input:focus { outline: none; }

  /* Set: the field washed with the colour of the light, in the same pale
     fill / mid border / dark text the tag pills use, so the sidebar stays as
     quiet as the rest of the interface. */
  .zf.lit .zf-input {
    border-color: var(--zero-line);
    color: var(--zero-fg);
    font-weight: var(--t-label-weight);
  }

  .zf { --zf-bg: var(--zero-bg, var(--surface)); }
  .zf:not(.lit):hover { --zf-bg: var(--surface-hover); }
  .zf.open:not(.lit) { --zf-bg: var(--surface); }

  .zf-hint {
    position: absolute;
    top: 1px;
    right: 1px;
    bottom: 1px;
    z-index: 1002;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 26px;
    padding-right: 6px;
    box-sizing: border-box;
    border-radius: 0 var(--radius) var(--radius) 0;
    background: linear-gradient(to right, transparent, var(--zf-bg) 45%);
    backdrop-filter: blur(1px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }
  .zf:hover .zf-hint, .zf.open .zf-hint { opacity: 1; }
  .zf-hint .zf-clear { pointer-events: auto; }

  .zf-chev {
    width: 9px;
    height: 6px;
    fill: none;
    stroke: var(--ink-200);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }
  .zf.open .zf-chev { transform: rotate(180deg); }

  .zf-clear {
    border: none;
    background: none;
    padding: 0 3px;
    font: inherit;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
  }
  .zf-clear:hover { opacity: 1; }

  /* Open: field and menu one panel, as with the dropdowns. */
  .zf.open .zf-input {
    position: relative;
    z-index: 1001;
    border-color: var(--brand-tint-line);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    box-shadow: var(--shadow-md);
  }
  .zf.open.above .zf-input { border-radius: 0 0 var(--radius) var(--radius); }

  .zf-menu {
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    margin: 0;
    padding: 3px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--brand-tint-line);
    border-top: none;
    border-radius: 0 0 var(--radius) var(--radius);
    box-shadow: var(--shadow-md);
  }
  .zf-menu.above {
    border-top: 1px solid var(--brand-tint-line);
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
  }

  /* Each laser on the colour of its light. */
  .zf-menu li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--t-nav-size);
    cursor: pointer;
    transition: filter 0.12s;
  }
  .zf-menu li:hover { filter: brightness(0.97); }
  .zf-menu li.sel { box-shadow: inset 0 0 0 2px currentColor; }
  .zf-val { font-weight: var(--t-label-weight); white-space: nowrap; }
  .zf-name { font-size: var(--t-code-size); opacity: 0.85; }
</style>

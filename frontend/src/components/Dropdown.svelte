<script lang="ts">
  /**
   * A select in the look of the sidebar's page buttons. At rest it is a plain
   * field with its value; hovering it shows a faint chevron, the hint that it
   * opens; a click opens it.
   *
   * Open, the field and its options become one panel: the same tinted border
   * runs round both, the seam between them squared off, one shadow lifting the
   * whole of it off the sidebar. The options sit on white, the chosen one in
   * the active page's tint. The menu lives in a fixed layer (lib/floating.ts),
   * so it never stretches the sidebar, and opens upwards when the room below
   * is too short. Long labels wrap rather than run out of the box.
   *
   * Keyboard: Enter, Space or the arrow keys open it; the arrows move, Enter
   * or Space picks, Escape or Tab closes. A click outside, a scroll or a
   * resize closes it too.
   */
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { floatAt, type Float } from '../lib/floating';

  export let value: string;
  /** `sep` draws a rule above an option, where a new group of them starts. */
  export let options: { value: string; label: string; title?: string; sep?: boolean }[];
  /**
   * Labels to reserve width for besides the options: the field is as wide as
   * the longest of all of them, so it does not wrap or jump when its options
   * change (the x axis unit, whose list changes with the quantity).
   */
  export let sizeTo: readonly string[] = [];
  /** Accessible name, where no visible label sits next to it. */
  export let label = '';

  const dispatch = createEventDispatcher<{ change: { value: string } }>();

  let open = false;
  let active = -1;
  let field: HTMLButtonElement;
  let menu: HTMLUListElement | null = null;
  let place: Float = { above: false, style: '' };

  $: current = options.find(o => o.value === value);

  function show() {
    place = floatAt(field, Math.min(288, options.length * 30 + 8));
    open = true;
    active = Math.max(0, options.findIndex(o => o.value === value));
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
  }
  function close() {
    open = false;
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', close);
  }
  function outside(e: PointerEvent) {
    const t = e.target as Node;
    if (!field?.contains(t) && !menu?.contains(t)) close();
  }
  // The menu is pinned to where the field was; if the page moves, let go.
  function onScroll(e: Event) {
    if (!menu?.contains(e.target as Node)) close();
  }
  function choose(v: string) {
    close();
    if (v !== value) dispatch('change', { value: v });
  }

  function onKey(e: KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % options.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + options.length) % options.length;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[active]) choose(options[active].value);
    } else if (e.key === 'Tab') {
      close();
    }
  }

  onDestroy(close);
</script>

<button
  type="button"
  class="dd-field"
  class:open
  class:above={open && place.above}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={label || undefined}
  title={current?.title}
  bind:this={field}
  on:click={() => (open ? close() : show())}
  on:keydown={onKey}
>
  <span class="dd-text">{current?.label ?? value}</span>
  <!-- Invisible, in the same grid cell: they give the field the width of its
       longest possible label. -->
  {#if sizeTo.length}{#each [...options.map(o => o.label), ...sizeTo] as l}<span class="dd-size" aria-hidden="true">{l}</span>{/each}{/if}
  <!-- The chevron lies over the text rather than beside it, on a short fade
       of the field's own colour, so it takes no width from the label. -->
  <span class="dd-hint" aria-hidden="true"><svg class="dd-chev" viewBox="0 0 10 6"><path d="M1 1 L5 5 L9 1" /></svg></span>
</button>

{#if open}
  <ul class="dd-menu" class:above={place.above} role="listbox" aria-label={label || undefined} style={place.style} bind:this={menu}>
    {#each options as o, i (o.value)}
      <!-- Picked on mousedown, before the field loses focus; the keyboard
           path is the field's own handler above. -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <li
        role="option"
        aria-selected={o.value === value}
        class:sel={o.value === value}
        class:active={i === active}
        class:sep={o.sep && i > 0}
        title={o.title}
        on:mousedown|preventDefault={() => choose(o.value)}
        on:mouseenter={() => (active = i)}
      >{o.label}</li>
    {/each}
  </ul>
{/if}

<style>
  /* The field: one of the sidebar's page buttons. */
  .dd-field {
    --dd-bg: var(--surface);
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 5px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--dd-bg);
    font: inherit;
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    text-align: left;
    cursor: pointer;
  }
  .dd-field:hover { --dd-bg: var(--surface-hover); }
  .dd-field:focus-visible { outline: none; border-color: var(--brand-tint-line); }

  /* Long labels wrap inside the box, only when the box itself is too narrow. */
  .dd-text, .dd-size { grid-area: 1 / 1; overflow-wrap: anywhere; }
  .dd-size { height: 0; overflow: hidden; visibility: hidden; white-space: nowrap; }

  /* The hint that it opens: there on hover, focus and while open, over the
     end of the text on a short fade of the field's colour, slightly blurred. */
  .dd-hint {
    position: absolute;
    top: 1px;
    right: 1px;
    bottom: 1px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 26px;
    padding-right: 8px;
    box-sizing: border-box;
    border-radius: 0 var(--radius) var(--radius) 0;
    background: linear-gradient(to right, transparent, var(--dd-bg) 45%);
    backdrop-filter: blur(1px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }
  .dd-field:hover .dd-hint, .dd-field:focus-visible .dd-hint, .dd-field.open .dd-hint { opacity: 1; }
  .dd-chev {
    width: 9px;
    height: 6px;
    fill: none;
    stroke: var(--ink-200);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.15s;
  }
  .dd-field.open .dd-chev { transform: rotate(180deg); }

  /* Open: field and menu one panel, in the active page's tinted border. */
  .dd-field.open {
    --dd-bg: var(--surface);
    z-index: 1001;
    border-color: var(--brand-tint-line);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    box-shadow: var(--shadow-md);
  }
  .dd-field.open.above {
    border-radius: 0 0 var(--radius) var(--radius);
  }

  .dd-menu {
    position: fixed;
    z-index: 1000;
    max-height: 18rem;
    overflow-y: auto;
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
  /* Opening upwards, the seam is at the bottom instead. */
  .dd-menu.above {
    border-top: 1px solid var(--brand-tint-line);
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
  }

  .dd-menu li {
    padding: 5px 7px;
    border-radius: var(--radius-sm);
    font-size: var(--t-nav-size);
    color: var(--t-nav-color);
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .dd-menu li.active { background: var(--surface-hover); }
  /* A new group: a hairline across the gap above it. */
  .dd-menu li.sep { position: relative; margin-top: 7px; }
  .dd-menu li.sep::before {
    content: '';
    position: absolute;
    top: -4px;
    left: 4px;
    right: 4px;
    border-top: 1px solid var(--line);
  }
  /* The chosen option: the active page's colours. */
  .dd-menu li.sel {
    background: var(--brand-tint);
    color: var(--brand-accent);
    font-weight: var(--t-label-weight);
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { VibrationMode, RefMap } from '../../lib/types';
  import { ieeeHtml } from '../../lib/citations';
  import { ATOMS_PALETTE } from '../../lib/colors';
  import { TAG_STYLES, DEFAULT_TAG_STYLE } from '../../lib/chart';

  const GREY = '#7F7F7F';

  export let modes: VibrationMode[];
  export let selectedModeId: string;
  export let refs: RefMap;
  export let bandCounts: Record<string, number>;

  const dispatch = createEventDispatcher<{
    select: { id: string };
    preview: { id: string | null };
    navigateRef: { key: string };
    navigateMode: { category: string; subtype: string | null };
  }>();
</script>

<div class="mode-list">
  {#each modes as m (m.id)}
    {@const count = bandCounts[m.id] ?? 0}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="mode-row"
      class:active={m.id === selectedModeId}
      on:mouseenter={() => dispatch('preview', { id: m.id })}
      on:mouseleave={() => dispatch('preview', { id: null })}
    >
      <button
        class="mode-title"
        on:click={() => dispatch('select', { id: m.id })}
        on:focus={() => dispatch('preview', { id: m.id })}
        on:blur={() => dispatch('preview', { id: null })}
      >
        <span>{m.label}</span>
        <span class="badges">
          {#if m.ir_active !== null}
            <span class="activity-badge" class:inactive={!m.ir_active}>
              {m.ir_active ? 'IR-active' : 'IR-inactive'}
            </span>
          {/if}
          {#if m.raman_active !== null}
            <span class="activity-badge" class:inactive={!m.raman_active}>
              {m.raman_active ? 'Raman-active' : 'Raman-inactive'}
            </span>
          {/if}
        </span>
      </button>

      <span class="chips">
        {#if m.atoms}
          <span class="chip atoms-chip" style="background:{ATOMS_PALETTE[m.atoms] ?? GREY}">{m.atoms}</span>
        {/if}
        {#each m.tags as tag (tag)}
          {@const style = TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE}
          <span class="chip tag-chip" style="background:{style.background}; border-color:{style.border}; color:{style.color}">{tag}</span>
        {/each}
      </span>

      {#if m.note}
        <p class="summary">{m.note}</p>
      {/if}

      <button
        class="band-link"
        disabled={count === 0}
        on:click={() => dispatch('navigateMode', { category: m.category, subtype: m.subtype })}
      >View {count} band{count !== 1 ? 's' : ''} in chart →</button>

      {#if m.reference.length > 0 && refs}
        <ul class="refs">
          {#each m.reference as key (key)}
            <li>
              <button class="ref-btn" on:click={() => dispatch('navigateRef', { key })}>
                {@html ieeeHtml(refs[key] ?? {}, key)}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</div>

<style>
  .mode-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 280px;
  }

  .mode-row {
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .mode-row:hover { background: #F7F8FA; }

  .mode-row.active {
    background: #EEF3FF;
    border-color: #C8D6F0;
  }

  .mode-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: #222;
    cursor: pointer;
    text-align: left;
  }

  .badges {
    display: flex;
    gap: 5px;
    margin-left: 8px;
  }

  .activity-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    background: #E6F4EA;
    color: #1E7B34;
    white-space: nowrap;
  }

  .activity-badge.inactive {
    background: #F1F1F1;
    color: #888;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 5px;
  }

  .chip {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 9px;
    white-space: nowrap;
  }

  .atoms-chip {
    color: #fff;
    font-weight: 700;
  }

  .tag-chip {
    border: 1px solid;
    font-weight: 500;
  }

  .summary {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: #666;
    line-height: 1.5;
  }

  .band-link {
    margin-top: 6px;
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    color: #1a3a8f;
    cursor: pointer;
    text-align: left;
  }

  .band-link:hover { text-decoration: underline; }
  .band-link:disabled { color: #B0B0B0; cursor: default; text-decoration: none; }

  .refs {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ref-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 11.5px;
    color: #555;
    cursor: pointer;
    text-align: left;
    line-height: 1.4;
  }

  .ref-btn:hover { color: #1a3a8f; text-decoration: underline; }
</style>

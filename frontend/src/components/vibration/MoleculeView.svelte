<script lang="ts">
  // Picks the viewer: the computed 3D one (MoleculeViewer3D) wherever
  // docs/data/molecules3d.json has this molecule and topology, the
  // hand-drawn MoleculeViewer everywhere else (the surface species for now).
  // Callers pass both kinds of input; whichever viewer is not used ignores
  // its half.
  import type { MoleculeGeometry, ModeVector } from '../../lib/moleculeGeometry';
  import { molecules3d, model3dFor } from '../../lib/molecule3d';
  import MoleculeViewer from './MoleculeViewer.svelte';
  import MoleculeViewer3D from './MoleculeViewer3D.svelte';

  export let geometry: MoleculeGeometry | null;
  export let activeVectors: ModeVector[] | null = null;
  export let moleculeId: string | undefined = undefined;
  export let topologyId: string | undefined = undefined;
  /** The mode being animated, or null at rest. */
  export let modeId: string | null = null;
  export let size = 180;
  export let interactive = false;

  const data = molecules3d();
  $: model = model3dFor($data, moleculeId, topologyId);
</script>

{#if $data === undefined && moleculeId}
  <!-- Still loading: hold the space, so the old drawing does not flash first. -->
  <svg class="placeholder" viewBox="-50 -52 100 104" style="width:{size}px; height:{size * 1.04}px;" aria-hidden="true" />
{:else if model}
  <MoleculeViewer3D {model} {modeId} {size} {interactive} depthCue={$data?.depth_cue ?? 0.2} />
{:else if geometry}
  <MoleculeViewer {geometry} {activeVectors} {size} />
{/if}

<style>
  .placeholder { flex: 0 0 auto; }
</style>

/**
 * A band's `vibration_modes` ids, resolved to the modes themselves and to the
 * geometry each one is drawn with.
 *
 * It lives here rather than in the chart because two things now render those
 * diagrams: the tooltip the chart floats on hover, and the card the sidebar
 * docks on a click. Both ask the same question of the same table, so it is
 * asked in one place.
 */
import type { Vibrations, VibrationMode } from './types';
import { geometryFor, type MoleculeGeometry } from './moleculeGeometry';

export interface LinkedMode {
  mode: VibrationMode;
  geometry: MoleculeGeometry | null;
  moleculeId: string;
  topologyId: string;
}

/**
 * The mode with that id, or null where nothing matches.
 *
 * A mode names its own topology when it is topology-specific (CO bound to one
 * atom bends differently from CO bridging two); otherwise the molecule's first
 * topology is the only one it has, and is the right one to draw.
 */
export function resolveMode(vibrations: Vibrations, modeId: string): LinkedMode | null {
  for (const molecule of vibrations.molecules) {
    const mode = molecule.modes.find(m => m.id === modeId);
    if (!mode) continue;
    const topologyId = mode.topology ?? molecule.topologies[0]?.id ?? '';
    return {
      mode,
      geometry: topologyId ? geometryFor(molecule.id, topologyId) : null,
      moleculeId: molecule.id,
      topologyId,
    };
  }
  return null;
}

/** Every mode a band documents, in the order the band lists them. */
export function linkedModesFor(vibrations: Vibrations, modeIds: string[]): LinkedMode[] {
  return modeIds
    .map(id => resolveMode(vibrations, id))
    .filter((m): m is LinkedMode => m !== null);
}

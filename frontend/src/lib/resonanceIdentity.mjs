import { componentActivityView } from './componentActivity.mjs';

export const RESONANCE_GLOW_BOOST = 96;
export const RESONANCE_BREATH_SECONDS = 8;
export const IDLE_RESONANCE = Object.freeze({ mode: 'metallic', activeIds: [], label: 'HARRY is ready', uncertain: false });
const BUSY_PHASES = new Set(['preparing', 'uploading', 'analysing']);
const UNKNOWN_STATES = new Set(['recovery_timeout', 'recovery_unavailable', 'unobserved']);

/** Presentation only. Never decides scan entitlement, charging or scoring. */
export function resonanceIdentity(progress = {}) {
  if (UNKNOWN_STATES.has(progress.serverState)) {
    return { mode: 'spectrum', activeIds: [], uncertain: true, label: 'Scan status unavailable — check your evidence records' };
  }
  const view = componentActivityView(progress);
  const terminal = ['completed', 'complete', 'failed', 'error', 'cancelled'].includes(progress.serverState);
  const busy = BUSY_PHASES.has(progress.phase) && !terminal;
  return {
    mode: busy ? 'spectrum' : 'metallic',
    activeIds: busy ? view.active.map(row => row.id) : [],
    label: ['completed', 'complete'].includes(progress.serverState) ? 'Analysis complete'
      : ['failed', 'error', 'cancelled'].includes(progress.serverState) ? 'Scan interrupted' : view.label,
    uncertain: false,
  };
}

export function unobservedResonance(progress = {}) {
  return BUSY_PHASES.has(progress.phase) && !['completed', 'complete', 'failed', 'error', 'cancelled'].includes(progress.serverState)
    ? { ...progress, serverState: 'unobserved', componentActivity: null, componentTelemetryAvailable: false }
    : progress;
}

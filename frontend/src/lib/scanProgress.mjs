export const SCAN_PHASE = Object.freeze({
  IDLE: "idle",
  PREPARING: "preparing",
  UPLOADING: "uploading",
  ANALYSING: "analysing",
  COMPLETE: "complete",
  ERROR: "error",
});

export const SCAN_STAGE_ORDER = Object.freeze([
  Object.freeze({ id: "prepare", number: "01", label: "Prepare" }),
  Object.freeze({ id: "upload", number: "02", label: "Upload" }),
  Object.freeze({ id: "analyse", number: "03", label: "Analyse" }),
  Object.freeze({ id: "record", number: "04", label: "Record" }),
]);

export const INITIAL_SCAN_PROGRESS = Object.freeze({
  phase: SCAN_PHASE.IDLE,
  uploadPercent: 0,
  serverProgressPercent: null,
  serverStage: null,
  serverState: null,
  errorMessage: null,
  failedAt: null,
});

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(value)));

export function uploadPercentFromEvent(event = {}) {
  if (Number.isFinite(event.progress)) {
    return clampPercent(event.progress * 100);
  }

  if (Number.isFinite(event.loaded) && Number.isFinite(event.total) && event.total > 0) {
    return clampPercent((event.loaded / event.total) * 100);
  }

  return null;
}

export function uploadCompletedByEvent(event = {}) {
  if (Number.isFinite(event.progress)) return event.progress >= 1;
  return Number.isFinite(event.loaded)
    && Number.isFinite(event.total)
    && event.total > 0
    && event.loaded >= event.total;
}

function stageForPhase(phase) {
  if (phase === SCAN_PHASE.PREPARING) return "prepare";
  if (phase === SCAN_PHASE.UPLOADING) return "upload";
  if (phase === SCAN_PHASE.ANALYSING) return "analyse";
  if (phase === SCAN_PHASE.COMPLETE) return "record";
  return null;
}

function readableStage(stage) {
  if (typeof stage !== "string" || !stage.trim()) return "the current analysis stage";
  return stage.trim().replace(/[_-]+/g, " ").toLowerCase();
}

export function scanProgressReducer(state = INITIAL_SCAN_PROGRESS, action = {}) {
  switch (action.type) {
    case "BEGIN":
      return {
        phase: SCAN_PHASE.PREPARING,
        uploadPercent: 0,
        serverProgressPercent: null,
        serverStage: null,
        serverState: null,
        errorMessage: null,
        failedAt: null,
      };

    case "UPLOAD_PROGRESS": {
      if ([SCAN_PHASE.ANALYSING, SCAN_PHASE.COMPLETE, SCAN_PHASE.ERROR].includes(state.phase)) return state;

      const reportedPercent = uploadPercentFromEvent(action.event);
      if (reportedPercent == null) return state;

      const uploadComplete = uploadCompletedByEvent(action.event);
      const uploadPercent = uploadComplete
        ? 100
        : Math.min(99, Math.max(state.uploadPercent, reportedPercent));
      return {
        ...state,
        phase: uploadComplete ? SCAN_PHASE.ANALYSING : SCAN_PHASE.UPLOADING,
        uploadPercent,
      };
    }

    case "ANALYSIS_STARTED":
      return { ...state, phase: SCAN_PHASE.ANALYSING, uploadPercent: 100 };

    case "SERVER_PROGRESS": {
      const reportedPercent = Number.isFinite(action.progressPercent)
        ? clampPercent(action.progressPercent)
        : null;
      const previousPercent = Number.isFinite(state.serverProgressPercent)
        ? state.serverProgressPercent
        : 0;

      return {
        ...state,
        phase: SCAN_PHASE.ANALYSING,
        uploadPercent: 100,
        serverProgressPercent: reportedPercent == null
          ? state.serverProgressPercent
          : Math.max(previousPercent, reportedPercent),
        serverStage: action.stage ?? state.serverStage,
        serverState: action.state ?? state.serverState,
      };
    }

    case "COMPLETE":
      return {
        ...state,
        phase: SCAN_PHASE.COMPLETE,
        uploadPercent: 100,
        serverProgressPercent: Number.isFinite(state.serverProgressPercent) ? 100 : null,
        serverState: action.state ?? state.serverState ?? "complete",
      };

    case "FAIL":
      return {
        ...state,
        phase: SCAN_PHASE.ERROR,
        errorMessage: action.message || "The evidence screen stopped before a result was stored.",
        failedAt: state.phase,
        serverState: action.state ?? state.serverState ?? "error",
      };

    case "RESET":
      return INITIAL_SCAN_PROGRESS;

    default:
      return state;
  }
}

export function getScanProgressView(progress = INITIAL_SCAN_PROGRESS) {
  const uploadPercent = clampPercent(progress.uploadPercent || 0);
  const hasServerPercent = Number.isFinite(progress.serverProgressPercent);
  const serverPercent = hasServerPercent ? clampPercent(progress.serverProgressPercent) : null;

  switch (progress.phase) {
    case SCAN_PHASE.PREPARING:
      return {
        statusLabel: "Preparing secure transfer",
        headline: "Evidence package preparing",
        detail: "Your selected material is being packaged on this device before secure upload begins.",
        counter: "0%",
        counterLabel: "secure upload",
        meterLabel: "Preparing evidence package",
        meterValueText: "Preparing evidence package; upload has not started",
        activeStage: "prepare",
        isActive: true,
        announcement: "Preparing the evidence package for secure upload.",
        announcementKey: SCAN_PHASE.PREPARING,
        serverPercent: null,
      };

    case SCAN_PHASE.UPLOADING:
      return {
        statusLabel: "Secure transfer",
        headline: "Uploading private evidence",
        detail: "Your browser is securely transferring the selected evidence package to SONIC CHECK.",
        counter: `${uploadPercent}%`,
        counterLabel: "secure upload",
        meterLabel: `Secure upload ${uploadPercent}%`,
        meterValueText: `Secure upload ${uploadPercent}% complete`,
        activeStage: "upload",
        isActive: true,
        announcement: "Secure evidence upload started.",
        announcementKey: SCAN_PHASE.UPLOADING,
        serverPercent: null,
      };

    case SCAN_PHASE.ANALYSING:
      return {
        statusLabel: hasServerPercent ? "Server pipeline underway" : "Server analysis underway",
        headline: hasServerPercent ? "Evidence pipeline in progress" : "Evidence channels in analysis",
        detail: hasServerPercent
          ? `The server reports ${readableStage(progress.serverStage)}; ${serverPercent}% of the defined pipeline milestones are complete.`
          : "Secure upload is complete. The server is validating and analysing your submission; it returns a finished result rather than a synthetic analysis percentage.",
        counter: hasServerPercent ? `${serverPercent}%` : "100%",
        counterLabel: hasServerPercent ? "pipeline milestones" : "upload complete",
        meterLabel: "Secure upload complete",
        meterValueText: "Secure upload complete; server analysis is active without a reported percentage",
        activeStage: "analyse",
        isActive: true,
        announcement: hasServerPercent
          ? `Server analysis milestone: ${readableStage(progress.serverStage)}.`
          : "Secure upload complete. Server analysis started without a reported percentage.",
        announcementKey: `${SCAN_PHASE.ANALYSING}:${progress.serverStage || "unreported"}`,
        serverPercent,
      };

    case SCAN_PHASE.COMPLETE:
      return {
        statusLabel: "Evidence ready",
        headline: "Evidence record created",
        detail: "The completed result is ready for review.",
        counter: "100%",
        counterLabel: "record stored",
        meterLabel: "Evidence record ready",
        meterValueText: "Secure upload and server analysis complete",
        activeStage: "record",
        isActive: false,
        announcement: "Evidence analysis complete. The evidence record is ready.",
        announcementKey: SCAN_PHASE.COMPLETE,
        serverPercent: hasServerPercent ? 100 : null,
      };

    case SCAN_PHASE.ERROR:
      return {
        statusLabel: "Screen interrupted",
        headline: "Evidence screen stopped",
        detail: "No completed result was stored. Review the error shown with the form, then try the evidence screen again.",
        counter: "STOP",
        counterLabel: uploadPercent >= 100 ? "upload complete" : "transfer stopped",
        meterLabel: uploadPercent >= 100 ? "Secure upload complete" : `Secure upload stopped at ${uploadPercent}%`,
        meterValueText: uploadPercent >= 100
          ? "Secure upload complete; server processing stopped before a result was returned"
          : `Secure upload stopped at ${uploadPercent}%`,
        activeStage: stageForPhase(progress.failedAt),
        isActive: false,
        announcement: `Evidence screen stopped. ${progress.errorMessage || "No completed result was stored."}`,
        announcementKey: SCAN_PHASE.ERROR,
        serverPercent,
      };

    default:
      return {
        statusLabel: "Analyzer ready",
        headline: "Awaiting private evidence",
        detail: "Choose audio, lyrics or both. Your material remains on this device until you start the evidence screen.",
        counter: "READY",
        counterLabel: "secure session",
        meterLabel: "Secure upload has not started",
        meterValueText: "Secure upload has not started",
        activeStage: null,
        isActive: false,
        announcement: "Analyzer ready for private evidence.",
        announcementKey: SCAN_PHASE.IDLE,
        serverPercent: null,
      };
  }
}

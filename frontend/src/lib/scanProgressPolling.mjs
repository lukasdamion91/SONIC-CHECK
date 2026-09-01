export const SCAN_PROGRESS_SCHEMA = "soniccheck-scan-progress/1.0.0";
export const SCAN_PROGRESS_BASIS = "completed_pipeline_milestones";
export const SCAN_POST_PENDING_TIMEOUT_MS = 10 * 60_000;
export const SCAN_POST_RECOVERY_TIMEOUT_MS = 120_000;
export const SCAN_RECONCILIATION_RETRY_MS = 3_000;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROGRESS_STATES = new Set(["processing", "completed", "failed"]);
const MILESTONE_PERCENT = Object.freeze({
  accepted: 0,
  validation_complete: 12,
  evidence_channels_complete: 25,
  candidate_refinement_complete: 38,
  result_assembly_complete: 50,
  storage_handling_complete: 62,
  persistence_complete: 75,
  entitlement_complete: 88,
  completed: 100,
});

export function createScanProgressId(cryptoApi = globalThis.crypto) {
  if (!cryptoApi) return null;
  if (typeof cryptoApi.randomUUID === "function") {
    try {
      const value = cryptoApi.randomUUID();
      if (UUID_V4.test(value)) return value.toLowerCase();
    } catch {
      // Continue to the standards-based getRandomValues fallback.
    }
  }
  if (typeof cryptoApi.getRandomValues !== "function") return null;

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function parseScanProgressResponse(data, expectedProgressId) {
  if (!data || typeof data !== "object") return null;
  if (data.schema_version !== SCAN_PROGRESS_SCHEMA) return null;
  if (!UUID_V4.test(data.progress_id || "")) return null;
  if (expectedProgressId && data.progress_id.toLowerCase() !== expectedProgressId.toLowerCase()) return null;
  if (!PROGRESS_STATES.has(data.state)) return null;
  if (data.progress_basis !== SCAN_PROGRESS_BASIS) return null;
  if (!Number.isFinite(data.progress_percent) || data.progress_percent < 0 || data.progress_percent > 100) return null;
  if (typeof data.stage !== "string" || !data.stage.trim()) return null;
  if (!Number.isInteger(data.completed_steps) || !Number.isInteger(data.total_steps)) return null;
  if (data.total_steps <= 0 || data.completed_steps < 0 || data.completed_steps > data.total_steps) return null;
  if (data.state === "failed") {
    if (data.stage !== "failed" || data.scan_id != null) return null;
  } else {
    if (MILESTONE_PERCENT[data.stage] !== data.progress_percent) return null;
    if (data.state === "completed" && (data.stage !== "completed" || typeof data.scan_id !== "string" || !data.scan_id)) return null;
    if (data.state === "processing" && (data.stage === "completed" || data.scan_id != null)) return null;
  }

  return {
    progressId: data.progress_id.toLowerCase(),
    state: data.state,
    stage: data.stage,
    progressPercent: Math.round(data.progress_percent),
    completedSteps: Number.isFinite(data.completed_steps) ? data.completed_steps : null,
    totalSteps: Number.isFinite(data.total_steps) ? data.total_steps : null,
    scanId: typeof data.scan_id === "string" ? data.scan_id : null,
    errorCode: typeof data.error_code === "string" ? data.error_code : null,
    retryAfterMs: normaliseRetryDelay(data.retry_after_ms),
  };
}

export function normaliseRetryDelay(value) {
  if (!Number.isFinite(value)) return 1_000;
  return Math.min(3_000, Math.max(750, Math.round(value)));
}

/**
 * Optional progress telemetry may degrade without deciding the authoritative
 * POST outcome. Always return a bounded retry; callers retain the same
 * owner-scoped reconciliation state until its independent deadline settles.
 */
export function scanPollFailureDecision({
  status,
  uploadComplete = false,
  notFoundAttempts = 0,
  unavailableAttempts = 0,
  transportAttempts = 0,
  retryAfterSeconds,
}) {
  const next = { notFoundAttempts, unavailableAttempts, transportAttempts };
  if (status === 404 && (!uploadComplete || notFoundAttempts < 4)) {
    if (uploadComplete) next.notFoundAttempts += 1;
    return { ...next, retryAfterMs: 1_000 };
  }
  if (status === 503 && unavailableAttempts < 4) {
    next.unavailableAttempts += 1;
    const retryAfter = Number(retryAfterSeconds);
    return {
      ...next,
      retryAfterMs: Number.isFinite(retryAfter)
        ? Math.min(3_000, Math.max(750, retryAfter * 1_000))
        : 1_000,
    };
  }
  if (!status && transportAttempts < 4) {
    next.transportAttempts += 1;
    return { ...next, retryAfterMs: 1_000 };
  }
  return { ...next, retryAfterMs: SCAN_RECONCILIATION_RETRY_MS };
}

export function shouldRecoverLostScanResponse({ progressId, activeProgressId, requestError }) {
  if (!UUID_V4.test(progressId || "") || !UUID_V4.test(activeProgressId || "")) return false;
  if (progressId.toLowerCase() !== activeProgressId.toLowerCase()) return false;
  if (requestError?.response != null) return false;
  if (requestError?.code === "ERR_CANCELED" || requestError?.name === "CanceledError") return false;
  return true;
}

/**
 * Bound the unresolved POST phase, then preserve one owner-scoped durable
 * reconciliation window for response loss, an explicit stop-waiting action,
 * or the whole-operation deadline.
 */
export function createScanPostRecovery({
  progressId,
  onCompleted,
  onFailed,
  onRecoveryStarted = () => undefined,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
  timeoutMs = SCAN_POST_RECOVERY_TIMEOUT_MS,
  pendingTimeoutMs = SCAN_POST_PENDING_TIMEOUT_MS,
}) {
  let awaitingRecovery = false;
  let settled = false;
  let pendingDeadline = null;
  let recoveryDeadline = null;

  const clearPendingDeadline = () => {
    if (pendingDeadline != null) clearTimer(pendingDeadline);
    pendingDeadline = null;
  };
  const clearRecoveryDeadline = () => {
    if (recoveryDeadline != null) clearTimer(recoveryDeadline);
    recoveryDeadline = null;
  };
  const clearDeadlines = () => {
    clearPendingDeadline();
    clearRecoveryDeadline();
  };
  const fail = (message, state) => {
    if (settled) return false;
    settled = true;
    clearDeadlines();
    onFailed(message, state);
    return true;
  };
  const beginRecovery = (reason) => {
    if (settled || awaitingRecovery) return false;
    awaitingRecovery = true;
    clearPendingDeadline();
    recoveryDeadline = setTimer(() => {
      fail(
        "The server did not confirm whether this submission produced a stored evidence record within the reconciliation window. Do not immediately retry; check your dashboard first.",
        "recovery_timeout",
      );
    }, timeoutMs);
    onRecoveryStarted(reason);
    return true;
  };

  if (UUID_V4.test(progressId || "")) {
    pendingDeadline = setTimer(() => {
      pendingDeadline = null;
      beginRecovery("pending_timeout");
    }, pendingTimeoutMs);
  }

  return {
    start(requestError, activeProgressId, reason = "response_lost") {
      if (settled || awaitingRecovery || !shouldRecoverLostScanResponse({
        progressId,
        activeProgressId,
        requestError,
      })) return false;
      return beginRecovery(reason);
    },
    handleProgress(report, failureMessage) {
      if (!awaitingRecovery || settled) return false;
      if (report?.state === "completed" && report.scanId) {
        settled = true;
        clearDeadlines();
        onCompleted(report.scanId);
        return true;
      }
      if (report?.state === "failed") {
        return fail(
          failureMessage || "The server stopped this evidence screen before a result was stored.",
          report.state,
        );
      }
      return false;
    },
    cancel() {
      settled = true;
      clearDeadlines();
    },
    get awaitingRecovery() {
      return awaitingRecovery && !settled;
    },
    get pendingPost() {
      return !settled && !awaitingRecovery;
    },
  };
}

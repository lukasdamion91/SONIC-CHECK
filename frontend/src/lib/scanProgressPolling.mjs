export const SCAN_PROGRESS_SCHEMA = "soniccheck-scan-progress/1.0.0";
export const SCAN_PROGRESS_BASIS = "completed_pipeline_milestones";

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

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import {
  ANALYZER_API_RELEASE_COMMIT,
  ANALYZER_API_RUNTIME_PROJECTION,
} from "../src/constants/analyzerIdentity.mjs";
import { probeApiReleaseWithRetry, probeDeploymentWithRetry } from "./probe-deployment.mjs";

// This recovery pairing is deliberately fixed. Updating the normal release
// binding must not silently authorise a different API for the retained build.
export const V90_RECOVERY_API_COMMIT = "cf0a8eaac9e2cb130ee65c09ccf4891b5c22db40";
export const RETAINED_RECOVERY_WEB_COMMIT = "b181bff20360ae0d8c2d56ad2d88636fc6d6f3d6";
export const V90_RECOVERY_PROJECTION = Object.freeze({
  application_manifest_sha256: "4ab8c2cf93cca70a6c31f35bd149ac5940a5e400ea556e44f9c0e9a70e20a0f2",
  application_files_checked: 109,
  application_bytes_scanned: 3471929,
});
export const RECOVERY_REQUEST_TIMEOUT_MS = 10_000;
export const RECOVERY_AFTER_TIMEOUT_MS = 330_000;

export function recoveryFetcher(fetcher, signal, timeoutMs = RECOVERY_REQUEST_TIMEOUT_MS) {
  return (url, options = {}) => fetcher(url, {
    ...options,
    // Native fetch keeps this signal attached while response bodies are read.
    signal: AbortSignal.any([
      signal,
      options.signal,
      AbortSignal.timeout(timeoutMs),
    ].filter(Boolean)),
  });
}

export function isReviewedV90Binding(commit, projection) {
  return commit === V90_RECOVERY_API_COMMIT
    && projection !== null && typeof projection === "object" && !Array.isArray(projection)
    && Object.keys(projection).length === Object.keys(V90_RECOVERY_PROJECTION).length
    && Object.entries(V90_RECOVERY_PROJECTION).every(([key, value]) => projection[key] === value);
}

export async function verifyV90Recovery({
  afterRestore = false,
  commit = ANALYZER_API_RELEASE_COMMIT,
  projection = ANALYZER_API_RUNTIME_PROJECTION,
  apiProbe = probeApiReleaseWithRetry,
  webProbe = probeDeploymentWithRetry,
  fetcher = fetch,
  timeoutMs = afterRestore ? RECOVERY_AFTER_TIMEOUT_MS : 30_000,
  requestTimeoutMs = RECOVERY_REQUEST_TIMEOUT_MS,
} = {}) {
  if (![timeoutMs, requestTimeoutMs].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("Recovery timeouts must be positive integers");
  }
  const receipt = {
    schema_version: "soniccheck-v90-frontend-recovery/1.0.0",
    phase: afterRestore ? "AFTER_FRONTEND_RESTORE" : "VERIFY_V90_PAIRING",
    expected_api_commit: V90_RECOVERY_API_COMMIT,
    retained_web_commit: RETAINED_RECOVERY_WEB_COMMIT,
    ok: false,
    binding_ok: isReviewedV90Binding(commit, projection),
    api: null,
    web: null,
    failure: null,
    check_timeout_ms: timeoutMs,
    request_timeout_ms: requestTimeoutMs,
    beta_catalogue_verification: "SEPARATE_REQUIRED_WORKFLOW_STEP",
    authenticated_scan_acceptance_claimed: false,
    scientific_acceptance_claimed: false,
  };
  if (!receipt.binding_ok) return receipt;

  const controller = new AbortController();
  const request = recoveryFetcher(fetcher, controller.signal, requestTimeoutMs);
  let timer;
  const deadline = new Promise((resolveDeadline) => {
    timer = setTimeout(() => {
      controller.abort();
      resolveDeadline({ ...receipt, ok: false, failure: "RECOVERY_CHECK_TIMEOUT" });
    }, timeoutMs);
  });
  const checks = async () => {
    // These are public reads, with no audio or account credentials. The beta
    // catalogue verifier remains a separate required workflow command.
    const api = await apiProbe({ attempts: 1, intervalMs: 0, fetcher: request });
    if (controller.signal.aborted) return { ...receipt, failure: "RECOVERY_CHECK_TIMEOUT" };
    receipt.api = api;
    if (api.ok !== true) return { ...receipt, failure: "API_GATE_FAILED" };
    if (afterRestore) {
      const web = await webProbe({
        expectedCommit: RETAINED_RECOVERY_WEB_COMMIT,
        attempts: 20,
        intervalMs: 5000,
        fetcher: request,
        sleeper: (delay) => sleep(delay, undefined, { signal: controller.signal }),
      });
      if (controller.signal.aborted) return { ...receipt, failure: "RECOVERY_CHECK_TIMEOUT" };
      receipt.web = web;
      if (web.ok !== true) return { ...receipt, failure: "WEB_GATE_FAILED" };
    }
    return { ...receipt, ok: true };
  };
  try {
    return await Promise.race([
      checks().catch(() => ({ ...receipt, ok: false, failure: "RECOVERY_CHECK_ERROR" })),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const allowed = new Set(["--after-restore"]);
  if (process.argv.slice(2).some((arg) => !allowed.has(arg))) {
    throw new Error("Unsupported recovery argument");
  }
  const result = await verifyV90Recovery({ afterRestore: process.argv.includes("--after-restore") });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getScanProgressView,
  INITIAL_SCAN_PROGRESS,
  SCAN_PHASE,
  scanProgressReducer,
  uploadPercentFromEvent,
} from "../src/lib/scanProgress.mjs";
import {
  createScanPostRecovery,
  createScanProgressId,
  normaliseRetryDelay,
  parseScanProgressResponse,
  scanPollFailureDecision,
  SCAN_POST_PENDING_TIMEOUT_MS,
  shouldRecoverLostScanResponse,
} from "../src/lib/scanProgressPolling.mjs";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

function controlledTimers() {
  let nextId = 1;
  const scheduled = new Map();
  const cleared = new Set();
  return {
    scheduled,
    cleared,
    setTimer(callback, delay) {
      const id = nextId;
      nextId += 1;
      scheduled.set(id, { callback, delay });
      return id;
    },
    clearTimer(id) {
      cleared.add(id);
      scheduled.delete(id);
    },
    fire(id) {
      const timer = scheduled.get(id);
      assert.ok(timer, `timer ${id} must be pending`);
      scheduled.delete(id);
      timer.callback();
    },
  };
}

test("upload telemetry converts browser byte progress into a bounded percentage", () => {
  assert.equal(uploadPercentFromEvent({ loaded: 1, total: 4 }), 25);
  assert.equal(uploadPercentFromEvent({ progress: 0.646 }), 65);
  assert.equal(uploadPercentFromEvent({ progress: 1.4 }), 100);
  assert.equal(uploadPercentFromEvent({ loaded: 4 }), null);
});

test("scan progress is monotonic and separates upload from server analysis", () => {
  let state = scanProgressReducer(INITIAL_SCAN_PROGRESS, { type: "BEGIN" });
  assert.equal(state.phase, SCAN_PHASE.PREPARING);
  assert.equal(state.uploadPercent, 0);

  state = scanProgressReducer(state, { type: "UPLOAD_PROGRESS", event: { loaded: 30, total: 100 } });
  assert.equal(state.phase, SCAN_PHASE.UPLOADING);
  assert.equal(state.uploadPercent, 30);

  state = scanProgressReducer(state, { type: "UPLOAD_PROGRESS", event: { loaded: 20, total: 100 } });
  assert.equal(state.uploadPercent, 30);

  state = scanProgressReducer(state, { type: "UPLOAD_PROGRESS", event: { loaded: 100, total: 100 } });
  assert.equal(state.phase, SCAN_PHASE.ANALYSING);
  assert.equal(state.uploadPercent, 100);

  const lateUploadEvent = scanProgressReducer(state, { type: "UPLOAD_PROGRESS", event: { loaded: 80, total: 100 } });
  assert.strictEqual(lateUploadEvent, state);
});

test("optional backend milestones remain monotonic and become the analysis counter", () => {
  let state = scanProgressReducer(
    { ...INITIAL_SCAN_PROGRESS, phase: SCAN_PHASE.ANALYSING, uploadPercent: 100 },
    { type: "SERVER_PROGRESS", progressPercent: 42, stage: "composition_features", state: "running" },
  );
  state = scanProgressReducer(state, {
    type: "SERVER_PROGRESS",
    progressPercent: 35,
    stage: "composition_features",
    state: "running",
  });

  assert.equal(state.serverProgressPercent, 42);
  const view = getScanProgressView(state);
  assert.equal(view.counter, "42%");
  assert.equal(view.counterLabel, "pipeline milestones");
  assert.match(view.detail, /composition features; 42% of the defined pipeline milestones/);
});

test("progress contract accepts only matching milestone telemetry", () => {
  const progressId = "123e4567-e89b-42d3-a456-426614174000";
  const payload = {
    schema_version: "soniccheck-scan-progress/1.0.0",
    progress_id: progressId,
    state: "processing",
    stage: "candidate_refinement_complete",
    completed_steps: 3,
    total_steps: 8,
    progress_percent: 38,
    progress_basis: "completed_pipeline_milestones",
    scan_id: null,
    error_code: null,
    retry_after_ms: 1_000,
  };
  const report = parseScanProgressResponse(payload, progressId);

  assert.equal(report.progressPercent, 38);
  assert.equal(report.stage, "candidate_refinement_complete");
  assert.equal(report.retryAfterMs, 1_000);
  assert.equal(parseScanProgressResponse({ ...payload, schema_version: "unknown" }, progressId), null);
  assert.equal(parseScanProgressResponse({ ...payload, progress_percent: 39 }, progressId), null);
  assert.equal(normaliseRetryDelay(100), 750);
  assert.equal(normaliseRetryDelay(10_000), 3_000);
  assert.equal(createScanProgressId({ randomUUID: () => progressId }), progressId);
  assert.equal(createScanProgressId({ randomUUID: () => "not-a-uuid" }), null);
  assert.equal(
    createScanProgressId({ getRandomValues: (bytes) => bytes.fill(0) }),
    "00000000-0000-4000-8000-000000000000",
  );

  const completed = parseScanProgressResponse({
    ...payload,
    state: "completed",
    stage: "completed",
    completed_steps: 8,
    progress_percent: 100,
    scan_id: "scan-123",
  }, progressId);
  assert.equal(completed.scanId, "scan-123");
});

test("request failures produce an explicit error phase instead of returning to ready", () => {
  const analysing = {
    ...INITIAL_SCAN_PROGRESS,
    phase: SCAN_PHASE.ANALYSING,
    uploadPercent: 100,
  };
  const state = scanProgressReducer(analysing, { type: "FAIL", message: "Analysis service unavailable." });
  const view = getScanProgressView(state);

  assert.equal(state.phase, SCAN_PHASE.ERROR);
  assert.equal(state.failedAt, SCAN_PHASE.ANALYSING);
  assert.equal(view.statusLabel, "Screen interrupted");
  assert.match(view.announcement, /Analysis service unavailable/);
});

test("a lost POST response can reconcile to a later durable completion", () => {
  const progressId = "123e4567-e89b-42d3-a456-426614174000";
  const timers = controlledTimers();
  let completed = null;
  let failed = null;
  let recoveryReason = null;
  const recovery = createScanPostRecovery({
    progressId,
    onCompleted: (scanId) => { completed = scanId; },
    onFailed: (message) => { failed = message; },
    onRecoveryStarted: (reason) => { recoveryReason = reason; },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.equal(timers.scheduled.get(1).delay, SCAN_POST_PENDING_TIMEOUT_MS);
  assert.equal(recovery.start({ code: "ERR_NETWORK" }, progressId), true);
  assert.equal(recoveryReason, "response_lost");
  assert.equal(recovery.awaitingRecovery, true);
  assert.equal(timers.cleared.has(1), true);
  assert.equal(timers.scheduled.get(2).delay, 120_000);
  assert.equal(recovery.handleProgress({ state: "processing" }), false);
  assert.equal(recovery.handleProgress({ state: "completed", scanId: "scan-123" }), true);
  assert.equal(completed, "scan-123");
  assert.equal(failed, null);
  assert.equal(timers.cleared.has(2), true);
});

test("lost-response recovery rejects HTTP failures and expires fail closed", () => {
  const progressId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(shouldRecoverLostScanResponse({
    progressId,
    activeProgressId: progressId,
    requestError: { response: { status: 422 } },
  }), false);
  assert.equal(shouldRecoverLostScanResponse({
    progressId,
    activeProgressId: progressId,
    requestError: { code: "ERR_CANCELED" },
  }), false);

  const timers = controlledTimers();
  let failedState = null;
  const recovery = createScanPostRecovery({
    progressId,
    onCompleted: () => assert.fail("unexpected completion"),
    onFailed: (_message, state) => { failedState = state; },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  assert.equal(recovery.start({ code: "ECONNABORTED" }, progressId), true);
  timers.fire(2);
  assert.equal(failedState, "recovery_timeout");
  assert.equal(recovery.awaitingRecovery, false);
});

test("whole-operation deadline enters reconciliation and survives degraded telemetry", () => {
  const progressId = "123e4567-e89b-42d3-a456-426614174000";
  const timers = controlledTimers();
  let recoveryReason = null;
  let completed = null;
  let failed = null;
  const recovery = createScanPostRecovery({
    progressId,
    onCompleted: (scanId) => { completed = scanId; },
    onFailed: (message) => { failed = message; },
    onRecoveryStarted: (reason) => { recoveryReason = reason; },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.equal(recovery.pendingPost, true);
  timers.fire(1);
  assert.equal(recoveryReason, "pending_timeout");
  assert.equal(recovery.awaitingRecovery, true);

  let telemetry = {
    status: 503,
    uploadComplete: true,
    notFoundAttempts: 0,
    unavailableAttempts: 0,
    transportAttempts: 0,
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const decision = scanPollFailureDecision(telemetry);
    assert.ok(decision.retryAfterMs >= 750 && decision.retryAfterMs <= 3_000);
    telemetry = { ...telemetry, ...decision };
  }
  assert.equal(telemetry.retryAfterMs, 3_000);
  assert.equal(recovery.awaitingRecovery, true);
  assert.equal(recovery.handleProgress({ state: "completed", scanId: "durable-scan" }), true);
  assert.equal(completed, "durable-scan");
  assert.equal(failed, null);
});

test("user stop is reconciliation, not an assertion that server work was cancelled", () => {
  const progressId = "123e4567-e89b-42d3-a456-426614174000";
  const timers = controlledTimers();
  let recoveryReason = null;
  let failure = null;
  const recovery = createScanPostRecovery({
    progressId,
    onCompleted: () => assert.fail("unexpected completion"),
    onFailed: (message, state) => { failure = { message, state }; },
    onRecoveryStarted: (reason) => { recoveryReason = reason; },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.equal(recovery.start(
    { code: "USER_STOP_RECONCILE" },
    progressId,
    "user_stop",
  ), true);
  assert.equal(recoveryReason, "user_stop");
  timers.fire(2);
  assert.equal(failure.state, "recovery_timeout");
  assert.match(failure.message, /Do not immediately retry; check your dashboard first/u);
});

test("server analysis copy explicitly refuses a fabricated computation percentage", () => {
  const view = getScanProgressView({ phase: SCAN_PHASE.ANALYSING, uploadPercent: 100 });

  assert.equal(view.counter, "100%");
  assert.equal(view.counterLabel, "upload complete");
  assert.match(view.detail, /finished result rather than a synthetic analysis percentage/);
  assert.match(view.meterValueText, /server analysis is active without a reported percentage/);
});

test("scanner markup exposes progress and reduced-motion accessibility", async () => {
  const [newScan, analyzer, landing, styles] = await Promise.all([
    source("../src/pages/NewScan.jsx"),
    source("../src/components/ScannerAnalyzer.jsx"),
    source("../src/pages/Landing.jsx"),
    source("../src/index.css"),
  ]);

  assert.match(newScan, /onUploadProgress:/);
  assert.match(newScan, /payload\.append\("progress_id", progressId\)/);
  assert.match(newScan, /`\/scans\/progress\/\$\{progressId\}`/);
  assert.equal((newScan.match(/startProgressPolling\(progressId\)/g) || []).length, 1);
  assert.match(newScan, /activePoll\.controller\.abort\(\)/);
  assert.match(newScan, /activeUpload\.controller\.abort\(\)/);
  assert.match(newScan, /signal: uploadController\.signal/);
  assert.match(newScan, /timeout: 0/);
  assert.match(newScan, /activePoll\?\.recovery\.start\(requestError, activePoll\.progressId\)/);
  assert.match(newScan, /Cancel wait &amp; check status/);
  assert.match(newScan, /disabled=\{submitting \|\| ambiguousOutcome\}/);
  assert.match(newScan, /Check dashboard before another screen/);
  assert.match(newScan, /SCAN_POST_PENDING_TIMEOUT_MS/);
  assert.match(newScan, /scanPollFailureDecision/);
  assert.doesNotMatch(newScan, /handleTelemetryUnavailable/);
  assert.match(newScan, /void refresh\(\)/);
  assert.match(newScan, /if \(report\.state === "completed"\) \{[\s\S]*completeSubmission\(report\.scanId\)/);
  assert.match(newScan, /if \(report\.state === "failed"\) \{[\s\S]*failSubmission\(message, report\.state\)/);
  assert.match(newScan, /setSubmitting\(false\);[\s\S]*dispatchScanProgress\(\{ type: "FAIL"/);
  assert.match(newScan, /terminalStateRef\.current \|\|= \{ state: "unmounted" \}/);
  assert.match(newScan, /headers\?\.get\?\.\("retry-after"\)/);
  assert.match(newScan, /<ScannerAnalyzer progress=\{scanProgress\}/);
  assert.match(analyzer, /role="progressbar"/);
  assert.match(analyzer, /className="sr-only"[\s\S]*aria-live="polite"/);
  assert.match(analyzer, /data-testid=\{SCAN\.progressDetail\}/);
  assert.match(analyzer, /percentage reports browser-to-server upload only/);
  assert.match(analyzer, /completed pipeline milestones—not elapsed time, an ETA, confidence or accuracy/);
  assert.match(landing, /<ChromaticText>checked through evidence\.<\/ChromaticText>/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.chromatic-text,/);
});

test("scanner bars use the exact uploaded SONIC rainbow texture", async () => {
  const [analyzer, asset] = await Promise.all([
    source("../src/components/ScannerAnalyzer.jsx"),
    readFile(new URL("../public/brand/sonic-rainbow-bar.png", import.meta.url)),
  ]);

  assert.match(analyzer, /\/brand\/sonic-rainbow-bar\.png/);
  assert.equal(
    createHash("sha256").update(asset).digest("hex"),
    "0bf91f5bd1aeac84ee3335b03ae8c0ecf544347eec800c0ab5a3c3c32b7d5933",
  );
});

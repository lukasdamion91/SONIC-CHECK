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
  createScanProgressId,
  normaliseRetryDelay,
  parseScanProgressResponse,
} from "../src/lib/scanProgressPolling.mjs";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

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
  assert.match(newScan, /useEffect\(\(\) => \(\) => stopProgressPolling\(\)/);
  assert.match(newScan, /status === 404/);
  assert.match(newScan, /status === 503 && activePoll\.unavailableAttempts < 4/);
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

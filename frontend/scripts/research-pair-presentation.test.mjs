import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  RESEARCH_RECEIPT_FIELDS,
  RESEARCH_RECEIPT_SCHEMA,
  buildResearchPairRequest,
  buildResearchReceiptEnvelope,
  buildResearchRequestContract,
  canonicalJson,
  createResearchRequestId,
  numberText,
  researchLaneView,
  researchPairCapabilityView,
  researchRuntimeRows,
  sha256Hex,
  validateResearchPairRecord,
  verifyResearchHtmlReport,
  verifyResearchPairRecordIntegrity,
} from "../src/lib/researchPairPresentation.mjs";

const LEFT = "507f1f77bcf86cd799439011";
const RIGHT = "507f1f77bcf86cd799439012";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const HASH = "0".repeat(64);

async function hashBytes(value) {
  return sha256Hex(typeof value === "string" ? new TextEncoder().encode(value) : value, webcrypto);
}

async function sealedRecord() {
  const leftEncoded = await hashBytes("left-audio");
  const rightEncoded = await hashBytes("right-audio");
  const leftPcm = await hashBytes("decoded-left");
  const rightPcm = await hashBytes("decoded-right");
  const result = {
    method_version: "soniccheck-s5p-pairwise/0.1.0-candidate",
    status: "DIAGNOSTIC_READY",
    lanes: { s54: { status: "DIAGNOSTIC_READY" } },
    input_source_sha256: [leftEncoded, rightEncoded].sort(),
    decoded_input: {
      status: "AVAILABLE",
      reason_codes: [],
      sample_rate: 11025,
      mono: true,
      sample_counts: [11025, 22050],
      durations_seconds: [1.0, 2.0],
      pcm_sha256: { left: leftPcm, right: rightPcm },
      hash_encoding: "C_contiguous_little_endian_float64_decoded_PCM",
      cropped: false,
      peak_normalized: false,
    },
    provider_calls: 0,
    production_scoring_changed: false,
    activation_allowed: false,
  };
  const lanes = ["s54"];
  const record = {
    id: "507f1f77bcf86cd799439099",
    schema_version: RESEARCH_RECEIPT_SCHEMA,
    receipt_id: "507f1f77bcf86cd799439099",
    request_id: REQUEST_ID,
    request_sha256: await sha256Hex(canonicalJson(buildResearchRequestContract(LEFT, RIGHT, lanes)), webcrypto),
    owner_binding_sha256: await hashBytes("owner-binding"),
    created_at: "2026-09-19T00:00:00+00:00",
    deployment_commit_sha: "candidate-r1",
    left_scan_id: LEFT,
    right_scan_id: RIGHT,
    selected_lanes: lanes,
    input_custody: {
      left: {
        side: "left", scan_id: LEFT, vault_file_id: "507f1f77bcf86cd799439021",
        object_key_sha256: await hashBytes("left-key"), object_version_id: "left-v1",
        object_etag: "left-etag", last_modified: "2026-09-19T00:00:00+00:00",
        declared_size_bytes: 10, reported_content_length: 10, encoded_size_bytes: 10,
        encoded_sha256: leftEncoded, content_type: "audio/wav", decoded_status: "AVAILABLE", decoded_pcm_sha256: leftPcm,
        decoded_sample_rate_hz: 11025, decoded_sample_count: 11025, decoded_duration_seconds: 1.0,
      },
      right: {
        side: "right", scan_id: RIGHT, vault_file_id: "507f1f77bcf86cd799439022",
        object_key_sha256: await hashBytes("right-key"), object_version_id: "right-v1",
        object_etag: "right-etag", last_modified: "2026-09-19T00:00:00+00:00",
        declared_size_bytes: 11, reported_content_length: 11, encoded_size_bytes: 11,
        encoded_sha256: rightEncoded, content_type: "audio/wav", decoded_status: "AVAILABLE", decoded_pcm_sha256: rightPcm,
        decoded_sample_rate_hz: 11025, decoded_sample_count: 22050, decoded_duration_seconds: 2.0,
      },
    },
    status: result.status,
    method_version: result.method_version,
    result_sha256: await sha256Hex(canonicalJson(result), webcrypto),
    result,
    provider_requests_made_by_endpoint: 0,
    payment_entitlements_consumed: 0,
    authoritative_scan_fields_changed: false,
  };
  record.receipt_sha256 = await sha256Hex(canonicalJson(buildResearchReceiptEnvelope(record)), webcrypto);
  return record;
}

test("cross-language type-tagged canonical vector matches Python", async () => {
  const vector = {
    unicode: "HARRY – 音",
    numbers: [0, -0, 1, 1.0, 0.1, 1.5, 9007199254740991],
    nested: { z: false, a: null },
  };
  assert.equal(await sha256Hex(canonicalJson(vector), webcrypto), "1ef2b25e02030b3ee96b7bf49e0c3d42ab14a2ae6722ecde103b0a80ea482652");
  assert.throws(() => canonicalJson({ unsafe: Number.MAX_SAFE_INTEGER + 1 }), /unsafe integer/);
  assert.throws(() => canonicalJson({ invalid: Infinity }), /non-finite/);
});

test("secure request identifiers and requests are canonical", () => {
  assert.equal(createResearchRequestId({ randomUUID: () => REQUEST_ID }), REQUEST_ID);
  assert.throws(() => createResearchRequestId({ randomUUID: () => "invalid" }), /invalid/);
  assert.deepEqual(buildResearchPairRequest(" left ", "right", ["s56", "s54", "s54"], REQUEST_ID), {
    request_id: REQUEST_ID, left_scan_id: "left", right_scan_id: "right", lanes: ["s54", "s56"],
  });
  assert.throws(() => buildResearchPairRequest("left", " left ", ["s54"], REQUEST_ID), /different/);
  assert.throws(() => buildResearchPairRequest("left", "right", [], REQUEST_ID), /Select/);
  assert.throws(() => buildResearchPairRequest("left", "right", ["s57"], REQUEST_ID), /supported/);
  assert.throws(() => buildResearchPairRequest("left", "right", ["s54"], "invalid"), /request identifier/);
});

test("sealed receipt validates and all three integrity bindings verify", async () => {
  const record = await sealedRecord();
  assert.deepEqual(Object.keys(buildResearchReceiptEnvelope(record)), [...RESEARCH_RECEIPT_FIELDS]);
  assert.equal(await verifyResearchPairRecordIntegrity(record, LEFT, RIGHT, REQUEST_ID, webcrypto), record);
});

test("unavailable decoded input remains a sealed absence rather than invented measurements", async () => {
  const record = await sealedRecord();
  record.status = "UNAVAILABLE";
  record.result.status = "UNAVAILABLE";
  record.result.decoded_input = {
    status: "UNAVAILABLE", reason_codes: ["AUDIO_DECODE_FAILED"], sample_rate: null,
    mono: null, sample_counts: null, durations_seconds: null, pcm_sha256: null,
    hash_encoding: null, cropped: false, peak_normalized: false,
  };
  record.result.lanes = {
    s54: { status: "UNAVAILABLE", reason_codes: ["AUDIO_DECODE_FAILED"], provider_calls: 0, production_scoring_changed: false, activation_allowed: false },
  };
  for (const side of ["left", "right"]) {
    record.input_custody[side].decoded_status = "UNAVAILABLE";
    record.input_custody[side].decoded_pcm_sha256 = null;
    record.input_custody[side].decoded_sample_rate_hz = null;
    record.input_custody[side].decoded_sample_count = null;
    record.input_custody[side].decoded_duration_seconds = null;
  }
  record.result_sha256 = await sha256Hex(canonicalJson(record.result), webcrypto);
  record.receipt_sha256 = await sha256Hex(canonicalJson(buildResearchReceiptEnvelope(record)), webcrypto);
  assert.equal(await verifyResearchPairRecordIntegrity(record, LEFT, RIGHT, REQUEST_ID, webcrypto), record);
  assert.equal(record.input_custody.left.decoded_pcm_sha256, null);
  assert.ok(record.input_custody.left.encoded_sha256);
});

test("route, request, custody and unexpected fields fail closed", async () => {
  const record = await sealedRecord();
  assert.throws(() => validateResearchPairRecord(record, "other", RIGHT, REQUEST_ID), /different source/);
  assert.throws(() => validateResearchPairRecord(record, LEFT, RIGHT, "22222222-2222-4222-8222-222222222222"), /different request/);
  assert.throws(() => validateResearchPairRecord({ ...record, extra: true }, LEFT, RIGHT, REQUEST_ID), /unexpected fields/);
  const custody = structuredClone(record);
  custody.input_custody.left.scan_id = RIGHT;
  assert.throws(() => validateResearchPairRecord(custody, LEFT, RIGHT, REQUEST_ID), /custody/);
});

test("result, request and complete receipt tampering are detected", async () => {
  for (const field of ["result", "request_sha256", "receipt_sha256"]) {
    const record = await sealedRecord();
    if (field === "result") record.result.lanes.s54.status = "MUTATED";
    else record[field] = HASH;
    await assert.rejects(
      verifyResearchPairRecordIntegrity(record, LEFT, RIGHT, REQUEST_ID, webcrypto),
      /SHA-256 integrity check/,
    );
  }
});

test("HTML report is bound to the receipt and exact bytes", async () => {
  const record = await sealedRecord();
  const blob = new Blob(["<html>sealed</html>"], { type: "text/html" });
  const reportHash = await sha256Hex(new Uint8Array(await blob.arrayBuffer()), webcrypto);
  const headers = {
    "x-integrity-hash": record.receipt_sha256,
    "x-integrity-scope": "mda2-diagnostic-receipt",
    "x-report-sha256": reportHash,
  };
  assert.equal(await verifyResearchHtmlReport(blob, headers, record.receipt_sha256, webcrypto), true);
  await assert.rejects(verifyResearchHtmlReport(blob, { ...headers, "x-report-sha256": HASH }, record.receipt_sha256, webcrypto), /report bytes/);
});

test("missing or malformed capability never enables a comparison", () => {
  for (const capability of [null, {}, { mode: "disabled", can_run: true }, { mode: "on", can_run: true }, { mode: "admin_opt_in", can_run: "true" }, { mode: "admin_opt_in" }]) {
    assert.equal(researchPairCapabilityView(capability).canRun, false);
  }
  const allowed = researchPairCapabilityView({ mode: "admin_opt_in", available: true, can_run: true, research_visibility_allowed: true });
  assert.equal(allowed.canRun, true);
  assert.equal(allowed.researchVisibilityAllowed, true);
  assert.equal(researchPairCapabilityView({ mode: "admin_opt_in", available: false, can_run: true }).canRun, false);
  assert.match(researchPairCapabilityView(null).summary, /UNKNOWN/);
  assert.match(researchPairCapabilityView({ mode: "disabled" }).summary, /disabled/);
});

test("V-series mode disclosure never promotes configured shadow into observed execution", () => {
  assert.ok(researchRuntimeRows(null).every((row) => row.mode === "UNKNOWN" && row.executionState === "UNKNOWN"));
  const rows = researchRuntimeRows({
    v16r: { configured_mode: "shadow", effective_status: "SHADOW_CONFIGURED_NOT_EXERCISED", execution_state: "NOT_OBSERVED" },
    v30: { configured_mode: "shadow", effective_status: "PARENT_DISABLED", execution_state: "NOT_OBSERVED", blockers: [{ reason_code: "PARENT_DISABLED", continuation_id: "VREC-V30-PARENT-INTEGRATION-REVIEW" }] },
    eight_channel_observer: { configured_mode: "admin_opt_in", effective_status: "ADMIN_OPT_IN_NOT_EXERCISED", execution_state: "NOT_OBSERVED" },
  });
  assert.equal(rows[0].executionState, "NOT_OBSERVED");
  assert.equal(rows[1].effectiveStatus, "PARENT_DISABLED");
  assert.equal(rows[1].blockers[0].continuation, "VREC-V30-PARENT-INTEGRATION-REVIEW");
  assert.equal(rows[2].executionState, "NOT_OBSERVED");
});

test("missing or nonfinite observations are never converted to zero", () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, "0", true]) assert.equal(numberText(value), "Not reported");
  assert.equal(numberText(0), "0");
  const missing = researchLaneView("s54", null);
  assert.equal(missing.status, "NOT RETURNED");
  assert.deepEqual(missing.metrics, []);
  const rejected = researchLaneView("s54", { status: "REJECTED", reason_codes: ["LOW_INFORMATION"] });
  assert.ok(rejected.metrics.every(([, value]) => value === "Not reported"));
  assert.deepEqual(rejected.reasons, ["LOW_INFORMATION"]);
});

test("fingerprint observations retain zero and false without inferring a decision", () => {
  const view = researchLaneView("s54", { status: "DIAGNOSTIC_READY", input_pcm_exact_equal: false, input_array_bytes_equal: false, fingerprint_similarity: 0, hamming_bit_errors: 64, compared_bits: 64, overlap_words: 2, absolute_offset_words: 0, tested_offsets: 1 });
  const metrics = Object.fromEntries(view.metrics);
  assert.equal(metrics["Fingerprint agreement (0–1)"], "0");
  assert.equal(metrics["Exact decoded PCM equality"], "No");
  assert.equal(metrics["Absolute offset (words)"], "0");
  assert.ok(view.notes.some((note) => /not a calibrated identity decision/.test(note)));
});

test("component missingness stays separate from usable evidence", () => {
  const view = researchLaneView("s55", {
    status: "PARTIAL_COMPONENT_EVIDENCE",
    components: {
      harmonic: { status: "OBSERVED_NONAUTHORITATIVE", aligned_spectral_cosine: 0.75, envelope_cosine: 0 },
      percussive: { status: "COMPONENT_UNUSABLE", aligned_spectral_cosine: null, envelope_cosine: null, reason_codes: ["COMPONENT_ENERGY_INSUFFICIENT"] },
    },
  });
  assert.equal(view.components[0].metrics[1][1], "0");
  assert.equal(view.components[1].metrics[0][1], "Not reported");
  assert.deepEqual(view.components[1].reasons, ["COMPONENT_ENERGY_INSUFFICIENT"]);
  assert.equal(view.metrics[1][1], "Not reported");
  assert.ok(view.notes.some((note) => /same waveform/.test(note)));
});

test("fragment budget exhaustion never presents an achieved statistic or null probability", () => {
  const view = researchLaneView("s56", { status: "RUNTIME_BUDGET_EXCEEDED", reason: "Search budget exhausted", search_complete: false, selected: null, null: null });
  const metrics = Object.fromEntries(view.metrics);
  assert.equal(metrics["Complete bounded search"], "No");
  assert.equal(metrics["Observed statistic"], "Not reported");
  assert.equal(metrics["Surrogate tail fraction"], "Not reported");
  assert.deepEqual(view.fragments, []);
  assert.deepEqual(view.reasons, ["Search budget exhausted"]);
});

test("fragment counts and null support have explicit scientific limits and canonical coordinates", () => {
  const view = researchLaneView("s56", {
    status: "COMPLETED_DEVELOPMENT_MECHANICS", search_complete: true,
    selected: { fragment_count: 3, observed_statistic: 4.25, fragments: [{ matched_atoms: 5, normalised_coverage_seconds: 15, profile_a_interval_seconds: [0, 15], profile_b_interval_seconds: [30, 45] }] },
    null: { completed: 19, requested: 19, tail_fraction: 0.05, minimum_resolvable_tail_fraction: 0.05, formal_null_support_satisfied: false, formal_s5_scientific_gate_satisfied: false },
  });
  const metrics = Object.fromEntries(view.metrics);
  assert.equal(metrics["Selected fragments"], "3");
  assert.equal(metrics["Formal null support met"], "No");
  assert.equal(metrics["Formal S5 scientific gate met"], "No");
  assert.equal(view.fragments[0].profileB, "30–45 s");
  assert.ok(view.notes.some((note) => /not a match probability/.test(note) && /canonical/.test(note)));
});

test("canonical fragment coordinates require an explicit source binding", () => {
  const lane = { status: "COMPLETED_DEVELOPMENT_MECHANICS", method_version: "soniccheck-mda2-s5p-fragment-sets/0.1.0-candidate", selected: { fragments: [] } };
  const reversed = researchLaneView("s56", lane, { profile_a: "right", profile_b: "left" });
  assert.equal(reversed.profileALabel, "Second scan (profile A)");
  assert.equal(reversed.profileBLabel, "First scan (profile B)");
  assert.equal(reversed.methodId, lane.method_version);
  assert.equal(researchLaneView("s56", lane).profileALabel, "Source unresolved (profile A)");
  assert.equal(researchLaneView("s56", lane, { profile_a: "both" }).profileALabel, "Both scans (profile A)");
});

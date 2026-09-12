import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { retrievalConsensusView } from "../src/lib/scanResultPresentation.mjs";

const clone = (value) => structuredClone(value);
const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
  ).join(",")}}`;
};
const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex");
const seal = (value) => ({ ...value, diagnostic_sha256: digest(value) });

const limitation = (
  "Cross-channel retrieval consensus measures agreement between correlated "
  + "candidate-generation views; it is not correctness, recall, accuracy, "
  + "originality, infringement, clearance, or legal evidence."
);
const claims = {
  accuracy_claimed: false,
  authoritative_output_changed: false,
  candidate_promotion_authorized: false,
  correctness_estimated: false,
  diagnostic_only: true,
  operational_threshold_established: false,
  payment_gate_changed: false,
  provider_calls_permitted: false,
};
const base = () => ({
  schema_version: "soniccheck-v37-retrieval-consensus/1.0.0",
  method_version: "soniccheck-v37-eight-channel-retrieval-consensus/1.0.0-research",
  claims: { ...claims },
  provider_requests_made: 0,
  limitations: [limitation],
});
const channels = [
  "v4:L160", "v4:L208", "v4:L257", "v4:FULL",
  "v6:L160", "v6:L208", "v6:L257", "v6:FULL",
];

const notRequested = () => seal({
  ...base(),
  status: "NOT_EVALUATED_NOT_REQUESTED",
  evaluated: false,
  reason_code: "ADMIN_SHADOW_NOT_REQUESTED",
  source_binding: null,
  execution: {
    requested: false,
    required_channel_count: 8,
    executed_channel_count: 0,
    all_required_channels_executed: false,
  },
  candidate_summary: null,
  profile_summary: null,
  timing: null,
});

const evaluated = () => seal({
  ...base(),
  status: "EVALUATED_SHADOW_ONLY",
  evaluated: true,
  reason_code: null,
  source_binding: {
    contract_id: "SC-EIGHT-CHANNEL-CONTROLLED-SHADOW-20260910",
    receipt_sha256: "b38a4db4386d5f7bbebe08be204335f65f4626aaf53af65dbf2af107f7d003a4",
    release_id: "SANITIZED-SELF-TEST-RELEASE",
    release_manifest_sha256: "3".repeat(64),
    generator_id: "soniccheck-v17-multiscale-candidate-generator/0.1.0-shadow",
    generator_sha256: "1".repeat(64),
    observer_sha256: "2".repeat(64),
    deployment_commit_sha: null,
  },
  execution: {
    requested: true,
    required_channel_count: 8,
    executed_channel_count: 8,
    all_required_channels_executed: true,
  },
  candidate_summary: {
    baseline_candidate_count: 0,
    challenger_candidate_count: 0,
    added_candidate_count: 0,
    lost_candidate_count: 0,
    baseline_challenger_jaccard_ppm: null,
    unique_channel_candidate_count: 0,
    channel_candidate_observation_count: 0,
    channel_candidate_counts: channels.map((channel_id) => ({
      channel_id,
      candidate_count: 0,
    })),
    challenger_channel_support_histogram: Object.fromEntries(
      channels.map((_channel, index) => [String(index + 1), 0]),
    ),
    challenger_multi_channel_candidate_count: 0,
    challenger_majority_channel_candidate_count: 0,
    challenger_all_channel_candidate_count: 0,
    top_ranked_challenger_channel_count: null,
    pairwise_channel_jaccard_ppm: {
      possible_channel_pairs: 28,
      observed_nonempty_union_pairs: 0,
      minimum_ppm: null,
      mean_ppm: null,
      maximum_ppm: null,
    },
  },
  profile_summary: {
    candidate_profile_count: 0,
    status_counts: {
      SCORED: 0,
      INSUFFICIENT_SIGNAL: 0,
      UNAVAILABLE: 0,
      INELIGIBLE: 0,
    },
    v16r_305_frame_eligible_count: 0,
  },
  timing: {
    baseline_retrieval_microseconds: 2000,
    challenger_retrieval_microseconds: 8000,
    profile_check_microseconds: 0,
    shadow_total_microseconds: 8000,
  },
});

const reseal = (value) => {
  const unsigned = clone(value);
  delete unsigned.diagnostic_sha256;
  return seal(unsigned);
};

test("V37 verifies the exact Python not-requested receipt digest", () => {
  const diagnostic = notRequested();
  assert.equal(
    diagnostic.diagnostic_sha256,
    "f1a1da0f8a215cb559a3e95d1422de6d8fb6aee468feb2d7d7c7ddb8dbdc8560",
  );
  assert.deepEqual(retrievalConsensusView({ retrieval_consensus: diagnostic }), {
    valid: true,
    available: false,
    status: "NOT_EVALUATED_NOT_REQUESTED",
    evaluated: false,
    requested: false,
    executedChannels: 0,
    requiredChannels: 8,
    reason: "ADMIN_SHADOW_NOT_REQUESTED",
    diagnosticDigest: diagnostic.diagnostic_sha256,
    limitation,
  });
});

test("V37 verifies the exact Python evaluated receipt and exposes no identifiers", () => {
  const diagnostic = evaluated();
  assert.equal(
    diagnostic.diagnostic_sha256,
    "1ade7335565b914839c65659a2a8e5c217f831e8d79062c3a06858867c25f7e8",
  );
  const view = retrievalConsensusView({ retrieval_consensus: diagnostic });
  assert.equal(view.valid, true);
  assert.equal(view.available, true);
  assert.equal(view.executedChannels, 8);
  assert.equal(view.meanPairwiseJaccard, null);
  assert.equal(view.profileCount, 0);
  assert.doesNotMatch(JSON.stringify(view), /query_audio|reference_id|candidate_ids/u);
});

test("V37 fails closed for a bad digest and resealed semantic contradictions", () => {
  const badDigest = evaluated();
  badDigest.timing.shadow_total_microseconds = 9000;
  assert.equal(retrievalConsensusView({ retrieval_consensus: badDigest })?.valid, false);

  const corruptions = [
    (value) => { value.claims.candidate_promotion_authorized = true; },
    (value) => { value.candidate_summary.baseline_challenger_jaccard_ppm = 0; },
    (value) => { value.candidate_summary.channel_candidate_counts[0].candidate_count = 1; },
    (value) => { value.profile_summary.candidate_profile_count = 1; },
    (value) => { value.execution.executed_channel_count = 7; },
    (value) => { value.source_binding.release_id = "https://private.invalid"; },
    (value) => { value.candidate_summary.candidate_ids = ["private-reference"]; },
  ];
  for (const corrupt of corruptions) {
    const diagnostic = evaluated();
    corrupt(diagnostic);
    const view = retrievalConsensusView({ retrieval_consensus: reseal(diagnostic) });
    assert.equal(view?.valid, false);
    assert.equal(view?.available, false);
  }
});

test("V37 preserves a valid fail-closed shadow abstention without metrics", () => {
  const diagnostic = seal({
    ...base(),
    status: "ABSTAIN_INVALID_OR_INCOMPLETE_SHADOW",
    evaluated: false,
    reason_code: "SHADOW_RECEIPT_INVALID",
    source_binding: null,
    execution: {
      requested: true,
      required_channel_count: 8,
      executed_channel_count: null,
      all_required_channels_executed: false,
    },
    candidate_summary: null,
    profile_summary: null,
    timing: null,
  });
  const view = retrievalConsensusView({ retrieval_consensus: diagnostic });
  assert.equal(view.valid, true);
  assert.equal(view.available, false);
  assert.equal(view.requested, true);
  assert.equal(view.reason, "SHADOW_RECEIPT_INVALID");
});

test("V37 upload opt-in is admin-only, audio-bound, and explicitly non-authoritative", async () => {
  const source = await readFile(new URL("../src/pages/NewScan.jsx", import.meta.url), "utf8");

  assert.match(source, /user\?\.role === "admin" && \(/u);
  assert.match(source, /disabled=\{submitting \|\| !audioFile\}/u);
  assert.match(source, /candidateShadowRequested && user\?\.role !== "admin"/u);
  assert.match(source, /candidateShadowRequested && !audioFile/u);
  assert.match(source, /candidateShadowRequested && user\?\.role === "admin"[\s\S]*payload\.append\("candidate_shadow", "true"\)/u);
  assert.match(source, /if \(!nextAudioFile\) setCandidateShadowRequested\(false\)/u);
  assert.match(source, /does not change the verdict, candidate ranking, provider calls, payment state or entitlement use/u);
});

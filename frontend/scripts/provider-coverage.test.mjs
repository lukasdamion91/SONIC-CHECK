import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordingProviderCoverage, recordingCandidateDetails } from "../src/lib/providerCoveragePresentation.mjs";
import { buildChannelCoverageRows } from "../src/lib/scanResultPresentation.mjs";

const row = (provider, outcome, rest = {}) => ({
  provider, outcome, attempted: outcome !== "skipped", request_count: outcome === "skipped" ? 0 : 1,
  candidate_count: outcome === "match" ? 1 : 0,
  mode: "shadow", access_basis: "commercial_approved", ...rest,
});
const scan = (...attempts) => ({
  scan_modes: { audio: true },
  fingerprint: { status_code: 1001, provider_attempts: attempts },
});

test("historical absent attempts stay unknown even with ready provider fields", () => {
  const coverage = buildRecordingProviderCoverage({ fingerprint: { status_code: 1001, ready: true, access_basis: "commercial_approved" } });
  assert.equal(coverage.recorded, false);
  assert.equal(coverage.completedCount, 0);
  for (const provider of coverage.rows) {
    assert.equal(provider.outcome, "unknown");
    assert.equal(provider.requestCount, null);
    assert.equal(provider.authority, "Access basis not recorded");
  }
});

test("successful fallback is visible alongside primary no-match and commercial shadow authority", () => {
  const result = scan(row("AcoustID + MusicBrainz", "no_match"), row("ACRCloud", "match"));
  const coverage = buildRecordingProviderCoverage(result);
  assert.equal(coverage.completedCount, 2);
  assert.equal(coverage.partial, false);
  assert.equal(coverage.rows[1].authority, "Commercial access approved for this provider scope");
  assert.equal(coverage.rows[1].mode, "shadow");
  assert.equal(coverage.rows[1].requestLabel, "1 request");
  assert.equal(coverage.rows[1].candidateCount, 1);
});

test("primary no-match followed by ACRCloud error cannot look like complete provider coverage", () => {
  const result = scan(row("AcoustID", "no_match"), row("ACRCloud", "error", { reason: "WRONG_ACCESS_KEY", status_code: 3001 }));
  const coverage = buildRecordingProviderCoverage(result);
  assert.equal(coverage.partial, true);
  assert.equal(coverage.rows[1].reason, "wrong access key");
  const channel = buildChannelCoverageRows(result)[0];
  assert.equal(channel.state, "unavailable_degraded");
  assert.match(channel.outcome, /partial provider coverage/);
  assert.equal(channel.coverage, "1 of 2 recording providers have a recorded completed search");
});

test("fallback skip never implies an ACRCloud request and missing row remains unknown", () => {
  const result = scan(row("AcoustID", "match"), row("ACRCloud", "skipped", { reason: "first_provider_matched" }));
  result.matches = [{ analysis_type: "recording_identity" }];
  const coverage = buildRecordingProviderCoverage(result);
  assert.equal(coverage.rows[1].attempted, false);
  assert.equal(coverage.rows[1].requestCount, 0);
  assert.equal(coverage.rows[1].label, "Not searched");
  assert.equal(coverage.rows[1].reason, "first provider matched");
  assert.equal(coverage.partial, false);
  assert.equal(coverage.completedCount, 1);
  assert.equal(buildChannelCoverageRows(result)[0].outcome, "Candidate evidence returned");
  assert.equal(buildChannelCoverageRows(result)[0].coverage, "1 of 2 recording providers have a recorded completed search");
  assert.equal(buildRecordingProviderCoverage(scan(row("AcoustID", "match"))).rows[1].outcome, "unknown");
});

test("disabled ACRCloud after primary no-match remains incomplete provider coverage", () => {
  const result = scan(row("AcoustID", "no_match"), row("ACRCloud", "skipped", { reason: "DISABLED_BY_POLICY", mode: "off" }));
  assert.equal(buildRecordingProviderCoverage(result).partial, true);
  assert.equal(buildChannelCoverageRows(result)[0].outcome, "No candidate — partial provider coverage");
});

test("contradictory or malformed attempts do not manufacture successful requests", () => {
  const result = scan(row("AcoustID", "no_match", { attempted: false }), row("ACRCloud", "match", { attempted: "true", request_count: "1", reason: "https://example.com/?token=private" }));
  const coverage = buildRecordingProviderCoverage(result);
  assert.equal(coverage.completedCount, 0);
  assert.equal(coverage.rows[1].requestCount, null);
  assert.equal(coverage.rows[1].reason, "");
  assert.equal(buildChannelCoverageRows(result)[0].state, "unavailable_degraded");
});

test("local audio preparation failure remains an error with zero provider requests", () => {
  const coverage = buildRecordingProviderCoverage(scan(row("AcoustID", "no_match"), row("ACRCloud", "error", {
    attempted: false, request_count: 0, reason: "AUDIO_PREPARATION_FAILED",
  })));
  assert.equal(coverage.rows[1].outcome, "error");
  assert.equal(coverage.rows[1].label, "Search failed before provider request");
  assert.equal(coverage.rows[1].requestCount, 0);
  assert.equal(coverage.partial, true);
});

test("provider score preserves exact zero and 100 while missing stays absent", () => {
  for (const score of [0, 100, 77.35]) {
    const details = recordingCandidateDetails({ analysis_type: "recording_identity", provider_score: score, reference_source: "ACRCloud", provider_identifier: { acrcloud_acrid: "acr-test-native-id" } });
    assert.equal(details.score, score);
    assert.equal(details.scoreLabel, `Provider score: ${score}/100`);
    assert.equal(details.identifier, "acr-test-native-id");
  }
  for (const score of [undefined, null, "0", false, NaN, Infinity, -1, 101]) {
    assert.equal(recordingCandidateDetails({ analysis_type: "recording_identity", provider_score: score }).scoreLabel, "Provider score not reported");
  }
  assert.equal(recordingCandidateDetails({ analysis_type: "lyric_phrase_overlap", provider_score: 90 }), null);
});

test("bounded excerpt provenance survives serialization without rendering provider payloads", () => {
  const result = scan(row("AcoustID", "no_match"), row("ACRCloud", "no_match", {
    sample_provenance: { sha256: "a".repeat(64), start_seconds: 0, duration_seconds: 12, byte_count: 384044, format: "wav", private_filename: "private.wav" },
    secret: "must-never-be-presented",
  }));
  const restored = JSON.parse(JSON.stringify(result));
  const coverage = buildRecordingProviderCoverage(restored);
  assert.deepEqual(coverage.rows[1].sample, { sha256: "a".repeat(64), startSeconds: 0, durationSeconds: 12 });
  assert.doesNotMatch(JSON.stringify(coverage), /private\.wav|must-never-be-presented/);
  restored.fingerprint.provider_attempts[1].sample_provenance.sha256 = "invalid";
  assert.equal(buildRecordingProviderCoverage(restored).rows[1].sample, null);
});

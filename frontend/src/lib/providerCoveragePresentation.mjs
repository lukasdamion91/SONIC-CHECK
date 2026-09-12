// Display only retained scan evidence. Current provider configuration cannot
// establish that a provider was exercised by a historical scan.
const PROVIDERS = ["AcoustID", "ACRCloud"];
const OUTCOMES = {
  match: "Candidates returned",
  no_match: "Searched — no candidate",
  error: "Provider request failed",
  skipped: "Not searched",
  unknown: "Execution not recorded",
};

const integer = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const providerName = (value) => {
  if (typeof value !== "string") return null;
  return PROVIDERS.find((name) => value.toLowerCase().includes(name.toLowerCase())) || null;
};
const reasonLabel = (value) => {
  // Reasons are codes, never arbitrary provider error payloads or credentials.
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_ -]{0,127}$/.test(value)) return "";
  return value.toLowerCase().replaceAll("_", " ");
};
const sampleDetails = (sample) => {
  if (!sample || typeof sample !== "object") return null;
  const sha256 = typeof sample.sha256 === "string" && /^[a-f0-9]{64}$/.test(sample.sha256) ? sample.sha256 : null;
  const startSeconds = typeof sample.start_seconds === "number" && Number.isFinite(sample.start_seconds) && sample.start_seconds >= 0 ? sample.start_seconds : null;
  const durationSeconds = typeof sample.duration_seconds === "number" && Number.isFinite(sample.duration_seconds) && sample.duration_seconds > 0 ? sample.duration_seconds : null;
  return sha256 && startSeconds != null && durationSeconds != null ? { sha256, startSeconds, durationSeconds } : null;
};

export function buildRecordingProviderCoverage(result = {}) {
  const attempts = result.fingerprint?.provider_attempts;
  const recorded = Array.isArray(attempts) ? attempts : [];
  const rows = PROVIDERS.map((provider) => {
    const attempt = recorded.find((row) => providerName(row?.provider) === provider);
    const attempted = typeof attempt?.attempted === "boolean" ? attempt.attempted : null;
    const declaredOutcome = typeof attempt?.outcome === "string" ? attempt.outcome.toLowerCase() : "";
    const outcome = (attempted === true && ["match", "no_match"].includes(declaredOutcome))
      || (attempted !== null && declaredOutcome === "error")
      || (attempted === false && declaredOutcome === "skipped") ? declaredOutcome : "unknown";
    const requestCount = integer(attempt?.request_count);
    const candidateCount = integer(attempt?.candidate_count);
    const mode = ["shadow", "off"].includes(attempt?.mode) ? attempt.mode : null;
    const authority = {
      commercial_approved: "Commercial access approved for this provider scope",
      evaluation_authorized: "Evaluation access authorised",
      none: "Access basis not set",
    }[attempt?.access_basis] || "Access basis not recorded";
    return {
      provider,
      outcome,
      label: outcome === "error" && attempted === false ? "Search failed before provider request" : OUTCOMES[outcome],
      attempted,
      requestCount,
      candidateCount,
      reason: reasonLabel(attempt?.reason),
      policySkip: outcome === "skipped" && attempt?.reason === "first_provider_matched",
      mode,
      authority,
      sample: sampleDetails(attempt?.sample_provenance),
      completed: outcome === "match" || outcome === "no_match",
      requestLabel: requestCount == null ? "Request count not recorded" : `${requestCount} request${requestCount === 1 ? "" : "s"}`,
    };
  });
  const completedCount = rows.filter((row) => row.completed).length;
  const hasFailure = rows.some((row) => row.outcome === "error");
  // An explicit fallback skip after a primary match fulfils that request
  // policy. Keep it visibly unsearched without calling it a failed search.
  const hasMissingCoverage = rows.some((row) => row.outcome === "unknown"
    || (row.outcome === "skipped" && !row.policySkip));
  return {
    rows,
    recorded: recorded.length > 0,
    completedCount,
    partial: completedCount > 0 && (hasFailure || hasMissingCoverage),
    hasFailure,
    summary: `${completedCount} of ${rows.length} recording providers have a recorded completed search`,
  };
}

export function recordingCandidateDetails(match = {}) {
  if (match.analysis_type !== "recording_identity") return null;
  const score = typeof match.provider_score === "number" && Number.isFinite(match.provider_score)
    && match.provider_score >= 0 && match.provider_score <= 100 ? match.provider_score : null;
  const provider = providerName(match.reference_source) || "Recording provider";
  const nativeId = match.provider_identifier?.acrcloud_acrid
    || match.provider_identifier?.acoustid || match.provider_identifier?.musicbrainz_recording_id;
  return {
    provider,
    score,
    scoreLabel: score == null ? "Provider score not reported" : `Provider score: ${score}/100`,
    identifier: typeof nativeId === "string" ? nativeId.slice(0, 160) : null,
    interpretation: "Provider-reported recording evidence; not a probability or composition score.",
  };
}

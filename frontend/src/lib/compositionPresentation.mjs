const object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value, fallback = "") => (
  typeof value === "string" && value.trim() ? value.trim().slice(0, 800) : fallback
);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;

export const compositionPercent = (value) => (
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value : null
);

export const COMPOSITION_COMPONENTS = [
  ["harmonic_chroma_percent", "Harmonic pitch classes"],
  ["melodic_interval_contour_percent", "Dominant pitch-class contour"],
  ["rhythmic_onset_profile_percent", "Onset pattern"],
  ["structural_sequence_percent", "Coarse harmonic sequence"],
];

const statuses = {
  AUDIO_NOT_SUBMITTED: ["not_submitted", "Audio not submitted"],
  NOT_CONFIGURED: ["unavailable", "Reference catalogue not configured"],
  QUERY_AUDIO_UNAVAILABLE: ["unavailable", "Query audio unavailable"],
  QUERY_SIGNAL_INSUFFICIENT: ["insufficient", "Input insufficient"],
  REFERENCE_SIGNAL_INSUFFICIENT: ["insufficient", "Reference signal insufficient"],
  INSUFFICIENT_COMPARISONS: ["insufficient", "Insufficient comparisons"],
  REFERENCE_AUDIO_UNAVAILABLE: ["unavailable", "Reference audio unavailable"],
  RETRIEVAL_QUERY_FAILED: ["unavailable", "Reference retrieval unavailable"],
  RETRIEVAL_METADATA_UNUSABLE: ["unavailable", "Reference metadata unusable"],
  CATALOGUE_EMPTY: ["no_reference", "Reference catalogue empty"],
  NO_COMPARABLE_REFERENCE: ["no_reference", "No comparable reference"],
  REFERENCE_NOT_REGISTERED: ["no_reference", "Reference not registered"],
  NO_CANDIDATES: ["no_reference", "No comparable reference"],
  COMPLETED_RESEARCH_ONLY: ["compared", "Research comparisons available"],
};

const humanize = (value) => text(value).replaceAll("_", " ").toLowerCase();
const sourceLabels = {
  versioned_feature_profile: "Versioned reference feature profile",
  authorised_reference_audio: "Authorised reference audio",
  provider_resolution: "Provider-resolved reference",
  sharded_feature_index: "Retrieved feature-index reference",
  catalogue_feature_index: "Catalogue feature reference",
};

const sufficiencyView = (value) => {
  if (!object(value)) return null;
  const known = ["SUFFICIENT", "INSUFFICIENT"].includes(value.status);
  return {
    status: known ? value.status : "UNKNOWN",
    label: value.status === "SUFFICIENT" ? "Input checks passed"
      : value.status === "INSUFFICIENT" ? "Input insufficient" : "Input status unavailable",
    reasons: Array.isArray(value.reason_codes)
      ? value.reason_codes.filter((reason) => typeof reason === "string").map(humanize) : [],
  };
};

function comparisonView(value, index) {
  const row = object(value) ? value : {};
  const rawSignal = row.composition_signal_percent;
  const signal = compositionPercent(rawSignal);
  const quality = compositionPercent(row.measurement_confidence_percent);
  const queryInput = sufficiencyView(row.signal_sufficiency?.query);
  const referenceInput = sufficiencyView(row.signal_sufficiency?.reference);
  const inputInsufficient = [queryInput, referenceInput].some((input) => input?.status === "INSUFFICIENT");
  const statusAllowsScore = !row.status || row.status === "COMPLETED_RESEARCH_ONLY";
  const malformed = !object(value)
    || (rawSignal != null && signal === null)
    || (row.measurement_confidence_percent != null && quality === null)
    || (row.signal_sufficiency != null && !object(row.signal_sufficiency))
    || (signal !== null && (!statusAllowsScore || inputInsufficient
      || [queryInput, referenceInput].some((input) => input?.status === "UNKNOWN")));
  const scoreAvailable = !malformed && statusAllowsScore && !inputInsufficient && signal !== null;
  const components = COMPOSITION_COMPONENTS.map(([key, label]) => ({
    key,
    label,
    percent: scoreAvailable ? compositionPercent(row.components?.[key]) : null,
  }));
  const shift = row.best_transposition_semitones;
  const shiftAvailable = scoreAvailable && Number.isInteger(shift) && shift >= -6 && shift <= 6;
  return {
    key: `${text(row.reference_id, "reference")}-${index}`,
    title: text(row.title, "Unnamed reference"),
    creator: text(row.creator, "Creator not reported"),
    rightsBasis: text(row.rights_basis),
    source: sourceLabels[row.feature_source] || text(row.feature_source, "Source not reported"),
    origin: sourceLabels[row.candidate_origin] || text(row.candidate_origin),
    method: text(row.method_version),
    status: malformed ? "Invalid comparison data"
      : inputInsufficient ? "Input insufficient"
        : statuses[row.status]?.[1] || (scoreAvailable ? "Research comparison" : "Comparison unavailable"),
    reason: malformed ? "This comparison contains invalid or contradictory numerical data; scores are withheld."
      : text(row.reason, scoreAvailable ? "" : "No usable numerical comparison was reported."),
    signal: scoreAvailable ? signal : null,
    quality: scoreAvailable ? quality : null,
    components,
    shift: shiftAvailable ? shift : null,
    queryInput,
    referenceInput,
    malformed,
  };
}

export function compositionAnalysisView(value) {
  const present = object(value) && Object.keys(value).length > 0;
  const data = present ? value : {};
  const hasComparisons = Array.isArray(data.comparisons);
  let comparisons = hasComparisons ? data.comparisons.map(comparisonView) : [];
  const countKeys = [
    "catalogue_entries_eligible", "catalogue_entries_available", "catalogue_entries_considered",
    "successful_comparison_count", "references_unavailable", "references_signal_insufficient",
    "catalogue_scan_limit",
  ];
  const invalidCounts = countKeys.some((key) => data[key] != null && !integer(data[key]));
  const actualSuccessful = comparisons.filter((row) => row.signal !== null).length;
  const considered = integer(data.catalogue_entries_considered) ? data.catalogue_entries_considered
    : hasComparisons ? comparisons.length : null;
  const successful = integer(data.successful_comparison_count) ? data.successful_comparison_count
    : hasComparisons ? actualSuccessful : null;
  const eligible = integer(data.catalogue_entries_eligible) ? data.catalogue_entries_eligible : null;
  const available = integer(data.catalogue_entries_available) ? data.catalogue_entries_available : null;
  const unavailable = integer(data.references_unavailable) ? data.references_unavailable : null;
  const insufficient = integer(data.references_signal_insufficient) ? data.references_signal_insufficient : null;
  const queryInput = sufficiencyView(data.query_signal_sufficiency || data.input_sufficiency);
  const contradictingCounts = (successful !== null && successful !== actualSuccessful)
    || (considered !== null && (considered < comparisons.length || considered < actualSuccessful))
    || (considered !== null && unavailable !== null && unavailable + actualSuccessful > considered)
    || (considered !== null && insufficient !== null && insufficient + actualSuccessful > considered)
    || (considered !== null && unavailable !== null && insufficient !== null
      && unavailable + insufficient + actualSuccessful > considered);
  const blockedStatus = data.status && data.status !== "COMPLETED_RESEARCH_ONLY";
  const invalid = invalidCounts || contradictingCounts || comparisons.some((row) => row.malformed)
    || (data.comparisons != null && !hasComparisons)
    || (data.catalogue_scan_truncated != null && typeof data.catalogue_scan_truncated !== "boolean")
    || (actualSuccessful > 0 && (blockedStatus || (queryInput && queryInput.status !== "SUFFICIENT")));
  let [state, status] = statuses[data.status] || ["unavailable", "Analysis unavailable"];
  if (!present) [state, status] = ["absent", "Analysis not recorded"];
  else if (invalid) [state, status] = ["unavailable", "Analysis data could not be validated"];
  else if (queryInput?.status === "INSUFFICIENT") [state, status] = ["insufficient", "Input insufficient"];
  else if (!data.status && actualSuccessful > 0) [state, status] = ["compared", "Legacy research comparisons"];
  else if (state === "compared" && actualSuccessful === 0) [state, status] = ["insufficient", "No usable comparisons"];
  if (invalid) comparisons = comparisons.map((row) => ({
    ...row, signal: null, quality: null, shift: null,
    components: row.components.map((component) => ({ ...component, percent: null })),
    status: "Comparison not validated",
  }));
  const duration = data.query_audio_quality?.analysed_seconds;
  const durationSeconds = typeof duration === "number" && Number.isFinite(duration) && duration > 0 ? duration : null;
  const limit = integer(data.catalogue_scan_limit) ? data.catalogue_scan_limit : null;
  const validSuccessful = invalid ? null : successful;
  const disclosure = validSuccessful > 0 && considered !== null ? (
    `The highest displayed composition signal is the top of ${validSuccessful} successful `
    + `comparison${validSuccessful === 1 ? "" : "s"} among ${considered} selected `
    + `reference${considered === 1 ? "" : "s"}. No multiple-comparison adjustment was applied.`
  ) : null;
  return {
    present, invalid, state, status, comparisons, queryInput, durationSeconds,
    eligible: invalid ? null : eligible,
    available: invalid ? null : available,
    considered: invalid ? null : considered,
    successful: validSuccessful,
    unavailable: invalid ? null : unavailable,
    insufficient: invalid ? null : insufficient,
    limit: invalid ? null : limit,
    truncated: !invalid && data.catalogue_scan_truncated === true,
    coverageReported: !invalid && typeof data.catalogue_scan_truncated === "boolean",
    reason: !present ? "This record has no composition-analysis result. No comparison or clearance can be inferred."
      : invalid ? "The stored composition result contains invalid or contradictory values. Numerical evidence is withheld; this is not a successful analysis."
        : text(data.reason, state === "compared" ? "Named references were compared using the recorded research method."
          : "No usable composition comparison is available in this record."),
    method: text(data.method_version, "Not recorded"),
    manifest: text(data.reference_manifest_version, "Not recorded"),
    disclosure,
  };
}

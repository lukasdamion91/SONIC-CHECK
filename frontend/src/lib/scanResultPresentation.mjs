import {
  ANALYZER_CAPABILITY_MANIFEST_REVISION,
  ANALYZER_IDENTITY,
  ANALYZER_IDENTITY_REVISION,
} from "../constants/analyzerIdentity.mjs";

const count = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
};

const recordingMatches = (result) => (result.matches || []).filter(
  (match) => match?.analysis_type === "recording_identity",
);

const lyricMatches = (result) => (result.matches || []).filter(
  (match) => match?.analysis_type === "lyric_phrase_overlap",
);

const sourceFor = (result, modality) => (result.evidence?.sources || []).find(
  (source) => source?.modality === modality,
) || {};

const submitted = (result, modality) => {
  const modes = result.scan_modes || {};
  const provenance = result.evidence?.provenance || {};
  if (modality === "audio") {
    return modes.audio === true || provenance.audio?.submitted === true;
  }
  return modes.lyrics === true || provenance.lyrics?.submitted === true;
};

const candidateCoverage = (candidateCount) => (
  `${candidateCount} candidate${candidateCount === 1 ? "" : "s"} returned`
);

export function buildChannelCoverageRows(result = {}) {
  const audioSubmitted = submitted(result, "audio");
  const lyricsSubmitted = submitted(result, "lyrics");
  const recordingSource = sourceFor(result, "recording_identity");
  const recording = result.fingerprint || {};
  const recordingCandidateCount = Math.max(
    recordingMatches(result).length,
    count(recordingSource.candidate_count),
  );
  const recordingUsable = [0, 1001].includes(
    Number(recording.status_code ?? recordingSource.status_code),
  );

  let recordingRow;
  if (!audioSubmitted) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "No recording-identity search",
    };
  } else if (recordingCandidateCount > 0) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "candidate_evidence",
      outcome: "Candidate evidence returned",
      coverage: candidateCoverage(recordingCandidateCount),
    };
  } else if (recordingUsable) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "searched_no_candidate",
      outcome: "Decoded and searched — no candidate",
      coverage: "Configured provider search completed",
    };
  } else {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: recording.status_msg || recordingSource.status || "No usable provider result",
    };
  }

  const lyric = result.lyric_analysis || {};
  const lyricSource = sourceFor(result, "lyric_phrase_overlap");
  const lyricCandidateCount = Math.max(lyricMatches(result).length, count(lyricSource.candidate_count));
  const candidatesChecked = Math.max(count(lyric.candidates_checked), count(lyricSource.candidates_with_text));
  const lyricUsable = lyric.source_usable === true
    || (lyric.source_usable == null && count(lyricSource.queries_succeeded) > 0);

  let lyricRow;
  if (!lyricsSubmitted) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "No lyric search",
    };
  } else if (lyricCandidateCount > 0) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "candidate_evidence",
      outcome: "Candidate evidence returned",
      coverage: `${candidateCoverage(lyricCandidateCount)}; ${candidatesChecked} candidate text${candidatesChecked === 1 ? "" : "s"} checked`,
    };
  } else if (lyricUsable) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "searched_no_candidate",
      outcome: "Searched — no candidate",
      coverage: `${candidatesChecked} candidate text${candidatesChecked === 1 ? "" : "s"} checked`,
    };
  } else {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: lyric.summary || lyricSource.status || "No usable lyric-source result",
    };
  }

  const composition = result.composition_analysis || {};
  const comparisons = Array.isArray(composition.comparisons) ? composition.comparisons : [];
  const completed = comparisons.filter((comparison) => comparison?.composition_signal_percent != null).length;
  const completedCount = Math.max(count(composition.successful_comparison_count), completed);
  const consideredCount = Math.max(
    count(composition.catalogue_entries_considered),
    comparisons.length,
    completedCount,
  );
  const unavailableCount = Math.max(count(composition.references_unavailable), consideredCount - completedCount);
  const noComparableReference = new Set([
    "NO_COMPARABLE_REFERENCE",
    "REFERENCE_NOT_REGISTERED",
    "NO_CANDIDATES",
  ]).has(composition.status);

  let compositionRow;
  if (!audioSubmitted || composition.status === "AUDIO_NOT_SUBMITTED") {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "Audio is required for comparison",
    };
  } else if (completedCount > 0) {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "comparison_coverage",
      outcome: "Named-reference comparisons completed",
      coverage: `${completedCount} of ${consideredCount} selected reference${consideredCount === 1 ? "" : "s"} compared${unavailableCount ? `; ${unavailableCount} unavailable` : ""}`,
    };
  } else if (noComparableReference) {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "searched_no_candidate",
      outcome: "Searched — no comparable named reference",
      coverage: `${consideredCount} selected references compared`,
    };
  } else {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: composition.reason || "No successful named-reference comparison",
    };
  }

  return [recordingRow, lyricRow, compositionRow];
}

export function compositionComparisonDisclosure(composition = {}) {
  const comparisons = Array.isArray(composition.comparisons) ? composition.comparisons : [];
  const completed = comparisons.filter((comparison) => comparison?.composition_signal_percent != null).length;
  const completedCount = Math.max(count(composition.successful_comparison_count), completed);
  if (completedCount === 0) return null;
  const consideredCount = Math.max(
    count(composition.catalogue_entries_considered),
    comparisons.length,
    completedCount,
  );
  return {
    completedCount,
    consideredCount,
    text: (
      `The highest displayed composition signal is the top of ${completedCount} successful `
      + `comparison${completedCount === 1 ? "" : "s"} among ${consideredCount} selected `
      + `reference${consideredCount === 1 ? "" : "s"}. No multiple-comparison adjustment was applied.`
    ),
  };
}

const finitePercent = (value) => (
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null
);

const isObject = (value) => Boolean(
  value && typeof value === "object" && !Array.isArray(value),
);

const exactKeys = (value, expected) => (
  isObject(value)
  && Object.keys(value).sort().join("\u001f") === [...expected].sort().join("\u001f")
);

const close = (left, right, tolerance = 1e-9) => (
  Number.isFinite(left)
  && Number.isFinite(right)
  && Math.abs(left - right) <= tolerance
);

const nonnegativeInteger = (value, maximum = Number.MAX_SAFE_INTEGER) => (
  Number.isSafeInteger(value) && value >= 0 && value <= maximum
);

const oneDecimalPercent = (value) => (
  finitePercent(value) !== null && close(value * 10, Math.round(value * 10))
);

const twoDecimalPercent = (value) => (
  finitePercent(value) !== null && close(value * 100, Math.round(value * 100))
);

const sameStringArray = (value, expected) => (
  Array.isArray(value)
  && value.length === expected.length
  && value.every((item, index) => item === expected[index])
);

const sortedUniqueStrings = (value, allowed) => (
  Array.isArray(value)
  && value.every((item) => typeof item === "string" && (!allowed || allowed.has(item)))
  && value.every((item, index) => index === 0 || value[index - 1] < item)
);

const HASH_PATTERN = /^[0-9a-f]{64}$/u;

// Python's V35 digest uses json.dumps(sort_keys=True, separators=(",", ":"),
// ensure_ascii=True). These diagnostics contain integral JSON numbers, so the
// compact canonical form can be reproduced without losing numeric lexemes.
const asciiJsonString = (value) => {
  let output = '"';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22) output += '\\"';
    else if (code === 0x5c) output += "\\\\";
    else if (code === 0x08) output += "\\b";
    else if (code === 0x09) output += "\\t";
    else if (code === 0x0a) output += "\\n";
    else if (code === 0x0c) output += "\\f";
    else if (code === 0x0d) output += "\\r";
    else if (code < 0x20 || code >= 0x7f) output += `\\u${code.toString(16).padStart(4, "0")}`;
    else output += value[index];
  }
  return `${output}"`;
};

const compareCodePoints = (left, right) => {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
};

const canonicalCompactJson = (value) => {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Non-finite diagnostic number");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return asciiJsonString(value);
  if (Array.isArray(value)) return `[${value.map(canonicalCompactJson).join(",")}]`;
  if (!isObject(value)) throw new TypeError("Unsupported diagnostic value");
  const keys = Object.keys(value).sort(compareCodePoints);
  return `{${keys.map((key) => `${asciiJsonString(key)}:${canonicalCompactJson(value[key])}`).join(",")}}`;
};

const SHA256_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (value, countValue) => (value >>> countValue) | (value << (32 - countValue));

const sha256Hex = (source) => {
  const bytes = Array.from(new TextEncoder().encode(source));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xff);

  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + (index * 4);
      words[index] = (
        (bytes[cursor] << 24)
        | (bytes[cursor + 1] << 16)
        | (bytes[cursor + 2] << 8)
        | bytes[cursor + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const prior15 = words[index - 15];
      const prior2 = words[index - 2];
      const sigma0 = rotateRight(prior15, 7) ^ rotateRight(prior15, 18) ^ (prior15 >>> 3);
      const sigma1 = rotateRight(prior2, 17) ^ rotateRight(prior2, 19) ^ (prior2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, index) => {
      state[index] = (state[index] + value) >>> 0;
    });
  }
  return state.map((value) => value.toString(16).padStart(8, "0")).join("");
};

const digestMatches = (value, digestField) => {
  if (!isObject(value) || !HASH_PATTERN.test(value[digestField] || "")) return false;
  const material = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== digestField),
  );
  try {
    return sha256Hex(canonicalCompactJson(material)) === value[digestField];
  } catch {
    return false;
  }
};

const V34_VERSION = "soniccheck-v34-partial-identification/1.0.0-research";
const V33_SOURCE_TUPLES = new Set([
  [
    "soniccheck-entity-bounded-evidence/0.5.0-research",
    "soniccheck-evidence-disposition/1.1.0-research",
    "soniccheck-evidence-disposition/1.1.0-research",
    "soniccheck-entity-bounded-evidence/0.5.0-research",
  ].join("\u001f"),
  [
    "soniccheck-entity-bounded-evidence/0.5.2-research",
    "soniccheck-evidence-disposition/1.1.2-research",
    "soniccheck-evidence-disposition/1.1.2-research",
    "soniccheck-entity-bounded-evidence/0.5.2-research",
  ].join("\u001f"),
]);
const CURRENT_V33_TUPLE = [
  "soniccheck-entity-bounded-evidence/0.5.2-research",
  "soniccheck-evidence-disposition/1.1.2-research",
  "soniccheck-evidence-disposition/1.1.2-research",
  "soniccheck-entity-bounded-evidence/0.5.2-research",
].join("\u001f");
const V34_MODALITIES = ["recording_identity", "lyric_overlap", "composition_similarity"];
const V34_MAXIMUM_POINTS = [30, 30, 40];
const V34_RESOLVED_OUTCOMES = new Set([
  "CANDIDATES_REPORTED", "CHECKED_NO_CANDIDATE", "ABSTAIN_RESEARCH_ONLY",
]);
const V34_UNRESOLVED_OUTCOMES = new Set([
  "ABSTAIN_NOT_CONFIGURED", "ABSTAIN_PROVIDER_UNAVAILABLE",
  "ABSTAIN_METHOD_INAPPLICABLE", "ABSTAIN_INCOMPLETE_PROVENANCE",
]);
const V34_UNAVAILABLE_REASONS = new Set([
  "INVALID_SCORE_AVAILABILITY", "V33_SCORE_NOT_AVAILABLE",
  "NO_SELECTED_CANDIDATE_ENTITY", "INVALID_SELECTED_ENTITY_GROUP_ID",
  "INVALID_V33_SCORE", "INVALID_CONTRIBUTION_MAP", "INVALID_CHANNEL_OUTCOME_MAP",
  "INVALID_CHANNEL_OUTCOME", "NON_CANONICAL_CHANNEL_OUTCOME",
  "UNSUPPORTED_CHANNEL_OUTCOME", "INCONSISTENT_CHANNEL_OUTCOME_FOR_MODALITY",
  "INCONSISTENT_CONTRIBUTION_CHANNEL_OUTCOME", "INVALID_ENTITY_CONTRIBUTION",
  "INCONSISTENT_ENTITY_CONTRIBUTION", "NO_SELECTED_ENTITY_CONTRIBUTION",
  "INCONSISTENT_V33_SCORE_TOTAL",
]);
const V34_ASSUMPTIONS = [
  "Observed exact-entity contributions retain their V33 values.",
  "Each unresolved channel may contribute from zero to its fixed maximum.",
  "A completed channel without an exactly linked observation contributes zero for this captured-evidence estimand.",
  "No distribution, sampling error, provider recall, or model error is inferred.",
  "The selected entity group and exact-linkage projection are held fixed; candidate regrouping is outside the envelope.",
];
const V34_KEYS = [
  "version", "estimand", "estimand_scope", "selected_entity_invariant_assumed",
  "exact_linkage_invariant_assumed", "candidate_regrouping_covered", "available",
  "status", "reason_code", "selected_entity_group_id", "observed_score_percent",
  "lower_bound_percent", "upper_bound_percent", "interval_width_percent",
  "resolved_weight_percent", "unresolved_weight_percent", "point_identified",
  "components", "calibration_status", "probability_interpretation", "accuracy_claim",
  "provider_recall_covered", "model_error_covered", "sampling_uncertainty_covered",
  "latent_real_world_evidence_covered", "changes_review_routing", "provider_calls",
  "offline_deterministic", "assumptions",
];
const V34_COMPONENT_KEYS = [
  "modality", "channel_outcome", "state", "maximum_points", "observed_points",
  "lower_points", "upper_points", "unresolved",
];

const validV34FixedBoundary = (value) => (
  exactKeys(value, V34_KEYS)
  && value.version === V34_VERSION
  && value.estimand === "V33_FIXED_SELECTED_ENTITY_CAPTURED_EVIDENCE_SCORE"
  && value.estimand_scope === "FIXED_SELECTED_ENTITY_AND_EXACT_LINKAGE_CAPTURED_CANDIDATE_SET_ONLY"
  && value.selected_entity_invariant_assumed === true
  && value.exact_linkage_invariant_assumed === true
  && value.candidate_regrouping_covered === false
  && value.calibration_status === "NOT_A_CALIBRATED_CONFIDENCE_INTERVAL"
  && value.probability_interpretation === false
  && value.accuracy_claim === false
  && value.provider_recall_covered === false
  && value.model_error_covered === false
  && value.sampling_uncertainty_covered === false
  && value.latent_real_world_evidence_covered === false
  && value.changes_review_routing === false
  && value.provider_calls === false
  && value.offline_deterministic === true
  && sameStringArray(value.assumptions, V34_ASSUMPTIONS)
);

export function structuralMissingnessView(similarity = {}) {
  const confidence = similarity?.evidence_confidence;
  const value = confidence?.partial_identification;
  if (!value || typeof value !== "object") return null;
  if (value.version !== V34_VERSION) {
    return { available: false, reason: "Unsupported V34 method version" };
  }
  if (!validV34FixedBoundary(value)) {
    return { available: false, reason: "Invalid V34 scientific boundary" };
  }
  const enclosingTuple = [
    similarity.method_version,
    similarity.disposition_method_version,
    similarity.review_triage?.version,
    confidence?.score_method_version,
  ].join("\u001f");
  if (!V33_SOURCE_TUPLES.has(enclosingTuple)) {
    return { available: false, reason: "Unsupported enclosing V33 contract" };
  }
  if (value.available !== true) {
    const unavailableValid = (
      value.available === false
      && value.status === "NOT_AVAILABLE"
      && V34_UNAVAILABLE_REASONS.has(value.reason_code)
      && value.selected_entity_group_id === null
      && value.observed_score_percent === null
      && value.lower_bound_percent === null
      && value.upper_bound_percent === null
      && value.interval_width_percent === null
      && value.resolved_weight_percent === 0
      && value.unresolved_weight_percent === 100
      && value.point_identified === false
      && Array.isArray(value.components)
      && value.components.length === 0
    );
    return {
      available: false,
      reason: unavailableValid ? value.reason_code : "Invalid V34 envelope",
    };
  }
  if (
    confidence?.available !== true
    || confidence?.scored_entity_group_id !== value.selected_entity_group_id
    || typeof value.selected_entity_group_id !== "string"
    || !value.selected_entity_group_id
    || value.selected_entity_group_id.trim() !== value.selected_entity_group_id
    || value.reason_code !== null
  ) {
    return { available: false, reason: "Invalid V34 envelope" };
  }
  if (enclosingTuple === CURRENT_V33_TUPLE) {
    const selectedGroups = Array.isArray(similarity.review_triage?.candidate_groups)
      ? similarity.review_triage.candidate_groups.filter(
        (group) => isObject(group) && group.group_id === value.selected_entity_group_id,
      )
      : [];
    const group = selectedGroups[0];
    if (
      selectedGroups.length !== 1
      || group.score_ineligible_context !== false
      || group.entity_linkage_eligible !== true
      || group.identifier_conflict !== false
      || group.ambiguous_linkage !== false
      || !new Set(["EXACT_IDENTIFIER", "UNLINKED_ISOLATED"]).has(group.linkage)
    ) {
      return { available: false, reason: "Invalid V34 selected-entity binding" };
    }
  }
  const observed = finitePercent(value.observed_score_percent);
  const lower = finitePercent(value.lower_bound_percent);
  const upper = finitePercent(value.upper_bound_percent);
  const resolved = finitePercent(value.resolved_weight_percent);
  const unresolved = finitePercent(value.unresolved_weight_percent);
  const width = finitePercent(value.interval_width_percent);
  if (
    [observed, lower, upper, resolved, unresolved, width].includes(null)
    || ![observed, lower, upper, resolved, unresolved, width].every(oneDecimalPercent)
    || finitePercent(confidence?.value) === null
    || !close(lower, observed)
    || !close(resolved + unresolved, 100)
    || !close(confidence.value, observed)
    || !close(upper, Math.round(Math.min(100, observed + unresolved) * 10) / 10)
    || !close(width, Math.round((upper - lower) * 10) / 10)
    || value.point_identified !== (unresolved === 0)
    || value.status !== (unresolved === 0 ? "POINT_IDENTIFIED" : "PARTIALLY_IDENTIFIED")
  ) {
    return { available: false, reason: "Invalid V34 envelope" };
  }
  if (!Array.isArray(value.components) || value.components.length !== 3) {
    return { available: false, reason: "Invalid V34 components" };
  }
  let componentObserved = 0;
  let componentResolved = 0;
  let componentUnresolved = 0;
  let linkedComponents = 0;
  for (let index = 0; index < value.components.length; index += 1) {
    const component = value.components[index];
    const maximum = V34_MAXIMUM_POINTS[index];
    if (
      !exactKeys(component, V34_COMPONENT_KEYS)
      || component.modality !== V34_MODALITIES[index]
      || component.maximum_points !== maximum
      || !twoDecimalPercent(component.observed_points)
      || !twoDecimalPercent(component.lower_points)
      || !twoDecimalPercent(component.upper_points)
      || component.upper_points > maximum
      || typeof component.channel_outcome !== "string"
      || component.channel_outcome.trim() !== component.channel_outcome
    ) {
      return { available: false, reason: "Invalid V34 components" };
    }
    if (component.state === "OBSERVED_LINKED_SIGNAL") {
      const expectedOutcome = index === 2 ? "ABSTAIN_RESEARCH_ONLY" : "CANDIDATES_REPORTED";
      if (
        component.channel_outcome !== expectedOutcome
        || component.unresolved !== false
        || !close(component.observed_points, component.lower_points)
        || !close(component.observed_points, component.upper_points)
      ) return { available: false, reason: "Invalid V34 components" };
      componentResolved += maximum;
      linkedComponents += 1;
    } else if (component.state === "OBSERVED_NO_LINKED_SIGNAL") {
      const outcomeAllowed = V34_RESOLVED_OUTCOMES.has(component.channel_outcome)
        && (index === 2
          ? component.channel_outcome === "ABSTAIN_RESEARCH_ONLY"
          : component.channel_outcome !== "ABSTAIN_RESEARCH_ONLY");
      if (
        !outcomeAllowed
        || component.unresolved !== false
        || component.observed_points !== 0
        || component.lower_points !== 0
        || component.upper_points !== 0
      ) return { available: false, reason: "Invalid V34 components" };
      componentResolved += maximum;
    } else if (component.state === "UNRESOLVED_CHANNEL") {
      const outcomeAllowed = component.channel_outcome === "OUTCOME_NOT_RECORDED"
        || V34_UNRESOLVED_OUTCOMES.has(component.channel_outcome);
      if (
        !outcomeAllowed
        || component.unresolved !== true
        || component.observed_points !== 0
        || component.lower_points !== 0
        || component.upper_points !== maximum
      ) return { available: false, reason: "Invalid V34 components" };
      componentUnresolved += maximum;
    } else {
      return { available: false, reason: "Invalid V34 components" };
    }
    componentObserved += component.observed_points;
  }
  if (
    linkedComponents === 0
    || !close(componentObserved, observed, 0.066)
    || !close(componentResolved, resolved)
    || !close(componentUnresolved, unresolved)
  ) return { available: false, reason: "Invalid V34 components" };
  return {
    available: true,
    observed,
    lower,
    upper,
    unresolved,
    pointIdentified: value.point_identified === true,
  };
}

const V36_VERSION = "soniccheck-channel-loss-sensitivity/1.0.0-research";
const V36_ENTITY_VERSION = "soniccheck-entity-bounded-evidence/0.5.2-research";
const V36_DISPOSITION_VERSION = "soniccheck-evidence-disposition/1.1.2-research";
const V36_MODALITIES = new Set(V34_MODALITIES);
const V36_REVIEW_STABILITY = new Set([
  "FRAGILE_TO_SINGLE_CHANNEL_LOSS", "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS",
]);
const V36_CHANGE_STABILITY = new Set([
  "CHANGES_UNDER_SINGLE_CHANNEL_LOSS", "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS",
]);
const V36_DECISIONS = new Set([
  "REVIEW_EVIDENCE_PRESENT", "NO_CANDIDATE_COMPLETE_OPERATIONAL_SCOPE",
  "NO_CANDIDATE_PARTIAL_OPERATIONAL_SCOPE", "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL",
]);
const V36_SCOPES = new Set(["COMPLETE", "PARTIAL", "NO_USABLE_CHANNEL"]);
const V36_OUTCOMES = new Set([
  "CANDIDATES_REPORTED", "CHECKED_NO_CANDIDATE", "ABSTAIN_NOT_CONFIGURED",
  "ABSTAIN_PROVIDER_UNAVAILABLE", "ABSTAIN_METHOD_INAPPLICABLE",
  "ABSTAIN_RESEARCH_ONLY", "ABSTAIN_INCOMPLETE_PROVENANCE",
]);
const V36_BASELINE_KEYS = [
  "decision_projection", "review_required", "review_evidence_observation_count",
  "review_entity_group_count", "review_evidence_signature_sha256", "entity_score_available",
  "entity_bounded_score_points", "selected_entity_group_id", "evidence_observation_count",
  "candidate_group_count", "screening_scope", "usable_operational_channel_count",
  "applicable_operational_channel_count", "possible_operational_channel_count", "channel_outcomes",
];
const V36_SUMMARY_KEYS = [
  "evaluated_scenario_count", "evaluated_scenario_count_out_of",
  "review_requirement_stability", "review_evidence_projection_stability",
  "decision_projection_stability", "review_critical_modalities",
  "review_evidence_changing_modalities", "decision_changing_modalities",
  "abstention_critical_modalities", "selected_entity_changing_modalities",
  "entity_score_availability_changing_modalities", "maximum_entity_score_drop_points",
  "maximum_entity_score_increase_points", "maximum_absolute_entity_score_change_points",
  "baseline_and_counterfactual_entity_score_range_points",
];
const V36_INTERPRETATION = (
  "Structural sensitivity to losing one already-observed channel. Stability here does not imply "
  + "correctness, calibration, originality, clearance, or resilience to missing catalogue coverage, "
  + "correlated errors, or multiple simultaneous channel failures."
);
const V36_ABSTENTION_INTERPRETATION = (
  "No channel-loss sensitivity metrics were published because the V33 projection failed the V36 input contract."
);

const decisionMatches = (projection) => {
  if (!isObject(projection) || !V36_DECISIONS.has(projection.decision_projection)) return false;
  if (projection.review_required === true) return projection.decision_projection === "REVIEW_EVIDENCE_PRESENT";
  if (projection.review_required !== false) return false;
  if (projection.screening_scope === "NO_USABLE_CHANNEL") {
    return projection.decision_projection === "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL";
  }
  return projection.decision_projection === (
    projection.screening_scope === "COMPLETE"
      ? "NO_CANDIDATE_COMPLETE_OPERATIONAL_SCOPE"
      : "NO_CANDIDATE_PARTIAL_OPERATIONAL_SCOPE"
  );
};

const validProjectionCounts = (projection) => (
  nonnegativeInteger(projection.review_evidence_observation_count)
  && nonnegativeInteger(projection.review_entity_group_count)
  && nonnegativeInteger(projection.evidence_observation_count)
  && nonnegativeInteger(projection.candidate_group_count)
  && nonnegativeInteger(projection.usable_operational_channel_count, 2)
  && nonnegativeInteger(projection.applicable_operational_channel_count, 2)
  && projection.possible_operational_channel_count === 2
  && projection.usable_operational_channel_count <= projection.applicable_operational_channel_count
  && projection.review_evidence_observation_count <= projection.evidence_observation_count
  && projection.review_entity_group_count <= projection.candidate_group_count
  && (projection.review_required
    ? projection.review_evidence_observation_count > 0 && projection.review_entity_group_count > 0
    : projection.review_evidence_observation_count === 0 && projection.review_entity_group_count === 0)
);

const validEntityProjection = (projection) => {
  if (projection.entity_score_available === true) {
    return oneDecimalPercent(projection.entity_bounded_score_points)
      && typeof projection.selected_entity_group_id === "string"
      && projection.selected_entity_group_id.length > 0;
  }
  return projection.entity_score_available === false
    && projection.entity_bounded_score_points === null
    && projection.selected_entity_group_id === null;
};

const operationalProjection = (outcomes) => {
  const applicable = ["recording_identity", "lyric_overlap"].filter(
    (modality) => outcomes[modality] !== "ABSTAIN_METHOD_INAPPLICABLE",
  );
  const usable = applicable.filter((modality) => new Set([
    "CANDIDATES_REPORTED", "CHECKED_NO_CANDIDATE",
  ]).has(outcomes[modality]));
  return {
    applicable: applicable.length,
    usable: usable.length,
    scope: usable.length === 0 ? "NO_USABLE_CHANNEL"
      : usable.length === applicable.length ? "COMPLETE" : "PARTIAL",
  };
};

const validV36Baseline = (baseline) => {
  if (
    !exactKeys(baseline, V36_BASELINE_KEYS)
    || !decisionMatches(baseline)
    || !V36_SCOPES.has(baseline.screening_scope)
    || !HASH_PATTERN.test(baseline.review_evidence_signature_sha256 || "")
    || !validProjectionCounts(baseline)
    || !validEntityProjection(baseline)
    || !exactKeys(baseline.channel_outcomes, V34_MODALITIES)
    || !V34_MODALITIES.every((modality) => V36_OUTCOMES.has(baseline.channel_outcomes[modality]))
    || baseline.channel_outcomes.composition_similarity === "CANDIDATES_REPORTED"
    || baseline.channel_outcomes.composition_similarity === "CHECKED_NO_CANDIDATE"
    || baseline.channel_outcomes.recording_identity === "ABSTAIN_RESEARCH_ONLY"
    || baseline.channel_outcomes.lyric_overlap === "ABSTAIN_RESEARCH_ONLY"
  ) return false;
  const projected = operationalProjection(baseline.channel_outcomes);
  return baseline.usable_operational_channel_count === projected.usable
    && baseline.applicable_operational_channel_count === projected.applicable
    && baseline.screening_scope === projected.scope;
};

const V36_EVALUATED_SCENARIO_KEYS = [
  "removed_modality", "evaluated", "source_outcome", "counterfactual_channel_outcome",
  "decision_projection", "decision_projection_changed", "review_required",
  "review_requirement_changed", "review_evidence_observation_count", "review_entity_group_count",
  "review_evidence_signature_sha256", "review_evidence_projection_changed",
  "became_no_usable_operational_abstention", "entity_score_available",
  "entity_score_availability_changed", "entity_bounded_score_points", "entity_score_change_points",
  "selected_entity_group_id", "selected_entity_changed", "evidence_observation_count",
  "candidate_group_count", "screening_scope", "usable_operational_channel_count",
  "applicable_operational_channel_count", "possible_operational_channel_count",
];
const V36_UNEVALUATED_SCENARIO_KEYS = [
  "removed_modality", "evaluated", "reason", "source_outcome",
];

const validV36Scenario = (scenario, baseline) => {
  if (!isObject(scenario) || !V36_MODALITIES.has(scenario.removed_modality)) return false;
  if (scenario.source_outcome !== baseline.channel_outcomes[scenario.removed_modality]) return false;
  const lossApplicable = scenario.removed_modality === "composition_similarity"
    ? scenario.source_outcome === "ABSTAIN_RESEARCH_ONLY"
    : new Set(["CANDIDATES_REPORTED", "CHECKED_NO_CANDIDATE"]).has(scenario.source_outcome);
  if (scenario.evaluated === false) {
    return exactKeys(scenario, V36_UNEVALUATED_SCENARIO_KEYS)
      && scenario.reason === "CHANNEL_NOT_OBSERVED_AS_USABLE"
      && (scenario.removed_modality === "composition_similarity" || lossApplicable === false);
  }
  if (
    !exactKeys(scenario, V36_EVALUATED_SCENARIO_KEYS)
    || scenario.evaluated !== true
    || !lossApplicable
  ) return false;
  if (
    scenario.counterfactual_channel_outcome !== "ABSTAIN_COUNTERFACTUAL_CHANNEL_LOSS"
    || !V36_SCOPES.has(scenario.screening_scope)
    || !HASH_PATTERN.test(scenario.review_evidence_signature_sha256 || "")
    || !validProjectionCounts(scenario)
    || !validEntityProjection(scenario)
    || !decisionMatches(scenario)
  ) return false;
  const counterfactualOutcomes = {
    ...baseline.channel_outcomes,
    [scenario.removed_modality]: "ABSTAIN_PROVIDER_UNAVAILABLE",
  };
  const projected = operationalProjection(counterfactualOutcomes);
  const booleanRelations = (
    scenario.decision_projection_changed === (scenario.decision_projection !== baseline.decision_projection)
    && scenario.review_requirement_changed === (scenario.review_required !== baseline.review_required)
    && scenario.review_evidence_projection_changed === (
      scenario.review_evidence_signature_sha256 !== baseline.review_evidence_signature_sha256
    )
    && scenario.entity_score_availability_changed === (
      scenario.entity_score_available !== baseline.entity_score_available
    )
    && scenario.selected_entity_changed === (
      scenario.selected_entity_group_id !== baseline.selected_entity_group_id
    )
    && scenario.became_no_usable_operational_abstention === (
      scenario.decision_projection === "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL"
      && baseline.decision_projection !== "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL"
    )
  );
  if (
    !booleanRelations
    || scenario.usable_operational_channel_count !== projected.usable
    || scenario.applicable_operational_channel_count !== projected.applicable
    || scenario.screening_scope !== projected.scope
    || scenario.evidence_observation_count > baseline.evidence_observation_count
    || scenario.review_evidence_observation_count > baseline.review_evidence_observation_count
  ) return false;
  if (scenario.entity_score_change_points === null) {
    return scenario.entity_bounded_score_points === null || baseline.entity_bounded_score_points === null;
  }
  return typeof scenario.entity_score_change_points === "number"
    && Number.isFinite(scenario.entity_score_change_points)
    && scenario.entity_score_change_points >= -100
    && scenario.entity_score_change_points <= 100
    && oneDecimalPercent(Math.abs(scenario.entity_score_change_points))
    && scenario.entity_bounded_score_points !== null
    && baseline.entity_bounded_score_points !== null
    && close(
      scenario.entity_score_change_points,
      Math.round((scenario.entity_bounded_score_points - baseline.entity_bounded_score_points) * 10) / 10,
    );
};

const modalityList = (scenarios, predicate) => scenarios
  .filter((scenario) => scenario.evaluated && predicate(scenario))
  .map((scenario) => scenario.removed_modality)
  .sort();

const validV36Summary = (summary, scenarios, baseline) => {
  if (!exactKeys(summary, V36_SUMMARY_KEYS)) return false;
  const evaluated = scenarios.filter((scenario) => scenario.evaluated);
  if (
    summary.evaluated_scenario_count !== evaluated.length
    || summary.evaluated_scenario_count_out_of !== 3
    || !nonnegativeInteger(summary.evaluated_scenario_count, 3)
  ) return false;
  const expectedLists = {
    review_critical_modalities: modalityList(scenarios, (scenario) => scenario.review_requirement_changed),
    review_evidence_changing_modalities: modalityList(scenarios, (scenario) => scenario.review_evidence_projection_changed),
    decision_changing_modalities: modalityList(scenarios, (scenario) => scenario.decision_projection_changed),
    abstention_critical_modalities: modalityList(scenarios, (scenario) => scenario.became_no_usable_operational_abstention),
    selected_entity_changing_modalities: modalityList(scenarios, (scenario) => scenario.selected_entity_changed),
    entity_score_availability_changing_modalities: modalityList(
      scenarios, (scenario) => scenario.entity_score_availability_changed,
    ),
  };
  if (Object.entries(expectedLists).some(([key, expected]) => !sameStringArray(summary[key], expected))) {
    return false;
  }
  const expectedReview = expectedLists.review_critical_modalities.length
    ? "FRAGILE_TO_SINGLE_CHANNEL_LOSS"
    : evaluated.length ? "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS" : "NOT_EVALUABLE_NO_OBSERVED_CHANNEL";
  const expectedReviewEvidence = expectedLists.review_evidence_changing_modalities.length
    ? "CHANGES_UNDER_SINGLE_CHANNEL_LOSS"
    : evaluated.length ? "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS" : "NOT_EVALUABLE_NO_OBSERVED_CHANNEL";
  const expectedDecision = expectedLists.decision_changing_modalities.length
    ? "CHANGES_UNDER_SINGLE_CHANNEL_LOSS"
    : evaluated.length ? "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS" : "NOT_EVALUABLE_NO_OBSERVED_CHANNEL";
  if (
    !(V36_REVIEW_STABILITY.has(summary.review_requirement_stability)
      || summary.review_requirement_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL")
    || !(V36_CHANGE_STABILITY.has(summary.review_evidence_projection_stability)
      || summary.review_evidence_projection_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL")
    || !(V36_CHANGE_STABILITY.has(summary.decision_projection_stability)
      || summary.decision_projection_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL")
    || summary.review_requirement_stability !== expectedReview
    || summary.review_evidence_projection_stability !== expectedReviewEvidence
    || summary.decision_projection_stability !== expectedDecision
  ) return false;
  const changes = evaluated
    .map((scenario) => scenario.entity_score_change_points)
    .filter((value) => typeof value === "number");
  const expectedDrop = changes.length ? Math.round(Math.max(...changes.map((value) => Math.max(0, -value))) * 10) / 10 : null;
  const expectedIncrease = changes.length ? Math.round(Math.max(...changes.map((value) => Math.max(0, value))) * 10) / 10 : null;
  const expectedAbsolute = changes.length ? Math.round(Math.max(...changes.map(Math.abs)) * 10) / 10 : null;
  if (
    summary.maximum_entity_score_drop_points !== expectedDrop
    || summary.maximum_entity_score_increase_points !== expectedIncrease
    || summary.maximum_absolute_entity_score_change_points !== expectedAbsolute
  ) return false;
  const scores = [baseline.entity_bounded_score_points, ...evaluated.map(
    (scenario) => scenario.entity_bounded_score_points,
  )].filter((value) => typeof value === "number");
  const expectedRange = scores.length
    ? { minimum: Math.min(...scores), maximum: Math.max(...scores) }
    : null;
  const range = summary.baseline_and_counterfactual_entity_score_range_points;
  return (
    (range === null && expectedRange === null)
    || (
      exactKeys(range, ["minimum", "maximum"])
      && oneDecimalPercent(range.minimum)
      && oneDecimalPercent(range.maximum)
      && range.minimum <= range.maximum
      && range.minimum === expectedRange?.minimum
      && range.maximum === expectedRange?.maximum
    )
  );
};

export function channelLossSensitivityView(similarity = {}) {
  const value = similarity?.channel_loss_sensitivity;
  if (!value || typeof value !== "object") return null;
  const boundaryValid = (
    value.version === V36_VERSION
    && value.mode === "SHADOW_ONLY"
    && value.authoritative_status_changed === false
    && value.legal_determination === false
    && value.causal_interpretation === false
    && value.calibrated_confidence === false
    && value.accuracy_estimate === false
    && value.clearance_determination === false
  );
  if (!boundaryValid) {
    return { available: false, reason: "Invalid or unsupported V36 diagnostic" };
  }
  if (value.status === "ABSTAIN_INVALID_V33_PROJECTION") {
    const abstentionKeys = [
      "version", "status", "evaluated", "mode", "validation_errors",
      "authoritative_status_changed", "legal_determination", "causal_interpretation",
      "calibrated_confidence", "accuracy_estimate", "clearance_determination", "interpretation",
    ];
    const valid = exactKeys(value, abstentionKeys)
      && value.evaluated === false
      && Array.isArray(value.validation_errors)
      && value.validation_errors.length === 1
      && typeof value.validation_errors[0] === "string"
      && /^[A-Z][A-Z0-9_]{0,127}$/u.test(value.validation_errors[0])
      && value.interpretation === V36_ABSTENTION_INTERPRETATION;
    return {
      available: false,
      reason: valid ? value.validation_errors[0] : "Invalid V36 abstention",
    };
  }
  const fullKeys = [
    "version", "status", "evaluated", "mode", "method", "source_disposition_version",
    "source_entity_score_method_version", "baseline", "scenarios", "summary",
    "authoritative_status_changed", "provider_requests_made", "legal_determination",
    "causal_interpretation", "calibrated_confidence", "accuracy_estimate",
    "clearance_determination", "interpretation",
  ];
  if (
    !exactKeys(value, fullKeys)
    || value.method !== "NON_CAUSAL_DETERMINISTIC_LEAVE_ONE_OBSERVED_CHANNEL_OUT"
    || value.source_disposition_version !== V36_DISPOSITION_VERSION
    || value.source_entity_score_method_version !== V36_ENTITY_VERSION
    || similarity.method_version !== V36_ENTITY_VERSION
    || similarity.disposition_method_version !== V36_DISPOSITION_VERSION
    || similarity.review_triage?.version !== V36_DISPOSITION_VERSION
    || similarity.evidence_confidence?.score_method_version !== V36_ENTITY_VERSION
    || value.provider_requests_made !== 0
    || value.interpretation !== V36_INTERPRETATION
    || !validV36Baseline(value.baseline)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length !== 3
    || value.scenarios.some((scenario, index) => (
      scenario.removed_modality !== V34_MODALITIES[index]
      || !validV36Scenario(scenario, value.baseline)
    ))
    || !validV36Summary(value.summary, value.scenarios, value.baseline)
  ) {
    return { available: false, reason: "Invalid or unsupported V36 diagnostic" };
  }
  const evaluatedCount = value.scenarios.filter((scenario) => scenario.evaluated).length;
  if (value.evaluated !== true) {
    const validUnavailable = value.evaluated === false
      && value.status === "NOT_EVALUATED_NO_APPLICABLE_OBSERVED_CHANNEL"
      && evaluatedCount === 0
      && value.summary.review_requirement_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL"
      && value.summary.review_evidence_projection_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL"
      && value.summary.decision_projection_stability === "NOT_EVALUABLE_NO_OBSERVED_CHANNEL";
    return {
      available: false,
      reason: validUnavailable ? value.status : "Invalid V36 non-evaluation",
    };
  }
  const summary = value.summary;
  if (value.status !== "EVALUATED_SHADOW_ONLY" || evaluatedCount < 1) {
    return { available: false, reason: "Invalid V36 evaluation status" };
  }
  return {
    available: true,
    status: value.status,
    evaluated: summary.evaluated_scenario_count,
    possible: summary.evaluated_scenario_count_out_of,
    reviewStability: summary.review_requirement_stability,
    decisionStability: summary.decision_projection_stability,
    maximumChange: summary.maximum_absolute_entity_score_change_points,
  };
}

const EXPECTED_CAPABILITIES = [
  {
    capability_id: "v34_structural_missingness_bounds",
    scientific_stage: "V34",
    method_version: V34_VERSION,
    runtime_state: "RUNTIME_SHADOW_OUTPUT",
    output_path: "similarity_analysis.evidence_confidence.partial_identification",
    automatic_scan_attachment: true,
    additional_provider_requests_made_by_capability: 0,
    authoritative_status_changed: false,
    payment_gate_changed: false,
  },
  {
    capability_id: "v35_multi_view_consistency",
    scientific_stage: "V35",
    method_version: "soniccheck-v35-exact-identity-invariance/0.1.0-research",
    runtime_state: "RUNTIME_DIAGNOSTIC_ENDPOINT",
    output_path: "POST /api/diagnostics/multiview-consistency",
    automatic_scan_attachment: false,
    additional_provider_requests_made_by_capability: 0,
    authoritative_status_changed: false,
    payment_gate_changed: false,
  },
  {
    capability_id: "v36_channel_loss_sensitivity",
    scientific_stage: "V36",
    method_version: V36_VERSION,
    runtime_state: "RUNTIME_SHADOW_OUTPUT",
    output_path: "similarity_analysis.channel_loss_sensitivity",
    automatic_scan_attachment: true,
    additional_provider_requests_made_by_capability: 0,
    authoritative_status_changed: false,
    payment_gate_changed: false,
  },
];
const EXPECTED_CAPABILITY_BODY = {
  revision: ANALYZER_CAPABILITY_MANIFEST_REVISION,
  analyzer_label: ANALYZER_IDENTITY,
  capabilities: EXPECTED_CAPABILITIES,
};
const EXPECTED_CAPABILITY_SHA256 = sha256Hex(canonicalCompactJson(EXPECTED_CAPABILITY_BODY));

const validTechnicalVersion = (value) => (
  typeof value === "string"
  && value.length > 0
  && value.length <= 200
  && value === value.trim()
  && !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
);

export function storedAnalyzerLabel(result = {}) {
  const analyzer = result?.analyzer;
  const technicalVersion = result?.analysis_version;
  if (
    !validTechnicalVersion(technicalVersion)
    || !isObject(analyzer)
    || analyzer.canonical_name !== "HARRY"
    || analyzer.versioned_label !== ANALYZER_IDENTITY
    || analyzer.scientific_v_series !== "V36"
    || analyzer.technical_analysis_version !== technicalVersion
  ) return null;
  if (analyzer.identity_revision === ANALYZER_IDENTITY_REVISION) {
    const keys = [
      "canonical_name", "versioned_label", "scientific_v_series", "identity_revision",
      "technical_analysis_version", "capability_manifest_revision", "capability_manifest_sha256",
    ];
    return exactKeys(analyzer, keys)
      && analyzer.capability_manifest_revision === ANALYZER_CAPABILITY_MANIFEST_REVISION
      && analyzer.capability_manifest_sha256 === EXPECTED_CAPABILITY_SHA256
      ? analyzer.versioned_label : null;
  }
  if (analyzer.identity_revision === "soniccheck-harry-identity/1.1.0") {
    const keys = [
      "canonical_name", "versioned_label", "scientific_v_series", "identity_revision",
      "technical_analysis_version",
    ];
    return exactKeys(analyzer, keys) ? analyzer.versioned_label : null;
  }
  return null;
}

export function currentAnalyzerDiagnosticViews(result = {}) {
  const analyzer = result?.analyzer;
  const isCurrentCapabilityBoundHarry = (
    analyzer?.identity_revision === ANALYZER_IDENTITY_REVISION
    && storedAnalyzerLabel(result) === ANALYZER_IDENTITY
  );
  if (!isCurrentCapabilityBoundHarry) {
    return {
      isCurrentCapabilityBoundHarry: false,
      v34: null,
      v36: null,
    };
  }
  const similarity = result?.similarity_analysis || {};
  return {
    isCurrentCapabilityBoundHarry: true,
    v34: structuralMissingnessView(similarity),
    v36: channelLossSensitivityView(similarity),
  };
}

const validPublicAnalyzer = (analyzer) => {
  const identityKeys = [
    "canonical_name", "versioned_label", "product", "role", "identity_revision",
    "scientific_v_series", "completed_v_series_through", "capability_manifest",
  ];
  if (
    !exactKeys(analyzer, identityKeys)
    || analyzer.canonical_name !== "HARRY"
    || analyzer.versioned_label !== ANALYZER_IDENTITY
    || analyzer.product !== "SONIC CHECK"
    || analyzer.role !== "evidence-screening analyzer"
    || analyzer.identity_revision !== ANALYZER_IDENTITY_REVISION
    || analyzer.scientific_v_series !== "V36"
    || analyzer.completed_v_series_through !== "V36"
  ) return false;
  const manifest = analyzer.capability_manifest;
  if (!exactKeys(manifest, ["revision", "analyzer_label", "capabilities", "sha256"])) return false;
  return manifest.sha256 === EXPECTED_CAPABILITY_SHA256
    && digestMatches(manifest, "sha256")
    && canonicalCompactJson({
      revision: manifest.revision,
      analyzer_label: manifest.analyzer_label,
      capabilities: manifest.capabilities,
    }) === canonicalCompactJson(EXPECTED_CAPABILITY_BODY);
};

const V35_STATUSES = new Set([
  "INSUFFICIENT_IDENTITY_PRESERVING_VIEWS", "EXACT_VIEW_DIVERGENCE_OBSERVED",
  "NO_EXACT_VIEW_DIVERGENCE_OBSERVED", "CONSISTENT_CHECKED_NO_CANDIDATE_OBSERVED",
  "NO_EXACT_IDENTIFIER_COMPARISONS",
]);
const V35_PAIR_STATUSES = new Set([
  "RESEARCH_CONTEXT_CANDIDATE_PRESENCE_DIVERGENCE", "CONSISTENT_RESEARCH_CONTEXT_EMPTY",
  "NOT_COMPARABLE_RESEARCH_CONTEXT_NO_EXACT_IDENTIFIER", "RESEARCH_EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE",
  "RESEARCH_EXACT_SET_STABLE_OBSERVED", "RESEARCH_EXACT_SET_PARTIAL_OVERLAP",
  "RESEARCH_EXACT_SET_DISJOINT", "NOT_COMPARABLE_RESEARCH_CONTEXT_UNAVAILABLE",
  "NOT_COMPARABLE_CHANNEL_UNUSABLE", "CANDIDATE_PRESENCE_DIVERGENCE",
  "CONSISTENT_CHECKED_NO_CANDIDATE", "NOT_COMPARABLE_NO_EXACT_IDENTIFIER",
  "EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE", "EXACT_SET_STABLE_OBSERVED",
  "EXACT_SET_PARTIAL_OVERLAP", "EXACT_SET_DISJOINT",
]);
const V35_DIVERGENCE_STATUSES = new Set([
  "CANDIDATE_PRESENCE_DIVERGENCE", "EXACT_SET_PARTIAL_OVERLAP", "EXACT_SET_DISJOINT",
  "EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE", "RESEARCH_CONTEXT_CANDIDATE_PRESENCE_DIVERGENCE",
  "RESEARCH_EXACT_SET_PARTIAL_OVERLAP", "RESEARCH_EXACT_SET_DISJOINT",
  "RESEARCH_EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE",
]);
const V35_EXACT_STATUSES = new Set([
  "EXACT_SET_STABLE_OBSERVED", "EXACT_SET_PARTIAL_OVERLAP", "EXACT_SET_DISJOINT",
  "EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE", "RESEARCH_EXACT_SET_STABLE_OBSERVED",
  "RESEARCH_EXACT_SET_PARTIAL_OVERLAP", "RESEARCH_EXACT_SET_DISJOINT",
  "RESEARCH_EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE",
]);
const V35_DIAGNOSTIC_KEYS = [
  "schema_version", "method_id", "status", "baseline_view_id", "view_count",
  "identity_preserving_view_count", "diagnostic_only_view_count", "views",
  "excluded_view_ids", "channel_summaries", "exact_identity_support", "signal_envelopes",
  "pairwise_channel_comparisons", "comparison_summary", "claims", "limitations",
  "diagnostic_sha256",
];
const V35_CLAIM_KEYS = [
  "diagnostic_only", "offline_by_construction", "provider_calls_permitted",
  "production_ranking_changed", "operational_threshold_established",
  "accuracy_or_recall_improvement_claimed", "match_or_nonmatch_adjudicated",
  "legal_or_release_determination_allowed", "same_source_relationship_verified",
  "identity_preserving_expectation_verified",
];
const V35_SUMMARY_KEYS = [
  "pair_count", "comparable_pair_count", "exact_identifier_comparison_count",
  "operational_exact_identifier_comparison_count", "research_exact_identifier_comparison_count",
  "consistent_checked_no_candidate_pair_count", "exact_divergence_count",
  "operational_exact_divergence_count", "research_context_exact_divergence_count",
  "status_counts", "minimum_exact_jaccard_ppm", "median_exact_jaccard_ppm",
  "maximum_exact_jaccard_ppm", "minimum_exact_association_multiset_jaccard_ppm",
  "median_exact_association_multiset_jaccard_ppm", "maximum_exact_association_multiset_jaccard_ppm",
];
const V35_VIEW_KEYS = [
  "view_id", "transform_id", "expectation", "source_entity_score_method_version",
  "channel_outcomes", "exact_identifier_count", "candidate_group_count_by_modality",
  "candidate_item_count_by_modality", "unlinked_candidate_group_count_by_modality",
  "conflicting_identifier_group_count_by_modality", "ambiguous_bridge_group_count_by_modality",
  "score_ineligible_context_group_count_by_modality",
  "score_ineligible_candidate_item_count_by_modality",
  "score_eligible_candidate_item_count_by_modality", "triage_projection_sha256",
];
const V35_CHANNEL_SUMMARY_KEYS = [
  "modality", "eligible_view_count", "usable_view_count", "candidate_view_count",
  "checked_no_candidate_view_count", "research_context_view_count",
  "research_candidate_context_view_count", "research_empty_context_view_count",
  "abstention_or_absent_view_count", "outcome_counts", "outcome_consistent",
  "candidate_presence_divergence", "research_candidate_context_divergence",
];
const V35_COMPARISON_KEYS = [
  "left_view_id", "right_view_id", "modality", "left_outcome", "right_outcome",
  "left_exact_identifier_count", "right_exact_identifier_count",
  "left_exact_association_group_count", "right_exact_association_group_count",
  "left_exact_association_sha256", "right_exact_association_sha256",
  "left_candidate_item_count", "right_candidate_item_count",
  "left_score_eligible_candidate_item_count", "right_score_eligible_candidate_item_count",
  "left_unlinked_candidate_group_count", "right_unlinked_candidate_group_count",
  "left_unsafe_isolated_group_count", "right_unsafe_isolated_group_count",
  "left_score_ineligible_context_group_count", "right_score_ineligible_context_group_count",
  "exact_jaccard_ppm", "exact_association_multiset_jaccard_ppm",
  "retained_exact_identifier_count", "removed_exact_identifier_count",
  "introduced_exact_identifier_count", "comparable", "status",
];
const V35_LIMITATIONS = [
  "Exact-identifier persistence measures software-observable invariance, not correctness or real-world accuracy.",
  "Unlinked candidates cannot participate in exact candidate-set comparisons.",
  "Signal envelopes are descriptive and uncalibrated; no range is a pass/fail threshold.",
  "Abstained or absent channels are unavailable observations, not negative evidence.",
  "View membership and IDENTITY_PRESERVING labels are caller assertions unless a separate custody protocol binds them.",
  "Exact identifier values plus view and transform IDs are republished and inherit the caller's custody requirements.",
  "No V31 execution-path integration or real-world multi-view evaluation is enabled by this module.",
];

const validPpmOrNull = (value) => value === null || nonnegativeInteger(value, 1_000_000);

const median = (values) => {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[midpoint]
    : (ordered[midpoint - 1] + ordered[midpoint]) / 2;
};

const validV35View = (view) => {
  if (
    !exactKeys(view, V35_VIEW_KEYS)
    || typeof view.view_id !== "string"
    || !view.view_id
    || typeof view.transform_id !== "string"
    || !view.transform_id
    || !new Set(["IDENTITY_PRESERVING", "DIAGNOSTIC_ONLY"]).has(view.expectation)
    || view.source_entity_score_method_version !== V36_ENTITY_VERSION
    || !HASH_PATTERN.test(view.triage_projection_sha256 || "")
    || !exactKeys(view.channel_outcomes, V34_MODALITIES)
    || !nonnegativeInteger(view.exact_identifier_count)
  ) return false;
  const countMaps = [
    "candidate_group_count_by_modality", "candidate_item_count_by_modality",
    "unlinked_candidate_group_count_by_modality", "conflicting_identifier_group_count_by_modality",
    "ambiguous_bridge_group_count_by_modality", "score_ineligible_context_group_count_by_modality",
    "score_ineligible_candidate_item_count_by_modality", "score_eligible_candidate_item_count_by_modality",
  ];
  if (!V34_MODALITIES.every((modality) => V36_OUTCOMES.has(view.channel_outcomes[modality]))) return false;
  if (
    view.channel_outcomes.composition_similarity === "CANDIDATES_REPORTED"
    || view.channel_outcomes.composition_similarity === "CHECKED_NO_CANDIDATE"
    || view.channel_outcomes.recording_identity === "ABSTAIN_RESEARCH_ONLY"
    || view.channel_outcomes.lyric_overlap === "ABSTAIN_RESEARCH_ONLY"
  ) return false;
  return countMaps.every((field) => (
      exactKeys(view[field], V34_MODALITIES)
      && V34_MODALITIES.every((modality) => nonnegativeInteger(view[field][modality]))
    ))
    && V34_MODALITIES.every((modality) => (
      (view.channel_outcomes[modality] === "CANDIDATES_REPORTED"
        ? view.candidate_item_count_by_modality[modality] > 0
        : view.channel_outcomes[modality] !== "CHECKED_NO_CANDIDATE"
          || view.candidate_item_count_by_modality[modality] === 0)
      && view.score_eligible_candidate_item_count_by_modality[modality]
        + view.score_ineligible_candidate_item_count_by_modality[modality]
        === view.candidate_item_count_by_modality[modality]
      && view.candidate_group_count_by_modality[modality]
        <= view.candidate_item_count_by_modality[modality]
      && view.unlinked_candidate_group_count_by_modality[modality]
        <= view.candidate_group_count_by_modality[modality]
      && view.conflicting_identifier_group_count_by_modality[modality]
        <= view.candidate_group_count_by_modality[modality]
      && view.ambiguous_bridge_group_count_by_modality[modality]
        <= view.candidate_group_count_by_modality[modality]
      && view.score_ineligible_context_group_count_by_modality[modality]
        <= view.candidate_group_count_by_modality[modality]
    ));
};

const V35_OPERATIONAL_USABLE_OUTCOMES = new Set([
  "CANDIDATES_REPORTED", "CHECKED_NO_CANDIDATE",
]);

const pairProjectionMatchesView = (comparison, side, view) => {
  const mappings = [
    ["candidate_item_count", "candidate_item_count_by_modality"],
    ["score_eligible_candidate_item_count", "score_eligible_candidate_item_count_by_modality"],
    ["unlinked_candidate_group_count", "unlinked_candidate_group_count_by_modality"],
    ["score_ineligible_context_group_count", "score_ineligible_context_group_count_by_modality"],
  ];
  return mappings.every(([pairField, viewField]) => (
    comparison[`${side}_${pairField}`] === view[viewField][comparison.modality]
  ));
};

const exactSetMetricsMatch = (comparison) => {
  const retained = comparison.retained_exact_identifier_count;
  const removed = comparison.removed_exact_identifier_count;
  const introduced = comparison.introduced_exact_identifier_count;
  if (
    comparison.left_exact_identifier_count !== retained + removed
    || comparison.right_exact_identifier_count !== retained + introduced
  ) return false;
  if (!V35_EXACT_STATUSES.has(comparison.status)) {
    return comparison.exact_jaccard_ppm === null
      && comparison.exact_association_multiset_jaccard_ppm === null;
  }
  const union = retained + removed + introduced;
  if (union === 0 || !Number.isInteger(comparison.exact_jaccard_ppm)) return false;
  const exactRatioPpm = (retained / union) * 1_000_000;
  return Math.abs(comparison.exact_jaccard_ppm - exactRatioPpm) <= 0.5
    && Number.isInteger(comparison.exact_association_multiset_jaccard_ppm);
};

const exactSetStatusMatches = (comparison, researchContext) => {
  const prefix = researchContext ? "RESEARCH_" : "";
  const jaccard = comparison.exact_jaccard_ppm;
  const associationJaccard = comparison.exact_association_multiset_jaccard_ppm;
  if (jaccard === 1_000_000) {
    const associationsStable = associationJaccard === 1_000_000
      && comparison.left_exact_association_group_count
        === comparison.right_exact_association_group_count
      && comparison.left_exact_association_sha256
        === comparison.right_exact_association_sha256;
    return comparison.status === `${prefix}${associationsStable
      ? "EXACT_SET_STABLE_OBSERVED"
      : "EXACT_ASSOCIATION_TOPOLOGY_DIVERGENCE"}`;
  }
  if (jaccard === 0) return comparison.status === `${prefix}EXACT_SET_DISJOINT`;
  return jaccard > 0
    && jaccard < 1_000_000
    && comparison.status === `${prefix}EXACT_SET_PARTIAL_OVERLAP`;
};

const pairStatusMatchesEvidence = (comparison) => {
  const leftOutcome = comparison.left_outcome;
  const rightOutcome = comparison.right_outcome;
  const leftResearch = leftOutcome === "ABSTAIN_RESEARCH_ONLY";
  const rightResearch = rightOutcome === "ABSTAIN_RESEARCH_ONLY";
  if (leftResearch || rightResearch) {
    if (!leftResearch || !rightResearch) {
      return comparison.status === "NOT_COMPARABLE_RESEARCH_CONTEXT_UNAVAILABLE";
    }
    const leftCandidates = comparison.left_score_eligible_candidate_item_count > 0;
    const rightCandidates = comparison.right_score_eligible_candidate_item_count > 0;
    if (leftCandidates !== rightCandidates) {
      return comparison.status === "RESEARCH_CONTEXT_CANDIDATE_PRESENCE_DIVERGENCE";
    }
    if (!leftCandidates) return comparison.status === "CONSISTENT_RESEARCH_CONTEXT_EMPTY";
    if (comparison.left_exact_identifier_count === 0 || comparison.right_exact_identifier_count === 0) {
      return comparison.status === "NOT_COMPARABLE_RESEARCH_CONTEXT_NO_EXACT_IDENTIFIER";
    }
    return exactSetStatusMatches(comparison, true);
  }

  const leftUsable = V35_OPERATIONAL_USABLE_OUTCOMES.has(leftOutcome);
  const rightUsable = V35_OPERATIONAL_USABLE_OUTCOMES.has(rightOutcome);
  if (!leftUsable || !rightUsable) {
    return comparison.status === "NOT_COMPARABLE_CHANNEL_UNUSABLE";
  }
  if (leftOutcome !== rightOutcome) {
    return comparison.status === "CANDIDATE_PRESENCE_DIVERGENCE";
  }
  if (leftOutcome === "CHECKED_NO_CANDIDATE") {
    return comparison.status === "CONSISTENT_CHECKED_NO_CANDIDATE";
  }
  if (comparison.left_exact_identifier_count === 0 || comparison.right_exact_identifier_count === 0) {
    return comparison.status === "NOT_COMPARABLE_NO_EXACT_IDENTIFIER";
  }
  return exactSetStatusMatches(comparison, false);
};

const validV35Comparison = (comparison, viewsById, eligibleViewIds) => {
  if (
    !exactKeys(comparison, V35_COMPARISON_KEYS)
    || !eligibleViewIds.has(comparison.left_view_id)
    || !eligibleViewIds.has(comparison.right_view_id)
    || comparison.left_view_id >= comparison.right_view_id
    || !V36_MODALITIES.has(comparison.modality)
    || !V35_PAIR_STATUSES.has(comparison.status)
    || typeof comparison.comparable !== "boolean"
    || comparison.comparable !== !comparison.status.startsWith("NOT_COMPARABLE_")
    || !validPpmOrNull(comparison.exact_jaccard_ppm)
    || !validPpmOrNull(comparison.exact_association_multiset_jaccard_ppm)
    || !HASH_PATTERN.test(comparison.left_exact_association_sha256 || "")
    || !HASH_PATTERN.test(comparison.right_exact_association_sha256 || "")
    || ![
      "left_exact_identifier_count", "right_exact_identifier_count",
      "left_exact_association_group_count", "right_exact_association_group_count",
      "left_candidate_item_count", "right_candidate_item_count",
      "left_score_eligible_candidate_item_count", "right_score_eligible_candidate_item_count",
      "left_unlinked_candidate_group_count", "right_unlinked_candidate_group_count",
      "left_unsafe_isolated_group_count", "right_unsafe_isolated_group_count",
      "left_score_ineligible_context_group_count", "right_score_ineligible_context_group_count",
      "retained_exact_identifier_count", "removed_exact_identifier_count",
      "introduced_exact_identifier_count",
    ].every((field) => nonnegativeInteger(comparison[field]))
  ) return false;
  const leftView = viewsById.get(comparison.left_view_id);
  const rightView = viewsById.get(comparison.right_view_id);
  return comparison.left_outcome === leftView.channel_outcomes[comparison.modality]
    && comparison.right_outcome === rightView.channel_outcomes[comparison.modality]
    && pairProjectionMatchesView(comparison, "left", leftView)
    && pairProjectionMatchesView(comparison, "right", rightView)
    && exactSetMetricsMatch(comparison)
    && pairStatusMatchesEvidence(comparison);
};

const expectedV35ComparisonKeys = (eligibleViews) => {
  const keys = [];
  for (let left = 0; left < eligibleViews.length; left += 1) {
    for (let right = left + 1; right < eligibleViews.length; right += 1) {
      for (const modality of V34_MODALITIES) {
        keys.push(`${eligibleViews[left].view_id}\u001f${eligibleViews[right].view_id}\u001f${modality}`);
      }
    }
  }
  return keys.sort();
};

const validV35ChannelSummaries = (summaries, eligibleViews) => {
  if (!Array.isArray(summaries) || summaries.length !== 3) return false;
  return summaries.every((summary, index) => {
    const modality = [...V34_MODALITIES].sort()[index];
    if (!exactKeys(summary, V35_CHANNEL_SUMMARY_KEYS) || summary.modality !== modality) return false;
    const outcomes = eligibleViews.map((view) => view.channel_outcomes[modality]);
    const countOutcome = (outcome) => outcomes.filter((value) => value === outcome).length;
    const candidates = countOutcome("CANDIDATES_REPORTED");
    const checked = countOutcome("CHECKED_NO_CANDIDATE");
    const research = countOutcome("ABSTAIN_RESEARCH_ONLY");
    const researchCandidates = eligibleViews.filter((view) => (
      view.channel_outcomes[modality] === "ABSTAIN_RESEARCH_ONLY"
      && view.score_eligible_candidate_item_count_by_modality[modality] > 0
    )).length;
    const outcomeCounts = Object.fromEntries([...new Set(outcomes)].sort().map(
      (outcome) => [outcome, countOutcome(outcome)],
    ));
    return summary.eligible_view_count === eligibleViews.length
      && summary.usable_view_count === candidates + checked
      && summary.candidate_view_count === candidates
      && summary.checked_no_candidate_view_count === checked
      && summary.research_context_view_count === research
      && summary.research_candidate_context_view_count === researchCandidates
      && summary.research_empty_context_view_count === research - researchCandidates
      && summary.abstention_or_absent_view_count === eligibleViews.length - candidates - checked
      && canonicalCompactJson(summary.outcome_counts) === canonicalCompactJson(outcomeCounts)
      && summary.outcome_consistent === (new Set(outcomes).size === 1)
      && summary.candidate_presence_divergence === Boolean(candidates && checked)
      && summary.research_candidate_context_divergence === Boolean(
        researchCandidates && research - researchCandidates,
      );
  });
};

const validV35Summary = (summary, comparisons) => {
  if (!exactKeys(summary, V35_SUMMARY_KEYS) || !isObject(summary.status_counts)) return false;
  const statusCounts = Object.fromEntries(
    [...V35_PAIR_STATUSES].sort().map((status) => [
      status, comparisons.filter((row) => row.status === status).length,
    ]).filter(([, value]) => value > 0),
  );
  const jaccards = comparisons.map((row) => row.exact_jaccard_ppm).filter((value) => value !== null);
  const association = comparisons
    .map((row) => row.exact_association_multiset_jaccard_ppm)
    .filter((value) => value !== null);
  const valuesMatch = (prefix, values) => (
    summary[`minimum_${prefix}`] === (values.length ? Math.min(...values) : null)
    && summary[`median_${prefix}`] === median(values)
    && summary[`maximum_${prefix}`] === (values.length ? Math.max(...values) : null)
  );
  const divergence = comparisons.filter((row) => V35_DIVERGENCE_STATUSES.has(row.status));
  const operationalDivergence = divergence.filter((row) => !row.status.startsWith("RESEARCH_"));
  return summary.pair_count === comparisons.length
    && summary.comparable_pair_count === comparisons.filter((row) => row.comparable).length
    && summary.exact_identifier_comparison_count === jaccards.length
    && summary.operational_exact_identifier_comparison_count === comparisons.filter(
      (row) => V35_EXACT_STATUSES.has(row.status) && !row.status.startsWith("RESEARCH_"),
    ).length
    && summary.research_exact_identifier_comparison_count === comparisons.filter(
      (row) => V35_EXACT_STATUSES.has(row.status) && row.status.startsWith("RESEARCH_"),
    ).length
    && summary.consistent_checked_no_candidate_pair_count === comparisons.filter(
      (row) => row.status === "CONSISTENT_CHECKED_NO_CANDIDATE",
    ).length
    && summary.exact_divergence_count === divergence.length
    && summary.operational_exact_divergence_count === operationalDivergence.length
    && summary.research_context_exact_divergence_count === divergence.length - operationalDivergence.length
    && canonicalCompactJson(summary.status_counts) === canonicalCompactJson(statusCounts)
    && valuesMatch("exact_jaccard_ppm", jaccards)
    && valuesMatch("exact_association_multiset_jaccard_ppm", association);
};

export function multiviewConsistencyView(wrapper = {}) {
  if (
    !exactKeys(wrapper, [
      "mode", "automatic_scan_activation", "provider_requests_made_by_endpoint",
      "payment_entitlements_consumed", "authoritative_scan_fields_changed",
      "same_source_relationship_verified", "identity_preserving_expectation_verified",
      "analyzer", "diagnostic",
    ])
    || !wrapper.diagnostic
    || wrapper.mode !== "DIAGNOSTIC_ONLY_STORED_VIEW_COMPARISON"
    || wrapper.automatic_scan_activation !== false
    || wrapper.provider_requests_made_by_endpoint !== 0
    || wrapper.payment_entitlements_consumed !== 0
    || wrapper.authoritative_scan_fields_changed !== false
    || wrapper.same_source_relationship_verified !== false
    || wrapper.identity_preserving_expectation_verified !== false
    || !validPublicAnalyzer(wrapper.analyzer)
  ) {
    return null;
  }
  const value = wrapper.diagnostic;
  if (
    !exactKeys(value, V35_DIAGNOSTIC_KEYS)
    || value.schema_version !== "soniccheck-v35-multiview-consistency/1.0.0"
    || value.method_id !== "soniccheck-v35-exact-identity-invariance/0.1.0-research"
    || !V35_STATUSES.has(value.status)
    || !nonnegativeInteger(value.view_count, 32)
    || !nonnegativeInteger(value.identity_preserving_view_count, 32)
    || value.identity_preserving_view_count < 1
    || !nonnegativeInteger(value.diagnostic_only_view_count, 32)
    || value.identity_preserving_view_count + value.diagnostic_only_view_count !== value.view_count
    || !exactKeys(value.claims, V35_CLAIM_KEYS)
    || value.claims?.diagnostic_only !== true
    || value.claims?.offline_by_construction !== true
    || value.claims?.provider_calls_permitted !== false
    || value.claims?.production_ranking_changed !== false
    || value.claims?.operational_threshold_established !== false
    || value.claims?.accuracy_or_recall_improvement_claimed !== false
    || value.claims?.match_or_nonmatch_adjudicated !== false
    || value.claims?.legal_or_release_determination_allowed !== false
    || value.claims?.same_source_relationship_verified !== false
    || value.claims?.identity_preserving_expectation_verified !== false
    || !digestMatches(value, "diagnostic_sha256")
    || !sameStringArray(value.limitations, V35_LIMITATIONS)
    || !Array.isArray(value.views)
    || value.views.length !== value.view_count
    || value.views.some((view) => !validV35View(view))
    || new Set(value.views.map((view) => view.view_id)).size !== value.views.length
    || typeof value.baseline_view_id !== "string"
    || !value.views.some(
      (view) => view.view_id === value.baseline_view_id && view.expectation === "IDENTITY_PRESERVING",
    )
    || value.views.filter((view) => view.expectation === "IDENTITY_PRESERVING").length
      !== value.identity_preserving_view_count
    || value.views.filter((view) => view.expectation === "DIAGNOSTIC_ONLY").length
      !== value.diagnostic_only_view_count
    || value.views.some((view, index) => index > 0 && value.views[index - 1].view_id >= view.view_id)
    || new Set(
      value.views.filter((view) => view.expectation === "IDENTITY_PRESERVING").map(
        (view) => view.transform_id,
      ),
    ).size !== value.identity_preserving_view_count
    || !sortedUniqueStrings(value.excluded_view_ids)
    || !sameStringArray(
      value.excluded_view_ids,
      value.views.filter((view) => view.expectation === "DIAGNOSTIC_ONLY").map((view) => view.view_id),
    )
    || !validV35ChannelSummaries(
      value.channel_summaries,
      value.views.filter((view) => view.expectation === "IDENTITY_PRESERVING"),
    )
    || !Array.isArray(value.exact_identity_support)
    || !Array.isArray(value.signal_envelopes)
    || !Array.isArray(value.pairwise_channel_comparisons)
  ) {
    return null;
  }
  const viewsById = new Map(value.views.map((view) => [view.view_id, view]));
  const eligibleViews = value.views.filter((view) => view.expectation === "IDENTITY_PRESERVING");
  const eligibleViewIds = new Set(eligibleViews.map((view) => view.view_id));
  const comparisons = value.pairwise_channel_comparisons;
  const expectedPairCount = (
    value.identity_preserving_view_count * (value.identity_preserving_view_count - 1) / 2
  ) * 3;
  const observedComparisonKeys = comparisons.map(
    (comparison) => `${comparison.left_view_id}\u001f${comparison.right_view_id}\u001f${comparison.modality}`,
  ).sort();
  if (
    comparisons.length !== expectedPairCount
    || comparisons.some((comparison) => !validV35Comparison(comparison, viewsById, eligibleViewIds))
    || !sameStringArray(observedComparisonKeys, expectedV35ComparisonKeys(eligibleViews))
    || !validV35Summary(value.comparison_summary, comparisons)
  ) return null;
  const comparable = comparisons.filter((row) => row.comparable);
  const divergenceCount = comparisons.filter((row) => V35_DIVERGENCE_STATUSES.has(row.status)).length;
  const jaccardCount = comparisons.filter((row) => row.exact_jaccard_ppm !== null).length;
  const expectedStatus = value.identity_preserving_view_count < 2
    ? "INSUFFICIENT_IDENTITY_PRESERVING_VIEWS"
    : divergenceCount > 0
      ? "EXACT_VIEW_DIVERGENCE_OBSERVED"
      : jaccardCount > 0
        ? "NO_EXACT_VIEW_DIVERGENCE_OBSERVED"
        : comparable.length > 0 && comparable.every(
          (row) => row.status === "CONSISTENT_CHECKED_NO_CANDIDATE",
        )
          ? "CONSISTENT_CHECKED_NO_CANDIDATE_OBSERVED"
          : "NO_EXACT_IDENTIFIER_COMPARISONS";
  if (value.status !== expectedStatus) return null;
  return {
    status: value.status,
    identityPreservingViews: value.identity_preserving_view_count,
    exactDivergenceCount: value.comparison_summary.exact_divergence_count,
    minimumExactJaccard: Number.isInteger(value.comparison_summary.minimum_exact_jaccard_ppm)
      ? value.comparison_summary.minimum_exact_jaccard_ppm / 1_000_000
      : null,
    digest: value.diagnostic_sha256,
  };
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  channelLossSensitivityView,
  currentAnalyzerDiagnosticViews,
  multiviewConsistencyView,
  storedAnalyzerLabel,
  structuralMissingnessView,
} from "../src/lib/scanResultPresentation.mjs";

const clone = (value) => structuredClone(value);

const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonical(value[key])}`,
  ).join(",")}}`;
};

const digest = (value) => createHash("sha256").update(canonical(value)).digest("hex");

const V34_ASSUMPTIONS = [
  "Observed exact-entity contributions retain their V33 values.",
  "Each unresolved channel may contribute from zero to its fixed maximum.",
  "A completed channel without an exactly linked observation contributes zero for this captured-evidence estimand.",
  "No distribution, sampling error, provider recall, or model error is inferred.",
  "The selected entity group and exact-linkage projection are held fixed; candidate regrouping is outside the envelope.",
];

const v34Similarity = () => ({
  method_version: "soniccheck-entity-bounded-evidence/0.5.2-research",
  disposition_method_version: "soniccheck-evidence-disposition/1.1.2-research",
  review_triage: {
    version: "soniccheck-evidence-disposition/1.1.2-research",
    candidate_groups: [{
      group_id: "entity-a",
      linkage: "EXACT_IDENTIFIER",
      identifier_conflict: false,
      ambiguous_linkage: false,
      score_ineligible_context: false,
      entity_linkage_eligible: true,
    }],
  },
  evidence_confidence: {
    available: true,
    value: 24,
    score_method_version: "soniccheck-entity-bounded-evidence/0.5.2-research",
    scored_entity_group_id: "entity-a",
    partial_identification: {
      version: "soniccheck-v34-partial-identification/1.0.0-research",
      estimand: "V33_FIXED_SELECTED_ENTITY_CAPTURED_EVIDENCE_SCORE",
      estimand_scope: "FIXED_SELECTED_ENTITY_AND_EXACT_LINKAGE_CAPTURED_CANDIDATE_SET_ONLY",
      selected_entity_invariant_assumed: true,
      exact_linkage_invariant_assumed: true,
      candidate_regrouping_covered: false,
      available: true,
      status: "PARTIALLY_IDENTIFIED",
      reason_code: null,
      selected_entity_group_id: "entity-a",
      observed_score_percent: 24,
      lower_bound_percent: 24,
      upper_bound_percent: 94,
      interval_width_percent: 70,
      resolved_weight_percent: 30,
      unresolved_weight_percent: 70,
      point_identified: false,
      components: [
        {
          modality: "recording_identity",
          channel_outcome: "CANDIDATES_REPORTED",
          state: "OBSERVED_LINKED_SIGNAL",
          maximum_points: 30,
          observed_points: 24,
          lower_points: 24,
          upper_points: 24,
          unresolved: false,
        },
        {
          modality: "lyric_overlap",
          channel_outcome: "ABSTAIN_PROVIDER_UNAVAILABLE",
          state: "UNRESOLVED_CHANNEL",
          maximum_points: 30,
          observed_points: 0,
          lower_points: 0,
          upper_points: 30,
          unresolved: true,
        },
        {
          modality: "composition_similarity",
          channel_outcome: "ABSTAIN_METHOD_INAPPLICABLE",
          state: "UNRESOLVED_CHANNEL",
          maximum_points: 40,
          observed_points: 0,
          lower_points: 0,
          upper_points: 40,
          unresolved: true,
        },
      ],
      calibration_status: "NOT_A_CALIBRATED_CONFIDENCE_INTERVAL",
      probability_interpretation: false,
      accuracy_claim: false,
      provider_recall_covered: false,
      model_error_covered: false,
      sampling_uncertainty_covered: false,
      latent_real_world_evidence_covered: false,
      changes_review_routing: false,
      provider_calls: false,
      offline_deterministic: true,
      assumptions: V34_ASSUMPTIONS,
    },
  },
});

test("V34 structural bounds replay the exact enclosing score and component contract", () => {
  assert.deepEqual(structuralMissingnessView(v34Similarity()), {
    available: true,
    observed: 24,
    lower: 24,
    upper: 94,
    unresolved: 70,
    pointIdentified: false,
  });
});

test("V34 fails closed for fabricated, incomplete, or internally inconsistent envelopes", () => {
  const corruptions = [
    (value) => { value.evidence_confidence.partial_identification.status = "MADE_UP"; },
    (value) => { value.evidence_confidence.partial_identification.components.pop(); },
    (value) => { value.evidence_confidence.partial_identification.components[1].upper_points = 29; },
    (value) => { value.evidence_confidence.partial_identification.interval_width_percent = 69; },
    (value) => { value.evidence_confidence.partial_identification.observed_score_percent = "24"; },
    (value) => { value.evidence_confidence.partial_identification.selected_entity_group_id = "invented"; },
    (value) => { value.review_triage.candidate_groups[0].score_ineligible_context = true; },
    (value) => { value.evidence_confidence.partial_identification.extra_claim = true; },
  ];
  for (const corrupt of corruptions) {
    const similarity = v34Similarity();
    corrupt(similarity);
    assert.equal(structuralMissingnessView(similarity)?.available, false);
  }
});

const baselineProjection = () => ({
  decision_projection: "REVIEW_EVIDENCE_PRESENT",
  review_required: true,
  review_evidence_observation_count: 1,
  review_entity_group_count: 1,
  review_evidence_signature_sha256: "1".repeat(64),
  entity_score_available: true,
  entity_bounded_score_points: 24,
  selected_entity_group_id: "entity-a",
  evidence_observation_count: 1,
  candidate_group_count: 1,
  screening_scope: "PARTIAL",
  usable_operational_channel_count: 1,
  applicable_operational_channel_count: 2,
  possible_operational_channel_count: 2,
  channel_outcomes: {
    recording_identity: "CANDIDATES_REPORTED",
    lyric_overlap: "ABSTAIN_PROVIDER_UNAVAILABLE",
    composition_similarity: "ABSTAIN_METHOD_INAPPLICABLE",
  },
});

const v36Similarity = () => ({
  method_version: "soniccheck-entity-bounded-evidence/0.5.2-research",
  disposition_method_version: "soniccheck-evidence-disposition/1.1.2-research",
  review_triage: { version: "soniccheck-evidence-disposition/1.1.2-research" },
  evidence_confidence: { score_method_version: "soniccheck-entity-bounded-evidence/0.5.2-research" },
  channel_loss_sensitivity: {
    version: "soniccheck-channel-loss-sensitivity/1.0.0-research",
    status: "EVALUATED_SHADOW_ONLY",
    evaluated: true,
    mode: "SHADOW_ONLY",
    method: "NON_CAUSAL_DETERMINISTIC_LEAVE_ONE_OBSERVED_CHANNEL_OUT",
    source_disposition_version: "soniccheck-evidence-disposition/1.1.2-research",
    source_entity_score_method_version: "soniccheck-entity-bounded-evidence/0.5.2-research",
    baseline: baselineProjection(),
    scenarios: [
      {
        removed_modality: "recording_identity",
        evaluated: true,
        source_outcome: "CANDIDATES_REPORTED",
        counterfactual_channel_outcome: "ABSTAIN_COUNTERFACTUAL_CHANNEL_LOSS",
        decision_projection: "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL",
        decision_projection_changed: true,
        review_required: false,
        review_requirement_changed: true,
        review_evidence_observation_count: 0,
        review_entity_group_count: 0,
        review_evidence_signature_sha256: "0".repeat(64),
        review_evidence_projection_changed: true,
        became_no_usable_operational_abstention: true,
        entity_score_available: true,
        entity_score_availability_changed: false,
        entity_bounded_score_points: 0,
        entity_score_change_points: -24,
        selected_entity_group_id: "entity-b",
        selected_entity_changed: true,
        evidence_observation_count: 1,
        candidate_group_count: 1,
        screening_scope: "NO_USABLE_CHANNEL",
        usable_operational_channel_count: 0,
        applicable_operational_channel_count: 2,
        possible_operational_channel_count: 2,
      },
      {
        removed_modality: "lyric_overlap",
        evaluated: false,
        reason: "CHANNEL_NOT_OBSERVED_AS_USABLE",
        source_outcome: "ABSTAIN_PROVIDER_UNAVAILABLE",
      },
      {
        removed_modality: "composition_similarity",
        evaluated: false,
        reason: "CHANNEL_NOT_OBSERVED_AS_USABLE",
        source_outcome: "ABSTAIN_METHOD_INAPPLICABLE",
      },
    ],
    summary: {
      evaluated_scenario_count: 1,
      evaluated_scenario_count_out_of: 3,
      review_requirement_stability: "FRAGILE_TO_SINGLE_CHANNEL_LOSS",
      review_evidence_projection_stability: "CHANGES_UNDER_SINGLE_CHANNEL_LOSS",
      decision_projection_stability: "CHANGES_UNDER_SINGLE_CHANNEL_LOSS",
      review_critical_modalities: ["recording_identity"],
      review_evidence_changing_modalities: ["recording_identity"],
      decision_changing_modalities: ["recording_identity"],
      abstention_critical_modalities: ["recording_identity"],
      selected_entity_changing_modalities: ["recording_identity"],
      entity_score_availability_changing_modalities: [],
      maximum_entity_score_drop_points: 24,
      maximum_entity_score_increase_points: 0,
      maximum_absolute_entity_score_change_points: 24,
      baseline_and_counterfactual_entity_score_range_points: { minimum: 0, maximum: 24 },
    },
    authoritative_status_changed: false,
    provider_requests_made: 0,
    legal_determination: false,
    causal_interpretation: false,
    calibrated_confidence: false,
    accuracy_estimate: false,
    clearance_determination: false,
    interpretation: (
      "Structural sensitivity to losing one already-observed channel. Stability here does not imply "
      + "correctness, calibration, originality, clearance, or resilience to missing catalogue coverage, "
      + "correlated errors, or multiple simultaneous channel failures."
    ),
  },
});

test("V36 channel-loss output is shown only after scenario and summary reconciliation", () => {
  assert.deepEqual(channelLossSensitivityView(v36Similarity()), {
    available: true,
    status: "EVALUATED_SHADOW_ONLY",
    evaluated: 1,
    possible: 3,
    reviewStability: "FRAGILE_TO_SINGLE_CHANNEL_LOSS",
    decisionStability: "CHANGES_UNDER_SINGLE_CHANNEL_LOSS",
    maximumChange: 24,
  });
});

test("V36 rejects invented statuses, impossible counts, and contradictory scenarios", () => {
  const corruptions = [
    (value) => { value.channel_loss_sensitivity.status = "MADE_UP"; },
    (value) => { value.channel_loss_sensitivity.provider_requests_made = 1; },
    (value) => { value.channel_loss_sensitivity.summary.evaluated_scenario_count = 99; },
    (value) => { value.channel_loss_sensitivity.summary.evaluated_scenario_count_out_of = 0; },
    (value) => { value.channel_loss_sensitivity.summary.review_requirement_stability = "MADE_UP"; },
    (value) => { value.channel_loss_sensitivity.summary.maximum_absolute_entity_score_change_points = 99; },
    (value) => { value.channel_loss_sensitivity.scenarios[0].decision_projection_changed = false; },
    (value) => { value.channel_loss_sensitivity.scenarios[0].removed_modality = "lyric_overlap"; },
    (value) => { value.channel_loss_sensitivity.source_entity_score_method_version = "future"; },
  ];
  for (const corrupt of corruptions) {
    const similarity = v36Similarity();
    corrupt(similarity);
    assert.equal(channelLossSensitivityView(similarity)?.available, false);
  }
});

test("V36 distinguishes canonical no-applicable and invalid-projection abstentions", () => {
  const noApplicable = v36Similarity();
  const value = noApplicable.channel_loss_sensitivity;
  value.status = "NOT_EVALUATED_NO_APPLICABLE_OBSERVED_CHANNEL";
  value.evaluated = false;
  value.baseline = {
    ...baselineProjection(),
    decision_projection: "ABSTAIN_NO_USABLE_OPERATIONAL_CHANNEL",
    review_required: false,
    review_evidence_observation_count: 0,
    review_entity_group_count: 0,
    entity_score_available: false,
    entity_bounded_score_points: null,
    selected_entity_group_id: null,
    evidence_observation_count: 0,
    candidate_group_count: 0,
    screening_scope: "NO_USABLE_CHANNEL",
    usable_operational_channel_count: 0,
    applicable_operational_channel_count: 0,
    channel_outcomes: {
      recording_identity: "ABSTAIN_METHOD_INAPPLICABLE",
      lyric_overlap: "ABSTAIN_METHOD_INAPPLICABLE",
      composition_similarity: "ABSTAIN_METHOD_INAPPLICABLE",
    },
  };
  value.scenarios = ["recording_identity", "lyric_overlap", "composition_similarity"].map(
    (removed_modality) => ({
      removed_modality,
      evaluated: false,
      reason: "CHANNEL_NOT_OBSERVED_AS_USABLE",
      source_outcome: "ABSTAIN_METHOD_INAPPLICABLE",
    }),
  );
  Object.assign(value.summary, {
    evaluated_scenario_count: 0,
    review_requirement_stability: "NOT_EVALUABLE_NO_OBSERVED_CHANNEL",
    review_evidence_projection_stability: "NOT_EVALUABLE_NO_OBSERVED_CHANNEL",
    decision_projection_stability: "NOT_EVALUABLE_NO_OBSERVED_CHANNEL",
    review_critical_modalities: [],
    review_evidence_changing_modalities: [],
    decision_changing_modalities: [],
    abstention_critical_modalities: [],
    selected_entity_changing_modalities: [],
    entity_score_availability_changing_modalities: [],
    maximum_entity_score_drop_points: null,
    maximum_entity_score_increase_points: null,
    maximum_absolute_entity_score_change_points: null,
    baseline_and_counterfactual_entity_score_range_points: null,
  });
  assert.deepEqual(channelLossSensitivityView(noApplicable), {
    available: false,
    reason: "NOT_EVALUATED_NO_APPLICABLE_OBSERVED_CHANNEL",
  });

  const abstention = {
    channel_loss_sensitivity: {
      version: "soniccheck-channel-loss-sensitivity/1.0.0-research",
      status: "ABSTAIN_INVALID_V33_PROJECTION",
      evaluated: false,
      mode: "SHADOW_ONLY",
      validation_errors: ["ENTITY_SCORE_CONFLICT"],
      authoritative_status_changed: false,
      legal_determination: false,
      causal_interpretation: false,
      calibrated_confidence: false,
      accuracy_estimate: false,
      clearance_determination: false,
      interpretation: (
        "No channel-loss sensitivity metrics were published because the V33 projection failed the V36 input contract."
      ),
    },
  };
  assert.deepEqual(channelLossSensitivityView(abstention), {
    available: false,
    reason: "ENTITY_SCORE_CONFLICT",
  });
  abstention.channel_loss_sensitivity.validation_errors = ["not-canonical"];
  assert.equal(channelLossSensitivityView(abstention)?.reason, "Invalid V36 abstention");
});

const capabilityBody = {
  revision: "soniccheck-harry-v36-capabilities/1.0.0",
  analyzer_label: "HARRY_V36",
  capabilities: [
    {
      capability_id: "v34_structural_missingness_bounds",
      scientific_stage: "V34",
      method_version: "soniccheck-v34-partial-identification/1.0.0-research",
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
      method_version: "soniccheck-channel-loss-sensitivity/1.0.0-research",
      runtime_state: "RUNTIME_SHADOW_OUTPUT",
      output_path: "similarity_analysis.channel_loss_sensitivity",
      automatic_scan_attachment: true,
      additional_provider_requests_made_by_capability: 0,
      authoritative_status_changed: false,
      payment_gate_changed: false,
    },
  ],
};
const capabilitySha = digest(capabilityBody);

const publicAnalyzer = () => ({
  canonical_name: "HARRY",
  versioned_label: "HARRY_V36",
  product: "SONIC CHECK",
  role: "evidence-screening analyzer",
  identity_revision: "soniccheck-harry-identity/1.2.0",
  scientific_v_series: "V36",
  completed_v_series_through: "V36",
  capability_manifest: { ...clone(capabilityBody), sha256: capabilitySha },
});

const currentStoredResult = () => ({
  analysis_version: "soniccheck-evidence-screening/0.3.0",
  analyzer: {
    canonical_name: "HARRY",
    versioned_label: "HARRY_V36",
    scientific_v_series: "V36",
    identity_revision: "soniccheck-harry-identity/1.2.0",
    technical_analysis_version: "soniccheck-evidence-screening/0.3.0",
    capability_manifest_revision: "soniccheck-harry-v36-capabilities/1.0.0",
    capability_manifest_sha256: capabilitySha,
  },
});

test("stored HARRY identity requires exact technical and capability binding", () => {
  assert.equal(capabilitySha, "e594f8b3282de37e89ce7da853efde590e779b4db75dc59c6547944cf2fe8b6b");
  assert.equal(storedAnalyzerLabel(currentStoredResult()), "HARRY_V36");

  const historical = currentStoredResult();
  historical.analyzer.identity_revision = "soniccheck-harry-identity/1.1.0";
  delete historical.analyzer.capability_manifest_revision;
  delete historical.analyzer.capability_manifest_sha256;
  assert.equal(storedAnalyzerLabel(historical), "HARRY_V36");

  const corruptions = [
    (value) => { delete value.analyzer.technical_analysis_version; },
    (value) => { value.analyzer.technical_analysis_version = "other"; },
    (value) => { delete value.analyzer.capability_manifest_revision; },
    (value) => { value.analyzer.capability_manifest_sha256 = "0".repeat(64); },
    (value) => { value.analyzer.identity_revision = "soniccheck-harry-identity/9.0.0"; },
    (value) => { value.analyzer.extra = true; },
  ];
  for (const corrupt of corruptions) {
    const result = currentStoredResult();
    corrupt(result);
    assert.equal(storedAnalyzerLabel(result), null);
  }
  historical.analyzer.capability_manifest_sha256 = capabilitySha;
  assert.equal(storedAnalyzerLabel(historical), null);
});

const currentStoredResultWithDiagnostics = () => {
  const similarity = v34Similarity();
  similarity.channel_loss_sensitivity = clone(v36Similarity().channel_loss_sensitivity);
  return {
    ...currentStoredResult(),
    similarity_analysis: similarity,
  };
};

test("current analyzer diagnostics require the exact stored capability binding", () => {
  const result = currentStoredResultWithDiagnostics();
  const diagnostics = currentAnalyzerDiagnosticViews(result);
  assert.equal(diagnostics.isCurrentCapabilityBoundHarry, true);
  assert.equal(diagnostics.v34?.available, true);
  assert.equal(diagnostics.v36?.available, true);

  const invalidDigest = currentStoredResultWithDiagnostics();
  invalidDigest.analyzer.capability_manifest_sha256 = "0".repeat(64);
  assert.deepEqual(currentAnalyzerDiagnosticViews(invalidDigest), {
    isCurrentCapabilityBoundHarry: false,
    v34: null,
    v36: null,
  });

  const unrecognisedAnalyzerClaim = currentStoredResultWithDiagnostics();
  unrecognisedAnalyzerClaim.analyzer.accuracy_claim = true;
  assert.deepEqual(currentAnalyzerDiagnosticViews(unrecognisedAnalyzerClaim), {
    isCurrentCapabilityBoundHarry: false,
    v34: null,
    v36: null,
  });

  const historical = currentStoredResultWithDiagnostics();
  historical.analyzer.identity_revision = "soniccheck-harry-identity/1.1.0";
  delete historical.analyzer.capability_manifest_revision;
  delete historical.analyzer.capability_manifest_sha256;
  assert.deepEqual(currentAnalyzerDiagnosticViews(historical), {
    isCurrentCapabilityBoundHarry: false,
    v34: null,
    v36: null,
  });
});

const zeroMap = () => ({
  composition_similarity: 0,
  lyric_overlap: 0,
  recording_identity: 0,
});

const v35View = (viewId, transformId, recordingCandidates) => ({
  view_id: viewId,
  transform_id: transformId,
  expectation: "IDENTITY_PRESERVING",
  source_entity_score_method_version: "soniccheck-entity-bounded-evidence/0.5.2-research",
  channel_outcomes: {
    composition_similarity: "ABSTAIN_METHOD_INAPPLICABLE",
    lyric_overlap: "CHECKED_NO_CANDIDATE",
    recording_identity: recordingCandidates ? "CANDIDATES_REPORTED" : "CHECKED_NO_CANDIDATE",
  },
  exact_identifier_count: recordingCandidates ? 1 : 0,
  candidate_group_count_by_modality: { ...zeroMap(), recording_identity: recordingCandidates ? 1 : 0 },
  candidate_item_count_by_modality: { ...zeroMap(), recording_identity: recordingCandidates ? 1 : 0 },
  unlinked_candidate_group_count_by_modality: zeroMap(),
  conflicting_identifier_group_count_by_modality: zeroMap(),
  ambiguous_bridge_group_count_by_modality: zeroMap(),
  score_ineligible_context_group_count_by_modality: zeroMap(),
  score_ineligible_candidate_item_count_by_modality: zeroMap(),
  score_eligible_candidate_item_count_by_modality: { ...zeroMap(), recording_identity: recordingCandidates ? 1 : 0 },
  triage_projection_sha256: (viewId === "baseline" ? "a" : "b").repeat(64),
});

const comparison = ({ modality, status, comparable, leftOutcome, rightOutcome, leftCount = 0 }) => ({
  left_view_id: "baseline",
  right_view_id: "lossy",
  modality,
  left_outcome: leftOutcome,
  right_outcome: rightOutcome,
  left_exact_identifier_count: leftCount,
  right_exact_identifier_count: 0,
  left_exact_association_group_count: leftCount,
  right_exact_association_group_count: 0,
  left_exact_association_sha256: "c".repeat(64),
  right_exact_association_sha256: "d".repeat(64),
  left_candidate_item_count: leftCount,
  right_candidate_item_count: 0,
  left_score_eligible_candidate_item_count: leftCount,
  right_score_eligible_candidate_item_count: 0,
  left_unlinked_candidate_group_count: 0,
  right_unlinked_candidate_group_count: 0,
  left_unsafe_isolated_group_count: 0,
  right_unsafe_isolated_group_count: 0,
  left_score_ineligible_context_group_count: 0,
  right_score_ineligible_context_group_count: 0,
  exact_jaccard_ppm: null,
  exact_association_multiset_jaccard_ppm: null,
  retained_exact_identifier_count: 0,
  removed_exact_identifier_count: leftCount,
  introduced_exact_identifier_count: 0,
  comparable,
  status,
});

const withDiagnosticDigest = (diagnostic) => ({
  ...diagnostic,
  diagnostic_sha256: digest(diagnostic),
});

const resealV35Wrapper = (wrapper) => {
  const material = clone(wrapper.diagnostic);
  delete material.diagnostic_sha256;
  wrapper.diagnostic.diagnostic_sha256 = digest(material);
  return wrapper;
};

const channelSummaries = () => [
  {
    modality: "composition_similarity",
    eligible_view_count: 2,
    usable_view_count: 0,
    candidate_view_count: 0,
    checked_no_candidate_view_count: 0,
    research_context_view_count: 0,
    research_candidate_context_view_count: 0,
    research_empty_context_view_count: 0,
    abstention_or_absent_view_count: 2,
    outcome_counts: { ABSTAIN_METHOD_INAPPLICABLE: 2 },
    outcome_consistent: true,
    candidate_presence_divergence: false,
    research_candidate_context_divergence: false,
  },
  {
    modality: "lyric_overlap",
    eligible_view_count: 2,
    usable_view_count: 2,
    candidate_view_count: 0,
    checked_no_candidate_view_count: 2,
    research_context_view_count: 0,
    research_candidate_context_view_count: 0,
    research_empty_context_view_count: 0,
    abstention_or_absent_view_count: 0,
    outcome_counts: { CHECKED_NO_CANDIDATE: 2 },
    outcome_consistent: true,
    candidate_presence_divergence: false,
    research_candidate_context_divergence: false,
  },
  {
    modality: "recording_identity",
    eligible_view_count: 2,
    usable_view_count: 2,
    candidate_view_count: 1,
    checked_no_candidate_view_count: 1,
    research_context_view_count: 0,
    research_candidate_context_view_count: 0,
    research_empty_context_view_count: 0,
    abstention_or_absent_view_count: 0,
    outcome_counts: { CANDIDATES_REPORTED: 1, CHECKED_NO_CANDIDATE: 1 },
    outcome_consistent: false,
    candidate_presence_divergence: true,
    research_candidate_context_divergence: false,
  },
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

const v35Wrapper = () => {
  const pairwise = [
    comparison({
      modality: "composition_similarity",
      status: "NOT_COMPARABLE_CHANNEL_UNUSABLE",
      comparable: false,
      leftOutcome: "ABSTAIN_METHOD_INAPPLICABLE",
      rightOutcome: "ABSTAIN_METHOD_INAPPLICABLE",
    }),
    comparison({
      modality: "lyric_overlap",
      status: "CONSISTENT_CHECKED_NO_CANDIDATE",
      comparable: true,
      leftOutcome: "CHECKED_NO_CANDIDATE",
      rightOutcome: "CHECKED_NO_CANDIDATE",
    }),
    comparison({
      modality: "recording_identity",
      status: "CANDIDATE_PRESENCE_DIVERGENCE",
      comparable: true,
      leftOutcome: "CANDIDATES_REPORTED",
      rightOutcome: "CHECKED_NO_CANDIDATE",
      leftCount: 1,
    }),
  ];
  const diagnostic = {
    schema_version: "soniccheck-v35-multiview-consistency/1.0.0",
    method_id: "soniccheck-v35-exact-identity-invariance/0.1.0-research",
    status: "EXACT_VIEW_DIVERGENCE_OBSERVED",
    baseline_view_id: "baseline",
    view_count: 2,
    identity_preserving_view_count: 2,
    diagnostic_only_view_count: 0,
    views: [v35View("baseline", "original", true), v35View("lossy", "encoded", false)],
    excluded_view_ids: [],
    channel_summaries: channelSummaries(),
    exact_identity_support: [],
    signal_envelopes: [],
    pairwise_channel_comparisons: pairwise,
    comparison_summary: {
      pair_count: 3,
      comparable_pair_count: 2,
      exact_identifier_comparison_count: 0,
      operational_exact_identifier_comparison_count: 0,
      research_exact_identifier_comparison_count: 0,
      consistent_checked_no_candidate_pair_count: 1,
      exact_divergence_count: 1,
      operational_exact_divergence_count: 1,
      research_context_exact_divergence_count: 0,
      status_counts: {
        CANDIDATE_PRESENCE_DIVERGENCE: 1,
        CONSISTENT_CHECKED_NO_CANDIDATE: 1,
        NOT_COMPARABLE_CHANNEL_UNUSABLE: 1,
      },
      minimum_exact_jaccard_ppm: null,
      median_exact_jaccard_ppm: null,
      maximum_exact_jaccard_ppm: null,
      minimum_exact_association_multiset_jaccard_ppm: null,
      median_exact_association_multiset_jaccard_ppm: null,
      maximum_exact_association_multiset_jaccard_ppm: null,
    },
    claims: {
      diagnostic_only: true,
      offline_by_construction: true,
      provider_calls_permitted: false,
      production_ranking_changed: false,
      operational_threshold_established: false,
      accuracy_or_recall_improvement_claimed: false,
      match_or_nonmatch_adjudicated: false,
      legal_or_release_determination_allowed: false,
      same_source_relationship_verified: false,
      identity_preserving_expectation_verified: false,
    },
    limitations: V35_LIMITATIONS,
  };
  return {
    mode: "DIAGNOSTIC_ONLY_STORED_VIEW_COMPARISON",
    automatic_scan_activation: false,
    provider_requests_made_by_endpoint: 0,
    payment_entitlements_consumed: 0,
    authoritative_scan_fields_changed: false,
    same_source_relationship_verified: false,
    identity_preserving_expectation_verified: false,
    analyzer: publicAnalyzer(),
    diagnostic: withDiagnosticDigest(diagnostic),
  };
};

test("V35 verifies the canonical digest and reconciles exact divergence counts", () => {
  const wrapper = v35Wrapper();
  assert.deepEqual(multiviewConsistencyView(wrapper), {
    status: "EXACT_VIEW_DIVERGENCE_OBSERVED",
    identityPreservingViews: 2,
    exactDivergenceCount: 1,
    minimumExactJaccard: null,
    digest: wrapper.diagnostic.diagnostic_sha256,
  });
  wrapper.diagnostic.views[0].transform_id = "tampered";
  assert.equal(multiviewConsistencyView(wrapper), null);
});

test("V35 accepts a semantically reconciled exact-set stability result", () => {
  const wrapper = v35Wrapper();
  wrapper.diagnostic.views[1] = v35View("lossy", "encoded", true);
  Object.assign(wrapper.diagnostic.channel_summaries[2], {
    candidate_view_count: 2,
    checked_no_candidate_view_count: 0,
    outcome_counts: { CANDIDATES_REPORTED: 2 },
    outcome_consistent: true,
    candidate_presence_divergence: false,
  });
  const row = wrapper.diagnostic.pairwise_channel_comparisons[2];
  Object.assign(row, {
    right_outcome: "CANDIDATES_REPORTED",
    right_exact_identifier_count: 1,
    right_exact_association_group_count: 1,
    right_exact_association_sha256: row.left_exact_association_sha256,
    right_candidate_item_count: 1,
    right_score_eligible_candidate_item_count: 1,
    exact_jaccard_ppm: 1_000_000,
    exact_association_multiset_jaccard_ppm: 1_000_000,
    retained_exact_identifier_count: 1,
    removed_exact_identifier_count: 0,
    status: "EXACT_SET_STABLE_OBSERVED",
  });
  Object.assign(wrapper.diagnostic.comparison_summary, {
    exact_identifier_comparison_count: 1,
    operational_exact_identifier_comparison_count: 1,
    exact_divergence_count: 0,
    operational_exact_divergence_count: 0,
    status_counts: {
      CONSISTENT_CHECKED_NO_CANDIDATE: 1,
      EXACT_SET_STABLE_OBSERVED: 1,
      NOT_COMPARABLE_CHANNEL_UNUSABLE: 1,
    },
    minimum_exact_jaccard_ppm: 1_000_000,
    median_exact_jaccard_ppm: 1_000_000,
    maximum_exact_jaccard_ppm: 1_000_000,
    minimum_exact_association_multiset_jaccard_ppm: 1_000_000,
    median_exact_association_multiset_jaccard_ppm: 1_000_000,
    maximum_exact_association_multiset_jaccard_ppm: 1_000_000,
  });
  wrapper.diagnostic.status = "NO_EXACT_VIEW_DIVERGENCE_OBSERVED";
  resealV35Wrapper(wrapper);

  assert.deepEqual(multiviewConsistencyView(wrapper), {
    status: "NO_EXACT_VIEW_DIVERGENCE_OBSERVED",
    identityPreservingViews: 2,
    exactDivergenceCount: 0,
    minimumExactJaccard: 1,
    digest: wrapper.diagnostic.diagnostic_sha256,
  });
});

test("V35 fails closed even when impossible values are covered by a recomputed digest", () => {
  const corruptions = [
    (value) => { delete value.diagnostic.status; },
    (value) => { value.diagnostic.status = "MADE_UP"; },
    (value) => { value.diagnostic.view_count = "2"; },
    (value) => { value.diagnostic.view_count = 999; },
    (value) => { value.diagnostic.comparison_summary.exact_divergence_count = 0; },
    (value) => { value.diagnostic.comparison_summary.minimum_exact_jaccard_ppm = 2_000_000; },
    (value) => { value.diagnostic.pairwise_channel_comparisons[0].comparable = true; },
    (value) => { value.diagnostic.pairwise_channel_comparisons[2].left_candidate_item_count = 0; },
    (value) => {
      const baseline = value.diagnostic.views[0];
      baseline.candidate_group_count_by_modality.recording_identity = 0;
      baseline.candidate_item_count_by_modality.recording_identity = 0;
      baseline.score_eligible_candidate_item_count_by_modality.recording_identity = 0;
      const row = value.diagnostic.pairwise_channel_comparisons[2];
      row.left_candidate_item_count = 0;
      row.left_score_eligible_candidate_item_count = 0;
    },
  ];
  for (const corrupt of corruptions) {
    const wrapper = v35Wrapper();
    corrupt(wrapper);
    resealV35Wrapper(wrapper);
    assert.equal(multiviewConsistencyView(wrapper), null);
  }
});

test("V35 rejects a resealed and re-summarised false exact-set stability claim", () => {
  const wrapper = v35Wrapper();
  const row = wrapper.diagnostic.pairwise_channel_comparisons[2];
  Object.assign(row, {
    status: "EXACT_SET_STABLE_OBSERVED",
    comparable: true,
    right_exact_identifier_count: 1,
    right_exact_association_group_count: 1,
    right_exact_association_sha256: row.left_exact_association_sha256,
    exact_jaccard_ppm: 1_000_000,
    exact_association_multiset_jaccard_ppm: 1_000_000,
    retained_exact_identifier_count: 1,
    removed_exact_identifier_count: 0,
    introduced_exact_identifier_count: 0,
  });
  Object.assign(wrapper.diagnostic.comparison_summary, {
    exact_identifier_comparison_count: 1,
    operational_exact_identifier_comparison_count: 1,
    exact_divergence_count: 0,
    operational_exact_divergence_count: 0,
    status_counts: {
      CONSISTENT_CHECKED_NO_CANDIDATE: 1,
      EXACT_SET_STABLE_OBSERVED: 1,
      NOT_COMPARABLE_CHANNEL_UNUSABLE: 1,
    },
    minimum_exact_jaccard_ppm: 1_000_000,
    median_exact_jaccard_ppm: 1_000_000,
    maximum_exact_jaccard_ppm: 1_000_000,
    minimum_exact_association_multiset_jaccard_ppm: 1_000_000,
    median_exact_association_multiset_jaccard_ppm: 1_000_000,
    maximum_exact_association_multiset_jaccard_ppm: 1_000_000,
  });
  wrapper.diagnostic.status = "NO_EXACT_VIEW_DIVERGENCE_OBSERVED";
  resealV35Wrapper(wrapper);

  assert.equal(multiviewConsistencyView(wrapper), null);
});

test("the visible result surface consumes all three diagnostic contracts", async () => {
  const source = await readFile(new URL("../src/pages/ScanResult.jsx", import.meta.url), "utf8");
  assert.match(source, /currentAnalyzerDiagnosticViews\(result\)/u);
  assert.match(source, /multiview-consistency/u);
  assert.match(source, /\{ANALYZER_IDENTITY\} structural diagnostics/u);
  assert.match(source, /not a confidence interval, probability or accuracy estimate/u);
});

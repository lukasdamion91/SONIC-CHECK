import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { channelLossSensitivityView } from "../src/lib/scanResultPresentation.mjs";

const fixture = JSON.parse(await readFile(
  new URL("./fixtures/v36-api-projections.json", import.meta.url), "utf8",
));
const sample = (name) => structuredClone(
  fixture.cases.find((entry) => entry.name === name).similarity,
);
const compositionLoss = (similarity) => similarity.channel_loss_sensitivity.scenarios.find(
  (scenario) => scenario.removed_modality === "composition_similarity",
);

test("V36 accepts pinned API projections including no-match and retained unscored context", () => {
  assert.equal(fixture.provenance.kind, "SYNTHETIC_OFFLINE_API_GENERATED");
  assert.equal(fixture.provenance.provider_requests_made, 0);
  assert.equal(fixture.cases.length, 5);
  for (const { name, similarity } of fixture.cases) {
    const before = structuredClone(similarity);
    assert.equal(channelLossSensitivityView(similarity)?.available, true, name);
    assert.deepEqual(similarity, before, "presentation must not mutate stored evidence");
  }
});

test("V36 composition loss preserves a completed no-match search as zero without a selected entity", () => {
  const similarity = sample("recording_no_match_with_composition");
  const scenario = compositionLoss(similarity);
  assert.equal(scenario.entity_score_available, true);
  assert.equal(scenario.entity_bounded_score_points, 0);
  assert.equal(scenario.selected_entity_group_id, null);
  assert.equal(scenario.usable_operational_channel_count, 1);
  assert.deepEqual(channelLossSensitivityView(similarity), {
    available: true,
    status: "EVALUATED_SHADOW_ONLY",
    evaluated: 2,
    possible: 3,
    reviewStability: "STABLE_FOR_OBSERVED_SINGLE_CHANNEL_LOSS",
    decisionStability: "CHANGES_UNDER_SINGLE_CHANNEL_LOSS",
    maximumChange: 27,
  });
  const context = sample("recording_no_match_with_unscored_context");
  const baseline = context.channel_loss_sensitivity.baseline;
  assert.equal(baseline.entity_bounded_score_points, 0);
  assert.equal(baseline.selected_entity_group_id, null);
  assert.ok(baseline.candidate_group_count > 0);
  assert.equal(channelLossSensitivityView(context)?.available, true);
});

test("V36 keeps unavailable scores distinct from completed zero-score searches", () => {
  const similarity = sample("composition_only_without_operational_result");
  const scenario = compositionLoss(similarity);
  assert.equal(scenario.entity_score_available, false);
  assert.equal(scenario.entity_bounded_score_points, null);
  assert.equal(scenario.selected_entity_group_id, null);
  assert.equal(scenario.usable_operational_channel_count, 0);
  assert.equal(channelLossSensitivityView(similarity)?.available, true);
  // Keep all relations and summaries coherent, but fabricate availability in
  // the absence of an operational result or any remaining entity evidence.
  scenario.entity_score_available = true;
  scenario.entity_score_availability_changed = false;
  scenario.entity_bounded_score_points = 0;
  scenario.entity_score_change_points = -27;
  const summary = similarity.channel_loss_sensitivity.summary;
  summary.entity_score_availability_changing_modalities = [];
  summary.maximum_entity_score_drop_points = 27;
  summary.maximum_entity_score_increase_points = 0;
  summary.maximum_absolute_entity_score_change_points = 27;
  summary.baseline_and_counterfactual_entity_score_range_points = { minimum: 0, maximum: 27 };
  assert.equal(channelLossSensitivityView(similarity)?.available, false);
});

test("V36 still suppresses malformed no-entity projections and contradictory summaries", () => {
  for (const corrupt of [
    (s) => { compositionLoss(s).selected_entity_group_id = ""; },
    (s) => { compositionLoss(s).selected_entity_group_id = 0; },
    (s) => { compositionLoss(s).entity_bounded_score_points = "0"; },
    (s) => { compositionLoss(s).entity_score_available = false; },
    (s) => { s.channel_loss_sensitivity.provider_requests_made = 1; },
    (s) => { s.channel_loss_sensitivity.summary.maximum_entity_score_drop_points = 0; },
    (s) => {
      // Reconcile the changed numeric summary: the missing entity must still
      // invalidate a positive score even when the arithmetic is consistent.
      const scenario = compositionLoss(s);
      scenario.entity_bounded_score_points = 1;
      scenario.entity_score_change_points = -26;
      const summary = s.channel_loss_sensitivity.summary;
      summary.maximum_entity_score_drop_points = 26;
      summary.maximum_absolute_entity_score_change_points = 26;
      summary.baseline_and_counterfactual_entity_score_range_points.minimum = 1;
    },
  ]) {
    const similarity = sample("recording_no_match_with_composition");
    corrupt(similarity);
    assert.equal(channelLossSensitivityView(similarity)?.available, false);
  }
});

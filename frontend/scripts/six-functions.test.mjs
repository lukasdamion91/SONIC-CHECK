import test from "node:test";
import assert from "node:assert/strict";
import { relationalScoreView, SIX_FUNCTION_SCORE_VERSION, RELATIONAL_METHOD_VERSION, LYRIC_ORDER_VERSION, INTERVAL_PATH_VERSION, BETA_SCORE_VERSION, BETA_INTERVAL_VERSION } from "../src/lib/relationalScorePresentation.mjs";

function fixture() {
  const weights = [.18, .18, .24, .10, .15, .15];
  const names = ["recording_identity", "lyric_overlap", "composition_similarity", "relational_specificity", "lyric_order_recovery", "interval_path_specificity"];
  const data = { aggregate_score_method_version: SIX_FUNCTION_SCORE_VERSION,
    aggregate_evidence_score: { score_method_version: SIX_FUNCTION_SCORE_VERSION, available: true,
      value: 100, scored_entity_group_id: "entity-a", channel_coverage_percent: 100, unscored_weight_percent: 0,
      components: names.map((modality, i) => ({ modality, base_weight: weights[i], checked: true,
        signal_percent: 100, weighted_signal_points: 100 * weights[i], scored_entity_group_id: "entity-a" })) } };
  [RELATIONAL_METHOD_VERSION, LYRIC_ORDER_VERSION, INTERVAL_PATH_VERSION].forEach((method_version, index) => {
    data[names[index + 3]] = { method_version, weight_percent: weights[index + 3] * 100,
      selected_entity_group_id: "entity-a", selected_signal_percent: 100, aggregate_contribution_points: weights[index + 3] * 100 };
  });
  return data;
}
test("six allocated functions reach exactly 100 points", () => {
  const view = relationalScoreView(fixture());
  assert.equal(view.valid, true); assert.equal(view.six, true); assert.equal(view.components.length, 6);
});
test("missing lyrics reserve their 15 percent", () => {
  const data = fixture(); const score = data.aggregate_evidence_score;
  Object.assign(score.components[4], { checked: false, signal_percent: null, weighted_signal_points: 0, scored_entity_group_id: null });
  Object.assign(data.lyric_order_recovery, { selected_signal_percent: null, aggregate_contribution_points: null });
  Object.assign(score, { value: 85, channel_coverage_percent: 85, unscored_weight_percent: 15 });
  assert.equal(relationalScoreView(data).valid, true);
});
test("beta interval decisions remain separate from the numeric score", () => {
  for (const selected_rule_decision of [true, false, null]) {
    const data = fixture(); const score = data.aggregate_evidence_score;
    data.aggregate_score_method_version = score.score_method_version = BETA_SCORE_VERSION;
    Object.assign(score.components[5], { signal_percent: 6.0345, weighted_signal_points: .905175 });
    score.value = 85.9;
    Object.assign(data.interval_path_specificity, { method_version: BETA_INTERVAL_VERSION,
      selected_signal_percent: 6.0345, aggregate_contribution_points: .905175, selected_rule_decision });
    const view = relationalScoreView(data);
    assert.equal(view.valid, true);
    assert.equal(view.score.value, 85.9);
    assert.equal(view.additional[1].selected_rule_decision, selected_rule_decision);
    data.interval_path_specificity.method_version = INTERVAL_PATH_VERSION;
    assert.equal(relationalScoreView(data).valid, false);
  }
});
for (const [name, mutate] of Object.entries({
  weight: (d) => { d.aggregate_evidence_score.components[4].base_weight = .3; },
  foreignEntity: (d) => { d.lyric_order_recovery.selected_entity_group_id = "other"; },
  version: (d) => { d.interval_path_specificity.method_version = "unknown"; },
  points: (d) => { d.lyric_order_recovery.aggregate_contribution_points = 100; },
  missingDiagnostic: (d) => { delete d.interval_path_specificity; },
  malformedTotal: (d) => { d.aggregate_evidence_score.value = NaN; },
})) test(`rejects six-function ${name}`, () => { const data = fixture(); mutate(data); assert.equal(relationalScoreView(data).valid, false); });

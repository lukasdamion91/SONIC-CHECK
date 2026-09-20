import test from "node:test";
import assert from "node:assert/strict";
import { relationalScoreView, RELATIONAL_SCORE_VERSION, RELATIONAL_METHOD_VERSION } from "../src/lib/relationalScorePresentation.mjs";

function fixture() {
  const weights = [.27, .27, .36, .1];
  const modalities = ["recording_identity", "lyric_overlap", "composition_similarity", "relational_specificity"];
  return { aggregate_score_method_version: RELATIONAL_SCORE_VERSION,
    aggregate_evidence_score: { score_method_version: RELATIONAL_SCORE_VERSION, available: true,
      value: 46, scored_entity_group_id: "entity-a", channel_coverage_percent: 46, unscored_weight_percent: 54,
      components: modalities.map((modality, i) => ({ modality, base_weight: weights[i], checked: i >= 2,
        signal_percent: i >= 2 ? 100 : null, weighted_signal_points: i >= 2 ? weights[i] * 100 : 0,
        scored_entity_group_id: i >= 2 ? "entity-a" : null })) },
    relational_specificity: { method_version: RELATIONAL_METHOD_VERSION, weight_percent: 10,
      selected_signal_percent: 100, aggregate_contribution_points: 10 } };
}
test("historical scans do not acquire a new score", () => assert.equal(relationalScoreView({}), null));
test("10% category and full aggregate arithmetic are verified", () => assert.equal(relationalScoreView(fixture()).valid, true));
for (const [name, mutate] of Object.entries({
  wrongWeight: (s) => { s.aggregate_evidence_score.components[3].base_weight = .2; },
  wrongTotal: (s) => { s.aggregate_evidence_score.value = 99; },
  foreignEntity: (s) => { s.aggregate_evidence_score.components[3].scored_entity_group_id = "other"; },
  unknownVersion: (s) => { s.aggregate_score_method_version = "unknown"; },
  zeroAsMissing: (s) => { s.aggregate_evidence_score.components[0].signal_percent = 0; },
  nonfinite: (s) => { s.aggregate_evidence_score.components[3].signal_percent = NaN; },
  missingTerm: (s) => { s.aggregate_evidence_score.components.pop(); },
})) test(`rejects ${name}`, () => { const data = fixture(); mutate(data); assert.equal(relationalScoreView(data).valid, false); });

import test from "node:test";
import assert from "node:assert/strict";
import { scanCategoryView } from "../src/lib/scanCategoryPresentation.mjs";
import {
  BETA_SCORE_VERSION, BETA_INTERVAL_VERSION, RELATIONAL_SCORE_VERSION,
  RELATIONAL_METHOD_VERSION, LYRIC_ORDER_VERSION,
} from "../src/lib/relationalScorePresentation.mjs";

const modalities = ["recording_identity", "lyric_overlap", "composition_similarity", "relational_specificity", "lyric_order_recovery", "interval_path_specificity"];
const betaWeights = [.18, .18, .24, .10, .15, .15];

// Synthetic saved-result contract, with intentionally unequal signals so an
// accidental mean or coverage-normalized score cannot match the expected total.
function betaResult(signals = [100, 20, 50, 80, 40, 6.0345], available = true) {
  const entity = available ? "candidate-a" : null;
  const components = modalities.map((modality, index) => ({
    modality, base_weight: betaWeights[index], checked: signals[index] !== null,
    signal_percent: signals[index],
    weighted_signal_points: signals[index] === null ? 0 : signals[index] * betaWeights[index],
    scored_entity_group_id: signals[index] === null ? null : entity,
  }));
  const coverage = components.reduce((total, row) => total + (row.checked ? row.base_weight * 100 : 0), 0);
  const similarity = {
    aggregate_score_method_version: BETA_SCORE_VERSION,
    aggregate_evidence_score: {
      score_method_version: BETA_SCORE_VERSION, available,
      value: available ? Math.round(components.reduce((total, row) => total + row.weighted_signal_points, 0) * 10) / 10 : null,
      scored_entity_group_id: entity, channel_coverage_percent: coverage,
      unscored_weight_percent: 100 - coverage, components,
    },
  };
  [RELATIONAL_METHOD_VERSION, LYRIC_ORDER_VERSION, BETA_INTERVAL_VERSION].forEach((method_version, offset) => {
    const row = components[offset + 3];
    similarity[row.modality] = {
      method_version, weight_percent: row.base_weight * 100,
      selected_entity_group_id: entity, selected_signal_percent: row.signal_percent,
      aggregate_contribution_points: row.checked ? row.weighted_signal_points : null,
    };
  });
  return { similarity_analysis: similarity };
}

test("beta category summary preserves validated server score and fixed contributions, not their arithmetic mean", () => {
  const result = betaResult();
  const before = structuredClone(result);
  const view = scanCategoryView(result);
  assert.equal(view.state, "scored");
  assert.equal(view.methodLabel, "Beta evidence index");
  assert.equal(view.value, 48.5);
  assert.deepEqual(view.rows.map(row => row.id), modalities);
  assert.deepEqual(view.rows.map(row => row.weight), [18, 18, 24, 10, 15, 15]);
  assert.deepEqual(view.rows.map(row => row.signal), [100, 20, 50, 80, 40, 6.0345]);
  view.rows.forEach((row, index) => assert.ok(Math.abs(row.points - [18, 3.6, 12, 8, 6, .905175][index]) < 1e-9));
  assert.equal(view.coverage, 100);
  assert.equal(view.unscored, 0);
  assert.deepEqual(result, before, "presenting results must not rewrite saved evidence");
});

test("available zero is displayed as zero, while absent categories and unavailable scores stay null", () => {
  const zero = scanCategoryView(betaResult([0, null, null, null, null, null]));
  assert.equal(zero.state, "scored");
  assert.equal(zero.value, 0);
  assert.equal(zero.rows[0].checked, true);
  assert.equal(zero.rows[0].signal, 0);
  assert.equal(zero.rows[0].points, 0);
  assert.equal(zero.coverage, 18);
  assert.equal(zero.unscored, 82);
  for (const row of zero.rows.slice(1)) {
    assert.equal(row.checked, false);
    assert.equal(row.signal, null);
    assert.equal(row.points, null);
  }
  const unavailable = scanCategoryView(betaResult(Array(6).fill(null), false));
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.value, null);
  assert.equal(unavailable.coverage, 0);
  assert.equal(unavailable.unscored, 100);
  assert.ok(unavailable.rows.every(row => !row.checked && row.signal === null && row.points === null));
});

test("missing category weight stays reserved and is never redistributed to observed categories", () => {
  const view = scanCategoryView(betaResult([null, null, 100, 100, null, 100]));
  assert.equal(view.value, 49);
  assert.equal(view.coverage, 49);
  assert.equal(view.unscored, 51);
  assert.deepEqual(view.rows.map(row => row.weight), [18, 18, 24, 10, 15, 15]);
  assert.deepEqual(view.rows.map(row => row.points), [null, null, 24, 10, null, 15]);
});

test("a supported available zero with no selected candidate remains zero without inventing category evidence", () => {
  const result = betaResult(Array(6).fill(null));
  const similarity = result.similarity_analysis;
  similarity.aggregate_evidence_score.scored_entity_group_id = null;
  for (const modality of modalities.slice(3)) similarity[modality].selected_entity_group_id = null;
  const view = scanCategoryView(result);
  assert.equal(view.state, "scored");
  assert.equal(view.value, 0);
  assert.equal(view.coverage, 0);
  assert.equal(view.unscored, 100);
  assert.ok(view.rows.every(row => !row.checked && row.signal === null && row.points === null));
});

test("beta rule decisions cannot replace the numeric category signal", () => {
  for (const selected_rule_decision of [true, false, null]) {
    const result = betaResult();
    result.similarity_analysis.interval_path_specificity.selected_rule_decision = selected_rule_decision;
    const view = scanCategoryView(result);
    assert.equal(view.value, 48.5);
    assert.equal(view.rows[5].signal, 6.0345);
    assert.ok(Math.abs(view.rows[5].points - .905175) < 1e-9);
  }
});

test("malformed or foreign-entity aggregate data cannot leak numerical category values into the summary", () => {
  const mutations = {
    foreignComponent: similarity => { similarity.aggregate_evidence_score.components[0].scored_entity_group_id = "another-candidate"; },
    foreignDiagnostic: similarity => { similarity.lyric_order_recovery.selected_entity_group_id = "another-candidate"; },
    wrongWeight: similarity => { similarity.aggregate_evidence_score.components[2].base_weight = .40; },
    wrongTotal: similarity => { similarity.aggregate_evidence_score.value = 100; },
    nonfiniteSignal: similarity => { similarity.aggregate_evidence_score.components[1].signal_percent = NaN; },
    missingCategory: similarity => { similarity.aggregate_evidence_score.components.pop(); },
    duplicateCategory: similarity => { similarity.aggregate_evidence_score.components[1].modality = "recording_identity"; },
    malformedCategory: similarity => { similarity.aggregate_evidence_score.components[0] = null; },
    wrongVersion: similarity => { similarity.aggregate_score_method_version = "future-score/2"; },
    wrongDiagnosticVersion: similarity => { similarity.interval_path_specificity.method_version = "unknown"; },
    unavailableWithNumber: similarity => { similarity.aggregate_evidence_score.available = false; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const result = betaResult();
    mutate(result.similarity_analysis);
    const view = scanCategoryView(result);
    assert.equal(view.state, "invalid", name);
    assert.equal(view.value, null, name);
    assert.equal(view.coverage, null, name);
    assert.equal(view.unscored, null, name);
    assert.ok(view.rows.every(row => !row.checked && row.signal === null && row.points === null && row.weight === null), name);
  }
});

test("historical four-category records retain their recorded weights and score", () => {
  const weights = [.27, .27, .36, .10];
  const result = { similarity_analysis: {
    aggregate_score_method_version: RELATIONAL_SCORE_VERSION,
    aggregate_evidence_score: {
      score_method_version: RELATIONAL_SCORE_VERSION, available: true, value: 46,
      scored_entity_group_id: "historical-candidate", channel_coverage_percent: 46, unscored_weight_percent: 54,
      components: modalities.slice(0, 4).map((modality, index) => ({
        modality, base_weight: weights[index], checked: index >= 2,
        signal_percent: index >= 2 ? 100 : null, weighted_signal_points: index >= 2 ? weights[index] * 100 : 0,
        scored_entity_group_id: index >= 2 ? "historical-candidate" : null,
      })),
    },
    relational_specificity: { method_version: RELATIONAL_METHOD_VERSION, weight_percent: 10,
      selected_signal_percent: 100, aggregate_contribution_points: 10 },
  } };
  const view = scanCategoryView(result);
  assert.equal(view.value, 46);
  assert.equal(view.methodLabel, "Research evidence index");
  assert.equal(view.rows.length, 4);
  assert.deepEqual(view.rows.map(row => row.weight), [27, 27, 36, 10]);
  assert.deepEqual(view.rows.map(row => row.id), modalities.slice(0, 4));
  assert.equal(view.coverage, 46);
  assert.equal(view.unscored, 54);
});

test("legacy signals without a supported weighted aggregate are not reinterpreted as a new six-category score", () => {
  const view = scanCategoryView({ similarity_analysis: {
    similarity_signal: { value_percent: 92 },
    aggregate_score: { value: 77, channel_coverage_percent: 100 },
    recording_similarity: 100,
  } });
  assert.equal(view.state, "unavailable");
  assert.equal(view.value, null);
  assert.equal(view.methodLabel, null);
  assert.ok(view.rows.every(row => !row.checked && row.signal === null && row.points === null && row.weight === null));
});

export const RELATIONAL_SCORE_VERSION = "harry-entity-relational-score/1.0.0-research";
export const RELATIONAL_METHOD_VERSION = "harry-counterfactual-binding/1.0.0-research";
export const SIX_FUNCTION_SCORE_VERSION = "harry-six-function-score/1.0.0-research";
export const LYRIC_ORDER_VERSION = "harry-lyric-order-recovery/1.0.0-research";
export const INTERVAL_PATH_VERSION = "harry-interval-path-specificity/1.0.0-research";
export const BETA_SCORE_VERSION = "harry-six-function-score/1.1.0-beta";
export const BETA_INTERVAL_VERSION = "harry-verified-interval/1.0.0-beta";
const percent = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
const near = (a, b, tolerance = 0.001) => typeof a === "number" && Number.isFinite(a) && Math.abs(a - b) <= tolerance;

export function relationalScoreView(similarity = {}) {
  if (!Object.hasOwn(similarity, "aggregate_evidence_score")) return null;
  const score = similarity.aggregate_evidence_score;
  const diagnostic = similarity.relational_specificity;
  const beta = similarity.aggregate_score_method_version === BETA_SCORE_VERSION;
  const six = beta || similarity.aggregate_score_method_version === SIX_FUNCTION_SCORE_VERSION;
  const version = beta ? BETA_SCORE_VERSION : six ? SIX_FUNCTION_SCORE_VERSION : RELATIONAL_SCORE_VERSION;
  const WEIGHTS = six ? [.18, .18, .24, .10, .15, .15] : [.27, .27, .36, .10];
  const MODALITIES = ["recording_identity", "lyric_overlap", "composition_similarity", "relational_specificity",
    ...(six ? ["lyric_order_recovery", "interval_path_specificity"] : [])];
  const invalid = { valid: false, reason: "The stored aggregate failed its version or arithmetic checks." };
  if (similarity.aggregate_score_method_version !== version
    || score?.score_method_version !== version
    || diagnostic?.method_version !== RELATIONAL_METHOD_VERSION
    || diagnostic.weight_percent !== 10 || !Array.isArray(score.components)
    || score.components.length !== WEIGHTS.length) return invalid;
  let total = 0;
  let coverage = 0;
  for (const [index, component] of score.components.entries()) {
    if (component.modality !== MODALITIES[index] || component.base_weight !== WEIGHTS[index]
      || typeof component.checked !== "boolean") return invalid;
    if (component.checked) {
      if (!percent(component.signal_percent) || component.scored_entity_group_id !== score.scored_entity_group_id
        || !score.scored_entity_group_id || !near(component.weighted_signal_points, component.signal_percent * WEIGHTS[index])) return invalid;
      total += component.weighted_signal_points;
      coverage += 100 * WEIGHTS[index];
    } else if (component.signal_percent !== null || component.weighted_signal_points !== 0) return invalid;
  }
  if (typeof score.available !== "boolean"
    || (score.available ? !near(score.value, total, 0.051) : score.value !== null || total !== 0)
    || !near(score.channel_coverage_percent, coverage)
    || !near(score.unscored_weight_percent, 100 - coverage)) return invalid;
  const relational = score.components[3];
  if (diagnostic.selected_signal_percent !== relational.signal_percent
    || (relational.checked ? !near(diagnostic.aggregate_contribution_points, relational.weighted_signal_points)
      : diagnostic.aggregate_contribution_points !== null)) return invalid;
  const additional = [];
  if (six) for (const [index, method] of [[4, LYRIC_ORDER_VERSION], [5, beta ? BETA_INTERVAL_VERSION : INTERVAL_PATH_VERSION]]) {
    const row = score.components[index];
    const detail = similarity[row.modality];
    if (detail?.method_version !== method || detail.weight_percent !== 15
      || detail.selected_signal_percent !== row.signal_percent
      || detail.selected_entity_group_id !== score.scored_entity_group_id
      || (row.checked ? !near(detail.aggregate_contribution_points, row.weighted_signal_points)
        : detail.aggregate_contribution_points !== null)) return invalid;
    additional.push(detail);
  }
  return { valid: true, score, diagnostic, additional, six, components: score.components };
}

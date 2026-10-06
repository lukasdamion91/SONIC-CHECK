import { HARRY_COMPONENTS } from "./componentActivity.mjs";
import { relationalScoreView, BETA_SCORE_VERSION } from "./relationalScorePresentation.mjs";

// Preview of the existing six-function contract, not a new scoring model.
const weights = [18, 18, 24, 10, 15, 15];
const descriptions = [
  ["Compares audio fingerprints with recordings in the sources searched.", "Helps identify a possible connection to an existing recording, including an excerpt."],
  ["Compares submitted lyrics with available reference text for shared phrases.", "Highlights wording that may warrant a closer comparison. Lyrics must be supplied separately."],
  ["Compares pitch, harmonic and rhythmic features with available musical references.", "Surfaces musical resemblance that a recording fingerprint alone may not capture."],
  ["Tests whether harmony and rhythmic events remain linked in time beyond disrupted controls.", "Examines the relationship between musical features, rather than isolated similarities."],
  ["Measures ordered correspondence between submitted and reference lyric fragments.", "Helps distinguish a shared sequence of words from scattered phrase overlap."],
  ["Examines ordered pitch-interval movement against eligible musical references.", "Tests whether the pattern of pitch changes carries specific comparison evidence."],
];
export const SCAN_CATEGORIES = Object.freeze(HARRY_COMPONENTS.map((row, index) => Object.freeze({
  ...row, weight: weights[index], description: descriptions[index][0], relevance: descriptions[index][1],
})));

export function scanCategoryView(result = null, pending = false) {
  const waiting = result == null;
  const fallback = (state, reason) => ({
    state, reason, value: null, coverage: null, unscored: null, methodLabel: null,
    rows: SCAN_CATEGORIES.map(row => ({ ...row, weight: waiting ? row.weight : null, checked: false, signal: null, points: null })),
  });
  if (waiting) return fallback(pending ? "processing" : "waiting", pending
    ? "Your category results will appear when the analysis finishes."
    : "Upload audio and start an analysis to see your results.");
  let view;
  try { view = relationalScoreView(result?.similarity_analysis || {}); }
  catch { return fallback("invalid", "The saved category data could not be verified."); }
  if (!view) return fallback("unavailable", "This saved scan does not contain a supported category-weighted score.");
  if (!view.valid) return fallback("invalid", view.reason);
  const score = view.score;
  return {
    state: score.available ? "scored" : "unavailable",
    reason: score.available ? "Only category evidence linked to the same eligible candidate contributes."
      : "No eligible candidate score is available for this scan.",
    value: score.available ? score.value : null,
    coverage: score.channel_coverage_percent, unscored: score.unscored_weight_percent,
    methodLabel: score.score_method_version === BETA_SCORE_VERSION ? "Beta evidence index" : "Research evidence index",
    rows: view.components.map(component => ({
      ...SCAN_CATEGORIES.find(row => row.id === component.modality),
      weight: component.base_weight * 100, checked: component.checked,
      signal: component.checked ? component.signal_percent : null,
      points: component.checked ? component.weighted_signal_points : null,
    })),
  };
}

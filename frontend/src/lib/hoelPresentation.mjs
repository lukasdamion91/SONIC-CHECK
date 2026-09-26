const VERSION = "soniccheck-hoel-value-system/1.0.0-candidate";
const CATEGORIES = {
  candidate_support: "Candidate support",
  evidence_coverage: "Evidence coverage",
  source_independence: "Source independence",
  contradiction_resistance: "Contradiction resistance",
  provenance_integrity: "Provenance integrity",
};
const percent = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;

export function hoelPresentation(hoel) {
  if (hoel?.value_system_version !== VERSION || !percent(hoel?.index_percent)) return null;
  const values = hoel.category_values || {};
  if (!Object.keys(CATEGORIES).every((key) => percent(values[key]))) return null;
  const projection = hoel.aggregate_projection;
  const validProjection = projection?.method_version === VERSION
    && projection.status === "COMPUTED_RESEARCH_ONLY"
    && projection.affects_authoritative_score === false
    && percent(projection.base_points) && percent(projection.projected_points)
    && typeof projection.adjustment_points === "number" && Number.isFinite(projection.adjustment_points)
    && projection.adjustment_points <= 0
    && Math.abs(projection.base_points + projection.adjustment_points - projection.projected_points) <= 0.00011;
  return {
    value: hoel.index_percent.toFixed(2),
    measuredZero: hoel.is_measured_zero === true && hoel.index_percent === 0,
    categories: Object.entries(CATEGORIES).map(([key, label]) => ({ key, label, value: values[key].toFixed(2) })),
    projection: validProjection ? {
      value: projection.projected_points.toFixed(2),
      adjustment: projection.adjustment_points.toFixed(2),
    } : null,
  };
}

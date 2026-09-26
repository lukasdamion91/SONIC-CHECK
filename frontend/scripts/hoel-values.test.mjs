import test from "node:test";
import assert from "node:assert/strict";
import { hoelPresentation } from "../src/lib/hoelPresentation.mjs";

const fixture = () => ({
  value_system_version: "soniccheck-hoel-value-system/1.0.0-candidate",
  index_percent: 80,
  category_values: { candidate_support: 80, evidence_coverage: 100, source_independence: 50,
    contradiction_resistance: 100, provenance_integrity: 100 },
  aggregate_projection: { method_version: "soniccheck-hoel-value-system/1.0.0-candidate",
    status: "COMPUTED_RESEARCH_ONLY", base_points: 49, projected_points: 46,
    adjustment_points: -3, affects_authoritative_score: false },
});

test("HOEL presents values and an internally consistent research adjustment", () => {
  const actual = hoelPresentation(fixture());
  assert.equal(actual.value, "80.00");
  assert.equal(actual.categories.length, 5);
  assert.deepEqual(actual.projection, { value: "46.00", adjustment: "-3.00" });
});
test("zero remains distinguishable from missing or unsupported measurements", () => {
  const value = fixture(); value.index_percent = 0; value.is_measured_zero = true;
  assert.equal(hoelPresentation(value).measuredZero, true);
  for (const missing of [undefined, {}, { ...value, index_percent: null },
    { ...value, value_system_version: "unsupported" }]) assert.equal(hoelPresentation(missing), null);
});
test("invalid numeric values cannot appear as percentages", () => {
  for (const invalid of [NaN, Infinity, true, "100", -1, 101]) {
    assert.equal(hoelPresentation({ ...fixture(), index_percent: invalid }), null);
    const value = fixture(); value.category_values.candidate_support = invalid;
    assert.equal(hoelPresentation(value), null);
  }
});
test("inconsistent or authoritative adjustment claims are not displayed", () => {
  for (const changes of [{ adjustment_points: 3 }, { projected_points: 1 },
    { affects_authoritative_score: true }, { adjustment_points: NaN }]) {
    const value = fixture(); Object.assign(value.aggregate_projection, changes);
    assert.equal(hoelPresentation(value).projection, null);
  }
});

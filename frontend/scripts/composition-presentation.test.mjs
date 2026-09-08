import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMPOSITION_COMPONENTS,
  compositionAnalysisView,
  compositionPercent,
} from "../src/lib/compositionPresentation.mjs";
import { buildChannelCoverageRows, compositionComparisonDisclosure } from "../src/lib/scanResultPresentation.mjs";

const comparison = () => ({
  reference_id: "synthetic-reference",
  title: "Synthetic reference",
  status: "COMPLETED_RESEARCH_ONLY",
  composition_signal_percent: 64,
  measurement_confidence_percent: 72,
  components: Object.fromEntries(COMPOSITION_COMPONENTS.map(([key], index) => [key, index * 25])),
  best_transposition_semitones: -3,
  feature_source: "versioned_feature_profile",
  candidate_origin: "catalogue_feature_index",
});
const analysis = () => ({
  status: "COMPLETED_RESEARCH_ONLY",
  method_version: "0.4.0-research",
  catalogue_entries_available: 10,
  catalogue_entries_considered: 1,
  successful_comparison_count: 1,
  references_unavailable: 0,
  references_signal_insufficient: 0,
  catalogue_scan_limit: 1,
  catalogue_scan_truncated: true,
  query_audio_quality: { analysed_seconds: 19.16, voiced_frame_ratio: 1 },
  query_signal_sufficiency: { status: "SUFFICIENT", reason_codes: [] },
  comparisons: [comparison()],
});

test("composition percentages never coerce null, booleans, strings or non-finite/out-of-range values", () => {
  for (const value of [null, undefined, "0", "99", false, true, {}, [], NaN, Infinity, -Infinity, -1, 101]) {
    assert.equal(compositionPercent(value), null);
  }
  for (const value of [0, 0.1, 50, 100]) assert.equal(compositionPercent(value), value);
});

test("composition absence and legacy null abstention are explicit and never numerical zero", () => {
  for (const absent of [undefined, null, {}, [], "unavailable"]) {
    const view = compositionAnalysisView(absent);
    assert.equal(view.state, "absent");
    assert.equal(view.successful, null);
    assert.equal(view.disclosure, null);
  }
  const view = compositionAnalysisView({ comparisons: [{ composition_signal_percent: null }] });
  assert.equal(view.state, "unavailable");
  assert.equal(view.comparisons[0].signal, null);
  assert.equal(view.comparisons[0].quality, null);
  assert.ok(view.comparisons[0].components.every((item) => item.percent === null));
  assert.equal(view.disclosure, null);
});

test("valid zero agreement survives legacy records without invented component or quality scores", () => {
  const view = compositionAnalysisView({ comparisons: [{ composition_signal_percent: 0 }] });
  assert.equal(view.state, "compared");
  assert.equal(view.status, "Legacy research comparisons");
  assert.equal(view.successful, 1);
  assert.equal(view.comparisons[0].signal, 0);
  assert.equal(view.comparisons[0].quality, null);
  assert.ok(view.comparisons[0].components.every((item) => item.percent === null));
});

test("composition keeps actual coverage, four proxy components, method, source and alignment direction", () => {
  const view = compositionAnalysisView(analysis());
  assert.equal(view.invalid, false);
  assert.equal(view.state, "compared");
  assert.deepEqual([view.available, view.eligible, view.considered, view.successful, view.unavailable], [10, null, 1, 1, 0]);
  assert.equal(view.truncated, true);
  assert.equal(view.limit, 1);
  assert.equal(view.durationSeconds, 19.16);
  assert.equal(view.comparisons[0].shift, -3);
  assert.equal(view.comparisons[0].source, "Versioned reference feature profile");
  assert.equal(view.comparisons[0].origin, "Catalogue feature reference");
  assert.deepEqual(view.comparisons[0].components.map((item) => item.percent), [0, 25, 50, 75]);
  assert.equal(view.method, "0.4.0-research");
  assert.match(view.disclosure, /No multiple-comparison adjustment/u);
});

test("malformed summary counts cannot manufacture successful comparisons", () => {
  for (const key of ["catalogue_entries_available", "catalogue_entries_considered", "successful_comparison_count", "references_unavailable", "references_signal_insufficient", "catalogue_scan_limit"]) {
    for (const value of ["1", false, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const fixture = analysis();
      fixture[key] = value;
      const view = compositionAnalysisView(fixture);
      assert.equal(view.invalid, true, `${key}: ${value}`);
      assert.equal(view.successful, null);
      assert.equal(view.comparisons[0].signal, null);
      assert.equal(view.disclosure, null);
      assert.equal(buildChannelCoverageRows({ scan_modes: { audio: true }, composition_analysis: fixture })[2].state, "unavailable_degraded");
    }
  }
});

test("contradictory successful and considered counts fail closed rather than taking their maximum", () => {
  for (const patch of [
    { successful_comparison_count: 2 },
    { successful_comparison_count: 0 },
    { catalogue_entries_considered: 0 },
    { references_unavailable: 1 },
    { references_signal_insufficient: 1 },
    { catalogue_entries_considered: 2, references_unavailable: 1, references_signal_insufficient: 1 },
    { comparisons: null, successful_comparison_count: 1 },
    { comparisons: "one" },
    { catalogue_scan_truncated: "false" },
  ]) {
    const value = { ...analysis(), ...patch };
    assert.equal(compositionAnalysisView(value).invalid, true);
    assert.equal(compositionComparisonDisclosure(value), null);
  }
});

test("malformed numerical rows and unavailable statuses cannot masquerade as valid comparisons", () => {
  for (const patch of [
    { composition_signal_percent: "0" },
    { composition_signal_percent: NaN },
    { composition_signal_percent: Infinity },
    { composition_signal_percent: 101 },
    { measurement_confidence_percent: false },
    { status: "REFERENCE_AUDIO_UNAVAILABLE" },
    { status: "REFERENCE_SIGNAL_INSUFFICIENT" },
    { signal_sufficiency: { reference: { status: "INSUFFICIENT", reason_codes: ["NO_INFORMATIVE_FRAMES"] } } },
    { signal_sufficiency: { reference: { status: "UNKNOWN" } } },
    { signal_sufficiency: "SUFFICIENT" },
  ]) {
    const value = analysis();
    value.comparisons[0] = { ...comparison(), ...patch };
    const view = compositionAnalysisView(value);
    assert.equal(view.invalid, true);
    assert.equal(view.comparisons[0].signal, null);
    assert.equal(view.comparisons[0].quality, null);
  }
});

test("malformed components and shift are withheld without coercion", () => {
  const value = analysis();
  value.comparisons[0].components = Object.fromEntries(COMPOSITION_COMPONENTS.map(([key]) => [key, "50"]));
  value.comparisons[0].best_transposition_semitones = "3";
  const view = compositionAnalysisView(value);
  assert.ok(view.comparisons[0].components.every((item) => item.percent === null));
  assert.equal(view.comparisons[0].shift, null);
});

test("query insufficiency is an abstention with readable reasons and no score", () => {
  const value = {
    status: "QUERY_SIGNAL_INSUFFICIENT",
    reason: "Insufficient informative pitch sequence.",
    catalogue_entries_considered: 0,
    successful_comparison_count: 0,
    query_signal_sufficiency: { status: "INSUFFICIENT", reason_codes: ["NO_PITCH_VARIATION"] },
    comparisons: [],
  };
  const view = compositionAnalysisView(value);
  assert.equal(view.invalid, false);
  assert.equal(view.state, "insufficient");
  assert.equal(view.status, "Input insufficient");
  assert.deepEqual(view.queryInput.reasons, ["no pitch variation"]);
  assert.equal(view.successful, 0);
  assert.equal(view.disclosure, null);
  assert.equal(buildChannelCoverageRows({ scan_modes: { audio: true }, composition_analysis: value })[2].outcome, "Input insufficient");
});

test("reference insufficiency remains distinct from missing reference audio", () => {
  const view = compositionAnalysisView({
    status: "REFERENCE_SIGNAL_INSUFFICIENT",
    catalogue_entries_considered: 1,
    references_signal_insufficient: 1,
    references_unavailable: 0,
    comparisons: [{ status: "REFERENCE_SIGNAL_INSUFFICIENT", composition_signal_percent: null,
      signal_sufficiency: { reference: { status: "INSUFFICIENT", reason_codes: ["STATIC_PITCH_SEQUENCE"] } } }],
  });
  assert.equal(view.state, "insufficient");
  assert.equal(view.successful, 0);
  assert.equal(view.insufficient, 1);
  assert.equal(view.unavailable, 0);
  assert.equal(view.comparisons[0].signal, null);
});

test("unavailable top-level result overrides contradictory numerical rows", () => {
  for (const status of ["NOT_CONFIGURED", "QUERY_SIGNAL_INSUFFICIENT", "RETRIEVAL_QUERY_FAILED", "UNKNOWN_NEW_STATUS"]) {
    const view = compositionAnalysisView({ ...analysis(), status });
    assert.equal(view.state, "unavailable");
    assert.equal(view.comparisons[0].signal, null);
    assert.equal(view.disclosure, null);
  }
});

test("component is wired unconditionally and explains the feature proxy and research boundary", async () => {
  const page = await readFile(new URL("../src/pages/ScanResult.jsx", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/CompositionAnalysis.jsx", import.meta.url), "utf8");
  assert.match(page, /<CompositionAnalysis analysis=\{result\.composition_analysis\} \/>/u);
  assert.doesNotMatch(page, /Composition refinement|compositionComparisons\.map/u);
  assert.match(component, /aria-labelledby="composition-analysis-heading"/u);
  assert.match(component, /proxy, not melody transcription/u);
  assert.match(component, /Reference-to-query alignment/u);
  assert.match(component, /qualified human review/u);
  assert.match(component, /not calibrated confidence/u);
  assert.doesNotMatch(component, /voiced_frame_ratio/u);
});

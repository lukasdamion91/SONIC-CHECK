import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { featureInventoryView, FEATURE_INVENTORY_SCHEMA, FEATURE_INVENTORY_INTERPRETATION, RUNTIME_FEATURES } from "../src/lib/featureInventoryPresentation.mjs";
import { buildChannelCoverageRows } from "../src/lib/scanResultPresentation.mjs";

function inventory() {
  return {
    schema_version: FEATURE_INVENTORY_SCHEMA,
    inventory_scope: "CURRENT_RUNTIME_CAPABILITIES",
    channel_count: 3,
    feature_count: 6,
    interpretation: FEATURE_INVENTORY_INTERPRETATION,
    features: RUNTIME_FEATURES.map((feature) => ({
      feature_id: feature.id,
      label: feature.label,
      parent_channel: feature.parentChannel,
      method_version: "controlled-fixture-1.0",
      input_requirement: feature.inputRequirement,
      execution_status: feature.id === "lyric_phrase_overlap" ? "NOT_SUBMITTED" : "COMPLETED",
      completed_comparison_count: feature.id === "recording_identity" ? null : feature.id === "lyric_phrase_overlap" ? 0 : 955,
      limitation: feature.limitation,
    })),
  };
}

test("six runtime features retain three channels and independently reported outcomes", () => {
  const source = inventory();
  source.features[3].execution_status = "INSUFFICIENT_SIGNAL";
  source.features[3].completed_comparison_count = 0;
  source.features[4].execution_status = "PARTIAL";
  source.features[4].completed_comparison_count = 301;
  const view = featureInventoryView({ feature_inventory: source });
  assert.equal(view.fullyReported, true);
  assert.equal(view.rows.length, 6);
  assert.equal(new Set(view.rows.map((row) => row.channel)).size, 3);
  assert.deepEqual(view.rows.map((row) => row.status), ["COMPLETED", "NOT_SUBMITTED", "COMPLETED", "INSUFFICIENT_SIGNAL", "PARTIAL", "COMPLETED"]);
  assert.deepEqual(view.rows.map((row) => row.completedComparisons), [null, 0, 955, 0, 301, 955]);
  assert.equal(view.rows[0].countLabel, "Not disclosed by provider");
  assert.equal(view.rows[1].inputRequirement, "Submitted lyric text");
  assert.equal(view.completedFeatureCount, 3);
  assert.equal(view.partialFeatureCount, 1);
});

test("saved partial recording coverage keeps its undisclosed provider count and all six entries", () => {
  const source = inventory();
  source.features[0].execution_status = "PARTIAL";
  source.features[0].method_version = "soniccheck-recording-identity-orchestration/1.1.0";
  const restored = JSON.parse(JSON.stringify({ feature_inventory: source, evidence: { feature_inventory: source } }));
  const view = featureInventoryView(restored);
  assert.equal(view.fullyReported, true);
  assert.equal(view.rows[0].status, "PARTIAL");
  assert.equal(view.rows[0].completedComparisons, null);
  assert.equal(view.rows[0].countLabel, "Not disclosed by provider");
  assert.equal(view.partialFeatureCount, 1);
  assert.equal(view.completedFeatureCount, 4);
  for (const index of [1, 2]) {
    const invalid = inventory();
    invalid.features[index].execution_status = "PARTIAL";
    invalid.features[index].completed_comparison_count = null;
    assert.equal(featureInventoryView({ feature_inventory: invalid }).reported, false);
  }
});

test("historical aggregate results never invent individual feature execution", () => {
  const view = featureInventoryView({
    scan_modes: { audio: true, lyrics: true },
    fingerprint: { status_code: 0 },
    lyric_analysis: { source_usable: true, candidates_checked: 8 },
    composition_analysis: { status: "COMPLETED_RESEARCH_ONLY", successful_comparison_count: 955 },
  });
  assert.equal(view.reported, false);
  assert.equal(view.completedFeatureCount, 0);
  assert.ok(view.rows.every((row) => row.status === "UNREPORTED" && row.completedComparisons === null));
  assert.equal(featureInventoryView(null).reported, false);
});

test("persisted evidence inventory is used when root projection is absent", () => {
  const source = inventory();
  assert.deepEqual(featureInventoryView({ evidence: { feature_inventory: source } }), featureInventoryView({ feature_inventory: source }));
  assert.deepEqual(featureInventoryView({ feature_inventory: null, evidence: { feature_inventory: source } }), featureInventoryView({ feature_inventory: source }));
  assert.deepEqual(featureInventoryView({ feature_inventory: source, evidence: { feature_inventory: null } }), featureInventoryView({ feature_inventory: source }));
  assert.equal(featureInventoryView({ feature_inventory: null, evidence: { feature_inventory: null } }).reported, false);
  const broken = { ...source, schema_version: "unsupported-version" };
  assert.equal(featureInventoryView({ feature_inventory: broken, evidence: { feature_inventory: source } }).reported, false);
});

test("missing, duplicate, malformed and future feature entries cannot appear completed", () => {
  const source = inventory();
  source.features = source.features.filter((feature) => feature.feature_id !== "coarse_harmonic_sequence");
  source.features.push({ ...source.features[2] });
  source.features[3].execution_status = "CERTIFIED";
  source.features[4].completed_comparison_count = "955";
  source.features[1].parent_channel = "recording_identity";
  const view = featureInventoryView({ feature_inventory: source });
  assert.equal(view.fullyReported, false);
  assert.ok(view.rows.every((row) => row.status === "UNREPORTED" && row.completedComparisons === null));
});

test("contradictory execution counts never display successful composition or unavailable-but-completed checks", () => {
  const source = inventory();
  source.features[2].completed_comparison_count = 0;
  source.features[3].execution_status = "UNAVAILABLE";
  source.features[4].completed_comparison_count = null;
  const view = featureInventoryView({ feature_inventory: source });
  assert.ok(view.rows.every((row) => row.status === "UNREPORTED" && row.completedComparisons === null));
});

test("conflicting persisted projections are withheld and key ordering alone is not a conflict", () => {
  const root = inventory();
  const conflicting = inventory();
  conflicting.features[2].completed_comparison_count = 954;
  assert.equal(featureInventoryView({ feature_inventory: root, evidence: { feature_inventory: conflicting } }).reported, false);
  const reordered = Object.fromEntries(Object.entries(root).reverse());
  assert.equal(featureInventoryView({ feature_inventory: root, evidence: { feature_inventory: reordered } }).fullyReported, true);
});

test("capability definitions without execution and altered canonical definitions are not scan evidence", () => {
  for (const change of [
    (value) => { delete value.features[0].execution_status; },
    (value) => { value.interpretation = "Accuracy certified"; },
    (value) => { value.features[3].label = "Transcribed melody"; },
    (value) => { value.features[3].limitation = ""; },
  ]) {
    const value = inventory();
    change(value);
    assert.equal(featureInventoryView({ feature_inventory: value }).reported, false);
  }
});

test("metadata discovery success with zero usable lyric texts cannot look like lyric screening success", () => {
  for (const lyricAnalysis of [
    { source_usable: false, status: "SOURCE_TEXT_UNAVAILABLE", candidates_checked: 0 },
    { source_usable: true, candidates_checked: 0 },
    { candidates_checked: 0 },
  ]) {
    const row = buildChannelCoverageRows({
      scan_modes: { lyrics: true },
      lyric_analysis: lyricAnalysis,
      evidence: { sources: [{ modality: "lyric_phrase_overlap", queries_succeeded: 3, candidates_with_text: 0 }] },
    })[1];
    assert.equal(row.state, "unavailable_degraded");
    assert.match(row.coverage, /No candidate lyric texts were available/u);
  }
});

test("partial lyric source coverage remains visible with and without candidate matches", () => {
  for (const partial of [
    { status: "PARTIAL_CANDIDATE_COVERAGE" },
    { comparison_coverage: "PARTIAL" },
    { candidate_texts_unavailable: 2 },
  ]) {
    for (const matches of [[], [{ analysis_type: "lyric_phrase_overlap" }]]) {
      const row = buildChannelCoverageRows({
        scan_modes: { lyrics: true },
        lyric_analysis: { source_usable: true, candidates_checked: 2, ...partial },
        matches,
      })[1];
      assert.match(row.outcome, /[Pp]artial/u);
      assert.match(row.coverage, /2 candidate texts checked.*source coverage incomplete/u);
      assert.equal(row.state, matches.length ? "candidate_evidence" : "unavailable_degraded");
    }
  }
});

test("successful empty discovery is distinguished from unavailable discovered lyric text", () => {
  const row = buildChannelCoverageRows({
    scan_modes: { lyrics: true },
    lyric_analysis: { discovery_usable: true, source_usable: true, candidates_retrieved: 0, candidates_checked: 0 },
  })[1];
  assert.equal(row.outcome, "Discovery completed — no candidate texts");
  assert.match(row.coverage, /0 candidate texts compared/u);
});

test("scan results mount the inventory alongside existing channel and composition evidence", async () => {
  const source = await readFile(new URL("../src/pages/ScanResult.jsx", import.meta.url), "utf8");
  assert.match(source, /<FeatureInventory result=\{result\} \/>/u);
  assert.match(source, /<ChannelCoverage rows=\{channelCoverageRows\} \/>/u);
  assert.match(source, /<CompositionAnalysis analysis=\{result\.composition_analysis\} \/>/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { savedDiagnosticsView, diagnosticNumber, EXTENSION_SCHEMA } from "../src/lib/savedDiagnosticsPresentation.mjs";

const fixture = () => ({
  schema_version: EXTENSION_SCHEMA, aggregate_score_modified: false,
  acoustic_diagnostics: {
    execution_status: "COMPLETED", status: "IMPLEMENTED_IN_CANDIDATE",
    coverage: { analyzed_duration_seconds: 10, coverage_fraction: 1 },
    decode_receipt: { decoded_seconds: 10, source_duration_seconds: 200, source_sample_rate_hz: 16000, source_channel_count: 1, coverage: "PARTIAL", window_start_seconds: 0, normalization_applied: false, resampling_requested: false, channel_downmix_requested: false },
    spectrum: { status: "MEASURED_SIGNAL_SPECTRUM", frequency_hz: [0, 20, 100, 1000, 8000], power_density_db_re_fs2_per_hz: [-180, -120, -80, -30, -100], n_fft: 4096, hop_samples: 2048, unframed_tail_samples: 32 },
    channels: [{ channel_index: 0, sample_peak_fs: 0, rms_fs: null, dc_offset_fs: 0, crest_factor_db: null, near_full_scale_sample_fraction: 0 }],
    timbre: { status: "DESCRIPTIVE_FEATURES", features: { centroid_hz: { mean: 1040.5 }, bandwidth_hz: { mean: 120 }, rolloff_85_hz: { mean: 1400 }, flatness: { mean: 0 } } },
    tempo: { status: "UNCALIBRATED_PERIODICITY_CANDIDATES", candidates: [{ bpm: 60.2 }, { bpm: 120.4 }] },
  },
  vocal_and_transcription: { status: "NOT_RUN", source_separation: { status: "NOT_RUN" } },
  final_evidence_review: { status: "COMPLETED_DIAGNOSTIC", issues: [{ code: "CONTROL", path: "components.<b>literal</b>&[2]", field: "old.path" }] },
});

test("legacy absence and unsupported extensions never backfill measurements", () => {
  for (const input of [null, undefined]) assert.equal(savedDiagnosticsView(input).state, "absent");
  for (const input of [[], "bad", true, {}, { schema_version: "future" }]) {
    const view = savedDiagnosticsView(input); assert.equal(view.state, "unsupported"); assert.equal(view.channels, undefined);
  }
});

test("saved values, units, native policy and whole source coverage stay distinct", () => {
  const input = fixture(); const original = structuredClone(input); const view = savedDiagnosticsView(input);
  assert.equal(view.measuredSeconds, 10); assert.equal(view.sourceSeconds, 200); assert.equal(view.coverage, "PARTIAL");
  assert.equal(view.sourceRate, 16000); assert.equal(view.sourceChannels, 1); assert.equal(view.nativePreserved, true);
  assert.equal(view.channels[0].peak, 0); assert.equal(view.channels[0].rms, null); assert.equal(view.channels[0].nearRail, 0);
  assert.equal(view.timbre[0].value, 1040.5); assert.equal(view.timbre[3].value, 0); assert.deepEqual(view.bpms, [60.2, 120.4]);
  assert.equal(view.issues[0].path, "components.<b>literal</b>&[2]"); assert.deepEqual(input, original);
  assert.equal(diagnosticNumber(0), "0.000"); assert.equal(diagnosticNumber(null), "Not measured");
});

test("failed execution cannot present stale nested measurements as measured", () => {
  for (const status of ["FAILED", "UNAVAILABLE", "NOT_SUBMITTED"]) {
    const input = fixture(); delete input.acoustic_diagnostics.execution_status; input.acoustic_diagnostics.status = status;
    const view = savedDiagnosticsView(input); assert.equal(view.status, status); assert.equal(view.spectrum, null);
    assert.equal(view.measuredSeconds, null); assert.deepEqual(view.channels, []); assert.deepEqual(view.bpms, []);
    assert.ok(view.timbre.every((r) => r.value === null));
  }
});

test("invalid finite, nonfinite, boolean, string and negative values are withheld", () => {
  for (const invalid of [true, "0", NaN, Infinity, -1, 17, null]) {
    const input = fixture(); input.acoustic_diagnostics.channels[0].sample_peak_fs = invalid;
    assert.equal(savedDiagnosticsView(input).channels[0].peak, null);
  }
  const input = fixture(); input.acoustic_diagnostics.channels[0].near_full_scale_sample_fraction = 1.1;
  input.acoustic_diagnostics.timbre.features.flatness.mean = 8; input.acoustic_diagnostics.decode_receipt.source_sample_rate_hz = "16000";
  assert.equal(savedDiagnosticsView(input).channels[0].nearRail, null); assert.equal(savedDiagnosticsView(input).timbre[3].value, null);
  assert.equal(savedDiagnosticsView(input).sourceRate, null);
});

test("malformed or unbounded spectra cannot create a chart", () => {
  const cases = [null, [], {}, { status: "FAILED" }, { status: "MEASURED_SIGNAL_SPECTRUM", frequency_hz: [100, 20], power_density_db_re_fs2_per_hz: [-10, -20] }, { status: "MEASURED_SIGNAL_SPECTRUM", frequency_hz: [20, 100], power_density_db_re_fs2_per_hz: [NaN, 0] }, { status: "MEASURED_SIGNAL_SPECTRUM", frequency_hz: [20, 100], power_density_db_re_fs2_per_hz: [-10, 1e9] }, { status: "MEASURED_SIGNAL_SPECTRUM", frequency_hz: Array.from({length: 1026}, (_, i) => i), power_density_db_re_fs2_per_hz: Array(1026).fill(-10) }];
  for (const spectrum of cases) { const input = fixture(); input.acoustic_diagnostics.spectrum = spectrum; assert.equal(savedDiagnosticsView(input).spectrum, null); }
});

test("malformed nested structures, issue limits, legacy locations and missing vocal evidence stay safe", () => {
  const input = fixture(); input.acoustic_diagnostics = []; input.vocal_and_transcription = false; input.final_evidence_review = { issues: [null, [], "bad", { code: "LEGACY", field: "legacy.field" }] };
  const view = savedDiagnosticsView(input); assert.equal(view.vocalStatus, "NOT_RUN"); assert.equal(view.separationStatus, "NOT_RUN"); assert.deepEqual(view.channels, []);
  assert.deepEqual(view.issues, [{ code: "LEGACY", path: "legacy.field" }]);
  input.final_evidence_review.issues = Array.from({length: 20}, () => ({ code: "x".repeat(400), path: "y".repeat(400) }));
  assert.equal(savedDiagnosticsView(input).issues.length, 6); assert.equal(savedDiagnosticsView(input).issues[0].path.length, 300);
});

test("saved score contradictions are visible and the input is never changed", () => {
  const input = fixture(); input.aggregate_score_modified = true;
  assert.match(savedDiagnosticsView(input).boundaryWarning, /declares a score modification/);
  assert.equal(input.aggregate_score_modified, true);
});

export { fixture };

test("real React rendering escapes saved text and renders the recorded chart and caveats", async () => {
  const require = createRequire(import.meta.url);
  const { transformSync } = require("@babel/core");
  const reactUrl = pathToFileURL(require.resolve("react")).href;
  const helperUrl = new URL("../src/lib/savedDiagnosticsPresentation.mjs", import.meta.url).href;
  let source = await readFile(new URL("../src/components/SavedAudioDiagnostics.jsx", import.meta.url), "utf8");
  source = source.replace('import { useMemo } from "react";', `import React, { useMemo } from ${JSON.stringify(reactUrl)};`)
    .replace('"@/lib/savedDiagnosticsPresentation.mjs"', JSON.stringify(helperUrl));
  const code = transformSync(source, { babelrc: false, configFile: false, plugins: [[require.resolve("@babel/plugin-transform-react-jsx"), { runtime: "classic" }]] }).code;
  const { default: Component } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const React = require("react"); const { renderToStaticMarkup } = require("react-dom/server");
  const input = fixture(); const before = structuredClone(input);
  let requests = 0; const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { requests++; throw Error("A saved viewer must not make network requests"); };
  let html;
  try { html = renderToStaticMarkup(React.createElement(Component, { extension: input })); }
  finally { globalThis.fetch = previousFetch; }
  assert.equal(requests, 0); assert.deepEqual(input, before);
  assert.match(html, /<polyline /); assert.match(html, /components\.&lt;b&gt;literal&lt;\/b&gt;&amp;\[2\]/);
  assert.doesNotMatch(html, /<b>literal<\/b>/); assert.match(html, /Singing transcription: NOT_RUN/);
  assert.match(html, /not proof of clipping/); assert.match(html, /confidence is uncalibrated/);
  assert.match(html, /200\.000 s/); assert.match(html, /Native rate and channels retained/);
  assert.match(html, /1,040|1040\.500/); assert.match(html, /add no points to the similarity score/);
  for (const extension of [null, {schema_version: "future"}, {schema_version: EXTENSION_SCHEMA, acoustic_diagnostics: {status: "FAILED"}}]) {
    const unavailable = renderToStaticMarkup(React.createElement(Component, { extension }));
    assert.doesNotMatch(unavailable, /<polyline /);
  }
  const route = await readFile(new URL("../src/pages/ScanResult.jsx", import.meta.url), "utf8");
  assert.match(route, /<SavedAudioDiagnostics extension=\{result\.analysis_extensions\}/);
  const savedProducerExtension = JSON.parse(await readFile(new URL("fixtures/saved-analysis-extensions.json", import.meta.url), "utf8"));
  const producedHtml = renderToStaticMarkup(React.createElement(Component, { extension: savedProducerExtension }));
  assert.match(producedHtml, /2\.000 s/);
  assert.match(producedHtml, /16000 Hz/);
  assert.match(producedHtml, /FULL_SELECTED_STREAM/);
  assert.match(producedHtml, /<polyline /);
  assert.match(producedHtml, /Singing transcription: NOT_RUN/);
  assert.equal(savedDiagnosticsView(savedProducerExtension).sourceSeconds, 2);
  if (process.env.SAVED_DIAGNOSTIC_PREVIEW) await writeFile(process.env.SAVED_DIAGNOSTIC_PREVIEW, html);
});

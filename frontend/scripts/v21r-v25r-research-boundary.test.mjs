import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("V21R-V25R remains an API-only, non-activating research epoch", async () => {
  const [manifestText, appSource, envSource, newScanSource] = await Promise.all([
    source("../../operations/v21r-v25r-research-boundary.json"),
    source("../src/App.js"),
    source("../.env.example"),
    source("../src/pages/NewScan.jsx"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.schema_version, "soniccheck-web-research-boundary/1.0.0");
  assert.equal(manifest.program_id, "SC-RL-V21R-V25R-2026-09-01");
  assert.deepEqual(manifest.research_versions, ["V21R", "V22R", "V23R", "V24R", "V25R"]);
  assert.equal(manifest.historical_versions_preserved, true);
  assert.equal(manifest.stacked_baseline.public_commit_sha, "f2ab418e311ae9058e5d7e574d596937bd334b2e");
  assert.equal(manifest.stacked_baseline.private_commit_sha, "8dfcab7dd1d8bb773946de52757c3828147fdf30");
  assert.ok(Object.values(manifest.web_boundary).every((value) => value === false));
  assert.ok(Object.values(manifest.authority).every((value) => value === false));

  assert.doesNotMatch(appSource, /path=["']\/?(?:app\/)?research(?:\/|["'])/iu);
  assert.doesNotMatch(appSource, /Research(?:Page|Dashboard|Experiment)/u);
  assert.doesNotMatch(envSource, /REACT_APP_(?:RESEARCH|EXPERIMENT|PROMOTION|ACTIVATE)/u);
  assert.doesNotMatch(newScanSource, /research[_ -]?(?:mode|cohort|experiment|opt.?in)/iu);

  assert.doesNotMatch(manifestText, /\.wav\b/iu);
  assert.doesNotMatch(manifestText, /(?:asset|audio|query)_sha256/iu);
  assert.doesNotMatch(manifestText, /(?:accuracy|recall|precision|fpr)[_ -]?(?:score|result|metric|percent)/iu);
});

import { writeFile } from "node:fs/promises";
import { BETA_RELEASE_ID, BETA_CATALOGUE_RELEASE_ID, BETA_CATALOGUE_WORK_COUNT, BETA_SELF_TEST_SHA256 } from "../src/constants/betaRelease.mjs";
import { ANALYZER_API_RELEASE_COMMIT } from "../src/constants/analyzerIdentity.mjs";

const origin = "https://api.soniccheck.io";
const paths = ["/api/version", "/api/catalogue/manifest", "/api/capabilities/beta/self-test"];
const [version, catalogue, mechanism] = await Promise.all(paths.map(async (path) => {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Beta release endpoint failed: ${path} (${response.status})`);
  return response.json();
}));
const checks = {
  api_commit: version.commit_sha === ANALYZER_API_RELEASE_COMMIT,
  release_id: version.beta_release?.release_id === BETA_RELEASE_ID && mechanism.release_id === BETA_RELEASE_ID,
  catalogue_id: catalogue.manifest_version === BETA_CATALOGUE_RELEASE_ID,
  catalogue_count: catalogue.coverage_summary?.active_entries === BETA_CATALOGUE_WORK_COUNT,
  held_excluded: version.beta_release?.held_entries_excluded === 160,
  interval_rule: version.beta_release?.verification_cutoff === 23,
  mechanism_parity: mechanism.status === "PASS" && mechanism.evidence_sha256 === BETA_SELF_TEST_SHA256,
};
const result = { status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL", checks,
  release_id: BETA_RELEASE_ID, api_commit: version.commit_sha, scope: "DEPLOYED_RELEASE_BINDING_AND_GENERATED_AUDIO_PARITY" };
await writeFile("beta-release-verification.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (result.status !== "PASS") process.exitCode = 1;

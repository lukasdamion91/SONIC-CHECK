import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../operations/v25-release-manifest.json", import.meta.url);

test("V25 release manifest pins baselines and fail-closed traffic controls", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.baselines.web.commit, "f4a0bd65637827c779a0357c27cb668f95a304b3");
  assert.equal(manifest.baselines.api.commit, "cc004bd3a203ba6e65ac7661308bb80791d2292e");
  assert.equal(manifest.canonical.web, "https://soniccheck.io");
  assert.equal(manifest.canonical.api, "https://api.soniccheck.io");
  assert.equal(manifest.baselines.api.deploy_order, 1);
  assert.equal(manifest.baselines.web.deploy_order, 2);
  assert.equal(manifest.traffic.public_checkout_enabled, false);
  assert.equal(manifest.traffic.paid_public_traffic_enabled, false);
  assert.equal(manifest.promotions.v16r, "shadow-only");
  assert.equal(manifest.promotions.failed_retrieval_candidates, "shadow-only");
  assert.equal(manifest.promotions.indexed_records_71126, "not-registry-authorized");
  assert.equal(manifest.deployment.certified, false);
  assert.equal(manifest.sequence.length, 7);
  assert.equal(manifest.stop_conditions.length, 4);
});

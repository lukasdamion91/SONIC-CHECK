import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const workflow = yaml.load(await readFile(new URL("../../.github/workflows/recover-pages.yml", import.meta.url), "utf8"));

function enabled(expression, operation, ref = "refs/heads/main") {
  if (!expression) return true;
  return runInNewContext(expression, {
    inputs: { operation },
    github: { ref, repository: "lukasdamion91/SONIC-CHECK" },
    failure: () => false,
    cancelled: () => false,
    steps: { deployment: { outcome: "skipped" } },
  }, { timeout: 100 }) === true;
}

function selectedSteps(job, operation) {
  if (!enabled(job.if, operation)) return [];
  return job.steps.filter((step) => enabled(step.if, operation));
}

test("manual default verification uploads no Pages package and cannot restore", () => {
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.on.workflow_dispatch.inputs.operation.default, "verify");
  assert.deepEqual(workflow.jobs.verify.permissions, { actions: "read", contents: "read" });
  for (const operation of ["verify", "verify-v90", "unexpected"]) {
    assert.equal(selectedSteps(workflow.jobs.restore, operation).length, 0);
    assert.equal(selectedSteps(workflow.jobs.verify, operation).some((step) => step.uses?.startsWith("actions/upload-artifact@")), false);
  }
  assert.equal(enabled(workflow.jobs.verify.if, "verify-v90", "refs/heads/other"), false);
});

test("V90 verify exercises the bounded API gate after artifact verification", () => {
  const steps = selectedSteps(workflow.jobs.verify, "verify-v90");
  const artifact = steps.findIndex((s) => s.run?.includes("download_artifact 12126867004"));
  const gate = steps.findIndex((s) => s.run?.endsWith("node frontend/scripts/verify-v90-recovery.mjs"));
  assert.ok(artifact >= 0 && gate > artifact);
  assert.equal(steps[gate].continueOnError, undefined);
  assert.equal(steps[gate]["continue-on-error"], undefined);
});

test("frontend-only restoration cannot reach Pages before rechecking main and V90", () => {
  const steps = selectedSteps(workflow.jobs.restore, "restore-frontend-v90");
  const main = steps.findIndex((s) => s.run?.includes('test "$GITHUB_SHA" = "$EXPECTED_MAIN_SHA"'));
  const gate = steps.findIndex((s) => s.run?.endsWith("node frontend/scripts/verify-v90-recovery.mjs"));
  const deploy = steps.findIndex((s) => s.uses?.startsWith("actions/deploy-pages@"));
  const bytes = steps.findIndex((s) => s.run?.includes("check_public_file static/js/main.2f946574.js"));
  const post = steps.findIndex((s) => s.run?.endsWith("node frontend/scripts/verify-v90-recovery.mjs --after-restore"));
  assert.ok(main >= 0 && gate > main && deploy > gate && bytes > deploy && post > bytes);
  assert.equal(steps.some((s) => s.run?.includes('--arg sha "$PRIOR_API_SHA"')), false);
  for (const step of steps) assert.equal(step["continue-on-error"], undefined);
});

test("the same existing beta/catalogue verifier is mandatory before and after V90 restoration", () => {
  const isBeta = (s) => s.run?.endsWith("node frontend/scripts/verify-beta-release.mjs");
  const verify = selectedSteps(workflow.jobs.verify, "verify-v90");
  assert.equal(verify.filter(isBeta).length, 1);
  const steps = selectedSteps(workflow.jobs.restore, "restore-frontend-v90");
  const deploy = steps.findIndex((s) => s.uses?.startsWith("actions/deploy-pages@"));
  const gates = steps.map((s, i) => isBeta(s) ? i : -1).filter((i) => i >= 0);
  assert.equal(gates.length, 2);
  assert.ok(gates[0] < deploy && gates[1] > deploy);
  for (const step of [...verify.filter(isBeta), ...steps.filter(isBeta)]) {
    assert.equal(step["continue-on-error"], undefined);
    assert.match(step.run, /^timeout --signal=TERM --kill-after=5s 75s /);
  }
  assert.equal(selectedSteps(workflow.jobs.restore, "restore").some(isBeta), false);
});

test("every selected recovery step has a budget and restore jobs reserve room for cleanup/reporting", () => {
  for (const [name, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps) assert.ok(Number.isInteger(step["timeout-minutes"]) && step["timeout-minutes"] > 0, `${name}: ${step.name || step.uses}`);
    for (const operation of ["verify", "verify-v90", "restore", "restore-frontend-v90"]) {
      const steps = selectedSteps(job, operation);
      if (!steps.length) continue;
      const sum = steps.reduce((total, step) => total + step["timeout-minutes"], 0);
      // Two minutes for runner/setup/cleanup, plus a minute for the failure
      // notification on a restoration path. Job timeout remains the hard cap.
      const reserve = name === "restore" ? 3 : 2;
      assert.ok(sum + reserve <= job["timeout-minutes"], `${name}/${operation}: ${sum}+${reserve} > ${job["timeout-minutes"]}`);
    }
  }
  const deploy = workflow.jobs.restore.steps.find((s) => s.uses?.startsWith("actions/deploy-pages@"));
  assert.equal(deploy.with.timeout, "600000");
  assert.ok(Number(deploy.with.timeout) + 60_000 <= deploy["timeout-minutes"] * 60_000);
});

test("failed or possibly applied restoration reports uncertainty and never retries deploy-pages", () => {
  assert.equal(workflow.jobs.restore.steps.filter((s) => s.uses?.startsWith("actions/deploy-pages@")).length, 1);
  const report = workflow.jobs.restore.steps.find((s) => s.name === "Report an unverified restore attempt without retrying deployment");
  for (const outcome of ["success", "failure", "cancelled", "skipped"]) {
    const enabled = runInNewContext(report.if, { failure: () => true, cancelled: () => false, steps: { deployment: { outcome } } });
    assert.equal(enabled, outcome !== "skipped");
  }
  assert.equal(runInNewContext(report.if, { failure: () => false, cancelled: () => true, steps: { deployment: { outcome: "cancelled" } } }), true);
  assert.match(report.run, /Pages may already have changed/);
  assert.ok(report.run.trim().split("\n").every((line) => line.trim().startsWith("echo ")));
});

test("parallel public-byte polling retains all three checks and propagates any request/hash failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sonic-recovery-public-bytes-"));
  try {
    const script = workflow.jobs.restore.steps.find((s) => s.name === "Verify the exact restored public site bytes").run;
    await writeFile(join(directory, "curl"), '#!/bin/sh\noutput=""\nwhile [ "$#" -gt 0 ]; do\n if [ "$1" = "-o" ]; then shift; output="$1"; fi\n shift\ndone\nprintf "%s\\n" "$output" >> "$RUNNER_TEMP/requests"\nif [ "$RECOVERY_TEST_FAILURE" = request ]; then exit 28; fi\nprintf fixture > "$output"\n', { mode: 0o700 });
    await writeFile(join(directory, "sha256sum"), '#!/bin/sh\nIFS= read -r check\ncase "$check" in\n *705f7146a4b2f6b9c540c2270734526bf25dfe46c5982d0a45066a831853d2c5*) [ "$RECOVERY_TEST_FAILURE" != hash ] ;;\n *) exit 0 ;;\nesac\n', { mode: 0o700 });
    await writeFile(join(directory, "sleep"), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    for (const [failure, expectedStatus, expectedRequests] of [["none", 0, 3], ["request", 1, 60], ["hash", 1, 22]]) {
      await writeFile(join(directory, "requests"), "");
      const result = spawnSync("bash", ["-e", "-c", script], {
        encoding: "utf8", timeout: 3000,
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, RUNNER_TEMP: directory, GITHUB_RUN_ID: "local-test", RECOVERY_TEST_FAILURE: failure },
      });
      assert.equal(result.status, expectedStatus, result.stderr);
      const requests = (await readFile(join(directory, "requests"), "utf8")).trim().split("\n");
      assert.equal(requests.length, expectedRequests);
      assert.equal(new Set(requests).size, 3);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("the catalogue command fails on verifier failure and kills a hung verifier without another invocation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sonic-recovery-beta-budget-"));
  try {
    const original = workflow.jobs.verify.steps.find((s) => s.run?.endsWith("node frontend/scripts/verify-beta-release.mjs")).run;
    await writeFile(join(directory, "node"), '#!/bin/sh\nprintf started >> "$RUNNER_TEMP/invocations"\nif [ "$RECOVERY_TEST_HANG" = true ]; then exec sleep 5; fi\nexit 1\n', { mode: 0o700 });
    for (const hang of ["false", "true"]) {
      await writeFile(join(directory, "invocations"), "");
      const result = spawnSync("bash", ["-e", "-c", original.replace("75s", "0.05s")], {
        encoding: "utf8", timeout: 3000,
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, RUNNER_TEMP: directory, RECOVERY_TEST_HANG: hang },
      });
      assert.equal(result.status, hang === "true" ? 124 : 1);
      assert.equal(await readFile(join(directory, "invocations"), "utf8"), "started");
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("the original paired restore retains the prior API gates before and after Pages", () => {
  const steps = selectedSteps(workflow.jobs.restore, "restore");
  const deploy = steps.findIndex((s) => s.uses?.startsWith("actions/deploy-pages@"));
  const gates = steps.map((s, i) => s.run?.includes('--arg sha "$PRIOR_API_SHA"') ? i : -1).filter((i) => i >= 0);
  assert.equal(gates.length, 2);
  assert.ok(gates[0] < deploy && gates[1] > deploy);
  assert.equal(steps.some((s) => s.run?.includes("verify-v90-recovery.mjs")), false);
});

test("only either explicit restore operation stages the retained package with seven-day retention", () => {
  for (const operation of ["restore", "restore-frontend-v90"]) {
    const upload = selectedSteps(workflow.jobs.verify, operation).find((s) => s.uses?.startsWith("actions/upload-artifact@"));
    assert.equal(upload.with.name, "github-pages");
    assert.equal(upload.with["retention-days"], 7);
    assert.match(upload.with.path, /sonic-pages-recovery\/artifact\.tar$/);
  }
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps) if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
  }
  assert.deepEqual(workflow.concurrency, { group: "github-pages", "cancel-in-progress": false });
});

test("the actual pre-deployment shell gate rejects both wrong expected SHA and stale main", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sonic-recovery-main-gate-"));
  try {
    const script = workflow.jobs.restore.steps.find((s) => s.run?.includes('test "$GITHUB_SHA" = "$EXPECTED_MAIN_SHA"')).run;
    await writeFile(join(directory, "git"), '#!/bin/sh\nprintf "%s\\trefs/heads/main\\n" "$RECOVERY_TEST_REMOTE_SHA"\nexit "${RECOVERY_TEST_GIT_STATUS:-0}"\n', { mode: 0o700 });
    const sha = "a".repeat(40);
    for (const [expected, remote, gitStatus, exitCode] of [[sha, sha, 0, 0], ["b".repeat(40), sha, 0, 1], [sha, "c".repeat(40), 0, 1], [sha, sha, 124, 124]]) {
      const result = spawnSync("bash", ["-e", "-c", script], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, GITHUB_SHA: sha, EXPECTED_MAIN_SHA: expected, RECOVERY_TEST_REMOTE_SHA: remote, RECOVERY_TEST_GIT_STATUS: String(gitStatus) },
      });
      assert.equal(result.status, exitCode, result.stderr);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

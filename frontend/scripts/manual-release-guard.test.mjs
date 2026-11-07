import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const workflow = require("js-yaml").load(await readFile(new URL("../../.github/workflows/static.yml", import.meta.url), "utf8"));
const earlyGuard = workflow.jobs.build.steps[0];
const deployGuard = workflow.jobs.deploy.steps.find((s) => s.name === "Refuse stale main deployment");
const sha = "a".repeat(40);

async function runGuard(step, { expected = sha, current = sha, remote = sha, event = "workflow_dispatch", ref = "refs/heads/main" } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "sonic-manual-release-"));
  try {
    // No remote access: exercise the exact checked-in shell against a local
    // fake Git executable, preserving both the fetch and rev-parse behavior.
    await writeFile(join(directory, "git"), '#!/bin/sh\ncase "$1" in\n fetch) exit 0 ;;\n rev-parse) printf "%s\\n" "$RELEASE_TEST_REMOTE_SHA" ;;\n *) exit 9 ;;\nesac\n', { mode: 0o700 });
    const result = spawnSync("bash", ["-e", "-c", step.run], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, EXPECTED_MAIN_SHA: expected, GITHUB_SHA: current, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, RELEASE_TEST_REMOTE_SHA: remote },
    });
    const sentinelExists = await stat(join(directory, "input-executed")).then(() => true, () => false);
    return { ...result, sentinelExists };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("manual expected SHA is mandatory and validated before checkout/install/build", () => {
  assert.equal(workflow.on.workflow_dispatch.inputs.expected_main_sha.required, true);
  assert.equal(workflow.on.workflow_dispatch.inputs.expected_main_sha.type, "string");
  assert.match(earlyGuard.run, /EXPECTED_MAIN_SHA/);
  assert.equal(earlyGuard["working-directory"], "${{ runner.temp }}");
  assert.equal(workflow.jobs.build.steps[1].name, "Checkout");
  assert.ok(workflow.jobs.build.steps.findIndex((s) => s.run?.includes("npm ci")) > 1);
  for (const event_name of ["workflow_dispatch", "push", "pull_request"]) {
    assert.equal(runInNewContext(earlyGuard.if, { github: { event_name } }), event_name === "workflow_dispatch");
  }
});

test("both guards take untrusted input through environment values, never shell interpolation", () => {
  for (const step of [earlyGuard, deployGuard]) {
    assert.equal(step.env.EXPECTED_MAIN_SHA, "${{ inputs.expected_main_sha }}");
    assert.doesNotMatch(step.run, /\$\{\{/);
    assert.equal(step["continue-on-error"], undefined);
  }
  assert.ok(workflow.jobs.deploy.steps.indexOf(deployGuard) < workflow.jobs.deploy.steps.findIndex((s) => s.uses?.startsWith("actions/deploy-pages@")));
});

test("exact reviewed full main SHA passes both real shell guards", async () => {
  for (const step of [earlyGuard, deployGuard]) assert.equal((await runGuard(step)).status, 0);
});

test("empty, abbreviated, mistyped or whitespace-padded inputs fail both manual gates", async () => {
  for (const expected of ["", "a".repeat(39), "a".repeat(41), "A".repeat(40), "g".repeat(40), `${sha}\n`, ` ${sha}`]) {
    for (const step of [earlyGuard, deployGuard]) assert.notEqual((await runGuard(step, { expected })).status, 0);
  }
});

test("a different reviewed SHA or non-main manual ref fails both gates", async () => {
  for (const step of [earlyGuard, deployGuard]) {
    assert.notEqual((await runGuard(step, { expected: "b".repeat(40) })).status, 0);
    assert.notEqual((await runGuard(step, { ref: "refs/heads/other" })).status, 0);
  }
});

test("a main move during the build fails the deployment gate", async () => {
  assert.notEqual((await runGuard(deployGuard, { remote: "b".repeat(40) })).status, 0);
});

test("push deployment retains its remote-main check without requiring a manual input", async () => {
  assert.equal((await runGuard(deployGuard, { event: "push", expected: "" })).status, 0);
  assert.notEqual((await runGuard(deployGuard, { event: "push", expected: "", remote: "b".repeat(40) })).status, 0);
});

test("hostile manual input cannot execute shell syntax", async () => {
  for (const expected of ['$(touch input-executed)', '`touch input-executed`', '"; touch input-executed; #', `${sha}\ntouch input-executed`]) {
    for (const step of [earlyGuard, deployGuard]) {
      const result = await runGuard(step, { expected });
      assert.notEqual(result.status, 0);
      assert.equal(result.sentinelExists, false);
    }
  }
});

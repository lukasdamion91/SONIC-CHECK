import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  isReviewedV90Binding,
  recoveryFetcher,
  RETAINED_RECOVERY_WEB_COMMIT,
  V90_RECOVERY_API_COMMIT,
  V90_RECOVERY_PROJECTION,
  verifyV90Recovery,
} from "./verify-v90-recovery.mjs";

test("the reviewed binding accepts reordered fields but rejects malformed projections", () => {
  const reversed = Object.fromEntries(Object.entries(V90_RECOVERY_PROJECTION).reverse());
  assert.equal(isReviewedV90Binding(V90_RECOVERY_API_COMMIT, reversed), true);
  for (const projection of [null, [], {}, { ...reversed, unexpected: true }]) {
    assert.equal(isReviewedV90Binding(V90_RECOVERY_API_COMMIT, projection), false);
  }
});

for (const [name, commit, projection] of [
  ["a different API source", "c45d067436c23537649b2fb8ed2ea584ffd9270a", V90_RECOVERY_PROJECTION],
  ["changed application bytes", V90_RECOVERY_API_COMMIT, { ...V90_RECOVERY_PROJECTION, application_bytes_scanned: 3471930 }],
  ["changed file count", V90_RECOVERY_API_COMMIT, { ...V90_RECOVERY_PROJECTION, application_files_checked: 108 }],
  ["changed manifest digest", V90_RECOVERY_API_COMMIT, { ...V90_RECOVERY_PROJECTION, application_manifest_sha256: "0".repeat(64) }],
  ["a mistyped projection", V90_RECOVERY_API_COMMIT, { ...V90_RECOVERY_PROJECTION, application_files_checked: "109" }],
]) {
  test(`${name} refuses recovery before any network probe`, async () => {
    const unavailable = () => { throw new Error("network probe must not run"); };
    const result = await verifyV90Recovery({ commit, projection, apiProbe: unavailable, webProbe: unavailable });
    assert.equal(result.ok, false);
    assert.equal(result.binding_ok, false);
    assert.equal(result.api, null);
    assert.equal(result.web, null);
  });
}

test("verify mode runs only the bounded API gate and leaves the website unprobed", async () => {
  const calls = [];
  const result = await verifyV90Recovery({
    apiProbe: async (options) => { calls.push(options); return { ok: true }; },
    webProbe: () => { throw new Error("website probe must not run before restoration"); },
  });
  assert.equal(result.ok, true);
  assert.equal(result.web, null);
  assert.equal(typeof calls[0].fetcher, "function");
  assert.deepEqual(calls.map(({ fetcher, ...options }) => options), [{ attempts: 1, intervalMs: 0 }]);
  assert.equal(result.authenticated_scan_acceptance_claimed, false);
});

test("any failed API gate prevents after-restore web success from masking it", async () => {
  for (const failure of ["deployed_commit", "runtime_application_projection", "api_readiness", "provider_payment_gates_closed"]) {
    const result = await verifyV90Recovery({
      afterRestore: true,
      apiProbe: async () => ({ ok: false, checks: { [failure]: { ok: false } } }),
      webProbe: () => { throw new Error("must stop after failed API gate"); },
    });
    assert.equal(result.ok, false);
    assert.equal(result.api.ok, false);
    assert.equal(result.web, null);
  }
});

test("after-restore checks the V90 API first and requires the exact retained web stamp", async () => {
  const calls = [];
  const result = await verifyV90Recovery({
    afterRestore: true,
    apiProbe: async () => { calls.push("api"); return { ok: true }; },
    webProbe: async (options) => { calls.push("web"); assert.equal(options.expectedCommit, RETAINED_RECOVERY_WEB_COMMIT); return { ok: true }; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["api", "web"]);
  assert.equal(result.phase, "AFTER_FRONTEND_RESTORE");
});

test("failed public web checks leave recovery unverified", async () => {
  const result = await verifyV90Recovery({
    afterRestore: true,
    apiProbe: async () => ({ ok: true }),
    webProbe: async () => ({ ok: false, checks: { landing: { ok: false } } }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.web.ok, false);
});

test("transport failure produces a failed receipt without a blind retry", async () => {
  let attempts = 0;
  const result = await verifyV90Recovery({ apiProbe: async () => { attempts++; throw new Error("offline"); } });
  assert.equal(result.ok, false);
  assert.equal(result.failure, "RECOVERY_CHECK_ERROR");
  assert.equal(attempts, 1);
});

test("a nonresponsive API probe hits the total deadline and never proceeds to the website", async () => {
  const result = await verifyV90Recovery({
    afterRestore: true,
    timeoutMs: 15,
    apiProbe: () => new Promise(() => {}),
    webProbe: () => { throw new Error("web must not run after timeout"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, "RECOVERY_CHECK_TIMEOUT");
});

test("a nonresponsive post-restore website fails without repeating API verification", async () => {
  let apiCalls = 0;
  const result = await verifyV90Recovery({
    afterRestore: true,
    timeoutMs: 15,
    apiProbe: async () => { apiCalls++; return { ok: true }; },
    webProbe: () => new Promise(() => {}),
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, "RECOVERY_CHECK_TIMEOUT");
  assert.equal(apiCalls, 1);
});

test("the recovery deadline aborts retry waits so no retry timer outlives the command budget", async () => {
  let retryStopped = false;
  const result = await verifyV90Recovery({
    afterRestore: true,
    timeoutMs: 15,
    apiProbe: async () => ({ ok: true }),
    webProbe: async ({ sleeper }) => {
      try { await sleeper(10_000); } finally { retryStopped = true; }
      throw new Error("must not complete a later retry");
    },
  });
  await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
  assert.equal(result.failure, "RECOVERY_CHECK_TIMEOUT");
  assert.equal(retryStopped, true);
});

test("the real web retry loop exits its process after deadline, rather than leaving retry timers alive", () => {
  const source = `
    import { verifyV90Recovery } from ${JSON.stringify(new URL("./verify-v90-recovery.mjs", import.meta.url).href)};
    const result = await verifyV90Recovery({
      afterRestore: true, timeoutMs: 20,
      apiProbe: async () => ({ ok: true }),
      fetcher: async () => { throw new Error("controlled offline"); },
    });
    console.log(result.failure);
    process.exitCode = result.ok ? 0 : 1;
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], { encoding: "utf8", timeout: 2000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /RECOVERY_CHECK_TIMEOUT/);
});

test("every recovery fetch has a request deadline, including when headers arrived but the body stalled", async () => {
  const controller = new AbortController();
  const request = recoveryFetcher(async (_url, { signal }) => ({
    text: () => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("body timed out")), { once: true })),
  }), controller.signal, 15);
  // Keep the event loop active; AbortSignal.timeout itself uses an unref timer.
  const keeper = setTimeout(() => {}, 1000);
  try {
    const response = await request("https://soniccheck.io/");
    await assert.rejects(response.text(), /body timed out/);
  } finally {
    clearTimeout(keeper);
  }
});

test("the outer recovery deadline and a caller's signal cannot be overwritten by per-request options", async () => {
  const controller = new AbortController();
  const caller = new AbortController();
  let combined;
  const request = recoveryFetcher(async (_url, { signal }) => { combined = signal; return {}; }, controller.signal);
  await request("https://soniccheck.io/", { signal: caller.signal });
  assert.equal(combined.aborted, false);
  controller.abort();
  assert.equal(combined.aborted, true);
});

test("invalid command/request budgets are refused", async () => {
  for (const timeoutMs of [0, -1, 1.5, Infinity]) {
    await assert.rejects(verifyV90Recovery({ timeoutMs }), /positive integers/);
  }
});

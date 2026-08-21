import assert from "node:assert/strict";
import test from "node:test";

import { probeDeployment } from "./probe-deployment.mjs";


function response(status, { body = "", location = null, url = "" } = {}) {
  return {
    status,
    url,
    headers: { get: (name) => (name.toLowerCase() === "location" ? location : null) },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

test("deployment truth requires exact artifact identity and routing", async () => {
  const commit = "a".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const fetcher = async (url, options) => {
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz") || url.endsWith("/api/readyz")) {
      return response(200, { body: '{"ok":true}', url });
    }
    assert.equal(options.redirect, "follow");
    return response(200, { body: html, url });
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, true);
  assert.equal(result.checks.login.auth_configured, true);
  assert.equal(result.checks.www_redirect.status, 301);
  assert.equal(result.checks.api_readiness.status, 200);
});

test("a 200 from the wrong deployment is a failed deployment", async () => {
  const fetcher = async (url) => {
    if (url.includes("www.soniccheck.io") || url.includes("app.soniccheck.io")) {
      return response(200, { body: "legacy", url });
    }
    if (url.includes("api.soniccheck.io")) return response(503, { body: '{"ok":false}', url });
    return response(200, { body: "<title>old site</title>", url });
  };

  const result = await probeDeployment({ expectedCommit: "b".repeat(40), fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.landing.observed_commit, null);
  assert.equal(result.checks.www_redirect.ok, false);
  assert.equal(result.checks.api_readiness.ok, false);
});

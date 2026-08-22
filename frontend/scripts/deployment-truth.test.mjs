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

const controlledBetaReadiness = JSON.stringify({
  ok: false,
  status: "CONFIGURATION_REQUIRED",
  checks: {
    database: true,
    clerk: true,
    stripe: true,
    private_audio_storage: true,
    recording_identity: false,
    lyric_candidate_discovery: false,
    audio_runtime: true,
    api_hostname: true,
    product_convergence: true,
    composition_reference_base: true,
    composition_v16r: true,
    catalogue_release: true,
  },
  secrets_included: false,
});

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
    if (url.endsWith("/api/healthz")) {
      return response(200, { body: '{"ok":true}', url });
    }
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    assert.equal(options.redirect, "follow");
    return response(200, { body: html, url });
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, true);
  assert.equal(result.checks.login.auth_configured, true);
  assert.equal(result.checks.www_redirect.status, 301);
  assert.equal(result.checks.api_readiness.status, 503);
  assert.equal(result.checks.api_readiness.controlled_beta_ready, true);
  assert.deepEqual(result.checks.api_readiness.blocking_checks, []);
  assert.equal(result.checks.api_readiness.nonblocking_provider_checks.recording_identity, false);
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

test("the right artifact without configured auth is not deployable", async () => {
  const commit = "c".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="false" />`;
  const fetcher = async (url) => {
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) {
      return response(200, { body: '{"ok":true}', url });
    }
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    return response(200, { body: html, url });
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.login.auth_configured, false);
  assert.equal(result.checks.login.ok, false);
});

test("controlled beta readiness still fails if Clerk or Stripe is not ready", async () => {
  const commit = "d".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const notReady = JSON.parse(controlledBetaReadiness);
  notReady.checks.clerk = false;
  notReady.checks.stripe = false;
  const fetcher = async (url) => {
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: JSON.stringify(notReady), url });
    return response(200, { body: html, url });
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.api_readiness.blocking_checks, ["clerk", "stripe"]);
});

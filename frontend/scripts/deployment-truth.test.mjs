import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { probeDeployment, probeDeploymentWithRetry } from "./probe-deployment.mjs";
import { ANALYZER_API_RELEASE_COMMIT } from "../src/constants/analyzerIdentity.mjs";


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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const capabilityManifestBody = {
  revision: "soniccheck-harry-v36-capabilities/1.0.0",
  analyzer_label: "HARRY_V36",
  capabilities: [
    {
      capability_id: "v34_structural_missingness_bounds",
      scientific_stage: "V34",
      method_version: "soniccheck-v34-partial-identification/1.0.0-research",
      runtime_state: "RUNTIME_SHADOW_OUTPUT",
      output_path: "similarity_analysis.evidence_confidence.partial_identification",
      automatic_scan_attachment: true,
      additional_provider_requests_made_by_capability: 0,
      authoritative_status_changed: false,
      payment_gate_changed: false,
    },
    {
      capability_id: "v35_multi_view_consistency",
      scientific_stage: "V35",
      method_version: "soniccheck-v35-exact-identity-invariance/0.1.0-research",
      runtime_state: "RUNTIME_DIAGNOSTIC_ENDPOINT",
      output_path: "POST /api/diagnostics/multiview-consistency",
      automatic_scan_attachment: false,
      additional_provider_requests_made_by_capability: 0,
      authoritative_status_changed: false,
      payment_gate_changed: false,
    },
    {
      capability_id: "v36_channel_loss_sensitivity",
      scientific_stage: "V36",
      method_version: "soniccheck-channel-loss-sensitivity/1.0.0-research",
      runtime_state: "RUNTIME_SHADOW_OUTPUT",
      output_path: "similarity_analysis.channel_loss_sensitivity",
      automatic_scan_attachment: true,
      additional_provider_requests_made_by_capability: 0,
      authoritative_status_changed: false,
      payment_gate_changed: false,
    },
  ],
};

const harryCapabilityManifest = {
  ...capabilityManifestBody,
  sha256: createHash("sha256").update(canonicalJson(capabilityManifestBody)).digest("hex"),
};
const harryAnalyzer = {
  versioned_label: "HARRY_V36",
  identity_revision: "soniccheck-harry-identity/1.2.0",
  scientific_v_series: "V36",
  capability_manifest: harryCapabilityManifest,
};
const harryVersion = JSON.stringify({
  commit_sha: ANALYZER_API_RELEASE_COMMIT,
  analyzer_label: "HARRY_V36",
  analyzer: harryAnalyzer,
});
const closedProductContract = JSON.stringify({
  analyzer: harryAnalyzer,
  paid_public_scanning: "closed",
  commercial_license_gate: {
    approved: false,
    approval_revision: null,
    status: "formal_licence_required",
    paid_traffic_requested: false,
    paid_traffic_authorized: false,
  },
  pricing: {
    plans: ["single_scan", "pro_monthly", "pro_annual", "enterprise_annual"]
      .map((id) => ({ id, checkout_enabled: false })),
  },
});

const harryRuntimeSelfTestBody = {
  schema_version: "soniccheck-harry-v36-runtime-self-test/1.0.0",
  status: "PASS",
  analyzer_label: "HARRY_V36",
  fixture_scope: "SANITIZED_SOFTWARE_SELF_TEST_ONLY",
  production_audio_used: false,
  research_validation_claimed: false,
  provider_requests_made: 0,
  payment_entitlements_consumed: 0,
  authoritative_status_changed: false,
  capabilities: Object.fromEntries(capabilityManifestBody.capabilities.map((capability) => [
    capability.capability_id,
    {
      executed: true,
      method_version: capability.method_version,
      status: "PASS",
    },
  ])),
};
harryRuntimeSelfTestBody.capabilities.v34_structural_missingness_bounds.status = (
  "PARTIALLY_IDENTIFIED"
);
harryRuntimeSelfTestBody.capabilities.v35_multi_view_consistency.status = (
  "NO_EXACT_VIEW_DIVERGENCE_OBSERVED"
);
harryRuntimeSelfTestBody.capabilities.v35_multi_view_consistency.diagnostic_sha256 = (
  "b".repeat(64)
);
harryRuntimeSelfTestBody.capabilities.v36_channel_loss_sensitivity.status = (
  "EVALUATED_SHADOW_ONLY"
);
const harryRuntimeSelfTest = JSON.stringify({
  ...harryRuntimeSelfTestBody,
  self_test_sha256: createHash("sha256")
    .update(canonicalJson(harryRuntimeSelfTestBody))
    .digest("hex"),
});
const closedProviderPaymentGates = JSON.stringify({
  schema_version: "soniccheck-provider-payment-gates/1.0.0",
  acrcloud_identification: {
    provider: "ACRCloud Identification API",
    mode: "off",
    access_basis: "none",
    paid_traffic_enabled: false,
    ready: false,
    status: "DISABLED_BY_POLICY",
    customer_audio_transmission_allowed: false,
    research_only: true,
    affects_composition_score: false,
    secrets_included: false,
  },
  musicbrainz_metadata: {
    version: "soniccheck-musicbrainz-enrichment/0.3.0",
    provider: "MusicBrainz WS/2",
    mode: "shadow",
    access_basis: "pending_evaluation",
    enabled: true,
    evaluation_only: true,
    commercial_use_approved: false,
    paid_traffic_enabled: false,
    configuration_error: null,
    role: "candidate_metadata_enrichment_only",
    affects_candidate_generation: false,
    affects_confidence: false,
    affects_ranking: false,
  },
  payment: {
    approved: false,
    approval_revision: null,
    status: "formal_licence_required",
    paid_traffic_requested: false,
    paid_traffic_authorized: false,
  },
  secrets_included: false,
});
const deployedApplicationPrivacy = JSON.stringify({
  schema_version: "soniccheck-runtime-application-root-privacy/1.0.0",
  status: "PASS",
  scope: "DEPLOYED_APPLICATION_ROOT_FILESYSTEM",
  application_manifest_sha256: "d".repeat(64),
  application_files_checked: 42,
  application_bytes_scanned: 123456,
  private_research_evidence_present: false,
  raw_audio_present: false,
  secret_material_present: false,
  whole_container_filesystem_scanned: false,
  whole_container_digest_claimed: false,
  content_classification_scope: "EXACT_PATH_ALLOWLIST_AND_RECOGNIZED_BYTE_SIGNATURES",
  semantic_content_classification_claimed: false,
});

function governedApiContractResponse(url) {
  if (url.endsWith("/api/version")) return response(200, { body: harryVersion, url });
  if (url.endsWith("/api/product-contract")) {
    return response(200, { body: closedProductContract, url });
  }
  if (url.endsWith("/api/capabilities/harry-v36/self-test")) {
    return response(200, { body: harryRuntimeSelfTest, url });
  }
  if (url.endsWith("/api/capabilities/provider-payment-gates")) {
    return response(200, { body: closedProviderPaymentGates, url });
  }
  if (url.endsWith("/api/capabilities/runtime-privacy")) {
    return response(200, { body: deployedApplicationPrivacy, url });
  }
  return null;
}

const googleClerkEnvironment = JSON.stringify({
  auth_config: {
    identification_strategies: ["email_address", "oauth_github", "oauth_google"],
    first_factors: ["email_code", "oauth_github", "oauth_google", "password"],
  },
  display_config: {
    instance_environment_type: "production",
    privacy_policy_url: "https://soniccheck.io/privacy/",
    terms_url: "https://soniccheck.io/terms/",
  },
  user_settings: {
    social: {
      oauth_google: {
        enabled: true,
        authenticatable: true,
        not_selectable: false,
        block_email_subaddresses: true,
        strategy: "oauth_google",
        name: "Google",
      },
    },
  },
});

function googleEnvironment(url, body = googleClerkEnvironment) {
  return response(200, { body, url });
}

function pageResponse(url, body, finalUrl = url) {
  let canonical = "";
  if (url.endsWith("/privacy/")) {
    canonical = '<link rel="canonical" href="https://soniccheck.io/privacy/" />';
  } else if (url.endsWith("/terms/")) {
    canonical = '<link rel="canonical" href="https://soniccheck.io/terms/" />';
  }
  return response(200, { body: `${body}${canonical}`, url: finalUrl });
}

function passingDeploymentFetcher({
  commit,
  healthBody = '{"ok":true}',
  healthStatus = 200,
  readinessBody = controlledBetaReadiness,
  readinessStatus = 503,
  productContractBody = closedProductContract,
  providerGatesBody = closedProviderPaymentGates,
  pageFinalUrl = (url) => url,
}) {
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  return async (url) => {
    if (url.endsWith("/api/product-contract")) {
      return response(200, { body: productContractBody, url });
    }
    if (url.endsWith("/api/capabilities/provider-payment-gates")) {
      return response(200, { body: providerGatesBody, url });
    }
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, {
        location: "https://soniccheck.io/v17-routing?source=deployment-truth",
        url,
      });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, {
        location: "https://soniccheck.io/app?source=deployment-truth",
        url,
      });
    }
    if (url.endsWith("/api/healthz")) {
      return response(healthStatus, { body: healthBody, url });
    }
    if (url.endsWith("/api/readyz")) {
      return response(readinessStatus, { body: readinessBody, url });
    }
    return pageResponse(url, html, pageFinalUrl(url));
  };
}

test("deployment truth requires exact artifact identity and routing", async () => {
  const commit = "a".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const fetcher = async (url, options) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
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
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, true);
  assert.equal(result.api_service_fully_ready_observed, false);
  assert.equal(result.full_service_launch_readiness_claimed, false);
  assert.equal(result.checks.login.auth_configured, true);
  assert.equal(result.checks.www_redirect.status, 301);
  assert.equal(result.checks.api_readiness.status, 503);
  assert.equal(result.checks.api_readiness.required_nonprovider_controls_ready, true);
  assert.deepEqual(result.checks.api_readiness.blocking_checks, []);
  assert.equal(result.checks.api_readiness.nonblocking_provider_checks.recording_identity, false);
  assert.equal(result.checks.harry_capability_contract.ok, true);
  assert.equal(
    result.checks.harry_capability_contract.api_commit,
    ANALYZER_API_RELEASE_COMMIT,
  );
  assert.equal(result.checks.harry_capability_contract.analyzer_label, "HARRY_V36");
  assert.equal(
    result.checks.harry_capability_contract.capability_manifest_revision,
    "soniccheck-harry-v36-capabilities/1.0.0",
  );
  assert.equal(result.checks.harry_capability_contract.paid_public_scanning, "closed");
  assert.match(
    result.checks.harry_capability_contract.runtime_self_test_sha256,
    /^[0-9a-f]{64}$/,
  );
  assert.equal(result.checks.harry_capability_contract.secrets_included, false);
  assert.equal(result.checks.google_provider_config.ok, true);
  assert.equal(result.checks.google_provider_config.checks.subaddresses_blocked, true);
  assert.equal(result.checks.google_provider_config.scope, "public_configuration_only");
  assert.equal(result.checks.google_provider_config.end_to_end_acceptance_required, true);
  assert.equal(result.checks.google_provider_config.secrets_included, false);
});

test("web probes identify the verifier while preserving truthful HTTP failures", async () => {
  const commit = "1".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    if (url.endsWith("/login")) return response(403, { body: "Cloudflare error 1010", url });
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });
  const webCalls = calls.filter(({ url }) => !url.includes("api.soniccheck.io"));
  const apiCalls = calls.filter(({ url }) => url.includes("api.soniccheck.io"));

  assert.equal(webCalls.length, 9);
  for (const { options } of webCalls) {
    assert.equal(options.headers["User-Agent"], "sonic-check-production-verifier/1.0");
  }
  for (const { options } of apiCalls) {
    assert.equal(options.headers, undefined);
  }
  assert.equal(result.ok, false);
  assert.equal(result.checks.login.ok, false);
  assert.equal(result.checks.login.status, 403);
  assert.ok(calls.some(({ url }) => url === "https://soniccheck.io/privacy/"));
  assert.ok(calls.some(({ url }) => url === "https://soniccheck.io/terms/"));
});

test("a 200 from the wrong deployment is a failed deployment", async () => {
  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
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
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
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
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.login.auth_configured, false);
  assert.equal(result.checks.login.ok, false);
});

test("required non-provider controls fail if Clerk or Stripe is not ready", async () => {
  const commit = "d".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const notReady = JSON.parse(controlledBetaReadiness);
  notReady.checks.clerk = false;
  notReady.checks.stripe = false;
  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: JSON.stringify(notReady), url });
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.api_readiness.blocking_checks, ["clerk", "stripe"]);
});

test("deployment truth retries while the independently deployed edge cutover converges", async () => {
  const commit = "e".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  let legacyProbeCount = 0;
  let sleepCount = 0;
  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      legacyProbeCount += 1;
      if (legacyProbeCount === 1) return response(200, { body: "legacy", url });
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    return pageResponse(url, html);
  };

  const result = await probeDeploymentWithRetry({
    expectedCommit: commit,
    fetcher,
    attempts: 3,
    intervalMs: 10_000,
    sleeper: async (delay) => {
      assert.equal(delay, 10_000);
      sleepCount += 1;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempt, 2);
  assert.equal(result.max_attempts, 3);
  assert.equal(legacyProbeCount, 2);
  assert.equal(sleepCount, 1);
});

test("deployment truth fails closed when Google or customer policy links are absent", async () => {
  const commit = "9".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const environment = JSON.parse(googleClerkEnvironment);
  environment.auth_config.identification_strategies = ["email_address", "oauth_github"];
  environment.auth_config.first_factors = ["email_code", "oauth_github", "password"];
  environment.display_config.privacy_policy_url = null;
  environment.display_config.terms_url = null;
  delete environment.user_settings.social.oauth_google;

  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) {
      return googleEnvironment(url, JSON.stringify(environment));
    }
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.google_provider_config.ok, false);
  assert.equal(result.checks.google_provider_config.checks.identification_strategy, false);
  assert.equal(result.checks.google_provider_config.checks.first_factor, false);
  assert.equal(result.checks.google_provider_config.checks.enabled, false);
  assert.equal(result.checks.google_provider_config.checks.privacy_policy, false);
  assert.equal(result.checks.google_provider_config.checks.terms, false);
  assert.equal("payload" in result.checks.google_provider_config, false);
});

test("customer policy probes reject redirects to the landing page", async () => {
  const commit = "8".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    if (url.endsWith("/privacy/") || url.endsWith("/terms/")) {
      return pageResponse(url, html, "https://soniccheck.io/");
    }
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.privacy.ok, false);
  assert.equal(result.checks.privacy.canonical_path, false);
  assert.equal(result.checks.terms.ok, false);
  assert.equal(result.checks.terms.canonical_path, false);
});

test("customer policy probes reject homepage canonical metadata", async () => {
  const commit = "7".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const fetcher = async (url) => {
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    if (url.endsWith("/privacy/") || url.endsWith("/terms/")) {
      return response(200, {
        body: `${html}<link rel="canonical" href="https://soniccheck.io/" />`,
        url,
      });
    }
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.privacy.canonical_path, true);
  assert.equal(result.checks.privacy.canonical_metadata, false);
  assert.equal(result.checks.privacy.observed_canonical, "https://soniccheck.io/");
  assert.equal(result.checks.terms.canonical_path, true);
  assert.equal(result.checks.terms.canonical_metadata, false);
});

test("deployment truth rejects a relabelled or unsealed HARRY capability contract", async () => {
  const commit = "6".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const badVersion = JSON.parse(harryVersion);
  badVersion.analyzer.capability_manifest.capabilities[0]
    .additional_provider_requests_made_by_capability = 1;
  const fetcher = async (url) => {
    if (url.endsWith("/api/version")) {
      return response(200, { body: JSON.stringify(badVersion), url });
    }
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(result.checks.harry_capability_contract.ok, false);
  assert.equal(result.checks.harry_capability_contract.checks.exact_capabilities, false);
});

test("deployment truth rejects a declared capability whose runtime self-test is tampered", async () => {
  const commit = "5".repeat(40);
  const html = `<meta name="soniccheck-deployment-commit" content="${commit}" /><meta name="soniccheck-auth-configured" content="true" />`;
  const badSelfTest = JSON.parse(harryRuntimeSelfTest);
  badSelfTest.capabilities.v36_channel_loss_sensitivity.executed = false;
  const fetcher = async (url) => {
    if (url.endsWith("/api/capabilities/harry-v36/self-test")) {
      return response(200, { body: JSON.stringify(badSelfTest), url });
    }
    const governed = governedApiContractResponse(url);
    if (governed) return governed;
    if (url.includes("clerk.soniccheck.io")) return googleEnvironment(url);
    if (url.includes("www.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/v17-routing?source=deployment-truth", url });
    }
    if (url.includes("app.soniccheck.io")) {
      return response(301, { location: "https://soniccheck.io/app?source=deployment-truth", url });
    }
    if (url.endsWith("/api/healthz")) return response(200, { body: '{"ok":true}', url });
    if (url.endsWith("/api/readyz")) return response(503, { body: controlledBetaReadiness, url });
    return pageResponse(url, html);
  };

  const result = await probeDeployment({ expectedCommit: commit, fetcher });

  assert.equal(result.ok, false);
  assert.equal(
    result.checks.harry_capability_contract.checks.runtime_capabilities_exercised,
    false,
  );
});

test("health verification requires an affirmative JSON body", async () => {
  const commit = "4".repeat(40);
  const ready = JSON.parse(controlledBetaReadiness);
  ready.ok = true;
  ready.status = "READY";
  for (const name of Object.keys(ready.checks)) ready.checks[name] = true;
  const result = await probeDeployment({
    expectedCommit: commit,
    fetcher: passingDeploymentFetcher({
      commit,
      healthBody: '{"ok":false}',
      readinessBody: JSON.stringify(ready),
      readinessStatus: 200,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.api_service_fully_ready_observed, true);
  assert.equal(result.full_service_launch_readiness_claimed, false);
  assert.equal(result.checks.api_health.status, 200);
  assert.equal(result.checks.api_health.body_ok, false);
});

test("readiness verification rejects schema, type and status contradictions", async (t) => {
  const commit = "3".repeat(40);
  const base = JSON.parse(controlledBetaReadiness);
  const cases = [
    {
      name: "unexpected readiness key",
      mutate: (payload) => { payload.checks.future_dependency = false; },
      expectedField: "exact_check_set",
    },
    {
      name: "missing readiness key",
      mutate: (payload) => { delete payload.checks.catalogue_release; },
      expectedField: "exact_check_set",
    },
    {
      name: "non-boolean provider readiness",
      mutate: (payload) => { payload.checks.recording_identity = "false"; },
      expectedField: "boolean_check_values",
    },
    {
      name: "HTTP 200 with a false readiness body",
      mutate: () => {},
      status: 200,
      expectedField: "status_body_consistent",
    },
    {
      name: "false readiness body with all checks true",
      mutate: (payload) => {
        for (const name of Object.keys(payload.checks)) payload.checks[name] = true;
      },
      expectedField: "checks_body_consistent",
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const payload = structuredClone(base);
      scenario.mutate(payload);
      const result = await probeDeployment({
        expectedCommit: commit,
        fetcher: passingDeploymentFetcher({
          commit,
          readinessBody: JSON.stringify(payload),
          readinessStatus: scenario.status ?? 503,
        }),
      });

      assert.equal(result.ok, false);
      assert.equal(result.api_service_fully_ready_observed, false);
      assert.equal(result.full_service_launch_readiness_claimed, false);
      assert.equal(result.checks.api_readiness[scenario.expectedField], false);
    });
  }
});

test("exact all-true readiness is distinct from maintenance readiness", async () => {
  const commit = "2".repeat(40);
  const ready = JSON.parse(controlledBetaReadiness);
  ready.ok = true;
  ready.status = "READY";
  for (const name of Object.keys(ready.checks)) ready.checks[name] = true;

  const result = await probeDeployment({
    expectedCommit: commit,
    fetcher: passingDeploymentFetcher({
      commit,
      readinessBody: JSON.stringify(ready),
      readinessStatus: 200,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.checks.api_readiness.ok, true);
  assert.equal(result.checks.api_readiness.service_fully_ready, true);
  assert.equal(result.api_service_fully_ready_observed, true);
  assert.equal(result.full_service_launch_readiness_claimed, false);
});

test("every production page probe requires its exact final URL", async (t) => {
  const commit = "1".repeat(40);
  const routes = [
    ["/", "landing"],
    ["/login", "login"],
    ["/join", "join"],
    ["/privacy/", "privacy"],
    ["/terms/", "terms"],
    ["/app", "app"],
  ];

  for (const [path, checkName] of routes) {
    await t.test(path, async () => {
      const requestedUrl = `https://soniccheck.io${path}`;
      const result = await probeDeployment({
        expectedCommit: commit,
        fetcher: passingDeploymentFetcher({
          commit,
          pageFinalUrl: (url) => (
            url === requestedUrl ? "https://soniccheck.io/unexpected-route" : url
          ),
        }),
      });

      assert.equal(result.ok, false);
      assert.equal(result.checks[checkName].exact_final_url, false);
      assert.equal(result.checks[checkName].final_url, "https://soniccheck.io/unexpected-route");
    });
  }
});

test("product-contract binding requires the exact deployed capability manifest", async () => {
  const commit = "0".repeat(40);
  const contract = JSON.parse(closedProductContract);
  contract.analyzer.capability_manifest.unsealed_note = "same revision and digest labels";
  const result = await probeDeployment({
    expectedCommit: commit,
    fetcher: passingDeploymentFetcher({
      commit,
      productContractBody: JSON.stringify(contract),
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.harry_capability_contract.checks.exact_capabilities, true);
  assert.equal(result.checks.harry_capability_contract.checks.product_contract_binding, false);
});

test("provider and payment gate snapshots reject every uncontracted key", async (t) => {
  const commit = "f".repeat(40);
  const cases = [
    ["top-level", (snapshot) => { snapshot.uncontracted = false; }],
    ["ACRCloud", (snapshot) => { snapshot.acrcloud_identification.uncontracted = false; }],
    ["MusicBrainz", (snapshot) => { snapshot.musicbrainz_metadata.uncontracted = false; }],
    ["payment", (snapshot) => { snapshot.payment.uncontracted = false; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, async () => {
      const providerGates = JSON.parse(closedProviderPaymentGates);
      mutate(providerGates);
      const result = await probeDeployment({
        expectedCommit: commit,
        fetcher: passingDeploymentFetcher({
          commit,
          providerGatesBody: JSON.stringify(providerGates),
        }),
      });

      assert.equal(result.ok, false);
      assert.equal(
        result.checks.harry_capability_contract.checks.provider_payment_gates_closed,
        false,
      );
    });
  }
});

test("Pages deployment refuses to redeploy a stale main SHA", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/static.yml", import.meta.url),
    "utf8",
  );
  const guard = workflow.indexOf("- name: Refuse stale main deployment");
  const deployment = workflow.indexOf("- name: Deploy production site");

  assert.ok(guard >= 0);
  assert.ok(deployment > guard);
  assert.ok(workflow.includes(
    "git fetch --no-tags --force origin main:refs/remotes/origin/main",
  ));
  assert.ok(workflow.includes(
    'test "${GITHUB_SHA}" = "$(git rev-parse refs/remotes/origin/main)"',
  ));
});

test("deployment truth retry arguments reject unsafe values", async () => {
  await assert.rejects(
    probeDeploymentWithRetry({ expectedCommit: "f".repeat(40), attempts: 0 }),
    /attempts must be a positive integer/,
  );
  await assert.rejects(
    probeDeploymentWithRetry({ expectedCommit: "f".repeat(40), intervalMs: -1 }),
    /intervalMs must be a non-negative integer/,
  );
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { probeCompositionScreening, probeDeployment, probeDeploymentWithRetry, probeScanFeatures } from "./probe-deployment.mjs";
import { ANALYZER_API_RELEASE_COMMIT } from "../src/constants/analyzerIdentity.mjs";
import { FEATURE_INVENTORY_SCHEMA, FEATURE_INVENTORY_INTERPRETATION, RUNTIME_FEATURES } from "../src/lib/featureInventoryPresentation.mjs";


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
  schema_version: "soniccheck-provider-payment-gates/1.1.0",
  acoustid_identification: {
    version: "soniccheck-acoustid-identity-screening/1.0.0",
    provider: "AcoustID Web Service",
    mode: "shadow",
    access_basis: "commercial_approved",
    api_key_configured: true,
    paid_traffic_enabled: false,
    timeout_seconds: 20,
    min_interval_seconds: 0.34,
    max_retries: 1,
    documented_request_limit_per_second: 3,
    ready: true,
    status: "READY_SHADOW",
    fingerprint_transmission_allowed: true,
    raw_audio_transmission_allowed: false,
    affects_composition_score: false,
    secrets_included: false,
  },
  acrcloud_identification: {
    provider: "ACRCloud Identification API",
    mode: "off",
    access_basis: "none",
    paid_traffic_enabled: false,
    ready: false,
    status: "DISABLED_BY_POLICY",
    customer_audio_transmission_allowed: false,
    secondary_credentials_present: true,
    secondary_credentials_complete: true,
    secondary_profile_status: "DORMANT_UNCLASSIFIED",
    secondary_profile_runtime_enabled: false,
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

const compositionCapability = {
  schema_version: "soniccheck-composition-screening-capability/1.0.0",
  method_version: "soniccheck-composition/0.4.1-research",
  feature_profile_version: "soniccheck-composition-feature-profile/1.0.0",
  validation_status: "RESEARCH_ONLY_UNCALIBRATED",
  operational_match_threshold: null,
  recording_identity_is_composition_evidence: false,
  independent_red_flag_enabled: false,
  signal_sufficiency_policy: "ABSTAIN_WITH_NULL_SCORES",
  availability: "BOUNDED_REFERENCE_CHECK_PASSED",
  configured_reference_comparison_exercised: true,
  provider_requests_made: 0,
  secrets_included: false,
  configured_reference_check: {
    status: "PASS",
    reference_limit: 3,
    selected: 3,
    profiles_decoded: 3,
    profile_failures: 0,
    comparisons_completed: 3,
    insufficient_profiles: 0,
    scope: "BOUNDED_CONFIGURED_PROFILE_COMPATIBILITY_ONLY",
    research_validation_claimed: false,
    customer_audio_used: false,
    raw_reference_audio_used: false,
    provider_requests_made: 0,
  },
  self_test: {
    executed: true, status: "PASS", fixture_scope: "SANITIZED_SOFTWARE_SELF_TEST_ONLY",
    research_validation_claimed: false, production_audio_used: false,
    cases: { silence_abstains: true, variable_melody_self_comparison: true },
  },
};

const scanFeatureCapability = {
  schema_version: FEATURE_INVENTORY_SCHEMA,
  inventory_scope: "CURRENT_RUNTIME_CAPABILITIES",
  channel_count: 3,
  feature_count: 6,
  interpretation: FEATURE_INVENTORY_INTERPRETATION,
  execution_statuses: ["NOT_SUBMITTED", "UNAVAILABLE", "INSUFFICIENT_SIGNAL", "NO_ELIGIBLE_REFERENCES", "COMPLETED", "PARTIAL"],
  provider_requests_made: 0,
  scores_or_thresholds_changed: false,
  features: RUNTIME_FEATURES.map((feature) => ({
    feature_id: feature.id,
    label: feature.label,
    parent_channel: feature.parentChannel,
    input_requirement: feature.inputRequirement,
    limitation: feature.limitation,
    method_version: {
      recording_identity: "soniccheck-recording-identity-orchestration/1.0.0",
      lyric_phrase_overlap: "soniccheck-exact-lyric-phrase-overlap/1.0.0",
      composition_similarity: "soniccheck-composition/0.4.1-research",
    }[feature.parentChannel],
  })),
};

function governedApiContractResponse(url) {
  if (url.endsWith("/api/capabilities/scan-features")) {
    return response(200, { body: JSON.stringify(scanFeatureCapability), url });
  }
  if (url.endsWith("/api/capabilities/composition-screening")) {
    return response(200, { body: JSON.stringify(compositionCapability), url });
  }
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

test("scan feature deployment verifies all definitions without claiming scan execution", async () => {
  const result = await probeScanFeatures("https://api.soniccheck.io", async (url, options) => {
    assert.equal(options.headers["User-Agent"], "sonic-check-production-verifier/1.0");
    return governedApiContractResponse(url);
  });
  assert.equal(result.ok, true);
  assert.equal(result.scope, "PUBLIC_CAPABILITY_DEFINITIONS_ONLY");
  assert.equal(result.authenticated_scan_acceptance_claimed, false);
  assert.equal(result.real_world_accuracy_claimed, false);
});

test("scan feature deployment rejects missing, duplicated, relabelled, unversioned or execution-claiming definitions", async () => {
  const mutations = [
    (value) => { value.features.pop(); },
    (value) => { value.features[5] = value.features[4]; },
    (value) => { value.channel_count = 6; },
    (value) => { value.features[2].label = "Independent melody detector"; },
    (value) => { value.features[1].method_version = null; },
    (value) => { value.features[0].execution_status = "COMPLETED"; },
    (value) => { value.provider_requests_made = 1; },
    (value) => { value.provider_requests_made = false; },
    (value) => { value.scores_or_thresholds_changed = true; },
    (value) => { value.execution_statuses.push("CERTIFIED"); },
  ];
  for (const mutate of mutations) {
    const payload = structuredClone(scanFeatureCapability);
    mutate(payload);
    const result = await probeScanFeatures("https://api.soniccheck.io", async (url) => response(200, { url, body: JSON.stringify(payload) }));
    assert.equal(result.ok, false);
  }
  assert.equal((await probeScanFeatures("https://api.soniccheck.io", async () => { throw new Error("unavailable"); })).ok, false);
});

test("release verification fails if six-feature capability is absent even when earlier checks pass", async () => {
  const passing = passingDeploymentFetcher({ commit: "a".repeat(40) });
  const result = await probeDeployment({
    expectedCommit: "a".repeat(40),
    fetcher: async (url) => url.endsWith("/api/capabilities/scan-features")
      ? response(404, { url, body: "{}" }) : passing(url),
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.scan_features.ok, false);
  assert.equal(result.checks.composition_screening.ok, true);
});

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
  for (const { url, options } of apiCalls) {
    if (url.endsWith("/api/capabilities/composition-screening") || url.endsWith("/api/capabilities/scan-features")) {
      assert.equal(options.headers["User-Agent"], "sonic-check-production-verifier/1.0");
    } else {
      assert.equal(options.headers, undefined);
    }
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

test("live-smoke readiness permits advisory lyric discovery to remain unavailable", async () => {
  const commit = "7".repeat(40);
  const ready = JSON.parse(controlledBetaReadiness);
  ready.ok = true;
  ready.status = "READY_FOR_LIVE_SMOKE_TEST";
  ready.checks.recording_identity = true;

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
  assert.equal(result.checks.api_readiness.checks_body_consistent, true);
  assert.equal(result.checks.api_readiness.service_fully_ready, false);
  assert.equal(result.checks.api_readiness.nonblocking_provider_checks.recording_identity, true);
  assert.equal(result.checks.api_readiness.nonblocking_provider_checks.lyric_candidate_discovery, false);
  assert.equal(result.api_service_fully_ready_observed, false);
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
    ["AcoustID", (snapshot) => { snapshot.acoustid_identification.uncontracted = false; }],
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

test("composition deployment requires live abstention behavior and governed coverage", async () => {
  const passing = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(compositionCapability), url }));
  assert.equal(passing.ok, true);
  assert.equal(passing.authenticated_scan_acceptance_claimed, false);
  for (const mutate of [
    (p) => { p.self_test.cases.silence_abstains = false; },
    (p) => { p.method_version = "soniccheck-composition/0.3.1-research"; },
    (p) => { p.method_version = "soniccheck-composition/0.4.0-research"; },
    (p) => { p.operational_match_threshold = 80; },
    (p) => { p.availability = "NO_ELIGIBLE_REFERENCES"; },
    (p) => { p.self_test.executed = "true"; },
    (p) => { p.self_test.research_validation_claimed = true; },
    (p) => { p.availability = "REFERENCES_CONFIGURED_NOT_EXERCISED"; },
    (p) => { p.configured_reference_comparison_exercised = false; },
    (p) => { p.provider_requests_made = 1; },
  ]) {
    const payload = structuredClone(compositionCapability);
    mutate(payload);
    const failed = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(payload), url }));
    assert.equal(failed.ok, false);
  }
  assert.equal((await probeCompositionScreening("https://api.soniccheck.io", async () => { throw new Error("offline"); })).ok, false);
});

test("synthetic composition PASS cannot hide failed actual configured reference profiles", async () => {
  const payload = structuredClone(compositionCapability);
  payload.availability = "REFERENCE_PROFILE_CHECK_FAILED";
  payload.configured_reference_comparison_exercised = false;
  payload.configured_reference_check = {
    ...payload.configured_reference_check,
    status: "FAIL",
    profiles_decoded: 0,
    profile_failures: 3,
    comparisons_completed: 0,
  };
  const failed = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(payload), url }));
  assert.equal(failed.checks.runtime_behavior, true);
  assert.equal(failed.checks.configured_reference_behavior, false);
  assert.equal(failed.checks.references, false);
  assert.equal(failed.ok, false);
  assert.equal(failed.authenticated_scan_acceptance_claimed, false);
  assert.equal(failed.real_world_accuracy_claimed, false);
});

test("configured composition reference check reconciles a bounded one-to-three profile sample", async () => {
  for (const selected of [1, 2, 3]) {
    const payload = structuredClone(compositionCapability);
    Object.assign(payload.configured_reference_check, {
      selected, profiles_decoded: selected, comparisons_completed: 1, insufficient_profiles: selected - 1,
    });
    const checked = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(payload), url }));
    assert.equal(checked.ok, true);
    assert.equal(checked.real_world_accuracy_claimed, false);
  }
});

test("configured composition reference check rejects unverified, malformed and contradictory canaries", async () => {
  const invalidPatches = [
    { status: "PARTIAL" },
    { status: "INSUFFICIENT_SIGNAL", comparisons_completed: 0, insufficient_profiles: 3 },
    { reference_limit: 4 },
    { reference_limit: "3" },
    { selected: 0, profiles_decoded: 0, comparisons_completed: 0 },
    { selected: 4, profiles_decoded: 4, comparisons_completed: 4 },
    { profiles_decoded: 2 },
    { profile_failures: 1 },
    { comparisons_completed: 0 },
    { insufficient_profiles: 1 },
    { scope: "FULL_CATALOGUE_VALIDATED" },
    { research_validation_claimed: true },
    { customer_audio_used: true },
    { raw_reference_audio_used: true },
    { provider_requests_made: 1 },
    { provider_requests_made: "0" },
    { provider_requests_made: false },
    { private_asset_path: "unexpected-field" },
  ];
  for (const key of ["selected", "profiles_decoded", "profile_failures", "comparisons_completed", "insufficient_profiles"]) {
    for (const value of [null, false, "0", "3", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      invalidPatches.push({ [key]: value });
    }
  }
  for (const patch of invalidPatches) {
    const payload = structuredClone(compositionCapability);
    Object.assign(payload.configured_reference_check, patch);
    const failed = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(payload), url }));
    assert.equal(failed.checks.runtime_behavior, true);
    assert.equal(failed.checks.configured_reference_behavior, false, JSON.stringify(patch));
    assert.equal(failed.ok, false);
  }
  for (const malformed of [undefined, null, [], "PASS"]) {
    const payload = { ...compositionCapability, configured_reference_check: malformed };
    const failed = await probeCompositionScreening("https://api.soniccheck.io", async (url) => response(200, { body: JSON.stringify(payload), url }));
    assert.equal(failed.ok, false);
  }
});

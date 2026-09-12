import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";

import { apiRuntimeProjectionIsValid, deploymentProbeProgress, probeApiRelease, probeApiReleaseWithRetry, probeCompositionScreening, probeDeployment, probeDeploymentWithRetry, probeScanFeatures } from "./probe-deployment.mjs";
import { ANALYZER_API_RELEASE_COMMIT, ANALYZER_API_RUNTIME_PROJECTION } from "../src/constants/analyzerIdentity.mjs";
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
  revision: "soniccheck-harry-v37-capabilities/1.0.0",
  analyzer_label: "HARRY_V37",
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
    {
      capability_id: "v37_retrieval_consensus",
      scientific_stage: "V37",
      method_version: "soniccheck-v37-eight-channel-retrieval-consensus/1.0.0-research",
      runtime_state: "RUNTIME_SHADOW_OUTPUT",
      output_path: "retrieval_consensus",
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
  versioned_label: "HARRY_V37",
  identity_revision: "soniccheck-harry-identity/1.3.0",
  scientific_v_series: "V37",
  capability_manifest: harryCapabilityManifest,
};
const harryVersion = JSON.stringify({
  commit_sha: ANALYZER_API_RELEASE_COMMIT,
  analyzer_label: "HARRY_V37",
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
  schema_version: "soniccheck-harry-v37-runtime-self-test/1.0.0",
  status: "PASS",
  analyzer_label: "HARRY_V37",
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
harryRuntimeSelfTestBody.capabilities.v37_retrieval_consensus.status = (
  "EVALUATED_SHADOW_ONLY"
);
harryRuntimeSelfTestBody.capabilities.v37_retrieval_consensus.diagnostic_sha256 = (
  "c".repeat(64)
);
const harryRuntimeSelfTest = JSON.stringify({
  ...harryRuntimeSelfTestBody,
  self_test_sha256: createHash("sha256")
    .update(canonicalJson(harryRuntimeSelfTestBody))
    .digest("hex"),
});
const legacyV36SelfTestBody = {
  ...harryRuntimeSelfTestBody,
  schema_version: "soniccheck-harry-v36-runtime-self-test/1.0.0",
  analyzer_label: "HARRY_V36",
  capabilities: Object.fromEntries(Object.entries(harryRuntimeSelfTestBody.capabilities).filter(
    ([capabilityId]) => capabilityId !== "v37_retrieval_consensus",
  )),
};
const legacyV36SelfTest = JSON.stringify({
  ...legacyV36SelfTestBody,
  self_test_sha256: createHash("sha256")
    .update(canonicalJson(legacyV36SelfTestBody))
    .digest("hex"),
});
const retrievalConsensusCapability = JSON.stringify({
  schema_version: "soniccheck-v37-retrieval-consensus-capability/1.0.0",
  scientific_stage: "V37",
  method_version: "soniccheck-v37-eight-channel-retrieval-consensus/1.0.0-research",
  runtime_state: "RUNTIME_SHADOW_OUTPUT",
  output_path: "result.retrieval_consensus",
  source_contract_id: "SC-EIGHT-CHANNEL-CONTROLLED-SHADOW-20260910",
  source_mode: "admin_opt_in",
  source_available: true,
  request_field: "candidate_shadow",
  access: "AUTHENTICATED_ADMIN_UPLOAD_ONLY",
  channels: [
    "v4:L160", "v4:L208", "v4:L257", "v4:FULL",
    "v6:L160", "v6:L208", "v6:L257", "v6:FULL",
  ],
  automatic_scan_attachment: true,
  eight_channel_execution_requires_admin_opt_in: true,
  authoritative_output_changed: false,
  candidate_ranking_changed: false,
  correctness_estimated: false,
  activation_authorized: false,
  additional_provider_requests_made: 0,
  payment_gate_changed: false,
  interpretation: (
    "Cross-channel retrieval consensus measures agreement between correlated "
    + "candidate-generation views; it is not correctness, recall, accuracy, "
    + "originality, infringement, clearance, or legal evidence."
  ),
});
// Preserve the predecessor fixture as evidence of the stale release assertion.
const legacyPendingProviderPaymentGates = JSON.stringify({
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
// Exact public, non-secret provider snapshot captured during V37 release review.
const closedProviderPaymentGates = await readFile(
  new URL("./fixtures/provider-payment-gates.v37-approved.json", import.meta.url),
  "utf8",
);
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
  if (url.endsWith("/api/capabilities/harry-v37/self-test")) {
    return response(200, { body: harryRuntimeSelfTest, url });
  }
  if (url.endsWith("/api/capabilities/harry-v36/self-test")) {
    return response(200, { body: legacyV36SelfTest, url });
  }
  if (url.endsWith("/api/capabilities/retrieval-consensus")) {
    return response(200, { body: retrievalConsensusCapability, url });
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
  assert.equal(result.checks.harry_capability_contract.analyzer_label, "HARRY_V37");
  assert.equal(
    result.checks.harry_capability_contract.capability_manifest_revision,
    "soniccheck-harry-v37-capabilities/1.0.0",
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
    if (url.endsWith("/api/capabilities/harry-v37/self-test")) {
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


const apiGateReadiness = JSON.parse(controlledBetaReadiness);
apiGateReadiness.ok = true;
apiGateReadiness.status = "READY_FOR_LIVE_SMOKE_TEST";
apiGateReadiness.checks.recording_identity = true;
const apiGateRoutes = {
  paths: {
    "/api/diagnostics/multiview-consistency": { post: {} },
    "/api/capabilities/harry-v36/self-test": { get: {} },
    "/api/capabilities/harry-v37/self-test": { get: {} },
    "/api/capabilities/retrieval-consensus": { get: {} },
    "/api/capabilities/runtime-privacy": { get: {} },
    "/api/capabilities/provider-payment-gates": { get: {} },
  },
};

function apiGateFetcher({ mutate, calls = [], readinessBody = apiGateReadiness, readinessStatus = 200 } = {}) {
  return async (url, options) => {
    calls.push({ url, options });
    assert.equal(new URL(url).origin, "https://api.soniccheck.io");
    assert.equal(options.method, undefined);
    assert.equal(options.body, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    const baseline = url.endsWith("/api/healthz")
      ? response(200, { body: '{"ok":true}', url })
      : url.endsWith("/api/readyz")
        ? response(readinessStatus, { body: JSON.stringify(readinessBody), url })
        : url.endsWith("/openapi.json")
          ? response(200, { body: JSON.stringify(apiGateRoutes), url })
          : governedApiContractResponse(url);
    assert.ok(baseline, `unexpected API request: ${url}`);
    const body = await baseline.json();
    if (url.endsWith("/api/capabilities/runtime-privacy")) Object.assign(body, ANALYZER_API_RUNTIME_PROJECTION);
    mutate?.(url, body);
    return response(baseline.status, { body: JSON.stringify(body), url });
  };
}

async function probeProviderGateSnapshot(snapshot) {
  return probeApiRelease({
    fetcher: apiGateFetcher({
      mutate: (url, body) => {
        if (!url.endsWith("/api/capabilities/provider-payment-gates")) return;
        for (const key of Object.keys(body)) delete body[key];
        Object.assign(body, snapshot);
      },
    }),
  });
}

test("V37 release gates accept the captured approved metadata-only public snapshot", async () => {
  const snapshot = JSON.parse(closedProviderPaymentGates);
  assert.equal(snapshot.musicbrainz_metadata.access_basis, "commercial_approved");
  assert.equal(snapshot.musicbrainz_metadata.evaluation_only, false);
  assert.equal(snapshot.musicbrainz_metadata.commercial_use_approved, true);
  assert.equal(snapshot.acrcloud_identification.secondary_profile_status, "NOT_CONFIGURED");
  const apiResult = await probeProviderGateSnapshot(snapshot);
  assert.equal(apiResult.ok, true);
  const commit = "a".repeat(40);
  const deploymentResult = await probeDeployment({
    expectedCommit: commit,
    fetcher: passingDeploymentFetcher({ commit, providerGatesBody: closedProviderPaymentGates }),
  });
  assert.equal(deploymentResult.ok, true);
  assert.equal(apiResult.authenticated_scan_acceptance_claimed, false);
  assert.equal(apiResult.web_deployment_verified, false);
});

test("V37 also accepts a coherent complete but dormant optional ACRCloud project", async () => {
  const snapshot = JSON.parse(closedProviderPaymentGates);
  Object.assign(snapshot.acrcloud_identification, {
    secondary_credentials_present: true,
    secondary_credentials_complete: true,
    secondary_profile_status: "DORMANT_UNCLASSIFIED",
  });
  const result = await probeProviderGateSnapshot(snapshot);
  assert.equal(result.ok, true);
});

test("the preserved pending-evaluation predecessor cannot authorize a production release", async () => {
  const result = await probeProviderGateSnapshot(JSON.parse(legacyPendingProviderPaymentGates));
  assert.equal(result.ok, false);
  assert.equal(result.checks.harry_capability_contract.checks.provider_payment_gates_closed, false);
});

test("V37 provider gate repair still rejects unsafe, incoherent and incorrectly typed states", async (t) => {
  const cases = [
    ["pending MusicBrainz", "musicbrainz_metadata", { access_basis: "pending_evaluation", evaluation_only: true, commercial_use_approved: false }],
    ["unapproved MusicBrainz", "musicbrainz_metadata", { commercial_use_approved: false }],
    ["numeric MusicBrainz approval", "musicbrainz_metadata", { commercial_use_approved: 1 }],
    ["numeric evaluation flag", "musicbrainz_metadata", { evaluation_only: 0 }],
    ["MusicBrainz live mode", "musicbrainz_metadata", { mode: "on" }],
    ["MusicBrainz configuration error", "musicbrainz_metadata", { configuration_error: "invalid" }],
    ["MusicBrainz non-metadata role", "musicbrainz_metadata", { role: "candidate_generation" }],
    ["MusicBrainz candidate generation", "musicbrainz_metadata", { affects_candidate_generation: true }],
    ["MusicBrainz confidence changes", "musicbrainz_metadata", { affects_confidence: true }],
    ["MusicBrainz ranking changes", "musicbrainz_metadata", { affects_ranking: true }],
    ["MusicBrainz paid traffic", "musicbrainz_metadata", { paid_traffic_enabled: true }],
    ["partial secondary credentials", "acrcloud_identification", { secondary_credentials_present: true }],
    ["complete without present", "acrcloud_identification", { secondary_credentials_complete: true }],
    ["absent with dormant status", "acrcloud_identification", { secondary_profile_status: "DORMANT_UNCLASSIFIED" }],
    ["complete with absent status", "acrcloud_identification", { secondary_credentials_present: true, secondary_credentials_complete: true }],
    ["secondary runtime activation", "acrcloud_identification", { secondary_profile_runtime_enabled: true }],
    ["numeric absent flag", "acrcloud_identification", { secondary_credentials_present: 0 }],
    ["numeric complete flag", "acrcloud_identification", { secondary_credentials_complete: 0 }],
    ["numeric disabled flag", "acrcloud_identification", { secondary_profile_runtime_enabled: 0 }],
    ["numeric dormant flags", "acrcloud_identification", { secondary_credentials_present: 1, secondary_credentials_complete: 1, secondary_profile_status: "DORMANT_UNCLASSIFIED" }],
    ["ACRCloud recognition activation", "acrcloud_identification", { mode: "on" }],
    ["ACRCloud access change", "acrcloud_identification", { access_basis: "commercial_approved" }],
    ["ACRCloud audio transmission", "acrcloud_identification", { customer_audio_transmission_allowed: true }],
    ["ACRCloud composition changes", "acrcloud_identification", { affects_composition_score: true }],
    ["AcoustID audio transmission", "acoustid_identification", { raw_audio_transmission_allowed: true }],
    ["AcoustID composition changes", "acoustid_identification", { affects_composition_score: true }],
    ["AcoustID paid traffic", "acoustid_identification", { paid_traffic_enabled: true }],
    ["payment approval", "payment", { approved: true }],
    ["payment approval revision", "payment", { approval_revision: "unreviewed" }],
    ["paid traffic requested", "payment", { paid_traffic_requested: true }],
    ["paid traffic authorized", "payment", { paid_traffic_authorized: true }],
  ];
  for (const [name, section, patch] of cases) {
    await t.test(name, async () => {
      const snapshot = JSON.parse(closedProviderPaymentGates);
      Object.assign(snapshot[section], patch);
      const result = await probeProviderGateSnapshot(snapshot);
      assert.equal(result.ok, false);
      assert.equal(result.checks.harry_capability_contract.checks.provider_payment_gates_closed, false);
      assert.equal(result.checks.api_health.ok, true);
      assert.equal(result.checks.runtime_application_projection.ok, true);
    });
  }
});

test("API premerge gate verifies all API contracts without web or Clerk requests", async () => {
  const calls = [];
  const result = await probeApiRelease({ fetcher: apiGateFetcher({ calls }) });
  assert.equal(result.ok, true);
  assert.equal(result.expected_api_commit, ANALYZER_API_RELEASE_COMMIT);
  assert.equal(result.observed_api_commit, ANALYZER_API_RELEASE_COMMIT);
  assert.match(result.captured_at, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(result.verification_scope, "API_RELEASE_BEFORE_WEB_MERGE");
  assert.equal(result.web_deployment_verified, false);
  assert.equal(result.authenticated_scan_acceptance_claimed, false);
  assert.equal(result.full_service_launch_readiness_claimed, false);
  assert.equal(result.api_service_fully_ready_observed, false);
  assert.equal(result.secrets_included, false);
  assert.equal(result.checks.api_readiness.recording_identity_ready, true);
  assert.equal(result.checks.api_readiness.lyric_candidate_discovery_ready, false);
  assert.deepEqual(result.checks.runtime_application_projection, {
    ok: true, expected: ANALYZER_API_RUNTIME_PROJECTION, observed: ANALYZER_API_RUNTIME_PROJECTION,
  });
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname).sort(), [
    "/api/capabilities/composition-screening",
    "/api/capabilities/harry-v36/self-test",
    "/api/capabilities/harry-v37/self-test",
    "/api/capabilities/provider-payment-gates",
    "/api/capabilities/retrieval-consensus",
    "/api/capabilities/runtime-privacy",
    "/api/capabilities/scan-features",
    "/api/healthz",
    "/api/product-contract",
    "/api/readyz",
    "/api/version",
    "/openapi.json",
  ]);
  assert.deepEqual(Object.keys(result.checks).sort(), [
    "api_health", "api_readiness", "api_routes", "composition_screening", "harry_capability_contract", "runtime_application_projection", "scan_features",
  ]);
});

test("API premerge gate preserves each existing fail-closed validator", async (t) => {
  const cases = [
    ["stale API commit", "/api/version", (body) => { body.commit_sha = "0".repeat(40); }, "harry_capability_contract"],
    ["unsealed capability", "/api/version", (body) => { body.analyzer.capability_manifest.sha256 = "0".repeat(64); }, "harry_capability_contract"],
    ["unexecuted self-test", "/api/capabilities/harry-v37/self-test", (body) => { body.status = "NOT_RUN"; }, "harry_capability_contract"],
    ["broken legacy V36 self-test", "/api/capabilities/harry-v36/self-test", (body) => { body.status = "NOT_RUN"; }, "harry_capability_contract"],
    ["promoting retrieval consensus", "/api/capabilities/retrieval-consensus", (body) => { body.candidate_ranking_changed = true; }, "harry_capability_contract"],
    ["open provider payment gate", "/api/capabilities/provider-payment-gates", (body) => { body.payment.approved = true; }, "harry_capability_contract"],
    ["open product checkout", "/api/product-contract", (body) => { body.pricing.plans[0].checkout_enabled = true; }, "harry_capability_contract"],
    ["private audio in application", "/api/capabilities/runtime-privacy", (body) => { body.raw_audio_present = true; }, "harry_capability_contract"],
    ["wrong application manifest", "/api/capabilities/runtime-privacy", (body) => { body.application_manifest_sha256 = "0".repeat(64); }, "runtime_application_projection"],
    ["wrong application file count", "/api/capabilities/runtime-privacy", (body) => { body.application_files_checked += 1; }, "runtime_application_projection"],
    ["wrong application byte count", "/api/capabilities/runtime-privacy", (body) => { body.application_bytes_scanned += 1; }, "runtime_application_projection"],
    ["missing database readiness", "/api/readyz", (body) => { body.checks.database = false; }, "api_readiness"],
    ["failed health body", "/api/healthz", (body) => { body.ok = false; }, "api_health"],
    ["unperformed reference comparison", "/api/capabilities/composition-screening", (body) => { body.configured_reference_check.comparisons_completed = 0; }, "composition_screening"],
    ["wrong feature method", "/api/capabilities/scan-features", (body) => { body.features[0].method_version = "not-reviewed"; }, "scan_features"],
  ];
  for (const [name, path, mutate, failedCheck] of cases) {
    await t.test(name, async () => {
      const result = await probeApiRelease({
        fetcher: apiGateFetcher({ mutate: (url, body) => { if (url.endsWith(path)) mutate(body); } }),
      });
      assert.equal(result.ok, false);
      assert.equal(result.checks[failedCheck].ok, false);
      assert.equal(result.web_deployment_verified, false);
      if (name === "stale API commit") assert.equal(result.observed_api_commit, null);
    });
  }
});

test("API gate requires recording readiness while lyric discovery remains advisory", async () => {
  const result = await probeApiRelease({
    fetcher: apiGateFetcher({ readinessBody: JSON.parse(controlledBetaReadiness), readinessStatus: 503 }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.checks.api_readiness.ok, false);
  assert.equal(result.checks.api_readiness.recording_identity_ready, false);
  assert.equal(result.checks.api_readiness.status_body_consistent, true);
  assert.equal(result.checks.api_readiness.checks_body_consistent, true);
  assert.equal(result.checks.api_readiness.required_nonprovider_controls_ready, true);
});

test("API gate rejects missing or wrong OpenAPI methods for every required route", async (t) => {
  for (const [path, methods] of Object.entries(apiGateRoutes.paths)) {
    await t.test(path, async () => {
      const method = Object.keys(methods)[0];
      for (const replacement of [undefined, { [method === "get" ? "post" : "get"]: {} }, { [method]: null }]) {
        const result = await probeApiRelease({ fetcher: apiGateFetcher({ mutate: (url, body) => {
          if (url.endsWith("/openapi.json")) body.paths[path] = replacement;
        } }) });
        assert.equal(result.ok, false);
        assert.equal(result.checks.api_routes.ok, false);
        assert.equal(result.checks.harry_capability_contract.ok, true);
      }
    });
  }
});

test("API source projection pin requires an exact well-formed digest and positive safe counts", () => {
  assert.equal(apiRuntimeProjectionIsValid(ANALYZER_API_RUNTIME_PROJECTION), true);
  const invalid = [undefined, null, [], {}, { ...ANALYZER_API_RUNTIME_PROJECTION, extra: true }];
  for (const value of [undefined, null, false, "0".repeat(63), "G".repeat(64)]) {
    invalid.push({ ...ANALYZER_API_RUNTIME_PROJECTION, application_manifest_sha256: value });
  }
  for (const field of ["application_files_checked", "application_bytes_scanned"]) {
    for (const value of [undefined, null, false, "52", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      invalid.push({ ...ANALYZER_API_RUNTIME_PROJECTION, [field]: value });
    }
  }
  for (const value of invalid) assert.equal(apiRuntimeProjectionIsValid(value), false);
});

test("API gate receipts omit response payloads and arbitrary exception messages", async () => {
  const marker = "private-response-marker";
  const result = await probeApiRelease({
    fetcher: apiGateFetcher({ mutate: (url, body) => {
      if (url.endsWith("/api/healthz") || url.endsWith("/api/readyz")) body.unexpected_debug = marker;
    } }),
  });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes(marker), false);
  assert.equal("payload" in result.checks.api_health, false);
  assert.equal("payload" in result.checks.api_readiness, false);
  const failed = await probeApiRelease({ fetcher: async () => { throw new Error(marker); } });
  assert.equal(failed.ok, false);
  assert.equal(JSON.stringify(failed).includes(marker), false);
  assert.equal(failed.observed_api_commit, null);
  const malformedProjection = await probeApiRelease({ fetcher: apiGateFetcher({ mutate: (url, body) => {
    if (url.endsWith("/api/capabilities/runtime-privacy")) {
      body.application_manifest_sha256 = marker;
      body.application_files_checked = marker;
      body.application_bytes_scanned = marker;
      body.unexpected_debug = marker;
    }
  } }) });
  assert.equal(malformedProjection.ok, false);
  assert.equal(JSON.stringify(malformedProjection).includes(marker), false);
  assert.deepEqual(malformedProjection.checks.runtime_application_projection.observed, {
    application_manifest_sha256: null, application_files_checked: null, application_bytes_scanned: null,
  });
});

test("API gate retries a stale deployment and stops after the exact API release appears", async () => {
  let versionRequests = 0;
  const waits = [];
  const result = await probeApiReleaseWithRetry({
    fetcher: apiGateFetcher({ mutate: (url, body) => {
      if (url.endsWith("/api/version") && ++versionRequests === 1) body.commit_sha = "0".repeat(40);
    } }),
    attempts: 3,
    intervalMs: 10_000,
    sleeper: async (delay) => { waits.push(delay); },
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempt, 2);
  assert.equal(result.max_attempts, 3);
  assert.equal(versionRequests, 2);
  assert.deepEqual(waits, [10_000]);
});

test("API gate exhausts its retry budget without claiming a verified release", async () => {
  let waits = 0;
  const result = await probeApiReleaseWithRetry({
    fetcher: apiGateFetcher({ mutate: (url, body) => {
      if (url.endsWith("/api/version")) body.commit_sha = "0".repeat(40);
    } }),
    attempts: 2,
    sleeper: async () => { waits += 1; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.attempt, 2);
  assert.equal(result.max_attempts, 2);
  assert.equal(result.observed_api_commit, null);
  assert.equal(waits, 1);
  await assert.rejects(probeApiReleaseWithRetry({ attempts: 0 }), /positive integer/u);
  await assert.rejects(probeApiReleaseWithRetry({ intervalMs: -1 }), /non-negative integer/u);
});

test("API release gate runs for every built web candidate and full verification remains post-deploy", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/static.yml", import.meta.url), "utf8");
  const gate = workflow.split("  verify-api:\n")[1].split("\n  deploy:\n")[0];
  assert.doesNotMatch(gate, /^    if:/mu);
  assert.match(gate, /needs: build/u);
  assert.match(gate, /contents: read/u);
  assert.match(gate, /persist-credentials: false/u);
  assert.doesNotMatch(gate, /secrets\.|: write|npm ci|workflow_run|pull_request_target/u);
  assert.match(gate, /--api-only\s+--attempts 30\s+--interval-ms 10000/u);
  assert.match(gate, /name: sonic-check-api-release-gate/u);
  assert.match(gate, /if-no-files-found: error/u);
  assert.match(gate, /if: always\(\) && steps\.api_release\.outcome != 'success'\s+run: exit 1/u);
  const production = workflow.split("  verify-production:\n")[1];
  assert.match(production, /needs: deploy/u);
  assert.match(production, /--expected-commit "\$\{GITHUB_SHA\}"/u);
  assert.doesNotMatch(production, /--api-only/u);
});

test("Pages deployment requires both successful gates on main push and manual runs, and never deploys a PR", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/static.yml", import.meta.url), "utf8");
  const deploy = workflow.split("  deploy:\n")[1].split("\n  verify-production:\n")[0];
  const needs = deploy.match(/^    needs: \[([^\]]+)\]$/mu)?.[1].split(",").map((name) => name.trim());
  assert.deepEqual(needs, ["build", "verify-api"]);
  const condition = deploy.match(/^    if: (.+)$/mu)?.[1];
  assert.ok(condition);
  // This workflow condition uses only the JS-compatible equality/AND subset of
  // GitHub expressions. Exercise its actual text rather than a copied predicate.
  for (const eventName of ["pull_request", "push", "workflow_dispatch"]) {
    for (const ref of ["refs/heads/main", "refs/heads/candidate"]) {
      for (const build of ["success", "failure", "cancelled", "skipped"]) {
        for (const api of ["success", "failure", "cancelled", "skipped"]) {
          const context = {
            github: { event_name: eventName, ref },
            needs: { build: { result: build }, "verify-api": { result: api } },
          };
          const deployAllowed = runInNewContext(condition, context, { timeout: 100 });
          assert.equal(deployAllowed, eventName !== "pull_request" && ref === "refs/heads/main"
            && build === "success" && api === "success", JSON.stringify(context));
        }
      }
    }
  }
});

test("retry progress identifies stale API commits without changing the final gate receipt", async () => {
  let versionRequests = 0;
  const events = [];
  const result = await probeApiReleaseWithRetry({
    fetcher: apiGateFetcher({ mutate: (url, body) => {
      if (url.endsWith("/api/version") && ++versionRequests === 1) body.commit_sha = "0".repeat(40);
    } }),
    attempts: 3,
    intervalMs: 10_000,
    sleeper: async () => {},
    onProgress: (event) => { events.push(event); },
  });
  assert.deepEqual(events.map(({ phase, attempt }) => [phase, attempt]), [
    ["started", 1], ["finished", 1], ["started", 2], ["finished", 2],
  ]);
  assert.deepEqual(events[1].failed_checks, ["harry_capability_contract.deployed_commit"]);
  assert.equal(events[1].observed_api_commit, "0".repeat(40));
  assert.equal(events[1].verified_api_commit, null);
  assert.equal(events[1].outcome, "retrying");
  assert.equal(events[1].retry_in_ms, 10_000);
  assert.equal(events[3].observed_api_commit, ANALYZER_API_RELEASE_COMMIT);
  assert.equal(events[3].verified_api_commit, ANALYZER_API_RELEASE_COMMIT);
  assert.equal(events[3].outcome, "passed");
  assert.equal(events[3].retry_in_ms, null);
  const expected = await probeApiRelease({ fetcher: apiGateFetcher() });
  const { captured_at, attempt, max_attempts, ...receipt } = result;
  delete expected.captured_at;
  assert.deepEqual(receipt, expected);
  assert.equal(attempt, 2);
  assert.equal(max_attempts, 3);
  assert.ok(captured_at);
});

test("full deployment retries emit bounded progress and preserve their final receipt", async () => {
  const expectedCommit = "a".repeat(40);
  const events = [];
  const result = await probeDeploymentWithRetry({
    expectedCommit,
    fetcher: passingDeploymentFetcher({ commit: expectedCommit }),
    onProgress: (event) => { events.push(event); },
  });
  assert.deepEqual(events.map(({ phase }) => phase), ["started", "finished"]);
  assert.equal(events[1].outcome, "passed");
  assert.equal(events[1].verified_api_commit, ANALYZER_API_RELEASE_COMMIT);
  const { attempt, max_attempts, ...receipt } = result;
  assert.equal(attempt, 1);
  assert.equal(max_attempts, 1);
  assert.deepEqual(receipt, await probeDeployment({
    expectedCommit, fetcher: passingDeploymentFetcher({ commit: expectedCommit }),
  }));
});

test("progress excludes arbitrary keys, payloads, URLs, errors and malformed observed commits", async () => {
  const marker = "private-diagnostic-marker\n::error::not-a-workflow-command";
  const events = [];
  const result = await probeApiReleaseWithRetry({
    fetcher: apiGateFetcher({ mutate: (url, body) => {
      body[marker] = marker;
      if (url.endsWith("/api/version")) body.commit_sha = marker;
    } }),
    onProgress: (event) => { events.push(event); },
  });
  assert.equal(result.ok, false);
  assert.equal(events[1].observed_api_commit, null);
  assert.equal(events[1].verified_api_commit, null);
  assert.equal(events[1].outcome, "failed");
  assert.equal(events[1].retry_in_ms, null);
  assert.equal(JSON.stringify(events).includes(marker), false);
  const malicious = {
    ok: false, attempt: 1, max_attempts: 2, error: marker, origins: { api: marker },
    checks: {
      [marker]: { ok: false },
      api_health: { ok: false, payload: marker, error: marker, status: marker },
      harry_capability_contract: { ok: false, checks: { deployed_commit: false, [marker]: false } },
      runtime_application_projection: { ok: false, expected: marker, observed: marker },
    },
  };
  const progress = deploymentProbeProgress(malicious, { observedApiCommit: marker });
  assert.equal(JSON.stringify(progress).includes(marker), false);
  assert.deepEqual(progress.failed_checks, [
    "api_health", "harry_capability_contract.deployed_commit", "runtime_application_projection",
  ]);
  for (const value of [null, 1, {}, "a".repeat(39), "g".repeat(40), "a".repeat(40) + "\n"]) {
    assert.equal(deploymentProbeProgress(malicious, { observedApiCommit: value }).observed_api_commit, null);
  }
});

test("CLI writes progress only to stderr and retains one final JSON receipt on stdout and disk", async () => {
  const directory = await mkdtemp(join(tmpdir(), "soniccheck-probe-cli-"));
  try {
    const preload = join(directory, "offline-fetch.mjs");
    const output = join(directory, "receipt.json");
    const marker = "private-cli-exception-marker";
    await writeFile(preload, `globalThis.fetch = async () => { throw new Error(${JSON.stringify(marker)}); };\n`);
    const child = spawnSync(process.execPath, [
      "--import", preload, new URL("./probe-deployment.mjs", import.meta.url).pathname,
      "--api-only", "--attempts", "2", "--interval-ms", "0", "--output", output,
    ], { encoding: "utf8", timeout: 10_000 });
    assert.equal(child.status, 1);
    assert.equal(child.error, undefined);
    assert.equal(child.stdout, await readFile(output, "utf8"));
    const receipt = JSON.parse(child.stdout);
    assert.equal(receipt.ok, false);
    assert.equal(receipt.attempt, 2);
    assert.equal(receipt.max_attempts, 2);
    assert.equal(child.stdout.includes("deployment_probe_progress"), false);
    assert.equal(child.stdout.includes(marker), false);
    assert.equal(child.stderr.includes(marker), false);
    const events = child.stderr.trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(events.map(({ phase, outcome }) => [phase, outcome || null]), [
      ["started", null], ["finished", "retrying"], ["started", null], ["finished", "failed"],
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

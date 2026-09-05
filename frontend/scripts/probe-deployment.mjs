import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANALYZER_CAPABILITY_MANIFEST_REVISION,
  ANALYZER_CAPABILITY_MANIFEST_SHA256,
  ANALYZER_API_RELEASE_COMMIT,
  ANALYZER_IDENTITY,
  ANALYZER_IDENTITY_REVISION,
} from "../src/constants/analyzerIdentity.mjs";


const DEFAULTS = {
  apex: "https://soniccheck.io",
  www: "https://www.soniccheck.io",
  app: "https://app.soniccheck.io",
  api: "https://api.soniccheck.io",
  clerk: "https://clerk.soniccheck.io",
};

const PRODUCTION_VERIFIER_USER_AGENT = "sonic-check-production-verifier/1.0";

const REQUIRED_NONPROVIDER_CONTROL_CHECKS = [
  "database",
  "clerk",
  "stripe",
  "private_audio_storage",
  "audio_runtime",
  "api_hostname",
  "product_convergence",
  "composition_reference_base",
  "composition_v16r",
  "catalogue_release",
];

const NONBLOCKING_PROVIDER_READINESS_CHECKS = [
  "recording_identity",
  "lyric_candidate_discovery",
];

const EXPECTED_READINESS_CHECKS = [
  ...REQUIRED_NONPROVIDER_CONTROL_CHECKS,
  ...NONBLOCKING_PROVIDER_READINESS_CHECKS,
];

const EXPECTED_PROVIDER_GATE_KEYS = [
  "schema_version",
  "acrcloud_identification",
  "musicbrainz_metadata",
  "payment",
  "secrets_included",
];

const EXPECTED_ACRCLOUD_GATE_KEYS = [
  "provider",
  "mode",
  "access_basis",
  "paid_traffic_enabled",
  "ready",
  "status",
  "customer_audio_transmission_allowed",
  "research_only",
  "affects_composition_score",
  "secrets_included",
];

const EXPECTED_MUSICBRAINZ_GATE_KEYS = [
  "version",
  "provider",
  "mode",
  "enabled",
  "access_basis",
  "evaluation_only",
  "commercial_use_approved",
  "paid_traffic_enabled",
  "configuration_error",
  "role",
  "affects_candidate_generation",
  "affects_confidence",
  "affects_ranking",
];

const EXPECTED_PAYMENT_GATE_KEYS = [
  "approved",
  "approval_revision",
  "status",
  "paid_traffic_requested",
  "paid_traffic_authorized",
];

const REQUIRED_HARRY_CAPABILITIES = {
  v34_structural_missingness_bounds: {
    scientific_stage: "V34",
    method_version: "soniccheck-v34-partial-identification/1.0.0-research",
    runtime_state: "RUNTIME_SHADOW_OUTPUT",
    output_path: "similarity_analysis.evidence_confidence.partial_identification",
    automatic_scan_attachment: true,
  },
  v35_multi_view_consistency: {
    scientific_stage: "V35",
    method_version: "soniccheck-v35-exact-identity-invariance/0.1.0-research",
    runtime_state: "RUNTIME_DIAGNOSTIC_ENDPOINT",
    output_path: "POST /api/diagnostics/multiview-consistency",
    automatic_scan_attachment: false,
  },
  v36_channel_loss_sensitivity: {
    scientific_stage: "V36",
    method_version: "soniccheck-channel-loss-sensitivity/1.0.0-research",
    runtime_state: "RUNTIME_SHADOW_OUTPUT",
    output_path: "similarity_analysis.channel_loss_sensitivity",
    automatic_scan_attachment: true,
  },
};

const REQUIRED_SELF_TEST_STATUSES = {
  v34_structural_missingness_bounds: "PARTIALLY_IDENTIFIED",
  v35_multi_view_consistency: "NO_EXACT_VIEW_DIVERGENCE_OBSERVED",
  v36_channel_loss_sensitivity: "EVALUATED_SHADOW_ONLY",
};

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const observed = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return observed.length === expected.length
    && observed.every((key, index) => key === expected[index]);
}

function manifestDigest(manifest) {
  const body = {
    revision: manifest?.revision,
    analyzer_label: manifest?.analyzer_label,
    capabilities: manifest?.capabilities,
  };
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

function capabilitiesAreExact(manifest) {
  if (
    manifest?.revision !== ANALYZER_CAPABILITY_MANIFEST_REVISION
    || manifest?.analyzer_label !== ANALYZER_IDENTITY
    || !Array.isArray(manifest?.capabilities)
    || manifest.capabilities.length !== Object.keys(REQUIRED_HARRY_CAPABILITIES).length
    || Object.keys(manifest).sort().join(",") !== "analyzer_label,capabilities,revision,sha256"
    || !/^[0-9a-f]{64}$/.test(manifest?.sha256 || "")
    || manifest.sha256 !== ANALYZER_CAPABILITY_MANIFEST_SHA256
    || manifest.sha256 !== manifestDigest(manifest)
  ) return false;

  const observed = Object.fromEntries(manifest.capabilities.map((row) => [row?.capability_id, row]));
  return Object.entries(REQUIRED_HARRY_CAPABILITIES).every(([capabilityId, expected]) => {
    const row = observed[capabilityId];
    const expectedRow = {
      capability_id: capabilityId,
      ...expected,
      additional_provider_requests_made_by_capability: 0,
      authoritative_status_changed: false,
      payment_gate_changed: false,
    };
    return canonicalJson(row) === canonicalJson(expectedRow);
  });
}

function runtimeSelfTestIsExact(selfTest, manifest) {
  const declared = Object.fromEntries(
    (manifest?.capabilities || []).map((row) => [row?.capability_id, row]),
  );
  const exercised = selfTest?.capabilities;
  if (
    selfTest?.schema_version !== "soniccheck-harry-v36-runtime-self-test/1.0.0"
    || selfTest?.status !== "PASS"
    || selfTest?.analyzer_label !== ANALYZER_IDENTITY
    || selfTest?.fixture_scope !== "SANITIZED_SOFTWARE_SELF_TEST_ONLY"
    || selfTest?.production_audio_used !== false
    || selfTest?.research_validation_claimed !== false
    || selfTest?.provider_requests_made !== 0
    || selfTest?.payment_entitlements_consumed !== 0
    || selfTest?.authoritative_status_changed !== false
    || !exercised
    || typeof exercised !== "object"
    || Array.isArray(exercised)
    || Object.keys(exercised).length !== Object.keys(REQUIRED_HARRY_CAPABILITIES).length
    || !/^[0-9a-f]{64}$/.test(selfTest?.self_test_sha256 || "")
  ) return false;

  const body = { ...selfTest };
  delete body.self_test_sha256;
  if (createHash("sha256").update(canonicalJson(body)).digest("hex") !== selfTest.self_test_sha256) {
    return false;
  }
  return Object.keys(REQUIRED_HARRY_CAPABILITIES).every((capabilityId) => (
    exercised[capabilityId]?.executed === true
    && exercised[capabilityId]?.method_version === declared[capabilityId]?.method_version
    && exercised[capabilityId]?.status === REQUIRED_SELF_TEST_STATUSES[capabilityId]
  )) && /^[0-9a-f]{64}$/.test(
    exercised.v35_multi_view_consistency?.diagnostic_sha256 || "",
  );
}

function closedProviderPaymentGates(value) {
  const acrcloud = value?.acrcloud_identification;
  const musicbrainz = value?.musicbrainz_metadata;
  const payment = value?.payment;
  return hasExactKeys(value, EXPECTED_PROVIDER_GATE_KEYS)
    && value?.schema_version === "soniccheck-provider-payment-gates/1.0.0"
    && value?.secrets_included === false
    && hasExactKeys(acrcloud, EXPECTED_ACRCLOUD_GATE_KEYS)
    && acrcloud?.provider === "ACRCloud Identification API"
    && acrcloud?.mode === "off"
    && acrcloud?.access_basis === "none"
    && acrcloud?.paid_traffic_enabled === false
    && acrcloud?.ready === false
    && acrcloud?.status === "DISABLED_BY_POLICY"
    && acrcloud?.customer_audio_transmission_allowed === false
    && acrcloud?.research_only === true
    && acrcloud?.affects_composition_score === false
    && acrcloud?.secrets_included === false
    && hasExactKeys(musicbrainz, EXPECTED_MUSICBRAINZ_GATE_KEYS)
    && musicbrainz?.version === "soniccheck-musicbrainz-enrichment/0.3.0"
    && musicbrainz?.provider === "MusicBrainz WS/2"
    && musicbrainz?.mode === "shadow"
    && musicbrainz?.access_basis === "pending_evaluation"
    && musicbrainz?.enabled === true
    && musicbrainz?.evaluation_only === true
    && musicbrainz?.commercial_use_approved === false
    && musicbrainz?.paid_traffic_enabled === false
    && musicbrainz?.configuration_error === null
    && musicbrainz?.role === "candidate_metadata_enrichment_only"
    && musicbrainz?.affects_candidate_generation === false
    && musicbrainz?.affects_confidence === false
    && musicbrainz?.affects_ranking === false
    && hasExactKeys(payment, EXPECTED_PAYMENT_GATE_KEYS)
    && payment?.approved === false
    && payment?.approval_revision === null
    && payment?.status === "formal_licence_required"
    && payment?.paid_traffic_requested === false
    && payment?.paid_traffic_authorized === false;
}

function deployedApplicationRootIsPrivate(value) {
  return value?.schema_version === "soniccheck-runtime-application-root-privacy/1.0.0"
    && value?.status === "PASS"
    && value?.scope === "DEPLOYED_APPLICATION_ROOT_FILESYSTEM"
    && /^[0-9a-f]{64}$/.test(value?.application_manifest_sha256 || "")
    && Number.isInteger(value?.application_files_checked)
    && value.application_files_checked > 0
    && Number.isInteger(value?.application_bytes_scanned)
    && value.application_bytes_scanned > 0
    && value?.private_research_evidence_present === false
    && value?.raw_audio_present === false
    && value?.secret_material_present === false
    && value?.whole_container_filesystem_scanned === false
    && value?.whole_container_digest_claimed === false
    && value?.content_classification_scope === "EXACT_PATH_ALLOWLIST_AND_RECOGNIZED_BYTE_SIGNATURES"
    && value?.semantic_content_classification_claimed === false;
}

function deploymentCommit(html) {
  return html.match(/<meta\s+name=["']soniccheck-deployment-commit["']\s+content=["']([^"']*)["']/i)?.[1] || "";
}

function authConfigured(html) {
  return html.match(/<meta\s+name=["']soniccheck-auth-configured["']\s+content=["']([^"']*)["']/i)?.[1] === "true";
}

function canonicalUrl(html) {
  return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']\s*\/?>/i)?.[1] || "";
}

function webRequestOptions(redirect) {
  return {
    redirect,
    headers: { "User-Agent": PRODUCTION_VERIFIER_USER_AGENT },
  };
}

async function probePage(
  base,
  path,
  expectedCommit,
  fetcher,
  { requireAuth = false, expectedCanonical = "" } = {},
) {
  try {
    const requestedUrl = `${base}${path}`;
    const response = await fetcher(requestedUrl, webRequestOptions("follow"));
    const body = await response.text();
    const observedCommit = deploymentCommit(body);
    const exactFinalUrl = response.url === requestedUrl;
    const observedCanonical = canonicalUrl(body);
    const canonicalMetadata = !expectedCanonical || observedCanonical === expectedCanonical;
    return {
      ok: (
        response.status === 200
        && observedCommit === expectedCommit
        && (!requireAuth || authConfigured(body))
        && exactFinalUrl
        && canonicalMetadata
      ),
      path,
      status: response.status,
      final_url: response.url,
      exact_final_url: exactFinalUrl,
      canonical_path: exactFinalUrl,
      canonical_metadata: canonicalMetadata,
      expected_canonical: expectedCanonical || null,
      observed_canonical: observedCanonical || null,
      expected_commit: expectedCommit,
      observed_commit: observedCommit || null,
      auth_configured: authConfigured(body),
    };
  } catch (error) {
    return { ok: false, path, error: String(error?.message || error) };
  }
}

async function probeRedirect(url, expectedLocation, fetcher) {
  try {
    const response = await fetcher(url, webRequestOptions("manual"));
    const location = response.headers.get("location");
    return {
      ok: response.status === 301 && location === expectedLocation,
      status: response.status,
      location,
      expected_location: expectedLocation,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), expected_location: expectedLocation };
  }
}

async function probeHealth(url, fetcher) {
  try {
    const response = await fetcher(url, { redirect: "follow" });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const bodyOk = payload?.ok === true;
    return {
      ok: response.status === 200 && bodyOk,
      status: response.status,
      expected_status: 200,
      body_ok: bodyOk,
      payload,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), expected_status: 200 };
  }
}

async function probeReadinessBoundary(url, fetcher) {
  try {
    const response = await fetcher(url, { redirect: "follow" });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const checks = payload?.checks;
    const observedCheckNames = checks && typeof checks === "object" && !Array.isArray(checks)
      ? Object.keys(checks)
      : [];
    const exactCheckSet = hasExactKeys(checks, EXPECTED_READINESS_CHECKS);
    const missingChecks = EXPECTED_READINESS_CHECKS.filter(
      (name) => !observedCheckNames.includes(name),
    );
    const unexpectedChecks = observedCheckNames.filter(
      (name) => !EXPECTED_READINESS_CHECKS.includes(name),
    );
    const booleanCheckValues = exactCheckSet
      && EXPECTED_READINESS_CHECKS.every((name) => typeof checks[name] === "boolean");
    const blockingChecks = REQUIRED_NONPROVIDER_CONTROL_CHECKS.filter(
      (name) => checks?.[name] !== true,
    );
    const allowedStatus = response.status === 200 || response.status === 503;
    const allChecksReady = booleanCheckValues
      && EXPECTED_READINESS_CHECKS.every((name) => checks[name] === true);
    const statusBodyConsistent = (response.status === 200) === (payload?.ok === true);
    const checksBodyConsistent = exactCheckSet && payload?.ok === allChecksReady;
    const maintenanceReady = allowedStatus
      && exactCheckSet
      && booleanCheckValues
      && statusBodyConsistent
      && checksBodyConsistent
      && blockingChecks.length === 0
      && payload?.secrets_included === false;
    const serviceFullyReady = maintenanceReady
      && response.status === 200
      && allChecksReady;
    return {
      ok: maintenanceReady,
      status: response.status,
      accepted_statuses: [200, 503],
      service_fully_ready: serviceFullyReady,
      exact_check_set: exactCheckSet,
      boolean_check_values: booleanCheckValues,
      status_body_consistent: statusBodyConsistent,
      checks_body_consistent: checksBodyConsistent,
      missing_checks: missingChecks,
      unexpected_checks: unexpectedChecks,
      required_nonprovider_controls_ready: blockingChecks.length === 0,
      required_nonprovider_checks: REQUIRED_NONPROVIDER_CONTROL_CHECKS,
      blocking_checks: blockingChecks,
      nonblocking_provider_checks: {
        recording_identity: checks?.recording_identity === true,
        lyric_candidate_discovery: checks?.lyric_candidate_discovery === true,
      },
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      accepted_statuses: [200, 503],
      required_nonprovider_checks: REQUIRED_NONPROVIDER_CONTROL_CHECKS,
    };
  }
}

async function probeHarryCapabilityContract(apiOrigin, fetcher) {
  try {
    const [
      versionResponse,
      contractResponse,
      selfTestResponse,
      providerGatesResponse,
      runtimePrivacyResponse,
    ] = await Promise.all([
      fetcher(`${apiOrigin}/api/version`, { redirect: "follow" }),
      fetcher(`${apiOrigin}/api/product-contract`, { redirect: "follow" }),
      fetcher(`${apiOrigin}/api/capabilities/harry-v36/self-test`, { redirect: "follow" }),
      fetcher(`${apiOrigin}/api/capabilities/provider-payment-gates`, { redirect: "follow" }),
      fetcher(`${apiOrigin}/api/capabilities/runtime-privacy`, { redirect: "follow" }),
    ]);
    const [version, contract, selfTest, providerGates, runtimePrivacy] = await Promise.all([
      versionResponse.json().catch(() => null),
      contractResponse.json().catch(() => null),
      selfTestResponse.json().catch(() => null),
      providerGatesResponse.json().catch(() => null),
      runtimePrivacyResponse.json().catch(() => null),
    ]);
    const analyzer = version?.analyzer;
    const manifest = analyzer?.capability_manifest;
    const contractManifest = contract?.analyzer?.capability_manifest;
    const contractGate = contract?.commercial_license_gate;
    const contractPlans = contract?.pricing?.plans;
    const checks = {
      endpoints: versionResponse.status === 200
        && contractResponse.status === 200
        && selfTestResponse.status === 200
        && providerGatesResponse.status === 200
        && runtimePrivacyResponse.status === 200,
      deployed_commit: version?.commit_sha === ANALYZER_API_RELEASE_COMMIT,
      living_identity: version?.analyzer_label === ANALYZER_IDENTITY
        && analyzer?.versioned_label === ANALYZER_IDENTITY
        && analyzer?.identity_revision === ANALYZER_IDENTITY_REVISION
        && analyzer?.scientific_v_series === "V36",
      exact_capabilities: capabilitiesAreExact(manifest),
      runtime_capabilities_exercised: runtimeSelfTestIsExact(selfTest, manifest),
      provider_payment_gates_closed: closedProviderPaymentGates(providerGates),
      deployed_application_root_private: deployedApplicationRootIsPrivate(runtimePrivacy),
      product_contract_binding: contract?.analyzer?.versioned_label === ANALYZER_IDENTITY
        && canonicalJson(contractManifest) === canonicalJson(manifest),
      paid_scanning_closed: contract?.paid_public_scanning === "closed",
      payment_gate_closed: canonicalJson(contractGate) === canonicalJson({
        approved: false,
        approval_revision: null,
        status: "formal_licence_required",
        paid_traffic_requested: false,
        paid_traffic_authorized: false,
      }),
      all_checkout_closed: Array.isArray(contractPlans)
        && new Set(contractPlans.map((plan) => plan?.id)).size === 4
        && ["single_scan", "pro_monthly", "pro_annual", "enterprise_annual"]
          .every((id) => contractPlans.some((plan) => plan?.id === id))
        && contractPlans.every((plan) => plan?.checkout_enabled === false),
    };
    return {
      ok: Object.values(checks).every(Boolean),
      checks,
      api_commit: checks.deployed_commit ? version.commit_sha : null,
      analyzer_label: analyzer?.versioned_label || null,
      identity_revision: analyzer?.identity_revision || null,
      capability_manifest_revision: manifest?.revision || null,
      capability_manifest_sha256: manifest?.sha256 || null,
      runtime_self_test_sha256: selfTest?.self_test_sha256 || null,
      runtime_application_manifest_sha256: runtimePrivacy?.application_manifest_sha256 || null,
      paid_public_scanning: contract?.paid_public_scanning || null,
      secrets_included: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      secrets_included: false,
    };
  }
}

export async function probeGoogleProviderConfiguration(url, fetcher = fetch) {
  try {
    const response = await fetcher(url, webRequestOptions("follow"));
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const authConfig = payload?.auth_config || {};
    const displayConfig = payload?.display_config || {};
    const google = payload?.user_settings?.social?.oauth_google || {};
    const checks = {
      production_instance: displayConfig.instance_environment_type === "production",
      identification_strategy: Array.isArray(authConfig.identification_strategies)
        && authConfig.identification_strategies.includes("oauth_google"),
      first_factor: Array.isArray(authConfig.first_factors)
        && authConfig.first_factors.includes("oauth_google"),
      enabled: google.enabled === true,
      authenticatable: google.authenticatable === true,
      selectable: google.not_selectable === false,
      subaddresses_blocked: google.block_email_subaddresses === true,
      privacy_policy: displayConfig.privacy_policy_url === "https://soniccheck.io/privacy/",
      terms: displayConfig.terms_url === "https://soniccheck.io/terms/",
    };

    return {
      ok: response.status === 200 && Object.values(checks).every(Boolean),
      status: response.status,
      checks,
      provider: google.name || "Google",
      strategy: google.strategy || "oauth_google",
      scope: "public_configuration_only",
      end_to_end_acceptance_required: true,
      secrets_included: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      scope: "public_configuration_only",
      end_to_end_acceptance_required: true,
      secrets_included: false,
    };
  }
}

export async function probeDeployment({
  expectedCommit,
  origins = DEFAULTS,
  fetcher = fetch,
} = {}) {
  if (!expectedCommit) throw new Error("expectedCommit is required");
  const [landing, login, join, privacy, terms, appRoute, www, legacyApp, health, readiness, harryCapabilityContract, googleProviderConfig] = await Promise.all([
    probePage(origins.apex, "/", expectedCommit, fetcher),
    probePage(origins.apex, "/login", expectedCommit, fetcher, { requireAuth: true }),
    probePage(origins.apex, "/join", expectedCommit, fetcher, { requireAuth: true }),
    probePage(origins.apex, "/privacy/", expectedCommit, fetcher, {
      expectedCanonical: "https://soniccheck.io/privacy/",
    }),
    probePage(origins.apex, "/terms/", expectedCommit, fetcher, {
      expectedCanonical: "https://soniccheck.io/terms/",
    }),
    probePage(origins.apex, "/app", expectedCommit, fetcher, { requireAuth: true }),
    probeRedirect(`${origins.www}/v17-routing?source=deployment-truth`, `${origins.apex}/v17-routing?source=deployment-truth`, fetcher),
    probeRedirect(`${origins.app}/legacy?source=deployment-truth`, `${origins.apex}/app?source=deployment-truth`, fetcher),
    probeHealth(`${origins.api}/api/healthz`, fetcher),
    probeReadinessBoundary(`${origins.api}/api/readyz`, fetcher),
    probeHarryCapabilityContract(origins.api, fetcher),
    probeGoogleProviderConfiguration(`${origins.clerk}/v1/environment`, fetcher),
  ]);
  const checks = {
    landing,
    login,
    join,
    privacy,
    terms,
    app: appRoute,
    www_redirect: www,
    legacy_app_redirect: legacyApp,
    api_health: health,
    api_readiness: readiness,
    harry_capability_contract: harryCapabilityContract,
    google_provider_config: googleProviderConfig,
  };
  const maintenanceVerificationPassed = Object.values(checks).every((check) => check.ok);
  return {
    schema_version: "soniccheck-deployment-truth/1.1.0",
    verification_scope: "WEB_RELEASE_AND_HARRY_V34_V36_MAINTENANCE",
    expected_commit: expectedCommit,
    origins,
    ok: maintenanceVerificationPassed,
    api_service_fully_ready_observed: readiness.service_fully_ready === true,
    full_service_launch_readiness_claimed: false,
    checks,
  };
}

export async function probeDeploymentWithRetry({
  expectedCommit,
  origins = DEFAULTS,
  fetcher = fetch,
  attempts = 1,
  intervalMs = 0,
  sleeper = (delay) => new Promise((resolveSleep) => setTimeout(resolveSleep, delay)),
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("attempts must be a positive integer");
  }
  if (!Number.isInteger(intervalMs) || intervalMs < 0) {
    throw new Error("intervalMs must be a non-negative integer");
  }

  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await probeDeployment({ expectedCommit, origins, fetcher });
    result.attempt = attempt;
    result.max_attempts = attempts;
    if (result.ok || attempt === attempts) return result;
    await sleeper(intervalMs);
  }

  return result;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function integerArgument(name, fallback) {
  const raw = argument(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = argument("--output");
  const result = await probeDeploymentWithRetry({
    expectedCommit: argument("--expected-commit"),
    attempts: integerArgument("--attempts", 1),
    intervalMs: integerArgument("--interval-ms", 0),
  });
  if (output) writeFileSync(resolve(output), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

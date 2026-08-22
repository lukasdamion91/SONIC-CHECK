import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";


const DEFAULTS = {
  apex: "https://soniccheck.io",
  www: "https://www.soniccheck.io",
  app: "https://app.soniccheck.io",
  api: "https://api.soniccheck.io",
};

const REQUIRED_CONTROLLED_BETA_CHECKS = [
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

function deploymentCommit(html) {
  return html.match(/<meta\s+name=["']soniccheck-deployment-commit["']\s+content=["']([^"']*)["']/i)?.[1] || "";
}

function authConfigured(html) {
  return html.match(/<meta\s+name=["']soniccheck-auth-configured["']\s+content=["']([^"']*)["']/i)?.[1] === "true";
}

async function probePage(base, path, expectedCommit, fetcher, { requireAuth = false } = {}) {
  try {
    const response = await fetcher(`${base}${path}`, { redirect: "follow" });
    const body = await response.text();
    const observedCommit = deploymentCommit(body);
    return {
      ok: (
        response.status === 200
        && observedCommit === expectedCommit
        && (!requireAuth || authConfigured(body))
      ),
      path,
      status: response.status,
      final_url: response.url,
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
    const response = await fetcher(url, { redirect: "manual" });
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

async function probeJson(url, expectedStatus, fetcher) {
  try {
    const response = await fetcher(url, { redirect: "follow" });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return {
      ok: response.status === expectedStatus,
      status: response.status,
      expected_status: expectedStatus,
      payload,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error), expected_status: expectedStatus };
  }
}

async function probeControlledBetaReadiness(url, fetcher) {
  try {
    const response = await fetcher(url, { redirect: "follow" });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const checks = payload?.checks || {};
    const blockingChecks = REQUIRED_CONTROLLED_BETA_CHECKS.filter((name) => checks[name] !== true);
    const allowedStatus = response.status === 200 || response.status === 503;
    return {
      ok: allowedStatus && blockingChecks.length === 0 && payload?.secrets_included === false,
      status: response.status,
      accepted_statuses: [200, 503],
      service_fully_ready: response.status === 200 && payload?.ok === true,
      controlled_beta_ready: blockingChecks.length === 0,
      required_checks: REQUIRED_CONTROLLED_BETA_CHECKS,
      blocking_checks: blockingChecks,
      nonblocking_provider_checks: {
        recording_identity: checks.recording_identity === true,
        lyric_candidate_discovery: checks.lyric_candidate_discovery === true,
      },
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      accepted_statuses: [200, 503],
      required_checks: REQUIRED_CONTROLLED_BETA_CHECKS,
    };
  }
}

export async function probeDeployment({
  expectedCommit,
  origins = DEFAULTS,
  fetcher = fetch,
} = {}) {
  if (!expectedCommit) throw new Error("expectedCommit is required");
  const [landing, login, join, appRoute, www, legacyApp, health, readiness] = await Promise.all([
    probePage(origins.apex, "/", expectedCommit, fetcher),
    probePage(origins.apex, "/login", expectedCommit, fetcher, { requireAuth: true }),
    probePage(origins.apex, "/join", expectedCommit, fetcher, { requireAuth: true }),
    probePage(origins.apex, "/app", expectedCommit, fetcher, { requireAuth: true }),
    probeRedirect(`${origins.www}/v17-routing?source=deployment-truth`, `${origins.apex}/v17-routing?source=deployment-truth`, fetcher),
    probeRedirect(`${origins.app}/legacy?source=deployment-truth`, `${origins.apex}/app?source=deployment-truth`, fetcher),
    probeJson(`${origins.api}/api/healthz`, 200, fetcher),
    probeControlledBetaReadiness(`${origins.api}/api/readyz`, fetcher),
  ]);
  const checks = { landing, login, join, app: appRoute, www_redirect: www, legacy_app_redirect: legacyApp, api_health: health, api_readiness: readiness };
  return {
    schema_version: "soniccheck-deployment-truth/1.0.0",
    expected_commit: expectedCommit,
    origins,
    ok: Object.values(checks).every((check) => check.ok),
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

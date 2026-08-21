import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";


const DEFAULTS = {
  apex: "https://soniccheck.io",
  www: "https://www.soniccheck.io",
  app: "https://app.soniccheck.io",
  api: "https://api.soniccheck.io",
};

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
    probeJson(`${origins.api}/api/readyz`, 200, fetcher),
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

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = argument("--output");
  const result = await probeDeployment({ expectedCommit: argument("--expected-commit") });
  if (output) writeFileSync(resolve(output), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

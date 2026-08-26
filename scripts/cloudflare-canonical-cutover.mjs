import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const DOMAIN = "soniccheck.io";
const GITHUB_PAGES_IPV4 = [
  "185.199.108.153",
  "185.199.109.153",
  "185.199.110.153",
  "185.199.111.153",
];
const MANAGED_RECORD_TYPES = new Set(["A", "AAAA", "CNAME"]);
const WWW_REDIRECT_REF = "soniccheck_redirect_www_canonical";
const LEGACY_REDIRECT_REF = "soniccheck_redirect_app_legacy";
const SPA_REWRITE_REF = "soniccheck_rewrite_canonical_spa";
const HARDENED_EDGE_SETTINGS = Object.freeze({
  always_use_https: "on",
  min_tls_version: "1.2",
});

export function normalizeToken(value) {
  let token = String(value || "").trim();
  token = token.replace(/^CLOUDFLARE_(?:READ_TOKEN|API_TOKEN)\s*=\s*/i, "").trim();
  token = token.replace(/^Bearer\s+/i, "").trim();
  if (
    token.length >= 2
    && ((token.startsWith('"') && token.endsWith('"'))
      || (token.startsWith("'") && token.endsWith("'")))
  ) {
    token = token.slice(1, -1).trim();
  }
  return token;
}

function errors(payload) {
  return Array.isArray(payload?.errors)
    ? payload.errors.map(({ code, message }) => ({ code, message }))
    : [];
}

export async function cloudflareRequest(path, token, options = {}) {
  if (!path.startsWith("/")) throw new Error("Cloudflare API path must start with '/'.");
  if (!token) throw new Error("A Cloudflare API token is required.");
  const method = options.method || "GET";
  const response = await (options.fetchImpl || fetch)(`${options.apiRoot || API_ROOT}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal || AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { success: false, errors: [{ code: "NON_JSON", message: "Non-JSON response" }] };
  }
  if (!response.ok || payload.success === false) {
    const codes = errors(payload).map(({ code }) => code).join(",") || "unknown";
    throw new Error(`Cloudflare ${method} ${path} failed (HTTP ${response.status}; codes ${codes}).`);
  }
  return payload.result;
}

export function validateState(state) {
  if (state?.schema_version !== "soniccheck-cloudflare-cutover/1.0.0") {
    throw new Error("Unexpected Cloudflare cutover state schema.");
  }
  if (!new Set(["canonical", "retire_legacy"]).has(state.phase)) {
    throw new Error("Cutover phase must be canonical or retire_legacy.");
  }
  if (state.canonical_origin !== "https://soniccheck.io") {
    throw new Error("Canonical origin does not match the approved apex.");
  }
  if (state.api_origin !== "https://api.soniccheck.io") {
    throw new Error("API origin cannot be changed by the web cutover.");
  }
  if (state.paid_public_traffic_enabled !== false) {
    throw new Error("DNS cutover cannot enable paid public traffic.");
  }
  return state;
}

export function desiredRecords(phase) {
  const records = [
    ...GITHUB_PAGES_IPV4.map((content) => ({
      type: "A",
      name: DOMAIN,
      content,
      ttl: 3600,
      proxied: true,
      comment: "SONIC CHECK canonical GitHub Pages apex",
    })),
    {
      type: "A",
      name: `www.${DOMAIN}`,
      content: "192.0.2.1",
      ttl: 1,
      proxied: true,
      comment: "SONIC CHECK www host; Cloudflare redirect only",
    },
  ];
  if (phase === "retire_legacy") {
    records.push({
      type: "A",
      name: `app.${DOMAIN}`,
      content: "192.0.2.1",
      ttl: 1,
      proxied: true,
      comment: "SONIC CHECK retired legacy host; Cloudflare redirect only",
    });
  }
  return records;
}

export function desiredEdgeSettings() {
  return { ...HARDENED_EDGE_SETTINGS };
}

function editableRule(rule) {
  const copy = structuredClone(rule);
  delete copy.id;
  delete copy.version;
  delete copy.last_updated;
  return copy;
}

export function legacyRedirectRule() {
  return {
    ref: LEGACY_REDIRECT_REF,
    description: "Retire obsolete SONIC CHECK app host to the canonical protected app",
    expression: '(http.host eq "app.soniccheck.io")',
    action: "redirect",
    action_parameters: {
      from_value: {
        target_url: { value: "https://soniccheck.io/app" },
        status_code: 301,
        preserve_query_string: true,
      },
    },
    enabled: true,
  };
}

export function wwwRedirectRule() {
  return {
    ref: WWW_REDIRECT_REF,
    description: "Converge SONIC CHECK www traffic on the canonical apex",
    expression: '(http.host eq "www.soniccheck.io")',
    action: "redirect",
    action_parameters: {
      from_value: {
        target_url: {
          expression: 'concat("https://soniccheck.io", http.request.uri.path)',
        },
        status_code: 301,
        preserve_query_string: true,
      },
    },
    enabled: true,
  };
}

export function mergeCanonicalRedirects(existingRules = [], phase = "canonical") {
  const managedRefs = new Set([WWW_REDIRECT_REF, LEGACY_REDIRECT_REF]);
  return [
    ...existingRules
      .filter((rule) => !managedRefs.has(rule.ref))
      .map(editableRule),
    wwwRedirectRule(),
    ...(phase === "retire_legacy" ? [legacyRedirectRule()] : []),
  ];
}

export function canonicalSpaRewriteRule() {
  return {
    ref: SPA_REWRITE_REF,
    description: "Serve SONIC CHECK browser routes from the canonical SPA entry point",
    expression: [
      '(http.host eq "soniccheck.io" and (',
      'http.request.uri.path in {"/login" "/join" "/register" "/signup" "/signin" "/pricing" "/privacy" "/terms" "/dashboard" "/library" "/payment-success" "/scan/new" "/app"}',
      ' or starts_with(http.request.uri.path, "/verify/")',
      ' or starts_with(http.request.uri.path, "/scan/")',
      ' or starts_with(http.request.uri.path, "/app/")',
      '))',
    ].join(""),
    action: "rewrite",
    action_parameters: {
      uri: {
        path: { value: "/index.html" },
      },
    },
    enabled: true,
  };
}

export function mergeCanonicalRewrites(existingRules = []) {
  return [
    ...existingRules
      .filter((rule) => rule.ref !== SPA_REWRITE_REF)
      .map(editableRule),
    canonicalSpaRewriteRule(),
  ];
}

function recordKey(record) {
  return `${record.type}|${record.name.toLowerCase()}|${String(record.content).toLowerCase()}`;
}

async function replaceManagedRecords(zoneId, token, allRecords, desired, options = {}) {
  const names = new Set(desired.map(({ name }) => name.toLowerCase()));
  const existing = allRecords.filter(
    (record) => names.has(String(record.name).toLowerCase()) && MANAGED_RECORD_TYPES.has(record.type),
  );
  const desiredByKey = new Map(desired.map((record) => [recordKey(record), record]));
  const retained = new Map();

  for (const record of existing) {
    const key = recordKey(record);
    if (desiredByKey.has(key) && !retained.has(key)) {
      retained.set(key, record);
    } else {
      await cloudflareRequest(`/zones/${zoneId}/dns_records/${record.id}`, token, {
        ...options,
        method: "DELETE",
      });
    }
  }

  for (const record of desired) {
    const current = retained.get(recordKey(record));
    await cloudflareRequest(
      current
        ? `/zones/${zoneId}/dns_records/${current.id}`
        : `/zones/${zoneId}/dns_records`,
      token,
      { ...options, method: current ? "PUT" : "POST", body: record },
    );
  }
}

async function readPhaseRuleset(zoneId, token, phase, options = {}) {
  const listed = await cloudflareRequest(`/zones/${zoneId}/rulesets`, token, options);
  const summary = (listed || []).find(
    ({ kind, phase: listedPhase }) => kind === "zone" && listedPhase === phase,
  );
  if (!summary) return null;
  return cloudflareRequest(`/zones/${zoneId}/rulesets/${summary.id}`, token, options);
}

async function readRedirectRuleset(zoneId, token, options = {}) {
  return readPhaseRuleset(zoneId, token, "http_request_dynamic_redirect", options);
}

async function readTransformRuleset(zoneId, token, options = {}) {
  return readPhaseRuleset(zoneId, token, "http_request_transform", options);
}

async function upsertCanonicalRedirects(zoneId, token, existing, phase, options = {}) {
  const body = {
    name: existing?.name || "SONIC CHECK redirect rules",
    description: existing?.description || "Canonical host convergence redirects",
    kind: "zone",
    phase: "http_request_dynamic_redirect",
    rules: mergeCanonicalRedirects(existing?.rules || [], phase),
  };
  return cloudflareRequest(
    existing ? `/zones/${zoneId}/rulesets/${existing.id}` : `/zones/${zoneId}/rulesets`,
    token,
    { ...options, method: existing ? "PUT" : "POST", body },
  );
}

async function upsertCanonicalSpaRewrite(zoneId, token, existing, options = {}) {
  const body = {
    name: existing?.name || "SONIC CHECK URL rewrites",
    description: existing?.description || "Canonical SPA route rewrites",
    kind: "zone",
    phase: "http_request_transform",
    rules: mergeCanonicalRewrites(existing?.rules || []),
  };
  return cloudflareRequest(
    existing ? `/zones/${zoneId}/rulesets/${existing.id}` : `/zones/${zoneId}/rulesets`,
    token,
    { ...options, method: existing ? "PUT" : "POST", body },
  );
}

async function readEdgeSettings(zoneId, token, options = {}) {
  const entries = await Promise.all(
    Object.keys(HARDENED_EDGE_SETTINGS).map(async (setting) => {
      const result = await cloudflareRequest(`/zones/${zoneId}/settings/${setting}`, token, options);
      return [setting, result];
    }),
  );
  return Object.fromEntries(entries);
}

async function reconcileEdgeSettings(zoneId, token, current, options = {}) {
  const desired = desiredEdgeSettings();
  for (const [setting, value] of Object.entries(desired)) {
    const observed = current[setting];
    if (!observed) throw new Error(`Cloudflare edge setting ${setting} was not readable.`);
    if (observed.value === value) continue;
    if (observed.editable === false) {
      throw new Error(`Cloudflare edge setting ${setting} is not editable for this zone.`);
    }
    await cloudflareRequest(`/zones/${zoneId}/settings/${setting}`, token, {
      ...options,
      method: "PATCH",
      body: { value },
    });
  }
}

function publicRecord(record) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    comment: record.comment || null,
  };
}

export async function executeCutover(state, token, options = {}) {
  validateState(state);
  const zones = await cloudflareRequest(
    `/zones?${new URLSearchParams({ name: DOMAIN, status: "active", per_page: "50" })}`,
    token,
    options,
  );
  if (!Array.isArray(zones) || zones.length !== 1 || zones[0].name !== DOMAIN) {
    throw new Error(`Expected one active ${DOMAIN} zone.`);
  }
  const zoneId = zones[0].id;
  const records = await cloudflareRequest(`/zones/${zoneId}/dns_records?per_page=5000`, token, options);
  const redirectRuleset = await readRedirectRuleset(zoneId, token, options);
  const transformRuleset = await readTransformRuleset(zoneId, token, options);
  const edgeSettings = await readEdgeSettings(zoneId, token, options);
  const touchedNames = new Set([DOMAIN, `www.${DOMAIN}`, `app.${DOMAIN}`]);
  const before = {
    schema_version: "soniccheck-cloudflare-rollback/1.0.0",
    captured_at: new Date().toISOString(),
    phase: state.phase,
    zone_id: zoneId,
    touched_records: records.filter(({ name }) => touchedNames.has(name)).map(publicRecord),
    redirect_ruleset: redirectRuleset,
    transform_ruleset: transformRuleset,
    edge_settings: Object.fromEntries(
      Object.entries(edgeSettings).map(([setting, value]) => [setting, {
        value: value.value,
        editable: value.editable,
      }]),
    ),
    secrets_included: false,
  };
  writeFileSync(options.rollbackPath || "cloudflare-cutover-rollback.json", `${JSON.stringify(before, null, 2)}\n`, { mode: 0o600 });

  await replaceManagedRecords(zoneId, token, records, desiredRecords(state.phase), options);
  await upsertCanonicalRedirects(zoneId, token, redirectRuleset, state.phase, options);
  await upsertCanonicalSpaRewrite(zoneId, token, transformRuleset, options);
  if (state.phase === "retire_legacy") {
    await reconcileEdgeSettings(zoneId, token, edgeSettings, options);
  }

  const afterRecords = await cloudflareRequest(`/zones/${zoneId}/dns_records?per_page=5000`, token, options);
  const afterRuleset = await readRedirectRuleset(zoneId, token, options);
  const afterTransformRuleset = await readTransformRuleset(zoneId, token, options);
  const afterEdgeSettings = await readEdgeSettings(zoneId, token, options);
  const result = {
    schema_version: "soniccheck-cloudflare-cutover-result/1.0.0",
    completed_at: new Date().toISOString(),
    phase: state.phase,
    records: afterRecords.filter(({ name }) => touchedNames.has(name)).map(publicRecord),
    legacy_redirect_present: Boolean(
      afterRuleset?.rules?.some(({ ref, enabled }) => ref === LEGACY_REDIRECT_REF && enabled),
    ),
    www_redirect_present: Boolean(
      afterRuleset?.rules?.some(({ ref, enabled }) => ref === WWW_REDIRECT_REF && enabled),
    ),
    spa_rewrite_present: Boolean(
      afterTransformRuleset?.rules?.some(({ ref, enabled }) => ref === SPA_REWRITE_REF && enabled),
    ),
    edge_settings: Object.fromEntries(
      Object.entries(afterEdgeSettings).map(([setting, value]) => [setting, value.value]),
    ),
    edge_hardening_requested: state.phase === "retire_legacy",
    edge_hardened: Object.entries(desiredEdgeSettings()).every(
      ([setting, value]) => afterEdgeSettings[setting]?.value === value,
    ),
    api_record_touched: false,
    paid_public_traffic_enabled: false,
    secrets_included: false,
  };
  writeFileSync(options.resultPath || "cloudflare-cutover-result.json", `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}

async function main() {
  const statePath = process.env.CUTOVER_STATE_PATH || "operations/cloudflare-cutover-state.json";
  const state = validateState(JSON.parse(readFileSync(statePath, "utf8")));
  const token = normalizeToken(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_READ_TOKEN);
  const result = await executeCutover(state, token, {
    rollbackPath: process.env.CUTOVER_ROLLBACK_OUTPUT,
    resultPath: process.env.CUTOVER_RESULT_OUTPUT,
  });
  console.log(JSON.stringify({
    phase: result.phase,
    managed_record_count: result.records.length,
    legacy_redirect_present: result.legacy_redirect_present,
    www_redirect_present: result.www_redirect_present,
    spa_rewrite_present: result.spa_rewrite_present,
    edge_hardening_requested: result.edge_hardening_requested,
    edge_hardened: result.edge_hardened,
    api_record_touched: result.api_record_touched,
    paid_public_traffic_enabled: result.paid_public_traffic_enabled,
  }, null, 2));
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`Cloudflare canonical cutover failed: ${error.message}`);
    process.exitCode = 1;
  });
}

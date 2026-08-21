import {
  constants as cryptoConstants,
  createCipheriv,
  createHash,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.cloudflare.com/client/v4";
const DOMAIN = "soniccheck.io";

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

function responseErrors(payload) {
  return Array.isArray(payload?.errors)
    ? payload.errors.map(({ code, message }) => ({ code, message }))
    : [];
}

export function classifyCloudflareFailure(response) {
  const message = Array.isArray(response?.errors)
    ? response.errors.map(({ message: value }) => String(value || "")).join(" ").toLowerCase()
    : "";

  if (message.includes("location")) return "TOKEN_LOCATION_RESTRICTED";
  if (message.includes("unauthorized to access requested resource")) {
    return "TOKEN_RESOURCE_UNAUTHORIZED";
  }
  if (message.includes("invalid access token")) return "TOKEN_INVALID_OR_REVOKED";
  if (message.includes("invalid request headers") || message.includes("authorization header")) {
    return "TOKEN_HEADER_INVALID";
  }
  return "UNCLASSIFIED";
}

export async function cloudflareGet(path, token, options = {}) {
  if (!path.startsWith("/")) throw new Error("Cloudflare API path must start with '/'.");
  if (!token) throw new Error("CLOUDFLARE_READ_TOKEN is required.");

  const fetchImpl = options.fetchImpl || fetch;
  const apiRoot = options.apiRoot || API_ROOT;
  const response = await fetchImpl(`${apiRoot}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal || AbortSignal.timeout(20_000),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { success: false, errors: [{ code: "NON_JSON", message: "Non-JSON response" }] };
  }

  return {
    path,
    status: response.status,
    success: response.ok && payload.success !== false,
    errors: responseErrors(payload),
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    result_info: payload.result_info || null,
    result: payload.result ?? null,
  };
}

function resultCount(response) {
  if (Array.isArray(response?.result)) return response.result.length;
  return response?.result == null ? 0 : 1;
}

async function settledGet(path, token, options) {
  try {
    return await cloudflareGet(path, token, options);
  } catch (error) {
    return {
      path,
      status: 0,
      success: false,
      errors: [{ code: "REQUEST_FAILED", message: error.message }],
      messages: [],
      result_info: null,
      result: null,
    };
  }
}

export async function collectInventory(token, options = {}) {
  const query = new URLSearchParams({ name: DOMAIN, status: "active", per_page: "50" });
  const zoneLookup = await cloudflareGet(`/zones?${query}`, token, options);
  if (!zoneLookup.success) {
    const codes = zoneLookup.errors.map(({ code }) => code).join(",") || "unknown";
    const category = classifyCloudflareFailure(zoneLookup);
    throw new Error(
      `Cloudflare zone lookup failed (HTTP ${zoneLookup.status}; codes ${codes}; category ${category}).`,
    );
  }

  const zones = Array.isArray(zoneLookup.result) ? zoneLookup.result : [];
  if (zones.length !== 1) {
    throw new Error(`Expected one active ${DOMAIN} zone; received ${zones.length}.`);
  }

  const zone = zones[0];
  const zoneId = zone.id;
  const accountId = zone.account?.id;
  if (!zoneId || !accountId) throw new Error("Cloudflare zone or account identifier is missing.");

  const settingNames = [
    "ssl",
    "always_use_https",
    "automatic_https_rewrites",
    "min_tls_version",
    "tls_1_3",
    "http3",
    "development_mode",
    "security_level",
    "cache_level",
    "browser_cache_ttl",
  ];

  const endpointPaths = {
    dns_records: `/zones/${zoneId}/dns_records?per_page=5000`,
    dnssec: `/zones/${zoneId}/dnssec`,
    rulesets: `/zones/${zoneId}/rulesets`,
    page_rules: `/zones/${zoneId}/pagerules?per_page=100`,
    workers_routes: `/zones/${zoneId}/workers/routes`,
    universal_ssl: `/zones/${zoneId}/ssl/universal/settings`,
    pages_projects: `/accounts/${accountId}/pages/projects?per_page=100`,
  };

  const endpointEntries = await Promise.all(
    Object.entries(endpointPaths).map(async ([name, path]) => [name, await settledGet(path, token, options)]),
  );
  const endpoints = Object.fromEntries(endpointEntries);

  const settingEntries = await Promise.all(
    settingNames.map(async (name) => [
      name,
      await settledGet(`/zones/${zoneId}/settings/${name}`, token, options),
    ]),
  );
  const settings = Object.fromEntries(settingEntries);

  const listedRulesets = Array.isArray(endpoints.rulesets?.result) ? endpoints.rulesets.result : [];
  const rulesetDetailsEntries = await Promise.all(
    listedRulesets.slice(0, 100).map(async (ruleset) => [
      ruleset.id,
      await settledGet(`/zones/${zoneId}/rulesets/${ruleset.id}`, token, options),
    ]),
  );

  return {
    meta: {
      generated_at: new Date().toISOString(),
      domain: DOMAIN,
      mode: "read-only",
      api_methods: ["GET"],
    },
    zone_lookup: zoneLookup,
    zone,
    endpoints,
    settings,
    ruleset_details: Object.fromEntries(rulesetDetailsEntries),
  };
}

export function encryptInventory(report, publicKeyPem) {
  const plaintext = Buffer.from(JSON.stringify(report, null, 2));
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedKey = publicEncrypt(
    {
      key: publicKeyPem,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    dataKey,
  );

  return {
    format: "soniccheck-cloudflare-inventory-v1",
    key_algorithm: "RSA-OAEP-3072-SHA256",
    data_algorithm: "AES-256-GCM",
    encrypted_key: encryptedKey.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    plaintext_sha256: createHash("sha256").update(plaintext).digest("hex"),
  };
}

export function safeSummary(report) {
  const endpointSummary = Object.fromEntries(
    Object.entries(report.endpoints).map(([name, response]) => [name, {
      status: response.status,
      success: response.success,
      count: resultCount(response),
      error_codes: response.errors.map(({ code }) => code),
    }]),
  );
  const cutoverHosts = new Set([
    "soniccheck.io",
    "www.soniccheck.io",
    "app.soniccheck.io",
    "api.soniccheck.io",
  ]);
  const dnsRecords = Array.isArray(report.endpoints?.dns_records?.result)
    ? report.endpoints.dns_records.result
      .filter((record) => cutoverHosts.has(String(record?.name || "").toLowerCase()))
      .map((record) => ({
        name: String(record.name || "").toLowerCase(),
        type: String(record.type || ""),
        content: String(record.content || ""),
        proxied: Boolean(record.proxied),
        ttl: Number(record.ttl || 0),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)
        || left.type.localeCompare(right.type)
        || left.content.localeCompare(right.content))
    : [];
  return {
    domain: report.meta.domain,
    mode: report.meta.mode,
    zone_found: Boolean(report.zone?.id),
    public_cutover_dns: dnsRecords,
    endpoints: endpointSummary,
    settings_readable: Object.values(report.settings).filter(({ success }) => success).length,
    ruleset_details_readable: Object.values(report.ruleset_details).filter(({ success }) => success).length,
  };
}

async function main() {
  const token = normalizeToken(process.env.CLOUDFLARE_READ_TOKEN);
  const publicKeyPath = process.env.INVENTORY_PUBLIC_KEY_PATH
    || ".github/cloudflare-inventory-encryption.pub";
  const outputPath = process.env.INVENTORY_OUTPUT
    || "cloudflare-inventory.enc.json";

  const report = await collectInventory(token);
  const publicKey = readFileSync(publicKeyPath, "utf8");
  const envelope = encryptInventory(report, publicKey);
  writeFileSync(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(safeSummary(report), null, 2));
  console.log(`Encrypted inventory written to ${outputPath}.`);
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`Read-only inventory failed: ${error.message}`);
    process.exitCode = 1;
  });
}
